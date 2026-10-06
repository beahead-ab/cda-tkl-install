// The ranger's point chains ("växelgator", docs/rangerlage.md): one button lays every
// turnout from a start inside the area straight out to a track. No route, no lock, no
// signal: the kernel lays the ranger's own turnouts (and boundaries in their back
// position) with the same field conditions as a manual move. The positions are found
// in the track graph at build time, never written by hand.
import { Topology } from './topology.mjs';
// Start and end are segments: 3e (T13) and Spår 6 (T124) for the goods yard and the
// depot; Lastspår 1–2 hang on 119 from the yard side (S119), Lastspår 3 on 133 from
// the 144 side (S133a), as the layout owner described them.
const spec=[
  {id:'left-g51',label:'Godsspår 51 från vänster',short:'V 51',side:'left',from:'T13',to:'T110'},
  {id:'left-g52',label:'Godsspår 52 från vänster',short:'V 52',side:'left',from:'T13',to:'T195'},
  {id:'left-g53',label:'Godsspår 53 från vänster',short:'V 53',side:'left',from:'T13',to:'T64'},
  {id:'left-g54',label:'Godsspår 54 från vänster',short:'V 54',side:'left',from:'T13',to:'T188'},
  {id:'load-1',label:'Lastspår 1',short:'Last 1',side:'left',from:'T222',to:'T216'},
  {id:'load-2',label:'Lastspår 2',short:'Last 2',side:'left',from:'T222',to:'T15'},
  {id:'right-g52',label:'Godsspår 52 från höger',short:'H 52',side:'right',from:'T124',to:'T195'},
  {id:'right-g53',label:'Godsspår 53 från höger',short:'H 53',side:'right',from:'T124',to:'T64'},
  {id:'right-g54',label:'Godsspår 54 från höger',short:'H 54',side:'right',from:'T124',to:'T188'},
  {id:'load-3',label:'Lastspår 3',short:'Last 3',side:'right',from:'T53',to:'T41'},
  {id:'depot-kolgard',label:'Kolgård',short:'Kolgård',side:'depot',from:'T124',to:'T58'},
  {id:'depot-lokstall',label:'Lokstall',short:'Lokstall',side:'depot',from:'T124',to:'T67'},
  {id:'depot-skiva',label:'Fram till vändskivan',short:'Skiva',side:'depot',from:'T124',to:'T150'},
  // 3d through 172 to the stub and its buffer stop; out towards 170 comes later.
  {id:'3d-stub',label:'3d till stickspåret',short:'3d stick',side:'3d',from:'T26',to:'T274'}
];
export function compileRangerPaths(panel,profile){
  const topology=new Topology(panel),own=new Set(profile.yardArea?.turnouts||[]),boundaries=profile.yardBoundaries||{};
  return spec.map(s=>{
    for(const seg of [s.from,s.to])if(!topology.segments[seg])throw Error('Växelgatans spår saknas i panelen: '+s.id+' '+seg);
    topology.buttons['rp:'+s.from]={segment:s.from};topology.buttons['rp:'+s.to]={segment:s.to};
    const found=topology.search('rp:'+s.from,'rp:'+s.to);
    if(!found)throw Error('Ingen växelgata i spårgrafen: '+s.id);
    for(const [name,position] of Object.entries(found.settings)){
      if(own.has(name))continue;
      if(boundaries[name]?.rangerPositions.includes(position))continue;
      throw Error(`Växelgatan ${s.id} lämnar rangerarens område vid ${name}.`);
    }
    return {id:s.id,label:s.label,short:s.short,side:s.side,turnouts:found.settings,segments:found.used,provenance:'Ur spårgrafen vid profilbygget; anläggningsägarens växelgator 2026-10-06.'};
  });
}
