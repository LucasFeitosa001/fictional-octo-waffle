import { useMemo } from 'react';
import type { AppointmentRow } from '../lib/types';

export const START_HOUR = 7;
export const END_HOUR = 22;
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

export interface EventColor {
  bg: string;
  text: string;
  bar: string;
}

/** Soft, distinct palette — events are tinted by professional. */
const PALETTE: EventColor[] = [
  { bg: '#FCE7F0', text: '#9D2C5B', bar: '#EF6E99' },
  { bg: '#E7F0FE', text: '#1E4FA3', bar: '#5B8DEF' },
  { bg: '#E7F8EF', text: '#137A48', bar: '#34C77B' },
  { bg: '#FFF1E0', text: '#9A5B1A', bar: '#F0A04B' },
  { bg: '#F0E9FB', text: '#5B3B9A', bar: '#9B6BEF' },
  { bg: '#E6F6F8', text: '#0F6E7A', bar: '#2BB7C6' },
];

function hashIndex(key: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function colorForAppointment(a: AppointmentRow): EventColor {
  const key = a.professionalId ?? a.professional?.id ?? a.id;
  return PALETTE[hashIndex(key, PALETTE.length)];
}

export function minutesFromStart(iso: string, day: Date): number {
  const d = new Date(iso);
  const mins = (d.getTime() - day.getTime()) / 60000;
  return mins - START_HOUR * 60;
}

export function sameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export type Placed = { a: AppointmentRow; top: number; height: number; col: number; cols: number };

/** Greedy interval packing: side-by-side lanes for overlapping events. */
export function layoutDay(events: AppointmentRow[], day: Date, hourHeight: number): Placed[] {
  const items = events
    .filter((a) => sameDay(a.start, day))
    .map((a) => {
      const startMin = Math.max(0, minutesFromStart(a.start, day));
      const endMin = Math.min(TOTAL_MIN, minutesFromStart(a.end, day));
      return { a, startMin, endMin: Math.max(endMin, startMin + 15) };
    })
    .sort((x, y) => x.startMin - y.startMin || x.endMin - y.endMin);

  const result: Placed[] = [];
  let cluster: { idx: number; col: number }[] = [];
  let colsEnd: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      const it = items[c.idx];
      result.push({
        a: it.a,
        top: (it.startMin / 60) * hourHeight,
        height: ((it.endMin - it.startMin) / 60) * hourHeight,
        col: c.col,
        cols,
      });
    }
    cluster = [];
    colsEnd = [];
  };

  items.forEach((it, idx) => {
    if (it.startMin >= clusterEnd) flush();
    let col = colsEnd.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colsEnd.length;
      colsEnd.push(it.endMin);
    } else {
      colsEnd[col] = it.endMin;
    }
    cluster.push({ idx, col });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  });
  flush();
  return result;
}

const HEADER_H = 56;

const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function isToday(day: Date): boolean {
  const n = new Date();
  return (
    n.getFullYear() === day.getFullYear() &&
    n.getMonth() === day.getMonth() &&
    n.getDate() === day.getDate()
  );
}

interface AgendaGridProps {
  days: Date[];
  appointments: AppointmentRow[];
  onSelect: (a: AppointmentRow) => void;
  hourHeight?: number;
}

export function AgendaGrid({ days, appointments, onSelect, hourHeight = 56 }: AgendaGridProps) {
  const hours = useMemo(
    () => Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i),
    [],
  );
  const bodyHeight = (END_HOUR - START_HOUR) * hourHeight;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  const nowTop = (nowMin / 60) * hourHeight;
  const nowVisible = nowMin >= 0 && nowMin <= TOTAL_MIN;

  return (
    <div className="flex overflow-x-auto">
      {/* Time gutter */}
      <div className="sticky left-0 z-10 w-14 shrink-0 bg-white">
        <div style={{ height: HEADER_H }} />
        {hours.map((h) => (
          <div
            key={h}
            style={{ height: hourHeight }}
            className="relative -mt-2 pr-2 text-right text-[11px] font-medium text-[#9AA0A6]"
          >
            <span className="absolute right-2 top-2">{String(h).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(120px, 1fr))` }}
      >
        {days.map((day) => {
          const placed = layoutDay(appointments, day, hourHeight);
          const today = isToday(day);
          return (
            <div key={day.toISOString()} className="border-l border-black/5">
              {/* Column header */}
              <div
                style={{ height: HEADER_H }}
                className="sticky top-0 z-10 flex flex-col items-center justify-center border-b border-black/5 bg-white"
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#9AA0A6]">
                  {weekdayFmt.format(day).replace('.', '')}
                </span>
                <span
                  className={[
                    'mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold',
                    today ? 'bg-[#f2b33d] text-[#3b2d09]' : 'text-[#2F3136]',
                  ].join(' ')}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Day body */}
              <div className="relative" style={{ height: bodyHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    style={{ top: i * hourHeight, height: hourHeight }}
                    className="absolute inset-x-0 border-b border-black/5"
                  />
                ))}

                {today && nowVisible && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: nowTop }}
                  >
                    <div className="relative">
                      <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[#f2b33d]" />
                      <div className="h-px bg-[#f2b33d]" />
                    </div>
                  </div>
                )}

                {placed.map(({ a, top, height, col, cols }) => {
                  const c = colorForAppointment(a);
                  const canceled = a.status === 'canceled';
                  const widthPct = 100 / cols;
                  const label = a.customer?.name ?? 'Sem cliente';
                  const svc = a.items?.length ? `${a.items.length} serviço(s)` : a.professional?.name;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelect(a)}
                      style={{
                        top,
                        height: Math.max(height, 20),
                        left: `calc(${col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: canceled ? '#F3F4F6' : c.bg,
                        color: canceled ? '#9AA0A6' : c.text,
                      }}
                      className="absolute z-10 flex flex-col overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] leading-tight shadow-sm ring-1 ring-black/5 transition-transform hover:z-30 hover:scale-[1.01]"
                    >
                      <span
                        className="absolute inset-y-1 left-0 w-1 rounded-full"
                        style={{ backgroundColor: canceled ? '#D1D5DB' : c.bar }}
                      />
                      <span className="pl-1.5 font-semibold">{timeFmt.format(new Date(a.start))}</span>
                      <span className={['truncate pl-1.5 font-medium', canceled ? 'line-through' : ''].join(' ')}>
                        {label}
                      </span>
                      {height > 38 && svc && (
                        <span className="truncate pl-1.5 opacity-80">{svc}</span>
                      )}
                    </button>
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
