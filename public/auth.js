// Inloggning, inbjudningskod, första ägaren och lösenordsbyte. Lokalt behöver operatören aldrig hit;
// sidan nås när Inställningar eller Studio öppnas utan inloggning, och leder tillbaka dit (?next=).
const $ = id => document.getElementById(id);
let state, busy = false, navigationMounted = false, view = 'login';
const next = (() => { const n = new URLSearchParams(location.search).get('next') || '/'; return /^\/(?!\/)/.test(n) ? n : '/'; })();
async function mountAccountNavigation(){
  if(navigationMounted)return;navigationMounted=true;
  for(const href of ['/app.css','/admin-line.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
  const {createAdminNavigation}=await import('./admin-navigation.js');
  document.body.dataset.page='account';document.body.dataset.skin='original';
  const header=document.createElement('header');header.className='app-header';header.innerHTML='<button id="admin-nav-toggle" type="button" aria-label="Öppna sidomenyn" aria-controls="admin-sidebar" aria-expanded="false"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/></svg></button><span class="app-header-title">Inställningar</span>';
  const sidebar=document.createElement('nav');sidebar.id='admin-sidebar';sidebar.setAttribute('aria-label','Inställningar');document.body.prepend(header,sidebar);const nav=createAdminNavigation({account:true});nav.setSession?.(state);
  const {createFullscreen}=await import('./fullscreen.js');createFullscreen({button:document.getElementById('toggle-fullscreen'),onError:text=>showError(Error(text))});
  fetch('/api/config').then(r=>r.ok?r.json():null).then(config=>{if(config?.fieldUrl){const link=document.getElementById('field-link');link.href=config.fieldUrl;link.hidden=false;}}).catch(()=>{});
}
function showError(error) { $('error').textContent = error.message; $('error').hidden = false; }
async function call(action, data) {
  const res = await fetch('/api/auth/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json().catch(() => null);
  if (!res.ok) throw Error(result?.error || 'Kunde inte logga in');
  return result;
}
function render() {
  const authenticated = state.authenticated, account = location.pathname === '/account';
  if (!authenticated && state.setup?.allowed) view = 'setup';
  $('login').hidden = authenticated || view !== 'login'; $('redeem').hidden = authenticated || view !== 'redeem'; $('setup').hidden = authenticated || view !== 'setup';
  $('change').hidden = !authenticated; $('account-actions').hidden = !authenticated; $('back').hidden = !!state.mustChange;
  const heading = authenticated ? (state.mustChange ? 'Välj ditt lösenord' : 'Byt lösenord') : view === 'setup' ? 'Skapa ägaren' : view === 'redeem' ? 'Lös in inbjudningskoden' : 'Logga in';
  $('heading').textContent = heading; document.title = heading + ' · Charlottendal TKL';
  if (authenticated && !state.mustChange) mountAccountNavigation().catch(showError);
  $('intro').textContent = authenticated ? (state.mustChange ? 'Byt det tillfälliga lösenordet innan du fortsätter.' : `Inloggad som ${state.user?.username || ''} (${state.user?.role === 'owner' ? 'ägare' : 'administratör'}). Här byter du lösenord.`)
    : view === 'setup' ? 'Ingen ägare finns än. Ägaren är den som lägger till och tar bort användare; en administratör sköter hela TKL men inte vilka som har tillgång.'
    : view === 'redeem' ? 'Ägaren har gett dig ett användarnamn och en engångskod. Välj ditt lösenord här.'
    : state.mode === 'external' ? 'Inloggning krävs överallt i webbdriften.' : 'Inställningar och Studio kräver inloggning. Operatören behöver inte logga in på den här datorn.';
  if (!authenticated) (view === 'setup' ? $('setup-username') : view === 'redeem' ? $('redeem-username') : $('username')).focus();
  if (authenticated && !account && !state.mustChange) location.replace(next);
}
async function submit(form, action) {
  if (busy) return; busy = true; $('error').hidden = true;
  const button = form.querySelector('button[type=submit]'); button.disabled = true;
  try { await action(); } catch (e) { showError(e); } finally { button.disabled = false; busy = false; }
}
$('to-redeem').onclick = () => { view = 'redeem'; $('error').hidden = true; render(); };
$('to-login').onclick = () => { view = 'login'; $('error').hidden = true; render(); };
$('login').onsubmit = e => { e.preventDefault(); submit($('login'), async () => {
  const password = $('password').value, result = await call('login', { username: $('username').value.trim(), password, next });
  $('password').value = '';
  if (!result.mustChange) { location.replace(result.next || next); return; }
  state = { ...state, authenticated: true, mustChange: true, user: result.user }; render();
  // Retain the just-entered temporary password only in this form until it is changed.
  $('current').value = password; $('current-row').hidden = true; $('new').focus();
}); };
$('redeem').onsubmit = e => { e.preventDefault(); submit($('redeem'), async () => {
  if ($('redeem-new').value !== $('redeem-repeat').value) throw Error('Lösenorden är inte lika');
  const result = await call('redeem', { username: $('redeem-username').value.trim(), code: $('code').value.trim(), password: $('redeem-new').value, next });
  $('redeem').reset(); location.replace(result.next || next);
}); };
$('setup').onsubmit = e => { e.preventDefault(); submit($('setup'), async () => {
  if ($('setup-new').value !== $('setup-repeat').value) throw Error('Lösenorden är inte lika');
  const result = await call('setup', { username: $('setup-username').value.trim(), password: $('setup-new').value, next });
  $('setup').reset(); location.replace(result.next || next);
}); };
$('change').onsubmit = e => { e.preventDefault(); submit($('change'), async () => {
  if ($('new').value !== $('repeat').value) throw Error('De nya lösenorden är inte lika');
  await call('password', { currentPassword: $('current').value, newPassword: $('new').value });
  $('change').reset(); location.replace(state.mustChange ? next : '/');
}); };
$('logout').onclick = async () => { try { await call('logout', {}); location.replace('/login'); } catch (e) { showError(e); } };
try {
  const response = await fetch('/api/auth/session'); if (!response.ok) throw Error('Inloggningen är inte tillgänglig');
  state = await response.json();
  if (state.mode === 'cloudflare') location.replace('/');
  else render();
} catch (e) { showError(e); }
