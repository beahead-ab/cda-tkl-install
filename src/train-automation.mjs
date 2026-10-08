// Automaten (0.75.0, bara i simuleringsläge): datorn är tågklarerare. Den lägger tågvägarna med samma begäran och
// samma förregling som operatören, aldrig förbi dem, och lämnar över vid allt oväntat.
//
// Genomgående tåg: ett tåg från Kungsfors eller Lekby fortsätter mot Vagnsta, ett från Vagnsta mot Kungsfors eller
// Lekby. När ett tåg står vid infartssignalen läggs infarten till ett ledigt spår som har en utfart åt rätt håll; när
// tåget stått på spåret DWELL_MS läggs utfarten. Vilket tåg som står var vet automaten ur tågspårningen.
// Spår där tågvägen inte kan lösas upp vid ankomst (målspårets detektor täcker en växel i vägen, spår 6 och 10) väljs
// inte, eftersom låsen då skulle ligga kvar.
export const DWELL_MS=30000;
const STAND_MS=2000,STEP_MS=2500;
const LINE_EDGES={A:['Au','An'],B:['Bu','Bn'],C:['Cu','Cn']};
const LIVE=new Set(['setting','establishing','clearing','active','traversing','cancelling']);
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
// Spårval med vänstertrafik: österut (mot Vagnsta) spår 1, helst 1b vid stationshuset; västerut spår 2, helst 2b.
// Därefter övriga spår. Ett spår som är belagt eller saknar utfart åt rätt håll hoppas över.
export const TRACK_ORDER={
  east:['htvSpIB','htvSpIC','htvSpIA','htvSpIIB','htvSpIIC','htvSpIIA','htvSpIIIA','htvSpIVA','htvSpVA','htvSpIIIB','htvSpIVB','htvSpVB'],
  west:['htvSpIIB','htvSpIIC','htvSpIIA','htvSpIB','htvSpIC','htvSpIA','htvSpIIIB','htvSpIVB','htvSpVB','htvSpIIIA','htvSpIVA','htvSpVA']};
// Ett tåg från väster (Kungsfors A, Lekby C) går mot Vagnsta (B); ett från Vagnsta växelvis mot Kungsfors och Lekby.
export function throughLine(origin,turn){return origin==='B'?(turn%2?'C':'A'):'B';}

export class TrainAutomation{
  constructor({profile,available,reason='',request,edgeBlock,log=()=>{},now=Date.now}){
    Object.assign(this,{profile,available,reason,request,edgeBlock,log,now});
    this.enabled=false;this.plans={};this.turn=0;this.lastAt=0;this.revision=0;this.last='';
    const main=profile.routes.filter(r=>r.kind==='main'&&!r.adminDisabled);
    // Spårknappen för blocket där en infart slutar (SIA → htvSpIA).
    this.trackOf={};for(const r of main)if(r.to.startsWith('htvSp'))this.trackOf[r.blocks.at(-1)]=r.to;
    const releasable=r=>{const last=r.blocks.at(-1),address=profile.blocks[last].address,final=new Set(r.blocks.filter(b=>profile.blocks[b].address===address));return !Object.keys(r.turnouts).some(n=>final.has(profile.turnouts[n]?.block));};
    this.arrivals=main.filter(r=>/^htv(Au|An|Bu|Bn|Cu|Cn)$/.test(r.from)&&r.to.startsWith('htvSp')&&releasable(r));
    this.departures=main.filter(r=>r.from.startsWith('htvSp')&&/^htv(Au|An|Bu|Bn|Cu|Cn)$/.test(r.to));
  }
  set(enabled){
    if(!this.available)fail(this.reason||'Automaten finns bara i simuleringsläge.');
    this.enabled=!!enabled;this.revision++;
    this.log('automation',this.enabled?'Automaten är på: datorn lägger tågvägarna. Du kan ta över när som helst.':'Automaten är av: du lägger tågvägarna.');
    return this.view();
  }
  handOver(reason){this.enabled=false;this.revision++;this.last=reason;this.log('automation','Automaten lämnar över: '+reason);}
  // state: kärnans läge (blocks, routes, controls, connected); trains: tågspårningens tåg; outgoing: normal utfart per linje.
  tick({state,trains=[],outgoing={}}){
    if(!this.enabled)return;
    const now=this.now();
    if(!state.connected)return this.handOver('ingen kontakt med banan.');
    if(state.controls?.stopAll)return this.handOver('AIS är aktiv.');
    if(state.controls?.emergency)return this.handOver('nödåtertagning pågår.');
    if(state.controls?.mode!=='local')return this.handOver('fjärrläge.');
    const held=state.routes.find(r=>['held','occupied'].includes(r.state));
    if(held)return this.handOver(`${held.label} hålls: ${held.reason}`);
    if(now-this.lastAt<STEP_MS)return;
    const live=state.routes.filter(r=>LIVE.has(r.state)),inRoute=b=>live.some(r=>r.blocks.includes(b)),from=new Set(live.map(r=>r.from));
    const free=b=>state.blocks[b]?.occupied===false,claimed=new Set(trains.flatMap(t=>t.blocks));
    const standing=trains.filter(t=>t.state==='station'&&now-t.movedAt>=STAND_MS&&!t.blocks.some(inRoute));
    for(const t of standing){
      // Vid kanten: bara ett tåg på linjens infartsspår som inte är på väg ut, och bara om ingen tågväg därifrån ligger.
      const origin=Object.entries(this.edgeBlock).find(([,b])=>b===t.head)?.[0];
      if(origin){if(origin!==outgoing[origin[0]]&&!this.plans[t.id]?.leaving&&!from.has('htv'+origin)&&this.arrive(t,origin,free,claimed))return;continue;}
      if(this.trackOf[t.head]&&!from.has(this.trackOf[t.head])&&now-t.movedAt>=DWELL_MS&&this.depart(t,outgoing,free))return;
    }
  }
  plan(t,origin){return this.plans[t.id]??=(origin?{origin:origin[0],line:throughLine(origin[0],this.turn++)}:{origin:'',line:'B'});}
  // Infart: ett ledigt spår som har en utfart mot tågets linje; först det som ligger i den ordning profilen har.
  arrive(t,edge,free,claimed){
    const plan=this.plan(t,edge),onward=to=>this.departures.some(d=>d.from===to&&LINE_EDGES[plan.line].includes(d.to.slice(3)));
    const order=TRACK_ORDER[plan.line==='B'?'east':'west'],rank=to=>{const i=order.indexOf(to);return i<0?order.length:i;};
    const options=this.arrivals.filter(r=>r.from==='htv'+edge&&r.blocks.slice(1).every(b=>free(b)&&!claimed.has(b))&&onward(r.to)).sort((a,b)=>rank(a.to)-rank(b.to));
    return this.try(options,t,r=>`Automaten lägger ${r.label} för tåg ${t.number||t.label}.`);
  }
  // Utfart: mot tågets linje, helst på linjens normala utfartsspår, när blocket vid kanten är fritt.
  depart(t,outgoing,free){
    const plan=this.plan(t,null),from=this.trackOf[t.head],edges=LINE_EDGES[plan.line];
    const options=this.departures.filter(r=>r.from===from&&edges.includes(r.to.slice(3))&&r.blocks.every(b=>b===t.head||free(b))&&free(this.edgeBlock[r.to.slice(3)]))
      .sort((a,b)=>(b.to.slice(3)===outgoing[plan.line])-(a.to.slice(3)===outgoing[plan.line]));
    const done=this.try(options,t,r=>`Automaten lägger ${r.label} för tåg ${t.number||t.label}.`);if(done)plan.leaving=true;return done;
  }
  // Begäran går genom kärnan som operatörens; avböjs den (konflikt, spärr) prövas nästa.
  try(options,t,text){
    const tried=new Set();
    for(const r of options){
      const key=r.from+'>'+r.to;if(tried.has(key))continue;tried.add(key);
      try{this.request(r.from,r.to);this.lastAt=this.now();this.last=text(r);this.revision++;this.log('automation',this.last);return true;}catch{}
    }
    return false;
  }
  view(){return {available:this.available,reason:this.available?'':this.reason,enabled:this.enabled,last:this.last};}
}
