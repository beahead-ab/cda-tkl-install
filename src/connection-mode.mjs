// LocoNet ansluten eller ej ansluten (0.78.0, språket sedan 0.79.0). Ansluten ('live'): TKL styr banan över LocoNet, med
// en LocoBuffer på USB som TKL själv startar gatewayen för (scripts/locobuffer-gateway.mjs), och återrapporterna kommer
// från banan. Ej ansluten ('offline'): TKL svarar själv på sina order och kör trafikspelets tåg (src/field.mjs i den
// lokala processen src/simulator.mjs). Valet sparas i connection.json och gäller efter omstart: var LocoNet ansluten
// ansluter TKL igen. Kärnan är densamma; bara förbindelsen byts. Villkoren för bytet (inga lås) avgör servern.
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

const BAUDS = ['9600', '19200', '38400', '57600', '115200'], FLOWS = ['none', 'rtscts'];
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
    this.data = storage.load('connection.json', { schema: 1, mode: this.external ? 'live' : 'offline', locobuffer: { device: '', baud: '57600', flow: 'rtscts' } });
    if (this.data.schema !== 1 || !['live', 'offline'].includes(this.data.mode) || typeof this.data.locobuffer?.device !== 'string') throw Error('Ogiltig connection.json.');
    this.gateway = { state: 'stopped', error: '', since: 0 }; this.child = null; this.timer = null; this.failures = 0;
  }
  get locked() { return this.external; }
  // Det läge TKL kör i: det sparade, så länge det går; live utan LocoBuffer faller tillbaka till offline.
  get mode() { return this.external ? 'live' : this.data.mode === 'live' && !this.liveReason() ? 'live' : 'offline'; }
  get port() { return Number(this.env.CHARLOTTENDAL_LOCOBUFFER_PORT || 8913); }
  liveReason() {
    if (this.external) return '';
    if (this.env.CHARLOTTENDAL_INSTALL_KIND === 'render') return 'Webbdriften har ingen LocoNet; TKL svarar alltid själv.';
    if (this.platform === 'win32') return 'LocoNet via LocoBuffer finns på Raspberry Pi och Mac, inte på Windows än.';
    if (!this.data.locobuffer.device) return 'Ingen LocoBuffer inställd. Ange den under Inställningar → Banan (LocoNet).';
    return '';
  }
  // Var kärnans LocoNet-klient ansluter: simulatorns ledning offline, gatewayen live.
  target(profile) {
    const wire = { host: this.env.CHARLOTTENDAL_WIRE_HOST || profile.transport.host, port: Number(this.env.CHARLOTTENDAL_WIRE_PORT || profile.transport.port) };
    if (this.external) return { mode: 'hardware', ...wire, label: `LocoNet ansluten via gateway ${wire.host}:${wire.port}` };
    if (this.mode === 'live') return { mode: 'hardware', host: '127.0.0.1', port: this.port, label: `LocoNet ansluten via LocoBuffer (${this.data.locobuffer.device})` };
    return { mode: 'simulator', ...wire, label: 'LocoNet ej ansluten · TKL svarar själv och kör trafikspelets tåg' };
  }
  // Enhetslistan läses bara när den efterfrågas (Inställningar), inte i varje lägesutskick.
  view({ devices = false } = {}) {
    const reason = this.liveReason();
    return { mode: this.mode, chosen: this.data.mode, locked: this.locked, live: { available: !reason, reason },
      locobuffer: { ...this.data.locobuffer }, ...(devices ? { devices: this.locked ? [] : this.listDevices() } : {}), gateway: { ...this.gateway }, port: this.port };
  }
  setLocobuffer({ device, baud, flow } = {}) {
    if (this.locked) fail('TKL är startad mot en fristående gateway (CHARLOTTENDAL_CONNECTION_MODE=hardware).', 409);
    if (typeof device !== 'string' || (device && (!/^\/dev\/[^\s\u0000-\u001f]+$/.test(device) || device.length > 255 || device.includes('..')))) fail('Ange LocoBufferns enhet under /dev, till exempel /dev/serial/by-id/…');
    if (!BAUDS.includes(String(baud))) fail('Ogiltig hastighet.');
    if (!FLOWS.includes(flow)) fail('Ogiltig flödeskontroll.');
    if (!device && this.data.mode === 'live') fail('Koppla från LocoNet innan LocoBuffern tas bort.', 409);
    const before = JSON.stringify(this.data.locobuffer);
    this.save({ ...this.data, locobuffer: { device, baud: String(baud), flow } });
    // En ändrad LocoBuffer i live: gatewayen startas om på samma port; kärnans klient ansluter igen av sig själv.
    if (this.mode === 'live' && before !== JSON.stringify(this.data.locobuffer)) { this.stopGateway(); this.startGateway(); }
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
    const { device, baud, flow } = this.data.locobuffer;
    const child = this.child = this.spawn(process.execPath, [path.join(this.root, 'scripts/locobuffer-gateway.mjs'), '--device', device, '--baud', baud, '--flow', flow, '--port', String(this.port)], { cwd: this.root, stdio: ['ignore', 'pipe', 'pipe'] });
    this.gateway = { state: 'starting', error: '', since: this.now() }; let errors = '';
    child.stdout?.on('data', d => { if (/LocoBuffer gateway: /.test(String(d))) { this.gateway = { state: 'running', error: '', since: this.now() }; this.failures = 0; this.emit('change'); } });
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
