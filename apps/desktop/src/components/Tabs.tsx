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
    <div className="scrollbar-none flex max-w-full snap-x snap-mandatory gap-1 overflow-x-auto rounded-xl bg-ink-100/50 p-1 sm:flex-wrap sm:overflow-visible">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`min-h-10 shrink-0 snap-start rounded-lg px-3.5 py-2 text-sm font-medium transition ${
            active === tab.key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
