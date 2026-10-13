// Tidtabellens stil (0.80.0), som i TrainMeet-appen för iPhone: samma tåg kan visas i ord, med små tecken, som en
// linjebild med stationen i mitten, eller linjebilden med tecken. Valet gäller den här webbläsaren (Inställningar →
// Utseende och ljud). Spåret står bara i Spår-kolumnen, i en ram när tåget står inne. Inget här ändrar något; raderna
// kommer färdiga från groupRows (public/timetable-rows.js), och här ritas de bara. Tecknen är ritade, inte tagna ur ett
// typsnitt, så att de ser likadana ut på alla skärmar, och de tar färgen från texten runt omkring.
import {groupRows} from './timetable-rows.js';

export const STYLE_KEY='charlottendal-timetable-style';
export const STYLES=[
  {id:'words',title:'Ord',detail:'Läget i ord, som Närmar sig och Avgått.'},
  {id:'symbols',title:'Symboler',detail:'Små tecken i stället för ord.'},
  {id:'line',title:'Linjebild',detail:'Stationen i mitten och linjerna åt båda håll.'},
  {id:'lineSymbols',title:'Linjebild + symboler',detail:'Linjebilden, med tecken för klareringsbegäran och minuterna.'}
];
export const FALLBACK='words';
export const validStyle=value=>STYLES.some(s=>s.id===value)?value:FALLBACK;
export const drawsLine=style=>style==='line'||style==='lineSymbols';
export const usesSymbols=style=>style==='symbols'||style==='lineSymbols';
export const styleTitle=style=>STYLES.find(s=>s.id===validStyle(style)).title;
// The choice is kept per browser; a browser without storage keeps the words.
export function readStyle(storage=globalThis.localStorage){try{return validStyle(storage?.getItem(STYLE_KEY));}catch{return FALLBACK;}}
export function saveStyle(value,storage=globalThis.localStorage){const style=validStyle(value);try{storage?.setItem(STYLE_KEY,style);}catch{}return style;}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Colours of the line picture, as in the app: planned grey dashed, requested amber dashed,
// cleared green, the train out on the line blue, done dark grey.
export const LEG_COLORS={planned:'#5c656e',requested:'#f5c518',cleared:'#4cd787',onLine:'#6ea8fe',done:'#3a424a'};
const NODE={standing:'#f5c518',doneFill:'#3a424a',doneRing:'#4a535c',now:'#f3f5f7',next:'#7d8791'};

// One mark: lines in currentColor in a small box, mirrored for the other direction.
function glyph(width,height,body,{mirrored=false,lineWidth=1.5,className=''}={}){
  const inner=mirrored?`<g transform="translate(${width} 0) scale(-1 1)">${body}</g>`:body;
  return `<svg class="tt-g${className?' '+className:''}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="currentColor" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}
const dot=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`;
const filled=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
export const GLYPHS={
  // This station: a ring with a dot.
  here:()=>glyph(12,12,dot(6,6,4.6)+filled(6,6,1.8)),
  // In and out on the same side: it turns here, pointing the way it goes back out.
  turn:towardsLeft=>glyph(15,13,'<path d="M1.5 3.5H10A3 3 0 0 1 10 9.5H1.5M4 7L1.5 9.5L4 12"/>',{mirrored:!towardsLeft,lineWidth:1.7}),
  // Gone from the station: a dot and an arrow away from it.
  departed:towardsLeft=>glyph(18,14,dot(4,7,2.6)+'<path d="M8 7H16M13.5 4.5L16 7L13.5 9.5"/>',{mirrored:towardsLeft,lineWidth:1.6}),
  // Came in: an arrow into a filled dot.
  arrived:towardsLeft=>glyph(18,14,'<path d="M2 7H10M7.5 4.5L10 7L7.5 9.5"/>'+filled(14,7,2.6),{mirrored:towardsLeft,lineWidth:1.6}),
  // On its way here: the front of a train.
  approaching:()=>glyph(14,14,'<rect x="3" y="1.5" width="8" height="9" rx="2.2"/><path d="M3 6.5H11M4.5 13L5.5 10.5M9.5 13L8.5 10.5"/>'),
  // Asked, waiting for the answer: an hourglass.
  waiting:()=>glyph(14,14,'<path d="M3.5 1.5H10.5M3.5 12.5H10.5M4.5 1.5L9.5 12.5M9.5 1.5L4.5 12.5"/>'),
  // Cleared: a tick in a ring.
  cleared:()=>glyph(16,16,dot(8,8,6.6)+'<path d="M5 8.3L7.1 10.3L11 6"/>',{lineWidth:1.7}),
  // Minutes until: a clock.
  clock:()=>glyph(13,13,dot(6.5,6.5,5.4)+'<path d="M6.5 3.6V6.8L8.7 8.2"/>'),
  // Column heads: an arrow into the station, and one away from it.
  arrivalHeader:()=>glyph(22,12,'<path d="M1 6H12M9 3L12 6L9 9"/>'+filled(17,6,3.2)),
  departureHeader:()=>glyph(22,12,'<path d="M10 6H21M18 3L21 6L18 9"/>'+filled(4,6,3.2))
};

// The sign for what goes on now (Symboler). Words for the states without a sign stay words.
const SIGN={
  departed:row=>({html:GLYPHS.departed(row.toSide==='left'),title:'Avgått'}),
  arrived:row=>({html:GLYPHS.arrived(row.fromSide==='right'),title:'Ankommet'}),
  approaching:()=>({html:GLYPHS.approaching(),title:'Närmar sig',className:'tt-sym-approaching'}),
  waiting:()=>({html:GLYPHS.waiting(),title:'Begärt, väntar på svar',className:'tt-sym-waiting'}),
  cleared:()=>({html:GLYPHS.cleared(),title:'Klart',className:'tt-sym-cleared'}),
  request:()=>({html:'<span class="tt-request" aria-hidden="true">?</span>',title:'Grannen begär klarering: svara under Klarering'})
};
const sign=(row,activity=row.activity)=>{const s=SIGN[activity]?.(row);return s?`<span class="tt-sym${s.className?' '+s.className:''}" title="${esc(s.title)}">${s.html}</span>`:'';};
export const lateMark=minutes=>`<span class="tt-late" title="${esc('sen '+minutes+' min')}">+${minutes}′</span>`;
export const countdownMark=minutes=>`<span class="tt-countdown" title="${esc('om '+minutes+' min')}">${GLYPHS.clock()}${minutes}′</span>`;

// The läge cell. Ord: the words as before. Symboler: the sign, the minutes as marks, and
// the words that have no sign. Linjebild: only what the picture cannot show.
export function lageHTML(row,style){
  const parts=row.parts||[];
  if(style==='words'||!style)return esc(row.lage);
  const marks=[],words=[];
  const status=parts.find(p=>p.kind==='status');
  if(style==='symbols'){const s=sign(row);if(s)marks.push(s);else if(status)words.push(status.text);}
  else{
    if(row.activity==='request'){if(style==='lineSymbols')marks.push(sign(row,'request'));else words.push('Begär klart');}
    // The picture shows the train standing, on the line, asked for and cleared; not that the driver is there.
    if(status?.value==='ready'&&row.activity==='standing')words.push(status.text);
  }
  for(const p of parts){
    if(p.kind==='status')continue;
    if(p.kind==='late'&&usesSymbols(style))marks.push(lateMark(p.minutes));
    else if(p.kind==='countdown'&&usesSymbols(style))marks.push(countdownMark(p.minutes));
    else words.push(p.text);
  }
  const text=words.length?`<span class="tt-words">${esc(words.join(' · '))}</span>`:'';
  return marks.length?`<span class="tt-marks">${marks.join('')}${text}</span>`:text;
}

// The line picture (Linjebild): this station as a dot in the middle, the neighbours' codes on
// their sides, and each line drawn as what happens on it, with the arrow the way the train runs.
export function routePicture(row){
  const inSide=row.from?row.fromSide||'left':'',outSide=row.to?row.toSide||'right':'';
  const leg=side=>inSide===side&&outSide===side?{turns:true,in:row.inState,out:row.outState}:inSide===side?{in:row.inState}:outSide===side?{out:row.outState}:null;
  const code=side=>outSide===side&&row.to?row.toCode||'':inSide===side&&row.from?row.fromCode||'':'';
  return {left:leg('left'),right:leg('right'),leftCode:code('left'),rightCode:code('right'),node:row.standing?'standing':'open'};
}
export function lineSegment(x1,x2,y,state){
  const c=LEG_COLORS[state]||LEG_COLORS.planned,dash=state==='planned'||state==='requested'?' stroke-dasharray="3 3"':'',back=x2>x1?-4.5:4.5;
  let out=`<path d="M${x1} ${y}H${x2}" stroke="${c}"${dash}/><path d="M${x2+back} ${y-3.5}L${x2} ${y}L${x2+back} ${y+3.5}" stroke="${c}"/>`;
  if(state==='onLine'){const x=(x1+x2)/2;out+=`<rect x="${x-5.5}" y="${y-4}" width="11" height="8" rx="2.5" fill="${c}" stroke="none"/>`;}
  return out;
}
const svgOpen=(width,height,className)=>`<svg class="${className}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`;
export function routePictureHTML(row){
  const p=routePicture(row),W=84,mid=42,y=8,gap=6;
  const edge={left:2,right:W-2},near={left:mid-gap,right:mid+gap};
  let body='';
  for(const side of ['left','right']){
    const l=p[side];if(!l)continue;
    if(l.turns){body+=lineSegment(edge[side],near[side],y-3.5,l.in)+lineSegment(near[side],edge[side],y+3.5,l.out);}
    else if(l.in)body+=lineSegment(edge[side],near[side],y,l.in);
    else body+=lineSegment(near[side],edge[side],y,l.out);
  }
  const ring=row.group==='done'?NODE.doneRing:row.group==='next'?NODE.next:NODE.now;
  body+=p.node==='standing'?`<circle cx="${mid}" cy="${y}" r="4.5" fill="${NODE.standing}" stroke="none"/>`:`<circle class="tt-node" cx="${mid}" cy="${y}" r="4.5" stroke="${ring}" stroke-width="1.8"/>`;
  return `<span class="tt-route-pic"><b>${esc(p.leftCode)}</b>${svgOpen(W,16,'tt-line-pic')}${body}</svg><b>${esc(p.rightCode)}</b></span>`;
}

// The route in the Symboler style: this station as a mark where the words say "börjar här"
// or "slutar". In one column the order follows the panel, as in the app: the line to the left first.
function placeHTML(name){return name?esc(name):`<span class="tt-sym" title="Den här stationen">${GLYPHS.here()}</span>`;}
function turnHTML(row){return `<span class="tt-sym" title="Vänder här">${GLYPHS.turn(row.fromSide!=='right')}</span>`;}
const turns=row=>!!row.from&&!!row.to&&row.fromSide===row.toSide;
function routeHTML(row){
  const start=placeHTML(row.from),end=placeHTML(row.to),arrow=a=>`<b class="tt-arrow">${a}</b>`;
  const leftward=row.fromSide==='right'||(!row.from&&row.toSide==='left');
  let inner=leftward?end+arrow('←')+start:start+arrow('→')+end;
  if(turns(row)){const names=esc(row.from===row.to?row.from:row.from+' / '+row.to);inner=row.fromSide==='right'?placeHTML('')+turnHTML(row)+names:names+turnHTML(row)+placeHTML('');}
  return `<span class="tt-route">${inner}</span>`;
}

const LABELS={n:'Tåg',slag:'Slag',fr:'Från',till:'Till',frtill:'Från → till',ank:'Ank',avg:'Avg',spar:'Spår',lage:'Läge',anm:'Anmärkning',la:'Läge · anmärkning'};
export const CELLS=Object.keys(LABELS);
// The column heads: Linjebild puts one Linje over Från and Till; the symbol styles head Ank
// and Avg with an arrow into the station and one away from it.
export function labelsHTML(style){
  const html={...Object.fromEntries(Object.entries(LABELS).map(([k,v])=>[k,esc(v)]))};
  if(drawsLine(style)){html.fr='Linje';html.till='';html.frtill='Linje';}
  if(usesSymbols(style)){html.ank=`<span title="Ankomst">${GLYPHS.arrivalHeader()}</span>`;html.avg=`<span title="Avgång">${GLYPHS.departureHeader()}</span>`;}
  return CELLS.map(c=>`<span class="tt-${c}">${html[c]}</span>`).join('');
}
// The track, once: in a frame while the train stands on it.
function trackHTML(row){
  const text=esc(row.track)+(row.changed?' *':'');
  return row.standing?`<span class="tt-track-frame" title="Tåget står inne på spåret">${text}</span>`:text;
}
// One row's cells in the chosen style.
export function cellsHTML(row,style=FALLBACK){
  const html={n:esc(row.number),slag:esc(row.slag),fr:esc(row.fromText),till:esc(row.toText),frtill:esc(row.frTill),ank:esc(row.arrival||'—'),avg:esc(row.departure||'—'),spar:trackHTML(row),lage:lageHTML(row,style),anm:esc(row.noteLine)};
  if(drawsLine(style)){const pic=routePictureHTML(row);html.fr=pic;html.till='';html.frtill=pic;}
  else if(style==='symbols'){html.fr=placeHTML(row.from);html.till=(turns(row)?turnHTML(row):'')+placeHTML(row.to);html.frtill=routeHTML(row);}
  html.la=[html.lage,row.noteLine?esc(row.noteLine):''].filter(Boolean).join(style==='words'?' · ':'<span class="tt-sep"> · </span>');
  return html;
}
export function rowHTML(row,style=FALLBACK,{preview=false}={}){
  const html=cellsHTML(row,style),titles={anm:row.note,la:row.la,lage:style==='words'?'':row.lage};
  const cells=CELLS.map(c=>`<span class="tt-${c}${c==='spar'&&row.changed?' tt-track-changed':''}"${titles[c]?' title="'+esc(titles[c])+'"':''}>${html[c]}</span>`).join('');
  if(preview)return `<span class="tt-entry tt-${row.group}" aria-hidden="true">${cells}</span>`;
  return `<button type="button" class="tt-entry tt-${row.group}" data-timetable-row="${row.i}" aria-haspopup="dialog" aria-label="Visa tidtabellsuppgifter för tåg ${esc(row.number)}">${cells}</button>`;
}

// The trains under Inställningar to compare the styles, at 12:36: 41 stands on 2a and has
// asked Vagnsta for clearance, 93 is on its way in from Vagnsta on the right and goes on to
// Lekby on the left, and 3510 starts here in nine minutes towards Kungsfors.
export function sampleRows(){
  const base={slag:'Pt',note:'',noStop:false,changed:false,planned:'',inLine:'',outLine:''};
  return groupRows([
    {...base,id:'41',number:'41',slag:'Gt',arrival:'12:20',departure:'12:38',sortTime:'12:20',from:'Kungsfors',to:'Vagnsta',fromCode:'KF',toCode:'VA',fromSide:'left',toSide:'right',track:'2a',trackLabel:'2a',movement:{arrival:'arrived',departure:'ready'},outLine:'requested'},
    {...base,id:'93',number:'93',arrival:'12:40',departure:'12:43',sortTime:'12:40',from:'Vagnsta',to:'Lekby',fromCode:'VA',toCode:'LK',fromSide:'right',toSide:'left',track:'1a',trackLabel:'1a',movement:{arrival:'approaching',departure:'none'},inLine:'occupied'},
    {...base,id:'3510',number:'3510',arrival:'',departure:'12:45',sortTime:'12:45',from:'',to:'Kungsfors',toCode:'KF',fromSide:'',toSide:'left',track:'3',trackLabel:'3',movement:null}
  ],{minutes:12*60+36,routes:[{state:'active',label:'Spår 2a → Bu'},{state:'active',label:'Bu → Spår 1a'}]}).all;
}
export function previewHTML(style){
  return `<span class="tt-preview" data-tt-style="${validStyle(style)}" aria-hidden="true">${sampleRows().map(r=>rowHTML(r,validStyle(style),{preview:true})).join('')}</span>`;
}

// The signs of the chosen style, for Teckenförklaring. The frame is the same in every style.
export function legendHTML(style){
  const item=(mark,text)=>`<span class="tt-legend-item"><span class="tt-legend-mark">${mark}</span>${esc(text)}</span>`;
  const line=state=>`${svgOpen(44,16,'tt-line-pic')}${lineSegment(4,40,8,state)}</svg>`;
  const items=[item('<span class="tt-track-frame">2a</span>','Spåret i en ram: tåget står inne på spåret')];
  if(drawsLine(style)){
    items.push(item(line('planned'),'Streckad grå: planerat'),item(line('requested'),'Streckad gul: begärt'),item(line('cleared'),'Grön: klart'),item(line('onLine'),'Blå: tåget är ute på linjen'),item(line('done'),'Mörkgrå: avklarat'),
      item(`${svgOpen(16,16,'tt-line-pic')}<circle cx="8" cy="8" r="4.5" fill="${NODE.standing}" stroke="none"/></svg>`,'Gul prick: tåget står inne'));
  }
  if(style==='symbols'){
    items.push(item(GLYPHS.here(),'Den här stationen: tåget börjar eller slutar här'),item(GLYPHS.turn(true),'Vänder här'),item(GLYPHS.departed(false),'Avgått'),item(GLYPHS.arrived(false),'Ankommet'),
      item(`<span class="tt-sym-approaching">${GLYPHS.approaching()}</span>`,'Närmar sig'),item(`<span class="tt-sym-waiting">${GLYPHS.waiting()}</span>`,'Begärt, väntar på svar'),item(`<span class="tt-sym-cleared">${GLYPHS.cleared()}</span>`,'Klart'));
  }
  if(usesSymbols(style))items.push(item('<span class="tt-request">?</span>','Grannen begär klarering: svara under Klarering'),item(countdownMark(16),'Minuter tills nästa tåg'),item(lateMark(6),'Minuter sen'));
  const note=style==='words'?'':style==='symbols'?'Det som saknar tecken, som Redo och tågväg ej lagd, står kvar i ord.':'Under linjebilden står bara det bilden inte visar, som Redo och tågväg ej lagd.';
  return `<h4>Tidtabellen · ${esc(styleTitle(style))}</h4><div class="tt-legend">${items.join('')}</div>${note?`<p class="muted">${esc(note)}</p>`:''}`;
}
