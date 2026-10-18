import fs from 'node:fs';
import { currentStation, stateDirectory } from './station.mjs';
// Only known on-disk profiles can be selected; callers cannot supply paths.
export function loadProfile(side='tkl',{activated=true}={}) {
  const selected=process.env.CHARLOTTENDAL_PROFILE || 'network';
  if(!['network','legacy'].includes(selected)) throw Error('Okänd anläggningsprofil.');
  const station=currentStation();
  // En annan station än Charlottendal har en driftprofil och en fältprofil i stations/<id>/profiles; den äldre provprofilen finns bara för Charlottendal.
  const file=selected==='legacy'?(side==='field'?station.legacyField:station.legacyProfile):(side==='field'?station.field:station.profile);
  if(!file) throw Error('Provprofilen finns bara för Charlottendal.');
  const base=JSON.parse(fs.readFileSync(file));
  if(side!=='field'||!activated)return base;
  // Studio skriver den aktiverade fältprofilen till tillståndskatalogen; simulatorn följer den vid start.
  // I webbdriften kör simulatorn som en annan användare och får inte läsa TKL:s katalog: då gäller grundprofilen,
  // och det sägs en gång på stderr. Bara en fil som finns men inte går att tolka stoppar starten.
  const dir=stateDirectory(process.env,station);
  try{const active=JSON.parse(fs.readFileSync(dir+'/studio-field-profile.json','utf8'));if(active?.id===base.id)return active;}
  catch(e){if(['EACCES','EPERM','ENOTDIR'].includes(e.code))console.error('Simulatorn kan inte läsa '+dir+'/studio-field-profile.json ('+e.code+'); grundprofilen används.');else if(e.code!=='ENOENT')throw e;}
  return base;
}
