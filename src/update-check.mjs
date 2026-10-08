// An installed copy (Raspberry Pi, Mac, PC) asks the public install repository whether a
// newer release exists, at start, every hour, and when Uppdatering asks. Only reads one small file;
// sends nothing about this installation. The web deployment checks too: on its own server
// (charlottendal-update installed) and on Render (deploy/render sets the kind).
export const UPDATE_URL='https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/package.json';
// What each release did, headings only (public/releases.json): read beside the version
// so Inställningar → Uppdatering can say what a newer release brings.
export const RELEASES_URL='https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/public/releases.json';
// web: the deployment at cda-tkl.trainmeet.app, which has charlottendal-update installed.
// render: the same deployment on Render since 6 October 2026 (deploy/render): Render builds cda-tkl main
// into a container, which cannot update itself; its Deploy Hook starts a new build when one is set.
const KINDS=new Set(['raspberry-pi','mac','windows','web','render']);
// A Render Deploy Hook (Settings → Deploy Hook on the service) is a secret URL; anything else is ignored.
export const renderHook=value=>/^https:\/\/api\.render\.com\/deploy\/srv-[^\s?#\/]+\?key=[^\s&#]+$/.test(String(value||''))?String(value):'';
// A Render build that has not replaced the running version after this long is reported as failed.
const RENDER_TIMEOUT_MS=30*60000;
const IN_PROGRESS=new Set(['fetching','installing','backup','restarting']);
// The systemd unit the panel may start; elsewhere the update runs from Terminal or PowerShell.
export const UPDATE_UNITS={'raspberry-pi':'cda-tkl-update.service',web:'charlottendal-update.service'};
export const newer=(a,b)=>{const x=String(a).split(/[.+-]/).map(Number),y=String(b).split(/[.+-]/).map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0;}return false;};
export class UpdateCheck{
  constructor({current,kind,fetcher=fetch,now=Date.now,url=UPDATE_URL,releasesUrl=RELEASES_URL,intervalMs=3600000,statusFile=null,readFile=null,writeFile=null,hook=''}){
    if(!KINDS.has(kind))throw Error('Okänd installationstyp: '+kind);
    Object.assign(this,{current,kind,fetcher,now,url,releasesUrl,intervalMs,statusFile,readFile,writeFile,hook:kind==='render'?renderHook(hook):''});this.runCache={text:null,value:null};this.latest=null;this.checkedAt=0;this.error='';this.timer=null;this.newReleases=[];
  }
  start(delayMs=30000){this.settle();const run=()=>this.check().catch(()=>{});this.timer=setTimeout(()=>{run();this.timer=setInterval(run,this.intervalMs);this.timer.unref?.();},delayMs);this.timer.unref?.();}
  async check(){
    try{
      const response=await this.fetcher(this.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('svar '+response.status);
      const version=(await response.json())?.version;
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+/.test(version))throw Error('ogiltig version');
      this.latest=version;this.error='';
      this.newReleases=newer(version,this.current)?await this.releases():[];
    }catch(e){this.error='Kunde inte se om det finns en ny version ('+(e?.message||e)+').';}
    this.settle();this.checkedAt=this.now();return this.view();
  }
  // Never fatal: without the headings the offer is vaguer, not wrong.
  async releases(){
    try{const response=await this.fetcher(this.releasesUrl,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!response.ok)return [];
      const list=await response.json();return Array.isArray(list)?list.filter(r=>typeof r?.version==='string'&&newer(r.version,this.current)&&Array.isArray(r.notes)).map(r=>({version:r.version,date:String(r.date||''),notes:r.notes.map(String)})):[];}
    catch{return [];}
  }
  // The web updater writes each step to update.json in the state directory; the last
  // one tells the panel how the most recent update went.
  run(){
    if(!this.statusFile||!this.readFile)return null;
    let text=null;try{text=this.readFile(this.statusFile);}catch{return null;}
    if(text!==this.runCache.text){let value=null;try{const parsed=JSON.parse(text);if(parsed&&typeof parsed.phase==='string')value={phase:parsed.phase,message:String(parsed.message||''),at:String(parsed.at||''),from:String(parsed.from||''),to:String(parsed.to||'')};}catch{}this.runCache={text,value};}
    return this.runCache.value;
  }
  // On Render nothing runs beside TKL during a build, so TKL keeps update.json itself: the build it
  // started is done once a process with another version reads the file, and failed when none came.
  write(phase,message,from,to){
    if(!this.statusFile||!this.writeFile)return;
    const at=new Date(this.now()).toISOString().replace(/\.\d+Z$/,'Z');
    try{this.writeFile(this.statusFile,JSON.stringify({phase,message,at,from,to})+'\n');}catch{}
  }
  settle(){
    if(this.kind!=='render')return;const run=this.run();if(!run||!IN_PROGRESS.has(run.phase))return;
    if(run.from&&run.from!==this.current)this.write('done','Version '+this.current+' är installerad. Föregående version: '+run.from+'.',run.from,this.current);
    else if(this.now()-Date.parse(run.at)>RENDER_TIMEOUT_MS)this.write('failed','Render har inte bytt version på 30 minuter; '+run.from+' kör fortfarande. Se Events på tjänsten i Render.',run.from,run.to);
  }
  // Uppdatera nu on Render: the Deploy Hook builds the newest commit of the branch Render follows.
  async startRender(){
    if(!this.hook)throw Error('Ingen Deploy Hook är inlagd för webbdriften.');
    const response=await this.fetcher(this.hook,{method:'POST',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Render svarade '+response.status+'.');
    const to=this.latest||'senaste versionen';
    this.write('restarting','Render bygger '+to+'. Webbdriften startar om när bygget är klart, vanligen inom tio minuter.',this.current,this.latest||'');
  }
  view(){return {kind:this.kind,current:this.current,latest:this.latest,available:!!this.latest&&newer(this.latest,this.current),newReleases:this.newReleases,checkedAt:this.checkedAt,error:this.error,canStart:this.kind==='render'?!!this.hook:!!UPDATE_UNITS[this.kind],run:this.run()};}
}
