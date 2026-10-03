// Fits the plan to its area. There is no zoom: the plan always shows whole in the width
// (or, on a portrait tablet and a phone, fills the height and pans sideways), and its
// size is chosen by dragging the boundary to the bottom row (panel-split.js).
// Local presentation only. Never subscribe to telemetry or send operating orders.
import {zoomGeometry} from './panel-layout.js';

export function createPanelFit({plan,viewport,stage,controls}){
  // A zoom saved by an earlier version no longer applies.
  try{localStorage.removeItem('charlottendal-panel-zoom-v1');}catch{}
  let previous=null,frame=null;
  // A pan indicator under the plan; CSS shows it on tablets and phones.
  const overlay=document.createElement('div');overlay.id='plan-overlay';
  overlay.innerHTML='<div class="plan-pan" aria-hidden="true"><i></i></div>';
  viewport.insertAdjacentElement('afterend',overlay);
  const thumb=overlay.querySelector('.plan-pan i');
  const number=(style,name)=>parseFloat(style.getPropertyValue(name))||0;
  function indicator(){
    const total=Math.max(1,stage.offsetWidth||1),share=Math.min(1,viewport.clientWidth/total);
    thumb.style.width=(share*100).toFixed(2)+'%';thumb.style.left=(Math.max(0,Math.min(1-share,viewport.scrollLeft/total))*100).toFixed(2)+'%';
    overlay.classList.toggle('plan-overlay-pannable',share<.999);
  }
  function render(){
    frame=null;
    const style=getComputedStyle(viewport),insetX=number(style,'--plan-inset-x'),insetTop=number(style,'--plan-inset-top');
    const fit=style.getPropertyValue('--plan-fit').trim();
    const w=viewport.clientWidth,h=viewport.clientHeight,box=plan.viewBox.baseVal;
    const controlsHeight=controls?.offsetHeight||0;
    const innerW=Math.max(1,w-insetX),innerH=Math.max(1,h-controlsHeight-insetTop);
    // A locked-height presentation (portrait tablet, phone strip) fills the height and pans.
    let percent=100;
    if(fit==='height'){const contain=Math.min(innerW/box.width,innerH/box.height);if(contain>0)percent=innerH/box.height/contain*100;}
    const geometry=zoomGeometry(innerW,innerH,box.width,box.height,percent);if(!geometry)return;
    const next={width:geometry.width,height:geometry.height,stageWidth:Math.max(w,geometry.width+insetX),stageHeight:Math.max(h,geometry.height+insetTop+controlsHeight)};
    if(previous&&['width','height','stageWidth','stageHeight'].every(k=>Math.abs(next[k]-previous[k])<.01)){indicator();return;}
    // Keep the viewed location in place while resizing.
    const offsetX=(next.stageWidth-next.width)/2,offsetY=(next.stageHeight-controlsHeight-next.height)/2;
    const x=previous?(viewport.scrollLeft+previous.viewportWidth/2-(previous.stageWidth-previous.width)/2)/previous.width:.5;
    const y=previous?(viewport.scrollTop+previous.viewportHeight/2-(previous.stageHeight-controlsHeight-previous.height)/2)/previous.height:.5;
    stage.style.width=next.stageWidth+'px';stage.style.height=next.stageHeight+'px';
    plan.style.width=next.width+'px';plan.style.height=next.height+'px';
    viewport.scrollLeft=Math.max(0,offsetX+x*next.width-w/2);viewport.scrollTop=Math.max(0,offsetY+y*next.height-h/2);
    previous={...next,viewportWidth:w,viewportHeight:h};
    indicator();
  }
  new ResizeObserver(()=>{if(frame===null)frame=requestAnimationFrame(render);}).observe(viewport);
  render();
  viewport.addEventListener('scroll',indicator,{passive:true});
}
