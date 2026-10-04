import {createContextDialog} from './context-dialog.js';
import {clockAt,groupRows,trainClass} from './timetable-rows.js';
import {createTrackOccupancy} from './track-occupancy.js';
import {occupancyModel} from './track-occupancy-model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CELLS=['n','slag','fr','till','frtill','ank','avg','spar','lage','anm','la'];

// TrainMeet is the only timetable; the local one is gone (docs/installningar-plan.md).
export function createTrainMeetTimetable() {
  const root=document.getElementById('trainmeet-timetable'),$=id=>document.getElementById('tt-'+id);
  root.innerHTML='<header class="tt-heading"><h2>Tidtabell</h2><span id="tt-station"></span><div class="tt-mode" role="group" aria-label="Urval"><button id="tt-mode-upcoming" type="button" aria-pressed="true">Kommande</button><button id="tt-mode-all" type="button" aria-pressed="false">Alla<span id="tt-count"></span></button></div><span id="tt-next"></span><span id="tt-clock"><span id="tt-clock-time"></span><span id="tt-clock-label"></span></span><button id="tt-collapse" type="button" hidden>Svep ned · stäng</button></header><p id="tt-status" role="status" hidden></p><div class="tt-labels" aria-hidden="true"><span class="tt-n">Tåg</span><span class="tt-slag">Slag</span><span class="tt-fr">Från</span><span class="tt-till">Till</span><span class="tt-frtill">Från → till</span><span class="tt-ank">Ank</span><span class="tt-avg">Avg</span><span class="tt-spar">Spår</span><span class="tt-lage">Läge</span><span class="tt-anm">Anmärkning</span><span class="tt-la">Läge · anmärkning</span></div><div id="tt-content" tabindex="0"></div><div id="tt-mini" aria-hidden="true"></div>';

  const dialog=document.createElement('dialog');dialog.className='inspector-host timetable-details';dialog.setAttribute('aria-labelledby','tt-detail-title');
  dialog.innerHTML='<div class="card"><div class="card-heading"><h3 id="tt-detail-title"></h3><button type="button" id="tt-close-detail" aria-label="Stäng tidtabellsuppgifter" autofocus>Stäng</button></div><div id="tt-detail-content"></div></div>';document.body.append(dialog);
  let rows=[],grouped=null,mode='upcoming',last='',miniLast='',identity='',selected=null,detailHTML='',frame=0;
  // The meet clock runs locally between polls; groups are recomputed when the minute changes.
  let clockBase=null,clockStart=0,clockKey='',shownMinute=null,clockMinutes=null,occupancy=null,clockShort='',doneLimit=Infinity,routes=[],userActiveUntil=0,lastTouch=0,userMoved=false,programmaticUntil=0,layoutHeight=0,anchoredKey=null;
  const announced=new Map();
  const details=createContextDialog({dialog,onClose:()=>{selected=null;}});
  $('close-detail').onclick=()=>details.close();
  function drawDetails(){
    if(!selected)return;const row=rows.find(r=>r.id===selected);if(!row){details.close();return;}
    $('detail-title').textContent='Tåg '+row.number;
    const values={'Station / driftplats':row.station,'Trafikdag':row.day,'Slag':row.slag,'Ankomst':row.arrival,'Avgång':row.departure,'Från':row.from,'Till':row.to,'Spår':row.track,...(row.changed?{'Planerat spår':row.planned}:{}),'Driftläge':row.state,'Uppehåll':row.noStop?'Passerar utan uppehåll':'Genomfart är inte angiven','Anmärkning':row.note};
    const html=($('status').hidden?'':'<p class="import-warning">'+esc($('status').textContent)+'</p>')+'<dl>'+Object.entries(values).map(([k,v])=>'<dt>'+k+'</dt><dd>'+esc(v||'—')+'</dd>').join('')+'</dl>';
    if(html!==detailHTML){detailHTML=html;$('detail-content').innerHTML=html;}
  }
  function showDetails(e){
    const button=e.target.closest('[data-timetable-row]');if(!button)return;
    e.preventDefault();const chosen=rows[Number(button.dataset.timetableRow)];selected=chosen?.id;if(!selected)return;drawDetails();
    if(chosen.trackLabel)window.dispatchEvent(new CustomEvent('panel-highlight',{detail:{kind:'track',name:chosen.trackLabel}}));
    details.open({currentTarget:button,clientX:e.clientX,clientY:e.clientY},button);
  }
  function detailsFrom(host){
    host.addEventListener('click',showDetails);
    host.addEventListener('contextmenu',showDetails);
    host.addEventListener('keydown',e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')showDetails(e);});
  }
  for(const host of [$('content'),$('mini')])detailsFrom(host);
  // The occupancy tab lives in the events column, which is built after this module.
  function ensureOccupancy(){
    if(occupancy)return occupancy;const host=document.getElementById('panel-occupancy');if(!host)return null;
    occupancy=createTrackOccupancy({host,range:document.getElementById('occ-range')});detailsFrom(host);return occupancy;
  }
  // Never move the list under a reader's finger or pointer.
  // Four seconds after the reader lets go, the list glides back to the NU line by itself.
  const touched=()=>{lastTouch=Date.now();userActiveUntil=lastTouch+4000;userMoved=true;};
  for(const type of ['wheel','touchstart','touchmove','pointerdown','keydown'])$('content').addEventListener(type,touched,{passive:true});
  $('content').addEventListener('scroll',()=>{if(Date.now()>=programmaticUntil)touched();},{passive:true});
  function rowHTML(row){
    const values={n:row.number,slag:row.slag,fr:row.fromText,till:row.toText,frtill:row.frTill,ank:row.arrival||'—',avg:row.departure||'—',spar:row.track+(row.changed?' *':''),lage:row.lage,anm:row.noteLine,la:row.la};
    const titles={anm:row.note,la:row.la};
    return '<button type="button" class="tt-entry tt-'+row.group+'" data-timetable-row="'+row.i+'" aria-haspopup="dialog" aria-label="Visa tidtabellsuppgifter för tåg '+esc(row.number)+'">'+CELLS.map(c=>'<span class="tt-'+c+(c==='spar'&&row.changed?' tt-track-changed':'')+'"'+(titles[c]?' title="'+esc(titles[c])+'"':'')+'>'+esc(values[c])+'</span>').join('')+'</button>';
  }
  const nowLine=()=>clockBase?'<div class="tt-now-line" aria-hidden="true"><span>NU '+esc(clockShort)+'</span><i></i></div>':'';
  function nextHTML(s){
    if(!s)return '';
    return 'Nästa <b>'+esc(s.number)+'</b>'+(s.from?'<span class="tt-next-from"> fr. '+esc(s.from)+'</span>':'')+'<span class="tt-next-time"> · <span class="tt-next-kind">'+s.kind+' </span>'+esc(s.time)+'</span>'+(s.minutes==null?'':' · <em>om '+s.minutes+' min</em>');
  }
  function replaceList(host,html,key){
    if(html===key.last)return false;
    const focused=host.contains(document.activeElement)?document.activeElement.dataset.timetableRow:null;
    const template=document.createElement('template');template.innerHTML=html;
    const oldRows=[...host.children],newRows=[...template.content.children];
    const same=oldRows.length===newRows.length&&oldRows.every((el,i)=>el.className===newRows[i].className&&el.dataset.timetableRow===newRows[i].dataset.timetableRow);
    if(same){for(let i=0;i<oldRows.length;i++)if(oldRows[i].innerHTML!==newRows[i].innerHTML)oldRows[i].replaceChildren(...newRows[i].childNodes);}
    else host.replaceChildren(...template.content.childNodes);
    key.last=html;
    if(focused!=null)host.querySelector('[data-timetable-row="'+Number(focused)+'"]')?.focus({preventScroll:true});
    return !same;
  }
  const listKey={last:''},miniKey={last:''};
  // When the clock moves a row past the NU line, the rows and the line glide to their
  // new places instead of jumping (record where they were, then animate from there).
  const still=matchMedia('(prefers-reduced-motion: reduce)');
  const placeKey=el=>el.dataset.timetableRow??(el.classList.contains('tt-now-line')?'nu':null);
  function places(){const map=new Map();for(const el of $('content').children){const key=placeKey(el);if(key!=null)map.set(key,el.getBoundingClientRect().top);}return map;}
  function glideFrom(before){
    if(still.matches||!before?.size)return;
    const moved=[];
    for(const el of $('content').children){const key=placeKey(el);if(key==null||!before.has(key))continue;const dy=before.get(key)-el.getBoundingClientRect().top;if(Math.abs(dy)<.5||Math.abs(dy)>600)continue;el.style.transition='none';el.style.transform='translateY('+dy+'px)';moved.push(el);}
    if(!moved.length)return;
    void $('content').offsetHeight;
    requestAnimationFrame(()=>{for(const el of moved){el.style.transition='transform 700ms cubic-bezier(.25,.7,.25,1)';el.style.transform='';}});
    setTimeout(()=>{for(const el of moved)el.style.transition='';},800);
  }
  function render(glide=false){
    const before=glide?places():null;
    const g=grouped;
    $('count').textContent=rows.length?' · '+rows.length:'';
    $('mode-upcoming').setAttribute('aria-pressed',String(mode==='upcoming'));$('mode-all').setAttribute('aria-pressed',String(mode==='all'));
    const next=nextHTML(g?.nextSummary);
    $('next').innerHTML=next;const mirror=document.getElementById('bottom-tabs-next');if(mirror)mirror.innerHTML=next;
    let html='';
    if(!rows.length)html='<p class="tt-empty">Ingen tidtabell att visa.</p>';
    else{
      // Everything above the NU line has its time behind it: the last done rows and,
      // always shown, trains still active after their time, in time order.
      const done=mode==='all'?g.done:g.done.slice(Math.max(0,g.done.length-doneLimit));
      const above=[...done,...g.late].sort((a,b)=>((a.time??1e9)-(b.time??1e9))||(a.i-b.i));
      html=above.map(rowHTML).join('')+nowLine()+g.now.map(rowHTML).join('')+g.next.map(rowHTML).join('');
    }
    const structural=replaceList($('content'),html,listKey);
    ensureOccupancy()?.update(occupancyModel(g?.all||[],{minutes:clockMinutes}));
    const mini=rows.length?'<div class="tt-mini-status"><span class="tt-mini-nu">NU</span><span class="tt-mini-clock">'+esc($('clock-time').textContent)+'</span><span class="tt-mini-rate">'+esc($('clock-label').textContent.replace(/^träffklocka · /,''))+'</span><span class="tt-mini-next">'+next+'</span><span id="panel-alarm-summary" hidden></span></div><div class="tt-mini-rows">'+[...g.now,...g.next.slice(0,g.now.length?2:3)].map(rowHTML).join('')+'</div><button type="button" class="tt-mini-hint">Svep upp · tidtabell och händelser</button>':'';
    if(mini!==miniLast){const summary=document.getElementById('panel-alarm-summary');const keep=summary?{text:summary.textContent,hidden:summary.hidden}:null;$('mini').innerHTML=mini;miniLast=mini;if(keep){const s=document.getElementById('panel-alarm-summary');if(s){s.textContent=keep.text;s.hidden=keep.hidden;}}}
    if(structural&&g&&g.doneKey!==anchoredKey)anchor(false);
    if(structural&&before)glideFrom(before);
    drawDetails();
  }
  // The NU line sits about a third down the list; done rows fill the space above it.
  function anchor(force,smooth=false){
    const content=$('content'),line=content.querySelector('.tt-now-line');if(!line)return;
    if(!force&&Date.now()<userActiveUntil)return;
    anchoredKey=grouped?.doneKey??null;
    const top=Math.max(0,Math.round(line.offsetTop-content.offsetTop-content.clientHeight/3));
    if(Math.abs(content.scrollTop-top)<1)return;
    // Our own scrolling is not the reader's: its scroll events are ignored for a moment.
    const glide=smooth&&!still.matches;programmaticUntil=Date.now()+(glide?1500:150);
    content.scrollTo({top,behavior:glide?'smooth':'auto'});
  }
  function layout(){
    frame=0;const content=$('content');const height=content.clientHeight;if(!height)return;
    const style=getComputedStyle(root),rowHeight=parseFloat(style.getPropertyValue('--tt-row'))||25,lineHeight=parseFloat(style.getPropertyValue('--tt-line'))||14;
    const limit=Math.max(0,Math.floor((height/3-lineHeight)/rowHeight));
    if(limit!==doneLimit){doneLimit=limit;render();}
    // A new size moves the line at once; a reader's scroll is undone by tick(), gliding.
    if(height!==layoutHeight){layoutHeight=height;anchor(false);}
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
  new ResizeObserver(schedule).observe(root);window.addEventListener('resize',schedule);
  $('mode-upcoming').onclick=()=>{mode='upcoming';render();anchor(true);};
  $('mode-all').onclick=()=>{mode='all';render();anchor(true);};
  // Phone, landscape: the bottom row shows the next trains; swiping up or tapping the
  // hint opens the full timetable and the events over the plan.
  const bottom=document.getElementById('panel-bottom');
  const expand=open=>{if(!bottom)return;if(open)bottom.dataset.expanded='';else delete bottom.dataset.expanded;$('collapse').hidden=!open;};
  $('mini').addEventListener('click',e=>{if(e.target.closest('.tt-mini-hint'))expand(true);});
  $('collapse').onclick=()=>expand(false);
  let swipe=null;
  bottom?.addEventListener('touchstart',e=>{swipe={y:e.touches[0].clientY,at:Date.now()};},{passive:true});
  bottom?.addEventListener('touchend',e=>{if(!swipe)return;const dy=e.changedTouches[0].clientY-swipe.y;const quick=Date.now()-swipe.at<600;swipe=null;if(!quick)return;if(dy<-40&&!('expanded' in bottom.dataset)&&$('mini').offsetParent)expand(true);else if(dy>40&&'expanded' in bottom.dataset&&$('content').scrollTop===0)expand(false);},{passive:true});
  function regroup(){
    const minutes=clockBase?clockAt(clockBase,performance.now()-clockStart).minutes:null;clockMinutes=minutes;
    grouped=groupRows(rows,{minutes,routes,announced});
    for(const key of [...announced.keys()])if(grouped.done.some(r=>r.number===key))announced.delete(key);
    render(true);
  }
  function tick(){
    if(userMoved&&Date.now()>=userActiveUntil){userMoved=false;anchor(false,true);}
    if(!clockBase||document.hidden)return;
    const now=clockAt(clockBase,performance.now()-clockStart);
    $('clock-time').textContent=now.text;clockShort=now.short;
    const phone=document.getElementById('panel-phone-clock');if(phone)phone.textContent=now.text;
    const mini=$('mini').querySelector('.tt-mini-clock');if(mini)mini.textContent=now.text;
    if(now.minutes!==shownMinute){shownMinute=now.minutes;regroup();}
  }
  // Four times a second, so a fast clock (4×) shows every meet second instead of every fourth.
  setInterval(tick,250);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  return {update(state,online,panel){
    routes=Array.isArray(panel?.routes)?panel.routes:[];
    const c=state?.context;
    const stale=!!c&&(!online||state?.stale);
    root.classList.toggle('timetable-stale',stale);
    $('station').textContent=c?[c.meet,c.day,'TrainMeet'].filter(Boolean).join(' · '):'';
    // The meet clock belongs to TrainMeet.
    const clock=state?.context?.clock;
    if(clock&&/^\d\d:\d\d:\d\d$/.test(clock.time)){
      // Re-anchor only on a new reading, back-dated by its age; between readings the
      // clock runs on locally instead of restarting from an old time on every update.
      const key=[clock.readAt??'',clock.time,clock.rate,clock.running].join('|');
      if(key!==clockKey){clockKey=key;clockBase={time:clock.time,rate:clock.rate,running:clock.running};clockStart=performance.now()-(Number.isFinite(state.clockAgeMs)?state.clockAgeMs:0);}
      $('clock-label').innerHTML='<span class="tt-clock-prefix">träffklocka · </span>'+(clock.running?'går':'pausad')+' · '+esc(clock.rate)+'×';const rate=document.getElementById('panel-phone-rate');if(rate)rate.textContent=clock.rate+'×';}
    else{clockBase=null;clockKey='';clockShort='';$('clock-time').textContent='';$('clock-label').textContent='';}
    $('status').textContent=stale?'Kontakt saknas – senaste mottagna uppgifter.':'';$('status').hidden=!stale;
    const nextIdentity=JSON.stringify([c?.station.id,c?.day,c?.trains.map(t=>t.id)]);if(nextIdentity!==identity){identity=nextIdentity;details.close();anchoredKey=null;}
    rows=[];
    if(c){
      const tracks=new Map(c.tracks.map(t=>[t.id,t])),points=new Map(c.operatingPoints.map(p=>[p.id,p.code])),movements=new Map(c.movements.map(m=>[m.id,m]));
      const trackName=id=>{const t=tracks.get(id);return t?[points.get(t.operatingPointId),t.label].filter(Boolean).join(' · '):'Okänt spår ('+id+')';},trackLabel=id=>tracks.get(id)?.label||'';
      rows=c.trains.map(t=>{
        const m=movements.get(t.id),changed=!!m?.track&&m.track!==t.track_id,planned=t.track_id?trackName(t.track_id):(t.track||'—');
        return {id:t.id,number:t.train_number,slag:trainClass(t.train_type),station:[c.station.name,points.get(t.operating_point_id)].filter(Boolean).join(' · '),day:t.days||c.day,arrival:t.arrival_time,departure:t.departure_time,sortTime:t.sort_time||'',from:t.arrival_from,to:t.departure_to,track:changed?trackName(m.track):planned,trackLabel:changed?trackLabel(m.track):(trackLabel(t.track_id)||t.track||''),planned,changed,noStop:t.no_stop,note:t.note,movement:m||null,state:[m?.arrival,m?.departure].filter(v=>v&&v!=='none').map(v=>({approaching:'Närmar sig',arrived:'Ankommet',positioned:'Uppställt',ready:'Redo',waiting:'Väntar',departed:'Avgått'})[v]??v).join(' · '),context:points.get(t.operating_point_id)};
      });
      // A train announced from a neighbour (its line requested or reserved towards us)
      // is noted with the meet time it was first seen here; TrainMeet sends no timestamp.
      const seen=clockBase?clockAt(clockBase,performance.now()-clockStart).short:'';
      for(const line of c.lines||[])if(['requested','reserved'].includes(line.state)&&line.direction==='in'&&line.trainNumber&&!announced.has(line.trainNumber))announced.set(line.trainNumber,seen);
    }
    if(clockBase){const now=clockAt(clockBase,performance.now()-clockStart);clockShort=now.short;shownMinute=now.minutes;$('clock-time').textContent=now.text;}
    regroup();schedule();
  }};
}
