// Requested position is never a confirmed position, even during animation.
export function turnoutDisplay(turnout,report,{fresh,now,timeout=6000}){
  const continuing=turnout.continuing===2?'B':'C';
  const position=fresh?report?.position:null;
  const active=position==='C'?continuing:position==='T'?(continuing==='B'?'C':'B'):null;
  const elapsed=now-report?.commandAt;
  const waiting=!!fresh&&!active&&['C','T'].includes(report?.desired)&&Number.isFinite(report?.commandAt)&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=timeout;
  return {active,phase:active?'confirmed':waiting?'waiting':'unknown'};
}

// Dubbel korsningsväxel (JMRI layoutSlip): förbindelsen är den vars båda lägen (states, 2 = CLOSED, 4 = THROWN) stämmer
// med de rapporterade växellägena. Bara rapporterade lägen tänder en förbindelse; begärda lägen visar att den väntar.
export function slipDisplay(slip,reports,{fresh,now,timeout=6000}){
  const positions=[slip.name,slip.name2].map(n=>fresh?reports?.[n]?.position:null);
  const pair=positions.every(p=>p==='C'||p==='T')?Object.entries(slip.states||{}).find(([,st])=>(st.turnout===4?'T':'C')===positions[0]&&(st.turnoutB===4?'T':'C')===positions[1])?.[0]:null;
  const waiting=!pair&&!!fresh&&[slip.name,slip.name2].some(n=>{const r=reports?.[n],elapsed=now-r?.commandAt;return ['C','T'].includes(r?.desired)&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=timeout;});
  return {active:pair?pair.split('-'):null,phase:pair?'confirmed':waiting?'waiting':'unknown'};
}
