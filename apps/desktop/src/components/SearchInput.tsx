import { Search } from 'lucide-react';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-300" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-xl border border-ink-100 bg-white py-2.5 pl-10 pr-3 text-base text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:min-h-11 sm:text-sm"
      />
    </div>
  );
}
