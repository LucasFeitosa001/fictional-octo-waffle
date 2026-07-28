import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { IconCalendar, IconChevron } from './icons';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * DatePicker — calendário/date-picker reutilizável do projeto.
 *
 * Um único componente, dois modos:
 *   - `mode="single"`  → seleciona UMA data (nascimento, validade, vencimento…).
 *   - `mode="range"`   → seleciona um intervalo (filtros de relatório/financeiro),
 *                        com uma coluna de PRESETS ("Hoje", "Mês passado"…).
 *
 * Responsivo:
 *   - Desktop (≥ md): abre como POPOVER ancorado ao input trigger.
 *   - Mobile (< md, 768px): sobe um DRAWER de baixo pra cima (bottom-sheet),
 *     como a Agenda faz. Detecção via `useIsMobile` (matchMedia).
 *
 * Datas trafegam como strings ISO curtas "YYYY-MM-DD" (mesmo formato que os
 * antigos `<input type="date">` e `lib/format.isoDate`), sem fuso: tudo é
 * tratado em horário local para não pular um dia por causa de UTC.
 */

// ── Utilidades de data (locais, sem fuso) ─────────────────────────────────────

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// MONTHS_SHORT foi removido junto com o cabeçalho "2026 Jul": o calendário agora
// escreve o mês por extenso, e não sobrou nenhum lugar que use a forma abreviada.
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** "YYYY-MM-DD" (string ISO curta) a partir de um Date, em horário LOCAL. */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date à meia-noite LOCAL (ou null se inválido). */
function fromISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && toISO(a) === toISO(b);
}

/** "dd/mm/aaaa" a partir de ISO. */
function formatBr(iso: string | null | undefined): string {
  const d = fromISO(iso ?? undefined);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Grade de 6 semanas (42 dias) a partir do domingo anterior ao dia 1 do mês. */
function buildGrid(viewMonth: Date): Date[] {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const start = addDays(first, -first.getDay()); // recua até domingo
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// ── Presets de intervalo ──────────────────────────────────────────────────────

export type DateRangeValue = { from: string; to: string };

type Preset = { id: string; label: string; range: () => DateRangeValue };

function buildPresets(): Preset[] {
  const today = startOfDay(new Date());
  const iso = toISO;
  return [
    {
      id: 'today',
      label: 'Hoje',
      range: () => ({ from: iso(today), to: iso(today) }),
    },
    {
      id: 'last-week',
      label: 'Semana passada',
      range: () => {
        // Semana anterior (domingo a sábado) à semana atual.
        const startThisWeek = addDays(today, -today.getDay());
        const start = addDays(startThisWeek, -7);
        const end = addDays(start, 6);
        return { from: iso(start), to: iso(end) };
      },
    },
    {
      id: 'last-month',
      label: 'Mês passado',
      range: () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: iso(start), to: iso(end) };
      },
    },
    {
      id: 'this-month',
      label: 'Este mês',
      range: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: iso(start), to: iso(today) };
      },
    },
    {
      id: 'last-6-months',
      label: '6 meses atrás',
      range: () => ({ from: iso(addMonths(today, -6)), to: iso(today) }),
    },
    {
      id: 'last-year',
      label: '1 ano atrás',
      range: () => {
        const start = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        return { from: iso(start), to: iso(today) };
      },
    },
  ];
}

// ── Estilos de célula ─────────────────────────────────────────────────────────

// `w-full min-w-9` e não `w-9`: item de grid com largura EXPLÍCITA não estica, cai
// em `justify-self: start`. No popover do desktop isso nunca apareceu porque o
// painel encolhe até o conteúdo e as 7 colunas ficam com exatos 36px; no
// bottom-sheet do mobile a grade é de largura total (~330px), as colunas viram
// ~45px e os números encostavam à ESQUERDA da célula enquanto os rótulos
// Dom/Seg/… (que não têm largura, então esticam e centralizam) ficavam no meio —
// a grade inteira parecia deslocada em relação ao cabeçalho.
// O `min-w-9` mantém a contribuição de largura intrínseca em 36px, então o
// dimensionamento do popover desktop continua idêntico.
const cellBase =
  'relative grid h-9 w-full min-w-9 place-items-center rounded-lg text-sm outline-none transition-colors ' +
  'focus-visible:ring-2 focus-visible:ring-gold/40';

// ── Calendário (grade) ────────────────────────────────────────────────────────

function Calendar({
  viewMonth,
  onPrev,
  onNext,
  isSelected,
  isInRange,
  isRangeStart,
  isRangeEnd,
  isToday,
  onPick,
}: {
  viewMonth: Date;
  onPrev: () => void;
  onNext: () => void;
  isSelected: (d: Date) => boolean;
  isInRange: (d: Date) => boolean;
  isRangeStart: (d: Date) => boolean;
  isRangeEnd: (d: Date) => boolean;
  isToday: (d: Date) => boolean;
  onPick: (d: Date) => void;
}) {
  const grid = useMemo(() => buildGrid(viewMonth), [viewMonth]);

  return (
    <div className="select-none">
      {/* Header: "Julho de 2026" + navegação */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Mês anterior"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <span className="rotate-90">
            <IconChevron size={18} />
          </span>
        </button>
        <div
          aria-live="polite"
          className="text-sm font-semibold text-foreground"
        >
          {/* "Julho de 2026", não "2026 Jul": o formato antigo era leitura de
              máquina. A forma correta já existia no aria-label logo abaixo — só
              não era a que aparecia na tela. */}
          <span>{MONTHS_LONG[viewMonth.getMonth()]} de </span>
          <span className="tabular-nums">{viewMonth.getFullYear()}</span>
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Próximo mês"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <span className="-rotate-90">
            <IconChevron size={18} />
          </span>
        </button>
      </div>

      {/* Cabeçalho dos dias da semana (começa em domingo) */}
      <div className="grid grid-cols-7 gap-0.5" role="presentation">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="grid h-8 place-items-center text-[11px] font-semibold uppercase tracking-wide text-muted"
            aria-hidden
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div
        className="grid grid-cols-7 gap-0.5"
        role="grid"
        aria-label={`Calendário — ${MONTHS_LONG[viewMonth.getMonth()]} de ${viewMonth.getFullYear()}`}
      >
        {grid.map((day) => {
          const outside = day.getMonth() !== viewMonth.getMonth();
          const selected = isSelected(day);
          const inRange = isInRange(day);
          const start = isRangeStart(day);
          const end = isRangeEnd(day);
          const today = isToday(day);

          let cls = cellBase;
          if (selected || start || end) {
            cls += ' bg-gold font-semibold text-primary-foreground hover:bg-gold-strong';
          } else if (inRange) {
            cls += ' bg-gold/15 text-foreground rounded-none';
          } else if (outside) {
            cls += ' text-muted/60 hover:bg-black/5';
          } else {
            cls += ' text-foreground hover:bg-black/5';
          }
          if (today && !selected && !start && !end) {
            cls += ' ring-1 ring-inset ring-gold/60';
          }

          return (
            <button
              key={toISO(day)}
              type="button"
              role="gridcell"
              aria-label={`${day.getDate()} de ${MONTHS_LONG[day.getMonth()]} de ${day.getFullYear()}`}
              aria-selected={selected || start || end}
              tabIndex={outside ? -1 : 0}
              onClick={() => onPick(day)}
              className={cls}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Painel interno (compartilhado por popover e drawer) ───────────────────────

function SingleBody({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (iso: string) => void;
}) {
  const selected = fromISO(value);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date((selected ?? new Date()).getFullYear(), (selected ?? new Date()).getMonth(), 1),
  );
  const today = startOfDay(new Date());

  return (
    <Calendar
      viewMonth={viewMonth}
      onPrev={() => setViewMonth((m) => addMonths(m, -1))}
      onNext={() => setViewMonth((m) => addMonths(m, 1))}
      isSelected={(d) => sameDay(d, selected)}
      isInRange={() => false}
      isRangeStart={() => false}
      isRangeEnd={() => false}
      isToday={(d) => sameDay(d, today)}
      onPick={(d) => onSelect(toISO(d))}
    />
  );
}

function RangeBody({
  value,
  onSelectRange,
  onCommit,
}: {
  value: DateRangeValue;
  onSelectRange: (next: DateRangeValue) => void;
  onCommit?: () => void;
}) {
  const presets = useMemo(buildPresets, []);
  const fromDate = fromISO(value.from);
  const toDate = fromISO(value.to);
  const anchor = fromDate ?? toDate ?? new Date();
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(anchor.getFullYear(), anchor.getMonth(), 1),
  );

  const today = startOfDay(new Date());

  function pick(d: Date) {
    const iso = toISO(d);
    // Sem início, ou intervalo já completo → começa um novo intervalo.
    if (!fromDate || (fromDate && toDate)) {
      onSelectRange({ from: iso, to: '' });
      return;
    }
    // Com início e sem fim → fecha o intervalo (ordenando se preciso).
    if (d < fromDate) {
      onSelectRange({ from: iso, to: value.from });
    } else {
      onSelectRange({ from: value.from, to: iso });
    }
  }

  const inRange = (d: Date) => {
    if (!fromDate || !toDate) return false;
    const t = startOfDay(d).getTime();
    return t > fromDate.getTime() && t < toDate.getTime();
  };

  const activePreset = presets.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  });

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-4">
      {/* Presets */}
      <div className="md:w-40 md:shrink-0 md:border-r md:border-[var(--color-soft-border)] md:pr-3">
        <div className="flex flex-wrap gap-1.5 md:flex-col">
          {presets.map((p) => {
            const active = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectRange(p.range());
                }}
                className={[
                  'rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-gold/15 font-semibold text-primary'
                    : 'text-foreground hover:bg-black/5',
                ].join(' ')}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendário */}
      <div className="min-w-0 flex-1">
        <Calendar
          viewMonth={viewMonth}
          onPrev={() => setViewMonth((m) => addMonths(m, -1))}
          onNext={() => setViewMonth((m) => addMonths(m, 1))}
          isSelected={() => false}
          isInRange={inRange}
          isRangeStart={(d) => sameDay(d, fromDate)}
          isRangeEnd={(d) => sameDay(d, toDate)}
          isToday={(d) => sameDay(d, today)}
          onPick={pick}
        />
        {onCommit && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onCommit}
              className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overlay: popover (desktop) / bottom-sheet (mobile) ────────────────────────

const EXIT_MS = 320;

function Overlay({
  isOpen,
  onClose,
  anchorRef,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  title: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount + animação de entrada/saída.
  useEffect(() => {
    if (isOpen) {
      setShow(false);
      setMounted(true);
      return;
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShow(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen, mounted]);

  // Fecha com Esc.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  // Desktop: fecha ao clicar fora (ignora clique no próprio anchor/painel).
  useEffect(() => {
    if (!mounted || isMobile) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [mounted, isMobile, onClose, anchorRef]);

  // Trava scroll do body enquanto o bottom-sheet está aberto.
  useEffect(() => {
    if (!mounted || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, isMobile]);

  useEffect(() => {
    if (show) panelRef.current?.focus();
  }, [show]);

  // Posição do popover desktop (abaixo do anchor, com flip se faltar espaço).
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean }>(
    { top: 0, left: 0, openUp: false },
  );
  useEffect(() => {
    if (!mounted || isMobile) return;
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelH = panelRef.current?.offsetHeight ?? 360;
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < panelH + 16 && r.top > panelH + 16;
      // O transbordo VERTICAL já era tratado (openUp); o horizontal não era.
      // Como o painel é `fixed` num portal, com `left: r.left` cru ele vazava do
      // painel de filtros e, num campo perto da borda direita, saía da tela — e
      // aí não dá nem para clicar no dia. `max-w` limitava a largura, mas não
      // reposicionava. Prende dentro da janela, com 8px de folga.
      const panelW = panelRef.current?.offsetWidth ?? 320;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8));
      setPos({
        top: openUp ? r.top - 8 : r.bottom + 8,
        left,
        openUp,
      });
    };
    place();
    // Na PRIMEIRA passada o painel ainda não tem dimensão medida, então `panelW`
    // cai no padrão e o intervalo (que é bem mais largo que o calendário simples)
    // ficaria mal preso. O ResizeObserver refaz a conta assim que ele mede — e
    // de novo se o conteúdo mudar de tamanho, como ao trocar de mês.
    const panel = panelRef.current;
    const ro = panel ? new ResizeObserver(place) : null;
    if (panel && ro) ro.observe(panel);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [mounted, isMobile, show, anchorRef]);

  if (!mounted) return null;

  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-[80]" role="presentation">
        <div
          aria-hidden
          onClick={onClose}
          className={[
            'absolute inset-0 cursor-pointer bg-black/40 backdrop-blur-[1px] transition-opacity duration-[320ms] ease-out',
            show ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={[
            'absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-pop)] outline-none',
            'transform-gpu transition-transform duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] will-change-transform',
            show ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          {/* Handle + título */}
          <div className="flex flex-col items-center gap-2 border-b border-[var(--color-soft-border)] px-4 pb-3 pt-2">
            <span className="h-1.5 w-10 rounded-full bg-black/15" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Desktop popover
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: pos.openUp ? 'translateY(-100%)' : undefined,
      }}
      className={[
        'z-[80] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-black/[0.08] bg-warm-white p-3 shadow-[var(--shadow-pop)] outline-none',
        // Animação padrão do projeto para dropdown/popover: 200ms ease-out com
        // opacity + translate-y + scale, e pointer-events-none quando fechado.
        'origin-top transition-all duration-200 ease-out',
        show
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none translate-y-1 scale-95 opacity-0',
      ].join(' ')}
    >
      {children}
    </div>,
    document.body,
  );
}

// ── Trigger (campo clicável) ──────────────────────────────────────────────────

const triggerClass =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-default-200 bg-white px-3 ' +
  'text-base text-foreground shadow-sm outline-none transition-colors sm:h-10 sm:text-sm ' +
  'hover:border-gold/60 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30 ' +
  'aria-expanded:border-gold aria-expanded:ring-2 aria-expanded:ring-gold/30';

// ── Componentes públicos ──────────────────────────────────────────────────────

export interface DatePickerProps {
  /** Data selecionada em ISO "YYYY-MM-DD" ('' quando vazia). */
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  placeholder?: string;
  /** Classe extra no wrapper. */
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * DatePicker — modo SINGLE. Campo clicável que abre o calendário
 * (popover no desktop, bottom-sheet no mobile) e devolve ISO "YYYY-MM-DD".
 */
export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Selecionar data',
  className,
  ariaLabel,
  disabled,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const display = formatBr(value);

  return (
    <div className={`flex w-full flex-col gap-1 ${className ?? ''}`}>
      {label && (
        <label htmlFor={fieldId} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      <button
        id={fieldId}
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? label ?? 'Selecionar data'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${triggerClass} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={display ? 'text-foreground' : 'text-muted'}>
          {display || placeholder}
        </span>
        <IconCalendar size={16} className="shrink-0 text-muted-ink" aria-hidden />
      </button>

      <Overlay
        isOpen={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={label ?? 'Selecionar data'}
      >
        <SingleBody
          value={value}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </Overlay>
    </div>
  );
}

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (next: DateRangeValue) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

/** "01/07/2026 – 20/07/2026", "01/07/2026 – …", ou '' */
function formatRangeLabel(from: string, to: string): string {
  const f = formatBr(from);
  const t = formatBr(to);
  if (f && t) return `${f} – ${t}`;
  if (f) return `${f} – …`;
  if (t) return `… – ${t}`;
  return '';
}

/**
 * DatePicker — modo RANGE. Campo clicável que abre o calendário com PRESETS
 * (popover no desktop, bottom-sheet no mobile). Devolve `{ from, to }` em ISO.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  label,
  placeholder = 'Selecionar período',
  className,
  ariaLabel,
  id,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const display = formatRangeLabel(from, to);
  const isMobile = useIsMobile();

  // No mobile, seleção é confirmada no botão "Aplicar"; no desktop, aplica ao
  // vivo e fecha quando o intervalo fica completo via clique no calendário.
  return (
    <div className={`flex w-full flex-col gap-1 ${className ?? ''}`}>
      {label && (
        <label htmlFor={fieldId} className="text-xs font-medium text-muted">
          {label}
        </label>
      )}
      <button
        id={fieldId}
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel ?? label ?? 'Selecionar período'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <span className={display ? 'text-foreground' : 'text-muted'}>
          {display || placeholder}
        </span>
        <IconCalendar size={16} className="shrink-0 text-muted-ink" aria-hidden />
      </button>

      <Overlay
        isOpen={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        title={label ?? 'Selecionar período'}
      >
        <RangeBody
          value={{ from, to }}
          onSelectRange={(next) => onChange(next)}
          onCommit={isMobile ? () => setOpen(false) : undefined}
        />
      </Overlay>
    </div>
  );
}
