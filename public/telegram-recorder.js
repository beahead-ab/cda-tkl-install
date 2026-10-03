import {createCommunicationView} from './communication-view.js';
import {createAdminDialog} from './admin-ui.js';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reason={operator:'Stoppad',disconnected:'Avslutad vid avbrott','time-limit':'Tidsgräns nådd','size-limit':'Storleksgräns nådd','event-limit':'Radgräns nådd','server-shutdown':'Avslutad vid serverstopp','capture-error':'Avbruten vid inspelningsfel'};
export function createTelegramRecorder() {
  const diagnostics=createCommunicationView(document.getElementById('advanced-protocol'));
  let state=null,online=false,busy=false,lastHistory='',requestError='';
  $('recording-tools').innerHTML=`<p class="muted">Spela in båda riktningarna för jämförelse och felsökning. Inspelningen skickar inga manövrer.</p>
    <div class="recording-actions"><label>Namn på inspelningen<input id="recording-label" maxlength="80" placeholder="Till exempel växel 123" autocomplete="off"></label><button id="recording-start">Starta inspelning</button><button id="recording-stop" disabled>Stoppa och spara</button><a id="recording-current" hidden>Hämta pågående logg</a></div>
    <p id="recording-status" role="status"></p><p id="recording-error" role="status"></p><p class="muted" id="recording-limits"></p>
    <p class="muted">Färdiga filer sparas på servern och kan hämtas här. Pågående trafik samlas i minnet tills inspelningen avslutas; oväntat serveravbrott kan förlora den pågående loggen. Fysisk MGP-mappning är ännu inte verifierad.</p><div id="recording-history"></div>`;
  const form=document.createElement('form');form.id='recording-start-form';form.append($('recording-label').closest('label'));
  const openButton=document.createElement('button');openButton.id='recording-open';openButton.textContent='Ny inspelning';$('recording-start').before(openButton);let baseline='';
  const modal=createAdminDialog({title:'Ny protokollinspelning',body:form,saveButton:$('recording-start'),dirty:()=>$('recording-label').value!==baseline,busy:()=>busy});
  $('recording-start').type='submit';$('recording-start').setAttribute('form',form.id);
  openButton.onclick=()=>{baseline=$('recording-label').value;modal.open();};
  const stamp=n=>new Date(n).toLocaleString('sv-SE',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  function paint() {
    const view=state?.recordings,a=view?.active;
    $('recording-start').disabled=!online||busy||state?.connection!=='connected'||!!a||!!view?.error;
    openButton.disabled=$('recording-start').disabled;modal.setBusy(busy);$('recording-label').disabled=busy||!!a;
    $('recording-stop').disabled=!online||busy||!a||!!a.saving;
    $('recording-stop').textContent=a?.stoppedAt?'Försök spara igen':'Stoppa och spara';
    $('recording-status').textContent=!online?'Kontakt med kärnan saknas.':a?`${a.saving?'Sparar':a.stoppedAt?'Avslutad · ej sparad':'Spelar in'} · ${a.eventCount} rader · ${Math.round(a.bytes/1024)} kB · ${a.label||'Utan namn'}`:'Ingen inspelning pågår.';
    $('recording-error').textContent=requestError||view?.error||'';
    $('recording-current').hidden=!a||!online;
    if(a){$('recording-current').href='/api/recordings/'+a.id+'/download';$('recording-current').textContent=a.stoppedAt?'Hämta logg som inte sparats':'Hämta pågående logg';}
    if(view)$('recording-limits').textContent=`Avslutas efter ${view.limits.maxDurationMs/60000} minuter, ${view.limits.maxEvents.toLocaleString('sv-SE')} rader, ${Math.round(view.limits.maxBytes/1000000)} MB eller bruten bussanslutning. Arkivet rymmer ${view.limits.maxFiles} filer.`;
    const history=JSON.stringify(view?.history||[]);
    if(history!==lastHistory){lastHistory=history;$('recording-history').innerHTML=(view?.history||[]).map(r=>`<div class="recording-row"><div><strong>${esc(r.label||'Utan namn')}</strong><span class="muted">${esc(stamp(r.startedAt))} · ${r.eventCount} rader · ${esc(reason[r.reason]||r.reason)}</span></div><a href="/api/recordings/${r.id}/download">Hämta JSON</a></div>`).join('')||'<p class="muted">Inga sparade inspelningar ännu.</p>';}
  }
  async function send(command) {
    if(busy||!online||!state?.recordings)return;busy=true;requestError='';paint();
    const data={sessionId:state.recordings.sessionId,...(command==='start'?{label:$('recording-label').value}:{id:state.recordings.active?.id})};
    try {const r=await fetch('/api/recordings/'+command,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const answer=await r.json();if(!r.ok)throw Error(answer.error);if(command==='start')modal.close(true);}
    catch(e){requestError=e.message;if(modal.isOpen)modal.message(e.message);}
    finally {busy=false;paint();}
  }
  form.onsubmit=e=>{e.preventDefault();send('start');};$('recording-stop').onclick=()=>send('stop');
  return {update(next,connected){state=next;online=connected;diagnostics.update(next,connected);paint();}};
}
