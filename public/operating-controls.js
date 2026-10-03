const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createOperatingControls({api,openSource}) {
  let state,online=false,built=false;
  $('operating-controls').innerHTML='<summary>Linjer och programmeringsspår <span id="operating-count"></span></summary><p class="muted">Spärrar hindrar nya tågvägar. Redan lagda vägar stoppas med låsen kvar.</p><div id="line-controls" class="line-controls"></div><section id="programming-controls"><h3>Programmeringsspår · Lastspår 3</h3><p id="programming-state" role="status"></p><p id="programming-reason" class="muted"></p><div class="actions"><button id="programming-on">Koppla in programmeringsspår</button><button id="programming-off">Begär normaldrift</button><button id="programming-source" class="text-link">Visa källregel →</button></div><p class="muted">Växel 133 låses i rakt läge. Ett lok får stå på Lastspår 3. Omkoppling visas först efter återrapport; ingen CV-programmerare ingår.</p></section>';
  const send=(command,data)=>{if(online&&state?.operating)return api(command,{...data,sessionId:state.operating.sessionId,revision:state.operating.revision});};
  $('line-controls').onclick=e=>{const id=e.target.closest('[data-line]')?.dataset.line;if(id){const line=state.operating.lines.find(l=>l.id===id);send('line-block',{id,blocked:!line.blocked});}};
  $('programming-on').onclick=()=>send('programming',{enabled:true});$('programming-off').onclick=()=>send('programming',{enabled:false});
  $('programming-source').onclick=()=>openSource('conditionals',state.operating.programming.rule);
  return {update(next,connected){state=next;online=connected;const op=state.operating; if(!op)return;
    if(!built){$('line-controls').innerHTML=op.lines.map(l=>`<button data-line="${esc(l.id)}"><strong>${esc(l.label)}</strong><span></span></button>`).join('');built=true;}
    for(const line of op.lines){const b=$('line-controls').querySelector(`[data-line="${line.id}"]`);b.classList.toggle('line-is-blocked',line.blocked);b.setAttribute('aria-pressed',String(line.blocked));b.querySelector('span').textContent=line.blocked?'Spärrat · öppna':'Öppet · spärra';b.disabled=!online||!!state.storageFault||(line.blocked&&state.controls.mode!=='local');}
    const p=op.programming,count=op.lines.filter(l=>l.blocked).length+(p?.reserved?1:0);$('operating-count').textContent=count?'· '+count+' spärrar':'';
    $('programming-controls').hidden=!p;if(!p)return;
    $('programming-state').textContent=!online?'Kontakt med kärnan saknas':!p.reserved?(p.normal?'Normaldrift återrapporterad':'Okänt läge · invänta återrapport'):({setting:'Kopplar om · spärr kvar',active:'Programmeringsläge återrapporterat',returning:'Återgår till normaldrift · spärr kvar',held:'Kontroll behövs · spärr kvar'}[p.phase]);
    $('programming-reason').textContent=p.reserved?p.reason:p.enable.reason;
    $('programming-on').disabled=!online||!p.enable.allowed;$('programming-off').disabled=!online||!!state.storageFault||state.connection!=='connected'||(!p.reserved&&p.normal)||p.phase==='returning';
  }};
}
