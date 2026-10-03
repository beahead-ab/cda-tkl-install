// Display reservations by detector address, including every visual alias.
// This does not change occupancy or grant any movement authority.
export function trackRestrictions(config,state) {
  const result=new Map();
  const add=(names,reason)=>{for(const name of names||[]){const address=config.blocks[name]?.address;if(address==null)continue;const reasons=result.get(address)||[];if(!reasons.includes(reason))reasons.push(reason);result.set(address,reasons);}};
  add(state?.controls?.blocked,'Administrativ spårspärr');
  for(const line of state?.operating?.lines||[])if(line.blocked)add(line.blocks,'Linjespärr · '+line.label);
  if(state?.operating?.programming?.reserved){const p=config.operatingControls?.programming;add([...(p?.blocks||[]),config.turnouts[p?.turnout]?.block],'Programmeringsspärr');}
  return result;
}

// One fixed marker per detector on its longest visible piece avoids clutter
// from the many short XML segments. Prefer plain rail over a turnout leg.
export function restrictionMarkers(panel,config) {
  const candidates=new Map();
  const add=(block,x1,y1,x2,y2,turnout=false)=>{
    const address=config.blocks[block]?.address,length=Math.hypot(x2-x1,y2-y1);
    if(address==null||length<12)return;
    const score=length+(turnout?0:10000),old=candidates.get(address);
    if(old&&old.score>=score)return;
    candidates.set(address,{address,block,x:(x1+x2)/2,y:(y1+y2)/2,angle:Math.atan2(y2-y1,x2-x1)*180/Math.PI,score});
  };
  for(const s of panel.segs)if(!s.hide&&s.b!=='frame'&&Math.min(s.y1,s.y2)<850)add(s.b,s.x1,s.y1,s.x2,s.y2);
  for(const t of Object.values(panel.turnouts))if(t.cy<=850)for(const [x,y] of [[t.ax,t.ay],[t.bx,t.by],[t.ccx,t.ccy]])add(t.block,t.cx,t.cy,x,y,true);
  return [...candidates.values()];
}

// Trace each line back through XML-connected segments, stopping at the first
// turnout. Never cross a turnout or guess connectivity from screen positions.
export function lineRestrictionExtents(panel,config) {
  const segments=panel.segs.filter(s=>s.b!=='frame'&&Math.min(s.y1,s.y2)<850),byId=new Map(segments.map(s=>[s.id,s])),points=new Map(),result=new Map();
  for(const s of segments)for(const end of [1,2])if(s['t'+end]==='POS_POINT'){
    const key=s['c'+end],list=points.get(key)||[];list.push(s);points.set(key,list);
  }
  for(const line of Object.values(config.operatingControls?.lines||{})){
    const addresses=new Set(line.blocks.map(b=>config.blocks[b]?.address).filter(a=>a!=null));
    const queue=segments.filter(s=>addresses.has(config.blocks[s.b]?.address)),parts=new Set();
    for(let i=0;i<queue.length;i++){
      const s=queue[i];if(parts.has(s.id))continue;parts.add(s.id);
      for(const end of [1,2]){
        const type=s['t'+end],key=s['c'+end],leg=/^TURNOUT_([ABC])$/.exec(type);
        if(leg){const t=panel.turnouts[key];if(t)parts.add('VX:'+t.name+':'+leg[1]);}
        else if(type.startsWith('LEVEL_XING_')){
          const opposite={A:'C',C:'A',B:'D',D:'B'}[type.slice(-1)],id=panel.xings?.[key]?.['c'+opposite?.toLowerCase()],next=byId.get(id);
          if(next&&!parts.has(id))queue.push(next);
        }
        else if(type==='POS_POINT'){
          const neighbors=points.get(key)||[];
          if(neighbors.length===2)for(const next of neighbors)if(!parts.has(next.id))queue.push(next);
        }
      }
    }
    result.set(line.id,parts);
  }
  return result;
}
