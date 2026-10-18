export const legacyDestinationDefaults=[
  {id:'Cu',name:'Lekby',phone:'72',position:'Vänster · övre spåret mot Lekby'},
  {id:'Cn',name:'Lekby',phone:'72',position:'Vänster · nedre spåret mot Lekby'},
  {id:'Au',name:'Kungsfors',phone:'',position:'Vänster · övre spåret mot Kungsfors'},
  {id:'An',name:'Kungsfors',phone:'',position:'Vänster · nedre spåret mot Kungsfors'},
  {id:'Bu',name:'Vagnsta',phone:'71',position:'Höger · övre spåret mot Vagnsta'},
  {id:'Bn',name:'Vagnsta',phone:'71',position:'Höger · nedre spåret mot Vagnsta'},
  {id:'D',name:'D',phone:'',position:'Höger · separat nedre utfart D'}
];
// Normal outbound tracks for left-hand running. This is label placement,
// independent of temporary routes, line blocks and TrainMeet station names.
// The side is where the line leaves the panel; the timetable's line picture
// draws the neighbours on the same side (public/timetable-style.js).
export const legacyDestinationLines=[
  {id:'C',name:'Linje C · vänster',side:'left',tracks:['Cu','Cn'],outgoing:'Cn'},
  {id:'A',name:'Linje A · vänster',side:'left',tracks:['Au','An'],outgoing:'An'},
  {id:'B',name:'Linje B · höger',side:'right',tracks:['Bu','Bn'],outgoing:'Bu'},
  {id:'D',name:'Linje D · höger',side:'right',tracks:['D'],outgoing:'D'}
];
// Samma modell läses av ortsinställningar, panel, tidtabell och tågspårning.
// De äldre standarderna är separata så att serverns Charlottendal inte påverkas av en webbläsares val.
export const legacyIncomingFields={Cu:'incoming:CuppIn',Cn:'incoming:CnedIn',Au:'incoming:AuppIn',An:'incoming:AnedIn',Bu:'incoming:BuppIn',Bn:'incoming:BnedIn',D:'incoming:DIn'};
export const legacyAnchors=Object.fromEntries(legacyDestinationDefaults.map(({id})=>{
  const right=legacyDestinationLines.find(l=>l.tracks.includes(id)).side==='right';
  return [id,{button:'htv'+id,side:right?'right':'left',outward:right?'right':'left',label:{x:right?2078:50,dy:id.endsWith('n')||id==='D'?38:-36}}];
}));
export let destinationDefaults=legacyDestinationDefaults,destinationLines=legacyDestinationLines,incomingFields=legacyIncomingFields,trafficAnchors=legacyAnchors;
let explicitConnections=false;
export function configureTraffic(model){
  destinationDefaults=model?.destinationDefaults??legacyDestinationDefaults;
  destinationLines=model?.destinationLines??legacyDestinationLines;
  incomingFields=model?.incomingFields??legacyIncomingFields;
  trafficAnchors=model?.anchors??legacyAnchors;
  explicitConnections=!!model?.explicitConnections;
}
export function trafficAnchor(track,controls){
  const binding=trafficAnchors[track];if(!binding)return null;
  const control=controls.find(c=>c.sensor===binding.button);if(!control)return null;
  return {...binding,control,right:binding.side==='right'};
}
export function destinationAnchor(track,controls){
  const anchor=trafficAnchor(track,controls);if(!anchor)return null;
  const {control,label={},right}=anchor;
  return {...anchor,x:label.x??control.centerX+(label.dx??(right?34:-34)),y:control.centerY+(label.dy??-36)};
}
export function lineTrainPlacement(edge,direction,controls,index=1){
  const a=trafficAnchor(edge,controls);if(!a)return null;
  const inward=direction==='in',outward=a.outward|| (a.right?'right':'left');
  const arrows={left:['←','→'],right:['→','←'],up:['↑','↓'],down:['↓','↑']};
  // Stationspaketens korta planer behöver skyltarna inåt i bilden. Charlottendals historiska lägen bevaras.
  const vertical=['up','down'].includes(outward),inside=explicitConnections&&!vertical;
  return {x:a.control.centerX+(vertical?45:inside?(a.right?-18:18):(a.right?18:-18)),y:a.control.centerY+28*index,
    anchor:inside?(a.right?'end':'start'):(a.right?'start':'end'),arrow:(arrows[outward]||arrows.right)[inward?1:0]};
}
export const defaultOutgoing=()=>Object.fromEntries(destinationLines.map(l=>[l.id,l.outgoing]));
export function isOutgoingDestination(id,outgoing){
  const line=destinationLines.find(l=>l.tracks.includes(id));
  return !!line&&(outgoing?.[line.id]??line.outgoing)===id;
}
export function destinationDisplay(entry,trainMeet){
  const station=entry.source==='trainmeet'?trainMeet?.context?.stations?.find(s=>s.id===entry.stationId):null;
  const missing=explicitConnections&&(!entry.stationId||!trainMeet?.context?.lines?.some(l=>l.neighborId===entry.stationId));
  return {...entry,name:station?.name||entry.name,phone:entry.phone,...(explicitConnections?{connectionMissing:missing}:{}),sourceLabel:missing?'TrainMeet-anslutning saknas':entry.source==='local'?'Lokalt':station?(trainMeet.stale?'TrainMeet · senaste uppgifter':'TrainMeet'):'TrainMeet saknas · lokalt reservnamn'};
}
