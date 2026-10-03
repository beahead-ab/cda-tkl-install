import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {TABLE_FILE_BYTES} from '../public/timetable-format.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function tableUpload(file){
  if(!file||typeof file.name!=='string'||!file.name.trim()||file.name.length>200||/[\x00-\x1f]/.test(file.name))fail('Välj en Excel- eller CSV-fil.');
  const kind=path.extname(file.name).slice(1).toLowerCase();
  if(!['xlsx','csv'].includes(kind))fail('Använd .xlsx eller .csv. Spara äldre Excel-filer som .xlsx först.');
  if(typeof file.data!=='string'||file.data.length>Math.ceil(TABLE_FILE_BYTES/3)*4)fail('Filen får vara högst 2 MB.',413);
  if(!file.data.length||file.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.data))fail('Filen kunde inte läsas.');
  const bytes=Buffer.from(file.data,'base64');
  if(bytes.toString('base64')!==file.data)fail('Filen kunde inte läsas.');
  if(bytes.length>TABLE_FILE_BYTES)fail('Filen får vara högst 2 MB.',413);
  return {id:'1',kind,name:path.basename(file.name),mime:kind==='csv'?'text/csv; charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',size:bytes.length,hash:createHash('sha256').update(bytes).digest('hex'),bytes};
}
// The railway event loop stays responsive even for a malformed workbook.
export function readTable(file){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./timetable-table-worker.mjs',import.meta.url),{workerData:{kind:file.kind,bytes:file.bytes},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16}});
    let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Object.assign(Error('Filen tog för lång tid att läsa. Använd mallen och högst 300 tågrörelser.'),{status:400})),10000);
    worker.once('message',result=>finish(result.error?Object.assign(Error(result.error),{status:400}):null,result.rows));
    worker.once('error',()=>finish(Object.assign(Error('Filen kunde inte läsas. Kontrollera formatet och använd mallen.'),{status:400})));
    worker.once('exit',()=>{if(!done)finish(Object.assign(Error('Inläsningen avbröts. Försök med en mindre fil.'),{status:400}));});
  });
}
