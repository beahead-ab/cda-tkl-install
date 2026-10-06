import {createHash,randomUUID} from 'node:crypto';
import {signalReportKind} from './signal-report.mjs';
const copy=structuredClone, record=v=>v&&typeof v==='object'&&!Array.isArray(v),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
// Signalrapport: 'se' = Signal10:s SE-telegram med beskedskoder, 'switch' = växelrapporten B1 (CLOSED kör, THROWN stopp).
// Profilraden sätter standarden för alla signaler; en signal kan avvika med reportKind, 'inherit' följer profilen.
const CHOICES={reportKind:['se','switch'],reportKindInherit:['inherit','se','switch']};
const fields={turnouts:{address:'address2048',inverted:'boolean'},blocks:{address:'address4096',activeMeansOccupied:'boolean'},signals:{address:'address2048',reportAddress:'address16384',stopCodes:'codes',goCodes:'codes',reportKind:'reportKindInherit'},signalReport:{kind:'reportKind'},programming:{relayAddress:'address2048',reportAddress:'address4096'},routes:{enabled:'boolean'},manual:{enabled:'boolean'}};
export class BindingConfiguration {
  constructor(base,{storage,canActivate=()=>({allowed:false,reason:'Aktivering ej tillgänglig.'}),prepare=()=>()=>{},now=Date.now}) {
    this.base=base;this.storage=storage;this.canActivate=canActivate;this.prepare=prepare;this.now=now;this.sessionId=randomUUID();this.baseHash=createHash('sha256').update(JSON.stringify(base)).digest('hex');
    this.catalog=[];const add=(kind,id,names,values,source)=>this.catalog.push({key:kind+':'+id,kind,id,names,values,source,fields:fields[kind]});
    for(const [n,b] of Object.entries(base.turnouts))add('turnouts',n,[n],{address:b.address,inverted:!!b.inverted},b.source||'');
    // En rad per fysisk detektor: alla spårledningar på samma adress ändras tillsammans. Spårledningar med flera ingångar
    // ägs av detekteringsregeln i Studio och ligger utanför katalogen; virtuella signaler har ingen utgång att binda.
    const sensors=new Map();for(const [n,b] of Object.entries(base.blocks)){if(b.inputs)continue;const id=(b.sourceInputs?b.sourceInputs[0]:(b.sourceSensor||n))+'@'+b.address;if(!sensors.has(id))sensors.set(id,[]);sensors.get(id).push(n);}
    for(const [id,names] of sensors){const b=base.blocks[names[0]];add('blocks',id,names,{address:b.address,activeMeansOccupied:b.activeMeansOccupied},[...new Set(names.map(n=>base.blocks[n].sourceSensor||n))].join(', '));}
    add('signalReport','alla',[],{kind:signalReportKind(base,{address:1,reportAddress:1})},'standard för alla signaler');
    for(const [n,b] of Object.entries(base.signals))if(!b.virtual)add('signals',n,[n],{address:b.address,reportAddress:b.reportAddress,stopCodes:b.stopCodes,goCodes:b.goCodes,reportKind:CHOICES.reportKind.includes(b.reportKind)?b.reportKind:'inherit'},b.sourceType||'');
    if(base.operatingControls?.programming){const p=base.operatingControls.programming;add('programming','track3',[],{relayAddress:p.relayAddress,reportAddress:p.reportAddress},p.rule);}
    for(const r of base.routes)add('routes',r.id,[r.id],{enabled:true},r.source?.rules?.join(', ')||'');
    for(const n of Object.keys(base.turnouts))add('manual',n,[n],{enabled:true},base.manualPolicies?.byTurnout[n]?.rule||'');
    this.objects=new Map(this.catalog.map(r=>[r.key,r]));
    this.data=storage.load('bindings.json',{schema:1,baseHash:this.baseHash,revision:0,activeVersion:0,draft:null,versions:[{id:0,at:null,reason:'Granskad grundprofil',overrides:{}}]});
    const d=this.data;if(d.schema!==1||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.versions)||!d.versions.length||d.versions.some((v,i)=>v.id!==i||!record(v.overrides))||!d.versions[d.activeVersion]||d.draft&&(!record(d.draft.overrides)||d.draft.baseVersion!==d.activeVersion))throw Error('Ogiltiga driftinställningar.');
    if(d.baseHash!==this.baseHash&&Object.keys(this.active.overrides).length)throw Error('Grundprofilen har ändrats. Granska aktiva driftbindningar före versionsbyte.');
    if(this.validate(this.active.overrides).length)throw Error('Aktiva driftinställningar är ogiltiga: '+this.validate(this.active.overrides).join(' '));
  }
  get active(){return this.data.versions[this.data.activeVersion];}
  shape(overrides){const errors=[];if(!record(overrides))return ['Ogiltigt ändringslager.'];for(const [key,value] of Object.entries(overrides)){
    const row=this.objects.get(key);if(!row||!record(value)||Object.keys(value).some(k=>!fields[row.kind][k])||Object.keys(value).length!==Object.keys(fields[row?.kind]||{}).length){errors.push('Okänd bindning eller fält: '+key);continue;}
    for(const [name,type] of Object.entries(fields[row.kind])){const v=value[name];if(type==='boolean'?typeof v!=='boolean':CHOICES[type]?!CHOICES[type].includes(v):type==='codes'?(!Array.isArray(v)||!v.length||v.length>32||v.some(n=>!Number.isInteger(n)||n<0||n>127)||new Set(v).size!==v.length):(!Number.isInteger(v)||v<1||v>Number(type.slice(7))))errors.push(key+': ogiltigt '+name);}
  }return errors;}
  profile(overrides=this.active.overrides){const p=copy(this.base);for(const [key,values] of Object.entries(overrides)){const row=this.objects.get(key);if(!row)continue;
    if(row.kind==='routes')p.routes.find(r=>r.id===row.id).adminDisabled=!values.enabled;
    else if(row.kind==='manual'){p.manualDisabled||=[];if(!values.enabled)p.manualDisabled.push(row.id);}
    else if(row.kind==='programming')Object.assign(p.operatingControls.programming,copy(values));
    else if(row.kind==='signalReport')p.signalReport={...(p.signalReport||{}),kind:values.kind};
    else for(const n of row.names){const v=copy(values);if(v.reportKind==='inherit'){delete v.reportKind;delete p[row.kind][n].reportKind;}Object.assign(p[row.kind][n],v,{provenance:'Operator override; physical binding requires commissioning.'});}
  }p.commissioned=false;return p;}
  validate(overrides){const errors=this.shape(overrides);if(errors.length)return errors;const p=this.profile(overrides),orders=new Map(),reports=new Map(),detectors=new Map();
    const unique=(map,address,name)=>{if(map.has(address))errors.push('Adress '+address+' delas av '+map.get(address)+' och '+name+'.');else map.set(address,name);};
    for(const [n,b] of Object.entries(p.turnouts))unique(orders,b.address,n);
    for(const [n,b] of Object.entries(p.signals)){if(b.virtual)continue;unique(orders,b.address,'signal '+n);unique(reports,b.reportAddress,'signal '+n);if(b.stopCodes.some(c=>b.goCodes.includes(c)))errors.push('Signal '+n+': samma beskedskod får inte betyda både stopp och kör.');
      // En B1-rapport på en växels adress kan inte skiljas från växelns egen rapport.
      if(signalReportKind(p,b)==='switch'&&Object.values(p.turnouts).some(t=>t.address===b.reportAddress))errors.push('Signal '+n+': växelrapporten på adress '+b.reportAddress+' tillhör redan en växel.');}
    for(const row of this.catalog.filter(r=>r.kind==='blocks')){const b=p.blocks[row.names[0]];unique(detectors,b.address,row.id);if(row.names.some(n=>p.blocks[n].address!==b.address||p.blocks[n].activeMeansOccupied!==b.activeMeansOccupied))errors.push('Detektoralias stämmer inte: '+row.id);}
    const pr=p.operatingControls?.programming;if(pr){unique(orders,pr.relayAddress,'programmeringsrelä');unique(detectors,pr.reportAddress,'programmeringsrapport');}
    return errors;
  }
  diff(overrides){const keys=new Set([...Object.keys(this.active.overrides),...Object.keys(overrides)]);return [...keys].sort().flatMap(key=>{const row=this.objects.get(key);if(!row)return [{key,field:'unknown',before:null,after:overrides[key]}];return Object.keys(fields[row.kind]).flatMap(field=>{const before=(this.active.overrides[key]||row.values)[field],after=(overrides[key]||row.values)[field];return equal(before,after)?[]:[{key,field,before,after}];});});}
  view(){const draft=this.data.draft;return {sessionId:this.sessionId,revision:this.data.revision,activeVersion:this.data.activeVersion,baseHash:this.baseHash,catalog:this.catalog,active:copy(this.active.overrides),draft:copy(draft),changes:draft?this.diff(draft.overrides):[],errors:draft?this.validate(draft.overrides):[],activation:this.canActivate(),history:this.data.versions.map(v=>({id:v.id,at:v.at,reason:v.reason,objects:Object.keys(v.overrides).length}))};}
  check({sessionId,revision}){if(sessionId!==this.sessionId||revision!==this.data.revision)fail('Driftinställningarna har ändrats. Läs in senaste läget.',409);}
  commit(next){next.revision++;next.baseHash=this.baseHash;this.storage.save('bindings.json',next);this.data=next;return this.view();}
  save(data){this.check(data);const row=this.objects.get(data.key);const errors=this.shape({[data.key]:data.values});if(errors.length)fail(errors.join(' '));const next=copy(this.data);next.draft||={baseVersion:next.activeVersion,overrides:copy(this.active.overrides)};if(equal(data.values,row.values))delete next.draft.overrides[data.key];else next.draft.overrides[data.key]=copy(data.values);return this.commit(next);}
  discard(data){this.check(data);const next=copy(this.data);next.draft=null;return this.commit(next);}
  restore(data){this.check(data);if(!Number.isSafeInteger(data.version)||!this.data.versions[data.version])fail('Versionen finns inte.');if(this.data.draft)fail('Granska eller kasta befintligt utkast först.',409);const next=copy(this.data);next.draft={baseVersion:next.activeVersion,overrides:copy(next.versions[data.version].overrides)};return this.commit(next);}
  activate(data){this.check(data);if(!this.data.draft||!this.diff(this.data.draft.overrides).length)fail('Inget ändrat utkast att aktivera.');if(typeof data.reason!=='string'||data.reason.trim().length<3||data.reason.length>500||/[\u0000-\u001f]/.test(data.reason))fail('Beskriv underlaget för ändringen (3–500 tecken).');const errors=this.validate(this.data.draft.overrides);if(errors.length)fail(errors.join(' '));const check=this.canActivate(this.profile(this.data.draft.overrides));if(!check.allowed)fail(check.reason,409);
    const next=copy(this.data),id=next.versions.length,profile=this.profile(next.draft.overrides);const apply=this.prepare(profile);next.versions.push({id,at:this.now(),reason:data.reason.trim(),overrides:copy(next.draft.overrides)});next.activeVersion=id;next.draft=null;this.commit(next);apply();return this.view();}
  export(){return {format:'charlottendal-bindings-v1',baseHash:this.baseHash,version:this.data.activeVersion,sourceHash:this.base.sourceHash,commissioned:false,history:copy(this.data.versions),profile:this.profile()};}
}
