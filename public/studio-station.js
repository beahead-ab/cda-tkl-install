// Stationen som Studio visar, ur /api/config: Charlottendal med Cda60.xml, eller en annan station med sin JMRI-fil
// (Träkvista: Trakvista.xml). Texterna i Studio är skrivna för Charlottendal; forStation byter namn och fil.
// register: källregistret (Källa), migration: Charlottendals införandestatus för Logix-reglerna.
export const station={id:'charlottendal',title:'Charlottendal',source:'Cda60.xml',register:true,migration:true};
export function setStation(config){const s=config?.station;if(!s)return;if(s.id)station.id=s.id;if(s.title)station.title=s.title;if(s.source)station.source=s.source;if(s.register===false)station.register=false;if(s.migration===false)station.migration=false;}
const genitive=title=>/s$/.test(title)?title:title+'s';
export const forStation=text=>station.title==='Charlottendal'?text:String(text).replaceAll('Cda60.xml',station.source).replaceAll('Charlottendals',genitive(station.title)).replaceAll('Charlottendal',station.title);
