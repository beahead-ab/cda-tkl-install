// Live och offline (0.78.0). Lägesknappen i statusraden visar alltid om TKL styr den riktiga banan (LIVE) eller den
// simulerade (OFFLINE), och öppnar rutan där läget byts. Inställningar → Banan (LocoNet) har samma val och LocoBufferns
// inställning. Servern avgör villkoren (src/server.mjs, connectionModeStatus); här visas de bara.
import {createAdminDialog,escapeHTML as esc} from './admin-ui.js';

const TEXT={
  live:'TKL styr banan över LocoNet med en LocoBuffer på USB. Order går till de riktiga växlarna och signalerna, och spårledningarna rapporterar från banan.',
  offline:'TKL kör stationen mot den simulerade banan, utan LocoNet. Inget går ut till banan. Simulerad trafik och Automat finns bara här.'
};
const AFTER='Vid bytet ansluter TKL på nytt: signalerna går till stopp, spårledningarna frågas av och växlarna är okända tills de får en order.';

// Vad knappen i statusraden säger: läget, och i live om LocoNet är ansluten.
export function modeChip(view,state,online){
  if(!view)return null;
  const live=view.mode==='live',connected=online&&state?.connection==='connected';
  const text=live?(connected?'LIVE · LocoNet':'LIVE · ingen LocoNet'):'OFFLINE · simulerad bana';
  const tone=live?(connected?'live':'alarm'):'offline';
  return {mode:view.mode,text,tone,title:(live?TEXT.live:TEXT.offline)+(view.locked?'':' Klicka för att byta läge.')};
}

function choices(view){
  const box=document.createElement('div');box.className='connection-modes';
  for(const mode of ['live','offline']){
    const current=view.mode===mode,check=view.switch?.[mode];
    const card=document.createElement('section');card.className='connection-mode-card';card.dataset.mode=mode;card.dataset.current=String(current);
    card.innerHTML=`<h3>${mode==='live'?'Live':'Offline'}${current?' <small>nu</small>':''}</h3><p></p><p class="connection-mode-reason muted"></p>`;
    card.querySelector('p').textContent=TEXT[mode];
    card.querySelector('.connection-mode-reason').textContent=current?(mode==='live'?view.label||'':'Den simulerade banan.'):(check?.allowed?'':check?.reason||'');
    box.append(card);
  }
  return box;
}

// Rutan från lägesknappen: båda lägena, villkoret för bytet och knappen.
export function openConnectionMode(view,{api,message}){
  if(!view)return;
  const target=view.mode==='live'?'offline':'live',check=view.switch?.[target];
  const body=document.createElement('div');body.append(choices(view));
  const note=document.createElement('p');note.className='muted';note.textContent=view.locked?'TKL är startad mot en fristående gateway och kör alltid live.':AFTER;body.append(note);
  if(!view.live.available&&!view.locked){const hint=document.createElement('p');hint.className='muted';hint.innerHTML='LocoBuffern ställs in under <a href="#advanced/protocol">Inställningar → Banan (LocoNet)</a>.';body.append(hint);hint.querySelector('a').onclick=()=>modal.close(true);}
  const save=document.createElement('button');save.type='button';save.textContent=target==='live'?'Byt till live':'Byt till offline';
  save.disabled=view.locked||!check?.allowed;
  let busy=false;const modal=createAdminDialog({title:'Live eller offline',body,saveButton:view.locked?null:save,busy:()=>busy});
  save.onclick=async()=>{busy=true;save.disabled=true;try{const answer=await api('connection/mode',{mode:target});if(answer){modal.close(true);message(target==='live'?'Live: TKL ansluter till banan.':'Offline: TKL kör mot den simulerade banan.',{error:false,duration:5000});}else save.disabled=false;}finally{busy=false;}};
  modal.element.addEventListener('close',()=>modal.element.remove(),{once:true});modal.open();
}

// Inställningar → Banan (LocoNet): läget och LocoBuffern. Enhetslistan hämtas när sidan öppnas och med Sök igen.
export function createConnectionSettings(root,{api}){
  if(!root)return null;
  root.innerHTML=`<div class="connection-settings-modes"></div><p class="connection-settings-switch"><button type="button" data-switch></button> <span class="muted" data-switch-reason></span></p>
    <h4>LocoBuffer</h4><p class="muted">Live går över en LocoBuffer på USB. TKL startar gatewayen till den själv. Ändras inställningen medan TKL kör live startas gatewayen om.</p>
    <form class="connection-settings-form" data-form><label>Enhet<input data-device list="locobuffer-devices" placeholder="/dev/serial/by-id/…" autocomplete="off" spellcheck="false"></label><datalist id="locobuffer-devices"></datalist>
    <label>Hastighet<select data-baud>${['9600','19200','38400','57600','115200'].map(b=>`<option value="${b}">${b} baud</option>`).join('')}</select></label>
    <label>Flödeskontroll<select data-flow><option value="rtscts">RTS/CTS (LocoBuffer-USB)</option><option value="none">Ingen</option></select></label>
    <p><button type="submit" class="primary">Spara LocoBuffer</button> <button type="button" data-rescan>Sök enheter igen</button> <span data-found class="muted"></span></p>
    <p class="admin-form-error" role="alert" data-error hidden></p></form><dl class="connection-settings-gateway" data-gateway></dl>`;
  const $=s=>root.querySelector(s);let view=null,edited=false,devices=[];
  async function load(){try{const r=await fetch('/api/connection');if(r.ok){const v=await r.json();devices=v.devices||[];paint(v,true);}}catch{}}
  function paint(next,fill=false){
    if(!next)return;view=next;
    const modes=$('.connection-settings-modes');modes.replaceChildren(choices(view));
    const target=view.mode==='live'?'offline':'live',check=view.switch?.[target];
    $('[data-switch]').textContent=target==='live'?'Byt till live':'Byt till offline';$('[data-switch]').disabled=view.locked||!check?.allowed;
    $('[data-switch-reason]').textContent=view.locked?'Läget är låst av CHARLOTTENDAL_CONNECTION_MODE=hardware.':check?.allowed?AFTER:check?.reason||'';
    if(fill||!edited){$('[data-device]').value=view.locobuffer.device;$('[data-baud]').value=view.locobuffer.baud;$('[data-flow]').value=view.locobuffer.flow;}
    $('#locobuffer-devices').innerHTML=devices.map(d=>`<option value="${esc(d.path)}">${esc(d.label)}</option>`).join('');
    $('[data-found]').textContent=devices.length?devices.length+' USB-serieportar hittade':'Ingen USB-serieport hittad';
    for(const n of root.querySelectorAll('[data-form] input,[data-form] select,[data-form] button'))n.disabled=view.locked;
    const g=view.gateway,state={running:'Igång',starting:'Startar',failed:'Fel',stopped:'Stoppad'}[g.state]||g.state;
    $('[data-gateway]').innerHTML=view.locked?'':`<dt>Gateway</dt><dd>${esc(state)}${view.mode==='live'?' · 127.0.0.1:'+esc(view.port):' · används bara live'}</dd>${g.error?`<dt>Senaste fel</dt><dd>${esc(g.error)}</dd>`:''}`;
  }
  root.addEventListener('input',e=>{if(e.target.closest('[data-form]'))edited=true;});
  $('[data-rescan]').onclick=load;
  $('[data-switch]').onclick=async()=>{if(!view)return;const target=view.mode==='live'?'offline':'live';$('[data-switch]').disabled=true;const answer=await api('connection/mode',{mode:target});if(answer?.connection)paint(answer.connection);};
  $('[data-form]').onsubmit=async e=>{
    e.preventDefault();$('[data-error]').hidden=true;
    try{const r=await fetch('/api/connection/locobuffer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:$('[data-device]').value.trim(),baud:$('[data-baud]').value,flow:$('[data-flow]').value})});
      const answer=await r.json().catch(()=>null);if(!r.ok)throw Error(answer?.error||'Servern svarade med fel '+r.status+'.');edited=false;devices=answer.devices||devices;paint(answer,true);}
    catch(error){$('[data-error]').textContent=error.message;$('[data-error]').hidden=false;}
  };
  load();
  return {update(state){if(state?.connectionMode)paint(state.connectionMode);},load};
}
