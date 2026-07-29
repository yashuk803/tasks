import { useTranslation } from 'react-i18next';

export default function UserCard({ user, onClick }) {
  const { t } = useTranslation();
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <button
      className="card w-full text-start hover:shadow-md transition-shadow flex items-center gap-3"
      onClick={() => onClick?.(user)}
    >
      <div className="w-10 h-10 rounded-full bg-brand-dark text-white flex items-center justify-center font-semibold text-sm shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-brand-black truncate">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-gray-500 truncate">{user.position || user.email}</p>
      </div>
      <span className="badge bg-gray-100 text-gray-600 shrink-0">
        {t(`user.roles.${user.role}`, user.role)}
      </span>
    </button>
  );
}
