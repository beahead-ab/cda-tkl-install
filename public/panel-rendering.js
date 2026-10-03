// Keep physical panel elements mounted. Repeated telemetry must not rewrite them.
export function attribute(node, name, value) {
  const next=String(value);
  if(node.getAttribute(name)!==next)node.setAttribute(name,next);
}
export function style(node, name, value) {
  if(node.style[name]!==value)node.style[name]=value;
}
export function text(node, value) {
  const next=String(value);
  if(node.textContent!==next)node.textContent=next;
}

// One monotonic clock per route: new reports and wall-clock adjustments cannot
// drag the lit front backwards. Signal authority always remains on the server.
export function flowProgress(route, timing, now, serverTime, reduced=false) {
  if(route.state!=='establishing')return 1;
  if(reduced){timing.progress=1;return 1;}
  if(timing.start==null)timing.start=now-Math.max(0,serverTime-route.establishedAt);
  timing.progress=Math.max(timing.progress||0,Math.min(1,Math.max(0,(now-timing.start)/(route.flowDuration||1200))));
  return timing.progress;
}

export function createPanelFrames({render,animate,request=requestAnimationFrame,cancel=cancelAnimationFrame}) {
  let frame=null,dirty=false;
  function run(now) {
    frame=null;
    if(dirty){dirty=false;render();}
    if(animate(now))schedule();
  }
  function schedule(){if(frame==null)frame=request(run);}
  return {paint(){dirty=true;schedule();},stop(){if(frame!=null)cancel(frame);frame=null;}};
}

// Only confirmed, fresh preparations blink; held/cancelled/ready routes never do.
// Keep endpoint roles independent of the current preparation stage so telemetry
// can advance setting → establishing → clearing without restarting the animation.
export function preparingEndpoints(routes, fresh=true) {
  const endpoints=new Map();
  if(!fresh)return endpoints;
  for(const route of routes) {
    if(!['setting','establishing','clearing'].includes(route.state))continue;
    for(const [id,role] of [[route.from,'start'],[route.to,'end']]) {
      if(!endpoints.has(id))endpoints.set(id,role);
    }
  }
  return endpoints;
}
