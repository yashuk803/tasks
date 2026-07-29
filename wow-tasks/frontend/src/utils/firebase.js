import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    return token;
  } catch (e) {
    console.warn('Push token error:', e.message);
    return null;
  }
}

export function onForegroundMessage(callback) {
  const { messaging } = getFirebase();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
