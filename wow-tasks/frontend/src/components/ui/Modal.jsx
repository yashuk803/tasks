import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90dvh] flex flex-col">
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-brand-dark">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 leading-none"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto p-4 flex-1">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
