import {createAdminDialog} from './admin-ui.js';
export function createAdminAppearance(){
  const $=id=>document.getElementById(id),original=document.querySelector('.appearance-controls');
  const overview=document.createElement('section');overview.className='card';overview.innerHTML='<div class="card-heading"><span class="admin-scope">Den här enheten</span><button id="appearance-edit" class="primary">Redigera</button></div><dl class="admin-summary" id="appearance-summary"></dl>';original.before(overview);original.hidden=true;
  const form=document.createElement('form');form.id='appearance-form';form.innerHTML='<label>Övergångslampor<select id="pref-crossing"><option value="calm">Lugn blinkning</option><option value="steady">Fast rött sken</option></select></label><label>Ljud vid fel<select id="pref-sound"><option value="no">Av</option><option value="yes">På</option></select></label><button type="submit">Spara</button>';
  const values=()=>JSON.stringify(['crossing','sound'].map(k=>$('pref-'+k).value));let baseline;
  const modal=createAdminDialog({title:'Utseende och ljud',body:form,saveButton:form.querySelector('button[type=submit]'),dirty:()=>values()!==baseline});
  function render(){const values=[['Panelutseende','Original'],['Övergångslampor',$('crossing-display').selectedOptions[0].textContent],['Ljud vid fel',$('sound-toggle').getAttribute('aria-pressed')==='true'?'På':'Av']];$('appearance-summary').replaceChildren(...values.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return [dt,dd];}));}
  $('appearance-edit').onclick=()=>{$('pref-crossing').value=$('crossing-display').value;$('pref-sound').value=$('sound-toggle').getAttribute('aria-pressed')==='true'?'yes':'no';baseline=values();modal.open();};
  form.onsubmit=e=>{e.preventDefault();try{$('crossing-display').value=$('pref-crossing').value;$('crossing-display').dispatchEvent(new Event('change'));if(($('sound-toggle').getAttribute('aria-pressed')==='true')!==($('pref-sound').value==='yes'))$('sound-toggle').click();modal.close(true);render();}catch(e){modal.message(e.message);}};render();
}
