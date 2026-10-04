import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {readTimetable} from './trainmeet-timetable.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(v,max=200)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const identity=(v)=>text(v,128)&&v.length>0;
const validClientId=v=>typeof v==='string'&&/^[A-Za-z0-9._:-]{3,64}$/.test(v);
// TrainMeet shows a code as 123-456 but compares letters and digits only, case-insensitively.
const pairingCode=v=>typeof v==='string'?v.toUpperCase().replace(/[^\p{L}\p{N}]/gu,''):'';
// Plain HTTP is accepted only where a TMBox would use it: the meet's own network.
// Loopback, private and link-local addresses and mDNS names qualify; a public
// address or name must use HTTPS.
export function localNetwork(hostname){
  const h=String(hostname||'').toLowerCase();
  if(['127.0.0.1','localhost','[::1]'].includes(h)||h.endsWith('.local'))return true;
  const v4=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if(v4){const [a,b]=v4.slice(1).map(Number);return a===10||a===127||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);}
  if(h.startsWith('['))return /^\[(f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/.test(h);
  return false;
}
function serverOrigin(value) {
  if(value==='')return '';
  if(!text(value,512))fail('Ange en giltig TrainMeet-adress.');
  let u;try{u=new URL(value.trim());}catch{fail('Ange hela serveradressen, till exempel https://trainmeet.example.');}
  if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.protocol!=='https:'&&!(u.protocol==='http:'&&localNetwork(u.hostname)))fail('TrainMeet kräver HTTPS, eller HTTP bara på det lokala nätet (privat adress eller .local-namn).');
  return u.origin;
}

const LINE_STATES=new Set(['free','requested','reserved','occupied']);
export const CLEARANCE_ACTIONS=['request','accept','reject','cancel','depart','arrive'];
const CLEARANCE_JOURNAL={request:'begärd',accept:'godkänd',reject:'nekad',cancel:'återtagen',depart:'avgång anmäld',arrive:'mottaget anmält'};
// The clearance steps this station may take for a line, mirroring the server's
// transitions so the panel offers only sensible buttons. The server decides.
export function lineActions(state,direction){
  if(state==='free')return ['request'];
  if(state==='requested')return direction==='out'?['cancel']:direction==='in'?['accept','reject']:[];
  if(state==='reserved')return direction==='out'?['depart','cancel']:[];
  if(state==='occupied')return direction==='in'?['arrive']:[];
  return [];
}
// Direction of each movement at the station, read from the service stop lists:
// the stop before and after this station on the same service. Auxiliary data,
// so a malformed row is skipped rather than failing the whole read.
export function routeDirections(routes,trains,station){
  const result={};if(!Array.isArray(routes)||!Array.isArray(trains)||routes.length>50000)return result;
  const byService=new Map();
  for(const r of routes){if(!record(r)||!identity(r.service_id)||!identity(r.station_id)||!Number.isFinite(r.stop_order))continue;if(!byService.has(r.service_id))byService.set(r.service_id,[]);byService.get(r.service_id).push(r);}
  for(const stops of byService.values())stops.sort((a,b)=>a.stop_order-b.stop_order);
  for(const t of trains){
    if(!record(t)||t.station_id!==station||!identity(t.id)||!identity(t.service_id))continue;
    const stops=byService.get(t.service_id)||[],here=stops.map((s,i)=>[s,i]).filter(([s])=>s.station_id===station);
    const hit=here.find(([s])=>(s.departure_time??null)===(t.departure_time??null)&&(s.arrival_time??null)===(t.arrival_time??null))||(here.length===1?here[0]:null);
    if(!hit)continue;const i=hit[1];let p=i,n=i;
    while(p>0&&stops[p-1].station_id===station)p--;while(n<stops.length-1&&stops[n+1].station_id===station)n++;
    const from=stops[p-1]?.station_id||'',to=stops[n+1]?.station_id||'';
    if(!text(from,128)||!text(to,128))continue;
    result[t.id]={from,to};if(text(t.train_number)&&t.train_number&&!result['#'+t.train_number])result['#'+t.train_number]={from,to};
  }
  return result;
}
// Lines of this station: static catalogue from the display joined with the
// live state from the station context. Unknown or missing states stay unknown.
const NEIGHBOR_MODES=new Set(['automatic','manual','disconnected']);
function readLines(display,context,station,names,codes){
  const catalogue=display.connections??[];
  if(!Array.isArray(catalogue)||catalogue.length>5000)fail('Ogiltig sträckkatalog från TrainMeet.',503);
  const live=new Map();
  for(const c of context.connection_states){
    const from=c.from_station_id==null?'':c.from_station_id,to=c.to_station_id==null?'':c.to_station_id;
    if(!text(from,128)||!text(to,128))fail('Ogiltigt förbindelseläge.',503);
    live.set(c.id,{state:LINE_STATES.has(c.state)?c.state:'unknown',from,to,trainNumber:text(c.train_number)?c.train_number:''});
  }
  // Who answers at the other end (TrainMeet Server 2.6+): automatic, manual or disconnected.
  const modes=record(context.station_modes)?context.station_modes:{};
  return catalogue.filter(c=>record(c)&&(c.station_a_id===station||c.station_b_id===station)).map(c=>{
    if(!identity(c.id)||!identity(c.station_a_id)||!identity(c.station_b_id))fail('Ogiltig sträcka från TrainMeet.',503);
    const neighborId=c.station_a_id===station?c.station_b_id:c.station_a_id,s=live.get(c.id);
    const state=s?s.state:'unknown',direction=!s||state==='free'?'':s.from===station?'out':s.to===station?'in':'';
    const neighborMode=NEIGHBOR_MODES.has(modes[neighborId])?modes[neighborId]:'';
    return {id:c.id,neighborId,neighborMode,neighborName:names.get(neighborId)||neighborId,neighborCode:codes.get(neighborId)||'',trackType:text(c.track_type,32)?c.track_type:'',state,direction,from:s?.from||'',to:s?.to||'',trainNumber:s?.trainNumber||'',actions:lineActions(state,direction)};
  });
}

// HTTP-v1 adapter for the reviewed TrainMeet contract: it reads the station
// context and acts as a TKL terminal for clearances and movements, the same station
// commands a TMBox uses. Like an assigned box it is in service while paired: no
// traffic shift is started. It deliberately has no reference to Engine, Field or
// detector state: a clearance is never a route, a lock or a signal aspect.
export class TrainMeet extends EventEmitter {
  constructor({storage,origin='',fetcher=fetch,now=Date.now,changeFeed=true}) {
    super();this.storage=storage;this.fetcher=fetcher;this.now=now;this.changeFeed=changeFeed;this.feed=null;this.feedRetryAt=0;this.urgent=false;this.sessionId=randomUUID();this.revision=0;this.busy=false;this.current=null;this.lastAttempt=0;this.context=null;this.status='unconfigured';this.error='';this.updatedAt=0;
    this.origin=serverOrigin(origin);this.originLocked=!!origin;
    this.data=storage.load('trainmeet.json',{version:1,clientId:'cda-tkl',stationId:'',token:'',origin:this.origin,pairings:{}});
    // One saved pairing per server, each key bound to its own origin. Older files hold only the active one.
    const pairings=this.data.pairings??(this.data.token&&text(this.data.origin,512)?{[this.data.origin]:{stationId:this.data.stationId,token:this.data.token}}:{});
    if(!record(pairings)||Object.entries(pairings).some(([o,p])=>!text(o,512)||!record(p)||!text(p.stationId,128)||!text(p.token,4096)||!p.token))throw Error('Ogiltig sparad TrainMeet-anslutning.');
    this.data={...this.data,pairings:Object.fromEntries(Object.entries(pairings).map(([o,p])=>[o,{stationId:p.stationId,token:p.token}]))};
    // Older files carry a shift operator name; there are no shifts any more.
    {const {autoShift:_auto,operatorName:_name,...rest}=this.data;this.data=rest;}
    if(this.data.version!==1||!validClientId(this.data.clientId)||!text(this.data.stationId,128)||!text(this.data.token,4096)||!text(this.data.origin,512))throw Error('Ogiltig sparad TrainMeet-anslutning.');
    if(this.origin&&this.data.token&&this.data.origin!==this.origin)throw Error('TrainMeet-adressen har ändrats. Flytta inte en gammal parkopplingsnyckel till en annan server.');
    if(!this.origin)this.origin=serverOrigin(this.data.origin);
    if(this.origin)this.status=this.data.token?'disconnected':'unpaired';
  }
  view(){return {sessionId:this.sessionId,revision:this.revision,origin:this.origin,originLocked:this.originLocked,clientId:this.data.clientId,status:this.status,busy:this.busy,paired:!!this.data.token,stationId:this.data.stationId,error:this.error,updatedAt:this.updatedAt,stale:this.status!=='connected'||this.now()-this.updatedAt>15000,contract:'TrainMeet HTTP v1 · TKL-terminal',savedServers:Object.entries(this.data.pairings).map(([origin,p])=>({origin,stationId:p.stationId})),context:this.context,
    // How old the clock reading is now; the panel runs the meet clock on from there.
    clockAgeMs:Number.isFinite(this.context?.clock?.readAt)?Math.max(0,this.now()-this.context.clock.readAt):null};}
  check(data){if(data.sessionId!==this.sessionId||data.revision!==this.revision)fail('TrainMeet-anslutningen har ändrats. Läs in senaste läget.',409);if(this.busy)fail('En TrainMeet-begäran pågår.',409);}
  // Switching server keeps the pairing of the server left behind and resumes a
  // saved pairing for the server chosen; a key is only ever sent to its own origin.
  configure(data){
    this.check(data);
    const origin=serverOrigin(data.origin);
    if(this.originLocked&&origin!==this.origin)fail('Den här installationen använder en fast TrainMeet-adress.',409);
    const clientId=data.clientId===undefined?this.data.clientId:typeof data.clientId==='string'?data.clientId.trim():data.clientId;
    if(!validClientId(clientId))fail('TKL-id ska ha 3–64 tecken: bokstäver a–z, siffror, punkt, bindestreck, understreck eller kolon.');
    if(clientId!==this.data.clientId&&(this.data.token||Object.keys(this.data.pairings).length))fail('Koppla från alla servrar innan TKL-id ändras.',409);
    const saved=origin?this.data.pairings[origin]:null;
    const next={...this.data,origin,clientId,stationId:saved?saved.stationId:'',token:saved?saved.token:''};
    try{this.storage.save('trainmeet.json',next);}catch{fail('Anslutningen kunde inte sparas. Den tidigare inställningen är kvar.',507);}
    this.data=next;this.origin=origin;this.context=null;this.updatedAt=0;this.lastAttempt=0;this.status=!origin?'unconfigured':saved?'disconnected':'unpaired';this.error='';this.revision++;this.emit('change');return this.view();
  }
  async request(path,{token='',payload,denied=null}={}) {
    if(!this.origin)fail('TrainMeet-server är inte angiven för den här installationen.');
    const response=await this.fetcher(this.origin+path,{method:payload?'POST':'GET',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(payload?{'Content-Type':'application/json'}:{})},body:payload?JSON.stringify(payload):undefined,redirect:'error',signal:AbortSignal.timeout(8000)});
    if(Number(response.headers.get('content-length'))>2000000)fail('TrainMeet-svaret är för stort.',503);
    let total=0,chunks=[];for await(const part of response.body){total+=part.length;if(total>2000000)fail('TrainMeet-svaret är för stort.',503);chunks.push(part);}
    const raw=Buffer.concat(chunks).toString();
    if(!response.ok){
      // The server explains refused actions in plain language; pass that on
      // unchanged, but never a body that is not a short JSON message.
      let detail='';try{const body=JSON.parse(raw);if(record(body)&&text(body.message,300)&&body.message.trim())detail=body.message;
        // Servers before the shift-free TKL contract refuse steps without a traffic shift.
        if(record(body)&&body.error==='tkl_shift_not_started')detail='TrainMeet-servern är för gammal: den kräver trafikpass. Uppdatera TrainMeet Server.';}catch{}
      // Refusals answer 409 and upstream failures 503, never 502 or 504: the public
      // address sits behind Cloudflare, which swaps those two for its own HTML page
      // and the operator would never see the explanation.
      if(response.status===401||response.status===403)fail(denied?(detail?detail.trim().replace(/[.!]?$/,'.'):denied.summary)+' '+denied.hint:detail||'Parkoppling eller stationsbehörighet saknas hos TrainMeet.',409);
      if(detail&&response.status<500)fail(detail,409);
      fail('TrainMeet svarade med fel '+response.status+'.',503);
    }
    return JSON.parse(raw);
  }
  async read(token=this.data.token,station=this.data.stationId,allowReset=false,reloadTimetable=false) {
    const context=await this.request('/v1/tkl/context?station_id='+encodeURIComponent(station),{token});
    // The clock in the answer was read somewhere during the request; the middle is the best guess.
    const asked=this.now(),display=await this.request('/v1/display',{token}),readAt=Math.round((asked+this.now())/2);
    if(context?.protocol_version!==1||display?.protocol_version!==1||!identity(context.publication_id)||context.publication_id!==display.publication_id||!identity(context.active_day)||context.active_day!==display.active_day||context.station?.id!==station||!record(context.movements)||!Array.isArray(context.connection_states)||!Array.isArray(display.trains)||!Number.isSafeInteger(display.revision)||display.revision<0)fail('TrainMeet-svaret följer inte det granskade kontraktet.',503);
    if(!allowReset&&this.context?.publicationId===display.publication_id&&this.context.day===display.active_day&&display.revision<this.context.revision)fail('TrainMeet skickade en äldre revision. Kontrollera serverbytet och parkoppla på nytt.',503);
    const stations=display.stations??[];
    if(!Array.isArray(stations)||stations.length>5000||stations.some(s=>!record(s)||!identity(s.id)||!text(s.name,200)||!s.name.trim()||s.code!=null&&!text(String(s.code),12))||new Set(stations.map(s=>s.id)).size!==stations.length)fail('Ogiltig stationskatalog från TrainMeet.',503);
    const clock=display.clock;
    if(!record(clock)||typeof clock.configured!=='boolean'||typeof clock.running!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(clock.time)||!Number.isFinite(clock.speed)||clock.speed<=0||clock.speed>1000)fail('TrainMeet-klockan kunde inte verifieras.',503);
    const trains=display.trains.filter(t=>t.station_id===station).map(t=>{if(!identity(t.id))fail('Tågrörelse saknar identitet.',503);const result={id:t.id};for(const k of ['train_number','arrival_time','departure_time','track','train_type','arrival_from','departure_to','track_id'])if(t[k]!=null){const value=String(t[k]);if(!text(value))fail('Ogiltig tåginformation.',503);result[k]=value;}return result;});
    if(new Set(trains.map(t=>t.id)).size!==trains.length)fail('TrainMeet skickade dubbla rörelseidentiteter.',503);
    const movements=Object.entries(context.movements).map(([id,m])=>{if(!identity(id)||!record(m)||!Number.isSafeInteger(m.revision)||m.revision<0)fail('Driftpost saknar identitet eller revision.',503);return {id,revision:m.revision,arrival:text(m.arrival)?m.arrival:'',departure:text(m.departure)?m.departure:'',track:text(m.actualTrack)?m.actualTrack:'',crewReady:m.crewReady===true,note:text(m.operatorNote)?m.operatorNote:''};});
    if(!allowReset&&this.context?.publicationId===display.publication_id&&this.context.day===display.active_day)for(const m of movements){const previous=this.context.movements.find(p=>p.id===m.id);if(previous&&m.revision<previous.revision)fail('TrainMeet skickade en äldre driftrevision. Kontrollera serverbytet.',503);}
    const connections=context.connection_states.map(c=>{if(!identity(c.id)||!text(c.state))fail('Ogiltigt förbindelseläge.',503);return {id:c.id,state:c.state,trainNumber:text(c.train_number)?c.train_number:''};});
    const lines=readLines(display,context,station,new Map(stations.map(s=>[s.id,s.name])),new Map(stations.map(s=>[s.id,s.code==null?'':String(s.code)])));
    const directions=routeDirections(display.routes,display.trains,station);
    // Publications are immutable. Refresh dynamic data every poll and reload the
    // timetable on publication/day/station changes or an explicit refresh.
    const previous=this.context;
    const cached=!allowReset&&!reloadTimetable&&previous?.timetable&&previous.publicationId===display.publication_id&&previous.day===display.active_day&&previous.station.id===station;
    const timetable=cached?{trains:previous.trains,tracks:previous.tracks,operatingPoints:previous.operatingPoints,timetable:previous.timetable}
      :readTimetable(await this.request('/v1/timetable?station_id='+encodeURIComponent(station),{token}),{stationId:station,publicationId:display.publication_id,day:display.active_day,loadedAt:this.now()});
    return {stations:stations.map(s=>({id:s.id,name:s.name,code:s.code==null?'':String(s.code)})),publicationId:display.publication_id,revision:display.revision,day:display.active_day,meet:text(display.meet?.name)?display.meet.name:'',station:{id:station,name:text(context.station.name)?context.station.name:station},clock:{time:clock.time,rate:clock.speed,running:clock.running,configured:clock.configured,readAt},...timetable,movements,connections,lines,directions};
  }
  // One TrainMeet exchange at a time, so a poll and an action never interleave
  // their writes to the last good context.
  async exclusive(work){
    while(this.busy){if(!this.current)fail('En TrainMeet-begäran pågår.',409);await this.current.catch(()=>{});}
    this.busy=true;this.emit('change');
    this.current=(async()=>{try{return await work();}finally{this.busy=false;this.current=null;this.emit('change');}})();
    return this.current;
  }
  // The meet's station list, read without credentials from the public display, so
  // the operator picks a station instead of typing its id.
  async stations(){
    if(!this.origin)fail('TrainMeet-server är inte angiven för den här installationen.');
    let display;try{display=await this.request('/v1/display');}catch(e){if(e.status)throw e;fail('TrainMeet svarar inte. Stationslistan kunde inte hämtas.',503);}
    const stations=display?.stations;
    if(display?.protocol_version!==1||!Array.isArray(stations)||stations.length>5000||stations.some(s=>!record(s)||!identity(s.id)||!text(s.name,200)||s.code!=null&&!text(String(s.code),12)))fail('TrainMeet lämnade ingen giltig stationslista.',503);
    return {origin:this.origin,meet:text(display.meet?.name)?display.meet.name:'',stations:stations.map(s=>({id:s.id,name:s.name,code:s.code==null?'':String(s.code)}))};
  }
  async pair(data) {
    this.check(data);if(!identity(data.stationId)||!text(data.code,128)||!pairingCode(data.code))fail('Ange stations-id och giltig anslutningskod.');
    await this.exclusive(async()=>{
      try {
        const response=await this.request('/v1/pair',{payload:{pairing_code:pairingCode(data.code),client_id:this.data.clientId,display_name:this.data.clientId,device_kind:'tkl_terminal'},denied:{summary:'TrainMeet godkände inte anslutningskoden.',hint:'Hämta en aktuell kod under Skärmar → Visa anslutningsuppgifter i TrainMeet.'}});
        if(response?.protocol_version!==1||response.client_id!==this.data.clientId||!text(response.access_token,4096)||!response.access_token)fail('TrainMeet lämnade ingen giltig parkopplingsnyckel.',503);
        const context=await this.read(response.access_token,data.stationId,true);
        const next={version:1,clientId:this.data.clientId,stationId:data.stationId,token:response.access_token,origin:this.origin,pairings:{...this.data.pairings,[this.origin]:{stationId:data.stationId,token:response.access_token}}};
        this.storage.save('trainmeet.json',next);this.data=next;this.context=context;this.status='connected';this.updatedAt=this.now();this.error='';this.revision++;
      }catch(e){this.status=this.data.token?'disconnected':'unpaired';this.error=e.status?e.message:'TrainMeet kunde inte anslutas. Kontrollera adress, kod och server.';throw Object.assign(Error(this.error),{status:e.status===409?409:503});}
    });
    return this.view();
  }
  // What a poll shows to have happened at TrainMeet becomes a journal row: a
  // neighbour's announcement, an arrival, a departure. Nothing is sent; our own
  // commands journal themselves when they are made.
  journalTransitions(previous,next){
    if(!previous||!next||previous.station?.id!==next.station?.id||previous.publicationId!==next.publicationId)return;
    const trains=new Map(next.trains.map(t=>[t.train_number,t])),lines=new Map(previous.lines.map(l=>[l.id,l]));
    for(const line of next.lines){
      const old=lines.get(line.id);
      if(old&&line.state==='requested'&&line.direction==='in'&&(old.state!=='requested'||old.trainNumber!==line.trainNumber)){
        const planned=line.trainNumber?trains.get(line.trainNumber):null;
        this.emit('journal','Tåganmälan '+(line.trainNumber||'utan tågnummer')+' från '+line.neighborName+(planned?.arrival_time?' · väntad '+planned.arrival_time:'')+'.');
      }
    }
    const movements=new Map(previous.movements.map(m=>[m.id,m]));
    for(const m of next.movements){
      const old=movements.get(m.id),train=next.trains.find(t=>t.id===m.id);if(!train)continue;
      if(m.arrival==='arrived'&&old?.arrival!=='arrived')this.emit('journal','Tåg '+train.train_number+' ankommit'+(train.track?' spår '+train.track:'')+'.');
      if(m.departure==='departed'&&old?.departure!=='departed')this.emit('journal','Tåg '+train.train_number+' avgått'+(train.departure_to?' mot '+train.departure_to:'')+'.');
    }
  }
  async refresh(data) {
    if(data)this.check(data);if(this.busy||!this.origin||!this.data.token)return this.view();this.lastAttempt=this.now();
    await this.exclusive(async()=>{
      try{const next=await this.read(this.data.token,this.data.stationId,false,!!data);this.journalTransitions(this.context,next);this.context=next;this.updatedAt=this.now();this.status='connected';this.error='';}
      catch(e){this.status='disconnected';this.error=e.status?e.message:'TrainMeet svarar inte. Senaste uppgifter visas som gamla.';}
    });
    return this.view();
  }
  // A station command: post it, then read the authoritative context back before
  // answering, whether the server accepted it or not. The panel never applies an
  // action locally; it shows what TrainMeet says happened.
  async command(data,build){
    if(!record(data))fail('Ogiltig TrainMeet-begäran.');
    if(data.sessionId!==this.sessionId||data.revision!==this.revision)fail('TrainMeet-anslutningen har ändrats. Läs in senaste läget.',409);
    if(!this.origin||!this.data.token)fail('Parkoppla med TrainMeet innan stationen manövreras.',409);
    return this.exclusive(async()=>{
      // Validate against the freshest context, after any poll in flight has finished.
      const {path,payload,journal,after}=build(this.context||{});
      let failure=null;
      try{await this.request(path,{token:this.data.token,payload});}
      catch(e){failure=e.status?e:Object.assign(Error('TrainMeet kunde inte nås. Åtgärden är inte utförd.'),{status:503});}
      try{const fresh=await this.read(this.data.token,this.data.stationId);this.journalTransitions(this.context,fresh);this.context=fresh;this.updatedAt=this.now();this.status='connected';this.error='';}
      catch(e){this.status='disconnected';this.error=e.status?e.message:'TrainMeet svarar inte. Senaste uppgifter visas som gamla.';}
      if(failure)throw failure;
      after?.();
      if(journal)this.emit('journal',journal);
      return this.view();
    });
  }
  async clearance(data){
    const action=data?.action,trainNumber=typeof data?.trainNumber==='string'?data.trainNumber.trim():'';
    if(!CLEARANCE_ACTIONS.includes(action))fail('Okänd klareringsåtgärd.');
    if(action==='request'&&!/^\d{1,10}$/.test(trainNumber))fail('Ange tågnumret med siffror.');
    return this.command(data,context=>{
      const line=(context.lines||[]).find(l=>l.id===data.connectionId);
      if(!line)fail('Sträckan hör inte till stationen.',409);
      const number=action==='request'?trainNumber:line.trainNumber;
      return {path:'/v1/tkl/clearance',payload:{station_id:this.data.stationId,connection_id:line.id,action,train_number:action==='request'?trainNumber:''},journal:`Klarering ${CLEARANCE_JOURNAL[action]}${number?' · tåg '+number:''} · ${line.neighborName}.`};
    });
  }
  // Movement declarations, the TMBox steps for one train: uppställt, förare på
  // plats, närmar sig, ankommit and an actual track. Unchanged fields are sent
  // with their current values so neither server path resets them.
  async movement(data){
    const movementId=typeof data?.movementId==='string'?data.movementId:'';
    const departure=data?.departure==null?'':data.departure,arrival=data?.arrival==null?'':data.arrival,track=data?.actualTrack==null?'':data.actualTrack;
    if(!identity(movementId))fail('Ange vilken tågrörelse som avses.');
    if(departure&&!['positioned','ready','departed'].includes(departure))fail('Okänt avgångsläge.');
    if(arrival&&!['approaching','arrived'].includes(arrival))fail('Okänt ankomstläge.');
    if(typeof track!=='string'||!text(track,40))fail('Ogiltig spårbeteckning.');
    if(!departure&&!arrival&&!track.trim())fail('Ingen ändring angiven.');
    return this.command(data,context=>{
      const train=(context.trains||[]).find(t=>t.id===movementId);
      if(!train)fail('Tågrörelsen finns inte på stationen i dag.',409);
      const current=(context.movements||[]).find(m=>m.id===movementId)||{};
      const payload={station_id:this.data.stationId,movement_id:movementId,departure:departure||current.departure||'none',arrival:arrival||current.arrival||'none',event_type:'tkl_'+(departure||arrival||'track_changed')};
      const actualTrack=track.trim()||current.track||train.track_id||'';if(actualTrack)payload.actual_track=actualTrack;
      const what=departure==='positioned'?'uppställt':departure==='ready'?'förare på plats':departure==='departed'?'avgått':arrival==='approaching'?'närmar sig':arrival==='arrived'?'ankommit':'spår '+track.trim();
      return {path:'/v1/tkl/movement',payload,journal:`Tåg ${train.train_number}: ${what} anmält hos TrainMeet.`};
    });
  }
  async disconnect(data){this.check(data);
    const pairings={...this.data.pairings};delete pairings[this.origin];const next={...this.data,token:'',stationId:'',origin:this.origin,pairings};this.storage.save('trainmeet.json',next);this.data=next;this.context=null;this.updatedAt=0;this.status=this.origin?'unpaired':'unconfigured';this.error='';this.revision++;this.emit('change');return this.view();}
  tick(){
    const paired=!!(this.origin&&this.data.token);
    if(this.feed&&(!paired||this.feed.origin!==this.origin)){this.feed.controller.abort();this.feed=null;this.feedRetryAt=0;}
    if(paired&&this.changeFeed&&!this.feed&&this.now()>=this.feedRetryAt)this.follow();
    if(paired&&!this.busy&&(this.urgent||this.now()-this.lastAttempt>=5000)){this.urgent=false;this.refresh();}
  }
  // TrainMeet says at once when its clock is stopped, started or given a new speed
  // (/v1/events: topic names only, no key). The clock is then read on the next tick
  // instead of on the next five-second poll; the poll still corrects any drift, and
  // without the feed (an older server, a proxy that cuts it) everything works as before.
  async follow(){
    const origin=this.origin,controller=new AbortController();this.feed={origin,controller};let wait=2000;
    try{
      const response=await this.fetcher(origin+'/v1/events',{headers:{Accept:'text/event-stream'},redirect:'error',signal:controller.signal});
      if(!response.ok||!response.body){wait=response.status===404?300000:30000;return;}
      const decoder=new TextDecoder();let buffer='';
      for await(const part of response.body){
        buffer+=decoder.decode(part,{stream:true});
        for(let cut;(cut=buffer.indexOf('\n\n'))>=0;){this.feedEvent(buffer.slice(0,cut));buffer=buffer.slice(cut+2);}
        if(buffer.length>65536)buffer='';
      }
    }catch{wait=controller.signal.aborted?0:15000;}
    finally{if(this.feed?.controller===controller){this.feed=null;this.feedRetryAt=this.now()+wait;}}
  }
  feedEvent(block){
    let event='message',data='';
    for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=line.slice(5).trim();}
    // A new stream may have missed a change while it was closed: read everything once.
    if(event==='hello'){this.urgent=true;return;}
    if(event!=='change')return;
    let topics=[];try{topics=JSON.parse(data).topics;}catch{return;}
    if(Array.isArray(topics)&&topics.includes('clock'))this.urgent=true;
  }
}
