// Read-only station inventory. Source evidence, active bindings and geometry are
// separate: neither a source comment nor a simulator report commissions hardware.
export const stationKinds={turnouts:'Växlar / växelobjekt',blocks:'Block',sensors:'Sensorer',signals:'Signaler',groups:'Växelgrupper',modules:'Modulreferenser'};
export function buildStationModel({index,panel,config}) {
  if(index.meta.sha256!==config.sourceHash)throw Error('Anläggningsprofilen och XML-underlaget har olika källversioner.');
  const objects=new Map(),edges=[],edgeKeys=new Set();
  const ensure=(kind,name)=>{const id=kind+':'+name;if(!objects.has(id))objects.set(id,{id,kind,name,sources:[],geometry:[],bindings:[],physicalVerified:false});return objects.get(id);};
  const connect=(a,b,label)=>{if(!objects.has(a)||!objects.has(b)||a===b)return;const key=[a,b,label].join('|');if(edgeKeys.has(key))return;edgeKeys.add(key);edges.push({from:a,to:b,label});};
  for(const r of index.records.filter(r=>['turnouts','blocks','sensors','signals'].includes(r.category))) {
    const o=ensure(r.category,r.name);o.sources.push({key:r.key,system:r.system,comment:r.comment,path:r.path});
    // This is a literal XML module reference, NOT a detected module identity.
    const module=/^(M\d+)-(\d+)-(\d+)(?:\s|$)/.exec(r.comment||'');
    if(module){const m=ensure('modules',module[1]);m.sources.push({key:r.key,system:r.system,comment:r.comment,path:r.path});o.moduleReference={name:m.name,base:Number(module[2]),channel:Number(module[3])};connect(o.id,m.id,'Modulreferens i XML');}
  }
  for(const kind of ['turnouts','blocks','signals'])for(const [name,b] of Object.entries(config[kind]||{})) {
    const o=ensure(kind,name);o.bindings.push({...b});
    o.bindingEvidence=b.provenance?.startsWith('Operator override')?'Lokal överstyrning · ej fysiskt verifierad':kind==='turnouts'&&o.sources.some(s=>s.system===b.source&&s.system==='LT'+b.address)?'Adress överensstämmer med XML · ej fysiskt verifierad':'Provbindning · ej fysiskt verifierad';
  }
  for(const b of panel.lblocks||[])if(b.sensor){ensure('blocks',b.user);ensure('sensors',b.sensor);connect('blocks:'+b.user,'sensors:'+b.sensor,'Beläggningssensor i XML');}
  for(const [name,b] of Object.entries(config.blocks||{}))if(b.sourceSensor){const sensor=ensure('sensors',b.sourceSensor);sensor.bindings.push({...b,block:name});connect('blocks:'+name,sensor.id,'Aktiv detektorbindning');}
  const segments=(panel.segs||[]).filter(s=>s.b!=='frame'&&Math.min(s.y1,s.y2)<850);
  for(const s of segments)if(s.b)ensure('blocks',s.b).geometry.push({type:'line',x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2});
  for(const t of Object.values(panel.turnouts||{})) {
    const o=ensure('turnouts',t.name);o.geometry.push({type:'point',x:t.cx,y:t.cy});
    for(const block of [t.block,t.blockb,t.blockc,t.blockd].filter(Boolean)){ensure('blocks',block);connect(o.id,'blocks:'+block,'Spåravsnitt vid växeln');}
  }
  for(const s of panel.micons||[])ensure('signals',s.mast).geometry.push({type:'point',x:s.x+12,y:s.y+8});
  for(const rule of config.manualPolicies?.rules||[])if(rule.names.length>1){
    const group=ensure('groups',rule.button);group.rule=rule;group.name=rule.names.map(n=>n.replace(/^Vx/,'')).join(' / ');
    for(const name of rule.names){const o=ensure('turnouts',name);group.geometry.push(...o.geometry);connect(group.id,o.id,'Ingår i källans knappgrupp');}
    for(const name of rule.blocks)connect(group.id,'blocks:'+name,'Manövervillkor: spåravsnitt');
    for(const name of rule.signals)connect(group.id,'signals:'+name,'Manövervillkor: signal');
  }
  for(const o of objects.values())if(o.kind==='modules')for(const edge of edges.filter(e=>e.to===o.id))o.geometry.push(...objects.get(edge.from).geometry);
  for(const o of objects.values())if(o.kind==='sensors')for(const edge of edges.filter(e=>e.to===o.id&&e.label==='Beläggningssensor i XML'))o.geometry.push(...objects.get(edge.from).geometry);
  return {schema:1,sourceHash:index.meta.sha256,bindingVersion:config.bindingVersion??0,objects:[...objects.values()],edges,segments,width:panel.w,height:850};
}
export function relatedStationObjects(model,id){return new Set([id,...model.edges.filter(e=>e.from===id||e.to===id).map(e=>e.from===id?e.to:e.from)]);}
export function stationLiveValue(object,state,online,staleMs) {
  if(!state||!online||state.connection!=='connected')return {text:'Ingen aktuell kontakt',tone:'unknown'};
  const fresh=r=>r&&Number.isFinite(r.updatedAt)&&r.updatedAt>0&&Number.isFinite(state.serverTime)&&state.serverTime>=r.updatedAt&&state.serverTime-r.updatedAt<=staleMs;
  if(object.kind==='sensors'){
    const values=object.bindings.map(b=>({b,r:state.blocks?.[b.block]}));
    if(!values.length)return {text:'Ingen aktiv återrapportbindning',tone:'unknown'};
    if(values.some(({r})=>!fresh(r)||typeof r.occupied!=='boolean'))return {text:'Okänd / inaktuell återrapport',tone:'unknown'};
    const active=values.map(({b,r})=>b.activeMeansOccupied?r.occupied:!r.occupied);
    if(active.some(v=>v!==active[0]))return {text:'Motstridiga återrapporter',tone:'unknown'};
    return {text:active[0]?'Rapporterad aktiv':'Rapporterad inaktiv',tone:active[0]?'active':'neutral',at:Math.min(...values.map(({r})=>r.updatedAt))};
  }
  const r=state[object.kind]?.[object.name];
  if(!fresh(r))return {text:object.bindings.length?'Okänd / inaktuell återrapport':'Ingen aktiv driftbindning',tone:'unknown'};
  if(object.kind==='turnouts')return {text:['C','T'].includes(r.position)?'Rapporterat läge '+r.position:'Okänt växelläge',tone:['C','T'].includes(r.position)?'neutral':'unknown',at:r.updatedAt};
  if(object.kind==='blocks')return {text:r.occupied===true?'Rapporterat belagt':r.occupied===false?'Rapporterat fritt':'Okänd beläggning',tone:r.occupied===true?'occupied':r.occupied===false?'neutral':'unknown',at:r.updatedAt};
  if(object.kind==='signals')return {text:r.aspect==='go'?'Rapporterat kör':r.aspect==='stop'?'Rapporterat stopp':'Okänt signalbesked',tone:r.aspect==='go'?'active':r.aspect==='stop'?'neutral':'unknown',at:r.updatedAt};
  return {text:'',tone:'neutral'};
}
