// An installed copy (Raspberry Pi, Mac, PC) asks the public install repository whether a
// newer release exists, at start and then every six hours. Only reads one small file;
// sends nothing about this installation. The web deployment is updated by publishing and
// does not check (no CHARLOTTENDAL_INSTALL_KIND there).
export const UPDATE_URL='https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/package.json';
const KINDS=new Set(['raspberry-pi','mac','windows']);
export const newer=(a,b)=>{const x=String(a).split(/[.+-]/).map(Number),y=String(b).split(/[.+-]/).map(Number);for(let i=0;i<3;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d>0;}return false;};
export class UpdateCheck{
  constructor({current,kind,fetcher=fetch,now=Date.now,url=UPDATE_URL,intervalMs=6*3600000}){
    if(!KINDS.has(kind))throw Error('Okänd installationstyp: '+kind);
    Object.assign(this,{current,kind,fetcher,now,url,intervalMs});this.latest=null;this.checkedAt=0;this.error='';this.timer=null;
  }
  start(delayMs=30000){const run=()=>this.check().catch(()=>{});this.timer=setTimeout(()=>{run();this.timer=setInterval(run,this.intervalMs);this.timer.unref?.();},delayMs);this.timer.unref?.();}
  async check(){
    try{
      const response=await this.fetcher(this.url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('svar '+response.status);
      const version=(await response.json())?.version;
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+/.test(version))throw Error('ogiltig version');
      this.latest=version;this.error='';
    }catch(e){this.error='Kunde inte se om det finns en ny version ('+(e?.message||e)+').';}
    this.checkedAt=this.now();return this.view();
  }
  view(){return {kind:this.kind,current:this.current,latest:this.latest,available:!!this.latest&&newer(this.latest,this.current),checkedAt:this.checkedAt,error:this.error,canStart:this.kind==='raspberry-pi'};}
}
