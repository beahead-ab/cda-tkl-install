import {SHEET_COLUMNS as columns,blankSheetRow,cellText,cellError,parseClipboard,clipboardText,applyCells} from './timetable-sheet-model.js';
import {escapeHTML as esc} from './admin-ui.js';
export function createTimetableSheet({root,rows,onChange=()=>{},onSelect=()=>{}}){
  let data=structuredClone(rows),baseline=JSON.stringify(data),undo=[],redo=[],start=[0,0],end=[0,0],editing=null,dragging=false,disabled=false;
  root.innerHTML='<div class="sheet-toolbar"><span class="sheet-address" aria-live="polite">A1</span><button type="button" data-sheet="undo">Ångra</button><button type="button" data-sheet="redo">Gör om</button><button type="button" data-sheet="append">Lägg till rad</button><button type="button" data-sheet="exclude">Uteslut valda rader</button><span class="sheet-status" role="status"></span></div><p class="muted sheet-help">Dubbelklicka eller skriv i en markerad cell. Tab / Enter / piltangenter flyttar markeringen. Skift markerar ett område. Kopiera och klistra in direkt från Excel eller Google Sheets. Passerar och Ta med: Ja / Nej.</p><div class="sheet-scroll"><table role="grid" aria-label="Redigera tidtabell" class="timetable-sheet"></table></div><p class="sheet-error" role="alert"></p>';
  const table=root.querySelector('table'),status=root.querySelector('.sheet-status'),error=root.querySelector('.sheet-error'),button=action=>root.querySelector('[data-sheet="'+action+'"]');
  const bounds=()=>({r1:Math.min(start[0],end[0]),r2:Math.max(start[0],end[0]),c1:Math.min(start[1],end[1]),c2:Math.max(start[1],end[1])});
  const cell=(r,c)=>table.querySelector('[data-cell="'+r+':'+c+'"]');
  function changed(){status.textContent=(JSON.stringify(data)!==baseline?'Osparade ändringar · ':'Utkast sparat · ')+data.length+' rader';button('undo').disabled=disabled||!undo.length;button('redo').disabled=disabled||!redo.length;button('append').disabled=disabled||data.length>=300;button('exclude').disabled=disabled;onChange();}
  function draw(){
    table.setAttribute('aria-rowcount',data.length+1);table.setAttribute('aria-colcount',columns.length+1);
    table.innerHTML='<thead><tr><th aria-label="Rad"></th>'+columns.map(([key,label],i)=>'<th scope="col"><span>'+String.fromCharCode(65+i)+'</span>'+esc(label)+'</th>').join('')+'</tr></thead><tbody>'+data.map((row,r)=>'<tr class="'+(row.included===false?'sheet-excluded':'')+'"><th scope="row">'+(r+1)+'</th>'+columns.map(([key,label],c)=>{const issue=cellError(row,key);return '<td role="gridcell" data-cell="'+r+':'+c+'" tabindex="-1" aria-label="'+esc(label+', rad '+(r+1)+': '+cellText(row,key)+(issue?' · '+issue:''))+'"'+(issue?' aria-invalid="true" title="'+esc(issue)+'"':'')+'>'+esc(cellText(row,key))+'</td>';}).join('')+'</tr>').join('')+'</tbody>';mark(false);changed();
  }
  function mark(focus=true){
    const b=bounds();for(const td of table.querySelectorAll('[data-cell]')){const [r,c]=td.dataset.cell.split(':').map(Number);const active=r===end[0]&&c===end[1],selected=r>=b.r1&&r<=b.r2&&c>=b.c1&&c<=b.c2;td.classList.toggle('sheet-selected',selected);td.classList.toggle('sheet-current',active);td.tabIndex=active?0:-1;td.setAttribute('aria-selected',String(selected));}
    root.querySelector('.sheet-address').textContent=String.fromCharCode(65+end[1])+(end[0]+1);onSelect(data[end[0]],end[0]);if(focus)cell(...end)?.focus({preventScroll:true});
  }
  function commit(next){if(JSON.stringify(next)===JSON.stringify(data))return;undo.push(structuredClone(data));if(undo.length>50)undo.shift();redo=[];data=next;error.textContent='';draw();}
  function select(r,c,extend=false){if(disabled)return;end=[Math.max(0,Math.min(data.length-1,r)),Math.max(0,Math.min(columns.length-1,c))];if(!extend)start=[...end];mark();cell(...end)?.scrollIntoView({block:'nearest',inline:'nearest'});}
  function finish(save=true){if(!editing)return true;const {r,c,input,original}=editing;editing=null;if(save&&input.value!==original){try{commit(applyCells(data,r,c,[[input.value]]));}catch(e){error.textContent=e.message;editing={r,c,input,original};input.focus();return false;}}else draw();return true;}
  function edit(value){if(disabled||editing)return;const [r,c]=end,td=cell(r,c),original=cellText(data[r],columns[c][0]);const input=document.createElement(columns[c][0]==='note'?'textarea':'input');input.value=value??original;input.setAttribute('aria-label',columns[c][1]+', rad '+(r+1));td.replaceChildren(input);editing={r,c,input,original};input.addEventListener('input',()=>{status.textContent='Osparade ändringar · '+data.length+' rader';onChange();});input.addEventListener('blur',()=>finish());input.focus();if(value===undefined)input.select();}
  table.addEventListener('pointerdown',e=>{const td=e.target.closest('[data-cell]');if(!td||['INPUT','TEXTAREA'].includes(e.target.tagName)||e.button!==0||disabled)return;if(!finish())return;e.preventDefault();const [r,c]=td.dataset.cell.split(':').map(Number);select(r,c,e.shiftKey);dragging=true;});
  table.addEventListener('pointerover',e=>{const td=e.target.closest('[data-cell]');if(dragging&&td){const [r,c]=td.dataset.cell.split(':').map(Number);select(r,c,true);}});
  const stopDragging=()=>{dragging=false;};window.addEventListener('pointerup',stopDragging);
  table.addEventListener('dblclick',e=>{if(e.target.closest('[data-cell]'))edit();});
  table.addEventListener('keydown',e=>{
    if(disabled)return;const command=e.metaKey||e.ctrlKey;
    if(command&&['z','y'].includes(e.key.toLowerCase())&&!editing){e.preventDefault();travel(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo');return;}
    if(command&&e.key.toLowerCase()==='a'&&!editing){e.preventDefault();start=[0,0];end=[data.length-1,columns.length-1];mark();return;}
    if(editing){if(e.key==='Enter'&&e.altKey&&editing.input.tagName==='TEXTAREA'){e.preventDefault();const input=editing.input;input.setRangeText('\n',input.selectionStart,input.selectionEnd,'end');onChange();return;}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);mark();return;}if(!['Enter','Tab'].includes(e.key))return;if(!finish())return;}
    const [r,c]=end;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)){e.preventDefault();let nr=r,nc=c;if(e.key==='Tab'){nc+=e.shiftKey?-1:1;if(nc<0){nr--;nc=columns.length-1;}if(nc>=columns.length){nr++;nc=0;}}else if(e.key==='Enter')nr+=e.shiftKey?-1:1;else{nr+=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;nc+=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;}select(nr,nc,e.shiftKey&&e.key.startsWith('Arrow'));return;}
    if(e.key==='F2'){e.preventDefault();edit();return;}
    if(['Backspace','Delete'].includes(e.key)){e.preventDefault();const b=bounds();try{commit(applyCells(data,b.r1,b.c1,Array.from({length:b.r2-b.r1+1},()=>Array(b.c2-b.c1+1).fill(''))));mark();}catch(e){error.textContent=e.message;}return;}
    if(!command&&!e.altKey&&e.key.length===1){e.preventDefault();edit(e.key);}
  });
  table.addEventListener('paste',e=>{if(disabled)return;const text=e.clipboardData.getData('text/plain');if(editing&&!/[\t\n\r]/.test(text))return;e.preventDefault();if(!finish())return;try{let values=parseClipboard(text);if(values[0]?.slice(0,10).every((v,i)=>v===columns[i]?.[1])&&values[0].length>=10)values=values.slice(1);if(!values.length)return;const b=bounds();commit(applyCells(data,b.r1,b.c1,values));start=[b.r1,b.c1];end=[b.r1+values.length-1,b.c1+Math.max(...values.map(r=>r.length))-1];mark();}catch(e){error.textContent=e.message;}});
  table.addEventListener('copy',e=>{if(editing)return;const b=bounds();e.preventDefault();e.clipboardData.setData('text/plain',clipboardText(data.slice(b.r1,b.r2+1).map(r=>columns.slice(b.c1,b.c2+1).map(([key])=>cellText(r,key)))));});
  function travel(direction){if(disabled||!finish())return;const from=direction==='undo'?undo:redo,to=direction==='undo'?redo:undo;if(!from.length)return;to.push(structuredClone(data));data=from.pop();end=[Math.min(end[0],data.length-1),end[1]];start=[...end];draw();mark();}
  button('undo').onclick=()=>travel('undo');button('redo').onclick=()=>travel('redo');
  button('append').onclick=()=>{if(!finish()||data.length>=300)return;commit([...data,blankSheetRow(data.at(-1))]);select(data.length-1,0);};
  button('exclude').onclick=()=>{if(!finish())return;const b=bounds(),next=structuredClone(data);for(let r=b.r1;r<=b.r2;r++)next[r].included=false;commit(next);mark();};
  draw();
  return {rows(){return finish()?structuredClone(data):null;},dirty(){return JSON.stringify(data)!==baseline||!!editing&&editing.input.value!==editing.original;},setDisabled(value){if(disabled===value)return;disabled=value;table.setAttribute('aria-disabled',String(value));if(editing)editing.input.disabled=value;changed();},destroy(){window.removeEventListener('pointerup',stopDragging);},errors(){return data.flatMap((r,i)=>columns.flatMap(([k,label])=>cellError(r,k)?['Rad '+(i+1)+', '+label+': '+cellError(r,k)]:[]));}};
}
