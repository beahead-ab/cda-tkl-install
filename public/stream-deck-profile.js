// Stream Deck layouts as saved data: which key does what, per model and page.
// Pure, shared by the server (validation) and the panel (editor and deck).
import {SYSTEM_KEYS,buildPages} from './stream-deck-layout.js';
export const MODELS={
  mini:{name:'Stream Deck Mini',columns:3,rows:2},
  mk2:{name:'Stream Deck MK.2 / Original',columns:5,rows:3},
  xl:{name:'Stream Deck XL',columns:8,rows:4},
  plus:{name:'Stream Deck +',columns:4,rows:2},
  neo:{name:'Stream Deck Neo',columns:4,rows:2}
};
export const SYSTEM_IDS=SYSTEM_KEYS.map(k=>k.id);
export const keyCount=model=>MODELS[model]?MODELS[model].columns*MODELS[model].rows:0;
export const modelFor=(columns,rows)=>Object.keys(MODELS).find(m=>MODELS[m].columns===columns&&MODELS[m].rows===rows)||'';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const clean=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
function normalizeKey(key,{pluppIds,pageCount,page,index}){
  if(key==null)return null;
  const where=`sida ${page}, knapp ${index+1}`;
  if(!record(key))fail(`Ogiltig knapp på ${where}.`);
  switch(key.type){
    case 'plupp':if(!pluppIds.has(key.id))fail(`Pluppen ${clean(key.id,64)?key.id:'?'} på ${where} finns inte i anläggningen.`);return {type:'plupp',id:key.id};
    case 'system':if(!SYSTEM_IDS.includes(key.id))fail(`Okänd driftknapp på ${where}.`);return {type:'system',id:key.id};
    case 'train':if(!['departure','arrival'].includes(key.role)||!clean(key.lineId,128)||!key.lineId.trim())fail(`Ogiltig sträckknapp på ${where}.`);return {type:'train',role:key.role,lineId:key.lineId};
    case 'page':if(!Number.isInteger(key.target)||key.target<0||key.target>=pageCount)fail(`Sidbytet på ${where} pekar på en sida som inte finns.`);return {type:'page',target:key.target};
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
    if(key.type==='system')return {type:'system',...SYSTEM_KEYS.find(k=>k.id===key.id)};
    if(key.type==='page')return {type:'page',target:key.target,title:layout.pages[key.target]?.name||`Sida ${key.target+1}`};
    if(key.type==='plupp'){const p=byId.get(key.id);return p?{type:'plupp',id:p.id,kind:p.kind,label:p.label,node:p.node}:{type:'missing',title:'Saknas',label:key.id};}
    const line=lineById.get(key.lineId);
    return line?{type:'train',role:key.role,lineId:line.id,neighborId:line.neighborId,neighborName:line.neighborName,neighborCode:line.neighborCode||''}:{type:'missing',title:'Sträcka saknas',label:key.role==='departure'?'→':'←'};
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
export function changeModel(layout,model){
  const count=keyCount(model);if(!count)fail('Okänd Stream Deck-modell.');
  return {model,pages:layout.pages.map(p=>({...p,keys:Array.from({length:count},(_,k)=>p.keys[k]??null)}))};
}
export function keyLabel(key,{pluppar=[],lines=[]}={}){
  if(!key)return '';
  if(key.type==='system')return SYSTEM_KEYS.find(k=>k.id===key.id)?.title||key.id;
  if(key.type==='page')return 'Sida → '+(key.target+1);
  if(key.type==='plupp')return pluppar.find(p=>p.id===key.id)?.label||key.id;
  const line=lines.find(l=>l.id===key.lineId);return (key.role==='departure'?'→ ':'← ')+(line?.neighborCode||line?.neighborName||key.lineId);
}
