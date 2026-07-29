import { useTranslation } from 'react-i18next';

const STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TaskFilters({ filters, onChange }) {
  const { t } = useTranslation();

  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-2 p-3 bg-white border-b border-gray-100">
      <input
        className="input"
        placeholder={t('common.search')}
        value={filters.search || ''}
        onChange={(e) => set('search', e.target.value)}
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          className={`shrink-0 badge cursor-pointer ${!filters.status ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => set('status', '')}
        >
          {t('common.all')}
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`shrink-0 badge cursor-pointer ${filters.status === s ? 'bg-brand-dark text-white' : `status-${s}`}`}
            onClick={() => set('status', filters.status === s ? '' : s)}
          >
            {t(`task.statuses.${s}`)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          className={`shrink-0 badge cursor-pointer ${!filters.priority ? 'bg-brand-dark text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => set('priority', '')}
        >
          {t('task.priority')}
        </button>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            className={`shrink-0 badge cursor-pointer ${filters.priority === p ? 'bg-brand-dark text-white' : `priority-${p}`}`}
            onClick={() => set('priority', filters.priority === p ? '' : p)}
          >
            {t(`task.priorities.${p}`)}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={!!filters.mine}
          onChange={(e) => set('mine', e.target.checked ? 'true' : '')}
          className="accent-brand-dark"
        />
        {t('nav.myTasks')}
      </label>
    </div>
  );
}
