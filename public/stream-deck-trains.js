// What a line's departure or arrival key shows and what one press means,
// following the TMBox sequence: uppställt, förare på plats, begär, avgått on
// the way out; godkänn, närmar sig, mottaget on the way in. The train is the
// next planned movement toward or from that neighbour, or the one already in
// the line's clearance. No DOM here; the server still decides every step.
import {COLORS} from './stream-deck-layout.js';
export const toMinutes=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(t||'');return m?Number(m[1])*60+Number(m[2]):Infinity;};
const direction=(context,t)=>context.directions?.[t.id]||context.directions?.['#'+t.train_number]||{from:'',to:''};
const movement=(context,t)=>t&&(context.movements||[]).find(m=>m.id===t.id);
const byNumber=(context,number,pick)=>(context.trains||[]).find(t=>t.train_number===number&&pick(direction(context,t)));
function key(role,line,train,fields){
  return {kind:'train',role,lineId:line.id,neighborCode:line.neighborCode||line.neighborName.slice(0,3).toUpperCase(),neighborName:line.neighborName,
    number:train?.train_number||'',time:train?(role==='departure'?train.departure_time:train.arrival_time)||'':'',movementId:train?.id||'',
    fill:'',blink:false,dim:false,short:null,long:null,text:'',step:'',...fields};
}
export function departureKey(line,context){
  const out=line.direction==='out';
  if(out&&['requested','reserved','occupied'].includes(line.state)){
    const train=byNumber(context,line.trainNumber,d=>d.to===line.neighborId)||{train_number:line.trainNumber};
    if(line.state==='requested')return key('departure',line,train,{step:'requested',text:'begärd · väntar',fill:COLORS.held,blink:true,long:{type:'clearance',action:'cancel'}});
    if(line.state==='reserved')return key('departure',line,train,{step:'cleared',text:'klart · avgått?',fill:COLORS.route,short:{type:'clearance',action:'depart'},long:{type:'clearance',action:'cancel'}});
    return key('departure',line,train,{step:'on-line',text:'på linjen',fill:COLORS.muted});
  }
  const next=(context.trains||[]).filter(t=>t.departure_time&&direction(context,t).to===line.neighborId&&movement(context,t)?.departure!=='departed').sort((a,b)=>toMinutes(a.departure_time)-toMinutes(b.departure_time))[0];
  if(!next)return key('departure',line,null,{step:'none',text:'inga fler avgångar',dim:true});
  const m=movement(context,next),stage=m?.departure||'none';
  if(stage==='none')return key('departure',line,next,{step:'unprepared',text:'ej uppställt',short:{type:'movement',movementId:next.id,departure:'positioned'}});
  if(stage==='positioned')return key('departure',line,next,{step:'positioned',text:'uppställt · förare?',short:{type:'movement',movementId:next.id,departure:'ready'}});
  if(line.state!=='free')return key('departure',line,next,{step:'ready',text:'redo · sträckan upptagen',fill:COLORS.route,dim:true});
  return key('departure',line,next,{step:'ready',text:'redo · begär?',fill:COLORS.route,short:{type:'clearance',action:'request',trainNumber:next.train_number}});
}
export function arrivalKey(line,context){
  const inbound=line.direction==='in';
  if(inbound&&line.state==='requested'){
    const train=byNumber(context,line.trainNumber,d=>d.from===line.neighborId)||{train_number:line.trainNumber};
    return key('arrival',line,train,{step:'incoming-request',text:'begär · godkänn?',fill:COLORS.held,blink:true,short:{type:'clearance',action:'accept'},long:{type:'clearance',action:'reject'}});
  }
  if(inbound&&line.state==='reserved'){
    const train=byNumber(context,line.trainNumber,d=>d.from===line.neighborId)||{train_number:line.trainNumber};
    return key('arrival',line,train,{step:'cleared-in',text:'klart · väntas',fill:COLORS.route});
  }
  if(inbound&&line.state==='occupied'){
    const train=byNumber(context,line.trainNumber,d=>d.from===line.neighborId),m=movement(context,train);
    if(train&&m?.arrival!=='approaching')return key('arrival',line,train,{step:'on-line-in',text:'på väg · närmar sig?',fill:COLORS.occupied,short:{type:'movement',movementId:train.id,arrival:'approaching'}});
    return key('arrival',line,train||{train_number:line.trainNumber},{step:'approaching',text:'närmar sig · mottaget?',fill:COLORS.occupied,short:{type:'clearance',action:'arrive'}});
  }
  const next=(context.trains||[]).filter(t=>t.arrival_time&&direction(context,t).from===line.neighborId&&movement(context,t)?.arrival!=='arrived').sort((a,b)=>toMinutes(a.arrival_time)-toMinutes(b.arrival_time))[0];
  if(!next)return key('arrival',line,null,{step:'none',text:'inga fler ankomster',dim:true});
  return key('arrival',line,next,{step:'planned',text:'väntas'});
}
