import {createTrainMeetTimetable} from './trainmeet-timetable.js';
import {confirmAdmin,escapeHTML as esc} from './admin-ui.js';
import {formatPairingCode} from './pairing-code.js';
// Inställningar → TrainMeet (0.82.0): serverns adress och anslutningskoden, inget mer. TrainMeet har en kod för hela
// träffen och TKL väljer sin station själv; efter en omstart återansluter TKL utan kod. En ny träff ger en ny kod, och
// då står formuläret här igen.
export function createTrainMeet({api,stationHint=()=>''}) {
  const root=document.getElementById('trainmeet'),$=id=>document.getElementById('tm-'+id);
  const timetable=createTrainMeetTimetable();
  let state,online=false,lastContent='',busy=false,typedOrigin=false;
  // Label · value · what it means, the same order as server.trainmeet.app's settings.
  const row=(label,value,consequence)=>`<div><dt>${label}</dt><dd id="tm-${value}"></dd><dd id="tm-${consequence}" class="settings-consequence"></dd></div>`;
  root.innerHTML=`<div class="card-heading"><h2>Anslutning</h2></div><dl class="settings-rows">${row('Status','status','status-consequence')}${row('Station','station-summary','station-consequence')}${row('Server','origin','origin-consequence')}</dl><p id="tm-message" class="settings-alert" role="status" hidden></p>
<form id="tm-connect-form" class="connection-settings-form" novalidate><label>Serverns adress<input id="tm-server" type="url" inputmode="url" maxlength="512" placeholder="https://server.trainmeet.app" autocomplete="url" spellcheck="false"></label><label>Anslutningskod<input id="tm-code" class="pairing-code" maxlength="16" placeholder="123-456" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"></label><label id="tm-station-choice" hidden>Station<select id="tm-station-list"></select></label>
<p><button id="tm-connect" type="submit" class="primary">Anslut</button> <span id="tm-connect-help" class="muted"></span></p><p id="tm-form-error" class="admin-form-error" role="alert" hidden></p></form>
<div id="tm-connected" class="settings-actions"><button id="tm-disconnect" type="button">Koppla från</button><p>TKL slutar följa träffen. Anslut igen med adress och kod.</p></div><div id="tm-context"></div><p class="settings-footnote">TrainMeet ger stationen tidtabell, klocka och tågklarering mot grannarna. Tågvägar, signaler och växlar styrs bara av TKL och påverkas aldrig av TrainMeet.</p>`;
  const form=$('connect-form'),station=()=>String(stationHint()||'').trim()||'Charlottendal';
  $('code').addEventListener('input',e=>{e.target.value=formatPairingCode(e.target.value);});
  $('server').addEventListener('input',()=>{typedOrigin=true;});
  const formError=text=>{$('form-error').textContent=text;$('form-error').hidden=!text;};
  // Träffen saknar ställverkets station: välj bland träffens stationer och anslut igen med samma kod.
  function choose(list){
    $('station-list').replaceChildren(...list.stations.map(s=>new Option(s.name+(s.code?' ('+s.code+')':''),s.id)));
    $('station-choice').hidden=false;formError(list.reason);$('station-list').focus();
  }
  function controls(){
    if(!state)return;const disabled=!online||busy||state.busy;
    // Formuläret står kvar när parkopplingen inte når fram, till exempel efter en ny träff med ny kod.
    const open=!state.paired||state.status!=='connected';
    form.hidden=!open;$('connected').hidden=!state.paired;
    for(const n of form.querySelectorAll('input,select,button'))n.disabled=disabled;
    $('server').readOnly=state.originLocked;$('disconnect').disabled=disabled;
    $('connect').textContent=busy?'Ansluter…':state.paired?'Anslut med ny kod':'Anslut';
    $('connect-help').textContent=`TKL väljer stationen ${station()} själv. Adressen och koden finns i TrainMeet Server för inloggad administratör: Anslut ett ställverk i deltagarvyn eller under Drift.`;
  }
  form.onsubmit=async e=>{
    e.preventDefault();if(busy||!state)return;
    const origin=$('server').value.trim(),code=formatPairingCode($('code').value),stationId=$('station-choice').hidden?'':$('station-list').value;
    if(!origin)return formError('Ange serverns adress, till exempel https://server.trainmeet.app.');
    if(code.replace(/-/g,'').length<6)return formError('Ange anslutningskoden från TrainMeet, sex tecken.');
    busy=true;formError('');controls();
    try{
      const answer=await api('trainmeet/connect',{origin,code,stationId});
      if(!answer)return formError(document.getElementById('message-text').textContent||'Kunde inte ansluta. Försök igen.');
      if(answer.choose)return choose(answer.choose);
      $('code').value='';$('station-choice').hidden=true;typedOrigin=false;
    }finally{busy=false;controls();}
  };
  $('disconnect').onclick=()=>confirmAdmin({title:'Koppla från TrainMeet?',message:'TKL slutar hämta träffens tidtabell och trafikläge. Du ansluter igen med serverns adress och kod.',button:'Koppla från',action:async()=>!!await api('trainmeet/disconnect',{sessionId:state.sessionId,revision:state.revision})});
  return {update(next,connected,panel){
    state=next;online=connected;if(!state)return;timetable.update(state,online,panel);
    const stale=!online||state.stale;
    const mode=!state.paired?'off':stale?'warn':'ok',status=$('status');
    status.innerHTML=`<span class="settings-state" data-state="${mode}">${{off:'Ej ansluten',warn:'Kontakt saknas',ok:'Ansluten'}[mode]}</span>`;
    $('status-consequence').textContent={off:'Ställverket visar ingen tidtabell och klockan går lokalt.',warn:'Tidtabellen visar senaste mottagna uppgifter. TKL återansluter själv.',ok:'Tidtabell, klocka och förbindelselägen följer träffen.'}[mode];
    document.getElementById('menu-trainmeet-status').textContent={off:'Ej ansluten',warn:'Kontakt saknas',ok:'Ansluten'}[mode];
    $('message').textContent=state.paired?state.error:'';$('message').hidden=!$('message').textContent;
    if(!typedOrigin&&document.activeElement!==$('server'))$('server').value=state.origin;
    $('origin').textContent=state.origin||'Ingen server vald';$('origin-consequence').textContent=state.originLocked?'Fast för den här installationen.':'TKL-servern hämtar härifrån, inte webbläsaren.';
    $('station-summary').textContent=state.context?.station.name||state.stationId||'Ingen station vald';$('station-consequence').textContent='Tidtabellen och tågklareringen gäller den här stationen. TKL väljer den själv när du ansluter.';
    controls();root.classList.toggle('trainmeet-stale',!!state.paired&&stale);
    const c=state.context;let html='';if(c)html=`<div class="trainmeet-heading"><strong>${esc(c.station.name)} · ${esc(c.meet)} · ${esc(c.day)}</strong><span>${c.trains.length} tågrörelser · TrainMeet-klocka ${esc(c.clock.time)}${stale?' · gamla uppgifter':''}</span></div><details><summary>Förbindelselägen</summary>${(c.lines||c.connections).map(n=>`<p>${esc(n.neighborName||n.id)} · ${esc(n.state)} ${esc(n.trainNumber)}</p>`).join('')||'<p>Inga förbindelser.</p>'}</details>`;
    if(html!==lastContent){lastContent=html;$('context').innerHTML=html;}
  }};
}
