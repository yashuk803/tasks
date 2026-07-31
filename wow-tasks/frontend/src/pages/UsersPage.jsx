import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Users as UsersIcon } from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser } from '../hooks/useUsers';
import { useDepartments } from '../hooks/useDepartments';
import UserCard from '../components/users/UserCard';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import useAuthStore from '../store/authStore';

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE'];

const emptyForm = {
  firstName: '', lastName: '', login: '', email: '',
  password: '', role: 'EMPLOYEE', position: '', departmentId: '',
};

export default function UsersPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [search, setSearch] = useState('');
  const [modalUser, setModalUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: users = [], isLoading } = useUsers({ search });
  const { data: departments = [] } = useDepartments();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const openCreate = () => {
    setForm(emptyForm);
    setModalUser('new');
  };

  const openEdit = (u) => {
    setForm({
      firstName: u.firstName, lastName: u.lastName,
      login: u.login, email: u.email, password: '',
      role: u.role, position: u.position ?? '', departmentId: u.departmentId ?? '',
    });
    setModalUser(u);
  };

  const handleSave = async () => {
    const payload = { ...form, departmentId: form.departmentId || null };
    if (!payload.password) delete payload.password;

    if (modalUser === 'new') {
      await createUser.mutateAsync(payload);
    } else {
      await updateUser.mutateAsync({ id: modalUser.id, ...payload });
    }
    setModalUser(null);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-2 items-center">
        <input
          className="input flex-1"
          placeholder={t('common.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isAdmin() && (
          <button className="btn-primary shrink-0 inline-flex items-center gap-1" onClick={openCreate}>
            <Plus size={16} /> {t('user.create')}
          </button>
        )}
      </div>

      {isLoading && <Spinner className="mt-8" />}

      {!isLoading && users.length === 0 && (
        <EmptyState icon={<UsersIcon size={40} />} title={t('common.all')} />
      )}

      {users.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          onClick={isAdmin() ? openEdit : undefined}
        />
      ))}

      <Modal
        open={!!modalUser}
        onClose={() => setModalUser(null)}
        title={modalUser === 'new' ? t('user.create') : t('user.edit')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalUser(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={createUser.isPending || updateUser.isPending}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">{t('user.firstName')}</label>
              <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div>
              <label className="label">{t('user.lastName')}</label>
              <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">{t('user.login')}</label>
            <input className="input" value={form.login} onChange={(e) => set('login', e.target.value)} />
          </div>

          <div>
            <label className="label">{t('user.email')}</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>

          <div>
            <label className="label">{t('auth.password')}</label>
            <input type="password" className="input" value={form.password} placeholder="••••••" onChange={(e) => set('password', e.target.value)} />
          </div>

          <div>
            <label className="label">{t('user.role')}</label>
            <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`user.roles.${r}`)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t('user.position')}</label>
            <input className="input" value={form.position} onChange={(e) => set('position', e.target.value)} />
          </div>

          <div>
            <label className="label">{t('user.department')}</label>
            <select className="input" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
