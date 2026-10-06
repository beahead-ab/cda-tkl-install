// Inställningar → Den här datorn → AI-tjänst: vilken Claude-modell chatten och AI-genomgången i
// Objekt och regler använder, och nyckeln hos Anthropic. Nyckeln går till TKL-servern en gång och
// sparas där (ai.json, bara servern läser den); sidan ser sedan bara de fyra sista tecknen.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>t?new Date(t).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'}):'';
export function createAiPage({root,api,message}){
  if(!root)return null;
  let view=null,last='',busy=false;
  const rows=list=>`<dl class="settings-rows">${list.map(([label,value,note])=>`<div><dt>${esc(label)}</dt><dd>${value}</dd><dd class="settings-consequence">${esc(note)}</dd></div>`).join('')}</dl>`;
  const pill=(mode,text)=>`<span class="settings-state" data-state="${mode}">${esc(text)}</span>`;
  const render=()=>{
    if(!view)return;
    const model=view.models.find(m=>m.id===view.model)||{label:view.model,note:''};
    const state=!view.configured?[pill('off','Inte ansluten'),'Chatten och AI-genomgången i Objekt och regler fungerar inte förrän en nyckel finns.']
      :view.lastTest?.ok?[pill('ok','Ansluten'),`Provet gick igenom ${when(view.lastTest.at)} med ${view.lastTest.model||view.model}.`]
      :view.lastTest?[pill('warn','Provet misslyckades'),`${when(view.lastTest.at)}: ${view.lastTest.error||'okänt fel'}`]
      :[pill('warn','Nyckel finns, inte provad'),'Prova anslutningen så att fel i nyckeln eller nätvägen syns här och inte först i Objekt och regler.'];
    const keyRow=view.configured?[['Nyckel',esc(view.keyHint),view.source==='env'?'Ur miljöfilen app.env på servern. En nyckel som sparas här går före den.':'Sparad på TKL-servern '+when(view.updatedAt)+'. Visas aldrig igen i sin helhet.']]:[['Nyckel','saknas','Skapas i Anthropic Console under API keys och klistras in nedan.']];
    const html=`<section class="card"><h2>Anslutningen</h2>${rows([['Status',state[0],state[1]],['Modell',esc(model.label),model.note],...keyRow])}
      <div class="settings-actions"><button type="button" data-ai-test${view.configured&&!busy?'':' disabled'}>${busy?'Provar …':'Prova anslutningen'}</button><p>Ett litet riktigt anrop till AI-tjänsten med den sparade nyckeln och modellen. Kostar en bråkdel av ett öre.</p></div></section>
      <section class="card"><h2>Modell och nyckel</h2><form data-ai-form class="ai-form">
        <label>Modell <select name="model">${view.models.map(m=>`<option value="${esc(m.id)}"${m.id===view.model?' selected':''}>${esc(m.label)}</option>`).join('')}</select></label>
        <p class="settings-consequence" data-ai-model-note>${esc(model.note)}</p>
        <label>${view.configured?'Ny nyckel (lämna tom för att behålla den sparade)':'Nyckel från Anthropic'} <input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
        <div class="settings-actions"><button type="submit" class="primary">Spara</button><p>Nyckeln skickas till TKL-servern på den här datorn och sparas där. Modellbytet gäller nästa anrop; ingen omstart behövs.</p></div>
      </form>${view.source==='app'?`<div class="settings-actions"><button type="button" data-ai-clear>Ta bort nyckeln</button><p>Chatten och AI-genomgången slutar fungera tills en ny nyckel sparas.</p></div>`:''}
      <p class="settings-footnote">Det som går till AI-tjänsten är beskrivningen i chatten, objektnamnen och underlaget för genomgången, aldrig nyckeln och aldrig något från webbläsaren direkt. Modellerna i listan är de som fungerar med lösningen: de svarar enligt schema och tänker adaptivt.</p></section>`;
    if(html!==last){last=html;root.innerHTML=html;}
  };
  root.addEventListener('change',e=>{const select=e.target.closest('select[name=model]');if(!select||!view)return;const m=view.models.find(x=>x.id===select.value);const note=root.querySelector('[data-ai-model-note]');if(note&&m)note.textContent=m.note;});
  root.addEventListener('submit',async e=>{
    const form=e.target.closest('[data-ai-form]');if(!form)return;e.preventDefault();
    const key=form.elements.key.value.trim(),model=form.elements.model.value;
    const answer=await api('ai/save',key?{model,key}:{model});
    if(answer){view=answer;last='';render();message('AI-tjänsten sparad.'+(key?' Prova anslutningen.':''),{error:false});}
  });
  root.addEventListener('click',async e=>{
    if(e.target.closest('[data-ai-test]')){busy=true;render();try{const answer=await api('ai/test',{});if(answer){view=answer;message('AI-tjänsten svarade'+(answer.probe?.greeting?': '+answer.probe.greeting:'.'),{error:false,duration:6000});}else{await page.load();}}finally{busy=false;last='';render();}return;}
    if(e.target.closest('[data-ai-clear]')){if(!confirm('Ta bort nyckeln från TKL-servern? Chatten och AI-genomgången slutar fungera tills en ny sparas.'))return;const answer=await api('ai/clear',{});if(answer){view=answer;last='';render();}}
  });
  const page={
    async load(){try{const r=await fetch('/api/ai',{cache:'no-cache'});if(!r.ok)return;view=await r.json();render();}catch{}},
    update(v){view=v;render();}
  };
  return page;
}
