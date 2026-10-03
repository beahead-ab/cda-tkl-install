// Stream Deck layouts, one per deck. Deck tabs and an overview of every deck; for the
// chosen deck a palette of keys, the deck's grid drawn exactly as the deck draws it (by
// stream-deck-render.js, never animated), page tabs and the chosen key's properties.
// Keys are dragged from the palette onto the grid, between places, onto a page tab or
// back to the palette to remove them; a click or the keyboard works too. Every change is
// saved at once as the deck's draft, and Aktivera makes it the deck's layout. Nothing
// here sends an operating order.
import {registerAdminWorkspace,confirmAdmin,escapeHTML as esc} from './admin-ui.js';
import {MODELS,validateLayout,changeModel,defaultLayout,layoutPages,setKey,moveKey,movePage,firstFree,addPage,renamePage,removePage,missingPluppar,differences,keyLabel,TURN_FILTERS,TURN_SLOTS,NAV_TARGETS,ICON_TYPES,HOLD_TYPES} from './stream-deck-profile.js';
import {SYSTEM_KEYS,orderPluppar,COLORS} from './stream-deck-layout.js';
import {ICONS,ICON_IDS} from './stream-deck-icons.js';
import {keySpec,drawKey} from './stream-deck-render.js';
import {turnList} from './stream-deck-turns.js';
const HASH='#tools/streamdeck/layout',REMEMBER='charlottendal-streamdeck-admin',PX=144;
const DOT={plupp:COLORS.free,turn:'#9ad0ff',train:'#4a7fb5',system:COLORS.muted,nav:COLORS.muted,page:COLORS.muted};
const SYSTEM_NOTES={'all-stop':'Ställer alla signaler i stopp.','reset-ais':'Häver Alla signaler i stopp.','panel-reset':'Återställer panelen. Kräver alltid minst en sekunds tryck.',cancel:'Avbryter ett påbörjat tågvägsval.','yard-authority':'Lämnar över eller återtar rangerbangården. Överstruken medan rangerställverket styr.',page:'Bläddrar till nästa sida.'};
const NAV_NOTES={next:'Går till nästa sida, och efter den sista till den första.',prev:'Går till föregående sida, och från den första till den sista.',home:'Går till första sidan.'};
const icon=(id,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[id].d}"/></svg>`;
const when=iso=>{const t=Date.parse(iso);return Number.isFinite(t)?new Intl.DateTimeFormat('sv-SE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(t):'';};
const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
// Drop the optional fields a key does not use, so drafts compare cleanly.
function tidy(key){
  if(!key)return null;const out={...key};
  if(!out.label)delete out.label;if(!out.icon||!ICON_TYPES.has(out.type))delete out.icon;if(!out.hold||!HOLD_TYPES.has(out.type))delete out.hold;
  if(out.type==='turn'){if(out.filter!=='line')delete out.lineId;if(out.details!==false)delete out.details;}
  return out;
}
async function post(path,data){
  const response=await fetch('/api/streamdeck/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const answer=await response.json().catch(()=>null);
  if(!response.ok||!answer)throw Object.assign(Error(answer?.error||'Servern svarade med fel '+response.status+'.'),{status:response.status});
  return answer;
}
export function createStreamDeckAdmin({pluppar,lines,context,deck}){
  const root=document.getElementById('streamdeck-layout-editor');if(!root)return null;
  root.innerHTML=`<div class="sda">
<header class="sda-head"><h1 tabindex="-1">Stream Deck</h1><div class="sda-tabs" role="tablist" aria-label="Deck" id="sda-tabs"></div>
<div class="sda-head-actions" id="sda-head-actions"><label class="sda-check"><input type="checkbox" id="sda-preview">Visa utkastet på decket</label><span id="sda-draft" class="sda-draft"></span><button type="button" id="sda-discard">Kasta</button><button type="button" id="sda-activate" class="primary">Aktivera</button></div></header>
<p id="sda-status" class="sda-status" role="status"></p>
<div id="sda-editor" class="sda-editor">
<aside class="sda-palette" id="sda-palette" aria-label="Knappförråd"><label class="sda-search"><span>Sök knapp</span><input id="sda-search" type="search" placeholder="Sök tågväg, tåg eller knapp …" autocomplete="off"></label><div id="sda-groups"></div>
<p class="sda-hint">Dra en knapp till en ruta, eller välj en ruta och klicka på knappen här. Släpp på en upptagen ruta för att byta plats, på en sidflik för att flytta dit och här i förrådet för att ta bort.</p></aside>
<section class="sda-main" aria-label="Decket"><div class="sda-pages"><div class="sda-page-tabs" role="tablist" aria-label="Sidor" id="sda-pages"></div><button type="button" id="sda-page-add" class="sda-page-add">+ Ny sida</button><span id="sda-meta" class="sda-meta"></span></div>
<div class="sda-stage"><div id="sda-grid" class="sda-grid" role="group" aria-label="Knapparna på sidan"></div></div>
<div class="sda-legend"><span><i style="background:${COLORS.free}"></i>fri</span><span><i style="background:${COLORS.route}"></i>i tågväg</span><span><i style="background:${COLORS.occupied}"></i>belagd</span><span><i style="background:${COLORS.held}"></i>hållen</span><span class="muted">Färgen följer alltid läget i ställverket.</span></div></section>
<aside class="sda-props" id="sda-props" aria-label="Vald knapp"></aside>
</div>
<div id="sda-overview" class="sda-overview" hidden></div>
</div>`;
  const $=id=>root.querySelector('#sda-'+id);
  // Live updates arrive often; rebuilding unchanged markup would swallow clicks and focus.
  const setHTML=(node,html)=>{if(node.dataset.html!==html){node.innerHTML=html;node.dataset.html=html;}};
  let view=null,serial='',overview=false,layout=null,page=0,selected=null,pending=false,saving=null,queued=false,saveTimer=0,lastError='',drag=null,suppressClick=false;
  try{serial=localStorage.getItem(REMEMBER)||'';}catch{}
  const visible=()=>!root.hidden;
  const say=(text,error=false)=>{const s=$('status');s.textContent=text||'';s.dataset.tone=error?'alarm':'';};
  // In the order the decks were first seen, so the tabs stay put.
  const decks=()=>view?Object.entries(view.decks).map(([s,d])=>({serial:s,...d})):[];
  const entry=s=>view&&s&&Object.hasOwn(view.decks,s)?view.decks[s]:null;
  const here=()=>new Set((deck?.decks?.()||[]).map(d=>d.serial));
  const plain=()=>pluppar().map(p=>({id:p.id,label:p.label,kind:p.kind}));
  const automatic=d=>defaultLayout(d.model,plain(),lines());
  const baseOf=d=>d.active||automatic(d);
  const cols=()=>MODELS[layout?.model]?.columns||5;
  // The working layout follows the server unless this editor has changes on the way.
  function sync(){
    const d=entry(serial);
    if(!d){if(serial&&view)serial='';if(!serial){const list=decks(),connected=here();const pick=list.find(x=>connected.has(x.serial))||list[0];if(pick&&!overview)serial=pick.serial;}}
    const e=entry(serial);if(!e){layout=null;overview=true;return;}
    // Changes on the way, or one the server refused, stay on screen until the next edit.
    if(pending||saving||lastError)return;
    const next=e.draft||baseOf(e);
    if(JSON.stringify(next)!==JSON.stringify(layout)){layout=structuredClone(next);if(page>=layout.pages.length)page=layout.pages.length-1;if(selected!=null&&selected>=layout.pages[page].keys.length)selected=null;}
  }
  function accept(next){if(next&&(!view||next.revision>=view.revision)){view=next;sync();}}
  // ---- saving -------------------------------------------------------------
  function commit(next,{props=true}={}){
    layout=next;pending=true;lastError='';
    render({props});clearTimeout(saveTimer);saveTimer=setTimeout(flush,350);
    if($('preview').checked)deck?.preview(serial,layout);
  }
  async function flush(){
    clearTimeout(saveTimer);
    if(saving){queued=true;return saving;}
    if(!pending||!serial)return;
    pending=false;const sent=layout,target=serial;
    saving=(async()=>{
      try{accept(await post('save',{revision:view.revision,serial:target,layout:sent}));}
      catch(e){lastError=e.message;say('Utkastet kunde inte sparas: '+e.message,true);if(e.status===409){pending=false;layout=null;}}
      finally{saving=null;if(queued){queued=false;await flush();}if(!pending&&!saving)sync();renderHead();if(layout===null){sync();render();}}
    })();
    return saving;
  }
  async function run(path,data,done){
    await flush();
    try{const result=await post(path,{revision:view.revision,...data});pending=false;layout=null;accept(result);render();done?.(result);return result;}
    catch(e){say(e.message,true);return null;}
  }
  // ---- rendering ----------------------------------------------------------
  // The panel's live state, but never dimmed for lost contact: the editor is for seeing the layout.
  function env(){const e=deck?.environment?.({page,pages:layout?.pages.length||1});if(e)return {...e,online:true};return {plupp:()=>({kind:'plupp',lines:[],fill:COLORS.free}),train:()=>({kind:'train',number:''}),turn:()=>({kind:'train',number:''}),system:{},online:true};}
  function paintCanvas(canvas,resolved,environment){drawKey(canvas.getContext('2d'),PX,keySpec(resolved,environment),true);}
  function renderHead(){
    const connected=here(),list=decks();
    setHTML($('tabs'),list.map(d=>`<button type="button" role="tab" data-deck="${esc(d.serial)}" aria-selected="${!overview&&d.serial===serial}"><i class="sda-dot${connected.has(d.serial)?' on':''}" title="${connected.has(d.serial)?'Ansluten här':'Inte ansluten här'}"></i>${esc(d.name)} · ${esc(MODELS[d.model].short)}</button>`).join('')+`<button type="button" role="tab" data-deck="" aria-selected="${overview}">Alla deck</button>`);
    const e=entry(serial),show=!overview&&!!e;$('head-actions').hidden=!show;$('editor').hidden=!show;$('overview').hidden=show;
    if(!show)return;
    const draft=pending||saving||!!e.draft,n=e.draft?differences(e.draft,baseOf(e)):0;
    $('draft').textContent=saving||pending?'Sparar …':lastError?'Ej sparat':e.draft?(n?`Utkast · ${plural(n,'ändring','ändringar')}`:'Utkast · inga ändringar'):e.active?`Aktiv · version ${e.activeVersion}`:'Standardlayouten';
    $('discard').disabled=!draft||!!saving;$('activate').disabled=!draft||!!saving||!!lastError;
    const live=connected.has(serial);$('preview').disabled=!live;$('preview').closest('label').title=live?'':'Decket är inte anslutet till den här datorn.';
    if(!live&&$('preview').checked){$('preview').checked=false;deck?.preview(serial,null);}
  }
  function paletteGroups(){
    const all=orderPluppar(plain()),missing=new Set(missingPluppar(layout,all).map(p=>p.id)),where=new Map();
    layout.pages.forEach((p,i)=>p.keys.forEach(k=>{if(k?.type==='plupp'&&!where.has(k.id))where.set(k.id,i);}));
    const c=context(),due=c?turnList(c).length:0,ls=lines();
    return [
      {name:'Tågvägar',count:missing.size?`${missing.size} saknas`:'alla finns',alarm:missing.size>0,items:all.map(p=>({id:'plupp:'+p.id,key:{type:'plupp',id:p.id},label:p.label+(p.kind==='shunt'?' (växel)':''),dot:DOT.plupp,placed:where.has(p.id),title:where.has(p.id)?`Finns på sida ${where.get(p.id)+1}`:'Finns inte på decket'}))},
      {name:'Tåg på tur',count:c?`${due} i tur`:'TrainMeet ej ansluten',items:Array.from({length:6},(_,i)=>({id:'turn:'+(i+1),key:{type:'turn',slot:i+1,filter:'all'},label:`Tåg ${i+1}`,dot:DOT.turn}))},
      {name:'Sträckor',count:ls.length?String(ls.length*2):'hämtas från TrainMeet',items:ls.flatMap(l=>[['departure','ut'],['arrival','in']].map(([role,word])=>({id:`train:${role}:${l.id}`,key:{type:'train',role,lineId:l.id},label:`${l.neighborName} ${word}`,dot:DOT.train})))},
      {name:'Drift',count:String(SYSTEM_KEYS.length-1),items:SYSTEM_KEYS.filter(k=>k.id!=='page').map(k=>({id:'system:'+k.id,key:{type:'system',id:k.id},label:k.title,dot:DOT.system}))},
      {name:'Navigering',count:'5',items:[['nav:next',{type:'nav',to:'next'},'Sida →'],['nav:prev',{type:'nav',to:'prev'},'← Sida'],['nav:home',{type:'nav',to:'home'},'Hem'],['system:page',{type:'system',id:'page'},'Sida x / y'],['page',{type:'page',target:0},'Gå till sida …']].map(([id,key,label])=>({id,key,label,dot:DOT.nav}))}
    ];
  }
  let paletteKeys=new Map();
  function renderPalette(){
    const q=$('search').value.trim().toLowerCase(),groups=paletteGroups();paletteKeys=new Map();
    setHTML($('groups'),groups.map(g=>{
      const items=g.items.filter(it=>!q||it.label.toLowerCase().includes(q)||g.name.toLowerCase().includes(q));
      for(const it of g.items)paletteKeys.set(it.id,it.key);
      if(q&&!items.length)return '';
      return `<section class="sda-group"><div class="sda-group-head"><span>${esc(g.name)}</span><span class="${g.alarm?'alarm':''}">${esc(g.count)}</span></div><div class="sda-items">${items.map(it=>`<button type="button" class="sda-item${it.placed?' placed':''}" data-palette="${esc(it.id)}"${it.title?` title="${esc(it.title)}"`:''}><i style="background:${it.dot}"></i>${esc(it.label)}</button>`).join('')||'<span class="muted">Inga ännu.</span>'}</div></section>`;
    }).join('')||'<p class="muted">Ingen knapp matchar sökningen.</p>');
  }
  function renderPages(){
    setHTML($('pages'),layout.pages.map((p,i)=>`<button type="button" role="tab" data-page-tab="${i}" aria-selected="${i===page}">${i+1} · ${esc(p.name)}</button>`).join(''));
    $('page-add').disabled=layout.pages.length>=20;
    const d=entry(serial),m=MODELS[layout.model];$('meta').textContent=`${m.name.replace(' / Original','')} · ${m.columns} × ${m.rows} · serienummer ${serial}`+(d&&d.model!==layout.model?` · decket rapporterar ${MODELS[d.model].name}`:'');
  }
  function renderGrid(){
    const focused=root.querySelector('.sda-cell:focus')?.dataset.cell,resolved=layoutPages(layout,{pluppar:pluppar(),lines:lines()})[page],environment=env();
    const grid=$('grid');grid.style.setProperty('--sda-cols',cols());grid.style.setProperty('--sda-max',cols()>5?'112px':'128px');
    grid.innerHTML=layout.pages[page].keys.map((k,i)=>{const r=Math.floor(i/cols())+1,c=i%cols()+1;return `<button type="button" class="sda-cell${k?'':' empty'}${i===selected?' selected':''}" data-cell="${i}" aria-pressed="${i===selected}" aria-label="Rad ${r}, kolumn ${c}: ${esc(k?keyLabel(k,{pluppar:pluppar(),lines:lines()}):'tom')}"><canvas width="${PX}" height="${PX}"></canvas></button>`;}).join('');
    grid.querySelectorAll('.sda-cell').forEach((cell,i)=>{if(layout.pages[page].keys[i])paintCanvas(cell.querySelector('canvas'),resolved[i],environment);});
    if(focused!=null)grid.querySelector(`[data-cell="${focused}"]`)?.focus();
  }
  function repaint(){
    if(!layout||overview||!visible())return;
    const resolved=layoutPages(layout,{pluppar:pluppar(),lines:lines()})[page],environment=env();
    $('grid').querySelectorAll('.sda-cell').forEach((cell,i)=>{if(layout.pages[page].keys[i])paintCanvas(cell.querySelector('canvas'),resolved[i],environment);});
    const preview=$('props').querySelector('canvas');if(preview&&selected!=null&&layout.pages[page].keys[selected])paintCanvas(preview,resolved[selected],environment);
  }
  function kindOf(k){
    if(!k)return 'Tom ruta';
    switch(k.type){
      case 'plupp':{const p=pluppar().find(x=>x.id===k.id);return p?`${p.kind==='shunt'?'Växeltågväg':'Tågväg'} · ${p.label}`:`Saknas · ${k.id}`;}
      case 'system':return 'Driftknapp · '+(SYSTEM_KEYS.find(s=>s.id===k.id)?.title||k.id);
      case 'train':{const l=lines().find(x=>x.id===k.lineId);return `Sträcka · ${l?.neighborName||k.lineId} ${k.role==='departure'?'ut':'in'}`;}
      case 'turn':return `Tåg på tur · plats ${k.slot}`;
      case 'page':return 'Sidbyte · till '+(layout.pages[k.target]?.name||'sida '+(k.target+1));
      case 'nav':return 'Sidknapp · '+NAV_TARGETS[k.to];
    }
    return k.type;
  }
  function notesOf(k){
    if(k.type==='plupp')return ['Tryck: väljer start eller mål','Två tryck: lägger tågvägen','Tryck på lagd tågväg: återtar'];
    if(k.type==='train')return ['Visar nästa tåg mot eller från grannstationen.','Kort tryck tar nästa steg i klareringen.','Långt tryck återtar en begäran eller nekar.'];
    if(k.type==='turn')return ['Ett tåg som har avgått lämnar knappen; nästa tåg i tur flyttar fram.','Ett tåg som väntar på ett steg från dig blinkar.','Kort tryck tar nästa steg. Långt tryck avbryter en begäran eller nekar.'];
    if(k.type==='system')return [SYSTEM_NOTES[k.id]].filter(Boolean);
    if(k.type==='page')return ['Går till den valda sidan.'];
    if(k.type==='nav')return [NAV_NOTES[k.to]];
    return [];
  }
  function defaultText(k){const bare={...k};delete bare.label;return keyLabel(bare,{pluppar:pluppar(),lines:lines()});}
  function renderProps(){
    const node=$('props'),k=selected!=null?layout.pages[page].keys[selected]:null;
    if(selected==null){
      node.innerHTML=`<div class="sda-props-kind">Sida ${page+1} av ${layout.pages.length}</div><label class="sda-field">Sidans namn<input id="sda-page-name" maxlength="24" value="${esc(layout.pages[page].name)}"></label>
<div class="sda-row"><button type="button" id="sda-page-left" ${page===0?'disabled':''}>← Flytta</button><button type="button" id="sda-page-right" ${page===layout.pages.length-1?'disabled':''}>Flytta →</button><button type="button" id="sda-page-remove" class="danger" ${layout.pages.length<2?'disabled':''}>Ta bort sidan</button></div>
<p class="muted">Välj en ruta för att ändra knappen. Dra knappar från förrådet till vänster, eller dra en sidflik för att ändra ordningen.</p>`;
      return;
    }
    const r=Math.floor(selected/cols())+1,c=selected%cols()+1;
    if(!k){node.innerHTML=`<div class="sda-props-kind">Tom ruta</div><div class="sda-props-where">Sida ${page+1} · rad ${r} · kolumn ${c}</div><p class="muted">Dra en knapp hit, eller klicka på en knapp i förrådet så hamnar den här.</p>`;return;}
    const ls=lines(),hold=HOLD_TYPES.has(k.type),forced=k.type==='system'&&k.id==='panel-reset';
    let fields='';
    if(k.type==='turn')fields=`<label class="sda-field">Vilka tåg<select id="sda-turn-filter">${Object.entries(TURN_FILTERS).filter(([v])=>v!=='line').map(([v,t])=>`<option value="${v}" ${k.filter===v?'selected':''}>${esc(t)}</option>`).join('')}${ls.map(l=>`<option value="line:${esc(l.id)}" ${k.filter==='line'&&k.lineId===l.id?'selected':''}>En sträcka: ${esc(l.neighborName)}</option>`).join('')}${k.filter==='line'&&!ls.some(l=>l.id===k.lineId)?`<option value="line:${esc(k.lineId)}" selected>En sträcka: ${esc(k.lineId)} (saknas)</option>`:''}</select></label>
<label class="sda-field">Plats i turordningen<select id="sda-turn-slot">${Array.from({length:TURN_SLOTS},(_,i)=>`<option value="${i+1}" ${k.slot===i+1?'selected':''}>${i+1}${i===0?' · närmast i tur':''}</option>`).join('')}</select></label>
<label class="sda-check"><input type="checkbox" id="sda-turn-details" ${k.details===false?'':'checked'}>Visa spår och tid</label>`;
    if(k.type==='train')fields=`<label class="sda-field">Sträcka<select id="sda-line">${ls.map(l=>`<option value="${esc(l.id)}" ${l.id===k.lineId?'selected':''}>${esc(l.neighborName)}${l.neighborCode?' ('+esc(l.neighborCode)+')':''}</option>`).join('')}${ls.some(l=>l.id===k.lineId)?'':`<option value="${esc(k.lineId)}" selected>${esc(k.lineId)} (saknas)</option>`}</select></label>
<label class="sda-field">Riktning<select id="sda-role"><option value="departure" ${k.role==='departure'?'selected':''}>Avgång, ut</option><option value="arrival" ${k.role==='arrival'?'selected':''}>Ankomst, in</option></select></label>`;
    if(k.type==='page')fields=`<label class="sda-field">Till sida<select id="sda-target">${layout.pages.map((p,i)=>`<option value="${i}" ${k.target===i?'selected':''}>${i+1} · ${esc(p.name)}</option>`).join('')}</select></label>`;
    if(k.type==='nav')fields=`<label class="sda-field">Går till<select id="sda-nav">${Object.entries(NAV_TARGETS).map(([v,t])=>`<option value="${v}" ${k.to===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
    const picture=ICON_TYPES.has(k.type)?`<div class="sda-field"><span>Bild</span><div class="sda-icons" role="group" aria-label="Bild">${k.type==='nav'?'':`<button type="button" data-icon="" aria-pressed="${!k.icon}" class="sda-icon-none">Ingen</button>`}${ICON_IDS.map(id=>`<button type="button" data-icon="${id}" aria-pressed="${k.icon===id||(!k.icon&&k.type==='nav'&&{next:'next',prev:'prev',home:'home'}[k.to]===id)}" aria-label="${esc(ICONS[id].name)}" title="${esc(ICONS[id].name)}">${icon(id)}</button>`).join('')}</div></div>`
      :`<div class="sda-field"><span>Bild</span><div class="sda-locked">${k.type==='plupp'?'Lampa i tågvägens färg (låst)':k.type==='missing'?'Saknas':'Tåget och dess steg (låst)'}</div></div>`;
    const holdField=hold?`<label class="sda-check"><input type="checkbox" id="sda-hold" ${k.hold||forced?'checked':''} ${forced?'disabled':''}>Håll in för att verka</label>
<label class="sda-field" ${k.hold||forced?'':'hidden'} id="sda-hold-row">Hur länge<select id="sda-hold-time"><option value="1000" ${(k.hold||1000)===1000?'selected':''}>1 sekund</option><option value="2000" ${k.hold===2000?'selected':''}>2 sekunder</option></select></label>`:'';
    node.innerHTML=`<div class="sda-props-head"><canvas width="${PX}" height="${PX}" aria-hidden="true"></canvas><div><div class="sda-props-kind">${esc(kindOf(k))}</div><div class="sda-props-where">Sida ${page+1} · rad ${r} · kolumn ${c}</div></div></div>
<label class="sda-field">Text på knappen<input id="sda-label" maxlength="24" value="${esc(k.label||'')}" placeholder="${esc(defaultText(k))}"></label>
${fields}${picture}${holdField}
<ul class="sda-notes">${notesOf(k).map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
<button type="button" id="sda-remove" class="danger">Ta bort från decket</button>
<p class="muted">Färgen när knappen är aktiv eller spärrad följer läget och går inte att ändra.</p>`;
    repaint();
  }
  function renderOverview(){
    const node=$('overview');if(node.contains(document.activeElement)&&document.activeElement.matches('input,select'))return;
    const list=decks(),connected=here();
    const cell=k=>!k?'transparent':DOT[k.type]||COLORS.muted;
    setHTML(node,`<div class="sda-overview-head"><h2>Alla deck</h2><span class="muted">Varje deck känns igen på sitt serienummer och har sin egen layout.</span></div>
${list.length?`<div class="sda-cards">${list.map(d=>{const m=MODELS[d.model],shown=d.draft||baseOf(d),n=d.draft?differences(d.draft,baseOf(d)):0,live=connected.has(d.serial);
  const state=live?'ansluten här':d.lastSeen?'senast sedd '+when(d.lastSeen):'inte sedd';
  const status=d.draft?`${d.active?'Egen':'Standard'} · utkast med ${plural(n,'ändring','ändringar')}`:d.active?`Egen · aktiverad ${when(d.activatedAt)||'version '+d.activeVersion}`:'Standardlayouten';
  return `<section class="sda-card" data-card="${esc(d.serial)}"><div class="sda-card-head"><i class="sda-dot${live?' on':''}"></i><input class="sda-card-name" data-rename value="${esc(d.name)}" maxlength="40" aria-label="Namn på decket"><span class="sda-card-state">${esc(state)}</span></div>
<div class="sda-mini" style="--sda-cols:${m.columns}">${shown.pages[0].keys.map(k=>`<span style="background:${cell(k)}"></span>`).join('')}</div>
<dl><dt>Modell</dt><dd>${esc(m.name.replace(' / Original',''))} · ${m.columns} × ${m.rows}</dd><dt>Serienummer</dt><dd>${esc(d.serial)}</dd><dt>Layout</dt><dd>${esc(status)}</dd><dt>Sidor</dt><dd>${shown.pages.length}</dd></dl>
<div class="sda-card-actions"><button type="button" class="primary" data-edit>Redigera</button><select data-copy aria-label="Kopiera layout från ett annat deck"><option value="">Kopiera layout från …</option>${list.filter(o=>o.serial!==d.serial).map(o=>`<option value="${esc(o.serial)}">${esc(o.name)}</option>`).join('')}</select><button type="button" data-export>Exportera</button><label class="sda-file">Importera …<input type="file" accept="application/json,.json" data-import></label>${live?'<button type="button" data-identify>Visa vilket deck</button>':''}${d.active||d.draft?'<button type="button" data-reset>Standardlayout</button>':''}${live?'':'<button type="button" class="danger" data-forget>Glöm</button>'}</div></section>`;}).join('')}</div>`
  :`<div class="sda-empty"><p>Inga deck ännu. Koppla in ett Stream Deck och anslut det i den här webbläsaren, så känns det igen och dyker upp här.</p><button type="button" class="primary" data-connect>Anslut Stream Deck</button></div>`}
<p class="muted">Ett nytt deck som kopplas in får standardlayouten för sin modell tills någon gör en egen. Layouten följer decket, oavsett vilken dator det sitter i.</p>`);
  }
  function render({props=true}={}){
    if(!view)return;
    renderHead();
    if(overview||!layout){renderOverview();return;}
    renderPalette();renderPages();renderGrid();if(props)renderProps();else repaint();
  }
  // ---- editing actions ------------------------------------------------------
  const key=()=>selected!=null?layout.pages[page].keys[selected]:null;
  const changeKey=(fields,opts)=>commit(setKey(layout,page,selected,tidy({...key(),...fields})),opts);
  function place(k,{to=selected,onPage=page}={}){
    let index=onPage===page?to:null;
    if(index==null){index=firstFree(layout,onPage);if(index<0){say(`Sidan ${layout.pages[onPage].name} är full. Välj en ruta att ersätta eller lägg till en sida.`,true);return;}}
    page=onPage;selected=index;commit(setKey(layout,onPage,index,tidy(structuredClone(k))));
  }
  function choose(next){
    if(next===serial&&!overview)return;
    flush().then(()=>{
      if(serial&&$('preview').checked){deck?.preview(serial,null);$('preview').checked=false;}
      overview=!next;if(next){serial=next;try{localStorage.setItem(REMEMBER,next);}catch{}}
      layout=null;page=0;selected=null;lastError='';say('');sync();render();
    });
  }
  // Clicks (a drag that ended is not a click).
  root.addEventListener('click',e=>{
    if(suppressClick){suppressClick=false;e.preventDefault();return;}
    const t=e.target;
    const tab=t.closest('[data-deck]');if(tab)return choose(tab.dataset.deck);
    if(t.closest('#sda-discard'))return confirmAdmin({title:'Kasta utkastet?',message:'Ändringarna sedan senaste aktiveringen tas bort. Decket fortsätter med den layout det har.',button:'Kasta',action:async()=>!!await run('discard',{serial},()=>say('Utkastet är kastat.'))});
    if(t.closest('#sda-activate'))return run('activate',{serial},r=>say(`Layouten för ${r.decks[serial].name} är aktiv · version ${r.decks[serial].activeVersion}.`));
    if(t.closest('#sda-page-add')){const next=addPage(layout);page=next.pages.length-1;selected=null;return commit(next);}
    const pageTab=t.closest('[data-page-tab]');if(pageTab){page=Number(pageTab.dataset.pageTab);selected=null;return render();}
    const cell=t.closest('[data-cell]');if(cell){const i=Number(cell.dataset.cell);selected=selected===i?null:i;return render();}
    const item=t.closest('[data-palette]');if(item){const k=paletteKeys.get(item.dataset.palette);if(k)place(k.type==='page'?{...k,target:page===0&&layout.pages.length>1?1:0}:k);return;}
    const ic=t.closest('[data-icon]');if(ic){changeKey({icon:ic.dataset.icon||undefined});root.querySelector(`[data-icon="${ic.dataset.icon}"]`)?.focus();return;}
    if(t.closest('#sda-remove')){const i=selected;commit(setKey(layout,page,i,null));return;}
    if(t.closest('#sda-page-remove'))return confirmAdmin({title:`Ta bort ${layout.pages[page].name}?`,message:'Knapparna på sidan tas bort ur utkastet. Sidbyten till sidan töms.',button:'Ta bort',action:async()=>{const next=removePage(layout,page);page=Math.max(0,page-1);selected=null;commit(next);return true;}});
    if(t.closest('#sda-page-left')||t.closest('#sda-page-right')){const to=page+(t.closest('#sda-page-left')?-1:1);const next=movePage(layout,page,to);page=to;return commit(next);}
    const card=t.closest('[data-card]');if(!card)return;const s=card.dataset.card,d=entry(s);
    if(t.closest('[data-edit]'))return choose(s);
    if(t.closest('[data-export]')){
      const layout=d.draft||baseOf(d),blob=new Blob([JSON.stringify({name:d.name,serial:s,...layout},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`streamdeck-${d.name.toLowerCase().replace(/[^a-z0-9åäö]+/g,'-').replace(/^-|-$/g,'')||s}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
      return say(`Layouten för ${d.name} är exporterad${d.draft?' (utkastet)':''}.`);
    }
    if(t.closest('[data-identify]')){deck?.identify(s);return say(`${d.name} visar sitt namn i två sekunder.`);}
    if(t.closest('[data-reset]'))return confirmAdmin({title:`Standardlayout på ${d.name}?`,message:'Den egna layouten och eventuellt utkast tas bort. Decket får den automatiska layouten för sin modell.',button:'Återgå',action:async()=>!!await run('reset',{serial:s},()=>say(`${d.name} använder standardlayouten.`))});
    if(t.closest('[data-forget]'))return confirmAdmin({title:`Glöm ${d.name}?`,message:'Decket och dess layout tas bort. Kopplas det in igen känns det igen som nytt, med standardlayouten.',button:'Glöm',action:async()=>!!await run('remove',{serial:s},()=>say(`${d.name} är glömt.`))});
  });
  root.addEventListener('click',e=>{if(e.target.closest('[data-connect]'))deck?.connect(true);});
  root.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='sda-preview'){deck?.preview(serial,t.checked?layout:null);return say(t.checked?'Decket visar utkastet tills du slutar redigera eller tar bort bocken.':'Decket visar sin aktiva layout igen.');}
    if(t.dataset.import!==undefined){
      const file=t.files[0],s=t.closest('[data-card]').dataset.card,d=entry(s);t.value='';if(!file)return;
      file.text().then(text=>{
        const parsed=validateLayout(JSON.parse(text),{pluppIds:pluppar().map(p=>p.id)});
        return run('save',{serial:s,layout:parsed.model===d.model?parsed:changeModel(parsed,d.model)},()=>say(`Layouten är inläst som utkast på ${d.name}${parsed.model===d.model?'':`, anpassad från ${MODELS[parsed.model].name} till ${MODELS[d.model].name}`}.`));
      }).catch(e=>say('Filen kunde inte läsas in: '+(e instanceof SyntaxError?'den är inte en layoutfil.':e.message),true));
      return;
    }
    if(t.dataset.copy!==undefined&&t.value){const s=t.closest('[data-card]').dataset.card,from=entry(t.value),to=entry(s);return run('copy',{serial:s,from:t.value},()=>say(`Layouten från ${from.name} är kopierad till ${to.name} som utkast.`));}
    if(t.dataset.rename!==undefined){const s=t.closest('[data-card]').dataset.card,name=t.value.trim();if(name&&name!==entry(s).name)run('rename',{serial:s,name},()=>say('Decket heter nu '+name+'.'));else t.value=entry(s).name;return;}
    if(t.id==='sda-turn-filter'){const [filter,lineId]=t.value.split(/:(.*)/s);return changeKey({filter,lineId:lineId||undefined});}
    if(t.id==='sda-turn-slot')return changeKey({slot:Number(t.value)});
    if(t.id==='sda-turn-details')return changeKey({details:t.checked?undefined:false});
    if(t.id==='sda-line')return changeKey({lineId:t.value});
    if(t.id==='sda-role')return changeKey({role:t.value});
    if(t.id==='sda-target')return changeKey({target:Number(t.value)});
    if(t.id==='sda-nav')return changeKey({to:t.value});
    if(t.id==='sda-hold')return changeKey({hold:t.checked?Number($('hold-time').value)||1000:undefined});
    if(t.id==='sda-hold-time')return changeKey({hold:Number(t.value)});
  });
  root.addEventListener('input',e=>{
    const t=e.target;
    if(t.id==='sda-search')return renderPalette();
    if(t.id==='sda-label')return changeKey({label:t.value.trim()||undefined},{props:false});
    if(t.id==='sda-page-name'){commit(renamePage(layout,page,t.value),{props:false});return;}
  });
  root.addEventListener('keydown',e=>{
    if(e.target.matches?.('[data-rename]')&&e.key==='Enter'){e.target.blur();return;}
    const cell=e.target.closest?.('[data-cell]');if(!cell)return;
    const i=Number(cell.dataset.cell),n=layout.pages[page].keys.length,c=cols();
    const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-c,ArrowDown:c}[e.key];
    if(step!=null){e.preventDefault();const j=i+step;if(j<0||j>=n)return;if(e.altKey&&layout.pages[page].keys[i]){selected=j;commit(moveKey(layout,{page,index:i},{page,index:j}));}else{selected=j;render();}root.querySelector(`[data-cell="${j}"]`)?.focus();return;}
    if((e.key==='Delete'||e.key==='Backspace')&&layout.pages[page].keys[i]){e.preventDefault();selected=i;commit(setKey(layout,page,i,null));root.querySelector(`[data-cell="${i}"]`)?.focus();return;}
    if(e.key==='Escape'&&selected!=null){selected=null;render();}
  });
  // ---- drag and drop (pointer events: mouse, pen and touch alike) -----------
  root.addEventListener('pointerdown',e=>{
    if(e.button!==0||!layout||overview)return;
    const item=e.target.closest('[data-palette]'),cell=e.target.closest('[data-cell]'),tab=e.target.closest('[data-page-tab]');
    if(item)drag={kind:'palette',key:paletteKeys.get(item.dataset.palette),label:item.textContent};
    else if(cell&&layout.pages[page].keys[Number(cell.dataset.cell)])drag={kind:'cell',from:{page,index:Number(cell.dataset.cell)},canvas:cell.querySelector('canvas')};
    else if(tab)drag={kind:'tab',page:Number(tab.dataset.pageTab),label:tab.textContent};
    else return;
    Object.assign(drag,{x:e.clientX,y:e.clientY,pointer:e.pointerId,active:false,target:null});
  });
  function targetAt(x,y){
    const el=document.elementFromPoint(x,y);if(!el||!root.contains(el))return null;
    const cell=el.closest('[data-cell]'),tab=el.closest('[data-page-tab]'),palette=el.closest('#sda-palette');
    if(drag.kind==='tab')return tab?{kind:'tab',el:tab,page:Number(tab.dataset.pageTab)}:null;
    if(cell)return {kind:'cell',el:cell,index:Number(cell.dataset.cell)};
    if(tab)return {kind:'tab',el:tab,page:Number(tab.dataset.pageTab)};
    if(palette&&drag.kind==='cell')return {kind:'palette',el:palette};
    return null;
  }
  window.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    if(!drag.active){
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
      drag.active=true;root.classList.add('sda-dragging');
      const ghost=document.createElement('div');ghost.className='sda-ghost';
      if(drag.canvas){const copy=document.createElement('canvas');copy.width=copy.height=PX;copy.getContext('2d').drawImage(drag.canvas,0,0);ghost.append(copy);}else ghost.textContent=drag.label;
      document.body.append(ghost);drag.ghost=ghost;
    }
    e.preventDefault();drag.ghost.style.transform=`translate(${e.clientX+10}px,${e.clientY+10}px)`;
    const target=targetAt(e.clientX,e.clientY);
    if(drag.target?.el!==target?.el){drag.target?.el.classList.remove('sda-target');target?.el.classList.add('sda-target');}
    drag.target=target;
  },{passive:false});
  function endDrag(e,drop){
    if(!drag||e.pointerId!==drag.pointer)return;
    const d=drag;drag=null;d.ghost?.remove();d.target?.el.classList.remove('sda-target');root.classList.remove('sda-dragging');
    if(!d.active||!drop)return;
    suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
    const t=d.target;if(!t)return;
    if(d.kind==='tab'){if(t.page===d.page)return;const next=movePage(layout,d.page,t.page);page=t.page;selected=null;return commit(next);}
    if(d.kind==='palette'){if(!d.key)return;const k=d.key.type==='page'?{...d.key,target:page===0&&layout.pages.length>1?1:0}:d.key;return t.kind==='cell'?place(k,{to:t.index}):place(k,{to:null,onPage:t.page});}
    if(t.kind==='palette'){selected=null;return commit(setKey(layout,d.from.page,d.from.index,null));}
    if(t.kind==='cell'){selected=t.index;return commit(moveKey(layout,d.from,{page,index:t.index}));}
    if(t.kind==='tab'){if(t.page===d.from.page)return;const index=firstFree(layout,t.page);if(index<0)return say(`Sidan ${layout.pages[t.page].name} är full.`,true);const next=moveKey(layout,d.from,{page:t.page,index});page=t.page;selected=index;return commit(next);}
  }
  window.addEventListener('pointerup',e=>endDrag(e,true));
  window.addEventListener('pointercancel',e=>endDrag(e,false));
  // ---- workspace ------------------------------------------------------------
  registerAdminWorkspace(HASH,root,{dirty:()=>pending||!!saving});
  function left(){if(!location.hash.startsWith(HASH)){for(const d of decks())if(deck?.previewing?.(d.serial))deck.preview(d.serial,null);$('preview').checked=false;}}
  window.addEventListener('hashchange',()=>{left();if(visible()){sync();render();}});
  const open=document.getElementById('streamdeck-layout-edit');if(open)open.onclick=()=>{location.hash=HASH;};
  function summary(){
    const node=document.getElementById('streamdeck-layout-summary');if(!node||!view)return;
    const list=decks();node.textContent=list.length?list.map(d=>`${d.name}: ${d.draft?'utkast':d.active?'egen layout version '+d.activeVersion:'standardlayouten'}`).join(' · '):'Inga deck ännu. Ett deck känns igen när det ansluts.';
  }
  let lastSignature='';
  return {
    update(next){accept(next);summary();if(!visible()||drag?.active)return;
      // Live state changes only repaint; a new layout or deck re-renders, but never the field being typed in.
      const signature=JSON.stringify([view.revision,Object.keys(view.decks),serial,overview,!!layout]);
      if(signature!==lastSignature){lastSignature=signature;render({props:!$('props').contains(document.activeElement)});}
      else{renderHead();if(overview)renderOverview();else{repaint();renderPalette();}}
    },
    devices(){if(visible()&&view){renderHead();if(overview)renderOverview();}}
  };
}
