// Studio: Konfigurera (stationsplanen och reglerna med chatten), Data (alla mängder med korsfilter), Genomgång (korten och avvikelserna)
// och Driftsättning (utkast, prov och aktivering). AI:n nås bara via TKL-servern; ingenting aktiveras härifrån utan utkast.
import {buildStudioModel,SETS,TABS,relationsFor,rowsFor,columnsFor,cellsFor,walkOrder,parseHash,planGeometry,setOf,SHAPE_LABEL,CARD_TYPES,CARD_LABEL,TYPE_CLASS} from './studio-model.js';
import {createPlan} from './studio-plan.js';
import {esc,$,mono,pill,kv,card,measuredPill} from './studio-ui.js';
import * as drift from './studio-drift.js';
import {createHelp} from './studio-help.js';
import {createLegacyHost,isLegacyView} from './studio-legacy.js';
import {studioTarget} from './admin-navigation-model.js';
const legacy=createLegacyHost();
// Simulatorns egen sida (banan i simuleringsläge) för felsökning: klicka i block, lägg in fel. Bara härifrån (0.75.0).
let fieldUrl='';
const NAV=()=>({
  konfigurera:[['Stationsplan','#konfigurera'],['Signaler','#data?set=signaler','66'],['Växlar','#data?set=vaxlar','49'],['Spårledningar','#data?set=sparledningar','197'],['Regler och chatten','#konfigurera/regler',String(model.rules.filter(r=>r.status!=='proposal').length)],['Visning','#konfigurera/visning'],['Orter och telefon','#konfigurera/orter'],['Övriga delar','#konfigurera/ovriga'],['Prova i simulatorn','#driftsattning/andringar']],
  data:[['Alla mängder','#data'],['Tågvägar','#data?set=tagvagar','340'],['Källa (XML)','#data/kalla']],
  genomgang:[['Genomgång och avvikelser','#genomgang',model.review?.last?String(model.review.last.cards.length)+' kort':''],['Införandestatus','#genomgang/inforande']],
  driftsattning:[['Ändringar och aktivering','#driftsattning/andringar'],['Driftbindningar','#driftsattning/bindningar'],['Mät objekt','#driftsattning/mat',measuredLabel()],['Lyssna','#driftsattning/lyssna'],['Kort och MGP','#driftsattning/kort',model.cards?.cards.length?String(model.cards.cards.length)+' kort':''],...(fieldUrl?[['Simulatorn ↗',fieldUrl]]:[])],
  anslutning:[['TrainMeet','/#trainmeet','i dag'],['Stream Deck','/#tools/streamdeck','i dag']]});
const measuredLabel=()=>{const c=model.counts.measured,t=model.counts.turnouts+model.counts.signals+model.counts.blocks;return c.field?`${c.field}/${t}`:c.bench?`${c.bench} bänk`:'0/'+t;};
const state={tab:'konfigurera',view:'',sets:new Set(['vaxlar','signaler','sparledningar','tagvagar']),object:null,layers:new Set(['numbers','signalNames','labels','dev']),width:null,panel:true,search:{}};
let model,geo,plan,order;
const session={load(){try{return JSON.parse(sessionStorage.getItem('studio-state')||'{}');}catch{return {};}},save(){try{sessionStorage.setItem('studio-state',JSON.stringify({sets:[...state.sets],object:state.object,layers:[...state.layers],width:state.width,panel:state.panel}));}catch{}}};

async function load(){
  const get=u=>fetch(u).then(r=>{if(!r.ok)throw Error(`${u}: ${r.status}`);return r.json();});
  const [profile,studio,panel]=await Promise.all([get('/api/config'),get('/api/studio'),get('/data/panel.json')]);
  model=buildStudioModel({profile,panel,studio});order=walkOrder(panel);fieldUrl=profile.fieldUrl||'';
  const undetected=new Set([...studio.detection.undetected.noSensor,...studio.detection.undetected.noRule]);
  geo=planGeometry(panel,undetected);
  $('#st-mode').textContent=profile.commissioned?'DRIFT':'SIMULERING · ingen hårdvara';
  {const old=studioTarget(location.hash);if(old)history.replaceState(null,'',old.replace('/studio.html',''));}
  const saved=session.load(),link=parseHash(location.hash);
  state.tab=link.tab;state.view=link.view;if(link.sets.length)state.sets=new Set(link.sets);else if(saved.sets)state.sets=new Set(saved.sets);
  state.object=link.object&&model.objects.has(link.object)?link.object:(saved.object&&model.objects.has(saved.object)?saved.object:null);
  if(link.view==='mat'&&state.object)state.measureObject=state.object;
  drift.init({model:()=>model,state,session,notice:()=>notice,setNotice:v=>{notice=v;},reloadStudio,render});
  if(saved.layers)state.layers=new Set(saved.layers);if(saved.width)state.width=saved.width;if(saved.panel===false)state.panel=false;
  render();
}
function go(tab,view=''){state.tab=tab;state.view=view;history.replaceState(null,'',`#${tab}${view?'/'+view:''}`);render();}
let busy=false,notice='';
async function draftApi(command,payload={}){
  if(busy||!model.drafts)return false;busy=true;notice='';
  try{const r=await fetch('/api/studio/drafts/'+command,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:model.drafts.sessionId,revision:model.drafts.revision,...payload})});
    if([401,428].includes(r.status)){location.assign('/login?next='+encodeURIComponent(location.pathname+location.hash));return false;}
    const answer=await r.json();if(!r.ok)throw Error(answer.error||r.statusText);model.drafts=answer;
    if(command==='activate'){notice='Regelversion '+answer.activeVersion+' är aktiverad. Kärnan har läst om profilen; AIS kvarstår tills nya stoppbesked kommit.';await reloadStudio();}
    return true;}
  catch(e){notice=e.message;if(/annat fönster/.test(e.message))await reloadStudio();return false;}
  finally{busy=false;render();}
}
async function reloadStudio(){try{const studio=await fetch('/api/studio').then(r=>r.json());const profile=await fetch('/api/config').then(r=>r.json());const panel=await fetch('/data/panel.json').then(r=>r.json());model=buildStudioModel({profile,panel,studio});}catch(e){notice=e.message;}}
function select(id,{center=true}={}){if(!model.objects.has(id))return;state.object=id;session.save();if(state.tab==='konfigurera'){plan?.select(id,{center});renderObjectCard();}else render();}
function render(){
  $('#st-tabs').innerHTML=TABS.map(t=>`<a href="#${t.id}"${t.id===state.tab?' aria-current="page"':''}>${t.label}</a>`).join('');
  const here='#'+state.tab+(state.view?'/'+state.view:'')+(state.tab==='data'&&state.sets.size===1?'?set='+[...state.sets][0]:'');
  $('#st-nav').innerHTML=`<span class="st-nav-title">${esc(TABS.find(t=>t.id===state.tab).label.toUpperCase())}</span>`+NAV()[state.tab].map(([label,href,count])=>{
    if(!href)return `<span class="st-nav-item" title="Kommer i ett senare steg">${esc(label)}<span class="st-count">${esc(count||'')}</span></span>`;
    const current=href===here||(href==='#'+state.tab&&!state.view&&!(state.tab==='data'&&state.sets.size===1));
    const external=!href.startsWith('#');
    return `<a href="${href}"${current?' aria-current="page"':''}${external?' target="_blank" rel="noopener" title="Simulatorns egen sida: banan i simuleringsläge, för felsökning (klicka i block, lägg in fel)"':''}>${esc(label)}${count?`<span class="st-count">${esc(count)}</span>`:''}</a>`;}).join('')
    +`<div class="st-nav-foot"><strong>Ett utkast för hela stationen</strong><br>Allt här är läst ur källorna. Ingenting är uppmätt och ingenting ändras härifrån.<br><span class="mono">profil ${esc(model.sourceHash.slice(0,12))}</span></div>`;
  const main=$('#st-main');
  document.body.classList.toggle('st-fill',state.tab==='konfigurera'&&!state.view);
  drift.stopPoll();legacy.stop();
  if(isLegacyView(state.tab,state.view))return void legacy.render(main,state.tab,state.view);
  if(state.tab==='konfigurera'&&state.view==='regler')renderRegler(main);else if(state.tab==='konfigurera'&&state.view==='ovriga')drift.renderOvriga(main);else if(state.tab==='driftsattning'&&state.view==='andringar')renderAndringar(main);
  else if(state.tab==='driftsattning'&&state.view==='mat')drift.renderMat(main);else if(state.tab==='driftsattning'&&state.view==='lyssna')drift.renderLyssna(main);else if(state.tab==='driftsattning'&&state.view==='kort')drift.renderKort(main);
  else if(state.tab==='konfigurera')renderKonfigurera(main);else if(state.tab==='data')renderData(main);else if(state.tab==='genomgang')renderGenomgang(main);else renderLater(main);
}
function stats(){const c=model.counts,d=model.detection;return `<div class="st-stats">
  <div class="st-stat"><small>Växlar</small><b>${c.turnouts}</b><small>Adresser ur JMRI, ej uppmätta</small></div><div class="st-stat"><small>Signaler</small><b>${c.signals}</b><small>Bänkadresser i simulatorn</small></div>
  <div class="st-stat"><small>Spårledningar</small><b>${c.blocks}</b><small>${d.inputs.used} av ${d.inputs.total} ingångar bundna</small></div><div class="st-stat"><small>Tågvägar</small><b>${c.routes}</b><small>210 huvud, 130 växling</small></div>
  <div class="st-stat amber"><small>Avvikelser</small><b>${model.deviations.length}</b><small>${model.blocking} blockerar driftsättning</small></div><div class="st-stat${c.measured.field?'':' amber'}"><small>Uppmätt i fält</small><b>${c.measured.field} av ${c.turnouts+c.signals+c.blocks}</b><small>${c.measured.bench?c.measured.bench+' bänkmätta i simulatorn':'Inga bindningar uppmätta'}</small></div></div>`;}
// ---------- Konfigurera ----------
function renderKonfigurera(main){
  const layers=[['numbers','Växelnummer'],['signalNames','Signalnamn'],['blockLabels','Spårledningar'],['addresses','Adresser'],['modules','MGP-modul'],['dev','Avvikelser']];
  // En verktygsrad: gå igenom, lager, zoom och panelen. Planen tar höjden som blir över (body.st-fill), objektet och avvikelserna ligger till höger.
  main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">KONFIGURERA · STATIONSPLAN</div><h1>Charlottendal</h1></div><p>Hela stationen. Klicka på ett objekt, eller gå igenom från vänster till höger.</p><span class="st-grow"></span>
    <a class="st-btn" href="#genomgang">Avvikelser</a><a class="st-btn st-btn-primary" href="#data">Visa i data</a></div>${stats()}
    <section class="st-card st-card-plan"><div class="st-toolbar"><span id="st-walk" style="display:contents"></span><span class="st-sep"></span><span class="st-eyebrow">LAGER</span>${layers.map(([k,l])=>`<button type="button" class="st-btn st-toggle" data-layer="${k}" aria-pressed="${state.layers.has(k)}">${l}</button>`).join('')}
      <span class="st-grow"></span><button type="button" class="st-btn st-toggle" data-zoom="-" aria-label="Zooma ut">−</button><span class="mono" id="st-zoom"></span><button type="button" class="st-btn st-toggle" data-zoom="+" aria-label="Zooma in">+</button><button type="button" class="st-btn st-toggle" data-zoom="fit" aria-label="Fyll bredden">Bredd</button><button type="button" class="st-btn st-toggle" data-zoom="height" aria-label="Fyll höjden">Höjd</button><button type="button" class="st-btn st-toggle" data-panel aria-pressed="${state.panel}">Panel</button></div>
      <div class="st-plan-wrap"><div id="st-plan-host"></div><aside class="st-side" id="st-side" aria-label="Valt objekt och avvikelser"${state.panel?'':' hidden'}><div id="st-object"></div>${deviationCard()}</aside></div>
      <div class="st-card-foot"><span class="st-legend"><span><i></i>Spår</span><span><i class="dash"></i>Ingen detektering i källan</span><span>Röd punkt: avvikelse</span><span class="st-grow"></span>${pill('Ingen rapport · ingen hårdvara','',false)}</span></div></section>`;
  const info=id=>{const o=model.objects.get(id);if(!o)return {};return {address:o.loconet?.order??o.loconet?.report,module:o.kind==='turnout'?o.source?.module?.name:o.kind==='signal'?o.source[0]?.module?.name:null};};
  plan=createPlan($('#st-plan-host'),geo,{onSelect:id=>select(id,{center:false}),info});
  // Utan sparad zoom visas hela stationen i den höjd fönstret ger.
  if(state.width)plan.setWidth(state.width);else{plan.fitHeight();state.width=plan.width();}plan.setLayers(state.layers);$('#st-zoom').textContent=Math.round(state.width/ (geo.viewBox[2]) * 100)+' %';
  const badTurnouts=model.companions.filter(c=>!c.ok).flatMap(c=>c.pair),undetected=[...model.detection.undetected.noSensor,...model.detection.undetected.noRule];
  plan.markDeviations({blocks:undetected,turnouts:[...badTurnouts,...model.turnouts.filter(t=>!t.inPlan).map(t=>t.id)]});
  main.onclick=e=>{const b=e.target.closest('[data-layer],[data-zoom],[data-walk],[data-select]');if(!b)return;
    if(b.dataset.layer){const k=b.dataset.layer;state.layers.has(k)?state.layers.delete(k):state.layers.add(k);b.setAttribute('aria-pressed',state.layers.has(k));plan.setLayers(state.layers);session.save();}
    if(b.dataset.zoom){if(b.dataset.zoom==='fit')plan.fit();else if(b.dataset.zoom==='height')plan.fitHeight();else plan.setWidth(state.width*(b.dataset.zoom==='+'?1.25:0.8));state.width=plan.width();$('#st-zoom').textContent=Math.round(state.width/geo.viewBox[2]*100)+' %';session.save();}
    if('panel' in b.dataset){state.panel=!state.panel;b.setAttribute('aria-pressed',state.panel);$('#st-side').hidden=!state.panel;session.save();}
    if(b.dataset.walk){const i=order.indexOf(state.object),next=i<0?order[0]:order[i+Number(b.dataset.walk)];if(next)select(next);}
    if(b.dataset.select)select(b.dataset.select);};
  if(state.object&&order.includes(state.object))plan.select(state.object,{center:true});else if(state.object)plan.select(state.object);
  renderObjectCard();
}
function renderWalk(){const i=order.indexOf(state.object);const host=$('#st-walk');if(!host)return;
  host.innerHTML=`<span class="st-eyebrow">GÅ IGENOM</span><button type="button" class="st-btn st-toggle" data-walk="-1"${i<=0?' disabled':''} aria-label="Föregående: ${esc(order[i-1]||'')}">‹ ${esc(order[i-1]||'')}</button><span class="st-walk">${esc(state.object||'–')}${i>=0?` <span style="color:var(--kr-mute);font-weight:600">${i+1}/${order.length}</span>`:''}</span><button type="button" class="st-btn st-toggle" data-walk="1"${i>=order.length-1?' disabled':''} aria-label="Nästa: ${esc(order[i+1]||'')}">${esc(i<0?'Börja vid '+order[0]:order[i+1]+' ›')}</button>`;}
function renderObjectCard(){
  renderWalk();const host=$('#st-object');if(!host)return;const o=model.objects.get(state.object);
  if(!o){host.innerHTML=card('Inget objekt valt','<p class="st-empty">Klicka på en växel, signal eller spårledning i planen.</p>');return;}
  const rel=relationsFor(model,o.id),actions=`<div class="st-toolbar" style="border-top:1px solid var(--kr-line);border-bottom:0"><a class="st-btn" href="#data?objekt=${encodeURIComponent(o.id)}" data-select-data="${esc(o.id)}">Visa i data</a>${['turnout','signal','block'].includes(o.kind)?`<a class="st-btn" href="#driftsattning/mat?objekt=${encodeURIComponent(o.id)}">Mät</a>`:''}${rel.deviations.length?`<a class="st-btn" href="#genomgang">${rel.deviations.length} avvikelse${rel.deviations.length>1?'r':''}</a>`:''}</div>`;
  let title='',body='',right='';
  if(o.kind==='turnout'){
    const comp=model.companions.find(c=>c.pair.includes(o.id)),straight=rel.routes.filter(r=>model.objects.get(r).turnouts[o.id]==='C').length;
    title=`${mono(o.id)} · växel`;right=o.inPlan?measuredPill(o):pill('Utan plats i planen','amber');
    body=kv([['LocoNet-adress',mono(o.loconet.order)+' '+pill('Ur JMRI, ej uppmätt','amber')],['JMRI',o.source?mono(o.source.system)+' · kommentar '+mono(o.source.comment):'–'],
      ['Modul och kanal',o.source?.module?mono(o.source.module.name)+(o.source.module.channel?' kanal '+mono(o.source.module.channel):'')+' '+pill('Hypotes'):'Ingen modulreferens'],['Spårledning',mono(o.block||'–')],
      ['Kompis',o.companions.length?o.companions.map(mono).join(', ')+(comp?' · '+(comp.ok?pill('Hel förbindelse','',true):pill('Ingen förbindelse: '+comp.pair[0]+' → '+comp.aLeadsTo+', '+comp.pair[1]+' → '+comp.bLeadsTo,'red')):''):'Ingen'],
      ['Tågvägar',mono(rel.routes.length)+` · ${straight} rakt, ${rel.routes.length-straight} avvikande`],['Status',esc(o.status)]]);
  } else if(o.kind==='signal'){
    const mods=[...new Set(o.source.map(s=>s.module?.name).filter(Boolean))];
    title=`${mono(o.id)} · signal`;right=measuredPill(o,'Bänkadress');
    body=kv([['Masttyp',mono(o.mastType)+(o.aspects.length?` · ${o.aspects.length} besked`:'')],['Adress',mono(o.loconet.order)+' · stopp '+mono(o.loconet.stopCodes.join(', '))+', kör '+mono(o.loconet.goCodes.join(', '))+' <span style="color:var(--kr-mute)">CZ-prov, ej svenskt</span>'],
      ['Utgångar i Cda60.xml',o.source.length?o.source.map(s=>mono(s.system)+' <span style="color:var(--kr-mute)">'+esc(s.comment)+'</span>').join('<br>'):'Ingen'],['Modul',mods.length>1?mods.map(mono).join(' och ')+' '+pill('Två moduler, oklart','amber'):mods.map(mono).join('')||'–'],
      ['Tågvägar','klareras i '+mono(o.routes.length)+', skyddssignal i '+mono(o.guards.length)],['Svenska beskedskoder',pill('Saknas','amber')]]);
  } else if(o.kind==='block'){
    const s=o.section,undet=s&&(s.shape==='noRule'||s.shape==='noSensor')&&s.track;
    title=`${mono(o.id)} · spårledning`;right=undet?pill('Ingen detektering','red'):measuredPill(o);
    body=kv([['Källsensor i JMRI',o.sourceSensor?mono(o.sourceSensor)+(s?.sharedWith>1?` · delas av ${s.sharedWith} spårledningar`:''):'Ingen'],['Ingångar',s?.inputDetails?.length?s.inputDetails.map(d=>mono(d.system)+(d.module?' <span style="color:var(--kr-mute)">'+esc(d.module)+'</span>':'')).join(', '):'Inga'],
      ['Regelform',s?esc(SHAPE_LABEL[s.shape]||s.shape):'–'],['Bänkadress',mono(o.loconet.report)+' · aktiv betyder '+(o.loconet.activeMeansOccupied?'belagt':'ledigt')],['Tågvägar',mono(rel.routes.length)],['Status',esc(o.status)]]);
  } else {title=mono(o.id);body=`<p class="st-note">${esc(o.title||o.label||'')}</p>`;}
  host.innerHTML=card(title,body+actions,{right});
}
function deviationCard(){
  const rows=model.deviations.slice(0,8).map(d=>`<li><span>${esc(d.title)}</span><span class="st-grow"></span><span class="st-count">${d.count}</span>${d.blocking?pill('Blockerar','red'):''}</li>`).join('');
  return card(`Avvikelser <span class="mono" style="color:var(--kr-red)">${model.deviations.length}</span>`,`<ul class="st-list">${rows}</ul>`,{right:`<a class="st-btn" href="#genomgang">Visa alla</a>`,foot:`Räknas om vid varje läsning. ${model.blocking} blockerar driftsättning.`});
}
// ---------- Regler ----------
function ruleCard(r){
  const st={active:['Gäller',''],unresolved:['Olöst','amber'],proposal:['Förslag · ej uppmätt','amber'],unsupported:['Stöds inte','red']}[r.status]||[r.status,''];
  const objs=r.touches.filter(x=>model.objects.has(x)).slice(0,8).map(x=>`<button type="button" data-select="${esc(x)}" class="mono" style="border:0;background:transparent;color:var(--kr-blue);padding:0;font-weight:700">${esc(x)}</button>`).join(', ');
  const src=[r.source?.jmri,r.source?.button,r.source?.studio&&'Studio '+r.source.studio+(r.source.crossing?' · '+r.source.crossing:'')].filter(Boolean).map(esc).join(' · ');
  return `<div class="st-card" style="border-style:${r.status==='proposal'?'dashed':'solid'}"><div class="st-card-head"><span class="st-eyebrow">${esc(r.typeLabel.toUpperCase())}${r.trigger?' · '+esc({manual:'MANUELL MANÖVER',line:'LINJESPÄRR',programming:'PROGRAMMERINGSSPÅR'}[r.trigger]||r.trigger.toUpperCase()):''}</span><span class="st-grow"></span>${pill('Verkställs i '+r.runsInLabel)}${pill(st[0],st[1],r.status==='proposal')}</div>
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px"><b style="font:700 15px var(--mono)">${esc(r.id.replace(/^(follow|authority|condition):(manual:|line:)?/,''))}</b><span style="font-size:13.5px">${esc(r.explain)}</span>
    <span style="font-size:12.5px;color:var(--kr-ink-2)">Objekt: ${objs||'–'}${r.touches.length>8?` … (${r.touches.length})`:''} · Tågvägar ${mono((r.routes||[]).length)}${src?' · Källa '+src:''}</span>
    ${r.problems?.length?`<span style="font-size:12.5px;color:var(--kr-red)">${r.problems.map(esc).join(' · ')}</span>`:''}${r.replaces?.length?`<span style="font-size:12.5px;color:var(--kr-amber)">Ersätter ${r.replaces.map(x=>esc(x.replace('follow:',''))).join(', ')}</span>`:''}</div></div>`;
}
function renderRegler(main){
  const rules=model.rules.filter(r=>r.status!=='proposal'),props=model.rules.filter(r=>r.status==='proposal'),f=state.ruleType||'alla';
  const types=[['alla','Alla',rules.length],['follow','Följer',rules.filter(r=>r.type==='follow').length],['authority','Manöverrätt',rules.filter(r=>r.type==='authority').length],['condition','Villkor',rules.filter(r=>r.type==='condition').length],['detection','Detektering',rules.filter(r=>r.type==='detection').length],['aspect','Signalbesked',rules.filter(r=>r.type==='aspect').length],['crossing','Vägövergång',rules.filter(r=>r.type==='crossing').length]];
  const shown=rules.filter(r=>f==='alla'||r.type===f);
  const eff=model.ruleEffects;
  const dr=model.drafts,ver=dr?.activeVersion||0,bd=model.baseDiff;
  const statusPill=ver?pill(`Regelversion ${ver} aktiv · ${bd?.fragments??0} kopplingar och ${bd?.routes??0} tågvägar skiljer sig från grundprofilen`,'amber'):model.compiledIdentical?pill('Kompilerar identiskt med grundprofilen','',true):pill('Kompileringen skiljer sig från profilen','red');
  const draftBtn=dr?.draft?`<a class="st-btn st-btn-primary" href="#driftsattning/andringar">Visa utkastet</a>`:props.length?`<button type="button" class="st-btn st-btn-primary" data-draft-from-proposal>Skapa utkast av förslaget</button>`:'';
  main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">KONFIGURERA · REGLER</div><h1>Regler</h1><p>Det som gäller uttryckt i regelspråket, kompilerat till kärnans fragment. Beskriv en ny regel i fritext; inget här ändrar driften förrän ett utkast aktiveras.</p></div><span class="st-grow"></span>${statusPill}${draftBtn}</div>
    ${renderBeskriv()}
    <div class="st-stats">${types.map(([k,l,n])=>`<div class="st-stat"><small>${l}</small><b>${n}</b></div>`).join('')}<div class="st-stat amber"><small>Förslag</small><b>${props.length}</b><small>${eff?eff.routesChanged+' tågvägar ändrar växelläge':''}</small></div><div class="st-stat"><small>Detektering ur XML</small><b>${model.detectionProposals}</b><small><a href="#genomgang">förslag i genomgången</a></small></div></div>
    ${props.length?card('Förslag ur spårgrafen · dubbelkorsväxlarna',`<div style="padding:12px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:12px">${props.map(ruleCard).join('')}</div>`
      +(eff?`<div class="st-note">Med förslaget ändrar ${eff.routesChanged} tågvägar växelläge (${eff.main} huvud, ${eff.shunt} växling). Exempel: ${eff.examples.slice(0,3).map(e=>`<b>${esc(e.label)}</b> ${esc(Object.entries(e.before).map(([k,v])=>k.slice(2)+' '+v).join(' '))} → ${esc(Object.entries(e.after).map(([k,v])=>k.slice(2)+' '+v).join(' '))}`).join('; ')}.</div>`:''),
      {right:pill('Ej uppmätt','amber'),foot:'Förslaget blir ett utkast som provas i simulatorn och aktiveras med skillnadslista i steg 4. Tågvägstabellen är oförändrad tills dess.'}):''}
    <div class="st-chips">${types.map(([k,l,n])=>`<button type="button" class="st-chip-set" data-rule-type="${k}" aria-pressed="${f===k}">${l}<b>${n}</b></button>`).join('')}<span class="st-grow"></span><span class="st-eyebrow">KÄLLA · ${esc(model.ruleSource.toUpperCase())}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px">${shown.map(ruleCard).join('')}</div>`;
  wireChat(main);
  main.onclick=async e=>{const t=e.target.closest('[data-rule-type]');if(t){state.ruleType=t.dataset.ruleType;renderRegler(main);return;}if(e.target.closest('[data-draft-from-proposal]')){if(await draftApi('create',{source:'proposal',note:'Förslag ur spårgrafen: dubbelkorsväxlarna X1 och X2'}))go('driftsattning','andringar');return;}
    if(await chatClick(e))return;const b=e.target.closest('[data-select]');if(b){state.object=b.dataset.select;session.save();location.hash='#konfigurera?objekt='+encodeURIComponent(b.dataset.select);}};
}
// ---------- Ändringar och aktivering ----------
function renderAndringar(main){
  const dr=model.drafts;
  if(!dr){main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">DRIFTSÄTTNING</div><h1>Ändringar och aktivering</h1></div></div><p class="st-error">Servern svarade utan utkastdata.</p>`;return;}
  const d=dr.draft,fmt=t=>t?new Date(t).toLocaleString('sv-SE'):'–';
  const versions=card('Regelversioner',`<ul class="st-list">${dr.versions.map(v=>`<li><span class="mono"><b>${v.id}</b></span><span style="flex-grow:1">${esc(v.reason)}<br><span style="font-size:12px;color:var(--kr-mute)">${v.at?fmt(v.at):'grundprofilen'} · ${v.rules} regler</span></span>${v.id===dr.activeVersion?pill('Aktiv','',true):d?'':`<button type="button" class="st-btn" data-restore="${v.id}">Återställ</button>`}</li>`).join('')}</ul>`,
    {foot:'Återställning skapar ett utkast som provas och aktiveras som alla andra.'});
  const head=`<div class="st-title"><div><div class="st-eyebrow">DRIFTSÄTTNING · ÄNDRINGAR OCH AKTIVERING</div><h1>${d?'Utkast':'Inget utkast'}</h1><p>${d?esc(d.note||'Utan anteckning')+' · skapat '+fmt(d.createdAt)+' på version '+d.baseVersion:'Regelversion '+dr.activeVersion+' är aktiv. Ett utkast skapas från ett förslag under Regler, eller genom återställning av en version.'}</p></div><span class="st-grow"></span>${notice?`<span class="st-pill ${/aktiverad/.test(notice)?'':'st-pill-amber'}">${esc(notice)}</span>`:''}</div>`;
  if(!d){main.innerHTML=head+`<div class="st-two">${versions}${card('Så aktiveras en ändring',`<ol style="margin:0;padding:12px 16px 12px 36px;display:flex;flex-direction:column;gap:8px;font-size:13.5px"><li>Utkastet valideras: objekten finns, lägena är möjliga, ingen växel i två följgrupper.</li><li>Simulatorprovet etablerar varje tågväg som ändras, plus ett urval oförändrade.</li><li>Aktivering kräver AIS, inga lås och färska rapporter, samma villkor som driftbindningarna, och ett skäl.</li><li>Kärnan läser om den kompilerade profilen. Simulatorn får samma koppling vid nästa start.</li></ol>`)}</div>`;bindAndringar(main);return;}
  const tr=d.trial,act=d.activation;
  const changes=card(`Regler som ändras <span class="mono" style="color:var(--kr-mute)">+${d.added.length} −${d.removed.length}</span>`,
    `<div style="padding:12px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px">${d.added.map(r=>`<div class="st-card" style="border-style:dashed"><div class="st-card-head"><span class="st-eyebrow">LÄGGS TILL · ${esc(r.typeLabel.toUpperCase())}</span><span class="st-grow"></span>${pill('Verkställs i '+r.runsInLabel)}</div><div style="padding:10px 14px"><b class="mono">${esc(r.id.replace(/^(follow|authority|condition):(manual:|line:)?/,''))}</b><br><span style="font-size:13px">${esc(r.explain)}</span></div></div>`).join('')}
    ${d.removed.map(r=>`<div class="st-card"><div class="st-card-head"><span class="st-eyebrow" style="color:var(--kr-red)">TAS BORT · ${esc(r.typeLabel.toUpperCase())}</span></div><div style="padding:10px 14px"><b class="mono" style="text-decoration:line-through">${esc(r.id.replace(/^(follow|authority|condition):(manual:|line:)?/,''))}</b><br><span style="font-size:13px;color:var(--kr-ink-2)">${esc(r.explain)}</span></div></div>`).join('')}</div>`);
  const frag=d.changes.fragments,rt=d.changes.routes;
  const diff=card(`Skillnadslista`,kv([['Kopplingar som ändras',frag.filter(f=>f.kind==='coupled').map(f=>`${mono(f.object)}: ${esc(f.before.join('+'))} → ${esc(f.after.join('+'))}`).join('<br>')||'Inga'],
      ['Manöverregler som berörs',frag.filter(f=>f.kind==='manual').map(f=>`${mono(f.object)}: ${esc(f.before)} → ${esc(f.after)}`).join('<br>')||'Inga'],
      ['Övriga fragment',frag.filter(f=>!['coupled','manual'].includes(f.kind)).map(f=>`${esc(f.kind)} ${mono(f.object)}`).join(', ')||'Inga'],
      ['Tågvägar som ändrar växelläge',`${mono(rt.count)} · ${rt.main} huvud, ${rt.shunt} växling`]])
    +(rt.examples.length?`<div class="st-grid-wrap"><table class="st-grid"><thead><tr><th>Tågväg</th><th>Före</th><th>Efter</th></tr></thead><tbody>${rt.examples.map(e=>`<tr><td>${esc(e.label)}</td><td class="mono" style="font-size:12px">${esc(Object.entries(e.before).map(([k,v])=>k.slice(2)+' '+v).join(' '))}</td><td class="mono" style="font-size:12px">${esc(Object.entries(e.after).map(([k,v])=>k.slice(2)+' '+v).join(' '))}</td></tr>`).join('')}</tbody></table></div>`:''),
    {foot:rt.count>rt.examples.length?`Visar ${rt.examples.length} av ${rt.count} ändrade tågvägar. Tabellen räknas om vid aktivering; 340 vägar kvar.`:'Tabellen räknas om vid aktivering.'});
  const probl=d.problems.length?card('Validering',`<ul class="st-list">${d.problems.map(p=>`<li><span class="mono">${esc(p.rule)}</span><span style="color:var(--kr-red)">${esc(p.problem)}</span></li>`).join('')}</ul>`,{right:pill(d.problems.length+' fel','red')}):card('Validering',`<p class="st-note">Alla objekt finns, lägena är möjliga och ingen växel följer två grupper.</p>`,{right:pill('Inga fel','',true)});
  const trial=card('Simulatorprov',(tr?`<div class="st-note">${tr.ok} av ${tr.total} tågvägar etablerade · ${tr.changed} ändrade och ${tr.sampled} oförändrade provade · ${fmt(tr.at)}</div><div class="st-grid-wrap"><table class="st-grid"><thead><tr><th>Tågväg</th><th>Resultat</th><th>Order till</th><th class="num">ms</th></tr></thead><tbody>${tr.results.slice(0,200).map(r=>`<tr><td>${esc(r.label)}</td><td>${r.result==='etablerad'?pill('Etablerad','',true):pill(esc(r.result)+(r.reason?' · '+esc(r.reason):''),'red')}</td><td class="mono" style="font-size:12px">${esc(r.ordered.map(x=>x.slice(2)).join(' '))}</td><td class="num">${r.ms}</td></tr>`).join('')}</tbody></table></div>`:'<p class="st-empty">Inte provat. Provet kör kärnan och den oberoende fältmodellen i samma process, en tågväg i taget.</p>')
    +`<div class="st-toolbar" style="border-top:1px solid var(--kr-line);border-bottom:0">${b44ish('Prova i simulatorn','data-test',busy)}</div>`,{right:tr?(tr.ok===tr.total?pill('Godkänt · beräknat',''):pill(`${tr.total-tr.ok} misslyckade`,'red')):pill('Inte provat','amber')});
  const activate=card('Aktivera',`<div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px"><span>${act.allowed?pill('Villkoren är uppfyllda','',true):pill(esc(act.reason),'amber')}</span>
    <label style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:600;color:var(--kr-ink-2)">Underlag för ändringen<input id="st-reason" type="text" maxlength="500" placeholder="T.ex. Diagonala par bekräftade i ritningen och på banan" style="height:36px;padding:0 10px;border-radius:8px;border:1px solid var(--kr-line-2);background:var(--kr-panel-2);color:var(--kr-ink);font:13px var(--font)"></label>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${b44ish('Aktivera regelversionen','data-activate',busy||!act.allowed,true)}${b44ish('Förkasta utkastet','data-discard',busy)}</div>
    <span style="font-size:12.5px;color:var(--kr-mute)">Samma villkor som driftbindningarna: AIS, inga lås, färska rapporter. Kärnan läser om profilen, alla fältlägen blir okända och AIS kvarstår tills nya stoppbesked kommit. Ingen MGP-modul omprogrammeras.</span></div>`);
  main.innerHTML=head+changes+`<div class="st-two"><div style="display:flex;flex-direction:column;gap:16px">${diff}${trial}</div><div style="display:flex;flex-direction:column;gap:16px">${probl}${activate}${versions}</div></div>`;
  bindAndringar(main);
}
function b44ish(text,attr,disabled=false,primary=false){return `<button type="button" class="st-btn${primary?' st-btn-primary':''}" ${attr}${disabled?' disabled':''}>${esc(text)}</button>`;}
function bindAndringar(main){
  main.onclick=async e=>{
    if(e.target.closest('[data-test]'))return draftApi('test');
    if(e.target.closest('[data-discard]'))return draftApi('discard');
    if(e.target.closest('[data-activate]'))return draftApi('activate',{reason:$('#st-reason')?.value||''});
    const r=e.target.closest('[data-restore]');if(r)return draftApi('restore',{version:Number(r.dataset.restore)});
  };
}
// ---------- Data ----------
function renderData(main){
  const f=state.object&&model.objects.has(state.object)?model.objects.get(state.object):null;
  main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">DATA · ALLA MÄNGDER</div><h1>Data</h1><p>Varje mängd är en projektion av samma last. Ett valt objekt filtrerar allt genom sina relationer.</p></div><span class="st-grow"></span><a class="st-btn" href="#konfigurera">Visa i planen</a></div>
    <div class="st-chips" id="st-chips">${SETS.map(s=>`<button type="button" class="st-chip-set" data-set="${s.id}" aria-pressed="${state.sets.has(s.id)}">${s.label}<b>${rowsFor(model,s.id,f?.id).length}${f?' / '+rowsFor(model,s.id).length:''}</b></button>`).join('')}
    ${f?`<span class="st-filter">Filter: ${esc(f.label||f.id)}<button type="button" data-clear aria-label="Ta bort filtret">×</button></span>`:'<span class="st-eyebrow">INGET FILTER · klicka en rad för att filtrera på objektet</span>'}</div>
    <div class="st-two"><div id="st-grids" style="display:flex;flex-direction:column;gap:16px"></div><div id="st-rel"></div></div>`;
  renderGrids();renderRelations();
  main.onclick=e=>{
    const chip=e.target.closest('[data-set]');if(chip){const s=chip.dataset.set;state.sets.has(s)?state.sets.delete(s):state.sets.add(s);session.save();renderData(main);return;}
    if(e.target.closest('[data-clear]')){state.object=null;session.save();renderData(main);return;}
    const row=e.target.closest('tr[data-id]');if(row){select(row.dataset.id);return;}
    const rel=e.target.closest('[data-rel-set]');if(rel){state.sets.add(rel.dataset.relSet);session.save();renderData(main);}
    const pick=e.target.closest('[data-pick]');if(pick)select(pick.dataset.pick);};
  main.oninput=e=>{const q=e.target.closest('[data-search-set]');if(q){state.search[q.dataset.searchSet]=q.value;renderGrid(q.dataset.searchSet);}};
}
function renderGrids(){const host=$('#st-grids');host.innerHTML=SETS.filter(s=>state.sets.has(s.id)).map(s=>`<div data-grid="${s.id}"></div>`).join('')||'<p class="st-empty">Tänd en mängd ovanför.</p>';for(const s of SETS)if(state.sets.has(s.id))renderGrid(s.id);}
function renderGrid(setId){
  const host=$(`[data-grid="${setId}"]`);if(!host)return;const set=SETS.find(s=>s.id===setId),cols=columnsFor(setId),q=(state.search[setId]||'').toLocaleLowerCase('sv');
  let rows=rowsFor(model,setId,state.object).map(o=>({o,cells:cellsFor(model,setId,o)}));
  if(q)rows=rows.filter(r=>Object.values(r.cells).join(' ').toLocaleLowerCase('sv').includes(q));
  const shown=rows.slice(0,200);
  const table=`<div class="st-grid-wrap"><table class="st-grid"><thead><tr>${cols.map(c=>`<th${c[2]==='num'?' class="num"':''}>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${shown.map(({o,cells})=>`<tr data-id="${esc(o.id)}"${o.id===state.object?' aria-selected="true"':''}>${cols.map(c=>`<td${c[2]==='num'?' class="num"':''}>${esc(cells[c[0]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  host.innerHTML=card(`${esc(set.label)} <span class="mono" style="color:var(--kr-mute)">${rows.length}</span>`,rows.length?table:'<p class="st-empty">Inga rader med det här filtret.</p>',
    {right:`<input class="st-grid-search" type="search" data-search-set="${setId}" value="${esc(state.search[setId]||'')}" placeholder="Sök i ${esc(set.label.toLowerCase())}" aria-label="Sök i ${esc(set.label)}">`,foot:rows.length>200?`Visar 200 av ${rows.length}. Begränsa med sökningen.`:''});
}
function renderRelations(){
  const host=$('#st-rel'),o=state.object&&model.objects.get(state.object);
  if(!o){host.innerHTML=card('Relationer','<p class="st-empty">Välj ett objekt så visas allt som hör ihop med det här.</p>');return;}
  const rel=relationsFor(model,o.id),groups=[['tagvagar','Tågvägar',rel.routes],['vaxlar','Växlar',rel.turnouts],['signaler','Signaler',rel.signals],['sparledningar','Spårledningar',rel.blocks],['moduler','Moduler',rel.modules],['avvikelser','Avvikelser',rel.deviations]];
  const sample=ids=>ids.slice(0,6).map(id=>`<button type="button" data-pick="${esc(id)}" class="mono" style="border:0;background:transparent;color:var(--kr-blue);padding:0;font-weight:600">${esc(model.objects.get(id)?.label||id)}</button>`).join(', ')+(ids.length>6?` …`:'');
  host.innerHTML=card(`${mono(o.label||o.id)} · ${esc({turnout:'växel',signal:'signal',block:'spårledning',route:'tågväg',module:'modul',deviation:'avvikelse'}[o.kind])}`,
    `<ul class="st-rel">${groups.map(([setId,label,ids])=>`<li><button type="button" data-rel-set="${setId}">${label}</button><span class="st-count">${ids.length}</span></li><li style="min-height:0;padding-bottom:10px;font-size:12.5px;color:var(--kr-ink-2)">${ids.length?sample(ids):'<span style="color:var(--kr-mute)">Inga</span>'}</li>`).join('')}</ul>`,
    {right:`<a class="st-btn" href="#konfigurera" data-plan="${esc(o.id)}">Visa i planen</a>`,foot:'Klicka en grupp för att tända mängden, eller ett namn för att filtrera på det i stället.'});
}
// ---------- Genomgång ----------
function renderGenomgang(main){
  const rv=model.review,last=rv?.last,ai=rv?.assistant||{configured:false},f=state.cardType||'alla',fmt=t=>t?new Date(t).toLocaleString('sv-SE'):'–';
  const cards=(last?.cards||[]).filter(c=>f==='alla'||c.type===f);
  const types=[['alla','Alla',last?.cards.length||0],...CARD_TYPES.map(t=>[t,CARD_LABEL[t],last?.counts?.[t]||0])];
  main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">GENOMGÅNG</div><h1>Genomgång</h1><p>Hela anläggningen mot det som är ritat: förslag, saknas, beslut och underlag. Varje förslag blir ett utkast som provas i simulatorn innan det aktiveras.</p></div><span class="st-grow"></span>${pill(model.blocking+' blockerar driftsättning','red')}<button type="button" class="st-btn st-btn-primary" data-run-review ${reviewBusy?'disabled':''}>${reviewBusy?'Genomgången körs…':last?'Kör genomgången igen':'Kör genomgången'}</button></div>
    ${notice?`<p class="st-error">${esc(notice)}</p>`:''}
    ${last?`<div class="st-stats">${types.slice(1).map(([k,l,n])=>`<div class="st-stat ${TYPE_CLASS[k]}"><small>${l}</small><b>${n}</b></div>`).join('')}<div class="st-stat"><small>Körd</small><b style="font-size:15px">${esc(fmt(last.at))}</b><small>${last.mode==='ai'?esc(last.model)+(last.usage?` · ${last.usage.input} in, ${last.usage.output} ut`:''):'utan AI · korten ur källorna'}</small></div></div>
      ${last.summary?card('Sammanfattning',`<p class="st-note">${esc(last.summary)}</p>`):''}
      <div class="st-chips">${types.map(([k,l,n])=>`<button type="button" class="st-chip-set" data-card-type="${k}" aria-pressed="${f===k}">${l}<b>${n}</b></button>`).join('')}<span class="st-grow"></span><span class="st-eyebrow">${ai.configured?'AI · '+esc(ai.model.toUpperCase()):'AI EJ ANSLUTEN'}</span></div>
      <div class="st-review">${cards.map(reviewCard).join('')||'<p class="st-empty">Inga kort av den typen.</p>'}</div>`
    :card('Ingen genomgång är körd',`<p class="st-note">Korten räknas deterministiskt ur källorna: avvikelserna, spårgrafen och reglerna. ${ai.configured?'AI-tjänsten är ansluten ('+esc(ai.model)+'): den ordnar och bedömer korten och kan lägga till egna. ':'AI-tjänsten är inte ansluten (<a href="/#advanced/ai">Inställningar → AI-tjänst</a>); genomgången ger korten utan bedömning. '}Ingenting aktiveras av genomgången.</p>`,{foot:'Körningen tar upp till någon minut med AI. Resultatet sparas på servern tills nästa körning.'})}
    ${card(`Avvikelser <span class="mono" style="color:var(--kr-red)">${model.deviations.length}</span>`,`<div class="st-grid-wrap"><table class="st-grid"><thead><tr><th>Avvikelse</th><th class="num">Antal</th><th>Löses av</th><th>Objekt</th><th></th></tr></thead><tbody>
      ${model.deviations.map(d=>`<tr><td style="font-family:var(--font)">${esc(d.title)}${d.blocking?' '+pill('Blockerar','red'):''}</td><td class="num">${d.count}</td><td>${esc(d.resolvedBy)}${d.note?' <span style="color:var(--kr-mute)">· '+esc(d.note)+'</span>':''}</td><td style="font-family:var(--mono);font-size:12px">${esc((d.items||[]).slice(0,8).join(', '))}${(d.items||[]).length>8?' …':''}</td>
      <td style="white-space:nowrap">${d.objects.length?`<a href="#data?objekt=${encodeURIComponent(d.objects[0])}">Visa i data</a> · <a href="#konfigurera?objekt=${encodeURIComponent(d.objects[0])}">Visa i planen</a>`:''}</td></tr>`).join('')}</tbody></table></div>`,
      {foot:'Listan är deterministisk och kommer från src/studio. Samma rader finns på npm run studio.'})}
    ${card('Kompispar enligt spårgrafen',`<ul class="st-list">${model.companions.map(c=>`<li><span class="mono"><b>${esc(c.pair.join(' + '))}</b></span><span class="st-grow"></span>${c.ok?pill('Hel förbindelse','',true):pill(`Ingen förbindelse: ${c.pair[0]} → ${c.aLeadsTo}, ${c.pair[1]} → ${c.bLeadsTo}`,'red')}</li>`).join('')}
      ${model.crossovers.map(x=>`<li><span>${esc(x.crossing)} · förslag</span><span class="st-grow"></span><span class="mono">${esc(x.pairs.map(p=>p.join(' + ')).join(' och '))}</span>${pill('Förslag · ej uppmätt','amber')}</li>`).join('')}</ul>`,{foot:'Förslaget blir ett utkast under Regler eller från kortet ovan.'})}`;
  main.onclick=async e=>{
    if(e.target.closest('[data-run-review]')){runReview();return;}
    const t=e.target.closest('[data-card-type]');if(t){state.cardType=t.dataset.cardType;renderGenomgang(main);return;}
    if(e.target.closest('[data-propose-bindings]')){const b=e.target.closest('button');b.disabled=true;try{notice='';const r=await fetch('/api/studio/bindings/propose-signals',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const a=await r.json();if(!r.ok)throw Error(a.error||r.statusText);notice=`${a.proposed} signaladresser ur XML ligger nu som utkast till driftbindningar. Granska och aktivera under Driftbindningar.${a.skipped.length?' Hoppade över: '+a.skipped.slice(0,3).join('; ')+(a.skipped.length>3?' …':''):''}`;}catch(err){notice=err.message;}render();return;}
    const d=e.target.closest('[data-card-draft]');if(d){const c=model.review?.last?.cards.find(x=>x.id===d.dataset.cardDraft);if(c&&await draftApi('create',{add:c.rules.map(bareRule),replaces:c.replaces,note:'Genomgång: '+c.title.slice(0,120)}))go('driftsattning','andringar');return;}
    const b=e.target.closest('[data-select]');if(b){state.object=b.dataset.select;session.save();location.hash='#data?objekt='+encodeURIComponent(b.dataset.select);}};
}
function reviewCard(c){
  const canDraft=c.rules.length&&c.rules.every(r=>!r.problems.length);
  const objs=c.objects.slice(0,10).map(o=>`<a class="mono" href="#data?objekt=${encodeURIComponent(o)}">${esc(o)}</a>`).join(', ');
  const action=c.action==='draft'?(model.drafts?.draft?`<a class="st-btn" href="#driftsattning/andringar">Visa utkastet</a>`:`<button type="button" class="st-btn st-btn-primary" data-card-draft="${esc(c.id)}" ${canDraft?'':'disabled'}>Skapa utkast</button>`)
    :c.action==='chat'?`<a class="st-btn" href="#konfigurera/regler">Beskriv i chatten</a>`
    :c.action==='data'?`<a class="st-btn" href="${c.objects[0]?'#data?objekt='+encodeURIComponent(c.objects[0]):'#data?set=tagvagar'}">Visa i data</a>`
    :c.action==='bindings'?`<button type="button" class="st-btn st-btn-primary" data-propose-bindings>Föreslå adresser ur XML</button>`
    :c.action==='measure'?`<a class="st-btn" href="#driftsattning/mat">Mät objekt</a>`:'';
  return `<section class="st-card st-review-card ${TYPE_CLASS[c.type]||''}"><div class="st-card-head"><span class="st-eyebrow st-type-ink">${esc((CARD_LABEL[c.type]||c.type).toUpperCase())}${c.typeFromSources?` · KÄLLORNA: ${esc(c.typeFromSources.toUpperCase())}`:''}${c.origin==='ai'?' · AI':''}</span><span class="st-grow"></span>${c.priority?`<span class="st-prio" title="Prioritet enligt AI">${c.priority}</span>`:''}<span class="mono st-count">${c.count}</span></div>
    <div class="st-review-body"><h3>${esc(c.title)}</h3>${c.assessment?`<p class="st-assess">${esc(c.assessment)}</p>`:''}<p class="st-source">${esc(c.text)}</p>
    ${c.rules.length?`<div class="st-proposals">${c.rules.slice(0,6).map(proposalCard).join('')}</div>${c.rules.length>6?`<p class="st-items">… och ${c.rules.length-6} regler till i samma utkast${c.rules.some(r=>r.problems.length)?`, ${c.rules.filter(r=>r.problems.length).length} validerar inte`:''}.</p>`:''}`:''}
    ${c.related?.length&&!c.rules.length?`<p class="st-items mono">Regler: ${c.related.slice(0,6).map(id=>`<a href="#data?objekt=${encodeURIComponent(id)}">${esc(id)}</a>`).join(', ')}${c.related.length>6?' …':''}</p>`:''}
    ${c.items.length&&!c.rules.length?`<p class="st-items mono">${esc(c.items.slice(0,8).join(', '))}${c.items.length>8?' …':''}</p>`:''}
    <div class="st-chat-actions">${objs?`<span class="st-meta">${objs}${c.objects.length>10?' …':''}</span>`:''}<span class="st-grow"></span>${action}</div></div></section>`;
}
let reviewBusy=false;
async function runReview(){
  if(reviewBusy)return;reviewBusy=true;notice='';render();
  try{const r=await fetch('/api/studio/review/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if([401,428].includes(r.status)){location.assign('/login?next='+encodeURIComponent(location.pathname+location.hash));return;}
    const answer=await r.json();if(!r.ok)throw Error(answer.error||r.statusText);model.review=answer;}
  catch(e){notice=e.message;}
  finally{reviewBusy=false;render();}
}
// ---------- chatten: fritext eller diktering → regelkort ----------
const chat={log:[],text:'',busy:false,error:''};
try{const saved=JSON.parse(sessionStorage.getItem('studio-chat')||'{}');if(Array.isArray(saved.log))chat.log=saved.log;if(typeof saved.text==='string')chat.text=saved.text;}catch{}
const saveChat=()=>{try{sessionStorage.setItem('studio-chat',JSON.stringify({log:chat.log.slice(-12),text:chat.text}));}catch{}};
const bareRule=({routes,explain,problems,typeLabel,runsInLabel,replaces,...r})=>r;
const chatObjects=()=>state.object&&['turnout','block','signal'].includes(model.objects.get(state.object)?.kind)?[state.object]:[];
function renderBeskriv(){
  const ai=model.review?.assistant||{configured:false},sel=chatObjects()[0]||null;
  const turns=chat.log.map(t=>t.role==='user'?`<div class="st-bubble st-bubble-user">${esc(t.text)}</div>`:answerHtml(t.answer)).join('');
  const mic=('SpeechRecognition' in window)||('webkitSpeechRecognition' in window);
  return `<section class="st-card" id="st-chat"><div class="st-card-head"><h2>Beskriv en regel</h2><span class="st-grow"></span>${sel?`<span class="st-filter">Gäller ${esc(sel)}<button type="button" data-chat-clear-object aria-label="Ta bort objektet">×</button></span>`:''}${ai.configured?pill('AI · '+ai.model,'',true):pill('AI ej ansluten','amber')}</div>
    ${turns?`<div class="st-chat-log">${turns}</div>`:`<p class="st-note">Skriv eller diktera vad som ska gälla, till exempel <i>Vx140 och Vx143 ska alltid ligga lika</i> eller <i>Vx112 får bara läggas om när S112 är fri</i>. AI:n översätter till regelkort; TKL validerar, läser tillbaka på svenska och provar i simulatorn innan något blir utkast.</p>`}
    ${chat.error?`<p class="st-error" style="margin:0 16px 12px">${esc(chat.error)}</p>`:''}
    <form class="st-chat-form" id="st-chat-form"><textarea id="st-chat-text" rows="2" aria-label="Beskriv regeln" placeholder="Vad ska gälla?" ${chat.busy?'disabled':''}>${esc(chat.text)}</textarea>
      <div class="st-chat-actions">${mic?`<button type="button" class="st-btn" data-chat-mic aria-pressed="false">🎙 Diktera</button>`:''}<span class="st-grow"></span>${chat.log.length?`<button type="button" class="st-btn" data-chat-clear>Rensa</button>`:''}<button type="submit" class="st-btn st-btn-primary" ${chat.busy||!ai.configured?'disabled':''}>${chat.busy?'Tolkar…':'Tolka'}</button></div></form>
    <div class="st-card-foot">${ai.configured?'Texten och objektnamnen går från TKL-servern till AI-tjänsten; nyckeln ligger på servern. Ingenting ändras förrän ett utkast aktiveras.':'Anslut AI-tjänsten under <a href="/#advanced/ai">Inställningar → Den här datorn → AI-tjänst</a>; nyckeln sparas på servern. Datorns egen diktering fungerar i textfältet redan nu.'}</div></section>`;
}
function answerHtml(a){
  const canDraft=a.rules.length&&a.rules.every(r=>!r.problems.length);
  return `<div class="st-bubble st-bubble-ai"><p>${esc(a.message)}</p>${a.questions.length?`<ul class="st-questions">${a.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:''}
    ${a.rules.length?`<div class="st-proposals">${a.rules.map(proposalCard).join('')}</div><div class="st-chat-actions">${a.replaces.length?`<span class="st-meta">Ersätter ${mono(a.replaces.join(', '))}</span>`:''}<span class="st-grow"></span>${model.drafts?.draft?`<a class="st-btn" href="#driftsattning/andringar">Visa utkastet</a>`:`<button type="button" class="st-btn st-btn-primary" data-chat-draft="${esc(a.at)}" ${canDraft?'':'disabled'}>Skapa utkast av ${a.rules.length} ${a.rules.length===1?'regel':'regler'}</button>`}</div>`:''}
    <small>${esc(a.model)} · ${a.usage.input} in, ${a.usage.output} ut${a.usage.cached?', '+a.usage.cached+' ur cache':''}</small></div>`;
}
function proposalCard(r){
  const touches=[...(r.objects||(r.object?[r.object]:[])),...(r.requires?.blocks||[]),...(r.requires?.signals||[]),...Object.keys(r.positions||{})];
  const objs=touches.filter(x=>model.objects.has(x)).slice(0,8).map(x=>`<button type="button" data-select="${esc(x)}" class="mono st-link">${esc(x)}</button>`).join(', ');
  return `<div class="st-card st-proposal${r.problems.length?' st-proposal-bad':''}"><div class="st-card-head"><span class="st-eyebrow">${esc((r.typeLabel||r.type).toUpperCase())}</span><span class="st-grow"></span>${pill('Verkställs i '+(r.runsInLabel||'TKL'))}${r.problems.length?pill('Validerar inte','red'):pill('Förslag · ej provad','amber',true)}</div>
    <div class="st-proposal-body"><b class="mono">${esc(r.id.replace(/^(follow|authority|condition|forbid):(manual:|line:)?/,''))}</b><span>${esc(r.explain)}</span>
    ${r.problems.length?`<ul class="st-problems">${r.problems.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
    <span class="st-meta">Objekt: ${objs||'–'} · Tågvägar ${mono((r.routes||[]).length)}${r.replaces?.length?' · Ersätter '+mono(r.replaces.join(', ')):''}</span></div></div>`;
}
function wireChat(main){
  const form=$('#st-chat-form',main),ta=$('#st-chat-text',main);if(!form||!ta)return;
  ta.oninput=()=>{chat.text=ta.value;saveChat();};
  ta.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=e=>{e.preventDefault();sendChat();};
  const log=$('.st-chat-log',main);if(log)log.scrollTop=log.scrollHeight;
}
async function sendChat(){
  const text=chat.text.trim();if(!text||chat.busy)return;
  chat.busy=true;chat.error='';chat.log.push({role:'user',text});render();
  try{const r=await fetch('/api/studio/assistant/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,objects:chatObjects()})});
    if([401,428].includes(r.status)){location.assign('/login?next='+encodeURIComponent(location.pathname+location.hash));return;}
    const answer=await r.json();if(!r.ok)throw Error(answer.error||r.statusText);
    chat.log.push({role:'ai',answer});chat.text='';}
  catch(e){chat.error=e.message;chat.log.pop();}
  finally{chat.busy=false;saveChat();render();}
}
let recognizer=null;
function toggleMic(btn){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
  if(recognizer){recognizer.stop();return;}
  recognizer=new SR();recognizer.lang='sv-SE';recognizer.interimResults=true;recognizer.continuous=true;
  const base=chat.text.trim()?chat.text.trim()+' ':'';
  recognizer.onresult=e=>{chat.text=base+[...e.results].map(r=>r[0].transcript).join(' ');const ta=$('#st-chat-text');if(ta)ta.value=chat.text;};
  recognizer.onerror=e=>{chat.error=e.error==='not-allowed'?'Mikrofonen är inte tillåten i webbläsaren. Datorns egen diktering fungerar i textfältet.':'Dikteringen avbröts: '+e.error;};
  recognizer.onend=()=>{recognizer=null;saveChat();const b=$('[data-chat-mic]');if(b){b.setAttribute('aria-pressed','false');b.textContent='🎙 Diktera';}if(chat.error)render();};
  recognizer.start();btn.setAttribute('aria-pressed','true');btn.textContent='■ Stoppa dikteringen';
}
async function chatClick(e){
  const mic=e.target.closest('[data-chat-mic]');if(mic){toggleMic(mic);return true;}
  if(e.target.closest('[data-chat-clear]')){chat.log=[];chat.error='';saveChat();render();return true;}
  if(e.target.closest('[data-chat-clear-object]')){state.object=null;session.save();render();return true;}
  const d=e.target.closest('[data-chat-draft]');
  if(d){const t=chat.log.find(x=>x.role==='ai'&&String(x.answer.at)===d.dataset.chatDraft);if(t&&await draftApi('create',{add:t.answer.rules.map(bareRule),replaces:t.answer.replaces,note:'Chatt: '+t.answer.text.slice(0,120)}))go('driftsattning','andringar');return true;}
  return false;
}
function renderLater(main){
  if(state.tab==='driftsattning'){state.view='andringar';return renderAndringar(main);}
  const text='TrainMeet och Stream Deck flyttas in sist. De finns i dagens admin.';
  main.innerHTML=`<div class="st-title"><div><div class="st-eyebrow">${esc(state.tab.toUpperCase())}</div><h1>${esc(TABS.find(t=>t.id===state.tab).label)}</h1><p>${esc(text)}</p></div></div>`;
}
// ---------- händelser ----------
window.addEventListener('hashchange',()=>{
  // Adresser från Inställningar (#register…, #advanced/xml…) leder till samma sida i Studio.
  const old=studioTarget(location.hash);if(old){history.replaceState(null,'',old.replace('/studio.html',''));}
  const link=parseHash(location.hash);if(link.object&&model?.objects.has(link.object)){state.object=link.object;if(link.tab==='driftsattning'&&link.view==='mat')state.measureObject=link.object;}if(link.sets.length)state.sets=new Set(link.sets);state.tab=link.tab;state.view=link.view;session.save();render();});
$('#st-search').addEventListener('keydown',e=>{if(e.key!=='Enter'||!model)return;const q=e.target.value.trim().toLocaleLowerCase('sv');const hit=[...model.objects.keys()].find(id=>id.toLocaleLowerCase('sv')===q)||[...model.objects.values()].find(o=>(o.label||'').toLocaleLowerCase('sv')===q)?.id;if(hit){select(hit);if(state.tab!=='konfigurera'&&state.tab!=='data')go('konfigurera');}});
createHelp({button:$('#st-help-btn'),getState:()=>({tab:state.tab,view:state.view})});
$('#st-theme').addEventListener('click',e=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'';e.currentTarget.textContent=light?'Mörkt':'Ljust';e.currentTarget.setAttribute('aria-pressed',light);try{localStorage.setItem('studio-theme',light?'light':'dark');}catch{}});
try{if(localStorage.getItem('studio-theme')==='light'){document.documentElement.dataset.theme='light';$('#st-theme').textContent='Mörkt';}}catch{}
load().catch(e=>{$('#st-main').innerHTML=`<p class="st-error">Studio kunde inte läsa stationen: ${esc(e.message)}</p>`;});
