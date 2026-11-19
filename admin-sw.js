// Service worker del back office di Pioveva: solo notifiche sul telefono, nessuna cache.
// Portato dal back office di Vitalia (già provato su iPhone e Android). Lo registra solo /admin.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

var BASE = self.location.pathname.replace(/\/admin-sw\.js$/, '');

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (err) { data = {}; }
  event.waitUntil(self.registration.showNotification(data.title || 'Pioveva', {
    body: data.body || '',
    icon: BASE + '/admin-app/icon-192.png',
    badge: BASE + '/admin-app/badge-96.png',
    tag: data.tag || 'pioveva',
    renotify: true,
    requireInteraction: !!data.urgent,
    data: { url: data.url ? BASE + data.url : BASE + '/admin' }
  }));
});

// Tocca la notifica: porta in primo piano il pannello già aperto, altrimenti lo apre.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || BASE + '/admin';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/admin') !== -1 && 'focus' in list[i]) { list[i].navigate && list[i].navigate(url); return list[i].focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});

// Il servizio push del telefono a volte cambia indirizzo (Chrome e Safari lo fanno dopo un po'):
// si manda quello nuovo con il vecchio come prova, così le notifiche non si fermano in silenzio.
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil((async function () {
    var old = event.oldSubscription;
    var key = old && old.options && old.options.applicationServerKey;
    var next = event.newSubscription;
    if (!next) { if (!key) return; next = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }
    var api = '';
    try {
      var cfg = await fetch(BASE + '/admin-app/config.json').then(function (r) { return r.json(); });
      api = cfg.api || '';
    } catch (e) { /* senza configurazione il pannello risincronizza alla prossima apertura */ }
    if (!api) return;
    await fetch(api + '/admin/push', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldEndpoint: old && old.endpoint, subscription: next.toJSON() }) });
  })());
});
