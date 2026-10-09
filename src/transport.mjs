import net from 'node:net';
import { EventEmitter } from 'node:events';
import { LineReader, fromHex, hex, decode, switchOrder } from './protocol.mjs';
// En växelorder är en puls: ON följt av OFF efter PULSE_MS, som JMRI sänder den och som Bennys monitorering visade
// (B0 … 10 → B1-rapport → B0 … 00). Avsändaren skickar bara ON; OFF läggs till här, så att varje väg ut (kärnan,
// Mät objekt) pulsar lika. Simulatorn bortser från OFF.
export const PULSE_MS = 200;
export class LocoNetClient extends EventEmitter {
  constructor({ host, port, silenceMs = 7000, pulseMs = PULSE_MS }) { super(); this.host = host; this.port = port; this.silenceMs = silenceMs; this.pulseMs = pulseMs; this.queue = []; this.stopped = false; this.pulses = new Set(); }
  start() {
    if (this.stopped) return;
    const socket = this.socket = net.createConnection({ host: this.host, port: this.port });
    socket.setNoDelay(true); socket.setKeepAlive(true, 2000);
    const reader = new LineReader(line => this.line(line), e => this.emit('fault', e.message));
    socket.on('connect', () => {
      this.online = true; this.lastReceive = Date.now(); this.emit('connection', true);
      this.watch = setInterval(() => {
        if (Date.now() - this.lastReceive > this.silenceMs || (this.pending && Date.now() - this.pending > 3000)) socket.destroy();
      }, 500);
    });
    socket.on('data', data => reader.push(data));
    socket.on('error', e => this.emit('fault', e.code || e.message));
    socket.on('close', () => {
      clearInterval(this.watch); this.online = false; this.queue = []; this.pending = 0;
      for (const t of this.pulses) clearTimeout(t); this.pulses.clear();
      for (const w of this.simulations?.splice(0) || []) { clearTimeout(w.timer); w.reject(Error('Förbindelsen till simulatorn bröts.')); }
      this.emit('connection', false);
      if (!this.stopped) this.retry = setTimeout(() => this.start(), 1000);
    });
  }
  line(line) {
    this.emit('protocol',{direction:'in',line});
    this.lastReceive = Date.now();
    if (line.startsWith('RECEIVE ')) {
      try { const data = fromHex(line.slice(8)); this.emit('wire', { direction: 'in', hex: hex(data) }); this.emit('frame', data); }
      catch (e) { this.emit('fault', e.message); }
    } else if (line.startsWith('SENT ')) {
      if (!this.pending) { this.emit('fault', 'Oväntad transportkvittens'); return; }
      if (!line.startsWith('SENT OK')) { this.emit('fault', line); this.socket.destroy(); return; }
      this.pending = 0; this.flush();
    } else if (line.startsWith('SIM ')) {
      const waiting = this.simulations?.shift(); if (!waiting) return;
      clearTimeout(waiting.timer);
      if (line.startsWith('SIM OK')) { try { waiting.resolve(JSON.parse(line.slice(7) || '{}')); } catch { waiting.resolve({}); } }
      else waiting.reject(Error(line.slice(10) || 'Simulatorn avböjde.'));
    } else if (line.startsWith('ERROR') || line.startsWith('BREAK')) this.emit('fault', line);
  }
  // Bara mot simulatorn (src/simulator.mjs): ett simuleringskommando på samma förbindelse, utan LocoNet-telegram.
  simulate(command) {
    if (!this.online) return Promise.reject(Error('Ingen kontakt med simulatorn.'));
    return new Promise((resolve, reject) => {
      const waiting = { resolve, reject };
      waiting.timer = setTimeout(() => { const i = this.simulations.indexOf(waiting); if (i >= 0) this.simulations.splice(i, 1); reject(Error('Simulatorn svarade inte.')); }, 3000);
      (this.simulations ??= []).push(waiting);
      const line = 'SIM ' + JSON.stringify(command); this.socket.write(line + '\r\n'); this.emit('protocol', { direction: 'out', line });
    });
  }
  send(data) {
    if (!this.online) return false;
    if (this.queue.length >= 200) { this.socket.destroy(); return false; }
    this.queue.push(data); this.flush();
    let order = null; try { order = decode(data); } catch {}
    if (order?.kind === 'order' && order.on) {
      const t = setTimeout(() => { this.pulses.delete(t); if (this.online) { this.queue.push(switchOrder(order.address, order.position, false)); this.flush(); } }, this.pulseMs);
      this.pulses.add(t);
    }
    return true;
  }
  flush() {
    if (this.pending || !this.online || !this.queue.length) return;
    const bytes = this.queue.shift(); this.pending = Date.now();
    const line='SEND ' + hex(bytes);this.socket.write(line + '\r\n');this.emit('protocol',{direction:'out',line});this.emit('wire', { direction: 'out', hex: hex(bytes) });
  }
  stop() { this.stopped = true; clearTimeout(this.retry); clearInterval(this.watch); for (const t of this.pulses) clearTimeout(t); this.pulses.clear(); this.socket?.destroy(); }
}
