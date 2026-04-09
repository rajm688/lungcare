/* ── Firebase Messaging (background push) ── */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCeBxHzJbfFUi6_DU8SpuFQgtXI6LOwns8',
  authDomain: 'lungcare-721be.firebaseapp.com',
  projectId: 'lungcare-721be',
  storageBucket: 'lungcare-721be.firebasestorage.app',
  messagingSenderId: '167334814176',
  appId: '1:167334814176:web:068aa93adbc0768f678b85'
});

const fbMessaging = firebase.messaging();

fbMessaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'LungCare';
  const body = payload.notification?.body || payload.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: './icons/icon-192.svg',
    badge: './icons/icon-192.svg',
    tag: payload.data?.tag || 'lungcare-reminder',
    vibrate: [200, 100, 200],
    data: { url: './' },
    renotify: true
  });
});

/* ── Notification click → open app ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

/* ── Cache (network-first with offline fallback) ── */
const CACHE = 'lungcare-v12';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './firebase-messaging-sw.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/logo-white.svg',
  './icons/logo-indigo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => {
        self.clients.matchAll().then((cls) => {
          cls.forEach((c) => c.postMessage({ type: 'SW_UPDATED', version: CACHE }));
        });
      })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only cache known app assets, skip external requests
  const isAsset = ASSETS.some((a) => url.pathname.endsWith(a.replace('./', '/')) || url.pathname === a.replace('.', ''));
  if (!isAsset && url.origin === self.location.origin) {
    // Same-origin non-asset: network only with offline fallback
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  if (!isAsset) return; // External requests — don't intercept
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
