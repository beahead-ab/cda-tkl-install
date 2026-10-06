// Spårplanen i Studio: ritad ur panelgeometrin av modulens egen kod, stor och rullbar i sidled, med lager, urval och minikarta.
const NS='http://www.w3.org/2000/svg';
const el=(tag,attrs,parent,text)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!=null)n.setAttribute(k,v);if(text!=null)n.textContent=text;parent?.append(n);return n;};
export function createPlan(host,geo,{onSelect,info=()=>({})}){
  const [vx,vy,vw,vh]=geo.viewBox;
  host.innerHTML='';host.className='st-plan';
  const scroll=document.createElement('div');scroll.className='st-plan-scroll';scroll.tabIndex=0;scroll.setAttribute('aria-label','Spårplan. Rulla i sidled, klicka på ett objekt för att välja det.');
  const svg=el('svg',{viewBox:geo.viewBox.join(' '),role:'group','aria-label':'Charlottendals spårplan'},scroll);
  const minimap=document.createElement('div');minimap.className='st-minimap';const mini=el('svg',{viewBox:geo.viewBox.join(' '),'aria-hidden':'true'},minimap);
  host.append(scroll,minimap);
  const g={rails:el('g',{class:'st-rails'},svg),legs:el('g',{class:'st-rails'},svg),blockLabels:el('g',{class:'st-layer',hidden:''},svg),labels:el('g',{class:'st-layer'},svg),numbers:el('g',{class:'st-layer'},svg),
    signalNames:el('g',{class:'st-layer'},svg),addresses:el('g',{class:'st-layer',hidden:''},svg),modules:el('g',{class:'st-layer',hidden:''},svg),signals:el('g',{},svg),dev:el('g',{class:'st-layer'},svg),hits:el('g',{},svg),sel:el('g',{},svg)};
  for(const s of geo.segments){
    el('line',{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,class:s.road?'st-road':s.undetected?'st-rail st-rail-undetected':'st-rail'},g.rails);
    if(!s.road)el('line',{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,class:'st-hit st-hit-line','data-id':s.block},g.hits);
  }
  for(const l of geo.legs){el('line',{x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,class:l.undetected?'st-rail st-rail-undetected':'st-rail'},g.legs);}
  el('circle',{cx:geo.turntable.cx,cy:geo.turntable.cy,r:geo.turntable.r,class:'st-turntable'},g.rails);
  for(const t of geo.turnouts){
    el('circle',{cx:t.cx,cy:t.cy,r:5,class:'st-node'},g.signals);
    el('text',{x:t.cx,y:t.cy-14,class:'st-number','text-anchor':'middle'},g.numbers,t.name.slice(2));
    const i=info(t.name);if(i.address!=null)el('text',{x:t.cx,y:t.cy+26,class:'st-address','text-anchor':'middle'},g.addresses,String(i.address));
    if(i.module)el('text',{x:t.cx,y:t.cy+40,class:'st-module','text-anchor':'middle'},g.modules,i.module);
    el('circle',{cx:t.cx,cy:t.cy,r:18,class:'st-hit','data-id':t.name},g.hits);
  }
  for(const s of geo.signals){
    el('circle',{cx:s.x,cy:s.y,r:7,class:'st-lamp'},g.signals);
    el('text',{x:s.x+11,y:s.y-9,class:'st-signal-name'},g.signalNames,s.mast);
    const i=info(s.mast);if(i.address!=null)el('text',{x:s.x+11,y:s.y+20,class:'st-address'},g.addresses,String(i.address));
    el('circle',{cx:s.x,cy:s.y,r:14,class:'st-hit','data-id':s.mast},g.hits);
  }
  for(const b of geo.blockLabels)el('text',{x:b.x,y:b.y-8,class:'st-block-label','text-anchor':'middle'},g.blockLabels,b.block);
  for(const l of geo.labels)el('text',{x:l.x,y:l.y,class:'st-label'},g.labels,l.text);
  for(const s of geo.segments)if(!s.road)el('line',{x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,class:'st-mini-rail'},mini);
  for(const l of geo.legs)el('line',{x1:l.x1,y1:l.y1,x2:l.x2,y2:l.y2,class:'st-mini-rail'},mini);
  const view=el('rect',{x:vx,y:vy,width:vw,height:vh,class:'st-mini-view'},mini);
  const miniSel=el('circle',{r:0,class:'st-mini-sel'},mini);
  let width=2600,selected=null;
  const positions=new Map([...geo.turnouts.map(t=>[t.name,{x:t.cx,y:t.cy}]),...geo.signals.map(s=>[s.mast,{x:s.x,y:s.y}]),...geo.blockLabels.map(b=>[b.block,{x:b.x,y:b.y}])]);
  function setWidth(px){width=Math.max(900,Math.min(5000,Math.round(px)));svg.style.width=width+'px';svg.style.height=Math.round(width*vh/vw)+'px';syncView();}
  function syncView(){const f=vw/width;view.setAttribute('x',vx+scroll.scrollLeft*f);view.setAttribute('width',Math.min(vw,scroll.clientWidth*f));view.setAttribute('y',vy+scroll.scrollTop*f);view.setAttribute('height',Math.min(vh,scroll.clientHeight*f));}
  function select(id,{center=false}={}){
    selected=id;g.sel.replaceChildren();const p=positions.get(id);
    if(p){el('circle',{cx:p.x,cy:p.y,r:26,class:'st-ring'},g.sel);miniSel.setAttribute('cx',p.x);miniSel.setAttribute('cy',p.y);miniSel.setAttribute('r',22);}else miniSel.setAttribute('r',0);
    for(const h of g.hits.children)h.classList.toggle('st-hit-selected',h.dataset.id===id);
    if(center&&p){const f=width/vw;scroll.scrollTo({left:(p.x-vx)*f-scroll.clientWidth/2,top:(p.y-vy)*f-scroll.clientHeight/2,behavior:'smooth'});}
  }
  function setLayers(on){for(const [k,node] of Object.entries(g))if(node.classList.contains('st-layer'))node.toggleAttribute('hidden',!on.has(k));}
  function markDeviations({blocks=[],turnouts=[]}){g.dev.replaceChildren();for(const id of [...blocks,...turnouts]){const p=positions.get(id);if(p)el('circle',{cx:p.x,cy:p.y-(blocks.includes(id)?0:0),r:7,class:'st-dev-dot'},g.dev).append(Object.assign(document.createElementNS(NS,'title'),{textContent:id+' · avvikelse'}));}}
  svg.addEventListener('click',e=>{const id=e.target.closest('[data-id]')?.dataset.id;if(id)onSelect(id);});
  svg.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.dataset.id){e.preventDefault();onSelect(e.target.dataset.id);}});
  for(const h of g.hits.children){h.setAttribute('tabindex','0');h.setAttribute('role','button');el('title',{},h,h.dataset.id);}
  scroll.addEventListener('scroll',syncView);new ResizeObserver(syncView).observe(scroll);
  minimap.addEventListener('click',e=>{const r=mini.getBoundingClientRect(),x=vx+(e.clientX-r.left)/r.width*vw,f=width/vw;scroll.scrollTo({left:(x-vx)*f-scroll.clientWidth/2,behavior:'smooth'});});
  let drag=null;scroll.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('[data-id]'))return;drag={x:e.clientX,left:scroll.scrollLeft};scroll.setPointerCapture(e.pointerId);});
  scroll.addEventListener('pointermove',e=>{if(drag)scroll.scrollLeft=drag.left-(e.clientX-drag.x);});scroll.addEventListener('pointerup',()=>{drag=null;});
  setWidth(width);
  return {setWidth,width:()=>width,fit:()=>setWidth(scroll.clientWidth-2),select,setLayers,markDeviations,selected:()=>selected};
}
