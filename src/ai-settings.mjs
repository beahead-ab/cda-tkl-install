// AI-tjänsten i appens inställningar: modell och nyckel sparade av TKL-servern i ai.json (0600).
// Nyckeln lämnar aldrig servern åt webbläsaren; sidan ser bara de fyra sista tecknen. Miljövariabeln
// ANTHROPIC_API_KEY är reservvärde för installationer som sätter den där; inställningen i appen går före.
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
// Modeller som fungerar med lösningen: strukturerade svar enligt schema och adaptivt tänkande.
export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Standard. Bäst balans mellan omdöme, tid och kostnad för regler och genomgång.' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Snabbare och billigare. Räcker för chatten; genomgången blir ytligare.' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', note: 'Mest kapabel och dyrast. Kräver 30 dagars datalagring hos Anthropic.' }];
export const DEFAULT_MODEL = 'claude-opus-5-5';
const KEY = /^[A-Za-z0-9_-]{20,400}$/;

export class AiSettings {
  constructor({ storage, env = process.env }) {
    this.storage = storage; this.env = env;
    const d = storage.load('ai.json', null);
    this.data = d && d.schema === 1 && typeof d === 'object' ? { schema: 1, model: AI_MODELS.some(m => m.id === d.model) ? d.model : null, key: typeof d.key === 'string' ? d.key : '', updatedAt: d.updatedAt ?? null, lastTest: d.lastTest ?? null } : { schema: 1, model: null, key: '', updatedAt: null, lastTest: null };
  }
  get key() { return this.data.key || this.env.ANTHROPIC_API_KEY || ''; }
  get model() { return this.data.model || (AI_MODELS.some(m => m.id === this.env.CHARLOTTENDAL_STUDIO_MODEL) ? this.env.CHARLOTTENDAL_STUDIO_MODEL : DEFAULT_MODEL); }
  get source() { return this.data.key ? 'app' : this.env.ANTHROPIC_API_KEY ? 'env' : 'none'; }
  view() {
    const key = this.key;
    return { configured: !!key, provider: 'Anthropic', model: this.model, models: AI_MODELS, source: this.source, keyHint: key ? '…' + key.slice(-4) : null, updatedAt: this.data.updatedAt, lastTest: this.data.lastTest };
  }
  static checkModel(model) { if (!AI_MODELS.some(m => m.id === model)) fail('Välj en av modellerna i listan.'); return model; }
  static checkKey(key) { const k = String(key ?? '').trim(); if (!KEY.test(k)) fail('Nyckeln ser inte ut som en API-nyckel (20–400 tecken utan mellanslag).'); return k; }
  // Modellen kan bytas utan ny nyckel; en ny nyckel ersätter den gamla. Tom nyckel med reservvärde i miljön behåller miljöns.
  save({ model, key } = {}, now = Date.now()) {
    const next = { ...this.data, model: AiSettings.checkModel(model ?? this.model), updatedAt: now };
    if (key !== undefined && key !== null && String(key).trim() !== '') next.key = AiSettings.checkKey(key);
    if (!next.key && !this.env.ANTHROPIC_API_KEY) fail('Ange en nyckel. Utan nyckel fungerar inte chatten och AI-genomgången.');
    this.data = next; this.storage.save('ai.json', this.data); return this.view();
  }
  recordTest(result, now = Date.now()) { this.data = { ...this.data, lastTest: { at: now, ...result } }; this.storage.save('ai.json', this.data); return this.view(); }
  clear() { this.data = { ...this.data, key: '', updatedAt: Date.now() }; this.storage.save('ai.json', this.data); return this.view(); }
}
