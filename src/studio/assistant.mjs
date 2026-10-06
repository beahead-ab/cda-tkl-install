// Chatten: fritext eller dikterat tal blir regelkort. AI:n är en översättare, aldrig en auktoritet: TKL validerar
// varje regel deterministiskt, läser tillbaka den på svenska och provar den i simulatorn innan något blir utkast.
// Nyckeln ligger på servern (ANTHROPIC_API_KEY). Webbläsaren talar bara med TKL-servern.
import Anthropic from '@anthropic-ai/sdk';
import { validateRules, explainRule, ruleRoutes, replacedBy, TYPE_LABEL, RUNS_IN } from './rules.mjs';
import { buildGraph } from './graph.mjs';

const fail = (message, status = 502) => { throw Object.assign(Error(message), { status }); };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string' }, strings = { type: 'array', items: string }, position = { type: 'string', enum: ['C', 'T'] };
const uniq = xs => [...new Set((xs || []).map(x => String(x).trim()).filter(Boolean))];

// Regelkortet som AI:n får fylla i. Fält som inte hör till typen lämnas tomma; TKL gör om det till regelspråket.
export const RULE_SCHEMA = object({
  type: { type: 'string', enum: ['follow', 'forbid', 'authority', 'condition', 'detection'] },
  objects: strings,
  inputs: strings, logic: { type: 'string', enum: ['any', 'all', ''] },
  relation: { type: 'string', enum: ['same', 'opposite', ''] },
  bothWays: { type: 'boolean' },
  tkl: { type: 'array', items: position }, ranger: { type: 'array', items: position },
  positions: { type: 'array', items: object({ object: string, position }) },
  requires: object({ blocks: strings, signals: strings }),
  note: string });
export const PROPOSE_SCHEMA = object({ message: string, objects: strings, questions: strings, rules: { type: 'array', items: RULE_SCHEMA } });

export const RULE_LANGUAGE = `Regelspråket, de fem typer som kan skapas här:
- follow: växlarna i objects läggs alltid lika (relation "same") eller motsatt ("opposite"). bothWays true betyder att en order till vilken som helst av dem går till alla. Dagens kärna verkställer bara same med bothWays; annat validerar inte.
- forbid: kombinationen i positions får aldrig förekomma. Prövas före varje manuell order och tågväg.
- authority: för växeln i objects: tkl är lägena TKL får lägga, ranger lägena rangeraren får lägga. Finns bara för gränsväxlarna mot rangerbangården (Vx112, Vx131, Vx154).
- condition: manuell omläggning av växlarna i objects kräver att spårledningarna i requires.blocks är fria och att signalerna i requires.signals visar stopp. Ersätter den manöverregel som i dag gäller för samma växlar.
- detection: spårledningen objects[0] är belagd när någon av (logic "any") eller alla (logic "all") ingångarna i inputs är aktiva. Ingångar heter LS följt av nummer ur Cda60.xml (LS90); numret blir LocoNet-adressen. Ersätter spårledningens nuvarande bindning.
Signalbesked (aspect) och vägövergångar (crossing) kan inte skapas här; de väntar på MGP-underlag.
Lägen: C är rakt spår (normalläge), T är avvikande (omlagt). Fält som inte hör till typen lämnas tomma: tomma listor, tom sträng, bothWays true.`;

const NAMING = `Namn: växlar heter Vx följt av nummer (Vx100). Spårledningar heter S följt av nummer eller bokstäver (S100, SIA, SN2A). Signaler heter som på ställverkets tavla (1/5, Au, An, Xv). Använd bara namn ur listorna nedan, exakt skrivna. Diktering hör fel på fackord: "växel hundra", "vä x 100" och "vx 100" är Vx100; "ess hundra" är S100; "Jimmy" är JMRI.`;
export const nameLists = names => `Växlar: ${names.turnouts.join(' ')}\nSignaler: ${names.signals.join(' ')}\nSpårledningar: ${names.blocks.join(' ')}${names.inputs?.length ? '\nIngångar: ' + names.inputs.join(' ') : ''}`;

const proposeSystem = names => `Du är regelassistent i Charlottendal Studio, ett ställverk (TKL) för en modelljärnväg. Operatören skriver eller dikterar vad som ska gälla för växlar, spårledningar och signaler. Du översätter till regelkort enligt schemat. Du är en översättare, aldrig en auktoritet: TKL validerar varje regel deterministiskt, läser tillbaka den på svenska och provar den i simulatorn innan något blir utkast.
${RULE_LANGUAGE}
${NAMING}
Svaret följer schemat. message är ett kort svar på svenska om vad du förstod och vad som blev regel. objects är de objekt beskrivningen avser. Är något tvetydigt, eller gäller det detektering, signalbesked eller vägövergångar som inte kan uttryckas i de fyra typerna: lämna rules tom och ställ frågan i questions. Hitta aldrig på objekt.
${nameLists(names)}`;

export const namesOf = (profile, xml = null) => ({ turnouts: Object.keys(profile.turnouts), signals: Object.keys(profile.signals), blocks: Object.keys(profile.blocks), inputs: (xml?.sensors || []).map(s => s.system).filter(s => /^LS\d+$/.test(s)) });
export const nameSets = profile => ({ turnouts: new Set(Object.keys(profile.turnouts)), blocks: new Set(Object.keys(profile.blocks)), signals: new Set(Object.keys(profile.signals)), lines: new Set(Object.keys(profile.operatingControls?.lines || {})) });
const touches = r => [...(r.type === 'aspect' ? r.signals || [] : r.type === 'crossing' ? r.blocks || [] : r.objects || (r.object ? [r.object] : [])), ...(r.requires?.blocks || []), ...(r.requires?.signals || []), ...Object.keys(r.positions || {})];

// Det AI:n får se om urvalet: objektens grannar i spårgrafen och de regler som redan gäller dem.
export function assistantContext({ profile, xml }, activeRules, objects = []) {
  const graph = xml ? buildGraph(xml) : null;
  const selection = uniq(objects).filter(o => profile.turnouts[o] || profile.blocks[o] || profile.signals[o]).slice(0, 12);
  const details = selection.map(o => {
    if (profile.turnouts[o]) { const t = profile.turnouts[o], end = graph?.divergingEnd(o); return { object: o, kind: 'växel', block: t.block, group: profile.coupled?.[o] || [o], divergingLeadsTo: end?.turnout || end?.object || null, routes: profile.routes.filter(r => r.turnouts[o]).length }; }
    if (profile.blocks[o]) { const b = profile.blocks[o]; return { object: o, kind: 'spårledning', binding: b.inputs ? { inputs: b.inputs, logic: b.logic } : { address: b.address, activeMeansOccupied: b.activeMeansOccupied }, sourceSensor: b.sourceSensor || null, turnouts: Object.entries(profile.turnouts).filter(([, t]) => t.block === o).map(([n]) => n), routes: profile.routes.filter(r => r.blocks.includes(o)).length }; }
    return { object: o, kind: 'signal', routes: profile.routes.filter(r => r.signals.includes(o)).length };
  });
  const existingRules = activeRules.filter(r => touches(r).some(o => selection.includes(o))).map(r => ({ id: r.id, type: r.type, status: r.status, explain: explainRule(r) }));
  return { selection: details, existingRules, names: namesOf(profile, xml) };
}

// Från AI:ns kort till regelspråket. Allt som kärnan behöver sätts här, aldrig av AI:n.
export function toRules(items, { origin = 'chatt', text = '', activeRules = [] } = {}) {
  const base = () => ({ runsIn: 'tkl', status: 'active', source: { studio: origin, text: String(text).slice(0, 500) } });
  return (Array.isArray(items) ? items : []).slice(0, 20).map(item => {
    const objects = uniq(item?.objects);
    if (item?.type === 'follow') { const sorted = [...objects].sort(); return { id: 'follow:' + sorted.join('+'), type: 'follow', objects: sorted, relation: item.relation || 'same', bothWays: item.bothWays !== false, ...base() }; }
    if (item?.type === 'forbid') { const positions = Object.fromEntries((Array.isArray(item.positions) ? item.positions : []).map(p => [String(p?.object || '').trim(), p?.position]).filter(([o]) => o)); return { id: 'forbid:' + Object.entries(positions).map(([o, p]) => o + '=' + p).join('+'), type: 'forbid', positions, ...base() }; }
    if (item?.type === 'authority') {
      const o = objects[0] || '?', existing = activeRules.find(r => r.type === 'authority' && r.object === o);
      return { id: 'authority:' + o, type: 'authority', object: o, tkl: uniq(item.tkl), ranger: uniq(item.ranger), ...(existing?.detail ? { detail: existing.detail } : {}), ...base(), source: { ...base().source, button: existing?.source?.button || null, provenance: 'Studio ' + origin + (existing ? ', ersätter ' + existing.id : '') } };
    }
    if (item?.type === 'detection') { const inputs = uniq(item.inputs).map(sys => ({ system: sys, address: Number(sys.replace(/^LS/, '')) || null, activeMeansOccupied: true })); return { id: 'detection:' + (objects[0] || '?'), type: 'detection', object: objects[0] || '?', logic: item.logic === 'all' ? 'all' : 'any', inputs, owner: 'rule', ...base() }; }
    if (item?.type === 'condition') return { id: 'condition:manual:' + objects.join('/'), type: 'condition', trigger: 'manual', objects, button: null, requires: { freeSensors: [], blocks: uniq(item.requires?.blocks), signals: uniq(item.requires?.signals), inactiveNX: [] }, ...base() };
    return { id: 'okänd:' + String(item?.type || '?'), type: String(item?.type || 'okänd'), objects, ...base() };
  });
}

// Validering mot de aktiva reglerna, tillbakaläsning och berörda tågvägar. Det här är det operatören godkänner.
export function decorateProposals(rules, { profile, activeRules, names }) {
  const replaces = replacedBy(rules, activeRules);
  const live = rules.map(r => ({ ...r, status: 'active' }));
  const problems = validateRules([...activeRules.filter(r => !replaces.includes(r.id)), ...live], names);
  const dup = new Set(rules.filter((r, i) => rules.findIndex(x => x.id === r.id) !== i).map(r => r.id));
  return { replaces, rules: rules.map(r => ({ ...r, typeLabel: TYPE_LABEL[r.type] || r.type, runsInLabel: RUNS_IN[r.type] || '–', explain: explainRule(r), routes: profile ? ruleRoutes(profile, r) : [],
    replaces: replacedBy([r], activeRules), problems: [...new Set([...problems.filter(p => p.rule === r.id).map(p => p.problem), ...(dup.has(r.id) ? ['Samma regel föreslås två gånger'] : [])])] })) };
}

const mapError = e => {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return Object.assign(Error('AI-anslutningens nyckel eller behörighet behöver kontrolleras.'), { status: 502 });
  if (e instanceof Anthropic.RateLimitError) return Object.assign(Error('AI-tjänstens kvot är nådd. Försök senare eller kontrollera kontot.'), { status: 502 });
  if (e instanceof Anthropic.APIConnectionError) return Object.assign(Error('AI-tjänsten kunde inte nås eller hann inte svara.'), { status: 502 });
  if (e instanceof Anthropic.APIError) return Object.assign(Error(`AI-tjänsten svarade med fel ${e.status ?? ''}: ${e.message}`.replace(/\s+/g, ' ')), { status: 502 });
  return e;
};

export class StudioAssistant {
  // Nyckel och modell läses vid varje anrop: ur appens inställningar (AiSettings, Inställningar → AI-tjänst) när sådana finns,
  // annars ur miljön. Klienten byggs om när nyckeln byts, så ett sparat byte gäller utan omstart.
  constructor({ settings = null, key = undefined, model = undefined, fetcher = undefined, timeout = 600000 } = {}) {
    this.settings = settings || { key: key ?? (process.env.ANTHROPIC_API_KEY || ''), model: model ?? (process.env.CHARLOTTENDAL_STUDIO_MODEL || 'claude-opus-5-5') };
    this.fetcher = fetcher; this.timeout = timeout; this.provider = 'Anthropic'; this.cached = null;
  }
  get key() { return this.settings.key || ''; }
  get model() { return this.settings.model || 'claude-opus-5-5'; }
  get configured() { return !!this.key; }
  get client() {
    const key = this.key; if (!key) return null;
    if (!this.cached || this.cached.key !== key) this.cached = { key, client: new Anthropic({ apiKey: key, maxRetries: 1, timeout: this.timeout, ...(this.fetcher ? { fetch: this.fetcher } : {}) }) };
    return this.cached.client;
  }
  view() { return { configured: this.configured, provider: this.provider, model: this.model }; }
  // Provanropet från Inställningar: ett litet riktigt anrop med strukturerat svar, så att nyckel, modell och nätväg prövas på riktigt.
  async probe() {
    const schema = { type: 'object', properties: { ok: { type: 'boolean' }, greeting: { type: 'string' } }, required: ['ok', 'greeting'], additionalProperties: false };
    const { parsed, model, usage } = await this.ask({ system: 'Du är AI-tjänsten i Charlottendal TKL. Svara enligt schemat: ok är true och greeting en kort hälsning på svenska.', input: { test: 'anslutning' }, schema, maxTokens: 2000, effort: 'low' });
    if (parsed.ok !== true) fail('AI-tjänsten svarade, men inte enligt schemat.', 502);
    return { ok: true, model, greeting: String(parsed.greeting || ''), usage };
  }
  // Ett anrop, ett strukturerat svar enligt schemat. Systemtexten är stabil och cachas; urvalet ligger i meddelandet.
  async ask({ system, input, schema, maxTokens = 16000, effort = 'high' }) {
    if (!this.configured) fail('AI-tjänsten är inte ansluten. Lägg till serverns API-nyckel först.', 503);
    let response;
    try {
      response = await this.client.beta.messages.create({ model: this.model, max_tokens: maxTokens, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', thinking: { type: 'adaptive' },
        output_config: { effort, format: { type: 'json_schema', schema } },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }], messages: [{ role: 'user', content: JSON.stringify(input) }] });
    } catch (e) { throw mapError(e); }
    if (response.stop_reason === 'refusal') fail('AI-tjänsten avböjde att behandla underlaget.');
    if (response.stop_reason === 'max_tokens') fail('AI-svaret rymdes inte. Dela upp beskrivningen.');
    const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let parsed; try { parsed = JSON.parse(text); } catch { fail('AI-tjänsten lämnade ett oläsbart svar.'); }
    if (!parsed || typeof parsed !== 'object') fail('AI-tjänsten lämnade ett oläsbart svar.');
    const u = response.usage || {};
    return { parsed, model: response.model || this.model, usage: { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cached: u.cache_read_input_tokens ?? 0 } };
  }
  // Fritext → regelkort. Svaret innehåller TKL:s egen tillbakaläsning, validering och vilka regler som ersätts.
  async propose({ text, objects = [] } = {}, { profile, xml, activeRules, names }) {
    const t = String(text ?? '').trim();
    if (t.length < 3 || t.length > 2000) fail('Beskriv regeln med 3–2000 tecken.', 400);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t)) fail('Ogiltig text.', 400);
    const ctx = assistantContext({ profile, xml }, activeRules, Array.isArray(objects) ? objects : []);
    const { parsed, model, usage } = await this.ask({ system: proposeSystem(ctx.names), input: { text: t, selection: ctx.selection, existingRules: ctx.existingRules }, schema: PROPOSE_SCHEMA });
    const rules = toRules(parsed.rules, { origin: 'chatt', text: t, activeRules });
    const d = decorateProposals(rules, { profile, activeRules, names });
    const known = o => names.turnouts.has(o) || names.blocks.has(o) || names.signals.has(o);
    return { text: t, message: String(parsed.message || '').slice(0, 2000), questions: (Array.isArray(parsed.questions) ? parsed.questions : []).map(q => String(q).slice(0, 500)).slice(0, 10),
      objects: uniq(parsed.objects).filter(known), rules: d.rules, replaces: d.replaces, model, usage, at: Date.now() };
  }
}
