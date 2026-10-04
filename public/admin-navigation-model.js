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
  {group:'datorn',hash:'#tools/appearance',label:'Utseende och ljud',id:'tools-tab',title:'Utseende och ljud',tabs:[]},
  {group:'datorn',hash:'#tools/streamdeck',label:'Stream Deck',id:'streamdeck-tab',title:'Elgato Stream Deck',tabs:[
    {hash:'#tools/streamdeck',label:'Anslutning'},
    {hash:'#tools/streamdeck/layout',label:'Layout',title:'Stream Deck-layout'}]},
  {group:'datorn',hash:'#advanced/protocol',label:'Banan (LocoNet)',id:'loconet-tab',title:'Banan (LocoNet)',tabs:[
    {hash:'#advanced/protocol',label:'Protokollinspelning'},
    {external:'field-link',label:'Simulator ↗'}]},
  {group:'datorn',hash:'#advanced/update',label:'Uppdatering',id:'update-tab',title:'Uppdatera TKL',tabs:[]},
  // #advanced itself, the old overview page, now opens the register.
  {group:'anlaggningen',hash:'#register',label:'Anläggning',id:'admin-tab',title:'Anläggningsregister',members:['#advanced'],tabs:[
    {hash:'#register',label:'Anläggningsregister'},
    {hash:'#register/station',label:'Anläggningsöversikt'},
    {hash:'#register/destinations',label:'Orter och telefon',title:'Orter och telefonnummer'},
    {hash:'#register/presentation',label:'Visningsinställningar'},
    {hash:'#register/bindings',label:'Driftinställningar'},
    {hash:'#advanced/xml',label:'XML-granskning'},
    {hash:'#advanced/migration',label:'Införandestatus'}]}
];
// Pages that only led on to others: they open their first real page instead.
export const REDIRECTS={'#advanced':'#register','#tools':'#tools/appearance'};
const within=(hash,base)=>hash===base||hash.startsWith(base+'/');
// Resolves a location hash to its section, the deepest matching tab and a page title.
export function resolveNavigation(hash){
  const current=String(hash||'#panel').split('?')[0]||'#panel';
  if(current==='#panel')return {section:null,tab:null,exact:false,title:'Ställverk'};
  const section=NAVIGATION_SECTIONS.find(s=>within(current,s.hash)||(s.members||[]).some(m=>within(current,m)));
  if(!section)return {section:null,tab:null,exact:false,title:'Inställningar'};
  const tab=section.tabs.filter(t=>t.hash&&within(current,t.hash)).sort((a,b)=>b.hash.length-a.hash.length)[0]||null;
  return {section,tab,exact:tab?.hash===current,title:tab?.title||tab?.label||section.title};
}
