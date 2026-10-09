// LocoNet framing. Sources and the limits of the E4 profile: docs/protokollunderlag.md.
export function frame(bytes) {
  return Buffer.from([...bytes, bytes.reduce((sum, n) => sum ^ n, 0xff)]);
}
export function validate(bytes) {
  if (bytes.length < 2 || !(bytes[0] & 0x80)) throw Error('Saknad opcode');
  const sizes = [2, 4, 6, bytes[1]];
  const size = sizes[(bytes[0] >> 5) & 3];
  if (size < 2 || size > 127 || bytes.length !== size) throw Error('Fel ramlängd');
  if ([...bytes].slice(1).some(b => b & 0x80)) throw Error('Fel databyte');
  if (bytes.reduce((sum, n) => sum ^ n, 0) !== 0xff) throw Error('Fel kontrollsumma');
  return bytes;
}
export const hex = bytes => [...bytes].map(n => n.toString(16).padStart(2, '0').toUpperCase()).join(' ');
export function fromHex(text) {
  const parts = text.trim().split(/\s+/);
  if (!parts.length || parts.some(p => !/^[0-9a-f]{2}$/i.test(p))) throw Error('Ogiltig hexram');
  return validate(Buffer.from(parts.map(p => parseInt(p, 16))));
}
function address(n, max) {
  if (!Number.isInteger(n) || n < 1 || n > max) throw Error('Adress utanför intervallet');
  return n - 1;
}
export function switchOrder(addr, position, on = true) {
  const n = address(addr, 2048);
  if (!['C', 'T'].includes(position)) throw Error('Ogiltigt växelläge');
  return frame([0xb0, n & 127, (n >> 7) | (position === 'C' ? 0x20 : 0) | (on ? 0x10 : 0)]);
}
// Som MGP-korten rapporterar (Bennys monitorering 9 oktober 2026, docs/genomgang-mgp-2026-10-06.md): B1 i ingångsformatet,
// bit 6 satt, bit 5 = växelingång, bit 4 = läge (satt = CLOSED, "input off"; noll = THROWN, "input on"), som JMRI läser det.
// 'unknown' (rörelse pågår) finns bara i simulatorn och sänds i utgångsformatet med båda bitarna noll.
export function switchReport(addr, position) {
  const n = address(addr, 2048);
  if (!['C', 'T', 'unknown'].includes(position)) throw Error('Ogiltig växelrapport');
  return frame([0xb1, n & 127, (n >> 7) | (position === 'unknown' ? 0 : 0x60 | (position === 'C' ? 0x10 : 0))]);
}
export function sensorReport(addr, active) {
  const n = address(addr, 4096);
  return frame([0xb2, (n >> 1) & 127, ((n >> 8) & 15) | ((n & 1) ? 0x20 : 0) | 0x40 | (active ? 0x10 : 0)]);
}
// This is the explicitly provisional Signal10-CZ example profile, NOT a verified Swedish SE mapping.
export function signalReport(addr, code) {
  const n = address(addr, 16384);
  if (!Number.isInteger(code) || code < 0 || code > 127) throw Error('Ogiltig beskedskod');
  return frame([0xe4, 9, n >> 7, n & 127, 0, 1, code, 0]);
}
export function decode(bytes) {
  validate(bytes);
  const [op, a, b] = bytes;
  if (op === 0xb0) return { kind: 'order', address: 1 + a + ((b & 15) << 7), position: b & 0x20 ? 'C' : 'T', on: !!(b & 0x10) };
  if (op === 0xb1) {
    const addr = 1 + a + ((b & 15) << 7);
    // Ingångsformatet (bit 6): så rapporterar MGP-korten växel- och signalläge. Bit 5 skiljer växelingången från
    // hjälpingången (aux), som inte är ett läge; bit 4 satt = CLOSED, noll = THROWN (JMRI: "input off"/"input on").
    if (b & 0x40) return b & 0x20 ? { kind: 'turnout', address: addr, position: b & 0x10 ? 'C' : 'T', input: true } : { kind: 'unsupported', opcode: op };
    // Utgångsformatet: bit 5 = CLOSED-utgången på, bit 4 = THROWN-utgången på; båda noll = okänt (rörelse pågår).
    const bits = b & 0x30;
    return { kind: 'turnout', address: addr, position: bits === 0x20 ? 'C' : bits === 0x10 ? 'T' : 'unknown' };
  }
  if (op === 0xb2) return { kind: 'sensor', address: 1 + 2 * (a + 128 * (b & 15)) + ((b & 0x20) >> 5), active: !!(b & 0x10) };
  if (op === 0xe4 && bytes.length === 9 && bytes[4] === 0 && bytes[5] === 1 && bytes[7] === 0)
    return { kind: 'signal', address: 1 + (a === 9 ? bytes[2] * 128 + bytes[3] : -1), code: bytes[6] };
  return { kind: 'unsupported', opcode: op };
}
export class FrameReader {
  constructor(onFrame, onError = () => {}) { this.pending = []; this.onFrame = onFrame; this.onError = onError; }
  push(chunk) {
    for (const b of chunk) {
      if (b & 0x80) { if (this.pending.length) this.onError(Error('Avbruten ram')); this.pending = [b]; }
      else if (this.pending.length) this.pending.push(b);
      else continue;
      if (this.pending.length < 2) continue;
      const size = [2, 4, 6, this.pending[1]][(this.pending[0] >> 5) & 3];
      if (size < 2 || size > 127) { this.onError(Error('Fel ramlängd')); this.pending = []; continue; }
      if (this.pending.length === size) {
        const msg = Buffer.from(this.pending); this.pending = [];
        try { validate(msg); this.onFrame(msg); } catch (e) { this.onError(e); }
      }
    }
  }
}
export class LineReader {
  constructor(onLine, onError = () => {}) { this.buffer = ''; this.onLine = onLine; this.onError = onError; }
  push(chunk) {
    this.buffer += chunk.toString('ascii');
    const lines = this.buffer.split(/[\r\n]+/); this.buffer = lines.pop();
    for (const line of lines) {
      if (line.length > 4096) this.onError(Error('För lång protokollrad'));
      else if (line.trim()) this.onLine(line.trim());
    }
    if (this.buffer.length > 4096) { this.buffer = ''; this.onError(Error('För lång protokollrad')); }
  }
}
