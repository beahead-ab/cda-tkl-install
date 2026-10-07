// Kom igång: det en ny installation måste ha innan den fungerar som väntat. Stegen räknas ur det som finns
// (ägare, AI-nyckel, kontakt med banan, TrainMeet); bara "klar" och vad som medvetet hoppats över sparas i
// onboarding.json. Ägaren och kontakten med banan krävs; AI-tjänsten och TrainMeet får hoppas över, men
// bara uttryckligen, så att en saknad nyckel aldrig är en överraskning i Studio.
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
export const STEP_IDS = ['owner', 'ai', 'connection', 'trainmeet'];
export class Onboarding {
  constructor({ storage }) {
    this.storage = storage;
    const d = storage.load('onboarding.json', null);
    this.data = d && d.schema === 1 ? { schema: 1, done: !!d.done, skipped: Array.isArray(d.skipped) ? d.skipped.filter(id => STEP_IDS.includes(id)) : [], finishedAt: d.finishedAt ?? null, finishedBy: d.finishedBy ?? null } : { schema: 1, done: false, skipped: [], finishedAt: null, finishedBy: null };
  }
  steps({ auth, ai, connection, trainMeet }) {
    const mode = auth?.mode || 'local', hasOwner = mode === 'cloudflare' ? true : !!auth?.users?.hasOwner();
    const tm = trainMeet || {}, tmDone = tm.status === 'connected' || !!tm.paired;
    return [
      { id: 'owner', label: 'Ägare', required: true, done: hasOwner, how: mode === 'external' ? 'script' : mode === 'cloudflare' ? 'none' : 'page', link: '/login?next=%2F%23advanced%2Fstart' },
      { id: 'ai', label: 'AI-tjänst', required: false, done: !!ai?.configured, tested: !!ai?.lastTest?.ok, model: ai?.model ?? null, link: '#advanced/ai' },
      { id: 'connection', label: 'Banan (LocoNet)', required: true, done: connection?.state === 'connected', mode: connection?.mode ?? 'unspecified', link: '#advanced/protocol' },
      { id: 'trainmeet', label: 'TrainMeet', required: false, done: tmDone, status: tm.status ?? 'unconfigured', origin: tm.origin ?? '', link: '#trainmeet' }];
  }
  view(context) {
    const steps = this.steps(context).map(s => ({ ...s, skipped: !s.done && this.data.skipped.includes(s.id) }));
    const remaining = steps.filter(s => !s.done && !s.skipped).length;
    return { done: this.data.done, finishedAt: this.data.finishedAt, finishedBy: this.data.finishedBy, skipped: this.data.skipped, mode: context.auth?.mode || 'local', steps, remaining,
      canFinish: steps.every(s => s.done || (!s.required && s.skipped)) };
  }
  // Klar: de krävda stegen måste vara gjorda; de frivilliga gjorda eller uttryckligen överhoppade.
  finish({ skipped = [] } = {}, { by = null, now = Date.now(), context }) {
    if (!Array.isArray(skipped) || skipped.some(id => !STEP_IDS.includes(id))) fail('Okänt steg att hoppa över.');
    const steps = this.steps(context);
    const missing = steps.filter(s => !s.done && (s.required || !skipped.includes(s.id)));
    if (missing.length) fail(`Kom igång är inte klar: ${missing.map(s => s.label).join(', ')}.` + (missing.some(s => !s.required) ? ' Hoppa över det som inte ska användas.' : ''), 409);
    this.data = { ...this.data, done: true, skipped: steps.filter(s => !s.done && skipped.includes(s.id)).map(s => s.id), finishedAt: now, finishedBy: by };
    this.storage.save('onboarding.json', this.data); return this.view(context);
  }
  reopen(context) { this.data = { ...this.data, done: false }; this.storage.save('onboarding.json', this.data); return this.view(context); }
}
