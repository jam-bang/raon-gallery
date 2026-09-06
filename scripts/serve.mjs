import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.zip': 'application/zip' };
function fail(res, code, message) { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(message); }
export function parseRange(value, total) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || total === 0) return false;
  let start, end;
  if (!match[1]) { const count = Number(match[2]); if (!Number.isSafeInteger(count) || count <= 0) return false; start = Math.max(0, total - count); end = total - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= total || end < start) return false;
  return { start, end };
}
export function createGalleryServer() {
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return fail(res, 405, 'Method not allowed'); }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { return fail(res, 400, 'Invalid URL'); }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) return fail(res, 403, 'Forbidden');
    try {
      let local;
      try { local = JSON.parse(await readFile(path.join(root, '.local/source.json'), 'utf8')); } catch { /* Static preview without originals. */ }
      if (pathname === '/config.js' && local) {
        const body = 'window.RAON_CONFIG = ' + JSON.stringify({ originalsBaseUrl: 'media/originals', videosBaseUrl: 'media/videos', archivesBaseUrl: 'media/archives' }) + ';';
        res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store' }); return res.end(req.method === 'HEAD' ? undefined : body);
      }
      let target;
      if (pathname.startsWith('/media/originals/') && local) {
        const name = pathname.slice('/media/originals/'.length);
        if (!local.files.includes(name) || path.basename(name) !== name) return fail(res, 404, 'File not found');
        target = path.join(local.source, name);
      } else {
        target = path.resolve(publicDir, '.' + (pathname === '/' ? '/index.html' : pathname));
        const resolved = await realpath(target);
        if (!resolved.startsWith(publicDir + path.sep)) return fail(res, 403, 'Forbidden');
      }
      const info = await stat(target);
      if (!info.isFile()) return fail(res, 404, 'File not found');
      const headers = { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
      if (pathname.startsWith('/media/originals/') || pathname.startsWith('/media/archives/')) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(target))}`;
      const range = parseRange(req.headers.range, info.size);
      if (range === false) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }); return res.end(); }
      if (range) { headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`; headers['Content-Length'] = range.end - range.start + 1; }
      else headers['Content-Length'] = info.size;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') return res.end();
      const stream = createReadStream(target, range || {});
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    } catch (error) { if (!res.headersSent) fail(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'File not found' : 'Unable to load file'); else res.destroy(); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createGalleryServer();
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Raon Gallery: http://127.0.0.1:${server.address().port}`));
}
