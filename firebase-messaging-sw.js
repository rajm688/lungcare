// Firebase Messaging default service worker — delegates to sw.js
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

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
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
