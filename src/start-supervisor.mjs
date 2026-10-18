// Två barnprocesser, en station. Vid stationsbyte får den gamla servern spara och avsluta före nästa start.
import { spawn as nodeSpawn } from 'node:child_process';
import path from 'node:path';
import { readInstallationSelection, resolveInstallationStart } from './installation-station.mjs';

async function stopChildren(children, timeout, requireCleanExit = false) {
  const remaining = children.filter(child => child.pid && child.exitCode === null && child.signalCode === null);
  let timer;
  try {
    if (remaining.length) await Promise.race([
        Promise.all(remaining.map(child => new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); }))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('TKL kunde inte avslutas kontrollerat. Ingen annan station startas.')), timeout); })
      ]);
    if (requireCleanExit && children.some(child => child.exitCode !== 0 || child.signalCode !== null)) throw Error('En TKL-process avslutades med fel eller signal. Ingen annan station startas.');
  } catch (error) { for (const child of remaining) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); throw error; }
  finally { clearTimeout(timer); }
}
export async function runInstallation({ root, env = process.env, args = [], signal, spawn = nodeSpawn, stdio = 'inherit', shutdownMs = 10000 } = {}) {
  let start = resolveInstallationStart({ root, env, args });
  while (!signal?.aborted) {
    const children = [], cleanups = [];
    const event = await new Promise(resolve => {
      let decided = false; const finish = result => { if (!decided) { decided = true; resolve(result); } };
      const abort = () => finish({ stop: true }); signal?.addEventListener('abort', abort, { once: true }); cleanups.push(() => signal?.removeEventListener('abort', abort));
      for (const file of ['src/simulator.mjs', 'src/server.mjs']) {
        const server = file === 'src/server.mjs';
        const child = spawn(process.execPath, [path.join(root, file)], { cwd: root, env: start.env, stdio: server ? (Array.isArray(stdio) ? [...stdio.slice(0, 3), 'ipc'] : [stdio, stdio, stdio, 'ipc']) : stdio });
        children.push(child);
        child.once('error', error => finish({ error }));
        child.once('exit', (code, sig) => finish({ code: code ?? (sig ? 1 : 0) }));
        if (server) child.on('message', message => {
          if (message?.type !== 'tkl-station-change' || start.env.TKL_STATION_SELECTION !== 'managed') return;
          try {
            const config = readInstallationSelection(start.file);
            if (!config || config.stationId !== message.stationId || !config.requireTrainMeetConnect) throw Error('Stationsbytet saknar ett sparat installationsval.');
            finish({ restart: true });
          } catch (error) { finish({ error }); }
        });
      }
      if (signal?.aborted) abort();
    });
    for (const cleanup of cleanups) cleanup();
    await stopChildren(children, shutdownMs, !!event.restart);
    if (event.error) throw event.error;
    if (!event.restart || signal?.aborted) return event.code || 0;
    start = resolveInstallationStart({ root, env, args });
  }
  return 0;
}
