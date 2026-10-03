export function createModelClock({api}) {
  const root=document.getElementById('model-clock');
  root.innerHTML='<summary><span>Modellklocka</span> <time id="clock-time">12:00:00</time> <span id="clock-state">Pausad</span></summary><form id="clock-form"><p class="muted">Gemensam lokal klocka för öppna paneler. Startar pausad efter omstart. TrainMeet är ännu inte tidskälla.</p><div class="catalog"><label>Trafikdygn<input id="clock-day" type="number" min="1" max="3651" value="1" required></label><label>Tid<input id="clock-input" type="time" step="1" value="12:00:00" required></label><label>Hastighet<input id="clock-rate" type="number" min="0.1" max="60" step="0.1" value="1" required></label><button id="clock-save">Ställ klockan</button><button id="clock-toggle" type="button">Starta</button></div><p id="clock-message" role="status"></p></form>';
  const $=id=>document.getElementById('clock-'+id);let state,received=0,online=false,editing=false,editGuard=null;
  function draw() {
    if(!state)return;
    const current=state.timeMs+(state.running&&online?Math.max(0,performance.now()-received)*state.rate:0),day=Math.floor(current/86400000)+1;
    const time=new Date(current).toISOString().slice(11,19);
    $('time').textContent=(day>1?'Dygn '+day+' · ':'')+time;
    $('state').textContent=!online?'Kontakt saknas':state.running?'Går · '+state.rate+'×':'Pausad · '+state.rate+'×';
    $('toggle').textContent=state.running?'Pausa':'Starta';$('message').textContent=state.error||'';
    for(const id of ['toggle','save'])$(id).disabled=!online;
  }
  function fields() {const time=new Date(state.timeMs).toISOString().slice(11,19);$('input').value=time;$('day').value=Math.floor(state.timeMs/86400000)+1;$('rate').value=state.rate;}
  for(const id of ['input','day','rate'])$(id).oninput=()=>{if(!editing)editGuard={sessionId:state.sessionId,revision:state.revision};editing=true;};
  async function change(extra,guard={}){const answer=await api('clock',{sessionId:state.sessionId,revision:state.revision,rate:state.rate,running:state.running,...guard,...extra});if(answer){state=answer;received=performance.now();editing=false;editGuard=null;fields();draw();}}
  $('form').onsubmit=e=>{e.preventDefault();const [h,m,s=0]=$('input').value.split(':').map(Number);change({timeMs:((Number($('day').value)-1)*86400+h*3600+m*60+s)*1000,rate:Number($('rate').value)},editGuard||{});};
  $('toggle').onclick=()=>change({running:!state.running});
  setInterval(draw,250);
  return {update(next,connected){const changed=!state||state.sessionId!==next.sessionId||state.revision!==next.revision;if(state?.sessionId===next.sessionId&&state.revision>next.revision)return;if(state!==next){state=next;received=performance.now();}online=connected;if(changed&&!editing)fields();draw();}};
}
