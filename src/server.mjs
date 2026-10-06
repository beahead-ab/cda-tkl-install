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
import { UpdateCheck, UPDATE_UNITS } from './update-check.mjs';
import { studioData, studioRules, buildRegistry, detectionInventory } from './studio/index.mjs';
import { CardInventory, mgpSummary } from './studio/cards.mjs';
import { Measurements } from './studio/measure.mjs';
import { loadSources } from './studio/sources.mjs';
import { rulesFromProfile } from './studio/rules.mjs';
import { StudioDrafts } from './studio/drafts.mjs';
import { StudioAssistant } from './studio/assistant.mjs';
import { AiSettings } from './ai-settings.mjs';
import { Onboarding } from './onboarding.mjs';
import { StudioReview } from './studio/review.mjs';
import { spawn } from 'node:child_process';

const baseProfile=loadProfile();
const port = Number(process.env.CHARLOTTENDAL_PORT || 8910), root = fileURLToPath(new URL('../public', import.meta.url));
const storage = new Storage(process.env.CHARLOTTENDAL_STATE_DIR || fileURLToPath(new URL('../var', import.meta.url)));
const auth = createAuth(root, true, process.env, { stateDir: storage.directory });
let profile,client,engine,configuration,trainInformation,panelIndications,recorder;
const bindingReports=new Map();
function activationStatus(proposed){
  const deny=reason=>({allowed:false,reason});
  if(!engine||!engine.controls.stopAll)return deny('Aktivera Alla signaler i stopp före profilbyte.');
  if(!engine.connected||engine.storageFault)return deny('Anslutning och fungerande lagring krävs.');
  if(engine.routes.length||engine.controls.programming.reserved||engine.yard.requests.length)return deny('Återta tågvägar, programmeringslås och rangerarens begäran först.');
  if(recorder.active||recorder.pending)return deny('Avsluta och spara telegraminspelningen först.');
  if(proposed){
    // I fysisk drift får en profil bara aktiveras när varje bindning är uppmätt i fält på den adress profilen har.
    if(connectionInfo(proposed).mode==='hardware'){const missing=studioMeasure.missing(proposed);if(missing.length)return deny(`${missing.length} bindningar är inte uppmätta i fält (${missing.slice(0,4).join(', ')}${missing.length>4?' …':''}). Mät dem under Driftsättning först.`);}
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
    configuration:new Configuration(p,{storage,canActivate:()=>!e.routes.length&&!e.controls.programming.reserved&&!e.yard.requests.length&&!e.storageFault}),
    trainInformation:new TrainInformation(JSON.parse(fs.readFileSync(new URL('../public/data/train-fields.json',import.meta.url))),p,{storage}),
    // Vägövergångarna ur profilen när en crossing-regel äger dem, annars ur katalogen.
    panelIndications:new PanelIndications(p.indications||JSON.parse(fs.readFileSync(new URL('../public/data/indications.json',import.meta.url))),p),
    recorder:new TelegramRecorder(storage.directory,p,{connectionInfo:target})};
}
// Studio's rules describe the network profile; another profile (the legacy commissioning
// one) runs as it is.
const withRules=p=>p.id===studioSources.profile.id?studioDrafts.apply(p).profile:p;
const bindings=new BindingConfiguration(baseProfile,{storage,canActivate:activationStatus,prepare:p=>{const next=createRuntime(withRules(p));return ()=>installRuntime(next);}});
// Studio: reglerna ovanpå driftbindningarna. Kärnan får alltid den kompilerade profilen, aldrig utkastet.
const studioSources=loadSources();
// The reviewed rules file belongs to the network profile; another profile (the legacy
// commissioning one) gets its own rules read out of itself.
const studioDrafts=new StudioDrafts({base:baseProfile,field:loadProfile('field',{activated:false}),rules:(studioSources.rules?.profile===baseProfile.id?studioSources.rules.rules:null)||rulesFromProfile(baseProfile,{indications:studioSources.indications}),storage,canActivate:activationStatus,
  prepare:(p,f)=>{storage.save('studio-field-profile.json',f);const next=createRuntime(p);return ()=>installRuntime(next);},
  proposal:()=>{const r=studioRules(studioSources,studioDrafts.activeRules());return {proposals:r.proposals,replaces:r.replaces};}});
// Chatten och AI-genomgången: Claude API med nyckeln på servern. Webbläsaren talar bara med TKL.
// AI-tjänsten: modell och nyckel ur Inställningar → Den här datorn → AI-tjänst (ai.json), med miljön som reservvärde.
const aiSettings=new AiSettings({storage});
const studioAssistant=new StudioAssistant({settings:aiSettings});
const studioReview=new StudioReview({sources:studioSources,assistant:studioAssistant,storage,activeRules:()=>studioDrafts.activeRules(),baseProfile:()=>bindings.profile()});
// Driftsättning: kortinventering över SV2 och mätning objekt för objekt. Båda går genom den aktiva LocoNet-klienten,
// bara när AIS är aktiv och inga lås finns, och inget av dem aktiverar något.
const studioCards=new CardInventory({storage,send:b=>!!client?.send(b)});
const studioMeasure=new Measurements({storage,send:b=>!!client?.send(b),guard:()=>{const s=activationStatus(null);return s.allowed?null:s.reason;},mode:()=>connectionInfo(profile).mode});
const trainMeet=new TrainMeet({storage,origin:process.env.CHARLOTTENDAL_TRAINMEET_ORIGIN||''});
// Kom igång (src/onboarding.mjs): stegens status ur det som finns; panelen visar "N steg kvar" tills ägaren markerat klart.
const onboarding=new Onboarding({storage});
const onboardingContext=()=>({auth,ai:aiSettings.view(),connection:{mode:connectionInfo(profile).mode,state:engine?.connected?'connected':'disconnected'},trainMeet:trainMeet.view()});
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
  c.on('connection',connected=>{bindingReports.clear();if(!connected){studioCards.abort();studioMeasure.abort();}recording.connection(connected);protect(()=>e.connection(connected));});
  c.on('frame',bytes=>protect(()=>{const d=decode(bytes);if(['turnout','sensor','signal'].includes(d.kind)){const key=d.kind+':'+d.address;if(!bindingReports.has(key)&&bindingReports.size>=6000)bindingReports.delete(bindingReports.keys().next().value);bindingReports.set(key,{at:Date.now(),data:d});}studioCards.observe(bytes);studioMeasure.observe(bytes);e.receive(bytes);}));
  c.on('fault',message=>{recording.fault(message);e.log('transport',String(message));});
  c.on('protocol',event=>{const decoded=describeProtocol(event.direction,event.line),objects=protocolObjects(next.profile,decoded.decoded);recording.protocol({...event,objects});protocolTrace.unshift({...event,at:Date.now(),...decoded,objects});protocolTrace.length=Math.min(protocolTrace.length,100);dirty=true;});recording.on('change',()=>{dirty=true;});
  c.on('wire',event=>{trace.unshift({...event,at:Date.now()});trace.length=Math.min(trace.length,100);dirty=true;});
  if(start)c.start();dirty=true;
}
trainMeet.on('change',()=>{dirty=true;});trainMeet.on('journal',text=>{engine.log('trainmeet',text);dirty=true;});
installRuntime(createRuntime(withRules(bindings.profile())),false);
// Layouts are checked against the live profile's pluppar, so the store is created once the runtime exists.
const streamDeckLayouts=new StreamDeckLayouts(storage,{pluppIds:()=>Object.keys(profile?.buttons||{})});
// The version this process was started with. An open panel compares it with the
// version it was loaded from and offers a reload after a release.
const release=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
// Installed copies look for a newer release in the public install repository.
// The web deployment sets no install kind; its own updater (installed by publish-release)
// makes it one, so Inställningar → Uppdatering can update it from cda-tkl-install.
const installKind=process.env.CHARLOTTENDAL_INSTALL_KIND||(fs.existsSync('/usr/local/sbin/charlottendal-update')?'web':'');
const updateCheck=installKind?new UpdateCheck({current:release,kind:installKind,statusFile:path.join(storage.directory,'update.json'),readFile:file=>fs.readFileSync(file,'utf8')}):null;
updateCheck?.start();
const snapshot = () => {const state=engine.snapshot();return { ...state,release,update:updateCheck?.view()??null,connectionInfo:connectionInfo(profile),destinations:destinations.view(),streamDeck:streamDeckLayouts.view(),bindingVersion:bindings.data.activeVersion,bindingActivation:activationStatus(), recordings:recorder.view(),clock:modelClock.snapshot(),trainMeet:trainMeet.view(),panelIndications:panelIndications.snapshot(state),trace, configurationVersion:configuration.data.activeVersion,trainInformation:trainInformation.snapshot() };};
const server = http.createServer(async (req, res) => {
  try {
    guard(req, port); const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (await auth.handle(req, res, url)) return;
    const expires = await auth.authenticate(req, url);
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (url.pathname === '/api/state') return json(res, snapshot());
      if(url.pathname==='/api/communication')return json(res,{connection:connectionInfo(profile),connectionState:engine.connected?'connected':'disconnected',expectations:commandExpectations(profile,engine.snapshot()),trace:protocolTrace});
      if(url.pathname==='/api/studio'){const measured=studioMeasure.measured(profile);return json(res,{...studioData(studioSources,studioDrafts.activeRules(),measured),drafts:studioDrafts.view(bindings.profile()),review:studioReview.view(),
        measure:studioMeasure.view(profile),cards:studioCards.view(),mgp:mgpSummary({profile,xml:studioSources.xml},buildRegistry(studioSources,measured),studioCards.view().cards,{sections:detectionInventory(studioSources).sections,measured})});}
      if(url.pathname==='/api/ai')return json(res,aiSettings.view());
      if(url.pathname==='/api/onboarding')return json(res,onboarding.view(onboardingContext()));
      // Inställningar → Användare: alla inloggade ser listan; ägaren ändrar den (src/users.mjs).
      if(url.pathname==='/api/users'){const me=auth.requireRole(req,'admin');return json(res,{...auth.users.summary(),me:{id:me.id,username:me.username,role:me.role},mode:auth.mode});}
      if(url.pathname==='/api/studio/measure')return json(res,studioMeasure.view(profile));
      if(url.pathname==='/api/studio/cards')return json(res,studioCards.view());
      if(url.pathname==='/api/studio/mgp/export'){const measured=studioMeasure.measured(profile);const doc={format:'charlottendal-mgp-v1',at:Date.now(),sourceHash:studioSources.profile.sourceHash,mode:connectionInfo(profile).mode,cards:studioCards.view().cards,modules:mgpSummary({profile,xml:studioSources.xml},buildRegistry(studioSources,measured),studioCards.view().cards,{sections:detectionInventory(studioSources).sections,measured})};
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="charlottendal-mgp.json"'});return res.end(req.method==='HEAD'?undefined:JSON.stringify(doc,null,2)+'\n');}
      // A preview only: the ranger's own targets are a narrower list, never a wider one.
      if(url.pathname==='/api/route-targets')return json(res,{targets:engine.routeTargets(url.searchParams.get('from'),url.searchParams.get('kind')||'main',url.searchParams.get('operator')==='ranger'?'ranger':'tkl')});
      if (url.pathname === '/api/config') { const {routeAlternatives,...panelProfile}=profile; return json(res, { ...panelProfile,release,bindingVersion:bindings.data.activeVersion, notes, trainFields:trainInformation.catalog(),panelIndications:panelIndications.catalog(), presentation:configuration.presentation(), fieldUrl: process.env.CHARLOTTENDAL_FIELD_URL || `http://127.0.0.1:${Number(process.env.CHARLOTTENDAL_SIM_PORT || 8911)}/`, accountUrl: auth.mode === 'external' ? '/account' : null, authMode: auth.mode, onboarding: (v => ({ done: v.done, remaining: v.remaining, steps: v.steps.map(x => ({ id: x.id, label: x.label, done: x.done, skipped: x.skipped })) }))(onboarding.view(onboardingContext())) }); }
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
    if(url.pathname.startsWith('/api/users/')){
      const command=url.pathname.slice('/api/users/'.length);if(!['invite','reissue','remove'].includes(command))return json(res,{error:'Finns inte'},404);
      const me=auth.requireRole(req,'owner'),ROLE={owner:'ägare',admin:'administratör',ranger:'rangerare'};
      if(command==='invite'){const r=auth.users.invite({username:data.username,role:data.role});engine.log('users',`${r.user.username} inbjuden som ${ROLE[r.user.role]} av ${me.username}.`);return json(res,{...r,...auth.users.summary()});}
      if(command==='reissue'){const r=auth.users.reissue(data.id);engine.log('users',`Ny inbjudningskod till ${r.user.username} av ${me.username}; tidigare lösenord och inloggningar gäller inte längre.`);auth.emit('invalidate');return json(res,{...r,...auth.users.summary()});}
      const gone=auth.users.user(data.id),summary=auth.users.remove(data.id,{by:me.id});engine.log('users',`${gone?.username||'Användare'} borttagen av ${me.username}.`);auth.emit('invalidate');return json(res,summary);
    }
    if(url.pathname==='/api/onboarding/finish'){const me=auth.access(req).user;const v=onboarding.finish(data,{by:me?.username||null,context:onboardingContext()});engine.log('onboarding','Kom igång markerad som klar'+(me?' av '+me.username:'')+(v.skipped.length?'; överhoppat: '+v.skipped.join(', '):'')+'.');dirty=true;return json(res,v);}
    if(url.pathname==='/api/onboarding/reopen')return json(res,onboarding.reopen(onboardingContext()));
    if(url.pathname==='/api/ai/save')return json(res,aiSettings.save(data));
    if(url.pathname==='/api/ai/clear')return json(res,aiSettings.clear());
    if(url.pathname==='/api/ai/test'){
      // Provet går med de sparade inställningarna; utfallet sparas så att sidan visar när anslutningen senast fungerade.
      try{const r=await studioAssistant.probe();return json(res,{...aiSettings.recordTest({ok:true,model:r.model,greeting:r.greeting}),probe:r});}
      catch(e){aiSettings.recordTest({ok:false,error:e.message});throw e;}
    }
    if(url.pathname==='/api/studio/assistant/propose')return json(res,await studioAssistant.propose(data,{profile:bindings.profile(),xml:studioSources.xml,activeRules:studioDrafts.activeRules(),names:studioDrafts.names}));
    if(url.pathname==='/api/studio/review/run')return json(res,await studioReview.run());
    if(url.pathname==='/api/studio/bindings/propose-signals'){
      // Signaladresserna ur XML som driftbindningsutkast: utgången LTn blir order- och rapportadress n, status ej uppmätt. Granskas under Driftbindningar.
      if(bindings.data.draft)return json(res,{error:'Det finns redan ett utkast till driftbindningar. Granska eller kasta det först.'},409);
      const registry=buildRegistry(studioSources),proposed=[],skipped=[];
      for(const s of registry.signals){const out=s.source.find(o=>/^LT\d+$/.test(o.system));const address=out?Number(out.system.slice(2)):null;if(!address){skipped.push(s.id+': ingen LT-utgång i XML');continue;}
        const row=bindings.objects.get('signals:'+s.id),v=bindings.view();try{bindings.save({sessionId:v.sessionId,revision:v.revision,key:'signals:'+s.id,values:{...row.values,address,reportAddress:address}});proposed.push(s.id);}catch(e){skipped.push(s.id+': '+e.message);}}
      dirty=true;return json(res,{proposed:proposed.length,skipped,bindings:bindings.view()});}
    if(url.pathname.startsWith('/api/studio/measure/')){const command=url.pathname.slice('/api/studio/measure/'.length);if(!['probe','confirm','cancel','remove'].includes(command))return json(res,{error:'Okänt mätkommando'},404);const result=studioMeasure[command](data,profile);if(command==='confirm')engine.log('studio',`${data.name} uppmätt av ${String(data.by).trim()}.`);dirty=true;return json(res,result);}
    if(url.pathname.startsWith('/api/studio/cards/')){const command=url.pathname.slice('/api/studio/cards/'.length);if(!['discover','identify','read','assign'].includes(command))return json(res,{error:'Okänt kortkommando'},404);return json(res,await studioCards[command](data));}
    if(url.pathname.startsWith('/api/studio/drafts/')){const command=url.pathname.slice('/api/studio/drafts/'.length);if(!['create','test','activate','discard','restore'].includes(command))return json(res,{error:'Okänt utkastkommando'},404);const result=studioDrafts[command](data,bindings.profile());if(command==='activate')engine.log('studio','Regelversion '+result.activeVersion+' aktiverad. AIS kvarstår, alla rapporter läses in på nytt.');dirty=true;return json(res,result);}
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
    // Uppdatering → Sök efter ny version: ask cda-tkl-install now rather than at the next hourly check.
    if(url.pathname==='/api/update/check'){
      if(!updateCheck)return json(res,{error:'Den här installationen söker inte efter nya versioner.'},409);
      const view=await updateCheck.check();dirty=true;return json(res,view);
    }
    if(url.pathname==='/api/update/start'){
      if(!updateCheck?.view().canStart)return json(res,{error:'Uppdateringen startas från Terminal eller PowerShell på den här datorn.'},409);
      const unit=UPDATE_UNITS[updateCheck.kind];
      const run=spawn('systemctl',['start','--no-block',unit],{stdio:'ignore'});
      const code=await new Promise(r=>{run.on('error',()=>r(-1));run.on('exit',r);});
      if(code!==0)return json(res,{error:'Uppdateringen kunde inte startas (systemctl '+code+'). Kör sudo '+unit.replace('.service','')+' på '+(updateCheck.kind==='web'?'servern':'Pi:n')+'.'},409);
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
    // The ranger's requests (docs/rangerlage.md). request and return are the ranger's
    // actions, answer and withdraw TKL's; the action itself names the operator, never
    // a client field. The ranger's own view and login come in a later step; until
    // then the authenticated panel can play both parts.
    else if (url.pathname === '/api/ranger/request') engine.yard.request(data.group);
    else if (url.pathname === '/api/ranger/answer') engine.yard.answer(data.id,data.approved===true);
    else if (url.pathname === '/api/ranger/return') engine.yard.return(data.id,'ranger');
    else if (url.pathname === '/api/ranger/withdraw') engine.yard.return(data.id,'tkl');
    // The ranger's own moves: own turnouts and boundaries back, shunt routes in the area.
    else if (url.pathname === '/api/ranger/turnout') engine.manual(data.name, data.position, {operator:'ranger'});
    else if (url.pathname === '/api/ranger/path') engine.yard.layPath(data.id);
    else if (url.pathname === '/api/ranger/route') engine.request(data.from, data.to, data.intent, {operator:'ranger'});
    else if (url.pathname === '/api/ranger/cancel') engine.cancel(data.id, {operator:'ranger'});
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
// CHARLOTTENDAL_LISTEN=0.0.0.0 lets the rangerare's station reach TKL over the layout's network.
server.listen(port, process.env.CHARLOTTENDAL_LISTEN || '127.0.0.1', () => {
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
