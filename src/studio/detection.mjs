// Spåravkänningen i källan: vilka ingångar som bildar varje spårledning, och vad som saknas.
import { moduleOf } from './sources.mjs';
// Block som inte är spår i panelen: vägövergångarnas lampor, perronger, ramen och vändskivan.
export const TRACKLESS = name => /^v\d/.test(name) || ['frame', 'friline', 'turntable', 'perrongu', 'perrongn'].includes(name);
export const SHAPES = { single: 'en ingång', any: 'någon av flera', all: 'alla av flera', turnoutPart: 'växelberoende del', noRule: 'sensor utan regel', noSensor: 'utan sensor' };

export function detectionInventory({ profile, xml }) {
  const sensors = Object.fromEntries(xml.sensors.map(s => [s.system, s]));
  const byUser = Object.fromEntries(xml.sensors.filter(s => s.user).map(s => [s.user, s.system]));
  const rules = {};
  // En regel kan sätta flera spårledningar (SN1B sätter slSN1b och slS170; "S95/96 kors" sätter slS95t och slS96c).
  for (const c of xml.conditionals) {
    for (const name of new Set(c.actions.filter(a => a.type === 9 && a.name.startsWith('sl')).map(a => a.name))) (rules[name] ??= []).push(c);
  }
  const physical = name => name.startsWith('LS') ? name : (byUser[name]?.startsWith('LS') ? byUser[name] : null);
  const isButton = v => v.name.startsWith('ss');                      // Spärra spår-knapparna i JMRI
  const inputsOf = src => { const out = []; for (const r of rules[src] || []) for (const v of r.variables) if ((v.type === 1 || v.type === 2) && !isButton(v)) { const p = physical(v.name); if (p && !out.includes(p)) out.push(p); } return out; };
  const shapeOf = src => {
    const rs = rules[src]; if (!rs) return 'noRule';
    const r = rs.find(x => !x.variables.some(isButton)) || rs[0];
    if (r.variables.some(v => v.type === 3 || v.type === 4)) return 'turnoutPart';
    const inputs = r.variables.filter(v => v.type === 1 || v.type === 2);
    if (inputs.length === 1) return 'single';
    return r.logicType === 2 ? 'any' : 'all';                           // JMRI: logicType 1 = alla, 2 = någon; antecedent-texten gäller bara typ 3
  };
  const sections = Object.entries(profile.blocks).map(([name, b]) => {
    const src = b.sourceSensor || null;
    const inputs = src ? inputsOf(src) : [];
    // bound: profilen använder redan exakt dessa LS-nummer som adresser, så ingen detekteringsregel behöver föreslås.
    const bound = inputs.length > 0 && JSON.stringify((b.inputs || [b]).map(i => i.address)) === JSON.stringify(inputs.map(p => Number(p.slice(2))));
    return { name, sourceSensor: src, shape: src ? shapeOf(src) : 'noSensor', inputs, inputDetails: inputs.map(p => ({ system: p, user: sensors[p].user, module: moduleOf(sensors[p].comment)?.name || null })),
      address: b.address, activeMeansOccupied: b.activeMeansOccupied, bound,
      blockedByButton: !!(src && (rules[src] || []).some(r => r.variables.some(isButton))), track: !TRACKLESS(name) };
  });
  const bySource = {}; for (const s of sections) if (s.sourceSensor) bySource[s.sourceSensor] = (bySource[s.sourceSensor] || 0) + 1;
  for (const s of sections) s.sharedWith = s.sourceSensor ? bySource[s.sourceSensor] : 0;
  const used = {}; for (const src of Object.keys(bySource)) for (const p of inputsOf(src)) used[p] = (used[p] || 0) + 1;
  const all = xml.sensors.filter(s => s.system.startsWith('LS')).map(s => s.system);
  const namedBlock = ls => { const m = /,\s*(\S.*)$/.exec(sensors[ls].comment || ''); return m ? m[1].trim() : null; };
  const unbound = all.filter(s => !used[s]).map(s => ({ system: s, user: sensors[s].user, comment: sensors[s].comment, module: moduleOf(sensors[s].comment)?.name || null, namedBlock: namedBlock(s) }));
  const counts = {}; for (const s of sections) counts[s.shape] = (counts[s.shape] || 0) + 1;
  return { sections, shapes: counts,
    inputs: { total: all.length, used: Object.keys(used).length, unbound, withoutModule: all.filter(s => !moduleOf(sensors[s].comment)).length,
      shared: Object.entries(used).filter(([, n]) => n > 1).map(([system, rules]) => ({ system, rules })).sort((a, b) => b.rules - a.rules) },
    undetected: { noSensor: sections.filter(s => s.shape === 'noSensor' && s.track).map(s => s.name), noRule: sections.filter(s => s.shape === 'noRule').map(s => s.name) },
    blockedByButton: [...new Set(sections.filter(s => s.blockedByButton).map(s => s.sourceSensor))].sort(), debounce: xml.debounce };
}
