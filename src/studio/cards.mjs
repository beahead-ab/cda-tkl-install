// Kortinventering över SV2: Discover samlar alla kort under ett fönster, Identify och läsning av SV1–4 riktar sig till ett.
// Vilket kort som driver vilken modul M00–M11 är ett beslut som operatören tar här tills Benny bekräftat identiteterna.
// MGP-sammanställningen per modul är exporten som senare jämförs mot det korten rapporterar. Inget skrivs till korten.
import { decodeSv, discover, identify, readSv4, SV_CMD, eepromBytes } from '../sv2.mjs';
import { moduleOf } from './sources.mjs';
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const identityKey = i => `${i.manufacturer}/${i.developer}/${i.product}/${i.serial}`;
// Kortets adress i svaret: DST när kortet skriver sin adress där, annars de sju bitarna i SRC. Bänkprovet avgör.
const addressOf = sv => sv.dst > 1 ? sv.dst : sv.src;

export class CardInventory {
  constructor({ storage, send, now = Date.now, windowMs = 1500, replyMs = 800, setTimer = setTimeout, clearTimer = clearTimeout }) {
    this.storage = storage; this.send = send; this.now = now; this.windowMs = windowMs; this.replyMs = replyMs; this.setTimer = setTimer; this.clearTimer = clearTimer;
    const d = storage.load('studio-cards.json', null);
    this.data = d && d.schema === 1 && Array.isArray(d.cards) ? d : { schema: 1, at: null, cards: [], modules: {} };
    this.pending = null;
  }
  view() {
    const cards = this.data.cards.map(c => ({ ...c, module: this.data.modules[c.address] || null, eeprom: c.sv?.[1] != null ? eepromBytes(c.sv[1]) : null }));
    const byAddress = {}, bySerial = {};
    for (const c of cards) { (byAddress[c.address] ??= []).push(identityKey(c)); (bySerial[c.serial] ??= []).push(c.address); }
    return { at: this.data.at, cards, pending: this.pending ? this.pending.name : null,
      duplicateAddresses: Object.entries(byAddress).filter(([, ids]) => ids.length > 1).map(([a]) => Number(a)),
      duplicateSerials: Object.entries(bySerial).filter(([, as]) => as.length > 1).map(([s]) => Number(s)) };
  }
  // Svar matchas på kommando (bit 6 satt) och, för riktade frågor, på kortadressen.
  observe(bytes) {
    const p = this.pending; if (!p) return;
    const sv = decodeSv(bytes); if (!sv || !sv.reply || sv.cmd !== (p.cmd | 0x40)) return;
    if (p.dst != null && addressOf(sv) !== p.dst) return;
    p.replies.push({ sv, at: this.now() });
    if (p.dst != null) p.finish();
  }
  abort() { this.pending?.finish(); }
  run(name, cmd, bytes, { dst = null, timeoutMs } = {}) {
    if (this.pending) fail('En SV2-fråga pågår redan.', 409);
    return new Promise((resolve, reject) => {
      const p = this.pending = { name, cmd, dst, replies: [], finish: () => { if (this.pending !== p) return; this.clearTimer(timer); this.pending = null; resolve(p.replies); } };
      const timer = this.setTimer(p.finish, timeoutMs);
      if (!this.send(bytes)) { this.clearTimer(timer); this.pending = null; reject(Object.assign(Error('Ingen anslutning till LocoNet. Discover och läsning kräver att TKL är inkopplad.'), { status: 503 })); }
    });
  }
  remember(replies) {
    for (const { sv, at } of replies) {
      if (!sv.identity) continue;
      const address = addressOf(sv), key = identityKey(sv.identity), existing = this.data.cards.find(c => identityKey(c) === key);
      if (existing) Object.assign(existing, { address, seenAt: at }); else this.data.cards.push({ address, ...sv.identity, seenAt: at, sv: null });
    }
    this.data.cards.sort((a, b) => a.address - b.address || a.serial - b.serial);
  }
  commit() { this.storage.save('studio-cards.json', this.data); return this.view(); }
  async discover() {
    const replies = await this.run('Discover', SV_CMD.discover, discover(), { timeoutMs: this.windowMs });
    this.data.at = this.now(); this.data.cards = this.data.cards.filter(c => replies.some(r => r.sv.identity && identityKey(r.sv.identity) === identityKey(c)));
    this.remember(replies); return this.commit();
  }
  async identify({ address }) {
    const a = this.address(address), replies = await this.run('Identify ' + a, SV_CMD.identify, identify(a), { dst: a, timeoutMs: this.replyMs });
    if (!replies.length) fail(`Inget kort svarade på Identify ${a}.`, 504);
    this.remember(replies); return this.commit();
  }
  async read({ address }) {
    const a = this.address(address), card = this.data.cards.find(c => c.address === a);
    if (!card) fail(`Kort ${a} finns inte i inventeringen. Kör Discover först.`);
    const replies = await this.run('Läs SV1–4 på ' + a, SV_CMD.read4, readSv4(a, 1), { dst: a, timeoutMs: this.replyMs });
    if (!replies.length) fail(`Kort ${a} svarade inte på läsning av SV1–4.`, 504);
    const d = replies[0].sv.data; card.sv = { 1: d[0], 2: d[1], 3: d[2], 4: d[3] }; card.readAt = this.now();
    return this.commit();
  }
  assign({ address, module }) {
    const a = this.address(address); if (!this.data.cards.some(c => c.address === a)) fail(`Kort ${a} finns inte i inventeringen.`);
    if (module !== null && !/^M\d\d$/.test(String(module))) fail('Ange modul som M00–M11, eller null.');
    const taken = Object.entries(this.data.modules).find(([addr, m]) => m === module && Number(addr) !== a);
    if (module && taken) fail(`${module} är redan kopplad till kort ${taken[0]}.`);
    if (module) this.data.modules[a] = module; else delete this.data.modules[a];
    return this.commit();
  }
  address(v) { if (!Number.isInteger(v) || v < 0 || v > 65535) fail('Ogiltig kortadress.'); return v; }
}

// Sammanställningen per modul: dekodertyp och kort, utgångar med objekt och adress, ingångar med spårledningar.
export function mgpSummary({ profile, xml }, registry, cards, { sections = [], measured = {} } = {}) {
  const signalOf = comment => (/(?:signal|siganl)\s+([^,]+)/i.exec(comment || '') || [])[1]?.trim() || null;
  const blocksByInput = {}; for (const s of sections) for (const i of s.inputs || []) (blocksByInput[i] ??= []).push(s.name);
  const number = (system, prefix) => { const n = Number(String(system).replace(prefix, '')); return Number.isInteger(n) ? n : null; };
  return registry.modules.map(m => {
    const card = cards.find(c => c.module === m.id) || null;
    const outputs = xml.turnouts.filter(t => moduleOf(t.comment)?.name === m.id).map(t => {
      const turnout = /^Vx\d+$/.test(t.user || '') && profile.turnouts[t.user] ? t.user : null, signal = !turnout && signalOf(t.comment) && profile.signals[signalOf(t.comment)] ? signalOf(t.comment) : null;
      const kind = turnout ? 'turnout' : signal ? 'signal' : null, object = turnout || signal;
      return { system: t.system, comment: t.comment, channel: moduleOf(t.comment)?.channel ?? null, kind, object, address: turnout ? profile.turnouts[turnout].address : signal ? profile.signals[signal].address : null,
        xmlAddress: number(t.system, /^L2?T/), measured: object ? measured[kind + ':' + object] || null : null };
    });
    const inputs = xml.sensors.filter(s => moduleOf(s.comment)?.name === m.id).map(s => ({ system: s.system, comment: s.comment, xmlAddress: number(s.system, /^LS/), blocks: blocksByInput[s.system] || [] }));
    return { id: m.id, card, decoder: card ? (card.product === 10 ? 'Signal10 (antaget)' : card.product === 5 ? 'Servo5 (antaget)' : 'produkt ' + card.product) : null, status: card ? 'kort kopplat, ej verifierat' : m.status,
      outputs, inputs, counts: { outputs: outputs.length, inputs: inputs.length, turnouts: outputs.filter(o => o.kind === 'turnout').length, signals: outputs.filter(o => o.kind === 'signal').length, measured: outputs.filter(o => o.measured).length } };
  });
}
