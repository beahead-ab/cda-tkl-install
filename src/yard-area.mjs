// Explicit new ownership model. XML supplies topology data only. The old
// HandleFreeArea/HandlePanel scripts and their internal sensors are not run.
export const yardTurnoutNames=[103,111,113,114,115,116,118,119,123,126,127,128,130,132,133,144,150,155].map(n=>'Vx'+n);
export function compileYardArea(panel,profile){
  const turnouts=yardTurnoutNames;
  const segments=panel.segs.filter(s=>s.b!=='frame'&&Math.min(s.y1,s.y2)<850),byId=new Map(segments.map(s=>[s.id,s])),adj=new Map();
  const add=(a,b)=>{if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);};
  for(const s of segments)for(const e of [1,2]){
    const kind=s['t'+e],id=s['c'+e];
    if(kind.startsWith('TURNOUT_'))add(s.id,'V:'+panel.turnouts[id]?.name);
    else if(kind==='POS_POINT')add(s.id,'P:'+id);
    // This graph defines ownership, not a traversable train path. All rays
    // belong to the same local turntable area regardless of bridge position.
    else if(kind.startsWith('TURNTABLE_RAY_'))add(s.id,'TABLE:'+id);
    else if(kind.startsWith('LEVEL_XING_'))add(s.id,'X:'+id+':'+(['A','C'].includes(kind.slice(-1))?'AC':'BD'));
  }
  const seen=new Set(),queue=turnouts.map(n=>'V:'+n);
  for(let i=0;i<queue.length;i++){
    const id=queue[i];if(seen.has(id)||id.startsWith('V:')&&!turnouts.includes(id.slice(2)))continue;
    seen.add(id);for(const next of adj.get(id)||[])queue.push(next);
  }
  const ids=[...seen].filter(id=>byId.has(id)).sort();
  const blocks=[...new Set([...ids.map(id=>byId.get(id).b),...turnouts.map(n=>profile.turnouts[n]?.block)].filter(Boolean))].sort();
  if(turnouts.some(n=>!profile.turnouts[n]||profile.yardBoundaries[n])||blocks.some(n=>!profile.blocks[n]))throw Error('Rangerområdets objekt måste granskas.');
  const addresses=new Set(blocks.map(n=>profile.blocks[n].address));
  const affected=r=>Object.keys(r.turnouts).some(n=>turnouts.includes(n))||r.blocks.some(n=>addresses.has(profile.blocks[n].address));
  const accessButtons=['htvSpIIIA','htvSpIVA','htvSpVA'];
  const external=id=>profile.buttons[id]?.segment&&!ids.includes(profile.buttons[id].segment);
  const accessRoutes=profile.routes.filter(r=>r.kind==='main'&&((accessButtons.includes(r.from)&&external(r.to))||(accessButtons.includes(r.to)&&external(r.from)))).map(r=>r.id);
  const signals=[...new Set([...profile.routes,...profile.routeAlternatives].filter(affected).flatMap(r=>[...r.signals,...r.guardSignals]))].sort();
  return {turnouts,segments:ids,blocks,signals,accessRoutes,provenance:'Egen central manöverrätt. Topologiskt avgränsad vid övriga växlar; TKL behåller 112, 131 och 154.'};
}
