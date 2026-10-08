// Hjälpen i Studio: en panel över högra delen av fönstret med en text per flik, i arbetsordningen. Öppnas med ?-knappen
// i sidhuvudet eller tangenten ?, stängs med × eller Escape. Den aktiva fliken är utfälld. Texterna är data (HELP) så att de
// kan provas utan DOM.
import {esc} from './studio-ui.js';
export const HELP=[
  {id:'plan',n:1,title:'Konfigurera · Stationsplan',match:({tab,view})=>tab==='konfigurera'&&!view,
   paragraphs:['Hela stationen ritad ur panel.json. <b>Klicka</b> på en växel, signal eller spårledning: panelen till höger visar adress, modul, tågvägar och avvikelser för just det objektet, och leder vidare till Data och Mät objekt.',
     '<b>Gå igenom</b> stegar från vänster till höger genom alla 115 växlar och signaler med ‹ och ›. Använd den när hela stationen ska gås igenom utan att något missas.',
     '<b>Lager</b> tänder och släcker växelnummer, signalnamn, spårledningar, adresser, MGP-modul och avvikelser. Röd punkt är en avvikelse; streckat spår saknar detektering i källan.',
     '<b>Höjd</b> visar hela stationen i fönstret, <b>Bredd</b> fyller bredden, − och + zoomar; dra i planen för att flytta, klicka i minikartan för att hoppa. <b>Panel</b> fäller in objektet och avvikelserna när planen behöver hela bredden.']},
  {id:'data',n:2,title:'Data',match:({tab})=>tab==='data',
   paragraphs:['Sex mängder i tabeller: växlar, signaler, spårledningar, tågvägar, moduler och avvikelser, samt reglerna. Chipsen överst tänder och släcker mängderna.',
     'Välj ett objekt (klicka på en rad) så filtreras alla mängder genom dess relationer, t.ex. alla tågvägar över Vx100 och alla signaler de klarerar. Högerkolumnen visar relationerna med antal. Länken i adressfältet kan delas; <b>Visa i planen</b> hoppar till objektet.',
     '<b>Källa (XML)</b> är hela Cda60.xml post för post: sök på namn, adress eller regel, öppna en post för alla JMRI-fält och referenser, och skriv egna anteckningar. Importkontrollen, avsnitten och sök i hela XML-filen ligger hopfällda under <b>Källfilen Cda60.xml</b> överst; där kan originalfilen hämtas oförändrad.']},
  {id:'regler',n:3,title:'Konfigurera · Regler och chatten',match:({tab,view})=>tab==='konfigurera'&&(view==='regler'||view==='ovriga'),
   paragraphs:['Det som gäller, som regelkort i sju typer: följer, förbjudet läge, manöverrätt, villkor, detektering, signalbesked och vägövergång. Dagens 69 regler kompilerar till exakt det kärnan läser; statusraden säger om kompileringen är identisk med grundprofilen.',
     'Beskriv i chatten vad som ska gälla ("Vx100 och Vx101 lägger alltid lika", "Vx140 får inte ligga avvikande när Vx143 ligger rakt") så får du ett kort att granska. Kortet blir ett utkast under Driftsättning, aldrig drift direkt. Chatten kräver en AI-nyckel under Inställningar → AI-tjänst.',
     '<b>Övriga delar</b> är samma språk för linjer, programmeringsspår, rangerbangård, vägövergångar och signalbesked.',
     '<b>Visning</b> ändrar namn och beskrivningar för panelens objekt (listan till vänster, det valda objektet med granskning och historik till höger), <b>Orter och telefon</b> ortsnamn och telefonnummer vid in- och utfarterna. Båda sparas i utkast och aktiveras när anläggningen saknar tågvägslås.']},
  {id:'genomgang',n:4,title:'Genomgång',match:({tab})=>tab==='genomgang',
   paragraphs:['Avvikelselistan som kort i fyra typer: <b>förslag</b> (med färdiga regler att skapa utkast av), <b>saknas</b> (beskriv i chatten), <b>beslut</b> (du avgör) och <b>underlag</b> (mätning eller MGP-dokumentation). "Blockerar" betyder att driftsättning inte kan ske förrän raden är löst.',
     'Med AI-nyckel ordnar <b>Kör genomgången</b> korten efter vad som bör göras först och bedömer varje kort; utan nyckel visas korten i källornas ordning. Kompisparen enligt spårgrafen och förslaget för dubbelkorsväxlarna X1 och X2 finns längst ner.',
     '<b>Införandestatus</b> visar varje regelgrupp i källan med sin status i TKL; ett klick öppnar regeln under Källa.']},
  {id:'driftsattning',n:5,title:'Driftsättning',match:({tab})=>tab==='driftsattning',
   paragraphs:['<b>Ändringar och aktivering</b>: ett utkast (från ett förslag eller en återställd version) valideras, provas i simulatorn tågväg för tågväg och aktiveras med skäl. Aktivering kräver AIS, inga lås och färska rapporter; kärnan läser om profilen och AIS kvarstår tills nya stoppbesked kommit.',
     '<b>Mät objekt</b>: en provorder per växel (rakt/avvikande), signal (stopp) och spårledning (belägg den), och rapporten som kommer <i>efter</i> ordern bekräftar adressen. Ekot och SENT OK räknas inte. Uppmätt i fält är kravet för att en profil ska få aktiveras i fysisk drift.',
     '<b>Lyssna</b> visar allt som går på bussen, avkodat där TKL förstår det. <b>Kort och MGP</b> inventerar korten över SV2 (Discover), kopplar kort till modul M00–M11 och visar per modul vad som ska stämma mellan Studio och dekodrarna.',
     '<b>Driftbindningar</b>: adresser, polaritet, beskedskoder och signalrapport (E4 eller B1) per objekt. Ändra i ett utkast, granska skillnaden och aktivera med skäl; mät sedan under Mät objekt.']},
  {id:'anslutning',n:6,title:'Anslutning',match:({tab})=>tab==='anslutning',
   paragraphs:['TrainMeet (träffen, tidtabellen och klareringen) och Stream Deck ställs i dag in under Inställningar; länkarna i menyn leder dit. Här kommer de att flyttas in sist.']}];
export const INTRO='Studio är anläggningen som Bennys XML beskriver den, läst av TKL. Ingenting här ändrar driften förrän ett utkast är provat i simulatorn och aktiverat. Arbetsgången går uppifrån och ner i flikarna.';
export const TIPS='Tryck <kbd>?</kbd> var som helst för den här hjälpen och <kbd>/</kbd> för sök. Hela genomgången av källan finns i docs/genomgang-mgp-2026-10-06.md i förrådet.';
export function currentSection(state){return HELP.find(h=>h.match(state))?.id||null;}
export function helpHtml(state){
  const open=currentSection(state);
  return `<div class="st-help-head"><b>Så arbetar du i Studio</b><span class="st-help-sub">Från ritning till driftsatt anläggning</span><button type="button" class="st-btn st-toggle" id="st-help-close" aria-label="Stäng hjälpen">×</button></div>
  <div class="st-help-body"><p class="st-help-intro">${INTRO}</p>${HELP.map(h=>`<details class="st-help-section"${h.id===open?' open':''}><summary><span class="st-help-n">${h.n}</span>${esc(h.title)}${h.id===open?'<span class="st-help-here">du är här</span>':''}</summary><div>${h.paragraphs.map(p=>`<p>${p}</p>`).join('')}</div></details>`).join('')}<p class="st-help-tips">${TIPS}</p></div>`;
}
// Panelen i sidan: knappen i sidhuvudet, tangenterna ? och Escape, fokus tillbaka till knappen när den stängs.
export function createHelp({button,getState}){
  const panel=document.createElement('aside');panel.id='st-help';panel.className='st-help';panel.setAttribute('aria-label','Hjälp');panel.hidden=true;document.body.append(panel);
  let openedFrom=null;
  const isOpen=()=>!panel.hidden;
  function open(){panel.innerHTML=helpHtml(getState());panel.hidden=false;button.setAttribute('aria-pressed','true');openedFrom=document.activeElement;panel.querySelector('#st-help-close').focus();}
  function close(){if(!isOpen())return;panel.hidden=true;button.setAttribute('aria-pressed','false');(openedFrom&&openedFrom!==document.body?openedFrom:button).focus?.();}
  button.addEventListener('click',()=>isOpen()?close():open());
  panel.addEventListener('click',e=>{if(e.target.closest('#st-help-close'))close();});
  document.addEventListener('keydown',e=>{const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
    if(e.key==='Escape'&&isOpen()){e.preventDefault();close();}
    else if(!typing&&e.key==='?'){e.preventDefault();isOpen()?close():open();}
    else if(!typing&&e.key==='/'){const s=document.getElementById('st-search');if(s){e.preventDefault();s.focus();}}});
  return {open,close,isOpen};
}
