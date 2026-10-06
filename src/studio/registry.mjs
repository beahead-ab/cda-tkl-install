// Objektregistret: TKL-namn, fysisk bindning och spårbarhet för växlar, signaler, spårledningar och moduler.
// Allt är läst ur driftprofilen, panelgeometrin och Cda60.xml. Status säger hur mycket som är bevisat: ingenting är uppmätt.
import { moduleOf } from './sources.mjs';
const STATUS = { xml: 'ur XML, ej uppmätt', bench: 'bänkadress i simulatorn', virtual: 'virtuell i JMRI, ingen utgång', none: 'ingen bindning' };
const statusOf = (binding, provenance) => binding.virtual ? STATUS.virtual : /bench|bänkadress/i.test(provenance) ? STATUS.bench : /ej uppmätt|not measured/i.test(provenance) ? STATUS.xml : provenance;

// measured: nyckel kind:namn → giltig mätning (samma adress som profilen). Fältmätning räknas för drift, bänkmätning bara i simulatorn.
export function buildRegistry({ profile, panel, xml }, measured = {}) {
  const measure = (kind, id) => measured[kind + ':' + id] || null;
  const lt = Object.fromEntries(xml.turnouts.map(t => [t.user, t])), ls = xml.sensors;
  const panelTurnouts = new Set(Object.values(panel.turnouts).map(t => t.name));
  const trace = (system, comment) => ({ system, comment, module: moduleOf(comment) });
  const turnouts = Object.entries(profile.turnouts).map(([id, t]) => {
    const src = lt[id];
    return { id, kind: 'turnout', inPlan: panelTurnouts.has(id), loconet: { order: t.address, report: t.address }, block: t.block,
      companions: (profile.coupled[id] || [id]).filter(x => x !== id), status: statusOf(t, t.provenance),
      measured: measure('turnout', id), source: src ? trace(src.system, src.comment) : null };
  });
  const signalOutputs = {};
  for (const t of xml.turnouts) { const m = /(?:signal|siganl)\s+([^,]+)/i.exec(t.comment); if (m) (signalOutputs[m[1].trim()] ??= []).push(trace(t.system, t.comment)); }
  const masts = Object.fromEntries(panel.micons.map(m => [m.mast, m]));
  const signals = Object.entries(profile.signals).map(([id, s]) => ({ id, kind: 'signal', mastType: s.sourceType, inPlan: !!masts[id], virtual: !!s.virtual,
    loconet: s.virtual ? { order: null, report: null, stopCodes: [], goCodes: [] } : { order: s.address, report: s.reportAddress, stopCodes: s.stopCodes, goCodes: s.goCodes }, status: statusOf(s, s.provenance),
    measured: measure('signal', id), source: signalOutputs[id] || [], output: s.sourceOutput || null, swedishAspects: false }));
  const blocks = Object.entries(profile.blocks).map(([id, b]) => ({ id, kind: 'block', loconet: { report: b.address, inputs: (b.inputs || [b]).map(i => i.address), logic: b.logic || null, activeMeansOccupied: b.activeMeansOccupied },
    sourceSensor: b.sourceSensor, sourceInputs: b.sourceInputs || [], status: statusOf(b, b.provenance), measured: measure('block', id) }));
  const modules = {};
  for (const item of [...xml.turnouts.map(t => ({ ...t, io: 'out' })), ...ls.map(s => ({ ...s, io: 'in' }))]) {
    const m = moduleOf(item.comment); if (!m) continue;
    const mod = modules[m.name] ??= { id: m.name, kind: 'module', outputs: 0, inputs: 0, turnouts: [], signals: [], refs: 0, decoder: null, firmware: null, status: 'ur kommentarer, ej uppmätt' };
    mod.refs++; mod[item.io === 'out' ? 'outputs' : 'inputs']++;
    if (item.io === 'out' && /^Vx\d+$/.test(item.user || '')) mod.turnouts.push(item.user);
    const sig = /(?:signal|siganl)\s+([^,]+)/i.exec(item.comment); if (sig && !mod.signals.includes(sig[1].trim())) mod.signals.push(sig[1].trim());
  }
  const xmlOnlyTurnouts = xml.turnouts.filter(t => /^Vx\d+$/.test(t.user || '') && !profile.turnouts[t.user]).map(t => t.user);
  return { turnouts, signals, blocks, modules: Object.values(modules).sort((a, b) => a.id.localeCompare(b.id)), xmlOnlyTurnouts,
    counts: { turnouts: turnouts.length, signals: signals.length, blocks: blocks.length, routes: profile.routes.length, modules: Object.keys(modules).length,
      measured: { field: [...turnouts, ...signals, ...blocks].filter(o => o.measured?.field).length, bench: [...turnouts, ...signals, ...blocks].filter(o => o.measured && !o.measured.field).length } } };
}
