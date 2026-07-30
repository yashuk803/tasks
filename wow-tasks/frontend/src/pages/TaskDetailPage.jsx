import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTask, useUpdateTask, useDeleteTask, useAcceptTask } from '../hooks/useTasks';
import StatusBadge from '../components/tasks/StatusBadge';
import PriorityBadge from '../components/tasks/PriorityBadge';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import { useState } from 'react';
import useAuthStore from '../store/authStore';

const STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isManager } = useAuthStore();

  const { data: task, isLoading } = useTask(id);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const acceptTask = useAcceptTask();

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <Spinner className="mt-16" />;
  if (!task) return <p className="text-center mt-16 text-gray-400">{t('common.error')}</p>;

  const isAssignee = task.assignees?.some((a) => a.user.id === user?.id);
  const canEdit = isManager() || task.authorId === user?.id || isAssignee;
  // Deletion is more destructive than editing — only the author or a manager/admin
  // can delete, matching the backend's canManageTask rule for DELETE.
  const canDelete = isManager() || task.authorId === user?.id;
  const showAcceptButton = isAssignee && task.status === 'NEW' && task.needsAcceptance;

  const handleStatusChange = (status) => {
    updateTask.mutate({ id: task.id, status });
  };

  const handleAccept = () => {
    acceptTask.mutate(task.id);
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(task.id);
    navigate(-1);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        <button onClick={() => navigate(-1)} className="text-brand-dark text-xl mt-0.5">←</button>
        <h1 className="text-xl font-semibold text-brand-black flex-1">{task.title}</h1>
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className="badge bg-gray-100 text-gray-600">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Accept task button */}
      {showAcceptButton && (
        <button
          className="btn-primary w-full"
          onClick={handleAccept}
          disabled={acceptTask.isPending}
        >
          {t('task.accept')}
        </button>
      )}

      {/* Status change */}
      {canEdit && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`shrink-0 badge cursor-pointer transition-opacity ${
                task.status === s ? 'opacity-100 ring-2 ring-brand-dark' : 'opacity-60'
              } status-${s}`}
            >
              {t(`task.statuses.${s}`)}
            </button>
          ))}
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="card">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
        </div>
      )}

      {/* Meta */}
      <div className="card flex flex-col gap-2 text-sm">
        {task.author && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('task.author')}</span>
            <span>{task.author.firstName} {task.author.lastName}</span>
          </div>
        )}
        {task.department && (
          <div className="flex justify-between">
            <span className="text-gray-500">{t('task.department')}</span>
            <span>{task.department.name}</span>
          </div>
        )}
        {task.assignees?.length > 0 && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-500 shrink-0">{t('task.assignees')}</span>
            <span className="text-end">
              {task.assignees.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* History */}
      {task.history?.length > 0 && (
        <div>
          <h2 className="font-semibold text-sm text-gray-600 mb-2">{t('task.history')}</h2>
          <div className="flex flex-col gap-1">
            {task.history.map((h) => (
              <div key={h.id} className="text-xs text-gray-500 flex justify-between gap-2">
                <span>{h.user?.firstName} — {h.field}: {h.oldValue} → {h.newValue}</span>
                <span className="shrink-0">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      <div>
        <h2 className="font-semibold text-sm text-gray-600 mb-2">{t('task.attachments')}</h2>

        {(!task.attachments || task.attachments.length === 0) && (
          <p className="text-xs text-gray-400 mb-2">{t('task.noAttachments')}</p>
        )}

        {task.attachments?.length > 0 && (
          <div className="flex flex-col gap-2 mb-3">
            {task.attachments.map((att) =>
              att.mimetype.startsWith('image/') ? (
                <a
                  key={att.id}
                  href={`${import.meta.env.VITE_API_URL}${att.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={`${import.meta.env.VITE_API_URL}${att.url}`}
                    alt={att.originalName}
                    className="rounded-lg object-cover w-full max-h-48 cursor-pointer"
                  />
                </a>
              ) : (
                <div key={att.id} className="card flex items-center gap-3 py-2 px-3">
                  <span className="text-lg">📎</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{att.originalName}</p>
                    <p className="text-xs text-gray-400">{formatSize(att.size)}</p>
                  </div>
                  <a
                    href={`${import.meta.env.VITE_API_URL}${att.url}`}
                    download={att.originalName}
                    className="btn-secondary text-xs py-1 px-2 shrink-0"
                  >
                    ↓
                  </a>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {(canEdit || canDelete) && (
        <div className="flex gap-2 mt-2">
          {canEdit && (
            <button className="btn-secondary flex-1" onClick={() => navigate(`/tasks/${id}/edit`)}>
              {t('common.edit')}
            </button>
          )}
          {canDelete && (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </button>
          )}
        </div>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('common.confirm')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-danger" onClick={handleDelete} disabled={deleteTask.isPending}>
              {t('common.delete')}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600">{t('task.delete')} «{task.title}»?</p>
      </Modal>
    </div>
  );
}
