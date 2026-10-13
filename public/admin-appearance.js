import {createAdminDialog,settingsRows,settingsNote} from './admin-ui.js';
import {STYLES,STYLE_KEY,legendHTML,previewHTML,readStyle,saveStyle,styleTitle} from './timetable-style.js';
export function createAdminAppearance(){
  const $=id=>document.getElementById(id),original=document.querySelector('.appearance-controls');
  $('appearance-heading').after(settingsNote('settings-scope','Gäller den här webbläsaren · sparas inte i TKL-servern'));
  const overview=document.createElement('section');overview.className='card';overview.innerHTML='<div class="card-heading"><h3>Panelen här</h3><button id="appearance-edit" class="primary">Redigera</button></div><dl id="appearance-summary"></dl>';original.before(overview);original.hidden=true;
  overview.after(settingsNote('settings-footnote','Andra skärmar mot samma TKL behåller sina egna val. Lägen, lås och order är desamma på alla skärmar; här ändras bara hur de visas och hörs.'));
  const form=document.createElement('form');form.id='appearance-form';form.innerHTML='<label>Övergångslampor<select id="pref-crossing"><option value="calm">Lugn blinkning</option><option value="steady">Fast rött sken</option></select></label><label>Ljud vid fel<select id="pref-sound"><option value="no">Av</option><option value="yes">På</option></select></label>'+
    // Tidtabellens stil (0.80.0): the same trains in each style, to compare before choosing.
    '<fieldset class="tt-style-choice"><legend>Tidtabellens stil</legend>'+STYLES.map(s=>'<label class="tt-style-option"><input type="radio" name="tt-style" value="'+s.id+'"><span><b>'+s.title+'</b><small>'+s.detail+'</small></span>'+previewHTML(s.id)+'</label>').join('')+
    '<p class="muted">Spåret står i Spår-kolumnen, med ram när tåget står inne. Tecknen förklaras under Teckenförklaring.</p></fieldset><button type="submit">Spara</button>';
  const chosenStyle=()=>form.querySelector('input[name=tt-style]:checked')?.value||readStyle();
  const values=()=>JSON.stringify([...['crossing','sound'].map(k=>$('pref-'+k).value),chosenStyle()]);let baseline;
  const modal=createAdminDialog({title:'Utseende och ljud',body:form,saveButton:form.querySelector('button[type=submit]'),dirty:()=>values()!==baseline,unchanged:'Inget ändrat'});
  const sound=()=>$('sound-toggle').getAttribute('aria-pressed')==='true';
  function render(){settingsRows($('appearance-summary'),[
    ['Övergångslampor',$('crossing-display').selectedOptions[0].textContent,'Hur plankorsningarnas lampor visas på panelen. Korsningens läge påverkas inte.'],
    ['Ljud vid fel',sound()?'På':'Av','Ett kort pip när ett felmeddelande visas, till exempel en nekad order. Meddelandet visas alltid, med eller utan ljud.'],
    ['Tidtabellens stil',styleTitle(readStyle()),'Hur tåglistan visar läget och vägen: i ord, med tecken eller som en linjebild. Tidtabellen är densamma; tecknen förklaras under Teckenförklaring.']]);
    const legend=$('timetable-legend');if(legend)legend.innerHTML=legendHTML(readStyle());}
  window.addEventListener('storage',e=>{if(e.key===STYLE_KEY)render();});
  $('appearance-edit').onclick=()=>{$('pref-crossing').value=$('crossing-display').value;$('pref-sound').value=sound()?'yes':'no';const style=readStyle();for(const r of form.querySelectorAll('input[name=tt-style]'))r.checked=r.value===style;baseline=values();modal.open();};
  form.onsubmit=e=>{e.preventDefault();try{$('crossing-display').value=$('pref-crossing').value;$('crossing-display').dispatchEvent(new Event('change'));if(sound()!==($('pref-sound').value==='yes'))$('sound-toggle').click();const style=saveStyle(chosenStyle());window.dispatchEvent(new CustomEvent('timetable-style',{detail:style}));modal.close(true);render();}catch(e){modal.message(e.message);}};render();
}
