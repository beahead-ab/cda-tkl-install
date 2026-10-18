import {destinationLines,incomingFields,trafficAnchor} from './destination-data.js';
export {incomingFields} from './destination-data.js';
// Bara stationens faktiska importerade fält får manuella ankomstknappar.
export function normalIncoming(lineId,outgoing){
  const line=destinationLines.find(l=>l.id===lineId);
  if(!line)return null;
  const exit=outgoing?.[line.id]??line.outgoing;
  if(!line.tracks.includes(exit))return null;
  return line.tracks.find(t=>t!==exit)||exit;
}
export function incomingChoice(key,outgoing){
  const track=Object.keys(incomingFields).find(t=>incomingFields[t]===key);
  const line=destinationLines.find(l=>l.tracks.includes(track));
  if(!line)return null;
  const normal=normalIncoming(line.id,outgoing),alternate=line.tracks.find(t=>t!==track);
  return {track,line:line.id,normal,deviating:track!==normal,alternate,target:incomingFields[alternate]||null};
}
export function incomingAnchors(controls){
  return Object.entries(incomingFields).flatMap(([track,key])=>{
    const anchor=trafficAnchor(track,controls);if(!anchor)return [];
    const {control,right}=anchor;
    return [{key,track,right,x:control.centerX+(right?45:-45),y:control.centerY-26}];
  });
}
