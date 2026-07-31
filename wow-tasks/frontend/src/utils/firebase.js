import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let messaging = null;

function getFirebase() {
  if (!app && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_WEB_API_KEY') {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  }
  return { app, messaging };
}

export async function requestPushPermission() {
  const { messaging } = getFirebase();
  if (!messaging) {
    console.warn('Firebase not configured — push notifications disabled');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // firebase-messaging-sw.js is bundled into the PWA's sw.js at build time
    // (see vite.config.js workbox.importScripts), so we reuse that single
    // registration instead of registering a second, competing service worker.
    const swRegistration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    return token;
  } catch (e) {
    console.warn('Push token error:', e.message);
    return null;
  }
}

// Requests permission + FCM token, then registers it with the backend.
// Shared by the initial app-load prompt and the bell's "enable" button.
export async function registerPushToken(api) {
  const token = await requestPushPermission();
  if (!token) return null;
  try {
    await api.post('/notifications/token', { token });
  } catch (e) {
    console.warn('Failed to register push token:', e.message);
  }
  return token;
}
