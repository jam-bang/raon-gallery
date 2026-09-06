/* A small, bounded carousel: two visible layers, one timer, no bulk preloading. */
window.initCoverCarousel = function initCoverCarousel(items, config) {
  const root = document.querySelector('.cover-carousel');
  const slides = document.querySelector('#cover-slides');
  const toggle = document.querySelector('#cover-toggle');
  const previous = document.querySelector('#cover-prev');
  const next = document.querySelector('#cover-next');
  const kind = document.querySelector('#cover-kind');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const photos = items.filter(item => item.type === 'photo');
  const widePhotos = photos.filter(item => item.width >= item.height);
  const videos = config.videosBaseUrl ? items.filter(item => item.type === 'video') : [];
  const photoPool = widePhotos.length ? widePhotos : photos;
  if (!photoPool.length && !videos.length) { root.hidden = true; return; }

  function shuffled(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  let photoQueue = [], videoQueue = [], sequence = 0;
  const history = [];
  let cursor = -1, frame = null, current = null, timer, generation = 0;
  let manuallyPaused = motion.matches, onScreen = true;
  const canRun = () => !manuallyPaused && onScreen && !document.hidden && !document.querySelector('dialog[open]');
  const holdTime = () => current?.type === 'video' ? 9000 : 6000;

  function pick() {
    // Two photos, then a video. Shuffle each pool without repeats until exhausted.
    const useVideo = videos.length && (!photoPool.length || sequence % 3 === 2);
    sequence++;
    let queue = useVideo ? videoQueue : photoQueue;
    if (!queue.length) {
      queue = shuffled(useVideo ? videos : photoPool);
      if (queue.length > 1 && queue[0].id === history.at(-1)?.id) queue.push(queue.shift());
      if (useVideo) videoQueue = queue;
      else photoQueue = queue;
    }
    return queue.shift();
  }

  function release(node) {
    if (!node) return;
    const video = node.querySelector('video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    node.remove();
  }

  function schedule(delay = holdTime()) {
    clearTimeout(timer);
    if (canRun()) timer = setTimeout(() => advance(1), delay);
  }

  function sync() {
    clearTimeout(timer);
    root.classList.toggle('is-paused', !canRun());
    toggle.setAttribute('aria-pressed', String(manuallyPaused));
    toggle.setAttribute('aria-label', manuallyPaused ? '자동 재생 시작' : '자동 재생 일시정지');
    toggle.title = manuallyPaused ? '자동 재생 시작' : '자동 재생 일시정지';
    toggle.firstElementChild.textContent = manuallyPaused ? '▶' : 'Ⅱ';
    const video = frame?.querySelector('video');
    if (canRun()) {
      // If a browser blocks autoplay, keep the poster and continue the slideshow.
      video?.play().then(() => { if (!canRun()) video.pause(); }).catch(() => {});
      if (current) schedule();
    } else video?.pause();
  }

  async function prepareImage(source) {
    const image = new Image();
    image.decoding = 'async';
    image.alt = '';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('Image load timed out')), 10000);
      const finish = error => {
        clearTimeout(timeout);
        image.onload = null; image.onerror = null;
        if (error) reject(error); else resolve();
      };
      image.onload = () => finish();
      image.onerror = () => finish(new Error('Image could not load'));
      image.src = source;
    });
    return image;
  }

  async function show(item) {
    clearTimeout(timer);
    const request = ++generation;
    try {
      const poster = await prepareImage(item.type === 'photo' ? item.preview : item.thumbnail);
      if (request !== generation) return;
      const layer = document.createElement('div');
      layer.className = 'cover-slide';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.setProperty('--slide-duration', `${item.type === 'video' ? 10 : 7}s`);
      if (item.type === 'photo') layer.append(poster);
      else {
        const video = document.createElement('video');
        video.muted = true; video.defaultMuted = true; video.playsInline = true;
        video.loop = true; video.preload = 'metadata'; video.poster = poster.src;
        video.tabIndex = -1; video.setAttribute('aria-hidden', 'true');
        const url = new URL(`${config.videosBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(item.previewName)}`, location.href);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported media URL');
        video.src = url.href;
        video.addEventListener('error', () => {
          if (!video.isConnected) return;
          video.pause(); video.removeAttribute('src');
          video.replaceWith(poster);
        }, { once: true });
        layer.append(video);
      }
      // A fast sequence of manual clicks must not accumulate media elements.
      for (const old of [...slides.children]) if (old !== frame) release(old);
      const outgoing = frame;
      slides.append(layer);
      frame = layer; current = item;
      kind.textContent = item.type === 'video' ? 'VIDEO · 소리 없이 재생' : 'PHOTO · 라온의 순간';
      previous.disabled = cursor <= 0;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (request !== generation || frame !== layer) return;
        layer.classList.add('is-visible');
        outgoing?.classList.remove('is-visible');
        outgoing?.querySelector('video')?.pause();
        setTimeout(() => { if (outgoing !== frame) release(outgoing); }, 1100);
      }));
      sync();
    } catch {
      if (request !== generation) return;
      // Keep the current image during transient network failures.
      kind.textContent = current ? 'HIGHLIGHTS' : '하이라이트를 불러오는 중입니다';
      previous.disabled = cursor <= 0;
      schedule(2500);
    }
  }

  function advance(direction) {
    if (direction < 0 && cursor <= 0) return;
    if (direction > 0 && cursor === history.length - 1) {
      history.push(pick());
      if (history.length > 50) { history.shift(); cursor--; }
    }
    cursor += direction;
    show(history[cursor]);
  }

  toggle.addEventListener('click', () => { manuallyPaused = !manuallyPaused; sync(); });
  previous.addEventListener('click', () => advance(-1));
  next.addEventListener('click', () => advance(1));
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', event => { if (event.matches) manuallyPaused = true; sync(); });
  // Suspend motion offscreen and while a photo viewer or download dialog is open.
  const observer = new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); }, { threshold: 0.15 });
  observer.observe(root);
  const dialogs = new MutationObserver(sync);
  for (const dialog of document.querySelectorAll('dialog')) dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  sync();
  advance(1);
};
