// Snabbinställningen för träffklockans sekunder (0.81.0), som i TrainMeet Server och appen: ett tryck på klockan visar
// eller döljer sekunderna. Valet gäller den här webbläsaren; utan val visas sekunderna, som förut.
export const CLOCK_SECONDS_KEY='charlottendal-clock-seconds';
export function clockSecondsShown(storage=globalThis.localStorage){
  try{return storage?.getItem(CLOCK_SECONDS_KEY)!=='off';}catch{return true;}
}
export function setClockSeconds(shown,storage=globalThis.localStorage){
  try{storage?.setItem(CLOCK_SECONDS_KEY,shown?'on':'off');}catch{}
  return shown;
}
export const toggleClockSeconds=(storage=globalThis.localStorage)=>setClockSeconds(!clockSecondsShown(storage),storage);
// Vad klockan visar: 12:36:41 eller 12:36 (clockAt i timetable-rows.js ger båda).
export const clockText=(now,shown)=>now?(shown?now.text:now.short):'';
export const clockHint=shown=>shown?'Tryck för att dölja sekunderna':'Tryck för att visa sekunderna';
