import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Field } from './field.mjs';
import { hex, fromHex, LineReader } from './protocol.mjs';
import { json, guard, body, staticFile } from './http.mjs';
import { createAuth } from './auth.mjs';
import { loadProfile } from './profile.mjs';
import { currentStation, stationData, stateDirectory } from './station.mjs';
import { stationTraffic } from './station-traffic.mjs';

const station = currentStation(), profile = loadProfile('field');
const port = Number(process.env.CHARLOTTENDAL_SIM_PORT || 8911), wirePort = Number(process.env.CHARLOTTENDAL_WIRE_PORT || 8912);
const traffic=stationTraffic(station,loadProfile('tkl'),stationData('panel.json',station));
const field = new Field(profile,{traffic}), clients = new Set(), trace = [];
let link = true;
function record(direction, bytes) { trace.unshift({ at: Date.now(), direction, hex: hex(bytes) }); trace.length = Math.min(trace.length, 80); }
function broadcast(bytes) { record('ut', bytes); if (link) for (const s of clients) s.write(`RECEIVE ${hex(bytes)}\r\n`); }
field.on('frame', broadcast);
const wire = net.createServer(socket => {
  if (!link) return socket.destroy();
  clients.add(socket); socket.setNoDelay(true); socket.write(`VERSION ${station.title} field laboratory 0.1\r\n`);
  const reader = new LineReader(line => {
    // TKL i simuleringsläge ställer simulerade tåg på linjerna över samma lokala förbindelse (SIM <json>); en riktig
    // LocoBuffer får aldrig sådana rader. Svaret är SIM OK <json> eller SIM ERROR <text>.
    if (line.startsWith('SIM ')) {
      try { socket.write('SIM OK ' + JSON.stringify(field.simulate(JSON.parse(line.slice(4))) || {}) + '\r\n'); }
      catch (e) { socket.write('SIM ERROR ' + String(e.message).replace(/[\r\n]+/g, ' ') + '\r\n'); }
      return;
    }
    try {
      if (!line.startsWith('SEND ')) throw Error('Expected SEND');
      const bytes = fromHex(line.slice(5)); record('in', bytes);
      // Transport echo precedes SENT OK; neither is a field position report.
      broadcast(bytes); socket.write('SENT OK\r\n'); field.accept(bytes);
    } catch (e) { socket.write('SENT ERROR Invalid frame\r\n'); }
  }, () => socket.destroy());
  socket.on('data', c => reader.push(c)); socket.on('error', () => {}); socket.on('close', () => clients.delete(socket));
  // Som MGP-korten (Bennys trace 10 oktober 2026) rapporterar simulatorn bara vid ändring, order och avfrågning: inget
  // när TKL ansluter och inget med jämna mellanrum. TKL frågar av ingångarna själv.
});
wire.listen(wirePort, '127.0.0.1');
const root = fileURLToPath(new URL('../public', import.meta.url));
const auth = createAuth(root, false, process.env, {stateDir:stateDirectory(process.env,station)});
const server = http.createServer(async (req, res) => {
  try {
    guard(req, port); const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (await auth.handle(req, res, url)) return;
    await auth.authenticate(req);
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, { station: { id: station.id, title: station.title }, tklUrl: process.env.CHARLOTTENDAL_TKL_URL || `http://127.0.0.1:${Number(process.env.CHARLOTTENDAL_PORT || 8910)}/` });
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, { ...field.snapshot(), link, clients: clients.size, trace });
    if (req.method === 'POST') {
      const data = await body(req);
      if (url.pathname === '/api/block') field.setBlock(data.name, data.occupied);
      else if (url.pathname === '/api/fault') field.setFault(data.kind, data.name);
      else if (url.pathname === '/api/programming-fault') field.setProgrammingFault(data.enabled);
      else if (url.pathname === '/api/train') field.startTrain(data.id);
      else if (url.pathname === '/api/link') { link = !!data.connected; if (!link) for (const s of clients) s.destroy(); }
      else return json(res, { error: 'Okänd manöver' }, 404);
      return json(res, { ok: true });
    }
    if (url.pathname.startsWith('/api/')) return json(res, { error: 'Finns inte' }, 404);
    staticFile(res, root, url.pathname === '/' ? '/simulator.html' : decodeURIComponent(url.pathname));
  } catch (e) { json(res, { error: e.message }, e.status || 400); }
});
server.listen(port, '127.0.0.1', () => console.log(`${station.title} anläggning: http://127.0.0.1:${port} · LocoNet ${wirePort}`));
const step = setInterval(() => field.tick(), 50);
function close() { clearInterval(step); for (const s of clients) s.destroy(); wire.close(); server.close(() => process.exit(0)); }
process.on('SIGINT', close); process.on('SIGTERM', close);
for (const s of [wire, server]) s.on('error', e => { console.error(e.message); process.exit(1); });
