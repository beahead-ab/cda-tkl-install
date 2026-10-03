// Poll only while choosing a route. Replies from a previous choice never apply.
export function createRouteTargets({load,onChange,setTimer=setTimeout,clearTimer=clearTimeout,interval=600}) {
  let generation=0,timer=null,targets=new Map(),loading=false;
  function clear(){generation++;if(timer!==null)clearTimer(timer);timer=null;targets=new Map();loading=false;}
  async function refresh(from,kind,token){
    try {
      const result=await load(from,kind);
      if(token!==generation)return;
      targets=new Map(result.targets.map(t=>[t.id,t.action]));
    } catch {
      if(token!==generation)return;
      targets=new Map();
    }
    loading=false;onChange();
    if(token===generation)timer=setTimer(()=>refresh(from,kind,token),interval);
  }
  return {
    clear,
    select(from,kind){clear();loading=true;void refresh(from,kind,generation);},
    has:id=>targets.has(id),
    action:id=>targets.get(id),
    get loading(){return loading;}
  };
}
