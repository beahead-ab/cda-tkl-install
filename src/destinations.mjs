import {legacyDestinationDefaults,legacyDestinationLines} from '../public/destination-data.js';
const legacy = {destinationDefaults:legacyDestinationDefaults,destinationLines:legacyDestinationLines};
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const clean=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const defaultOutgoing=traffic=>Object.fromEntries(traffic.destinationLines.map(line=>[line.id,line.outgoing]));
const initial=traffic=>({revision:0,entries:traffic.destinationDefaults.map(({id,name,phone})=>({id,name,phone,source:'local',stationId:''}))});
function validateEntry(d,defaults){
  if(!d||!defaults.some(x=>x.id===d.id)||!['local','trainmeet'].includes(d.source)||!clean(d.name,40)||!d.name.trim()||!clean(d.phone,24)||!/^[-+()\d *#]*$/.test(d.phone)||!clean(d.stationId,128)||d.source==='trainmeet'&&!d.stationId.trim())fail('Ange ortsnamn, giltigt telefonnummer och station vid TrainMeet-koppling.');
}
function validateOutgoing(outgoing,lines){
  if(!outgoing||typeof outgoing!=='object'||Array.isArray(outgoing)||Object.keys(outgoing).length!==lines.length||!lines.every(line=>line.tracks.includes(outgoing[line.id])))fail('Välj ett giltigt utgående spår för varje linje.');
}
function validateBook(data,traffic){
  if(!data||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.entries)||data.entries.length!==traffic.destinationDefaults.length)throw Error('Ogiltiga sparade ortsuppgifter.');
  for(const d of data.entries)validateEntry(d,traffic.destinationDefaults);
  if(new Set(data.entries.map(d=>d.id)).size!==traffic.destinationDefaults.length)throw Error('Dubbla ortsuppgifter.');
  if(data.outgoing!==undefined)validateOutgoing(data.outgoing,traffic.destinationLines);
}
export class Destinations {
  constructor(storage,traffic=legacy){
    this.storage=storage;this.traffic=traffic;
    this.data=storage.load('destinations.json',initial(traffic));
    // Äldre Träkvistapaket skrev Charlottendals sju ortsposter också i Träkvistas egen driftkatalog. Vi godtar
    // bara det exakta gamla formatet. Egna namn, telefoner och kopplingar behålls i sin helhet som en synlig
    // överlämning; inget skrivs vid start och ingen granne gissas ur de gamla uppgifterna.
    const oldIds=legacyDestinationDefaults.map(d=>d.id);
    if(traffic.explicitConnections&&this.data?.entries?.length===oldIds.length&&this.data.entries.every(d=>oldIds.includes(d?.id))){
      validateBook(this.data,legacy);
      const previous=structuredClone(this.data),untouched=previous.revision===0&&JSON.stringify(previous.entries)===JSON.stringify(initial(legacy).entries)&&
        (previous.outgoing===undefined||JSON.stringify(previous.outgoing)===JSON.stringify(defaultOutgoing(legacy)))&&
        Object.keys(previous).every(key=>['revision','entries','outgoing'].includes(key));
      this.data={...initial(traffic),revision:previous.revision};
      if(!untouched)this.data.migration={kind:'legacy-destinations',message:'Äldre ortsuppgifter är bevarade i destinations.json under migration.previous. Koppla linjerna till rätt stationer i TrainMeet; de äldre namnen och kopplingarna används inte för trafiken.',previous};
    }
    validateBook(this.data,traffic);
    if(this.data.migration){
      if(!traffic.explicitConnections||this.data.migration.kind!=='legacy-destinations')throw Error('Ogiltig överlämning av äldre ortsuppgifter.');
      validateBook(this.data.migration.previous,legacy);
    }
    // Gamla Charlottendalfiler behåller varje spårs namn och telefon. Normal utfart läggs bara till i minnet,
    // och skrivs tillsammans med övriga uppgifter först när administratören uttryckligen sparar.
    this.data.outgoing??=defaultOutgoing(traffic);
    this.validateOutgoing(this.data.outgoing);
  }
  validateOutgoing(outgoing){validateOutgoing(outgoing,this.traffic.destinationLines);}
  validate(d){validateEntry(d,this.traffic.destinationDefaults);}
  view(){return structuredClone(this.data);}
  save({revision,entry,outgoing},stations=[]){
    if(revision!==this.data.revision)fail('Ortsuppgifterna har ändrats. Stäng redigeringen och öppna den igen.',409);
    this.validate(entry);
    const line=this.traffic.destinationLines.find(l=>l.tracks.includes(entry.id));
    const selected={...this.data.outgoing};
    if(outgoing!==undefined)selected[line.id]=outgoing;
    this.validateOutgoing(selected);
    if(entry.source==='trainmeet'&&!stations.some(s=>s.id===entry.stationId))fail('Stationen finns inte i den hämtade TrainMeet-träffen.');
    const value={id:entry.id,name:entry.name.trim(),phone:entry.phone.trim(),source:entry.source,stationId:entry.source==='trainmeet'?entry.stationId:''};
    const next={revision:revision+1,outgoing:selected,entries:this.data.entries.map(d=>d.id===entry.id?value:d),...(this.data.migration?{migration:structuredClone(this.data.migration)}:{})};
    this.storage.save('destinations.json',next);this.data=next;return this.view();
  }
}
