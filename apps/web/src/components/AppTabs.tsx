import type { ReactNode } from 'react';
import { Tabs } from '@heroui/react';

export type AppTabItem<Key extends string> = {
  id: Key;
  label: ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
};

export function AppTabs<Key extends string>({
  items,
  selectedKey,
  onSelectionChange,
  ariaLabel,
  className = '',
  listClassName = '',
}: {
  items: AppTabItem<Key>[];
  selectedKey: Key;
  onSelectionChange: (key: Key) => void;
  ariaLabel: string;
  className?: string;
  listClassName?: string;
}) {
  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => onSelectionChange(String(key) as Key)}
      variant="secondary"
      className={className}
    >
      <Tabs.ListContainer className="max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1 shadow-[var(--shadow-soft)]">
        <Tabs.List
          aria-label={ariaLabel}
          className={`min-w-max gap-1 ${listClassName}`}
        >
          {items.map((item) => (
            <Tabs.Tab
              key={item.id}
              id={item.id}
              isDisabled={item.disabled}
              className="group inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-ink transition-[color,background-color,box-shadow,transform] duration-200 ease-out hover:bg-[color-mix(in_oklab,var(--sp-primary)_9%,transparent)] hover:text-ink data-[selected]:bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] data-[selected]:text-primary data-[selected]:shadow-[var(--shadow-soft)] active:scale-[0.98]"
            >
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-canvas text-muted-ink transition-colors group-data-[selected]:bg-[color-mix(in_oklab,var(--sp-primary)_18%,transparent)] group-data-[selected]:text-primary"
              >
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}
