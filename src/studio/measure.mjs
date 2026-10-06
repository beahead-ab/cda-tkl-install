// Mätning objekt för objekt: en provorder, en verklig rapport efter ordern, och operatörens bekräftelse med namn.
// Ekot och transportkvittensen räknas inte. Mätningen sparas med adress, läge och telegram; byter adressen är den inte giltig längre.
// I fysisk drift kan ingen profil aktiveras förrän alla dess bindningar är uppmätta på sina adresser.
import { decode, switchOrder, switchReport, signalReport, hex } from '../protocol.mjs';
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
export const KINDS = ['turnout', 'signal', 'block'];
const key = (kind, name) => kind + ':' + name;

export class Measurements {
  constructor({ storage, send, now = Date.now, guard = () => null, mode = () => 'unspecified' }) {
    this.storage = storage; this.send = send; this.now = now; this.guard = guard; this.mode = mode;
    const d = storage.load('studio-measurements.json', null);
    this.data = d && d.schema === 1 && d.items && typeof d.items === 'object' ? d : { schema: 1, items: {} };
    this.pending = null; this.latest = {};
  }
  binding(profile, kind, name) {
    if (!KINDS.includes(kind)) fail('Okänt objektslag.');
    const b = profile[kind + 's']?.[name]; if (!b) fail(`${name} finns inte i profilen.`, 404);
    if (b.virtual) fail(`${name} är en virtuell signal utan utgång och kan inte mätas.`);
    return b;
  }
  // Giltig mätning = samma adress som profilen har nu. Fältmätning är den som räknas för drift.
  item(profile, kind, name) {
    const m = this.data.items[key(kind, name)]; if (!m) return null;
    const b = profile[kind + 's']?.[name]; if (!b) return null;
    const current = kind === 'signal' ? m.address === b.address && m.reportAddress === b.reportAddress : m.address === b.address;
    return { ...m, current, field: current && m.mode === 'hardware' };
  }
  measured(profile) {
    const out = {};
    for (const kind of KINDS) for (const name of Object.keys(profile[kind + 's'] || {})) { const m = this.item(profile, kind, name); if (m?.current) out[key(kind, name)] = m; }
    return out;
  }
  // Virtuella signaler har ingen utgång och kan varken mätas eller saknas.
  names(profile, kind) { return Object.entries(profile[kind + 's'] || {}).filter(([, b]) => !b.virtual).map(([n]) => n); }
  missing(profile) {
    const out = [];
    for (const kind of KINDS) for (const name of this.names(profile, kind)) if (!this.item(profile, kind, name)?.field) out.push(name);
    return out;
  }
  view(profile) {
    const counts = {};
    for (const kind of KINDS) { const names = this.names(profile, kind); const items = names.map(n => this.item(profile, kind, n)); counts[kind] = { total: names.length, bench: items.filter(m => m?.current && m.mode !== 'hardware').length, field: items.filter(m => m?.field).length }; }
    const items = Object.fromEntries(Object.entries(this.data.items).map(([k, m]) => { const [kind, name] = k.split(/:(.*)/); return [k, this.item(profile, kind, name) || { ...m, current: false, field: false }]; }));
    return { mode: this.mode(), guard: this.guard(), pending: this.pending, counts, items };
  }
  // Provordern. Växlar: rakt eller avvikande. Signaler: bara stopp, eftersom kärnan själv återtar ett omotiverat kör.
  // Spårledningar: ingen order; rapporten ska ändra läge, så att en periodisk rapport inte räknas.
  probe({ kind, name, position = null } = {}, profile) {
    const b = this.binding(profile, kind, name);
    const reason = this.guard(); if (reason) fail(reason, 409);
    if (this.pending && !this.pending.report) fail(`En mätning av ${this.pending.name} väntar på rapport. Avbryt den först.`, 409);
    let order = null, expect, requested = null;
    if (kind === 'turnout') { if (!['C', 'T'].includes(position)) fail('Ange läge C eller T.'); requested = position; const physical = b.inverted ? (position === 'C' ? 'T' : 'C') : position; order = switchOrder(b.address, physical); expect = { kind: 'turnout', address: b.address, position: physical }; }
    else if (kind === 'signal') { requested = 'STOP'; order = switchOrder(b.address, 'T'); expect = { kind: 'signal', address: b.reportAddress, codes: b.stopCodes }; }
    else { requested = 'change'; expect = { kind: 'sensor', address: b.address, baseline: this.latest['sensor:' + b.address] ?? null }; }
    // Väntan registreras före ordern: simulatorn kan svara i samma andetag som ordern går ut.
    const expectHex = kind === 'turnout' ? [hex(switchReport(b.address, expect.position))] : kind === 'signal' ? b.stopCodes.map(c => hex(signalReport(b.reportAddress, c))) : [];
    this.pending = { kind, name, address: kind === 'signal' ? b.reportAddress : b.address, orderAddress: kind === 'block' ? null : b.address, requested, order: order ? hex(order) : null, expectHex, sentAt: this.now(), expect, report: null, mismatch: null, mode: this.mode() };
    if (order && !this.send(order)) { this.pending = null; fail('Ingen anslutning till LocoNet.', 503); }
    return this.view(profile);
  }
  observe(bytes) {
    let d; try { d = decode(bytes); } catch { return; }
    if (d.kind === 'sensor') { const before = this.latest['sensor:' + d.address]; this.latest['sensor:' + d.address] = d.active; if (this.pending && !this.pending.report && this.pending.expect.kind === 'sensor' && this.pending.expect.address === d.address && this.pending.expect.baseline === null && before === undefined) this.pending.expect.baseline = d.active; }
    const p = this.pending; if (!p || p.report) return; const e = p.expect;
    if (d.kind !== e.kind || d.address !== e.address) return;
    const ok = e.kind === 'turnout' ? d.position === e.position : e.kind === 'signal' ? e.codes.includes(d.code) : e.baseline === null ? false : d.active !== e.baseline;
    if (ok) p.report = { hex: hex(bytes), at: this.now(), decoded: d }; else p.mismatch = { hex: hex(bytes), at: this.now(), decoded: d };
  }
  confirm({ kind, name, by } = {}, profile) {
    const p = this.pending; if (!p || p.kind !== kind || p.name !== name) fail('Ingen pågående mätning av det objektet.');
    if (!p.report) fail('Ingen verklig rapport har kommit efter ordern. Vänta, eller avbryt och prova igen.', 409);
    const who = String(by ?? '').trim(); if (who.length < 2 || who.length > 80 || /[\u0000-\u001f]/.test(who)) fail('Ange vem som mäter (2–80 tecken).');
    const b = this.binding(profile, kind, name);
    this.data.items[key(kind, name)] = { kind, name, address: kind === 'signal' ? b.address : b.address, ...(kind === 'signal' ? { reportAddress: b.reportAddress } : {}), at: this.now(), by: who, mode: p.mode, requested: p.requested,
      evidence: { order: p.order, report: p.report.hex, reportAt: p.report.at, sentAt: p.sentAt } };
    this.pending = null; this.storage.save('studio-measurements.json', this.data);
    return this.view(profile);
  }
  cancel(_data, profile) { this.pending = null; return this.view(profile); }
  remove({ kind, name } = {}, profile) { if (!this.data.items[key(kind, name)]) fail('Ingen mätning att ta bort.', 404); delete this.data.items[key(kind, name)]; this.storage.save('studio-measurements.json', this.data); return this.view(profile); }
  abort() { if (this.pending && !this.pending.report) this.pending = null; }
}
