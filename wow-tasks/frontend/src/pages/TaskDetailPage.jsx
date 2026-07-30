import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTask, useUpdateTask, useDeleteTask, useAcceptTask, useAddComment } from '../hooks/useTasks';
import StatusControl from '../components/tasks/StatusControl';
import PriorityBadge from '../components/tasks/PriorityBadge';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import Tabs from '../components/ui/Tabs';
import { useState } from 'react';
import useAuthStore from '../store/authStore';

const HISTORY_PREVIEW_COUNT = 3;

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
  const addComment = useAddComment();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState('comments');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  if (isLoading) return <Spinner className="mt-16" />;
  if (!task) return <p className="text-center mt-16 text-gray-400">{t('common.error')}</p>;

  const isAssignee = task.assignees?.some((a) => a.user.id === user?.id);
  // Full edit (title/description/priority/dueDate/assignees) is a MANAGER+/ADMIN
  // right, plus the task's own author. A plain EMPLOYEE assignee can only change
  // status and comment — per spec they don't get the "edit" right.
  const canFullyEdit = isManager() || task.authorId === user?.id;
  const canChangeStatus = canFullyEdit || isAssignee;
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

  const handleAddComment = (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    addComment.mutate({ taskId: task.id, text }, { onSuccess: () => setCommentText('') });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        <button onClick={() => navigate(-1)} className="text-brand-dark text-xl mt-0.5">←</button>
        <h1 className="text-xl font-semibold text-brand-black flex-1">{task.title}</h1>
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap items-center">
        <StatusControl status={task.status} editable={canChangeStatus} onChange={handleStatusChange} />
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

      {/* Activity: Comments / Attachments / History */}
      <div>
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: 'comments', label: t('task.comments'), count: task.comments?.length ?? 0 },
            { key: 'attachments', label: t('task.attachments'), count: task.attachments?.length ?? 0 },
            { key: 'history', label: t('task.history'), count: task.history?.length ?? 0 },
          ]}
        />

        {activeTab === 'comments' && (
          <div className="pt-3">
            {(!task.comments || task.comments.length === 0) && (
              <p className="text-xs text-gray-400 mb-2">{t('task.noComments')}</p>
            )}

            {task.comments?.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {task.comments.map((c) => (
                  <div key={c.id} className="card py-2 px-3">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-700">
                        {c.user?.firstName} {c.user?.lastName}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                className="input flex-1"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t('task.commentPlaceholder')}
              />
              <button className="btn-secondary shrink-0" disabled={addComment.isPending || !commentText.trim()}>
                {t('task.addComment')}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="pt-3">
            {(!task.attachments || task.attachments.length === 0) && (
              <p className="text-xs text-gray-400">{t('task.noAttachments')}</p>
            )}

            {task.attachments?.some((att) => att.mimetype.startsWith('image/')) && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {task.attachments
                  .filter((att) => att.mimetype.startsWith('image/'))
                  .map((att) => (
                    <a
                      key={att.id}
                      href={`${import.meta.env.VITE_API_URL}${att.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={`${import.meta.env.VITE_API_URL}${att.url}`}
                        alt={att.originalName}
                        className="rounded-lg object-cover w-full aspect-square cursor-pointer"
                      />
                    </a>
                  ))}
              </div>
            )}

            {task.attachments
              ?.filter((att) => !att.mimetype.startsWith('image/'))
              .map((att) => (
                <div key={att.id} className="card flex items-center gap-3 py-2 px-3 mb-2">
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
              ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="pt-3">
            {(!task.history || task.history.length === 0) && (
              <p className="text-xs text-gray-400">{t('task.noHistory')}</p>
            )}

            {task.history?.length > 0 && (
              <div className="flex flex-col gap-2">
                {(historyExpanded ? task.history : task.history.slice(0, HISTORY_PREVIEW_COUNT)).map((h) => (
                  <div key={h.id} className="text-xs text-gray-500 flex justify-between gap-2">
                    <span>
                      {h.user?.firstName} — {h.field}: {h.oldValue} → {h.newValue}
                    </span>
                    <span className="shrink-0">{new Date(h.createdAt).toLocaleString()}</span>
                  </div>
                ))}

                {task.history.length > HISTORY_PREVIEW_COUNT && (
                  <button
                    type="button"
                    onClick={() => setHistoryExpanded((v) => !v)}
                    className="text-xs text-brand-dark font-medium text-start mt-1"
                  >
                    {historyExpanded ? t('task.showLessHistory') : t('task.showAllHistory')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {(canFullyEdit || canDelete) && (
        <div className="flex gap-2 mt-2 sticky bottom-0 bg-gray-50 py-2 safe-bottom">
          {canFullyEdit && (
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
