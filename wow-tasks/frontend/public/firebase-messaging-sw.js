// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Config will be injected at build time via vite-plugin-pwa / or hardcoded here for dev
// These are PUBLIC config values (safe to expose)
firebase.initializeApp({
  apiKey:            'AIzaSyBRVUtnsvLXItReynTG39DmNkfpW45P3hM',
  authDomain:        'task-treker-wow-corp.firebaseapp.com',
  projectId:         'task-treker-wow-corp',
  storageBucket:     'task-treker-wow-corp.firebasestorage.app',
  messagingSenderId: '681460740141',
  appId:             '1:681460740141:web:20921b3dd408adcbd248a4',
});

const messaging = firebase.messaging();

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const { taskId } = payload.data || {};

  self.registration.showNotification(title || 'WOW Tasks', {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { taskId },
    actions: [{ action: 'open', title: 'Открыть' }],
  });
});

// Click on notification → open the task
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const url = taskId ? `/tasks/${taskId}` : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
