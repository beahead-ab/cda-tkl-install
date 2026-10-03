import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import { json, body, staticFile } from './http.mjs';

const derive = promisify(scrypt), cookieName = '__Host-cda_session', lifetime = 12 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 401) => Object.assign(Error(message), { status });
async function hash(password, salt) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 128) throw fail('Fel lösenord');
  return derive(password, Buffer.from(salt, 'hex'), 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
async function matches(password, record) {
  return timingSafeEqual(await hash(password, record.salt), Buffer.from(record.hash, 'hex'));
}
function save(file, record) {
  const temp = file + '.tmp', fd = fs.openSync(temp, 'w', 0o640);
  try { fs.writeFileSync(fd, JSON.stringify(record) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  const directory = fs.openSync(path.dirname(file), 'r');
  try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
}
export async function initializePassword(file, password) {
  if (fs.existsSync(file)) throw Error('Lösenord finns redan; filen skrivs inte över');
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) throw Error('Använd 6–128 tecken');
  const salt = randomBytes(16).toString('hex');
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 });
  save(file, { version: 1, salt, hash: (await hash(password, salt)).toString('hex'), mustChange: true, sessions: [], attempts: [] });
}
export class PasswordAuth extends EventEmitter {
  constructor(env, root, primary) {
    super();
    const origin = new URL(env.CHARLOTTENDAL_PUBLIC_ORIGIN);
    if (origin.protocol !== 'https:' || origin.origin !== env.CHARLOTTENDAL_PUBLIC_ORIGIN || !path.isAbsolute(env.CHARLOTTENDAL_AUTH_FILE || '')) throw Error('Lösenordsinloggning kräver HTTPS och en separat lösenordsfil');
    this.origin = origin.origin; this.file = env.CHARLOTTENDAL_AUTH_FILE; this.root = root; this.primary = primary; this.busy = false;
    this.read(); // Refuse startup if the credential store is missing or damaged.
  }
  read() {
    const record = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (record.version !== 1 || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{128}$/.test(record.hash) ||
        typeof record.mustChange !== 'boolean' || !Array.isArray(record.sessions) || !Array.isArray(record.attempts)) throw Error('Ogiltig inloggningsfil');
    return record;
  }
  session(req, record = this.read()) {
    const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return record.sessions.find(s => s.id === digest(token) && s.expires > Date.now()) || null;
  }
  issue(res, record) {
    const token = randomBytes(32).toString('hex'), expires = Date.now() + lifetime;
    record.sessions = record.sessions.filter(s => s.expires > Date.now()).slice(-11);
    record.sessions.push({ id: digest(token), expires });
    save(this.file, record);
    res.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime / 1000}`);
  }
  async authenticate(req) {
    const record = this.read(), session = this.session(req, record);
    if (!session) throw fail('Logga in för att fortsätta');
    if (record.mustChange) throw fail('Byt det tillfälliga lösenordet först', 428);
    return session.expires;
  }
  async handle(req, res, url) {
    const route = url.pathname;
    if (this.primary && ['GET', 'HEAD'].includes(req.method) && ['/login', '/account', '/auth.js', '/auth.css'].includes(route)) {
      staticFile(res, this.root, ['/login', '/account'].includes(route) ? '/auth.html' : route); return true;
    }
    if (this.primary && route === '/api/auth/session' && req.method === 'GET') {
      const record = this.read(), session = this.session(req, record);
      json(res, { authenticated: !!session, mustChange: !!session && record.mustChange }); return true;
    }
    if (this.primary && route.startsWith('/api/auth/') && req.method === 'POST') {
      // Cookie-authenticated writes require an exact Origin, including login/logout.
      if (req.headers.origin !== this.origin) throw fail('Otillåtet ursprung', 403);
      if (this.busy) throw fail('Ett inloggningsförsök pågår. Försök igen om en stund.', 429);
      this.busy = true;
      try {
        const data = await body(req), record = this.read(), session = this.session(req, record);
        if (route === '/api/auth/logout') {
          if (session) { record.sessions = record.sessions.filter(s => s.id !== session.id); save(this.file, record); }
          res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
          this.emit('invalidate'); json(res, { ok: true }); return true;
        }
        if (!['/api/auth/login', '/api/auth/password'].includes(route)) throw fail('Finns inte', 404);
        if (route === '/api/auth/password' && !session) throw fail('Logga in för att fortsätta');
        record.attempts = record.attempts.filter(t => t > Date.now() - 60000);
        if (record.attempts.length >= 5) { res.setHeader('Retry-After', '60'); throw fail('För många försök. Vänta en minut.', 429); }
        record.attempts.push(Date.now()); save(this.file, record);
        const supplied = route === '/api/auth/login' ? data.password : data.currentPassword;
        if (!await matches(supplied, record)) throw fail('Fel lösenord');
        if (route === '/api/auth/password') {
          if (typeof data.newPassword !== 'string' || data.newPassword.length < 6 || data.newPassword.length > 128) throw fail('Välj ett lösenord med 6–128 tecken', 400);
          if (data.newPassword === supplied) throw fail('Välj ett nytt lösenord', 400);
          const salt = randomBytes(16).toString('hex');
          record.salt = salt; record.hash = (await hash(data.newPassword, salt)).toString('hex');
          record.mustChange = false; record.sessions = [];
        }
        record.attempts = [];
        this.issue(res, record);
        if (route === '/api/auth/password') this.emit('invalidate');
        json(res, { ok: true, mustChange: record.mustChange }); return true;
      } finally { this.busy = false; }
    }
    const record = this.read(), session = this.session(req, record);
    if (!session || record.mustChange) {
      if (['GET', 'HEAD'].includes(req.method) && !route.startsWith('/api/')) {
        res.writeHead(303, { Location: '/login', 'Cache-Control': 'no-store' }); res.end(); return true;
      }
      throw fail(session ? 'Byt det tillfälliga lösenordet först' : 'Logga in för att fortsätta', session ? 428 : 401);
    }
    // POST protection also applies to all railway and simulator controls.
    if (req.method === 'POST' && req.headers.origin !== this.origin) throw fail('Otillåtet ursprung', 403);
    return false;
  }
}
