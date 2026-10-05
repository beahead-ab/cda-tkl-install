// Inställningar → Uppdatering: the installed version, the latest one and, on a Mac or
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
  // Label · value · consequence, as in the other sections of Inställningar.
  const rows=list=>`<dl class="settings-rows">${list.map(([label,value,note])=>`<div><dt>${esc(label)}</dt><dd>${value}</dd><dd class="settings-consequence">${esc(note)}</dd></div>`).join('')}</dl>`;
  const pill=(mode,text)=>`<span class="settings-state" data-state="${mode}">${esc(text)}</span>`;
  // Vad är nytt: each release's headings, from public/releases.json, which every
  // release adds to; a newer release's headings come from the update check.
  let notes=null,args=null,expanded=false;
  fetch('/releases.json',{cache:'no-cache'}).then(r=>r.ok?r.json():[]).catch(()=>[]).then(list=>{notes=Array.isArray(list)?list:[];if(args)page.update(...args);});
  root.addEventListener('click',e=>{if(e.target.closest('[data-more-releases]')){expanded=!expanded;page.update(...args);}});
  const block=(entry,tag)=>`<article class="release"><div class="release-head"><span class="release-version">${esc(entry.version)}</span>${tag?`<span class="settings-state" data-state="${tag==='Kommer med uppdateringen'?'warn':'ok'}">${esc(tag)}</span>`:''}<span class="muted">${esc(entry.date||'')}</span></div><ul>${(entry.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul></article>`;
  const whatsNew=(current,coming)=>{
    const installed=notes||[];if(!installed.length&&!coming.length)return '';
    const shown=expanded?installed:installed.slice(0,10);
    return `<section class="card releases"><h2>Vad är nytt</h2><p class="settings-scope">Vad varje version gjorde · på rubriknivå</p>${coming.map(e=>block(e,'Kommer med uppdateringen')).join('')}${shown.map(e=>block(e,e.version===current?'Installerad':'')).join('')}${installed.length>10?`<button type="button" data-more-releases>${expanded?'Visa färre':`Visa äldre versioner (${installed.length-10})`}</button>`:''}</section>`;
  };
  const page={update(update,release){
    args=[update,release];view=update;
    let html;
    if(!update){
      html=`<section class="card"><h2>Webbdriften</h2>${rows([['Installerad',esc(release||'okänd'),'Den här TKL är webbdriften.'],['Uppdateras','genom publicering','Från utvecklingsdatorn, inte härifrån.']])}</section>`;
    }else{
      const where=KIND_TEXT[update.kind]||update.kind;
      const state=update.available?[pill('warn','Ny version finns'),`${update.latest} kan installeras. Inget ändras förrän du uppdaterar.`]
        :update.latest?[pill('ok','Senaste versionen'),'Inget att göra.']
        :[pill('off','Okänt'),update.error||'Senaste versionen har inte kunnat läsas än. Uppdateringen fungerar ändå.'];
      const how=update.canStart
        ?(update.available?'<div class="settings-actions"><button type="button" class="primary" data-start-update>Uppdatera nu</button><p>Pi:n hämtar, installerar och startar om TKL själv. Panelen är borta en kort stund.</p></div>':'<p class="muted">Pi:n uppdaterar sig själv härifrån när en ny version finns.</p>')
        :line(update.kind);
      html=`<section class="card"><h2>Den här installationen</h2>${rows([['Status',state[0],state[1]],['Installerad',esc(update.current),'Den här datorn: '+where+'.'],['Senaste',esc(update.latest||'–'),'Läses från installationsförrådet på GitHub.']])}${how}</section>`
        +`<details class="card"><summary>Raden för andra datorer</summary>${['mac','windows'].filter(k=>k!==update.kind).map(line).join('')}<p>Raspberry Pi: <code>curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sudo sh</code></p></details>`
        +'<p class="settings-footnote">Inställningar och driftdata ligger kvar vid uppdateringen, och om den nya versionen inte startar återställs den gamla. Raden går att köra även när ingen ny version visas; då installeras samma version igen.</p>';
    }
    html+=whatsNew(update?.current||release,update?.available?(update.newReleases||[]):[]);
    if(html!==last){last=html;root.innerHTML=html;}
  }};
  return page;
}
