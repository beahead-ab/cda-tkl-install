// AI-genomgången av hela anläggningen. Korten räknas deterministiskt ur avvikelserna, spårgrafen och reglerna;
// AI:n ordnar, bedömer och kompletterar dem. Varje förslag går samma väg som ett regelkort från chatten:
// validering, tillbakaläsning, simulatorprov, utkast och aktivering. Ingenting aktiveras av genomgången.
import { deviations, signalRelationCoverage } from './deviations.mjs';
import { companionCheck, crossoverProposals } from './graph.mjs';
import { proposeCrossoverRules, explainRule } from './rules.mjs';
import { toRules, decorateProposals, RULE_SCHEMA, RULE_LANGUAGE, nameLists, namesOf, nameSets } from './assistant.mjs';
import { detectionInventory } from './detection.mjs';
import { proposeDetectionRules } from './rules.mjs';

const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
export const CARD_TYPES = ['förslag', 'saknas', 'beslut', 'underlag'];
export const CARD_LABEL = { förslag: 'Förslag', saknas: 'Saknas', beslut: 'Beslut', underlag: 'Underlag' };
export const ACTION_LABEL = { draft: 'Skapa utkast', chat: 'Beskriv i chatten', data: 'Visa i data', bindings: 'Föreslå adresser ur XML', measure: 'Mät objekt', none: '' };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' }, strings = { type: 'array', items: string };
export const REVIEW_SCHEMA = object({
  summary: string,
  cards: { type: 'array', items: object({ id: string, type: { type: 'string', enum: CARD_TYPES }, priority: { type: 'integer' }, assessment: string }) },
  extra: { type: 'array', items: object({ title: string, type: { type: 'string', enum: CARD_TYPES }, text: string, objects: strings, rules: { type: 'array', items: RULE_SCHEMA } }) } });
const list = (xs, max = 6) => xs.length > max ? xs.slice(0, max).join(', ') + ` och ${xs.length - max} till` : xs.join(', ');

// Objektnamnen i en avvikelses rader, t.ex. "Vx140 + Vx142" eller "3/2 → 6/6".
const objectsIn = (items, known) => [...new Set(items.flatMap(i => String(i).split(/\s*(?:\+|→|,|\/(?=Vx))\s*/)).filter(t => known(t)))];

// Korten utan AI: det som källorna säger, i den form plan §5b beskriver.
export function reviewItems(sources, activeRules, profile = sources.profile) {
  const names = nameSets(profile), known = o => names.turnouts.has(o) || names.blocks.has(o) || names.signals.has(o);
  const rows = deviations(sources), dev = Object.fromEntries(rows.map(r => [r.id, r]));
  const companions = companionCheck(sources.xml, profile.coupled), crossings = crossoverProposals(sources.xml);
  const items = [];
  const push = (id, type, title, { text = '', count = 0, objects = [], list: rowsIn = [], rules = [], replaces = [], basis = [], action = 'none', related = [] } = {}) =>
    items.push({ id, type, title, text, count, objects, items: rowsIn, rules, replaces, basis, action, related, origin: 'källor', priority: null, assessment: '' });
  const fromDev = (code, type, title, extra = {}) => { const d = dev[code]; if (!d || !d.count) return null; return push(code, type, title, { text: extra.text ?? `${d.count} ${d.title.toLocaleLowerCase('sv')}. Löses av ${d.resolvedBy}.`, count: d.count, objects: extra.objects ?? objectsIn(d.items, known), list: d.items.slice(0, 60), basis: ['avv:' + code], ...extra }); };

  // Förslag
  const prop = proposeCrossoverRules(profile, activeRules, crossings, companions);
  for (const x of crossings) {
    const rules = prop.proposals.filter(p => p.source?.crossing === x.crossing); if (!rules.length) continue;
    const d = decorateProposals(rules, { profile, activeRules, names }), bad = companions.filter(c => !c.ok && c.pair.every(t => x.turnouts.includes(t)));
    push('x-' + x.crossing, 'förslag', `Dubbelkorsväxel ${x.crossing}: kompisparen följer inte ritningen`, { count: rules.length, objects: x.turnouts, rules: d.rules, replaces: d.replaces, basis: ['avv:companion-pairs'], action: 'draft',
      text: `I ritningen möts de avvikande benen diagonalt: ${x.pairs.map(p => p.join(' + ')).join(' och ')}. Dagens par ${bad.map(c => c.pair.join(' + ')).join(' och ')} bildar ingen förbindelse. Förslaget ersätter ${d.replaces.join(' och ')}; ${prop.effects.routesChanged} tågvägar ändrar växelläge. Bekräfta på banan innan aktivering.` });
  }
  const ok = companions.filter(c => c.ok);
  if (ok.length) push('companions-ok', 'förslag', 'Kompispar som stämmer med ritningen: behåll följreglerna', { count: ok.length, objects: ok.flatMap(c => c.pair), list: ok.map(c => c.pair.join(' + ')), related: activeRules.filter(r => r.type === 'follow' && ok.some(c => c.pair.every(t => r.objects.includes(t)))).map(r => r.id),
    text: `${ok.length} av ${companions.length} par bildar förbindelse i ritningen. Reglerna finns i dag och behålls; läget bekräftas under Mät objekt.` });
  if (dev['vx95-vx96']?.count) { const d = decorateProposals(toRules([{ type: 'follow', objects: ['Vx95', 'Vx96'], relation: 'same', bothWays: true }], { origin: 'genomgång', text: 'Vx95/Vx96-automatiken i JMRI', activeRules }), { profile, activeRules, names });
    push('vx95-vx96', 'förslag', 'Vx95 och Vx96: JMRI:s automatik saknas som följregel', { count: 1, objects: ['Vx95', 'Vx96'], rules: d.rules, replaces: d.replaces, basis: ['avv:vx95-vx96'], action: 'draft', list: dev['vx95-vx96'].items,
      text: `Logix ${dev['vx95-vx96'].items.join(' och ')} lägger Vx95 och Vx96 tillsammans, men i profilen är de inte kopplade. Förslag: en följregel. Bekräfta på banan att de ska ligga lika innan aktivering.` }); }
  fromDev('yard-boundaries', 'förslag', 'Gränsväxlar mot rangerbangården: manöverrätten finns, TKL-lägena kontrolleras inte', { action: 'chat', related: activeRules.filter(r => r.type === 'authority').map(r => r.id),
    text: `${dev['yard-boundaries']?.items.join(', ')} har manöverrätt i dag (${activeRules.filter(r => r.type === 'authority').map(explainRule).join(' ')}) Kärnan prövar bara rangerarens lägen. Ska TKL:s lägen begränsas, beskriv det i chatten; den fysiska överlämningen mäts under Mät objekt när rangerpanelen är ansluten.` });
  fromDev('signal-bench', 'förslag', 'Signaladresser: utgångarna ur XML ersätter bänkadresserna', { action: 'bindings', text: `${dev['signal-bench']?.count} signaler har bänkadresser i simulatorn. Utgången LTn i Cda60.xml blir order- och rapportadress n som utkast till driftbindningar, status ej uppmätt, och mäts under Mät objekt. Rapportadressen för Signal10:s besked är ett antagande tills bänkprovet gjorts.` });
  const detection = decorateProposals(proposeDetectionRules(detectionInventory(sources).sections, activeRules), { profile, activeRules, names });
  fromDev('block-bench', 'förslag', 'Spårledningar: ingångarna ur XML ersätter bänkadresserna', { action: 'draft', rules: detection.rules, replaces: detection.replaces, objects: detection.rules.map(r => r.object),
    text: `${dev['block-bench']?.count} spårledningar saknar verklig ingång (${dev['block-bench']?.note}). ${detection.rules.length} detekteringsregler ur Cda60.xml: LS-numret som adress, någon av eller alla ingångar, polaritet antagen. Utkastet provas i simulatorn; aktivering kräver färska rapporter på de nya adresserna, alltså mätning på banan.` });
  // Saknas
  fromDev('manual-groups', 'saknas', 'Manuella växelgrupper utan entydig manöverregel', { action: 'chat', objects: activeRules.filter(r => r.type === 'condition' && r.trigger === 'manual' && r.status === 'unresolved').flatMap(r => r.objects),
    related: activeRules.filter(r => r.type === 'condition' && r.trigger === 'manual' && r.status === 'unresolved').map(r => r.id),
    text: `Knappgrupperna ${dev['manual-groups']?.items.join(', ')} har ingen verifierad koppling i ritningen, så direktmanövern är spärrad. Beskriv villkoret för varje grupp i chatten: vilka växlar, vilka spårledningar som ska vara fria och vilka signaler i stopp.` });
  const indicators = (sources.indications?.indicators || []).map(i => i.name);
  if (indicators.length) push('crossings', 'saknas', `Vägövergångarna ${indicators[0]}–${indicators.at(-1)} saknar regler`, { count: indicators.length, list: indicators, basis: dev['crossing-v4']?.count ? ['avv:crossing-v4'] : [], action: 'step6',
    related: activeRules.filter(r => r.type === 'crossing').map(r => r.id),
    text: `Vägövergångarna finns som crossing-regler med tågvägarna och spårledningarna som aktiverar dem, men bara för visning i panelen. Förringning, bomåterrapport och spärr av tågväg väntar på MGP-underlag.${dev['crossing-v4']?.count ? ` V4 saknar dessutom ${dev['crossing-v4'].count} villkor i källan (${list(dev['crossing-v4'].items, 4)}).` : ''}` });
  fromDev('undetected-blocks', 'saknas', 'Spårledningar utan detektering i källan', { action: 'chat', text: `${dev['undetected-blocks']?.count} spårledningar har ingen sensor eller ingen regel i XML. Beskriv ingången i chatten (detection: spårledning och LS-ingång), eller märk spårledningen uttryckligt odetekterad.` });
  // Beslut
  fromDev('contradicting-rules', 'beslut', 'Motsägande tågvägsregler i källan', { action: 'data', text: `${dev['contradicting-rules']?.note}: ${dev['contradicting-rules']?.items.join(', ')}. Varje regel behöver ett beslut: gäller tågvägen eller inte.` });
  fromDev('signal-relations', 'beslut', 'Signalrelationer i JMRI utan tågväg', { action: 'data', text: `${dev['signal-relations']?.count} av ${signalRelationCoverage(sources).total} relationer från signal till signal saknar tågväg i TKL. Antingen saknas en tågväg, eller så används relationen inte och det ska sägas uttryckligen.` });
  fromDev('nx-without-route', 'beslut', 'NX-definitioner utan tågväg', { action: 'data' });
  fromDev('shunt-excluded', 'beslut', 'Undantagna växeltågvägar', { action: 'data' });
  fromDev('xml-only-turnouts', 'beslut', 'Växlar i källan utan plats i planen', { action: 'data', objects: [], text: `${dev['xml-only-turnouts']?.items.join(', ')} finns i Cda60.xml men inte i planen. Beslut: ta in i planen eller lämna utanför.` });
  // Underlag
  fromDev('turnout-unmeasured', 'underlag', 'Växeladresser ur JMRI, ej uppmätta i fält', { action: 'measure', objects: [] });
  fromDev('swedish-aspects', 'underlag', 'Svenska beskedskoder per masttyp', { action: 'none', objects: [], related: activeRules.filter(r => r.type === 'aspect').map(r => r.id), text: `Beskedskoderna saknas för alla ${dev['swedish-aspects']?.count} masttyper (${dev['swedish-aspects']?.items.join(', ')}). Reglerna aspect:<masttyp> håller CZ-provkoderna tills Signal10:s svenska koder finns; då blir regeln regelägd och ersätter bindningarnas koder.` });
  fromDev('turntable', 'underlag', 'Vändskivans anslutning okänd', { text: `Vändskivan har utgångar i XML utan modul (${dev['turntable']?.note}). Bara MGP-uppgifterna kan avgöra kopplingen.` });
  fromDev('programming-relay', 'underlag', 'Programmeringsspårets relä ej verifierat', { action: 'measure' });
  fromDev('unbound-inputs', 'underlag', 'Detektoringångar som ingen spårledning använder', { action: 'data', objects: [], text: `${dev['unbound-inputs']?.count} ingångar i XML används av ingen spårledning. Gås igenom på banan; en del är troligen reserver eller knappar.` });
  return items;
}

const reviewSystem = names => `Du går igenom hela Charlottendals anläggning i Studio, ett ställverk (TKL) för en modelljärnväg. Utgångspunkten är att reglerna ska följa det som är ritat. Du får korten som räknats fram deterministiskt ur källorna (JMRI-ritningen Cda60.xml, driftprofilen och spårgrafen) och en sammanfattning av anläggningen. Du bedömer, ordnar och kompletterar; du avgör ingenting, och ingenting aktiveras av genomgången.
Korttyper: förslag (regel eller bindning att granska), saknas (regel som behövs men inte finns), beslut (källan säger emot sig själv; operatören måste välja), underlag (bara MGP-uppgifter eller mätning på banan kan avgöra).
För varje kort: behåll id, ange priority (1 är det som bör göras först) och skriv assessment på svenska, två till fyra meningar: vad ritningen och källorna säger, vad som bör göras och varför det kommer i den ordningen. Byt type bara när källorna motiverar det. summary är en kort sammanfattning av läget och ordningen.
extra är kort för sådant som de givna korten inte täcker och som går att belägga i underlaget; lämna listan tom om inget sådant finns. Ett förslag med regler följer regelspråket nedan med exakta objektnamn; TKL validerar dem. Hitta aldrig på objekt, adresser eller mätvärden.
${RULE_LANGUAGE}
${nameLists(names)}`;

// AI:ns svar läggs på korten: bedömning, prioritet, eventuellt byte av typ, och extra kort med validerade regler.
export function mergeReview(items, parsed, { profile, activeRules, names }) {
  const known = o => names.turnouts.has(o) || names.blocks.has(o) || names.signals.has(o);
  const byId = new Map(items.map(i => [i.id, i])), seen = new Set();
  for (const c of Array.isArray(parsed.cards) ? parsed.cards : []) {
    const it = byId.get(c?.id); if (!it || seen.has(c.id)) continue; seen.add(c.id);
    it.assessment = String(c.assessment || '').slice(0, 2000); it.priority = Number.isInteger(c.priority) && c.priority > 0 ? c.priority : null;
    if (CARD_TYPES.includes(c.type) && c.type !== it.type) { it.typeFromSources = it.type; it.type = c.type; }
  }
  const extra = (Array.isArray(parsed.extra) ? parsed.extra : []).slice(0, 20).map((x, i) => {
    const title = String(x?.title || '').slice(0, 200), rules = toRules(x?.rules, { origin: 'genomgång', text: title, activeRules }), d = decorateProposals(rules, { profile, activeRules, names });
    return { id: 'ai:' + (i + 1), type: CARD_TYPES.includes(x?.type) ? x.type : 'underlag', title, text: String(x?.text || '').slice(0, 2000), count: rules.length, objects: (Array.isArray(x?.objects) ? x.objects : []).map(String).filter(known).slice(0, 40), items: [],
      rules: d.rules, replaces: d.replaces, basis: [], action: d.rules.length ? 'draft' : 'none', related: [], origin: 'ai', priority: items.length + i + 1, assessment: '' };
  });
  const cards = [...items, ...extra].map((c, i) => ({ ...c, order: i })).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || a.order - b.order).map(({ order, ...c }) => c);
  return { summary: String(parsed.summary || '').slice(0, 4000), cards };
}

export class StudioReview {
  constructor({ sources, assistant, storage, activeRules, baseProfile, now = Date.now }) {
    this.sources = sources; this.assistant = assistant; this.storage = storage; this.activeRules = activeRules; this.baseProfile = baseProfile; this.now = now; this.running = false;
    const d = storage.load('studio-review.json', null); this.data = d && d.schema === 1 && Array.isArray(d.cards) ? d : null;
  }
  items() { return reviewItems(this.sources, this.activeRules(), this.baseProfile()); }
  view() { return { assistant: this.assistant.view(), running: this.running, last: this.data }; }
  // Deterministiska kort alltid; med nyckel ordnar och bedömer AI:n dem. Resultatet sparas tills nästa körning.
  async run() {
    if (this.running) fail('Genomgången körs redan.', 409);
    this.running = true;
    try {
      const profile = this.baseProfile(), activeRules = this.activeRules(), names = nameSets(profile), items = this.items();
      let result = { mode: 'deterministisk', model: null, usage: null, summary: '', cards: items };
      if (this.assistant.configured) {
        const unresolved = activeRules.filter(r => r.type === 'condition' && r.trigger === 'manual' && r.status === 'unresolved');
        const input = { cards: items.map(c => ({ id: c.id, type: c.type, title: c.title, count: c.count, text: c.text, objects: c.objects.slice(0, 20), items: c.items.slice(0, 20), rules: c.rules.map(r => ({ id: r.id, explain: r.explain, problems: r.problems })), related: c.related })),
          plant: { counts: { turnouts: Object.keys(profile.turnouts).length, signals: Object.keys(profile.signals).length, blocks: Object.keys(profile.blocks).length, routes: profile.routes.length },
            companions: companionCheck(this.sources.xml, profile.coupled), crossings: crossoverProposals(this.sources.xml), yardBoundaries: Object.keys(profile.yardBoundaries || {}),
            rules: activeRules.map(r => ({ id: r.id, type: r.type, status: r.status, explain: explainRule(r) })),
            unresolvedManualGroups: unresolved.map(r => ({ button: r.button, turnouts: r.objects, reason: r.reason })),
            contradictingRouteRules: (profile.sourcePolicy || []).filter(r => r.status === 'unresolved').map(r => ({ rule: r.rule, name: r.name, problems: r.problems })),
            unmatchedSignalRelations: signalRelationCoverage(this.sources).unmatched.map(r => `${r.from} → ${r.to}`), programming: profile.operatingControls?.programming || null } };
        const { parsed, model, usage } = await this.assistant.ask({ system: reviewSystem(namesOf(profile)), input, schema: REVIEW_SCHEMA });
        result = { mode: 'ai', model, usage, ...mergeReview(items, parsed, { profile, activeRules, names }) };
      }
      const counts = Object.fromEntries(CARD_TYPES.map(t => [t, result.cards.filter(c => c.type === t).length]));
      this.data = { schema: 1, at: this.now(), ...result, counts };
      this.storage.save('studio-review.json', this.data);
    } finally { this.running = false; }
    return this.view();
  }
}
