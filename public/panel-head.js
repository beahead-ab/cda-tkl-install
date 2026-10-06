// Status bar in its own row above the plan: CHARLOTTENDAL with the current notice beside
// it on the left; on the right the update and reload chips when they apply, and the push
// buttons (Återställ) that app.js moves in. Presentation only; app.js hands it
// the texts, it sends nothing.
const esc=v=>String(v??'');
export function createPanelHead({shell,onUpdate}){
  if(!shell)return null;
  const left=document.createElement('div');left.id='plan-head';
  left.innerHTML='<span class="plan-head-title">Charlottendal</span><span class="chip chip-status" id="plan-head-status" role="status" hidden><i class="chip-dot" aria-hidden="true"></i><span></span></span>';
  const right=document.createElement('div');right.id='plan-head-right';
  right.innerHTML='<button type="button" class="chip chip-start" id="plan-head-start" data-tone="warn" hidden><i class="chip-dot" aria-hidden="true"></i><span></span></button><button type="button" class="chip chip-update" id="plan-head-update" hidden><i class="chip-dot" aria-hidden="true"></i><span></span></button><button type="button" class="chip chip-release" id="plan-head-release" data-tone="warn" hidden><i class="chip-dot" aria-hidden="true"></i><span>Ny version · ladda om</span></button>';
  shell.append(left,right);
  const status=left.querySelector('#plan-head-status'),release=right.querySelector('#plan-head-release'),updateChip=right.querySelector('#plan-head-update');
  // Reloading is the operator's choice: never in the middle of a route choice or an acknowledgement.
  release.onclick=()=>location.reload();
  let updateView=null;updateChip.onclick=()=>onUpdate?.(updateView);
  // Kom igång: until the owner marks it done, the panel says how many steps remain and opens the page.
  const startChip=right.querySelector('#plan-head-start');startChip.onclick=()=>{location.hash='#advanced/start';};
  let message=null,timer=0,notice=null;
  function draw(){
    const shown=message||notice;
    status.hidden=!shown?.text;status.dataset.tone=shown?.tone||'';
    status.querySelector('span').textContent=esc(shown?.text);status.title=esc(shown?.text);
  }
  return {
    // The core's message for a while; errors read as alarms.
    message(text,error,duration){clearTimeout(timer);message=text?{text,tone:error?'alarm':'ok'}:null;if(text&&duration)timer=setTimeout(()=>{message=null;draw();},duration);draw();},
    // The standing notice when no message is shown: no contact, AIS or an emergency cancel,
    // a route waiting, remote mode. The panel shows no toasts; this is where they read.
    notice(next){notice=next||null;draw();},
    startNotice(view){const show=!!view&&!view.done;startChip.hidden=!show;if(show){startChip.querySelector('span').textContent='Kom igång · '+view.remaining+' steg kvar';startChip.title='Det här ställverket är inte färdigt att användas. Öppna Kom igång under Inställningar.';}},
    // A newer release in the public install repository than this installed copy runs.
    updateNotice(view){updateView=view||null;const show=!!view?.available;updateChip.hidden=!show;if(show){updateChip.querySelector('span').textContent='Uppdatering '+view.latest;const text='Charlottendal TKL '+view.latest+' finns att installera. Den här datorn kör '+view.current+'.';updateChip.title=text;updateChip.setAttribute('aria-label',text);}},
    // The server runs a newer version than this page was loaded from.
    release(version){release.hidden=!version;if(version){const text='Ny version '+version+' finns. Ladda om sidan för att använda den.';release.title=text;release.setAttribute('aria-label',text);}}
  };
}
