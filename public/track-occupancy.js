// Draws the occupancy model into the right column's second tab. Presentation only;
// the bars are buttons that carry the timetable row index, so the timetable's own
// details dialog answers a click. Nothing is sent anywhere.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createTrackOccupancy({host,range}){
  if(!host)return null;
  let last='';
  return {update(model){
    if(range)range.textContent=model?.label||'';
    let html;
    if(!model||model.empty)html='<p class="occ-empty">'+(model?.label?'Inga tåg på något spår '+esc(model.label.split(' · ')[0])+'.':'Ingen tidtabell att visa.')+'</p>';
    else{
      const ticks=model.ticks.map(t=>'<i class="occ-tick" style="left:'+t.left+'"></i>').join('')+(model.now?'<i class="occ-nowline" style="left:'+model.now+'"></i>':'');
      html='<div class="occ-axis">'+model.ticks.map(t=>'<span style="left:'+t.left+'">'+esc(t.label)+'</span>').join('')+'</div>'+
        '<div class="occ-scroll"><div class="occ-rows"><div class="occ-names">'+model.tracks.map(t=>'<div class="occ-name" title="'+esc(t.name)+'">'+esc(t.name)+'</div>').join('')+'</div>'+
        '<div class="occ-lanes"><div class="occ-ticks" aria-hidden="true">'+ticks+'</div>'+
        model.tracks.map(t=>'<div class="occ-lane">'+t.bars.map(b=>'<button type="button" class="occ-bar occ-'+b.group+(b.open?' occ-open':'')+'" style="left:'+b.left+';width:'+b.width+'" data-timetable-row="'+b.i+'" title="'+esc(b.title)+'" aria-haspopup="dialog" aria-label="Visa tidtabellsuppgifter för tåg '+esc(b.number)+'">'+esc(b.number)+'</button>').join('')+'</div>').join('')+
        '</div></div></div>';
    }
    if(html===last)return;last=html;
    const top=host.querySelector('.occ-scroll')?.scrollTop||0;
    host.innerHTML=html;
    const scroll=host.querySelector('.occ-scroll');if(scroll&&top)scroll.scrollTop=top;
  }};
}
