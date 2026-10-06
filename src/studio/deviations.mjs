// Avvikelselistan: det som saknas eller strider i källorna, räknat vid varje läsning. Varje rad säger vad som löser den.
import { companionCheck } from './graph.mjs';
import { detectionInventory } from './detection.mjs';
import { buildRegistry } from './registry.mjs';

export function signalRelationCoverage({ profile, xml }) {
  // En JMRI-relation från → till har en tågväg när de två signalerna klareras i följd i någon tågväg.
  const follows = (a, b) => profile.routes.some(r => { const i = r.signals.indexOf(a); return i >= 0 && r.signals[i + 1] === b; });
  const matched = [], unmatched = [];
  for (const rel of xml.signalRelations) (follows(rel.from, rel.to) ? matched : unmatched).push(rel);
  return { total: xml.signalRelations.length, matched, unmatched };
}

export function deviations(sources, measured = {}) {
  const { profile, xml, coverage, indications } = sources;
  const registry = buildRegistry(sources, measured), det = detectionInventory(sources), pairs = companionCheck(xml, profile.coupled), rel = signalRelationCoverage(sources);
  const rows = [];
  const add = (id, title, count, resolvedBy, extra = {}) => rows.push({ id, title, count, resolvedBy, blocking: extra.blocking ?? false, items: extra.items ?? [], note: extra.note ?? '' });
  const benchSignals = registry.signals.filter(s => /bänkadress/.test(s.status));
  add('signal-bench', 'Signaler med bänkadress', benchSignals.length, 'Bindning ur XML och mätning', { blocking: true });
  const benchBlocks = registry.blocks.filter(b => /bänkadress/.test(b.status));
  add('block-bench', 'Spårledningar utan verklig ingång', benchBlocks.length, 'detection och mätning', { blocking: true, note: `${new Set(benchBlocks.map(b => b.loconet.report)).size} bänkadresser` });
  add('turnout-unmeasured', 'Växeladresser ej uppmätta i fält', registry.turnouts.filter(t => !t.measured?.field).length, 'Mät objekt', { blocking: true, items: registry.turnouts.filter(t => !t.measured?.field).map(t => t.id) });
  add('signal-relations', 'Signalrelationer i JMRI utan tågväg', rel.unmatched.length, 'Tågväg eller uttryckligt undantag', { items: rel.unmatched.map(r => `${r.from} → ${r.to}`) });
  const nxWithout = coverage.nx.filter(n => !n.routes.length);
  add('nx-without-route', 'NX-definitioner utan tågväg', nxWithout.length, 'Beslut per par', { items: nxWithout.map(n => `${n.fromSensor} → ${n.toSensor}`) });
  add('shunt-excluded', 'Undantagna växeltågvägar', coverage.excluded.length, 'Beslut per par', { items: coverage.excluded.map(e => `${e.from} → ${e.to}`) });
  const unresolvedGroups = profile.manualPolicies.rules.filter(r => r.status === 'unresolved');
  add('manual-groups', 'Manuella växelgrupper olösta', unresolvedGroups.length, 'follow eller condition', { items: unresolvedGroups.map(r => r.button) });
  const contradicting = profile.sourcePolicy.filter(r => r.status === 'unresolved');
  add('contradicting-rules', 'Motsägande tågvägsregler', contradicting.length, 'Beslut per regel', { items: contradicting.map(r => r.rule), note: `${contradicting.filter(r => r.rule.startsWith('IX:AUTO:0013')).length} huvud + ${contradicting.filter(r => r.rule.startsWith('IX:AUTO:0019')).length} växling` });
  const boundaries = Object.keys(profile.manualPolicies.boundaryOverrides || {});
  add('yard-boundaries', 'Gränsväxlar: TKL-lägen kontrolleras inte', boundaries.length, 'authority', { items: boundaries });
  const routeNx = new Set(profile.routes.flatMap(r => r.nxIds));
  const v4 = indications.indicators.find(i => i.name === 'V4'), v4Missing = v4 ? v4.conditions.filter(c => c.kind === 'nx' && !routeNx.has(c.id)) : [];
  add('crossing-v4', 'Vägövergång V4 saknar villkor', v4Missing.length, 'crossing', { items: v4Missing.map(c => c.label) });
  const mastTypes = [...new Set(registry.signals.map(s => s.mastType))].sort();
  add('swedish-aspects', 'Svenska beskedskoder saknas', mastTypes.length, 'aspect och MGP-underlag', { blocking: true, items: mastTypes, note: 'alla masttyper' });
  const auto9596 = ['IX:AUTO:0007C33', 'IX:AUTO:0007C34'].filter(id => xml.conditionals.some(c => c.system === id));
  const coupled9596 = (profile.coupled.Vx95 || []).includes('Vx96');
  add('vx95-vx96', 'Vx95/Vx96-automatiken ej införd', auto9596.length === 2 && !coupled9596 ? 1 : 0, 'follow', { items: auto9596 });
  add('xml-only-turnouts', 'Växlar i källan utan plats i planen', registry.xmlOnlyTurnouts.length, 'Beslut', { items: registry.xmlOnlyTurnouts });
  const turntable = xml.turnouts.filter(t => /^Vändskiva/.test(t.comment));
  add('turntable', 'Vändskivans anslutning okänd', turntable.length ? 1 : 0, 'MGP-underlag', { note: `${turntable.length} utgångar utan modul` });
  const prog = xml.turnouts.find(t => t.user === 'ProgSpår');
  add('programming-relay', 'Programmeringsspårets relä ej verifierat', prog ? 1 : 0, 'Mätning', { items: prog ? [prog.system] : [] });
  const badPairs = pairs.filter(p => !p.ok);
  add('companion-pairs', 'Kompispar som inte bildar förbindelse', badPairs.length, 'follow och mätning', { blocking: true, items: badPairs.map(p => p.pair.join(' + ')) });
  const undetected = [...det.undetected.noSensor, ...det.undetected.noRule];
  add('undetected-blocks', 'Spårledningar utan detektering i källan', undetected.length, 'detection eller uttryckligt odetekterat', { blocking: true, items: undetected });
  add('unbound-inputs', 'Detektoringångar som ingen spårledning använder', det.inputs.unbound.length, 'Gås igenom på banan', { items: det.inputs.unbound.map(u => u.system) });
  return rows;
}
