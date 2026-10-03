export class Topology {
  constructor(panel) {
    this.panel = panel;
    this.segments = Object.fromEntries(panel.segs.filter(s => s.b !== 'frame' && Math.min(s.y1, s.y2) < 850).map(s => [s.id, s]));
    this.turnouts = Object.fromEntries(Object.values(panel.turnouts).map(t => [t.name, t]));
    this.points = {};
    for (const s of Object.values(this.segments)) for (const end of [1, 2]) {
      if (s['t' + end] === 'POS_POINT') (this.points[s['c' + end]] ??= []).push({ id: s.id, end });
    }
    this.buttons = {};
    for (const b of panel.sicons.filter(b => b.sensor.startsWith('htv') && !b.hidden)) {
      let candidates = Object.values(this.segments).filter(s => s.b && !s.hide && !/^perrong/i.test(s.b));
      const match = /^htvSp(.+)$/.exec(b.sensor);
      const named = match && candidates.filter(s => s.b === 'S' + match[1]);
      if (named?.length) candidates = named;
      candidates.sort((a, c) => distance(a, b) - distance(c, b));
      const printed = panel.labels.filter(l => !l.hidden && /^[0-9]+[a-z]?$/.test(l.text) && Math.abs(l.y - b.y) < 12 && l.x < b.x && b.x - l.x < 35).sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
      this.buttons[b.sensor] = { ...b, segment: candidates[0]?.id, label: printed ? 'Spår ' + printed.text : buttonLabel(b.sensor) };
    }
  }
  expand(settings) {
    const result = { ...settings }, queue = Object.keys(result);
    // Coupling is undirected and transitive. Conflicting assignments invalidate a candidate.
    while (queue.length) {
      const name = queue.shift();
      const peers = Object.values(this.turnouts).filter(t => t.name === name || t.name2 === name)
        .flatMap(t => [t.name, t.name2]).filter(Boolean);
      for (const peer of peers) {
        if (result[peer] && result[peer] !== result[name]) return null;
        if (!result[peer]) { result[peer] = result[name]; queue.push(peer); }
      }
    }
    return result;
  }
  search(from, to, options = {}) { return this.searchRoutes(from,to,{...options,limit:1})[0] || null; }
  searchRoutes(from, to, { blocked = new Set(), locks = {}, crossings = new Set(), limit = 256 } = {}) {
    const first = this.buttons[from]?.segment, last = this.buttons[to]?.segment;
    if (!first || !last || first === last || blocked.has(this.segments[first].b) || blocked.has(this.segments[last].b)) return [];
    const length = s => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const queue = (this.buttons[from].end ? [this.buttons[from].end] : [1, 2]).map(end => ({ id: first, end, settings: {}, path: [{ kind: 'segment', id: first, end }], blocks: [this.segments[first].b], crossings: [], used: [first], cost: length(this.segments[first]) }));
    const seen = new Map(), results=[];
    let attempts = 0;
    while (queue.length && attempts++ < 30000) {
      queue.sort((a, b) => a.cost - b.cost);
      const n = queue.shift();
      if (n.id === last && (!this.buttons[to].end || this.buttons[to].end === n.end)) {
        results.push({ ...n, blocks: [...new Set(n.blocks.filter(Boolean))], flow: this.flow(n.path) });
        if(limit===1)return results;
        if(results.length>limit)throw Error('För många alternativa tågvägar; grafen behöver granskas.');
        continue;
      }
      const key = n.id + ':' + n.end + ':' + JSON.stringify(Object.entries(n.settings).sort()) + (limit===1?'':':'+n.used.slice().sort().join(','));
      if (seen.has(key) && seen.get(key) <= n.cost) continue;
      seen.set(key, n.cost);
      const s = this.segments[n.id], out = n.end === 1 ? 2 : 1, node = s['c' + out], type = s['t' + out];
      const push = (id, exitType, settings, via, crossing) => {
        const next = this.segments[id];
        if (!next || n.used.includes(id) || blocked.has(next.b)) return;
        const expanded = this.expand(settings);
        if (!expanded || Object.entries(expanded).some(([name, pos]) => locks[name] && locks[name] !== pos)) return;
        let end;
        if (next.c1 === node && next.t1 === exitType) end = 1;
        else if (next.c2 === node && next.t2 === exitType) end = 2;
        else return;
        const path = [...n.path, ...(via ? [via] : []), { kind: 'segment', id, end }];
        const vb = via?.kind === 'turnout' ? this.turnouts[via.name].block : null;
        if (vb && blocked.has(vb)) return;
        // Claude Design's porting review: the internal turnout legs are part of
        // the physical path length. A fixed penalty can select a longer route.
        let internalLength = 0;
        if (via?.kind === 'turnout') {
          const t = this.turnouts[via.name];
          const points = { A: [t.ax,t.ay], B: [t.bx,t.by], C: [t.ccx,t.ccy] };
          for (const leg of [via.from,via.to]) internalLength += Math.hypot(points[leg][0]-t.cx,points[leg][1]-t.cy);
        }
        queue.push({ id, end, settings: expanded, path, blocks: [...n.blocks, ...(vb ? [vb] : []), next.b], crossings: crossing ? [...n.crossings, crossing] : n.crossings, used: [...n.used, id], cost: n.cost + length(next) + internalLength });
      };
      if (type === 'POS_POINT') {
        for (const next of this.points[node] || []) if (next.id !== n.id) push(next.id, 'POS_POINT', n.settings);
      }
      const tm = /^TURNOUT_([ABC])$/.exec(type);
      if (tm) {
        const t = this.panel.turnouts[node]; if (!t) continue;
        const leg = tm[1], closed = t.continuing === 2 ? 'B' : 'C';
        for (const pos of ['C', 'T']) {
          const branch = pos === 'C' ? closed : closed === 'B' ? 'C' : 'B';
          if (leg !== 'A' && leg !== branch) continue;
          if (n.settings[t.name] && n.settings[t.name] !== pos) continue;
          const exit = leg === 'A' ? branch : 'A';
          push(t['c' + exit.toLowerCase()], 'TURNOUT_' + exit, { ...n.settings, [t.name]: pos }, { kind: 'turnout', name: t.name, from: leg, to: exit });
        }
      }
      const xm = /^LEVEL_XING_([ABCD])$/.exec(type);
      if (xm && !crossings.has(node)) {
        const x = this.panel.xings[node], exit = { A: 'C', C: 'A', B: 'D', D: 'B' }[xm[1]];
        if (x) push(x['c' + exit.toLowerCase()], 'LEVEL_XING_' + exit, n.settings, null, node);
      }
    }
    if(queue.length)throw Error('Sökgränsen för alternativa tågvägar nåddes; grafen behöver granskas.');
    return results;
  }
  flow(path) {
    const out = []; let distance = 0;
    const append = (id, a, b, block) => { const length = Math.hypot(b[0] - a[0], b[1] - a[1]); out.push({ id, x1: a[0], y1: a[1], x2: b[0], y2: b[1], block, length, distance }); distance += length; };
    for (const p of path) {
      if (p.kind === 'segment') {
        const s = this.segments[p.id], a = [s.x1, s.y1], b = [s.x2, s.y2];
        append(p.id, p.end === 1 ? a : b, p.end === 1 ? b : a, s.b);
      } else {
        const t = this.turnouts[p.name], points = { A: [t.ax, t.ay], B: [t.bx, t.by], C: [t.ccx, t.ccy] };
        append('VX:' + p.name + ':' + p.from, points[p.from], [t.cx, t.cy], t.block);
        append('VX:' + p.name + ':' + p.to, [t.cx, t.cy], points[p.to], t.block);
      }
    }
    return out;
  }
}
function distance(s, b) { return ((s.x1 + s.x2) / 2 - b.x - 8) ** 2 + ((s.y1 + s.y2) / 2 - b.y - 8) ** 2; }
export function buttonLabel(id) {
  const m = /^htvSp(III|II|IV|I|V|X)([ABC]?)$/.exec(id);
  return m ? 'Spår ' + ({ I: 1, II: 2, III: 3, IV: 4, V: 5, X: 10 }[m[1]]) + m[2].toLowerCase() : id.replace(/^htv/, '');
}
