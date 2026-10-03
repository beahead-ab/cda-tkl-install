// Read-only projection. This module cannot order equipment or release reservations.
import {prepareCrossing, crossingWarning} from './crossing-indications.mjs';
export class PanelIndications {
  constructor(catalog,profile) {
    if(profile.sourceHash&&profile.sourceHash!==catalog.sourceHash)throw Error('Indikeringarnas källa stämmer inte med driftprofilen.');
    this.source=catalog;this.profile=profile;
    this.coveredNX=new Set([...profile.routes,...(profile.routeAlternatives||[])].flatMap(r=>r.nxIds||[]));
    this.definitions=catalog.indicators.map(indicator=>({...indicator,...(indicator.crossing?{crossing:prepareCrossing(indicator.crossing,profile)}:{}),conditions:indicator.conditions.map(condition=>({...condition,
      blocks:condition.kind==='sensor'?Object.entries(profile.blocks).filter(([,b])=>[condition.id,condition.sourceSystem].includes(b.sourceSensor)).map(([name])=>name):[],
      connected:condition.kind==='nx'?this.coveredNX.has(condition.id):Object.values(profile.blocks).some(b=>[condition.id,condition.sourceSystem].includes(b.sourceSensor))
    }))}));
  }
  catalog(){return {sourceHash:this.source.sourceHash,indicators:this.definitions};}
  snapshot(state) {
    const usable=state.connection==='connected'&&!state.storageFault;
    return Object.fromEntries(this.definitions.map(def=>{
      const conditions=def.conditions.map(condition=>{
        let value=null,reason='Saknar anslutet underlag';
        if(!usable)reason=state.storageFault?'Lagringsfel':'Anläggningen är frånkopplad';
        else if(condition.kind==='nx'&&condition.connected) {
          const reservations=state.routes.filter(r=>r.nxIds?.includes(condition.id));
          if(!reservations.length){value=false;reason='Ingen reservation';}
          else if(reservations.some(r=>['active','traversing'].includes(r.state))){value=true;reason='Klar tågväg eller tågpassage';}
          else reason='Tågväg under etablering, återtagning eller med kvarvarande lås';
        }else if(condition.kind==='sensor'&&condition.connected) {
          const reports=condition.blocks.map(name=>({binding:this.profile.blocks[name],report:state.blocks[name]}));
          const fresh=reports.every(({report:s})=>s&&typeof s.occupied==='boolean'&&s.updatedAt>0&&state.serverTime>=s.updatedAt&&state.serverTime-s.updatedAt<=this.profile.staleMs);
          const addresses=new Set(reports.map(r=>r.binding.address));
          const values=reports.map(({binding,report})=>binding.activeMeansOccupied?report?.occupied:!report?.occupied);
          if(fresh&&addresses.size===1&&values.every(v=>v===values[0])){value=values[0];reason=value?'Aktiv sensor återrapporterad':'Inaktiv sensor återrapporterad';}
          else reason='Saknad, gammal eller motsägande återrapport';
        }
        return {kind:condition.kind,id:condition.id,label:condition.label,value,reason};
      });
      const value=conditions.some(c=>c.value===true)?true:conditions.every(c=>c.value===false)?false:null;
      return [def.name,{value,derived:true,complete:conditions.every(c=>c.value!==null),known:conditions.filter(c=>c.value!==null).length,total:conditions.length,conditions,
        ...(def.crossing?{warning:crossingWarning(def.crossing,state,this.profile)}:{})}];
    }));
  }
}
