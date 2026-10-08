// Tågspårning (0.73.0): vilket tåg som står var, räknat ur spåravkänningarna, växellägena och tågvägarna.
// Bara presentation. Inget här påverkar låsning, signaler eller tågvägar, och kärnan läser det aldrig.
// Provas först i simulering (CHARLOTTENDAL_CONNECTION_MODE=simulator); mot riktig bana är den avstängd.
//
// Antagandena (docs/tagsparning.md):
// - Ett tåg är ett nummer och de spårledningar det belägger, från svansen till fronten.
// - Ett tåg rör sig bara till en angränsande spårledning, och bara genom en växel som ligger åt det hållet.
//   Det löser de delade detektorerna: LS72 belägger nio block vid spår 11–13, men bara det block växlarna
//   leder till blir tågets. En lagd tågväg väger tyngst när flera vägar är möjliga.
// - En spårledning utan ingång (bänkadress) är en brygga: tåget får passera den utan rapport.
// - Ett glapp kortare än GRACE_MS frigör inte en spårledning.
// - Ett nytt tåg vid linjens kant får numret från TrainMeet (tåg på väg in från grannstationen) eller från
//   det inkommande fältet; annars ett okänt nummer (?1, ?2 …) som operatören rättar.
// - Ett tåg som lämnar vid kanten visas på linjen tills grannstationen tagit emot det.
import {Topology} from './topology.mjs';

export const GRACE_MS=1500;
export const GHOST_MS=30*60000;
export const LINE_MS=5*60000;
const SHARED_TAIL_MS=4000,REVERSE_MS=3000;
export const EDGES={Au:'A',An:'A',Cu:'C',Cn:'C',Bu:'B',Bn:'B',D:'D'};
export const INCOMING_FIELDS={Cu:'incoming:CuppIn',Cn:'incoming:CnedIn',Au:'incoming:AuppIn',An:'incoming:AnedIn',Bu:'incoming:BuppIn',Bn:'incoming:BnedIn',D:'incoming:DIn'};
const ROUTE_LIVE=new Set(['setting','active','clearing','traversing']);

// Spårgrafen på blocknivå ur panelens geometri: två spårledningar hänger ihop om ett spår går mellan dem,
// genom en växel bara i det läge som leder dit, genom en korsning rakt över.
export function buildTrackGraph(panel,profile){
  const known=b=>b&&profile.blocks[b]?b:null,nodes=new Map();
  const add=(id,block)=>{if(!nodes.has(id))nodes.set(id,{block:known(block),edges:[]});};
  const link=(a,b,cond=null)=>{if(!nodes.has(a)||!nodes.has(b))return;nodes.get(a).edges.push({to:b,cond});nodes.get(b).edges.push({to:a,cond});};
  const segs=panel.segs.filter(s=>s.b!=='frame'&&Math.min(s.y1,s.y2)<850);
  for(const s of segs)add('s:'+s.id,s.b);
  for(const [id,t] of Object.entries(panel.turnouts))add('t:'+id,t.block);
  for(const [id,x] of Object.entries(panel.xings||{})){add('x:'+id+':AC',x.bac);add('x:'+id+':BD',x.bbd);}
  const anchors={};
  for(const s of segs)for(const end of [1,2])if(s['t'+end]==='POS_POINT')(anchors[s['c'+end]]??=[]).push('s:'+s.id);
  for(const list of Object.values(anchors))for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)link(list[i],list[j]);
  for(const [id,t] of Object.entries(panel.turnouts)){
    const closed=t.continuing===2?'B':'C';
    for(const leg of ['A','B','C']){const seg=t['c'+leg.toLowerCase()];if(seg)link('s:'+seg,'t:'+id,leg==='A'?null:{turnout:t.name,position:leg===closed?'C':'T'});}
  }
  for(const [id,x] of Object.entries(panel.xings||{}))for(const [legs,path] of [[['ca','cc'],'AC'],[['cb','cd'],'BD']])for(const leg of legs)if(x[leg])link('s:'+x[leg],'x:'+id+':'+path);
  // Komprimera till block: från varje nod i ett block, genom noder utan block, till närmaste andra block.
  const edges={};
  for(const [id,n] of nodes){
    if(!n.block)continue;
    const queue=[[id,[]]],seen=new Set([id]);
    while(queue.length){
      const [current,conds]=queue.shift();
      for(const e of nodes.get(current).edges){
        if(seen.has(e.to))continue;seen.add(e.to);
        const next=nodes.get(e.to),path=e.cond?[...conds,e.cond]:conds;
        if(next.block===n.block)continue;
        if(next.block){const map=(edges[n.block]??=new Map());const list=map.get(next.block)||[];if(!list.some(c=>JSON.stringify(c)===JSON.stringify(path)))list.push(path);map.set(next.block,list);continue;}
        queue.push([e.to,path]);
      }
    }
  }
  return edges;
}
// Ett växelläge som inte är känt (under omläggning, ingen rapport) stänger ingen väg.
const allowed=(conds,turnouts)=>conds.every(c=>{const p=turnouts?.[c.turnout]?.position;return p!=='C'&&p!=='T'||p===c.position;});

export class TrainTracker{
  constructor({profile,panel,enabled=true,reason='',now=Date.now,log=()=>{}}){
    Object.assign(this,{profile,enabled,reason,now,log});
    this.graph=buildTrackGraph(panel,profile);
    this.trains=[];this.lineTrains=[];this.lastOccupied={};this.sequence=0;this.unknown=0;this.revision=0;this.appliedBook={};
    this.input={turnouts:{},routes:[],lines:[],edgeInfo:{},book:{}};
    // Kanterna: knappen för linjen (htvAu …) och blocket vid den, samt första blocket i tågvägarna in från linjen
    // och sista i tågvägarna ut. Det är där tåg kommer och går.
    const topology=new Topology(panel);this.edgeOf={};this.exitEdge={};this.edgeBlock={};
    for(const edge of Object.keys(EDGES)){
      const button=topology.buttons['htv'+edge],block=button&&topology.segments[button.segment]?.b;
      if(profile.blocks[block]){this.edgeOf[block]=edge;this.exitEdge[block]=edge;this.edgeBlock[edge]=block;}
      for(const r of profile.routes){if(r.from==='htv'+edge&&r.blocks[0])this.edgeOf[r.blocks[0]]??=edge;if(r.to==='htv'+edge&&r.blocks.at(-1))this.exitEdge[r.blocks.at(-1)]??=edge;}
    }
    this.detectors=Object.fromEntries(Object.entries(profile.blocks).map(([n,b])=>[n,(b.inputs||[b]).map(i=>i.address)]));
  }
  undetected(name){return this.detectors[name].every(a=>a>=3000);}
  shares(a,b){return a===b||this.detectors[a].some(x=>this.detectors[b].includes(x));}
  neighbours(name){const out=[];for(const [other,alternatives] of this.graph[name]||[])if(alternatives.some(c=>allowed(c,this.input.turnouts)))out.push(other);return out;}
  adjacent(a,b){return (this.graph[a]?.get(b)||[]).length>0;}
  observe({blocks,turnouts,routes=[],connected,book={},lines=[],edgeInfo={}}){
    if(!this.enabled)return false;
    const before=JSON.stringify(this.view());
    this.input={turnouts,routes:routes.filter(r=>ROUTE_LIVE.has(r.state)&&!r.cancelRequested),lines:Array.isArray(lines)?lines:[],edgeInfo,book};
    if(connected){
      const now=this.now();
      for(const [name,state] of Object.entries(blocks||{}))if(state?.occupied===true)this.lastOccupied[name]=now;
      this.held=name=>blocks?.[name]?.occupied===true||now-(this.lastOccupied[name]||-Infinity)<GRACE_MS;
      this.occupied=name=>blocks?.[name]?.occupied===true;
      this.release(now);this.extend(now);this.create(now);this.applyBook();this.expire(now);
    }
    const changed=JSON.stringify(this.view())!==before;if(changed)this.revision++;return changed;
  }
  claimed(){const map=new Map();for(const t of this.trains)if(t.state==='station')for(const b of t.body)map.set(b,t);return map;}
  routeFor(t){return this.input.routes.find(r=>r.blocks.some(b=>t.body.includes(b)))||null;}
  // Svansen och de block tåget lämnat. Ett glapp kortare än GRACE_MS räknas inte; en brygga utan ingång följer med
  // tills ett detekterat block längre fram är belagt; en delad detektor som ett annat tåg håller släpper svansen när
  // tåget har stått i nästa block en stund.
  release(now){
    const claims=this.claimed();
    for(const t of this.trains.filter(t=>t.state==='station')){
      const keep=t.body.map((b,i)=>{
        // En brygga utan ingång släpps först när inget detekterat block bakom den är belagt och något framför är det.
        if(this.undetected(b)){const detectedHeld=n=>!this.undetected(n)&&this.held(n);return t.body.slice(0,i).some(detectedHeld)||!t.body.slice(i+1).some(detectedHeld);}
        if(!this.held(b))return false;
        if(i===0&&t.body.length>1){const other=[...claims].some(([n,o])=>o!==t&&this.shares(n,b));if(other&&now-(t.entered[t.body[1]]||now)>SHARED_TAIL_MS)return false;}
        return true;
      });
      // Bara ändarna kan frigöras; ett hål mitt i tåget är en delning.
      let first=keep.indexOf(true),last=keep.lastIndexOf(true);
      if(first<0){this.leave(t,now);continue;}
      const kept=t.body.slice(first,last+1),gap=kept.findIndex((b,i)=>!keep[first+i]);
      if(gap>0){
        const rear=kept.slice(0,gap).filter((b,i)=>keep[first+i]),front=kept.slice(gap).filter((b,i)=>keep[first+gap+i]);
        t.body=front;t.movedAt=now;
        if(rear.length){const part=this.add(rear,now,{number:t.number,certain:false,source:'delning'});this.log('train-tracking',`Tåg ${t.number||t.label} delat? En del står kvar vid ${rear.at(-1)}. Kontrollera numret.`);part.label=t.label;}
      } else t.body=kept;
    }
  }
  leave(t,now){
    const edge=this.exitEdge[t.head]||this.edgeOf[t.head];
    if(edge){
      const info=this.input.edgeInfo[edge]||{};
      this.lineTrains.push({id:t.id,number:t.number,label:t.label,certain:t.certain,edge,line:EDGES[edge],direction:'out',neighbor:info.name||'',stationId:info.stationId||'',since:now});
      this.log('train-tracking',`Tåg ${t.number||t.label} lämnade mot ${info.name||'linje '+EDGES[edge]}.`);
      this.trains=this.trains.filter(x=>x!==t);
    } else {
      // Försvann inne på stationen: troligen på spår utan avkänning (lokstallet, vändskivan). Står kvar som senast sett.
      t.lastBlock=t.body.at(-1);t.state='ghost';t.since=now;t.body=[];
      this.log('train-tracking',`Tåg ${t.number||t.label} syns inte längre; senast vid ${t.lastBlock}.`);
    }
  }
  // Fronten växer till ett angränsande belagt block som ingen annan har, genom växlarna som de ligger. Går det inte
  // framåt men bakåt har tåget vänt. Flera möjliga block: tågvägen väger tyngst.
  extend(now){
    for(let pass=0;pass<6;pass++){
      const claims=this.claimed(),proposals=[];
      for(const t of this.trains.filter(t=>t.state==='station')){
        const route=this.routeFor(t);
        for(const end of ['head','tail']){
          // Bakåt bara för ett tåg som stått still en stund: ett tåg som nyss rört sig framåt får inte ta blocket
          // bakom sig, där ett följande tåg är på väg in.
          if(end==='tail'&&now-t.movedAt<REVERSE_MS)continue;
          const from=end==='head'?t.body.at(-1):t.body[0],options=this.reach(from,t,claims);
          if(!options.length)continue;
          options.sort((a,b)=>this.score(b,route)-this.score(a,route));
          proposals.push({t,end,path:options[0],uncertain:options.length>1&&this.score(options[0],route)===this.score(options[1],route),route});
          break;
        }
      }
      if(!proposals.length)return;
      const taken=new Map();
      for(const p of proposals){const block=p.path.at(-1),other=taken.get(block);if(!other||(p.route?.blocks.includes(block)&&!other.route?.blocks.includes(block)))taken.set(block,p);else p.t.certain=false;}
      let moved=false;
      for(const p of new Set(taken.values())){
        const t=p.t;if(p.uncertain)t.certain=false;
        if(p.end==='tail')t.body.reverse();
        for(const b of p.path){if(!t.body.includes(b)){t.body.push(b);t.entered[b]=now;}}
        t.movedAt=now;moved=true;
      }
      if(!moved)return;
    }
  }
  // Vägar ut från ett block till ett belagt block på en ny detektor. Block utan ingång och block på en detektor
  // som tåget redan håller är broar: de säger inget om rörelse (LS199 belägger SN1B, S170 och S166a på en gång),
  // så tåget passerar dem, högst åtta i rad (nio block delar LS72), tills en annan detektor visar var det är.
  reach(from,t,claims){
    const out=[],queue=[[from,[]]],seen=new Set([from,...t.body]),own=b=>t.body.some(n=>this.shares(n,b));
    while(queue.length){
      const [block,path]=queue.shift();
      for(const next of this.neighbours(block)){
        if(seen.has(next))continue;seen.add(next);
        const owner=claims.get(next);if(owner&&owner!==t)continue;
        const bridge=this.undetected(next)||own(next);
        if(!bridge&&this.occupied(next)){out.push([...path,next]);continue;}
        if(bridge&&path.length<8)queue.push([next,[...path,next]]);
      }
    }
    return out;
  }
  score(path,route){return route&&path.every(b=>route.blocks.includes(b))?2:route&&route.blocks.includes(path.at(-1))?1:0;}
  // Beläggning som inget tåg förklarar blir ett nytt tåg. Ett block på en detektor som ett tåg redan håller är förklarat.
  create(now){
    const claims=this.claimed(),explained=b=>[...claims.keys()].some(n=>this.shares(n,b));
    // Block i en lagd tågväg och vid kanterna först: av block på samma detektor är det de som troligast har tåget.
    const rank=b=>(this.input.routes.some(r=>r.blocks.includes(b))?0:2)+(this.edgeOf[b]?0:1);
    const fresh=Object.keys(this.profile.blocks).filter(b=>this.occupied(b)&&!this.undetected(b)&&!claims.has(b)&&!explained(b)).sort((a,b)=>rank(a)-rank(b));
    const used=new Set();
    for(const start of fresh){
      if(used.has(start))continue;
      // Sammanhängande belagda block genom växlarna som de ligger; av en delad detektor bara de som hänger ihop.
      const component=[start],queue=[start];used.add(start);
      while(queue.length){const b=queue.shift();for(const n of this.neighbours(b))if(fresh.includes(n)&&!used.has(n)&&!component.some(c=>this.shares(c,n))){used.add(n);component.push(n);queue.push(n);}}
      for(const b of fresh)if(!used.has(b)&&component.some(c=>this.shares(c,b)))used.add(b);
      const ghost=this.trains.find(t=>t.state==='ghost'&&component.some(b=>b===t.lastBlock||this.adjacent(t.lastBlock,b)));
      // Samma tåg som stod på spår utan avkänning, troligen; osäkert tills operatören bekräftat.
      if(ghost){ghost.state='station';ghost.certain=false;ghost.body=this.order(component);ghost.movedAt=now;for(const b of component)ghost.entered[b]=now;this.log('train-tracking',`Tåg ${ghost.number||ghost.label} syns igen vid ${ghost.head}.`);continue;}
      const edge=component.map(b=>this.edgeOf[b]).find(Boolean),body=this.order(component,edge);
      const named=this.numberFor(component,edge);
      const t=this.add(body,now,named);t.edge=edge||'';
      this.log('train-tracking',edge?`Tåg ${t.number||t.label} kom in från ${this.input.edgeInfo[edge]?.name||'linje '+EDGES[edge]} (${edge}).`:`Okänt tåg ${t.label} vid ${t.head}. Ange numret.`);
    }
  }
  // Ordningen inom ett nytt tåg: från kanten och inåt, annars som blocken hänger ihop.
  order(component,edge){
    if(component.length<2)return component;
    const start=component.find(b=>this.edgeOf[b]===edge)||component.find(b=>component.filter(c=>c!==b&&this.adjacent(b,c)).length<=1)||component[0];
    const out=[start],rest=new Set(component.filter(b=>b!==start));
    while(rest.size){const next=[...rest].find(b=>this.adjacent(out.at(-1),b))||[...rest][0];out.push(next);rest.delete(next);}
    return out;
  }
  numberFor(component,edge){
    const live=new Set([...this.trains.map(t=>t.number),...this.lineTrains.map(t=>t.number)].filter(Boolean));
    for(const b of component){const e=this.input.book['block:'+b];if(e?.value&&!live.has(e.value))return {number:e.value,certain:true,source:'operatör'};}
    if(edge){
      const info=this.input.edgeInfo[edge]||{};
      const line=this.input.lines.find(l=>l.direction==='in'&&['reserved','occupied'].includes(l.state)&&l.trainNumber&&!live.has(l.trainNumber)&&info.stationId&&l.neighborId===info.stationId);
      if(line)return {number:line.trainNumber,certain:true,source:'TrainMeet'};
      const e=this.input.book[INCOMING_FIELDS[edge]];if(e?.value&&e.value!=='-'&&!live.has(e.value))return {number:e.value,certain:true,source:'inkommande fält'};
    }
    return {number:'',certain:false,source:'okänt'};
  }
  add(body,now,{number,certain,source}){
    const t={id:'t'+(++this.sequence),number,label:number||'?'+(++this.unknown),certain,source,state:'station',body:[...body],entered:Object.fromEntries(body.map(b=>[b,now])),since:now,movedAt:now};
    Object.defineProperty(t,'head',{get(){return this.state==='station'?this.body.at(-1):this.lastBlock;},enumerable:false});
    this.trains.push(t);return t;
  }
  // Ett nummer som operatören skrivit på ett block där tåget står gäller: det är bekräftelsen.
  applyBook(){
    // Ett tåg från en kant som fick okänt nummer tar det inkommande fältets nummer om anmälan kom efter tåget.
    const live=new Set(this.trains.map(t=>t.number).filter(Boolean));
    for(const t of this.trains.filter(t=>t.state==='station'&&!t.number&&t.edge)){
      const e=this.input.book[INCOMING_FIELDS[t.edge]];
      if(e?.value&&e.value!=='-'&&!live.has(e.value)){t.number=e.value;t.label=e.value;t.certain=true;t.source='inkommande fält';live.add(e.value);this.log('train-tracking',`Tåg ${e.value} vid ${t.head}: numret från det inkommande fältet.`);}
    }
    for(const t of this.trains.filter(t=>t.state==='station'))for(const b of t.body){
      const e=this.input.book['block:'+b];if(!e?.value||this.appliedBook[b]===e.updatedAt)continue;
      this.appliedBook[b]=e.updatedAt;if(t.number!==e.value||!t.certain){t.number=e.value;t.label=e.value;t.certain=true;t.source='operatör';}
    }
  }
  expire(now){
    this.trains=this.trains.filter(t=>t.state!=='ghost'||now-t.since<GHOST_MS);
    this.lineTrains=this.lineTrains.filter(l=>{
      if(now-l.since>LINE_MS)return false;
      // Med TrainMeet: borta när grannstationen inte längre har tåget på linjen (efter en minut, så att TrainMeet hinner).
      if(l.stationId&&this.input.lines.length&&now-l.since>60000)return this.input.lines.some(x=>x.neighborId===l.stationId&&x.trainNumber===l.number&&x.state!=='free');
      return true;
    });
  }
  // Operatören rättar eller bekräftar numret på ett spårat tåg.
  name(id,number){
    const t=this.trains.find(t=>t.id===id);if(!t)throw Object.assign(Error('Tåget finns inte längre i spårningen.'),{status:409});
    const value=String(number??'').trim();
    if(!/^[\p{L}\p{N} ._/-]{1,24}$/u.test(value))throw Object.assign(Error('Ange högst 24 tecken: bokstäver, siffror, blanksteg, punkt, bindestreck, snedstreck eller understreck.'),{status:400});
    if(this.trains.some(o=>o!==t&&o.number===value))throw Object.assign(Error(`Tåg ${value} finns redan i spårningen.`),{status:409});
    t.number=value;t.label=value;t.certain=true;t.source='operatör';this.revision++;
    this.log('train-tracking',`Tåg ${value} bekräftat av operatören vid ${t.head}.`);return this.view();
  }
  remove(id){
    const before=this.trains.length;this.trains=this.trains.filter(t=>t.id!==id);this.lineTrains=this.lineTrains.filter(t=>t.id!==id);
    if(this.trains.length===before)throw Object.assign(Error('Tåget finns inte längre i spårningen.'),{status:409});
    this.revision++;return this.view();
  }
  view(){
    if(!this.enabled)return {enabled:false,reason:this.reason,trains:[],lines:[]};
    const trains=this.trains.map(t=>{const r=t.state==='station'?this.routeFor(t):null;return {id:t.id,number:t.number,label:t.label,certain:t.certain,source:t.source,state:t.state,blocks:[...t.body],head:t.head,route:r?.label||'',since:t.since,movedAt:t.movedAt};});
    // Tåg på väg in enligt TrainMeet som inte syns på stationen än, vid kanten de kommer till.
    const live=new Set(this.trains.map(t=>t.number).filter(Boolean)),incoming=[];
    for(const l of this.input.lines){
      if(l.direction!=='in'||!['reserved','occupied'].includes(l.state)||!l.trainNumber||live.has(l.trainNumber))continue;
      const edge=Object.keys(EDGES).find(e=>this.input.edgeInfo[e]?.stationId===l.neighborId&&this.input.edgeInfo[e]?.incoming);
      if(edge)incoming.push({id:'in:'+l.id,number:l.trainNumber,label:l.trainNumber,certain:true,edge,line:EDGES[edge],direction:'in',neighbor:l.neighborName||this.input.edgeInfo[edge]?.name||'',state:l.state});
    }
    return {enabled:true,trains,lines:[...incoming,...this.lineTrains.map(l=>({...l}))]};
  }
}
