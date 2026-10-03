import {registerAdminWorkspace,escapeHTML as esc} from './admin-ui.js';
import {buildStationModel,stationKinds,relatedStationObjects,stationLiveValue} from './station-model.js';
const hash='#register/station';
export function createStationWorkspace({root,index,panel,config,openRecord}) {
  const model=buildStationModel({index,panel,config}),objects=new Map(model.objects.map(o=>[o.id,o]));
  let selected=null,lastState=null,online=false,zoom=1,highlight=new Set();
  const workspace=document.createElement('section');workspace.className='station-workspace';
  workspace.innerHTML=`<div class="admin-workspace-heading"><h1 tabindex="-1">Anläggningsöversikt</h1><span class="muted">Granska objekt och samband</span></div>
    <p>Välj ett objekt i spårplanen eller sök i hela underlaget. Källuppgifter och aktiva driftbindningar visas separat.</p>
    <p class="station-connection" role="status"></p>
    <div class="station-controls"><label>Sök objekt<input type="search" data-search placeholder="Växel, block, sensor, modul eller adress"></label><label>Objekttyp<select data-kind><option value="">Alla typer</option>${Object.entries(stationKinds).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="station-check"><input type="checkbox" data-placed checked>På spårplanen</label><button type="button" data-export>Hämta inventering</button></div>
    <fieldset class="station-layers"><legend>Etiketter på spårplanen</legend>${[['turnouts','Växlar',true],['signals','Signaler',true],['blocks','Block',false],['sensors','Sensorer',false],['modules','Modulreferenser',false]].map(([k,v,on])=>`<label><input type="checkbox" data-layer="${k}" ${on?'checked':''}>${v}</label>`).join('')}<label>Zoom <input data-zoom type="range" min="10" max="200" step="5" value="100"><output data-scale>100 %</output></label><button type="button" data-fit>Visa hela</button></fieldset>
    <div class="station-layout"><div class="station-map-area"><div class="station-map" tabindex="0" aria-label="Spårplan för granskning. Rulla åt båda håll eller dra i en tom yta."><svg class="station-plan" aria-label="Anläggningens objekt"></svg></div><p class="muted station-map-help">Klick visar detaljer. Dra i tom yta eller rulla åt båda håll. Omarkerade linjer visar spårgeometrin, inte en lagd tågväg.</p><p data-count class="muted"></p><div class="station-results" aria-label="Sökresultat"></div></div><aside class="station-detail" aria-label="Valt objekt"><p>Välj ett objekt för att se adresser, källuppgifter och samband.</p></aside></div>`;
  root.append(workspace);registerAdminWorkspace(hash,workspace);
  const $=s=>workspace.querySelector(s),map=$('.station-map'),plan=$('.station-plan'),detail=$('.station-detail'),nodes=[];
  const svg=(tag,attrs,parent,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;parent.append(n);return n;};
  plan.setAttribute('viewBox',`0 100 ${model.width} ${model.height-100}`);
  for(const s of model.segments)svg('line',{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,class:'station-rail'},plan);
  for(const t of Object.values(panel.turnouts))for(const [x,y]of [[t.ax,t.ay],[t.bx,t.by],[t.ccx,t.ccy]])svg('line',{x1:t.cx,y1:t.cy,x2:x,y2:y,class:'station-rail'},plan);
  const overlays=svg('g',{},plan);
  for(const kind of ['blocks','turnouts','signals','sensors','modules'])for(const o of model.objects.filter(o=>o.kind===kind&&o.geometry.length)){
    if(kind==='modules')continue; // References accompany their actual source object; no invented module location.
    const g=svg('g',{'data-object':o.id,class:'station-object','role':'button','tabindex':'0','aria-label':o.name+' · '+stationKinds[kind]},plan);svg('title',{},g,o.name);
    if(kind==='blocks')for(const p of o.geometry.filter(p=>p.type==='line'))svg('line',{...p,type:undefined,class:'station-hit'},g).removeAttribute('type');
    const points=kind==='sensors'?o.geometry.filter(p=>p.type==='line').slice(0,1):o.geometry;
    for(const p of points){const x=p.type==='point'?p.x:(p.x1+p.x2)/2,y=p.type==='point'?p.y:(p.y1+p.y2)/2;
      if(kind!=='blocks')svg(kind==='sensors'?'rect':'circle',kind==='sensors'?{x:x-4,y:y-4,width:8,height:8,class:'station-symbol'}:{cx:x,cy:y,r:kind==='signals'?5:4,class:'station-symbol'},g);
      svg('text',{x:x+7,y:y+(kind==='blocks'?16:kind==='sensors'?29:-9),class:'station-label'},g,o.name);
      if(o.moduleReference)svg('text',{x:x+7,y:y+18,class:'station-module-label'},g,`${o.moduleReference.name} · ${o.moduleReference.channel}`);
    }
    g.onclick=()=>select(o.id);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(o.id);}};nodes.push({o,g});
  }
  function layers(){const enabled=new Set([...workspace.querySelectorAll('[data-layer]:checked')].map(n=>n.dataset.layer));for(const {o,g}of nodes){g.querySelectorAll('.station-label').forEach(n=>n.style.display=enabled.has(o.kind)?'':'none');g.querySelectorAll('.station-module-label').forEach(n=>n.style.display=enabled.has('modules')?'':'none');g.style.display=o.kind==='sensors'&&!enabled.has('sensors')?'none':'';}}
  function resize(value){zoom=value;plan.style.width=Math.round(model.width*zoom)+'px';plan.style.height=Math.round((model.height-100)*zoom)+'px';$('[data-zoom]').value=Math.round(zoom*100);$('[data-scale]').textContent=Math.round(zoom*100)+' %';}
  function fit(){resize(Math.max(.1,Math.min(2,(map.clientWidth-4)/model.width)));map.scrollTo(0,0);}
  let drag;map.onpointerdown=e=>{if(e.button!==0||e.target.closest('[data-object]'))return;drag={x:e.clientX,y:e.clientY,left:map.scrollLeft,top:map.scrollTop};map.setPointerCapture(e.pointerId);};map.onpointermove=e=>{if(drag){map.scrollLeft=drag.left+drag.x-e.clientX;map.scrollTop=drag.top+drag.y-e.clientY;}};map.onpointerup=map.onpointercancel=()=>{drag=null;};
  function list(){const q=$('[data-search]').value.trim().toLocaleLowerCase('sv'),kind=$('[data-kind]').value,placed=$('[data-placed]').checked;
    const found=model.objects.filter(o=>(!kind||o.kind===kind)&&(!placed||o.geometry.length)&&(!q||[o.name,...o.sources.map(s=>s.system+' '+s.comment),...o.bindings.map(b=>b.address+' '+(b.reportAddress||''))].join(' ').toLocaleLowerCase('sv').includes(q))).sort((a,b)=>a.name.localeCompare(b.name,'sv',{numeric:true}));
    $('[data-count]').textContent=`${found.length} objekt · ${model.objects.length} totalt. ${found.length>100?'Första 100 visas; begränsa sökningen.':''}`;
    $('.station-results').innerHTML=found.slice(0,100).map(o=>`<button type="button" data-result="${esc(o.id)}" aria-pressed="${selected===o.id}"><strong>${esc(o.name)}</strong><span>${esc(stationKinds[o.kind])}${!o.geometry.length?' · utan position':''}</span></button>`).join('')||'<p>Inga objekt matchar sökningen.</p>';
  }
  function field(label,value){return `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`;}
  function select(id,{center=false}={}){const o=objects.get(id);if(!o)return;selected=id;highlight=relatedStationObjects(model,id);
    overlays.replaceChildren();for(const related of highlight){const x=objects.get(related);for(const p of x.geometry){if(p.type==='line')svg('line',{x1:p.x1,y1:p.y1,x2:p.x2,y2:p.y2,class:'station-related-rail'},overlays);else svg('circle',{cx:p.x,cy:p.y,r:10,class:'station-related-point'},overlays);}}
    for(const {o:x,g}of nodes)g.classList.toggle('station-selected',x.id===id);
    detail.innerHTML=`<h2>${esc(o.name)}</h2><p class="muted">${esc(stationKinds[o.kind])}${o.geometry.length?'':' · utan position i spårplanen'}</p><p data-live></p><dl class="station-facts">${field('Fysisk verifiering','Ej verifierad')}${o.bindings.length?field('Bindning',o.bindingEvidence||'Aktiv detektorbindning · ej fysiskt verifierad'):''}${o.moduleReference?field('Modulreferens i XML',`${o.moduleReference.name} · basreferens ${o.moduleReference.base} · anslutning ${o.moduleReference.channel}`):''}</dl>
      ${o.rule?`<h3>Knappgrupp från källan</h3><p>${esc(o.rule.status==='ready'?'Befintlig manöverregel finns.':'Samverkan behöver beskrivas och verifieras.')}</p><p class="muted">Gruppnamnet är inte en lägestabell. Gemensamma rörelsemönster har inte skapats automatiskt.</p>`:''}
      ${o.bindings.length?`<h3>Aktiv driftbindning</h3><dl class="station-facts">${[...new Set(o.bindings.map(b=>JSON.stringify({address:b.address,reportAddress:b.reportAddress,inverted:b.inverted,activeMeansOccupied:b.activeMeansOccupied})))].map(s=>{const b=JSON.parse(s);return field('LocoNet-adress',b.address)+(b.reportAddress?field('Återrapportadress',b.reportAddress):'')+(b.inverted!==undefined?field('Omvänd riktning',b.inverted?'Ja':'Nej'):'')+(b.activeMeansOccupied!==undefined?field('Aktiv sensor betyder',b.activeMeansOccupied?'Belagt':'Fritt'):'');}).join('')}</dl>`:''}
      <h3>Samband</h3><div class="station-relations">${model.edges.filter(e=>e.from===id||e.to===id).map(e=>{const other=objects.get(e.from===id?e.to:e.from);return `<button type="button" data-result="${esc(other.id)}">${esc(other.name)}<small>${esc(e.label)}</small></button>`;}).join('')||'<p class="muted">Inga kartlagda samband.</p>'}</div>
      <h3>Källuppgifter</h3>${o.sources.map(s=>`<p><button type="button" data-source="${esc(s.key)}">${esc(s.system||o.name)} →</button>${s.comment?`<small>${esc(s.comment)}</small>`:''}</p>`).join('')||'<p>Ingen direkt källpost.</p>'}<a href="#advanced/protocol">Visa protokoll och inspelningar →</a>`;
    list();live();if(center&&o.geometry.length){const p=o.geometry[0],x=p.type==='point'?p.x:(p.x1+p.x2)/2,y=p.type==='point'?p.y:(p.y1+p.y2)/2;map.scrollTo({left:x*zoom-map.clientWidth/2,top:(y-100)*zoom-map.clientHeight/2,behavior:'smooth'});}
  }
  function live(){if(workspace.hidden)return;$('.station-connection').textContent=lastState?.connectionInfo?.label||'Anslutningens typ är inte angiven';for(const {o,g}of nodes)g.dataset.state=stationLiveValue(o,lastState,online,config.staleMs).tone;
    if(selected){const o=objects.get(selected),value=stationLiveValue(o,lastState,online,config.staleMs),node=$('[data-live]');node.textContent=['groups','modules'].includes(o.kind)?'Källreferens · ingen egen lägesrapport':value.text+(value.at?' · '+new Date(value.at).toLocaleTimeString('sv-SE'):'');}}
  $('.station-results').onclick=detail.onclick=e=>{const id=e.target.closest('[data-result]')?.dataset.result,key=e.target.closest('[data-source]')?.dataset.source;if(id)select(id,{center:true});if(key)openRecord(key);};
  for(const n of workspace.querySelectorAll('[data-layer]'))n.onchange=layers;
  $('[data-search]').oninput=list;$('[data-kind]').onchange=list;$('[data-placed]').onchange=list;$('[data-zoom]').oninput=e=>resize(Number(e.target.value)/100);$('[data-fit]').onclick=fit;
  $('[data-export]').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='charlottendal-anlaggningsinventering.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function sync(){if(location.hash.split('?')[0]!==hash)return;const id=new URLSearchParams(location.hash.split('?')[1]||'').get('object');if(id&&objects.has(id))select(id,{center:true});requestAnimationFrame(()=>{if(!plan.style.width)fit();live();});}
  window.addEventListener('hashchange',sync);layers();list();sync();return {update(state,connected){lastState=state;online=connected;live();}};
}
