import { EventEmitter } from 'node:events';
import { decode, switchReport, sensorReport, signalReport } from './protocol.mjs';
import { decodeSv, svReply, identityReply, SV_CMD } from './sv2.mjs';
import { signalReportKind } from './signal-report.mjs';

// Independent field state: no Engine import, route state or TKL HTTP access.
export class Field extends EventEmitter {
  constructor(profile, { now = Date.now, movementMs = 650, traffic = null } = {}) {
    super(); this.profile = profile; this.now = now; this.movementMs = movementMs;
    // Stationen anger linjekanter och uppställningsspår uttryckligen. Äldre modulprov behåller Charlottendals knappar.
    this.traffic=traffic;
    const edges=Object.keys(traffic?.edgeLines??{Au:'A',An:'A',Bu:'B',Bn:'B',Cu:'C',Cn:'C',D:'D'});
    this.lineEdges=Object.fromEntries(edges.map(edge=>[traffic?.anchors?.[edge]?.button||'htv'+edge,edge]));
    this.lineButtons=new Set(Object.keys(this.lineEdges));
    this.turnouts = Object.fromEntries(Object.keys(profile.turnouts).map(n => [n, { position: 'C', target: 'C', due: 0 }]));
    this.blocks = Object.fromEntries(Object.keys(profile.blocks).map(n => [n, false]));
    // En virtuell signal finns inte i anläggningen: ingen dekoder, ingen rapport. Tåget kör på panelens besked, så den räknas som kör här.
    this.signals = Object.fromEntries(Object.entries(profile.signals).map(([n, b]) => [n, b.virtual ? { permission: 'GO', code: 8, due: 0, virtual: true } : { permission: 'STOP', code: 0, due: 0 }]));
    this.faults = { turnout: '', signal: '', sensor: '' }; this.train = null; this.trains = []; this.nextTrain = 420;
    this.programming=profile.programming?{relay:'T',active:false,target:false,due:0,fault:false}:null;
    // Simulerade kort: identitet och SV-minne per modul. Svarar på SV2 som ett kort skulle enligt SV v13.
    this.modules=(profile.modules||[]).map(m=>({...m,sv:{...(m.sv||{})}}));
  }
  answerSv(sv) {
    const identity=m=>this.emit('frame',identityReply(sv,m.address,m));
    const value=(m,n)=>m.sv[n]??0, reply=(m,data)=>this.emit('frame',svReply(sv,{dst:m.address,data}));
    if(sv.cmd===SV_CMD.discover){for(const m of this.modules)identity(m);return;}
    if(sv.cmd===SV_CMD.changeAddress){const m=this.modules.find(x=>x.manufacturer===(sv.sv&0xff)&&x.developer===(sv.sv>>8)&&x.product===(sv.data[0]|(sv.data[1]<<8))&&x.serial===(sv.data[2]|(sv.data[3]<<8)));if(m){m.address=sv.dst;identity(m);}return;}
    for(const m of this.modules.filter(x=>x.address===sv.dst)){
      if(sv.cmd===SV_CMD.identify)identity(m);
      else if(sv.cmd===SV_CMD.read)reply(m,[value(m,sv.sv)]);
      else if(sv.cmd===SV_CMD.read4)reply(m,[0,1,2,3].map(i=>value(m,sv.sv+i)));
      else if(sv.cmd===SV_CMD.write){m.sv[sv.sv]=sv.data[0];reply(m,[value(m,sv.sv)]);}
      else if(sv.cmd===SV_CMD.maskedWrite){m.sv[sv.sv]=(value(m,sv.sv)&~sv.data[1])|(sv.data[0]&sv.data[1]);reply(m,[value(m,sv.sv)]);}
      else if(sv.cmd===SV_CMD.write4){[0,1,2,3].forEach(i=>{m.sv[sv.sv+i]=sv.data[i];});reply(m,[0,1,2,3].map(i=>value(m,sv.sv+i)));}
      else if(sv.cmd===SV_CMD.reconfigure)reply(m,[]);
    }
  }
  reportTurnout(name) {
    if (this.faults.turnout === name) return;
    const b = this.profile.turnouts[name], value = this.turnouts[name].position;
    // En lokalt styrd växel läggs på plats och har inga konfigurerade givare: den rapporterar ingenting till TKL.
    if (b.local) return;
    // Växelmotorns lägesgivare (Träkvista): två ingångar i stället för växelrapporten; båda passiva medan växeln går.
    if (b.feedbackSensors) { this.emit('frame', sensorReport(b.feedbackSensors.thrown, value === 'T')); this.emit('frame', sensorReport(b.feedbackSensors.closed, value === 'C')); return; }
    const physical = value === 'unknown' ? value : b.inverted ? (value === 'C' ? 'T' : 'C') : value;
    this.emit('frame', switchReport(b.address, physical));
  }
  // En ingång är aktiv när ett block som själv belagts (av ett tåg eller ett klick) har den. Block som bara delar adress
  // följer med i simulatorns bild men tänder inte sina andra ingångar: S95b belägger LS13, och SLI (LS13 eller LS74)
  // blir belagd, men LS74 förblir fri (0.74.0).
  inputActive(address) { return Object.entries(this.direct || {}).some(([n, on]) => on && (this.profile.blocks[n].inputs || [this.profile.blocks[n]]).some(i => i.address === address)); }
  reportBlock(name) {
    if (this.faults.sensor && this.profile.blocks[this.faults.sensor].address === this.profile.blocks[name].address) return;
    const b = this.profile.blocks[name];
    // Flera ingångar rapporterar alla samma beläggning; simulatorn har ingen egen bild av var på spårledningen tåget står.
    for (const i of b.inputs || [b]) { const active = this.inputActive(i.address); this.emit('frame', sensorReport(i.address, i.activeMeansOccupied ? active : !active)); }
  }
  reportSignal(name) {
    const s = this.signals[name], b = this.profile.signals[name]; if (s.virtual) return;
    // Per profil: SE-telegram med beskedskod, eller växelrapport (B1) där CLOSED = kör och THROWN = stopp.
    this.emit('frame', signalReportKind(this.profile, b) === 'switch' ? switchReport(b.reportAddress, s.code ? 'C' : 'T') : signalReport(b.reportAddress, s.code));
  }
  // Avfrågning (0.77.0): simulatorn svarar som MGP:s ingångskort, med ingångarna och inget annat. Den fördelar ingångarna
  // på avfrågningens åtta grupper efter adress ((adress − 1) >> 3 & 7), så att varje ingång svarar en gång per varv.
  // De riktiga korten svarar per kort; vilket kort som svarar på vilken grupp avgör deras adress.
  interrogate(group) {
    const sent = new Set(), faulty = this.faults.sensor ? this.profile.blocks[this.faults.sensor].address : null;
    for (const b of Object.values(this.profile.blocks)) for (const i of b.inputs || [b]) {
      if (sent.has(i.address) || ((i.address - 1) >> 3 & 7) !== group) continue; sent.add(i.address);
      if (i.address === faulty) continue;
      const active = this.inputActive(i.address); this.emit('frame', sensorReport(i.address, i.activeMeansOccupied ? active : !active));
    }
    const p = this.programming, a = this.profile.programming?.reportAddress;
    if (p && !p.fault && a && !sent.has(a) && ((a - 1) >> 3 & 7) === group) this.emit('frame', sensorReport(a, p.active));
    // Växelmotorernas lägesgivare är ingångar på korten och svarar på avfrågningen som de andra.
    for (const [name, b] of Object.entries(this.profile.turnouts)) {
      if (!b.feedbackSensors || b.local || this.faults.turnout === name) continue;
      const value = this.turnouts[name].position;
      for (const [address, active] of [[b.feedbackSensors.thrown, value === 'T'], [b.feedbackSensors.closed, value === 'C']])
        if (!sent.has(address) && ((address - 1) >> 3 & 7) === group) { sent.add(address); this.emit('frame', sensorReport(address, active)); }
    }
  }
  // Allt på en gång, som om varje kort rapporterade: bara för proven. Simulatorn sänder det inte (korten upprepar inget).
  allReports() {
    for (const n of Object.keys(this.turnouts)) this.reportTurnout(n);
    // Varje ingång rapporteras en gång; en spårledning med flera ingångar rapporteras när någon av dem ännu inte gått ut.
    const sent=new Set();
    for (const n of Object.keys(this.blocks)) { const inputs=(this.profile.blocks[n].inputs||[this.profile.blocks[n]]).map(i=>i.address); if(inputs.every(a=>sent.has(a))) continue; this.reportBlock(n); for(const a of inputs) sent.add(a); }
    for (const n of Object.keys(this.signals)) this.reportSignal(n);
    this.reportProgramming();
  }
  reportProgramming(){const p=this.programming,b=this.profile.programming;if(p&&!p.fault){this.emit('frame',switchReport(b.relayAddress,p.relay));this.emit('frame',sensorReport(b.reportAddress,p.active));}}
  setProgrammingFault(enabled){if(!this.programming||typeof enabled!=='boolean')throw Error('Ogiltigt programmeringsfel.');this.programming.fault=enabled;this.tick();this.reportProgramming();}
  accept(bytes) {
    const sv=decodeSv(bytes); if(sv){ if(!sv.reply) this.answerSv(sv); return; }
    const d = decode(bytes); if (d.kind === 'interrogate') return this.interrogate(d.group);
    if (d.kind !== 'order' || !d.on) return;
    // Reläet som redan står i det begärda läget rapporterar direkt, som en växel; annars rör det sig först.
    if(this.programming&&d.address===this.profile.programming.relayAddress){const p=this.programming,target=d.position==='C';if(target===p.active&&p.relay!=='unknown'&&!p.due)this.reportProgramming();else{p.target=target;p.relay='unknown';p.due=this.now()+this.movementMs;this.reportProgramming();}}
    for (const [name, b] of Object.entries(this.profile.turnouts)) {
      if (b.address !== d.address) continue;
      const logical = b.inverted ? (d.position === 'C' ? 'T' : 'C') : d.position;
      const s = this.turnouts[name];
      // Ett MGP-kort svarar på ordern; en motor som redan ligger rätt ändrar inga givare och rapporterar inget.
      if (s.position === logical) { if (!b.feedbackSensors) this.reportTurnout(name); continue; }
      s.target = logical; s.position = 'unknown'; s.due = this.now() + this.movementMs;
      this.reportTurnout(name);
    }
    for (const [name, b] of Object.entries(this.profile.signals)) {
      if (b.address !== d.address) continue;
      const s = this.signals[name]; s.permission = d.position === 'C' ? 'GO' : 'STOP'; s.due = this.now() + 160;
      if (s.permission === 'STOP') { s.code = 0; this.reportSignal(name); }
    }
    this.tick();
  }
  tick() {
    const now = this.now();
    const p=this.programming;if(p&&p.due&&p.due<=now&&!p.fault){p.active=p.target;p.relay=p.active?'C':'T';p.due=0;this.reportProgramming();}
    for (const [n, s] of Object.entries(this.turnouts)) if (s.due && s.due <= now && this.faults.turnout !== n) {
      s.position = s.target; s.due = 0; this.reportTurnout(n);
    }
    for (const [n, s] of Object.entries(this.signals)) {
      if (s.virtual) continue;
      const p = this.profile.protection[n];
      const alternatives=(p?.alternatives || (p?[p]:[])).filter(option=>Object.entries(option.turnouts).every(([t,pos])=>this.turnouts[t].position===pos));
      const programSafe=option=>!this.programming||(!Object.hasOwn(option.turnouts,this.profile.programming.turnout)&&!option.blocks.some(b=>this.profile.programming.blocks.includes(b)))||(this.programming.relay==='T'&&!this.programming.active);
      const permitted = s.permission === 'GO' && now >= s.due && this.faults.signal !== n && alternatives.length>0 && alternatives.every(option=>programSafe(option)&&option.blocks.every(b=>!this.blocks[b]));
      // Provisional CZ example codes; intentionally no invented Swedish aspect table.
      const code = permitted ? (alternatives.some(p=>Object.values(p.turnouts).includes('T')) ? 18 : 8) : 0;
      if (code !== s.code) { s.code = code; this.reportSignal(n); }
    }
    for(const train of [...this.trains]) if(now>=train.nextAt) this.stepTrain(train);
  }
  setBlock(name, occupied) {
    if (!(name in this.blocks) || typeof occupied !== 'boolean') throw Error('Okänd detektor.');
    this.updateBlock(name,occupied); this.tick();
  }
  updateBlock(name,occupied) {
    (this.direct ??= {})[name]=occupied;
    const address=this.profile.blocks[name].address;
    for(const [alias,binding] of Object.entries(this.profile.blocks)) if(binding.address===address) this.blocks[alias]=occupied;
    this.reportBlock(name);
  }
  setFault(kind, name) {
    const allowed = { turnout: this.turnouts, signal: this.signals, sensor: this.blocks };
    if (!allowed[kind] || (name && !(name in allowed[kind]))) throw Error('Okänd felpunkt.');
    this.faults[kind] = name; this.tick();
  }
  startTrain(id) {
    const candidates=[...this.profile.scenarios,...(this.profile.scenarioAlternatives||[])].filter(s=>s.id===id);
    // Select from field positions and signal feedback, never TKL runtime state.
    const path = candidates.find(s=>Object.entries(s.turnouts||{}).every(([n,p])=>this.turnouts[n].position===p)&&(s.signals||[s.signal]).every(n=>this.signals[n].code)) || candidates[0];
    if (!path) throw Error('Okänd färd.');
    const stop = (path.signals || [path.signal]).find(n => !this.signals[n].code);
    if (stop) throw Error(`Signal ${stop} visar inte kör i anläggningen.`);
    if (path.blocks.some(n => this.blocks[n])) throw Error('Färdvägen är redan belagd.');
    if(path.turnouts && Object.entries(path.turnouts).some(([n,p])=>this.turnouts[n].position!==p)) throw Error('Växlarna ligger inte för den valda färden.');
    const addresses=new Set(path.blocks.map(n=>this.profile.blocks[n].address));
    if(this.trains.some(t=>t.blocks.some(n=>addresses.has(this.profile.blocks[n].address)))) throw Error('Ett annat tåg använder den valda färden.');
    const seen=new Set(), blocks=path.blocks.filter(n=>{const a=this.profile.blocks[n].address;if(seen.has(a))return false;seen.add(a);return true;});
    this.trains.push({number:'P'+(++this.nextTrain),label:path.label,blocks,signalEntries:path.signalEntries || [{signal:path.signal,index:0}],turnouts:path.turnouts || {},index:-1,nextAt:this.now()+50});
    this.train=this.trains[0] || null;
  }
  // Simulerade tåg på linjerna (0.74.0). Ett tåg med nummer ställs på linjen utanför infartssignalen, kör när en
  // tågväg därifrån är lagd och signalerna visar kör, stannar på målspåret och kör vidare på nästa tågväg. Ut på en
  // linje lämnar det anläggningen. Simulatorn vet inget om TKL:s tågvägar: den läser växlarna och signalerna, och
  // tåget väljer den färd vars växlar ligger rätt och vars signaler visar kör.
  routes(){return this.catalogue??=[...this.profile.scenarios,...(this.profile.scenarioAlternatives||[])].map(s=>{const [from,to]=s.id.split('--');return {...s,from,to};});}
  // Block som följer på varandra i någon färd: där kan ett stående tåg börja nästa.
  neighbours(){if(!this.adjacent){this.adjacent={};for(const s of this.routes())s.blocks.forEach((b,i)=>{const n=s.blocks[i+1];if(n){(this.adjacent[b]??=new Set()).add(n);(this.adjacent[n]??=new Set()).add(b);}});}return this.adjacent;}
  // at: en linjes infart (htvAu …) eller, sedan 0.79.0, ett spår på stationen (en knapp som är mål för en färd, htvSpIA …):
  // trafikspelets uppställda tåg ställs där.
  spawnTrain({number,at}={}) {
    if(typeof number!=='string'||!/^[\p{L}\p{N} ._/-]{1,24}$/u.test(number))throw Error('Ogiltigt tågnummer.');
    const line=this.lineButtons.has(at);
    if(typeof at!=='string'||line&&!this.routes().some(s=>s.from===at))throw Error('Okänd linje.');
    const track=Object.values(this.traffic?.stationTracks||{}).find(t=>t.button===at);
    const block=line&&this.traffic?this.traffic.edgeBlocks[this.lineEdges[at]]:track?.block??this.routes().find(s=>s.to===at)?.blocks.at(-1);
    if(!block||!this.profile.blocks[block])throw Error(line?'Linjen saknar block utanför infartssignalen.':'Okänt spår.');
    const address=this.profile.blocks[block].address;
    if(this.blocks[block]||this.trains.some(t=>t.blocks.some(n=>this.profile.blocks[n].address===address)))throw Error(line?'Linjen är belagd.':'Spåret är belagt.');
    if(this.trains.some(t=>t.number===number))throw Error(`Tåg ${number} finns redan.`);
    this.updateBlock(block,true);
    const t={number,label:line?'På linjen':'Uppställt',blocks:[block],index:0,position:at,standing:true,park:true,signalEntries:[],turnouts:{},waiting:line?'Väntar vid infartssignalen':'Uppställt',nextAt:this.now()+500};
    this.trains.push(t);this.train=this.trains[0]||null;return {number,block};
  }
  // Ett av trafikspelets tåg som trafikspelet inte längre har här tas bort från banan (0.82.0), och bara när det står:
  // ett tåg som kör lämnar banan själv.
  removeTrain({number}={}) {
    const t=this.trains.find(x=>x.number===number);
    if(!t)throw Error(`Tåg ${number} finns inte på banan.`);
    if(!t.park)throw Error(`Tåg ${number} är inte ett av trafikspelets tåg.`);
    if(!t.standing)throw Error(`Tåg ${number} kör.`);
    this.trains=this.trains.filter(x=>x!==t);this.train=this.trains[0]||null;
    for(const block of t.blocks)this.updateBlock(block,false);
    return {number};
  }
  depart(t) {
    const here=t.blocks[t.index],address=this.profile.blocks[here].address,near=this.neighbours()[here]||new Set();
    const busy=new Set(this.trains.filter(o=>o!==t).flatMap(o=>o.blocks.map(n=>this.profile.blocks[n].address)));
    const path=this.routes().find(s=>(s.from===t.position||near.has(s.blocks[0]))&&!s.blocks.some(b=>this.profile.blocks[b].address===address)
      &&Object.entries(s.turnouts||{}).every(([n,p])=>this.turnouts[n].position===p)&&(s.signals||[s.signal]).every(n=>this.signals[n].code)
      &&s.blocks.every(b=>!this.blocks[b]&&!busy.has(this.profile.blocks[b].address)));
    t.nextAt=this.now()+400;
    if(!path)return false;
    const seen=new Set([address]),blocks=path.blocks.filter(n=>{const a=this.profile.blocks[n].address;if(seen.has(a))return false;seen.add(a);return true;});
    Object.assign(t,{label:path.label,to:path.to,blocks:[here,...blocks],index:0,standing:false,waiting:null,turnouts:path.turnouts||{},signalEntries:(path.signalEntries||[{signal:path.signal,index:0}]).map(e=>({...e,index:e.index+1}))});
    return true;
  }
  stepTrain(t) {
    if (t.standing) { this.depart(t); return; }
    const next = t.index + 1;
    const stop = t.signalEntries.find(e => e.index === next && !this.signals[e.signal].code);
    const moved = Object.entries(t.turnouts).some(([n,p]) => this.turnouts[n].position !== p);
    if (stop || moved) { t.waiting = stop ? `Stopp vid ${stop.signal}` : 'Växelläge ändrat'; t.nextAt = this.now()+250; return; }
    t.waiting = null;
    t.index++; t.nextAt = this.now() + 850;
    if (t.index < t.blocks.length) this.updateBlock(t.blocks[t.index],true);
    if (t.index >= 2) this.updateBlock(t.blocks[t.index-2],false);
    // Framme på ett spår på stationen: tåget står kvar i sista blocket. Ut på en linje lämnar det anläggningen.
    if (t.park && t.index === t.blocks.length && !this.lineButtons.has(t.to)) {
      Object.assign(t,{blocks:[t.blocks.at(-1)],index:0,standing:true,position:t.to,waiting:'Står på '+t.label.split(' → ').at(-1),nextAt:this.now()+1500});
      return;
    }
    if (t.index >= t.blocks.length + 1) this.trains=this.trains.filter(x=>x!==t);
    this.train=this.trains[0] || null;
    // tick on the next 50 ms cycle recalculates local signal protection.
  }
  simulate(command) {
    if (command?.kind === 'spawn') { const result = this.spawnTrain(command); this.tick(); return result; }
    if (command?.kind === 'remove') { const result = this.removeTrain(command); this.tick(); return result; }
    throw Error('Okänt simuleringskommando.');
  }
  snapshot() { return { turnouts: this.turnouts, blocks: this.blocks, signals: this.signals, programming:this.programming,faults: this.faults, train: this.train, trains:this.trains, scenarios: this.profile.scenarios }; }
}
