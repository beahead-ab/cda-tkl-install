// Bind clicks to reviewed NX controls, never to the nearest track or icon.
export function signalRouteControls(config, registry, sourceEndpoints={endpoints:[]}) {
  const types=new Set(['dvsi_4','hdvsi_8','hsi_3+dvsi']);
  const capable=new Set(registry.signals.filter(s=>types.has(s.type)&&(s.aspects.some(a=>/Sh[123]/.test(a))||s.cls==='VirtualSignalMastXml'&&s.aspects.length===0)).map(s=>s.id));
  const sensors=new Map(), ambiguous=new Set();
  for(const b of [...sourceEndpoints.endpoints,...config.routes.flatMap(r=>r.boundaries||[])]) {
    if(!b.sensor||!b.mast)continue;
    if(sensors.has(b.sensor)&&sensors.get(b.sensor)!==b.mast)ambiguous.add(b.sensor);
    sensors.set(b.sensor,b.mast);
  }
  // A destination need not display shunting permission. It remains a STOP
  // guard; its exact XML sensor/mast binding also covers terminal signals.
  const stops=new Set(registry.signals.filter(s=>config.signals[s.id]&&
    (capable.has(s.id)||s.aspects.includes('Stop')||s.type==='sly_2'&&s.aspects.includes('Lit'))).map(s=>s.id));
  const rows=config.routes.filter(r=>r.kind==='shunt').flatMap(r=>{
    const [start,end]=r.source?.nxButtons||[];
    const from=sensors.get(start),to=sensors.get(end);
    if(ambiguous.has(start)||ambiguous.has(end)||!capable.has(from)||!stops.has(to)||
       !types.has(config.signals[from]?.sourceType)||
       r.signals[0]!==from||!r.guardSignals.includes(to))return [];
    return [{...r,fromSignal:from,toSignal:to}];
  });
  const candidates=new Map();
  for(const r of rows)for(const [mast,id] of [[r.fromSignal,r.from],[r.toSignal,r.to]]) {
    if(!candidates.has(mast))candidates.set(mast,new Set());
    candidates.get(mast).add(id);
  }
  const buttons=new Map([...candidates].filter(([,ids])=>ids.size===1).map(([mast,ids])=>[mast,[...ids][0]]));
  const routes=rows.filter(r=>buttons.get(r.fromSignal)===r.from&&buttons.get(r.toSignal)===r.to);
  const starts=new Set(routes.map(r=>r.from));
  function targets(from,active=[]) {
    const result=new Set(routes.filter(r=>r.from===from).map(r=>r.to));
    // A connected, already reserved chain can be cancelled from its outer ends,
    // even when those outer ends have no single route in the static catalogue.
    const visit=(previous,seen)=>{
      for(const r of active.filter(r=>r.kind==='shunt'&&r.from===(previous?.to||from))) {
        if(seen.has(r.id))continue;
        if(previous&&(previous.source?.nxButtons?.[1]!==r.source?.nxButtons?.[0]||r.boundaries?.[0]?.sensor!==r.source?.nxButtons?.[0]))continue;
        if([...buttons.values()].includes(r.to))result.add(r.to);
        visit(r,new Set([...seen,r.id]));
      }
    };
    visit(null,new Set());return result;
  }
  return {buttons,starts,routes,targets};
}

export function signalImage(type, aspect, shunting) {
  if(aspect!=='go')return aspect==='stop'?0:2;
  return shunting&&['hdvsi_8','hsi_3+dvsi'].includes(type)?3:1;
}
