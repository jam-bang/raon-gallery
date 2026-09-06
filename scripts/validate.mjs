import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const manifest = JSON.parse(await readFile(path.join(root, 'gallery.json'), 'utf8'));
assert(Array.isArray(manifest.items) && manifest.items.length > 0);
const ids = new Set();
for (const item of manifest.items) {
  assert(!ids.has(item.id), `Duplicate ID: ${item.id}`); ids.add(item.id);
  assert(item.width > 0 && item.height > 0 && item.bytes > 0);
  assert(['photo', 'video'].includes(item.type));
  for (const filename of [item.thumbnail, item.type === 'photo' ? item.preview : `media/videos/${item.previewName}`].filter(Boolean)) {
    assert(!filename.includes('..') && !path.isAbsolute(filename));
    assert((await stat(path.join(root, filename))).size > 0, filename);
  }
}
assert(manifest.coverId === null || ids.has(manifest.coverId), 'Cover must exist');
for (const archive of manifest.archives) assert(archive.bytes > 0 && archive.count > 0 && !archive.name.includes('/'));
console.log(`Validated ${manifest.items.length} gallery items and their preview assets.`);
