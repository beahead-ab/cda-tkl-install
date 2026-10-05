// An installed copy (Raspberry Pi, Mac, PC) asks the public install repository whether a
// newer release exists, at start, every hour, and when Uppdatering asks. Only reads one small file;
// sends nothing about this installation. The web deployment is updated by publishing and
// does not check (no CHARLOTTENDAL_INSTALL_KIND there).
export const UPDATE_URL='https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/package.json';
// What each release did, headings only (public/releases.json): read beside the version
// so Inställningar → Uppdatering can say what a newer release brings.
export const RELEASES_URL='https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/public/releases.json';
// web: the deployment at cda-tkl.trainmeet.app, which has charlottendal-update installed.
const KINDS=new Set(['raspberry-pi','mac','windows','web']);
// The systemd unit the panel may start; elsewhere the update runs from Terminal or PowerShell.
export const UPDATE_UNITS={'raspberry-pi':'cda-tkl-update.service',web:'charlottendal-update.service'};
export const newer=(a,b)=>{const x=String(a).split(/[.+-]/).map(Number),y=String(b).split(/[.+-]/).map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0;}return false;};
export class UpdateCheck{
  constructor({current,kind,fetcher=fetch,now=Date.now,url=UPDATE_URL,releasesUrl=RELEASES_URL,intervalMs=3600000,statusFile=null,readFile=null}){
    if(!KINDS.has(kind))throw Error('Okänd installationstyp: '+kind);
    Object.assign(this,{current,kind,fetcher,now,url,releasesUrl,intervalMs,statusFile,readFile});this.runCache={text:null,value:null};this.latest=null;this.checkedAt=0;this.error='';this.timer=null;this.newReleases=[];
  }
  start(delayMs=30000){const run=()=>this.check().catch(()=>{});this.timer=setTimeout(()=>{run();this.timer=setInterval(run,this.intervalMs);this.timer.unref?.();},delayMs);this.timer.unref?.();}
  async check(){
    try{
      const response=await this.fetcher(this.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('svar '+response.status);
      const version=(await response.json())?.version;
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+/.test(version))throw Error('ogiltig version');
      this.latest=version;this.error='';
      this.newReleases=newer(version,this.current)?await this.releases():[];
    }catch(e){this.error='Kunde inte se om det finns en ny version ('+(e?.message||e)+').';}
    this.checkedAt=this.now();return this.view();
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
  view(){return {kind:this.kind,current:this.current,latest:this.latest,available:!!this.latest&&newer(this.latest,this.current),newReleases:this.newReleases,checkedAt:this.checkedAt,error:this.error,canStart:!!UPDATE_UNITS[this.kind],run:this.run()};}
}
