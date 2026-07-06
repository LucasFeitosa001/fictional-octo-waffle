import { useMemo } from 'react';
import type { AgendaSchedule, BusyBlock } from '../lib/booking';

// A week grid that shows a single professional's free/busy time. It NEVER shows
// customer data — busy windows render as a neutral "Ocupado" block; the open
// working hours are tinted as "Disponível", so the gaps read as bookable.

const HEADER_H = 52;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(day: Date): boolean {
  return isSameDay(day, new Date());
}

interface AvailabilityGridProps {
  days: Date[];
  /** Busy blocks for the selected professional only. */
  busy: BusyBlock[];
  /** Recurring working windows for the selected professional only. */
  windows: AgendaSchedule[];
  hourHeight?: number;
}

export function AvailabilityGrid({
  days,
  busy,
  windows,
  hourHeight = 52,
}: AvailabilityGridProps) {
  // Fit the visible hour range to the professional's actual working windows so
  // the grid isn't mostly empty. Fall back to a sensible default when unknown.
  const { startHour, endHour } = useMemo(() => {
    if (!windows.length) {
      return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const w of windows) {
      min = Math.min(min, hhmmToMin(w.startTime));
      max = Math.max(max, hhmmToMin(w.endTime));
    }
    return {
      startHour: Math.max(0, Math.floor(min / 60)),
      endHour: Math.min(24, Math.ceil(max / 60)),
    };
  }, [windows]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );
  const totalMin = (endHour - startHour) * 60;
  const bodyHeight = (endHour - startHour) * hourHeight;
  const startMinOfDay = startHour * 60;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() - startMinOfDay;
  const nowTop = (nowMin / 60) * hourHeight;
  const nowVisible = nowMin >= 0 && nowMin <= totalMin;

  const parsedBusy = useMemo(
    () => busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
    [busy],
  );

  return (
    <div className="flex overflow-x-auto rounded-2xl border border-[var(--color-soft-border)] bg-white shadow-[var(--shadow-card)]">
      {/* Time gutter */}
      <div className="sticky left-0 z-10 w-12 shrink-0 bg-white">
        <div style={{ height: HEADER_H }} />
        {hours.map((h) => (
          <div
            key={h}
            style={{ height: hourHeight }}
            className="relative pr-1.5 text-right text-[10px] font-medium text-[#9AA0A6]"
          >
            <span className="absolute right-1.5 -top-1.5">{String(h).padStart(2, '0')}h</span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(96px, 1fr))` }}
      >
        {days.map((day) => {
          const today = isToday(day);
          const dayWindows = windows.filter((w) => w.weekday === day.getDay());
          const dayBusy = parsedBusy.filter((b) => isSameDay(b.start, day));

          return (
            <div key={day.toISOString()} className="border-l border-black/5">
              {/* Column header */}
              <div
                style={{ height: HEADER_H }}
                className="sticky top-0 z-10 flex flex-col items-center justify-center border-b border-black/5 bg-white"
              >
                <span className="text-[10px] font-medium uppercase tracking-wide text-[#9AA0A6]">
                  {weekdayFmt.format(day).replace('.', '')}
                </span>
                <span
                  className={[
                    'mt-0.5 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold',
                    today ? 'bg-[var(--color-pink)] text-white' : 'text-foreground',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Day body */}
              <div className="relative" style={{ height: bodyHeight }}>
                {/* Hour gridlines */}
                {hours.map((h, i) => (
                  <div
                    key={h}
                    style={{ top: i * hourHeight, height: hourHeight }}
                    className="absolute inset-x-0 border-b border-black/5"
                  />
                ))}

                {/* "Disponível" working windows (tinted background). */}
                {dayWindows.map((w, i) => {
                  const top = ((hhmmToMin(w.startTime) - startMinOfDay) / 60) * hourHeight;
                  const height =
                    ((hhmmToMin(w.endTime) - hhmmToMin(w.startTime)) / 60) * hourHeight;
                  return (
                    <div
                      key={`w-${i}`}
                      style={{ top, height }}
                      className="absolute inset-x-0.5 rounded-lg bg-[#FFF1EE]"
                    />
                  );
                })}

                {/* "Now" indicator on today's column. */}
                {today && nowVisible && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: nowTop }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[var(--color-pink)]" />
                    <div className="h-px bg-[var(--color-pink)]" />
                  </div>
                )}

                {/* "Ocupado" busy blocks (no customer data). */}
                {dayBusy.map((b, i) => {
                  const startM = Math.max(
                    0,
                    (b.start.getHours() * 60 + b.start.getMinutes()) - startMinOfDay,
                  );
                  const endM = Math.min(
                    totalMin,
                    (b.end.getHours() * 60 + b.end.getMinutes()) - startMinOfDay,
                  );
                  const top = (startM / 60) * hourHeight;
                  const height = Math.max(16, ((endM - startM) / 60) * hourHeight);
                  return (
                    <div
                      key={`b-${i}`}
                      style={{ top, height }}
                      className="absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-lg border border-black/5 bg-[#ECECEC] px-1.5 py-1 text-left text-[10px] leading-tight text-[#6f6a63]"
                    >
                      <span className="font-semibold">{timeFmt.format(b.start)}</span>
                      {height > 28 && <span className="opacity-80">Ocupado</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
