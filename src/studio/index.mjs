// Studio, steg 1: objektregister och avvikelselista. Läser källorna och räknar; ändrar ingenting.
import { loadSources } from './sources.mjs';
import { buildRegistry } from './registry.mjs';
import { companionCheck, crossoverProposals } from './graph.mjs';
import { detectionInventory } from './detection.mjs';
import { deviations, signalRelationCoverage } from './deviations.mjs';
import { rulesFromProfile, compileRules, profileFragments, compiledFragments, validateRules, explainRule, ruleRoutes, proposeCrossoverRules, proposeDetectionRules, TYPE_LABEL, RUNS_IN } from './rules.mjs';
import { applyRules } from './apply.mjs';
export { loadSources, buildRegistry, companionCheck, crossoverProposals, detectionInventory, deviations, signalRelationCoverage, rulesFromProfile, compileRules, profileFragments, validateRules, explainRule, proposeCrossoverRules };

export function studioOverview(sources = loadSources(), measured = {}) {
  const registry = buildRegistry(sources, measured), det = detectionInventory(sources), rows = deviations(sources, measured);
  return {
    sourceHash: sources.profile.sourceHash, counts: registry.counts,
    modules: registry.modules.map(m => ({ id: m.id, refs: m.refs, outputs: m.outputs, inputs: m.inputs, turnouts: m.turnouts.length, signals: m.signals.length, status: m.status })),
    companions: companionCheck(sources.xml, sources.profile.coupled), crossovers: crossoverProposals(sources.xml),
    detection: { shapes: det.shapes, inputs: { total: det.inputs.total, used: det.inputs.used, unbound: det.inputs.unbound.length, withoutModule: det.inputs.withoutModule, shared: det.inputs.shared.length },
      undetected: det.undetected, blockedByButton: det.blockedByButton },
    signalRelations: (r => ({ total: r.total, matched: r.matched.length, unmatched: r.unmatched.length }))(signalRelationCoverage(sources)),
    deviations: rows, blocking: rows.filter(r => r.blocking && r.count > 0).length };
}

// Hela lasten för Studio-sidan: översikten plus objekten, spåravkänningens sektioner och signalrelationerna utan tågväg.
export function studioData(sources = loadSources(), activeRules = null, measured = {}) {
  const registry = buildRegistry(sources, measured), det = detectionInventory(sources), rel = signalRelationCoverage(sources), overview = studioOverview(sources, measured);
  return { ...overview, objects: { turnouts: registry.turnouts, signals: registry.signals, blocks: registry.blocks, modules: registry.modules }, rules: studioRules(sources, activeRules),
    detection: { ...overview.detection, sections: det.sections, unboundInputs: det.inputs.unbound, sharedInputs: det.inputs.shared },
    signalRelations: { total: rel.total, matched: rel.matched.length, unmatched: rel.unmatched } };
}

// Reglerna som Studio visar: regelfilen om den finns, annars härledda ur profilen. Varje regel får klartext,
// berörda tågvägar och valideringens anmärkningar. Förslagen för X1 och X2 kommer ur spårgrafen.
export function studioRules(sources = loadSources(), activeRules = null) {
  const { profile } = sources, rules = activeRules || sources.rules?.rules || rulesFromProfile(profile, { indications: sources.indications });
  const names = { turnouts: new Set(Object.keys(profile.turnouts)), blocks: new Set(Object.keys(profile.blocks)), signals: new Set(Object.keys(profile.signals)), lines: new Set(Object.keys(profile.operatingControls.lines)) };
  const problems = validateRules(rules, names);
  const compiled = compileRules(rules, { turnoutNames: Object.keys(profile.turnouts) });
  const identical = JSON.stringify(compiledFragments(compiled)) === JSON.stringify(JSON.parse(JSON.stringify(profileFragments(profile))));
  const baseDiff = applyRules(profile, rules).changes;
  const decorate = r => ({ ...r, typeLabel: TYPE_LABEL[r.type], runsInLabel: RUNS_IN[r.type], explain: explainRule(r), routes: ruleRoutes(profile, r), problems: problems.filter(p => p.rule === r.id).map(p => p.problem) });
  const proposal = proposeCrossoverRules(profile, rules, crossoverProposals(sources.xml), companionCheck(sources.xml, profile.coupled));
  // Detekteringsförslagen ur XML: ett per spårledning med ingångar i källan. Visas i genomgången, inte som enskilda kort under Regler.
  const detection = proposeDetectionRules(detectionInventory(sources).sections, rules);
  return { rules: rules.map(decorate), proposals: proposal.proposals.map(decorate), replaces: proposal.replaces, effects: proposal.effects, detectionProposals: detection.map(decorate),
    source: activeRules ? 'aktiv regelversion' : sources.rules ? 'profiles/charlottendal-rules.json' : 'härledda ur driftprofilen', compiledIdentical: identical, baseDiff: { fragments: baseDiff.fragments.length, routes: baseDiff.routes.length }, problems };
}
