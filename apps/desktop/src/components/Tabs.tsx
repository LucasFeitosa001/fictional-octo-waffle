export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-ink-100/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
            active === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
