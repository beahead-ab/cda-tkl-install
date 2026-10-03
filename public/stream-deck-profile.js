// Stream Deck layouts as saved data: which key does what, per model and page.
// Pure, shared by the server (validation) and the panel (editor and deck).
import {SYSTEM_KEYS,buildPages} from './stream-deck-layout.js';
import {ICON_IDS} from './stream-deck-icons.js';
export const MODELS={
  mini:{name:'Stream Deck Mini',short:'Mini',columns:3,rows:2},
  mk2:{name:'Stream Deck MK.2 / Original',short:'MK.2',columns:5,rows:3},
  xl:{name:'Stream Deck XL',short:'XL',columns:8,rows:4},
  plus:{name:'Stream Deck +',short:'+',columns:4,rows:2},
  neo:{name:'Stream Deck Neo',short:'Neo',columns:4,rows:2}
};
export const SYSTEM_IDS=SYSTEM_KEYS.map(k=>k.id);
export const keyCount=model=>MODELS[model]?MODELS[model].columns*MODELS[model].rows:0;
export const modelFor=(columns,rows)=>Object.keys(MODELS).find(m=>MODELS[m].columns===columns&&MODELS[m].rows===rows)||'';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const clean=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
// Tåg på tur: which trains a key may follow, and how many places in the turn there are.
export const TURN_FILTERS={all:'Alla tåg',arrivals:'Bara ankomster',departures:'Bara avgångar',yard:'Spår 11–13 (rangerbangården)',line:'En sträcka'};
export const TURN_SLOTS=12;
export const NAV_TARGETS={next:'Nästa sida',prev:'Föregående sida',home:'Första sidan'};
export const HOLDS=[0,1000,2000];
// Every key may carry its own short text. Operating, page and navigation keys may also
// carry an icon; a route or a train always shows its state with the panel's colours.
// Any key but a train key (whose long press already cancels or rejects) may require a hold.
export const ICON_TYPES=new Set(['system','page','nav']);
export const HOLD_TYPES=new Set(['system','page','nav','plupp']);
function extras(key,where){
  const out={};
  if(key.label!=null&&key.label!==''){if(!clean(key.label,24))fail(`Texten på ${where} får ha högst 24 tecken.`);const label=key.label.trim();if(label)out.label=label;}
  if(ICON_TYPES.has(key.type)&&key.icon!=null&&key.icon!==''){if(!ICON_IDS.includes(key.icon))fail(`Okänd bild på ${where}.`);out.icon=key.icon;}
  if(HOLD_TYPES.has(key.type)&&key.hold!=null&&key.hold!==0){if(!HOLDS.includes(key.hold))fail(`Ogiltig hålltid på ${where}.`);out.hold=key.hold;}
  return out;
}
function normalizeKey(key,{pluppIds,pageCount,page,index}){
  if(key==null)return null;
  const where=`sida ${page}, knapp ${index+1}`;
  if(!record(key))fail(`Ogiltig knapp på ${where}.`);
  switch(key.type){
    case 'plupp':if(!pluppIds.has(key.id))fail(`Pluppen ${clean(key.id,64)?key.id:'?'} på ${where} finns inte i anläggningen.`);return {type:'plupp',id:key.id,...extras(key,where)};
    case 'system':if(!SYSTEM_IDS.includes(key.id))fail(`Okänd driftknapp på ${where}.`);return {type:'system',id:key.id,...extras(key,where)};
    case 'train':if(!['departure','arrival'].includes(key.role)||!clean(key.lineId,128)||!key.lineId.trim())fail(`Ogiltig sträckknapp på ${where}.`);return {type:'train',role:key.role,lineId:key.lineId,...extras(key,where)};
    case 'turn':{
      if(!Number.isInteger(key.slot)||key.slot<1||key.slot>TURN_SLOTS)fail(`Tåg på tur på ${where} har ingen giltig plats.`);
      const filter=key.filter||'all';if(!TURN_FILTERS[filter])fail(`Okänt urval för tåg på tur på ${where}.`);
      if(filter==='line'&&(!clean(key.lineId,128)||!key.lineId?.trim()))fail(`Tåg på tur på ${where} saknar sträcka.`);
      return {type:'turn',slot:key.slot,filter,...(filter==='line'?{lineId:key.lineId}:{}),...(key.details===false?{details:false}:{}),...extras(key,where)};
    }
    case 'page':if(!Number.isInteger(key.target)||key.target<0||key.target>=pageCount)fail(`Sidbytet på ${where} pekar på en sida som inte finns.`);return {type:'page',target:key.target,...extras(key,where)};
    case 'nav':if(!NAV_TARGETS[key.to])fail(`Okänd sidknapp på ${where}.`);return {type:'nav',to:key.to,...extras(key,where)};
    default:fail(`Okänd knapptyp på ${where}.`);
  }
}
export function validateLayout(layout,{pluppIds}){
  const ids=pluppIds instanceof Set?pluppIds:new Set(pluppIds||[]);
  if(!record(layout))fail('Layouten saknas.');
  if(!MODELS[layout.model])fail('Okänd Stream Deck-modell.');
  if(!Array.isArray(layout.pages)||layout.pages.length<1||layout.pages.length>20)fail('En layout har 1–20 sidor.');
  const count=keyCount(layout.model);
  const pages=layout.pages.map((p,i)=>{
    if(!record(p)||!Array.isArray(p.keys)||p.keys.length>count)fail(`Sidan ${i+1} är ogiltig.`);
    const name=clean(p.name,24)&&p.name.trim()?p.name.trim():`Sida ${i+1}`;
    return {name,keys:Array.from({length:count},(_,k)=>normalizeKey(p.keys[k],{pluppIds:ids,pageCount:layout.pages.length,page:i+1,index:k}))};
  });
  return {model:layout.model,pages};
}
// Today's automatic layout as a starting point for editing.
export function defaultLayout(model,pluppar,lines=[]){
  const count=keyCount(model);if(!count)fail('Okänd Stream Deck-modell.');
  return {model,pages:buildPages(pluppar,count,lines).map((keys,i)=>({name:`Sida ${i+1}`,keys:Array.from({length:count},(_,k)=>{const key=keys[k];if(!key)return null;
    if(key.type==='system')return {type:'system',id:key.id};if(key.type==='plupp')return {type:'plupp',id:key.id};return {type:'train',role:key.role,lineId:key.lineId};})}))};
}
export const fits=(layout,deckKeys)=>!!layout&&keyCount(layout.model)<=deckKeys;
// Resolve a saved layout against what the panel knows right now.
export function layoutPages(layout,{pluppar=[],lines=[]}){
  const byId=new Map(pluppar.map(p=>[p.id,p])),lineById=new Map(lines.map(l=>[l.id,l]));
  return layout.pages.map(page=>page.keys.map(key=>{
    if(!key)return null;
    const own={...(key.label?{text:key.label}:{}),...(key.icon?{icon:key.icon}:{}),...(key.hold?{hold:key.hold}:{})};
    if(key.type==='system')return {type:'system',...SYSTEM_KEYS.find(k=>k.id===key.id),...own};
    if(key.type==='page')return {type:'page',target:key.target,title:layout.pages[key.target]?.name||`Sida ${key.target+1}`,...own};
    if(key.type==='nav')return {type:'nav',to:key.to,title:NAV_TARGETS[key.to],...own};
    if(key.type==='turn')return {type:'turn',slot:key.slot,filter:key.filter,lineId:key.lineId||'',details:key.details!==false,...own};
    if(key.type==='plupp'){const p=byId.get(key.id);return p?{type:'plupp',id:p.id,kind:p.kind,label:p.label,node:p.node,...own}:{type:'missing',title:'Saknas',label:key.id};}
    const line=lineById.get(key.lineId);
    return line?{type:'train',role:key.role,lineId:line.id,neighborId:line.neighborId,neighborName:line.neighborName,neighborCode:line.neighborCode||'',...own}:{type:'missing',title:'Sträcka saknas',label:key.role==='departure'?'→':'←'};
  }));
}
// Editing helpers: every change returns a new layout and keeps page targets valid.
export function setKey(layout,page,index,key){
  return {...layout,pages:layout.pages.map((p,i)=>i===page?{...p,keys:p.keys.map((k,j)=>j===index?key:k)}:p)};
}
export function swapKeys(layout,page,a,b){
  const keys=[...layout.pages[page].keys];[keys[a],keys[b]]=[keys[b],keys[a]];
  return {...layout,pages:layout.pages.map((p,i)=>i===page?{...p,keys}:p)};
}
// Move a key to another place, on this page or another; a key already there takes its place.
export function moveKey(layout,from,to){
  if(from.page===to.page&&from.index===to.index)return layout;
  const pages=layout.pages.map(p=>({...p,keys:[...p.keys]}));
  const moving=pages[from.page].keys[from.index],there=pages[to.page].keys[to.index];
  pages[to.page].keys[to.index]=moving;pages[from.page].keys[from.index]=there??null;
  return {...layout,pages};
}
// The first empty place on a page, or -1 when the page is full.
export const firstFree=(layout,page)=>layout.pages[page].keys.findIndex(k=>!k);
// Reorder pages, keeping every page key pointing at the same page as before.
export function movePage(layout,from,to){
  if(from===to)return layout;
  const order=layout.pages.map((_,i)=>i);const [p]=order.splice(from,1);order.splice(to,0,p);
  const where=new Map(order.map((old,now)=>[old,now]));
  return {...layout,pages:order.map(old=>({...layout.pages[old],keys:layout.pages[old].keys.map(k=>k?.type==='page'?{...k,target:where.get(k.target)}:k)}))};
}
// Pluppar of the installation that no page of the layout holds.
export function missingPluppar(layout,pluppar){
  const placed=new Set(layout.pages.flatMap(p=>p.keys).filter(k=>k?.type==='plupp').map(k=>k.id));
  return pluppar.filter(p=>!placed.has(p.id));
}
// How many keys differ between two layouts (a draft against the active one).
export function differences(a,b){
  if(!a||!b)return a||b?Math.max(...[a,b].filter(Boolean).map(l=>l.pages.length*keyCount(l.model))):0;
  let n=0;const pages=Math.max(a.pages.length,b.pages.length),count=Math.max(keyCount(a.model),keyCount(b.model));
  for(let p=0;p<pages;p++){if((a.pages[p]?.name||'')!==(b.pages[p]?.name||''))n++;for(let k=0;k<count;k++)if(JSON.stringify(a.pages[p]?.keys[k]??null)!==JSON.stringify(b.pages[p]?.keys[k]??null))n++;}
  return n;
}
export function addPage(layout,name=''){
  if(layout.pages.length>=20)fail('En layout har högst 20 sidor.');
  return {...layout,pages:[...layout.pages,{name:name.trim()||`Sida ${layout.pages.length+1}`,keys:Array(keyCount(layout.model)).fill(null)}]};
}
export function renamePage(layout,page,name){
  return {...layout,pages:layout.pages.map((p,i)=>i===page?{...p,name:name.trim()||`Sida ${i+1}`}:p)};
}
export function removePage(layout,page){
  if(layout.pages.length<=1)fail('Layouten behöver minst en sida.');
  const pages=layout.pages.filter((_,i)=>i!==page).map(p=>({...p,keys:p.keys.map(k=>k?.type==='page'?(k.target===page?null:{type:'page',target:k.target>page?k.target-1:k.target}):k)}));
  return {...layout,pages};
}
// Adapt a layout to another model, keeping every key in its row and column; keys outside
// a smaller deck are left out.
export function changeModel(layout,model){
  const to=MODELS[model];if(!to)fail('Okänd Stream Deck-modell.');
  const from=MODELS[layout.model]||to;
  return {model,pages:layout.pages.map(p=>({...p,keys:Array.from({length:to.columns*to.rows},(_,k)=>{const row=Math.floor(k/to.columns),column=k%to.columns;return row<from.rows&&column<from.columns?p.keys[row*from.columns+column]??null:null;})}))};
}
export function keyLabel(key,{pluppar=[],lines=[]}={}){
  if(!key)return '';
  if(key.label)return key.label;
  if(key.type==='system')return SYSTEM_KEYS.find(k=>k.id===key.id)?.title||key.id;
  if(key.type==='page')return 'Sida → '+(key.target+1);
  if(key.type==='nav')return NAV_TARGETS[key.to];
  if(key.type==='turn')return 'Tåg '+key.slot+(key.filter&&key.filter!=='all'?' · '+TURN_FILTERS[key.filter].toLowerCase():'');
  if(key.type==='plupp')return pluppar.find(p=>p.id===key.id)?.label||key.id;
  const line=lines.find(l=>l.id===key.lineId);return (key.role==='departure'?'→ ':'← ')+(line?.neighborCode||line?.neighborName||key.lineId);
}
