// The new kernel owns both roles. Handover is a durable software permission,
// not a fabricated LocoNet report or a call into JMRI. A future ranger client
// must submit commands through this kernel, never directly to the decoder.
export class YardControl {
  constructor(engine){
    this.e=engine;this.def=engine.profile.yardArea;this.blockAddresses=new Set((this.def?.blocks||[]).map(n=>engine.profile.blocks[n].address));
    const saved=engine.controls.yard;
    if(saved&&(!this.def||!['tkl','ranger'].includes(saved.owner)))throw Error('Ogiltig sparad manöverrätt för rangerbangården.');
    if(saved?.owner==='ranger'&&saved.fingerprint!==engine.fingerprint)throw Error('Profilen har ändrats medan rangerbangården är överlämnad. Återställ profilen före start.');
  }
  get delegated(){return this.e.controls.yard?.owner==='ranger';}
  get addresses(){return this.blockAddresses;}
  affected(route){const addresses=this.addresses;return !!this.def&&(Object.keys(route.turnouts||{}).some(n=>this.def.turnouts.includes(n))||(route.blocks||[]).some(n=>addresses.has(this.e.profile.blocks[n]?.address)));}
  routeReason(route){
    if(!this.delegated||!this.affected(route))return null;
    // TKL keeps the reviewed access routes to/from 11–13. All their usual
    // route locks cover shared points; a ranger restoration cannot break one.
    if(this.def.accessRoutes.includes(route.definitionId||route.id))return null;
    return 'Rangerbangården är överlämnad. Återta manöverrätten för denna tågväg.';
  }
  manualReason(names,operator){
    if(operator==='ranger'){
      if(!this.delegated)return 'Rangerbangården är inte överlämnad.';
      if(names.some(n=>!this.def.turnouts.includes(n)&&!this.e.profile.yardBoundaries[n]))return 'Växeln tillhör TKL:s område.';
    }else if(this.delegated&&names.some(n=>this.def.turnouts.includes(n)))return 'Växeln manövreras av rangerställverket. Återta rangerbangården först.';
    return null;
  }
  changeStatus(){
    const e=this.e,deny=reason=>({allowed:false,reason});
    if(!this.def)return deny('Rangerområde saknas i profilen.');
    if(!e.connected||e.storageFault)return deny('Anslutning och fungerande lagring krävs.');
    if(e.controls.mode!=='local')return deny('Lokal manövrering krävs.');
    if(e.controls.panelReset?.completedAt===null)return deny('Invänta panelåterställningen.');
    if(e.controls.programming.reserved)return deny('Återgå från programmering först.');
    if(e.routes.some(r=>this.affected(r)))return deny('Återta berörda tågvägar innan manöverrätten byts.');
    for(const n of [...this.def.turnouts,...Object.keys(e.profile.yardBoundaries)])if(!e.fresh(e.turnouts[n])||e.turnouts[n].position==='unknown'||(e.turnouts[n].desired&&e.turnouts[n].position!==e.turnouts[n].desired)||e.turnouts[n].reportSequence<=(e.turnouts[n].commandSequence??-1))return deny(n+' saknar bekräftat läge.');
    for(const n of this.def.blocks)if(!e.fresh(e.blocks[n]))return deny(n+' saknar aktuell återrapport.');
    for(const n of this.def.signals)if(!e.fresh(e.signals[n])||e.signals[n].aspect!=='stop'||e.signals[n].desired!=='STOP'||e.signals[n].reportSequence<=(e.signals[n].commandSequence??-1))return deny('Signal '+n+' måste visa bekräftat stopp.');
    return {allowed:true,reason:this.delegated?'Återta rangerbangårdens manövrer till TKL.':'Lämna över lokala manövrer. TKL behåller gränsväxlarna och infart/utfart till 11–13.'};
  }
  setOwner(owner){
    if(!['tkl','ranger'].includes(owner))throw Error('Ogiltig manöverrätt.');
    if(owner===(this.delegated?'ranger':'tkl'))throw Error('Manöverrätten har redan ändrats. Läs senaste läget.');
    const check=this.changeStatus();if(!check.allowed)throw Error(check.reason);
    const previous=this.e.controls.yard;
    this.e.controls.yard={owner,fingerprint:this.e.fingerprint};
    try{this.e.persistControls();}catch(error){this.e.controls.yard=previous;throw error;}
    this.e.operating.revision++;
    this.e.log('yard-authority',owner==='ranger'?'Rangerbangårdens manöverrätt överlämnad. TKL behåller gränsväxlar och anslutning till 11–13.':'TKL har återtagit rangerbangårdens manöverrätt.');
  }
  snapshot(){return this.def?{owner:this.delegated?'ranger':'tkl',change:this.changeStatus(),mode:'central-kernel'}:null;}
}
