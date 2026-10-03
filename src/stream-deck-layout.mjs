// Saved Stream Deck layouts for the installation: an active layout, a draft and
// a revision, like the other administrative documents. null means the automatic
// layout. Every key is validated against the installation's own pluppar.
import {validateLayout} from '../public/stream-deck-profile.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export class StreamDeckLayouts{
  constructor(storage,{pluppIds=[],now=()=>new Date().toISOString()}={}){
    this.storage=storage;this.pluppIds=typeof pluppIds==='function'?()=>new Set(pluppIds()):()=>new Set(pluppIds);this.now=now;
    this.data=storage.load('streamdeck.json',{revision:0,active:null,draft:null,activeVersion:0,activatedAt:''});
    if(!this.data||typeof this.data!=='object'||!Number.isSafeInteger(this.data.revision)||this.data.revision<0||!Number.isSafeInteger(this.data.activeVersion)||typeof this.data.activatedAt!=='string')throw Error('Ogiltig sparad Stream Deck-layout.');
    for(const key of ['active','draft'])if(this.data[key]!=null){try{this.data[key]=validateLayout(this.data[key],{pluppIds:this.pluppIds()});}catch(e){throw Error('Ogiltig sparad Stream Deck-layout: '+e.message);}}
  }
  view(){return structuredClone(this.data);}
  check(data){if(!data||data.revision!==this.data.revision)fail('Stream Deck-layouten har ändrats. Läs in senaste läget.',409);}
  persist(next){try{this.storage.save('streamdeck.json',next);}catch{fail('Layouten kunde inte sparas. Den tidigare är kvar.',507);}this.data=next;return this.view();}
  save(data){this.check(data);const draft=validateLayout(data.layout,{pluppIds:this.pluppIds()});return this.persist({...this.data,revision:this.data.revision+1,draft});}
  activate(data){this.check(data);if(!this.data.draft)fail('Det finns inget utkast att aktivera.');return this.persist({...this.data,revision:this.data.revision+1,active:this.data.draft,draft:null,activeVersion:this.data.activeVersion+1,activatedAt:this.now()});}
  discard(data){this.check(data);if(!this.data.draft)fail('Det finns inget utkast att kasta.');return this.persist({...this.data,revision:this.data.revision+1,draft:null});}
  reset(data){this.check(data);if(!this.data.active&&!this.data.draft)fail('Standardlayouten gäller redan.');return this.persist({...this.data,revision:this.data.revision+1,active:null,draft:null,activeVersion:this.data.activeVersion+1,activatedAt:this.now()});}
}
