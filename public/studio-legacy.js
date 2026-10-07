// Anläggningens sidor som tidigare låg under Inställningar → Anläggning, nu i Studio (0.71.0): Visning, Orter och telefon,
// Driftbindningar, Källa (registret och XML:en) och Införandestatus. Samma moduler som förut, monterade i inbäddat läge
// (admin-ui.js): arbetsytan visas på plats och ingen adress ändras. Varje modul skapas en gång och flyttas in i vyn när den
// visas, så att ett utkast eller ett valt objekt ligger kvar mellan flikarna. Kärnans läge läses med jämna mellanrum medan en
// sådan vy är öppen, för aktiveringsvillkoren (AIS, lås, anslutning).
import {embedAdminWorkspaces} from './admin-ui.js';
import {createConfiguration} from './configuration.js';
import {createDestinations} from './destinations.js';
import {createBindingConfiguration} from './binding-configuration.js';
import {createSourceRegister} from './source-register.js';
import {esc} from './studio-ui.js';
import {LEGACY_VIEWS} from './studio-legacy-views.js';
export {isLegacyView} from './studio-legacy-views.js';
embedAdminWorkspaces();
const get=u=>fetch(u).then(r=>{if([401,428].includes(r.status)){location.assign('/login?next='+encodeURIComponent(location.pathname+location.hash));throw Error('Inloggning krävs.');}if(!r.ok)throw Error(u+': '+r.status);return r.json();});
// Översiktskorten med "Öppna …" och modulernas egna rubriker behövs inte när sidan redan är öppen i Studio.
function embed(root){for(const child of [...root.children])if(!child.classList.contains('admin-workspace'))child.remove();root.querySelectorAll('.admin-workspace-heading').forEach(n=>n.remove());return root;}
export function createLegacyHost(){
  const parts={},updaters=[];let config=null,panel=null,register=null,registerRoot=null,timer=null,lastState=null,online=false;
  const configOnce=()=>config?Promise.resolve(config):get('/api/config').then(c=>config=c);
  const panelOnce=()=>panel?Promise.resolve(panel):get('/data/panel.json').then(p=>panel=p);
  async function poll(){try{lastState=await get('/api/state');online=true;}catch{online=false;}for(const u of updaters)try{u(lastState,online);}catch{}}
  function start(){if(!timer){poll();timer=setInterval(poll,2500);}}
  function stop(){clearInterval(timer);timer=null;}
  // Modulerna söker sina element med document.getElementById: behållaren sitter i sidan innan modulen skapas.
  async function part(key,slot){
    if(parts[key]){slot.replaceChildren(parts[key]);return parts[key];}
    const root=document.createElement('div');root.className='st-legacy';slot.replaceChildren(root);
    if(key==='konfigurera/visning'){const c=createConfiguration({root,config:await configOnce(),onActive:()=>{}});updaters.push((s,o)=>c.updateState(s,o));}
    else if(key==='konfigurera/orter'){const d=createDestinations(root);updaters.push((s,o)=>d.update(s,o));}
    else if(key==='driftsattning/bindningar'){const b=createBindingConfiguration({root});updaters.push((s,o)=>b.updateState(s,o));}
    embed(root);parts[key]=root;return root;
  }
  // Registret skriver i tre behållare med fasta id: posterna, XML-översikten och införandestatusen. Källa visar de två första,
  // Införandestatus den tredje; ett klick på en regelgrupp där öppnar posten under Källa.
  async function source(slot){
    if(register){slot.replaceChildren(registerRoot);return register;}
    registerRoot=document.createElement('div');registerRoot.className='st-legacy';
    registerRoot.innerHTML='<div id="advanced-xml-content" data-legacy="xml"></div><div id="admin-view" data-legacy="register"></div><div id="advanced-migration-content" data-legacy="migration"></div>';
    slot.replaceChildren(registerRoot);
    const [c,p]=await Promise.all([configOnce(),panelOnce()]);
    register=createSourceRegister({config:c,panel:p,editors:false,onActive:()=>{},saveNote:async(key,note)=>{try{const r=await fetch('/api/note',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,note})});return r.ok;}catch{return false;}}});
    updaters.push((s,o)=>register.updateState(s,o));
    registerRoot.addEventListener('click',e=>{if(e.target.closest('#migration-groups [data-group]'))setTimeout(()=>{location.hash='#data/kalla';},0);});
    return register;
  }
  async function render(main,tab,view){
    const key=tab+'/'+view,info=LEGACY_VIEWS[key];
    main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">${esc(info.eyebrow)}</div><h1>${esc(info.title)}</h1><p>${esc(info.text)}</p></div></div><div class="st-legacy-slot"><p class="st-loading">Läser…</p></div>`;
    const slot=main.querySelector('.st-legacy-slot');start();
    try{
      if(key==='data/kalla'||key==='genomgang/inforande'){
        await source(slot);await register.open();
        registerRoot.querySelector('#admin-view .toolbar')?.remove();registerRoot.querySelector('#admin-view a[href="#register/station"]')?.closest('section')?.remove();
        for(const n of registerRoot.querySelectorAll('[data-legacy]'))n.hidden=key==='data/kalla'?n.dataset.legacy==='migration':n.dataset.legacy!=='migration';
        const params=new URLSearchParams(location.hash.split('?')[1]||'');
        if(key==='data/kalla'&&params.get('post'))await register.openKey(params.get('post'));
        else if(key==='data/kalla'&&params.get('kategori'))await register.open(params.get('kategori'),params.get('namn')||undefined);
      } else await part(key,slot);
      poll();
    }catch(e){slot.innerHTML=`<p class="st-error">${esc(e.message)}</p>`;}
  }
  return {render,stop};
}
