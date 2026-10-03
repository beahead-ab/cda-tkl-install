// Where the boundary between the plan and the bottom row may go. Pure, so it can be
// tested. The plan keeps its proportions: it grows until it spans the width (or, on a
// portrait tablet where it pans sideways, until the bottom row is at its smallest)
// and shrinks to about half that size. The bottom row never goes below MIN_BOTTOM.
export const SPLIT_KEY='cda-panel-split-v1';
export const MIN_BOTTOM=160;
const RATIO=3.0552;
export function splitBounds({width,height,insetX=0,insetTop=0,portrait=false}){
  const fit=Math.max(1,(width-insetX)/RATIO),room=Math.max(0,height-insetTop-MIN_BOTTOM);
  if(portrait)return {min:Math.round(Math.min(fit,room)),max:Math.round(room)};
  const max=Math.min(fit,room);
  return {min:Math.round(Math.min(max,Math.max(160,fit*.45))),max:Math.round(max)};
}
// A saved choice is the plan's share of the window height, so it follows a resize.
export const planHeight=(ratio,height,bounds)=>Math.round(Math.min(bounds.max,Math.max(bounds.min,ratio*height)));
export function readSplit(raw){const ratio=Number(raw);return raw!=null&&raw!==''&&Number.isFinite(ratio)&&ratio>0&&ratio<1?ratio:null;}
