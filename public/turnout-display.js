// Requested position is never a confirmed position, even during animation.
export function turnoutDisplay(turnout,report,{fresh,now,timeout=6000}){
  const continuing=turnout.continuing===2?'B':'C';
  const position=fresh?report?.position:null;
  const active=position==='C'?continuing:position==='T'?(continuing==='B'?'C':'B'):null;
  const elapsed=now-report?.commandAt;
  const waiting=!!fresh&&!active&&['C','T'].includes(report?.desired)&&Number.isFinite(report?.commandAt)&&Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=timeout;
  return {active,phase:active?'confirmed':waiting?'waiting':'unknown'};
}
