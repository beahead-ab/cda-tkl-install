// Navigation model for the Inställningar window. Pure data, so the rail,
// the tab rows and the page titles stay consistent and can be tested without a DOM.
// Every existing #-address is kept; only the presentation groups them. The old Drift
// pages (#tools/operations…) open the Drift tab in the signal box's bottom row.
// Three groups, as in TrainMeet Server's Inställningar (docs/installningar-plan.md):
// what the meet shares, what only this computer has, and the station's description.
export const NAVIGATION_GROUPS=[
  {key:'traffen',label:'Träffen'},
  {key:'datorn',label:'Den här datorn'},
  {key:'anlaggningen',label:'Anläggningen'}
];
export const NAVIGATION_SECTIONS=[
  // TrainMeet is the only timetable; the old #import pages lead here.
  {group:'traffen',hash:'#trainmeet',label:'TrainMeet',id:'trainmeet-tab',title:'TrainMeet',status:'menu-trainmeet-status',tabs:[]},
  {group:'traffen',hash:'#tools/journal',label:'Händelser',id:'journal-tab',title:'Händelser',tabs:[]},
  {group:'datorn',hash:'#advanced/start',label:'Kom igång',id:'start-tab',title:'Kom igång',status:'start-status',tabs:[]},
  {group:'datorn',hash:'#tools/appearance',label:'Utseende och ljud',id:'tools-tab',title:'Utseende och ljud',tabs:[]},
  {group:'datorn',hash:'#tools/streamdeck',label:'Stream Deck',id:'streamdeck-tab',title:'Elgato Stream Deck',tabs:[
    {hash:'#tools/streamdeck',label:'Anslutning'},
    {hash:'#tools/streamdeck/layout',label:'Layout',title:'Stream Deck-layout'}]},
  {group:'datorn',hash:'#advanced/protocol',label:'Banan (LocoNet)',id:'loconet-tab',title:'Banan (LocoNet)',tabs:[
    {hash:'#advanced/protocol',label:'Protokollinspelning'},
    {external:'field-link',label:'Simulator ↗'}]},
  {group:'datorn',hash:'#advanced/ai',label:'AI-tjänst',id:'ai-tab',title:'AI-tjänst',tabs:[]},
  {group:'datorn',hash:'#advanced/users',label:'Användare',id:'users-tab',title:'Användare',tabs:[]},
  {group:'datorn',hash:'#advanced/update',label:'Uppdatering',id:'update-tab',title:'Uppdatera TKL',tabs:[]},
  // Everything about the station lives in Studio (0.71.0): the group is one link out of Inställningar.
  {group:'anlaggningen',href:'/studio.html',label:'Studio',id:'admin-tab',title:'Studio',tabs:[]}
];
// Pages that only led on to others: they open their first real page instead.
export const REDIRECTS={'#advanced':'#advanced/start','#tools':'#tools/appearance'};
// The old Anläggning pages and where they live in Studio. Bookmarks, the docs and the panel's
// object links keep working: each old address opens its Studio page.
export const STUDIO_ROUTES=[
  ['#register/station','#konfigurera'],['#register/destinations','#konfigurera/orter'],['#register/presentation','#konfigurera/visning'],
  ['#register/bindings','#driftsattning/bindningar'],['#advanced/xml','#data/kalla'],['#advanced/migration','#genomgang/inforande'],['#register','#data/kalla']];
export function studioTarget(hash){
  const [path,query='']=String(hash||'').split('?'),params=new URLSearchParams(query);
  if(path==='#register/object'&&params.get('record'))return '/studio.html#data/kalla?post='+encodeURIComponent(params.get('record'));
  if(path==='#register/station'&&params.get('object'))return '/studio.html#konfigurera?objekt='+encodeURIComponent(params.get('object').replace(/^[a-z]+:/i,''));
  const hit=STUDIO_ROUTES.find(([from])=>path===from||path.startsWith(from+'/'));
  return hit?'/studio.html'+hit[1]:null;
}
const within=(hash,base)=>hash===base||hash.startsWith(base+'/');
// Resolves a location hash to its section, the deepest matching tab and a page title.
export function resolveNavigation(hash){
  const current=String(hash||'#panel').split('?')[0]||'#panel';
  if(current==='#panel')return {section:null,tab:null,exact:false,title:'Ställverk'};
  const section=NAVIGATION_SECTIONS.find(s=>(s.hash&&within(current,s.hash))||(s.members||[]).some(m=>within(current,m)));
  if(!section)return {section:null,tab:null,exact:false,title:'Inställningar'};
  const tab=section.tabs.filter(t=>t.hash&&within(current,t.hash)).sort((a,b)=>b.hash.length-a.hash.length)[0]||null;
  return {section,tab,exact:tab?.hash===current,title:tab?.title||tab?.label||section.title};
}
