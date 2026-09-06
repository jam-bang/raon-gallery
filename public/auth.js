const ACCESS_HASH = 'febdc00125b065b552439e92fcdad028f514b1c9d8f8c8242ca78bdfd3d550db';
const ACCESS_SESSION_KEY = 'raon-gallery-access';
const gate = document.querySelector('#access-gate');
const form = document.querySelector('#access-form');
const input = document.querySelector('#access-password');
const message = document.querySelector('#access-message');
let bootPromise;

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${source} load failed`));
    document.head.append(script);
  });
}

function bootGallery() {
  if (!bootPromise) {
    bootPromise = loadScript('config.js')
      .then(() => loadScript('cover.js'))
      .then(() => loadScript('app.js'));
  }
  return bootPromise;
}

async function grantAccess(hash) {
  sessionStorage.setItem(ACCESS_SESSION_KEY, hash);
  message.textContent = '갤러리를 불러오고 있습니다.';
  form.querySelector('button').disabled = true;
  try {
    await bootGallery();
    document.documentElement.dataset.access = 'unlocked';
    gate.hidden = true;
  } catch (error) {
    form.querySelector('button').disabled = false;
    message.textContent = '갤러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    console.error(error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const hash = await digest(input.value);
  if (hash !== ACCESS_HASH) {
    input.value = '';
    input.setAttribute('aria-invalid', 'true');
    message.textContent = '비밀번호가 맞지 않습니다.';
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  await grantAccess(hash);
});

if (sessionStorage.getItem(ACCESS_SESSION_KEY) === ACCESS_HASH) grantAccess(ACCESS_HASH);
else input.focus();
