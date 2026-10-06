// The ranger's own view (docs/rangerlage.md, step 3): the request buttons in the panel's
// console row and the chip beside CHARLOTTENDAL that says where a request stands. The
// view is the same track plan; app.js dims what is outside the ranger's area and sends
// the ranger's moves through /api/ranger/. Presentation only; app.js sends.
export const GROUP_SHORT={'left-11':'Vänster 11','left-12':'Vänster 12','left-13':'Vänster 13','right-11':'Höger 11','right-12':'Höger 12','right-13':'Höger 13','six-154':'Spår 6 ut','3d-left':'3d ut'};
// What the ranger's chip says: the request waiting for TKL (with Ångra), or the group lying out (with Lägg tillbaka).
export function rangerOwnView(yard){
  const requests=yard?.requests||[],open=requests.find(r=>r.state==='open'),laid=requests.filter(r=>r.state==='laid');
  if(open)return {text:`${open.label} begärd · väntar på TKL`,tone:'warn',actions:[{label:'Ångra',command:'return',id:open.id}]};
  if(laid.length)return {text:`${laid.map(r=>r.label).join(', ')} ligger ute`,tone:'on',actions:laid.map(r=>({label:laid.length>1?'Lägg tillbaka '+r.label:'Lägg tillbaka',command:'return',id:r.id}))};
  return {text:'',tone:'',actions:[]};
}
// One button per request group at the top of the events column: idle (enabled when the
// kernel says it can be made, the reason as tooltip otherwise), waiting for TKL, or lying out.
export function createRangerBar({root,api}){
  if(!root)return null;
  const bar=document.createElement('div');bar.id='ranger-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Rangerarens begäran');root.prepend(bar);
  const row=(id,text)=>{const r=document.createElement('div');r.className='ranger-row';r.id=id;const label=document.createElement('span');label.className='ranger-bar-label';label.textContent=text;r.append(label);bar.append(r);return r;};
  // Växelgator first: the ranger's own moves. Then what is asked of TKL.
  const paths=row('ranger-paths','Växelgator'),groups=row('ranger-groups','Begär av TKL');
  let last='';
  bar.addEventListener('click',e=>{const b=e.target.closest('button[data-group],button[data-path]');if(!b||b.disabled)return;if(b.dataset.path)api('ranger/path',{id:b.dataset.path});else api('ranger/request',{group:b.dataset.group});});
  const chip=(text)=>{const b=document.createElement('button');b.type='button';b.className='chip';b.innerHTML='<i class="chip-dot" aria-hidden="true"></i><span></span>';b.querySelector('span').textContent=text;return b;};
  return {update(state,online){
    const yard=state?.yard,list=yard?.groups||[],chains=yard?.paths||[];
    const key=JSON.stringify([online,list.map(g=>[g.id,g.state,g.can?.allowed,g.can?.reason]),chains.map(p=>[p.id,p.laid,p.can?.allowed,p.can?.reason])]);
    if(key===last)return;last=key;
    bar.querySelectorAll('button').forEach(b=>b.remove());
    paths.hidden=!chains.length;
    for(const p of chains){
      const b=chip(p.short||p.label);b.dataset.path=p.id;b.dataset.state=p.laid?'laid':'idle';b.dataset.tone=p.laid?'on':'';
      b.disabled=!online||!p.can?.allowed;
      b.title=p.laid?p.label+': gatan ligger.':p.can?.allowed?'Lägg gatan till '+p.label+'.':p.can?.reason||'';
      paths.append(b);
    }
    for(const g of list){
      const b=chip(GROUP_SHORT[g.id]||g.short||g.label);b.dataset.group=g.id;b.dataset.state=g.state;
      b.disabled=!online||g.state!=='idle'||!g.can?.allowed;
      b.title=g.state==='open'?g.label+' är begärd. TKL svarar.':g.state==='laid'?g.label+' ligger ute. Lägg tillbaka i statusraden.':g.can?.allowed?'Begär '+g.label+' av TKL.':g.can?.reason||'';
      b.dataset.tone=g.state==='open'?'warn':g.state==='laid'?'on':'';
      groups.append(b);
    }
  }};
}
