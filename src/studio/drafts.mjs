// Utkast av regler: skapa, prova i simulatorn, aktivera med samma villkor som driftbindningarna, återställ.
// Versionerna sparas i studio-rules.json. Kärnan får alltid en kompilerad profil; den läser aldrig utkastet.
import { createHash, randomUUID } from 'node:crypto';
import { validateRules, explainRule, TYPE_LABEL, RUNS_IN } from './rules.mjs';
import { applyRules } from './apply.mjs';
import { runTrial } from './trial.mjs';
const copy = structuredClone, hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const KEEP = ['id', 'type', 'objects', 'object', 'relation', 'bothWays', 'runsIn', 'status', 'source', 'trigger', 'button', 'requires', 'reason', 'label', 'sourceSensor', 'requiredPosition', 'relay', 'tkl', 'ranger', 'detail', 'positions',
  'inputs', 'logic', 'owner', 'signals', 'stopCodes', 'goCodes', 'aspects', 'conditions', 'blocks', 'lamps', 'preRingMs', 'feedback'];
const strip = r => Object.fromEntries(KEEP.filter(k => r[k] !== undefined).map(k => [k, copy(r[k])]));
const decorate = r => ({ ...r, typeLabel: TYPE_LABEL[r.type], runsInLabel: RUNS_IN[r.type], explain: explainRule(r) });

export class StudioDrafts {
  constructor({ base, field, rules, storage, now = Date.now, canActivate = () => ({ allowed: false, reason: 'Aktivering ej tillgänglig.' }), prepare = () => () => {}, proposal = () => ({ proposals: [], replaces: [] }), trial = runTrial, sampleUnchanged = 12 }) {
    this.base = base; this.field = field; this.storage = storage; this.now = now; this.canActivate = canActivate; this.prepare = prepare; this.proposal = proposal; this.trial = trial; this.sampleUnchanged = sampleUnchanged;
    this.sessionId = randomUUID();
    this.names = { turnouts: new Set(Object.keys(base.turnouts)), blocks: new Set(Object.keys(base.blocks)), signals: new Set(Object.keys(base.signals)), lines: new Set(Object.keys(base.operatingControls?.lines || {})) };
    this.data = storage.load('studio-rules.json', { schema: 1, revision: 0, activeVersion: 0, versions: [{ id: 0, at: null, reason: 'Dagens regler ur driftprofilen', rules }], draft: null });
    const d = this.data;
    if (d.schema !== 1 || !Array.isArray(d.versions) || !d.versions.length || d.versions.some((v, i) => v.id !== i || !Array.isArray(v.rules)) || !d.versions[d.activeVersion] || (d.draft && (!Array.isArray(d.draft.rules) || d.draft.baseVersion !== d.activeVersion))) throw Error('Ogiltig regelhistorik i studio-rules.json.');
    // Version 0 följer alltid den granskade grundprofilen. Senare versioner är operatörens egna.
    d.versions[0].rules = rules;
    const problems = validateRules(this.activeRules(), this.names).filter(p => !/steg 6/.test(p.problem));
    if (problems.length) throw Error('Aktiva regler validerar inte: ' + problems.map(p => p.rule + ': ' + p.problem).join(' '));
  }
  get active() { return this.data.versions[this.data.activeVersion]; }
  activeRules() { return this.active.rules; }
  // Reglerna tillämpade på en profil, i första hand den som driftbindningarna ger.
  apply(profile = this.base, rules = this.activeRules()) { return applyRules(profile, rules, this.field); }
  status(draft, applied, problems) {
    if (problems.length) return { allowed: false, reason: 'Utkastet validerar inte.' };
    if (!draft.trial) return { allowed: false, reason: 'Prova utkastet i simulatorn först.' };
    if (draft.trial.rulesHash !== hash(draft.rules)) return { allowed: false, reason: 'Utkastet har ändrats sedan provet. Prova igen.' };
    if (draft.trial.ok !== draft.trial.total) return { allowed: false, reason: `${draft.trial.total - draft.trial.ok} av ${draft.trial.total} tågvägar klarade inte simulatorprovet.` };
    if (!applied.changes.fragments.length && !applied.changes.routes.length && hash(draft.rules) === hash(this.activeRules())) return { allowed: false, reason: 'Utkastet skiljer sig inte från de aktiva reglerna.' };
    return this.canActivate(applied.profile);
  }
  view(baseProfile = this.base) {
    const draft = this.data.draft; let d = null;
    if (draft) {
      const problems = validateRules(draft.rules, this.names), applied = applyRules(baseProfile, draft.rules, this.field);
      const activeIds = new Set(this.activeRules().map(r => r.id)), draftIds = new Set(draft.rules.map(r => r.id));
      const routes = applied.changes.routes;
      d = { baseVersion: draft.baseVersion, note: draft.note, createdAt: draft.createdAt, rules: draft.rules.length,
        added: draft.rules.filter(r => !activeIds.has(r.id)).map(decorate), removed: this.activeRules().filter(r => !draftIds.has(r.id)).map(decorate),
        changes: { fragments: applied.changes.fragments, routes: { count: routes.length, main: routes.filter(r => r.kind === 'main').length, shunt: routes.filter(r => r.kind === 'shunt').length, examples: routes.slice(0, 8) } },
        problems, trial: draft.trial, activation: this.status(draft, applied, problems) };
    }
    return { sessionId: this.sessionId, revision: this.data.revision, activeVersion: this.data.activeVersion, versions: this.data.versions.map(v => ({ id: v.id, at: v.at, reason: v.reason, rules: v.rules.length })), draft: d };
  }
  check({ sessionId, revision } = {}) { if (sessionId !== this.sessionId || revision !== this.data.revision) fail('Reglerna har ändrats i ett annat fönster. Läs in senaste läget.', 409); }
  commit(next) { next.revision++; this.storage.save('studio-rules.json', next); this.data = next; return this.view(); }
  create(data) {
    this.check(data); if (this.data.draft) fail('Det finns redan ett utkast. Granska eller kasta det först.', 409);
    let rules;
    if (data.source === 'proposal') { const { proposals, replaces } = this.proposal(); if (!proposals.length) fail('Det finns inget förslag att göra utkast av.'); rules = [...this.activeRules().filter(r => !replaces.includes(r.id)), ...proposals.map(p => ({ ...strip(p), status: 'active' }))]; }
    else if (Array.isArray(data.add)) {
      // Från chatten eller genomgången: nya regler ovanpå de aktiva, minus dem de ersätter.
      if (!data.add.length) fail('Inga regler att lägga till.');
      if (data.add.some(r => !r || typeof r.id !== 'string' || typeof r.type !== 'string')) fail('Ogiltigt regelkort.');
      const replaces = (Array.isArray(data.replaces) ? data.replaces : []).map(String);
      rules = [...this.activeRules().filter(r => !replaces.includes(r.id)), ...data.add.map(r => ({ ...strip(r), status: 'active' }))];
    }
    else if (Array.isArray(data.rules)) rules = data.rules.map(strip);
    else fail('Ange källa för utkastet: proposal eller rules.');
    const note = String(data.note || '').trim().slice(0, 500); if (/[\u0000-\u001f]/.test(note)) fail('Ogiltig anteckning.');
    const next = copy(this.data); next.draft = { baseVersion: next.activeVersion, rules, note, createdAt: this.now(), trial: null };
    return this.commit(next);
  }
  test(data, baseProfile = this.base) {
    this.check(data); const draft = this.data.draft; if (!draft) fail('Inget utkast att prova.');
    const problems = validateRules(draft.rules, this.names); if (problems.length) fail('Utkastet validerar inte: ' + problems.map(p => p.rule + ': ' + p.problem).join(' '));
    const applied = applyRules(baseProfile, draft.rules, this.field), changed = applied.changes.routes.map(r => r.id);
    const rest = applied.profile.routes.map(r => r.id).filter(id => !changed.includes(id)), step = Math.max(1, Math.floor(rest.length / this.sampleUnchanged));
    const sample = rest.filter((_, i) => i % step === 0).slice(0, this.sampleUnchanged);
    const result = this.trial({ profile: applied.profile, field: applied.field, routeIds: [...changed, ...sample] });
    const next = copy(this.data);
    next.draft.trial = { at: this.now(), rulesHash: hash(draft.rules), total: result.total, ok: result.ok, changed: changed.length, sampled: sample.length,
      results: result.results.map(r => ({ id: r.id, label: r.label, kind: r.kind, result: r.result, reason: r.reason, ordered: r.ordered, locked: r.locked, ms: r.ms })) };
    return this.commit(next);
  }
  activate(data, baseProfile = this.base) {
    this.check(data); const draft = this.data.draft; if (!draft) fail('Inget utkast att aktivera.');
    if (typeof data.reason !== 'string' || data.reason.trim().length < 3 || data.reason.length > 500 || /[\u0000-\u001f]/.test(data.reason)) fail('Beskriv underlaget för ändringen (3–500 tecken).');
    const problems = validateRules(draft.rules, this.names), applied = applyRules(baseProfile, draft.rules, this.field), status = this.status(draft, applied, problems);
    if (!status.allowed) fail(status.reason);
    const next = copy(this.data), id = next.versions.length, apply = this.prepare(applied.profile, applied.field);
    next.versions.push({ id, at: this.now(), reason: data.reason.trim(), rules: copy(draft.rules) }); next.activeVersion = id; next.draft = null;
    const view = this.commit(next); apply(); return view;
  }
  discard(data) { this.check(data); const next = copy(this.data); next.draft = null; return this.commit(next); }
  restore(data) {
    this.check(data); if (!Number.isSafeInteger(data.version) || !this.data.versions[data.version]) fail('Versionen finns inte.');
    if (this.data.draft) fail('Granska eller kasta befintligt utkast först.', 409);
    const next = copy(this.data); next.draft = { baseVersion: next.activeVersion, rules: copy(next.versions[data.version].rules), note: 'Återställning av version ' + data.version, createdAt: this.now(), trial: null };
    return this.commit(next);
  }
}
