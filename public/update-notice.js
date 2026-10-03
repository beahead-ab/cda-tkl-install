// "Uppdatering X" in the status bar when the public install repository has a newer
// release than this installed copy. On a Raspberry Pi the dialog starts the update; on a
// Mac or PC it shows the line to run. The page itself sends nothing until asked.
import {confirmAdmin,createAdminDialog} from './admin-ui.js';
const LINES={
  mac:{where:'Terminal',line:'curl -fsSL https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.sh | sh'},
  windows:{where:'PowerShell',line:'irm https://raw.githubusercontent.com/beahead-ab/cda-tkl-install/main/install.ps1 | iex'}
};
export function openUpdateNotice(view,{api,message}){
  if(!view?.available)return;
  const title='Charlottendal TKL '+view.latest+' finns';
  if(view.canStart){
    confirmAdmin({title,button:'Uppdatera nu',
      message:'Den här Pi:n kör '+view.current+'. Uppdateringen hämtar '+view.latest+', installerar den och startar om TKL, vilket tar ett par minuter. Lagda tågvägar behåller sina lås men måste läggas om för att signalerna ska gå till kör. Inställningar och driftdata ligger kvar, och om den nya versionen inte startar återställs den gamla.',
      action:async()=>{const answer=await api('update/start',{});if(!answer)return false;message('Uppdateringen har startat. Ställverket visar "Ny version · ladda om" när den är klar.',{error:false,duration:8000});}});
    return;
  }
  const how=LINES[view.kind]||LINES.mac;
  const body=document.createElement('div');
  body.innerHTML='<p></p><p></p><pre class="update-line"><code></code></pre><button type="button" class="update-copy">Kopiera raden</button>';
  body.querySelector('p').textContent='Den här datorn kör '+view.current+'. Inställningar och driftdata ligger kvar vid uppdateringen, och om den nya versionen inte startar återställs den gamla.';
  body.querySelectorAll('p')[1].textContent='Öppna '+how.where+' och kör:';
  body.querySelector('code').textContent=how.line;
  const copy=body.querySelector('.update-copy');
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(how.line);copy.textContent='Kopierad';}catch{copy.textContent='Markera raden och kopiera';}};
  const modal=createAdminDialog({title,body});
  modal.element.addEventListener('close',()=>modal.element.remove(),{once:true});modal.open();
}
