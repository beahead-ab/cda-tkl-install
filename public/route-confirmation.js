// Let the operator see both endpoints before sending the route order.
// Cancellation, navigation or lost permission invalidates the delayed order.
export function createRouteConfirmation({submit,valid,onChange,delay=300,setTimer=setTimeout,clearTimer=clearTimeout}) {
  let current=null,timer=null;
  function cancel(){if(timer!=null)clearTimer(timer);timer=null;current=null;}
  return {
    get selection(){return current;},cancel,
    start(pair){
      cancel();const operation={...pair};current=operation;onChange(false);
      timer=setTimer(async()=>{
        timer=null;if(current!==operation)return;
        try{if(valid())await submit(operation);}
        finally{if(current===operation){current=null;onChange(true);}}
      },delay);
    }
  };
}
