// The panel's console and the Drift tab in the bottom row; opening a part sends no orders.
export function createPanelConsole({onOpen,onResetComplete,showDrift}) {
  const $=id=>document.getElementById(id),root=$('panel-console');
  root.innerHTML='<div id="panel-quick-actions"><button type="button" class="chip" id="panel-reset" aria-label="Återställ panel"><i class="chip-dot" aria-hidden="true"></i><span id="panel-reset-label">Återställ</span></button></div><div class="panel-runtime-info"><span id="panel-reset-status" role="status"></span><span id="panel-mode-status"></span><span id="panel-selection-slot"></span></div>';
  // Drift: the bottom row's third tab holds everything an operator does while trains
  // run, so nothing operational is left in the administration window
  // (docs/installningar-plan.md). The parts are the same elements as before; only
  // their place changes, and opening a part sends no orders.
  const drift=document.createElement('div');drift.id='panel-drift';drift.tabIndex=-1;
  const actions=document.createElement('div');actions.className='drift-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label','Driftknappar');
  drift.append(actions);$('panel-events')?.append(drift);
  $('all-stop').textContent='Alla signaler i stopp';$('reset-ais').textContent='Återställ stopp';$('reset-ais').hidden=true;
  $('emergency-cancel').textContent='Nödåterta alla';
  $('emergency-cancel').title='Nödåterta alla begär stopp och återtagning. Låsen ligger kvar tills spåren är fria och stopp samt växellägen är bekräftade.';
  actions.append($('panel-quick-actions'),$('all-stop'),$('reset-ais'),$('emergency-cancel'),$('toggle-authority'));
  const mode=$('control-mode').closest('.authority-bar');mode.className='drift-mode';drift.append(mode);
  $('panel-selection-slot').append($('selection-hint'));
  const section=(id,title,...nodes)=>{const d=document.createElement('details');d.className='drift-section';d.id=id;d.innerHTML='<summary></summary>';d.querySelector('summary').textContent=title;d.append(...nodes);return d;};
  const routeHelp=document.createElement('p');routeHelp.className='muted';routeHelp.textContent='Välj huvudtågväg för vanlig trafik eller växeltågväg för växling. Använd start- och slutplupparna på panelen eller listvalet här. Samma val återtar vägen.';
  $('clear-selection').textContent='Avbryt startval';$('clear-selection').hidden=false;$('clear-selection').disabled=true;
  $('route-mode').hidden=true;
  const routeActions=document.createElement('div');routeActions.className='admin-actions';routeActions.append($('clear-selection'));
  const routes=section('drift-routes','Tågvägar',routeHelp,root.querySelector('.panel-runtime-info'),$('route-activity'),$('route-catalog').closest('.card'),routeActions,$('route-mode'));
  const clearance=$('clearance-tools');clearance.classList.add('drift-clearance');
  const blocks=$('toggle-block').closest('details');blocks.id='track-block-tools';
  const trains=section('drift-trains','Tågnummer',$('train-information'));
  for(const part of [clearance,routes,blocks,$('operating-controls'),trains,$('model-clock')]){part.hidden=false;if(part.tagName==='DETAILS'){part.open=false;part.classList.add('drift-section');}drift.append(part);}
  $('inspector-home').hidden=true;document.body.append($('inspector-home'));
  $('traffic-tools').remove();$('operating-tools').remove();
  let lastReset=null;
  // The old Drift pages of the administration window, kept as addresses.
  const ADDRESSES={routes:'drift-routes',clearance:'clearance-tools',blocks:'track-block-tools',lines:'operating-controls',trains:'drift-trains',clock:'model-clock',authority:'panel-drift'};
  function close(){return false;}
  function open(id){
    if(id==='trainmeet-timetable'){location.hash='#panel';$('trainmeet-timetable').focus({preventScroll:true});return true;}
    const part=$(id);if(!part||!drift.contains(part))return false;
    onOpen();if(location.hash!=='#panel')location.hash='#panel';showDrift?.();
    if(part.tagName==='DETAILS')part.open=true;
    if(id==='drift-trains'&&$('train-editor'))$('train-editor').open=true;
    requestAnimationFrame(()=>part.scrollIntoView({block:'start',behavior:'smooth'}));
    return true;
  }
  // #tools/operations/blocks and friends open the matching part of the Drift tab.
  function route(){const m=location.hash.split('?')[0].match(/^#tools\/operations(?:\/(\w+))?$/);if(!m)return;history.replaceState(null,'','#panel');window.dispatchEvent(new HashChangeEvent('hashchange'));open(ADDRESSES[m[1]]||'panel-drift');}
  window.addEventListener('hashchange',route);queueMicrotask(route);
  return {open,close,update(state,online){
    const stopped=!!state.controls?.stopAll,remote=state.controls?.mode==='remote',shunt=$('route-mode').value==='shunt';
    const reset=state.panelReset,waiting=reset?.phase==='waiting';
    $('panel-reset').setAttribute('aria-label',waiting?'Återställer…':'Återställ panel');
    $('panel-reset').disabled=!online||waiting||!!state.storageFault;
    $('panel-reset').setAttribute('aria-busy',String(waiting));$('panel-reset').dataset.tone=waiting?'warn':'';$('panel-reset-label').textContent=waiting?'Återställer…':'Återställ';
    $('panel-reset-status').textContent=['waiting','interrupted'].includes(reset?.phase)?reset.reason:'';
    if(reset?.phase==='complete'&&lastReset&&(lastReset.id!==reset.id||lastReset.phase!=='complete'))onResetComplete?.(reset.reason);
    lastReset=reset;
    $('all-stop').setAttribute('aria-pressed',String(stopped));$('reset-ais').hidden=!stopped;
    $('toggle-authority').setAttribute('aria-pressed',String(remote));$('toggle-authority').textContent=remote?'Återgå till lokal manövrering':'Spärra lokal manövrering';
    $('panel-mode-status').textContent=[remote?'Fjärrläge':'',shunt?'Växeltågväg':''].filter(Boolean).join(' · ');
    routes.querySelector('summary').textContent=state.routes.length?`Tågvägar (${state.routes.length})`:'Tågvägar';
  }};
}
