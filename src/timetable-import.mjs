import {EventEmitter} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {tableUpload,readTable} from './timetable-table.mjs';
export const IMPORT_LIMITS={files:8,fileBytes:8*1024*1024,totalBytes:16*1024*1024,rows:300,requestBytes:23*1024*1024};
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=200)=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export const ROW_FIELDS=['trainNumber','station','day','arrival','departure','track','from','to','note'];
const blankRow=(station='Charlottendal',day='')=>({id:randomUUID(),...Object.fromEntries(ROW_FIELDS.map(k=>[k,''])),station,day,noStop:false,included:true,sources:[],uncertainties:[]});
function rowValues(row){
  if(!object(row)||ROW_FIELDS.some(k=>!text(row[k],k==='note'?2000:160))||typeof row.noStop!=='boolean')fail('En tidtabellsrad har ogiltiga uppgifter.');
  return Object.fromEntries([...ROW_FIELDS.map(k=>[k,row[k].trim()]),['noStop',row.noStop]]);
}
export function validateUploads(files){
  if(!Array.isArray(files)||!files.length||files.length>IMPORT_LIMITS.files)fail('Välj 1–8 bilder eller PDF-filer.');
  let total=0;const hashes=new Set();
  return files.map((f,index)=>{
    if(!object(f)||!text(f.name,200)||!f.name.trim()||typeof f.data!=='string'||f.data.length>Math.ceil(IMPORT_LIMITS.fileBytes/3)*4||f.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.data))fail('En uppladdad fil är ogiltig eller större än 8 MB.');
    const bytes=Buffer.from(f.data,'base64');total+=bytes.length;
    if(bytes.toString('base64')!==f.data||!bytes.length||bytes.length>IMPORT_LIMITS.fileBytes||total>IMPORT_LIMITS.totalBytes)fail('Filerna får vara högst 8 MB vardera och 16 MB tillsammans.',413);
    const mime=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':null;
    if(!mime||f.mime!==mime)fail('Filtypen stämmer inte med innehållet. Använd PDF, PNG, JPEG eller WebP.');
    const hash=createHash('sha256').update(bytes).digest('hex');if(hashes.has(hash))fail('Samma fil har valts flera gånger.');hashes.add(hash);
    return {id:String(index+1),name:path.basename(f.name).replace(/[\r\n]/g,' '),mime,size:bytes.length,hash,bytes};
  });
}
export function validateExtraction(result,files){
  if(!object(result)||!text(result.title)||!Array.isArray(result.rows)||result.rows.length>IMPORT_LIMITS.rows||!Array.isArray(result.warnings)||result.warnings.length>30||result.warnings.some(w=>!text(w,1000))||!Array.isArray(result.coverage)||result.coverage.length!==files.length)fail('AI-svaret var ofullständigt. Dela upp underlaget i färre filer och försök igen.',502);
  const coverageIds=new Set();
  for(const c of result.coverage){if(!object(c)||!Number.isInteger(c.file)||c.file<1||c.file>files.length||coverageIds.has(c.file)||c.complete!==true||!Array.isArray(c.pages)||!c.pages.length||c.pages.length>5000||new Set(c.pages).size!==c.pages.length||c.pages.some(p=>!Number.isInteger(p)||p<1||p>5000)||files[c.file-1].mime.startsWith('image/')&&(c.pages.length!==1||c.pages[0]!==1))fail('AI kunde inte läsa alla underlag. Dela upp filerna eller ladda upp tydligare bilder.',502);coverageIds.add(c.file);}
  const rows=result.rows.map(r=>{
    const values=rowValues(r);
    if(!Array.isArray(r.sources)||!r.sources.length||r.sources.length>30||r.sources.some(s=>!object(s)||!Number.isInteger(s.file)||!Number.isInteger(s.page)||!result.coverage.some(c=>c.file===s.file&&c.pages.includes(s.page)))||!Array.isArray(r.uncertainties)||r.uncertainties.length>15||r.uncertainties.some(u=>!text(u,500)))fail('AI-svaret saknar giltiga hänvisningar till underlaget.',502);
    return {id:randomUUID(),...values,included:true,sources:r.sources.map(s=>({file:s.file,page:s.page})),uncertainties:r.uncertainties};
  });
  return {title:result.title,rows,warnings:result.warnings,coverage:result.coverage};
}
export function reviewWarnings(rows){
  const seen=new Set(),warnings=[];
  for(const r of rows.filter(r=>r.included)){
    if(!r.trainNumber||!r.station||!r.day||!r.arrival&&!r.departure)warnings.push('Tågnummer, station, trafikdag eller båda tiderna saknas på en vald rad.');
    if([r.arrival,r.departure].some(value=>value&&!/^\d{2}:[0-5]\d$/.test(value)))warnings.push('Ange tider som HH:MM, exempelvis 09:15 eller 25:10.');
    const key=JSON.stringify(ROW_FIELDS.filter(k=>k!=='note').map(k=>r[k]));
    if(seen.has(key))warnings.push('Samma tågrörelse finns flera gånger. Uteslut dubbletten eller rätta uppgifterna.');seen.add(key);
  }
  return [...new Set(warnings)];
}
// Pure information store: no references to signals, routes, field reports or TrainMeet commands.
export class TimetableImport extends EventEmitter {
  constructor({storage,reader,now=Date.now}){
    super();this.storage=storage;this.reader=reader;this.now=now;this.sessionId=randomUUID();this.error='';this.task=null;
    this.data=storage.load('timetable-import.json',{version:1,revision:0,source:'trainmeet',draft:null,active:null});
    const d=this.data;if(d.version!==1||!Number.isSafeInteger(d.revision)||d.revision<0||!['trainmeet','import'].includes(d.source))throw Error('Ogiltig sparad tidtabellsimport.');
    for(const item of [d.draft,d.active].filter(Boolean)){
      if(!uuid(item.id)||!Array.isArray(item.files)||!Array.isArray(item.rows)||item.rows.length>IMPORT_LIMITS.rows||!text(item.title))throw Error('Ogiltig sparad tidtabell.');
      for(const row of item.rows)rowValues(row);
    }
    if(d.draft?.status==='reading'){d.draft={...d.draft,status:'failed',error:'Tolkningen avbröts när servern startade om. Ladda upp på nytt.'};this.commit({...d});}
  }
  summary(){return {sessionId:this.sessionId,revision:this.data.revision,source:this.data.source,aiConfigured:this.reader.configured,provider:this.reader.provider,error:this.error,active:this.data.active,draft:this.data.draft?{id:this.data.draft.id,status:this.data.draft.status,error:this.data.draft.error,rowCount:this.data.draft.rows.length}:null};}
  view(){return {...this.summary(),draft:this.data.draft,limits:IMPORT_LIMITS};}
  check(data){if(data.sessionId!==this.sessionId||data.revision!==this.data.revision)fail('Tidtabellen har ändrats. Läs in senaste versionen innan du sparar.',409);}
  commit(next){next.revision=this.data.revision+1;try{this.storage.save('timetable-import.json',next);}catch{fail('Tidtabellen kunde inte sparas. Tidigare sparade uppgifter är kvar.',507);}this.data=next;this.error='';this.emit('change');return this.view();}
  directory(id){return path.join(this.storage.directory,'timetable-imports',id);}
  manual(data){
    this.check(data);if(this.data.draft)fail('Slutför eller kasta det befintliga utkastet först.',409);
    const title=data.title===undefined?'Egen tidtabell':data.title;
    if(!text(title)||!title.trim())fail('Ange ett namn för tidtabellen.');
    return this.commit({...this.data,draft:{id:randomUUID(),kind:'manual',title:title.trim(),createdAt:this.now(),status:'review',error:'',rows:[blankRow()],warnings:[],coverage:[],files:[]}});
  }
  edit(data){
    this.check(data);if(this.data.draft)fail('Slutför eller kasta det befintliga utkastet först.',409);
    if(!this.data.active)fail('Det finns ingen sparad tidtabell att redigera.',409);
    return this.commit({...this.data,draft:{...structuredClone(this.data.active),status:'review',error:'',warnings:[],coverage:[]}});
  }
  append(data){
    this.check(data);const d=this.data.draft;
    if(d?.status!=='review'||d.kind!=='manual')fail('Skapa eller öppna en manuell tidtabell först.',409);
    if(d.rows.length>=IMPORT_LIMITS.rows)fail('Tidtabellen får innehålla högst 300 rader.');
    const previous=d.rows.at(-1);
    return this.commit({...this.data,draft:{...d,rows:[...d.rows,blankRow(previous?.station,previous?.day)]}});
  }
  async table(data){
    this.check(data);if(this.data.draft)fail('Slutför eller kasta det befintliga utkastet före en ny import.',409);
    const file=tableUpload(data.file),rows=await readTable(file);
    // Another client may have edited the timetable while the worker was reading.
    this.check(data);if(this.data.draft)fail('Ett annat utkast har skapats. Läs in senaste versionen.',409);
    const id=randomUUID(),directory=this.directory(id),{bytes,kind,...metadata}=file;
    const draft={id,kind,title:file.name.replace(/\.(xlsx|csv)$/i,''),createdAt:this.now(),status:'review',error:'',rows:rows.map(r=>({...r,id:randomUUID()})),warnings:reviewWarnings(rows),coverage:[],files:[metadata]};
    try{fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(path.join(directory,file.id),bytes,{mode:0o600,flag:'wx'});return this.commit({...this.data,draft});}
    catch(e){fs.rmSync(directory,{recursive:true,force:true});throw e.status?e:Object.assign(Error('Underlaget kunde inte sparas.'),{status:507});}
  }
  begin(data){
    this.check(data);if(this.data.draft)fail('Slutför eller kasta det befintliga utkastet före en ny import.',409);
    if(!this.reader.configured)fail('AI-tolkning är inte ansluten. Lägg till serverns API-nyckel först.',503);
    if(!text(data.stationHint,160))fail('Ange stationens namn, högst 160 tecken.');
    const files=validateUploads(data.files),id=randomUUID(),directory=this.directory(id);
    const draft={id,kind:'ai',title:'Ny tidtabell',stationHint:data.stationHint,createdAt:this.now(),status:'reading',error:'',rows:[],warnings:[],coverage:[],files:files.map(({bytes,...f})=>f)};
    try{fs.mkdirSync(directory,{recursive:true,mode:0o700});for(const f of files)fs.writeFileSync(path.join(directory,f.id),f.bytes,{mode:0o600,flag:'wx'});this.commit({...this.data,draft});}
    catch(e){fs.rmSync(directory,{recursive:true,force:true});throw e.status?e:Object.assign(Error('Underlagen kunde inte sparas.'),{status:507});}
    this.task=Promise.resolve().then(()=>this.finish(id,files,data.stationHint));return this.view();
  }
  async finish(id,files,stationHint){
    try{
      const result=validateExtraction(await this.reader.read(files,stationHint),files);
      if(this.data.draft?.id!==id)return;
      this.commit({...this.data,draft:{...this.data.draft,...result,title:result.title||'Importerad tidtabell',status:'review',error:''}});
    }catch(e){
      if(this.data.draft?.id!==id)return;
      const error=e.status?e.message:'AI-tolkningen misslyckades. Prova tydligare eller färre underlag.';
      try{this.commit({...this.data,draft:{...this.data.draft,status:'failed',error}});}catch{this.error='AI-jobbet är avslutat men resultatet kunde inte sparas. Kontrollera lagringen.';this.emit('change');}
    }finally{this.task=null;}
  }
  save(data){
    this.check(data);const draft=this.data.draft;
    if(!draft||draft.status!=='review')fail('Det finns inget färdigt utkast att redigera.',409);
    if(!text(data.title)||!data.title.trim()||!Array.isArray(data.rows)||data.rows.length!==draft.rows.length)fail('Utkastets titel eller rader är ogiltiga.');
    const ids=new Set();const rows=data.rows.map(row=>{const original=draft.rows.find(r=>r.id===row.id);if(!original||ids.has(row.id)||typeof row.included!=='boolean')fail('Utkastets radidentiteter stämmer inte.');ids.add(row.id);return {...original,...rowValues(row),included:row.included};});
    return this.commit({...this.data,draft:{...draft,title:data.title.trim(),rows,...(['csv','xlsx'].includes(draft.kind)?{warnings:reviewWarnings(rows)}:{})}});
  }
  sheet(data){
    this.check(data);const draft=this.data.draft;
    if(!draft||draft.status!=='review')fail('Det finns inget färdigt utkast att redigera.',409);
    if(!text(data.title)||!data.title.trim()||!Array.isArray(data.rows)||data.rows.length<draft.rows.length||data.rows.length>IMPORT_LIMITS.rows)fail('Tidtabellens namn eller antal rader är ogiltigt. Högst 300 rader.');
    const originals=new Map(draft.rows.map(r=>[r.id,r])),seen=new Set();
    const rows=data.rows.map(row=>{
      if(!object(row)||typeof row.included!=='boolean')fail('En tidtabellsrad har ogiltiga uppgifter.');
      const values=rowValues(row);
      if(row.id===null)return {...blankRow(),...values,included:row.included};
      const original=originals.get(row.id);if(!original||seen.has(row.id))fail('Tidtabellens radidentiteter stämmer inte.');seen.add(row.id);
      return {...original,...values,included:row.included};
    });
    if(seen.size!==originals.size)fail('Befintliga rader får inte försvinna. Uteslut dem med Ta med: Nej.');
    return this.commit({...this.data,draft:{...draft,title:data.title.trim(),rows,warnings:reviewWarnings(rows)}});
  }
  activate(data){
    this.check(data);const d=this.data.draft;
    if(!d||d.status!=='review'||data.reviewed!==true)fail('Granska och spara utkastet innan det används.',409);
    const rows=d.rows.filter(r=>r.included);if(!rows.length)fail('Välj minst en tågrörelse.');const warnings=reviewWarnings(rows);if(warnings.length)fail(warnings.join(' '));
    const result=this.commit({...this.data,source:'import',active:{id:d.id,kind:d.kind||'ai',title:d.title,files:d.files,rows,activatedAt:this.now()},draft:null});
    // Previous source files remain on disk for backup; only the active/draft files are served.
    return result;
  }
  discard(data){this.check(data);if(this.task)fail('Vänta tills tolkningen är avslutad.',409);return this.commit({...this.data,draft:null});}
  select(data){this.check(data);if(!['trainmeet','import'].includes(data.source)||data.source==='import'&&!this.data.active)fail('Välj en tillgänglig tidtabell.');return this.commit({...this.data,source:data.source});}
  sourceFile(importId,fileId){
    const item=[this.data.draft,this.data.active].find(d=>d?.id===importId),f=item?.files.find(f=>f.id===fileId);
    if(!f||!uuid(importId)||!/^\d+$/.test(fileId))fail('Underlaget finns inte.',404);
    return {...f,path:path.join(this.directory(importId),fileId)};
  }
}
