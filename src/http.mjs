import fs from 'node:fs';
import path from 'node:path';
export function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
export function guard(req, port, publicOrigin = process.env.CHARLOTTENDAL_PUBLIC_ORIGIN) {
  const allowed = publicOrigin ? new Set([new URL(publicOrigin).host]) : new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  const origins = publicOrigin ? [publicOrigin] : [...allowed].map(h => 'http://' + h);
  if (!allowed.has(req.headers.host)) throw Error('Otillåten värd');
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) throw Error('Otillåten metod');
  if (req.method === 'POST') {
    if (req.headers.origin && !origins.includes(req.headers.origin)) throw Error('Otillåtet ursprung');
    if (req.headers['sec-fetch-site'] === 'cross-site') throw Error('Otillåtet ursprung');
    if (!req.headers['content-type']?.startsWith('application/json')) throw Error('JSON krävs');
  }
}
export async function body(req,limit=65536) {
  let size=0;const chunks=[];
  for await (const chunk of req) {size+=chunk.length;if(size>limit)throw Object.assign(Error('För stor begäran'),{status:413});chunks.push(chunk);}
  const text=Buffer.concat(chunks).toString('utf8');return text?JSON.parse(text):{};
}
export function staticFile(res, root, requested) {
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { json(res, { error: 'Sidan finns inte' }, 404); return; }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'" });
  fs.createReadStream(file).pipe(res);
}
