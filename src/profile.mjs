import fs from 'node:fs';
// Only known on-disk profiles can be selected; callers cannot supply paths.
export function loadProfile(side='tkl') {
  const selected=process.env.CHARLOTTENDAL_PROFILE || 'network';
  if(!['network','legacy'].includes(selected)) throw Error('Okänd anläggningsprofil.');
  const file=side==='field'?'simulator':'charlottendal';
  return JSON.parse(fs.readFileSync(new URL(`../profiles/${file}${selected==='network'?'-network':''}.json`,import.meta.url)));
}
