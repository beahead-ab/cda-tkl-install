export const destinationDefaults=[
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
export const destinationLines=[
  {id:'C',name:'Linje C · vänster',tracks:['Cu','Cn'],outgoing:'Cn'},
  {id:'A',name:'Linje A · vänster',tracks:['Au','An'],outgoing:'An'},
  {id:'B',name:'Linje B · höger',tracks:['Bu','Bn'],outgoing:'Bu'},
  {id:'D',name:'Linje D · höger',tracks:['D'],outgoing:'D'}
];
export const defaultOutgoing=()=>Object.fromEntries(destinationLines.map(l=>[l.id,l.outgoing]));
export function isOutgoingDestination(id,outgoing){
  const line=destinationLines.find(l=>l.tracks.includes(id));
  return !!line&&(outgoing?.[line.id]??line.outgoing)===id;
}
export function destinationDisplay(entry,trainMeet){
  const station=entry.source==='trainmeet'?trainMeet?.context?.stations?.find(s=>s.id===entry.stationId):null;
  return {...entry,name:station?.name||entry.name,phone:entry.phone,sourceLabel:entry.source==='local'?'Lokalt':station?(trainMeet.stale?'TrainMeet · senaste uppgifter':'TrainMeet'):'TrainMeet saknas · lokalt reservnamn'};
}
