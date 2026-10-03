// Reviewed boundary rights, specified by the layout owner on 2026-09-26.
// Positions below are logical XML positions. Electrical inversion belongs to
// Engine.turnoutOrder, not to this permission check.
const sourceHash='c69a865ae9a85cdb842d70c34d2573dde4b11c50f601a561d5b941136ac6fa87';
const reviewed={
  Vx112:{id:'TO12',continuing:2,segments:['T117','T126','T129'],tklLegs:['B'],yardLegs:['A','C'],button:'vxv102/112'},
  Vx131:{id:'TO26',continuing:4,segments:['T49','T44','T116'],tklLegs:['C'],yardLegs:['A','B'],button:'vxv131/132'},
  Vx154:{id:'TO20',continuing:4,segments:['T36','T46','T118'],tklLegs:['A','C'],yardLegs:['B'],button:'vxv144/154'}
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
      provenance:'Anläggningsägarens manöverregel 2026-09-26, granskad mot XML-portarna. Fysisk överlämningsanslutning återstår.'}];
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
    if(!rule.rangerPositions.includes(position))return name+': endast TKL får öppna förbindelsen mot TKL:s område.';
  }
  return null;
}
