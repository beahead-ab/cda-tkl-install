import {switchOrder} from './protocol.mjs';
import {randomUUID} from 'node:crypto';

export class OperatingControls {
  constructor(engine) {
    this.engine=engine;this.catalog=engine.profile.operatingControls||{lines:{},programming:null};
    this.sessionId=randomUUID();this.revision=0;
    this.relay={position:'unknown',updatedAt:0,reportSequence:0};this.feedback={active:null,updatedAt:0,reportSequence:0};
    this.phase=engine.controls.programming.reserved?'held':'normal';this.reason=this.phase==='held'?'Programmeringsspärr återställd. Kontrollera anläggningen och begär normaldrift.':'';
    this.commandSequence=-1;this.commandAt=0;
    this.protectingSignals=[...new Set([...engine.profile.routes,...(engine.profile.routeAlternatives||[])].filter(r=>this.affected(r)).flatMap(r=>[...r.signals,...engine.guardSignals(r)]))];
  }
  get e(){return this.engine;} get def(){return this.catalog.programming;} get reservation(){return this.e.controls.programming;}
  checkCommand({sessionId,revision}){if(sessionId!==this.sessionId||revision!==this.revision)throw Object.assign(Error('Manöverläget har ändrats. Läs senaste läget och försök igen.'),{status:409});}
  affected(route) {return !!this.def&&(Object.hasOwn(route.turnouts||{},this.def.turnout)||(route.blocks||[]).some(n=>this.def.blocks.some(b=>this.e.profile.blocks[b].address===this.e.profile.blocks[n].address)));}
  lineAffects(line,route){return [route.from,route.to].includes(line.button)||(route.blocks||[]).some(n=>line.blocks.some(b=>this.e.profile.blocks[b].address===this.e.profile.blocks[n].address));}
  routeReason(route) {
    const yardReason=this.e.yard?.routeReason(route);if(yardReason)return yardReason;
    const line=this.e.controls.lines.map(id=>this.catalog.lines[id]).find(l=>this.lineAffects(l,route));
    if(line)return line.label+' är spärrat.';
    if(this.affected(route)&&(this.reservation.reserved||!this.normalKnown()))return 'Programmeringsområdet är låst eller saknar bekräftad normaldrift.';
    return null;
  }
  manualReason(names,blocks=[]) {return this.affected({turnouts:Object.fromEntries(names.map(n=>[n,true])),blocks})&&(this.reservation.reserved||!this.normalKnown())?'Programmeringsområdet låser växel 133 och Lastspår 3.':null;}
  blockLine(id,blocked) {
    const line=this.catalog.lines[id];if(!line||typeof blocked!=='boolean')throw Error('Okänd linjespärr.');
    if(this.e.storageFault)throw Error('Lagringsfel; manövrering spärrad.');
    if(!blocked&&this.e.controls.mode!=='local')throw Error('Återgå till lokal manövrering innan linjespärren tas bort.');
    this.e.controls.lines=this.e.controls.lines.filter(n=>n!==id);if(blocked)this.e.controls.lines.push(id);
    this.revision++;
    this.e.persistControls();
    if(blocked)for(const route of this.e.routes)if(this.lineAffects(line,route))this.e.hold(route,line.label+' har spärrats.');
    this.e.log('line-block',`${line.label}: spärr ${blocked?'lagd':'borttagen'}. Inga detektorbesked ändrade.`);
  }
  normalKnown(){return !this.def||(this.e.fresh(this.relay)&&this.e.fresh(this.feedback)&&this.relay.position==='T'&&this.feedback.active===false);}
  guardSignals(){return this.protectingSignals;}
  environmentReason(returning=false) {
    if(!this.def)return 'Programmeringsspår saknas i profilen.';
    if(!this.e.connected||this.e.storageFault)return 'Anslutning och fungerande lagring krävs.';
    if(!returning&&this.e.controls.mode!=='local')return 'Lokal manövrering krävs.';
    if(this.e.routes.some(r=>this.affected(r)))return 'Återta berörda tågvägar först.';
    for(const n of this.def.blocks)if(!this.e.fresh(this.e.blocks[n]))return n+' saknar aktuell återrapport.';
    for(const n of this.def.clearBlocks)if(this.e.blocks[n].occupied!==false)return n+' måste vara fritt.';
    for(const n of this.guardSignals()){const s=this.e.signals[n];if(!this.e.fresh(s)||s.aspect!=='stop'||s.desired!=='STOP')return 'Skyddande signal '+n+' måste visa bekräftat stopp.';}
    const s=this.e.turnouts[this.def.turnout];if(!this.e.fresh(s)||s.position==='unknown'||s.reportSequence<=(s.commandSequence??-1))return 'Växel 133 saknar aktuellt läge.';
    return null;
  }
  enableStatus(){const reason=this.environmentReason()||(this.e.controls.stopAll?'Återställ AIS före programmering.':this.reservation.reserved?'Programmeringsområdet är redan reserverat.':!this.normalKnown()?'Invänta bekräftad normaldrift.':this.e.turnouts[this.def.turnout].position!==this.def.requiredPosition?'Växel 133 måste ligga rakt.':null);return {allowed:!reason,reason:reason||'Växel 133 rakt, skyddande signaler i stopp och inga berörda tågvägslås. Ett lok får stå på Lastspår 3.'};}
  setProgramming(enabled) {
    if(typeof enabled!=='boolean'||!this.def)throw Error('Ogiltig programmeringsmanöver.');
    if(enabled){const check=this.enableStatus();if(!check.allowed)throw Error(check.reason);}
    else if(!this.e.connected||this.e.storageFault)throw Error('Anslutning och fungerande lagring krävs för att begära normaldrift.');
    this.revision++;this.e.controls.programming={reserved:true,desired:enabled,fingerprint:this.e.fingerprint};this.e.persistControls();
    this.phase=enabled?'setting':'returning';this.reason=enabled?'Inväntar omkoppling och återrapport.':'Normaldrift begärd. Spärren kvarstår till bekräftad omkoppling.';
    this.commandSequence=this.e.reportSequence;this.commandAt=this.e.now();
    this.e.send(switchOrder(this.def.relayAddress,enabled?'C':'T'));
    this.e.log('programming',this.reason);
  }
  connection(){this.revision++;this.relay.position='unknown';this.relay.updatedAt=0;this.feedback.active=null;this.feedback.updatedAt=0;if(this.reservation.reserved){this.phase='held';this.reason='Förbindelsen ändrad. Spärren ligger kvar; begär normaldrift efter kontroll.';}}
  receive(d,sequence) {
    if(!this.def)return;
    if(d.kind==='turnout'&&d.address===this.def.relayAddress)Object.assign(this.relay,{position:d.position,updatedAt:this.e.now(),reportSequence:sequence});
    if(d.kind==='sensor'&&d.address===this.def.reportAddress)Object.assign(this.feedback,{active:d.active,updatedAt:this.e.now(),reportSequence:sequence});
    if(!this.reservation.reserved&&(this.relay.position==='C'||this.feedback.active===true)) {
      this.e.controls.programming={reserved:true,desired:false,fingerprint:this.e.fingerprint};this.e.persistControls();this.hold('Oväntad programmeringsrapport. Kontrollera och begär normaldrift.');
      for(const route of this.e.routes)if(this.affected(route))this.e.hold(route,'Oväntad programmeringsrapport.');
    }
  }
  hold(reason){if(this.phase==='held')return;this.revision++;this.phase='held';this.reason=reason;this.e.log('programming-held',reason+' Programmeringsspärren ligger kvar.');}
  tick() {
    if(!this.def)return;
    const fresh=this.e.fresh(this.relay)&&this.e.fresh(this.feedback),after=fresh&&this.relay.reportSequence>this.commandSequence&&this.feedback.reportSequence>this.commandSequence;
    if(!this.reservation.reserved)return;
    const reason=this.environmentReason(this.phase==='returning');
    if(this.phase==='returning') {
      if(after&&this.normalKnown()&&!reason){const previous=this.e.controls.programming;this.e.controls.programming={reserved:false,desired:false};try{this.e.persistControls();}catch(e){this.e.controls.programming=previous;throw e;}this.revision++;this.phase='normal';this.reason='Normaldrift bekräftad. Programmeringsspärr frigiven.';this.e.log('programming',this.reason);}
      else if(this.e.now()-this.commandAt>this.e.profile.commandTimeoutMs)this.hold('Normaldrift kunde inte bekräftas. '+(reason||'Kontrollera omkopplarens återrapport.'));
    } else if(this.phase==='setting') {
      if(reason||this.e.turnouts[this.def.turnout].position!==this.def.requiredPosition)this.hold(reason||'Växel 133 har ändrat läge.');
      else if(after&&this.relay.position==='C'&&this.feedback.active===true){this.revision++;this.phase='active';this.reason='Programmeringsläge återrapporterat. Växel 133 och Lastspår 3 är låsta.';this.e.log('programming',this.reason);}
      else if(this.e.now()-this.commandAt>this.e.profile.commandTimeoutMs)this.hold('Programmeringsläget kunde inte bekräftas.');
    } else if(this.phase==='active'&&(!fresh||reason||this.relay.position!=='C'||this.feedback.active!==true||this.e.turnouts[this.def.turnout].position!==this.def.requiredPosition))this.hold(reason||'Programmeringsåterrapport saknas eller stämmer inte.');
  }
  snapshot(){return {sessionId:this.sessionId,revision:this.revision,lines:Object.values(this.catalog.lines).map(l=>({...l,blocked:this.e.controls.lines.includes(l.id)})),programming:this.def?{...this.reservation,phase:this.phase,reason:this.reason,relay:this.e.fresh(this.relay)?this.relay.position:'unknown',reported:this.e.fresh(this.feedback)?this.feedback.active:null,normal:this.normalKnown(),enable:this.enableStatus(),rule:this.def.rule}:null};}
}
