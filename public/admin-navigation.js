// One administration window; the panel ellipsis opens the full workspace directly.
// The rail holds six entries. Sub-pages are a tab row above the page, the footer
// stays fixed while only the list scrolls, and phones get the rail as a drawer.
import {NAVIGATION_SECTIONS,resolveNavigation} from './admin-navigation-model.js';
export function createAdminNavigation({account=false}={}) {
  const sidebar=document.getElementById('admin-sidebar'),button=document.getElementById('admin-nav-toggle'),panelButton=document.getElementById('menu-toggle');
  const prefix=account?'/':'';
  // Programmatic return/initial focus must not leave a mouse-operated control lit.
  document.addEventListener('pointerdown',()=>document.body.removeAttribute('data-nav-keyboard'),true);
  document.addEventListener('keydown',e=>{if(e.key==='Tab')document.body.setAttribute('data-nav-keyboard','');},true);
  const popup=document.getElementById('app-menu')||document.createElement('div');popup.id='app-menu';popup.className='shared-menu';popup.hidden=false;
  const fieldLink='<a id="field-link" hidden target="_blank" rel="noopener">Anläggningssimulator ↗</a>';
  popup.innerHTML=`<div class="admin-nav-items"></div><div class="admin-nav-footer"><button id="toggle-fullscreen" type="button" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true"><path class="fullscreen-expand" d="M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4"/><path class="fullscreen-contract" d="M3 7h4V3m6 0v4h4M7 17v-4H3m10 4v-4h4"/></svg><span>Fullskärm</span></button>${account?fieldLink:''}<a id="account-link" href="/account" hidden>Byt lösenord</a><div id="admin-nav-status"></div><span id="panel-connection" hidden></span></div>`;
  sidebar.replaceChildren(popup);
  const items=popup.querySelector('.admin-nav-items');
  for(const section of NAVIGATION_SECTIONS){
    const group=document.createElement('div');group.className='admin-nav-group';group.dataset.section=section.hash;
    const link=document.createElement('a');link.href=prefix+section.hash;link.textContent=section.label;link.id=section.id;link.dataset.navHash=section.hash;
    group.append(link);items.append(group);
  }
  // Tab rows are mounted once for every section, so status spans keep their text between page changes.
  const tabs=document.createElement('nav');tabs.className='admin-tabs';tabs.setAttribute('aria-label','Undersidor');tabs.hidden=true;
  const rows=new Map();
  if(!account)for(const section of NAVIGATION_SECTIONS){
    if(!section.tabs.length)continue;
    const row=document.createElement('div');row.className='admin-tab-row';row.hidden=true;row.dataset.section=section.hash;
    for(const tab of section.tabs){
      const a=document.createElement('a');a.textContent=tab.label;
      if(tab.external){a.id=tab.external;a.hidden=true;a.target='_blank';a.rel='noopener';}
      else{a.href=prefix+tab.hash;a.dataset.navHash=tab.hash;if(tab.id)a.id=tab.id;}
      if(tab.status){const status=document.createElement('span');status.id=tab.status;a.append(status);}
      row.append(a);
    }
    rows.set(section.hash,row);tabs.append(row);
  }
  const connection=document.getElementById('connection');if(connection){connection.hidden=false;popup.querySelector('#admin-nav-status').append(connection);}
  const shell=document.createElement('section');shell.id='admin-shell';shell.hidden=true;shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Administration');
  const bar=document.createElement('div');bar.className='admin-shell-bar';
  if(button){button.hidden=false;button.setAttribute('aria-expanded','false');bar.append(button);}
  const barTitle=document.createElement('span');barTitle.className='admin-shell-bar-title';barTitle.textContent='CHARLOTTENDAL';bar.append(barTitle);
  const rail=document.createElement('aside');rail.className='admin-shell-rail';
  const header=document.querySelector('.app-header');if(header)rail.append(header);rail.append(sidebar);
  const drawerShade=document.createElement('div');drawerShade.className='admin-shell-drawer-shade';
  const content=document.createElement('div');content.id='admin-shell-content';content.append(tabs);
  for(const node of document.querySelectorAll('body>main:not(#panel-view),body>footer'))content.append(node);
  const exit=document.createElement('a');exit.id='admin-shell-close';exit.href=prefix+'#panel';exit.setAttribute('aria-label','Stäng administration');exit.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>';
  shell.append(bar,rail,drawerShade,content,exit);document.body.append(shell);document.body.classList.add('admin-shell-app');
  const shade=document.createElement('div');shade.id='admin-shell-shade';shade.hidden=true;document.body.append(shade);
  const panel=document.getElementById('panel-view');let lastAdmin='#tools/operations',wasOpen=false;
  // Phone drawer: below 540 px the rail is hidden until the three-dot button opens it.
  let drawerOpen=false;const phone=window.matchMedia?.('(max-width:539px)');
  function setDrawer(open){
    drawerOpen=open;document.body.toggleAttribute('data-admin-nav-open',open);
    button?.setAttribute('aria-expanded',String(open));
    if(open)queueMicrotask(()=>(sidebar.querySelector('a[aria-current=page]')||sidebar.querySelector('a'))?.focus({preventScroll:true}));
  }
  if(button)button.onclick=()=>{setDrawer(!drawerOpen);if(!drawerOpen)button.focus({preventScroll:true});};
  drawerShade.onclick=()=>{setDrawer(false);button?.focus({preventScroll:true});};
  sidebar.addEventListener('click',e=>{if(drawerOpen&&e.target.closest('a,button'))setDrawer(false);});
  phone?.addEventListener?.('change',()=>{if(!phone.matches&&drawerOpen)setDrawer(false);});
  function close(){return false;} // Legacy calls only closed the old small menu.
  function open(){location.hash=lastAdmin;}
  if(panelButton){panelButton.setAttribute('aria-controls','admin-shell');panelButton.setAttribute('aria-haspopup','dialog');panelButton.setAttribute('aria-label','Öppna administration');panelButton.onclick=open;}
  document.addEventListener('keydown',e=>{
    if(shell.hidden||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(drawerOpen&&phone?.matches){setDrawer(false);button?.focus({preventScroll:true});return;}exit.click();return;}
    if(e.key==='Tab'){
      const focusable=[...shell.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  },true);
  function sync(){
    const current=account?'account':location.hash.split('?')[0]||'#panel';
    const opened=current!=='#panel';shell.hidden=!opened;shade.hidden=!opened;if(panel)panel.inert=opened;
    document.body.toggleAttribute('data-admin-window',opened);if(panelButton)panelButton.setAttribute('aria-expanded',String(opened));
    if(opened&&!account)lastAdmin=location.hash;
    if(opened&&!wasOpen)queueMicrotask(()=>exit.focus({preventScroll:true}));
    if(!opened&&wasOpen)panelButton?.focus({preventScroll:true});wasOpen=opened;
    if(!opened&&drawerOpen)setDrawer(false);
    const resolved=account?{section:null}:resolveNavigation(current);
    for(const group of sidebar.querySelectorAll('.admin-nav-group'))group.classList.toggle('active-group',resolved.section?.hash===group.dataset.section);
    for(const [hash,row] of rows)row.hidden=resolved.section?.hash!==hash;
    tabs.hidden=!resolved.section||!rows.has(resolved.section.hash);
    for(const a of shell.querySelectorAll('[data-nav-hash]')){if(a.dataset.navHash===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    if(account)popup.querySelector('#account-link').setAttribute('aria-current','page');
  }
  function title(){return account?'Byt lösenord':resolveNavigation(location.hash).title;}
  function setAccount(enabled){popup.querySelector('#account-link').hidden=!enabled;}
  setAccount(account);sync();return {sync,title,setAccount,close};
}
