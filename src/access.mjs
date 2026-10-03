import { createRemoteJWKSet, jwtVerify } from 'jose';

// Public deployments fail closed unless the complete Access configuration exists.
// Forwarded email/Host headers alone are never proof of authentication.
export function createAccessGuard(env = process.env, keys) {
  if (!env.CHARLOTTENDAL_PUBLIC_ORIGIN) return async () => null;
  const origin = new URL(env.CHARLOTTENDAL_PUBLIC_ORIGIN);
  const issuer = env.CHARLOTTENDAL_ACCESS_ISSUER;
  const audience = env.CHARLOTTENDAL_ACCESS_AUD;
  const email = env.CHARLOTTENDAL_ACCESS_EMAIL?.toLowerCase();
  if (origin.protocol !== 'https:' || origin.origin !== env.CHARLOTTENDAL_PUBLIC_ORIGIN ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') || !audience || !email) {
    throw Error('Publik drift kräver HTTPS och fullständig Cloudflare Access-konfiguration');
  }
  const jwks = keys || createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs'), { timeoutDuration: 5000 });
  return async req => {
    try {
      const token = req.headers['cf-access-jwt-assertion'];
      if (typeof token !== 'string' || token.length > 16384) throw Error();
      const { payload } = await jwtVerify(token, jwks, {
        issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'],
      });
      if (payload.email?.toLowerCase() !== email) throw Error();
      return payload.exp * 1000;
    } catch {
      throw Object.assign(Error('Inloggning krävs'), { status: 403 });
    }
  };
}
