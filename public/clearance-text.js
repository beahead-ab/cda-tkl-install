// Plain texts and the mechanical TMBox step rules for lines and movements.
// No DOM, so wording and step order are testable. The server still decides.
export const ACTION_TEXT={request:'Begär klarering',accept:'Godkänn',reject:'Neka',cancel:'Återta',depart:'Avgått',arrive:'Mottaget'};
export const TRACK_TEXT={single:'enkelspår',double:'dubbelspår'};
// Who answers at the other end of the line, as TrainMeet reports it.
export const NEIGHBOR_TEXT={automatic:'automatisk',manual:'bemannad',disconnected:'kontakt saknas'};
export function lineStatus(line){
  const n=line.trainNumber?'tåg '+line.trainNumber:'tåg',to=line.neighborName;
  switch(line.state){
    case 'free':return 'Fri';
    case 'requested':return line.direction==='in'?`Förfrågan från ${to} · ${n}`:line.direction==='out'?`Begärd av oss · ${n} mot ${to}`:`Begärd · ${n}`;
    case 'reserved':return line.direction==='out'?`Klart · ${n} får avgå mot ${to}`:line.direction==='in'?`Klart · ${n} väntas från ${to}`:`Klart · ${n}`;
    case 'occupied':return line.direction==='in'?`${n} på väg från ${to} · bekräfta mottaget vid ankomst`:line.direction==='out'?`${n} på linjen mot ${to}`:`${n} på linjen`;
    default:return 'Okänt läge';
  }
}
export const needsAttention=line=>line.state==='requested'&&line.direction==='in';
// One train at the station: its arrival and departure declarations, TMBox order.
export function movementStatus(m,train){
  const dep=m?.departure||'none',arr=m?.arrival||'none',parts=[];
  if(train.arrival_time)parts.push(arr==='arrived'?'Ankommit':arr==='approaching'?'Närmar sig':'Väntas');
  if(train.departure_time)parts.push(dep==='departed'?'Avgått':dep==='ready'?'Redo · begär klarering på sträckan':dep==='positioned'?'Uppställt · väntar på förare':'Ej uppställt');
  return parts.join(' · ')||'Ingen tid';
}
// seen: the train is on its way here on a line (cleared or departed). A train
// the system does not see coming can be moved here at once: TrainMeet then
// counts the sender's part as done and frees the line (issue #115).
export function movementActions(m,train,seen=false){
  const dep=m?.departure||'none',arr=m?.arrival||'none',out=[];
  if(train.arrival_time&&arr!=='arrived'){
    out.push(arr==='approaching'?{field:'arrival',value:'arrived',label:'Ankommit',primary:true}:{field:'arrival',value:'approaching',label:'Närmar sig',primary:false});
    if(arr==='none'&&!seen)out.push({field:'arrival',value:'arrived',label:'Flytta hit',primary:false,confirm:`Flytta tåg ${train.train_number} hit? Avsändarens del räknas som gjord och sträckan blir fri.`});
  }
  if(train.departure_time&&dep!=='departed'&&(!train.arrival_time||arr==='arrived')){
    if(dep==='none')out.push({field:'departure',value:'positioned',label:'Uppställt',primary:false});
    else if(dep==='positioned')out.push({field:'departure',value:'ready',label:'Förare på plats',primary:true});
  }
  return out;
}
export const movementDone=(m,train)=>(!train.arrival_time||m?.arrival==='arrived')&&(!train.departure_time||m?.departure==='departed');
