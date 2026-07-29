import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDepartments, useCreateDepartment, useUpdateDepartment } from '../hooks/useDepartments';
import { useUsers } from '../hooks/useUsers';
import DeptTree from '../components/departments/DeptTree';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

const emptyForm = { name: '', parentId: '', headId: '' };

function getDescendantIds(deptId, allDepts) {
  const result = [];
  const queue = [deptId];
  while (queue.length) {
    const cur = queue.shift();
    const children = allDepts.filter((d) => d.parentId === cur);
    children.forEach((c) => { result.push(c.id); queue.push(c.id); });
  }
  return result;
}

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { data: departments = [], isLoading } = useDepartments();
  const { data: users = [] } = useUsers();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();

  const [modal, setModal] = useState(null); // null | 'new' | dept object
  const [form, setForm] = useState(emptyForm);
  const [modalError, setModalError] = useState('');

  const openCreate = () => {
    setForm(emptyForm);
    setModalError('');
    setModal('new');
  };

  const openEdit = (dept) => {
    setForm({
      name: dept.name,
      parentId: dept.parentId ?? '',
      headId: dept.headId ?? '',
    });
    setModalError('');
    setModal(dept);
  };

  const handleSave = async () => {
    setModalError('');
    const payload = {
      name: form.name,
      parentId: form.parentId || null,
      headId: form.headId || null,
    };
    try {
      if (modal === 'new') {
        await createDept.mutateAsync(payload);
      } else {
        await updateDept.mutateAsync({ id: modal.id, ...payload });
      }
      setModal(null);
    } catch (err) {
      setModalError(err?.response?.data?.error || t('common.error'));
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleMove = (deptId, newParentId) => {
    updateDept.mutate({ id: deptId, parentId: newParentId });
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-semibold text-brand-dark">{t('nav.departments')}</h1>
        <button className="btn-primary" onClick={openCreate}>
          + {t('dept.create')}
        </button>
      </div>

      {isLoading && <Spinner className="mt-8" />}

      <DeptTree departments={departments} onEdit={openEdit} onMove={handleMove} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'new' ? t('dept.create') : t('dept.edit')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={createDept.isPending || updateDept.isPending}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="label">{t('dept.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">{t('dept.parent')}</label>
            <select className="input" value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">— {t('dept.noParent')}</option>
              {departments
                .filter((d) => {
                  if (modal === 'new') return true;
                  const excluded = [modal?.id, ...getDescendantIds(modal?.id, departments)];
                  return !excluded.includes(d.id);
                })
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          </div>

          {modalError && <p className="text-sm text-red-600">{modalError}</p>}

          <div>
            <label className="label">{t('dept.head')}</label>
            <select className="input" value={form.headId} onChange={(e) => set('headId', e.target.value)}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
