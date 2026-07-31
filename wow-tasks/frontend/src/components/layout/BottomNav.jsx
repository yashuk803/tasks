import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ListChecks, ClipboardList, Users, Building2 } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function BottomNav() {
  const { t } = useTranslation();
  const { isAdmin, isManager } = useAuthStore();

  const navClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 py-2 px-3 flex-1 text-xs font-medium text-center leading-tight transition-colors ${
      isActive ? 'text-brand-dark' : 'text-gray-400'
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex justify-around max-w-lg mx-auto">
        <NavLink to="/tasks" className={navClass}>
          <ListChecks size={20} />
          <span>{t('nav.myTasks')}</span>
        </NavLink>

        {isManager() && (
          <NavLink to="/dept-tasks" className={navClass}>
            <ClipboardList size={20} />
            <span>{t('nav.deptTasks')}</span>
          </NavLink>
        )}

        {isManager() && (
          <NavLink to="/users" className={navClass}>
            <Users size={20} />
            <span>{t('nav.users')}</span>
          </NavLink>
        )}

        {isAdmin() && (
          <NavLink to="/departments" className={navClass}>
            <Building2 size={20} />
            <span>{t('nav.departments')}</span>
          </NavLink>
        )}
      </div>
    </nav>
  );
}
