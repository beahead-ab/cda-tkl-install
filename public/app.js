import {routePresentation,routeButtonPhase} from './route-presentation.js';
import {createRouteTargets} from './route-targets.js';
import {turnoutDisplay} from './turnout-display.js';
import {destinationDisplay,destinationDefaults,isOutgoingDestination} from './destination-data.js';
import {createRouteConfirmation} from './route-confirmation.js';
import {trackRestrictions,restrictionMarkers,lineRestrictionExtents} from './track-restrictions.js';
import {signalRouteControls,signalImage} from './signal-route-controls.js';
import {createAdminNavigation} from './admin-navigation.js';
import {createAdminAppearance} from './admin-appearance.js';
import {createPanelZoom,createZoomDialog,zoomLabel} from './panel-zoom.js';
import {syncAdminWorkspaces,registerAdminWorkspace} from './admin-ui.js';
import {attribute,style,text as setText,flowProgress,createPanelFrames,preparingEndpoints} from './panel-rendering.js';
import {createTimetableImport} from './timetable-import.js';
import { createManualFeedback } from './manual-feedback.js';
import { createSourceRegister } from './source-register.js';
import { panelLayout } from './panel-layout.js';
import { createTrainInformation } from './train-information.js';
import { createTelegramRecorder } from './telegram-recorder.js';
import { createTrainMeet } from './trainmeet.js';
import {createClearance} from './clearance.js';
import {createStreamDeck} from './stream-deck.js';
import {createStreamDeckEditor} from './stream-deck-editor.js';
import { createModelClock } from './model-clock.js';
import { createFeedback } from './feedback.js';
import { createOperatingControls } from './operating-controls.js';
import { createFullscreen } from './fullscreen.js';
import { createContextDialog } from './context-dialog.js';
import { createPanelConsole } from './panel-console.js';
import {createPanelEvents} from './panel-events.js';
import {createPanelHead} from './panel-head.js';
import {createPanelSplit} from './panel-split.js';
import {labelClass,objectFromMessage} from './plan-objects.js';
const $ = id => document.getElementById(id);
const adminNavigation=createAdminNavigation();
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = n => new Date(n).toLocaleTimeString('sv-SE');
const crossingDisplays = {
  calm: {label:'Lugn röd växelblinkning',description:'Dämpade röda lampor med mjuk tändning och släckning, 20 blinkningar per minut per lampa.'},
  steady: {label:'Fast rött sken',description:'Båda lamporna lyser med ett dämpat fast rött sken när övergången är aktiv.'}
};
let crossingDisplay='calm';
function setCrossingDisplay(value,{save=true}={}) {
  crossingDisplay=Object.hasOwn(crossingDisplays,value)?value:'calm';
  document.body.dataset.crossingDisplay=crossingDisplay;
  $('crossing-display').value=crossingDisplay;
  if(save)try{localStorage.setItem('charlottendal-crossing-display',crossingDisplay);}catch{}
}
try{setCrossingDisplay(localStorage.getItem('charlottendal-crossing-display'),{save:false});}catch{setCrossingDisplay('calm',{save:false});}
$('crossing-display').onchange=()=>{setCrossingDisplay($('crossing-display').value);paint();};

let state, config, panel, registry, chosen = null, inspected = null, online = false, lastEvent = 0, pending = 0;
let manualFeedback, sourceRegister, trainInformation, telegramRecorder, operatingControls, modelClock, trainMeet, feedback, layout;
let routeConfirmation,signalEndpoints;
const routeTargets=createRouteTargets({load:async(from,kind)=>{
  const response=await fetch('/api/route-targets?'+new URLSearchParams({from,kind}),{cache:'no-store'});
  if(!response.ok)throw Error('Mål kunde inte kontrolleras.');
  return response.json();
},onChange:()=>paint()});
let currentPage='panel',appMenu,contextDialog,panelConsole,panelEvents,panelHead,timetableImport,signalControls,chosenKind=null,clearanceView,streamDeck,streamDeckEditor;
const pageFromHash=()=>{
  if(location.hash==='#tools/zoom')history.replaceState(null,'','#tools/appearance');
  if(location.hash==='#tools')history.replaceState(null,'','#tools/appearance');
  if(location.hash==='#tools/connections')history.replaceState(null,'','#register');
  return ({'#register':'admin','#tools':'tools','#trainmeet':'trainmeet','#import':'import','#advanced':'advanced'})[location.hash.split('/')[0]]||'panel';
};
function setPage(page,{historyMode='push'}={}) {
  let hash={panel:'#panel',tools:'#tools',admin:'#register',trainmeet:'#trainmeet',import:'#import',advanced:'#advanced'}[page];
  if(!hash)return;
  if(historyMode==='replace'&&location.hash.startsWith(hash+'/'))hash=location.hash;
  if(historyMode!=='none'&&location.hash!==hash)history[historyMode==='replace'?'replaceState':'pushState'](null,'',hash);
  closeInspector(false);manualFeedback?.clear();
  if(currentPage!==page)clearChoice(false);
  currentPage=page;document.body.dataset.page=page;
  appMenu?.close();
  for(const p of ['panel','tools','admin','trainmeet','import','advanced']) {
    $(p+'-view').hidden=p!=='panel'&&p!==page;
    const tab=$(p+'-tab');
    if(tab){tab.classList.toggle('selected',p===page);if(p===page)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
  }
  adminNavigation.sync();
  document.title=adminNavigation.title()+' · Charlottendal TKL';
  window.scrollTo(0,0);$('admin-shell-content').scrollTop=0;syncAdminWorkspaces();paint();
  if(page==='admin'||page==='advanced')return sourceRegister.open().catch(e=>message(e.message));
}
function openTools(section) {
  if(panelConsole?.open(section))return;
  const target=$(section);if(target)location.hash='#tools/'+section.replace('-tools','');
}
async function openSource(kind,name) { await setPage('admin'); await sourceRegister.open(kind,name); }
let blockedTracks=new Map(),blockedLineParts=new Set(),lineExtents=new Map();
const blockMarkers=[];
const destinationNodes=[], rails = [], switches = [], signals = [], buttons = [], indicatorLamps = [], sourceLamps=[],routeNodes = new Map(),turnoutNumbers=new Map();
const iconTypes = {
  hsi_2: ['Hsi0', 'Hsi1', 'Hsi-dark', 12, 32], hsi_4: ['Hsi0', 'Hsi1', 'Hsi-dark', 12, 32], hsi_5: ['Hsi0', 'Hsi1', 'Hsi-dark', 12, 32],
  'hsi_3+dvsi': ['Hsi0+Sh0', 'Hsi1+Sh1', 'Hsi-dark+Sh-dark', 12, 32], hdvsi_8: ['Hdvsi0+Sh0', 'Hdvsi1+Sh1', 'Hdvsi-dark', 18, 31],
  dvsi_4: ['Dvsi0', 'Dvsi1', 'Dvsi-dark', 18, 25], sly_2: ['Ssi0', 'Ssi1', 'Dark', 18, 25]
};
const icon = file => '/assets/mod59/icons/' + encodeURIComponent(file) + '.gif';
const imageCache = [], decodedIcons = new Set();
const rendered = new Map();
function html(id, value) { if (rendered.get(id) !== value) { $(id).innerHTML = value; rendered.set(id, value); } }
function svg(tag, attrs, parent, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  parent?.append(node); return node;
}
function accessible(g, name, action) {
  g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-label', name);
  svg('title', {}, g, name); g.addEventListener('click', action);
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action(e); } });
}
function objectDetails(node,kind,name) {
  node.querySelector('title')?.remove();
  node.setAttribute('aria-description','Högerklicka eller tryck Skift+F10 för information.');
  node.addEventListener('contextmenu',e=>{e.preventDefault();showInspector(kind,name,e);});
  node.addEventListener('keydown',e=>{
    if(e.key==='ContextMenu'||e.key==='F10'&&e.shiftKey){e.preventDefault();showInspector(kind,name,e);}
  });
}
let messageTimer,messageHideTimer,messageDuration=4000,messageCanPause=true;
function pauseMessage(){clearTimeout(messageTimer);clearTimeout(messageHideTimer);$('message').classList.remove('toast-leaving');}
function resumeMessage(){
  pauseMessage();const toast=$('message');
  if(toast.hidden||(messageCanPause&&(toast.matches(':hover')||toast.contains(document.activeElement))))return;
  messageTimer=setTimeout(()=>{toast.classList.add('toast-leaving');messageHideTimer=setTimeout(()=>{toast.hidden=true;toast.classList.remove('toast-leaving');},180);},messageDuration);
}
function message(text,{error=true,duration=4000}={}) {
  messageDuration=duration;messageCanPause=error;
  $('message').dataset.tone=error?'error':'success';
  pauseMessage();if(text&&error)feedback?.error();$('message-text').textContent=text;$('message').hidden=!text||!!(panelHead&&document.body.dataset.page==='panel');
  if(text)resumeMessage();
  panelHead?.message(text,error,duration);
}
$('message').addEventListener('pointerenter',()=>{if(messageCanPause)pauseMessage();});
$('message').addEventListener('pointerleave',()=>{if(messageCanPause)resumeMessage();});
$('message').addEventListener('focusin',()=>{if(messageCanPause)pauseMessage();});
$('message').addEventListener('focusout',e=>{if(messageCanPause&&!$('message').contains(e.relatedTarget))resumeMessage();});
async function api(path, data) {
  const urgent=path==='panel-reset'||path==='emergency-cancel'||(path==='all-stop'&&data.enabled===true);
  if (pending&&!urgent) return; pending++;
  try {
    const response = await fetch('/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    // A reverse proxy may answer with an HTML page instead of our JSON; say so instead of showing the parser's complaint.
    const answer = await response.json().catch(() => null); if (!response.ok || !answer) throw Error(answer?.error || 'Servern svarade med fel ' + response.status + ' utan läsbart besked.');
    // The ordered event stream owns the display; a late HTTP reply cannot roll it back.
    if(path!=='panel-reset')message(''); return answer;
  } catch (e) { message(e.message); } finally { pending--; paint(); }
}
function clearChoice(repaint=true) { routeConfirmation?.cancel(); routeTargets.clear(); chosen = null; chosenKind=null; $('selection-hint').textContent = 'Välj startplupp och därefter slutplupp'; $('selection-hint').hidden=true; $('clear-selection').disabled = true; if(repaint)paint(); }
function choose(id,kind='main') {
  manualFeedback?.clear();
  if (!usable()) return message('Panelen saknar aktuell kontakt med anläggningen.');
  if (['waiting','interrupted'].includes(state.panelReset?.phase)) return message(state.panelReset.reason);
  if(state.controls?.mode==='remote') return message('Fjärrläge: lokal tågvägsläggning är spärrad.');
  if(chosen===id&&chosenKind===kind&&!pending)return clearChoice();
  if(pending||routeConfirmation?.selection)return;
  if(chosen&&chosenKind!==kind)return;
  if(chosen&&chosen!==id&&!routeTargets.has(id))return;
  if (!chosen) {
    if(kind==='shunt'&&!signalControls.starts.has(id))return message('Signalen kan väljas som mål men saknar en ansluten växeltågväg som start.');
    chosenKind=kind;chosen = id;routeTargets.select(id,kind); $('selection-hint').hidden=false; $('selection-hint').textContent = label(id) + (kind==='shunt'?' → välj slutsignal':' → välj slutplupp'); $('clear-selection').disabled = false; paint();
  } else if (chosen === id) clearChoice();
  else { routeConfirmation.start({from:chosen,to:id,kind}); }
}
function syncChoiceControls() {
  for(const node of $('track-plan').querySelectorAll('[role="button"]')){
    const id=chosenKind==='main'&&node.classList.contains('main-control')?node.dataset.button:
      chosenKind==='shunt'&&node.classList.contains('signal-target')?node.dataset.routeButton:null;
    const allowed=!chosen||!!id&&(id===chosen||routeTargets.has(id));
    node.classList.toggle('choice-disabled',!allowed);
    node.classList.toggle('route-destination',!!chosen&&!!id&&id!==chosen&&routeTargets.has(id));
    attribute(node,'aria-disabled',!allowed);attribute(node,'tabindex',allowed?'0':'-1');
    if(chosen&&id&&id!==chosen)attribute(node,'aria-description',allowed?
      (routeTargets.action(id)==='cancel'?'Möjlig slutpunkt för återtagning.':'Möjlig slutpunkt för tågväg.'):
      (routeTargets.loading?'Kontrollerar möjliga slutpunkter.':'Inte en möjlig slutpunkt nu.'));
  }
}
for(const event of ['click','contextmenu','keydown'])$('track-plan').addEventListener(event,e=>{
  if(!chosen||event==='keydown'&&!['Enter',' ','ContextMenu','F10'].includes(e.key))return;
  const node=e.target.closest('[role="button"]');
  if(node?.getAttribute('aria-disabled')==='true'){e.preventDefault();e.stopImmediatePropagation();}
},true);
function label(id) {
  if(config.buttons?.[id]) return displayName('buttons',id,config.buttons[id].label);
  const found = config.routes.find(r => r.from === id || r.to === id);
  if (found) return found.label.split(' → ')[found.from === id ? 0 : 1];
  return id.replace('htv', '');
}
function displayName(kind,id,fallback=id) { return config.presentation?.overrides[kind+':'+id]?.name||fallback; }
function presentationDescription(kind,id) { return config.presentation?.overrides[kind+':'+id]?.description||''; }
function applyPresentation(value) {
  config.presentation=value;
  sourceRegister?.presentationChanged();
  trainInformation?.presentationChanged();
  // Change text in place: never rebuild the SVG or signal image elements.
  for(const option of $('block-choice').options) option.textContent=displayName('blocks',option.value)+(displayName('blocks',option.value)!==option.value?' · '+option.value:'');
  for(const id of ['catalog-from','catalog-to']) for(const option of $(id)?.options||[]) option.textContent=label(option.value);
  if(chosen) $('selection-hint').textContent=label(chosen)+' → välj slutpunkt';
  for(const b of buttons) { const id=b.sensor||b.id;if(!id)continue;const node=b.g||b.node;if(node&&config.buttons?.[id]) {node.setAttribute('aria-label',label(id));const title=node.querySelector('title');if(title)title.textContent=label(id);} }
  paint();
}
// A yellow ring marks the plan object a journal row or timetable row refers to.
// Presentation only: it reads the drawn plan and sends nothing.
let hiliteNode=null,hiliteTimer=0;
function objectPosition(kind,name){
  if(!panel||!layout)return null;
  if(kind==='turnout'){const t=Object.values(panel.turnouts).find(t=>t.name===name);return t?{x:t.cx,y:t.cy}:null;}
  if(kind==='signal'){const m=signals.find(s=>s.mast===name)?.g.transform.baseVal.consolidate()?.matrix;return m?{x:m.e,y:m.f}:null;}
  if(kind==='block'){const parts=rails.filter(r=>r.block===name).map(r=>r.node);if(!parts.length)return null;const len=n=>Math.hypot(n.x2.baseVal.value-n.x1.baseVal.value,n.y2.baseVal.value-n.y1.baseVal.value);const n=parts.reduce((a,b)=>len(b)>len(a)?b:a);return {x:(n.x1.baseVal.value+n.x2.baseVal.value)/2,y:(n.y1.baseVal.value+n.y2.baseVal.value)/2};}
  if(kind==='button'){const b=layout.controls.find(b=>b.sensor===name);return b?{x:b.centerX,y:b.centerY}:null;}
  if(kind==='route'){const r=config.routes.find(r=>r.label===name);return r?objectPosition('button',r.to)||objectPosition('button',r.from):null;}
  if(kind==='track'){const l=panel.labels.find(l=>!l.hidden&&String(l.text).toLowerCase()===String(name).toLowerCase());return l?{x:l.x+String(l.text).length*(l.size||12)*.3,y:l.y+(l.size||12)/2}:null;}
  return null;
}
function highlightObject(target){
  const pos=target&&objectPosition(target.kind,target.name);if(!pos)return false;
  if(!hiliteNode)hiliteNode=svg('circle',{r:22,class:'hilite','aria-hidden':'true'},$('track-plan'));
  attribute(hiliteNode,'cx',pos.x);attribute(hiliteNode,'cy',pos.y);style(hiliteNode,'display','');
  clearTimeout(hiliteTimer);hiliteTimer=setTimeout(()=>style(hiliteNode,'display','none'),8000);
  return true;
}
window.addEventListener('panel-highlight',e=>highlightObject(e.detail));
document.addEventListener('pointerdown',()=>{if(hiliteNode)style(hiliteNode,'display','none');},true);
const HEAD_WAIT=new Set(['setting','establishing','clearing','held','cancelling']);
function headStatus(){
  const mode=state?.controls?.mode;
  const subtitle=[config?.profile?.title||'Charlottendal',mode==='remote'?'fjärrläge':'lokal drift',Object.keys(config?.turnouts||{}).length+' växlar',signals.length+' signaler'].join(' · ');
  const waiting=(state?.routes||[]).find(r=>HEAD_WAIT.has(r.state));
  const status=waiting?{text:displayName('routes',waiting.definitionId,waiting.label)+' · '+(statuses[waiting.state]||waiting.state)+(waiting.reason?' · '+waiting.reason:''),tone:waiting.state==='held'?'alarm':'warn'}:null;
  const simulator=state?.connectionInfo?.mode==='simulator';
  return {subtitle,status,gateway:{text:simulator?'Simulering':'MGP · LocoNet',tone:online&&state?.connection==='connected'?'on':'err'},simulator};
}
function buildPlan() {
  layout = panelLayout(panel);
  lineExtents=lineRestrictionExtents(panel,config);
  const {x,y,width,height}=layout.crop;
  $('track-plan').setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
  manualFeedback=createManualFeedback({config,plan:$('track-plan'),scroll:document.querySelector('.panel-scroll'),panelView:$('manual-feedback-host'),stateOf:()=>state,online:()=>online,isBlocked,esc,revealPlan:()=>{if(currentPage!=='panel')setPage('panel');}});
  const root = $('track-plan'), track = svg('g', {}, root), turnouts = svg('g', {}, root);
  const flow = svg('g', { id: 'flow-layer', 'pointer-events': 'none' }, root), labels = svg('g', {}, root), icons = svg('g', {}, root), controls = svg('g', {}, root);
  for (const s of panel.segs.filter(s => s.b !== 'frame' && s.b !== 'turntable' && !s.hide && Math.min(s.y1, s.y2) < 850)) {
    const node = svg('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, class: 'rail unconfigured' }, track);
    svg('title', {}, node, 'Spårsegment '+s.id+' · '+s.b);
    rails.push({ node, block: s.b, id:s.id, main:!!s.m });
    if (s.d) node.setAttribute('stroke-dasharray','7 5');
    const length=Math.hypot(s.x2-s.x1,s.y2-s.y1), count=length<26?0:Math.max(1,Math.round(length/78));
    for(let i=0;i<count;i++){ const fraction=(i+.5)/count;
      indicatorLamps.push({block:s.b,node:svg('circle',{cx:s.x1+(s.x2-s.x1)*fraction,cy:s.y1+(s.y2-s.y1)*fraction,r:2.5,class:'relay-lens'},track)});
    }
  }
  for (const t of Object.values(panel.turnouts)) {
    if (t.cy > 850) continue;
    const legs = {},litLegs={},group=svg('g',{'data-turnout':t.name,class:'turnout-geometry'},turnouts);
    for (const [leg, x, y] of [['A', t.ax, t.ay], ['B', t.bx, t.by], ['C', t.ccx, t.ccy]]) {
      legs[leg] = svg('line', { x1: t.cx, y1: t.cy, x2: x, y2: y, class: 'rail unknown turnout-base' }, group);
      litLegs[leg]=svg('line',{x1:t.cx,y1:t.cy,x2:x,y2:y,class:'rail turnout-lit','aria-hidden':'true'},group);
      indicatorLamps.push({block:t.block,node:svg('circle',{cx:(t.cx+x)/2,cy:(t.cy+y)/2,r:2.5,class:'relay-lens'},turnouts)});
    }
    switches.push({ ...t, legs,litLegs,group,seenConfirmed:false });
    manualFeedback.addTurnout(t);
    turnoutNumbers.set(t.name,svg('text', { x: t.cx + 3, y: t.cy - 11, class: 'turnout-number' }, labels, t.name.replace('Vx', '')));
    // The source manoeuvre dot already occupies this position. A second,
    // invisible button underneath it gave pointer and keyboard different actions.
  }
  const restrictions=svg('g',{id:'track-restrictions'},root);
  for(const marker of restrictionMarkers(panel,config)){
    const g=svg('g',{class:'track-restriction',transform:`translate(${marker.x} ${marker.y}) rotate(${marker.angle})`,visibility:'hidden',role:'img',tabindex:'-1','aria-label':'Spärrat spår '+marker.block,'data-block':marker.block},restrictions);
    svg('rect',{x:-12,y:-12,width:24,height:24,class:'restriction-hit'},g);
    svg('path',{d:'M-4 -6V6M4 -6V6',class:'restriction-bars','aria-hidden':'true'},g);
    objectDetails(g,'block',marker.block);blockMarkers.push({...marker,g});
  }
  for (const l of panel.labels.filter(l => !l.hidden && l.y < 840)) {
    if(/Lekby|Vagnsta|Kungsfors/i.test(l.text))continue;
    const size=l.size||12;
    if(l.br!=null)svg('rect',{x:l.x-3,y:l.y-3,width:l.text.length*size*.58+12,height:size*1.5+3,fill:`rgb(${l.br},${l.bg},${l.bb})`},labels);
    svg('text',{x:l.x,y:l.y+size,class:'track-label '+labelClass(l.text),...(size===12?{}:{style:`font-size:${size}px`})},labels,l.text);
  }
  for(const fallback of destinationDefaults){
    const b=layout.controls.find(b=>b.sensor==='htv'+fallback.id);if(!b)continue;
    const right=['Bu','Bn','D'].includes(fallback.id),lower=fallback.id.endsWith('n')||fallback.id==='D',y=b.centerY+(lower?38:-36),arrowX=right?2078:50;
    const group=svg('g',{class:'destination',role:'img','data-destination':fallback.id,display:isOutgoingDestination(fallback.id)?'inline':'none'},labels);
    // One chip holds arrow, name and number, drawn first so it sits behind them.
    const plate=svg('rect',{class:'destination-plate',y:y-16,height:23,rx:3,'aria-hidden':'true'},group);
    svg('path',{class:'destination-arrow',transform:`translate(${arrowX} ${y-4})`,d:right?'M0 0H14M10 -4L14 0L10 4':'M14 0H0M4 -4L0 0L4 4','aria-hidden':'true'},group);
    const nameNode=svg('text',{y,'text-anchor':right?'end':'start',class:'track-label destination-label',style:'font-size:11px','aria-hidden':'true'},group,fallback.name.toUpperCase());
    const badge=svg('g',{'aria-hidden':'true'},group),box=svg('rect',{y:y-13,height:18,rx:2,fill:'#fff'},badge),number=svg('text',{y:y, class:'destination-phone',style:'font-size:12px'},badge);
    destinationNodes.push({id:fallback.id,fallback:{...fallback,source:'local'},group,plate,nameNode,badge,box,number,right,x:right?arrowX-8:arrowX+22});
  }
  const tt = panel.turntable;
  const table=svg('g',{id:'turntable',class:'turntable',transform:`translate(${tt.cx} ${tt.cy})`,'data-position':'unknown'},track);
  // Cover incoming rays inside the pit; retain the original source geometry outside it.
  svg('circle',{r:tt.r,class:'turntable-pit'},table);
  svg('circle',{r:tt.r-3,class:'turntable-rim'},table);
  // A neutral schematic bridge until commissioned position sensors provide feedback.
  // This is not a commanded or confirmed connection to any of the approach tracks.
  const bridge=svg('g',{class:'turntable-bridge',transform:'rotate(-35)','aria-hidden':'true'},table);
  svg('rect',{x:-tt.r+4,y:-5,width:2*tt.r-8,height:10,rx:1,class:'turntable-deck'},bridge);
  for(const x of [-14,0,14])svg('path',{d:`M${x} -5V5`,class:'turntable-sleeper'},bridge);
  svg('path',{d:`M${-tt.r+3} -3H${tt.r-3}M${-tt.r+3} 3H${tt.r-3}`,class:'turntable-rails'},bridge);
  svg('text',{x:tt.r+6,y:-tt.r+6,class:'turntable-unknown','aria-hidden':'true'},table,'?');
  accessible(table,'Vändskiva · läge okänt',e=>showInspector('turntable',tt.id,e));
  objectDetails(table,'turntable',tt.id);
  for (const m of panel.micons.filter(m => m.y < 850)) {
    const type = iconTypes[m.type] || iconTypes.hsi_2;
    const w = type[3] * (m.scale || 1), h = type[4] * (m.scale || 1);
    const rad = m.deg * Math.PI / 180, rw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)), rh = Math.abs(h * Math.cos(rad)) + Math.abs(w * Math.sin(rad));
    const g = svg('g', { transform: `translate(${m.x + rw / 2},${m.y + rh / 2})`, class: 'touch-target signal-target','data-signal':m.mast }, icons);
    svg('circle', { r: Math.hypot(rw,rh)/2+4, class: 'hit' }, g);
    const files=type.slice(0,3);
    if(m.type==='hdvsi_8')files.push('Hdvsi0+Sh1');
    if(m.type==='hsi_3+dvsi')files.push('Hsi0+Sh1');
    const images=files.map((file,i)=>svg('image',{x:-w/2,y:-h/2,width:w,height:h,transform:`rotate(${m.deg})`,href:icon(file),visibility:i===2?'visible':'hidden','pointer-events':'none'},g));
    const unknown = svg('text', { x: rw / 2 + 1, y: 3, class: 'signal-unknown' }, g, '?');
    const routeButton=signalControls.buttons.get(m.mast);
    if(routeButton)g.dataset.routeButton=routeButton;
    g.classList.toggle('signal-startable',signalControls.starts.has(routeButton));
    accessible(g, `Signal ${m.mast}${routeButton?(signalControls.starts.has(routeButton)?' · växeltågväg':' · slutsignal'):''}`, e => {if(routeButton)choose(routeButton,'shunt');else if(e.type==='keydown')showInspector('signal',m.mast,e);});
    objectDetails(g,'signal',m.mast);
    signals.push({ ...m, g, images, unknown, type, signalType:m.type, files, routeButton });
  }
  const used = new Set(config.routes.flatMap(r => [r.from, r.to]));
  for (const b of layout.controls) {
    const isShunt=b.sensor.startsWith('tvv');
    const isButton=(b.act||'').includes('S-on') || isShunt;
    if(!isButton && !/lamp-[gr]|blink-r|free|hw-/.test(b.act||'')) continue;
    const isRoute=b.sensor.startsWith('htv') || isShunt;
    const names=b.sensor.startsWith('vxv')?b.sensor.slice(3).split('/').map(n=>'Vx'+n):[];
    const available=isRoute?used.has(b.sensor):names.length>0&&names.every(n=>config.turnouts[n]&&(config.coupled[names[0]]||[names[0]]).includes(n));
    const g=svg('g',{transform:`translate(${b.centerX},${b.centerY})`,class:'touch-target '+(isButton?'route-button':'source-indicator')+(isRoute?(isShunt?' shunt-control':' main-control'):''),'data-button':b.sensor},controls);
    const hit=svg('circle',{r:isButton?16:9,class:'hit'},g);
    if(isButton) {
      if(isShunt) svg('path',{d:b.act.includes('arrowleft')?'M6,-5 L-3,-5 L-8,0 L-3,5 L6,5 Z':'M-6,-5 L3,-5 L8,0 L3,5 L-6,5 Z',class:'dot shunt-arrow'},g);
      else { svg('circle',{r:(b.act.includes('-s.')?15:21)/2,class:'dot'},g); svg('rect',{x:-3.5,y:-3.5,width:7,height:7,class:'traffic-dot'},g); }
    } else {
      const lens=svg('circle',{r:b.act.includes('free')?4.5:6.5,class:'indicator-off'},g);
      const indication=config.panelIndications?.indicators.find(i=>Object.values(i.lamps).some(l=>l.name===b.sensor));
      if(indication) {
        const unknown=svg('text',{x:10,y:4,class:'derived-unknown','pointer-events':'none'},g,'?');
        const color=indication.lamps.g.name===b.sensor?'g':'r';
        if(indication.crossing)g.classList.add('crossing-lamp',color==='g'?'crossing-left':'crossing-right');
        sourceLamps.push({g,lens,unknown,name:indication.name,color,crossing:!!indication.crossing});
      }
    }
    let manualName=names[0];
    accessible(g,isRoute?`${label(b.sensor)} · ${isShunt?'växeltågväg':'tågvägsknapp'}`:names.length?`Manövrera växel ${names.join(' / ')}`:b.sensor,e=>{
      if(isRoute) return choose(b.sensor,isShunt?'shunt':'main');
      const indication=sourceLamps.find(l=>l.g===g);
      if(indication){if(e.type==='keydown')showInspector('indication',indication.name,e);return;}
      if(names.length){
        if(!available) return message('Växelgruppen finns i källan men är ännu inte ansluten till driftprofilen.');
        return manualTurnout(manualName,state?.turnouts[manualName]?.position==='C'?'T':'C');
      }
      openSource('sensors',b.sensor);
    });
    if(names.length){manualName=manualFeedback.addControl(g,names,b.centerX,b.centerY);objectDetails(g,'turnout',manualName);}
    const indication=sourceLamps.find(l=>l.g===g);if(indication)objectDetails(g,'indication',indication.name);
    if(isButton) buttons.push({id:b.sensor,g,hit,hitCap:b.hitCap,available,names,isRoute,kind:isShunt?'shunt':'main'});
  }
  new ResizeObserver(()=>{
    const scale=root.getScreenCTM()?.a||1;
    for(const b of buttons) b.hit.setAttribute('r',Math.min(b.hitCap,32*Math.min(1.6,1/Math.max(.1,scale)))/2);
  }).observe(root);
  $('derived-indications').innerHTML='<span>Beräknat:</span>'+(config.panelIndications?.indicators||[]).map(i=>`<button type="button" data-indication="${esc(i.name)}"${i.crossing?' data-crossing="true"':''}><i></i>${esc(i.name)} <span>?</span></button>`).join('');
  $('derived-indications').onclick=e=>{const name=e.target.closest('button')?.dataset.indication;if(name)inspectIndication(name);};
}
async function manualTurnout(name,position) {
  if(!usable())return message('Panelen saknar aktuell kontakt med anläggningen.');
  if(chosen)return;
  if(state.manual?.[name]?.allowed!==true)return message(state.manual?.[name]?.reason||'Ingen verifierad manöverregel är ansluten.');
  if(pending)return;
  manualFeedback.order(name,position);
  if(!await api('turnout',{name,position}))manualFeedback.failed($('message-text').textContent);
}
function showInspector(kind,name,event) {
  appMenu?.close();
  if(kind==='turnout')manualFeedback.select(name);else manualFeedback.clear();
  inspected={kind,name};paintInspector();
  $('inspector-heading').textContent=({turnout:'Växel',signal:'Signal',indication:'Indikering',block:'Spårspärr',turntable:'Vändskiva'})[kind]+' '+name;
  $('inspector-host').append($('inspector-card'));
  contextDialog.open(event);
}
function closeInspector(restoreFocus=true) {
  contextDialog?.close(restoreFocus);
}
function inspectIndication(name){showInspector('indication',name);}
function isBlocked(name) { const address=config.blocks[name]?.address;return address!=null && (state?.controls?.blocked || []).some(n=>config.blocks[n]?.address===address); }
function hasTrackRestriction(name){return blockedTracks.has(config.blocks[name]?.address);}
function usable() { return online && state?.connection === 'connected' && !state.storageFault; }
function paintPlan() {
  for(const n of destinationNodes){
    const visible=isOutgoingDestination(n.id,state.destinations?.outgoing);
    attribute(n.group,'display',visible?'inline':'none');
    attribute(n.group,'aria-hidden',visible?'false':'true');
    if(!visible)continue;
    const entry=state.destinations?.entries.find(d=>d.id===n.id)||n.fallback,d=destinationDisplay(entry,state.trainMeet),width=Math.max(30,d.phone.length*7.4+14);
    setText(n.nameNode,d.name.toUpperCase());const x=n.right?n.x-width:n.x+n.nameNode.getComputedTextLength()+8;attribute(n.nameNode,'x',n.right?n.x-(d.phone?width+8:0):n.x);setText(n.number,d.phone?'('+d.phone+')':'');attribute(n.box,'x',x);attribute(n.box,'width',width);attribute(n.number,'x',x+width/2);attribute(n.number,'text-anchor','middle');attribute(n.badge,'visibility',d.phone?'visible':'hidden');
    const nameLen=n.nameNode.getComputedTextLength(),nameX=Number(n.nameNode.getAttribute('x')),numLen=d.phone?n.number.getComputedTextLength():0,plateStart=(n.right?Math.min(nameX-nameLen,d.phone?x+width/2-numLen/2:Infinity):n.x-22)-9,plateEnd=(n.right?n.x+22:Math.max(nameX+nameLen,d.phone?x+width/2+numLen/2:0))+9;attribute(n.plate,'x',plateStart);attribute(n.plate,'width',Math.max(0,plateEnd-plateStart));attribute(n.group,'aria-label',d.name+(d.phone?' · telefon '+d.phone:'')+' · '+d.sourceLabel);
  }
  const yardParts=new Set(state.yard?.owner==='ranger'?config.yardArea?.segments:[]),yardPoints=new Set(state.yard?.owner==='ranger'?config.yardArea?.turnouts:[]);
  blockedTracks=trackRestrictions(config,state);
  blockedLineParts=new Set((state.operating?.lines||[]).filter(l=>l.blocked).flatMap(l=>[...(lineExtents.get(l.id)||[])]));
  for(const marker of blockMarkers){const blocked=blockedTracks.has(marker.address);attribute(marker.g,'visibility',blocked?'visible':'hidden');attribute(marker.g,'tabindex',blocked?'0':'-1');}
  const fresh = online && state?.connection === 'connected';
  for (const r of rails) {
    const value = fresh ? state.blocks[r.block]?.occupied : null;
    attribute(r.node,'class', 'rail ' + (r.main?'main ':'') + (yardParts.has(r.id)?'yard-delegated ':'') + (hasTrackRestriction(r.block)||blockedLineParts.has(r.id)?'blocked ':'') + (!(r.block in config.blocks) ? 'unconfigured' : value === true ? 'occupied' : value === false ? '' : 'unknown'));
  }
  for (const t of switches) {
    const display=turnoutDisplay(t,state.turnouts[t.name],{fresh:fresh&&!state.storageFault,now:state.serverTime,timeout:config.commandTimeoutMs});
    const occupied = fresh && state.blocks[t.block]?.occupied;
    attribute(t.group,'data-phase',display.phase);
    attribute(t.group,'data-instant',!t.seenConfirmed||display.phase==='unknown');
    if(display.active)t.seenConfirmed=true;
    turnoutNumbers.get(t.name)?.classList.toggle('locked',!!state?.routes.some(r=>r.turnouts[t.name]));
    for(const [leg,node] of Object.entries(t.legs)){
      const restricted=hasTrackRestriction(t.block)||blockedLineParts.has('VX:'+t.name+':'+leg),flags=(yardPoints.has(t.name)?'yard-delegated ':'')+(restricted?'blocked ':'')+(occupied?'occupied ':'');
      attribute(node,'class','rail turnout-base '+flags+(display.phase==='unknown'?'unknown':leg==='A'&&display.active?'turnout-stem':'branch-off'));
      attribute(t.litLegs[leg],'class','rail turnout-lit '+flags);
      style(t.litLegs[leg],'opacity',display.active&&(leg==='A'||leg===display.active)?'1':'0');
    }
  }
  const signalTargets=chosenKind==='shunt'?new Set(signals.filter(s=>routeTargets.has(s.routeButton)).map(s=>s.routeButton)):new Set();
  const signalPreparing=preparingEndpoints(state.routes,usable()&&!state.controls?.stopAll);
  for (const s of signals) {
    const value = fresh ? state.signals[s.mast]?.aspect : 'unknown';
    const shunting=state.routes.some(r=>r.kind==='shunt'&&r.signals.includes(s.mast));
    const requested=signalImage(s.signalType,value,shunting);
    const selected=decodedIcons.has(s.files[requested])?requested:2;
    s.images.forEach((image,i)=>attribute(image,'visibility',i===selected?'visible':'hidden'));
    style(s.unknown,'display',selected !== 2 ? 'none' : '');
    s.g.classList.toggle('unconfigured', !config.signals[s.mast]);
    s.g.classList.toggle('signal-chosen',chosenKind==='shunt'&&s.routeButton===chosen);
    s.g.classList.toggle('route-choice-start',chosenKind==='shunt'&&s.routeButton===chosen);
    s.g.classList.toggle('route-choice-end',routeConfirmation.selection?.kind==='shunt'&&s.routeButton===routeConfirmation.selection.to);
    s.g.classList.toggle('signal-destination',!!s.routeButton&&signalTargets.has(s.routeButton));
    const preparing=s.routeButton&&signalPreparing.get(s.routeButton);
    s.g.classList.toggle('signal-preparing',!!preparing);
    attribute(s.g,'aria-busy',!!preparing);
    if(s.routeButton)attribute(s.g,'aria-pressed',chosenKind==='shunt'&&s.routeButton===chosen);
    attribute(s.g,'aria-description',(s.routeButton?(s.routeButton===chosen?'Vald startsignal. ':signalTargets.has(s.routeButton)?'Möjlig slutsignal. ':signalControls.starts.has(s.routeButton)?'Klicka för växeltågväg. ':'Slutsignal · välj en startsignal först. '):'')+'Högerklicka eller tryck Skift+F10 för information.');
  }
  for(const lamp of indicatorLamps) lamp.node.classList.toggle('occupied',fresh&&state.blocks[lamp.block]?.occupied===true);
  for(const lamp of sourceLamps) {
    const indication=state.panelIndications?.[lamp.name];
    const value=fresh?(lamp.crossing?indication?.warning?.value:indication?.value):null;
    lamp.g.classList.toggle('crossing-active',lamp.crossing&&value===true);
    attribute(lamp.g,'data-value',value===true?'active':value===false?'inactive':'unknown');
    attribute(lamp.lens,'class','indicator-off '+(value==null?'derived-missing':!lamp.crossing&&value===(lamp.color==='g')?'derived-on-'+lamp.color:''));
    style(lamp.unknown,'display',value==null&&lamp.color==='g'?'':'none');
    const text=lamp.name+' · '+(lamp.crossing?'vägövergång · '+(value===true?crossingDisplays[crossingDisplay].label:value===false?'släckta lampor':'okänt underlag'): 'beräknad panelindikering · '+(value===true?'aktivt underlag':value===false?'inaktivt underlag':'okänt underlag'));
    attribute(lamp.g,'aria-label',text+' · '+(lamp.crossing?(lamp.color==='g'?'vänster':'höger'):lamp.color));
  }
  for(const button of $('derived-indications').querySelectorAll('button')) {
    const crossing=button.dataset.crossing==='true',indication=state.panelIndications?.[button.dataset.indication];
    const value=fresh?(crossing?indication?.warning?.value:indication?.value):null;
    button.dataset.value=value===true?'active':value===false?'inactive':'unknown';
    button.querySelector('span').textContent=value==null?'?':crossing?(value?'Varnar':'Släckt'):'';
    button.title=button.dataset.indication+' · Beräknad panelindikering, ingen bomkvittens';
    button.setAttribute('aria-label',button.dataset.indication+' · '+(crossing?(value===true?crossingDisplays[crossingDisplay].label:value===false?'släckta lampor':'okänt underlag'):(value===true?'aktivt':value===false?'inaktivt':'okänt')+' underlag')+' · detaljer');
  }
  const preparing=preparingEndpoints(state.routes,usable()&&!state.controls?.stopAll);
  for (const b of buttons) {
    const preparingRole=b.isRoute?preparing.get(b.id):null;
    b.g.classList.toggle('route-preparing',!!preparingRole);
    attribute(b.g,'data-preparing-endpoint',preparingRole||'');
    if(b.isRoute){
      const selectedStart=chosenKind==='main'&&b.id===chosen,selectedEnd=routeConfirmation.selection?.kind==='main'&&b.id===routeConfirmation.selection.to;
      b.g.classList.toggle('route-choice-start',selectedStart);b.g.classList.toggle('route-choice-end',selectedEnd);
      attribute(b.g,'aria-pressed',selectedStart||selectedEnd);
      attribute(b.g,'aria-busy',!!preparingRole||!!routeConfirmation.selection&&(selectedStart||selectedEnd));
      attribute(b.g,'aria-description',selectedEnd?'Vald slutpunkt · bekräftar tågvägsval.':selectedStart?'Vald startpunkt · välj slutplupp.':preparingRole?(preparingRole==='start'?'Startpunkt':'Slutpunkt')+' · Tågvägen förbereds.':'');
    }
    b.g.classList.toggle('chosen', b.id === chosen); b.g.classList.toggle('unavailable', !b.available || (b.names.length && state.manual?.[b.names[0]]?.allowed===false));
    b.g.classList.toggle('locked',!!state?.routes.some(r=>b.names.some(n=>r.turnouts[n]))||(state.operating?.programming?.reserved&&b.names.includes('Vx133')));
    b.g.classList.toggle('line-is-blocked',!!state.operating?.lines.some(l=>l.blocked&&l.button===b.id));
  }
  for (const [id, data] of routeNodes) if (!state?.routes.some(r => r.id === id)) { data.g.remove(); routeNodes.delete(id); }
  for (const r of state?.routes || []) {
    if (!routeNodes.has(r.id)) {
      const g = svg('g', {}, $('flow-layer'));
      const presentation=routePresentation(r,panel,config,layout.controls);
      const parts = presentation.parts.map(part => {
        const node = svg('line', { x1: part.x1, y1: part.y1, x2: part.x2, y2: part.y2, class: 'route-flow' }, g);
        const lamps = [];
        const count=part.length<26?1:Math.max(1,Math.round(part.length/78));
        for(let j=0;j<count;j++){const dist=(j+.5)/count*part.length; lamps.push({at:part.distance+dist,node:svg('circle',{cx:part.x1+(part.x2-part.x1)*(j+.5)/count,cy:part.y1+(part.y2-part.y1)*(j+.5)/count,r:3.4,class:'lamp'},g)});}
        return { ...part, node, lamps };
      });
      routeNodes.set(r.id, { g, parts, members:presentation.members, total:presentation.total, timing:{} });
    }
  }
}
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function animateFlow(now=performance.now()) {
  if(currentPage!=='panel'||document.hidden)return false;
  let moving=false;
  const buttonPhases=new Map(),priority={active:1,held:2,occupied:3};
  for (const r of state?.routes || []) {
    const entry = routeNodes.get(r.id); if (!entry) continue;
    const total = entry.total;
    const fresh=online&&state.connection==='connected';
    const fraction = fresh ? flowProgress(r,entry.timing,now,state.serverTime,reducedMotion.matches) : 1;
    if(fresh&&r.state==='establishing'&&fraction<1&&!reducedMotion.matches)moving=true;
    const status = !fresh ? 'held' : r.state;
    for(const member of entry.members){
      const phase=routeButtonPhase(r,member,{connection:fresh?'connected':'disconnected',blocks:state.blocks},fraction,total);
      if(!buttonPhases.has(member.id)||priority[phase]>priority[buttonPhases.get(member.id)])buttonPhases.set(member.id,phase);
    }
    for (const part of entry.parts) {
      const lit = Math.max(0, Math.min(part.length, fraction * total - part.distance));
      const occupied = fresh && state.blocks[part.block]?.occupied === true;
      attribute(part.node,'class','route-flow ' + status);
      style(part.node,'visibility',occupied||hasTrackRestriction(part.block)||blockedLineParts.has(part.id) ? 'hidden' : '');
      if (r.state === 'establishing' && fresh) attribute(part.node,'stroke-dasharray',`${lit} ${part.length + 1}`);
      else if(part.node.hasAttribute('stroke-dasharray'))part.node.removeAttribute('stroke-dasharray');
      for (const lamp of part.lamps) style(lamp.node,'visibility',!occupied && !hasTrackRestriction(part.block) && !blockedLineParts.has(part.id) && ['establishing', 'clearing', 'active', 'traversing'].includes(status) && lamp.at <= fraction * total ? 'visible' : 'hidden');
    }
  }
  for(const b of buttons){
    const phase=buttonPhases.get(b.id);
    b.g.classList.toggle('in-route',!!phase);attribute(b.g,'data-route-phase',phase||'');
  }
  return moving;
}
const statuses = { setting: 'Lägger växlar', establishing: 'Etablerar', clearing: 'Klarsätter', active: 'Klar', traversing:'Tåg passerar', held: 'Stopp · lås kvar', occupied: 'Lås kvar', cancelling: 'Återtar' };
const frames=createPanelFrames({render:renderPanel,animate:animateFlow});
routeConfirmation=createRouteConfirmation({submit:({from,to})=>api('route',{from,to}),valid:()=>!!routeConfirmation.selection&&routeTargets.has(routeConfirmation.selection.to)&&usable()&&!pending&&state.controls?.mode!=='remote'&&!['waiting','interrupted'].includes(state.panelReset?.phase),onChange:finished=>{if(finished)clearChoice(false);paint();}});
function paint(){frames.paint();}
function renderPanel() {
  if (!state) return;
  sourceRegister?.updateState(state,online);
  trainInformation?.update(state,online);
  telegramRecorder?.update(state,online);
  operatingControls?.update(state,online);
  if(state.clock)modelClock?.update(state.clock,online);
  trainMeet?.update(state.trainMeet,online,state.timetableImport,{routes:state.routes||[]});
  clearanceView?.update(state.trainMeet,online);
  streamDeck?.update();
  if(state.streamDeck)streamDeckEditor?.update(state.streamDeck,online);
  timetableImport?.update(state.timetableImport,online);
  if(chosen && (!usable() || state.controls?.mode==='remote')) clearChoice(false);
  const c = $('connection'); setText(c,!online ? 'Kontakt med kärnan saknas' : state.storageFault ? 'Lagringsfel · spärrad' : state.connection === 'connected' ? (state.connectionInfo?.mode==='simulator'?'Simulator ansluten':'LocoNet ansluten') : (state.connectionInfo?.mode==='simulator'?'Simulator frånkopplad':'LocoNet frånkopplad'));
  c.className = 'connection ' + (usable() ? 'online' : 'offline');
  setText($('panel-connection'),c.textContent);attribute($('panel-connection'),'class',c.className);
  if(currentPage==='panel')paintPlan();
  paintInspector(); manualFeedback?.update(); syncChoiceControls();
  document.body.dataset.panelReady='true';
  const resetting=['waiting','interrupted'].includes(state.panelReset?.phase);
  $('ais-status').hidden = !state.controls?.stopAll||resetting;
  $('all-stop').disabled = !online;
  $('emergency-cancel').disabled = !online;
  const remote=state.controls?.mode==='remote', emergency=state.controls?.emergency, remaining=state.emergencyRemaining?.length||0;
  $('control-mode').textContent=remote?'Fjärrläge · lokal manövrering spärrad':'Lokal manövrering';
  $('remote-notice').hidden=!remote;
  $('toggle-authority').title=remote?'Återgå till lokal manövrering':'Växla till fjärrläge';
  $('toggle-authority').disabled=!online||pending||!state.modeChange?.allowed;
  $('mode-reason').textContent=state.modeChange?.allowed?'':state.modeChange?.reason||'';
  $('emergency-status').hidden=resetting||!emergency||(!state.controls.stopAll&&!remaining);
  $('emergency-status').textContent=remaining?`Nödåtertagning pågår · ${remaining} av ${emergency.routeIds.length} tågvägslås kvar. Fria spår, kända växellägen och nya stoppbesked krävs. Efter omstart: begär återtagning igen.`:emergency?'Nödåtertagning färdig · alla berörda lås är frigivna. Återställ AIS när anläggningen har kontrollerats.':'';
  $('ais-text').textContent=remaining?'AIS aktiv · nödåtertagning pågår, låsen skyddar kvarvarande vägar':'AIS aktiv · alla körmedgivanden återkallade';
  $('reset-ais').disabled = !state.controls?.stopAll || !usable() || pending || !state.allStopReset?.allowed;
  $('reset-ais').title=state.allStopReset?.reason||'';
  const blocks=state.controls?.blocked || [];
  $('blocked-count').textContent=blocks.length ? `· ${blocks.length} spärrade` : '';
  html('blocked-list',blocks.map(n=>`<span class="field-chip blocked-chip">${esc(displayName('blocks',n))} · spärrat</span>`).join(''));
  $('toggle-block').textContent = isBlocked($('block-choice').value)?'Ta bort spärr':'Spärra spår';
  $('toggle-block').disabled = !online || pending || !!state.storageFault || (remote&&isBlocked($('block-choice').value));
  for (const b of $('route-catalog').querySelectorAll('button')) b.disabled = !usable() || pending || remote;
  html('active-routes', state.routes.map(r => `<div class="route-item"><strong>${esc(displayName('routes',r.definitionId,r.label))}<span class="route-state ${esc(r.state)}">${esc(statuses[r.state])}</span></strong><small>${esc(r.reason)}${r.passage&&r.enteredAt?' · '+r.passage.filter(p=>p.state==='clear').length+'/'+r.passage.length+' avsnitt passerade':''}</small><button data-cancel="${esc(r.id)}" ${!online || r.cancelRequested ? 'disabled' : ''}>${r.cancelRequested ? 'Inväntar frigivning' : 'Återta'}</button></div>`).join(''));
  $('route-activity').hidden=!state.routes.length;
  $('route-summary').textContent=`${state.routes.length} ${state.routes.length===1?'tågväg':'tågvägar'} · ${state.routes.map(r=>statuses[r.state]).filter((v,i,a)=>a.indexOf(v)===i).join(' / ')}`;
  $('event-status').textContent = state.routes.length + ' tågvägslås · ' + Object.keys(config.turnouts).length + ' anslutna växlar';
  html('events', state.events.filter(e => !['report', 'transport'].includes(e.kind)).slice(0, 7).map(e => `<div class="event-row"><time>${time(e.at)}</time><span>${esc(e.message)}</span></div>`).join(''));
  $('wire').textContent = (state.trace || []).slice(0, 40).map(e => `${time(e.at)}  ${e.direction === 'out' ? 'SKICKAT ' : 'MOTTAGET'}  ${e.hex}`).join('\n');
  panelConsole?.update(state,online);panelEvents?.update(state,online);panelHead?.update(headStatus());
}
function paintInspector() {
  if (!inspected || !state) return;
  $('inspect-turnout').value=inspected.kind==='turnout'?inspected.name:'';
  if(inspected.kind==='turntable'){
    html('inspector','<dl><dt>Läge</dt><dd>Okänt · lägesåterkoppling saknas</dd></dl><p class="muted">Spårbryggan visas schematiskt. Sensorerna behöver kopplas till vändskivans lägen innan panelen kan visa vilken spåranslutning som är bekräftad.</p>');
    return;
  }
  if(inspected.kind==='block'){
    const name=inspected.name,reasons=trackRestrictions(config,state).get(config.blocks[name]?.address)||[];
    const occupied=online&&state.connection==='connected'?state.blocks[name]?.occupied:null;
    html('inspector',`<dl><dt>Spårledning</dt><dd>${esc(displayName('blocks',name))}</dd><dt>Spärr</dt><dd>${esc(reasons.join(' · ')||'Ingen spärr')}</dd><dt>Beläggning</dt><dd>${occupied===true?'Belagt':occupied===false?'Fritt':'Okänd · återrapport saknas'}</dd></dl><p class="muted">Streckat spår med dubbla tvärstreck visar spärr. Rött visar beläggning även när spåret är spärrat. Spärren ändras under Driftverktyg.</p>`);
    return;
  }
  if(inspected.kind==='indication')return paintIndication(inspected.name);
  const { kind, name } = inspected, b = kind === 'signal' ? config.signals[name] : config.turnouts[name];
  const sourceKind = kind === 'signal' ? 'signals' : 'layoutTurnouts';
  const sourceButton = `<a href="#register/station?object=${encodeURIComponent((kind==='signal'?'signals:':'turnouts:')+name)}">Visa i anläggningsöversikten →</a><button class="source-inspect" data-source-kind="${sourceKind}" data-source-name="${esc(name)}">${kind === 'signal' ? 'Signalbesked och källuppgifter' : 'Visa alla källuppgifter'} →</button>`;
  const original = kind === 'signal' ? registry.signals.find(r=>r.id===name) : null;
  const presentationKind=kind==='signal'?'signals':'turnouts', display=displayName(presentationKind,name), description=presentationDescription(presentationKind,name);
  const sourceInfo = (display!==name?`<h2>${esc(display)}</h2>`:'')+(description?`<p>${esc(description)}</p>`:'')+(original ? `<p class="muted">${esc(original.type)} · Besked i XML: ${esc(original.aspects.join(', '))}</p>` : '');
  if (!b) { html('inspector', `<h2>${kind === 'signal' ? 'Signal' : 'Växel'} ${esc(name)}</h2><p class="muted">Importerad från JMRI. Återrapport och manövrering är ännu inte inkopplade för detta objekt.</p>` + sourceInfo + sourceButton); return; }
  const s = kind === 'signal' ? state.signals[name] : state.turnouts[name];
  const locked = state.routes.filter(r => kind === 'signal' ? r.signals.includes(name) : r.turnouts[name]);
  const value = !online ? 'Okänt' : kind === 'signal' ? ({ go: 'Kör återrapporterat', stop: 'Stopp återrapporterat', unknown: 'Okänt besked' }[s.aspect]) : ({ C: 'Rakt', T: 'Avvikande', unknown: 'Okänt / omläggning' }[s.position]);
  const manual=state.manual?.[name], manualNotice=kind==='turnout'&&manual?`<p class="muted">${esc(manual.reason)}</p>`:'';
  const programLock=kind==='turnout'&&name==='Vx133'&&state.operating?.programming?.reserved;
  const detail = `<dl><dt>${kind === 'signal' ? 'Signal' : 'Växel'}</dt><dd><strong>${esc(name)}</strong></dd><dt>Rapporterat</dt><dd>${esc(value)}</dd><dt>Tågvägslås</dt><dd>${esc(locked.map(r => r.label).join(', ') || 'Inga')}</dd>${programLock?'<dt>Programmeringsspärr</dt><dd>Lastspår 3 · lås kvar</dd>':''}<dt>${kind === 'signal' ? 'Provadress / råkod' : 'Källadress'}</dt><dd>${kind === 'signal' ? b.address + ' / ' + (s.code ?? '—') : esc(b.source) + (b.inverted ? ' · inverterad' : '')}</dd></dl>`;
  html('inspector', detail + sourceInfo + sourceButton + manualNotice + (kind === 'turnout' ? `<div class="actions"><button data-manual="C" ${locked.length || !usable() || manual?.allowed===false ? 'disabled' : ''}>Lägg rakt</button><button data-manual="T" ${locked.length || !usable() || manual?.allowed===false ? 'disabled' : ''}>Lägg avvikande</button></div>` : `<p class="muted">Beskedskoderna är en preliminär provmappning. Fullständiga svenska signalbilder kräver verifiering mot din MGP-utrustning.</p>`));
}
function paintIndication(name) {
  const def=config.panelIndications.indicators.find(i=>i.name===name),s=state.panelIndications?.[name];
  if(def.crossing) {
    const warning=s?.warning,fresh=online&&state.connection==='connected'&&!state.storageFault,value=fresh?warning?.value:null;
    const causes=fresh?(warning?.conditions||[]).filter(c=>c.value!==false):[];
    html('inspector',`<h2>${esc(name)} · vägövergång</h2><dl><dt>Lampor</dt><dd>${value===true?crossingDisplays[crossingDisplay].label:value===false?'Släckta':'Okänt underlag · frågetecken'}</dd><dt>Korsande block</dt><dd>${def.crossing.blocks.map(n=>esc(displayName('blocks',n))).join(', ')}</dd><dt>Kända villkor</dt><dd>${fresh?warning?.known||0:0} av ${warning?.total||def.crossing.blocks.length+1}</dd></dl><p class="muted">Varnar så länge en tågväg över strecket är reserverad eller ett korsande block är belagt. Lamporna släcks när reservationerna är frigivna och alla korsande block är bekräftat fria.</p><p class="muted">${crossingDisplays[crossingDisplay].description} Inställningen gäller panelens visning; ingen fysisk bomkvittens.</p>${causes.length?`<ul class="indication-causes">${causes.map(c=>`<li><strong>${esc(c.label)}</strong> · ${esc(c.reason)}</li>`).join('')}</ul>`:''}<button class="source-inspect" data-source-kind="conditionals" data-source-name="${esc(def.name)}">Visa ursprunglig XML-regel →</button>`);
    return;
  }
  const fresh=online&&state.connection==='connected'&&!state.storageFault,value=fresh?s?.value:null;
  const important=fresh?(s?.conditions||[]).filter(c=>c.value!==false):[];
  html('inspector',`<h2>${esc(name)} · panelindikering</h2><dl><dt>Beräknat läge</dt><dd>${value===true?'Aktivt underlag · grön lampa':value===false?'Inaktivt underlag · röd lampa':'Okänt underlag · inget fastställt läge'}</dd><dt>Kända villkor</dt><dd>${fresh?s?.known||0:0} av ${s?.total||def.conditions.length}</dd></dl><p class="muted">Indikering från tågvägar och sensorrapporter. Ingen fysisk bomkvittens eller bommanöver.</p><p class="muted">Ett aktivt villkor räcker för grön indikering. Röd kräver att alla villkor är kända och inaktiva. Tågväg som läggs, återtas eller hålls kvar ger okänt NX-villkor.</p>${important.length?`<ul class="indication-causes">${important.map(c=>`<li><strong>${esc(c.label)}</strong> · ${esc(c.reason)}</li>`).join('')}</ul>`:''}<button class="source-inspect" data-source-kind="conditionals" data-source-name="${esc(def.name)}">Visa källregeln och alla villkor →</button>`);
}
async function start() {
  appMenu=adminNavigation;
  contextDialog=createContextDialog({dialog:$('inspector-host'),onClose:()=>{$('inspector-home').append($('inspector-card'));manualFeedback?.clear();}});
  const fullscreen = createFullscreen({button: $('toggle-fullscreen'), onError: message});
  telegramRecorder=createTelegramRecorder();
  operatingControls=createOperatingControls({api,openSource});
  timetableImport=createTimetableImport();modelClock=createModelClock({api});trainMeet=createTrainMeet({api,onTimetable:()=>openTools('trainmeet-timetable'),stationHint:()=>config?.profile?.title||'Charlottendal'});feedback=createFeedback();clearanceView=createClearance({api,message});
  panelConsole=createPanelConsole({onOpen:()=>{appMenu?.close();},onResetComplete:text=>message(text,{error:false,duration:4000})});panelEvents=createPanelEvents();
  [config, panel, registry, signalEndpoints] = await Promise.all(['/api/config', '/data/panel.json', '/data/source/signals.json', '/data/signal-endpoints.json'].map(async url => { const r = await fetch(url); if (r.status === 401 || r.status === 428) { location.assign('/login'); throw Error('Inloggning krävs'); } if (!r.ok) throw Error('Kunde inte läsa underlaget'); return r.json(); }));
  const files = [...new Set([...Object.values(iconTypes).flatMap(a => a.slice(0, 3)), 'Hsi0+Sh1', 'Hdvsi0+Sh1'])];
  // Loading a missing or slow icon must not prevent the track plan from starting.
  // Each displayed variant is decoded before it can replace the dark indication.
  const preload=Promise.allSettled(files.map(async file => { const i = new Image(); imageCache.push(i); i.src = icon(file); await i.decode(); decodedIcons.add(file); }))
    .then(results => { if(results.some(r=>r.status==='rejected')) message('En signalbild kunde inte laddas. Berörd signal visas som okänd.');paint(); });
  let preloadTimer;
  await Promise.race([preload,new Promise(resolve=>{preloadTimer=setTimeout(resolve,2000);})]);
  clearTimeout(preloadTimer);
  sourceRegister = createSourceRegister({config,panel,saveNote:(key,note)=>api('note',{key,note}),onActive:applyPresentation});
  signalControls=signalRouteControls(config,registry,signalEndpoints);
  buildPlan();
  const deckPluppar=()=>buttons.filter(b=>b.isRoute).map(b=>({id:b.id,kind:b.kind,node:b.g,label:label(b.id)}));
  streamDeck=createStreamDeck({pluppar:deckPluppar,choose,clearChoice,api,message,state:()=>state,online:()=>online&&state?.connection==='connected',chosen:()=>chosen,trainMeet:()=>state?.trainMeet,layout:()=>state?.streamDeck});
  streamDeckEditor=createStreamDeckEditor({api,message,pluppar:deckPluppar,lines:()=>state?.trainMeet?.context?.lines||[],deck:streamDeck});
  trainInformation=createTrainInformation({catalog:config.trainFields,controls:layout.controls,plan:$('track-plan'),displayName,openSource,onOpen:()=>openTools('train-information')});
  $('close-inspector').onclick=()=>closeInspector();
  $('dismiss-message').onclick=()=>message('');

  $('block-choice').innerHTML=Object.keys(config.blocks).sort((a,b)=>a.localeCompare(b,'sv',{numeric:true})).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $('block-choice').onchange=paint;
  $('inspect-turnout').innerHTML='<option value="">Välj växel för information…</option>'+[...new Set(Object.values(panel.turnouts).map(t=>t.name))].sort((a,b)=>a.localeCompare(b,'sv',{numeric:true})).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $('inspect-turnout').onchange=()=>{const name=$('inspect-turnout').value;if(name)showInspector('turnout',name);else manualFeedback.clear();};
  $('toggle-block').onclick=()=>api('track-block',{name:$('block-choice').value,blocked:!isBlocked($('block-choice').value)});
  $('all-stop').onclick=()=>api('all-stop',{enabled:true});
  $('emergency-cancel').onclick=()=>api('emergency-cancel',{});
  $('toggle-authority').onclick=async()=>{if(await api('control-mode',{mode:state.controls.mode==='remote'?'local':'remote'}))clearChoice();};
  $('reset-ais').onclick=()=>api('all-stop',{enabled:false});
  $('account-link').hidden = !config.accountUrl;
  adminNavigation.setAccount(!!config.accountUrl);
  $('field-link').href = config.fieldUrl || 'http://127.0.0.1:8911/'; $('field-link').hidden = false;
  $('route-catalog').innerHTML=`<label>Från<select id="catalog-from"></select></label><label>Till<select id="catalog-to"></select></label><button id="catalog-request" class="primary" disabled>Lägg / återta tågväg</button><p id="catalog-hint" class="muted" hidden></p>`;
  function catalogHint(){const ids=[$('catalog-from').value,$('catalog-to').value].filter(id=>config.buttons[id]?.presentation==='catalog');$('catalog-hint').hidden=!ids.length;$('catalog-hint').textContent=ids.map(label).join(', ')+' väljs i listan. Använd Lägg / återta tågväg även för återtagning.';}
  function catalogOrder(ids){return $('route-mode').value==='shunt'?ids.sort((a,b)=>label(a).localeCompare(label(b),'sv',{numeric:true})):ids;}
  function targets(){const from=$('catalog-from').value;$('catalog-to').innerHTML=catalogOrder(config.routes.filter(r=>r.from===from).map(r=>r.to)).map(id=>`<option value="${esc(id)}">${esc(label(id))}</option>`).join('');catalogHint();}
  $('catalog-to').onchange=catalogHint;
  function routeMode(){ const mode=$('route-mode').value; document.body.dataset.routeMode=mode; clearChoice(); const starts=catalogOrder([...new Set(config.routes.filter(r=>(r.kind||'main')===mode).map(r=>r.from))]); $('catalog-from').innerHTML=starts.map(id=>`<option value="${esc(id)}">${esc(label(id))}</option>`).join('');targets(); }
  $('route-mode').onchange=()=>{$('catalog-mode').value=$('route-mode').value;routeMode();}; $('catalog-mode').onchange=()=>{$('route-mode').value=$('catalog-mode').value;routeMode();}; $('catalog-from').onchange=targets;routeMode();
  function resetPanelChoices() {
    closeInspector(false);inspected=null;$('inspect-turnout').value='';
    manualFeedback.clear();
    $('route-mode').value=$('catalog-mode').value='main';routeMode();
    // Clear only transient panel choices. Keep the mounted plan, detector reports,
    // viewport, appearance and any unfinished administrative edits intact.
    if($('track-plan').contains(document.activeElement))document.activeElement.blur();
  }
  $('yard-authority').onclick=()=>api('yard-authority',{owner:state.yard.owner==='ranger'?'tkl':'ranger',sessionId:state.operating.sessionId,revision:state.operating.revision});
  $('panel-reset').onclick=()=>{message('');resetPanelChoices();return api('panel-reset',{});};
  $('catalog-request').onclick=()=>api('route',{from:$('catalog-from').value,to:$('catalog-to').value});
  $('active-routes').onclick = e => { const id = e.target.closest('button')?.dataset.cancel; if (id) api('cancel', { id }); };
  $('inspector').onclick = e => { const source=e.target.closest('[data-source-kind]'); if(source) { openSource(source.dataset.sourceKind,source.dataset.sourceName); return; } const position = e.target.closest('button')?.dataset.manual; if (position) manualTurnout(inspected.name, position); };
  $('clear-selection').onclick = ()=>clearChoice();
  document.addEventListener('keydown', e => { if(e.key==='Escape'){if(document.querySelector('.admin-dialog[open]'))return;if($('inspector-host').open){e.preventDefault();closeInspector();return;}if(fullscreen.active()){fullscreen.exit();return;}manualFeedback.clear();clearChoice();} });
  // Original is the only active panel. Retired skin preferences must not restore it differently.
  try{localStorage.removeItem('charlottendal-skin');}catch{}
  const panelZoom=createPanelZoom({plan:$('track-plan'),viewport:document.querySelector('.panel-scroll'),stage:$('plan-stage'),controls:$('panel-console')});
  const zoomDialog=createZoomDialog(panelZoom);
  panelHead=createPanelHead({shell:document.querySelector('#panel-view .panel-shell'),onZoom:()=>zoomDialog.open()});
  createPanelSplit({bottom:$('panel-bottom'),viewport:document.querySelector('.panel-scroll')});panelZoom.subscribe(value=>panelHead?.zoom(value));
  // Återställ panel and Lämna över rangerbangården sit beside the zoom chip; the console row under the plan is gone.
  document.getElementById('plan-head-zoom')?.before($('panel-quick-actions'));
  panelZoom.subscribe(value=>{$('menu-zoom-value').textContent=zoomLabel(value);});
  $('open-panel-zoom').onclick=e=>{e.preventDefault();e.stopPropagation();appMenu.close();zoomDialog.open();};
  createAdminAppearance({zoom:panelZoom});
  for(const id of ['appearance','journal','streamdeck'])registerAdminWorkspace('#tools/'+id,$(id+'-tools'));
  for(const id of ['xml','migration','protocol'])registerAdminWorkspace('#advanced/'+id,$('advanced-'+id));
  document.addEventListener('click',e=>{
    const section=e.target.closest('[data-tools-section]');
    if(section){e.preventDefault();openTools(section.dataset.toolsSection);return;}
    const link=e.target.closest('a[href^="#"]');
    if(link?.getAttribute('href')?.startsWith('#register/station'))closeInspector(false);
    const page={'#panel':'panel','#tools':'tools','#register':'admin','#trainmeet':'trainmeet','#import':'import','#advanced':'advanced'}[link?.getAttribute('href')];
    if(page){e.preventDefault();setPage(page);}
  });
  window.addEventListener('hashchange',()=>setPage(pageFromHash(),{historyMode:'none'}));
  setPage(pageFromHash(),{historyMode:'replace'});
  applyPresentation(config.presentation);
  const source = new EventSource('/api/events');
  let presentationLoading=false,observedResetId;
  source.onmessage = e => {
    state = JSON.parse(e.data);if(state.bindingVersion!==config.bindingVersion){location.reload();return;} online = true; lastEvent = Date.now();
    panelHead?.release(state.release&&config.release&&state.release!==config.release?state.release:null);
    // A quick reset may finish between two snapshots. Use its identity, not a
    // waiting/stop transition, so every open panel clears its local buttons once.
    const resetId=state.panelReset?.id;
    if(resetId&&resetId!==observedResetId)resetPanelChoices();
    observedResetId=resetId;paint();
    if(!presentationLoading && state.configurationVersion!==config.presentation?.activeVersion) {
      presentationLoading=true;
      fetch('/api/presentation').then(r=>{if(!r.ok)throw Error('Kunde inte hämta nya visningsinställningar.');return r.json();}).then(applyPresentation).catch(e=>message(e.message)).finally(()=>{presentationLoading=false;});
    }
  };
  source.onerror = () => { online = false; paint(); };
  setInterval(() => { if (Date.now() - lastEvent > 3000 && online) { online = false; paint(); } }, 750);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)frames.stop();else paint();});
  reducedMotion.addEventListener('change',paint);
}
start().catch(e => { message('Startfel: ' + e.message); for(const id of ['connection','panel-connection'])$(id).textContent='Kunde inte starta panelen'; });
