// Presentation only: permissions and all turnout orders stay in the server.
export function createManualFeedback({config, plan, scroll, panelView, stateOf, online, isBlocked, esc, revealPlan=()=>{}}) {
  const box=document.createElement('aside');
  box.className='manual-feedback';box.hidden=true;box.setAttribute('aria-label','Manuell växelmanöver');
  box.innerHTML='<div id="manual-feedback-body" role="status" aria-live="polite" aria-atomic="true"></div>';
  panelView.append(box);
  const body=box.querySelector('#manual-feedback-body');
  const layer=document.createElementNS(plan.namespaceURI,'g');layer.setAttribute('pointer-events','none');layer.setAttribute('aria-hidden','true');plan.append(layer);
  const markers=new Map(),positions=new Map(),controls=[];
  let selected=null,requested=null,failure=null,rendered='';
  const namesFor=name=>[name,...(config.coupled?.[name]||[]).filter(n=>n!==name)];
  const active=()=>selected;
  function clear() {selected=requested=failure=null;update();}
  body.onclick=e=>{
    const name=e.target.closest('[data-show-turnout]')?.dataset.showTurnout;
    const marker=markers.get(name);if(!marker)return;
    const nameBeforeNavigation=active();revealPlan();selected=nameBeforeNavigation;update();
    marker.scrollIntoView({block:'center',inline:'center',behavior:'instant'});update();
  };
  function visible(name) {
    const marker=markers.get(name);if(!marker)return false;
    const r=marker.getBoundingClientRect(),clip=scroll.getBoundingClientRect(),cover=box.getBoundingClientRect();
    if(!r.width||!r.height||!clip.width||!clip.height)return false;
    const inside=r.left>=Math.max(0,clip.left)&&r.right<=Math.min(innerWidth,clip.right)&&r.top>=Math.max(0,clip.top)&&r.bottom<=Math.min(innerHeight,clip.bottom);
    const covered=!box.hidden&&r.right>cover.left&&r.left<cover.right&&r.bottom>cover.top&&r.top<cover.bottom;
    return inside&&!covered;
  }
  function update() {
    const name=active(),state=stateOf(),names=name?namesFor(name):[];
    for(const [n,marker] of markers){marker.style.display=names.includes(n)?'':'none';marker.classList.toggle('manual-primary',n===name);}
    for(const c of controls)c.node.classList.toggle('manual-related',c.names.some(n=>names.includes(n)));
    box.hidden=!name||!state;if(box.hidden)return;
    const connected=online()&&state.connection==='connected';
    const policy=state.manual?.[name],companions=names.slice(1);
    const pending=selected===name&&requested,orderFailure=selected===name&&failure;
    const canMove=connected&&!state.storageFault&&policy?.allowed===true;
    const reason=!connected?'Panelen saknar aktuell kontakt med anläggningen.':state.storageFault?'Lagringsfel · manövrering spärrad.':policy?.reason||'Ingen verifierad manöverregel är ansluten.';
    const moving=connected&&pending&&reason.includes('växelläge')&&names.some(n=>{const s=state.turnouts[n];return s?.desired===pending&&s.position==='unknown'&&state.serverTime-s.commandAt<=config.commandTimeoutMs;});
    box.dataset.status=orderFailure?'blocked':moving?'moving':canMove?'ready':'blocked';
    const unknownPeer=companions.find(n=>state.blocks[config.turnouts[n]?.block]?.occupied==null);
    const unknownReason=unknownPeer&&reason.includes('saknar aktuell återrapport')?`Kan inte bekräfta att kompisväxelns spår är fritt (${config.turnouts[unknownPeer].block}).`:reason;
    const status=orderFailure?'Manövern kunde inte bekräftas · '+orderFailure:moving?'Omläggning pågår · inväntar återrapporter.':canMove?'Manöver möjlig · skyddsvillkoren är uppfyllda.':'Manöver spärrad · '+unknownReason;
    const rows=names.map(n=>{
      const t=config.turnouts[n],s=state.turnouts[n],block=t?.block,occupied=connected?state.blocks[block]?.occupied:null;
      const position=connected?({C:'Rakt',T:'Avvikande'}[s?.position]||'Okänt / omläggning'):'Okänt läge';
      const locked=state.routes.some(r=>r.turnouts[n]);
      const programming=n==='Vx133'&&state.operating?.programming?.reserved;
      const blocked=block&&isBlocked(block),outside=!visible(n);
      const track=!block?'Spår saknar återrapport':`${block}: ${occupied===true?'belagt':occupied===false?'fritt':'okänt'}`;
      return `<li><span><strong>${esc(n)}</strong>${n!==name?' · kompis':''}<br>${esc(position)} · ${esc(track)}${locked?' · tågvägslåst':''}${programming?' · programmeringsspärr':''}${blocked?' · spärrat':''}${outside?' · utanför vyn':''}</span>${outside&&markers.has(n)?`<button type="button" data-show-turnout="${esc(n)}">Visa ${esc(n)}</button>`:''}</li>`;
    }).join('');
    const content=`<strong>Manuell växelmanöver · ${esc(name)}</strong><p>${companions.length?`Manövern påverkar även ${esc(companions.join(', '))}.`:'Ingen automatisk kompismanöver är kopplad.'}${pending?` Begärt läge: ${pending==='C'?'rakt':'avvikande'}.`:''}</p><ul>${rows}</ul><p class="manual-feedback-status">${esc(status)}</p>`;
    if(content!==rendered){body.innerHTML=content;rendered=content;}
  }
  function addTurnout(t) {
    const marker=document.createElementNS(plan.namespaceURI,'circle');
    marker.setAttribute('cx',t.cx);marker.setAttribute('cy',t.cy);marker.setAttribute('r',19);marker.setAttribute('class','manual-marker');marker.setAttribute('data-manual-marker',t.name);marker.style.display='none';
    layer.append(marker);markers.set(t.name,marker);positions.set(t.name,t);
  }
  function addControl(node,names,x,y) {
    if(!names.length)return;
    const nearest=names.filter(n=>positions.has(n)).sort((a,b)=>Math.hypot(positions.get(a).cx-x,positions.get(a).cy-y)-Math.hypot(positions.get(b).cx-x,positions.get(b).cy-y))[0]||names[0];
    const group=namesFor(nearest),peers=group.filter(n=>n!==nearest);
    const label=`Manövrera växel ${nearest}${peers.length?' · påverkar även '+peers.join(', '):''}`;
    node.setAttribute('aria-label',label);
    controls.push({node,names:group});return nearest;
  }
  scroll.addEventListener('scroll',update,{passive:true});
  window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
  new ResizeObserver(update).observe(box);
  return {addTurnout,addControl,update,clear,
    select(name){selected=name;requested=failure=null;update();},
    order(name,position){if(selected!==name)return;requested=position;failure=null;update();},
    failed(reason){requested=null;failure=reason||'Kontrollera kontakten och återrapporterna.';update();}
  };
}
