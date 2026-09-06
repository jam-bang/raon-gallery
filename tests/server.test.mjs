import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createGalleryServer, parseRange } from '../scripts/serve.mjs';
let server, origin;
before(async () => { server = createGalleryServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
test('byte ranges cover seeking, suffixes and invalid requests', () => {
  assert.deepEqual(parseRange('bytes=2-6', 10), { start: 2, end: 6 });
  assert.deepEqual(parseRange('bytes=8-', 10), { start: 8, end: 9 });
  assert.deepEqual(parseRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(parseRange('bytes=8-999', 10), { start: 8, end: 9 });
  for (const range of ['bytes=10-', 'bytes=4-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5']) assert.equal(parseRange(range, 10), false);
});
test('static page and partial media responses work', async () => {
  const full = await fetch(`${origin}/index.html`); assert.equal(full.status, 200); const text = await full.text(); assert.match(text, /라온의 순간/); assert.match(text, /data-access="locked"/); assert.match(text, /auth\.js/);
  const auth = await fetch(`${origin}/auth.js`); assert.equal(auth.status, 200); assert.match(await auth.text(), /crypto\.subtle\.digest/);
  const partial = await fetch(`${origin}/index.html`, { headers: { Range: 'bytes=0-14' } }); assert.equal(partial.status, 206); assert.equal(await partial.text(), '<!doctype html>');
  const head = await fetch(`${origin}/index.html`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});
test('private files and unknown originals are inaccessible', async () => {
  for (const target of ['/.git/config', '/.local/source.json', '/%2e%2e%5cpackage.json', '/media/originals/unknown.JPG']) {
    const response = await fetch(origin + target); assert.ok([403, 404].includes(response.status), target);
  }
  const post = await fetch(`${origin}/index.html`, { method: 'POST' }); assert.equal(post.status, 405);
});
