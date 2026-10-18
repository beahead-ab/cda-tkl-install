// Trafikens bindningar läses en gång ur stationsbeskrivningen. De läggs inte på de genererade profilerna:
// profil-id, egenskapsordning och sourceHash används av redan sparade driftinställningar.
import { legacyDestinationDefaults, legacyDestinationLines, legacyIncomingFields } from '../public/destination-data.js';
import { Topology } from './topology.mjs';

export const LEGACY_EDGE_LINES = Object.freeze({Au:'A',An:'A',Cu:'C',Cn:'C',Bu:'B',Bn:'B',D:'D'});
const copy = value => structuredClone(value);
const blockExists = (profile, block) => !!block && Object.hasOwn(profile.blocks || {}, block);
const validateBlock = (profile, block, name) => {
  if (!blockExists(profile, block)) throw Error(`${name}: stationsbindningen saknar ett giltigt block (${block || 'inget'}).`);
};
export const outgoingDefaults = traffic => Object.fromEntries(traffic.destinationLines.map(line => [line.id, line.outgoing]));

export function stationTraffic(station, profile, panel) {
  if (station.id === 'charlottendal') {
    const edgeBlocks = {}, anchors = {}, topology = new Topology(panel);
    for (const edge of Object.keys(LEGACY_EDGE_LINES)) {
      const button = topology.buttons['htv' + edge], block = button && topology.segments[button.segment]?.b;
      if (blockExists(profile, block)) edgeBlocks[edge] = block;
      const right = ['Bu','Bn','D'].includes(edge), lower = edge.endsWith('n') || edge === 'D';
      anchors[edge] = {button:'htv' + edge, side:right?'right':'left', outward:right?'right':'left', label:{x:right?2078:50,dy:lower?38:-36}};
    }
    const stationTracks = {};
    // Charlottendals historiska spårurval behålls, inklusive första tågvägens målblock.
    for (const [button, binding] of Object.entries(profile.buttons || {})) {
      const match = /^Spår\s+(.+)$/.exec(binding.label || ''), block = match && profile.routes.find(route => route.to === button)?.blocks.at(-1);
      if (block) stationTracks[match[1].trim().toLowerCase()] = {button,block,label:match[1].trim()};
    }
    return {destinationDefaults:copy(legacyDestinationDefaults),destinationLines:copy(legacyDestinationLines),
      edgeLines:{...LEGACY_EDGE_LINES},edgeBlocks,incomingFields:{...legacyIncomingFields},stationTracks,anchors,explicitConnections:false};
  }
  const definition = station.definition;
  if (!definition || !definition.buttons || !definition.lines) throw Error(`${station.title}: trafikens stationsbeskrivning saknas.`);
  const destinationDefaults = [], destinationLines = [], edgeLines = {}, edgeBlocks = {}, anchors = {}, stationTracks = {};
  const lineButtons = new Set();
  for (const [id, line] of Object.entries(definition.lines)) {
    const button = line.button, binding = definition.buttons[button];
    validateBlock(profile, binding?.block, `Linje ${id}`);
    if (!profile.buttons?.[button]) throw Error(`Linje ${id}: knappen ${button} saknas i profilen.`);
    if (line.singleTrack !== true) throw Error(`Linje ${id}: ange en uttrycklig bindning för dubbelspårets in- och utfart.`);
    if (!['left','right'].includes(line.side)) throw Error(`Linje ${id}: panelens sida saknas.`);
    if (lineButtons.has(button)) throw Error(`Linje ${id}: knappen ${button} är redan bunden till en linje.`);
    lineButtons.add(button);
    // neighbour är en uppgift om källan, inte en TrainMeet-identitet. Operatören väljer verklig granne i Orter.
    const name = line.label || 'Linje ' + id;
    destinationDefaults.push({id,name,phone:'',position:(line.side === 'left'?'Vänster':'Höger') + ' · ' + name});
    destinationLines.push({id,name,side:line.side,tracks:[id],outgoing:id});
    edgeLines[id] = id; edgeBlocks[id] = binding.block;
    const segments = (panel.segs || []).filter(segment => segment.b === binding.block);
    const longest = segments.sort((a,b) => Math.hypot(b.x2-b.x1,b.y2-b.y1)-Math.hypot(a.x2-a.x1,a.y2-a.y1))[0];
    const vertical = longest && Math.abs(longest.y2-longest.y1)>Math.abs(longest.x2-longest.x1);
    // Geometrin används bara för pilens riktning. Blockbindningen kommer alltid ur stationsfilen.
    const outward = vertical ? definition.verticalEastbound === 'down'?'down':'up' : line.side;
    anchors[id] = {button,side:line.side,outward,label:{dx:line.side==='left'?-34:34,dy:vertical?42:52}};
  }
  for (const [button, binding] of Object.entries(definition.buttons)) {
    if (lineButtons.has(button)) continue;
    const match = /^Spår\s+(.+)$/.exec(binding.label || '');
    if (!match) continue;
    validateBlock(profile,binding.block,binding.label);
    if (!profile.buttons?.[button]) throw Error(`${binding.label}: knappen ${button} saknas i profilen.`);
    const label = match[1].trim(), key = label.toLowerCase();
    if (Object.hasOwn(stationTracks,key)) throw Error(`Dubbelt stationsspår: ${label}.`);
    stationTracks[key] = {button,block:binding.block,label};
  }
  return {destinationDefaults,destinationLines,edgeLines,edgeBlocks,incomingFields:{},stationTracks,anchors,explicitConnections:true};
}

// Bara sparade, uttryckliga TrainMeet-kopplingar kan skapa trafiktåg. En ej ansluten C förblir utan stationId.
export function trafficEdgeInfo(traffic, destinations, context) {
  const stations = context?.stations || [], out = {};
  for (const line of traffic.destinationLines) {
    const exit = destinations.outgoing?.[line.id] ?? line.outgoing, incoming = line.tracks.find(track => track !== exit) || exit;
    for (const track of line.tracks) {
      const entry = destinations.entries.find(item => item.id === track) || {};
      const station = entry.source === 'trainmeet' ? stations.find(item => item.id === entry.stationId) : null;
      const connected = !traffic.explicitConnections || !!station && (context?.lines || []).some(item => item.neighborId === entry.stationId);
      out[track] = {name:station?.name || entry.name || track,stationId:entry.source === 'trainmeet' && connected ? entry.stationId : '',incoming:track === incoming,
        button:traffic.anchors[track]?.button || 'htv' + track};
    }
  }
  return out;
}
