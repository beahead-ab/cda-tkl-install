// Reglerna tillämpade på en profil: fragmenten kompileras, och tågvägarnas, alternativens och simulatorns
// växellägen räknas om som vägens växlar utvidgade med följreglerna. För dagens regler blir allt identiskt.
import { compileRules } from './rules.mjs';
const sameMap = (a, b) => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map(k => [k, b[k]]));
// Behåller den gamla nyckelordningen för växlar som är kvar, så att orderföljden inte ändras i onödan.
function retune(item, blockOf, coupled) {
  const want = {};
  for (const [n, pos] of Object.entries(item.turnouts)) if (item.blocks.includes(blockOf[n])) for (const m of coupled[n] || [n]) want[m] = pos;
  if (sameMap(want, item.turnouts)) return false;
  const next = {}; for (const n of Object.keys(item.turnouts)) if (n in want) next[n] = want[n];
  for (const n of Object.keys(want)) if (!(n in next)) next[n] = want[n];
  item.turnouts = next; return true;
}
export function fragmentDiff(a, b) {
  const out = [], j = v => JSON.stringify(v);
  for (const n of Object.keys(b.coupled)) if (j(a.coupled[n]) !== j(b.coupled[n])) out.push({ kind: 'coupled', object: n, before: a.coupled[n], after: b.coupled[n] });
  for (const n of Object.keys(b.manualPolicies.byTurnout)) { const x = a.manualPolicies.byTurnout[n], y = b.manualPolicies.byTurnout[n]; if (x?.status !== y.status || x?.reason !== y.reason || j(x?.names) !== j(y.names)) out.push({ kind: 'manual', object: n, before: x ? `${x.status} ${x.names.join('+')}` : null, after: `${y.status} ${y.names.join('+')}` }); }
  for (const n of new Set([...Object.keys(a.yardBoundaries), ...Object.keys(b.yardBoundaries)])) if (j(a.yardBoundaries[n]) !== j(b.yardBoundaries[n])) out.push({ kind: 'authority', object: n, before: a.yardBoundaries[n]?.rangerPositions || null, after: b.yardBoundaries[n]?.rangerPositions || null });
  for (const n of new Set([...Object.keys(a.operatingControls.lines), ...Object.keys(b.operatingControls.lines)])) if (j(a.operatingControls.lines[n]) !== j(b.operatingControls.lines[n])) out.push({ kind: 'line', object: n, before: !!a.operatingControls.lines[n], after: !!b.operatingControls.lines[n] });
  if (j(a.operatingControls.programming) !== j(b.operatingControls.programming)) out.push({ kind: 'programming', object: 'Vx133', before: a.operatingControls.programming?.requiredPosition || null, after: b.operatingControls.programming?.requiredPosition || null });
  // Det regelägda: spårledningarnas ingångar, signalernas koder och vägövergångarna.
  const bind = x => x ? (x.inputs ? x.inputs.map(i => i.address + (i.activeMeansOccupied ? '' : '¬')).join(x.logic === 'all' ? '&' : '|') : String(x.address) + (x.activeMeansOccupied ? '' : '¬')) : null;
  for (const n of Object.keys(b.blocks)) if (bind(a.blocks[n]) !== bind(b.blocks[n])) out.push({ kind: 'detection', object: n, before: bind(a.blocks[n]), after: bind(b.blocks[n]) });
  const codes = x => x ? x.virtual ? 'virtuell' : `stopp ${x.stopCodes.join(',')} kör ${x.goCodes.join(',')}` : null;
  for (const n of Object.keys(b.signals)) if (codes(a.signals[n]) !== codes(b.signals[n])) out.push({ kind: 'aspect', object: n, before: codes(a.signals[n]), after: codes(b.signals[n]) });
  if (j(a.indications?.indicators || null) !== j(b.indications?.indicators || null)) for (const ind of b.indications?.indicators || []) { const was = (a.indications?.indicators || []).find(x => x.name === ind.name); if (j(was) !== j(ind)) out.push({ kind: 'crossing', object: ind.name, before: was ? was.conditions.length + ' villkor' : null, after: ind.conditions.length + ' villkor' }); }
  return out;
}
export function applyRules(profile, rules, field = null) {
  const compiled = compileRules(rules, { turnoutNames: Object.keys(profile.turnouts) });
  const blockOf = Object.fromEntries(Object.entries(profile.turnouts).map(([n, t]) => [n, t.block]));
  const next = structuredClone(profile);
  next.coupled = compiled.coupled; next.manualPolicies = compiled.manualPolicies; next.yardBoundaries = compiled.yardBoundaries;
  // Adresserna för programmeringsreläet ägs av driftbindningarna, inte av regeln.
  const pr = profile.operatingControls?.programming;
  next.operatingControls = { lines: compiled.operatingControls.lines, programming: compiled.operatingControls.programming && pr ? { ...compiled.operatingControls.programming, relayAddress: pr.relayAddress, reportAddress: pr.reportAddress } : compiled.operatingControls.programming };
  for (const [n, b] of Object.entries(compiled.blocks)) next.blocks[n] = { ...next.blocks[n], ...b, provenance: 'Studio detection-regel: adress ur Cda60.xml, ej uppmätt.' };
  for (const [n, c] of Object.entries(compiled.signals)) next.signals[n] = { ...next.signals[n], ...c };
  if (compiled.indications) next.indications = { sourceHash: profile.sourceHash, indicators: compiled.indications };
  next.rules = rules.filter(r => !['proposal', 'rejected'].includes(r.status));
  const routes = [];
  for (const r of next.routes) { const before = { ...r.turnouts }; if (retune(r, blockOf, next.coupled)) routes.push({ id: r.id, label: r.label, kind: r.kind, before, after: r.turnouts }); }
  for (const r of next.routeAlternatives || []) retune(r, blockOf, next.coupled);
  let nextField = null;
  if (field) {
    nextField = structuredClone(field); nextField.coupled = next.coupled;
    // The legacy commissioning plant has no protection table.
    for (const p of Object.values(nextField.protection || {})) for (const a of p.alternatives || []) retune(a, blockOf, next.coupled);
    for (const s of [...(nextField.scenarios || []), ...(nextField.scenarioAlternatives || [])]) retune(s, blockOf, next.coupled);
    if (nextField.programming && next.operatingControls.programming) nextField.programming = { ...next.operatingControls.programming };
    for (const [n, b] of Object.entries(compiled.blocks)) if (nextField.blocks[n]) nextField.blocks[n] = { ...nextField.blocks[n], ...b };
  }
  return { profile: next, field: nextField, changes: { fragments: fragmentDiff(profile, next), routes } };
}
