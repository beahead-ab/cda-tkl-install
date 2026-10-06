// The ranger's own area (docs/rangerlage.md): the turnouts the ranger lays freely,
// and the track reached from them without crossing into TKL's area. The boundary
// turnouts (profile.yardBoundaries) are passed through on their yard legs only, so
// 3e, Spår 6 and 3d belong to the area while the legs towards TKL do not. XML
// supplies topology data only; no JMRI handover script is run.
export const yardTurnoutNames=[111,114,115,118,119,127,128,130,133,150,155].map(n=>'Vx'+n);
export function compileYardArea(panel,profile){
  const turnouts=yardTurnoutNames,boundaries=profile.yardBoundaries||{};
  const segments=panel.segs.filter(s=>s.b!=='frame'&&Math.min(s.y1,s.y2)<850),byId=new Map(segments.map(s=>[s.id,s])),adj=new Map();
  const add=(a,b)=>{if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);};
  for(const s of segments)for(const e of [1,2]){
    const kind=s['t'+e],id=s['c'+e];
    if(kind.startsWith('TURNOUT_')){
      const name=panel.turnouts[id]?.name,leg=kind.slice(-1);
      // A boundary turnout joins the area only through its yard legs.
      if(boundaries[name]&&!boundaries[name].yardLegs.includes(leg))continue;
      add(s.id,'V:'+name);
    }
    else if(kind==='POS_POINT')add(s.id,'P:'+id);
    // This graph defines ownership, not a traversable train path. All rays
    // belong to the same local turntable area regardless of bridge position.
    else if(kind.startsWith('TURNTABLE_RAY_'))add(s.id,'TABLE:'+id);
    else if(kind.startsWith('LEVEL_XING_'))add(s.id,'X:'+id+':'+(['A','C'].includes(kind.slice(-1))?'AC':'BD'));
  }
  const inside=name=>turnouts.includes(name)||!!boundaries[name];
  const seen=new Set(),queue=turnouts.map(n=>'V:'+n);
  for(let i=0;i<queue.length;i++){
    const id=queue[i];if(seen.has(id)||id.startsWith('V:')&&!inside(id.slice(2)))continue;
    seen.add(id);for(const next of adj.get(id)||[])queue.push(next);
  }
  const ids=[...seen].filter(id=>byId.has(id)).sort();
  const blocks=[...new Set([...ids.map(id=>byId.get(id).b),...turnouts.map(n=>profile.turnouts[n]?.block)].filter(Boolean))].sort();
  if(turnouts.some(n=>!profile.turnouts[n]||boundaries[n])||blocks.some(n=>!profile.blocks[n]))throw Error('Rangerområdets objekt måste granskas.');
  const addresses=new Set(blocks.map(n=>profile.blocks[n].address));
  const affected=r=>Object.keys(r.turnouts).some(n=>turnouts.includes(n))||r.blocks.some(n=>addresses.has(profile.blocks[n].address));
  const signals=[...new Set([...profile.routes,...profile.routeAlternatives].filter(affected).flatMap(r=>[...r.signals,...r.guardSignals]))].sort();
  return {turnouts,boundaries:Object.keys(boundaries).sort(),segments:ids,blocks,signals,provenance:'Rangerarens eget område enligt docs/rangerlage.md. Topologiskt avgränsat vid gränsväxlarnas TKL-ben; spår 11–13 är TKL:s.'};
}
