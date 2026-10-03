// Tåg på tur: the station's trains in timetable order, each in the step it has reached.
// A turn key shows the train at its place in that order, after its filter, and a press
// takes the train to its next step through the same TrainMeet calls as the line keys:
// godkänn, närmar sig and ankommit on the way in; uppställt, förare på plats, begär and
// avgått on the way out. A train leaves the turn when it has arrived for good or left,
// and the next one moves up. Pure: no DOM, and the server still decides every step.
import {COLORS} from './stream-deck-layout.js';
import {toMinutes} from './stream-deck-trains.js';
export const YARD_TRACKS=[11,12,13];
const collator=new Intl.Collator('sv',{numeric:true});
const direction=(c,t)=>c.directions?.[t.id]||c.directions?.['#'+t.train_number]||{from:'',to:''};
export const trackNumber=label=>{const m=/\d+/.exec(label||'');return m?Number(m[0]):NaN;};
// Every train still due here, in the order it is due. A train that both arrives and
// departs is first on turn for its arrival and then for its departure.
export function turnList(context){
  if(!context)return [];
  const movements=new Map((context.movements||[]).map(m=>[m.id,m])),lines=context.lines||[],list=[];
  for(const train of context.trains||[]){
    const m=movements.get(train.id)||{},d=direction(context,train);
    const role=train.arrival_time&&m.arrival!=='arrived'?'arrival':train.departure_time&&m.departure!=='departed'?'departure':'';
    if(!role)continue;
    const time=role==='arrival'?train.arrival_time:train.departure_time,neighborId=role==='arrival'?d.from:d.to;
    list.push({train,movement:m,role,time,minutes:toMinutes(time),line:neighborId?lines.find(l=>l.neighborId===neighborId)||null:null,track:m.track||train.track||''});
  }
  return list.sort((a,b)=>a.minutes-b.minutes||collator.compare(a.train.train_number,b.train.train_number));
}
export function turnFilter(key){
  switch(key.filter){
    case 'arrivals':return t=>t.role==='arrival';
    case 'departures':return t=>t.role==='departure';
    case 'yard':return t=>YARD_TRACKS.includes(trackNumber(t.track));
    case 'line':return t=>t.line?.id===key.lineId;
    default:return ()=>true;
  }
}
export const turnAt=(list,key)=>list.filter(turnFilter(key))[key.slot-1]||null;
function spec(turn,fields){
  const {train,line,role,time,track}=turn;
  return {kind:'train',turn:true,role,lineId:line?.id||'',neighborCode:line?.neighborCode||(line?.neighborName||'').slice(0,3).toUpperCase(),
    number:train.train_number,time,track,movementId:train.id,fill:'',blink:false,dim:false,short:null,long:null,text:'',step:'',...fields};
}
// What one turn key shows and what a short and a long press do.
export function turnSpec(key,context){
  if(!context)return {kind:'train',turn:true,role:'',lineId:'',neighborCode:'',number:'',time:'',track:'',movementId:'',text:'TrainMeet ej ansluten',step:'none',fill:'',blink:false,dim:true,short:null,long:null};
  const turn=turnAt(turnList(context),key);
  if(!turn)return {kind:'train',turn:true,role:'',lineId:'',neighborCode:'',number:'',time:'',track:'',movementId:'',text:'inget tåg i tur',step:'none',fill:'',blink:false,dim:true,short:null,long:null};
  const {train,movement:m,line,role}=turn,number=train.train_number;
  if(role==='arrival'){
    const inbound=line&&line.direction==='in'&&line.trainNumber===number;
    if(inbound&&line.state==='requested')return spec(turn,{step:'incoming-request',text:'anmält · godkänn?',fill:COLORS.held,blink:true,short:{type:'clearance',action:'accept'},long:{type:'clearance',action:'reject'}});
    if(inbound&&line.state==='reserved')return spec(turn,{step:'cleared-in',text:'klart · väntas',fill:COLORS.route});
    if(inbound&&line.state==='occupied'){
      if(m.arrival!=='approaching')return spec(turn,{step:'on-line-in',text:'på väg · närmar sig?',fill:COLORS.occupied,short:{type:'movement',movementId:train.id,arrival:'approaching'}});
      return spec(turn,{step:'approaching',text:'närmar sig · ankommit?',fill:COLORS.occupied,short:{type:'clearance',action:'arrive'}});
    }
    if(m.arrival==='approaching')return spec(turn,{step:'approaching',text:'närmar sig · ankommit?',fill:COLORS.occupied,short:{type:'movement',movementId:train.id,arrival:'arrived'}});
    // Without a line (from a siding or the depot) the operator reports the steps directly.
    if(!line)return spec(turn,{step:'planned',text:'väntas · närmar sig?',short:{type:'movement',movementId:train.id,arrival:'approaching'}});
    return spec(turn,{step:'planned',text:'väntas'});
  }
  const outbound=line&&line.direction==='out'&&line.trainNumber===number&&['requested','reserved','occupied'].includes(line.state);
  if(outbound&&line.state==='requested')return spec(turn,{step:'requested',text:'begärd · väntar',fill:COLORS.held,blink:true,long:{type:'clearance',action:'cancel'}});
  if(outbound&&line.state==='reserved')return spec(turn,{step:'cleared',text:'klart · avgå?',fill:COLORS.route,short:{type:'clearance',action:'depart'},long:{type:'clearance',action:'cancel'}});
  if(outbound)return spec(turn,{step:'on-line',text:'avgått · på linjen',fill:COLORS.muted});
  const stage=m.departure||'';
  if(!stage)return spec(turn,{step:'unprepared',text:'ej uppställt',short:{type:'movement',movementId:train.id,departure:'positioned'}});
  if(stage==='positioned')return spec(turn,{step:'positioned',text:'uppställt · förare?',fill:COLORS.held,short:{type:'movement',movementId:train.id,departure:'ready'}});
  if(!line)return spec(turn,{step:'ready',text:'redo · avgått?',fill:COLORS.route,short:{type:'movement',movementId:train.id,departure:'departed'}});
  if(line.state!=='free')return spec(turn,{step:'ready',text:'redo · sträckan upptagen',fill:COLORS.route,dim:true});
  return spec(turn,{step:'ready',text:'redo · begär?',fill:COLORS.route,short:{type:'clearance',action:'request',trainNumber:number}});
}
