export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? 'border-brand-dark text-brand-dark'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          {tab.label}
          {tab.count != null && <span className="ms-1 text-xs">({tab.count})</span>}
        </button>
      ))}
    </div>
  );
}
