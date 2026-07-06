import {
  START_HOUR,
  END_HOUR,
  layoutDay,
  minutesFromStart,
  sameDay,
  isToday,
  colorForAppointment,
  type Placed,
} from '../src/components/AgendaGrid';
import type { AppointmentRow } from '../src/lib/types';

const DAY = new Date(2026, 5, 7); // 2026-06-07, local midnight

/** Build an appointment on 2026-06-07 from "HH:MM" local times. */
function ev(
  id: string,
  s: string,
  e: string,
  extra: Partial<AppointmentRow> = {},
): AppointmentRow {
  return {
    id,
    companyId: 'c',
    status: 'scheduled',
    start: `2026-06-07T${s}:00`,
    end: `2026-06-07T${e}:00`,
    ...extra,
  } as AppointmentRow;
}

function appt(extra: Partial<AppointmentRow>): AppointmentRow {
  return {
    id: 'x',
    companyId: 'c',
    status: 'scheduled',
    start: '2026-06-07T09:00:00',
    end: '2026-06-07T10:00:00',
    ...extra,
  } as AppointmentRow;
}

function byId(placed: Placed[], id: string): Placed {
  const p = placed.find((x) => x.a.id === id);
  if (!p) throw new Error(`not placed: ${id}`);
  return p;
}

const HEX = /^#[0-9a-f]{6}$/i;

describe('grid constants', () => {
  it('starts at 7', () => expect(START_HOUR).toBe(7));
  it('ends at 22', () => expect(END_HOUR).toBe(22));
  it('end after start', () => expect(END_HOUR).toBeGreaterThan(START_HOUR));
  it('spans 900 minutes', () => expect((END_HOUR - START_HOUR) * 60).toBe(900));
});

describe('minutesFromStart', () => {
  const cases: [string, number][] = [
    ['2026-06-07T07:00:00', 0],
    ['2026-06-07T08:00:00', 60],
    ['2026-06-07T09:00:00', 120],
    ['2026-06-07T07:30:00', 30],
    ['2026-06-07T12:00:00', 300],
    ['2026-06-07T22:00:00', 900],
    ['2026-06-07T06:00:00', -60],
    ['2026-06-07T00:00:00', -420],
    ['2026-06-07T10:15:00', 195],
    ['2026-06-07T13:45:00', 405],
    ['2026-06-08T07:00:00', 1440],
    ['2026-06-07T07:01:00', 1],
  ];
  it.each(cases)('%p -> %p', (iso, expected) => {
    expect(minutesFromStart(iso, DAY)).toBeCloseTo(expected, 5);
  });
});

describe('sameDay', () => {
  const cases: [string, boolean][] = [
    ['2026-06-07T00:00:00', true],
    ['2026-06-07T23:59:59', true],
    ['2026-06-07T12:00:00', true],
    ['2026-06-07T07:30:00', true],
    ['2026-06-07T09:00:00', true],
    ['2026-06-07T18:00:00', true],
    ['2026-06-06T23:59:59', false],
    ['2026-06-08T00:00:00', false],
    ['2026-07-07T12:00:00', false],
    ['2025-06-07T12:00:00', false],
    ['2026-06-17T12:00:00', false],
    ['2026-05-07T12:00:00', false],
    ['2026-06-01T12:00:00', false],
    ['2026-12-07T12:00:00', false],
  ];
  it.each(cases)('%p -> %p', (iso, expected) => {
    expect(sameDay(iso, DAY)).toBe(expected);
  });
});

describe('isToday', () => {
  const now = new Date();
  it('true for now', () => expect(isToday(now)).toBe(true));
  it('true for today at noon', () =>
    expect(isToday(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12))).toBe(true));
  it('false for tomorrow', () => {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    expect(isToday(t)).toBe(false);
  });
  it('false for yesterday', () => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    expect(isToday(y)).toBe(false);
  });
  it('false for a fixed past date', () => expect(isToday(new Date(2000, 0, 1))).toBe(false));
  it('false for a fixed future date', () => expect(isToday(new Date(2099, 0, 1))).toBe(false));
});

describe('colorForAppointment', () => {
  it.each(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'])(
    'is structurally valid + deterministic for %p',
    (pid) => {
      const c = colorForAppointment(appt({ professionalId: pid }));
      expect(c.bg).toMatch(HEX);
      expect(c.text).toMatch(HEX);
      expect(c.bar).toMatch(HEX);
      expect(colorForAppointment(appt({ professionalId: pid }))).toEqual(c);
    },
  );

  it('same professionalId yields same color', () => {
    expect(colorForAppointment(appt({ id: 'a', professionalId: 'pX' }))).toEqual(
      colorForAppointment(appt({ id: 'b', professionalId: 'pX' })),
    );
  });

  it('professionalId takes precedence over professional.id', () => {
    const c1 = colorForAppointment(appt({ professionalId: 'a', professional: { id: 'b' } as any }));
    const c2 = colorForAppointment(appt({ professionalId: 'a', professional: { id: 'c' } as any }));
    expect(c1).toEqual(c2);
  });

  it('falls back to professional.id when professionalId is absent', () => {
    const withFlat = colorForAppointment(appt({ professionalId: 'z' }));
    const withNested = colorForAppointment(
      appt({ professionalId: null, professional: { id: 'z' } as any }),
    );
    expect(withNested).toEqual(withFlat);
  });

  it('falls back to appointment id when no professional info', () => {
    const c1 = colorForAppointment(appt({ id: 'same', professionalId: null }));
    const c2 = colorForAppointment(appt({ id: 'same', professionalId: null }));
    expect(c1).toEqual(c2);
  });

  it('produces at most 6 distinct palette colors', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(colorForAppointment(appt({ professionalId: `p${i}` })).bar);
    expect(seen.size).toBeLessThanOrEqual(6);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('bar differs from bg', () => {
    const c = colorForAppointment(appt({ professionalId: 'p1' }));
    expect(c.bar).not.toBe(c.bg);
  });
});

describe('layoutDay', () => {
  it('returns empty for no events', () => {
    expect(layoutDay([], DAY, 60)).toEqual([]);
  });

  it('places a single 09:00-10:00 event', () => {
    const [p] = layoutDay([ev('a', '09:00', '10:00')], DAY, 60);
    expect(p.top).toBeCloseTo(120, 5);
    expect(p.height).toBeCloseTo(60, 5);
    expect(p.col).toBe(0);
    expect(p.cols).toBe(1);
  });

  it('places an event at the very start (07:00)', () => {
    const [p] = layoutDay([ev('a', '07:00', '08:00')], DAY, 60);
    expect(p.top).toBeCloseTo(0, 5);
    expect(p.height).toBeCloseTo(60, 5);
  });

  it('clamps an event that begins before START_HOUR', () => {
    const [p] = layoutDay([ev('a', '06:00', '08:00')], DAY, 60);
    expect(p.top).toBeCloseTo(0, 5);
    expect(p.height).toBeCloseTo(60, 5);
  });

  it('clamps an event that ends after END_HOUR', () => {
    const [p] = layoutDay([ev('a', '21:00', '23:00')], DAY, 60);
    expect(p.top).toBeCloseTo(840, 5);
    expect(p.height).toBeCloseTo(60, 5);
  });

  it('enforces a minimum 15-minute height', () => {
    const [p] = layoutDay([ev('a', '09:00', '09:05')], DAY, 60);
    expect(p.height).toBeCloseTo(15, 5);
  });

  it('spanning the full day fills the body', () => {
    const [p] = layoutDay([ev('a', '07:00', '22:00')], DAY, 60);
    expect(p.top).toBeCloseTo(0, 5);
    expect(p.height).toBeCloseTo(900, 5);
  });

  it('lays two overlapping events into 2 columns', () => {
    const placed = layoutDay([ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30')], DAY, 60);
    expect(byId(placed, 'a').cols).toBe(2);
    expect(byId(placed, 'b').cols).toBe(2);
    expect(new Set(placed.map((p) => p.col)).size).toBe(2);
  });

  it('reuses a single column for back-to-back events', () => {
    const placed = layoutDay([ev('a', '09:00', '10:00'), ev('b', '10:00', '11:00')], DAY, 60);
    expect(byId(placed, 'a').cols).toBe(1);
    expect(byId(placed, 'b').cols).toBe(1);
    expect(byId(placed, 'a').col).toBe(0);
    expect(byId(placed, 'b').col).toBe(0);
  });

  it('lays three fully-overlapping events into 3 columns', () => {
    const placed = layoutDay(
      [ev('a', '09:00', '10:00'), ev('b', '09:00', '10:00'), ev('c', '09:00', '10:00')],
      DAY,
      60,
    );
    expect(placed.every((p) => p.cols === 3)).toBe(true);
    expect(new Set(placed.map((p) => p.col))).toEqual(new Set([0, 1, 2]));
  });

  it('packs a staggered cluster into 2 columns', () => {
    const placed = layoutDay(
      [ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30'), ev('c', '10:15', '11:00')],
      DAY,
      60,
    );
    expect(byId(placed, 'a').col).toBe(0);
    expect(byId(placed, 'b').col).toBe(1);
    expect(byId(placed, 'c').col).toBe(0);
    expect(placed.every((p) => p.cols === 2)).toBe(true);
  });

  it('handles events provided out of chronological order', () => {
    const placed = layoutDay([ev('late', '15:00', '16:00'), ev('early', '08:00', '09:00')], DAY, 60);
    expect(byId(placed, 'early').top).toBeCloseTo(60, 5);
    expect(byId(placed, 'late').top).toBeCloseTo(480, 5);
  });

  it('filters out events from other days', () => {
    const other = ev('z', '09:00', '10:00');
    other.start = '2026-06-08T09:00:00';
    other.end = '2026-06-08T10:00:00';
    const placed = layoutDay([ev('a', '09:00', '10:00'), other], DAY, 60);
    expect(placed).toHaveLength(1);
    expect(placed[0].a.id).toBe('a');
  });

  it('scales geometry with hourHeight', () => {
    const [p] = layoutDay([ev('a', '09:00', '10:00')], DAY, 120);
    // 09:00 is 2h after START_HOUR (07:00) → 2 * 120 = 240
    expect(p.top).toBeCloseTo(240, 5);
    expect(p.height).toBeCloseTo(120, 5);
  });

  it('still lays out canceled appointments', () => {
    const placed = layoutDay([ev('a', '09:00', '10:00', { status: 'canceled' })], DAY, 60);
    expect(placed).toHaveLength(1);
    expect(placed[0].a.status).toBe('canceled');
  });

  it.each([30, 56, 60, 64, 100, 120])('top is proportional for hourHeight=%p', (hh) => {
    const [p] = layoutDay([ev('a', '09:00', '10:00')], DAY, hh);
    expect(p.top).toBeCloseTo(2 * hh, 5);
    expect(p.height).toBeCloseTo(hh, 5);
  });

  it.each([
    ['08:00', '09:00', 60, 60],
    ['08:00', '10:00', 60, 120],
    ['10:00', '12:00', 180, 120],
    ['07:30', '08:00', 30, 30],
    ['12:00', '13:30', 300, 90],
    ['18:00', '19:00', 660, 60],
  ])('event %p-%p -> top %p height %p', (s, e, top, height) => {
    const [p] = layoutDay([ev('a', s as string, e as string)], DAY, 60);
    expect(p.top).toBeCloseTo(top as number, 5);
    expect(p.height).toBeCloseTo(height as number, 5);
  });

  it('keeps every event when many non-overlapping exist', () => {
    const evts = [
      ev('a', '08:00', '08:45'),
      ev('b', '09:00', '09:45'),
      ev('c', '10:00', '10:45'),
      ev('d', '11:00', '11:45'),
      ev('e', '12:00', '12:45'),
    ];
    const placed = layoutDay(evts, DAY, 60);
    expect(placed).toHaveLength(5);
    expect(placed.every((p) => p.cols === 1 && p.col === 0)).toBe(true);
  });

  it('separate clusters do not inflate each other columns', () => {
    const placed = layoutDay(
      [
        ev('a', '09:00', '10:00'),
        ev('b', '09:30', '10:30'),
        ev('c', '14:00', '15:00'),
      ],
      DAY,
      60,
    );
    expect(byId(placed, 'c').cols).toBe(1);
    expect(byId(placed, 'a').cols).toBe(2);
  });
});
