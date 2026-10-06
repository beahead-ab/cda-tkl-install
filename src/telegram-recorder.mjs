import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {decode,fromHex,hex} from './protocol.mjs';
import { decodeSv, classifyFrame } from './sv2.mjs';
const ID=/^[a-f0-9-]{36}$/;
const fail=message=>{throw Object.assign(Error(message),{status:409});};
export function describeProtocol(direction,line) {
  const prefix=direction==='out'?'SEND ':'RECEIVE ';
  if(line.startsWith(prefix)) {
    try {
      const bytes=fromHex(line.slice(prefix.length)),decoded=decode(bytes);
      if(decoded.kind==='unsupported'){
        // SV2 (E5 10, format 2) och de ramar Lyssna känner igen utan att tolka dem. Inget av detta rör ett objekts tillstånd.
        const sv=decodeSv(bytes);
        if(sv)return {kind:sv.reply?'sv-reply':'sv-request',valid:true,hex:hex(bytes),decoded:sv,interpretation:sv.identity?`${sv.name} från kort ${sv.dst}: tillverkare ${sv.identity.manufacturer}, utvecklare ${sv.identity.developer}, produkt ${sv.identity.product}, serienummer ${sv.identity.serial}.`:`${sv.name}${sv.reply?' från':' till'} kort ${sv.dst}, SV ${sv.sv}, data ${sv.data.join(' ')}.`};
        const c=classifyFrame(bytes);return {kind:'unsupported',frame:c.kind,valid:true,hex:hex(bytes),decoded,interpretation:c.note};
      }
      return {kind:decoded.kind==='order'?(direction==='out'?'order':'received-order'):decoded.kind==='unsupported'?'unsupported':'report',valid:true,hex:hex(bytes),decoded,
        ...(decoded.kind==='signal'?{interpretation:'Preliminär Signal10-CZ-form. Svenskt MGP-besked ej verifierat.'}:{}),
        ...(decoded.kind==='order'&&direction==='in'?{interpretation:'Mottagen order kan vara eko eller en annan avsändare. Ingen utförd manöver kvitteras.'}:{})};
    }catch(e){return {kind:'invalid-frame',valid:false,error:e.message};}
  }
  if(/^SENT\b/.test(line))return {kind:'transport-ack',interpretation:'Transportkvittens, ingen bekräftelse på växelläge eller signalbesked.'};
  if(/^(ERROR|BREAK)\b/.test(line))return {kind:'transport-error'};
  return {kind:'transport-line'};
}
export class TelegramRecorder extends EventEmitter {
  constructor(directory,profile,{now=Date.now,clock=()=>performance.now(),maxEvents=10000,maxBytes=4_000_000,maxDurationMs=120000,maxFiles=100,connectionInfo=null}={}) {
    super();this.directory=path.join(directory,'telegram-recordings');this.now=now;this.clock=clock;
    this.limits={maxEvents,maxBytes,maxDurationMs,maxFiles};this.sessionId=randomUUID();this.active=null;this.history=new Map();this.error=null;this.pending=null;
    this.provenance={profile:{id:profile.id,title:profile.title,sourceHash:profile.sourceHash||null,fingerprint:createHash('sha256').update(JSON.stringify(profile)).digest('hex')},
      connection:connectionInfo,transport:'LocoNet-over-TCP',capturePoint:'TKL transport, complete ASCII protocol lines after whitespace/CR/LF normalization',
      verification:'Fysisk MGP/LocoBuffer ej verifierad. Filerna är observationer från vald anslutning, inte bevis för svensk beskedsmappning.',
      bindings:{turnouts:profile.turnouts,blocks:profile.blocks,signals:profile.signals,operatingControls:profile.operatingControls}};
    try {
      fs.mkdirSync(this.directory,{recursive:true});
      for(const file of fs.readdirSync(this.directory).filter(f=>ID.test(f.slice(0,-5))&&f.endsWith('.json'))) {
        if(this.history.size>=maxFiles)throw Error('Inspelningsarkivet överskrider gränsen');
        const stat=fs.statSync(path.join(this.directory,file));if(stat.size>maxBytes+250000)throw Error('För stor inspelningsfil');
        const doc=JSON.parse(fs.readFileSync(path.join(this.directory,file),'utf8'));
        if(doc.format!=='charlottendal-telegram-v1'||doc.id!==file.slice(0,-5)||!Array.isArray(doc.events)||doc.events.length>maxEvents||!doc.stoppedAt)throw Error('Ogiltig inspelningsfil');
        this.history.set(doc.id,this.summary(doc,true));
      }
    }catch(e){this.error='Inspelningsarkivet kunde inte läsas: '+e.message;}
  }
  summary(doc,saved=false){return {id:doc.id,label:doc.label,startedAt:doc.startedAt,stoppedAt:doc.stoppedAt,reason:doc.reason,eventCount:doc.events.length,bytes:doc.bytes,saved};}
  view(){return {sessionId:this.sessionId,limits:this.limits,active:this.active?{...this.summary(this.active),saving:!!this.pending}:null,history:[...this.history.values()].sort((a,b)=>b.startedAt-a.startedAt),error:this.error};}
  start({label='',sessionId}={},connection) {
    if(sessionId!==this.sessionId)fail('Servern har startats om. Läs in läget innan en ny inspelning.');
    if(this.error)fail(this.error);if(this.active)fail('En inspelning pågår eller väntar på att sparas.');
    if(connection!=='connected')fail('Anslut till anläggningen innan inspelningen startas.');
    if(this.history.size>=this.limits.maxFiles)fail('Inspelningsarkivet är fullt. Tidigare filer har bevarats.');
    if(typeof label!=='string'||label.length>80||/[\x00-\x1f\x7f]/.test(label))throw Error('Namn får vara högst 80 tecken utan kontrolltecken.');
    const at=this.now();this.startedTick=this.clock();
    this.active={format:'charlottendal-telegram-v1',id:randomUUID(),label:label.trim(),startedAt:at,stoppedAt:null,reason:null,bytes:0,...structuredClone(this.provenance),events:[]};
    this.add({kind:'connection',connected:connection==='connected'});this.emit('change');return this.view();
  }
  add(event) {
    if(!this.active||this.active.stoppedAt)return;
    const elapsedMs=Math.max(0,Math.round(this.clock()-this.startedTick));
    if(elapsedMs>=this.limits.maxDurationMs){void this.finish('time-limit');return;}
    const row={seq:this.active.events.length+1,at:this.now(),elapsedMs,...event};
    const bytes=Buffer.byteLength(JSON.stringify(row))+1;
    if(this.active.bytes+bytes>this.limits.maxBytes){void this.finish('size-limit');return;}
    this.active.events.push(row);this.active.bytes+=bytes;
    if(this.active.events.length>=this.limits.maxEvents)void this.finish('event-limit');
    this.emit('change');
  }
  protocol({direction,line,objects=[]}) {
    if(!this.active||this.active.stoppedAt)return;
    try {this.add({direction,objects:structuredClone(objects),line:String(line).slice(0,4096),...describeProtocol(direction,String(line).slice(0,4096))});}
    catch(e){this.error='Inspelningen avbröts: '+e.message;void this.finish('capture-error');}
  }
  connection(connected){this.add({kind:'connection',connected});if(!connected&&this.active&&!this.active.stoppedAt)void this.finish('disconnected');}
  fault(message){this.add({kind:'transport-fault',message:String(message).slice(0,1024)});}
  tick(){if(this.active&&!this.active.stoppedAt&&this.clock()-this.startedTick>=this.limits.maxDurationMs)void this.finish('time-limit');}
  async stop({id,sessionId}={}) {
    if(sessionId!==this.sessionId)fail('Servern har startats om. Läs in läget innan du stoppar.');
    if(this.history.has(id)&&!this.active)return this.view();
    if(id!==this.active?.id)fail('Inspelningen har ändrats i en annan panel. Läs in senaste.');
    await this.finish(this.active.reason||'operator');return this.view();
  }
  async finish(reason) {
    if(!this.active)return;
    if(this.pending)return this.pending;
    const doc=this.active;doc.stoppedAt=doc.stoppedAt||this.now();doc.reason=doc.reason||reason;this.emit('change');
    this.pending=(async()=>{
      const destination=path.join(this.directory,doc.id+'.json'),temp=destination+'.tmp';let handle;
      try {
        // The unique recording id never replaces an older completed recording.
        const data=JSON.stringify(doc)+'\n';
        handle=await fsp.open(temp,'w',0o600);await handle.writeFile(data);await handle.sync();await handle.close();handle=null;
        await fsp.link(temp,destination);await fsp.unlink(temp).catch(()=>{});
        this.history.set(doc.id,this.summary(doc,true));this.active=null;this.error=null;
      }catch(e){if(handle)await handle.close().catch(()=>{});this.error='Inspelningen kunde inte sparas. Hämta filen nu eller försök spara igen. '+e.code;}
      finally{this.pending=null;this.emit('change');}
    })();
    return this.pending;
  }
  async export(id) {
    if(!ID.test(id))throw Object.assign(Error('Okänd inspelning'),{status:404});
    if(this.active?.id===id)return structuredClone(this.active);
    if(!this.history.has(id))throw Object.assign(Error('Okänd inspelning'),{status:404});
    return JSON.parse(await fsp.readFile(path.join(this.directory,id+'.json'),'utf8'));
  }
}
