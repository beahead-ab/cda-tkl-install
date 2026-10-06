// Stream Deck key layout and key appearance, kept free of DOM and WebHID so it
// can be tested. Page 0 holds the operating keys followed by pluppar; every
// further page starts with the page key. Appearance mirrors the track plan's
// own classes, so a key never shows a state the panel does not.
export const SYSTEM_KEYS=[
  {id:'page',title:'Sida'},
  {id:'all-stop',title:'Alla signaler i stopp'},
  {id:'reset-ais',title:'Återställ stopp'},
  {id:'panel-reset',title:'Återställ panel',caption:'håll 1 s'},
  {id:'cancel',title:'Avbryt val'},
  // Not on the automatic layout: placed by hand where the ranger's requests are answered.
  {id:'yard-authority',title:'Rangerbegäran',optional:true}
];
export const COLORS={background:'#141413',free:'#d8d6cc',route:'#67df8d',held:'#ecc074',occupied:'#ff6067',choice:'#fff5bd',destination:'#9ad0ff',preparing:'#cbb876',text:'#efefed',muted:'#7d8791'};
const collator=new Intl.Collator('sv',{numeric:true});
export function orderPluppar(pluppar){
  return [...pluppar].sort((a,b)=>(a.kind==='shunt')-(b.kind==='shunt')||collator.compare(a.label,b.label));
}
export function buildPages(pluppar,keyCount,lines=[]){
  const ordered=orderPluppar(pluppar),pages=[];let i=0;
  const first=SYSTEM_KEYS.filter(k=>!k.optional).map(({optional,...k})=>({type:'system',...k}));
  // One departure and one arrival key per line toward a neighbouring station.
  for(const line of lines)for(const role of ['departure','arrival'])if(first.length<keyCount)first.push({type:'train',role,lineId:line.id,neighborId:line.neighborId,neighborName:line.neighborName,neighborCode:line.neighborCode||''});
  while(first.length<keyCount&&i<ordered.length)first.push({type:'plupp',...ordered[i++]});
  pages.push(first.slice(0,keyCount));
  while(i<ordered.length){const page=[{type:'system',...SYSTEM_KEYS[0]}];while(page.length<keyCount&&i<ordered.length)page.push({type:'plupp',...ordered[i++]});pages.push(page);}
  return pages;
}
export function pluppSpec(key,classes,phase){
  const has=c=>classes.has(c);
  return {
    kind:'plupp',title:key.label,lines:splitLabel(key.label),caption:key.kind==='shunt'?'växeltågväg':'',
    fill:phase==='occupied'?COLORS.occupied:phase==='held'?COLORS.held:has('in-route')?COLORS.route:COLORS.free,
    ring:has('route-choice-start')||has('route-choice-end')?COLORS.choice:has('route-destination')?COLORS.destination:'',
    dim:has('choice-disabled')||has('unavailable'),blink:has('route-preparing'),blocked:has('line-is-blocked')
  };
}
export function systemSpec(key,{stopAll=false,chosen=false,page=0,pages=1,remote=false,yard=null}={}){
  const base={kind:'system',id:key.id,title:key.title,lines:splitLabel(key.title),caption:key.caption||'',fill:'',ring:'',dim:false,blink:false,blocked:false};
  if(key.id==='page')return {...base,title:`Sida ${page+1}/${pages}`,lines:['Sida',`${page+1} / ${pages}`],dim:pages<2};
  if(key.id==='all-stop')return {...base,fill:stopAll?COLORS.occupied:'',caption:stopAll?'aktiv':''};
  if(key.id==='reset-ais')return {...base,dim:!stopAll};
  if(key.id==='cancel')return {...base,dim:!chosen};
  if(key.id==='panel-reset')return {...base,dim:remote};
  // Rangerbegäran: blinks with the request waiting for TKL, shows the group lying out, dim when idle.
  if(key.id==='yard-authority')return {...base,lines:['Ranger-','begäran'],caption:yard?.open||yard?.laid||'',blink:!!yard?.open,fill:yard?.open?COLORS.held:'',dim:!yard||(!yard.open&&!yard.laid)};
  return base;
}
export function splitLabel(text){
  const words=String(text).split(' ');if(words.length<2)return [text];
  const mid=Math.ceil(words.length/2);return [words.slice(0,mid).join(' '),words.slice(mid).join(' ')];
}
export const signature=(spec,blinkOn)=>JSON.stringify(spec)+(spec.blink?blinkOn?'1':'0':'');
