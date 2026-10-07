import {createStationWorkspace} from './station-workspace.js';
import {createDestinations} from './destinations.js';
import {createAdminDialog,registerAdminWorkspace} from './admin-ui.js';
import { createBindingConfiguration } from './binding-configuration.js';
import { createConfiguration } from './configuration.js';
import { createSignalDetails, preloadSignalReferences } from './signal-details.js';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const titles = { systemName:'Systemnamn', userName:'Namn', comment:'Kommentar', antecedent:'Villkorsuttryck', logicType:'Logiktyp', triggerOnChange:'Utlösning vid ändring', conditionalStateVariable:'Villkorsvariabel', conditionalAction:'Åtgärd', data:'Värde', delay:'Fördröjning', option:'Alternativ', type:'Typ', operator:'Operator', negated:'Negerat', triggersCalc:'Utlöser beräkning', num1:'Tal 1', num2:'Tal 2', dataString:'Textvärde', string:'Text', aspect:'Signalbesked', defines:'Besked', turnout:'Växelobjekt', turnoutstate:'Växelläge', enabled:'Aktiverad', feedback:'Återrapportering', inverted:'Inverterad', occupancysensor:'Beläggningssensor', sensor:'Sensor', occupiedsense:'Beläggningsvärde', sourceSignalMast:'Från signal', destinationSignalMast:'Till signal', destinationMast:'Målsignal', source:'Start', destination:'Mål', uniqueid:'Unikt ID', nxType:'Tågvägstyp', blockname:'Block', blocknameac:'Block A–C', blocknamebd:'Block B–D', continuing:'Rak gren', disabled:'Direktmanöver avstängd', hidden:'Dold i originalpanelen', turnoutname:'Växel', secondturnoutname:'Kopplad växel', class:'JMRI-klass', goingActive:'Fördröjning till aktiv', goingInActive:'Fördröjning till inaktiv', lockTurnouts:'Lås växlar', raytrack:'Vändskivespår', angle:'Vinkel', scale:'Skala', degrees:'Rotation', url:'Resurs', memory:'Minne', blockcontents:'Blockinnehåll' };
const description = node => node.children.find(c=>c.tag==='userName')?.text || node.attrs.userName || node.attrs.systemName || node.attrs.ident || node.attrs.defines || node.attrs.destination || node.attrs.sensor || node.attrs.turnout || node.attrs.text || (node.text || '').trim();
function rows(attrs) {
  return Object.entries(attrs).map(([key,value])=>`<div class="source-field"><dt>${esc(titles[key] || key)}${titles[key]?` <small>${esc(key)}</small>`:''}</dt><dd>${esc(value === '' ? '(tomt)' : value)}</dd></div>`).join('');
}
function treeView(node, depth=0, autoOpen=true) {
  const details=document.createElement('details'); details.className='source-node';
  const summary=document.createElement('summary'); summary.textContent=(titles[node.tag]||node.tag)+(description(node)?' · '+description(node):''); details.append(summary);
  let loaded=false;
  const fill=()=>{
    if(loaded || !details.open) return; loaded=true;
    const content=document.createElement('div'); content.className='source-node-body';
    const attrs=document.createElement('dl'); attrs.innerHTML=rows(node.attrs); content.append(attrs);
    if(node.text?.trim()) { const p=document.createElement('p');p.textContent=node.text;content.append(p); }
    for(const child of node.children) content.append(treeView(child,depth+1,autoOpen && node.children.length<60));
    details.append(content);
  };
  details.ontoggle=fill;
  if(autoOpen && depth<2 && node.children.length<60) { details.open=true; fill(); }
  return details;
}
function sourceXML(node, depth=0) {
  const indent='  '.repeat(depth);
  if(node.tag==='#comment') return indent+'<!--'+(node.text||'')+'-->';
  if(node.tag==='#processing-instruction') return indent+'<?'+(node.text||'')+'?>';
  const namespaces=new Map();
  const xmlName=k=>k.replace(/^\{([^}]+)\}(.+)$/,(_,uri,local)=>{ if(!namespaces.has(uri)) namespaces.set(uri,uri==='http://www.w3.org/2001/XMLSchema-instance'?'xsi':'ns'+namespaces.size); return namespaces.get(uri)+':'+local; });
  let attrs=Object.entries(node.attrs).map(([k,v])=>` ${xmlName(k)}="${esc(v)}"`).join('');
  attrs=[...namespaces].map(([uri,prefix])=>` xmlns:${prefix}="${esc(uri)}"`).join('')+attrs;
  if(!node.children.length && !node.text) return `${indent}<${node.tag}${attrs} />`;
  return `${indent}<${node.tag}${attrs}>${node.text?.trim()?esc(node.text.trim()):''}${node.children.length?'\n'+node.children.map(c=>sourceXML(c,depth+1)).join('\n')+'\n'+indent:''}</${node.tag}>`;
}
export function createSourceRegister({config, panel, saveNote, onActive, editors=true}) {
  let station, destinations, configuration, bindingConfiguration, signalCatalog, signalDetails, lastState, lastOnline=false;
  let index, migration, ready, treeReady, nodeMap, category='signals', page=0, selected, query='', status='all';
  const $=id=>document.getElementById(id), pageSize=50;
  const binding=r=> {
    if(r.category==='signals') return config.signals[r.name];
    if(r.category==='layoutTurnouts') return config.turnouts[r.name];
    if(r.category==='turnouts') { const b=config.turnouts[r.name]; return b?.source===r.system?b:null; }
    if(['blocks','layoutBlocks'].includes(r.category)) return config.blocks[r.name];
    return null;
  };
  const presentation=r=>{
    const kind={layoutTurnouts:'turnouts',turnouts:'turnouts',signals:'signals',blocks:'blocks',layoutBlocks:'blocks',sensors:'buttons'}[r.category];
    return kind?config.presentation?.overrides[kind+':'+r.name]||{}:{};
  };
  const migrationLabels={tested:'Provad i simulatorn',replaced:'Ersatt beteende',partial:'Delvis införd',pending:'Återstår',external:'Anslutning återstår',disabled:'Avstängd i källan',denied:'Nekas enligt källan',unresolved:'Källmotsägelse · spärrad',excluded:'Ej ansluten'};
  const operational=r=>migration?.byRule[r.system] || migration?.groups.find(g=>g.id===r.system);
  const recordByKey=key=>index.records.find(r=>r.key===key);
  const loadTree=()=>treeReady ||= fetch('/data/source/tree.json').then(check).then(root=>{
    nodeMap=new Map(); const walk=n=>{nodeMap.set(n.path,n);n.children.forEach(walk);};walk(root);return nodeMap;
  }).catch(e=>{treeReady=null;throw e;});
  function check(r) { if(!r.ok) { if([401,428].includes(r.status)) location.assign('/login');throw Error('Källunderlaget kunde inte läsas'); } return r.json(); }
  function render() {
    const needle=query.toLocaleLowerCase('sv-SE');
    const found=index.records.filter(r=>(!category || r.category===category || (category==='_addresses' && ['turnouts','sensors'].includes(r.category))) && (!needle || (r.name+' '+(presentation(r).name||'')+' '+(presentation(r).description||'')+' '+r.system+' '+r.context+' '+r.search).toLocaleLowerCase('sv-SE').includes(needle)) && (status==='all' || (status==='noted' ? !!config.notes[r.noteKey||'xml:'+r.key] : !!binding(r)===(status==='connected'))));
    page=Math.max(0,Math.min(page,Math.ceil(found.length/pageSize)-1));
    const start=page*pageSize, current=found.slice(start,start+pageSize);
    $('registry-count').textContent=found.length?`${start+1}–${Math.min(start+pageSize,found.length)} av ${found.length.toLocaleString('sv-SE')} poster`:'Inga träffar';
    $('registry-rows').innerHTML=current.map(r=>{
      const shown=presentation(r), b=binding(r), noteKey=r.noteKey||'xml:'+r.key, op=operational(r);
      return `<tr><td><button class="source-open" data-source="${r.key}">${esc(shown.name||r.name)}</button>${shown.name?`<div class="muted">${esc(r.name)} · källnamn</div>`:''}${shown.description?`<div class="muted">${esc(shown.description)}</div>`:''}${r.comment?`<div class="muted">${esc(r.comment)}</div>`:''}</td><td>${esc(index.meta.categories.find(c=>c.key===r.category)?.label)}</td><td>${esc(r.system || r.element)}${r.context?`<div class="muted source-context">${esc(r.context)}</div>`:''}</td><td><span class="source-badge ${b?'connected':''}">${b?'Inkopplad i provprofil':'Importerad'}</span>${op?`<div class="source-operational">${esc(migrationLabels[op.status])}</div>`:''}${config.notes[noteKey]?'<div class="muted">Anteckning finns</div>':''}</td><td><button data-source="${r.key}" aria-label="Visa detaljer för ${esc(r.name)}">Visa →</button></td></tr>`;
    }).join('');
    $('registry-prev').disabled=page===0; $('registry-next').disabled=start+pageSize>=found.length;
    $('registry-page').textContent=`Sida ${page+1} av ${Math.max(1,Math.ceil(found.length/pageSize))}`;
    $('registry-category').value=category;
  }
  let detailPage,noteModal,noteBaseline='';
  async function showRecord(record) {
    selected=record; signalDetails=null;
    $('source-detail').hidden=false; $('source-detail-heading').textContent=presentation(record).name||record.name;
    $('source-detail-body').textContent='Läser källuppgifter…'; $('source-xml').hidden=true;
    detailPage.open('?record='+encodeURIComponent(record.key));
    try {
      await loadTree(); if(selected!==record)return;
      const node=nodeMap.get(record.path), b=binding(record);
      const holder=$('source-detail-body'); holder.replaceChildren();
      const statusText=document.createElement('p');statusText.className='muted';statusText.textContent=b?`Inkopplad i provprofil · ${b.source||'provadress '+b.address}. Källuppgifterna nedan är bevarade separat.`:'Importerad källinformation. Dessa JMRI-inställningar och regler körs inte automatiskt av TKL-kärnan.';holder.append(statusText);
      const op=operational(record);if(op){const text=document.createElement('p');text.className='source-operational';text.textContent=migrationLabels[op.status]+' · '+op.behavior;holder.append(text);}
      if(record.context) { const context=document.createElement('p');context.className='muted';context.textContent=record.context;holder.append(context); }
      if(record.category==='signals') {
        const mast=signalCatalog.masts.find(m=>m.sourceKey===record.key);
        if(mast){signalDetails=createSignalDetails(mast,{config,openRecord:key=>{const other=recordByKey(key);if(other)showRecord(other);}});holder.append(signalDetails.element);signalDetails.update(lastState,lastOnline);}
      }
      holder.append(treeView(node));
      if(record.refs?.length) {
        const related=document.createElement('details'); const summary=document.createElement('summary'); summary.textContent=`Referenser och andra förekomster (${record.refs.length})`;related.append(summary);
        const links=document.createElement('div');links.className='source-relations';
        for(const key of record.refs){const other=recordByKey(key);if(!other)continue;const button=document.createElement('button');button.textContent=other.name+' · '+(other.system||other.element);button.onclick=()=>showRecord(other);links.append(button);}
        related.append(links);holder.append(related);
      }
      $('source-path').textContent=record.path;
      $('source-note').value=config.notes[record.noteKey||'xml:'+record.key]||'';
      $('source-note-status').textContent='';$('source-note-display').textContent=$('source-note').value||'Ingen anteckning.';
    } catch(e) { $('source-detail-body').textContent=e.message; }
  }
  function initialize() {
    $('admin-view').innerHTML=`<div class="toolbar"><div><span class="admin-scope">Hela anläggningen</span><h1>Anläggningsregister</h1></div><a class="back-to-panel" href="#panel">Tillbaka till ställverket →</a></div>
      <section class="card"><h2>Anläggningsprofil</h2><p id="profile-summary"></p></section>
      <section class="card"><h2>Anläggningsöversikt</h2><p>Spårplan, objekt, adresser och samband.</p><a href="#register/station">Öppna anläggningsöversikten →</a></section><div id="station-editor"></div><div id="destinations-editor"></div><div id="configuration-editor"></div><div id="binding-editor"></div><div class="source-filters"><label>Visa <select id="registry-category"><option value="">Alla kategorier</option><option value="_addresses">Adressmappning (${index.meta.categories.filter(c=>['turnouts','sensors'].includes(c.key)).reduce((n,c)=>n+c.count,0)})</option>${index.meta.categories.map(c=>`<option value="${c.key}">${esc(c.label)} (${c.count})</option>`).join('')}</select></label><label class="source-search">Sök i alla källfält<input id="search" type="search" placeholder="Namn, adress, regel, värde…"></label><label>Funktion <select id="registry-status"><option value="all">Alla</option><option value="connected">Inkopplad i provprofil</option><option value="imported">Endast importerad</option><option value="noted">Med egen anteckning</option></select></label><button id="source-export-notes">Exportera anteckningar</button></div>
      <section class="card"><div class="card-heading"><h2 id="registry-count"></h2><span class="muted">Välj ett objekt för samtliga källfält</span></div><div class="table-wrap"><table><thead><tr><th>Objekt</th><th>Kategori</th><th>Källidentitet</th><th>Status</th><th></th></tr></thead><tbody id="registry-rows"></tbody></table></div><div class="source-pagination"><button id="registry-prev">← Föregående</button><span id="registry-page"></span><button id="registry-next">Nästa →</button></div></section>
      <section id="source-detail" class="card source-detail" hidden><div class="card-heading"><h2 id="source-detail-heading"></h2><button id="source-close">Stäng detaljer</button></div><div id="source-detail-body"></div><p id="source-path" class="source-path"></p><button id="source-xml-button">Visa XML för objektet</button><pre id="source-xml" hidden></pre><div class="source-note"><label for="source-note">Egen anteckning</label><textarea id="source-note" maxlength="4000" rows="3"></textarea><button id="source-save">Spara anteckning</button><span id="source-note-status" role="status"></span></div></section>`;
    $('profile-summary').textContent=`${config.routes.filter(r=>r.kind!=='shunt').length} huvudtågvägar och ${config.routes.filter(r=>r.kind==='shunt').length} växeltågvägar · ${Object.keys(config.turnouts).length} växlar · ${Object.keys(config.signals).length} signaler i provanläggningen.`;
    $('advanced-migration-content').innerHTML=`<section class="source-migration card"><h2>Alla regelgrupper</h2><p class="muted">Varje källregel har en uttrycklig status. Att ett objekt är importerat betyder inte att dess funktion är körklar.</p><div id="migration-groups"></div><p id="migration-limitations" class="muted"></p></section>`;
    $('advanced-xml-content').innerHTML=`<section class="card"><h2>Hela XML-filen bevarad</h2><p id="source-counts"></p><div class="admin-actions"><a class="source-download" href="/data/source/Cda60.xml" download="Cda60.xml">Hämta original-XML ↓</a><button id="source-all">Sök i hela XML-filen</button></div></section><section class="source-audit card"><h2>Importkontroll och källfil</h2><p>Originalfilen kan hämtas oförändrad. Alla element, attribut, texter och ordningen i dokumentträdet är bevarade. Filens ursprungliga formatering, XML-deklaration och namnrymder finns i originalet.</p><p id="source-hash"></p><div id="source-sections"></div><p>Registerposter kan överlappa: exempelvis visas en signalrelation både i signalmastlogiken och som egen post. Avsnittet Inställningar och historik ger tillgång till hela dokumentträdet, inklusive managerinställningar.</p></section>`;
    detailPage=registerAdminWorkspace('#register/object',$('source-detail'));
    const note=$('source-note').closest('.source-note');note.insertAdjacentHTML('beforebegin','<h3>Egen anteckning</h3><p id="source-note-display"></p><button id="source-note-edit">Redigera anteckning</button>');
    noteModal=createAdminDialog({title:'Egen anteckning',body:note,saveButton:$('source-save'),dirty:()=>$('source-note').value!==noteBaseline,busy:()=>$('source-save').disabled});
    $('source-note-edit').onclick=()=>{if(!selected)return;$('source-note').value=config.notes[selected.noteKey||'xml:'+selected.key]||'';noteBaseline=$('source-note').value;noteModal.open();};
    if(editors){
    station=createStationWorkspace({root:$('station-editor'),index,panel,config,openRecord:key=>{const r=recordByKey(key);if(r)showRecord(r);}});station.update(lastState,lastOnline);
    destinations=createDestinations($('destinations-editor'));destinations.update(lastState,lastOnline);
    configuration=createConfiguration({root:$('configuration-editor'),config,onActive});
    configuration.updateState(lastState,lastOnline);
    bindingConfiguration=createBindingConfiguration({root:$('binding-editor')});bindingConfiguration.updateState(lastState,lastOnline);
    } else for(const id of ['station-editor','destinations-editor','configuration-editor','binding-editor'])$(id)?.remove();
    $('migration-groups').innerHTML=(migration?.groups||[]).map(g=>`<div class="migration-row"><button data-group="${esc(g.id)}">${esc(g.name)}</button><span>${esc(migrationLabels[g.status])} · ${g.rules.length} ${g.rules.length===1?'regel':'regler'}</span><p>${esc(g.behavior)}</p></div>`).join('');
    $('migration-limitations').textContent=migration?.limitations.join(' ')||'';
    $('migration-groups').onclick=e=>{const id=e.target.closest('button')?.dataset.group;if(id){const record=index.records.find(r=>r.system===id);if(record)showRecord(record);}};
    $('source-counts').textContent=`${index.meta.sectionCount} avsnitt · ${index.meta.nodeCount.toLocaleString('sv-SE')} XML-noder · ${index.meta.attributeCount.toLocaleString('sv-SE')} attribut`;
    $('source-hash').textContent=`${index.meta.file} · ${index.meta.bytes.toLocaleString('sv-SE')} byte · SHA-256 ${index.meta.sha256}`;
    $('source-sections').innerHTML=index.meta.sections.map(s=>`<button class="source-section" data-section="${esc(s.path)}">${esc(s.tag)} · ${s.children} poster</button>`).join('');
    $('source-sections').onclick=e=>{const p=e.target.closest('button')?.dataset.section;if(p)showRecord(index.records.find(r=>r.path===p));};
    $('registry-category').onchange=e=>{category=e.target.value;page=0;render();};
    $('registry-status').onchange=e=>{status=e.target.value;page=0;render();};
    $('search').oninput=e=>{query=e.target.value;page=0;render();};
    $('source-export-notes').onclick=()=>{ const data={source:index.meta.file,sha256:index.meta.sha256,exportedAt:new Date().toISOString(),notes:config.notes}; const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='charlottendal-anteckningar.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); };
    $('source-all').onclick=()=>{category='';query='';status='all';page=0;$('search').value='';$('registry-status').value='all';render();location.hash='#register';};
    $('registry-prev').onclick=()=>{page--;render();};$('registry-next').onclick=()=>{page++;render();};
    $('registry-rows').onclick=e=>{const key=e.target.closest('button')?.dataset.source;if(key)showRecord(recordByKey(key));};
    $('source-close').onclick=()=>{detailPage.close();selected=null;signalDetails=null;};
    $('source-xml-button').onclick=()=>{if(selected&&nodeMap){$('source-xml').textContent=sourceXML(nodeMap.get(selected.path));$('source-xml').hidden=!$('source-xml').hidden;}};
    $('source-save').onclick=async()=>{
      if(!selected)return; const record=selected, key=record.noteKey||'xml:'+record.key, note=$('source-note').value;
      $('source-save').disabled=true;
      try { if(await saveNote(key,note)){config.notes[key]=note;$('source-note-status').textContent='Sparat';$('source-note-display').textContent=note||'Ingen anteckning.';noteModal.close(true);render();}else noteModal.message('Kunde inte spara. Försök igen.'); }
      finally {$('source-save').disabled=false;}
    };
    render();
  }
  async function open(kind, name) {
    ready ||= Promise.all([fetch('/data/source/index.json').then(check),fetch('/data/migration.json').then(check),fetch('/data/signal-catalog.json').then(check)]).then(async ([data,status,signals])=>{index=data;migration=status;signalCatalog=signals;if(signals.sourceHash!==index.meta.sha256)throw Error('Signalregistret stämmer inte med källfilen');await preloadSignalReferences(signals);initialize();}).catch(e=>{ready=null;document.getElementById('admin-view').textContent=e.message;throw e;});
    await ready;
    if(!kind&&location.hash.startsWith('#register/object')){const key=new URLSearchParams(location.hash.split('?')[1]||'').get('record'),record=recordByKey(key);if(record&&selected!==record)await showRecord(record);else if(!record)detailPage.close();}
    if(kind){category=kind;query='';status='all';page=0;$('search').value='';$('registry-status').value='all';render();if(name){const record=index.records.find(r=>r.category===kind&&r.name===name);if(record)await showRecord(record);}}
  }
  async function openKey(key){await open();const record=recordByKey(key);if(record)await showRecord(record);return !!record;}
  return {open,openKey,presentationChanged(){if(index){render();if(selected)$('source-detail-heading').textContent=presentation(selected).name||selected.name;}},updateState(state,online){lastState=state;lastOnline=online;station?.update(state,online);destinations?.update(state,online);configuration?.updateState(state,online);bindingConfiguration?.updateState(state,online);signalDetails?.update(state,online);}};
}
