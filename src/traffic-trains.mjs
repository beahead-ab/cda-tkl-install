// Trafikspelets tåg när LocoNet inte är ansluten (0.79.0). Trafiken kommer från TrainMeet-servern; TKL har ingen egen
// simulerad trafik. Utan LocoNet svarar TKL själv och kör då trafikspelets tåg på sin egen bana, som om de rullade:
//  - ett tåg som grannstationen sänt på linjen hit (sträckan belagd mot stationen, med tågnummer) ställs utanför
//    infartssignalen på linjens infartsspår;
//  - ett tåg som anmälts uppställt (eller förare på plats) på ett spår här ställs på det spåret.
// Sedan kör tåget när tågvägen är lagd och signalerna visar kör, stannar på målspåret och kör vidare på nästa tågväg,
// precis som med LocoNet ansluten. Med LocoNet ansluten gör TKL inget av detta: tågen syns på banan.
const RETRY_MS = 5000;

export class TrafficTrains {
  constructor({ available = false, send, log = () => {}, now = Date.now }) {
    Object.assign(this, { available, send, log, now });
    this.placed = new Map(); this.retry = new Map(); this.busy = false; this.error = ''; this.revision = 0;
  }
  // Vad trafikspelet säger ska finnas på banan just nu. context: TrainMeet-kontexten; edges: {Au:{stationId,incoming,block}};
  // tracks: {'1a':{button,block}} för stationens spår.
  wanted({ context, edges, tracks }) {
    const out = [];
    for (const line of context?.lines || []) {
      if (line.state !== 'occupied' || line.direction !== 'in' || !line.trainNumber) continue;
      const edge = Object.keys(edges).find(e => edges[e]?.incoming && edges[e]?.stationId && edges[e].stationId === line.neighborId);
      if (!edge || !edges[edge].block) continue;
      out.push({ key: `line:${line.id}:${line.trainNumber}`, number: line.trainNumber, at: 'htv' + edge, block: edges[edge].block, where: `på linjen från ${line.neighborName || edges[edge].name || edge}, utanför infartssignalen` });
    }
    const labels = new Map((context?.tracks || []).map(t => [t.id, t.label]));
    for (const m of context?.movements || []) {
      if (!['positioned', 'ready'].includes(m.departure)) continue;
      const train = (context.trains || []).find(t => t.id === m.id);
      if (!train?.train_number) continue;
      const label = String(labels.get(m.track) || m.track || train.track || '').trim();
      const track = tracks[label.toLowerCase()];
      if (!track) continue;
      out.push({ key: `movement:${m.id}`, number: train.train_number, at: track.button, block: track.block, track: true, where: `uppställt på spår ${label}` });
    }
    return out;
  }
  // Ett tåg i taget per varv: det som redan syns (spårningen har numret) ställs inte ut igen, och ett belagt spår väntar.
  async tick({ context, edges, tracks, blocks, tracked = [], expect = () => {} }) {
    if (!this.available || this.busy) return;
    const now = this.now(), wanted = this.wanted({ context, edges, tracks });
    for (const key of [...this.placed.keys()]) if (!wanted.some(w => w.key === key)) { this.placed.delete(key); this.retry.delete(key); }
    const known = new Set(tracked.map(t => t.number).filter(Boolean));
    const next = wanted.find(w => !this.placed.has(w.key) && !known.has(w.number) && !(this.retry.get(w.key) > now) && blocks[w.block]?.occupied === false);
    if (!next) return;
    this.busy = true;
    try {
      if (next.track) expect(next.block, next.number);
      await this.send({ kind: 'spawn', number: next.number, at: next.at });
      this.placed.set(next.key, now); this.error = '';
      this.log('traffic-trains', `Tåg ${next.number} ${next.where} (trafikspelet, LocoNet ej ansluten).`);
    } catch (error) {
      // Finns tåget redan på banan (TKL startade om medan banan körde vidare) är det på plats.
      if (/finns redan/.test(error.message)) this.placed.set(next.key, now);
      else { this.retry.set(next.key, now + RETRY_MS); this.error = `Tåg ${next.number}: ${error.message}`; }
    } finally { this.busy = false; this.revision++; }
  }
  clear() { if (this.placed.size || this.retry.size) { this.placed.clear(); this.retry.clear(); this.revision++; } }
  view() { return { available: this.available, placed: [...this.placed.keys()], error: this.error }; }
}
