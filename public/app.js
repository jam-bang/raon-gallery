/* Vanilla JavaScript: relative paths keep GitHub project pages working. */
const $ = (selector) => document.querySelector(selector);
const config = window.RAON_CONFIG || {};
const state = { items: [], archives: [], filtered: [], filter: 'all', index: 0 };
const viewer = $('#viewer');
const downloads = $('#downloads');
const size = (bytes) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const duration = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
function assetUrl(base, filename) {
  if (!base || !filename) return null;
  const url = new URL(`${base.replace(/\/$/, '')}/${encodeURIComponent(filename)}`, location.href);
  return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function wireDownload(anchor, url, name) {
  anchor.href = url;
  anchor.download = name;
  // External file hosts should send Content-Disposition: attachment.
  if (new URL(url).origin !== location.origin) { anchor.target = '_blank'; anchor.rel = 'noopener'; }
  else { anchor.removeAttribute('target'); anchor.removeAttribute('rel'); }
}
function renderGrid() {
  state.filtered = state.items.filter((item) => state.filter === 'all' || item.type === state.filter);
  const fragment = document.createDocumentFragment();
  for (const [index, item] of state.filtered.entries()) {
    const card = element('article', 'media-card');
    const button = element('button', 'card-image');
    button.setAttribute('aria-label', `${item.type === 'photo' ? '사진' : '영상'} ${item.name} 크게 보기`);
    const img = element('img');
    img.src = item.thumbnail; img.alt = `라온태권도 시범단 공연 ${item.type === 'photo' ? '사진' : '영상'} ${index + 1}`;
    img.width = item.width; img.height = item.height; img.loading = index < 8 ? 'eager' : 'lazy'; img.decoding = 'async';
    button.append(img);
    if (item.type === 'video') {
      button.append(element('span', 'card-badge', '▶ 영상'), element('span', 'play-icon', '▶'));
      if (item.duration) button.append(element('span', 'duration', duration(item.duration)));
    }
    button.addEventListener('click', () => openViewer(index));
    const meta = element('div', 'card-meta');
    const info = element('div');
    info.append(element('p', 'card-title', item.name), element('p', 'card-subtitle', `${item.type === 'photo' ? '사진' : '영상'} · ${size(item.bytes)}`));
    meta.append(info);
    const url = assetUrl(config.originalsBaseUrl, item.name);
    if (url) {
      const link = element('a', 'card-download', '↓');
      link.setAttribute('aria-label', `${item.name} 원본 다운로드`);
      wireDownload(link, url, item.name); meta.append(link);
    }
    card.append(button, meta); fragment.append(card);
  }
  $('#media-grid').replaceChildren(fragment);
  $('#end-note').textContent = state.filtered.length ? `${state.filter === 'photo' ? '사진' : state.filter === 'video' ? '영상' : '사진과 영상'} ${state.filtered.length}개 · 함께해 주셔서 감사합니다.` : '아직 등록된 항목이 없습니다.';
  for (const button of document.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
}
function showCurrent() {
  const item = state.filtered[state.index];
  $('#viewer-content').querySelector('video')?.pause();
  $('#viewer-content').replaceChildren();
  $('#viewer-index').textContent = `${item.type === 'photo' ? 'PHOTO' : 'VIDEO'}  /  ${String(state.index + 1).padStart(2, '0')} — ${state.filtered.length}`;
  $('#viewer-name').textContent = item.name;
  $('#viewer-detail').textContent = `${item.width} × ${item.height} · 원본 ${size(item.bytes)}${item.duration ? ` · ${duration(item.duration)}` : ''}`;
  const url = assetUrl(config.originalsBaseUrl, item.name);
  $('#viewer-download').hidden = !url;
  if (url) wireDownload($('#viewer-download'), url, item.name);
  const media = element(item.type === 'photo' ? 'img' : 'video');
  if (item.type === 'photo') { media.src = item.preview; media.alt = `${item.name} — 라온태권도 시범단 공연`; }
  else {
    const source = assetUrl(config.videosBaseUrl, item.previewName);
    if (!source) { $('#viewer-content').append(element('p', 'media-error', '영상 미리보기를 준비하고 있습니다. 조금만 기다려 주세요.')); updateNav(); return; }
    media.src = source; media.poster = item.thumbnail; media.controls = true; media.playsInline = true; media.preload = 'metadata';
  }
  media.addEventListener('error', () => { $('#viewer-content').replaceChildren(element('p', 'media-error', '미리보기를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.')); }, { once: true });
  $('#viewer-content').append(media);
  updateNav();
}
function updateNav() { $('#viewer-prev').disabled = state.index === 0; $('#viewer-next').disabled = state.index === state.filtered.length - 1; }
function openViewer(index) { state.index = index; showCurrent(); viewer.showModal(); $('#viewer-close').focus(); }
function navigate(offset) { const next = state.index + offset; if (next >= 0 && next < state.filtered.length) { state.index = next; showCurrent(); } }
$('#viewer-prev').addEventListener('click', () => navigate(-1));
$('#viewer-next').addEventListener('click', () => navigate(1));
$('#viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () => { const video = $('#viewer-content video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } });
viewer.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'VIDEO') return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); navigate(1); }
});
let touchStart = null;
$('#viewer-content').addEventListener('touchstart', (event) => { touchStart = event.touches.length === 1 && event.target.tagName === 'IMG' ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }, { passive: true });
$('#viewer-content').addEventListener('touchend', (event) => { if (!touchStart) return; const dx = event.changedTouches[0].clientX - touchStart.x; const dy = event.changedTouches[0].clientY - touchStart.y; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx > 0 ? -1 : 1); touchStart = null; }, { passive: true });
for (const dialog of [viewer, downloads]) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => { state.filter = button.dataset.filter; renderGrid(); });
$('#download-all').addEventListener('click', () => downloads.showModal());
$('#downloads-close').addEventListener('click', () => downloads.close());
async function init() {
  try {
    const response = await fetch('gallery.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    state.items = manifest.items; state.archives = manifest.archives;
    const photos = state.items.filter((item) => item.type === 'photo');
    $('#count-all').textContent = state.items.length; $('#count-photo').textContent = photos.length; $('#count-video').textContent = state.items.length - photos.length; $('#total-count').textContent = state.items.length;
    const cover = photos.find((item) => item.id === manifest.coverId) || photos[0];
    if (cover) $('#cover-image').src = cover.preview;
    else $('.cover').hidden = true;
    $('#collection-note').textContent = config.originalsBaseUrl ? '미리보기는 가볍게, 다운로드는 원본으로.' : '사진을 누르면 크게 볼 수 있어요.';
    const availableArchives = state.archives.filter((archive) => assetUrl(config.archivesBaseUrl, archive.name));
    $('#download-all').disabled = !availableArchives.length;
    const pending = [];
    if (!config.originalsBaseUrl || !availableArchives.length) pending.push('원본 다운로드');
    if (state.items.some(item => item.type === 'video') && !config.videosBaseUrl) pending.push('영상 미리보기');
    if (pending.length) $('#status').textContent = `${pending.join('와 ')}를 준비하고 있습니다. 준비되는 대로 연결됩니다.`;
    for (const archive of availableArchives) {
      const link = element('a', 'archive-link'); const copy = element('span', '', archive.label);
      copy.append(element('small', '', `${archive.count}개 · ZIP · ${size(archive.bytes)}`));
      link.append(copy, element('span', '', '↓'));
      wireDownload(link, assetUrl(config.archivesBaseUrl, archive.name), archive.name); $('#archive-list').append(link);
    }
    renderGrid();
  } catch (error) {
    $('#status').textContent = '사진과 영상을 불러오지 못했습니다. 잠시 후 페이지를 새로고침해 주세요.';
    $('#collection-note').textContent = ''; $('#end-note').textContent = ''; console.error(error);
  }
}
init();
