/* ── Firebase Messaging (background push) ── */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCeBxHzJbfFUi6_DU8SpuFQgtXI6LOwns8",
  authDomain: "lungcare-721be.firebaseapp.com",
  projectId: "lungcare-721be",
  storageBucket: "lungcare-721be.firebasestorage.app",
  messagingSenderId: "167334814176",
  appId: "1:167334814176:web:068aa93adbc0768f678b85"
});

const fbMessaging = firebase.messaging();

fbMessaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'LungCare';
  const body = payload.notification?.body || payload.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="%236366F1"/><path d="M33 65C27 59 25 48 27 37C29 28 35 24 40 27C42 28.5 43 31.5 43 36V69C40 71 36 69 33 65Z" fill="white" opacity=".95"/><path d="M63 65C69 59 71 48 69 37C67 28 61 24 56 27C54 28.5 53 31.5 53 36V69C56 71 60 69 63 65Z" fill="white" opacity=".95"/><rect x="45" y="19" width="6" height="21" rx="3" fill="white"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="%236366F1"/></svg>',
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
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('./');
    })
  );
});

/* ── Cache (network-first with offline fallback) ── */
const CACHE = 'lungcare-v5';
const ASSETS = ['./', './index.html', './style.css', './script.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      self.clients.matchAll().then(cls => {
        cls.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE }));
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Skip Firebase and Google API requests from caching
  if (e.request.url.includes('firebasejs') ||
      e.request.url.includes('googleapis.com') ||
      e.request.url.includes('firestore.googleapis.com')) {
    return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
  );
});
