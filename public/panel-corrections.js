// Reviewed connections the JMRI panel drew but did not join (docs/rangerlage.md). Each one
// is checked against the geometry: the segment end and the turnout leg must be the same
// point, and both must still be unconnected, or the panel has changed and needs a new look.
const REVIEWED=[
  // 3d ends where 172's diverging leg ends; the layout owner confirmed the connection on
  // 2026-10-06. 3d → 172 → the stub with the buffer stop; on towards 170 is not yet in use.
  {segment:'T26',end:1,point:'EB2',turnout:'TO47',leg:'C'}
];
export function correctPanel(panel){
  const next=structuredClone(panel);
  for(const r of REVIEWED){
    const s=next.segs.find(s=>s.id===r.segment),t=next.turnouts[r.turnout],leg=r.leg.toLowerCase();
    const at=[t?.[leg==='c'?'ccx':leg+'x'],t?.[leg==='c'?'ccy':leg+'y']];
    if(!s||!t||s['c'+r.end]!==r.point||s['t'+r.end]!=='POS_POINT'||t['c'+leg]!=null||Math.hypot(s['x'+r.end]-at[0],s['y'+r.end]-at[1])>0.5)
      throw Error('Panelrättelsen stämmer inte längre: '+r.segment+' mot '+r.turnout+'.'+r.leg);
    s['c'+r.end]=r.turnout;s['t'+r.end]='TURNOUT_'+r.leg;t['c'+leg]=r.segment;
  }
  return next;
}
