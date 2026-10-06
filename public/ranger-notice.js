// TKL's side of the ranger's requests (docs/rangerlage.md): what the status bar says,
// which buttons it carries and which turnouts the plan lights up. Presentation only;
// app.js sends the answers. A request waiting for TKL comes before groups lying out.
export function rangerView(yard){
  const requests=yard?.requests||[],groups=new Map((yard?.groups||[]).map(g=>[g.id,g]));
  const open=requests.find(r=>r.state==='open'),laid=requests.filter(r=>r.state==='laid');
  const points=new Map();
  for(const r of requests)for(const name of Object.keys(groups.get(r.group)?.out||{}))if(r.state==='open'||!points.has(name))points.set(name,r.state==='open'?'ranger-request':'ranger-laid');
  if(open)return {text:`Rangeraren begär ${open.label}`,tone:'warn',actions:[{label:'Godkänn',command:'answer',id:open.id,approved:true},{label:'Neka',command:'answer',id:open.id,approved:false}],points};
  if(laid.length)return {text:`${laid.map(r=>r.label).join(', ')} ligger ute för rangeraren`,tone:'on',actions:laid.map(r=>({label:laid.length>1?'Dra tillbaka '+r.label:'Dra tillbaka',command:'withdraw',id:r.id})),points};
  return {text:'',tone:'',actions:[],points};
}
