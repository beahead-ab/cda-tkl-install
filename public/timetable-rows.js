// The station timetable as the panel's bottom row shows it: rows grouped around the
// meet clock into done · NU · ongoing · upcoming. Pure data, no DOM and no orders.
// Movement states are the ones TrainMeet reports for a TMBox; nothing is inferred
// from the interlocking. Each row also carries what the styles Symboler and
// Linjebild draw (public/timetable-style.js): what goes on now, the clearance on
// the line in and the line out, and whether the train stands on its track.
import {destinationLines} from './destination-data.js';
const STATUS={none:'',approaching:'Närmar sig',arrived:'Ankommet',positioned:'Uppställt',ready:'Redo',waiting:'Väntar',departed:'Avgått'};
const ACTIVE=new Set(['approaching','arrived','positioned','ready','waiting']);
// A route counts as laid while it is being set, established or passed; a released
// or cancelled one does not.
const LAID=new Set(['setting','establishing','clearing','active','traversing']);
export const statusText=value=>STATUS[value]??(value||'');
export const toMinutes=text=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(text||'').trim());return m?Number(m[1])*60+Number(m[2]):null;};
// TrainMeet's train types: person → Pt, goods → Gt, everything else (work …) → Tjt.
export const trainClass=type=>({person:'Pt',passenger:'Pt',goods:'Gt',freight:'Gt'})[String(type||'').toLowerCase()]||(type?'Tjt':'');
const pad=n=>String(n).padStart(2,'0');
export const firstLine=text=>String(text||'').split(/\r?\n/)[0].trim();
// The meet clock between polls: TrainMeet reports time, speed and running state and
// the terminal lets it run locally at that speed until the next poll corrects it.
export function clockAt(base,elapsedMs=0){
  if(!base||typeof base.time!=='string')return null;
  const [h,m,s]=base.time.split(':').map(Number);
  let total=(h||0)*3600+(m||0)*60+(s||0);
  if(base.running)total+=Math.max(0,elapsedMs)/1000*(Number(base.rate)>0?Number(base.rate):1);
  total=((Math.floor(total)%86400)+86400)%86400;
  const hh=Math.floor(total/3600),mm=Math.floor(total/60)%60,ss=total%60;
  return {seconds:total,minutes:Math.floor(total/60),text:pad(hh)+':'+pad(mm)+':'+pad(ss),short:pad(hh)+':'+pad(mm)};
}
// Does a laid route start or end on the train's track? Route labels read
// "Au → Spår 1a"; the timetable track reads "1a". null when the track is unknown.
export function routeLaid(routes,track){
  const label=String(track||'').trim().toLowerCase();if(!label)return null;
  const wanted='spår '+label;
  return (routes||[]).some(r=>LAID.has(r?.state)&&String(r.label||'').toLowerCase().split('→').map(s=>s.trim()).some(end=>end===wanted||end===label));
}
// Which side of the panel each TrainMeet neighbour lies on: a destination linked to a
// TrainMeet station (Inställningar → Orter) gives the station its line's side.
export function stationSides(destinations,lines=destinationLines){
  const out=new Map();
  for(const e of destinations?.entries||[]){
    if(e?.source!=='trainmeet'||!e.stationId||out.has(e.stationId))continue;
    const side=lines.find(l=>l.tracks.includes(e.id))?.side;if(side)out.set(e.stationId,side);
  }
  return out;
}
// The sides a train comes in from and leaves to. A neighbour not linked to a side is put
// opposite the other end, and with neither known the train runs left to right, as the
// words read.
export function routeSides({from='',to='',fromId='',toId=''},sides=new Map()){
  const other=s=>s==='left'?'right':'left';
  let fromSide=from?sides.get(fromId)||'':'',toSide=to?sides.get(toId)||'':'';
  if(from&&!fromSide)fromSide=toSide?other(toSide):'left';
  if(to&&!toSide)toSide=fromSide?other(fromSide):'right';
  return {fromSide,toSide};
}
// The clearance for one train on the line it comes in on and the one it leaves on:
// requested, reserved (klart) or occupied (on the line); '' when the line is not about it.
export function lineStates(lines,number,{from='',to=''}={}){
  const pick=(direction,neighbor)=>(lines||[]).find(l=>l?.direction===direction&&l.trainNumber===number&&['requested','reserved','occupied'].includes(l.state)&&(!neighbor||l.neighborId===neighbor))?.state||'';
  return number?{inLine:pick('in',from),outLine:pick('out',to)}:{inLine:'',outLine:''};
}
// What goes on with the train now, for the sign of the Symboler style.
function activityOf({group,arr,dep,inLine,outLine,standing}){
  if(group==='done')return dep==='departed'?'departed':arr==='arrived'?'arrived':'none';
  if(standing){
    if(outLine==='requested'||dep==='waiting')return 'waiting';
    if(outLine==='reserved')return 'cleared';
    return arr==='arrived'&&dep==='none'?'arrived':'standing';
  }
  if(arr==='approaching'||inLine==='occupied')return 'approaching';
  if(inLine==='reserved')return 'cleared';
  if(inLine==='requested')return 'request';
  if(outLine==='requested')return 'waiting';
  if(outLine==='reserved')return 'cleared';
  return 'planned';
}
// The line in and the line out as the line picture draws them.
const inStateOf=({group,arr,inLine})=>group==='done'||arr==='arrived'?'done':arr==='approaching'||inLine==='occupied'?'onLine':inLine==='reserved'?'cleared':inLine==='requested'?'requested':'planned';
const outStateOf=({group,dep,outLine})=>group==='done'||dep==='departed'?'done':outLine==='occupied'?'onLine':outLine==='reserved'?'cleared':outLine==='requested'||dep==='waiting'?'requested':'planned';
// The next planned time of a row at or after the clock: arrival first, then departure.
function upcomingTime(row,minutes){
  for(const [kind,value] of [['ank',row.arrival],['avg',row.departure]]){const t=toMinutes(value);if(t!=null&&(minutes==null||t>=minutes))return {kind,time:value,minutes:t};}
  return null;
}
export function groupRows(rows,{minutes=null,routes=[],announced=new Map()}={}){
  const keyed=rows.map((r,i)=>({...r,i,time:toMinutes(r.sortTime)??toMinutes(r.arrival)??toMinutes(r.departure)}));
  keyed.sort((a,b)=>((a.time??1e9)-(b.time??1e9))||(a.i-b.i));
  const done=[],late=[],now=[],next=[];
  for(const r of keyed){
    const arr=r.movement?.arrival||'none',dep=r.movement?.departure||'none',hasData=arr!=='none'||dep!=='none';
    const lastTime=toMinutes(r.departure)??toMinutes(r.arrival);
    const group=dep==='departed'?'done':(ACTIVE.has(dep)||ACTIVE.has(arr))?'now':(!hasData&&minutes!=null&&lastTime!=null&&lastTime<minutes)?'done':'next';
    const row={...r,group,lage:'',la:'',delta:'',fromText:r.from||'—',toText:r.to||(r.arrival?'slutar':'—'),frTill:(r.from?r.from+' ':'')+'→ '+(r.to||'slutar'),noteLine:firstLine(r.note)};
    // The läge as parts, so each style can draw them its own way; lage is the words.
    const parts=[];
    if(group==='done'){const value=dep==='departed'?'departed':arr==='arrived'?'arrived':'';if(value)parts.push({kind:'status',value,text:statusText(value)});}
    else if(group==='now'){
      const value=dep!=='none'?dep:arr;if(statusText(value))parts.push({kind:'status',value,text:statusText(value)});
      // Still active after its own time: it sits above the NU line, where its time belongs, and says how late it is.
      const behind=minutes!=null&&lastTime!=null?minutes-lastTime:0;
      if(behind>0&&behind<=720){row.late=true;row.lateMinutes=behind;parts.push({kind:'late',minutes:behind,text:'sen '+(behind>=60?Math.floor(behind/60)+' h '+behind%60+' min':behind+' min')});}
      const at=announced.get(r.number);if(at)parts.push({kind:'announced',text:'anmält '+at});
      if(routeLaid(routes,r.trackLabel??r.track)===false)parts.push({kind:'route',text:'tågväg ej lagd'});
    } else {
      if(r.noStop)parts.push({kind:'noStop',text:'Genomfart'});if(r.changed&&r.planned)parts.push({kind:'changed',text:'Spår ändrat fr. '+r.planned});
    }
    row.parts=parts;
    const inLine=r.inLine||'',outLine=r.outLine||'';
    // Standing on its track: come in, or set up (uppställt, förare på plats) and not yet gone.
    row.standing=group!=='done'&&(arr==='arrived'||['positioned','ready','waiting'].includes(dep));
    row.activity=activityOf({group,arr,dep,inLine,outLine,standing:row.standing});
    row.inState=r.from?inStateOf({group,arr,inLine}):'';row.outState=r.to?outStateOf({group,dep,outLine}):'';
    (group==='done'?done:row.late?late:group==='now'?now:next).push(row);
  }
  if(next.length&&minutes!=null){const t=upcomingTime(next[0],minutes);if(t){next[0].countdownMinutes=t.minutes-minutes;next[0].parts.unshift({kind:'countdown',minutes:t.minutes-minutes,text:'om '+(t.minutes-minutes)+' min'});}}
  let nextSummary=null;
  for(const r of [...now,...next]){const t=upcomingTime(r,minutes);if(t){nextSummary={number:r.number,from:r.from||'',kind:t.kind,time:t.time,minutes:minutes==null?null:t.minutes-minutes};break;}}
  if(!nextSummary){const r=[...now,...next][0];const t=r&&upcomingTime(r,null);if(t)nextSummary={number:r.number,from:r.from||'',kind:t.kind,time:t.time,minutes:minutes==null?null:Math.max(0,t.minutes-minutes)};}
  for(const r of [...done,...late,...now,...next]){r.lage=r.parts.map(p=>p.text).join(' · ');r.la=[r.lage,r.noteLine].filter(Boolean).join(' · ');}
  return {done,late,now,next,all:[...done,...late,...now,...next],nextSummary,doneKey:[...done,...late].map(r=>r.id).join('\u0000')};
}
