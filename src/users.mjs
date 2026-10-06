// Användare i Charlottendal TKL, funktionellt som i TrainMeet Server: ägare och administratörer med
// användarnamn och lösenord, inbjudan med engångskod, sessioner i en cookie. Ägaren lägger till och tar
// bort användare; en administratör sköter hela TKL men inte vilka som har tillgång. Filen users.json delas
// av TKL och simulatorn (0640, gruppen charlottendal-auth i webbdriften) och skrivs alltid atomiskt.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomInt, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt), digest = value => createHash('sha256').update(value).digest('hex');
export const ROLES = ['owner', 'admin'], CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ', INVITATION_DAYS = 7, SESSION_HOURS = 12;
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,63}$/i, CODE = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/;
const fail = (message, status = 400) => Object.assign(Error(message), { status });
export function checkUsername(value) {
  const name = String(value ?? '').trim();
  if (!USERNAME.test(name)) throw fail('Användarnamnet har 3–64 tecken: bokstäver, siffror, punkt, bindestreck eller understreck.');
  return name;
}
export function checkPassword(value) {
  if (typeof value !== 'string' || value.length < 6 || value.length > 128) throw fail('Välj ett lösenord med 6–128 tecken');
  return value;
}
async function hash(password, salt) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw fail('Fel användarnamn eller lösenord', 401);
  return derive(password, Buffer.from(salt, 'hex'), 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
const makeCode = () => { let s = ''; for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]; return s.slice(0, 4) + '-' + s.slice(4); };
const normalizeCode = value => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
// Var filen ligger: egen variabel, annars bredvid den tidigare lösenordsfilen, annars i driftkatalogen.
export function usersFile(env = process.env, stateDir) {
  if (env.CHARLOTTENDAL_USERS_FILE) return env.CHARLOTTENDAL_USERS_FILE;
  if (env.CHARLOTTENDAL_AUTH_FILE) return path.join(path.dirname(env.CHARLOTTENDAL_AUTH_FILE), 'users.json');
  return path.join(stateDir, 'users.json');
}
function writeAtomic(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 });
  const temp = file + '.tmp', fd = fs.openSync(temp, 'w', 0o640);
  try { fs.writeFileSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  const directory = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(directory); } catch {} finally { fs.closeSync(directory); }
}
const publicUser = (u, now) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt, mustChange: !!u.mustChange,
  status: u.hash ? 'active' : u.invitation && u.invitation.expires > now ? 'invited' : 'expired', invitationExpires: u.invitation?.expires ?? null });

export class UserStore {
  // legacyFile: dagens auth.json med ett delat lösenord; det blir ägaren "admin" första gången users.json saknas.
  constructor(file, { legacyFile = null, now = Date.now } = {}) {
    this.file = file; this.now = now; this.busy = false;
    this.migrated = false; this.readonly = false;
    if (!fs.existsSync(file)) {
      const legacy = legacyFile && fs.existsSync(legacyFile) ? JSON.parse(fs.readFileSync(legacyFile, 'utf8')) : null;
      const users = legacy && legacy.version === 1 && /^[a-f0-9]{128}$/.test(legacy.hash || '') ? [{ id: randomBytes(8).toString('hex'), username: 'admin', role: 'owner', salt: legacy.salt, hash: legacy.hash, mustChange: !!legacy.mustChange, createdAt: now(), updatedAt: now(), invitation: null }] : [];
      // Simulatorn i webbdriften får bara läsa katalogen: den väntar på att TKL skriver filen och ser tills dess inga användare.
      try { writeAtomic(file, { version: 2, users, sessions: [], attempts: [] }); this.migrated = users.length > 0; }
      catch (e) { if (!['EACCES', 'EPERM', 'EROFS'].includes(e.code)) throw e; this.readonly = true; }
    }
    this.read();
  }
  read() {
    // En fil som försvunnit under drift (säkerhetskopia tillbakalagd, katalog rensad) ger en tom lista, inte ett stopp.
    if (!fs.existsSync(this.file)) {
      const empty = { version: 2, users: [], sessions: [], attempts: [] };
      if (!this.readonly) { try { writeAtomic(this.file, empty); } catch (e) { if (!['EACCES', 'EPERM', 'EROFS'].includes(e.code)) throw e; this.readonly = true; } }
      return empty;
    }
    const record = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (record.version !== 2 || !Array.isArray(record.users) || !Array.isArray(record.sessions) || !Array.isArray(record.attempts)) throw Error('Ogiltig användarfil');
    return record;
  }
  write(record) { writeAtomic(this.file, record); }
  count() { return this.read().users.length; }
  hasOwner() { return this.read().users.some(u => u.role === 'owner' && u.hash); }
  summary() {
    const now = this.now(), record = this.read();
    return { count: record.users.length, hasOwner: record.users.some(u => u.role === 'owner' && u.hash), users: record.users.map(u => publicUser(u, now)).sort((a, b) => a.role === b.role ? a.username.localeCompare(b.username, 'sv') : a.role === 'owner' ? -1 : 1) };
  }
  user(id) { const u = this.read().users.find(u => u.id === id); return u ? publicUser(u, this.now()) : null; }
  find(record, username) { const name = String(username ?? '').trim().toLowerCase(); return record.users.find(u => u.username.toLowerCase() === name) || null; }
  // Första ägaren: bara när ingen användare finns (onboardingen, scripts/create-owner.mjs eller den migrerade lösenordsfilen).
  async createOwner({ username, password, mustChange = false }) {
    const record = this.read(); if (record.users.length) throw fail('Det finns redan användare. Ägaren bjuder in fler under Inställningar → Användare.', 409);
    const name = checkUsername(username); checkPassword(password);
    const salt = randomBytes(16).toString('hex'), now = this.now();
    const user = { id: randomBytes(8).toString('hex'), username: name, role: 'owner', salt, hash: (await hash(password, salt)).toString('hex'), mustChange, createdAt: now, updatedAt: now, invitation: null };
    record.users.push(user); this.write(record); return publicUser(user, now);
  }
  // Inbjudan: ett namn och en roll ger en engångskod som gäller sju dagar. Koden visas en gång och lagras bara som hash.
  invite({ username, role = 'admin' }) {
    const record = this.read(), name = checkUsername(username);
    if (!ROLES.includes(role)) throw fail('Rollen är ägare eller administratör.');
    if (this.find(record, name)) throw fail('Användarnamnet finns redan.', 409);
    const code = makeCode(), now = this.now();
    const user = { id: randomBytes(8).toString('hex'), username: name, role, salt: null, hash: null, mustChange: false, createdAt: now, updatedAt: now, invitation: { codeHash: digest(normalizeCode(code)), expires: now + INVITATION_DAYS * 86400000 } };
    record.users.push(user); this.write(record);
    return { user: publicUser(user, now), code, expires: user.invitation.expires };
  }
  // Ny kod för en användare som tappat sin eller låst sig ute: lösenordet nollställs, sessionerna avslutas.
  reissue(id) {
    const record = this.read(), user = record.users.find(u => u.id === id); if (!user) throw fail('Användaren finns inte.', 404);
    const code = makeCode(), now = this.now();
    user.invitation = { codeHash: digest(normalizeCode(code)), expires: now + INVITATION_DAYS * 86400000 }; user.salt = null; user.hash = null; user.mustChange = false; user.updatedAt = now;
    record.sessions = record.sessions.filter(s => s.userId !== user.id); this.write(record);
    return { user: publicUser(user, now), code, expires: user.invitation.expires };
  }
  recover(username) { const user = this.find(this.read(), username); if (!user) throw fail('Användaren finns inte.', 404); return this.reissue(user.id); }
  throttle(record) {
    const now = this.now(); record.attempts = record.attempts.filter(t => t > now - 60000);
    if (record.attempts.length >= 5) throw fail('För många försök. Vänta en minut.', 429);
    record.attempts.push(now); this.write(record);
  }
  async redeem({ username, code, password }) {
    const record = this.read(); this.throttle(record);
    const user = this.find(record, username), clean = normalizeCode(code);
    if (!user || !user.invitation || !CODE.test(clean.slice(0, 4) + '-' + clean.slice(4)) || !timingSafeEqual(Buffer.from(user.invitation.codeHash, 'hex'), Buffer.from(digest(clean), 'hex'))) throw fail('Fel användarnamn eller kod', 401);
    if (user.invitation.expires <= this.now()) throw fail('Koden har gått ut. Be ägaren om en ny.', 410);
    checkPassword(password);
    const salt = randomBytes(16).toString('hex'); user.salt = salt; user.hash = (await hash(password, salt)).toString('hex'); user.invitation = null; user.mustChange = false; user.updatedAt = this.now();
    record.attempts = []; this.write(record); return publicUser(user, this.now());
  }
  async login({ username, password }) {
    const record = this.read(); this.throttle(record);
    const user = this.find(record, username);
    if (!user || !user.hash || !timingSafeEqual(await hash(password, user.salt), Buffer.from(user.hash, 'hex'))) throw fail('Fel användarnamn eller lösenord', 401);
    record.attempts = []; this.write(record); return publicUser(user, this.now());
  }
  async changePassword(id, { currentPassword, newPassword }) {
    const record = this.read(), user = record.users.find(u => u.id === id); if (!user || !user.hash) throw fail('Logga in för att fortsätta', 401);
    this.throttle(record);
    if (!timingSafeEqual(await hash(currentPassword, user.salt), Buffer.from(user.hash, 'hex'))) throw fail('Fel lösenord', 401);
    checkPassword(newPassword); if (newPassword === currentPassword) throw fail('Välj ett nytt lösenord');
    const salt = randomBytes(16).toString('hex'); user.salt = salt; user.hash = (await hash(newPassword, salt)).toString('hex'); user.mustChange = false; user.updatedAt = this.now();
    record.attempts = []; record.sessions = record.sessions.filter(s => s.userId !== user.id); this.write(record); return publicUser(user, this.now());
  }
  // Den sista ägaren kan inte tas bort, och ingen tar bort sig själv av misstag.
  remove(id, { by = null } = {}) {
    const record = this.read(), user = record.users.find(u => u.id === id); if (!user) throw fail('Användaren finns inte.', 404);
    if (by && by === id) throw fail('Du kan inte ta bort dig själv. Be en annan ägare.', 409);
    if (user.role === 'owner' && user.hash && !record.users.some(u => u.id !== id && u.role === 'owner' && u.hash)) throw fail('Den sista ägaren kan inte tas bort.', 409);
    record.users = record.users.filter(u => u.id !== id); record.sessions = record.sessions.filter(s => s.userId !== id); this.write(record);
    return this.summary();
  }
  issueSession(userId) {
    const record = this.read(), token = randomBytes(32).toString('hex'), now = this.now(), expires = now + SESSION_HOURS * 3600000;
    record.sessions = record.sessions.filter(s => s.expires > now).slice(-23);
    record.sessions.push({ id: digest(token), userId, expires, createdAt: now }); this.write(record);
    return { token, expires };
  }
  session(token) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const record = this.read(), now = this.now(), s = record.sessions.find(s => s.id === digest(token) && s.expires > now); if (!s) return null;
    const user = record.users.find(u => u.id === s.userId); if (!user || !user.hash) return null;
    return { id: s.id, expires: s.expires, user: publicUser(user, now) };
  }
  revokeSession(id) { const record = this.read(); record.sessions = record.sessions.filter(s => s.id !== id); this.write(record); }
}
