// Installationen väljer en station vid start. Valet hör till installationen, aldrig till stationens driftdata.
// Befintliga installationer med fasta kataloger eller miljöval är låsta tills deras startkonfiguration ändras.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentStation, stationIds } from './station.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const fail = (message, status = 409) => { throw Object.assign(Error(message), { status }); };
const known = (id, root) => typeof id === 'string' && stationIds(root).includes(id);
export const installationConfigFile = (root = ROOT, env = process.env) => path.resolve(root, env.TKL_INSTALLATION_CONFIG || '.tkl-installation/station.json');

// Också en ännu inte skapad katalog måste jämföras genom sin verkliga förälder. En symbolisk länk får
// aldrig ge två stationer samma users.json eller routes.json; även en länk till ett ännu saknat mål räknas.
export function physicalDirectory(directory, seen = new Set()) {
  const full = path.resolve(directory);
  if (seen.has(full)) throw Error('En symbolisk länk i driftkatalogen går i cirkel.');
  seen.add(full);
  try { return fs.realpathSync(full); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try {
      if (fs.lstatSync(full).isSymbolicLink()) return physicalDirectory(path.resolve(path.dirname(full), fs.readlinkSync(full)), seen);
    } catch (statError) { if (statError.code !== 'ENOENT') throw statError; }
    const parent = path.dirname(full);
    if (parent === full) throw error;
    return path.join(physicalDirectory(parent, seen), path.basename(full));
  }
}
function checkSeparateDirectories(map) {
  const directories = Object.values(map).map(directory => physicalDirectory(directory));
  if (new Set(directories).size !== directories.length) throw Error('Stationerna måste ha olika driftkataloger, också efter symboliska länkar.');
}
const defaultDirectory = (root, id) => path.join(root, 'var', id === 'charlottendal' ? '' : id);
function directoryReason(root, config) {
  try {
    checkSeparateDirectories(config?.stationStateDirectories || Object.fromEntries(stationIds(root).map(id => [id, defaultDirectory(root, id)])));
    return '';
  } catch (error) { return 'Stationsbyte kräver skilda fysiska driftkataloger. ' + error.message; }
}

export function readInstallationSelection(file) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw Error('Kan inte läsa installationens stationsval: ' + error.message); }
  if (data?.version !== 1 || typeof data.stationId !== 'string' || !/^[a-z0-9-]+$/.test(data.stationId) || typeof data.requireTrainMeetConnect !== 'boolean') throw Error('Ogiltigt stationsval för installationen.');
  if (data.stationStateDirectories !== undefined) {
    const map = data.stationStateDirectories;
    if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).length || Object.entries(map).some(([id, directory]) => !/^[a-z0-9-]+$/.test(id) || typeof directory !== 'string' || !path.isAbsolute(directory))) throw Error('Ogiltig karta över stationernas driftkataloger.');
    checkSeparateDirectories(map);
  }
  return data;
}
function saveSelection(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.tmp';
  const fd = fs.openSync(temp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
export function installationLockReason(env = process.env, managed = false, config = null) {
  if (env.CHARLOTTENDAL_INSTALL_KIND === 'render' || env.RENDER) return 'Webbdriften kör sin fasta station. En annan station får en egen Render-tjänst.';
  if (env.TKL_STATION_SELECTION === 'locked' || (!managed && env.CHARLOTTENDAL_STATION)) return 'Stationen är vald i startkommandot eller CHARLOTTENDAL_STATION. Ändra startkonfigurationen för att välja en annan station.';
  const mapped = managed && env.TKL_STATION_STATE_DIRECTORY_MAPPED === '1' && config?.stationStateDirectories;
  const fixed = [!mapped && 'CHARLOTTENDAL_STATE_DIR', 'CHARLOTTENDAL_USERS_FILE', 'CHARLOTTENDAL_AUTH_FILE', 'CHARLOTTENDAL_PROFILE', 'CHARLOTTENDAL_TRAINMEET_ORIGIN'].find(key => key && env[key]);
  if (fixed) return fixed + ' är fast för installationen. Stationsbyte kräver separata driftdata och anslutningar.';
  if (!managed) return 'Stationsbyte kräver att programmet startas med npm start, så att båda processerna kan startas om tillsammans.';
  return '';
}
export function resolveInstallationStart({ root = ROOT, env = process.env, args = [] } = {}) {
  if (args.length > 1) throw Error('Ange högst en station.');
  if (env.CHARLOTTENDAL_STATION && args[0] && env.CHARLOTTENDAL_STATION !== args[0]) throw Error('Startkommandots station skiljer sig från CHARLOTTENDAL_STATION.');
  const explicit = env.CHARLOTTENDAL_STATION || args[0];
  const file = installationConfigFile(root, env);
  const config = explicit ? null : readInstallationSelection(file);
  const identity = fs.existsSync(path.join(root, 'packaging/identity.env')) ? fs.readFileSync(path.join(root, 'packaging/identity.env'), 'utf8') : '';
  const defaultId = /^TKL_STATION=([a-z0-9-]+)\s*$/m.exec(identity)?.[1] || 'charlottendal';
  const stationId = explicit || config?.stationId || defaultId;
  if (!known(stationId, root)) throw Error('Stationen ' + stationId + ' är inte installerad.');
  let mapped = {};
  if (!explicit && config?.stationStateDirectories) {
    if (env.CHARLOTTENDAL_STATE_DIR && config.stationStateDirectories[defaultId] !== env.CHARLOTTENDAL_STATE_DIR) throw Error('Kartans ursprungliga driftkatalog måste vara exakt samma som CHARLOTTENDAL_STATE_DIR. Inga befintliga driftdata flyttas.');
    if (!Object.hasOwn(config.stationStateDirectories, stationId)) throw Error('Den valda stationen saknar en egen driftkatalog i installationens karta.');
    mapped = { CHARLOTTENDAL_STATE_DIR: config.stationStateDirectories[stationId], TKL_STATION_STATE_DIRECTORY_MAPPED: '1' };
  }
  const mode = explicit || installationLockReason({ ...env, ...mapped }, true, config) ? 'locked' : 'managed';
  if (mode === 'managed') { const reason = directoryReason(root, config); if (reason) throw Error(reason); }
  return { stationId, file, config, env: { ...env, ...mapped, CHARLOTTENDAL_STATION: stationId, TKL_STATION_SELECTION: mode, TKL_INSTALLATION_CONFIG: file,
    CHARLOTTENDAL_CONNECTION_MODE: 'simulator', CHARLOTTENDAL_WIRE_HOST: '127.0.0.1' } };
}
// Tillståndet kommer från serverns aktuella objekt. Alla tågvägar omfattas, också återställda och kvarhållna lås.
export function stationChangeReason({ engine, connection, recorder, automation, trainMeet, activeCommands = 0, automating = false, trafficBusy = false } = {}) {
  if (activeCommands > 0 || automating || trafficBusy) return 'Vänta tills pågående manöver och trafikåtgärd är klar.';
  if (!engine || engine.storageFault) return 'Fungerande lagring och ett inläst driftläge krävs.';
  if (!connection || connection.locked || connection.mode !== 'offline' || connection.data?.mode === 'live') return 'Koppla från LocoNet innan stationen byts.';
  if (engine.routes?.length) return 'Återta alla tågvägar och kvarhållna lås först.';
  if (engine.controls?.programming?.reserved || engine.controls?.programming?.desired) return 'Återgå till normaldrift på programmeringsspåret först.';
  if (engine.controls?.emergency && engine.controls.emergency.completedAt === null) return 'Avsluta nödåtertagningen först.';
  if (engine.controls?.panelReset?.completedAt === null) return 'Avsluta panelåterställningen först.';
  if (engine.yard?.requests?.length) return 'Rangerarens begäran måste vara besvarad och tillbakalagd först.';
  if (recorder?.active || recorder?.pending) return 'Avsluta och spara telegraminspelningen först.';
  if (automation?.enabled) return 'Stäng av automaten innan stationen byts.';
  if (trainMeet?.busy) return 'Vänta tills TrainMeet-begäran är klar.';
  return '';
}

export class InstallationStation {
  constructor({ root = ROOT, env = process.env, station = currentStation(env, root), send = typeof process.send === 'function' ? message => process.send(message) : null } = {}) {
    Object.assign(this, { root, env, station, send });
    this.file = installationConfigFile(root, env); this.pending = null;
    this.managed = env.TKL_STATION_SELECTION === 'managed' && typeof send === 'function';
    this.config = this.managed || env.TKL_STATION_STATE_DIRECTORY_MAPPED === '1' ? readInstallationSelection(this.file) : null;
    if (this.config && this.config.stationId !== station.id) throw Error('Det sparade stationsvalet stämmer inte med den startade stationen.');
    if (env.TKL_STATION_STATE_DIRECTORY_MAPPED === '1' && (!this.config?.stationStateDirectories || this.config.stationStateDirectories[station.id] !== env.CHARLOTTENDAL_STATE_DIR)) throw Error('Stationens driftkatalog stämmer inte med installationens karta.');
  }
  get requireTrainMeetConnect() { return !!this.config?.requireTrainMeetConnect; }
  targetReason(id) {
    if (!known(id, this.root)) return 'Stationen är inte installerad.';
    const separation = directoryReason(this.root, this.config); if (separation) return separation;
    if (id === this.station.id) return 'Stationen körs redan.';
    if (this.config?.stationStateDirectories && !Object.hasOwn(this.config.stationStateDirectories, id)) return 'Stationen saknar en egen driftkatalog i installationens karta.';
    const directory = this.config?.stationStateDirectories?.[id] || defaultDirectory(this.root, id);
    try {
      const connection = JSON.parse(fs.readFileSync(path.join(directory, 'connection.json'), 'utf8'));
      if (connection.mode !== 'offline') return 'Stationen har LocoNet ansluten i sitt sparade läge. Starta den separat och koppla från först.';
    } catch (error) { if (error.code !== 'ENOENT') return 'Stationens sparade LocoNet-läge kunde inte läsas. Kontrollera det före byte.'; }
    return '';
  }
  view(runtime = {}) {
    const fixed = installationLockReason(this.env, this.managed, this.config);
    const reason = this.pending ? 'Stationen byts. Vänta tills programmet har startat om.' : fixed || stationChangeReason(runtime);
    return { current: this.station.id, title: this.station.title, locked: !!fixed, reason, restarting: !!this.pending, requireTrainMeetConnect: this.requireTrainMeetConnect,
      stations: stationIds(this.root).map(id => { const station = currentStation({ CHARLOTTENDAL_STATION: id }, this.root); const why = reason || this.targetReason(id); return { id, title: station.title, current: id === this.station.id, allowed: !why, reason: why }; }) };
  }
  prepare(stationId, runtime) {
    if (!known(stationId, this.root)) fail('Stationen är inte installerad.', 400);
    const view = this.view(runtime), target = view.stations.find(s => s.id === stationId);
    if (!target.allowed) fail(target.reason);
    const config = { ...this.config, version: 1, stationId, requireTrainMeetConnect: true };
    try { saveSelection(this.file, config); }
    catch { fail('Stationsvalet kunde inte sparas. Den nuvarande stationen fortsätter.', 507); }
    this.pending = stationId;
    return { restarting: true, stationId, title: target.title };
  }
  restart() { if (this.pending) this.send?.({ type: 'tkl-station-change', stationId: this.pending }); }
  resumeTrainMeet() {
    if (!this.requireTrainMeetConnect) return;
    const config = { ...this.config, requireTrainMeetConnect: false }; saveSelection(this.file, config); this.config = config;
  }
}
