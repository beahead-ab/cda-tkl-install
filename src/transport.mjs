import net from 'node:net';
import { EventEmitter } from 'node:events';
import { LineReader, fromHex, hex } from './protocol.mjs';
export class LocoNetClient extends EventEmitter {
  constructor({ host, port, silenceMs = 7000 }) { super(); this.host = host; this.port = port; this.silenceMs = silenceMs; this.queue = []; this.stopped = false; }
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
    } else if (line.startsWith('ERROR') || line.startsWith('BREAK')) this.emit('fault', line);
  }
  send(data) {
    if (!this.online) return false;
    if (this.queue.length >= 200) { this.socket.destroy(); return false; }
    this.queue.push(data); this.flush(); return true;
  }
  flush() {
    if (this.pending || !this.online || !this.queue.length) return;
    const bytes = this.queue.shift(); this.pending = Date.now();
    const line='SEND ' + hex(bytes);this.socket.write(line + '\r\n');this.emit('protocol',{direction:'out',line});this.emit('wire', { direction: 'out', hex: hex(bytes) });
  }
  stop() { this.stopped = true; clearTimeout(this.retry); clearInterval(this.watch); this.socket?.destroy(); }
}
