// Åtkomst till TKL och simulatorn. Tre lägen:
//  - lokalt (ingen CHARLOTTENDAL_AUTH_MODE): operatören behöver ingen inloggning; Inställningar, Objekt och regler
//    och deras API kräver en inloggad ägare eller administratör så snart en ägare finns. Innan dess är allt öppet,
//    så att onboardingen kan skapa ägaren.
//  - password (webbdriften, CHARLOTTENDAL_PUBLIC_ORIGIN över HTTPS): inloggning krävs överallt, även för operatören.
//  - cloudflare: JWT-vakten som förut, oförändrad.
// Användarna ligger i users.json (src/users.mjs); sessionen i en HttpOnly-cookie.
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createAccessGuard } from './access.mjs';
import { UserStore, usersFile, checkUsername } from './users.mjs';
import { json, body, staticFile } from './http.mjs';

const fail = (message, status = 401) => Object.assign(Error(message), { status });
// Vad som kräver en inloggad administratör i lokalt läge. Allt annat är operatörens: panelen, tågvägarna, klockan, TrainMeet-rörelser.
const ADMIN_PAGES = new Set(['/studio.html']);
const ADMIN_API = ['/api/studio', '/api/ai', '/api/users', '/api/onboarding', '/api/bindings', '/api/recordings', '/api/update/', '/api/configuration/', '/api/destinations', '/api/note', '/api/trainmeet/configure', '/api/trainmeet/pair', '/api/trainmeet/refresh', '/api/trainmeet/disconnect'];
const STREAMDECK_OPERATOR = new Set(['/api/streamdeck/seen']);
// Rangerarens inloggning ger bara rangerarens vy: sidorna, läsning och /api/ranger/ (docs/rangerlage.md).
const isRangerRoute = (pathname, method) => ['GET', 'HEAD'].includes(method) ? !isAdminRoute(pathname) : pathname.startsWith('/api/ranger/') || pathname.startsWith('/api/auth/');
export function isAdminRoute(pathname) {
  if (ADMIN_PAGES.has(pathname)) return true;
  if (pathname.startsWith('/api/streamdeck/')) return !STREAMDECK_OPERATOR.has(pathname);
  return ADMIN_API.some(p => pathname === p.replace(/\/$/, '') || pathname.startsWith(p.endsWith('/') ? p : p + '/'));
}
// The computer TKL runs on. Everything else on the network logs in, even in local mode.
// A request without a socket (tests, internal calls) is the computer itself.
const isLoopback = req => { const a = req?.socket?.remoteAddress; return !a || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a); };
const safeNext = value => typeof value === 'string' && /^\/(?!\/)[\w./#?=&%-]*$/.test(value) ? value : '/';

export class UserAuth extends EventEmitter {
  constructor({ env = process.env, root, primary = false, stateDir, mode }) {
    super();
    this.mode = mode; this.root = root; this.primary = primary; this.busy = false;
    if (mode === 'external') {
      const origin = new URL(env.CHARLOTTENDAL_PUBLIC_ORIGIN);
      if (origin.protocol !== 'https:' || origin.origin !== env.CHARLOTTENDAL_PUBLIC_ORIGIN || !path.isAbsolute(env.CHARLOTTENDAL_AUTH_FILE || env.CHARLOTTENDAL_USERS_FILE || '')) throw Error('Inloggning i webbdriften kräver HTTPS och en separat användarfil');
      this.origin = origin.origin;
    }
    this.cookieName = mode === 'external' ? '__Host-cda_session' : 'cda_session';
    this.users = new UserStore(usersFile(env, stateDir), { legacyFile: env.CHARLOTTENDAL_AUTH_FILE || null });
  }
  token(req) { return req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(this.cookieName + '='))?.slice(this.cookieName.length + 1) || null; }
  session(req) { return this.users.session(this.token(req)); }
  setCookie(res, token, maxAge) { res.setHeader('Set-Cookie', `${this.cookieName}=${token}; Path=/; HttpOnly; ${this.mode === 'external' ? 'Secure; ' : ''}SameSite=Strict; Max-Age=${maxAge}`); }
  // Vad en begäran kräver: 'user' överallt i webbdriften och från andra datorer på nätet (rangerarens
  // station); 'admin' för administrationen lokalt när en ägare finns; annars inget.
  requirement(url, req = null) {
    if (this.mode === 'external') return 'user';
    if (req && !isLoopback(req)) return 'user';
    return isAdminRoute(url.pathname) && this.users.hasOwner() ? 'admin' : null;
  }
  view(req) {
    const session = this.session(req), hasOwner = this.users.hasOwner();
    return { mode: this.mode, authenticated: !!session, user: session ? { id: session.user.id, username: session.user.username, role: session.user.role } : null,
      mustChange: !!session?.user.mustChange, setup: { needed: !hasOwner, allowed: !hasOwner && this.mode === 'local' && isLoopback(req) }, expires: session?.expires ?? null };
  }
  // Sidor, sessionsfrågan och inloggningsflödet; därefter spärren. true = färdigbehandlad.
  async handle(req, res, url) {
    const route = url.pathname;
    if (this.primary && ['GET', 'HEAD'].includes(req.method) && ['/login', '/account', '/auth.js', '/auth.css'].includes(route)) {
      staticFile(res, this.root, ['/login', '/account'].includes(route) ? '/auth.html' : route); return true;
    }
    if (this.primary && route === '/api/auth/session' && req.method === 'GET') { json(res, this.view(req)); return true; }
    if (this.primary && route.startsWith('/api/auth/') && req.method === 'POST') {
      if (this.mode === 'external' && req.headers.origin !== this.origin) throw fail('Otillåtet ursprung', 403);
      if (this.busy) throw fail('Ett inloggningsförsök pågår. Försök igen om en stund.', 429);
      this.busy = true;
      try {
        const data = await body(req), session = this.session(req);
        if (route === '/api/auth/logout') {
          if (session) this.users.revokeSession(session.id);
          this.setCookie(res, '', 0); this.emit('invalidate'); json(res, { ok: true }); return true;
        }
        let user;
        if (route === '/api/auth/login') user = await this.users.login({ username: data.username, password: data.password });
        else if (route === '/api/auth/redeem') user = await this.users.redeem({ username: data.username, code: data.code, password: data.password });
        else if (route === '/api/auth/setup') {
          if (!this.view(req).setup.allowed) throw fail(this.users.hasOwner() ? 'Det finns redan en ägare. Logga in eller be om en inbjudningskod.' : 'I webbdriften skapas ägaren på servern med scripts/create-owner.mjs.', 409);
          user = await this.users.createOwner({ username: data.username, password: data.password });
        } else if (route === '/api/auth/password') {
          if (!session) throw fail('Logga in för att fortsätta');
          user = await this.users.changePassword(session.user.id, { currentPassword: data.currentPassword, newPassword: data.newPassword });
          this.emit('invalidate');
        } else throw fail('Finns inte', 404);
        const issued = this.users.issueSession(user.id); this.setCookie(res, issued.token, 12 * 3600);
        json(res, { ok: true, mustChange: !!user.mustChange, user: { id: user.id, username: user.username, role: user.role }, next: safeNext(data.next) }); return true;
      } finally { this.busy = false; }
    }
    const required = this.requirement(url, req); if (!required) return false;
    const session = this.session(req);
    if (!session || session.user.mustChange) {
      if (['GET', 'HEAD'].includes(req.method) && !route.startsWith('/api/')) {
        // Bara sidor får en återgång; datafiler och skript som nekas leder till inloggningen rakt av.
        const page = route !== '/' && (!route.includes('.') || route.endsWith('.html')) && !route.startsWith('/data/');
        const next = page ? '?next=' + encodeURIComponent(route) : '';
        res.writeHead(303, { Location: '/login' + next, 'Cache-Control': 'no-store' }); res.end(); return true;
      }
      throw fail(session ? 'Byt det tillfälliga lösenordet först' : 'Logga in för att fortsätta', session ? 428 : 401);
    }
    if (this.mode === 'external' && req.method === 'POST' && req.headers.origin !== this.origin) throw fail('Otillåtet ursprung', 403);
    if (session.user.role === 'ranger' && !isRangerRoute(route, req.method)) throw fail('Rangerarens inloggning ger bara rangerarens vy.', 403);
    return false;
  }
  // Efter handle: vem som frågar. expires styr händelseströmmens livslängd; user är null för operatören lokalt.
  async authenticate(req, url = null) {
    const session = this.session(req);
    if (url && this.requirement(url, req) && !session) throw fail('Logga in för att fortsätta');
    return session ? session.expires : null;
  }
  access(req) { const s = this.session(req); return s ? { expires: s.expires, user: s.user } : { expires: null, user: null }; }
  // Vem som manövrerar: en inloggad rangerare är rangeraren, alla andra är TKL. Aldrig ett fält i anropet.
  operator(req) { return this.session(req)?.user.role === 'ranger' ? 'ranger' : 'tkl'; }
  // Ägarens åtgärder i Inställningar → Användare. Alla inloggade ser listan; bara ägaren ändrar vem som har tillgång.
  requireRole(req, role) {
    const session = this.session(req); if (!session) throw fail('Logga in för att fortsätta');
    if (role === 'owner' && session.user.role !== 'owner') throw fail('Bara ägaren lägger till och tar bort användare.', 403);
    if (session.user.role === 'ranger') throw fail('Rangerarens inloggning ger bara rangerarens vy.', 403);
    return session.user;
  }
}
export function createAuth(root, primary = false, env = process.env, { stateDir } = {}) {
  const dir = stateDir || env.CHARLOTTENDAL_STATE_DIR || path.join(root, '..', 'var');
  if (env.CHARLOTTENDAL_AUTH_MODE === 'password') return new UserAuth({ env, root, primary, stateDir: dir, mode: 'external' });
  if (env.CHARLOTTENDAL_AUTH_MODE === 'cloudflare') return { mode: 'cloudflare', authenticate: createAccessGuard(env), handle: async () => false, on: () => {}, access: () => ({ expires: null, user: null }), users: null, requireRole: () => { throw fail('Användare hanteras inte i det här läget', 409); }, operator: () => 'tkl', view: () => ({ mode: 'cloudflare', authenticated: true, user: null, mustChange: false, setup: { needed: false, allowed: false } }) };
  if (env.CHARLOTTENDAL_AUTH_MODE && env.CHARLOTTENDAL_AUTH_MODE !== 'local') throw Error('Okänt inloggningsläge');
  return new UserAuth({ env, root, primary, stateDir: dir, mode: 'local' });
}
export { checkUsername };
