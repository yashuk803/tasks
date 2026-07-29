import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Select from 'react-select';
import { useTask, useCreateTask, useUpdateTask, useUploadAttachment } from '../hooks/useTasks';
import { useUsers } from '../hooks/useUsers';
import Spinner from '../components/ui/Spinner';

const STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const empty = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'NEW',
  dueDate: '',
  departmentId: '',
  assigneeIds: [],
  responsibleId: '',
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    borderRadius: '0.5rem',
    borderColor: state.isFocused ? '#1d5d86' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(29, 93, 134, 0.5)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#1d5d86' : '#d1d5db' },
  }),
  valueContainer: (base) => ({ ...base, padding: '2px 12px' }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function TaskFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: existing, isLoading: loadingTask } = useTask(id);
  const { data: users = [] } = useUsers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const uploadAttachment = useUploadAttachment();

  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
    [users]
  );

  useEffect(() => {
    if (existing) {
      const assigneeIds = existing.assignees?.map((a) => a.userId) ?? [];
      setForm({
        title: existing.title ?? '',
        description: existing.description ?? '',
        priority: existing.priority ?? 'MEDIUM',
        status: existing.status ?? 'NEW',
        dueDate: existing.dueDate ? existing.dueDate.slice(0, 10) : '',
        departmentId: existing.departmentId ?? '',
        assigneeIds,
        responsibleId: assigneeIds[0] ?? '',
      });
    }
  }, [existing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleResponsibleChange = (option) => {
    const responsibleId = option ? option.value : '';
    const selectedUser = users.find((u) => u.id === responsibleId);
    setForm((f) => {
      const assigneeIds = responsibleId && !f.assigneeIds.includes(responsibleId)
        ? [...f.assigneeIds, responsibleId]
        : f.assigneeIds;
      return {
        ...f,
        responsibleId,
        departmentId: selectedUser ? selectedUser.departmentId ?? '' : f.departmentId,
        assigneeIds,
      };
    });
  };

  const handleAssigneesChange = (options) => {
    let assigneeIds = (options || []).map((o) => o.value);
    setForm((f) => {
      if (f.responsibleId && !assigneeIds.includes(f.responsibleId)) {
        assigneeIds = [...assigneeIds, f.responsibleId];
      }
      return { ...f, assigneeIds };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { responsibleId, ...rest } = form;
    const payload = {
      ...rest,
      dueDate: form.dueDate || null,
      departmentId: form.departmentId || null,
    };
    try {
      if (isEdit) {
        await updateTask.mutateAsync({ id, ...payload });
        if (files.length) await uploadAttachment.mutateAsync({ taskId: id, files });
        navigate(`/tasks/${id}`);
      } else {
        const task = await createTask.mutateAsync(payload);
        if (files.length) await uploadAttachment.mutateAsync({ taskId: task.id, files });
        navigate(`/tasks/${task.id}`);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    }
  };

  if (isEdit && loadingTask) return <Spinner className="mt-16" />;

  const isPending = createTask.isPending || updateTask.isPending || uploadAttachment.isPending;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-brand-dark text-xl">←</button>
        <h1 className="text-xl font-semibold text-brand-black">
          {isEdit ? t('task.edit') : t('task.create')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">{t('task.title')}</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">{t('task.description')}</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('task.priority')}</label>
            <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`task.priorities.${p}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('task.status')}</label>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t(`task.statuses.${s}`)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t('task.dueDate')}</label>
          <input
            type="date"
            className="input"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
        </div>

        <div>
          <label className="label">{t('task.responsible')}</label>
          <Select
            options={userOptions}
            value={userOptions.find((o) => o.value === form.responsibleId) || null}
            onChange={handleResponsibleChange}
            placeholder={t('task.responsiblePlaceholder')}
            isClearable
            styles={selectStyles}
            menuPortalTarget={document.body}
          />
        </div>

        <div>
          <label className="label">{t('task.assignees')}</label>
          <Select
            options={userOptions}
            value={userOptions.filter((o) => form.assigneeIds.includes(o.value))}
            onChange={handleAssigneesChange}
            placeholder={t('task.selectPlaceholder')}
            isMulti
            styles={selectStyles}
            menuPortalTarget={document.body}
          />
        </div>

        <div>
          <label className="label">{t('task.attachments')}</label>
          <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
            <span>📎</span>
            <span>{t('task.uploadFile')}</span>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={i} className="text-xs text-gray-600 flex items-center gap-2">
                  <span>📄</span>
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="text-red-400 shrink-0" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={isPending}>
            {isPending ? <Spinner className="h-5" /> : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
