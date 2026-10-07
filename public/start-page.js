// Inställningar → Den här datorn → Kom igång: de steg en ny installation behöver, med status ur det som finns
// och en knapp till rätt sida. Ägare och kontakt med banan krävs; AI-tjänst och TrainMeet hoppas över
// uttryckligen om de inte ska användas. "Markera som klar" tar bort "N steg kvar" ur panelen.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const when=t=>t?new Date(t).toLocaleString('sv-SE',{dateStyle:'short',timeStyle:'short'}):'';
const CONNECTION={simulator:'simulatorn',hardware:'LocoBuffer',unspecified:'banan'};
export function createStartPage({root,api,message,session,onChange}){
  if(!root)return null;
  let view=null,last='',skipped=new Set();
  const pill=(mode,text)=>`<span class="settings-state" data-state="${mode}">${esc(text)}</span>`;
  const texts=s=>{
    const user=session?.()?.user;
    switch(s.id){
      case 'owner':return s.done?['Ägaren finns.'+(user?' Du är inloggad som '+user.username+'.':''),'']:s.how==='script'?['Webbdriften: ägaren skapas på servern som användaren charlottendal. Lösenordet läses från standard input.','']:['Ägaren är den som lägger till och tar bort användare; en administratör sköter hela TKL men inte vilka som har tillgång. Operatören behöver inte logga in på den här datorn.',''];
      case 'ai':return s.done?[`Ansluten med ${s.model}.`+(s.tested?' Provet gick igenom.':' Prova anslutningen under AI-tjänst så att fel syns där och inte först i Studio.'),'']:['Chatten och AI-genomgången i Studio använder Claude via en nyckel från Anthropic. Utan nyckel fungerar de inte; allt annat i TKL fungerar.','Hoppa över om AI-tjänsten inte ska användas på den här installationen.'];
      case 'connection':return s.done?[`Kontakt med ${CONNECTION[s.mode]||s.mode}.`,'']:[`Ingen kontakt med ${CONNECTION[s.mode]||'banan'}. Läget (simulator eller LocoBuffer) ställs i app.env vid installationen; status och porten syns under Banan (LocoNet).`,''];
      case 'trainmeet':return s.done?['TrainMeet är anslutet'+(s.origin?' till '+s.origin:'')+'.','']:['TrainMeet ger tåg till och från grannstationerna. Anslut med adress och parningskod under Träffen → TrainMeet.','Hoppa över om stationen körs fristående.'];
    }return ['',''];
  };
  const render=()=>{
    if(!view)return;
    const steps=view.steps.map((s,i)=>{
      const sk=!s.done&&(s.skipped||skipped.has(s.id));const [text,skipText]=texts(s);
      const state=s.done?pill('ok','Klart'):sk?pill('off','Överhoppat'):s.required?pill('warn','Krävs'):pill('warn','Att göra');
      const go=s.done?'':s.id==='owner'&&s.how==='script'?'':s.id==='owner'?`<a class="button primary" href="${esc(s.link)}">Skapa ägaren</a>`:`<a class="button" href="${esc(s.link)}">${s.id==='ai'?'Anslut AI-tjänsten':s.id==='trainmeet'?'Anslut TrainMeet':'Visa Banan (LocoNet)'}</a>`;
      const skip=!s.done&&!s.required?`<button type="button" data-skip="${s.id}" aria-pressed="${sk}">${sk?'Ångra':'Hoppa över'}</button>`:'';
      const command=s.id==='owner'&&!s.done&&s.how==='script'?`<div class="start-command"><code>printf '%s\\n' "$PASSWORD" | node scripts/create-owner.mjs &lt;namn&gt;</code></div>`:'';
      return `<article class="start-step" data-step="${s.id}" data-done="${s.done}" data-skipped="${sk}"><span class="start-number">${s.done?'✓':i+1}</span><div><h3>${esc(s.label)} ${state}</h3><p>${esc(text)}</p>${skipText?`<p>${esc(skipText)}</p>`:''}${command}</div><div class="start-actions">${go}${skip}</div></article>`;
    }).join('');
    const canFinish=view.steps.every(s=>s.done||(!s.required&&(s.skipped||skipped.has(s.id))));
    const foot=view.done?`<div class="settings-actions"><button type="button" data-reopen>Öppna Kom igång igen</button><p>Markerad som klar ${esc(when(view.finishedAt))}${view.finishedBy?' av '+esc(view.finishedBy):''}. Stegen ovan visar ändå alltid dagens läge.</p></div>`
      :`<div class="settings-actions"><button type="button" class="primary" data-finish${canFinish?'':' disabled'}>Markera Kom igång som klar</button><p>${canFinish?'Panelen slutar visa "steg kvar". Det som hoppats över går att göra senare under Inställningar.':'Gör de krävda stegen och hoppa uttryckligen över det som inte ska användas.'}</p></div>`;
    const html=`<section class="card"><h2>${view.done?'Klart':view.remaining+' steg kvar'}</h2><div class="start-steps">${steps}</div>${foot}
      <p class="settings-footnote">${view.mode==='external'?'Webbdriften: inloggning krävs överallt. ':'Den här datorn: operatören behöver inte logga in; Inställningar och Studio kräver ägaren eller en administratör. '}Nyckeln till AI-tjänsten lagras på TKL-servern och visas aldrig igen i sin helhet.</p></section>`;
    if(html!==last){last=html;root.innerHTML=html;}
  };
  root.addEventListener('click',async e=>{
    const skip=e.target.closest('[data-skip]');if(skip){const id=skip.dataset.skip;if(skipped.has(id))skipped.delete(id);else skipped.add(id);last='';render();return;}
    if(e.target.closest('[data-finish]')){const answer=await api('onboarding/finish',{skipped:[...skipped]});if(answer){view=answer;last='';render();message('Kom igång är klar.',{error:false});onChange?.(answer);}return;}
    if(e.target.closest('[data-reopen]')){const answer=await api('onboarding/reopen',{});if(answer){view=answer;last='';render();onChange?.(answer);}}
  });
  const page={
    async load(){try{const r=await fetch('/api/onboarding',{cache:'no-cache'});if(r.status===401||r.status===428){if(session?.()?.mode!=='cloudflare')location.assign('/login?next='+encodeURIComponent('/'+location.hash));return;}if(!r.ok)return;view=await r.json();skipped=new Set(view.skipped);last='';render();onChange?.(view);}catch{}},
    update(v){view=v;render();}
  };
  return page;
}
