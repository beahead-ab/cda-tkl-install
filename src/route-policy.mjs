// Compiled source facts are data, never executable JMRI scripts.
export class RoutePolicy {
  constructor(source) {
    this.pairs = new Map();
    for (const rule of [...source.mainRoutePolicies, ...(source.shuntRoutePolicies || [])]) {
      const key = rule.fromButton + '\0' + rule.toButton;
      if (!this.pairs.has(key)) this.pairs.set(key, []);
      this.pairs.get(key).push(rule);
    }
  }
  inspect(from, to) {
    const rules = this.pairs.get(from + '\0' + to) || [];
    if (!rules.length) return { allowed: false, reason: 'Knappkombinationen saknar godkänd regel i källan.', rules: [] };
    if (rules.some(r => r.status === 'unresolved')) return { allowed: false, reason: 'Källregeln innehåller en motsägelse och är spärrad tills den är utredd.', rules };
    if (rules.some(r => r.status === 'denied')) return { allowed: false, reason: 'Knappkombinationen är uttryckligen spärrad i Charlottendals källregler.', rules };
    const signatures = new Set(rules.map(r => JSON.stringify(r.nxButtons)));
    if (signatures.size !== 1) return { allowed: false, reason: 'Flera regler ger olika NX-order för samma knappar.', rules };
    return { allowed: true, rules, nxButtons: rules[0].nxButtons };
  }
  allowed() {
    return [...this.pairs.values()].map(r => ({ from: r[0].fromButton, to: r[0].toButton }))
      .filter(p => this.inspect(p.from, p.to).allowed);
  }
}

export function attachSourceEndpoints(topology, source) {
  for (const a of source.anchors) for (const direction of ['eastbound','westbound']) {
    const sensor = a[direction+'sensor']; if (!sensor) continue;
    const incoming = [a.connect1name,a.connect2name].map(id=>topology.segments[id]).filter(Boolean).filter(s=>{
      const at = s.c1===a.ident ? 1 : s.c2===a.ident ? 2 : 0;
      if (!at) return false;
      const dx = deltaFromAnchor(topology, s, at, a);
      return direction==='eastbound' ? dx<0 : dx>0;
    });
    if(incoming.length===1) {
      const seg=incoming[0];
      topology.buttons[sensor]={segment:seg.id,end:seg.c1===a.ident?2:1,label:sensor};
    }
  }
  for (const e of source.turnoutEnds) {
    const seg=topology.segments[e.segment];
    if(e.sensor && seg) topology.buttons[e.sensor]={segment:seg.id,end:seg.c1===e.id?2:1,label:e.sensor};
  }
}

function deltaFromAnchor(topology, segment, at, anchor) {
  const other = at === 1 ? 2 : 1;
  let dx = segment['x'+other] - Number(anchor.x);
  // JMRI may place an anchor exactly on a turnout leg. The zero-length
  // segment still has a direction: from that leg toward the turnout centre.
  if (!dx && segment['t'+other]?.startsWith('TURNOUT_')) {
    const turnout = topology.panel.turnouts[segment['c'+other]];
    if (turnout) dx = turnout.cx - Number(anchor.x);
  }
  return dx;
}

export function searchSourceRoute(topology, fromSensor, toSensor) {
  return trimApproach(topology,topology.search(fromSensor,toSensor));
}

export function searchSourceRoutes(topology,fromSensor,toSensor) {
  return topology.searchRoutes(fromSensor,toSensor).map(route=>trimApproach(topology,route)).filter(Boolean);
}

function trimApproach(topology,route) {
  if (!route) return null;
  // The incoming segment ends AT the start signal. Its occupancy belongs to
  // the approach, not to the protected route ahead of that signal.
  const path=route.path.slice(1);
  if(!path.length) return null;
  const blocks=[...new Set(path.map(p=>p.kind==='segment'?topology.segments[p.id].b:topology.turnouts[p.name].block).filter(Boolean))];
  const flow=topology.flow(path);
  return {...route,path,blocks,used:path.filter(p=>p.kind==='segment').map(p=>p.id),flow,cost:flow.reduce((n,p)=>n+p.length,0)};
}

// Mast locations and direction come from source anchors / turnout legs,
// never from the visually nearest icon (which may face the other direction).
export function signalPlan(topology, source, route) {
  const anchors = Object.fromEntries(source.anchors.map(a => [a.ident, a]));
  const ends = source.turnoutEnds;
  const signals = [], guards = [], boundaries = [];
  const add = (mast, index, sensor) => {
    if (mast && !signals.includes(mast)) { signals.push(mast); boundaries.push({ mast, index, sensor }); }
  };
  for (let index = 0; index < route.path.length; index++) {
    const p = route.path[index];
    if (p.kind === 'turnout') {
      for (const end of ends.filter(e => e.turnout === p.name)) {
        if (end.leg === p.from) add(end.mast, index, end.sensor);
        else if (end.mast) guards.push(end.mast);
      }
      continue;
    }
    const seg = topology.segments[p.id], entry = seg['c' + p.end];
    const anchor = anchors[entry];
    if (!anchor) continue;
    const exit = p.end === 1 ? 2 : 1;
    const dx = deltaFromAnchor(topology, seg, p.end, anchor);
    if (!dx) continue; // no inferred direction for a vertical-only anchor
    const forward = dx > 0 ? 'eastbound' : 'westbound', reverse = dx > 0 ? 'westbound' : 'eastbound';
    add(anchor[forward + 'signalmast'], index, anchor[forward + 'sensor']);
    if (anchor[reverse + 'signalmast']) guards.push(anchor[reverse + 'signalmast']);
  }
  // The destination is a STOP guard unless Engine verifies a separately
  // reserved continuation at this exact source signal boundary.
  const last = route.path.at(-1);
  if (last?.kind === 'segment') {
    const seg = topology.segments[last.id], exit = last.end === 1 ? 2 : 1, node = seg['c' + exit];
    const a = anchors[node], dx = seg['x' + exit] - seg['x' + last.end];
    if (a && dx) for (const direction of ['eastbound', 'westbound']) if (a[direction + 'signalmast']) guards.push(a[direction + 'signalmast']);
    for (const e of ends) if (e.id === node && e.segment === last.id && e.mast) guards.push(e.mast);
  }
  return { signals, guardSignals: [...new Set(guards)].filter(n => !signals.includes(n)), boundaries };
}
