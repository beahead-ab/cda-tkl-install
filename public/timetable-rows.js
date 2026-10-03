// The station timetable as the panel's bottom row shows it: rows grouped around the
// meet clock into done · NU · ongoing · upcoming. Pure data, no DOM and no orders.
// Movement states are the ones TrainMeet reports for a TMBox; nothing is inferred
// from the interlocking.
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
    if(group==='done')row.lage=dep==='departed'?'Avgått':arr==='arrived'?'Ankommet':'';
    else if(group==='now'){
      const parts=[statusText(dep!=='none'?dep:arr)];
      // Still active after its own time: it sits above the NU line, where its time belongs, and says how late it is.
      const behind=minutes!=null&&lastTime!=null?minutes-lastTime:0;
      if(behind>0&&behind<=720){row.late=true;parts.push('sen '+(behind>=60?Math.floor(behind/60)+' h '+behind%60+' min':behind+' min'));}
      const at=announced.get(r.number);if(at)parts.push('anmält '+at);
      if(routeLaid(routes,r.trackLabel??r.track)===false)parts.push('tågväg ej lagd');
      row.lage=parts.filter(Boolean).join(' · ');
    } else {
      const parts=[];if(r.noStop)parts.push('Genomfart');if(r.changed&&r.planned)parts.push('Spår ändrat fr. '+r.planned);row.lage=parts.join(' · ');
    }
    (group==='done'?done:row.late?late:group==='now'?now:next).push(row);
  }
  if(next.length&&minutes!=null){const t=upcomingTime(next[0],minutes);if(t)next[0].lage=['om '+(t.minutes-minutes)+' min',next[0].lage].filter(Boolean).join(' · ');}
  let nextSummary=null;
  for(const r of [...now,...next]){const t=upcomingTime(r,minutes);if(t){nextSummary={number:r.number,from:r.from||'',kind:t.kind,time:t.time,minutes:minutes==null?null:t.minutes-minutes};break;}}
  if(!nextSummary){const r=[...now,...next][0];const t=r&&upcomingTime(r,null);if(t)nextSummary={number:r.number,from:r.from||'',kind:t.kind,time:t.time,minutes:minutes==null?null:Math.max(0,t.minutes-minutes)};}
  for(const r of [...done,...late,...now,...next])r.la=[r.lage,r.noteLine].filter(Boolean).join(' · ');
  return {done,late,now,next,all:[...done,...late,...now,...next],nextSummary,doneKey:[...done,...late].map(r=>r.id).join('\u0000')};
}
