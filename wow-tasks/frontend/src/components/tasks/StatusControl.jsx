import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const STATUSES = ['NEW', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'];

export default function StatusControl({ status, editable, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!editable) {
    return <span className={`badge status-${status}`}>{t(`task.statuses.${status}`, status)}</span>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`badge status-${status} cursor-pointer inline-flex items-center gap-1`}
      >
        {t(`task.statuses.${status}`, status)}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 start-0 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[9rem]">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`w-full text-start px-3 py-1.5 hover:bg-gray-50 ${
                s === status ? 'ring-1 ring-inset ring-brand-dark rounded-md' : ''
              }`}
            >
              <span className={`badge status-${s}`}>{t(`task.statuses.${s}`, s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
