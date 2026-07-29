import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import BottomNav from './BottomNav';
import api from '../../utils/api';
import { requestPushPermission, onForegroundMessage } from '../../utils/firebase';

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const pushTokenRef = useRef(null);

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const token = await requestPushPermission();
      if (!token) return;
      pushTokenRef.current = token;
      try {
        await api.post('/notifications/token', { token });
      } catch (e) {
        console.warn('Failed to register push token:', e.message);
      }
    })();

    unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'WOW Tasks';
      const body = payload.notification?.body || '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (pushTokenRef.current) {
      try { await api.delete('/notifications/token', { data: { token: pushTokenRef.current } }); } catch {}
    }
    await logout();
    navigate('/login');
  };

  const toggleLang = () => {
    const langs = ['ru', 'en', 'he'];
    const next = langs[(langs.indexOf(i18n.language) + 1) % langs.length];
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-dvh flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-brand-dark text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2 font-serif font-bold text-lg tracking-tight"
        >
          <img src="/logo.png" alt="WOW Corporation" className="h-8 w-8 object-contain" />
          {t('app.name')}
        </button>

        <div className="flex items-center gap-3">
          <button onClick={toggleLang} className="text-xs text-brand-light uppercase">
            {i18n.language}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-light hidden sm:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-brand-light hover:text-white transition-colors"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
