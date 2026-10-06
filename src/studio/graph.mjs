// Spårgrafen ur JMRI:s layout: växlar, segment, punkter och korsningar. Används för att pröva om två växlar hänger ihop.
export function buildGraph(xml) {
  const { layoutTurnouts: TO, segments: TS, points: PP, crossings: LX } = xml;
  const byName = {};
  for (const t of Object.values(TO)) byName[t.turnoutname] ??= t;
  // Följer ett segment bort från 'cameFrom' tills en växel eller ett spårslut nås. Korsningar passeras rakt igenom.
  function walk(segment, cameFrom) {
    for (let guard = 0; guard < 500; guard++) {
      const s = TS[segment]; if (!s) return { object: segment, type: 'MISSING' };
      const ends = [[s.connect1name, s.type1], [s.connect2name, s.type2]];
      const [object, type] = ends.find(e => e[0] !== cameFrom) || ends[1];
      if (type === 'POS_POINT') {
        const p = PP[object]; const next = [p?.connect1name, p?.connect2name].filter(x => x && x !== segment);
        if (!next.length) return { object, type: 'END' };
        cameFrom = object; segment = next[0]; continue;
      }
      if (type.startsWith('LEVEL_XING')) {
        const leg = type.slice(-1).toLowerCase(), opposite = { a: 'c', c: 'a', b: 'd', d: 'b' }[leg];
        cameFrom = object; segment = LX[object]['connect' + opposite + 'name']; continue;
      }
      return { object, type };
    }
    return { object: segment, type: 'LOOP' };
  }
  const divergingLeg = t => (t.continuing ?? '2') === '2' ? 'C' : 'B';
  // Vart leder växelns avvikande ben?
  function divergingEnd(name) {
    const t = byName[name]; if (!t) return null;
    const leg = divergingLeg(t), r = walk(t['connect' + leg.toLowerCase() + 'name'], t.ident);
    return { turnout: TO[r.object]?.turnoutname || null, object: r.object, leg: r.type.startsWith('TURNOUT_') ? r.type.slice(-1) : r.type };
  }
  return { byName, walk, divergingLeg, divergingEnd };
}
// Två kompisväxlar bildar en förbindelse när vardera växelns avvikande ben leder till den andras avvikande ben.
export function checkPair(graph, a, b) {
  const ea = graph.divergingEnd(a), eb = graph.divergingEnd(b);
  if (!ea || !eb) return { pair: [a, b], ok: false, reason: 'Växeln saknas i layouten' };
  const ok = ea.turnout === b && ea.leg === graph.divergingLeg(graph.byName[b]) && eb.turnout === a && eb.leg === graph.divergingLeg(graph.byName[a]);
  return { pair: [a, b], ok, aLeadsTo: ea.turnout || ea.object, bLeadsTo: eb.turnout || eb.object };
}
export function companionPairs(coupled) {
  const seen = new Set(), pairs = [];
  for (const group of Object.values(coupled)) if (group.length === 2) { const k = [...group].sort().join('+'); if (!seen.has(k)) { seen.add(k); pairs.push([...group].sort()); } }
  return pairs;
}
export function companionCheck(xml, coupled) { const g = buildGraph(xml); return companionPairs(coupled).map(([a, b]) => checkPair(g, a, b)); }
// Dubbelkorsväxlar: fyra växlar kring en korsning. Rätt par är de vars avvikande ben möts.
export function crossoverProposals(xml) {
  const g = buildGraph(xml), out = [];
  for (const [ident, x] of Object.entries(xml.crossings)) {
    const legs = ['a', 'b', 'c', 'd'].map(l => g.walk(x['connect' + l + 'name'], ident));
    const names = legs.map(r => xml.layoutTurnouts[r.object]?.turnoutname).filter(Boolean);
    if (names.length !== 4) continue;
    const pairs = names.map(n => [n, g.divergingEnd(n)?.turnout]).filter(([n, m]) => m && n < m).map(p => p.sort());
    out.push({ crossing: ident, turnouts: names.sort(), pairs });
  }
  return out;
}
