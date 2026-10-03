export const SHEET_COLUMNS=[['trainNumber','Tågnummer'],['station','Station'],['day','Trafikdag'],['arrival','Ankomst'],['departure','Avgång'],['track','Spår'],['from','Från'],['to','Till'],['noStop','Passerar'],['note','Anmärkning'],['included','Ta med']];
export function blankSheetRow(previous={}){return {id:null,...Object.fromEntries(SHEET_COLUMNS.map(([k])=>[k,''])),station:previous.station||'Charlottendal',day:previous.day||'',noStop:false,included:true,sources:[],uncertainties:[]};}
export function cellText(row,key){return ['noStop','included'].includes(key)?(row[key]?'Ja':'Nej'):row[key]||'';}
export function cellError(row,key){
  if(row.included===false)return '';
  if(['trainNumber','station','day'].includes(key)&&!row[key]?.trim())return 'Uppgiften behövs.';
  if(['arrival','departure'].includes(key)){
    if(!row.arrival&&!row.departure)return 'Ange ankomst eller avgång.';
    if(row[key]&&!/^\d{2}:[0-5]\d$/.test(row[key]))return 'Ange HH:MM, exempelvis 09:15 eller 25:10.';
  }
  return '';
}
export function parseClipboard(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}else if(!quoted&&(c==='\t'||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!=='\t'){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}else cell+=c;}
  if(quoted)throw Error('Det inklistrade området har ett oavslutat citattecken.');
  if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function clipboardText(rows){return rows.map(row=>row.map(v=>/["\t\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join('\t')).join('\n');}
export function applyCells(rows,startRow,startColumn,values){
  if(startRow+values.length>300||values.some(r=>startColumn+r.length>SHEET_COLUMNS.length))throw Error('Området ryms inte. Högst 300 rader och 11 kolumner.');
  const next=structuredClone(rows);
  for(let r=0;r<values.length;r++){
    while(next.length<=startRow+r)next.push(blankSheetRow(next.at(-1)));
    for(let c=0;c<values[r].length;c++){
      const key=SHEET_COLUMNS[startColumn+c][0],v=String(values[r][c]).trim();
      if(['included','noStop'].includes(key)){if(!['','ja','nej','true','false','1','0'].includes(v.toLowerCase()))throw Error(SHEET_COLUMNS[startColumn+c][1]+': ange Ja eller Nej.');next[startRow+r][key]=['ja','true','1'].includes(v.toLowerCase());}
      else {if(v.length>(key==='note'?2000:160)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Cellinnehållet är för långt eller innehåller ogiltiga tecken.');next[startRow+r][key]=v;}
    }
  }
  return next;
}
