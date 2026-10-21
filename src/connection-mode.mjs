// LocoNet ansluten eller ej ansluten (0.78.0, språket sedan 0.79.0). Ansluten ('live'): TKL styr banan över LocoNet, med
// en LocoBuffer på USB eller en BTLocoBridge över Bluetooth (0.83.0) som TKL själv startar gatewayen för
// (scripts/locobuffer-gateway.mjs), och återrapporterna kommer från banan. Ej ansluten ('offline'): TKL svarar själv på sina order och kör trafikspelets tåg (src/field.mjs i den
// lokala processen src/simulator.mjs). Valet sparas i connection.json och gäller efter omstart: var LocoNet ansluten
// ansluter TKL igen. Kärnan är densamma; bara förbindelsen byts. Villkoren för bytet (inga lås) avgör servern.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

const BAUDS = ['9600', '19200', '38400', '57600', '115200'], FLOWS = ['none', 'rtscts'];
// Två anslutningar till banan: en LocoBuffer på USB och Möllehems BTLocoBridge över Bluetooth. Bluetooth-kortet
// anges med sin adress (Raspberry Pi, RFCOMM) eller med den parade serieporten systemet skapar åt det (Mac,
// /dev/cu.…). Kortet paras i datorn först; TKL ansluter bara till det.
export const ADAPTERS = ['locobuffer', 'btlocobridge'];
export const ADAPTER_LABEL = { locobuffer: 'LocoBuffer (USB)', btlocobridge: 'BTLocoBridge (Bluetooth)' };
const ADDRESS = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
const DEVICE = /^\/dev\/[^\s\u0000-\u001f]+$/;
const isDevice = target => target.startsWith('/dev/');
const cleanDevice = (value, what) => {
  if (typeof value !== 'string' || (value && (!DEVICE.test(value) || value.length > 255 || value.includes('..')))) fail(what);
  return value;
};
function cleanLocobuffer({ device, baud, flow } = {}) {
  cleanDevice(device, 'Ange LocoBufferns enhet under /dev, till exempel /dev/serial/by-id/…');
  if (!BAUDS.includes(String(baud))) fail('Ogiltig hastighet.');
  if (!FLOWS.includes(flow)) fail('Ogiltig flödeskontroll.');
  return { device, baud: String(baud), flow };
}
// Adressen skrivs som AA:BB:CC:DD:EE:FF och sparas med versaler; en parad serieport anges som sin /dev-enhet.
function cleanBridge({ target, channel = 1 } = {}) {
  if (typeof target !== 'string') fail('Ange BTLocoBridgens adress AA:BB:CC:DD:EE:FF, eller dess serieport under /dev.');
  const value = target.trim();
  if (value && !ADDRESS.test(value)) cleanDevice(value, 'Ange BTLocoBridgens adress AA:BB:CC:DD:EE:FF, eller dess serieport under /dev.');
  if (!Number.isInteger(Number(channel)) || Number(channel) < 1 || Number(channel) > 30) fail('Kanalen är 1–30.');
  return { target: ADDRESS.test(value) ? value.toUpperCase() : value, channel: Number(channel) };
}
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
export const MODE_LABEL = { live: 'LocoNet ansluten', offline: 'LocoNet ej ansluten' };

// USB-serieportar som en LocoBuffer kan sitta på: stabila namn under /dev/serial/by-id först (Linux), annars
// ttyACM/ttyUSB, och cu.usb* på Mac.
export function listSerialDevices(readdir = d => fs.readdirSync(d)) {
  const out = [], list = (dir, test, label = n => n) => { try { for (const n of readdir(dir).sort()) if (test(n)) out.push({ path: path.join(dir, n), label: label(n) }); } catch {} };
  list('/dev/serial/by-id', () => true);
  list('/dev', n => /^tty(ACM|USB)\d+$/.test(n) || /^cu\.usb(serial|modem)/.test(n));
  return out;
}

export class ConnectionMode extends EventEmitter {
  constructor({ storage, env = process.env, platform = process.platform, root, spawn = nodeSpawn, listDevices = listSerialDevices, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
    super();
    Object.assign(this, { storage, env, platform, root, spawn, listDevices, setTimer, clearTimer, now });
    const envMode = env.CHARLOTTENDAL_CONNECTION_MODE || 'unspecified';
    if (!['simulator', 'hardware', 'unspecified'].includes(envMode)) throw Error('Okänt anslutningsläge. Välj simulator eller hardware.');
    // CHARLOTTENDAL_CONNECTION_MODE=hardware är den fristående vägen: TKL ansluter till en gateway som någon annan startat
    // (CHARLOTTENDAL_WIRE_HOST/PORT). Då finns ingen simulator att gå offline mot, och läget är låst till live.
    this.external = envMode === 'hardware';
    const stored = storage.load('connection.json', { schema: 2, mode: this.external ? 'live' : 'offline', locobuffer: { device: '', baud: '57600', flow: 'rtscts' }, btlocobridge: { target: '', channel: 1 } });
    if (![1, 2].includes(stored.schema) || !['live', 'offline'].includes(stored.mode) || typeof stored.locobuffer?.device !== 'string') throw Error('Ogiltig connection.json.');
    // Schema 1 (före BTLocoBridge) läses som förut och får USB-anslutningen som vald.
    this.data = { ...stored, schema: 2, adapter: stored.adapter ?? 'locobuffer', btlocobridge: { target: '', channel: 1, ...stored.btlocobridge } };
    if (!ADAPTERS.includes(this.data.adapter) || typeof this.data.btlocobridge.target !== 'string' || !Number.isInteger(this.data.btlocobridge.channel)) throw Error('Ogiltig connection.json.');
    this.gateway = { state: 'stopped', error: '', since: 0 }; this.child = null; this.timer = null; this.failures = 0;
  }
  get locked() { return this.external; }
  get adapter() { return this.data.adapter; }
  // Den inställda anslutningen: enheten för USB, adressen eller den parade serieporten för Bluetooth.
  get connector() { return this.adapter === 'btlocobridge' ? this.data.btlocobridge.target : this.data.locobuffer.device; }
  // Det läge TKL kör i: det sparade, så länge det går; live utan LocoBuffer faller tillbaka till offline.
  get mode() { return this.external ? 'live' : this.data.mode === 'live' && !this.liveReason() ? 'live' : 'offline'; }
  get port() { return Number(this.env.CHARLOTTENDAL_LOCOBUFFER_PORT || 8913); }
  liveReason() {
    if (this.external) return '';
    if (this.env.CHARLOTTENDAL_INSTALL_KIND === 'render') return 'Webbdriften har ingen LocoNet; TKL svarar alltid själv.';
    if (this.platform === 'win32') return 'LocoNet finns på Raspberry Pi och Mac, inte på Windows än.';
    if (this.adapter === 'btlocobridge') {
      if (!this.connector) return 'Ingen BTLocoBridge inställd. Ange kortets adress under Inställningar → Banan (LocoNet).';
      // RFCOMM mot en adress går genom Python på Linux; på Mac paras kortet i systemet och blir en serieport.
      if (!isDevice(this.connector) && this.platform !== 'linux') return 'På Mac paras BTLocoBridge i Bluetooth-inställningarna och anges som sin serieport, /dev/cu.…';
      return '';
    }
    if (!this.connector) return 'Ingen LocoBuffer inställd. Ange den under Inställningar → Banan (LocoNet).';
    return '';
  }
  // Var kärnans LocoNet-klient ansluter: simulatorns ledning offline, gatewayen live.
  target(profile) {
    const wire = { host: this.env.CHARLOTTENDAL_WIRE_HOST || profile.transport.host, port: Number(this.env.CHARLOTTENDAL_WIRE_PORT || profile.transport.port) };
    if (this.external) return { mode: 'hardware', ...wire, label: `LocoNet ansluten via gateway ${wire.host}:${wire.port}` };
    if (this.mode === 'live') return { mode: 'hardware', host: '127.0.0.1', port: this.port, label: `LocoNet ansluten via ${this.adapter === 'btlocobridge' ? 'BTLocoBridge' : 'LocoBuffer'} (${this.connector})` };
    return { mode: 'simulator', ...wire, label: 'LocoNet ej ansluten · TKL svarar själv och kör trafikspelets tåg' };
  }
  // Enhetslistan läses bara när den efterfrågas (Inställningar), inte i varje lägesutskick.
  view({ devices = false } = {}) {
    const reason = this.liveReason();
    return { mode: this.mode, chosen: this.data.mode, locked: this.locked, live: { available: !reason, reason }, adapter: this.adapter,
      locobuffer: { ...this.data.locobuffer }, btlocobridge: { ...this.data.btlocobridge }, ...(devices ? { devices: this.locked ? [] : this.listDevices() } : {}), gateway: { ...this.gateway }, port: this.port };
  }
  // Den gamla vägen: bara USB-anslutningens inställning, som också väljer den.
  setLocobuffer(locobuffer) { return this.setAdapter({ adapter: 'locobuffer', locobuffer }); }
  // Vilken anslutning TKL använder och dess inställning. Det som inte skickas med behålls.
  setAdapter({ adapter = this.data.adapter, locobuffer = this.data.locobuffer, btlocobridge = this.data.btlocobridge } = {}) {
    if (this.locked) fail('TKL är startad mot en fristående gateway (CHARLOTTENDAL_CONNECTION_MODE=hardware).', 409);
    if (!ADAPTERS.includes(adapter)) fail('Okänd anslutning. Välj LocoBuffer eller BTLocoBridge.');
    const next = { adapter, locobuffer: cleanLocobuffer(locobuffer), btlocobridge: cleanBridge(btlocobridge) };
    const connector = adapter === 'btlocobridge' ? next.btlocobridge.target : next.locobuffer.device;
    if (!connector && this.data.mode === 'live') fail(`Koppla från LocoNet innan ${adapter === 'btlocobridge' ? 'BTLocoBridge' : 'LocoBuffern'} tas bort.`, 409);
    const before = JSON.stringify([this.data.adapter, this.data.locobuffer, this.data.btlocobridge]);
    this.save({ ...this.data, ...next });
    // En ändrad anslutning i live: gatewayen startas om på samma port; kärnans klient ansluter igen av sig själv.
    if (this.mode === 'live' && before !== JSON.stringify([next.adapter, next.locobuffer, next.btlocobridge])) { this.stopGateway(); this.startGateway(); }
    this.emit('change'); return this.view();
  }
  // Byter det sparade läget och startar eller stoppar gatewayen. Kärnans förbindelse byter servern efteråt.
  switch(mode) {
    if (!['live', 'offline'].includes(mode)) fail('Okänt läge. Välj ansluten eller ej ansluten.');
    if (this.locked) fail('TKL är startad mot en fristående gateway och är alltid ansluten till LocoNet.', 409);
    if (mode === 'live' && this.liveReason()) fail(this.liveReason(), 409);
    this.save({ ...this.data, mode });
    if (mode === 'live') this.startGateway(); else this.stopGateway();
    this.emit('change'); return this.view();
  }
  start() { if (this.mode === 'live' && !this.locked) this.startGateway(); }
  stop() { this.stopGateway(); }
  save(data) { this.storage.save('connection.json', data); this.data = data; }
  startGateway() {
    if (this.child || this.locked) return;
    this.clearTimer(this.timer); this.timer = null;
    const { device, baud, flow } = this.data.locobuffer, { target, channel } = this.data.btlocobridge;
    const args = this.adapter === 'btlocobridge'
      ? ['--adapter', 'btlocobridge', '--address', target, '--channel', String(channel)]
      : ['--device', device, '--baud', baud, '--flow', flow];
    const child = this.child = this.spawn(process.execPath, [path.join(this.root, 'scripts/locobuffer-gateway.mjs'), ...args, '--port', String(this.port)], { cwd: this.root, stdio: ['ignore', 'pipe', 'pipe'] });
    this.gateway = { state: 'starting', error: '', since: this.now() }; let errors = '';
    child.stdout?.on('data', d => { if (/LocoNet-gateway: /.test(String(d))) { this.gateway = { state: 'running', error: '', since: this.now() }; this.failures = 0; this.emit('change'); } });
    child.stderr?.on('data', d => { errors = (errors + d).slice(-2000); const last = errors.trim().split('\n').at(-1); if (last) { this.gateway.error = last; this.emit('change'); } });
    child.on('error', e => { this.gateway.error = e.message; });
    child.on('exit', code => {
      if (this.child !== child) return;
      this.child = null;
      this.gateway = { state: 'failed', error: this.gateway.error || `Gatewayen avslutades (kod ${code}).`, since: this.now() };
      // Utan LocoBuffer (urkopplad, fel enhet) försöker TKL igen, allt glesare upp till var 15:e sekund, så länge läget är live.
      if (this.mode === 'live') { this.failures++; this.timer = this.setTimer(() => { this.timer = null; if (this.mode === 'live') this.startGateway(); }, Math.min(15000, 2000 * 2 ** Math.min(3, this.failures - 1))); }
      this.emit('change');
    });
    this.emit('change');
  }
  stopGateway() {
    this.clearTimer(this.timer); this.timer = null; this.failures = 0;
    const child = this.child; this.child = null;
    if (child) child.kill('SIGTERM');
    this.gateway = { state: 'stopped', error: '', since: this.now() };
  }
}
