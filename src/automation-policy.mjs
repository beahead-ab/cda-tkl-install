// Stationsstyrd automat: tidtabellen väljer spår och nästa verkliga granne. Alla tågvägar begärs hos samma kärna
// som operatörens. Klareringen är en separat åtgärd hos TrainMeet och kan aldrig ersätta förreglingen.
import {GRACE_MS} from './train-tracking.mjs';
const LIVE=new Set(['setting','establishing','clearing','active','traversing','cancelling']);
const ACTIVE=new Set(['active','traversing']);
const key=meet=>JSON.stringify([meet.sessionId,meet.context.station?.id,meet.context.publicationId,meet.context.day]);
const contextIdentity=meet=>({stationId:meet.context.station.id,publicationId:meet.context.publicationId,day:meet.context.day});
const routeProof=route=>route?{id:route.id,from:route.from,to:route.to,blocks:[...route.blocks]}:null;
const proof=plan=>({arrival:routeProof(plan.arrival),departure:routeProof(plan.departure),trackBlock:plan.track.block});
const label=value=>String(value||'').trim().toLowerCase();
const problem=message=>{throw Error(message);};

export class TimetableAutomationPolicy{
  constructor({automation,traffic,clearance,movement}){
    this.automation=automation;this.traffic=traffic||{};this.clearance=clearance;this.movement=movement;this.plans=new Map();this.sent=new Set();this.busy=false;
    const profile=automation.profile,tracks=Object.values(this.traffic.stationTracks||{}),buttons=new Set(tracks.map(t=>t.button));
    const edges=new Set(Object.keys(this.traffic.edgeLines||{}).map(e=>this.button(e)));
    this.trackOf=Object.fromEntries(tracks.map(t=>[t.block,t.button]));
    const main=profile.routes.filter(r=>r.kind==='main'&&!r.adminDisabled);
    const releasable=r=>{const last=r.blocks.at(-1),address=profile.blocks[last]?.address,final=new Set(r.blocks.filter(b=>profile.blocks[b]?.address===address));return address!=null&&!Object.keys(r.turnouts||{}).some(n=>final.has(profile.turnouts[n]?.block));};
    this.arrivals=main.filter(r=>edges.has(r.from)&&buttons.has(r.to)&&releasable(r));
    this.departures=main.filter(r=>buttons.has(r.from)&&edges.has(r.to));
  }
  button(edge){return this.traffic.anchors?.[edge]?.button||'htv'+edge;}
  fail(message){this.automation.handOver(message);}
  checkRun(){if(!this.automation.enabled||this.automation.generation!==this.runGeneration)problem('Automatens körning har ändrats. Kontrollera tåget och ta över.');}
  dispatch(plan,identity,step){
    this.checkRun();
    if(plan.dispatchUncertain)problem('Automatens tidigare åtgärd är inte bekräftad. Kontrollera tåget och klareringen manuellt.');
    if(this.sent.has(identity)){plan.dispatchUncertain={identity,step};problem('Automatens åtgärd har redan skickats. Kontrollera tåget och klareringen manuellt.');}
    // Ett avslag eller ett förlorat/overifierat svar får inte bli framgång vid nästa påslag, heller inte efter en
    // ny trafikrevision. Bara ett verifierat svar från samma körning tar bort denna spärr.
    plan.dispatchUncertain={identity,step};this.sent.add(identity);
  }
  fresh(meet){
    if(!meet||meet.stale||meet.status!=='connected'||!meet.context||!meet.sessionId||!Number.isSafeInteger(meet.revision)||meet.revision<0)problem('TrainMeet saknar ett färskt, verifierat trafikläge.');
    if(!meet.context.station?.id||!meet.context.publicationId||!meet.context.day||!Number.isSafeInteger(meet.context.revision)||meet.context.revision<0||!Array.isArray(meet.context.lines)||!Array.isArray(meet.context.trains)||!Array.isArray(meet.context.tracks))problem('TrainMeet saknar stationsunderlag för automaten.');
    if(typeof this.clearance!=='function')problem('Automatens klarering är inte ansluten till TrainMeet.');
  }
  lineFor(neighbor,context,edges){
    const lines=context.lines.filter(l=>l.neighborId===neighbor),bound=Object.keys(this.traffic.edgeLines||{}).filter(e=>edges[e]?.stationId===neighbor);
    if(!neighbor||lines.length!==1||bound.length!==1)problem('Nästa granne eller linjebindning saknas eller är tvetydig.');
    return {line:lines[0],edge:bound[0]};
  }
  plan(number,meet,edges,origin=''){
    const context=meet.context,rows=context.trains.filter(t=>t.train_number===number);
    if(!number||rows.length!==1)problem('Tågnumret saknas eller matchar flera tidtabellsrader.');
    const row=rows[0],direction=context.directions?.[row.id]||context.directions?.['#'+number];
    if(!direction?.to)problem('Tågets nästa granne saknas i TrainMeet.');
    const listed=context.tracks.filter(t=>t.id===row.track_id);
    if(listed.length!==1)problem('Tidtabellen saknar ett entydigt stationsspår.');
    const matches=Object.entries(this.traffic.stationTracks||{}).filter(([name,t])=>label(name)===label(listed[0].label)||label(t.label)===label(listed[0].label));
    if(matches.length!==1)problem('Tidtabellsspåret saknar en entydig stationsbindning.');
    const track=matches[0][1],next=this.lineFor(direction.to,context,edges);
    if(origin&&(!edges[origin]?.stationId||direction.from!==edges[origin].stationId))problem('Tågets ankomstriktning matchar inte den anslutna grannen.');
    if(origin===next.edge)problem('Tåget saknar en genomgående riktning till nästa granne.');
    const value={movementId:row.id,number,track,trackId:listed[0].id,nextEdge:next.edge,nextConnection:next.line.id,origin,key:key(meet)},old=this.plans.get(row.id);
    if(origin)value.originConnection=this.lineFor(direction.from,context,edges).line.id;
    if(old){
      if(old.key!==value.key||old.number!==number||old.track.button!==track.button||old.trackId!==value.trackId||old.nextEdge!==next.edge||old.nextConnection!==next.line.id||origin&&(old.origin!==origin||old.originConnection!==value.originConnection))problem('Tågets plan eller TrainMeet-anslutning har ändrats.');
      return old;
    }
    this.plans.set(row.id,value);return value;
  }
  releasing(plan,kind,route,state){
    if(!route.autoRelease||!route.cancelRequested||route.state!=='cancelling'||!route.passage?.length)return false;
    const free=b=>state.blocks[b]?.occupied===false;
    if(kind==='departure')return route.passage.every(p=>p.state==='clear')&&[plan.track.block,...route.blocks].every(free);
    const last=route.passage.at(-1),address=this.automation.profile.blocks[plan.track.block]?.address;
    return route.arrival===true&&last.address===address&&last.state==='occupied'&&route.passage.slice(0,-1).every(p=>p.state==='clear')&&
      state.blocks[plan.track.block]?.occupied===true&&route.blocks.every(b=>this.automation.profile.blocks[b]?.address===address||free(b));
  }
  route(plan,kind,state,finishing=false){
    const pending=plan[kind];if(!pending)return null;
    const candidates=state.routes.filter(r=>r.from===pending.from&&r.to===pending.to&&(!pending.id||r.id===pending.id));
    if(candidates.length!==1)problem('Automatens tågväg saknas, har ändrats eller återtas.');
    const route=candidates[0],normalRelease=finishing&&this.releasing(plan,kind,route,state);
    // Kärnan begär själv stopp efter en fullständigt följd passage. Vänta då på dess stoppåterrapporter och
    // låsfrigivning; en manuell återtagning mitt i passagen ska fortfarande lämnas till operatören.
    if((route.cancelRequested||route.state==='cancelling')&&!normalRelease||!LIVE.has(route.state))problem('Automatens tågväg saknas, har ändrats eller återtas.');
    return candidates[0];
  }
  async command(plan,line,action,meet){
    if(!Array.isArray(line.actions)||!line.actions.includes(action))problem('TrainMeet tillåter inte den väntade klareringen.');
    const identity=JSON.stringify([key(meet),meet.revision,meet.context.revision,line.id,action,plan.number]);
    // Lås före await. Även ett förlorat svar lämnas till operatören i stället för att skickas en gång till.
    this.dispatch(plan,identity,action);
    const answer=await this.clearance({sessionId:meet.sessionId,revision:meet.revision,contextRevision:meet.context.revision,contextIdentity:contextIdentity(meet),proof:proof(plan),automationGeneration:this.runGeneration,connectionId:line.id,action,trainNumber:plan.number});
    this.fresh(answer);
    const current=answer.context.lines.find(l=>l.id===line.id);
    if(key(answer)!==key(meet)||answer.context.revision<meet.context.revision||!current)problem('Klareringens svar kunde inte verifieras mot senaste trafikläget.');
    if(action==='arrive'){
      if(current.state!=='free')problem('TrainMeet har inte bekräftat att tåget tagits emot.');
    }else{
      const direction=action==='accept'?'in':'out',states=action==='request'?['requested','reserved']:action==='accept'?['reserved','occupied']:['occupied'];
      if(current.direction!==direction||current.trainNumber!==plan.number||!states.includes(current.state))problem('TrainMeet har inte bekräftat den begärda klareringen.');
    }
    this.checkRun();delete plan.dispatchUncertain;
  }
  async declare(plan,step,meet){
    if(typeof this.movement!=='function')problem('Automatens tåganmälan är inte ansluten till TrainMeet.');
    const identity=JSON.stringify([key(meet),meet.revision,meet.context.revision,'movement',plan.movementId,step]);
    this.dispatch(plan,identity,step);
    const change=step==='arrived'?{arrival:'arrived',actualTrack:plan.trackId}:{departure:'departed'};
    const answer=await this.movement({sessionId:meet.sessionId,revision:meet.revision,contextRevision:meet.context.revision,contextIdentity:contextIdentity(meet),proof:proof(plan),automationGeneration:this.runGeneration,movementId:plan.movementId,trainNumber:plan.number,...change});
    this.fresh(answer);
    const current=answer.context.movements?.find(m=>m.id===plan.movementId);
    if(key(answer)!==key(meet)||answer.context.revision<meet.context.revision||!current||step==='arrived'&&(current.arrival!=='arrived'||current.track!==plan.trackId)||step==='departed'&&current.departure!=='departed')problem('TrainMeet har inte bekräftat tågets ankomst eller avgång.');
    this.checkRun();delete plan.dispatchUncertain;
  }
  build(plan,kind,options){
    if(!options.length)problem('Tidtabellens tågväg är belagd, okänd eller saknar en säker väg.');
    const r=options[0],laid=this.automation.request(r.from,r.to);
    plan[kind]={from:r.from,to:r.to,id:laid?.id||'',blocks:[...(laid?.blocks||r.blocks)],active:false};
    this.automation.lastAt=this.automation.now();this.automation.last=`Automaten lägger ${r.label} för tåg ${plan.number}.`;
    this.automation.revision++;this.automation.log('automation',this.automation.last);
  }
  async observe(plan,{state,trains,meet,edges}){
    if(plan.key!==key(meet))problem('TrainMeet-anslutningen, publikationen eller trafikdagen har ändrats.');
    this.plan(plan.number,meet,edges,plan.origin);
    if(plan.arrival&&!plan.arrival.active){
      const route=this.route(plan,'arrival',state);
      if(!ACTIVE.has(route.state))return true;
      const incoming=this.lineFor(edges[plan.origin]?.stationId,meet.context,edges).line;
      if(incoming.trainNumber!==plan.number||incoming.direction!=='in')problem('Den inkommande klareringen har ändrats.');
      if(incoming.state==='requested')await this.command(plan,incoming,'accept',meet);
      else if(!['reserved','occupied'].includes(incoming.state))problem('Den inkommande klareringen är inte giltig.');
      plan.arrival.active=true;return true;
    }
    if(plan.arrival?.active&&!plan.arrived){
      const laid=state.routes.find(r=>r.id===plan.arrival.id||!plan.arrival.id&&r.from===plan.arrival.from&&r.to===plan.arrival.to);
      const train=trains.find(t=>t.number===plan.number);
      if(laid)this.route(plan,'arrival',state,true);
      else if(train?.head===plan.track.block&&train.certain!==false&&train.state==='station'&&state.blocks[plan.track.block]?.occupied===true)plan.arrived=true;
      else problem('Infarten försvann innan tågets ankomst kunde följas.');
      const line=meet.context.lines.find(l=>l.id===plan.originConnection);
      if(!(plan.arrived&&line?.state==='free')&&(line?.direction!=='in'||line.trainNumber!==plan.number||!['reserved','occupied'].includes(line.state)))problem('Den inkommande klareringen ändrades innan tågets ankomst kunde följas.');
    }
    if(plan.departure&&!plan.departure.active){
      const route=this.route(plan,'departure',state);
      if(!ACTIVE.has(route.state))return true;
      const outgoing=meet.context.lines.find(l=>l.id===plan.nextConnection);
      if(outgoing?.trainNumber!==plan.number||outgoing.direction!=='out')problem('Den utgående klareringen har ändrats.');
      if(outgoing.state==='reserved')await this.command(plan,outgoing,'depart',meet);
      else if(outgoing.state!=='occupied')problem('Den utgående klareringen är inte beviljad.');
      plan.departure.active=true;return true;
    }
    if(plan.departure?.active&&!plan.left){
      const laid=state.routes.find(r=>r.id===plan.departure.id||!plan.departure.id&&r.from===plan.departure.from&&r.to===plan.departure.to);
      let waiting=false;
      if(laid)this.route(plan,'departure',state,true);
      else{
        if(![plan.track.block,...plan.departure.blocks].every(block=>state.blocks[block]?.occupied===false))problem('Utfarten försvann med belagt eller okänt spår. Kontrollera tågets avgång.');
        if(!trains.some(t=>t.number===plan.number))plan.left=true;
        else{
          // Kärnan löser vägen när beläggningen släpper; spårningen filtrerar samma släpp med GRACE_MS.
          plan.departure.missingAt??=this.automation.now();
          if(this.automation.now()-plan.departure.missingAt<GRACE_MS+500)waiting=true;
          else problem('Utfarten försvann innan tågets avgång kunde följas.');
        }
      }
      const line=meet.context.lines.find(l=>l.id===plan.nextConnection);
      if(!(plan.left&&line?.state==='free')&&(line?.direction!=='out'||line.trainNumber!==plan.number||line.state!=='occupied'))problem('Den utgående klareringen ändrades innan tågets avgång kunde följas.');
      if(waiting)return true;
    }
    return false;
  }
  async tick(input){
    if(this.busy)return;
    this.busy=true;this.runGeneration=this.automation.generation;
    try{await this.run(input);}catch(error){this.fail(error.message||'ett fel i den stationsstyrda automaten.');}finally{this.busy=false;}
  }
  async run({state,trains,meet,edges,dwellMs,standMs,stepMs}){
    this.fresh(meet);if(meet.busy)return;
    this.checkRun();
    if([...this.plans.values()].some(plan=>plan.dispatchUncertain))problem('Automatens tidigare åtgärd är inte bekräftad. Kontrollera tåget och klareringen manuellt.');
    const contextKey=key(meet);
    if(this.contextKey===contextKey&&meet.context.revision<this.contextRevision)problem('TrainMeet har skickat en äldre trafikrevision.');
    this.contextKey=contextKey;this.contextRevision=meet.context.revision;
    for(const plan of this.plans.values())if(await this.observe(plan,{state,trains,meet,edges}))return;
    for(const plan of this.plans.values()){
      if(plan.left&&!plan.departureDeclared){
        await this.declare(plan,'departed',meet);plan.departureDeclared=true;return;
      }
      if(plan.arrived&&!plan.received){
        if(!plan.arrivalDeclared){await this.declare(plan,'arrived',meet);plan.arrivalDeclared=true;return;}
        const incoming=meet.context.lines.find(l=>l.id===plan.originConnection);
        if(incoming?.state==='free')plan.received=true;
        else if(incoming?.state==='occupied'&&incoming.direction==='in'&&incoming.trainNumber===plan.number){await this.command(plan,incoming,'arrive',meet);plan.received=true;return;}
        else problem('Tågets ankomst kan inte bekräftas mot den inkommande linjen.');
      }
    }
    const automation=this.automation,now=automation.now();if(now-automation.lastAt<stepMs)return;
    const live=state.routes.filter(r=>LIVE.has(r.state));
    // Låt den pågående tågvägen bli färdig innan en ny trafikuppgift tas. Kärnan avgör fortfarande varje väg.
    if(live.length)return;
    const free=b=>state.blocks[b]?.occupied===false,claimed=new Set(trains.flatMap(t=>t.blocks));
    const arriving=meet.context.lines.filter(l=>l.direction==='in'&&['requested','reserved','occupied'].includes(l.state)&&l.trainNumber);
    for(const line of arriving){
      const incoming=this.lineFor(line.neighborId,meet.context,edges),plan=this.plan(line.trainNumber,meet,edges,incoming.edge);
      if(plan.arrival)continue;
      const observed=trains.filter(t=>t.number===plan.number);
      if(observed.length>1||observed[0]?.certain===false)problem('Det inkommande tågets läge är osäkert.');
      // En begärd infart får läggas innan tåget nått linjen; klareringen besvaras först när signalvägen är aktiv.
      if(line.state==='occupied'&&(!observed[0]||observed[0].head!==this.traffic.edgeBlocks[incoming.edge]||now-observed[0].movedAt<standMs))continue;
      if(observed[0]&&observed[0].head!==this.traffic.edgeBlocks[incoming.edge])problem('Det inkommande tåget står inte vid rätt infart.');
      if(!free(plan.track.block)||claimed.has(plan.track.block))problem('Tidtabellsspåret är belagt eller okänt.');
      const options=this.arrivals.filter(r=>r.from===this.button(incoming.edge)&&r.to===plan.track.button&&r.blocks.every(b=>free(b)&&!claimed.has(b)));
      this.build(plan,'arrival',options);return;
    }
    const standing=trains.filter(t=>t.state==='station'&&this.trackOf[t.head]&&now-t.movedAt>=dwellMs);
    for(const train of standing){
      if(train.certain===false)problem('Det avgående tågets läge är osäkert.');
      const plan=this.plan(train.number,meet,edges);
      if(plan.departure)continue;
      const movement=meet.context.movements?.find(m=>m.id===plan.movementId);
      if(!plan.arrival?.active&&!['positioned','ready'].includes(movement?.departure))problem('Automaten saknar en följd infart efter omstart. Kontrollera tåget och ta över.');
      if(plan.track.block!==train.head||this.trackOf[train.head]!==plan.track.button)problem('Tåget står inte på sitt tidtabellsspår.');
      const line=meet.context.lines.find(l=>l.id===plan.nextConnection);
      if(!line)problem('Tågets verkliga utgående linje saknas.');
      if(line.state==='free'){
        if(plan.requested)problem('Den begärda utgående klareringen återtogs eller avslogs.');
        plan.requested=true;await this.command(plan,line,'request',meet);return;
      }
      if(line.direction!=='out'||line.trainNumber!==plan.number)problem('Utgående enkelspår används av ett annat eller mötande tåg.');
      if(line.state==='requested'){if(!plan.requested)problem('Utgående klarering kan inte knytas till automatens begäran.');continue;}
      if(line.state!=='reserved')problem('Utgående enkelspår är inte fritt för tåget.');
      const options=this.departures.filter(r=>r.from===plan.track.button&&r.to===this.button(plan.nextEdge)&&r.blocks.every(b=>free(b)&&!claimed.has(b))&&free(this.traffic.edgeBlocks[plan.nextEdge]));
      this.build(plan,'departure',options);return;
    }
  }
}
