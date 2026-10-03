// Track occupancy over time, from the same rows as the timetable: one lane per
// track, one bar per train from arrival to departure. Pure, so it can be tested.
// The window follows the meet clock (50 min back, 100 min ahead, whole 10-minute
// steps); without a clock it spans the whole timetable.
import {toMinutes} from './timetable-rows.js';
const pad=n=>String(n).padStart(2,'0');
export const hhmm=m=>{const t=((m%1440)+1440)%1440;return pad(Math.floor(t/60))+':'+pad(t%60);};
const naturally=(a,b)=>a.localeCompare(b,'sv',{numeric:true});
// A train that starts here is shown from 6 minutes before departure; one that ends
// here is shown 28 minutes after arrival, as in the design.
export function barSpan(row){
  const arrival=toMinutes(row.arrival),departure=toMinutes(row.departure);
  if(arrival==null&&departure==null)return null;
  const start=arrival??departure-6;let end=departure??arrival+28;
  if(end<start)end+=1440;
  return {start,end,open:departure==null};
}
export function occupancyModel(rows,{minutes=null,span=150,before=50}={}){
  const spans=[];
  for(const row of rows||[]){const s=row.track&&barSpan(row);if(s)spans.push({row,...s});}
  let start,end;
  if(minutes!=null){start=Math.floor((minutes-before)/10)*10;end=start+span;}
  else if(spans.length){start=Math.floor(Math.min(...spans.map(s=>s.start))/30)*30;end=Math.max(start+60,Math.ceil(Math.max(...spans.map(s=>s.end))/30)*30);}
  else return {empty:true,label:'',ticks:[],now:null,tracks:[]};
  const width=end-start,pct=m=>((m-start)/width*100).toFixed(2)+'%';
  const inWindow=s=>{if(s.end<start&&s.end+1440>=start&&s.start+1440<=end){s.start+=1440;s.end+=1440;}return s.end>=start&&s.start<=end;};
  const visible=spans.filter(inWindow);
  const tracks=[...new Set(visible.map(s=>s.row.track))].sort(naturally).map(name=>({name,
    bars:visible.filter(s=>s.row.track===name).sort((a,b)=>a.start-b.start).map(s=>({
      i:s.row.i,number:s.row.number,group:s.row.group||'next',open:s.open,left:pct(s.start),width:((s.end-s.start)/width*100).toFixed(2)+'%',
      title:s.row.number+' · '+(s.row.arrival||'—')+' – '+(s.row.departure||'slutar')+' · '+name}))}));
  const ticks=[];for(let t=Math.ceil(start/30)*30;t<=end;t+=30)if(t>start&&t<end)ticks.push({left:pct(t),label:hhmm(t)});
  const now=minutes!=null&&minutes>=start&&minutes<=end?pct(minutes):null;
  return {empty:!visible.length,label:hhmm(start)+' – '+hhmm(end)+' · planerad',ticks,now,tracks};
}
