import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, he } from 'date-fns/locale';
import { Bell, BellRing } from 'lucide-react';
import api from '../../utils/api';
import { registerPushToken } from '../../utils/firebase';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/useNotifications';
import EmptyState from '../ui/EmptyState';

const locales = { ru, en: enUS, he };

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const containerRef = useRef(null);

  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Re-check permission whenever the dropdown opens (in case it was changed
  // in browser site settings while the app stayed open).
  useEffect(() => {
    if (open && typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, [open]);

  const handleEnablePush = async () => {
    await registerPushToken(api);
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  };

  const handleItemClick = (notif) => {
    if (!notif.read) markRead.mutate(notif.id);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-brand-light hover:text-white transition-colors"
        aria-label={t('notifications.title')}
      >
        {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-amber text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-xl border border-gray-100 z-50 text-brand-dark">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-brand-teal hover:underline"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {permission !== 'granted' && (
            <div className="px-4 py-3 border-b border-gray-100 bg-brand-light/10">
              {permission === 'denied' ? (
                <>
                  <p className="text-xs font-medium text-brand-dark">{t('notifications.blockedTitle')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('notifications.blockedHint')}</p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-600">{t('notifications.enablePrompt')}</p>
                  <button onClick={handleEnablePush} className="btn-primary text-xs px-3 py-1.5 shrink-0">
                    {t('notifications.enableButton')}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState title={t('notifications.empty')} />
            ) : (
              <ul>
                {notifications.map((notif) => (
                  <li key={notif.id}>
                    <button
                      onClick={() => handleItemClick(notif)}
                      className={`w-full text-start px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        notif.read ? '' : 'bg-brand-light/10'
                      }`}
                    >
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), {
                          addSuffix: true,
                          locale: locales[i18n.language] || enUS,
                        })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
