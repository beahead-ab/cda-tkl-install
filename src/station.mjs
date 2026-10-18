// Vilken station den här installationen kör. En installation kör en station, som en TMBox står på en station.
// CHARLOTTENDAL_STATION väljer bland katalogerna i stations/ som har en genererad profil, och Charlottendal, vars filer
// ligger kvar där de alltid legat (profiles/, public/data). Anroparen kan inte ange en sökväg. Standard är paketets
// station i packaging/identity.env: Charlottendal i cda-tkl, Träkvista i Tk-TKL, som saknar Charlottendals filer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHARLOTTENDAL = 'charlottendal';
const identity = fs.existsSync(ROOT + 'packaging/identity.env') ? fs.readFileSync(ROOT + 'packaging/identity.env', 'utf8') : '';
export const DEFAULT_STATION = /^TKL_STATION=([a-z0-9-]+)\s*$/m.exec(identity)?.[1] || CHARLOTTENDAL;
const directory = root => path.join(path.resolve(root instanceof URL || String(root).startsWith('file:') ? fileURLToPath(root) : root), path.sep);
export function stationIds(root = ROOT) {
  root = directory(root);
  const dir = root + 'stations';
  const found = fs.existsSync(dir) ? fs.readdirSync(dir).filter(id => /^[a-z0-9-]+$/.test(id) && fs.existsSync(`${dir}/${id}/station.json`) && fs.existsSync(`${dir}/${id}/profiles/network.json`)) : [];
  const charlottendal = fs.existsSync(root + 'profiles/charlottendal-network.json') ? [CHARLOTTENDAL] : [];
  return [...charlottendal, ...found.filter(id => id !== CHARLOTTENDAL)];
}
export function currentStation(env = process.env, root = ROOT) {
  root = directory(root);
  const id = env.CHARLOTTENDAL_STATION || DEFAULT_STATION;
  const ids = stationIds(root);
  if (!ids.includes(id)) throw Error('Okänd station: ' + id + '. Finns: ' + ids.join(', ') + '.');
  // Samma beskrivning för båda stationerna. Sökvägarna beskriver befintliga filer; ingenting flyttas eller skrivs om.
  if (id === CHARLOTTENDAL) return { id, title: 'Charlottendal', dataDir: root + 'public/data',
    profile: root + 'profiles/charlottendal-network.json', field: root + 'profiles/simulator-network.json',
    legacyProfile: root + 'profiles/charlottendal.json', legacyField: root + 'profiles/simulator.json',
    rules: root + 'profiles/charlottendal-rules.json', migration: root + 'public/data/migration.json', optionalStudioData: false,
    source: root + 'public/data/source/Cda60.xml', sourceName: 'Cda60.xml', tklId: 'cda-tkl' };
  const dir = `${root}stations/${id}`, station = JSON.parse(fs.readFileSync(dir + '/station.json', 'utf8'));
  // JMRI-filen som stationen är importerad ur: Studio läser den, som Charlottendals Cda60.xml.
  const source = station.source && /^[\w.-]+\.xml$/.test(station.source) && fs.existsSync(dir + '/' + station.source) ? dir + '/' + station.source : null;
  return { id, title: station.title, signature: station.signature, definition: station, dataDir: dir + '/data', profile: dir + '/profiles/network.json', field: dir + '/profiles/field.json',
    legacyProfile: null, legacyField: null, rules: null, migration: null, optionalStudioData: true,
    source, sourceName: source ? station.source : null, tklId: (station.signature || id).toLowerCase().replace(/[^a-z0-9]/g, '') + '-tkl' };
}
// Driftdata (lås, journal, inställningar): var/ för Charlottendal, var/<id>/ för en annan station, så att två stationers
// lås aldrig blandas. CHARLOTTENDAL_STATE_DIR gäller före båda.
export function stateDirectory(env = process.env, station = currentStation(env)) {
  if (env.CHARLOTTENDAL_STATE_DIR) return env.CHARLOTTENDAL_STATE_DIR;
  return ROOT + 'var' + (station.id === CHARLOTTENDAL ? '' : '/' + station.id);
}
// En fil i stationens data (panel.json, train-fields.json …): Charlottendals ligger i public/data.
export function stationData(file, station = currentStation()) { return JSON.parse(fs.readFileSync(station.dataDir + '/' + file, 'utf8')); }
