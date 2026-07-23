import { Tabs } from '@heroui/react';
import { Calendar, CircleCheck, Person, Tag } from '@gravity-ui/icons';

export type BookingNavStep = 'service' | 'professional' | 'datetime' | 'confirm';

const NAV_STEPS = [
  { id: 'service', label: 'Serviços', icon: Tag },
  { id: 'professional', label: 'Profissional', icon: Person },
  { id: 'datetime', label: 'Horário', icon: Calendar },
  { id: 'confirm', label: 'Confirmar', icon: CircleCheck },
] as const;

export function BottomNav({
  step,
  onStepChange,
  canOpen,
}: {
  step: BookingNavStep;
  onStepChange: (step: BookingNavStep) => void;
  canOpen: (step: BookingNavStep) => boolean;
}) {
  return (
    <nav
      aria-label="Etapas do agendamento"
      className="club-bottomnav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-soft-border)] md:hidden"
    >
      <Tabs
        selectedKey={step}
        onSelectionChange={(key) => onStepChange(String(key) as BookingNavStep)}
        variant="secondary"
        className="mx-auto w-full max-w-lg"
      >
        <Tabs.ListContainer className="w-full overflow-visible bg-transparent px-1.5 pt-1.5">
          <Tabs.List aria-label="Etapas do agendamento" className="grid w-full grid-cols-4 gap-1">
            {NAV_STEPS.map(({ id, label, icon: Icon }) => (
              <Tabs.Tab
                key={id}
                id={id}
                isDisabled={!canOpen(id)}
                className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted transition-[color,background-color,transform] duration-200 data-[selected]:bg-[#FCE4EA] data-[selected]:text-[#B84F70] active:scale-[0.97] disabled:opacity-35 min-[380px]:text-[11px]"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-muted shadow-sm transition-colors group-data-[selected]:bg-[var(--color-pink)] group-data-[selected]:text-white">
                  <Icon width={16} height={16} />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </nav>
  );
}
