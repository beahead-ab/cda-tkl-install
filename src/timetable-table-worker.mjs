import {parentPort,workerData} from 'node:worker_threads';
import {readSheet} from 'read-excel-file/node';
import {SaxesParser} from 'saxes';
import path from 'node:path';
import yauzl from 'yauzl';
import {parse} from 'csv-parse/sync';
import {TIMETABLE_COLUMNS,TABLE_ROWS,TABLE_FILE_BYTES} from '../public/timetable-format.js';
const fail=message=>{throw Error(message);};
const MAX_EXPANDED=12*1024*1024;

// Validate both claimed and actual expanded sizes before reading workbook XML.
function checkZip(bytes){
  return new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
    if(error)return reject(Error('Excel-filen är skadad eller har fel format.'));
    let total=0,count=0,stopped=false;const names=new Set(),files=new Map();
    const stop=message=>{if(stopped)return;stopped=true;zip.close();reject(Error(message));};
    zip.on('error',()=>stop('Excel-filen är skadad.'));
    zip.on('end',()=>{if(!stopped)names.has('xl/workbook.xml')?resolve(files):stop('Filen är inte en Excel-arbetsbok.');});
    zip.on('entry',entry=>{
      if(++count>128||entry.uncompressedSize>MAX_EXPANDED||total+entry.uncompressedSize>MAX_EXPANDED)return stop('Excel-filen är för stor när den packas upp. Använd mallen.');
      if(names.has(entry.fileName)||entry.generalPurposeBitFlag&1||/vbaProject|externalLinks|embeddings/i.test(entry.fileName))return stop('Använd en vanlig .xlsx utan makron, externa länkar eller inbäddade filer.');
      names.add(entry.fileName);
      zip.openReadStream(entry,(err,stream)=>{
        if(err)return stop('Excel-filen kunde inte packas upp.');
        const chunks=[];
        stream.on('data',chunk=>{total+=chunk.length;if(total>MAX_EXPANDED){stream.destroy();stop('Excel-filen är för stor när den packas upp.');}else chunks.push(chunk);});
        stream.on('error',()=>stop('Excel-filen är skadad eller har fel storleksuppgifter.'));
        stream.on('end',()=>{if(!stopped){files.set(entry.fileName,Buffer.concat(chunks));zip.readEntry();}});
      });
    });
    zip.readEntry();
  }));
}
function headers(cells){
  const expected=TIMETABLE_COLUMNS.map(([label])=>label);
  if(cells.length!==expected.length||cells.some((v,i)=>v!==expected[i]))fail('Rubrikraden ska vara exakt: '+expected.join(';')+'. Använd mallen och behåll kolumnernas ordning.');
}
function valuesToRow(values,sourceRow,sheet){
  const at=label=>`Rad ${sourceRow}, ${label}: `;
  if(values.length!==TIMETABLE_COLUMNS.length)fail(`Rad ${sourceRow}: ska ha exakt ${TIMETABLE_COLUMNS.length} kolumner.`);
  const row={};
  TIMETABLE_COLUMNS.forEach(([label,key],index)=>{
    const v=values[index].trim();
    if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)||v.length>(key==='note'?2000:160))fail(at(label)+'ogiltig text eller för många tecken.');
    if(v.startsWith('='))fail(at(label)+'använd ett värde, inte en formel.');
    if(key==='noStop'){if(v!=='Ja'&&v!=='Nej')fail(at(label)+'skriv Ja eller Nej.');row[key]=v==='Ja';}
    else if((key==='arrival'||key==='departure')&&v){if(!/^\d{1,2}:[0-5]\d$/.test(v))fail(at(label)+'skriv HH:MM, till exempel 09:05 eller 25:10.');row[key]=v.padStart(5,'0');}
    else row[key]=v;
  });
  for(const [label,key] of TIMETABLE_COLUMNS.slice(0,3))if(!row[key])fail(at(label)+'måste fyllas i.');
  if(!row.arrival&&!row.departure)fail(`Rad ${sourceRow}: fyll i minst ankomst eller avgång.`);
  return {...row,included:true,sources:[{file:1,row:sourceRow,...(sheet?{sheet}:{})}],uncertainties:[]};
}
function csvRows(bytes){
  let input;try{input=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('CSV-filen ska vara sparad som CSV UTF-8.');}
  const first=input.split(/\r?\n/,1)[0],delimiter=first.includes(';')?';':',';
  let records;try{records=parse(input,{bom:true,delimiter,info:true,max_record_size:8192,relax_column_count:true});}catch(e){fail(`CSV-filen har felaktiga citattecken eller en för lång rad${e.lines?' vid rad '+e.lines:''}.`);}
  if(!records.length)fail('CSV-filen är tom.');
  headers(records[0].record);let previousLine=records[0].info.lines;const rows=[];
  for(const {record,info} of records.slice(1)){
    const rowNumber=previousLine+1;previousLine=info.lines;
    if(record.every(v=>!v.trim()))continue;
    rows.push(valuesToRow(record,rowNumber));if(rows.length>TABLE_ROWS)fail('Tidtabellen får innehålla högst 300 tågrörelser.');
  }
  return rows;
}
function excelValue(v,key,n,index,metadata){
  const at=`Rad ${n}, ${TIMETABLE_COLUMNS[index][0]}: `,address=String.fromCharCode(65+index)+n;
  if(v===null||v===undefined)return '';
  if(typeof v==='string')return v;
  if(key==='arrival'||key==='departure'){
    const raw=metadata.numbers.get(address)?.value;
    if(raw!==undefined)return excelTime(Number(raw),at);
  }
  if(v instanceof Date){
    if(key==='day')return v.toISOString().slice(0,10);
    fail(at+'använd text i den här kolumnen.');
  }
  if(typeof v==='number'){
    if(!Number.isSafeInteger(v)||v<0)fail(at+'använd text för beteckningar.');
    const formatId=metadata.styles[metadata.numbers.get(address)?.style||0]||0,format=metadata.formats.get(formatId)||'unsupported';
    if(/^0{2,20}$/.test(format))return String(v).padStart(format.length,'0');
    if(!['General','0','@'].includes(format))fail(at+'använd text så att beteckningens exakta format bevaras.');
    return String(v);
  }
  fail(at+'använd vanliga textvärden.');
}
function excelTime(v,at){
  const minutes=v*1440,rounded=Math.round(minutes);
  if(!Number.isFinite(v)||v<0||rounded>=6000||Math.abs(minutes-rounded)>0.00001)fail(at+'ange en tid med hela minuter, 00:00–99:59.');
  return String(Math.floor(rounded/60)).padStart(2,'0')+':'+String(rounded%60).padStart(2,'0');
}
function xml(bytes,open,close=()=>{},text=()=>{}){
  if(!bytes)fail('Excel-filen saknar nödvändiga delar.');
  const parser=new SaxesParser({xmlns:true});
  parser.on('doctype',()=>fail('Excel-filen innehåller en otillåten XML-deklaration.'));
  parser.on('error',()=>fail('Excel-filen innehåller skadad XML.'));
  parser.on('opentag',node=>open(node.local,Object.fromEntries(Object.values(node.attributes).map(a=>[a.local,a.value]))));
  parser.on('closetag',node=>close(node.local));parser.on('text',text);
  parser.write(bytes.toString('utf8')).close();
}
function workbookMetadata(files){
  const sheets=[],relationships=new Map(),metadata={numbers:new Map(),hiddenRows:new Set(),formats:new Map([[0,'General'],[1,'0'],[49,'@']]),styles:[]};
  xml(files.get('xl/workbook.xml'),(tag,a)=>{if(tag==='sheet')sheets.push(a);});
  const sheet=sheets.find(s=>s.name==='Tidtabell');
  if(!sheet||sheets.filter(s=>s.name==='Tidtabell').length!==1)fail('Excel-filen ska ha ett blad som heter Tidtabell. Använd mallen.');
  if(sheets.some(s=>!['Tidtabell','Läs mig'].includes(s.name)))fail('Samla alla tågrörelser på bladet Tidtabell. Andra blad än Tidtabell och Läs mig stöds inte.');
  if(sheet.state&&sheet.state!=='visible')fail('Bladet Tidtabell måste vara synligt.');
  xml(files.get('xl/_rels/workbook.xml.rels'),(tag,a)=>{if(tag==='Relationship'){if(a.TargetMode==='External')fail('Externa arbetsbokslänkar stöds inte.');relationships.set(a.Id,a.Target);}});
  const target=relationships.get(sheet.id);if(!target)fail('Excel-filen saknar bladet Tidtabell.');
  const sheetPath=target.startsWith('/')?target.slice(1):path.posix.normalize('xl/'+target);
  let cell,insideValue=false;
  xml(files.get(sheetPath),(tag,a)=>{
    if(tag==='row'&&(a.hidden==='1'||a.hidden==='true'))metadata.hiddenRows.add(Number(a.r));
    if(tag==='mergeCell')fail('Bladet Tidtabell får inte ha sammanslagna celler.');
    if(tag==='c'){
      const match=/^([A-J])([1-9]\d{0,3})$/.exec(a.r||'');
      if(!match||Number(match[2])>2000)fail('Bladet Tidtabell får ha högst 10 kolumner och data inom de första 2 000 raderna.');
      if(a.t==='e')fail(`Cell ${a.r}: rätta Excel-felvärdet före import.`);
      cell={address:a.r,number:!a.t||a.t==='n',style:Number(a.s||0),value:''};
    }
    if(tag==='f')fail(`Cell ${cell?.address||''}: klistra in värdet i stället för formeln.`);
    if(tag==='v')insideValue=true;
  },tag=>{if(tag==='v')insideValue=false;if(tag==='c'){if(cell.number&&cell.value)metadata.numbers.set(cell.address,cell);cell=null;}},value=>{if(insideValue&&cell)cell.value+=value;});
  let cellStyles=false;
  if(files.has('xl/styles.xml'))xml(files.get('xl/styles.xml'),(tag,a)=>{if(tag==='numFmt')metadata.formats.set(Number(a.numFmtId),a.formatCode);if(tag==='cellXfs')cellStyles=true;if(tag==='xf'&&cellStyles)metadata.styles.push(Number(a.numFmtId||0));},tag=>{if(tag==='cellXfs')cellStyles=false;});
  return metadata;
}
async function xlsxRows(bytes){
  const metadata=workbookMetadata(await checkZip(bytes));let data;
  try{data=await readSheet(bytes,{sheet:'Tidtabell',trim:false});}catch{fail('Excel-filen kunde inte läsas. Spara en ny .xlsx från mallen.');}
  if(!data.length)fail('Excel-filen är tom.');
  headers(data[0]);const rows=[];
  for(let index=1;index<data.length;index++){
    const n=index+1,values=TIMETABLE_COLUMNS.map(([,key],i)=>excelValue(data[index][i],key,n,i,metadata));
    if(values.every(v=>!v.trim()))continue;
    if(metadata.hiddenRows.has(n))fail(`Rad ${n}: visa dolda tågrörelser innan du importerar.`);
    rows.push(valuesToRow(values,n,'Tidtabell'));if(rows.length>TABLE_ROWS)fail('Tidtabellen får innehålla högst 300 tågrörelser.');
  }
  return rows;
}
try{
  const bytes=Buffer.from(workerData.bytes);
  if(bytes.length>TABLE_FILE_BYTES)fail('Filen får vara högst 2 MB.');
  const rows=workerData.kind==='csv'?csvRows(bytes):await xlsxRows(bytes);
  if(!rows.length)fail('Filen innehåller inga tågrörelser. Fyll i minst en rad under rubrikerna.');
  parentPort.postMessage({rows});
}catch(e){parentPort.postMessage({error:e.message});}
