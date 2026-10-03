// Saved Stream Deck layouts, one per deck. A deck is known by its serial number, so its
// layout follows it to whichever computer it is plugged into. Each deck has a name, the
// model it reported, an active layout and a draft; null means the automatic layout for
// its model. One revision covers the whole document, like the other administrative
// documents. Keys are validated against the installation's own pluppar when saved.
import {validateLayout,changeModel,MODELS} from '../public/stream-deck-profile.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v);
export const MAX_DECKS=16;
export const SERIAL=/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const EMPTY={version:2,revision:0,decks:{},legacy:null};
// Version 1 held one layout for every deck. A deck seen for the first time takes it over
// when it was made for the same model, so nobody loses a layout by updating.
function migrate(data){
  if(record(data)&&data.version===2)return data;
  if(!record(data))return data;
  const legacy=data.active?{layout:data.active,activeVersion:data.activeVersion||0,activatedAt:data.activatedAt||''}:null;
  return {version:2,revision:Number.isSafeInteger(data.revision)?data.revision:0,decks:{},legacy};
}
// A saved layout may name a plupp a later release no longer has; the deck shows it as
// missing instead of the server refusing to start.
const pluppsIn=layout=>(layout?.pages||[]).flatMap(p=>p?.keys||[]).filter(k=>k?.type==='plupp'&&typeof k.id==='string').map(k=>k.id);
export class StreamDeckLayouts{
  constructor(storage,{pluppIds=[],now=()=>new Date().toISOString()}={}){
    this.storage=storage;this.pluppIds=typeof pluppIds==='function'?()=>new Set(pluppIds()):()=>new Set(pluppIds);this.now=now;
    const data=migrate(storage.load('streamdeck.json',EMPTY));
    const bad=why=>{throw Error('Ogiltig sparad Stream Deck-layout'+(why?': '+why:'.'));};
    if(!record(data)||!Number.isSafeInteger(data.revision)||data.revision<0||!record(data.decks))bad();
    const lenient=layout=>{if(layout==null)return null;try{return validateLayout(layout,{pluppIds:new Set([...this.pluppIds(),...pluppsIn(layout)])});}catch(e){bad(e.message);}};
    const decks={};
    for(const [serial,d] of Object.entries(data.decks)){
      if(!SERIAL.test(serial)||!record(d)||!text(d.name,40)||!MODELS[d.model]||typeof d.lastSeen!=='string'||!Number.isSafeInteger(d.activeVersion)||d.activeVersion<0||typeof d.activatedAt!=='string')bad();
      decks[serial]={name:d.name,model:d.model,lastSeen:d.lastSeen,active:lenient(d.active),draft:lenient(d.draft),activeVersion:d.activeVersion,activatedAt:d.activatedAt};
    }
    let legacy=null;
    if(data.legacy!=null){if(!record(data.legacy))bad();legacy={layout:lenient(data.legacy.layout),activeVersion:Number(data.legacy.activeVersion)||0,activatedAt:String(data.legacy.activatedAt||'')};if(!legacy.layout)legacy=null;}
    this.data={version:2,revision:data.revision,decks,legacy};
  }
  view(){return structuredClone(this.data);}
  check(data){if(!data||data.revision!==this.data.revision)fail('Stream Deck-layouten har ändrats. Läs in senaste läget.',409);}
  deck(serial){const d=typeof serial==='string'&&Object.hasOwn(this.data.decks,serial)&&this.data.decks[serial];if(!d)fail('Decket finns inte. Koppla in det så att det känns igen.',404);return d;}
  persist(decks,{bump=true,legacy=this.data.legacy}={}){
    const next={version:2,revision:this.data.revision+(bump?1:0),decks,legacy};
    try{this.storage.save('streamdeck.json',next);}catch{fail('Layouten kunde inte sparas. Den tidigare är kvar.',507);}
    this.data=next;return this.view();
  }
  change(serial,fields){return this.persist({...this.data.decks,[serial]:{...this.deck(serial),...fields}});}
  validate(layout){return validateLayout(layout,{pluppIds:this.pluppIds()});}
  defaultName(model,serial){
    const base='Stream Deck '+MODELS[model].short,taken=new Set(Object.values(this.data.decks).map(d=>d.name));
    return taken.has(base)?base+' '+serial.slice(-4):base;
  }
  // A deck reports itself when a panel opens it. No revision check: the deck does not edit.
  seen(data){
    const serial=data?.serial,model=data?.model;
    if(!SERIAL.test(serial||''))fail('Decket saknar giltigt serienummer.');
    if(!MODELS[model])fail('Okänd Stream Deck-modell.');
    const known=Object.hasOwn(this.data.decks,serial)?this.data.decks[serial]:null,now=this.now();
    if(known){
      if(known.model===model&&Date.parse(now)-Date.parse(known.lastSeen)<60000)return this.view();
      return this.persist({...this.data.decks,[serial]:{...known,model,lastSeen:now}},{bump:false});
    }
    if(Object.keys(this.data.decks).length>=MAX_DECKS)fail(`Högst ${MAX_DECKS} deck kan sparas. Glöm ett deck som inte används.`);
    const legacy=this.data.legacy?.layout?.model===model?this.data.legacy:null;
    return this.persist({...this.data.decks,[serial]:{name:this.defaultName(model,serial),model,lastSeen:now,active:legacy?legacy.layout:null,draft:null,activeVersion:legacy?1:0,activatedAt:legacy?legacy.activatedAt:''}},{bump:false});
  }
  save(data){
    this.check(data);const d=this.deck(data.serial),draft=this.validate(data.layout);
    if(draft.model!==d.model)fail(`Layouten är gjord för ${MODELS[draft.model].name}, men decket är en ${MODELS[d.model].name}.`);
    return this.change(data.serial,{draft});
  }
  activate(data){this.check(data);const d=this.deck(data.serial);if(!d.draft)fail('Det finns inget utkast att aktivera.');return this.change(data.serial,{active:d.draft,draft:null,activeVersion:d.activeVersion+1,activatedAt:this.now()});}
  discard(data){this.check(data);const d=this.deck(data.serial);if(!d.draft)fail('Det finns inget utkast att kasta.');return this.change(data.serial,{draft:null});}
  reset(data){this.check(data);const d=this.deck(data.serial);if(!d.active&&!d.draft)fail('Standardlayouten gäller redan.');return this.change(data.serial,{active:null,draft:null,activeVersion:d.activeVersion+1,activatedAt:this.now()});}
  rename(data){
    this.check(data);this.deck(data.serial);
    const name=typeof data.name==='string'?data.name.trim():'';
    if(!name||!text(name,40))fail('Ett decknamn har 1–40 tecken.');
    if(Object.entries(this.data.decks).some(([s,d])=>s!==data.serial&&d.name===name))fail('Ett annat deck heter redan så.');
    return this.change(data.serial,{name});
  }
  // Copy another deck's layout (its draft if it has one) into this deck's draft, adapted to this model.
  copy(data){
    this.check(data);const d=this.deck(data.serial),from=this.deck(data.from);
    if(data.from===data.serial)fail('Välj ett annat deck att kopiera från.');
    const layout=from.draft||from.active;if(!layout)fail(`${from.name} använder standardlayouten. Det finns ingen egen layout att kopiera.`);
    return this.change(data.serial,{draft:this.validate(layout.model===d.model?layout:changeModel(layout,d.model))});
  }
  remove(data){
    this.check(data);this.deck(data.serial);
    const decks={...this.data.decks};delete decks[data.serial];return this.persist(decks);
  }
}
