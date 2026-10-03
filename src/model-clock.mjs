import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';

// Traffic time is independent of wall time, detector age and route timers.
// Restarts always pause at the last checkpoint; downtime is never simulated.
export class ModelClock {
  constructor(storage,{monotonic=()=>performance.now(),wall=()=>Date.now()}={}) {
    this.storage=storage;this.monotonic=monotonic;this.wall=wall;this.sessionId=randomUUID();this.revision=0;
    const saved=storage.load('model-clock.json',{version:1,timeMs:12*3600000,rate:1});
    if(saved?.version!==1||!Number.isSafeInteger(saved.timeMs)||saved.timeMs<0||saved.timeMs>315360000000||!Number.isFinite(saved.rate)||saved.rate<0.1||saved.rate>60)throw Error('Ogiltig sparad modellklocka.');
    this.timeMs=saved.timeMs;this.rate=saved.rate;this.running=false;this.anchor=monotonic();this.checkpointAt=this.anchor;this.error=null;
  }
  time() {return this.timeMs+(this.running?Math.max(0,this.monotonic()-this.anchor)*this.rate:0);}
  save(next) {this.storage.save('model-clock.json',{version:1,timeMs:Math.floor(next.timeMs),rate:next.rate});}
  change(data) {
    if(data.sessionId!==this.sessionId||data.revision!==this.revision)throw Object.assign(Error('Klockan har ändrats. Läs in det senaste läget.'),{status:409});
    if(typeof data.running!=='boolean'||!Number.isFinite(data.rate)||data.rate<0.1||data.rate>60||data.timeMs!==undefined&&(!Number.isSafeInteger(data.timeMs)||data.timeMs<0||data.timeMs>315360000000))throw Error('Ange giltig tid och en hastighet mellan 0,1 och 60.');
    const next={timeMs:data.timeMs??this.time(),rate:data.rate};this.save(next);
    this.timeMs=next.timeMs;this.rate=next.rate;this.running=data.running;this.anchor=this.monotonic();this.checkpointAt=this.anchor;this.error=null;this.revision++;
    return this.snapshot();
  }
  checkpoint(force=false) {
    if(!force&&(!this.running||this.monotonic()-this.checkpointAt<5000))return;
    const timeMs=this.time();
    try {this.save({timeMs,rate:this.rate});this.checkpointAt=this.monotonic();}
    catch {this.timeMs=timeMs;this.anchor=this.monotonic();this.running=false;this.error='Klockan är pausad: tiden kunde inte sparas.';this.revision++;}
  }
  snapshot() {return {sessionId:this.sessionId,revision:this.revision,timeMs:Math.floor(this.time()),rate:this.rate,running:this.running,authority:'local',serverAt:this.wall(),error:this.error};}
}
