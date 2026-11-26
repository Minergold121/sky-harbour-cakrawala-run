// Dev server for SKY HARBOUR (Node 22, standard library only).
// Serves game/ on http://localhost:8080 (or --port <n>) so the game
// can be played and screenshotted in desktop Chrome. Nothing else:
// no logging of bodies, no paths outside game/.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const wanted = portArg === -1 ? 8080 : Number(argv[portArg + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, ''));
  const file = join(gameRoot, rel);
  if (!file.startsWith(gameRoot + sep) && file !== gameRoot) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let info;
  try {
    info = statSync(file);
  } catch {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`SKY HARBOUR dev server: http://localhost:${port}`);
});
