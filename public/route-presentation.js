// Presentation only. Never add these connectors to route definitions or locks.
const EPS=.01;
function onPart(x,y,p){
  const dx=p.x2-p.x1,dy=p.y2-p.y1,l2=dx*dx+dy*dy;
  if(!l2)return false;
  const t=((x-p.x1)*dx+(y-p.y1)*dy)/l2;
  return t>=-EPS&&t<=1+EPS&&Math.hypot(x-p.x1-t*dx,y-p.y1-t*dy)<.25;
}
export function routePresentation(route,panel,config,controls){
  const buttons=controls.filter(b=>b.sensor.startsWith('htv'));
  const source=route.flow||[];
  function connector(id,edge,start){
    const b=buttons.find(b=>b.sensor===id),binding=config.buttons[id];
    if(!b||!edge||source.some(p=>onPart(b.centerX,b.centerY,p)))return [];
    const boundaryX=start?edge.x1:edge.x2,boundaryY=start?edge.y1:edge.y2;
    const dir=Math.sign(edge.x2-edge.x1),from=start?b.centerX:boundaryX,to=start?boundaryX:b.centerX;
    if(Math.abs(edge.y1-edge.y2)>EPS||Math.abs(b.centerY-boundaryY)>EPS||dir*(to-from)<=0)return [];
    const block=panel.segs.find(s=>s.id===binding?.segment)?.b;
    if(!block)return [];
    // Follow only existing straight segments in this button's own block, up to
    // the actual route boundary. Hidden source segments bridge the button gap.
    const low=Math.min(from,to),high=Math.max(from,to);
    const spans=panel.segs.filter(s=>s.b===block&&Math.abs(s.y1-boundaryY)<EPS&&Math.abs(s.y2-boundaryY)<EPS)
      .map(s=>({s,low:Math.max(low,Math.min(s.x1,s.x2)),high:Math.min(high,Math.max(s.x1,s.x2))}))
      .filter(s=>s.high>s.low).sort((a,b)=>a.low-b.low);
    const parts=[];let cursor=low;
    for(const span of spans){
      if(span.low>cursor+EPS)return [];
      if(span.high<=cursor)continue;
      parts.push({id:span.s.id,x1:cursor,y1:boundaryY,x2:span.high,y2:boundaryY,block,connector:true});cursor=span.high;
    }
    if(cursor<high-EPS)return [];
    return dir>0?parts:parts.reverse().map(p=>({...p,x1:p.x2,x2:p.x1}));
  }
  const parts=[...connector(route.from,source[0],true),...source.map(p=>({...p})),...connector(route.to,source.at(-1),false)];
  let distance=0;
  for(const p of parts){p.length=Math.hypot(p.x2-p.x1,p.y2-p.y1);p.distance=distance;distance+=p.length;}
  const members=buttons.flatMap(b=>{
    const covered=parts.filter(p=>onPart(b.centerX,b.centerY,p));
    if(!covered.length&&b.sensor!==route.from&&b.sensor!==route.to)return [];
    const at=covered.length?Math.min(...covered.map(p=>p.distance+Math.hypot(b.centerX-p.x1,b.centerY-p.y1))):b.sensor===route.from?0:distance;
    return [{id:b.sensor,parts:covered,at}];
  });
  return {parts,members,total:distance||1};
}
export function routeButtonPhase(route,member,state,fraction=1,total=1){
  if(state.connection!=='connected')return 'held';
  if(member.parts.some(p=>state.blocks[p.block]?.occupied===true))return 'occupied';
  if(['held','occupied','cancelling','setting'].includes(route.state))return 'held';
  if(route.state==='traversing')return 'held';
  if(route.state==='establishing'&&member.at>fraction*total)return 'held';
  return 'active';
}
