// Editor for the saved Stream Deck layout: a grid in the deck's shape, pages as
// tabs, one dialog to choose what a key does. Saves a draft on the server and
// activates it like the other administrative documents. Drag and drop, icons and
// colours are deliberately absent: appearance follows state, not the editor.
import {createAdminDialog,confirmAdmin,registerAdminWorkspace,escapeHTML as esc} from './admin-ui.js';
import {MODELS,keyCount,modelFor,validateLayout,defaultLayout,setKey,swapKeys,addPage,renamePage,removePage,changeModel,keyLabel,SYSTEM_IDS} from './stream-deck-profile.js';
import {SYSTEM_KEYS} from './stream-deck-layout.js';
export function createStreamDeckEditor({api,message,pluppar,lines,deck}){
  const $=id=>document.getElementById('sde-'+id),card=document.getElementById('streamdeck-layout-card'),root=document.getElementById('streamdeck-layout-editor');
  if(!card||!root)return null;
  root.innerHTML=`<div class="admin-workspace-heading"><h1 tabindex="-1">Stream Deck-layout</h1></div>
<p class="muted">Klicka på en ruta för att välja vad knappen gör. Markera två rutor i rad för att byta plats. Utseendet följer tillståndet och går inte att ställa in.</p>
<div class="admin-toolbar sde-toolbar"><label>Modell<select id="sde-model"></select></label><button id="sde-standard" type="button">Hämta standardlayouten</button><button id="sde-save" type="button">Spara utkast</button><button id="sde-activate" type="button" class="primary">Granska och aktivera</button><button id="sde-discard" type="button">Kasta utkast</button><button id="sde-export" type="button">Exportera</button><label class="sde-import">Importera<input id="sde-import" type="file" accept="application/json,.json" hidden></label></div>
<p id="sde-status" class="muted" role="status"></p>
<div class="sde-pages" id="sde-pages"></div>
<div class="admin-actions sde-page-actions"><button id="sde-page-add" type="button">Ny sida</button><button id="sde-page-rename" type="button">Byt namn på sidan</button><button id="sde-page-remove" type="button">Ta bort sidan</button></div>
<div id="sde-grid" class="sde-grid" role="grid"></div>`;
  for(const [id,m] of Object.entries(MODELS))$('model').append(new Option(`${m.name} · ${m.columns}×${m.rows}`,id));
  let state=null,layout=null,baseline='',page=0,selected=null,busy=false,online=false;
  const serialize=l=>JSON.stringify(l);
  const dirty=()=>!!layout&&serialize(layout)!==baseline;
  const workspace=registerAdminWorkspace('#tools/streamdeck/layout',root,{dirty,onDiscard:()=>{layout=null;load();}});
  document.getElementById('streamdeck-layout-edit').onclick=()=>workspace.open();
  document.getElementById('streamdeck-layout-reset').onclick=()=>confirmAdmin({title:'Återgå till standardlayouten?',message:'Den egna layouten och eventuellt utkast tas bort. Decket använder då den automatiska layouten.',button:'Återgå',action:async()=>!!await api('streamdeck/reset',{revision:state.revision})});
  // Key chooser
  const form=document.createElement('form');form.id='sde-key-form';const f=id=>form.querySelector('#sde-'+id);
  form.innerHTML=`<label>Knapp<select id="sde-type"><option value="">Tom</option><option value="plupp">Plupp</option><option value="system">Driftknapp</option><option value="departure">Avgång mot sträcka</option><option value="arrival">Ankomst från sträcka</option><option value="page">Sidbyte</option></select></label>
<div data-for="plupp"><label>Sök plupp<input id="sde-plupp-filter" autocomplete="off" placeholder="skriv del av namnet"></label><label>Plupp<select id="sde-plupp" size="8"></select></label></div>
<div data-for="system"><label>Driftknapp<select id="sde-system"></select></label></div>
<div data-for="line"><label>Sträcka<select id="sde-line"></select></label><p class="muted" id="sde-line-help"></p></div>
<div data-for="page"><label>Till sida<select id="sde-target"></select></label></div>
<button type="submit" class="primary">Använd</button>`;
  for(const k of SYSTEM_KEYS)f('system').append(new Option(k.title,k.id));
  const keyDialog=createAdminDialog({title:'Knapp',body:form,saveButton:form.querySelector('button'),dirty:()=>false,busy:()=>busy});
  let editing=null;
  function fillChooser(key){
    const type=!key?'':key.type==='train'?key.role:key.type;f('type').value=type;showFields();
    f('plupp-filter').value='';fillPluppar('');if(key?.type==='plupp')f('plupp').value=key.id;
    if(key?.type==='system')f('system').value=key.id;
    f('line').replaceChildren(...lines().map(l=>new Option(`${l.neighborName} (${l.neighborCode||l.id})`,l.id)));f('line-help').textContent=lines().length?'':'Sträckorna hämtas från TrainMeet när stationen är parkopplad.';
    if(key?.type==='train')f('line').value=key.lineId;
    f('target').replaceChildren(...layout.pages.map((p,i)=>new Option(p.name,String(i))));if(key?.type==='page')f('target').value=String(key.target);
  }
  function fillPluppar(filter){const q=filter.trim().toLowerCase();const list=[...pluppar()].sort((a,b)=>(a.kind==='shunt')-(b.kind==='shunt')||a.label.localeCompare(b.label,'sv',{numeric:true})).filter(p=>!q||p.label.toLowerCase().includes(q)||p.id.toLowerCase().includes(q));const current=f('plupp').value;f('plupp').replaceChildren(...list.map(p=>new Option(p.label+(p.kind==='shunt'?' · växeltågväg':''),p.id)));if(list.some(p=>p.id===current))f('plupp').value=current;}
  function showFields(){const t=f('type').value;for(const box of form.querySelectorAll('[data-for]'))box.hidden=box.dataset.for!==(t==='departure'||t==='arrival'?'line':t);}
  f('type').onchange=showFields;f('plupp-filter').oninput=()=>fillPluppar(f('plupp-filter').value);
  form.onsubmit=e=>{e.preventDefault();const t=f('type').value;let key=null;
    if(t==='plupp'){if(!f('plupp').value)return keyDialog.message('Välj en plupp.');key={type:'plupp',id:f('plupp').value};}
    else if(t==='system')key={type:'system',id:f('system').value};
    else if(t==='departure'||t==='arrival'){if(!f('line').value)return keyDialog.message('Ingen sträcka att välja. Parkoppla med TrainMeet först.');key={type:'train',role:t,lineId:f('line').value};}
    else if(t==='page')key={type:'page',target:Number(f('target').value)};
    layout=setKey(layout,editing.page,editing.index,key);keyDialog.close(true);render();};
  // Grid interaction: click = choose; a second click on another key within the selection = swap.
  $('grid').addEventListener('click',e=>{const cell=e.target.closest('[data-index]');if(!cell||!layout)return;const index=Number(cell.dataset.index);
    if(selected!==null&&selected!==index){layout=swapKeys(layout,page,selected,index);selected=null;render();return;}
    selected=index;render();editing={page,index};fillChooser(layout.pages[page].keys[index]);keyDialog.open();});
  $('grid').addEventListener('keydown',e=>{if(e.key==='Escape'&&selected!==null){selected=null;render();}});
  $('pages').addEventListener('click',e=>{const tab=e.target.closest('[data-page]');if(!tab)return;page=Number(tab.dataset.page);selected=null;render();});
  $('page-add').onclick=()=>{try{layout=addPage(layout);page=layout.pages.length-1;render();}catch(err){message(err.message);}};
  $('page-rename').onclick=()=>{const name=prompt('Sidans namn',layout.pages[page].name);if(name!==null){layout=renamePage(layout,page,name);render();}};
  $('page-remove').onclick=()=>{try{layout=removePage(layout,page);page=Math.min(page,layout.pages.length-1);render();}catch(err){message(err.message);}};
  $('model').onchange=()=>{try{layout=changeModel(layout,$('model').value);selected=null;render();}catch(err){message(err.message);}};
  $('standard').onclick=()=>{layout=defaultLayout($('model').value,pluppar(),lines());page=0;selected=null;render();};
  async function run(work){if(busy)return;busy=true;render();try{return await work();}finally{busy=false;render();}}
  $('save').onclick=()=>run(async()=>{try{validateLayout(layout,{pluppIds:pluppar().map(p=>p.id)});}catch(err){return message(err.message);}const answer=await api('streamdeck/save',{revision:state.revision,layout});if(answer){baseline=serialize(answer.draft);message('Utkastet sparat.',{error:false});}});
  $('activate').onclick=()=>{if(dirty())return message('Spara utkastet innan det aktiveras.');confirmAdmin({title:'Aktivera layouten?',message:'Decket byter till den här layouten direkt, även på andra anslutna skärmar mot samma installation.',button:'Aktivera',action:async()=>!!await api('streamdeck/activate',{revision:state.revision})});};
  $('discard').onclick=()=>confirmAdmin({title:'Kasta utkastet?',message:'Osparade och sparade ändringar i utkastet försvinner. Den aktiva layouten påverkas inte.',button:'Kasta',action:async()=>{const answer=await api('streamdeck/discard',{revision:state.revision});if(answer){layout=null;load();}return !!answer;}});
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(layout,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='streamdeck-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $('import').onchange=async()=>{const file=$('import').files[0];$('import').value='';if(!file)return;try{const parsed=JSON.parse(await file.text());layout=validateLayout(parsed,{pluppIds:pluppar().map(p=>p.id)});page=0;selected=null;render();message('Layouten är inläst som osparat utkast.',{error:false});}catch(err){message('Filen kunde inte läsas: '+(err.message||err));}};
  function load(){
    if(!state)return;
    if(layout&&dirty())return;
    const source=state.draft||state.active;
    layout=source?structuredClone(source):defaultLayout(connectedModel()||'mk2',pluppar(),lines());
    baseline=serialize(layout);page=Math.min(page,layout.pages.length-1);render();
  }
  function connectedModel(){const info=deck?.info?.();return info?.connected?modelFor(info.columns,info.rows):'';}
  function render(){
    const info=deck?.info?.(),summary=!state?'':state.active?`Egen layout version ${state.activeVersion} (${MODELS[state.active.model]?.name||state.active.model}, ${state.active.pages.length} sidor)`:'Standardlayouten, automatisk för den anslutna modellen';
    document.getElementById('streamdeck-layout-summary').textContent=summary+(state?.draft?' · utkast finns':'')+(info?.connected&&state?.active&&keyCount(state.active.model)>info.keys?' · passar inte den anslutna modellen, standard används':'');
    document.getElementById('streamdeck-layout-reset').disabled=!online||!state||(!state.active&&!state.draft);
    if(!layout)return;
    $('model').value=layout.model;const m=MODELS[layout.model];
    $('status').textContent=`${dirty()?'Osparade ändringar.':state?.draft?'Sparat utkast.':'Inget utkast.'} ${connectedModel()?'Ansluten: '+MODELS[connectedModel()].name+'.':''}`;
    $('pages').replaceChildren(...layout.pages.map((p,i)=>{const b=document.createElement('button');b.type='button';b.dataset.page=String(i);b.textContent=p.name;b.className=i===page?'selected':'';b.setAttribute('aria-pressed',String(i===page));return b;}));
    const grid=$('grid');grid.style.gridTemplateColumns=`repeat(${m.columns},minmax(0,1fr))`;
    grid.replaceChildren(...layout.pages[page].keys.map((key,i)=>{const cell=document.createElement('button');cell.type='button';cell.dataset.index=String(i);cell.className='sde-key'+(key?' '+key.type:' empty')+(selected===i?' selected':'');const text=keyLabel(key,{pluppar:pluppar(),lines:lines()});cell.innerHTML=`<span class="sde-key-type">${esc(key?{plupp:'plupp',system:'drift',train:'tåg',page:'sida'}[key.type]:'')}</span><span class="sde-key-label">${esc(text||'—')}</span>`;cell.setAttribute('aria-label',`Knapp ${i+1}: ${text||'tom'}`);return cell;}));
    for(const id of ['save','activate','discard','standard','export','page-add','page-rename','page-remove','model'])$(id).disabled=busy||!online;
    $('activate').disabled=busy||!online||dirty()||!state?.draft;$('discard').disabled=busy||!online||!state?.draft;
  }
  return {update(next,connected){online=connected;const changed=!state||next.revision!==state.revision;state=next;if(changed||!layout)load();else render();}};
}
