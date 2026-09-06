(() => {
  const config = window.RAON_CONFIG || {};
  const endpoint = config.analyticsBaseUrl
    ? `${config.analyticsBaseUrl.replace(/\/$/, '')}/api/events`
    : null;
  const NAME_KEY = 'raon-gallery-visitor-name';
  const SESSION_KEY = 'raon-gallery-session-id';

  function sessionId() {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, value);
    }
    return value;
  }

  function visitorName() {
    return (sessionStorage.getItem(NAME_KEY) || '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 40);
  }

  function deviceType() {
    const agent = navigator.userAgent || '';
    if (/iPad|Tablet|PlayBook|Silk/i.test(agent) || (/Android/i.test(agent) && !/Mobile/i.test(agent))) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(agent)) return 'mobile';
    if (navigator.userAgent) return 'desktop';
    return 'unknown';
  }

  function send(eventType, details = {}) {
    if (!endpoint) return;
    const payload = {
      eventType,
      visitorName: visitorName(),
      sessionId: sessionId(),
      ...details,
    };
    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest?.('[data-download-file]');
      if (link?.dataset.downloadFile) send('download', { fileName: link.dataset.downloadFile });
    },
    true,
  );

  window.RAON_ANALYTICS = {
    setVisitorName(value) {
      const cleaned = String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 40);
      sessionStorage.setItem(NAME_KEY, cleaned);
    },
    trackAccess() {
      send('access', { deviceType: deviceType() });
    },
  };
})();

