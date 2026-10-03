// The boundary between the plan and the bottom row can be dragged: a lower bottom row
// gives a larger plan, until the plan reaches the sides. Double-click puts it back.
// The choice is this browser's own (localStorage), like the zoom. Presentation only.
import {SPLIT_KEY,planHeight,readSplit,splitBounds} from './panel-split-model.js';
export function createPanelSplit({bottom,viewport}){
  if(!bottom||!viewport)return null;
  const body=document.body,handle=document.createElement('div');
  handle.id='panel-divider';handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','horizontal');
  handle.setAttribute('aria-label','Gränsen mellan ställverket och tidtabellen. Dra eller använd pilarna; dubbelklicka för standardläget.');
  handle.title='Dra för att ändra storleken · dubbelklicka för standardläget';
  handle.innerHTML='<i aria-hidden="true"></i>';bottom.prepend(handle);
  const enabled=matchMedia('(min-width:501px) and (min-height:431px)'),portrait=matchMedia('(orientation:portrait) and (max-width:900px)');
  const number=name=>parseFloat(getComputedStyle(body).getPropertyValue(name))||0;
  // The layout viewport, the same box the CSS lengths (vw, dvh) are measured in.
  const view=()=>({width:document.documentElement.clientWidth||innerWidth,height:document.documentElement.clientHeight||innerHeight});
  let ratio=null;try{ratio=readSplit(localStorage.getItem(SPLIT_KEY));}catch{}
  const bounds=()=>splitBounds({...view(),insetX:number('--plan-inset-x'),insetTop:number('--plan-inset-top')+number('--console-h'),portrait:portrait.matches});
  // The plan's height as drawn now: its row less the top inset.
  const current=()=>viewport.offsetHeight-number('--plan-inset-top')-number('--console-h');
  function show(height){
    const b=bounds();handle.setAttribute('aria-valuemin',String(b.min));handle.setAttribute('aria-valuemax',String(b.max));handle.setAttribute('aria-valuenow',String(Math.round(height??current())));
  }
  function apply(){
    handle.hidden=!enabled.matches;
    if(!enabled.matches||ratio==null){body.style.removeProperty('--plan-user');show();return;}
    const height=planHeight(ratio,view().height,bounds());body.style.setProperty('--plan-user',height+'px');show(height);
  }
  function set(height,save){
    const b=bounds();height=Math.min(b.max,Math.max(b.min,height));ratio=height/view().height;
    body.style.setProperty('--plan-user',Math.round(height)+'px');show(height);
    if(save)try{localStorage.setItem(SPLIT_KEY,String(ratio));}catch{}
  }
  function reset(){ratio=null;try{localStorage.removeItem(SPLIT_KEY);}catch{}apply();}
  let drag=null;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();try{handle.setPointerCapture(e.pointerId);}catch{}drag={y:e.clientY,start:current()};body.dataset.splitDragging='';});
  handle.addEventListener('pointermove',e=>{if(drag)set(drag.start+e.clientY-drag.y,false);});
  const end=e=>{if(!drag)return;drag=null;delete body.dataset.splitDragging;try{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);}catch{}if(ratio!=null)try{localStorage.setItem(SPLIT_KEY,String(ratio));}catch{}};
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  handle.addEventListener('dblclick',reset);
  handle.addEventListener('keydown',e=>{
    const step=e.shiftKey?64:16,b=bounds();
    const next={ArrowDown:current()+step,ArrowUp:current()-step,End:b.max,Home:b.min}[e.key];
    if(next!=null){e.preventDefault();set(next,true);}
  });
  for(const query of [enabled,portrait])query.addEventListener('change',apply);
  // A rotated tablet or a resized window re-clamps the saved choice.
  addEventListener('resize',apply);new ResizeObserver(()=>apply()).observe(document.documentElement);
  addEventListener('storage',e=>{if(e.key===SPLIT_KEY||e.key===null){ratio=readSplit(e.newValue);apply();}});
  apply();
  return {reset};
}
