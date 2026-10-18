import { fileURLToPath } from 'node:url';
import { runInstallation } from '../src/start-supervisor.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const controller = new AbortController();
process.on('SIGINT', () => controller.abort()); process.on('SIGTERM', () => controller.abort());
try { process.exitCode = await runInstallation({ root, args: process.argv.slice(2), signal: controller.signal }); }
catch (error) { console.error(error.message); process.exitCode = 1; }
