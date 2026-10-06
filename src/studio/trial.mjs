// Simulatorprovet: kärnan och den oberoende fältmodellen i samma process, en tågväg i taget.
// Samma rigg som testerna använder. Resultatet är etablerad eller inte, med order och lås.
import { Engine } from '../engine.mjs';
import { Field } from '../field.mjs';
import { decode } from '../protocol.mjs';
export function runTrial({ profile, field, routeIds, limitMs = 8000 }) {
  const byAddress = Object.fromEntries(Object.entries(profile.turnouts).map(([n, t]) => [t.address, n]));
  const results = [];
  for (const id of routeIds) {
    const def = profile.routes.find(r => r.id === id);
    if (!def) { results.push({ id, result: 'saknas', reason: 'Tågvägen finns inte i profilen.' }); continue; }
    let now = 100000; const queue = [], commands = [];
    const f = new Field(field, { now: () => now, movementMs: 100 });
    const e = new Engine(profile, { now: () => now, send: b => { queue.push(['order', b]); commands.push(decode(b)); } });
    f.on('frame', b => queue.push(['report', b]));
    const drain = () => { let guard = 20000; while (queue.length && guard--) { const [k, b] = queue.shift(); if (k === 'order') f.accept(b); else e.receive(b); } if (guard <= 0) throw Error('Återkopplingen stabiliserar sig inte.'); };
    e.connection(true); f.allReports(); drain();
    let route = null, error = null;
    try { route = e.request(def.from, def.to); } catch (err) { error = err.message; }
    for (let t = 0; route && route.state !== 'active' && t < limitMs; t += 50) { now += 50; f.tick(); if (now % 1000 === 0) f.allReports(); drain(); e.tick(); drain(); }
    const ordered = [...new Set(commands.filter(c => c.kind === 'order' && byAddress[c.address]).map(c => byAddress[c.address]))];
    results.push({ id, label: def.label, kind: def.kind, result: error ? 'avvisad' : route.state === 'active' ? 'etablerad' : route.state, reason: error || (route.state === 'active' ? '' : route.reason || ''),
      ordered, locked: route ? route.turnouts : {}, signals: route ? route.signals : [], ms: now - 100000 });
  }
  return { total: results.length, ok: results.filter(r => r.result === 'etablerad').length, results };
}
