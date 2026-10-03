import {destinationDefaults as defaults,destinationLines,defaultOutgoing} from '../public/destination-data.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const clean=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
export class Destinations {
  constructor(storage){
    this.storage=storage;this.data=storage.load('destinations.json',{revision:0,entries:defaults.map(({id,name,phone})=>({id,name,phone,source:'local',stationId:''}))});
    if(!Number.isSafeInteger(this.data.revision)||this.data.revision<0||!Array.isArray(this.data.entries)||this.data.entries.length!==defaults.length)throw Error('Ogiltiga sparade ortsuppgifter.');
    for(const d of this.data.entries)this.validate(d);
    if(new Set(this.data.entries.map(d=>d.id)).size!==defaults.length)throw Error('Dubbla ortsuppgifter.');
    // Old files retain every per-track name and telephone number. Defaults are
    // applied in memory and persisted with the next explicit admin save.
    this.data.outgoing??=defaultOutgoing();
    this.validateOutgoing(this.data.outgoing);
  }
  validateOutgoing(outgoing){
    if(!outgoing||typeof outgoing!=='object'||Array.isArray(outgoing)||Object.keys(outgoing).length!==destinationLines.length||!destinationLines.every(l=>l.tracks.includes(outgoing[l.id])))fail('Välj ett giltigt utgående spår för varje linje.');
  }
  validate(d){
    if(!d||!defaults.some(x=>x.id===d.id)||!['local','trainmeet'].includes(d.source)||!clean(d.name,40)||!d.name.trim()||!clean(d.phone,24)||!/^[-+()\d *#]*$/.test(d.phone)||!clean(d.stationId,128)||d.source==='trainmeet'&&!d.stationId.trim())fail('Ange ortsnamn, giltigt telefonnummer och station vid TrainMeet-koppling.');
  }
  view(){return structuredClone(this.data);}
  save({revision,entry,outgoing},stations=[]){
    if(revision!==this.data.revision)fail('Ortsuppgifterna har ändrats. Stäng redigeringen och öppna den igen.',409);
    this.validate(entry);
    const line=destinationLines.find(l=>l.tracks.includes(entry.id));
    const selected={...this.data.outgoing};
    if(outgoing!==undefined)selected[line.id]=outgoing;
    this.validateOutgoing(selected);
    if(entry.source==='trainmeet'&&!stations.some(s=>s.id===entry.stationId))fail('Stationen finns inte i den hämtade TrainMeet-träffen.');
    const value={id:entry.id,name:entry.name.trim(),phone:entry.phone.trim(),source:entry.source,stationId:entry.source==='trainmeet'?entry.stationId:''};
    const next={revision:revision+1,outgoing:selected,entries:this.data.entries.map(d=>d.id===entry.id?value:d)};
    this.storage.save('destinations.json',next);this.data=next;return this.view();
  }
}
