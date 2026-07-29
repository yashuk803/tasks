import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../../store/authStore';

export default function BottomNav() {
  const { t } = useTranslation();
  const { isAdmin, isManager } = useAuthStore();

  const navClass = ({ isActive }) =>
    `flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors ${
      isActive ? 'text-brand-dark' : 'text-gray-400'
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex justify-around max-w-lg mx-auto">
        <NavLink to="/tasks" className={navClass}>
          <span className="text-lg">✓</span>
          {t('nav.myTasks')}
        </NavLink>

        {isManager() && (
          <NavLink to="/dept-tasks" className={navClass}>
            <span className="text-lg">📋</span>
            {t('nav.deptTasks')}
          </NavLink>
        )}

        {isManager() && (
          <NavLink to="/users" className={navClass}>
            <span className="text-lg">👥</span>
            {t('nav.users')}
          </NavLink>
        )}

        {isAdmin() && (
          <NavLink to="/departments" className={navClass}>
            <span className="text-lg">🏢</span>
            {t('nav.departments')}
          </NavLink>
        )}
      </div>
    </nav>
  );
}
