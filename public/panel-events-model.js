// Tone, category and filters for the panel's event column. The core journal's
// kinds are unchanged; this is presentation only, the same rows the tools page lists.
const ALARM=new Set(['error','unexpected-go','bad-frame','emergency']);
const WARN=new Set(['all-stop','route-held','programming-held','line-block','track-block','permission']);
const OK=new Set(['established','route-active','released','panel-reset-complete','emergency-complete']);
const ROUTE=new Set(['route-request','route-repeat','route-held','route-active','established','released','cancel','order','emergency','emergency-complete','all-stop','panel-reset','panel-reset-complete','programming','programming-held','unexpected-go']);
const TRAIN=new Set(['train-entered','train-information','train-tracking','trainmeet','track-block','line-block','ranger-request','ranger-approved','ranger-denied','ranger-returned','ranger-withdrawn','ranger-path']);
// The column shows operating events: routes, trains, alarms. Field-level rows stay in
// the full journal under Verktyg: reports and transport frames (as there), plus the
// orders and permission requests the core sends to signals and turnouts, and the
// administrative rows about Stream Deck layouts, display settings and bindings.
export const HIDDEN_KINDS=['report','transport','order','permission','streamdeck','configuration','bindings'];
export const FILTERS=[['all','Alla'],['alarm','Larm'],['route','Tågvägar'],['train','Tåg']];
export const tone=kind=>ALARM.has(kind)?'alarm':WARN.has(kind)?'warn':OK.has(kind)?'ok':'info';
export const category=kind=>ROUTE.has(kind)?'route':TRAIN.has(kind)?'train':'other';
export const eventKey=e=>e?.id!=null?String(e.id):String(e?.at)+'\u0000'+e?.kind+'\u0000'+e?.message;
export const visibleEvents=events=>(Array.isArray(events)?events:[]).filter(e=>e&&!HIDDEN_KINDS.includes(e.kind));
export function filterEvents(events,filter){
  const rows=visibleEvents(events);
  if(filter==='alarm')return rows.filter(e=>tone(e.kind)==='alarm');
  if(filter==='route')return rows.filter(e=>category(e.kind)==='route');
  if(filter==='train')return rows.filter(e=>category(e.kind)==='train');
  return rows;
}
export const openAlarms=(events,acked=new Set())=>visibleEvents(events).filter(e=>tone(e.kind)==='alarm'&&!acked.has(eventKey(e)));
export const alarmCount=(events,acked)=>openAlarms(events,acked).length;
export const latestAlarm=(events,acked)=>openAlarms(events,acked)[0]||null;
