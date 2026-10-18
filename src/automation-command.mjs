// Körs inne i TrainMeets exklusiva begäran, efter eventuell väntande poll. Operatören kan ha tagit över under tiden.
export function automationCommand({automation,engine,connection},a,e,t,data){
  const deny=()=>{throw Object.assign(Error('Automatens tågväg eller driftläge har ändrats. Kontrollera tåget och ta över.'),{status:409});};
  if(automation!==a||engine!==e||!a.enabled||!Number.isSafeInteger(data.automationGeneration)||data.automationGeneration!==a.generation||connection.mode!=='offline'||!e.connected||e.storageFault||e.controls.stopAll||e.controls.emergency||e.controls.mode!=='local')deny();
  const proof=data.proof;
  if(!proof?.trackBlock)deny();
  const route=kind=>{const p=proof[kind];return p&&e.routes.find(r=>r.id===p.id&&r.from===p.from&&r.to===p.to);};
  const active=kind=>{const r=route(kind);return r&&!r.cancelRequested&&['active','traversing'].includes(r.state);};
  if(data.action==='accept'&&!active('arrival')||data.action==='depart'&&!active('departure'))deny();
  const trains=t.view().trains;
  if(data.action==='request'||data.action==='arrive'||data.arrival==='arrived'){
    if(route('arrival')||!trains.some(train=>train.number===data.trainNumber&&train.head===proof.trackBlock&&train.state==='station'&&train.certain)||e.blocks[proof.trackBlock]?.occupied!==true)deny();
  }
  if(data.departure==='departed'){
    const departure=proof.departure,blocks=departure?.blocks;
    if(route('departure')||trains.some(train=>train.number===data.trainNumber)||e.blocks[proof.trackBlock]?.occupied!==false||
      !Array.isArray(blocks)||!blocks.length||!e.profile?.routes.some(r=>r.from===departure.from&&r.to===departure.to&&JSON.stringify(r.blocks)===JSON.stringify(blocks))||
      blocks.some(block=>e.blocks[block]?.occupied!==false))deny();
  }
}
