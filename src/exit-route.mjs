// Main routes to a source-defined line reserve the detector beyond the exit
// signal too. Station destinations and shunting still end at a STOP boundary.
export function extendExitRoute(topology,source,path,targetSensor,lineButton) {
  const last=path.path.at(-1),segment=last?.kind==='segment'&&topology.segments[last.id];
  if(!segment)throw Error('Utfarten saknar ett slutsegment.');
  const exit=last.end===1?2:1,node=segment['c'+exit];
  const anchor=source.anchors.find(a=>a.ident===node);
  const directions=['eastbound','westbound'].filter(d=>anchor?.[d+'sensor']===targetSensor);
  if(directions.length!==1)throw Error('Utfartens signalgräns är inte entydig.');
  const direction=directions[0],mast=anchor[direction+'signalmast'];
  const id=[anchor.connect1name,anchor.connect2name].find(id=>id&&id!==last.id);
  const next=topology.segments[id],entry=next?.c1===node?1:next?.c2===node?2:0;
  const dx=entry?next['x'+(entry===1?2:1)]-next['x'+entry]:0;
  const lineBlock=topology.segments[topology.buttons[lineButton]?.segment]?.b;
  if(!mast||!entry||!dx||(dx>0)!==(direction==='eastbound')||!next.b||next.b!==lineBlock||path.path.some(p=>p.kind==='segment'&&p.id===id))throw Error('Spårledningen efter utfartssignalen stämmer inte med linjens källanknytning.');
  const extended=[...path.path,{kind:'segment',id,end:entry}],flow=topology.flow(extended);
  return {...path,path:extended,flow,used:[...path.used,id],blocks:[...new Set([...path.blocks,next.b])],cost:flow.reduce((n,p)=>n+p.length,0),exitSignal:mast};
}
