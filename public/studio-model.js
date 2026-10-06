// Studio: modellen bakom Konfigurera och Data. Ren logik utan DOM, så den kan provas i Node.
// En last (driftprofil, panelgeometri och /api/studio) blir objekt, relationer och projektioner.
export const SETS=[
  {id:'vaxlar',label:'Växlar',kind:'turnout'},{id:'signaler',label:'Signaler',kind:'signal'},{id:'sparledningar',label:'Spårledningar',kind:'block'},
  {id:'tagvagar',label:'Tågvägar',kind:'route'},{id:'regler',label:'Regler',kind:'rule'},{id:'moduler',label:'Moduler',kind:'module'},{id:'avvikelser',label:'Avvikelser',kind:'deviation'}];
export const TABS=[{id:'konfigurera',label:'Konfigurera'},{id:'data',label:'Data'},{id:'genomgang',label:'Genomgång'},{id:'driftsattning',label:'Driftsättning'},{id:'anslutning',label:'Anslutning'}];
export const CARD_TYPES=['förslag','saknas','beslut','underlag'],CARD_LABEL={förslag:'Förslag',saknas:'Saknas',beslut:'Beslut',underlag:'Underlag'},TYPE_CLASS={förslag:'st-type-forslag',saknas:'st-type-saknas',beslut:'st-type-beslut',underlag:'st-type-underlag'};
export const SHAPE_LABEL={single:'En ingång',any:'Någon av flera',all:'Alla av flera',turnoutPart:'Växelberoende del',noRule:'Sensor utan regel',noSensor:'Utan sensor'};
const OBJECT_RE=/^(Vx\d+|\d+\/\d+|S[A-Z0-9a-z]+|Slokstall\d|SL\d\w*|SU\d\w*|SN\d\w*|SG\d+|M\d\d|LS\d+|LT\d+|V\d|X\d)$/;

export function buildStudioModel({profile,panel,studio}) {
  const objects=new Map(),add=o=>{objects.set(o.id,o);return o;};
  const sections=new Map((studio.detection.sections||[]).map(s=>[s.name,s]));
  const masts=new Map(panel.micons.map(m=>[m.mast,m]));
  const turnouts=studio.objects.turnouts.map(t=>add({...t,kind:'turnout',routes:[]}));
  const signals=studio.objects.signals.map(s=>add({...s,kind:'signal',routes:[],guards:[],position:masts.get(s.id)||null,aspects:panel.aspectsByType?.[s.mastType]||[]}));
  const blocks=studio.objects.blocks.map(b=>add({...b,kind:'block',routes:[],section:sections.get(b.id)||null}));
  const modules=studio.objects.modules.map(m=>add({...m,kind:'module',objects:[]}));
  const routes=profile.routes.map(r=>add({id:r.id,kind:'route',label:r.label,routeKind:r.kind,from:r.from,to:r.to,turnouts:r.turnouts,blocks:r.blocks,signals:r.signals,guardSignals:r.guardSignals,crossings:r.crossings||[],source:r.source}));
  for(const r of routes){
    for(const t of Object.keys(r.turnouts))objects.get(t)?.routes.push(r.id);
    for(const b of r.blocks)objects.get(b)?.routes.push(r.id);
    for(const s of r.signals)objects.get(s)?.routes.push(r.id);
    for(const s of r.guardSignals)objects.get(s)?.guards.push(r.id);
  }
  const moduleOf=src=>src?.module?.name&&objects.get(src.module.name);
  for(const t of turnouts){const m=moduleOf(t.source);if(m)m.objects.push(t.id);}
  for(const s of signals)for(const src of s.source){const m=moduleOf(src);if(m&&!m.objects.includes(s.id))m.objects.push(s.id);}
  for(const b of blocks)for(const d of b.section?.inputDetails||[]){const m=d.module&&objects.get(d.module);if(m&&!m.objects.includes(b.id))m.objects.push(b.id);}
  const deviations=(studio.deviations||[]).map((d,i)=>add({...d,kind:'deviation',id:'avv:'+d.id,code:d.id,order:i,objects:deviationObjects(d)}));
  const touches=r=>[...(r.type==='aspect'?r.signals||[]:r.type==='crossing'?r.blocks||[]:r.objects||(r.object?[r.object]:[])),...(r.requires?.blocks||[]),...(r.requires?.signals||[]),...Object.keys(r.positions||{})];
  const rules=[...(studio.rules?.rules||[]),...(studio.rules?.proposals||[])].map(r=>add({...r,kind:'rule',label:r.id,touches:touches(r)}));
  const rulesByObject=new Map();for(const r of rules)for(const o of r.touches)(rulesByObject.get(o)||rulesByObject.set(o,[]).get(o)).push(r.id);
  return {objects,turnouts,signals,blocks,routes,modules,deviations,rules,rulesByObject,ruleEffects:studio.rules?.effects||null,ruleSource:studio.rules?.source||'',compiledIdentical:studio.rules?.compiledIdentical??null,baseDiff:studio.rules?.baseDiff||null,drafts:studio.drafts||null,review:studio.review||null,measure:studio.measure||null,cards:studio.cards||null,mgp:studio.mgp||[],detectionProposals:(studio.rules?.detectionProposals||[]).length,counts:studio.counts,sourceHash:studio.sourceHash,companions:studio.companions,crossovers:studio.crossovers,detection:studio.detection,blocking:studio.blocking};
}
export function deviationObjects(d){
  const out=new Set();
  for(const item of d.items||[])for(const token of String(item).split(/\s*(?:\+|→|,)\s*/))if(OBJECT_RE.test(token))out.add(token);
  return [...out];
}
// Alla objekt som hör ihop med ett valt objekt. Det är korsfiltret i Data-vyn.
export function relationsFor(model,id){
  const o=model.objects.get(id),empty={routes:[],turnouts:[],signals:[],blocks:[],modules:[],deviations:[],rules:[]};
  if(!o)return empty;
  const uniq=a=>[...new Set(a)];
  let routeIds=[];
  if(o.kind==='route')routeIds=[o.id];
  else if(o.kind==='signal')routeIds=uniq([...o.routes,...o.guards]);
  else if(o.kind==='module')routeIds=uniq(o.objects.flatMap(x=>model.objects.get(x)?.routes||[]));
  else if(o.kind==='deviation')routeIds=uniq(o.objects.flatMap(x=>model.objects.get(x)?.routes||[]));
  else if(o.kind==='rule')routeIds=o.routes||[];
  else routeIds=o.routes;
  const rs=routeIds.map(r=>model.objects.get(r)).filter(Boolean);
  const rel={routes:routeIds,
    turnouts:uniq(o.kind==='module'?o.objects.filter(x=>model.objects.get(x)?.kind==='turnout'):o.kind==='deviation'?o.objects.filter(x=>model.objects.get(x)?.kind==='turnout'):rs.flatMap(r=>Object.keys(r.turnouts))),
    signals:uniq(o.kind==='module'?o.objects.filter(x=>model.objects.get(x)?.kind==='signal'):o.kind==='deviation'?o.objects.filter(x=>model.objects.get(x)?.kind==='signal'):rs.flatMap(r=>[...r.signals,...r.guardSignals])),
    blocks:uniq(o.kind==='deviation'?o.objects.filter(x=>model.objects.get(x)?.kind==='block'):o.kind==='module'?o.objects.filter(x=>model.objects.get(x)?.kind==='block'):rs.flatMap(r=>r.blocks)),
    modules:uniq(o.kind==='turnout'?[o.source?.module?.name].filter(Boolean):o.kind==='signal'?o.source.map(s=>s.module?.name).filter(Boolean):o.kind==='block'?(o.section?.inputDetails||[]).map(d=>d.module).filter(Boolean):o.kind==='module'?[o.id]:[]),
    deviations:model.deviations.filter(d=>d.objects.includes(id)||(o.kind==='module'&&d.objects.some(x=>o.objects.includes(x)))).map(d=>d.id),
    rules:o.kind==='rule'?[o.id]:o.kind==='route'?model.rules.filter(r=>(r.routes||[]).includes(o.id)).map(r=>r.id):uniq((o.kind==='module'?o.objects:[id]).flatMap(x=>model.rulesByObject.get(x)||[]))};
  if(o.kind==='rule'){const t=o.touches;rel.turnouts=uniq([...t.filter(x=>model.objects.get(x)?.kind==='turnout'),...rel.turnouts]);rel.blocks=uniq([...t.filter(x=>model.objects.get(x)?.kind==='block'),...rel.blocks]);rel.signals=uniq([...t.filter(x=>model.objects.get(x)?.kind==='signal'),...rel.signals]);}
  if(o.kind==='turnout'){rel.turnouts=uniq([o.id,...o.companions,...rel.turnouts]);rel.blocks=uniq([o.block,...rel.blocks]);}
  if(o.kind==='block')rel.blocks=uniq([o.id,...rel.blocks]);
  if(o.kind==='signal')rel.signals=uniq([o.id,...rel.signals]);
  return rel;
}
const KIND_TO_SET={turnout:'vaxlar',signal:'signaler',block:'sparledningar',route:'tagvagar',rule:'regler',module:'moduler',deviation:'avvikelser'};
const REL_KEY={vaxlar:'turnouts',signaler:'signals',sparledningar:'blocks',tagvagar:'routes',regler:'rules',moduler:'modules',avvikelser:'deviations'};
export function rowsFor(model,setId,filterId=null){
  const all={vaxlar:model.turnouts,signaler:model.signals,sparledningar:model.blocks,tagvagar:model.routes,regler:model.rules,moduler:model.modules,avvikelser:model.deviations}[setId]||[];
  if(!filterId||!model.objects.has(filterId))return all;
  const keep=new Set(relationsFor(model,filterId)[REL_KEY[setId]]);
  return all.filter(o=>keep.has(o.id));
}
export function setOf(kind){return KIND_TO_SET[kind];}
const n=x=>x==null?'':String(x);
export function columnsFor(setId){
  return {
    vaxlar:[['id','Växel'],['companion','Kompis'],['block','Spårledning'],['address','Adress'],['module','Modul · kanal'],['routes','Tågvägar','num'],['status','Status']],
    signaler:[['id','Signal'],['mastType','Masttyp'],['address','Adress'],['outputs','Utgångar i XML'],['cleared','Klareras i','num'],['guard','Skydd i','num'],['status','Status']],
    sparledningar:[['id','Spårledning'],['sourceSensor','Källsensor'],['inputs','Ingångar'],['shape','Regelform'],['address','Adress'],['routes','Tågvägar','num'],['status','Status']],
    tagvagar:[['label','Tågväg'],['routeKind','Typ'],['turnouts','Växlar med läge'],['blocks','Spårledningar i ordning'],['signals','Klareras'],['guardSignals','Skydd'],['source','Källa']],
    regler:[['id','Regel'],['typeLabel','Typ'],['explain','Klartext'],['touches','Objekt'],['runsInLabel','Verkställs i'],['routes','Tågvägar','num'],['status','Status'],['source','Källa']],
    moduler:[['id','Modul'],['refs','Ref.','num'],['outputs','Utgångar','num'],['inputs','Ingångar','num'],['turnouts','Växlar'],['signals','Signaler'],['status','Status']],
    avvikelser:[['title','Avvikelse'],['count','Antal','num'],['resolvedBy','Löses av'],['items','Objekt'],['blocking','Blockerar']]}[setId]||[];
}
export function cellsFor(model,setId,o){
  const list=(a,max=6)=>a.length>max?a.slice(0,max).join(', ')+` … (${a.length})`:a.join(', ');
  switch(setId){
    case 'vaxlar':return {id:o.id,companion:o.companions.join(', '),block:n(o.block),address:n(o.loconet.order),module:o.source?.module?`${o.source.module.name}${o.source.module.channel?' · '+o.source.module.channel:''}`:'',routes:n(o.routes.length),status:o.inPlan?o.status:'Utan plats i planen'};
    case 'signaler':return {id:o.id,mastType:o.mastType,address:n(o.loconet.order),outputs:o.source.map(s=>s.system+' '+(s.module?.name||'')).join(', '),cleared:n(o.routes.length),guard:n(o.guards.length),status:o.status};
    case 'sparledningar':{const s=o.section;return {id:o.id,sourceSensor:n(o.sourceSensor||'–'),inputs:s?list(s.inputs,4):'',shape:s?SHAPE_LABEL[s.shape]||s.shape:'',address:n(o.loconet.report),routes:n(o.routes.length),status:s&&(s.shape==='noRule'||s.shape==='noSensor')&&s.track?'Ingen detektering':o.status};}
    case 'tagvagar':return {label:o.label,routeKind:o.routeKind==='main'?'huvud':'växling',turnouts:Object.entries(o.turnouts).map(([k,v])=>k.slice(2)+' '+v).join(' '),blocks:list(o.blocks,8),signals:o.signals.join(', '),guardSignals:list(o.guardSignals,6),source:(o.source?.rules||[]).join(', ')};
    case 'regler':return {id:o.id,typeLabel:o.typeLabel,explain:o.explain,touches:list(o.touches,6),runsInLabel:o.runsInLabel,routes:n((o.routes||[]).length),status:{active:'Gäller',unresolved:'Olöst',proposal:'Förslag',unsupported:'Stöds inte'}[o.status]||o.status,source:[o.source?.jmri,o.source?.profile,o.source?.studio].filter(Boolean).join(' · ')};
    case 'moduler':return {id:o.id,refs:n(o.refs),outputs:n(o.outputs),inputs:n(o.inputs),turnouts:list(o.turnouts,5),signals:list(o.signals,5),status:o.status};
    case 'avvikelser':return {title:o.title,count:n(o.count),resolvedBy:o.resolvedBy+(o.note?' · '+o.note:''),items:list(o.items||[],5),blocking:o.blocking?'Ja':''};
  }
  return {};
}
// Ordningen vänster till höger genom stationen, för Gå igenom.
export function walkOrder(panel){
  const items=[...Object.values(panel.turnouts).map(t=>({id:t.name,x:t.cx,y:t.cy})),...panel.micons.map(m=>({id:m.mast,x:m.x,y:m.y}))];
  return items.sort((a,b)=>a.x-b.x||a.y-b.y).map(i=>i.id);
}
// Djuplänken läses en gång: #data?set=tagvagar,signaler&objekt=Vx100
export function parseHash(hash){
  const [path,query]=String(hash||'').replace(/^#/,'').split('?'),params=new URLSearchParams(query||''),[head,view='']=path.split('/');
  const tab=TABS.some(t=>t.id===head)?head:'konfigurera';
  return {tab,view,sets:(params.get('set')||'').split(',').filter(s=>SETS.some(x=>x.id===s)),object:params.get('objekt')||null};
}
// Geometrin ur panel.json, ritad av Studios egen kod. Ramen och dekorationerna utgår.
export function planGeometry(panel,undetected=new Set()){
  const road=new Set(['v1','v2','v3','v4']),skip=new Set(['frame','friline']);
  const segments=panel.segs.filter(s=>!s.hide&&!skip.has(s.b)&&Math.max(s.y1,s.y2)<=820).map(s=>({id:s.id,block:s.b,x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,road:road.has(s.b),undetected:undetected.has(s.b)}));
  const legs=[],turnouts=[];
  for(const t of Object.values(panel.turnouts)){
    turnouts.push({name:t.name,cx:t.cx,cy:t.cy,block:t.block,undetected:undetected.has(t.block)});
    for(const k of ['a','b','cc','d']){const x=t[k+'x'],y=t[k+'y'];if(x==null||(k==='d'&&x===t.ax&&y===t.ay))continue;legs.push({name:t.name,x1:t.cx,y1:t.cy,x2:x,y2:y,undetected:undetected.has(t.block)});}
  }
  const blockCentroid={};
  for(const s of segments){if(s.road)continue;const c=blockCentroid[s.block]??={sx:0,sy:0,n:0};c.sx+=s.x1+s.x2;c.sy+=s.y1+s.y2;c.n+=2;}
  const blockLabels=Object.entries(blockCentroid).map(([block,c])=>({block,x:c.sx/c.n,y:c.sy/c.n}));
  const labels=panel.labels.filter(l=>!l.hidden&&l.y<=800&&l.text.trim()).map(l=>({x:l.x,y:l.y,text:l.text.trim().replace(/</g,'‹').replace(/>/g,'›')}));
  return {viewBox:[20,130,2100,690],segments,legs,turnouts,signals:panel.micons.map(m=>({mast:m.mast,x:m.x,y:m.y})),labels,blockLabels,turntable:panel.turntable,crossings:Object.entries(panel.xings).map(([id,x])=>({id,cx:x.cx,cy:x.cy}))};
}
