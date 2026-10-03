// A versioned presentation layer. Stable object identities and all operational
// bindings remain in the reviewed profile, never in user-editable overrides.
const kinds = { turnouts:'Växel', signals:'Signal', blocks:'Spåravsnitt', buttons:'Tågvägsknapp', routes:'Tågväg' };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message, status=400) => { throw Object.assign(Error(message), { status }); };
const copy = value => structuredClone(value);

export class Configuration {
  constructor(profile, { storage, canActivate=()=>true, now=Date.now }={}) {
    this.storage=storage; this.canActivate=canActivate; this.now=now;
    this.catalog=Object.entries(kinds).flatMap(([kind, title]) => {
      const entries=kind==='routes' ? profile.routes.map(r=>[r.id,r]) : Object.entries(profile[kind]||{});
      return entries.map(([id, b])=>({key:kind+':'+id,kind,title,id,label:b.label||id,
        source:b.source||b.sourceSensor||null,address:b.address??null,description:''}));
    });
    this.objects=new Map(this.catalog.map(r=>[r.key,r]));
    this.data=storage.load('configuration.json', {schema:1,revision:0,activeVersion:0,draft:null,
      versions:[{id:0,createdAt:null,reason:'Originalets visningsnamn',overrides:{}}]});
    const d=this.data;
    if(d.schema!==1 || !Number.isSafeInteger(d.revision) || d.revision<0 || !Array.isArray(d.versions) || !d.versions.length || d.versions.some((v,i)=>v.id!==i || !record(v.overrides)) || !d.versions[d.activeVersion] || (d.draft && (!record(d.draft.overrides) || d.draft.baseVersion!==d.activeVersion))) throw Error('Sparade inställningsversioner är ogiltiga. Återställ en kontrollerad backup.');
    // An active name must still refer to an existing object after a software update.
    const errors=this.validate(this.active.overrides);
    if(errors.length) throw Error('Aktiva visningsinställningar stämmer inte med profilen: '+errors.join(' '));
  }
  get active() { return this.data.versions[this.data.activeVersion]; }
  presentation() { return {activeVersion:this.data.activeVersion,overrides:copy(this.active.overrides)}; }
  validate(overrides) {
    if(!record(overrides)) return ['Ändringslagret måste innehålla objekt.'];
    const errors=[];
    for(const [key, fields] of Object.entries(overrides)) {
      if(!this.objects.has(key)) { errors.push('Okänt objekt: '+key); continue; }
      if(!record(fields) || Object.keys(fields).some(f=>!['name','description'].includes(f))) { errors.push(key+': endast visningsnamn och beskrivning kan ändras.'); continue; }
      for(const [field,value] of Object.entries(fields)) {
        const max=field==='name'?64:1000;
        if(typeof value!=='string' || value.length>max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value) || (field==='name' && (!value.trim() || /[\n\r\t]/.test(value)))) errors.push(key+': ogiltigt '+(field==='name'?'visningsnamn':'beskrivning')+'.');
      }
    }
    return errors;
  }
  diff(overrides) {
    const keys=[...new Set([...Object.keys(this.active.overrides),...Object.keys(overrides)])].sort();
    return keys.flatMap(key=>['name','description'].flatMap(field=>{
      const base=field==='name'?this.objects.get(key)?.label||key:'';
      const before=this.active.overrides[key]?.[field]??base, after=overrides[key]?.[field]??base;
      return before===after?[]:[{key,field,before,after}];
    }));
  }
  view() {
    const draft=copy(this.data.draft);
    return {revision:this.data.revision,active:this.presentation(),draft,catalog:this.catalog,
      changes:draft?this.diff(draft.overrides):[],errors:draft?this.validate(draft.overrides):[],
      activationAllowed:this.canActivate()===true,
      history:this.data.versions.map(v=>({id:v.id,createdAt:v.createdAt,reason:v.reason,objects:Object.keys(v.overrides).length}))};
  }
  checkRevision(expected) { if(expected!==this.data.revision) fail('Inställningarna har ändrats i en annan panel. Läs in senaste versionen innan du sparar igen.',409); }
  commit(next) {
    next.revision=this.data.revision+1;
    // Durable write first. A failed save never alters the live or staged layer.
    this.storage.save('configuration.json',next); this.data=next;
    return this.view();
  }
  save({revision,key,name,description,...extra}) {
    this.checkRevision(revision);
    if(Object.keys(extra).length || !this.objects.has(key)) fail('Okänt objekt eller ändringsfält.');
    const errors=this.validate({[key]:{name,description}}); if(errors.length) fail(errors.join(' '));
    const next=copy(this.data), base=this.objects.get(key);
    next.draft ||= {baseVersion:next.activeVersion,updatedAt:this.now(),restoredFrom:null,overrides:copy(this.active.overrides)};
    const fields={}; if(name.trim()!==base.label) fields.name=name.trim(); if(description.trim()) fields.description=description.trim();
    if(Object.keys(fields).length) next.draft.overrides[key]=fields; else delete next.draft.overrides[key];
    next.draft.updatedAt=this.now(); return this.commit(next);
  }
  restore({revision,version}) {
    this.checkRevision(revision);
    if(!Number.isSafeInteger(version) || !this.data.versions[version]) fail('Versionen finns inte.');
    if(this.data.draft) fail('Granska eller kasta det sparade utkastet innan en äldre version hämtas.',409);
    const next=copy(this.data); next.draft={baseVersion:next.activeVersion,updatedAt:this.now(),restoredFrom:version,overrides:copy(next.versions[version].overrides)};
    return this.commit(next);
  }
  discard({revision}) { this.checkRevision(revision); const next=copy(this.data); next.draft=null; return this.commit(next); }
  activate({revision,reason}) {
    this.checkRevision(revision);
    if(typeof reason!=='string' || !reason.trim() || reason.length>200 || /[\u0000-\u001f\u007f]/.test(reason)) fail('Beskriv ändringen kort (1–200 tecken).');
    if(!this.data.draft) fail('Det finns inget sparat utkast.');
    const errors=this.validate(this.data.draft.overrides); if(errors.length) fail(errors.join(' '));
    if(!this.diff(this.data.draft.overrides).length) fail('Utkastet innehåller ingen ändring jämfört med aktiv version.');
    if(this.canActivate()!==true) fail('Aktivering spärrad: återta alla tågvägslås och åtgärda eventuella lagringsfel först.',409);
    const next=copy(this.data), id=next.versions.length;
    next.versions.push({id,createdAt:this.now(),reason:reason.trim(),overrides:copy(next.draft.overrides),restoredFrom:next.draft.restoredFrom});
    next.activeVersion=id; next.draft=null; return this.commit(next);
  }
}
