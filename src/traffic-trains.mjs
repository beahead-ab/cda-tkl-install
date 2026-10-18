// Trafikspelets tåg när LocoNet inte är ansluten (0.79.0). Trafiken kommer från TrainMeet-servern; TKL har ingen egen
// simulerad trafik. Utan LocoNet svarar TKL själv och kör då trafikspelets tåg på sin egen bana, som om de rullade:
//  - ett tåg som grannstationen sänt på linjen hit (sträckan belagd mot stationen, med tågnummer) ställs utanför
//    infartssignalen på linjens infartsspår;
//  - ett tåg som anmälts uppställt (eller förare på plats) på ett spår här ställs på det spåret.
// Sedan kör tåget när tågvägen är lagd och signalerna visar kör, stannar på målspåret och kör vidare på nästa tågväg,
// precis som med LocoNet ansluten. Med LocoNet ansluten gör TKL inget av detta: tågen syns på banan.
// Sedan 0.82.0 gäller det också åt andra hållet: ett stående tåg på banan som trafikspelet inte har här (varken på
// linjen eller ankommet, uppställt eller förare på plats och inte avgånget) tas bort, så att banan och tidtabellen visar
// samma tåg. Det hände efter en ny parkoppling eller en återställd träff: tågen från förut stod kvar och spärrade
// spåren för de uppställda tågen.
const RETRY_MS = 5000;
// Så länge ett tåg ska ha saknats i trafikspelet innan det tas bort: TrainMeet läses med några sekunders mellanrum, och
// en ankomst eller avgång hinner synas där först.
export const ABSENT_MS = 10000;
const STANDING = new Set(['positioned', 'ready', 'waiting']);

export class TrafficTrains {
  constructor({ available = false, send, log = () => {}, now = Date.now }) {
    Object.assign(this, { available, send, log, now });
    this.placed = new Map(); this.retry = new Map(); this.absent = new Map(); this.kept = new Set(); this.busy = false; this.error = ''; this.revision = 0;
  }
  // Tågnumren som trafikspelet har här just nu: på en linje till eller från stationen, eller ankommet, på väg in,
  // uppställt eller med förare på plats och inte avgånget.
  present(context) {
    const out = new Set(), numbers = new Map((context?.trains || []).map(t => [t.id, t.train_number]));
    for (const line of context?.lines || []) if (line.state === 'occupied' && line.trainNumber) out.add(line.trainNumber);
    for (const m of context?.movements || []) {
      const number = numbers.get(m.id);
      if (number && m.departure !== 'departed' && (m.arrival === 'arrived' || m.arrival === 'approaching' || STANDING.has(m.departure) || m.crewReady)) out.add(number);
    }
    return out;
  }
  // Det tåg på banan som har saknats i trafikspelet längst, när det har saknats minst ABSENT_MS. Bara när TKL har ett
  // färskt trafikläge: utan kontakt med TrainMeet rörs inget.
  stale({ context, fresh, tracked, now }) {
    if (!context || !fresh) { this.absent.clear(); return null; }
    const present = this.present(context), numbers = new Set(tracked.map(t => t.number).filter(Boolean));
    for (const number of [...this.absent.keys()]) if (!numbers.has(number) || present.has(number)) this.absent.delete(number);
    for (const number of [...this.kept]) if (!numbers.has(number)) this.kept.delete(number);
    for (const number of numbers) if (!present.has(number) && !this.kept.has(number) && !this.absent.has(number)) this.absent.set(number, now);
    return [...this.absent].filter(([, since]) => now - since >= ABSENT_MS).sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
  }
  // Vad trafikspelet säger ska finnas på banan just nu. context: TrainMeet-kontexten; edges: {Au:{stationId,incoming,block}};
  // tracks: {'1a':{button,block}} för stationens spår.
  wanted({ context, edges, tracks }) {
    const out = [];
    for (const line of context?.lines || []) {
      if (line.state !== 'occupied' || line.direction !== 'in' || !line.trainNumber) continue;
      const edge = Object.keys(edges).find(e => edges[e]?.incoming && edges[e]?.stationId && edges[e].stationId === line.neighborId);
      if (!edge || !edges[edge].block) continue;
      out.push({ key: `line:${line.id}:${line.trainNumber}`, number: line.trainNumber, at: edges[edge].button || 'htv' + edge, block: edges[edge].block, where: `på linjen från ${line.neighborName || edges[edge].name || edge}, utanför infartssignalen` });
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
  async tick({ context, edges, tracks, blocks, tracked = [], fresh = true, expect = () => {}, forget = () => {} }) {
    if (!this.available || this.busy) return;
    const now = this.now(), wanted = this.wanted({ context, edges, tracks });
    for (const key of [...this.placed.keys()]) if (!wanted.some(w => w.key === key)) { this.placed.delete(key); this.retry.delete(key); }
    const gone = this.stale({ context, fresh, tracked, now });
    if (gone) return this.remove(gone, now, forget);
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
  // Spårningen glömmer tåget också: annars står det kvar som senast sett på spåret och tar över numret när nästa tåg
  // ställs där.
  async remove(number, now, forget) {
    this.busy = true;
    try {
      await this.send({ kind: 'remove', number });
      this.absent.delete(number); this.error = ''; forget(number);
      this.log('traffic-trains', `Tåg ${number} är borttaget från banan: trafikspelet har det inte här (LocoNet ej ansluten).`);
    } catch (error) {
      // Ett tåg som kör lämnar banan själv eller stannar; ett tåg som inte är trafikspelets (en provkörning) får stå. Finns
      // det inte på banan är det bara spårningen som minns det.
      if (/kör\.$/.test(error.message)) this.absent.set(number, now - ABSENT_MS + RETRY_MS);
      else if (/finns inte på banan/.test(error.message)) { this.absent.delete(number); forget(number); }
      else { this.absent.delete(number); this.kept.add(number); }
    } finally { this.busy = false; this.revision++; }
  }
  clear() { this.absent.clear(); this.kept.clear(); if (this.placed.size || this.retry.size) { this.placed.clear(); this.retry.clear(); this.revision++; } }
  view() { return { available: this.available, placed: [...this.placed.keys()], error: this.error }; }
}
