// Återställning för en utelåst användare: skriver en ny engångskod (sju dagar) som löser in sig på /login under
// "Jag har en inbjudningskod". Tidigare lösenord och inloggningar för användaren slutar gälla.
//   node scripts/recover-user.mjs casper
import { UserStore, usersFile } from '../src/users.mjs';
import { stateDirectory } from '../src/station.mjs';
const username = process.argv[2]; if (!username) { console.error('Ange användarnamn: node scripts/recover-user.mjs <namn>'); process.exit(2); }
let stateDir = process.env.CHARLOTTENDAL_STATE_DIR;
// En uttrycklig sökväg fungerar även vid återställning utan stationens filer.
if (!stateDir && !process.env.CHARLOTTENDAL_USERS_FILE && !process.env.CHARLOTTENDAL_AUTH_FILE) stateDir = stateDirectory();
const file = usersFile(process.env, stateDir);
const store = new UserStore(file, { legacyFile: process.env.CHARLOTTENDAL_AUTH_FILE || null });
const { user, code, expires } = store.recover(username);
console.log(`Inbjudningskod för ${user.username} (${user.role === 'owner' ? 'ägare' : 'administratör'}): ${code}\nGäller till ${new Date(expires).toISOString().slice(0, 16).replace('T', ' ')} UTC. Löses in på /login under "Jag har en inbjudningskod".`);
