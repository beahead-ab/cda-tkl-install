import {searchSourceRoutes,signalPlan} from './route-policy.mjs';

// Compare physical movement options once per NX pair, so duplicate main/shunt
// controls cannot bias the preference. This is a static plan, not permission:
// Engine still checks current occupancy, locks, field feedback and guards.
export function selectRoutePaths(topology,source,requests,{eligible=()=>true}={}) {
  const detector=new Map(topology.panel.lblocks.map(b=>[b.user,b.sensor||'@'+b.user]));
  const groups=new Map();
  const keyOf=nx=>nx.join('\0');
  const requestsByPair=new Map();
  for(const request of requests){const key=keyOf(request.nxButtons);if(!requestsByPair.has(key))requestsByPair.set(key,[]);requestsByPair.get(key).push(request);}
  for(const [key,pairRequests] of requestsByPair) {
    const request=pairRequests[0];
    const [start,target]=request.nxButtons;
    const targetMast=source.anchors.flatMap(a=>['eastbound','westbound'].map(d=>a[d+'sensor']===target?a[d+'signalmast']:null)).find(Boolean)||source.turnoutEnds.find(e=>e.sensor===target)?.mast;
    const candidates=searchSourceRoutes(topology,start,target).map(path=>({path,plan:signalPlan(topology,source,path)})).filter(c=>c.plan.signals.length&&c.plan.boundaries[0]?.sensor===start&&(!targetMast||c.plan.guardSignals.includes(targetMast))&&pairRequests.some(r=>eligible(r,c)));
    for(const candidate of candidates){
      candidate.resources={start,target,firstSignal:candidate.plan.signals[0],blocks:new Set(candidate.path.blocks.map(b=>detector.get(b)||'@'+b)),turnouts:candidate.path.settings,crossings:new Set(candidate.path.crossings),signals:new Set(candidate.plan.signals),guards:new Set(candidate.plan.guardSignals)};
    }
    groups.set(key,candidates);
  }
  const selected=new Map();
  for(const [key,candidates] of groups){
    for(const c of candidates){
      const blocked=[...groups].filter(([other,list])=>other!==key&&list.length&&!list.some(o=>compatible(c.resources,o.resources))).length;
      const divergent=c.path.path.filter(p=>p.kind==='turnout'&&c.path.settings[p.name]==='T').length;
      c.preference={blockedMovements:blocked,divergentLegs:divergent,length:c.path.cost,alternatives:candidates.length};
    }
    candidates.sort((a,b)=>a.preference.blockedMovements-b.preference.blockedMovements||a.preference.divergentLegs-b.preference.divergentLegs||a.path.cost-b.path.cost||JSON.stringify(a.path.path).localeCompare(JSON.stringify(b.path.path),'en'));
    selected.set(key,candidates);
  }
  return selected;
}
export function compatible(a,b){
  const overlaps=(x,y)=>[...x].some(v=>y.has(v));
  const guardConflict=(owner,next)=>[...next.signals].some(signal=>owner.guards.has(signal)&&!(owner.target&&owner.target===next.start&&signal===next.firstSignal));
  return !overlaps(a.blocks,b.blocks)&&!overlaps(a.crossings,b.crossings)&&!overlaps(a.signals,b.signals)&&!guardConflict(a,b)&&!guardConflict(b,a)&&!Object.entries(a.turnouts).some(([name,pos])=>b.turnouts[name]&&b.turnouts[name]!==pos);
}
