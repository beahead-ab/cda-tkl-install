import {createAdminDialog,confirmAdmin,registerAdminWorkspace} from './admin-ui.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=value=>value?new Date(value).toLocaleString('sv-SE'):'Grundversion';
export function createConfiguration({root,config,onActive}) {
  let data,selected,kind='signals',query='',busy=false,unsaved=false,locks=0,unavailable=false;
  const $=id=>document.getElementById('cfg-'+id);
  root.innerHTML=`<details class="configuration card"><summary>Visningsinställningar <span id="cfg-version"></span></summary>
    <p class="muted">Ändra namn och beskrivningar för panelens objekt. Adresser, signalbesked och manöverregler ligger i en separat driftprofil och ändras inte här. Original-XML bevaras.</p>
    <div class="configuration-toolbar"><span id="cfg-draft-state"></span><button id="cfg-reload">Läs in senaste</button></div>
    <p id="cfg-message" role="status" aria-live="polite"></p>
    <div class="configuration-grid"><div><label>Objekttyp<select id="cfg-kind"><option value="signals">Signaler</option><option value="turnouts">Växlar</option><option value="blocks">Spåravsnitt</option><option value="buttons">Tågvägsknappar</option><option value="routes">Tågvägar</option></select></label>
    <label>Sök objekt<input id="cfg-search" type="search" placeholder="Namn eller identitet"></label><select id="cfg-object" size="6" aria-label="Objekt att ändra"></select></div>
    <form id="cfg-editor"><strong id="cfg-identity"></strong><p id="cfg-origin" class="muted"></p><label>Visningsnamn<input id="cfg-name" maxlength="64" required></label><label>Beskrivning<textarea id="cfg-description" maxlength="1000" rows="3"></textarea></label><button id="cfg-save" type="submit">Spara i utkast</button><button id="cfg-reset-editor" type="button">Ångra osparat</button><span id="cfg-unsaved" class="muted"></span></form></div>
    <section class="configuration-review"><h3>Granska sparat utkast</h3><p id="cfg-validation"></p><div id="cfg-diff" class="table-wrap"></div>
    <label>Beskriv ändringen<input id="cfg-reason" maxlength="200" placeholder="Exempel: Förtydligat signalnamnet vid infarten"></label>
    <div class="actions"><button id="cfg-activate" class="primary">Aktivera utkast</button><button id="cfg-discard">Kasta sparat utkast</button></div><p id="cfg-locks" class="muted"></p></section>
    <details class="configuration-history"><summary>Versionshistorik</summary><p class="muted">Hämta en version till ett utkast, granska skillnaderna och aktivera när anläggningen saknar tågvägslås.</p><div id="cfg-history"></div></details></details>`;
  const contents=root.firstElementChild;contents.open=true;contents.querySelector('summary').hidden=true;
  const overview=document.createElement('section');overview.className='card';overview.innerHTML='<h2>Visningsinställningar</h2><p class="muted">Namn och beskrivningar för panelens objekt.</p><button type="button">Öppna visningsinställningar</button>';
  const workspace=document.createElement('section');workspace.innerHTML='<div class="admin-workspace-heading"><h1 tabindex="-1">Visningsinställningar</h1></div><p class="admin-scope">Hela anläggningen · sparas först i utkast</p>';workspace.append(contents);root.append(overview,workspace);
  const page=registerAdminWorkspace('#register/presentation',workspace);overview.querySelector('button').onclick=page.open;
  const editorForm=$('editor'),editButton=document.createElement('button');editButton.id='cfg-open-editor';editButton.type='button';editButton.textContent='Redigera valt objekt';const preview=document.createElement('div');preview.className='admin-selected-object';preview.innerHTML='<div id="cfg-preview"></div>';editorForm.before(preview);preview.append(editButton);
  $('reset-editor').hidden=true;$('unsaved').hidden=true;
  const modal=createAdminDialog({title:'Redigera namn och beskrivning',body:editorForm,saveButton:$('save'),dirty:()=>unsaved,busy:()=>busy,onCancel:()=>{unsaved=false;editor();}});
  editButton.onclick=()=>{editor();modal.open();};
  const activationForm=document.createElement('form');activationForm.id='cfg-activation-form';activationForm.append($('reason').closest('label'));$('activate').setAttribute('form',activationForm.id);$('activate').type='submit';
  const activationInfo=document.createElement('p');activationInfo.className='muted';activationInfo.textContent='De granskade namnen och beskrivningarna börjar användas i alla öppna paneler. Aktivering kräver att inga tågvägslås finns kvar.';activationForm.prepend(activationInfo);
  const activationButton=document.createElement('button');activationButton.id='cfg-open-activation';activationButton.textContent='Granska och aktivera';$('activate').before(activationButton);
  const activationModal=createAdminDialog({title:'Aktivera visningsinställningar',body:activationForm,saveButton:$('activate'),dirty:()=>$('reason').value!=='',busy:()=>busy,onCancel:()=>{$('reason').value='';}});
  activationButton.onclick=()=>{$('reason').value='';controls();activationModal.open();};
  const message=(value,error=false)=>{$('message').textContent=value;$('message').classList.toggle('error',error);if(error){if(modal.isOpen)modal.message(value);if(activationModal.isOpen)activationModal.message(value);}};
  async function request(action,payload) {
    const response=await fetch('/api/configuration'+(action?'/'+action:''),action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
    if([401,428].includes(response.status)) location.assign('/login');
    const answer=await response.json(); if(!response.ok) throw Error(answer.error||'Kunde inte läsa inställningarna.');return answer;
  }
  function controls() {
    const changed=!!data?.changes.length;editButton.disabled=busy||!selected||!data;activationButton.disabled=busy||unsaved||!!locks||unavailable||!changed||!!data?.errors.length;modal.setBusy(busy);activationModal.setBusy(busy);
    $('activate').disabled=busy||unsaved||!!locks||unavailable||!changed||!!data?.errors.length||!$('reason').value.trim();
    $('discard').disabled=busy||unsaved||!data?.draft;
    $('reset-editor').disabled=busy||!unsaved;
    $('save').disabled=busy||!selected||!unsaved;
    $('reload').disabled=busy||unsaved;
    for(const id of ['name','description','reason']) $(id).disabled=busy||!data;
    $('object').disabled=busy||unsaved||!data; $('kind').disabled=busy||unsaved||!data; $('search').disabled=busy||unsaved||!data;
    $('locks').textContent=unavailable?'Aktivering spärrad medan kontakt saknas eller ett lagringsfel finns.':locks?`Aktivering spärrad: ${locks} driftlås finns kvar.`:unsaved?'Spara den öppna ändringen innan du granskar eller byter objekt.':'Aktivering tillåts när inga tågvägslås finns. Servern kontrollerar villkoret igen.';
    $('unsaved').textContent=unsaved?' Ej sparat':'';
    for(const button of $('history').querySelectorAll('button')) button.disabled=busy||unsaved||!!data?.draft;
  }
  const fields=key=>(data.draft?data.draft.overrides:data.active.overrides)[key]||{};
  function editor() {
    const row=data.catalog.find(r=>r.key===selected); if(!row){$('editor').hidden=true;$('preview').textContent='Inga objekt matchar sökningen.';controls();return;}$('editor').hidden=false;
    const values=fields(row.key);$('identity').textContent=row.title+' · '+row.id;
    $('origin').textContent='Ursprungligt namn: '+row.label+(row.address!==null?' · Adress: '+row.address:'');
    $('name').value=values.name??row.label;$('description').value=values.description||'';$('preview').innerHTML='<strong>'+esc(values.name??row.label)+'</strong><p class="admin-readonly muted">'+esc(values.description||'Ingen beskrivning.')+'</p>';unsaved=false;controls();
  }
  function objects() {
    const needle=query.toLocaleLowerCase('sv');
    const rows=data.catalog.filter(r=>r.kind===kind&&(!needle||(r.id+' '+r.label+' '+(fields(r.key).name||'')).toLocaleLowerCase('sv').includes(needle)));
    if(!rows.some(r=>r.key===selected)) selected=rows[0]?.key;
    $('object').innerHTML=rows.map(r=>`<option value="${esc(r.key)}">${esc(fields(r.key).name||r.label)}${(fields(r.key).name||r.label)!==r.id?' · '+esc(r.id):''}</option>`).join('');
    $('object').value=selected||'';editor();
  }
  function render() {
    $('version').textContent='· version '+data.active.activeVersion;
    $('draft-state').textContent=data.draft?'Utkast sparat '+date(data.draft.updatedAt)+(data.draft.restoredFrom!==null?' · hämtat från version '+data.draft.restoredFrom:''):'Inget sparat utkast';
    $('validation').textContent=data.errors.length?data.errors.join(' '):data.changes.length?`${data.changes.length} fältändringar validerade. Namn och beskrivningar påverkar inte driftadresser eller lås.`:'Inga skillnader mot den aktiva versionen.';
    $('diff').innerHTML=data.changes.length?`<table><thead><tr><th>Objekt / fält</th><th>Aktivt nu</th><th>Efter aktivering</th></tr></thead><tbody>${data.changes.map(r=>`<tr><td>${esc(r.key)}<div class="muted">${r.field==='name'?'Visningsnamn':'Beskrivning'}</div></td><td>${esc(r.before)||'—'}</td><td>${esc(r.after)||'—'}</td></tr>`).join('')}</tbody></table>`:'';
    $('history').innerHTML=[...data.history].reverse().map(v=>`<div class="configuration-version"><div><strong>Version ${v.id}${v.id===data.active.activeVersion?' · aktiv':''}</strong><p>${esc(v.reason)}</p><small>${date(v.createdAt)} · ${v.objects} ändrade objekt</small></div><button data-version="${v.id}">Hämta till utkast</button></div>`).join('');
    objects();controls();
  }
  async function act(action,payload,success) {
    if(busy)return;busy=true;controls();
    try {
      data=await request(action,{revision:data.revision,...payload});unsaved=false;
      config.presentation=data.active; await onActive(data.active);render();message(success);
      if(action==='save')modal.close(true);if(action==='activate'){$('reason').value='';activationModal.close(true);}return true;
    } catch(e){message(e.message,true);return false;}finally{busy=false;controls();}
  }
  async function load() { if(busy||unsaved)return;busy=true;controls();try{data=await request();render();message('');}catch(e){message(e.message,true);}finally{busy=false;controls();} }
  $('kind').onchange=e=>{kind=e.target.value;objects();};$('search').oninput=e=>{query=e.target.value;objects();};
  $('object').onchange=e=>{selected=e.target.value;editor();};
  for(const id of ['name','description']) $(id).oninput=()=>{unsaved=true;controls();};
  $('reset-editor').onclick=editor;
  $('reason').oninput=controls;$('reload').onclick=load;
  $('editor').onsubmit=e=>{e.preventDefault();act('save',{key:selected,name:$('name').value,description:$('description').value},'Utkast sparat på servern. Granska skillnaderna nedan.');};
  activationForm.onsubmit=e=>{e.preventDefault();act('activate',{reason:$('reason').value},'Versionen är aktiverad. Öppna paneler får de nya visningsuppgifterna.');};
  $('discard').onclick=()=>confirmAdmin({title:'Kasta visningsutkastet?',message:'Den aktiva versionen behålls.',button:'Kasta utkast',action:()=>act('discard',{},'Utkastet är kastat.')});
  $('history').onclick=e=>{const v=e.target.closest('button')?.dataset.version;if(v!==undefined)act('restore',{version:Number(v)},'Versionen är hämtad till utkast. Granska skillnaderna före aktivering.');};
  load();
  return {load,updateState(state,online){locks=(state?.routes.length||0)+(state?.operating?.programming?.reserved?1:0);unavailable=!online||!!state?.storageFault;controls();}};
}
