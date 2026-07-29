import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuthStore from '../store/authStore';
import Spinner from '../components/ui/Spinner';

const LANGS = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'he', label: 'עב' },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { i18n } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.login, form.password);
      navigate('/tasks');
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-brand-dark flex flex-col items-center justify-center px-6">
      {/* Language switcher */}
      <div className="absolute top-4 end-4 flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => i18n.changeLanguage(l.code)}
            className={`px-2 py-1 rounded text-xs font-bold transition-all ${
              i18n.language === l.code
                ? 'bg-white text-brand-dark'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl font-bold text-white text-center mb-8">
          {t('app.name')}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-xl flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-brand-dark">{t('auth.login')}</h2>

          <div>
            <label className="label">{t('auth.loginPlaceholder')}</label>
            <input
              className="input"
              autoComplete="username"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">{t('auth.password')}</label>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <Spinner className="h-5" /> : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
