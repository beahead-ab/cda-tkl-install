import fs from 'node:fs';
import path from 'node:path';
export class Storage {
  constructor(directory) { this.directory = directory; fs.mkdirSync(directory, { recursive: true }); }
  load(name, fallback) {
    try { return JSON.parse(fs.readFileSync(path.join(this.directory, name), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return fallback; throw Error(`Kan inte läsa ${name}: ${e.message}`); }
  }
  save(name, value) {
    const file = path.join(this.directory, name), temp = file + '.tmp';
    const fd = fs.openSync(temp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, file);
  }
  event(event) {
    const file = path.join(this.directory, 'events.ndjson');
    if (fs.existsSync(file) && fs.statSync(file).size > 5_000_000) fs.renameSync(file, file + '.previous');
    fs.appendFileSync(file, JSON.stringify(event) + '\n', { mode: 0o600 });
  }
}
