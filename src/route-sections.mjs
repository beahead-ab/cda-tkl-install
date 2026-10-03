// Split only along existing, reviewed route definitions on the actual reserved
// path. Never infer a release boundary from a dot's screen coordinates.
const sameSet=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
const flowKey=f=>JSON.stringify([f.id,f.x1,f.y1,f.x2,f.y2,f.block]);
export function splitRouteAt(profile,route,button) {
  if(button===route.from||button===route.to||!route.flow?.length)return null;
  const catalogue=[...profile.routes,...(profile.routeAlternatives||[])];
  const disabled=new Set(profile.routes.filter(r=>r.adminDisabled).map(r=>r.id));
  const eligible=r=>r.kind===route.kind&&!disabled.has(r.id)&&r.flow?.length;
  const starts=catalogue.filter(r=>eligible(r)&&r.from===route.from&&r.to===button);
  const ends=catalogue.filter(r=>eligible(r)&&r.from===button&&r.to===route.to);
  const original=route.flow.map(flowKey),set=(r,key)=>new Set(r[key]||[]);
  for(const a of starts)for(const b of ends){
    const combined=[...a.flow,...b.flow].map(flowKey);
    if(combined.length!==original.length||combined.some((k,i)=>k!==original[i]))continue;
    if(a.source?.nxButtons?.[1]!==b.source?.nxButtons?.[0]||!b.source?.nxButtons?.[0]||b.boundaries?.[0]?.sensor!==b.source.nxButtons[0])continue;
    if(JSON.stringify([...a.signals,...b.signals])!==JSON.stringify(route.signals))continue;
    if(!sameSet(new Set([...a.blocks,...b.blocks]),set(route,'blocks'))||!sameSet(new Set([...a.crossings,...b.crossings]),set(route,'crossings')))continue;
    const addresses=new Set(a.blocks.map(n=>profile.blocks[n].address));
    if(b.blocks.some(n=>addresses.has(profile.blocks[n].address))||b.crossings.some(n=>a.crossings.includes(n)))continue;
    const settings=[...Object.entries(a.turnouts),...Object.entries(b.turnouts)];
    if(settings.some(([n,p])=>route.turnouts[n]!==p)||!sameSet(new Set(settings.map(([n])=>n)),new Set(Object.keys(route.turnouts))))continue;
    const guards=new Set([...a.guardSignals,...b.guardSignals]);
    if((route.guardSignals||[]).some(n=>!guards.has(n))||[...guards].some(n=>!route.guardSignals.includes(n)&&!route.signals.includes(n)))continue;
    return [a,b];
  }
  return null;
}
