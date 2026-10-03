// Ported from Claude Design's Charlottendal Reläpanel: computeCrop, snap and btnHit.
// These helpers only place objects; operation state always comes from the server.
export function panelLayout(panel) {
  const controls = panel.sicons.map((source, index) => {
    let x = source.x + 8, y = source.y + 8;
    if ((source.act || '').includes('S-on')) {
      let bestY = null, distance = 15;
      for (const s of panel.segs) {
        if (Math.abs(s.y1 - s.y2) > 2) continue;
        const dy = Math.abs(s.y1 - y);
        if (dy < distance && Math.min(s.x1, s.x2) - 40 < x && Math.max(s.x1, s.x2) + 40 > x) { distance = dy; bestY = s.y1; }
      }
      if (bestY !== null) {
        let left = -Infinity, right = Infinity;
        for (const s of panel.segs) {
          if (Math.abs(s.y1 - s.y2) > 2 || Math.abs(s.y1 - bestY) > 2) continue;
          for (const end of [s.x1, s.x2]) { if (end <= x) left = Math.max(left, end); if (end >= x) right = Math.min(right, end); }
        }
        if (right - left < 60) x = (left + right) / 2;
        y = bestY;
      }
    }
    return { ...source, index, centerX: x, centerY: y };
  }).filter(c => !c.hidden && c.y < 840);
  const buttons = controls.filter(c => (c.act || '').includes('S-on') || c.sensor.startsWith('tvv'));
  for (const b of buttons) {
    let distance = Infinity;
    for (const other of buttons) if (other.index !== b.index) distance = Math.min(distance, Math.hypot(other.centerX - b.centerX, other.centerY - b.centerY));
    for (const m of panel.micons) distance = Math.min(distance, Math.hypot(m.x + 9 - b.centerX, m.y + 12 - b.centerY));
    b.hitCap = Math.max(18, distance - 4);
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const include = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  for (const s of panel.segs) if (!s.hide && s.b !== 'frame' && Math.min(s.y1, s.y2) <= 850) include(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2));
  for (const t of Object.values(panel.turnouts)) for (const [x, y] of [[t.ax, t.ay], [t.bx, t.by], [t.ccx, t.ccy]]) if (x != null && y <= 850) include(x, y, x, y);
  const t = panel.turntable;
  if (t) include(t.cx-t.r-5, t.cy-t.r-5, t.cx+t.r+5, t.cy+t.r+5);
  for (const l of panel.labels) if (!l.hidden && l.y < 840) include(l.x, l.y, l.x + l.text.trim().length*l.size*.58 + (l.br != null ? 12 : 0), l.y+l.size*1.4);
  for (const s of controls) include(s.x-3, s.y-3, s.x+21, s.y+21);
  for (const m of panel.micons) include(m.x-2, m.y-2, m.x+34, m.y+34);
  for (const b of panel.bicons) if (b.y < 840) include(b.x, b.y, b.x+44, b.y+16);
  return { controls, crop: { x: Math.floor(x0-16), y: Math.floor(y0-16), width: Math.ceil(x1-x0)+32, height: Math.ceil(y1-y0)+32 } };
}

// Zoom is relative to fitting the complete plan in the available viewport.
export function normalizeZoom(value){
  const n=(typeof value==='number'||typeof value==='string'&&value.trim())?Number(value):NaN;
  return Number.isFinite(n)?Math.min(300,Math.max(50,Math.round(n/5)*5)):100;
}
export function zoomGeometry(width,height,planWidth,planHeight,percent){
  if(![width,height,planWidth,planHeight].every(n=>Number.isFinite(n)&&n>0))return null;
  const scale=Math.min(width/planWidth,height/planHeight)*normalizeZoom(percent)/100;
  const w=planWidth*scale,h=planHeight*scale;
  return {width:w,height:h,stageWidth:Math.max(width,w),stageHeight:Math.max(height,h)};
}
