// Vilken station den här installationen kör. En installation kör en station, som en TMBox står på en station.
// CHARLOTTENDAL_STATION väljer bland katalogerna i stations/ som har en genererad profil, och Charlottendal, vars filer
// ligger kvar där de alltid legat (profiles/, public/data). Anroparen kan inte ange en sökväg. Standard är paketets
// station i packaging/identity.env: Charlottendal i cda-tkl, Träkvista i Tk-TKL, som saknar Charlottendals filer.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BUILT_IN = 'charlottendal';
const identity = fs.existsSync(ROOT + 'packaging/identity.env') ? fs.readFileSync(ROOT + 'packaging/identity.env', 'utf8') : '';
export const DEFAULT_STATION = /^TKL_STATION=([a-z0-9-]+)\s*$/m.exec(identity)?.[1] || BUILT_IN;
export function stationIds() {
  const dir = ROOT + 'stations';
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter(id => /^[a-z0-9-]+$/.test(id) && fs.existsSync(`${dir}/${id}/station.json`) && fs.existsSync(`${dir}/${id}/profiles/network.json`)) : [];
  const builtIn = fs.existsSync(ROOT + 'profiles/charlottendal-network.json') ? [BUILT_IN] : [];
  return [...builtIn, ...found.filter(id => id !== BUILT_IN)];
}
export function currentStation(env = process.env) {
  const id = env.CHARLOTTENDAL_STATION || DEFAULT_STATION;
  if (!stationIds().includes(id)) throw Error('Okänd station: ' + id + '. Finns: ' + stationIds().join(', ') + '.');
  if (id === BUILT_IN) return { id, title: 'Charlottendal', builtIn: true, dataDir: ROOT + 'public/data', profile: null, field: null, source: ROOT + 'public/data/source/Cda60.xml', sourceName: 'Cda60.xml' };
  const dir = `${ROOT}stations/${id}`, station = JSON.parse(fs.readFileSync(dir + '/station.json', 'utf8'));
  // JMRI-filen som stationen är importerad ur: Studio läser den, som Charlottendals Cda60.xml.
  const source = station.source && /^[\w.-]+\.xml$/.test(station.source) && fs.existsSync(dir + '/' + station.source) ? dir + '/' + station.source : null;
  return { id, title: station.title, signature: station.signature, builtIn: false, dataDir: dir + '/data', profile: dir + '/profiles/network.json', field: dir + '/profiles/field.json',
    source, sourceName: source ? station.source : null };
}
// Driftdata (lås, journal, inställningar): var/ för Charlottendal, var/<id>/ för en annan station, så att två stationers
// lås aldrig blandas. CHARLOTTENDAL_STATE_DIR gäller före båda.
export function stateDirectory(env = process.env, station = currentStation(env)) {
  if (env.CHARLOTTENDAL_STATE_DIR) return env.CHARLOTTENDAL_STATE_DIR;
  return ROOT + 'var' + (station.builtIn ? '' : '/' + station.id);
}
// En fil i stationens data (panel.json, train-fields.json …): Charlottendals ligger i public/data.
export function stationData(file, station = currentStation()) { return JSON.parse(fs.readFileSync(station.dataDir + '/' + file, 'utf8')); }
