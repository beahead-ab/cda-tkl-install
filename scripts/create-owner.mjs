// Skapar den första ägaren när ingen användare finns: e-postadressen som argument, lösenordet via standard input.
// Används i webbdriften (där ägaren inte kan skapas från webbläsaren) och vid återställning av en tom installation.
//   printf '%s\n' "$PASSWORD" | CHARLOTTENDAL_AUTH_FILE=/var/lib/charlottendal-auth/auth.json node scripts/create-owner.mjs casper@example.se
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UserStore, usersFile } from '../src/users.mjs';
const username = process.argv[2]; if (!username) { console.error('Ange e-post: node scripts/create-owner.mjs <e-post> < lösenordsfil'); process.exit(2); }
const file = usersFile(process.env, process.env.CHARLOTTENDAL_STATE_DIR || fileURLToPath(new URL('../var', import.meta.url)));
const password = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
const store = new UserStore(file, { legacyFile: process.env.CHARLOTTENDAL_AUTH_FILE || null });
const user = await store.createOwner({ username, password });
console.log(`Ägaren ${user.username} skapad i ${file}. Logga in i panelen; fler användare bjuds in under Inställningar → Användare.`);
