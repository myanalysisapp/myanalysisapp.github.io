/* ==========================================================================
   Service worker: приложение целиком кладётся в кэш при установке,
   дальше работает офлайн. Сеть используется только для обновления файлов
   самого приложения — данные пациента никуда не отправляются.
   ========================================================================== */

const VERSION = 'moy-analiz-v25';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',

  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './css/desktop.css',
  './css/print.css',

  './js/app.js',
  './js/ui.js',
  './js/db.js',
  './js/store.js',
  './js/catalog.js',
  './js/charts.js',
  './js/qr.js',
  './js/demo.js',
  './js/screens/onboarding.js',
  './js/screens/today.js',
  './js/screens/labs.js',
  './js/screens/trends.js',
  './js/screens/meds.js',
  './js/screens/more.js',
  './js/screens/quickadd.js',
  './js/screens/reports.js',
  './js/screens/safety.js',
  './js/screens/sos.js',
  './js/screens/a2hs.js',
  './js/screens/calendar.js',
  './js/screens/checkin.js',
  './js/parse.js',
  './js/pets.js',
  './js/screens/labsnav.js',
  './js/screens/tour.js',

  './assets/fonts/nunito-var.woff',
  './assets/pets/cat-sleep.png',
  './assets/pets/cat-happy.png',
  './assets/pets/dog-sleep.png',
  './assets/pets/dog-happy.png',
  './assets/pets/hedgehog-sleep.png',
  './assets/pets/hedgehog-happy.png',
  './assets/pets/badger-sleep.png',
  './assets/pets/badger-happy.png',
  './assets/pets/badger-hi.png',
  './assets/pets/badger-talk.png',
  './assets/pets/badger-wink.png',
  './assets/pets/badger-bye.png',

  './assets/favicon.svg',
  './assets/logo.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    /* по одному: один отсутствующий файл не должен рушить всю установку */
    await Promise.all(ASSETS.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // чужих доменов в приложении нет

  /* служебные адреса локального сервера кэшировать нельзя:
     это пульс «вкладка открыта», а не содержимое приложения */
  if (url.pathname.startsWith('/__')) return;

  /* навигация: сначала сеть (чтобы подхватить обновление), офлайн — из кэша */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  /* статика: сначала кэш, параллельно тихо обновляем */
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
