// Inställningar → Den här datorn → Användare, som i TrainMeet Server: ägaren bjuder in med namn och roll och får en
// engångskod att lämna över; den inbjudne väljer lösenord på /login. En administratör ser listan men ändrar den inte.
import {createAdminDialog} from './admin-ui.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>t?new Date(t).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'}):'';
const ROLE={owner:'ägare',admin:'administratör'};
export function createUsersPage({root,api,message,session}){
  if(!root)return null;
  let view=null,last='';
  const pill=(mode,text)=>`<span class="settings-state" data-state="${mode}">${esc(text)}</span>`;
  const status=u=>u.status==='active'?pill('ok',u.mustChange?'Byter lösenord vid inloggning':'Aktiv'):u.status==='invited'?pill('warn','Inbjuden · koden gäller till '+when(u.invitationExpires)):pill('off','Koden har gått ut');
  const render=()=>{
    if(!view)return;
    const owner=view.me?.role==='owner';
    const rows=view.users.map(u=>`<tr data-user="${esc(u.id)}"><td>${esc(u.username)}${u.id===view.me?.id?' <span class="muted">(du)</span>':''}</td><td>${ROLE[u.role]||esc(u.role)}</td><td>${status(u)}</td><td class="users-actions">${owner?`${u.status!=='active'||u.id!==view.me?.id?`<button type="button" data-reissue="${esc(u.id)}">Ny kod</button>`:''}${u.id!==view.me?.id?`<button type="button" data-remove="${esc(u.id)}" data-name="${esc(u.username)}">Ta bort</button>`:''}`:''}</td></tr>`).join('');
    const mode=view.mode==='external'?'Webbdriften: inloggning krävs överallt, också för operatören.':'Den här datorn: operatören behöver inte logga in. Inställningar och Objekt och regler kräver en inloggad ägare eller administratör.';
    const html=`<section class="card"><h2>Vem som har tillgång</h2><p class="settings-consequence">${esc(mode)} Ägaren lägger till och tar bort användare; en administratör sköter hela TKL men inte vilka som har tillgång.</p>
      <table class="users-table"><thead><tr><th>Användarnamn</th><th>Roll</th><th>Status</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="muted">Inga användare.</td></tr>'}</tbody></table>
      ${owner?`<div class="settings-actions"><button type="button" class="primary" data-invite>Bjud in användare</button><p>Du får en engångskod som gäller sju dagar. Den nya användaren väljer sitt lösenord på inloggningssidan under "Jag har en inbjudningskod".</p></div>`:`<p class="settings-footnote">Bara ägaren bjuder in och tar bort användare. Ditt eget lösenord byter du under <a href="/account">Byt lösenord</a>.</p>`}
      ${owner?`<p class="settings-footnote">"Ny kod" nollställer användarens lösenord och avslutar dess inloggningar: för den som glömt sitt lösenord eller aldrig löste in sin kod. Har ägaren själv låst sig ute körs <code>node scripts/recover-user.mjs &lt;namn&gt;</code> på datorn. Ditt eget lösenord byter du under <a href="/account">Byt lösenord</a>.</p>`:''}</section>`;
    if(html!==last){last=html;root.innerHTML=html;}
  };
  const showCode=(result,title)=>{
    const body=document.createElement('div');
    body.innerHTML=`<p>Lämna användarnamnet och koden till <b>${esc(result.user.username)}</b> (${ROLE[result.user.role]}). Koden visas bara nu och gäller till ${esc(when(result.expires))}.</p><p class="users-code"><code>${esc(result.code)}</code> <button type="button" data-copy-code>Kopiera</button></p><p class="settings-consequence">Den nya användaren öppnar inloggningssidan, väljer "Jag har en inbjudningskod" och anger namn, kod och ett eget lösenord.</p>`;
    body.querySelector('[data-copy-code]').onclick=async e=>{try{await navigator.clipboard.writeText(result.code);e.target.textContent='Kopierad';}catch{e.target.textContent='Markera koden och kopiera';}};
    const close=document.createElement('button');close.type='button';close.textContent='Klart';
    const modal=createAdminDialog({title,body,saveButton:close});modal.footer.querySelector('[data-cancel]')?.remove();close.onclick=()=>modal.close();modal.open();
  };
  const invite=()=>{
    const form=document.createElement('form');form.className='admin-form';
    form.innerHTML=`<label>Användarnamn <input name="username" required maxlength="64" autocomplete="off" autocapitalize="off" spellcheck="false" pattern="[A-Za-z0-9][A-Za-z0-9._\\-]{2,63}"></label><p class="settings-consequence">3–64 tecken: bokstäver, siffror, punkt, bindestreck eller understreck.</p>
      <label>Roll <select name="role"><option value="admin">Administratör · sköter hela TKL</option><option value="owner">Ägare · även vem som har tillgång</option></select></label>`;
    const save=document.createElement('button');save.type='button';save.textContent='Skapa inbjudningskod';
    const modal=createAdminDialog({title:'Bjud in användare',body:form,saveButton:save});
    save.onclick=async()=>{if(!form.reportValidity())return;save.disabled=true;try{const result=await api('users/invite',{username:form.elements.username.value.trim(),role:form.elements.role.value});if(result){modal.close();view={...view,...result};last='';render();showCode(result,'Inbjudningskod skapad');}}finally{save.disabled=false;}};
    modal.open();form.elements.username.focus();
  };
  root.addEventListener('click',async e=>{
    if(e.target.closest('[data-invite]'))return invite();
    const re=e.target.closest('[data-reissue]');
    if(re){if(!confirm('Ge en ny kod? Användarens lösenord och inloggningar slutar gälla.'))return;const result=await api('users/reissue',{id:re.dataset.reissue});if(result){view={...view,...result};last='';render();showCode(result,'Ny inbjudningskod');}return;}
    const rm=e.target.closest('[data-remove]');
    if(rm){if(!confirm(`Ta bort ${rm.dataset.name}? Användaren loggas ut och kan inte längre logga in.`))return;const result=await api('users/remove',{id:rm.dataset.remove});if(result){view={...view,...result};last='';render();message(rm.dataset.name+' är borttagen.',{error:false});}}
  });
  const page={
    async load(){try{const r=await fetch('/api/users',{cache:'no-cache'});if(r.status===401||r.status===428){const s=session?.();if(s?.mode!=='cloudflare')location.assign('/login?next='+encodeURIComponent('/'+location.hash));return;}if(!r.ok){const a=await r.json().catch(()=>null);root.innerHTML=`<p class="settings-alert">${esc(a?.error||'Användare kan inte läsas här.')}</p>`;return;}view=await r.json();last='';render();}catch{}},
    update(v){view=v;render();}
  };
  return page;
}
