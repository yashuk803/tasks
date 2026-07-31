import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { useTasks } from '../hooks/useTasks';
import TaskCard from '../components/tasks/TaskCard';
import TaskFilters from '../components/tasks/TaskFilters';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

export default function TasksPage({ deptMode = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState(
    deptMode ? {} : { mine: 'true' }
  );

  const { data: tasks, isLoading, error } = useTasks(filters);

  return (
    <div className="flex flex-col">
      <TaskFilters filters={filters} onChange={setFilters} />

      <div className="p-3 flex flex-col gap-2">
        {isLoading && <Spinner className="mt-8" />}

        {error && (
          <p className="text-center text-red-500 mt-8">{t('common.error')}</p>
        )}

        {!isLoading && !error && tasks?.length === 0 && (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title={t('task.noTasks')}
            action={
              <button className="btn-primary" onClick={() => navigate('/tasks/new')}>
                {t('task.create')}
              </button>
            }
          />
        )}

        {tasks?.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>

      <button
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] end-4 z-30 w-14 h-14 rounded-full bg-brand-teal text-white shadow-lg flex items-center justify-center hover:bg-brand-dark transition-colors"
        onClick={() => navigate('/tasks/new')}
        aria-label={t('task.create')}
      >
        <Plus size={28} />
      </button>
    </div>
  );
}
