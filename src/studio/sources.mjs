// Studio läser tre källor: driftprofilen, panelgeometrin och Cda60.xml, plus de genererade filerna i public/data.
// Allt är läsning. Ingenting här ändrar driften.
import fs from 'node:fs';
const ROOT = new URL('../../', import.meta.url);
export function readJson(rel, root = ROOT) { return JSON.parse(fs.readFileSync(new URL(rel, root), 'utf8')); }
export function readText(rel, root = ROOT) { return fs.readFileSync(new URL(rel, root), 'utf8'); }

const attrs = s => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const tag = (body, name) => { const m = body.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? m[1] : null; };

// Regexläsning av de delar av JMRI-filen som Studio behöver. Filen är exporterad av JMRI och har stabil form.
export function parseLayoutXml(text) {
  const named = kind => [...text.matchAll(new RegExp(`<${kind}\\b([^>/]*)>([\\s\\S]*?)</${kind}>`, 'g'))].map(m => ({
    system: tag(m[2], 'systemName'), user: tag(m[2], 'userName'), comment: (tag(m[2], 'comment') || '').trim(), attrs: attrs(m[1]) }));
  const turnouts = named('turnout').filter(t => t.system);
  const sensors = named('sensor').filter(s => s.system);
  const blocks = named('block').filter(b => b.system).map(b => ({ ...b, occupancySensor: null }));
  for (const m of text.matchAll(/<block systemName="([^"]+)"[^>]*>([\s\S]*?)<\/block>/g)) {
    const b = blocks.find(x => x.system === m[1]); if (b) b.occupancySensor = tag(m[2], 'occupancysensor');
  }
  const byIdent = kind => Object.fromEntries([...text.matchAll(new RegExp(`<${kind} ([^>]*)>`, 'g'))].map(m => attrs(m[1])).map(a => [a.ident, a]));
  const conditionals = [...text.matchAll(/<conditional systemName="([^"]+)" userName="([^"]*)" antecedent="([^"]*)" logicType="(\d)"[^>]*>([\s\S]*?)<\/conditional>/g)].map(m => ({
    system: m[1], user: m[2], antecedent: m[3], logicType: Number(m[4]),
    variables: [...m[5].matchAll(/<conditionalStateVariable operator="(\d)" negated="(\w+)" type="(\d+)" systemName="([^"]+)"/g)].map(v => ({ operator: Number(v[1]), negated: v[2] === 'yes', type: Number(v[3]), name: v[4] })),
    actions: [...m[5].matchAll(/<conditionalAction option="(\d)" type="(\d+)" systemName="([^"]*)" data="(-?\d+)"/g)].map(a => ({ option: Number(a[1]), type: Number(a[2]), name: a[3], data: Number(a[4]) })) }));
  const signalRelations = [];
  for (const m of text.matchAll(/<signalmastlogic source="([^"]+)">([\s\S]*?)<\/signalmastlogic>/g))
    for (const d of m[2].matchAll(/<destinationMast destination="([^"]+)">/g)) signalRelations.push({ from: m[1], to: d[1] });
  const deb = text.match(/<globalDebounceTimers>\s*<goingActive>(\d+)<\/goingActive>\s*<goingInActive>(\d+)<\/goingInActive>/);
  // Signalmasterna: en TurnoutSignalMast sätter en JMRI-växel (LT-utgång) per besked, en VirtualSignalMast har ingen utgång alls.
  const signalMasts = [...text.matchAll(/<(turnoutsignalmast|virtualsignalmast)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(m => ({
    user: tag(m[2], 'userName'), system: tag(m[2], 'systemName'), type: /:([^:(]+)\(/.exec(tag(m[2], 'systemName') || '')?.[1] || null, virtual: m[1] === 'virtualsignalmast',
    aspects: [...m[2].matchAll(/<aspect defines="([^"]+)">\s*<turnout>([^<]+)<\/turnout>\s*<turnoutstate>(\w+)<\/turnoutstate>/g)].map(a => ({ name: a[1], turnout: a[2], state: a[3] })) }));
  return { turnouts, sensors, blocks, layoutTurnouts: byIdent('layoutturnout'), segments: byIdent('tracksegment'), points: byIdent('positionablepoint'),
    crossings: byIdent('levelxing'), conditionals, signalRelations, signalMasts, debounce: deb ? { goingActive: Number(deb[1]), goingInactive: Number(deb[2]) } : null };
}

let cache = null;
export function loadSources(root = ROOT) {
  if (cache && cache.root === root.href) return cache.sources;
  const profile = readJson('profiles/charlottendal-network.json', root);
  const sources = { profile, panel: readJson('public/data/panel.json', root), coverage: readJson('public/data/route-coverage.json', root),
    indications: readJson('public/data/indications.json', root), migration: readJson('public/data/migration.json', root),
    xml: parseLayoutXml(readText('public/data/source/Cda60.xml', root)) };
  for (const [name, doc] of [['route-coverage', sources.coverage], ['indications', sources.indications], ['migration', sources.migration]])
    if (doc.sourceHash !== profile.sourceHash) throw Error(`${name}.json hör till en annan källversion än driftprofilen.`);
  try { const rules = readJson('profiles/charlottendal-rules.json', root); if (rules.sourceHash !== profile.sourceHash) throw Error('charlottendal-rules.json hör till en annan källversion än driftprofilen.'); sources.rules = rules; }
  catch (e) { if (e.code !== 'ENOENT') throw e; sources.rules = null; }
  cache = { root: root.href, sources };
  return sources;
}
export const MODULE_RE = /^(M\d\d)(?:-(\d+)-(\d+))?\b/;
export function moduleOf(comment) { const m = MODULE_RE.exec(comment || ''); return m ? { name: m[1], base: m[2] ? Number(m[2]) : null, channel: m[3] ? Number(m[3]) : null } : null; }
