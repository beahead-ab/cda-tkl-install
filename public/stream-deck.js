// Stream Deck as a keyboard for the panel over WebHID. A key press does exactly
// what a click on the plupp does, through the same choose() and the same API
// calls, so locks, modes and refusals apply unchanged. Line keys walk the
// TMBox sequence for the next train toward or from each neighbour. Key images
// are drawn from the pluppar's own classes and the TrainMeet context each
// paint. Nothing here talks to the field.
import sd from './vendor/elgato-stream-deck-webhid.js';
import {buildPages,pluppSpec,systemSpec,signature,COLORS} from './stream-deck-layout.js';
import {departureKey,arrivalKey} from './stream-deck-trains.js';
import {layoutPages,fits,keyCount,modelFor} from './stream-deck-profile.js';
const STORAGE='charlottendal-streamdeck',LONG_PRESS=800;
export function createStreamDeck({pluppar,choose,clearChoice,api,message,state,online,chosen,trainMeet,layout}){
  const $=id=>document.getElementById(id),statusNode=$('streamdeck-status'),connectButton=$('streamdeck-connect'),disconnectButton=$('streamdeck-disconnect'),originNode=$('streamdeck-origin'),pagesNode=$('streamdeck-pages');
  const supported=typeof navigator!=='undefined'&&!!navigator.hid&&window.isSecureContext;
  let deck=null,controls=[],size=72,pages=[[]],pagesSig='',page=0,shown=new Map(),downAt=new Map(),blinkOn=false,timer=null,rendering=false,again=false;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  function status(text){if(statusNode)statusNode.textContent=text;if(connectButton)connectButton.hidden=!!deck;if(disconnectButton)disconnectButton.hidden=!deck;}
  if(!supported){status('WebHID saknas här. Använd Chrome, Edge eller Chromium på en säker adress (https eller localhost).');if(connectButton)connectButton.disabled=true;}
  else status('Ej ansluten.');
  if(originNode)originNode.textContent=`Den här sidan: ${location.origin} · ${!navigator.hid?'WebHID saknas i webbläsaren, öppna adressen i Chrome':!window.isSecureContext?'osäker adress, använd https eller localhost':'WebHID tillgängligt'}.`;
  async function connect(prompt){
    if(!supported)return false;
    try{
      const list=prompt?await sd.requestStreamDecks():await sd.getStreamDecks();
      if(!list.length){if(prompt)message('Ingen Stream Deck valdes.');return false;}
      await attach(list[0]);for(const extra of list.slice(1))extra.close().catch(()=>{});return true;
    }catch(e){message('Stream Deck kunde inte öppnas: '+(e?.message||e));status('Ej ansluten.');return false;}
  }
  async function attach(device){
    deck=device;controls=deck.CONTROLS.filter(c=>c.type==='button'&&c.feedbackType==='lcd');
    if(!controls.length){message('Den här Stream Deck-modellen saknar bildknappar.');await detach(false);return;}
    size=controls[0].pixelSize?.width||72;canvas.width=canvas.height=size;
    deck.on('error',e=>{message('Stream Deck: '+(e?.message||e));});
    deck.on('down',c=>{if(c.type==='button')downAt.set(c.index,performance.now());});
    deck.on('up',c=>{if(c.type==='button')press(c.index,performance.now()-(downAt.get(c.index)||performance.now()));});
    await deck.clearPanel();await deck.setBrightness(80);
    page=0;shown=new Map();pagesSig='';try{localStorage.setItem(STORAGE,'auto');}catch{}
    if(!timer)timer=setInterval(()=>{blinkOn=!blinkOn;if([...shown.values()].some(s=>s.blink))update();},600);
    update(true);
  }
  async function detach(forget=true){
    const d=deck;deck=null;controls=[];shown=new Map();if(timer){clearInterval(timer);timer=null;}
    if(forget){try{localStorage.setItem(STORAGE,'off');}catch{}}
    if(d){try{await d.clearPanel();}catch{}try{await d.close();}catch{}}
    pagesSig='';if(pagesNode)pagesNode.replaceChildren();status('Ej ansluten.');
  }
  if(supported)navigator.hid.addEventListener('disconnect',()=>{if(deck){deck=null;controls=[];shown=new Map();if(timer){clearInterval(timer);timer=null;}status('Stream Deck frånkopplad. Anslut den igen så återupptas visningen.');}});
  const context=()=>trainMeet()?.context||null;
  function lines(){return context()?.lines||[];}
  // The saved layout wins when it fits the connected deck; otherwise the automatic one.
  function activeLayout(){const saved=layout?.()?.active;return saved&&fits(saved,controls.length)?saved:null;}
  function keys(){
    const list=pluppar(),current=lines(),saved=activeLayout(),sig=list.length+'|'+current.map(l=>l.id).join(',')+'|'+controls.length+'|'+(saved?'v'+layout().activeVersion:'auto');
    if(sig!==pagesSig){pagesSig=sig;pages=saved?layoutPages(saved,{pluppar:list,lines:current}):buildPages(list,controls.length,current);if(page>=pages.length)page=0;describe();}
    return pages;
  }
  function info(){const columns=controls.length?Math.max(...controls.map(c=>c.column))+1:0,rows=controls.length?Math.max(...controls.map(c=>c.row))+1:0;return {connected:!!deck,keys:controls.length,columns,rows,model:modelFor(columns,rows),name:deck?.PRODUCT_NAME||''};}
  function describe(){
    if(!pagesNode)return;
    const name=k=>!k?'tom':k.type==='train'?`${k.role==='departure'?'→':'←'} ${k.neighborCode||k.neighborName}`:k.type==='plupp'?k.label:k.type==='missing'?'saknas ('+k.label+')':k.title;
    const saved=activeLayout();
    pagesNode.replaceChildren(...pages.map((p,i)=>{const line=document.createElement('p');line.textContent=`${saved?saved.pages[i]?.name||'Sida '+(i+1):'Sida '+(i+1)}: ${p.map(name).join(' · ')}`;return line;}));
  }
  function trainSpec(key){
    const c=context(),line=c?.lines.find(l=>l.id===key.lineId);
    if(!line)return {kind:'train',role:key.role,neighborCode:key.neighborCode,number:'',time:'',text:'TrainMeet ej ansluten',step:'none',fill:'',blink:false,dim:true,short:null,long:null};
    return key.role==='departure'?departureKey(line,c):arrivalKey(line,c);
  }
  function act(key,action){
    if(!action)return;
    const tm=trainMeet();if(!tm?.paired)return message('TrainMeet är inte parkopplad.');
    const base={sessionId:tm.sessionId,revision:tm.revision};
    if(action.type==='clearance')return api('trainmeet/clearance',{...base,connectionId:key.lineId,action:action.action,trainNumber:action.trainNumber||''});
    if(action.type==='movement')return api('trainmeet/movement',{...base,movementId:action.movementId,...(action.departure?{departure:action.departure}:{}),...(action.arrival?{arrival:action.arrival}:{})});
  }
  function press(index,held){
    if(!deck)return;const key=keys()[page]?.[index];if(!key)return;
    if(key.type==='plupp')return choose(key.id,key.kind);
    if(key.type==='page'){page=Math.min(key.target,keys().length-1);update(true);return;}
    if(key.type==='missing')return message('Knappen '+key.label+' saknar underlag i den här installationen.');
    if(key.type==='train'){
      const spec=trainSpec(key),long=held>=LONG_PRESS;
      const action=long?spec.long:spec.short;
      if(action)return act(key,action);
      if(long&&spec.short)return message('Kort tryck: '+spec.text,{error:false});
      return message(spec.number?`Tåg ${spec.number}: ${spec.text}.`:spec.text,{error:false});
    }
    const s=state();
    switch(key.id){
      case 'page':page=(page+1)%keys().length;update(true);return;
      case 'all-stop':return api('all-stop',{enabled:true});
      case 'reset-ais':if(s?.controls?.stopAll)return api('all-stop',{enabled:false});return message('Alla signaler i stopp är inte aktiv.');
      case 'cancel':return clearChoice();
      case 'panel-reset':if(held>=1000)return $('panel-reset')?.click();return message('Håll in knappen i en sekund för Återställ panel.',{error:false});
    }
  }
  const font=(weight,px)=>`${weight} ${px}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  function fit(text,max){let t=String(text);while(ctx.measureText(t).width>max&&t.length>3)t=t.slice(0,-2)+'…';return t;}
  function draw(spec){
    const s=size,c=ctx;c.clearRect(0,0,s,s);
    c.fillStyle=spec.kind==='system'&&spec.fill?spec.fill:COLORS.background;c.fillRect(0,0,s,s);
    c.globalAlpha=spec.dim?0.38:1;c.textAlign='center';c.textBaseline='middle';
    if(spec.kind==='train'){
      const bar=spec.blink?(blinkOn?spec.fill:COLORS.background):spec.fill;
      if(bar){c.fillStyle=bar;c.fillRect(0,0,s,Math.max(4,s*0.08));}
      c.fillStyle=COLORS.muted;c.font=font(500,s*0.13);c.fillText(`${spec.role==='departure'?'→':'←'} ${spec.neighborCode}${spec.time?' · '+spec.time:''}`,s/2,s*0.24);
      c.fillStyle=COLORS.text;c.font=font(700,spec.number.length>4?s*0.26:s*0.32);c.fillText(spec.number||'—',s/2,s*0.52);
      c.fillStyle=spec.fill&&!spec.dim?spec.fill:COLORS.muted;c.font=font(500,s*0.13);c.fillText(fit(spec.text,s-4),s/2,s*0.82);
    }else{
      if(spec.kind==='plupp'){
        const r=s*0.17,cx=s/2,cy=s*0.30;
        if(spec.ring){c.beginPath();c.arc(cx,cy,r+s*0.07,0,Math.PI*2);c.strokeStyle=spec.ring;c.lineWidth=Math.max(2,s*0.04);c.stroke();}
        c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle=spec.blink&&!blinkOn?COLORS.background:spec.blink?COLORS.preparing:spec.fill;c.fill();
        c.strokeStyle=spec.blink?COLORS.preparing:spec.fill;c.lineWidth=Math.max(1.5,s*0.025);c.stroke();
        if(spec.blocked){c.fillStyle=COLORS.held;c.fillRect(0,0,s,Math.max(3,s*0.05));}
      }
      const dark=spec.kind==='system'&&spec.fill;c.fillStyle=dark?'#1a1414':COLORS.text;
      const lines=spec.lines||[],big=spec.kind==='plupp'?s*0.2:s*0.17,top=spec.kind==='plupp'?s*0.62:s*0.42;
      c.font=font(600,big);lines.forEach((line,i)=>c.fillText(fit(line,s-6),s/2,top+i*big*1.15));
      if(spec.caption){c.font=font(400,s*0.13);c.fillStyle=dark?'#1a1414':COLORS.muted;c.fillText(spec.caption,s/2,s*0.9);}
    }
    c.globalAlpha=1;
  }
  async function update(force=false){
    if(!deck)return;if(rendering){again=true;return;}rendering=true;
    try{
      const current=keys();if(page>=current.length)page=0;
      const s=state(),ctxSystem={stopAll:!!s?.controls?.stopAll,chosen:!!chosen(),page,pages:current.length,remote:s?.controls?.mode==='remote'};
      const nodes=new Map(pluppar().map(p=>[p.id,p.node]));
      for(const control of controls){
        const key=current[page][control.index];
        const spec=!key?{kind:'empty',lines:[],dim:true,blink:false}
          :key.type==='plupp'?pluppSpec(key,new Set(nodes.get(key.id)?.classList||[]),nodes.get(key.id)?.dataset.routePhase||'')
          :key.type==='train'?trainSpec(key):key.type==='page'?{kind:'system',id:'page',title:key.title,lines:['Sida',key.title],caption:'',fill:'',ring:'',dim:false,blink:false,blocked:false}:key.type==='missing'?{kind:'system',id:'missing',title:key.title,lines:[key.title,key.label],caption:'',fill:'',ring:'',dim:true,blink:false,blocked:false}:systemSpec(key,ctxSystem);
        if(!online()&&spec.kind!=='empty')spec.dim=true;
        const sig=signature(spec,blinkOn);
        if(!force&&shown.get(control.index)?.sig===sig)continue;
        draw(spec);await deck.fillKeyCanvas(control.index,canvas);shown.set(control.index,{sig,blink:spec.blink});
      }
      status(`${deck.PRODUCT_NAME} · ${controls.length} knappar · sida ${page+1} av ${current.length} · ${activeLayout()?'egen layout version '+layout().activeVersion:'standardlayout'}`);
    }catch(e){message('Stream Deck kunde inte uppdateras: '+(e?.message||e));}
    finally{rendering=false;if(again){again=false;update();}}
  }
  if(connectButton)connectButton.onclick=()=>connect(true);
  if(disconnectButton)disconnectButton.onclick=()=>detach(true);
  // Open a Stream Deck the browser already allows (a click earlier, or the Raspberry Pi's
  // Chromium policy) at start and whenever one is plugged in, unless Koppla bort was chosen here.
  const off=()=>{try{return localStorage.getItem(STORAGE)==='off';}catch{return false;}};
  if(supported&&!off())connect(false);
  if(supported)navigator.hid.addEventListener('connect',()=>{if(!deck&&!off())connect(false);});
  return {update:()=>update(false),connect,detach,info};
}
