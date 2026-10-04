import {createTrainMeetTimetable} from './trainmeet-timetable.js';
import {createAdminDialog,confirmAdmin,escapeHTML as esc} from './admin-ui.js';
import {formatPairingCode} from './pairing-code.js';
export function createTrainMeet({api,onTimetable,stationHint=()=>''}) {
  const root=document.getElementById('trainmeet'),$=id=>document.getElementById('tm-'+id);
  const timetable=createTrainMeetTimetable();
  let state,online=false,lastContent='',busy=false,editBaseline='',pairBaseline='',openedRevision;
  // Label · value · what it means, the same order as server.trainmeet.app's settings.
  const row=(label,value,consequence)=>`<div><dt>${label}</dt><dd id="tm-${value}"></dd><dd id="tm-${consequence}" class="settings-consequence"></dd></div>`;
  root.innerHTML=`<div class="card-heading"><h2>Anslutning</h2></div><dl class="settings-rows">${row('Status','status','status-consequence')}${row('Station','station-summary','station-consequence')}${row('Server','origin','origin-consequence')}${row('TKL-id','identity','identity-consequence')}</dl><p id="tm-message" class="settings-alert" role="status" hidden></p>
<div class="settings-actions"><button id="tm-pair-open" class="primary">Parkoppla</button><p id="tm-pair-consequence">Kräver anslutningskoden från TrainMeet, en gång per server. Därefter återansluter TKL själv.</p><button id="tm-show-timetable">Visa tidtabell</button><p>Öppnar ställverket med stationens tidtabell i nederraden.</p><button id="tm-refresh">Hämta senaste</button><p id="tm-refresh-consequence">Läser om tidtabell, klocka och förbindelselägen nu. Annars sker det av sig självt.</p><button id="tm-edit">Redigera anslutning</button><p>Byt server eller TKL-id. Parkopplingen till varje server sparas, så du kan byta tillbaka utan ny kod.</p><button id="tm-disconnect">Koppla från</button><p id="tm-disconnect-consequence">Raderar nyckeln för den här servern. Parkopplingen till andra servrar sparas. Frågar först.</p></div><div id="tm-context"></div><p class="settings-footnote">TrainMeet ger stationen tidtabell, klocka och tågklarering mot grannarna. Tågvägar, signaler och växlar styrs bara av TKL och påverkas aldrig av TrainMeet.</p>`;
  const editForm=document.createElement('form');editForm.id='tm-server-form';
  editForm.innerHTML=`<label>TKL-id<input id="tm-client-id" minlength="3" maxlength="64" pattern="[A-Za-z0-9._:\\-]{3,64}" required autocomplete="off" spellcheck="false" aria-describedby="tm-client-help"></label><p id="tm-client-help" class="muted">Det här id:t visas hos TrainMeet. Varje TKL-installation ska ha ett eget id.</p><label>Serveradress<input id="tm-server" type="url" maxlength="512" placeholder="https://server.trainmeet.app" autocomplete="url" spellcheck="false" list="tm-saved-servers"></label><datalist id="tm-saved-servers"></datalist><p id="tm-server-help" class="muted"></p><button id="tm-save-server" type="submit">Spara anslutning</button>`;
  const editValue=()=>JSON.stringify([$('client-id').value,$('server').value]);
  const editDialog=createAdminDialog({title:'Redigera anslutning',body:editForm,saveButton:editForm.querySelector('button'),dirty:()=>editValue()!==editBaseline,busy:()=>busy||state?.busy,unchanged:'Inget ändrat',canSave:()=>online});
  const pairForm=document.createElement('form');pairForm.id='tm-pair';pairForm.innerHTML='<p id="tm-pair-destination" class="muted"></p><label>Station<select id="tm-station-list" hidden></select><input id="tm-station" maxlength="128" required autocomplete="off" placeholder="stations-id"></label><p id="tm-station-help" class="muted"></p><label>Anslutningskod<input id="tm-code" class="pairing-code" maxlength="128" required autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="123-456"></label><p class="muted">Koden visas i TrainMeet under Skärmar → Visa anslutningsuppgifter, skriven som 123-456. Den behövs en gång per server; därefter återansluter TKL själv.</p><button id="tm-connect" type="submit">Parkoppla</button>';
  pairForm.querySelector('#tm-code').addEventListener('input',e=>{e.target.value=formatPairingCode(e.target.value);});
  const pairValue=()=>JSON.stringify([$ ('station').value,$('code').value]);
  const pairDialog=createAdminDialog({title:'Parkoppla med TrainMeet',body:pairForm,saveButton:pairForm.querySelector('button'),dirty:()=>pairValue()!==pairBaseline,busy:()=>busy,onCancel:()=>{$('code').value='';}});
  const action=(name,extra={},version=state)=>api('trainmeet/'+name,{sessionId:version.sessionId,revision:version.revision,...extra});
  function controls(){
    if(!state)return;const disabled=!online||busy||state.busy;
    $('edit').disabled=disabled;$('pair-open').hidden=state.paired;$('pair-open').disabled=disabled||!state.origin;
    editDialog.refresh();$('connect').disabled=disabled||state.paired||!state.origin;
    for(const id of ['refresh','disconnect','show-timetable']){$(id).hidden=!state.paired;$(id).nextElementSibling.hidden=!state.paired;}$('pair-consequence').hidden=state.paired;
    $('refresh').disabled=disabled;$('disconnect').disabled=disabled;
    editDialog.setBusy(busy);pairDialog.setBusy(busy);
  }
  async function submitAll(dialog,steps){
    if(busy)return;if(!steps.length)return dialog.close(true);busy=true;controls();dialog.message('');
    try{let version=openedRevision;for(const [name,payload] of steps){const answer=await action(name,payload,version);if(!answer){dialog.message(document.getElementById('message-text').textContent||'Kunde inte spara. Försök igen.');return;}version=answer;}dialog.close(true);}
    finally{busy=false;controls();}
  }
  async function submit(dialog,name,payload){
    if(busy)return;busy=true;controls();dialog.message('');
    try{const answer=await action(name,payload,openedRevision);if(answer){dialog.close(true);$('code').value='';}else dialog.message(document.getElementById('message-text').textContent||'Kunde inte spara. Försök igen.');}
    finally{busy=false;controls();}
  }
  $('edit').onclick=()=>{openedRevision={...state};$('client-id').value=state.clientId;$('server').value=state.origin;$('server').readOnly=state.originLocked;const saved=state.savedServers||[];$('client-id').readOnly=state.paired||saved.length>0;$('client-help').textContent=$('client-id').readOnly?'TKL-id kan ändras först när alla servrar är frånkopplade.':'Det här id:t visas hos TrainMeet. Varje TKL-installation ska ha ett eget id.';document.getElementById('tm-saved-servers').innerHTML=saved.map(s=>`<option value="${esc(s.origin)}">${esc(s.stationId)}</option>`).join('');editBaseline=editValue();$('server-help').textContent=state.originLocked?'Serveradressen är fast för den här installationen.':'Adressen ska kunna nås från TKL-servern. HTTPS över internet, eller HTTP på träffens eget nät, till exempel http://192.168.1.10:8787.'+(saved.length?' Sparade parkopplingar: '+saved.map(s=>s.origin).join(', ')+'. Byte av server behåller dem.':'');editDialog.open();};
  const loadStations=async()=>{$('station-list').hidden=true;$('station').hidden=false;$('station-help').textContent='Hämtar träffens stationer…';
    const list=await api('trainmeet/stations',{});
    if(!list?.stations?.length){const retry=document.createElement('button');retry.type='button';retry.textContent='Hämta listan igen';retry.onclick=loadStations;$('station-help').replaceChildren('Stationslistan kunde inte hämtas. Ange stationens id från TrainMeet eller ',retry);return;}
    const hint=String(stationHint()||'').trim().toLowerCase(),pick=list.stations.find(s=>s.id===state.stationId)||list.stations.find(s=>s.name.trim().toLowerCase()===hint)||list.stations.find(s=>hint&&s.name.toLowerCase().startsWith(hint))||list.stations.find(s=>hint&&s.code.toLowerCase()===hint.slice(0,3));
    $('station-list').replaceChildren(...list.stations.map(s=>new Option(s.name+(s.code?' ('+s.code+')':''),s.id)));
    if(pick)$('station-list').value=pick.id;$('station').value=$('station-list').value;$('station').hidden=true;$('station-list').hidden=false;
    $('station-list').onchange=()=>{$('station').value=$('station-list').value;};
    $('station-help').textContent=(list.meet?list.meet+' · ':'')+list.stations.length+' stationer'+(pick?' · '+pick.name+' förvald':'')+'.';pairBaseline=pairValue();};
  $('pair-open').onclick=()=>{openedRevision={...state};$('station').value=state.stationId||'';$('code').value='';pairBaseline=pairValue();$('pair-destination').textContent=state.clientId+' → '+state.origin;pairDialog.open();loadStations();};
  editForm.onsubmit=e=>{e.preventDefault();const clientId=$('client-id').value.trim(),origin=$('server').value.trim();
    const steps=[];if(clientId!==state.clientId||origin!==state.origin)steps.push(['configure',{clientId,origin}]);
    submitAll(editDialog,steps);};
  pairForm.onsubmit=e=>{e.preventDefault();submit(pairDialog,'pair',{stationId:$('station').value.trim(),code:formatPairingCode($('code').value)});};
  $('refresh').onclick=()=>action('refresh');
  $('disconnect').onclick=()=>confirmAdmin({title:'Koppla från TrainMeet?',message:'TKL slutar hämta träffens tidtabell och trafikläge. Du kan parkoppla igen senare.',button:'Koppla från',action:async()=>!!await action('disconnect')});
  $('show-timetable').onclick=onTimetable;
  return {update(next,connected,panel){
    state=next;online=connected;if(!state)return;timetable.update(state,online,panel);
    const stale=!online||state.stale;
    const mode=!state.paired?'off':stale?'warn':'ok',status=$('status');
    status.innerHTML=`<span class="settings-state" data-state="${mode}">${{off:'Ej ansluten',warn:'Kontakt saknas',ok:'Ansluten'}[mode]}</span>`;
    $('status-consequence').textContent={off:'Ställverket visar ingen tidtabell och klockan går lokalt.',warn:'Tidtabellen visar senaste mottagna uppgifter. TKL återansluter själv.',ok:'Tidtabell, klocka och förbindelselägen följer träffen.'}[mode];
    document.getElementById('menu-trainmeet-status').textContent={off:'Ej ansluten',warn:'Kontakt saknas',ok:'Ansluten'}[mode];
    const guide=state.paired?'':(state.savedServers||[]).length?'Ingen parkoppling sparad för den här servern. Parkoppla med dess kod, eller välj en sparad server under Redigera anslutning.':state.origin?'':'Ange serveradressen under Redigera anslutning, parkoppla sedan med träffens kod.';
    $('message').textContent=state.error||guide;$('message').hidden=!$('message').textContent;
    $('identity').textContent=state.clientId;$('identity-consequence').textContent='Så heter den här installationen hos TrainMeet. Varje TKL har ett eget id.';
    $('origin').textContent=state.origin||'Ingen server vald';$('origin-consequence').textContent=state.originLocked?'Fast för den här installationen.':'TKL-servern hämtar härifrån, inte webbläsaren.';
    $('station-summary').textContent=state.context?.station.name||state.stationId||'Ingen station vald';$('station-consequence').textContent='Tidtabellen och tågklareringen gäller den här stationen. Väljs när du parkopplar.';
    controls();root.classList.toggle('trainmeet-stale',!!state.paired&&stale);
    const c=state.context;let html='';if(c)html=`<div class="trainmeet-heading"><strong>${esc(c.station.name)} · ${esc(c.meet)} · ${esc(c.day)}</strong><span>${c.trains.length} tågrörelser · TrainMeet-klocka ${esc(c.clock.time)}${stale?' · gamla uppgifter':''}</span></div><details><summary>Förbindelselägen</summary>${(c.lines||c.connections).map(n=>`<p>${esc(n.neighborName||n.id)} · ${esc(n.state)} ${esc(n.trainNumber)}</p>`).join('')||'<p>Inga förbindelser.</p>'}</details>`;
    if(html!==lastContent){lastContent=html;$('context').innerHTML=html;}
  }};
}
