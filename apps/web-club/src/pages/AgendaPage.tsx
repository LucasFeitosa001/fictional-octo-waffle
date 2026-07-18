import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from '@gravity-ui/icons';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { AgendaGridSkeleton } from '../components/Skeletons';
import { useAgenda, usePortal } from '../lib/booking';

// Start of the week (Sunday) containing `ref`, at local midnight.
function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

const rangeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

/**
 * Public availability page: a week grid showing a professional's free/busy time
 * — never any customer data. Customers use it to eyeball open slots before
 * jumping into the booking flow.
 */
export function AgendaPage({ slug, backTo }: { slug: string; backTo: string }) {
  const navigate = useNavigate();
  const portal = usePortal(slug);

  useEffect(() => {
    if (portal.data?.name) {
      document.title = `${portal.data.name} — Disponibilidade`;
    }
  }, [portal.data?.name]);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  // [from, to) ISO bounds for the visible week.
  const from = days[0].toISOString();
  const to = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 7);
    return end.toISOString();
  }, [weekStart]);

  const agenda = useAgenda(slug, from, to);
  const professionals = agenda.data?.professionals ?? [];

  const [proId, setProId] = useState<string | null>(null);
  // Default to the first professional once they load.
  useEffect(() => {
    if (!proId && professionals.length) setProId(professionals[0].id);
  }, [proId, professionals]);

  const selectedPro = professionals.find((p) => p.id === proId) ?? null;
  const busy = useMemo(
    () => (agenda.data?.busy ?? []).filter((b) => b.professionalId === proId),
    [agenda.data, proId],
  );
  const windows = useMemo(
    () => (agenda.data?.schedules ?? []).filter((w) => w.professionalId === proId),
    [agenda.data, proId],
  );

  const shiftWeek = (deltaDays: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + deltaDays);
    setWeekStart(next);
  };

  const rangeLabel = `${rangeFmt.format(days[0])} – ${rangeFmt.format(days[6])}`.replace(
    /\./g,
    '',
  );

  return (
    <div className="club-page flex flex-col">
      <header className="club-topbar sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-3 md:py-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label="Voltar"
            className="club-touch grid place-items-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft width={22} height={22} />
          </button>
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass"
            className="h-6 w-auto sm:h-7"
          />
        </div>
      </header>

      <main className="club-page-main mx-auto w-full max-w-5xl flex-1 py-6 sm:py-8">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-brand text-2xl text-foreground sm:text-3xl">Disponibilidade</h1>
          <p className="text-sm text-muted">
            Veja os horários livres de cada profissional{portal.data?.name ? ` na ${portal.data.name}` : ''}.
          </p>
        </div>

        {/* Professional selector */}
        {professionals.length > 0 && (
          <div className="club-scroll-row -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
            {professionals.map((p) => {
              const active = p.id === proId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProId(p.id)}
                  className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-transparent bg-[var(--color-pink)] text-white shadow-[var(--shadow-soft)]'
                      : 'border-[var(--color-soft-border)] bg-white text-foreground hover:border-[var(--color-pink)]'
                  }`}
                >
                  {p.nickname || p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Week navigation + legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <button
              type="button"
              onClick={() => shiftWeek(-7)}
              aria-label="Semana anterior"
              className="club-touch grid shrink-0 place-items-center rounded-full border border-[var(--color-soft-border)] bg-white text-foreground transition-colors hover:border-[var(--color-pink)] hover:text-[var(--color-pink)]"
            >
              <ChevronLeft width={18} height={18} />
            </button>
            <span className="min-w-32 text-center text-sm font-semibold capitalize text-foreground">
              {rangeLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftWeek(7)}
              aria-label="Próxima semana"
              className="club-touch grid shrink-0 place-items-center rounded-full border border-[var(--color-soft-border)] bg-white text-foreground transition-colors hover:border-[var(--color-pink)] hover:text-[var(--color-pink)]"
            >
              <ChevronRight width={18} height={18} />
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#FFF1EE] ring-1 ring-[var(--color-soft-border)]" />
              Disponível
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-[#ECECEC] ring-1 ring-black/5" />
              Ocupado
            </span>
          </div>
        </div>

        {/* Grid */}
        <p className="mt-4 text-xs text-muted sm:hidden">Deslize a grade para ver os outros dias da semana.</p>
        <div className="mt-2 sm:mt-4">
          {agenda.isLoading ? (
            <AgendaGridSkeleton />
          ) : professionals.length === 0 ? (
            <p className="rounded-2xl border border-[var(--color-soft-border)] bg-white px-4 py-10 text-center text-sm text-muted">
              Nenhum profissional disponível para agendamento online.
            </p>
          ) : (
            <AvailabilityGrid days={days} busy={busy} windows={windows} />
          )}
        </div>

        {selectedPro && (
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-muted">
              Mostrando a agenda de <strong>{selectedPro.nickname || selectedPro.name}</strong>.
            </p>
            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="min-h-12 w-full rounded-2xl bg-[var(--color-pink)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-pink)] sm:w-auto"
            >
              Escolher serviço e agendar
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
