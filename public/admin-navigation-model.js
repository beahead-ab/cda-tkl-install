// Navigation model for the administration window. Pure data, so the rail,
// the tab rows and the page titles stay consistent and can be tested without a DOM.
// Every existing #-address is kept; only the presentation groups them.
export const NAVIGATION_SECTIONS=[
  {hash:'#tools/operations',label:'Drift',id:'operations-tab',title:'Driftverktyg',tabs:[
    {hash:'#tools/operations',label:'Driftverktyg'},
    {hash:'#tools/operations/routes',label:'Tågvägar'},
    {hash:'#tools/operations/clearance',label:'Tågklarering'},
    {hash:'#tools/operations/blocks',label:'Spårspärrar'},
    {hash:'#tools/operations/lines',label:'Linjer och programmeringsspår'},
    {hash:'#tools/operations/trains',label:'Tågnummer'},
    {hash:'#tools/operations/clock',label:'Modellklocka'},
    {hash:'#tools/operations/authority',label:'Lokal- och fjärrläge'}]},
  {hash:'#import',label:'Tidtabeller',id:'import-tab',title:'Tidtabeller',members:['#trainmeet'],tabs:[
    {hash:'#import',label:'Tidtabeller'},
    {hash:'#trainmeet',label:'TrainMeet',id:'trainmeet-tab',status:'menu-trainmeet-status'},
    {hash:'#import/upload',label:'Importera',title:'Importera tidtabell'},
    {hash:'#import/edit',label:'Redigera utkast',title:'Redigera tidtabell'}]},
  {hash:'#tools/journal',label:'Händelser',id:'journal-tab',title:'Händelser',tabs:[]},
  {hash:'#tools/appearance',label:'Utseende',id:'tools-tab',title:'Utseende och ljud',tabs:[]},
  {hash:'#tools/streamdeck',label:'Stream Deck',id:'streamdeck-tab',title:'Elgato Stream Deck',tabs:[
    {hash:'#tools/streamdeck',label:'Anslutning'},
    {hash:'#tools/streamdeck/layout',label:'Layout',title:'Stream Deck-layout'}]},
  {hash:'#register',label:'Anläggning',id:'admin-tab',title:'Anläggningsregister',tabs:[
    {hash:'#register',label:'Anläggningsregister'},
    {hash:'#register/station',label:'Anläggningsöversikt'},
    {hash:'#register/destinations',label:'Orter och telefon',title:'Orter och telefonnummer'},
    {hash:'#register/presentation',label:'Visningsinställningar'},
    {hash:'#register/bindings',label:'Driftinställningar'}]},
  {hash:'#advanced',label:'Avancerat',id:'advanced-tab',title:'Avancerat',tabs:[
    {hash:'#advanced',label:'Avancerat'},
    {hash:'#advanced/xml',label:'XML-granskning'},
    {hash:'#advanced/migration',label:'Införandestatus'},
    {hash:'#advanced/protocol',label:'Protokollinspelning'},
    {hash:'#advanced/update',label:'Uppdatering',title:'Uppdatera TKL'},
    {external:'field-link',label:'Simulator ↗'}]}
];
const within=(hash,base)=>hash===base||hash.startsWith(base+'/');
// Resolves a location hash to its section, the deepest matching tab and a page title.
export function resolveNavigation(hash){
  const current=String(hash||'#panel').split('?')[0]||'#panel';
  if(current==='#panel')return {section:null,tab:null,exact:false,title:'Ställverk'};
  const section=NAVIGATION_SECTIONS.find(s=>within(current,s.hash)||(s.members||[]).some(m=>within(current,m)));
  if(!section)return {section:null,tab:null,exact:false,title:'Administration'};
  const tab=section.tabs.filter(t=>t.hash&&within(current,t.hash)).sort((a,b)=>b.hash.length-a.hash.length)[0]||null;
  return {section,tab,exact:tab?.hash===current,title:tab?.title||tab?.label||section.title};
}
