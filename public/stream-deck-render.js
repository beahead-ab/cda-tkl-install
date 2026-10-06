// What a Stream Deck key looks like, shared by the deck and the layout editor so the
// editor shows exactly what the deck shows. keySpec() turns a resolved key and the
// panel's current state into a description; drawKey() paints it on a square canvas.
// Colours always follow state; a key's own text and icon only change the words and
// the picture. No WebHID here.
import {pluppSpec,systemSpec,splitLabel,COLORS} from './stream-deck-layout.js';
import {ICONS} from './stream-deck-icons.js';
import {NAV_TARGETS} from './stream-deck-profile.js';
const NAV={next:{icon:'next',text:'Nästa'},prev:{icon:'prev',text:'Föregående'},home:{icon:'home',text:'Hem'}};
// Återställ panel is never quicker than a one-second hold, whatever the layout says.
export const holdOf=key=>key?.type==='system'&&key.id==='panel-reset'?Math.max(1000,key.hold||0):key?.hold||0;
const holdCaption=ms=>`håll ${ms/1000} s`;
export {pluppSpec};
// env: plupp(key) → spec from the plan, train(key) and turn(key) → specs from TrainMeet,
// system → {stopAll, chosen, page, pages, remote, yard}, online → boolean.
export function keySpec(key,env){
  if(!key)return {kind:'empty',lines:[],dim:true,blink:false};
  const system={kind:'system',caption:'',fill:'',ring:'',dim:false,blink:false,blocked:false};
  let spec;
  switch(key.type){
    case 'plupp':spec=env.plupp(key);if(key.text)spec={...spec,lines:splitLabel(key.text)};break;
    case 'train':spec={...env.train(key),label:key.text||''};break;
    case 'turn':spec={...env.turn(key),label:key.text||'',slot:key.slot,details:key.details!==false};break;
    case 'page':spec={...system,id:'page-'+key.target,title:key.title,lines:key.text?splitLabel(key.text):['Sida',key.title]};break;
    case 'nav':{
      const n=NAV[key.to],page=env.system?.page||0,pages=env.system?.pages||1;
      spec={...system,id:'nav-'+key.to,title:NAV_TARGETS[key.to],lines:[key.text||n.text],icon:n.icon,caption:`${page+1} / ${pages}`,dim:pages<2};break;
    }
    case 'missing':spec={...system,id:'missing',title:key.title,lines:[key.title,key.label],dim:true};break;
    case 'ranger-path':case 'ranger-request':case 'ranger-turnout':spec=env.ranger?env.ranger(key):{...system,id:key.type,title:key.title,lines:splitLabel(key.text||key.title),dim:true};break;
    default:spec=systemSpec(key,env.system);if(key.text)spec={...spec,lines:splitLabel(key.text)};
  }
  if(key.icon&&spec.kind==='system')spec={...spec,icon:key.icon};
  const hold=holdOf(key);
  if(hold&&spec.kind!=='train'){
    if(spec.kind==='plupp')spec={...spec,caption:spec.caption?'växel · '+holdCaption(hold):holdCaption(hold)};
    else if(!spec.caption||spec.caption.startsWith('håll'))spec={...spec,caption:holdCaption(hold)};
  }
  if(!env.online&&spec.kind!=='empty')spec={...spec,dim:true};
  return spec;
}
const font=(weight,px)=>`${weight} ${px}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
function fit(c,text,max){let t=String(text);while(c.measureText(t).width>max&&t.length>3)t=t.slice(0,-2)+'…';return t;}
const paths=new Map();
function icon(c,id,cx,cy,size,color){
  const d=ICONS[id]?.d;if(!d||typeof Path2D==='undefined')return;
  if(!paths.has(id))paths.set(id,new Path2D(d));
  c.save();c.translate(cx-size/2,cy-size/2);c.scale(size/24,size/24);
  c.strokeStyle=color;c.lineWidth=2;c.lineCap='round';c.lineJoin='round';c.stroke(paths.get(id));c.restore();
}
// Paint one key. blinkOn picks the phase of a blinking key; the editor passes true and
// never animates.
export function drawKey(c,s,spec,blinkOn=true){
  c.clearRect(0,0,s,s);
  c.fillStyle=spec.kind==='system'&&spec.fill?spec.fill:COLORS.background;c.fillRect(0,0,s,s);
  c.globalAlpha=spec.dim?0.38:1;c.textAlign='center';c.textBaseline='middle';
  if(spec.kind==='train'){
    const bar=spec.blink?(blinkOn?spec.fill:COLORS.background):spec.fill;
    if(bar){c.fillStyle=bar;c.fillRect(0,0,s,Math.max(4,s*0.08));}
    const arrow=spec.role==='departure'?'→':spec.role==='arrival'?'←':'';
    let top;
    if(spec.turn)top=!spec.role?(spec.label||`Tåg på tur ${spec.slot||''}`):spec.details?[`${spec.label||arrow} ${spec.time}`.trim(),spec.track].filter(Boolean).join(' · '):(spec.label||`${arrow} ${spec.neighborCode}`.trim());
    else top=`${arrow} ${spec.label||spec.neighborCode}${spec.time?' · '+spec.time:''}`;
    c.fillStyle=COLORS.muted;c.font=font(500,s*0.13);c.fillText(fit(c,top,s-4),s/2,s*0.24);
    c.fillStyle=COLORS.text;c.font=font(700,(spec.number||'').length>4?s*0.26:s*0.32);c.fillText(spec.number||'—',s/2,s*0.52);
    c.fillStyle=spec.fill&&!spec.dim?spec.fill:COLORS.muted;c.font=font(500,s*0.13);c.fillText(fit(c,spec.text,s-4),s/2,s*0.82);
  }else if(spec.kind!=='empty'){
    const dark=spec.kind==='system'&&spec.fill,ink=dark?'#1a1414':COLORS.text;
    if(spec.kind==='plupp'){
      const r=s*0.17,cx=s/2,cy=s*0.30;
      if(spec.ring){c.beginPath();c.arc(cx,cy,r+s*0.07,0,Math.PI*2);c.strokeStyle=spec.ring;c.lineWidth=Math.max(2,s*0.04);c.stroke();}
      c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle=spec.blink&&!blinkOn?COLORS.background:spec.blink?COLORS.preparing:spec.fill;c.fill();
      c.strokeStyle=spec.blink?COLORS.preparing:spec.fill;c.lineWidth=Math.max(1.5,s*0.025);c.stroke();
      if(spec.blocked){c.fillStyle=COLORS.held;c.fillRect(0,0,s,Math.max(3,s*0.05));}
    }
    const lines=spec.lines||[];let bottom=0;
    if(spec.icon){
      const small=!!spec.caption,size=s*(small?0.34:0.40),y=s*(small?0.29:0.34);
      icon(c,spec.icon,s/2,y,size,ink);
      c.fillStyle=ink;c.font=font(600,s*0.15);const line=fit(c,lines.join(' '),s-6);const ty=s*(small?0.66:0.76);c.fillText(line,s/2,ty);
      bottom=ty;if(spec.strike){const w=c.measureText(line).width;c.fillRect(s/2-w/2,ty-1,w,Math.max(1.5,s*0.025));}
    }else{
      const big=spec.kind==='plupp'?s*0.2:s*0.17,top=spec.kind==='plupp'?s*0.62:s*0.42;
      c.fillStyle=ink;c.font=font(600,big);
      lines.forEach((text,i)=>{const line=fit(c,text,s-6),y=top+i*big*1.15;c.fillText(line,s/2,y);bottom=y;if(spec.strike){const w=c.measureText(line).width;c.fillRect(s/2-w/2,y-1,w,Math.max(1.5,s*0.025));}});
    }
    if(spec.caption){c.font=font(400,s*0.13);c.fillStyle=dark?'#1a1414':COLORS.muted;c.fillText(fit(c,spec.caption,s-4),s/2,Math.max(s*0.9,Math.min(s*0.92,bottom+s*0.18)));}
  }
  c.globalAlpha=1;
}
