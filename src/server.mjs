import {connectionInfo,commandExpectations,protocolObjects} from './communication-diagnostics.mjs';
import http from 'node:http';
import {Destinations} from './destinations.mjs';
import {StreamDeckLayouts} from './stream-deck-layout.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {decode} from './protocol.mjs';
import { Engine } from './engine.mjs';
import { Storage } from './storage.mjs';
import { LocoNetClient } from './transport.mjs';
import { createAuth } from './auth.mjs';
import { json, guard, body, staticFile } from './http.mjs';
import { loadProfile } from './profile.mjs';
import { BindingConfiguration } from './binding-configuration.mjs';
import { Configuration } from './configuration.mjs';
import { TrainInformation } from './train-information.mjs';
import { PanelIndications } from './panel-indications.mjs';
import { TrainMeet } from './trainmeet.mjs';
import { ModelClock } from './model-clock.mjs';
import { describeProtocol, TelegramRecorder } from './telegram-recorder.mjs';
import { UpdateCheck } from './update-check.mjs';
import { spawn } from 'node:child_process';

const baseProfile=loadProfile();
const port = Number(process.env.CHARLOTTENDAL_PORT || 8910), root = fileURLToPath(new URL('../public', import.meta.url));
const auth = createAuth(root, true);
const storage = new Storage(process.env.CHARLOTTENDAL_STATE_DIR || fileURLToPath(new URL('../var', import.meta.url)));
let profile,client,engine,configuration,trainInformation,panelIndications,recorder;
const bindingReports=new Map();
function activationStatus(proposed){
  const deny=reason=>({allowed:false,reason});
  if(!engine||!engine.controls.stopAll)return deny('Aktivera Alla signaler i stopp före profilbyte.');
  if(!engine.connected||engine.storageFault)return deny('Anslutning och fungerande lagring krävs.');
  if(engine.routes.length||engine.controls.programming.reserved||engine.yard.delegated)return deny('Återta tågvägar, programmeringslås och rangerbangårdens manöverrätt först.');
  if(recorder.active||recorder.pending)return deny('Avsluta och spara telegraminspelningen först.');
  if(proposed){
    const report=(kind,address)=>{const r=bindingReports.get(kind+':'+address);return r&&Date.now()-r.at<=proposed.staleMs?r.data:null;};
    for(const [n,b] of Object.entries(proposed.turnouts)){const r=report('turnout',b.address);if(!r||!['C','T'].includes(r.position))return deny(n+': den föreslagna adressen saknar aktuellt känt växelläge.');}
    for(const [n,b] of Object.entries(proposed.blocks)){const r=report('sensor',b.address);if(!r||(b.activeMeansOccupied?r.active:!r.active))return deny(n+': den föreslagna bindningen saknar färsk frirapport.');}
    for(const [n,b] of Object.entries(proposed.signals)){const r=report('signal',b.reportAddress);if(!r||!b.stopCodes.includes(r.code))return deny(n+': den föreslagna bindningen saknar färskt stoppbesked.');}
    const p=proposed.operatingControls?.programming;if(p&&(report('turnout',p.relayAddress)?.position!=='T'||report('sensor',p.reportAddress)?.active!==false))return deny('Föreslaget programmeringsområde saknar färsk normalrapport.');
  }
  return {allowed:true,reason:'AIS aktiv och inga lås. Föreslagna adresser måste ha färska fria lägen och stoppbesked vid aktivering.'};
}
function createRuntime(p){
  const target=connectionInfo(p);
  const c=new LocoNetClient({host:target.host,port:target.port,silenceMs:p.staleMs});
  const e=new Engine(p,{storage,send:bytes=>c.send(bytes)});if(e.storageFault)throw Error(e.storageFault);
  return {profile:p,client:c,engine:e,
    configuration:new Configuration(p,{storage,canActivate:()=>!e.routes.length&&!e.controls.programming.reserved&&!e.yard.delegated&&!e.storageFault}),
    trainInformation:new TrainInformation(JSON.parse(fs.readFileSync(new URL('../public/data/train-fields.json',import.meta.url))),p,{storage}),
    panelIndications:new PanelIndications(JSON.parse(fs.readFileSync(new URL('../public/data/indications.json',import.meta.url))),p),
    recorder:new TelegramRecorder(storage.directory,p,{connectionInfo:target})};
}
const bindings=new BindingConfiguration(baseProfile,{storage,canActivate:activationStatus,prepare:p=>{const next=createRuntime(p);return ()=>installRuntime(next);}});
const trainMeet=new TrainMeet({storage,origin:process.env.CHARLOTTENDAL_TRAINMEET_ORIGIN||''});
const destinations=new Destinations(storage);
const modelClock=new ModelClock(storage);let clockPublished=0;
let notes = storage.load('notes.json', {}); const streams = new Set(), trace = [], protocolTrace=[]; let dirty = true;
auth.on('invalidate', () => { for (const stream of streams) stream.end(); streams.clear(); });
function protect(action) { try { return action(); } catch (e) { engine.log('error', e.message); } }
function installRuntime(next,start=true){
  if(client){client.removeAllListeners();client.stop();engine.removeAllListeners();recorder.removeAllListeners();}
  ({profile,client,engine,configuration,trainInformation,panelIndications,recorder}=next);trace.length=0;protocolTrace.length=0;
  const {client:c,engine:e,trainInformation:book,recorder:recording}=next;
  let recordedRevision=e.revision;
  e.on('change',()=>{
    for(const event of e.events.filter(event=>event.id>recordedRevision).reverse()){recordedRevision=event.id;recording.add({kind:'engine-event',event});}
    book.observe(e.blocks,e.connected,e.routes);dirty=true;
  });
  c.on('connection',connected=>{bindingReports.clear();recording.connection(connected);protect(()=>e.connection(connected));});
  c.on('frame',bytes=>protect(()=>{const d=decode(bytes);if(['turnout','sensor','signal'].includes(d.kind)){const key=d.kind+':'+d.address;if(!bindingReports.has(key)&&bindingReports.size>=6000)bindingReports.delete(bindingReports.keys().next().value);bindingReports.set(key,{at:Date.now(),data:d});}e.receive(bytes);}));
  c.on('fault',message=>{recording.fault(message);e.log('transport',String(message));});
  c.on('protocol',event=>{const decoded=describeProtocol(event.direction,event.line),objects=protocolObjects(next.profile,decoded.decoded);recording.protocol({...event,objects});protocolTrace.unshift({...event,at:Date.now(),...decoded,objects});protocolTrace.length=Math.min(protocolTrace.length,100);dirty=true;});recording.on('change',()=>{dirty=true;});
  c.on('wire',event=>{trace.unshift({...event,at:Date.now()});trace.length=Math.min(trace.length,100);dirty=true;});
  if(start)c.start();dirty=true;
}
trainMeet.on('change',()=>{dirty=true;});trainMeet.on('journal',text=>{engine.log('trainmeet',text);dirty=true;});
installRuntime(createRuntime(bindings.profile()),false);
// Layouts are checked against the live profile's pluppar, so the store is created once the runtime exists.
const streamDeckLayouts=new StreamDeckLayouts(storage,{pluppIds:()=>Object.keys(profile?.buttons||{})});
// The version this process was started with. An open panel compares it with the
// version it was loaded from and offers a reload after a release.
const release=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
// Installed copies look for a newer release in the public install repository.
const updateCheck=process.env.CHARLOTTENDAL_INSTALL_KIND?new UpdateCheck({current:release,kind:process.env.CHARLOTTENDAL_INSTALL_KIND}):null;
updateCheck?.start();
const snapshot = () => {const state=engine.snapshot();return { ...state,release,update:updateCheck?.view()??null,connectionInfo:connectionInfo(profile),destinations:destinations.view(),streamDeck:streamDeckLayouts.view(),bindingVersion:bindings.data.activeVersion,bindingActivation:activationStatus(), recordings:recorder.view(),clock:modelClock.snapshot(),trainMeet:trainMeet.view(),panelIndications:panelIndications.snapshot(state),trace, configurationVersion:configuration.data.activeVersion,trainInformation:trainInformation.snapshot() };};
const server = http.createServer(async (req, res) => {
  try {
    guard(req, port); const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (await auth.handle(req, res, url)) return;
    const expires = await auth.authenticate(req);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (url.pathname === '/api/state') return json(res, snapshot());
      if(url.pathname==='/api/communication')return json(res,{connection:connectionInfo(profile),connectionState:engine.connected?'connected':'disconnected',expectations:commandExpectations(profile,engine.snapshot()),trace:protocolTrace});
      if(url.pathname==='/api/route-targets')return json(res,{targets:engine.routeTargets(url.searchParams.get('from'),url.searchParams.get('kind')||'main')});
      if (url.pathname === '/api/config') { const {routeAlternatives,...panelProfile}=profile; return json(res, { ...panelProfile,release,bindingVersion:bindings.data.activeVersion, notes, trainFields:trainInformation.catalog(),panelIndications:panelIndications.catalog(), presentation:configuration.presentation(), fieldUrl: process.env.CHARLOTTENDAL_FIELD_URL || `http://127.0.0.1:${Number(process.env.CHARLOTTENDAL_SIM_PORT || 8911)}/`, accountUrl: process.env.CHARLOTTENDAL_AUTH_MODE === 'password' ? '/account' : null }); }
      if (url.pathname === '/api/train-information') return json(res, {...trainInformation.snapshot(),...trainInformation.catalog()});
      if(url.pathname==='/api/bindings')return json(res,bindings.view());
      if(url.pathname==='/api/bindings/export'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Disposition':'attachment; filename=charlottendal-driftprofil.json'});return res.end(req.method==='HEAD'?undefined:JSON.stringify(bindings.export(),null,2));}
      if (url.pathname === '/api/configuration') return json(res, configuration.view());
      if (url.pathname === '/api/presentation') return json(res, configuration.presentation());
      if (url.pathname === '/api/recordings') return json(res,recorder.view());
      if (url.pathname.startsWith('/api/recordings/')&&url.pathname.endsWith('/download')) {
        const id=url.pathname.slice('/api/recordings/'.length,-'/download'.length),doc=await recorder.export(id);
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="charlottendal-telegram-${doc.id}.json"`});
        return res.end(req.method==='HEAD'?undefined:JSON.stringify(doc,null,2)+'\n');
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
        if (req.method === 'HEAD') return res.end();
        res.write(`data: ${JSON.stringify(snapshot())}\n\n`); streams.add(res);
        const expiry = expires ? setTimeout(() => res.end(), Math.max(1, expires - Date.now())) : null;
        req.on('close', () => { streams.delete(res); clearTimeout(expiry); }); return;
      }
      if (url.pathname.startsWith('/api/')) return json(res, { error: 'Finns inte' }, 404);
      return staticFile(res, root, decodeURIComponent(url.pathname));
    }
    const data = await body(req,65536);
    if(url.pathname.startsWith('/api/bindings/')){const command=url.pathname.slice('/api/bindings/'.length);if(!['save','discard','restore','activate'].includes(command))return json(res,{error:'Okänd driftinställning'},404);const result=bindings[command](data);engine.log('bindings',command==='activate'?'Driftprofil version '+result.activeVersion+' aktiverad. AIS kvarstår, alla rapporter läses in på nytt.':'Driftinställningarnas utkast uppdaterat.');dirty=true;return json(res,result);}
    if(url.pathname.startsWith('/api/streamdeck/')){
      const command=url.pathname.slice('/api/streamdeck/'.length);
      if(!['seen','save','activate','discard','reset','rename','copy','remove'].includes(command))return json(res,{error:'Okänd Stream Deck-åtgärd'},404);
      const decks=streamDeckLayouts.data.decks,before=typeof data?.serial==='string'&&Object.hasOwn(decks,data.serial)?decks[data.serial]:null,result=streamDeckLayouts[command](data);dirty=true;
      const name=(Object.hasOwn(result.decks,data.serial)?result.decks[data.serial].name:before?.name)||'Stream Deck';
      if(command==='seen'&&!before)engine.log('streamdeck',name+' känns igen för första gången.');
      if(command==='activate')engine.log('streamdeck','Stream Deck-layout för '+name+' version '+result.decks[data.serial].activeVersion+' aktiverad.');
      if(command==='reset')engine.log('streamdeck',name+' använder standardlayouten.');
      if(command==='remove')engine.log('streamdeck',name+' är glömt.');
      return json(res,result);
    }
    if(url.pathname==='/api/destinations'){const result=destinations.save(data,trainMeet.context?.stations||[]);dirty=true;return json(res,result);}
    if(url.pathname.startsWith('/api/trainmeet/')){const command={configure:'configure',pair:'pair',refresh:'refresh',disconnect:'disconnect',stations:'stations',clearance:'clearance',movement:'movement'}[url.pathname.slice('/api/trainmeet/'.length)];if(!command)return json(res,{error:'Okänd TrainMeet-åtgärd'},404);return json(res,await trainMeet[command](data));}
    // On a Raspberry Pi the panel can start cda-tkl-update.service (allowed for the cda-tkl
    // user by the installer's polkit rule). It reinstalls and restarts TKL; the panel then
    // offers a reload. Elsewhere the update is started from Terminal or PowerShell.
    if(url.pathname==='/api/update/start'){
      if(!updateCheck?.view().canStart)return json(res,{error:'Uppdateringen startas från Terminal eller PowerShell på den här datorn.'},409);
      const run=spawn('systemctl',['start','--no-block','cda-tkl-update.service'],{stdio:'ignore'});
      const code=await new Promise(r=>{run.on('error',()=>r(-1));run.on('exit',r);});
      if(code!==0)return json(res,{error:'Uppdateringen kunde inte startas (systemctl '+code+'). Kör sudo cda-tkl-update på Pi:n.'},409);
      engine.log('update','Uppdatering till '+(updateCheck.view().latest||'senaste versionen')+' startad. TKL startar om när den är installerad.');dirty=true;
      return json(res,{started:true});
    }
    if(url.pathname==='/api/clock'){const result=modelClock.change(data);dirty=true;engine.log('clock','Modellklockan '+(result.running?'går':'är pausad')+' med hastighet '+result.rate+'×.');return json(res,result);}
    if(url.pathname==='/api/recordings/start'){recorder.start(data,engine.connected?'connected':'disconnected');return json(res,recorder.view());}
    if(url.pathname==='/api/recordings/stop'){await recorder.stop(data);return json(res,recorder.view());}
    if (url.pathname.startsWith('/api/configuration/')) {
      const command=url.pathname.slice('/api/configuration/'.length);
      if(!['save','restore','discard','activate'].includes(command)) return json(res,{error:'Okänd inställningsåtgärd'},404);
      const result=configuration[command](data); dirty=true;
      engine.log('configuration',command==='activate'?`Visningsinställningar version ${result.active.activeVersion} aktiverad.`:'Inställningsutkast '+({save:'sparat',restore:'hämtat från historiken',discard:'kastat'}[command])+'.');
      return json(res,result);
    }
    if(url.pathname.startsWith('/api/train-information/')) {
      const command=url.pathname.slice('/api/train-information/'.length);
      if(!['save','move','follow','unfollow'].includes(command)) return json(res,{error:'Okänd informationsåtgärd'},404);
      const result=trainInformation[command](data);dirty=true;
      engine.log('train-information',({move:'Tågnummer flyttat manuellt mellan informationsfält.',follow:'Tågnummer kopplat till rapporterad passage.',unfollow:'Tågnummerföljning avslutad av operatören.',save:'Tåginformation registrerad eller kontrollerad manuellt.'})[command]);
      return json(res,result);
    }
    if (url.pathname === '/api/route') engine.request(data.from, data.to, data.intent);
    else if (url.pathname === '/api/cancel') engine.cancel(data.id);
    else if (url.pathname === '/api/turnout') engine.manual(data.name, data.position);
    else if (url.pathname === '/api/track-block') engine.blockTrack(data.name, data.blocked);
    else if (url.pathname === '/api/line-block') {engine.operating.checkCommand(data);engine.operating.blockLine(data.id,data.blocked);}
    else if (url.pathname === '/api/programming') {engine.operating.checkCommand(data);engine.operating.setProgramming(data.enabled);}
    else if (url.pathname === '/api/yard-authority') {engine.operating.checkCommand(data);engine.yard.setOwner(data.owner);}
    else if (url.pathname === '/api/all-stop') engine.allStop(data.enabled);
    else if (url.pathname === '/api/panel-reset') engine.resetPanel();
    else if (url.pathname === '/api/emergency-cancel') engine.emergencyCancelAll();
    else if (url.pathname === '/api/control-mode') engine.setMode(data.mode);
    else if (url.pathname === '/api/note') {
      if (typeof data.key !== 'string' || data.key.length > 120 || typeof data.note !== 'string' || data.note.length > 4000 || ['__proto__', 'constructor', 'prototype'].includes(data.key)) throw Error('Ogiltig anteckning');
      const next = { ...notes, [data.key]: data.note }; storage.save('notes.json', next); notes = next;
    } else return json(res, { error: 'Okänd manöver' }, 404);
    json(res, { ok: true, state: snapshot() });
  } catch (e) { json(res, { error: e.message }, e.status || 400); }
});
let tick, publish;
server.listen(port, '127.0.0.1', () => {
  console.log(`Charlottendal TKL: http://127.0.0.1:${port}`); client.start();
  tick = setInterval(() => {protect(() => engine.tick());recorder.tick();modelClock.checkpoint();trainMeet.tick();if(Date.now()-clockPublished>1000){dirty=true;clockPublished=Date.now();}}, 100);
  publish = setInterval(() => {
    if (!dirty) return; dirty = false; const text = `data: ${JSON.stringify(snapshot())}\n\n`;
    for (const res of streams) { if (res.writableLength > 1e6) { res.end(); streams.delete(res); } else res.write(text); }
  }, 150);
});
server.on('error', e => { console.error(e.message); process.exit(1); });
let closing=false;
async function close() {
  if(closing)return;closing=true;
  clearInterval(tick); clearInterval(publish);
  for (const n of Object.keys(engine.signals)) protect(() => engine.permission(n, 'STOP'));
  modelClock.checkpoint(true);
  await recorder.finish('server-shutdown');
  setTimeout(() => { client.stop(); for (const s of streams) s.end(); server.close(() => process.exit(0)); }, 250);
}
process.on('SIGINT', close); process.on('SIGTERM', close);
