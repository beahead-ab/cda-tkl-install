// LocoNet ansluten eller ej ansluten (0.78.0, språket sedan 0.79.0). Lägesknappen i statusraden visar alltid om TKL får
// återrapporterna från banan eller svarar själv, och öppnar rutan med Anslut till LocoNet / Koppla från LocoNet.
// Inställningar → Banan (LocoNet) har samma knapp och LocoBufferns inställning. Servern avgör villkoren
// (src/server.mjs, connectionModeStatus); här visas de bara. Internt heter lägena 'live' och 'offline'.
import {createAdminDialog,escapeHTML as esc} from './admin-ui.js';

const TEXT={
  live:'TKL styr banan över LocoNet genom den inställda anslutningen: en LocoBuffer på USB eller en BTLocoBridge över Bluetooth. Order går till de riktiga växlarna och signalerna, och återrapporterna kommer från banan.',
  offline:'TKL väntar inte på LocoNet: det du gör på panelen räknas som utfört och TKL ger sig själv återrapporten. Trafikspelets tåg från TrainMeet-servern kör TKL längs tågvägarna. Inget går ut på LocoNet. Automaten finns bara här.'
};
const TITLE={live:'Ansluten',offline:'Ej ansluten'};
const ACTION={live:'Anslut till LocoNet',offline:'Koppla från LocoNet'};
const AFTER='Vid bytet ansluter TKL på nytt: signalerna går till stopp, spårledningarna frågas av och växlarna är okända tills de får en order. Valet gäller också efter en omstart.';

// Vad knappen i statusraden säger: ansluten (och om banan svarar) eller ej ansluten.
export function modeChip(view,state,online){
  if(!view)return null;
  const live=view.mode==='live',connected=online&&state?.connection==='connected';
  const text=live?(connected?'LocoNet ansluten':'LocoNet svarar inte'):'LocoNet ej ansluten';
  const tone=live?(connected?'live':'alarm'):'offline';
  return {mode:view.mode,text,tone,title:(live?TEXT.live:TEXT.offline)+(view.locked?'':' Klicka för att '+(live?'koppla från.':'ansluta.'))};
}

function choices(view){
  const box=document.createElement('div');box.className='connection-modes';
  for(const mode of ['live','offline']){
    const current=view.mode===mode,check=view.switch?.[mode];
    const card=document.createElement('section');card.className='connection-mode-card';card.dataset.mode=mode;card.dataset.current=String(current);
    card.innerHTML=`<h3>${TITLE[mode]}${current?' <small>nu</small>':''}</h3><p></p><p class="connection-mode-reason muted"></p>`;
    card.querySelector('p').textContent=TEXT[mode];
    card.querySelector('.connection-mode-reason').textContent=current?(mode==='live'?view.label||'':''):(check?.allowed?'':check?.reason||'');
    box.append(card);
  }
  return box;
}

// Rutan från lägesknappen: båda lägena, villkoret för bytet och knappen.
export function openConnectionMode(view,{api,message}){
  if(!view)return;
  const target=view.mode==='live'?'offline':'live',check=view.switch?.[target];
  const body=document.createElement('div');body.append(choices(view));
  const note=document.createElement('p');note.className='muted';note.textContent=view.locked?'TKL är startad mot en fristående gateway och är alltid ansluten till LocoNet.':AFTER;body.append(note);
  if(!view.live.available&&!view.locked){const hint=document.createElement('p');hint.className='muted';hint.innerHTML='Anslutningen ställs in under <a href="#advanced/protocol">Inställningar → Banan (LocoNet)</a>.';body.append(hint);hint.querySelector('a').onclick=()=>modal.close(true);}
  const save=document.createElement('button');save.type='button';save.textContent=ACTION[target];
  save.disabled=view.locked||!check?.allowed;
  let busy=false;const modal=createAdminDialog({title:'LocoNet',body,saveButton:view.locked?null:save,busy:()=>busy});
  save.onclick=async()=>{busy=true;save.disabled=true;try{const answer=await api('connection/mode',{mode:target});if(answer){modal.close(true);message(target==='live'?'TKL ansluter till LocoNet.':'LocoNet frånkopplad: TKL svarar själv.',{error:false,duration:5000});}else save.disabled=false;}finally{busy=false;}};
  modal.element.addEventListener('close',()=>modal.element.remove(),{once:true});modal.open();
}

// Inställningar → Banan (LocoNet): läget och LocoBuffern. Enhetslistan hämtas när sidan öppnas och med Sök igen.
export function createConnectionSettings(root,{api}){
  if(!root)return null;
  root.innerHTML=`<div class="connection-settings-modes"></div><p class="connection-settings-switch"><button type="button" data-switch></button> <span class="muted" data-switch-reason></span></p>
    <h4>Anslutning till banan</h4><p class="muted">LocoNet nås över en LocoBuffer på USB eller en BTLocoBridge över Bluetooth. TKL startar gatewayen till den valda själv. Ändras inställningen medan LocoNet är ansluten startas gatewayen om.</p>
    <form class="connection-settings-form" data-form>
    <label>Anslutning<select data-adapter><option value="locobuffer">LocoBuffer (USB)</option><option value="btlocobridge">BTLocoBridge (Bluetooth)</option></select></label>
    <div data-locobuffer><label>Enhet<input data-device list="locobuffer-devices" placeholder="/dev/serial/by-id/…" autocomplete="off" spellcheck="false"></label><datalist id="locobuffer-devices"></datalist>
    <label>Hastighet<select data-baud>${['9600','19200','38400','57600','115200'].map(b=>`<option value="${b}">${b} baud</option>`).join('')}</select></label>
    <label>Flödeskontroll<select data-flow><option value="rtscts">RTS/CTS (LocoBuffer-USB)</option><option value="none">Ingen</option></select></label></div>
    <div data-btlocobridge hidden><label>Kortets adress<input data-target list="locobuffer-devices" placeholder="AA:BB:CC:DD:EE:FF" autocomplete="off" spellcheck="false"></label>
    <label>Kanal<input data-channel type="number" min="1" max="30" step="1"></label>
    <p class="muted">Para kortet i datorns Bluetooth-inställningar först. På en Raspberry Pi anges adressen; på en Mac blir det parade kortet en serieport och anges som <code>/dev/cu.…</code>, och kanalen används då inte.</p></div>
    <p><button type="submit" class="primary">Spara anslutningen</button> <button type="button" data-rescan>Sök enheter igen</button> <span data-found class="muted"></span></p>
    <p class="admin-form-error" role="alert" data-error hidden></p></form><dl class="connection-settings-gateway" data-gateway></dl>`;
  const $=s=>root.querySelector(s);let view=null,edited=false,devices=[];
  async function load(){try{const r=await fetch('/api/connection');if(r.ok){const v=await r.json();devices=v.devices||[];paint(v,true);}}catch{}}
  function paint(next,fill=false){
    if(!next)return;view=next;
    const modes=$('.connection-settings-modes');modes.replaceChildren(choices(view));
    const target=view.mode==='live'?'offline':'live',check=view.switch?.[target];
    $('[data-switch]').textContent=ACTION[target];$('[data-switch]').disabled=view.locked||!check?.allowed;
    $('[data-switch-reason]').textContent=view.locked?'Läget är låst av CHARLOTTENDAL_CONNECTION_MODE=hardware.':check?.allowed?AFTER:check?.reason||'';
    if(fill||!edited){$('[data-adapter]').value=view.adapter;$('[data-device]').value=view.locobuffer.device;$('[data-baud]').value=view.locobuffer.baud;$('[data-flow]').value=view.locobuffer.flow;
      $('[data-target]').value=view.btlocobridge.target;$('[data-channel]').value=view.btlocobridge.channel;}
    showAdapter($('[data-adapter]').value);
    $('#locobuffer-devices').innerHTML=devices.map(d=>`<option value="${esc(d.path)}">${esc(d.label)}</option>`).join('');
    $('[data-found]').textContent=devices.length?devices.length+' USB-serieportar hittade':'Ingen USB-serieport hittad';
    for(const n of root.querySelectorAll('[data-form] input,[data-form] select,[data-form] button'))n.disabled=view.locked;
    const g=view.gateway,state={running:'Igång',starting:'Startar',failed:'Fel',stopped:'Stoppad'}[g.state]||g.state;
    $('[data-gateway]').innerHTML=view.locked?'':`<dt>Gateway</dt><dd>${esc(state)}${view.mode==='live'?' · 127.0.0.1:'+esc(view.port):' · används bara när LocoNet är ansluten'}</dd>${g.error?`<dt>Senaste fel</dt><dd>${esc(g.error)}</dd>`:''}`;
  }
  // Bara den valda anslutningens fält visas; den andras inställning ligger kvar och kan väljas igen.
  function showAdapter(adapter){$('[data-locobuffer]').hidden=adapter!=='locobuffer';$('[data-btlocobridge]').hidden=adapter!=='btlocobridge';}
  root.addEventListener('input',e=>{if(e.target.closest('[data-form]'))edited=true;});
  $('[data-adapter]').onchange=()=>showAdapter($('[data-adapter]').value);
  $('[data-rescan]').onclick=load;
  $('[data-switch]').onclick=async()=>{if(!view)return;const target=view.mode==='live'?'offline':'live';$('[data-switch]').disabled=true;const answer=await api('connection/mode',{mode:target});if(answer?.connection)paint(answer.connection);};
  $('[data-form]').onsubmit=async e=>{
    e.preventDefault();$('[data-error]').hidden=true;
    try{const r=await fetch('/api/connection/adapter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({adapter:$('[data-adapter]').value,
      locobuffer:{device:$('[data-device]').value.trim(),baud:$('[data-baud]').value,flow:$('[data-flow]').value},
      btlocobridge:{target:$('[data-target]').value.trim(),channel:Number($('[data-channel]').value||1)}})});
      const answer=await r.json().catch(()=>null);if(!r.ok)throw Error(answer?.error||'Servern svarade med fel '+r.status+'.');edited=false;devices=answer.devices||devices;paint(answer,true);}
    catch(error){$('[data-error]').textContent=error.message;$('[data-error]').hidden=false;}
  };
  load();
  return {update(state){if(state?.connectionMode)paint(state.connectionMode);},load};
}
