import { createAccessGuard } from './access.mjs';
import { PasswordAuth } from './password-auth.mjs';
export function createAuth(root, primary = false, env = process.env) {
  if (env.CHARLOTTENDAL_AUTH_MODE === 'password') return new PasswordAuth(env, root, primary);
  if (env.CHARLOTTENDAL_AUTH_MODE && env.CHARLOTTENDAL_AUTH_MODE !== 'cloudflare') throw Error('Okänt inloggningsläge');
  return { authenticate: createAccessGuard(env), handle: async () => false, on: () => {} };
}
