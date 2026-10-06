// Reviewed boundary rights, specified by the layout owner on 2026-09-26 (112, 131,
// 154) and extended on 2026-10-06 with the other half of each pair and the ranger's
// gate turnouts (102, 103, 132, 144, 164): docs/rangerlage.md. Each boundary has
// exactly one isolating position, the one the ranger may lay freely (the "back"
// position of a request group). Positions below are logical XML positions.
// Electrical inversion belongs to Engine.turnoutOrder, not to this permission check.
const sourceHash='c69a865ae9a85cdb842d70c34d2573dde4b11c50f601a561d5b941136ac6fa87';
const reviewed={
  Vx102:{id:'TO11',continuing:2,segments:['T73','T78','T126'],tklLegs:['A','B'],yardLegs:['C'],button:'vxv102/112'},
  Vx103:{id:'TO5',continuing:2,segments:['T13','T135','T148'],tklLegs:['B'],yardLegs:['A','C'],button:'vxv103'},
  // Spår 11–13 are TKL's, so 112's leg towards 113 and 131's leg towards 126 are TKL legs.
  Vx112:{id:'TO12',continuing:2,segments:['T117','T126','T129'],tklLegs:['A','B'],yardLegs:['C'],button:'vxv102/112'},
  Vx131:{id:'TO26',continuing:4,segments:['T49','T44','T116'],tklLegs:['A','C'],yardLegs:['B'],button:'vxv131/132'},
  Vx132:{id:'TO24',continuing:2,segments:['T123','T43','T45'],tklLegs:['C'],yardLegs:['A','B'],button:'vxv131/132'},
  Vx144:{id:'TO21',continuing:2,segments:['T53','T121','T52'],tklLegs:['C'],yardLegs:['A','B'],button:'vxv144/154'},
  Vx154:{id:'TO20',continuing:4,segments:['T36','T46','T118'],tklLegs:['A','C'],yardLegs:['B'],button:'vxv144/154'},
  Vx164:{id:'TO0',continuing:2,segments:['T161','T2','T144'],tklLegs:['B'],yardLegs:['A','C'],button:'vxv164'},
  // 172 (with the reviewed panel connection to 3d): 3d and the stub are the ranger's, 170 TKL's.
  Vx172:{id:'TO47',continuing:2,segments:['T274','T273','T26'],tklLegs:['B'],yardLegs:['A','C'],button:'vxv172'}
};

export function compileYardBoundaries(panel,source) {
  if(source.sourceHash!==sourceHash)throw Error('Rangergränsens XML-underlag har ändrats; granska manöverrätten på nytt.');
  return Object.fromEntries(Object.entries(reviewed).map(([name,r])=>{
    const t=panel.turnouts[r.id];
    if(t?.name!==name||t.continuing!==r.continuing||t.name2||r.segments.some((s,i)=>t['c'+'abc'[i]]!==s))throw Error('Rangergränsens spåranslutning har ändrats: '+name);
    for(const [i,id] of r.segments.entries()){
      const s=panel.segs.find(s=>s.id===id),leg='TURNOUT_'+'ABC'[i];
      if(!s||![1,2].some(e=>s['c'+e]===r.id&&s['t'+e]===leg))throw Error('Rangergränsens anslutning saknas: '+name);
    }
    const closed=t.continuing===2?'B':'C',positions={C:['A',closed],T:['A',closed==='B'?'C':'B']};
    const opens=legs=>legs.some(l=>r.tklLegs.includes(l))&&legs.some(l=>r.yardLegs.includes(l));
    const rangerPositions=Object.keys(positions).filter(p=>!opens(positions[p]));
    if(rangerPositions.length!==1)throw Error('Inget entydigt skyddsläge vid rangergränsen: '+name);
    return [name,{tklPositions:['C','T'],rangerPositions,ports:positions,tklLegs:r.tklLegs,yardLegs:r.yardLegs,sourceButton:r.button,
      provenance:'Anläggningsägarens manöverregel 2026-09-26 och 2026-10-06, granskad mot XML-portarna. Rangerarens vy är ännu inte ansluten.'}];
  }));
}

// A trusted caller identifies the operator. Never accept this identity from
// a client-controlled request field. Local-yard points must be explicitly
// declared; boundary points permit only the reviewed isolating position.
export function boundaryCommandReason(boundaries,names,position,operator,yardTurnouts=[]) {
  if(!['C','T'].includes(position))return 'Ogiltigt växelläge.';
  if(operator==='tkl')return null;
  if(operator!=='ranger')return 'Okänd manöverbehörighet.';
  if(!names.length)return 'Ingen växel vald.';
  for(const name of names){
    const rule=boundaries?.[name];
    if(!rule){if(yardTurnouts.includes(name))continue;return name+': rangerarens manöverrätt är inte ansluten.';}
    if(!rule.rangerPositions.includes(position))return name+': endast TKL får öppna förbindelsen mot TKL:s område. Begär den i stället.';
  }
  return null;
}
