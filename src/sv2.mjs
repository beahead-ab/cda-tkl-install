// SV2-programmering över LocoNet: OPC_PEER_XFER (E5 10) i format 2 enligt SV Programming Message Formats v13.
// Studio använder Discover, Identify och läsning. Skrivning, adressbyte och omstart finns som meddelanden
// men skickas inte förrän läsningen är verifierad på riktiga kort. Inget här uppdaterar ett objekts tillstånd.
import { frame } from './protocol.mjs';
export const SV_CMD = { write: 0x01, read: 0x02, maskedWrite: 0x03, write4: 0x05, read4: 0x06, discover: 0x07, identify: 0x08, changeAddress: 0x09, reconfigure: 0x0f };
export const SV_NAME = { 0x01: 'SV skriv', 0x02: 'SV läs', 0x03: 'SV maskad skrivning', 0x05: 'SV skriv 4', 0x06: 'SV läs 4', 0x07: 'Discover', 0x08: 'Identify', 0x09: 'Adressbyte', 0x0f: 'Omstart',
  0x41: 'Svar SV skriv', 0x42: 'Svar SV läs', 0x43: 'Svar maskad skrivning', 0x45: 'Svar SV skriv 4', 0x46: 'Svar SV läs 4', 0x47: 'Svar Discover', 0x48: 'Svar Identify', 0x49: 'Svar adressbyte', 0x4f: 'Svar omstart' };
export const STANDARD_SV = { 1: 'EEPROM-storlek', 2: 'Programversion', 3: 'Serienummer låg byte', 4: 'Serienummer hög byte' };
// MGP-kortens egna SV ur Bennys monitorering 9 oktober 2026 (docs/genomgang-mgp-2026-10-06.md): adressen och ingångarnas polaritet.
export const MGP_SV = { 21: 'Adress (servo 1; servo 2 får adressen +1, osv.)', 178: 'Ingångarnas belagd-nivå (0 = belagd vid låg, 1 = belagd vid hög)' };
export const eepromBytes = v => [256, 512, 1024, 2048, 4096][v] ?? null;
const check = (n, max, what) => { if (!Number.isInteger(n) || n < 0 || n > max) throw Error(`${what} utanför intervallet 0–${max}`); return n; };
const hi = n => (n >> 7) & 1, low = n => n & 0x7f;

// <E5><10><SRC><SV_CMD><SV_TYPE=02><SVX1><DST_L><DST_H><SV_ADRL><SV_ADRH><SVX2><D1><D2><D3><D4><CHK>
// SVX1 och SVX2 bär bit 7 för de fyra bytena som följer, så att alla databyte håller sig under 0x80.
export function svMessage({ src = 1, cmd, dst = 0, sv = 0, data = [] } = {}) {
  check(src, 127, 'Avsändare'); check(cmd, 127, 'SV-kommando'); check(dst, 65535, 'Kortadress'); check(sv, 65535, 'SV-nummer');
  const d = [0, 1, 2, 3].map(i => check(data[i] ?? 0, 255, 'Databyte'));
  const dstL = dst & 0xff, dstH = dst >> 8, svL = sv & 0xff, svH = sv >> 8;
  const svx1 = 0x10 | hi(dstL) | (hi(dstH) << 1) | (hi(svL) << 2) | (hi(svH) << 3);
  const svx2 = 0x10 | hi(d[0]) | (hi(d[1]) << 1) | (hi(d[2]) << 2) | (hi(d[3]) << 3);
  return frame([0xe5, 0x10, src, cmd, 0x02, svx1, low(dstL), low(dstH), low(svL), low(svH), svx2, ...d.map(low)]);
}
// Null när ramen inte är ett SV2-meddelande: typ 02 och övre nibbel 1 i både SVX1 och SVX2 krävs.
export function decodeSv(bytes) {
  if (bytes.length !== 16 || bytes[0] !== 0xe5 || bytes[1] !== 0x10 || bytes[4] !== 0x02 || (bytes[5] & 0xf0) !== 0x10 || (bytes[10] & 0xf0) !== 0x10) return null;
  const with7 = (value, bit, x) => value | (((x >> bit) & 1) << 7);
  const dstL = with7(bytes[6], 0, bytes[5]), dstH = with7(bytes[7], 1, bytes[5]), svL = with7(bytes[8], 2, bytes[5]), svH = with7(bytes[9], 3, bytes[5]);
  const data = [11, 12, 13, 14].map((i, k) => with7(bytes[i], k, bytes[10]));
  const cmd = bytes[3], reply = !!(cmd & 0x40);
  const out = { kind: 'sv', cmd, name: SV_NAME[cmd] || `SV okänt kommando ${cmd}`, reply, src: bytes[2], dst: dstL | (dstH << 8), sv: svL | (svH << 8), data };
  if (cmd === 0x47 || cmd === 0x48) out.identity = { manufacturer: svL, developer: svH, product: data[0] | (data[1] << 8), serial: data[2] | (data[3] << 8) };
  return out;
}
export const discover = (src = 1) => svMessage({ src, cmd: SV_CMD.discover });
export const identify = (dst, src = 1) => svMessage({ src, cmd: SV_CMD.identify, dst });
export const readSv = (dst, sv, src = 1) => svMessage({ src, cmd: SV_CMD.read, dst, sv });
export const readSv4 = (dst, sv, src = 1) => svMessage({ src, cmd: SV_CMD.read4, dst, sv });
// Svaret på en begäran: samma kommando med bit 6 satt. Kortets adress står i DST och SRC är frågarens (agentens) nummer,
// som MGP-korten svarar enligt Bennys trace 10 oktober 2026 (JMRI agent 1, MGP-appen agent 0). Inventeringen läser DST.
export const svReply = (request, { dst, sv = request.sv, data = [] } = {}) => svMessage({ src: request.src, cmd: request.cmd | 0x40, dst, sv, data });
export const identityReply = (request, address, { manufacturer, developer, product, serial }) =>
  svMessage({ src: request.src, cmd: request.cmd | 0x40, dst: address, sv: (manufacturer & 0xff) | ((developer & 0xff) << 8), data: [product & 0xff, product >> 8, serial & 0xff, serial >> 8] });
// MGP-kortens identitet i Discover-svaret (Bennys trace): tillverkare 126, utvecklare 1. Signal10 SE är produkt 6; servokortet
// med adressen i SV21 och ingångar (Bennys kort 6) är produkt 9. Produkt 5 (Bennys kort 18) är inte identifierad.
export const MGP_IDENTITY = { manufacturer: 126, developer: 1 };
export const MGP_PRODUCTS = { 6: 'Signal10 SE', 9: 'servokort med ingångar' };
// Det som inte tolkas men ändå ska kännas igen i Lyssna, enligt LocoNet PE 1.0.
export function classifyFrame(bytes) {
  const op = bytes[0];
  if (op === 0x81) return { kind: 'busy', note: 'OPC_BUSY, masterns tidsutfyllnad. Räknas, tolkas inte.' };
  if (op === 0xb4) return { kind: 'long-ack', note: bytes[1] === 0x30 && bytes[2] === 0x00 ? 'LONG_ACK: kommandostationen avvisade en växelorder (B0).' : 'LONG_ACK, sparas rått.' };
  if (op === 0xb2 && !(bytes[2] & 0x40)) return { kind: 'reserved', note: 'B2 med bit 6 = 0, reserverad form. Loggas rått.' };
  if (op === 0xe5) return { kind: 'peer', note: 'Peer-to-peer utan SV2-signatur. Loggas utan tolkning.' };
  return { kind: 'unknown', note: 'Okänd opcode. Kontrollsumman stämmer, ramen loggas som okänd.' };
}
