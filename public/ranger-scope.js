// What the ranger's view shows (docs/rangerlage.md): the ranger's own area, spår 11–13
// with the request groups' own routes, and short stubs where TKL's tracks continue.
// Everything else is not drawn. Pure: built once from the panel and the profile.
const key=(x,y)=>Math.round(x)+','+Math.round(y);
const STUB=28,MARGIN=40,TRACKS=new Set(['SIIIA','SIVA','SVA']);
function distance(px,py,s){
  const dx=s.x2-s.x1,dy=s.y2-s.y1,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((px-s.x1)*dx+(py-s.y1)*dy)/len)):0;
  return Math.hypot(px-(s.x1+dx*t),py-(s.y1+dy*t));
}
export function rangerScope(panel,config){
  const segs=panel.segs.filter(s=>s.b!=='frame'&&s.b!=='turntable'&&!s.hide&&Math.min(s.y1,s.y2)<850),byId=new Map(segs.map(s=>[s.id,s]));
  const groups=config.rangerRequests||[],routes=groups.map(g=>config.routes.find(r=>r.id===g.route)).filter(Boolean);
  const segments=new Set(config.yardArea?.segments||[]);
  for(const s of segs)if(TRACKS.has(s.b))segments.add(s.id);
  for(const r of routes)for(const id of r.segments||[])if(byId.has(id))segments.add(id);
  const turnouts=new Set([...(config.yardArea?.turnouts||[]),...(config.yardArea?.boundaries||[]),...groups.flatMap(g=>Object.keys(g.out)),...routes.flatMap(r=>Object.keys(r.turnouts||{}))]);
  // Where TKL's track continues from a visible end: a short stub, drawn but never live.
  const ends=new Set();
  for(const id of segments){const s=byId.get(id);if(s){ends.add(key(s.x1,s.y1));ends.add(key(s.x2,s.y2));}}
  for(const t of Object.values(panel.turnouts))if(turnouts.has(t.name))for(const [x,y] of [[t.ax,t.ay],[t.bx,t.by],[t.ccx,t.ccy]])if(x!=null)ends.add(key(x,y));
  const stubs=new Map();
  for(const s of segs){
    if(segments.has(s.id))continue;
    const a=ends.has(key(s.x1,s.y1)),b=ends.has(key(s.x2,s.y2));if(!a&&!b)continue;
    const [fx,fy,tx,ty]=a?[s.x1,s.y1,s.x2,s.y2]:[s.x2,s.y2,s.x1,s.y1],k=Math.min(1,STUB/(Math.hypot(tx-fx,ty-fy)||1));
    stubs.set(s.id,{x1:fx,y1:fy,x2:fx+(tx-fx)*k,y2:fy+(ty-fy)*k});
  }
  const shown=[...segments].map(id=>byId.get(id)).filter(Boolean);
  const near=(x,y,limit=30)=>shown.some(s=>distance(x,y,s)<=limit);
  const blocks=new Set(shown.map(s=>s.b));
  const signals=new Set(routes.flatMap(r=>[...(r.signals||[]),...(r.guardSignals||[])]));
  const buttons=new Set(routes.flatMap(r=>[r.from,r.to]));
  const showSignal=m=>signals.has(m.mast)||near(m.x+9,m.y+12,34);
  const showButton=b=>buttons.has(b.sensor)||(config.buttons?.[b.sensor]?.segment?segments.has(config.buttons[b.sensor].segment):b.sensor.startsWith('vxv')?b.sensor.slice(3).split('/').every(n=>turnouts.has('Vx'+n)):near(b.centerX,b.centerY,26));
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  const include=(a,b,c,d)=>{x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,c);y1=Math.max(y1,d);};
  for(const s of [...shown,...stubs.values()])include(Math.min(s.x1,s.x2),Math.min(s.y1,s.y2),Math.max(s.x1,s.x2),Math.max(s.y1,s.y2));
  for(const t of Object.values(panel.turnouts))if(turnouts.has(t.name))include(t.cx-14,t.cy-16,t.cx+30,t.cy+4);
  const tt=panel.turntable;if(tt)include(tt.cx-tt.r-5,tt.cy-tt.r-5,tt.cx+tt.r+5,tt.cy+tt.r+5);
  return {segments,stubs,turnouts,blocks,signals,buttons,near,showSignal,showButton,
    crop:{x:Math.floor(x0-MARGIN),y:Math.floor(y0-MARGIN),width:Math.ceil(x1-x0)+2*MARGIN,height:Math.ceil(y1-y0)+2*MARGIN}};
}
