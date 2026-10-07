// Shared admin forms. Runtime controls keep their existing behaviour.
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sequence=0;
const unsavedChecks=new Set();
window.addEventListener('beforeunload',e=>{if([...unsavedChecks].some(check=>check())){e.preventDefault();e.returnValue='';}});
// unchanged: Spara stays dark with that note until something in the form differs;
// canSave adds the caller's own conditions, such as a lost connection.
export function createAdminDialog({title,body,saveButton,dirty=()=>false,busy=()=>false,onCancel=()=>{},unchanged='',canSave=()=>true}){
  const dialog=document.createElement('dialog'),id='admin-dialog-'+(++sequence);dialog.className='admin-dialog';dialog.setAttribute('aria-labelledby',id);
  dialog.innerHTML=`<header><h2 id="${id}">${escapeHTML(title)}</h2><button type="button" data-close aria-label="Stäng dialog">×</button></header><div class="admin-dialog-body"></div><p class="admin-form-error" role="alert" hidden></p><footer class="admin-dialog-actions"><button type="button" data-cancel>Avbryt</button></footer><section class="admin-discard" hidden><h3>Osparade ändringar</h3><p>Vill du fortsätta redigera eller kasta ändringarna?</p><div class="admin-dialog-actions"><button type="button" data-continue>Fortsätt redigera</button><button type="button" data-discard>Kasta ändringarna</button></div></section>`;
  const content=dialog.querySelector('.admin-dialog-body'),footer=dialog.querySelector('footer'),error=dialog.querySelector('[role=alert]'),discard=dialog.querySelector('.admin-discard');
  if(typeof body==='string')content.innerHTML=body;else if(body)content.append(body);
  const fieldErrors=new Map();
  function clearFieldError(field){const item=fieldErrors.get(field);if(!item)return;item.node.remove();if(item.described)field.setAttribute('aria-describedby',item.described);else field.removeAttribute('aria-describedby');if(item.invalid!==null)field.setAttribute('aria-invalid',item.invalid);else field.removeAttribute('aria-invalid');fieldErrors.delete(field);}
  let focusingInvalid=false;
  content.addEventListener('invalid',e=>{
    e.preventDefault();const field=e.target;clearFieldError(field);
    const node=document.createElement('span');node.className='admin-field-error';node.id=id+'-error-'+(++sequence);node.textContent=field.validationMessage;
    fieldErrors.set(field,{node,described:field.getAttribute('aria-describedby'),invalid:field.getAttribute('aria-invalid')});
    field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),node.id].filter(Boolean).join(' '));(field.closest('label')||field).after(node);
    if(!focusingInvalid){focusingInvalid=true;field.focus();queueMicrotask(()=>{focusingInvalid=false;});}
  },true);
  content.addEventListener('input',e=>{if(e.target.validity?.valid)clearFieldError(e.target);});
  dialog.addEventListener('close',()=>{for(const field of fieldErrors.keys())clearFieldError(field);});
  if(saveButton){const form=saveButton.form;if(form)saveButton.setAttribute('form',form.id);footer.append(saveButton);saveButton.classList.add('primary');}
  const idle=document.createElement('span');idle.className='admin-unchanged';idle.textContent=unchanged;idle.hidden=true;if(unchanged&&saveButton)footer.prepend(idle);
  function refresh(){if(!unchanged||!saveButton)return;const same=!dirty();idle.hidden=!same;saveButton.disabled=same||busy()||!canSave();}
  content.addEventListener('input',refresh);content.addEventListener('change',refresh);
  document.body.append(dialog);let trigger;
  const pending=()=>dialog.isConnected&&dialog.open&&dirty();unsavedChecks.add(pending);
  function resetPrompt(){content.hidden=false;footer.hidden=false;discard.hidden=true;}
  function close(force=false){
    if(!dialog.open)return true;if(!force&&busy())return false;
    if(!force&&dirty()){content.hidden=true;footer.hidden=true;discard.hidden=false;dialog.querySelector('[data-continue]').focus();return false;}
    dialog.close();resetPrompt();trigger?.isConnected&&trigger.focus({preventScroll:true});return true;
  }
  function cancel(){if(close())onCancel();}
  dialog.querySelector('[data-close]').onclick=cancel;dialog.querySelector('[data-cancel]').onclick=cancel;
  dialog.querySelector('[data-continue]').onclick=()=>{resetPrompt();content.querySelector('input,select,textarea,button')?.focus();};
  dialog.querySelector('[data-discard]').onclick=()=>{if(!busy()){onCancel();close(true);}};
  dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}},true);
  return {element:dialog,content,footer,refresh,open(){if(document.querySelector('dialog[open]')!==dialog&&document.querySelector('dialog[open]'))return false;trigger=document.activeElement;error.hidden=true;resetPrompt();dialog.showModal();refresh();content.querySelector('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')?.focus();return true;},close,setTitle(value){dialog.querySelector('h2').textContent=value;},message(value){error.textContent=value;error.hidden=!value;},setBusy(value){dialog.querySelectorAll('[data-close],[data-cancel]').forEach(b=>b.disabled=value);},get isOpen(){return dialog.open;}};
}
export function confirmAdmin({title,message,button='Bekräfta',action}){
  const body=document.createElement('p');body.textContent=message;const save=document.createElement('button');save.type='button';save.textContent=button;
  let busy=false;const modal=createAdminDialog({title,body,saveButton:save,busy:()=>busy});
  save.onclick=async()=>{busy=true;save.disabled=true;modal.setBusy(true);try{if(await action()!==false)modal.close(true);}catch(e){modal.message(e.message);}finally{busy=false;save.disabled=false;modal.setBusy(false);}};
  modal.element.addEventListener('close',()=>modal.element.remove(),{once:true});modal.open();
}
const workspaces=new Map();let hiddenNodes=new Map(),embedded=false;
// Studio monterar samma sidor i sina egna vyer: arbetsytan visas direkt, öppna och stäng rör inte adressen.
export function embedAdminWorkspaces(){embedded=true;}
export function syncAdminWorkspaces(){
  for(const [node,hidden] of hiddenNodes)node.hidden=hidden;hiddenNodes=new Map();
  for(const {element} of workspaces.values())element.hidden=true;
  const current=workspaces.get(location.hash.split('?')[0]);if(!current)return;
  current.element.hidden=false;
  for(let node=current.element;node.parentElement&&node.parentElement.tagName!=='BODY';node=node.parentElement){
    for(const sibling of node.parentElement.children){if(sibling!==node){hiddenNodes.set(sibling,sibling.hidden);sibling.hidden=true;}}
    if(node.parentElement.tagName==='MAIN')break;
  }
}
export function registerAdminWorkspace(hash,element,{dirty=()=>false,onDiscard=()=>{}}={}){
  if(embedded){element.classList.add('admin-workspace');unsavedChecks.add(()=>element.isConnected&&dirty());return {open(){element.hidden=false;element.scrollIntoView?.({block:'nearest'});},close(){element.hidden=true;}};}
  element.classList.add('admin-workspace');element.hidden=true;workspaces.set(hash,{element,dirty,onDiscard});unsavedChecks.add(()=>element.isConnected&&dirty());syncAdminWorkspaces();
  return {open(suffix=''){if(typeof suffix!=='string')suffix='';location.hash=hash+suffix;syncAdminWorkspaces();element.querySelector('h1,h2')?.focus();},close(){location.hash=hash.split('/')[0];syncAdminWorkspaces();}};
}
window.addEventListener('hashchange',syncAdminWorkspaces);

let lastWorkspaceHash=location.hash,leaving=false;
function confirmLeave(current,next){
  if(leaving)return;leaving=true;
  const body=document.createElement('p');body.textContent='Det finns osparade ändringar. Fortsätt redigera eller kasta ändringarna för att lämna sidan.';
  const button=document.createElement('button');button.textContent='Kasta ändringarna';
  const modal=createAdminDialog({title:'Lämna redigeringen?',body,saveButton:button,onCancel:()=>{leaving=false;}});
  modal.footer.querySelector('[data-cancel]').textContent='Fortsätt redigera';
  button.onclick=()=>{current.onDiscard();leaving=false;modal.close(true);location.hash=next;};
  modal.element.addEventListener('close',()=>modal.element.remove(),{once:true});modal.open();
}
document.addEventListener('click',e=>{
  const link=e.target.closest('a[href^="#"]'),next=link?.getAttribute('href'),current=workspaces.get(location.hash.split('?')[0]);
  if(current?.dirty()&&next!==location.hash&&next){e.preventDefault();e.stopImmediatePropagation();confirmLeave(current,next);}
},true);
window.addEventListener('hashchange',()=>{
  const next=location.hash,current=workspaces.get(lastWorkspaceHash.split('?')[0]);
  if(next!==lastWorkspaceHash&&current?.dirty()){
    history.replaceState(null,'',lastWorkspaceHash);syncAdminWorkspaces();confirmLeave(current,next);return;
  }
  lastWorkspaceHash=next;
});
// Inställningar rows: label · value · grey consequence (docs/installningar-plan.md).
// A value may be text or a node, such as settingsState().
export function settingsRows(list,rows){
  list.classList.add('settings-rows');
  list.replaceChildren(...rows.map(([label,value,note])=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),consequence=document.createElement('dd');
    dt.textContent=label;if(value instanceof Node)dd.append(value);else dd.textContent=value;consequence.className='settings-consequence';consequence.textContent=note||'';
    row.append(dt,dd,consequence);return row;
  }));
}
// Status as text and shape, never colour alone: ok ●, warn ▲, off ○.
export function settingsState(mode,text){const span=document.createElement('span');span.className='settings-state';span.dataset.state=mode;span.textContent=text;return span;}
export function settingsNote(className,text){const p=document.createElement('p');p.className=className;p.textContent=text;return p;}
