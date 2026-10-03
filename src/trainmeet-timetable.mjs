// Station timetable from TrainMeet RuntimePublication.timetable, schema 3.
// Keep only display data; never pass server configuration or credentials through.
const invalid=()=>{throw Object.assign(Error('TrainMeet-tidtabellen matchar inte stationen, trafikdagen eller det granskade formatet.'),{status:502});};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const string=(v,max=200)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const id=v=>string(v,128)&&v.length>0;
const list=v=>Array.isArray(v)&&v.length<=5000&&v.every(object);
const optional=(v,max=200)=>v==null||string(v,max);
const unique=rows=>new Set(rows.map(r=>r.id)).size===rows.length;
// Planned times are server-owned text; do not apply the clock's 24-hour rule.
const time=v=>optional(v,32);

export function readTimetable(data,{stationId,publicationId,day,loadedAt}) {
  if(!object(data)||data.schema_version!==3||data.publication_id!==publicationId||data.active_day!==day||
    !list(data.stations)||!list(data.tracks)||!list(data.trains))invalid();
  const stations=data.stations.filter(s=>s.id===stationId);
  if(stations.length!==1)invalid();
  const points=stations[0].operating_points??[];
  if(!list(points)||!unique(points)||points.some(p=>!id(p.id)||!string(p.name)||!string(p.code)))invalid();
  const operatingPoints=points.map(p=>({id:p.id,name:p.name,code:p.code}));
  const tracks=data.tracks.filter(t=>t.station_id===stationId).map(t=>{
    if(!id(t.id)||!string(t.display_label)||!optional(t.operating_point_id,128)||
      t.operating_point_id&&!points.some(p=>p.id===t.operating_point_id))invalid();
    return {id:t.id,label:t.display_label,operatingPointId:t.operating_point_id||''};
  });
  if(!unique(tracks))invalid();
  const trackMap=new Map(tracks.map(t=>[t.id,t]));
  const trains=data.trains.map(t=>{
    if(!id(t.id)||t.station_id!==stationId||!string(t.train_number)||!t.train_number||
      !time(t.arrival_time)||!time(t.departure_time)||!optional(t.track_id,128)||
      t.track_id&&!trackMap.has(t.track_id)||!optional(t.operating_point_id,128)||
      t.operating_point_id&&!points.some(p=>p.id===t.operating_point_id)||
      points.length>1&&!t.operating_point_id||
      t.no_stop!=null&&typeof t.no_stop!=='boolean')invalid();
    const track=t.track_id?trackMap.get(t.track_id):null;
    if(t.operating_point_id&&track&&track.operatingPointId!==t.operating_point_id)invalid();
    const row={id:t.id,train_number:t.train_number,arrival_time:t.arrival_time||'',departure_time:t.departure_time||'',
      track_id:t.track_id||'',track:track?.label||'',operating_point_id:t.operating_point_id||'',no_stop:t.no_stop??false};
    for(const key of ['days','train_type','arrival_from','departure_to','sort_time']){
      if(!optional(t[key]))invalid();row[key]=t[key]||'';
    }
    // Notes can contain line breaks, but no other control characters.
    if(t.note!=null&&(typeof t.note!=='string'||t.note.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t.note)))invalid();
    row.note=t.note||'';
    return row;
  });
  if(!unique(trains))invalid();
  // Preserve the server's manual/time ordering; the active day is filtered there.
  return {trains,tracks,operatingPoints,timetable:{schemaVersion:3,loadedAt}};
}
