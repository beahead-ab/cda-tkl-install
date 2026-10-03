// Operating tools share the same navigation/workspaces; opening sends no orders.
import {registerAdminWorkspace} from './admin-ui.js';
export function createPanelConsole({onOpen,onResetComplete}) {
  const $=id=>document.getElementById(id),root=$('panel-console');
  root.innerHTML='<div id="panel-quick-actions"><button type="button" class="chip" id="panel-reset" aria-label="Återställ panel"><i class="chip-dot" aria-hidden="true"></i><span id="panel-reset-label">Återställ</span></button></div><div class="panel-runtime-info"><span id="panel-reset-status" role="status"></span><span id="panel-mode-status"></span><span id="panel-selection-slot"></span></div>';
  const yard=$('panel-reset').cloneNode(true);yard.id='yard-authority';yard.hidden=true;
  yard.querySelector('defs')?.remove();yard.querySelector('#panel-reset-label').id='yard-authority-label';
  yard.removeAttribute('aria-label');$('panel-quick-actions').append(yard);
  const drawer=document.createElement('div');drawer.id='operations-workspaces';$('tools-view').append(drawer);
  $('all-stop').textContent='Alla signaler i stopp';$('reset-ais').textContent='Återställ stopp';$('reset-ais').hidden=true;
  $('panel-selection-slot').append($('selection-hint'));
  const routes=document.createElement('section');routes.id='panel-route-tools';
  drawer.append(routes);
  routes.innerHTML='<p class="muted">Välj huvudtågväg för vanlig trafik eller växeltågväg för växling. Använd start- och slutplupparna på panelen eller listvalet här. Samma val återtar vägen.</p>';
  routes.append(root.querySelector('.panel-runtime-info'),$('route-activity'),$('route-catalog').closest('.card'));
  const routeActions=document.createElement('div');routeActions.className='admin-actions';routeActions.append($('clear-selection'),$('all-stop'),$('reset-ais'),$('emergency-cancel'));routes.append(routeActions);
  const emergencyHelp=document.createElement('p');emergencyHelp.className='muted';emergencyHelp.textContent='Nödåterta alla begär stopp och återtagning. Låsen ligger kvar tills spåren är fria och stopp samt växellägen är bekräftade.';routes.append(emergencyHelp);
  $('clear-selection').textContent='Avbryt startval';$('clear-selection').hidden=false;$('clear-selection').disabled=true;
  $('emergency-cancel').textContent='Nödåterta alla';$('route-mode').hidden=true;routes.append($('route-mode'));
  const authority=document.createElement('section');authority.id='panel-authority-tools';
  authority.innerHTML='<p class="muted">Fjärrläge spärrar lokal tågvägsläggning och växelmanöver. Ingen fjärrstyrning är ansluten ännu. Stopp och återtagning fungerar fortfarande.</p>';
  authority.append($('control-mode').closest('.authority-bar'));
  const overview=document.createElement('section');overview.id='panel-operations';overview.className='operation-overview';
  const descriptions=[
    ['panel-route-tools','Tågvägar','Välj typ av tågväg, använd listval och återta lagda vägar.'],
    ['clearance-tools','Tågklarering','Begär, godkänn och bekräfta tågklarering mot grannstationerna genom TrainMeet.'],
    ['track-block-tools','Spårspärrar','Hindra nya tågvägar över ett valt spåravsnitt.'],
    ['operating-controls','Linjer och programmeringsspår','Spärra en linje eller växla Lastspår 3 till programmeringsläge.'],
    ['train-information','Tågnummer','Ange tågidentitet och hantera nummerföljning i spårplanen.'],
    ['model-clock','Modellklocka','Ställ tid och hastighet för TKL:s lokala klocka.'],
    ['panel-authority-tools','Lokal- och fjärrläge','Manöverspärr för lokal drift. Ingen fjärrstyrning är ansluten.']
  ];
  for(const [id,title,description] of descriptions){const button=document.createElement('button');button.type='button';button.dataset.panelTool=id;button.setAttribute('aria-controls',id);button.innerHTML='<strong></strong><span></span>';button.querySelector('strong').textContent=title;button.querySelector('span').textContent=description;overview.append(button);}
  const blocks=$('toggle-block').closest('details');blocks.id='track-block-tools';
  const panes=[overview,routes,$('clearance-tools'),blocks,$('operating-controls'),$('train-information'),$('model-clock'),authority];
  for(const pane of panes){pane.hidden=true;drawer.append(pane);}
  $('inspector-home').hidden=true;document.body.append($('inspector-home'));
  $('traffic-tools').remove();$('operating-tools').remove();
  let lastReset=null;
  const hashes=['','#routes','#clearance','#blocks','#lines','#trains','#clock','#authority'];
  const workspaces=new Map();
  for(let i=0;i<panes.length;i++){
    const pane=panes[i],workspace=document.createElement('section');workspace.hidden=true;
    const title=i?descriptions[i-1][1]:'Driftverktyg';
    workspace.innerHTML='<div class="admin-workspace-heading"><h1 tabindex="-1"></h1></div>';
    workspace.querySelector('h1').textContent=title;
    drawer.append(workspace);workspace.append(pane);pane.hidden=false;
    if(pane.tagName==='DETAILS')pane.open=true;
    workspaces.set(pane.id,registerAdminWorkspace('#tools/operations'+hashes[i].replace('#','/'),workspace));
  }
  function close(){return false;}
  function open(id){
    if(id==='trainmeet-timetable'){location.hash='#panel';$('trainmeet-timetable').focus({preventScroll:true});return true;}
    const workspace=workspaces.get(id);if(!workspace)return false;
    onOpen();workspace.open();
    if(id==='train-information'&&$('train-editor'))$('train-editor').open=true;
    return true;
  }
  drawer.addEventListener('click',e=>{const id=e.target.closest('[data-panel-tool]')?.dataset.panelTool;if(id)open(id);});
  return {open,close,update(state,online){
    const authority=state.yard,delegated=authority?.owner==='ranger';
    yard.hidden=!authority;yard.disabled=!online||!authority?.change.allowed;
    yard.setAttribute('aria-pressed',String(delegated));yard.dataset.tone=delegated?'warn':'';
    const action=delegated?'Återta rangerbangården':'Lämna över rangerbangården';
    // Styra RBG: plain while TKL controls the yard, struck through while the ranger does.
    $('yard-authority-label').textContent='Styra RBG';yard.classList.toggle('chip-off',delegated);yard.setAttribute('aria-label',action);
    yard.title='Manöverrätt: '+(delegated?'Rangerställverket':'TKL')+'. '+(authority?.change.reason||'');
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
    const routeButton=overview.querySelector('[data-panel-tool="panel-route-tools"] strong');routeButton.textContent=state.routes.length?`Tågvägar (${state.routes.length})`:'Tågvägar';
  }};
}
