import {switchOrder,switchReport,signalReport,hex} from './protocol.mjs';
import {signalReportKind} from './signal-report.mjs';
// Den rapport som bekräftar en signals begärda besked: SE-koderna, eller B1 med CLOSED = kör och THROWN = stopp.
const signalExpectation=(profile,b,go)=>signalReportKind(profile,b)==='switch'?[hex(switchReport(b.reportAddress,go?'C':'T'))]:(go?b.goCodes:b.stopCodes).map(code=>hex(signalReport(b.reportAddress,code)));
export function connectionInfo(profile,env=process.env){
  const mode=env.CHARLOTTENDAL_CONNECTION_MODE||'unspecified';
  if(!['simulator','hardware','unspecified'].includes(mode))throw Error('Okänt anslutningsläge. Välj simulator eller hardware.');
  return {mode,host:env.CHARLOTTENDAL_WIRE_HOST||profile.transport.host,port:Number(env.CHARLOTTENDAL_WIRE_PORT||profile.transport.port),label:mode==='simulator'?'Utvecklingsläge · simulerade LocoNet-svar':mode==='hardware'?'Fysisk anslutning vald · hårdvaruverifiering separat':'Anslutningstyp ej angiven · fysisk anläggning inte verifierad'};
}
// Observational only: never sends commands or invents reports. A matching report
// is temporal evidence for the latest command, not a LocoNet transaction ID.
export function commandExpectations(profile,state){
  const rows=[];
  for(const kind of ['turnouts','signals'])for(const [name,b]of Object.entries(profile[kind])){
    const s=state[kind][name];if(!s?.commandAt||!s.desired||b.virtual)continue;
    const isTurnout=kind==='turnouts',physical=isTurnout?(b.inverted?(s.desired==='C'?'T':'C'):s.desired):(s.desired==='GO'?'C':'T');
    const match=isTurnout?s.position===s.desired:s.aspect===s.desired.toLowerCase();
    const fresh=s.updatedAt>0&&state.serverTime>=s.updatedAt&&state.serverTime-s.updatedAt<=profile.staleMs;
    const after=s.reportSequence>s.commandSequence&&s.updatedAt>=s.commandAt;
    const connected=state.connection==='connected',confirmed=connected&&fresh&&after&&match;
    const age=state.serverTime-s.commandAt;
    const status=!connected?'disconnected':confirmed?'confirmed':age>profile.commandTimeoutMs?'timeout':'waiting';
    rows.push({kind,name,address:b.address,reportAddress:isTurnout?b.address:b.reportAddress,desired:s.desired,commandAt:s.commandAt,
      order:hex(switchOrder(b.address,physical)),expected:isTurnout?[hex(switchReport(b.address,physical))]:signalExpectation(profile,b,s.desired==='GO'),
      status,reason:status==='confirmed'?'Färsk matchande rapport efter senaste ordern.':status==='disconnected'?'Anslutningen saknas. Ingen rapport räknas som aktuell.':!fresh?'Väntar på aktuell lägesrapport.':!after?'Rapporten föregår senaste ordern.':'Återrapporten motsvarar inte begärt läge.',
      reportAt:s.updatedAt||null,reported:isTurnout?s.position:s.aspect,provisional:!isTurnout});
  }
  return rows.sort((a,b)=>b.commandAt-a.commandAt||a.name.localeCompare(b.name));
}
export function protocolObjects(profile,decoded){
  if(!decoded?.kind)return [];
  const kinds=decoded.kind==='order'?['turnouts','signals']:decoded.kind==='turnout'?['turnouts','signals']:decoded.kind==='sensor'?['blocks']:decoded.kind==='signal'?['signals']:[];
  const matches=(kind,b)=>kind==='blocks'?(b.inputs||[b]).some(i=>i.address===decoded.address):kind==='turnouts'?b.address===decoded.address:b.virtual?false
    :decoded.kind==='order'?b.address===decoded.address:b.reportAddress===decoded.address&&signalReportKind(profile,b)===(decoded.kind==='signal'?'se':'switch');
  return kinds.flatMap(kind=>Object.entries(profile[kind]).filter(([,b])=>matches(kind,b)).map(([name,b])=>({kind,name,
    ...(decoded.kind==='order'?{expected:kind==='turnouts'?[hex(switchReport(b.address,decoded.position))]:signalExpectation(profile,b,decoded.position==='C'),provisional:kind==='signals'}:{})})));
}
