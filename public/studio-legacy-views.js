// Sidorna från Inställningar → Anläggning som Studio visar (0.71.0), med rubrik och ingress. Ren data, så att
// adresserna kan provas utan webbläsare; monteringen ligger i studio-legacy.js.
export const LEGACY_VIEWS={
  'konfigurera/visning':{eyebrow:'KONFIGURERA · VISNING',title:'Visning',text:'Namn och beskrivningar för panelens objekt. Ändringar sparas i ett utkast och aktiveras när anläggningen saknar tågvägslås. Adresser och regler ändras inte här.'},
  'konfigurera/orter':{eyebrow:'KONFIGURERA · ORTER OCH TELEFON',title:'Orter och telefon',text:'Ortsnamn och telefonnummer vid panelens in- och utfarter, lokalt eller kopplade till en station i TrainMeet, och normal utfart per linje.'},
  'driftsattning/bindningar':{eyebrow:'DRIFTSÄTTNING · DRIFTBINDNINGAR',title:'Driftbindningar',text:'Adress, polaritet, beskedskoder och signalrapport (E4 eller B1) per objekt. Ändra i ett utkast, granska skillnaden och aktivera med skäl; mät sedan objekten under Mät objekt.'},
  'data/kalla':{eyebrow:'DATA · KÄLLA',title:'Källa',text:'Hela Cda60.xml, sökbar post för post med JMRI:s fält, referenser och egna anteckningar. Originalfilen kan hämtas oförändrad.'},
  'genomgang/inforande':{eyebrow:'GENOMGÅNG · INFÖRANDESTATUS',title:'Införandestatus',text:'Varje regelgrupp i källan med sin status i TKL: provad, ersatt, delvis införd, återstår eller nekad. Att ett objekt är importerat betyder inte att dess funktion är körklar.'}};
export const isLegacyView=(tab,view)=>Object.hasOwn(LEGACY_VIEWS,tab+'/'+view);
