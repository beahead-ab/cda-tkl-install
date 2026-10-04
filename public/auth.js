const $ = id => document.getElementById(id);
let state, busy = false, navigationMounted=false;
async function mountAccountNavigation(){
  if(navigationMounted)return;navigationMounted=true;
  for(const href of ['/app.css','/admin-line.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
  const {createAdminNavigation}=await import('./admin-navigation.js');
  document.body.dataset.page='account';document.body.dataset.skin='original';
  const header=document.createElement('header');header.className='app-header';header.innerHTML='<button id="admin-nav-toggle" type="button" aria-label="Öppna sidomenyn" aria-controls="admin-sidebar" aria-expanded="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg></button><a class="brand" href="/#panel"><span>CHARLOTTENDAL</span></a>';
  const sidebar=document.createElement('nav');sidebar.id='admin-sidebar';sidebar.setAttribute('aria-label','Inställningar');document.body.prepend(header,sidebar);createAdminNavigation({account:true});
  const {createFullscreen}=await import('./fullscreen.js');createFullscreen({button:document.getElementById('toggle-fullscreen'),onError:text=>showError(Error(text))});
  fetch('/api/config').then(r=>r.ok?r.json():null).then(config=>{if(config?.fieldUrl){const link=document.getElementById('field-link');link.href=config.fieldUrl;link.hidden=false;}}).catch(()=>{});
}

function showError(error) { $('error').textContent = error.message; $('error').hidden = false; }
async function call(action, data) {
  const res = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json();
  if (!res.ok) throw Error(result.error || 'Kunde inte logga in');
  return result;
}
function render() {
  const authenticated = state.authenticated;
  $('login').hidden = authenticated; $('change').hidden = !authenticated;
  $('account-actions').hidden = !authenticated; $('back').hidden = state.mustChange;
  $('heading').textContent = authenticated ? (state.mustChange?'Välj ditt lösenord':'Byt lösenord') : 'Logga in';
  document.title=$('heading').textContent+' · Charlottendal TKL';
  if(authenticated&&!state.mustChange)mountAccountNavigation().catch(showError);
  $('intro').textContent = authenticated ? (state.mustChange ? 'Byt det tillfälliga lösenordet innan du öppnar ställverket.' : 'Här kan du byta lösenord. Övriga inloggningar avslutas när du sparar.') : 'Ange ditt lösenord för att öppna ställverket.';
}
async function submit(form, action) {
  if (busy) return; busy = true; $('error').hidden = true;
  const button = form.querySelector('button[type=submit]'); button.disabled = true;
  try { await action(); } catch (e) { showError(e); } finally { button.disabled = false; busy = false; }
}
$('login').onsubmit = e => { e.preventDefault(); submit($('login'), async () => {
  const password = $('password').value, result = await call('login', { password });
  $('password').value = '';
  if (!result.mustChange) { location.replace('/'); return; }
  state = { authenticated: true, mustChange: true }; render();
  // Retain the just-entered temporary password only in this form until it is changed.
  $('current').value = password; $('current-row').hidden = true; $('new').focus();
}); };
$('change').onsubmit = e => { e.preventDefault(); submit($('change'), async () => {
  if ($('new').value !== $('repeat').value) throw Error('De nya lösenorden är inte lika');
  await call('password', { currentPassword: $('current').value, newPassword: $('new').value });
  $('change').reset(); location.replace('/');
}); };
$('logout').onclick = async () => { try { await call('logout', {}); location.replace('/login'); } catch (e) { showError(e); } };
try {
  const response = await fetch('/api/auth/session'); if (!response.ok) throw Error('Inloggningen är inte tillgänglig');
  state = await response.json();
  if (state.authenticated && !state.mustChange && location.pathname === '/login') location.replace('/');
  else render();
} catch (e) { showError(e); }
