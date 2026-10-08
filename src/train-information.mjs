import { randomUUID } from 'node:crypto';
export const TRAIN_INFORMATION_SCHEMA=2;
const copy=structuredClone;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validValue=value=>typeof value==='string'&&value.length<=24&&/^[\p{L}\p{N} ._/-]*$/u.test(value);

// Information only. This store has no path to turnout orders, signal permission,
// reservation release or the simulator's internal train model.
export class TrainInformation {
  constructor(catalog,profile,{storage,now=Date.now,sessionId=randomUUID()}={}) {
    this.storage=storage;this.now=now;this.sessionId=sessionId;this.sourceHash=catalog.sourceHash;this.profile=profile;this.routes=[];this.connected=false;this.fault=null;
    this.fields=catalog.fields.filter(f=>f.kind==='incoming'||profile.blocks[f.name]);
    this.objects=new Map(this.fields.map(f=>[f.key,f]));
    this.anchors=catalog.anchors.filter(a=>this.objects.has(a.key));
    this.observed=new Map();this.epochs={};
    this.data=storage.load('train-information.json',{schema:2,sourceHash:this.sourceHash,revision:0,entries:{},history:[],follows:[]});
    if(this.data.schema===1)this.data={...this.data,schema:2,follows:[]};
    const d=this.data;
    if(d.schema!==2||d.sourceHash!==this.sourceHash||!Number.isSafeInteger(d.revision)||d.revision<0||!record(d.entries)||!Array.isArray(d.history)||d.history.length>200) throw Error('Sparad tåginformation är ogiltig eller hör till annat källunderlag. Kontrollera före start.');
    for(const [key,e] of Object.entries(d.entries)) if(!this.objects.has(key)||!record(e)||!validValue(e.value)||!e.value.trim()||!['manual','follow','simulation'].includes(e.source)||(e.review!==undefined&&typeof e.review!=='boolean')||!Number.isFinite(e.updatedAt)||typeof e.sessionId!=='string'||!Number.isSafeInteger(e.epoch)||e.epoch<0) throw Error('Sparad tågidentitet är ogiltig: '+key);
    for(const e of d.history) if(!record(e)||!['assign','confirm','clear','move','follow-start','follow-move','follow-pause','follow-stop','follow-complete'].includes(e.kind)||!Number.isFinite(e.at)||!Number.isSafeInteger(e.revision)||e.revision<1||e.revision>d.revision||!['manual','follow','simulation'].includes(e.source)||!validValue(e.before)||!validValue(e.after)||(['move','follow-move'].includes(e.kind)?[e.from,e.to]:[e.key]).some(key=>!this.objects.has(key))) throw Error('Sparad tågnummershistorik är ogiltig.');
    this.validateFollows();
  }
  catalog(){return {sourceHash:this.sourceHash,fields:copy(this.fields),anchors:copy(this.anchors)};}
  observe(blocks,connected,routes=[]) {
    this.connected=connected;this.routes=routes;
    for(const f of this.fields.filter(f=>f.kind==='block')) {
      const next=connected?blocks[f.name]?.occupied??null:null;
      if(this.observed.get(f.key)!==next) {this.epochs[f.key]=(this.epochs[f.key]||0)+1;this.observed.set(f.key,next);}
    }
    this.advanceFollows();
  }
  snapshot() {
    const entries={};
    for(const [key,e] of Object.entries(this.data.entries)) entries[key]={...e,
      needsReview:!!e.review||!!this.fault||e.sessionId!==this.sessionId||e.epoch!==(this.epochs[key]||0)||(this.objects.get(key).kind==='block'&&this.observed.get(key)==null),
      duplicate:Object.entries(this.data.entries).some(([other,v])=>other!==key&&v.value===e.value)};
    return {sessionId:this.sessionId,revision:this.data.revision,entries,fault:this.fault,follows:copy(this.data.follows).map(f=>f.status==='active'&&(this.fault||f.sessionId!==this.sessionId)?{...f,status:'paused',reason:this.fault||'Servern har startat om. Kontrollera tågnumrets plats.'}:f),epochs:{...this.epochs},history:copy(this.data.history.slice(-12).reverse())};
  }
  check({revision,sessionId},keys,epochs) {
    if(this.fault)fail('Tåginformationens lagring fungerar inte. Ingen följning eller ändring utförs; kontrollera lagringen och starta om.',409);
    if(revision!==this.data.revision||sessionId!==this.sessionId) fail('Tåginformationen har ändrats eller servern har startat om. Läs in senaste uppgifter före ny ändring.',409);
    if(keys.some(key=>!this.objects.has(key))) fail('Okänt informationsfält.');
    if(!record(epochs)||keys.some(key=>epochs[key]!==(this.epochs[key]||0))) fail('Beläggningen har ändrats under redigeringen. Läs in och kontrollera platsen igen.',409);
  }
  entry(value,key){return {value,source:'manual',updatedAt:this.now(),sessionId:this.sessionId,epoch:this.epochs[key]||0};}
  commit(next,event) {
    next.revision=this.data.revision+1;
    next.history.push({...event,at:this.now(),revision:next.revision,source:event.source||'manual'});
    next.history=next.history.slice(-200);
    this.storage.save('train-information.json',next);this.data=next;
    return this.snapshot();
  }
  save({revision,sessionId,key,value,epochs,...extra}) {
    if(Object.keys(extra).length||!validValue(value)) fail('Ange högst 24 tecken: bokstäver, siffror, blanksteg, punkt, bindestreck, snedstreck eller understreck.');
    this.check({revision,sessionId},[key],epochs);value=value.trim();
    const next=copy(this.data),before=next.entries[key]?.value||'';
    this.detach(next,[key]);
    if(value) next.entries[key]=this.entry(value,key);else delete next.entries[key];
    return this.commit(next,{kind:before===value?'confirm':value?'assign':'clear',key,before,after:value});
  }
  // Simulerade tåg (0.74.0): den simulerade grannstationen anmäler ett tåg i linjens inkommande fält, och tömmer
  // fältet när tåget har kommit in. Ingen session- eller beläggningskontroll: det är ingen operatör som redigerar.
  announce(key,value) {
    if(this.fault||this.objects.get(key)?.kind!=='incoming'||!validValue(value))return null;
    const before=this.data.entries[key]?.value||'';if(before===value)return null;
    const next=copy(this.data);this.detach(next,[key]);
    if(value)next.entries[key]={...this.entry(value,key),source:'simulation'};else delete next.entries[key];
    try{return this.commit(next,{kind:value?'assign':'clear',key,before,after:value,source:'simulation'});}catch(error){this.fault='Tåginformationen kunde inte sparas: '+error.message;return null;}
  }
  move({revision,sessionId,from,to,epochs,...extra}) {
    if(Object.keys(extra).length||from===to) fail('Välj två olika informationsfält.');
    this.check({revision,sessionId},[from,to],epochs);
    const value=this.data.entries[from]?.value;
    if(!value) fail('Startfältet saknar tågnummer.');
    if(this.data.entries[to]) fail('Målfältet har redan ett tågnummer. Kontrollera det före flytt.',409);
    const next=copy(this.data);this.detach(next,[from,to]);delete next.entries[from];next.entries[to]=this.entry(value,to);
    return this.commit(next,{kind:'move',from,to,before:value,after:value});
  }
  validateFollows() {
    const d=this.data;
    if(!Array.isArray(d.follows)||d.follows.length>100)throw Error('Sparade tågnummerföljningar är ogiltiga.');
    const ids=new Set();
    for(const f of d.follows){
      if(!record(f)||typeof f.id!=='string'||ids.has(f.id)||typeof f.sessionId!=='string'||typeof f.routeId!=='string'||typeof f.definitionId!=='string'||typeof f.routeLabel!=='string'||!validValue(f.value)||!f.value.trim()||!this.objects.has(f.key)||!this.objects.has(f.startKey)||!['active','paused','stopped','complete'].includes(f.status)||typeof f.reason!=='string'||!Number.isFinite(f.updatedAt)||!Array.isArray(f.path)||!f.path.length||f.path.length>this.fields.length||!Number.isInteger(f.index)||f.index < -1||f.index>=f.path.length||f.path.some(p=>!record(p)||!Number.isInteger(p.address)||p.address<1||p.address>4096||this.objects.get(p.key)?.kind!=='block')||new Set(f.path.map(p=>p.address)).size!==f.path.length)throw Error('Sparad tågnummerföljning är ogiltig.');
      ids.add(f.id);
    }
  }
  path(route,startKey) {
    const addresses=[...new Set(route.blocks.map(n=>this.profile.blocks[n]?.address))];
    if(addresses.some(a=>!Number.isInteger(a))||!route.passage||route.passage.length!==addresses.length||route.passage.some((p,i)=>p.address!==addresses[i]))fail('Tågvägen saknar verifierad passageordning.');
    return addresses.map(address=>{
      const keys=route.blocks.filter(n=>this.profile.blocks[n].address===address).map(n=>'block:'+n);
      const key=keys.includes(startKey)?startKey:keys.find(k=>this.anchors.some(a=>a.key===k&&!a.duplicate))||keys[0];
      if(!this.objects.has(key))fail('Tågvägens informationsfält saknas.');
      return {address,key};
    });
  }
  aliasKeys(address){return this.fields.filter(f=>f.kind==='block'&&this.profile.blocks[f.name]?.address===address).map(f=>f.key);}
  pathKnown(path){return path.every(p=>this.aliasKeys(p.address).every(k=>this.observed.get(k)!==null&&this.observed.has(k)));}
  follow({revision,sessionId,key,routeId,epochs,...extra}) {
    if(Object.keys(extra).length)fail('Okänd följningsuppgift.');
    this.check({revision,sessionId},[key],epochs);
    const entry=this.snapshot().entries[key],route=this.routes.find(r=>r.id===routeId);
    if(!entry||entry.needsReview||entry.duplicate)fail('Registrera och kontrollera ett unikt tågnummer först.',409);
    if(!this.connected||!route||route.state!=='active'||!route.autoRelease||!route.passage?.every(p=>p.state==='pending'))fail('Välj en klar tågväg där passagen ännu inte börjat.',409);
    const path=this.path(route,key),field=this.objects.get(key);
    if(field.kind==='block'&&this.profile.blocks[field.name].address!==path[0].address)fail('Numret måste stå i ett inkommande fält eller vid tågvägens första detektor.');
    if(!this.pathKnown(path)||path.some(p=>this.aliasKeys(p.address).some(k=>this.observed.get(k)!==false)))fail('Tågvägens spår måste ha aktuella fria besked.',409);
    if(path.some(p=>this.aliasKeys(p.address).some(k=>k!==key&&this.data.entries[k])))fail('Tågvägen har redan tåginformation. Kontrollera alla platser först.',409);
    if(this.data.follows.some(f=>f.status==='active'&&(f.key===key||f.value===entry.value||f.routeId===routeId||f.path.some(p=>path.some(n=>p.address===n.address)))))fail('Numret eller tågvägen har redan en pågående följning.',409);
    const next=copy(this.data);next.follows=next.follows.filter(f=>f.status==='active'||f.status==='paused');if(next.follows.length>=100)fail('Avsluta gamla pausade följningar först.');
    const f={id:randomUUID(),sessionId:this.sessionId,routeId,definitionId:route.definitionId,routeLabel:route.label,value:entry.value,startKey:key,key,path,index:-1,status:'active',reason:'Väntar på första beläggningen.',updatedAt:this.now()};next.follows.push(f);
    return this.commit(next,{kind:'follow-start',key,before:entry.value,after:entry.value,source:'follow'});
  }
  unfollow({revision,sessionId,id,epochs={},...extra}) {
    if(Object.keys(extra).length)fail('Okänd följningsuppgift.');
    this.check({revision,sessionId},[],epochs);
    const next=copy(this.data),f=next.follows.find(f=>f.id===id);
    if(!f||!['active','paused'].includes(f.status))fail('Ingen pågående eller pausad följning.');
    f.status='stopped';f.reason='Avslutad av operatören. Kontrollera placeringen.';f.updatedAt=this.now();
    if(next.entries[f.key]?.value===f.value)next.entries[f.key].review=true;
    return this.commit(next,{kind:'follow-stop',key:f.key,before:f.value,after:f.value,source:'follow'});
  }
  detach(next,keys) {
    for(const f of next.follows)if(['active','paused'].includes(f.status)&&keys.includes(f.key)){
      f.status='stopped';f.reason='Manuell ändring avslutade följningen.';f.updatedAt=this.now();
    }
  }
  advanceFollows() {
    if(this.fault)return;
    for(const stored of this.data.follows.filter(f=>f.status==='active')) {
      const next=copy(this.data),f=next.follows.find(f=>f.id===stored.id),entry=next.entries[f.key],route=this.routes.find(r=>r.id===f.routeId);
      const pause=reason=>{f.status='paused';f.reason=reason;f.updatedAt=this.now();if(entry?.value===f.value)entry.review=true;return {kind:'follow-pause',key:f.key,before:f.value,after:f.value,source:'follow'};};
      let event;
      if(f.sessionId!==this.sessionId)event=pause('Servern har startat om. Kontrollera placeringen; följningen återupptas inte automatiskt.');
      else if(!this.connected||!this.pathKnown(f.path))event=pause('Anslutning eller aktuell beläggningsrapport saknas.');
      else if(!entry||entry.value!==f.value||Object.entries(next.entries).some(([k,e])=>k!==f.key&&e.value===f.value))event=pause('Tågnumret är ändrat eller finns på flera platser.');
      else if(!route||!['active','traversing','cancelling'].includes(route.state))event=pause('Tågvägen saknas eller hålls kvar. Kontrollera placeringen.');
      else if(route.passage?.length!==f.path.length||route.passage.some((p,i)=>p.address!==f.path[i].address))event=pause('Tågvägens detektorordning har ändrats.');
      else if(route.passage.every(p=>p.state==='clear')&&f.index===f.path.length-1){
        f.status='complete';f.reason='Sista avsnittet passerat. Kontrollera placeringen bortom tågvägen.';f.updatedAt=this.now();entry.review=true;
        event={kind:'follow-complete',key:f.key,before:f.value,after:f.value,source:'follow'};
      } else if(route.cancelRequested||route.state==='cancelling')event=pause('Tågvägen återtas. Ingen ytterligare nummerflytt.');
      else {
        const index=route.passage.findLastIndex(p=>p.state!=='pending');
        if(index>f.index){
          if(index!==f.index+1||route.passage[index].state!=='occupied'||route.passage.slice(0,index).some(p=>p.state==='pending'))event=pause('Passagens ordning kan inte följas entydigt.');
          else if(this.aliasKeys(f.path[index].address).some(k=>this.observed.get(k)!==true))event=pause('Nästa avsnitt saknar entydig beläggning.');
          else if(this.aliasKeys(f.path[index].address).some(k=>k!==f.key&&next.entries[k]))event=pause('Nästa plats har redan tåginformation.');
          else {
            const from=f.key,to=f.path[index].key;delete next.entries[from];next.entries[to]={...this.entry(f.value,to),source:'follow'};
            f.key=to;f.index=index;f.reason='Följer rapporterad passage. Tågidentiteten är manuellt tilldelad.';f.updatedAt=this.now();
            event={kind:'follow-move',from,to,before:f.value,after:f.value,source:'follow'};
          }
        }
      }
      if(event)try{this.commit(next,event);}catch(error){this.fault='Tågnummerföljningen stoppad: '+error.message;return;}
    }
  }

}
