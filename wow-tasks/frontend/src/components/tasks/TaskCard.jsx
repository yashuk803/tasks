import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

export default function TaskCard({ task }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const overdue =
    task.dueDate &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELLED' &&
    new Date(task.dueDate) < new Date();

  return (
    <button
      className="card w-full text-start hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-brand-black line-clamp-2 flex-1">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <StatusBadge status={task.status} />

        {task.dueDate && (
          <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {new Date(task.dueDate).toLocaleDateString()}
            {overdue && ' ⚠'}
          </span>
        )}

        {task.department && (
          <span className="text-xs text-gray-400">{task.department.name}</span>
        )}
      </div>

      {task.assignees?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {task.assignees.slice(0, 3).map((a) => (
            <span key={a.userId} className="text-xs bg-brand-light/20 text-brand-dark px-1.5 py-0.5 rounded">
              {a.user.firstName} {a.user.lastName}
            </span>
          ))}
          {task.assignees.length > 3 && (
            <span className="text-xs text-gray-400">+{task.assignees.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}
