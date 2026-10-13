self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  // Alarms must grab attention even with the app closed: vibrate, stay on
  // screen until dismissed, and offer Open / Snooze actions. A custom voice
  // or azan file cannot play from a service worker (no audio APIs), so the
  // phone's default notification sound is used.
  const isAlarm = typeof payload.tag === 'string' && payload.tag.startsWith('smart-routine-alarm-');
  const actions = Array.isArray(payload.actions)
    ? payload.actions.slice(0, 2).map((action) => ({ action: String(action.action || 'open'), title: String(action.title || '') }))
    : [];

  event.waitUntil(self.registration.showNotification(payload.title || 'Smart Routine', {
    body: payload.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
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
  // The snooze action deep-links back into the app, which snoozes the alarm
  // itself (the worker cannot call the authenticated API).
  const target = event.action === 'snooze' && data.snoozeUrl
    ? new URL(data.snoozeUrl, self.location.origin).href
    : new URL(data.url || '/app', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
