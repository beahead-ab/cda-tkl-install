import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const children = ['src/simulator.mjs', 'src/server.mjs'].map(file => spawn(process.execPath, [file], { cwd: root, stdio: 'inherit', env: {...process.env,CHARLOTTENDAL_CONNECTION_MODE:'simulator',CHARLOTTENDAL_WIRE_HOST:'127.0.0.1'} }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const c of children) c.kill('SIGTERM'); setTimeout(() => process.exit(code), 750); }
for (const c of children) c.on('exit', code => stop(code || 0));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
