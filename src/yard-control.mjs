// The ranger's requests (docs/rangerlage.md). The ranger owns a yard area and lays
// its turnouts freely; everything else is TKL's. A request names a turnout group
// from the profile: the ranger asks, TKL approves, and the kernel lays the group.
// While it lies out the group is locked for TKL, and the ranger may lay it back
// (the boundaries' isolating positions) but never out again. Requests are durable
// software state in the kernel, never a fabricated field report; a future ranger
// client submits them through this kernel, never directly to the decoders.
import { randomUUID } from 'node:crypto';
import { forbidReason } from './studio/rules.mjs';
const STATES=['open','laid'];
export class YardControl {
  constructor(engine){
    this.e=engine;this.def=engine.profile.yardArea||null;this.groups=engine.profile.rangerRequests||[];
    const saved=engine.controls.yard;
    // Older state carried the handover owner; the request model replaces it.
    if(!saved||'owner' in saved){
      if(saved?.owner==='ranger')throw Error('Rangerbangården är överlämnad i en äldre version. Återta den där före uppdateringen.');
      engine.controls.yard={requests:[]};
    }
    const requests=engine.controls.yard.requests;
    if(!Array.isArray(requests)||requests.some(r=>typeof r?.id!=='string'||!STATES.includes(r.state)||!this.group(r.group)||!Number.isFinite(r.requestedAt)))throw Error('Sparade rangerbegäran stämmer inte med profilen. Kontrollera före start.');
    if(requests.some(r=>r.state==='laid')&&engine.controls.yard.fingerprint!==engine.fingerprint)throw Error('Profilen har ändrats medan en rangerbegäran ligger ute. Återställ profilen före start.');
  }
  get requests(){return this.e.controls.yard.requests;}
  group(id){return this.groups.find(g=>g.id===id)||null;}
  find(id){return this.requests.find(r=>r.id===id)||null;}
  // The laid request whose group lays this turnout, if any.
  laid(name){return this.requests.find(r=>r.state==='laid'&&Object.hasOwn(this.group(r.group).out,name))||null;}
  label(r){return this.group(r.group).label;}
  manualReason(names,operator){
    for(const name of names){
      const r=this.laid(name);
      if(r)return `${this.label(r)} ligger ute för rangeraren. ${operator==='ranger'?'Lägg tillbaka den i stället.':'Dra tillbaka den först.'}`;
      if(operator==='ranger'&&!this.def?.turnouts.includes(name)&&!this.e.profile.yardBoundaries?.[name])return 'Växeln tillhör TKL:s område.';
    }
    return null;
  }
  // A laid group is the ranger's: TKL's routes over any of its turnouts wait, even an
  // alternative path that happens to want the same positions. The ranger's own shunt
  // routes (a later step) may run over the group as it lies.
  routeReason(route,operator='tkl'){
    for(const [name,position] of Object.entries(route.turnouts||{})){
      const r=this.laid(name);
      if(r&&(operator!=='ranger'||this.group(r.group).out[name]!==position))return `${this.label(r)} ligger ute för rangeraren. Vänta tills den är tillbaka.`;
    }
    if(operator==='ranger')return this.rangerRouteReason(route);
    return null;
  }
  // The ranger's own shunt routes: inside the area (own turnouts, boundaries in their back
  // position) or over a request group as it lies. Anything else names the request to make.
  rangerRouteReason(route){
    if(route.kind!=='shunt')return 'Rangeraren lägger bara växeltågvägar.';
    const boundaries=this.e.profile.yardBoundaries||{};
    for(const [name,position] of Object.entries(route.turnouts||{})){
      if(this.def?.turnouts.includes(name))continue;
      if(boundaries[name]?.rangerPositions.includes(position))continue;
      const laid=this.laid(name);
      if(laid&&this.group(laid.group).out[name]===position)continue;
      const group=this.groups.find(g=>g.out[name]===position);
      return group?`Växeltågvägen kräver begäran ${group.label}.`:`Växeltågvägen går utanför rangerarens område (${name}).`;
    }
    return null;
  }
  // What the ranger is told before anything is sent to TKL. A route over the group
  // is the clearest case: no request is made, the answer is immediate.
  requestStatus(id,{renew=null}={}){
    const e=this.e,group=this.group(id),deny=reason=>({allowed:false,reason});
    if(!group)return deny('Okänd begäran.');
    if(!e.connected||e.storageFault)return deny(e.storageFault?'Lagringsfel; manövrering spärrad.':'Ingen LocoNet-anslutning.');
    if(e.controls.mode!=='local')return deny('Fjärrläge: begäran är spärrad.');
    if(e.controls.stopAll)return deny('Alla signaler i stopp är aktiverat.');
    for(const other of this.requests){
      if(other===renew)continue;
      const shared=Object.keys(this.group(other.group).out).filter(n=>Object.hasOwn(group.out,n));
      if(other.group===id)return deny(other.state==='laid'?`${group.label} ligger redan ute.`:`${group.label} är redan begärd.`);
      if(shared.length)return deny(`${this.label(other)} ${other.state==='laid'?'ligger ute':'är begärd'}; lägg tillbaka den först.`);
    }
    const names=Object.keys(group.out).flatMap(n=>e.profile.coupled?.[n]||[n]);
    for(const route of e.routes){const hit=names.find(n=>Object.hasOwn(route.turnouts,n));if(hit)return deny(`Går inte att lägga: tågväg ${route.label} ligger över ${hit}.`);}
    const forbidden=forbidReason(e.profile.rules,{...e.knownPositions(),...group.out});if(forbidden)return deny(forbidden);
    for(const [name,position] of Object.entries(group.out)){
      if(e.turnoutConfirmed(name,position))continue;
      const condition=e.manualStatus(name,'tkl',{kernel:true});
      if(!condition.allowed)return deny(`${name} kan inte läggas: ${condition.reason}`);
    }
    return {allowed:true,reason:'Växlarna är fria. TKL avgör.'};
  }
  request(id){
    const check=this.requestStatus(id);if(!check.allowed)throw Error(check.reason);
    const group=this.group(id),request={id:randomUUID(),group:id,state:'open',requestedAt:this.e.now()};
    this.save([...this.requests,request]);
    this.e.log('ranger-request',`Rangeraren begär ${group.label}.`,{request:request.id});
    return request;
  }
  answer(id,approved){
    const request=this.find(id);if(!request||request.state!=='open')throw Error('Begäran finns inte längre.');
    const group=this.group(request.group);
    if(approved!==true){
      this.save(this.requests.filter(r=>r!==request));
      this.e.log('ranger-denied',`${group.label} nekad av TKL.`,{request:id});return request;
    }
    const check=this.requestStatus(group.id,{renew:request});if(!check.allowed)throw Error(check.reason);
    // The lock is durable before any order; the group is then laid like a manual move.
    this.save(this.requests.map(r=>r===request?{...r,state:'laid',approvedAt:this.e.now()}:r));
    this.lay(group.out);
    this.e.log('ranger-approved',`${group.label} godkänd av TKL. Växlarna läggs.`,{request:id});
    return this.find(id);
  }
  // The ranger lays the group back; TKL may withdraw it the same way. An open request is
  // simply taken back by whoever ends it.
  return(id,operator='ranger'){
    const request=this.find(id);if(!request)throw Error('Begäran finns inte längre.');
    if(request.state==='open'){
      this.save(this.requests.filter(r=>r!==request));
      this.e.log(operator==='ranger'?'ranger-withdrawn':'ranger-denied',operator==='ranger'?`${this.label(request)} återkallad av rangeraren.`:`${this.label(request)} nekad av TKL.`,{request:id});
      return request;
    }
    const e=this.e,group=this.group(request.group);
    if(!e.connected||e.storageFault)throw Error(e.storageFault?'Lagringsfel; manövrering spärrad.':'Ingen LocoNet-anslutning.');
    if(e.controls.stopAll)throw Error('Alla signaler i stopp är aktiverat.');
    const names=Object.keys(group.back).flatMap(n=>e.profile.coupled?.[n]||[n]);
    for(const route of e.routes){const hit=names.find(n=>Object.hasOwn(route.turnouts,n));if(hit)throw Error(`Återta tågväg ${route.label} över ${hit} först.`);}
    for(const [name,position] of Object.entries(group.back)){
      if(e.turnoutConfirmed(name,position))continue;
      const condition=e.manualStatus(name,'tkl',{kernel:true});
      if(!condition.allowed)throw Error(`${name} kan inte läggas tillbaka: ${condition.reason}`);
    }
    this.save(this.requests.filter(r=>r!==request));
    this.lay(group.back);
    this.e.log(operator==='ranger'?'ranger-returned':'ranger-withdrawn',operator==='ranger'?`${group.label} lagd tillbaka av rangeraren.`:`${group.label} dragen tillbaka av TKL.`,{request:id});
    return request;
  }
  lay(positions){
    for(const [name,position] of Object.entries(positions))for(const n of this.e.profile.coupled?.[name]||[name])if(!this.e.turnoutConfirmed(n,position))this.e.turnoutOrder(n,position);
  }
  save(requests){
    const previous=this.e.controls.yard;
    this.e.controls.yard={requests,...(requests.some(r=>r.state==='laid')?{fingerprint:this.e.fingerprint}:{})};
    try{this.e.persistControls();}catch(error){this.e.controls.yard=previous;throw error;}
    this.e.operating.revision++;
  }
  // An open request a route has since been laid over is answered for TKL: the
  // ranger learns at once instead of waiting for a click that cannot succeed.
  tick(){
    for(const request of [...this.requests]){
      if(request.state!=='open')continue;
      const names=Object.keys(this.group(request.group).out).flatMap(n=>this.e.profile.coupled?.[n]||[n]);
      const route=this.e.routes.find(r=>names.some(n=>Object.hasOwn(r.turnouts,n)));
      if(!route)continue;
      try{this.save(this.requests.filter(r=>r!==request));}catch{return;}
      this.e.log('ranger-denied',`${this.label(request)} kan inte läggas: tågväg ${route.label} ligger.`,{request:request.id});
    }
  }
  snapshot(){
    if(!this.def)return null;
    return {own:this.def.turnouts,boundaries:this.def.boundaries,
      groups:this.groups.map(g=>{const r=this.requests.find(r=>r.group===g.id)||null;return {id:g.id,label:g.label,side:g.side,track:g.track||null,out:g.out,back:g.back,state:r?r.state:'idle',request:r,can:r?null:this.requestStatus(g.id)};}),
      requests:this.requests.map(r=>({...r,label:this.label(r)}))};
  }
}
