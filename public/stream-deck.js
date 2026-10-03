// Stream Deck as a keyboard for the panel over WebHID. Several decks can be open at once
// (the Raspberry Pi drives all three); each is known by its serial number and shows the
// layout saved for it, or the automatic one. A key press does exactly what a click on
// the plupp does, through the same choose() and the same API calls, so locks, modes and
// refusals apply unchanged. Line keys walk the TMBox sequence for the next train toward
// or from each neighbour; turn keys follow the trains in timetable order. Key images are
// drawn by stream-deck-render.js, the same code the layout editor uses. Nothing here
// talks to the field.
import sd from './vendor/elgato-stream-deck-webhid.js';
import {buildPages,pluppSpec,signature} from './stream-deck-layout.js';
import {departureKey,arrivalKey} from './stream-deck-trains.js';
import {turnSpec} from './stream-deck-turns.js';
import {layoutPages,fits,modelFor,MODELS} from './stream-deck-profile.js';
import {keySpec,drawKey,holdOf} from './stream-deck-render.js';
const STORAGE='charlottendal-streamdeck',LONG_PRESS=800,VENDOR=4057;
async function post(path,data){
  const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const answer=await response.json().catch(()=>null);if(!response.ok||!answer)throw Error(answer?.error||'Servern svarade med fel '+response.status+'.');return answer;
}
// A serial the server accepts: letters, digits, dot, dash and underscore, starting with a letter or digit.
export const cleanSerial=v=>String(v??'').replace(/[^A-Za-z0-9._-]/g,'').replace(/^[^A-Za-z0-9]+/,'').slice(0,64);
// hid, library and locks are the browser's WebHID, the Stream Deck library and Web Locks;
// tests pass stand-ins.
export function createStreamDeck({pluppar,choose,clearChoice,api,message,state,online,chosen,trainMeet,layout,onChange,hid=typeof navigator!=='undefined'?navigator.hid:null,library=sd,locks=typeof navigator!=='undefined'?navigator.locks:null}){
  const $=id=>document.getElementById(id),statusNode=$('streamdeck-status'),connectButton=$('streamdeck-connect'),disconnectButton=$('streamdeck-disconnect'),originNode=$('streamdeck-origin'),pagesNode=$('streamdeck-pages');
  const supported=!!hid&&typeof window!=='undefined'&&window.isSecureContext;
  const units=new Map(),previews=new Map();
  // Without Web Locks every window drives its decks, as before.
  let previewSeq=0,blinkOn=false,timer=null,scanning=false,owner=!locks;
  const deckEntry=serial=>{const decks=layout?.()?.decks;return decks&&Object.hasOwn(decks,serial)?decks[serial]:null;};
  const nameOf=unit=>deckEntry(unit.serial)?.name||unit.deck.PRODUCT_NAME||'Stream Deck';
  const changed=()=>{try{onChange?.();}catch{}};
  function status(){
    if(statusNode)statusNode.textContent=!supported?'WebHID saknas här. Använd Chrome, Edge eller Chromium på en säker adress (https eller localhost).'
      :!owner?'Stream Deck styrs från ett annat fönster med ställverket. Tryck Styr härifrån för att ta över.'
      :units.size?[...units.values()].map(u=>`${nameOf(u)} · ${MODELS[u.model]?.short||u.controls.length+' knappar'} · sida ${u.page+1} av ${u.pages.length} · ${u.saved?.label||'standardlayout'}`).join('. ')+'.':'Ej ansluten.';
    if(connectButton){connectButton.disabled=!supported;connectButton.textContent=!owner?'Styr härifrån':units.size?'Anslut fler':'Anslut Stream Deck';}
    if(disconnectButton)disconnectButton.hidden=!units.size;
  }
  status();
  if(originNode)originNode.textContent=`Den här sidan: ${location.origin} · ${!hid?'WebHID saknas i webbläsaren, öppna adressen i Chrome':!window.isSecureContext?'osäker adress, använd https eller localhost':'WebHID tillgängligt'}.`;
  const off=()=>{try{return localStorage.getItem(STORAGE)==='off';}catch{return false;}};
  // One window per browser drives the decks. Two would both act on every press, and a
  // route requested twice used to be a route laid and taken back. The other windows wait
  // and take over when that window closes, or at once with Styr härifrån.
  const LOCK='charlottendal-streamdeck';
  let waiting=null;
  function claim(steal=false){
    if(!supported||!locks)return;
    // At most one request per window: taking over withdraws the one waiting in the queue.
    if(waiting){waiting.abort();waiting=null;}
    const wait=steal?null:new AbortController();waiting=wait;
    locks.request(LOCK,steal?{steal:true}:{signal:wait.signal},()=>{if(waiting===wait)waiting=null;owner=true;status();changed();if(!off())scan();return new Promise(()=>{});})
      .catch(e=>{if(wait?.signal.aborted||e?.name!=='AbortError')return;owner=false;release();claim();});
  }
  // Let go of the decks without clearing them: the window taking over draws on them.
  function release(){
    const list=[...units.values()];for(const u of list){forgetUnit(u);u.deck.close().catch(()=>{});}
    if(pagesNode)pagesNode.replaceChildren();status();changed();
  }
  // Open every Stream Deck the browser allows that is not open yet.
  async function scan(){
    if(!supported||!owner||scanning)return;scanning=true;
    try{
      for(const device of await hid.getDevices()){
        if(device.vendorId!==VENDOR||device.opened||[...units.values()].some(u=>u.hid===device))continue;
        try{await attach(await library.openDevice(device));}catch(e){message('Stream Deck kunde inte öppnas: '+(e?.message||e));}
      }
    }finally{scanning=false;status();}
  }
  async function connect(prompt){
    if(!supported)return false;
    try{
      if(prompt){const chosenDevices=await hid.requestDevice({filters:[{vendorId:VENDOR}]});if(!chosenDevices.length){message('Ingen Stream Deck valdes.');return false;}}
      try{localStorage.setItem(STORAGE,'auto');}catch{}
      if(!owner){claim(true);return true;}
      await scan();return units.size>0;
    }catch(e){message('Stream Deck kunde inte öppnas: '+(e?.message||e));return false;}
  }
  async function attach(deck){
    const controls=deck.CONTROLS.filter(c=>c.type==='button'&&c.feedbackType==='lcd');
    if(!controls.length){message('Den här Stream Deck-modellen saknar bildknappar.');await deck.close().catch(()=>{});return;}
    const columns=Math.max(...controls.map(c=>c.column))+1,rows=Math.max(...controls.map(c=>c.row))+1,model=modelFor(columns,rows);
    let serial='';try{serial=cleanSerial(await deck.getSerialNumber());}catch{}
    if(!serial)serial=(model||'deck')+'-'+(deck.hid?.device?.productId||0);
    while(units.has(serial))serial=serial.slice(0,60)+'-2';
    const size=controls[0].pixelSize?.width||72,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const unit={deck,hid:deck.hid?.device,serial,model,columns,rows,controls,size,canvas,ctx:canvas.getContext('2d',{willReadFrequently:true}),pages:[[]],pagesSig:'',saved:null,page:0,shown:new Map(),downAt:new Map(),downTrain:new Map(),rendering:false,again:false,identifying:false};
    deck.on('error',e=>{message('Stream Deck: '+(e?.message||e));});
    deck.on('down',c=>{if(c.type!=='button')return;unit.downAt.set(c.index,performance.now());unit.downTrain.set(c.index,unit.shown.get(c.index)?.movementId||'');});
    deck.on('up',c=>{if(c.type==='button')press(unit,c.index,performance.now()-(unit.downAt.get(c.index)??performance.now()));});
    await deck.clearPanel();await deck.setBrightness(80);
    units.set(serial,unit);
    // Tell the server the deck is here, so the editor can name it and give it a layout.
    if(model)post('streamdeck/seen',{serial,model}).catch(e=>message('Stream Deck kunde inte registreras: '+e.message));
    if(!timer)timer=setInterval(()=>{blinkOn=!blinkOn;for(const u of units.values())if([...u.shown.values()].some(s=>s.blink))paint(u);},600);
    paint(unit,true);status();changed();
  }
  function forgetUnit(unit){units.delete(unit.serial);if(!units.size&&timer){clearInterval(timer);timer=null;}}
  async function detach(forget=true){
    const list=[...units.values()];for(const u of list)forgetUnit(u);
    if(forget){try{localStorage.setItem(STORAGE,'off');}catch{}}
    for(const u of list){try{await u.deck.clearPanel();}catch{}try{await u.deck.close();}catch{}}
    if(pagesNode)pagesNode.replaceChildren();status();changed();
  }
  if(supported)hid.addEventListener('disconnect',e=>{
    const gone=[...units.values()].filter(u=>u.hid===e.device);if(!gone.length)return;
    for(const u of gone)forgetUnit(u);
    status();if(statusNode&&!units.size)statusNode.textContent='Stream Deck frånkopplad. Anslut den igen så återupptas visningen.';
    describe();changed();
  });
  const context=()=>trainMeet()?.context||null;
  const lines=()=>context()?.lines||[];
  // A draft shown from the editor wins, then the deck's own active layout, then (for a deck
  // the server has not seen yet) the old shared layout, and otherwise the automatic one.
  function savedFor(unit){
    const n=unit.controls.length,preview=previews.get(unit.serial);
    if(preview&&fits(preview,n))return {layout:preview,version:'p'+previewSeq,label:'utkastet visas'};
    const entry=deckEntry(unit.serial);
    if(entry?.active&&fits(entry.active,n))return {layout:entry.active,version:'v'+entry.activeVersion,label:'egen layout version '+entry.activeVersion};
    const legacy=layout?.()?.legacy?.layout;
    if(!entry&&legacy?.model===unit.model)return {layout:legacy,version:'legacy',label:'gemensam layout'};
    return null;
  }
  function keys(unit){
    const list=pluppar(),current=lines(),saved=savedFor(unit),sig=list.length+'|'+current.map(l=>l.id).join(',')+'|'+unit.controls.length+'|'+(saved?.version||'auto');
    if(sig!==unit.pagesSig){unit.pagesSig=sig;unit.saved=saved;unit.pages=saved?layoutPages(saved.layout,{pluppar:list,lines:current}):buildPages(list,unit.controls.length,current);if(unit.page>=unit.pages.length)unit.page=0;describe();}
    return unit.pages;
  }
  function describe(){
    if(!pagesNode)return;
    const name=k=>!k?'tom':k.text||(k.type==='train'?`${k.role==='departure'?'→':'←'} ${k.neighborCode||k.neighborName}`:k.type==='turn'?'tåg på tur '+k.slot:k.type==='plupp'?k.label:k.type==='missing'?'saknas ('+k.label+')':k.title);
    pagesNode.replaceChildren(...[...units.values()].flatMap(u=>u.pages.map((p,i)=>{const line=document.createElement('p');line.textContent=`${nameOf(u)}, ${u.saved?u.saved.layout.pages[i]?.name||'Sida '+(i+1):'Sida '+(i+1)}: ${p.map(name).join(' · ')}`;return line;})));
  }
  function trainSpec(key){
    const c=context(),line=c?.lines.find(l=>l.id===key.lineId);
    if(!line)return {kind:'train',role:key.role,lineId:key.lineId,neighborCode:key.neighborCode,number:'',time:'',text:'TrainMeet ej ansluten',step:'none',fill:'',blink:false,dim:true,short:null,long:null};
    return key.role==='departure'?departureKey(line,c):arrivalKey(line,c);
  }
  // Everything a key's look depends on, for the deck and for the editor's copy of it.
  function environment({page=0,pages=1}={}){
    const s=state(),nodes=new Map(pluppar().map(p=>[p.id,p.node]));
    const yard=s?.yard?{delegated:s.yard.owner==='ranger',allowed:!!s.yard.change?.allowed}:null;
    return {plupp:k=>pluppSpec(k,new Set(nodes.get(k.id)?.classList||[]),nodes.get(k.id)?.dataset.routePhase||''),train:trainSpec,turn:k=>turnSpec(k,context()),
      system:{stopAll:!!s?.controls?.stopAll,chosen:!!chosen(),page,pages,remote:s?.controls?.mode==='remote',yard},online:online()};
  }
  function act(spec,action){
    if(!action)return;
    const tm=trainMeet();if(!tm?.paired)return message('TrainMeet är inte parkopplad.');
    const base={sessionId:tm.sessionId,revision:tm.revision};
    if(action.type==='clearance'){if(!spec.lineId)return message('Tåget har ingen sträcka att klarera.');return api('trainmeet/clearance',{...base,connectionId:spec.lineId,action:action.action,trainNumber:action.trainNumber||''});}
    if(action.type==='movement')return api('trainmeet/movement',{...base,movementId:action.movementId,...(action.departure?{departure:action.departure}:{}),...(action.arrival?{arrival:action.arrival}:{})});
  }
  const keyName=key=>key.text||key.title||key.label||'knappen';
  function press(unit,index,held){
    if(!units.has(unit.serial)||unit.identifying)return;
    const pages=keys(unit),key=pages[unit.page]?.[index];if(!key)return;
    const need=holdOf(key);
    if(need&&held<need)return message(`Håll in ${keyName(key)} i ${need/1000===1?'en sekund':need/1000+' sekunder'}.`,{error:false});
    const go=page=>{unit.page=page;paint(unit,true);status();};
    if(key.type==='plupp')return choose(key.id,key.kind);
    if(key.type==='page')return go(Math.min(key.target,pages.length-1));
    if(key.type==='nav')return go(key.to==='next'?(unit.page+1)%pages.length:key.to==='prev'?(unit.page-1+pages.length)%pages.length:0);
    if(key.type==='missing')return message('Knappen '+key.label+' saknar underlag i den här installationen.');
    if(key.type==='train'||key.type==='turn'){
      const spec=key.type==='train'?trainSpec(key):turnSpec(key,context()),long=held>=LONG_PRESS;
      // A turn key can move on to the next train while it is held; never act on a train the operator did not see.
      if(key.type==='turn'&&unit.downTrain.get(index)!==(spec.movementId||''))return message('Knappen bytte tåg medan den hölls in. Tryck igen.',{error:false});
      const action=long?spec.long:spec.short;
      if(action)return act(spec,action);
      if(long&&spec.short)return message('Kort tryck: '+spec.text,{error:false});
      return message(spec.number?`Tåg ${spec.number}: ${spec.text}.`:spec.text,{error:false});
    }
    const s=state();
    switch(key.id){
      case 'page':return go((unit.page+1)%pages.length);
      case 'all-stop':return api('all-stop',{enabled:true});
      case 'reset-ais':if(s?.controls?.stopAll)return api('all-stop',{enabled:false});return message('Alla signaler i stopp är inte aktiv.');
      case 'cancel':return clearChoice();
      case 'panel-reset':return $('panel-reset')?.click();
      case 'yard-authority':{
        const button=$('yard-authority');
        if(!button||button.hidden)return message('Rangerbangården kan inte lämnas över här.');
        if(button.disabled)return message(s?.yard?.change?.reason||'Manöverrätten kan inte ändras just nu.');
        return button.click();
      }
    }
  }
  async function paint(unit,force=false){
    if(!units.has(unit.serial)||unit.identifying)return;if(unit.rendering){unit.again=true;return;}unit.rendering=true;
    try{
      const current=keys(unit);if(unit.page>=current.length)unit.page=0;
      const env=environment({page:unit.page,pages:current.length});
      for(const control of unit.controls){
        const spec=keySpec(current[unit.page][control.index],env),sig=signature(spec,blinkOn);
        if(!force&&unit.shown.get(control.index)?.sig===sig)continue;
        drawKey(unit.ctx,unit.size,spec,blinkOn);await unit.deck.fillKeyCanvas(control.index,unit.canvas);
        unit.shown.set(control.index,{sig,blink:!!spec.blink,movementId:spec.movementId||''});
      }
    }catch(e){message('Stream Deck kunde inte uppdateras: '+(e?.message||e));}
    finally{unit.rendering=false;if(unit.again){unit.again=false;paint(unit);}}
  }
  function update(force=false){for(const u of units.values())paint(u,force);status();}
  // Show which physical deck is which: every key turns blue with the deck's name for two seconds.
  async function identify(serial){
    const unit=units.get(serial);if(!unit||unit.identifying)return false;
    while(unit.rendering)await new Promise(r=>setTimeout(r,20));
    unit.identifying=true;
    try{
      const c=unit.ctx,s=unit.size,name=nameOf(unit);
      c.fillStyle='#4a7fb5';c.fillRect(0,0,s,s);c.fillStyle='#ffffff';c.textAlign='center';c.textBaseline='middle';c.font=`600 ${s*0.16}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      const words=name.split(' ');words.slice(0,3).forEach((w,i,all)=>c.fillText(w,s/2,s/2+(i-(all.length-1)/2)*s*0.2));
      for(const control of unit.controls)await unit.deck.fillKeyCanvas(control.index,unit.canvas);
      await new Promise(r=>setTimeout(r,2000));
    }catch{}finally{unit.identifying=false;unit.shown=new Map();paint(unit,true);}
    return true;
  }
  if(connectButton)connectButton.onclick=()=>connect(true);
  if(disconnectButton)disconnectButton.onclick=()=>detach(true);
  // Open the Stream Decks the browser already allows (a click earlier, or the Raspberry Pi's
  // Chromium policy) at start and whenever one is plugged in, unless Koppla bort was chosen here.
  if(supported){if(locks)claim();else if(!off())scan();}
  if(supported)hid.addEventListener('connect',()=>{if(!off())scan();});
  return {
    update:()=>update(false),connect,detach,identify,environment,
    // Whether this window drives the decks (the others wait).
    driving:()=>owner,
    // The decks open in this browser right now.
    decks:()=>[...units.values()].map(u=>({serial:u.serial,model:u.model,columns:u.columns,rows:u.rows,keys:u.controls.length,product:u.deck.PRODUCT_NAME||'',page:u.page})),
    // Show an editor's draft on one deck, or go back to its saved layout with null.
    preview(serial,draft){if(draft)previews.set(serial,draft);else if(!previews.delete(serial))return;previewSeq++;const u=units.get(serial);if(u)paint(u);status();},
    previewing:serial=>previews.has(serial),
    info(){const u=units.values().next().value;return u?{connected:true,keys:u.controls.length,columns:u.columns,rows:u.rows,model:u.model,name:u.deck.PRODUCT_NAME||'',serial:u.serial}:{connected:false,keys:0,columns:0,rows:0,model:'',name:''};}
  };
}
