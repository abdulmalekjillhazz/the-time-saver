const CACHE_NAME = 'smart-routine-pwa-v3';
const PRECACHE_URLS = ['/app', '/brand-logo.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((key) => key.startsWith('smart-routine-pwa-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  const isAppShell = event.request.mode === 'navigate'
    && url.pathname.replace(/\/$/, '') === '/app'
    && !url.search;
  const isNextAsset = url.origin === self.location.origin
    && url.pathname.startsWith('/_next/static/')
    && ['script', 'style', 'font', 'image', 'worker'].includes(event.request.destination);
  if (!isAppShell && !isNextAsset) return;
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      try {
        const response = await fetch(event.request);
        if (response.ok && url.origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const isAlarm = typeof payload.tag === 'string' && payload.tag.startsWith('smart-routine-alarm-');
  const actions = Array.isArray(payload.actions)
    ? payload.actions.slice(0, 2).map((action) => ({ action: String(action.action || 'open'), title: String(action.title || '') }))
    : [];

  event.waitUntil(self.registration.showNotification(payload.title || 'Smart Routine', {
    body: payload.body || '',
    icon: '/brand-logo.png',
    badge: '/brand-logo.png',
    tag: payload.tag || 'smart-routine-notification',
    requireInteraction: payload.requireInteraction === true || isAlarm,
    renotify: isAlarm,
    vibrate: isAlarm ? [300, 100, 300, 100, 300] : undefined,
    actions,
    data: {
      url: payload.url || '/app',
      snoozeUrl: payload.snoozeUrl || null,
    },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = event.action === 'snooze' && data.snoozeUrl
    ? new URL(data.snoozeUrl, self.location.origin).href
    : new URL(data.url || '/app', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
