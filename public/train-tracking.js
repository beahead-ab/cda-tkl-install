// Tågspårningen på ställverket (0.73.0, bara i simulering): varje spårat tåg som en skylt vid sin front med pil
// åt det håll det kör, tåg på linjen vid kanterna (på väg in enligt TrainMeet, eller på väg ut) och en rad per tåg
// under Drift → Tågnummer. En skylt med ? är osäker; ett klick rättar eller bekräftar numret. Bara presentation.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SVG='http://www.w3.org/2000/svg';
const RIGHT=new Set(['Bu','Bn','D']);
// Var ett block ligger i planen: mitten av dess längsta spårbit, annars växelns mittpunkt.
export function blockPositions(panel){
  const out={},best={};
  for(const s of panel.segs||[]){if(!s.b)continue;const length=Math.hypot(s.x2-s.x1,s.y2-s.y1);if(!(best[s.b]>=length)){best[s.b]=length;out[s.b]={x:(s.x1+s.x2)/2,y:(s.y1+s.y2)/2};}}
  for(const t of Object.values(panel.turnouts||{}))if(t.block&&!out[t.block])out[t.block]={x:t.cx,y:t.cy};
  return out;
}
export function createTrainTracking({plan,panel,controls,api,message,displayName=(k,n)=>n}){
  if(!plan)return null;
  const positions=blockPositions(panel),node=(tag,attrs,parent,text)=>{const n=document.createElementNS(SVG,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
  const layer=node('g',{id:'train-tracking-layer'},plan);
  const host=document.getElementById('train-information');
  const list=document.createElement('section');list.id='tracking-list';list.className='tracking-list';list.hidden=true;host?.prepend(list);
  const dialog=document.createElement('dialog');dialog.className='incoming-train-menu tracking-menu';dialog.setAttribute('aria-label','Spårat tåg');
  dialog.innerHTML='<h2></h2><p data-tracking-place></p><label>Tågnummer<input data-tracking-number maxlength="24" autocomplete="off"></label><button data-tracking-save class="primary">Spara och bekräfta</button><button data-tracking-remove>Ta bort ur spårningen</button><p data-tracking-message role="status"></p><button data-tracking-close>Stäng</button>';
  document.body.append(dialog);
  let view=null,online=false,selected=null,last='';
  const $d=s=>dialog.querySelector(s);
  const place=t=>t.state==='ghost'?'Senast sedd vid '+displayName('blocks',t.head):'Vid '+displayName('blocks',t.head)+(t.route?' · tågväg '+t.route:'');
  function open(id){
    const t=view?.trains.find(x=>x.id===id);if(!t)return;selected=id;
    $d('h2').textContent=t.number?'Tåg '+t.number:'Okänt tåg '+t.label;
    $d('[data-tracking-place]').textContent=place(t)+'. '+(t.certain?'Numret kommer från '+t.source+'.':'Numret är osäkert: ange eller bekräfta det.');
    $d('[data-tracking-number]').value=t.number||'';$d('[data-tracking-message]').textContent='';
    dialog.showModal();$d('[data-tracking-number]').focus();
  }
  $d('[data-tracking-close]').onclick=()=>dialog.close();
  $d('[data-tracking-save]').onclick=async()=>{const answer=await api('tracking/name',{id:selected,number:$d('[data-tracking-number]').value});if(answer){view=answer;draw();dialog.close();message('Tågnumret är sparat.',{error:false,duration:3000});}};
  $d('[data-tracking-remove]').onclick=async()=>{const answer=await api('tracking/remove',{id:selected});if(answer){view=answer;draw();dialog.close();}};
  dialog.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-tracking-number]')){e.preventDefault();$d('[data-tracking-save]').click();}});
  layer.addEventListener('click',e=>{const g=e.target.closest('[data-tracking-train]');if(g)open(g.dataset.trackingTrain);});
  layer.addEventListener('keydown',e=>{const g=e.target.closest('[data-tracking-train]');if(g&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(g.dataset.trackingTrain);}});
  // En skylt: nummer och pil i en ruta, ovanför spåret.
  function tag(parent,{x,y,text,cls,id,title,anchor='middle'}){
    const g=node('g',{class:'tracking-tag '+cls,transform:`translate(${Math.round(x)} ${Math.round(y)})`,...(id?{'data-tracking-train':id,role:'button',tabindex:'0'}:{})},parent);
    const width=Math.max(34,text.length*9.6+16),left=anchor==='end'?-width:anchor==='start'?0:-width/2;
    node('rect',{x:left,y:-13,width,height:24,rx:4},g);node('text',{x:left+width/2,y:5,'text-anchor':'middle'},g,text);node('title',{},g,title);
    return g;
  }
  function draw(){
    const key=JSON.stringify([view,online]);if(key===last)return;last=key;
    layer.replaceChildren();
    const enabled=!!view?.enabled;layer.style.display=enabled?'':'none';list.hidden=!enabled;
    if(!enabled){list.innerHTML='';return;}
    for(const t of view.trains){
      const head=positions[t.head];if(!head)continue;
      const previous=positions[t.blocks.at(-2)]||null,dx=previous?head.x-previous.x:0;
      const arrow=t.state==='ghost'?'':dx>4?' →':dx<-4?'← ':'';
      const label=(t.number||t.label)+(t.certain||String(t.label).startsWith('?')?'':'?');
      const text=arrow.startsWith('←')?arrow+label:label+arrow;
      tag(layer,{x:head.x,y:head.y-30,text,cls:(t.certain?'':'uncertain ')+(t.state==='ghost'?'ghost':''),id:t.id,title:(t.number?'Tåg '+t.number:'Okänt tåg')+'. '+place(t)+(t.certain?'':'. Osäkert, klicka för att ange numret.')});
    }
    // Linjerna: på väg in vid infartsspåret, på väg ut vid spåret tåget lämnade på. Flera tåg staplas.
    const stack={};
    for(const l of view.lines){
      const control=controls.find(c=>c.sensor==='htv'+l.edge);if(!control)continue;
      const right=RIGHT.has(l.edge),n=stack[l.edge]=(stack[l.edge]||0)+1,inward=l.direction==='in';
      const name=l.number||l.label,arrow=(right?!inward:inward)?'→':'←',text=arrow==='←'?'← '+name:name+' →';
      tag(layer,{x:control.centerX+(right?18:-18),y:control.centerY+28*n,anchor:right?'start':'end',text,cls:'line '+(inward?'incoming':'outgoing'),title:`Tåg ${name} ${inward?'på väg in från':'på väg ut mot'} ${l.neighbor||'linje '+l.line}${l.state==='reserved'?' (klarerat, inte avgått)':''}.`});
    }
    const rows=view.trains.map(t=>`<li class="${t.certain?'':'uncertain'}"><button type="button" data-tracking-open="${esc(t.id)}">${esc(t.number||t.label)}${t.certain?'':' ?'}</button><span>${esc(place(t))}</span><small>${esc(t.certain?t.source:'osäkert')}</small></li>`).join('');
    const lines=view.lines.map(l=>`<li class="line"><strong>${esc(l.number||l.label)}</strong><span>${l.direction==='in'?'På väg in från':'På väg ut mot'} ${esc(l.neighbor||'linje '+l.line)}</span><small>${esc(l.edge)}</small></li>`).join('');
    list.innerHTML=`<h4>Spårade tåg <small>simulering · ur spåravkänningen</small></h4>${rows||lines?`<ul>${rows}${lines}</ul>`:'<p class="muted">Inga tåg på stationen eller linjerna just nu.</p>'}`;
  }
  list.addEventListener('click',e=>{const b=e.target.closest('[data-tracking-open]');if(b)open(b.dataset.trackingOpen);});
  return {update(next,isOnline){view=next||null;online=isOnline;draw();}};
}
