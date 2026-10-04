// Avancerat → Uppdatering: the installed version, the latest one and, on a Mac or
// PC, the one line to run, always at hand with a copy button. A Raspberry Pi
// starts the update itself; the web deployment is updated by publishing.
import {UPDATE_LINES,openUpdateNotice} from './update-notice.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KIND_TEXT={'raspberry-pi':'Raspberry Pi',mac:'Mac',windows:'Windows'};
export function createUpdatePage({root,api,message}){
  if(!root)return null;
  let last='',view=null;
  root.addEventListener('click',async e=>{
    const copy=e.target.closest('[data-copy-line]');
    if(copy){try{await navigator.clipboard.writeText(copy.dataset.copyLine);copy.textContent='Kopierad';}catch{copy.textContent='Markera raden och kopiera';}setTimeout(()=>{copy.textContent='Kopiera raden';},2500);return;}
    if(e.target.closest('[data-start-update]'))openUpdateNotice(view,{api,message});
  });
  const line=(kind)=>{const how=UPDATE_LINES[kind];return `<p>Öppna ${esc(how.where)} på ${kind==='mac'?'Macen':'datorn'} och kör:</p><pre class="update-line"><code>${esc(how.line)}</code></pre><button type="button" data-copy-line="${esc(how.line)}">Kopiera raden</button>`;};
  return {update(update,release){
    view=update;
    let html;
    if(!update){
      html=`<section class="card"><h2>Webbdriften</h2><p>Den här TKL är webbdriften${release?' och kör '+esc(release):''}. Den uppdateras genom publicering från utvecklingsdatorn, inte härifrån.</p></section>`;
    }else{
      const status=update.available?`<p><strong>Charlottendal TKL ${esc(update.latest)} finns.</strong> Den här datorn (${esc(KIND_TEXT[update.kind]||update.kind)}) kör ${esc(update.current)}.</p>`
        :update.latest?`<p>Den här datorn (${esc(KIND_TEXT[update.kind]||update.kind)}) kör ${esc(update.current)}, som är senaste versionen.</p>`
        :`<p>Den här datorn (${esc(KIND_TEXT[update.kind]||update.kind)}) kör ${esc(update.current)}. Senaste version har inte kunnat läsas än.</p>`;
      const how=update.canStart
        ?(update.available?'<p>Pi:n hämtar, installerar och startar om TKL själv.</p><button type="button" class="primary" data-start-update>Uppdatera nu</button>':'<p>Pi:n uppdaterar sig själv härifrån när en ny version finns.</p>')
        :line(update.kind);
      html=`<section class="card"><h2>Den här installationen</h2>${status}${update.error?`<p class="muted">${esc(update.error)}</p>`:''}${how}<p class="muted">Inställningar och driftdata ligger kvar vid uppdateringen, och om den nya versionen inte startar återställs den gamla. Raden går att köra även när ingen ny version visas; då installeras samma version igen.</p></section>`
        +`<details class="card"><summary>Raden för andra datorer</summary>${['mac','windows'].filter(k=>k!==update.kind).map(line).join('')}<p>Raspberry Pi: <code>curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sudo sh</code></p></details>`;
    }
    if(html!==last){last=html;root.innerHTML=html;}
  }};
}
