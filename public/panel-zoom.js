import {createAdminDialog} from './admin-ui.js';
import {normalizeZoom,zoomGeometry} from './panel-layout.js';

export const ZOOM_KEY='charlottendal-panel-zoom-v1';
export const zoomLabel=value=>value===100?'100 % · Visa hela':`${value} %`;

// Local presentation only. Never subscribe to telemetry or send operating orders.
export function createPanelZoom({plan,viewport,stage,controls}){
  let saved=100,explicit=false;try{const stored=localStorage.getItem(ZOOM_KEY);explicit=stored!=null;saved=normalizeZoom(stored);}catch{}
  let value=saved,previous=null,frame=null,preview=null,restoreScroll=null,presented=saved,pinch=null;
  const listeners=new Set();
  // Tags and a pan indicator over the plan; CSS shows them on tablets and phones.
  const overlay=document.createElement('div');overlay.id='plan-overlay';
  overlay.innerHTML='<div class="plan-zoom-tags"><span class="plan-zoom-tag" id="plan-zoom-tag"></span><button type="button" class="plan-zoom-tag" id="plan-zoom-fit">Visa hela</button></div><div class="plan-pan" aria-hidden="true"><i></i></div>';
  viewport.insertAdjacentElement('afterend',overlay);
  const tag=overlay.querySelector('#plan-zoom-tag'),fitButton=overlay.querySelector('#plan-zoom-fit'),thumb=overlay.querySelector('.plan-pan i');
  const number=(style,name)=>parseFloat(style.getPropertyValue(name))||0;
  function indicator(){
    const total=Math.max(1,stage.offsetWidth||1),share=Math.min(1,viewport.clientWidth/total);
    thumb.style.width=(share*100).toFixed(2)+'%';thumb.style.left=(Math.max(0,Math.min(1-share,viewport.scrollLeft/total))*100).toFixed(2)+'%';
    overlay.classList.toggle('plan-overlay-pannable',share<.999);
  }
  function render(){
    frame=null;
    const style=getComputedStyle(viewport),insetX=number(style,'--plan-inset-x'),insetTop=number(style,'--plan-inset-top');
    const fit=style.getPropertyValue('--plan-fit').trim(),tagMode=style.getPropertyValue('--plan-tag').trim();
    const w=viewport.clientWidth,h=viewport.clientHeight,box=plan.viewBox.baseVal;
    const controlsHeight=controls?.offsetHeight||0;
    const innerW=Math.max(1,w-insetX),innerH=Math.max(1,h-controlsHeight-insetTop);
    // 100 % fits the whole plan in the stage. A locked-height presentation (portrait
    // tablet, phone strip) fills the height until the user has chosen a zoom.
    let percent=value;
    if(fit==='height'&&!explicit&&!preview&&!pinch){const contain=Math.min(innerW/box.width,innerH/box.height);if(contain>0)percent=normalizeZoom(innerH/box.height/contain*100);}
    const geometry=zoomGeometry(innerW,innerH,box.width,box.height,percent);if(!geometry)return;
    const next={width:geometry.width,height:geometry.height,stageWidth:Math.max(w,geometry.width+insetX),stageHeight:Math.max(h,geometry.height+insetTop+controlsHeight)};
    const offsetX=(next.stageWidth-next.width)/2,offsetY=(next.stageHeight-controlsHeight-next.height)/2;
    if(presented!==percent){presented=percent;notify();}
    tag.textContent=tagMode==='pinch'?'Dra · nyp för zoom':percent+' % · dra för att panorera';
    fitButton.hidden=percent===100;
    if(previous&&['width','height','stageWidth','stageHeight'].every(k=>Math.abs(next[k]-previous[k])<.01)){restorePosition();indicator();return;}
    // Keep the viewed location in place while resizing. At 100% the whole plan fits.
    const x=previous?(viewport.scrollLeft+previous.viewportWidth/2-(previous.stageWidth-previous.width)/2)/previous.width:.5;
    const y=previous?(viewport.scrollTop+previous.viewportHeight/2-(previous.stageHeight-controlsHeight-previous.height)/2)/previous.height:.5;
    stage.style.width=next.stageWidth+'px';stage.style.height=next.stageHeight+'px';
    plan.style.width=next.width+'px';plan.style.height=next.height+'px';
    viewport.scrollLeft=Math.max(0,offsetX+x*next.width-w/2);viewport.scrollTop=Math.max(0,offsetY+y*next.height-h/2);
    previous={...next,viewportWidth:w,viewportHeight:h};
    restorePosition();indicator();
  }
  function restorePosition(){if(restoreScroll){viewport.scrollLeft=restoreScroll.left;viewport.scrollTop=restoreScroll.top;restoreScroll=null;}}
  function schedule(){if(frame===null)frame=requestAnimationFrame(render);}
  function notify(){for(const fn of listeners)fn(presented);}
  new ResizeObserver(schedule).observe(viewport);
  render();
  viewport.addEventListener('scroll',indicator,{passive:true});
  window.addEventListener('storage',e=>{
    if(e.key!==ZOOM_KEY&&e.key!==null)return;
    saved=normalizeZoom(e.newValue);explicit=e.newValue!=null;if(!preview){value=saved;schedule();}
  });
  const api={
    get value(){return presented;},
    subscribe(fn){listeners.add(fn);fn(presented);return ()=>listeners.delete(fn);},
    set(next){
      const n=normalizeZoom(next);
      try{localStorage.setItem(ZOOM_KEY,String(n));}catch{throw Error('Webbläsaren kunde inte spara zoomen. Kontrollera att lokal lagring är tillåten.');}
      saved=value=n;explicit=true;preview=restoreScroll=null;schedule();
    },
    beginPreview(){restoreScroll=null;preview={left:viewport.scrollLeft,top:viewport.scrollTop};},
    preview(next){value=normalizeZoom(next);schedule();},
    cancelPreview(){value=saved;restoreScroll=preview;preview=null;schedule();},
  };
  fitButton.onclick=()=>{try{api.set(100);}catch{}};
  // Pinch on touch screens scales the zoom; the result is kept like a chosen zoom.
  const pointers=new Map();
  const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)||1;};
  viewport.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;pointers.set(e.pointerId,e);if(pointers.size===2)pinch={distance:distance(),base:presented};});
  viewport.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,e);if(pinch&&pointers.size===2){value=normalizeZoom(pinch.base*distance()/pinch.distance);schedule();}});
  const endPinch=e=>{pointers.delete(e.pointerId);if(pinch&&pointers.size<2){const chosen=value;pinch=null;try{api.set(chosen);}catch{value=saved;schedule();}}};
  viewport.addEventListener('pointerup',endPinch);viewport.addEventListener('pointercancel',endPinch);
  return api;
}

export function createZoomControl({id,onInput=()=>{}}){
  const element=document.createElement('div');element.className='panel-zoom-control';
  element.innerHTML=`<div class="zoom-value-row"><label for="${id}">Zoom</label><output for="${id}"></output></div><input id="${id}" type="range" min="50" max="300" step="5" aria-describedby="${id}-help"><div class="zoom-scale" aria-hidden="true"><span>50 %</span><span>300 %</span></div><button type="button" class="zoom-fit">Visa hela</button><p id="${id}-help" class="muted">100 % visar hela ställverket. Vid större zoom kan du rulla i spårplanen.</p>`;
  const input=element.querySelector('input'),output=element.querySelector('output');
  function set(n){input.value=normalizeZoom(n);output.value=zoomLabel(Number(input.value));input.setAttribute('aria-valuetext',output.value);}
  input.oninput=()=>{set(input.value);onInput(Number(input.value));};
  element.querySelector('button').onclick=()=>{set(100);onInput(100);};set(100);
  return {element,set,get value(){return Number(input.value);}};
}

export function createZoomDialog(zoom){
  const form=document.createElement('form');form.id='panel-zoom-form';
  const control=createZoomControl({id:'panel-zoom-range',onInput:value=>zoom.preview(value)});
  form.append(control.element);
  const note=document.createElement('p');note.className='muted';note.textContent='Förhandsvisning. Spara behåller zoomen i den här webbläsaren på enheten.';form.append(note);
  const save=document.createElement('button');save.type='submit';save.textContent='Spara';form.append(save);
  let initial;
  const modal=createAdminDialog({title:'Zoom på ställverket',body:form,saveButton:save,dirty:()=>control.value!==initial,onCancel:()=>zoom.cancelPreview()});
  modal.element.classList.add('panel-zoom-dialog');
  form.onsubmit=e=>{e.preventDefault();try{zoom.set(control.value);modal.close(true);}catch(error){modal.message(error.message);}};
  return {open(){initial=zoom.value;control.set(initial);if(modal.open())zoom.beginPreview();}};
}
