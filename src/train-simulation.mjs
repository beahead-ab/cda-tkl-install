// Simulerade tåg (0.74.0, bara i simuleringsläge): med knappen Simulera tåg under Drift släpper TKL in tåg på
// linjerna, som simulerade grannstationer. Varje tåg anmäls med nummer i linjens inkommande fält (som en grannstation
// gör) och ställs i simulatorn på linjen utanför infartssignalen (SIM-kommandot över den lokala förbindelsen).
// Sedan sköter operatören tågvägarna: tåget kör när signalen visar kör, stannar på målspåret och kör vidare på nästa
// tågväg. Spårningen (src/train-tracking.mjs) tar numret ur det inkommande fältet när tåget kommer in.
import {INCOMING_FIELDS} from './train-tracking.mjs';

// Ett nummer per linje och riktning in: Kungsfors 4xx, Vagnsta 3xx, Lekby 2xx.
export const LINE_SERIES={A:401,B:301,C:201};
const LINES={A:['Au','An'],B:['Bu','Bn'],C:['Cu','Cn']};
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};

export class TrainSimulation{
  constructor({available,reason='',send,announce,log=()=>{},now=Date.now,random=Math.random,intervalMs=[45000,90000],maxTrains=6}){
    Object.assign(this,{available,reason,send,announce,log,now,random,intervalMs,maxTrains});
    this.enabled=false;this.nextAt=0;this.busy=false;this.counter={A:0,B:0,C:0};this.waiting=[];this.error='';this.revision=0;
  }
  set(enabled){
    if(!this.available)fail(this.reason||'Simulerade tåg finns bara i simuleringsläge.');
    this.enabled=!!enabled;this.nextAt=this.enabled?this.now()+3000:0;this.error='';this.revision++;
    this.log('train-simulation',this.enabled?'Simulerade tåg på: grannstationerna släpper in tåg på linjerna.':'Simulerade tåg av: inga nya tåg släpps in.');
    return this.view();
  }
  // edges: {Au:{name,incoming,block}} ur Orter och telefon; blocks: kärnans beläggning; tracked: spårningens tåg.
  async tick({edges,blocks,tracked=[]}){
    const now=this.now();
    // Ett anmält tåg som syns på stationen har kommit in: fältet töms, som när grannstationen avslutar anmälan.
    // Tåget har kommit in när spårningen ser det förbi blocket utanför infartssignalen.
    for(const w of [...this.waiting]){
      const entered=tracked.some(t=>t.state==='station'&&t.number===w.number&&t.blocks.some(b=>b!==edges[w.edge]?.block));
      if(entered||now-w.at>15*60000){this.announce(INCOMING_FIELDS[w.edge],'');this.waiting=this.waiting.filter(x=>x!==w);this.revision++;}
    }
    if(!this.enabled||this.busy||now<this.nextAt)return;
    const inStation=tracked.filter(t=>t.state==='station').length+this.waiting.length;
    if(inStation>=this.maxTrains){this.nextAt=now+10000;return;}
    // En linje i taget: infartsspåret (det som inte är normal utfart) ska vara fritt och utan väntande tåg.
    const free=Object.entries(LINES).map(([line,tracks])=>tracks.find(t=>edges[t]?.incoming)).filter(edge=>edge&&edges[edge]?.block&&blocks[edges[edge].block]?.occupied===false&&!this.waiting.some(w=>w.edge===edge));
    if(!free.length){this.nextAt=now+5000;return;}
    const edge=free[Math.floor(this.random()*free.length)],line=edge[0];
    const live=new Set([...tracked.map(t=>t.number),...this.waiting.map(w=>w.number)].filter(Boolean));
    let number;do{number=String(LINE_SERIES[line]+2*(this.counter[line]++%50));}while(live.has(number));
    this.busy=true;
    try{
      // Anmälan först, som när grannstationen ringer innan tåget syns: spårningen tar numret när tåget dyker upp.
      this.announce(INCOMING_FIELDS[edge],number);
      try{await this.send({kind:'spawn',number,at:'htv'+edge});}catch(error){this.announce(INCOMING_FIELDS[edge],'');throw error;}
      this.waiting.push({number,edge,at:now});this.error='';
      this.log('train-simulation',`Tåg ${number} anmält från ${edges[edge].name||'linje '+line} och står utanför infartssignalen (${edge}).`);
    }catch(error){this.error=error.message;}
    finally{this.busy=false;this.revision++;}
    const [low,high]=this.intervalMs;this.nextAt=this.now()+low+Math.floor(this.random()*(high-low));
  }
  view(){return {available:this.available,reason:this.available?'':this.reason,enabled:this.enabled,nextAt:this.nextAt,waiting:this.waiting.map(w=>({...w})),error:this.error};}
}
