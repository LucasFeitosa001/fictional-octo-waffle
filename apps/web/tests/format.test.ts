import {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTime,
  isoDate,
  isoDateUtc,
  toDateInput,
  formatSlotTime,
  formatDuration,
  initials,
} from '../src/lib/format';

/** Normalise non-breaking spaces that Intl injects so assertions are stable. */
const norm = (s: string) => s.replace(/\u00a0/g, ' ');

describe('formatMoney', () => {
  const cases: [string | number | null | undefined, string][] = [
    [180, 'R$ 180,00'],
    ['180', 'R$ 180,00'],
    [0, 'R$ 0,00'],
    [null, 'R$ 0,00'],
    [undefined, 'R$ 0,00'],
    [1234.5, 'R$ 1.234,50'],
    ['1234.5', 'R$ 1.234,50'],
    [-50, '-R$ 50,00'],
    ['abc', 'R$ 0,00'],
    [1000000, 'R$ 1.000.000,00'],
    [0.99, 'R$ 0,99'],
    [0.1, 'R$ 0,10'],
    [99.999, 'R$ 100,00'],
    ['12.34', 'R$ 12,34'],
    [Infinity, 'R$ 0,00'],
    [5, 'R$ 5,00'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(norm(formatMoney(input))).toBe(expected);
  });
});

describe('formatNumber', () => {
  const cases: [number | null | undefined, string][] = [
    [1234567, '1.234.567'],
    [1234.5, '1.234,5'],
    [0, '0'],
    [null, '0'],
    [undefined, '0'],
    [-1000, '-1.000'],
    [1000, '1.000'],
    [12, '12'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(norm(formatNumber(input))).toBe(expected);
  });
});

describe('formatDuration', () => {
  const cases: [number | null | undefined, string][] = [
    [0, '0min'],
    [1, '1min'],
    [5, '5min'],
    [15, '15min'],
    [30, '30min'],
    [35, '35min'],
    [45, '45min'],
    [59, '59min'],
    [60, '1h'],
    [61, '1h 1min'],
    [75, '1h 15min'],
    [90, '1h 30min'],
    [100, '1h 40min'],
    [105, '1h 45min'],
    [119, '1h 59min'],
    [120, '2h'],
    [125, '2h 5min'],
    [180, '3h'],
    [200, '3h 20min'],
    [240, '4h'],
    [1440, '24h'],
    [1500, '25h'],
    [null, '0min'],
    [undefined, '0min'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('initials', () => {
  const cases: [string | null | undefined, string][] = [
    ['Stella Samya', 'SS'],
    ['Maria Eduarda Negreiros', 'MN'],
    ['Marina', 'M'],
    ['  joão   silva  ', 'JS'],
    ['', '?'],
    [null, '?'],
    [undefined, '?'],
    ['a', 'A'],
    ['ana paula souza', 'AS'],
    ['José', 'J'],
    ['X Y', 'XY'],
    ['DANIEL', 'D'],
    ['mary jane watson', 'MW'],
    ['Bela Admin', 'BA'],
    ['  Foo  Bar  Baz  ', 'FB'],
    ['ab cd ef', 'AE'],
  ];
  it.each(cases)('derives initials of %p as %p', (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('formats a midday UTC instant in pt-BR', () => {
    expect(formatDate('2026-06-07T12:00:00Z')).toBe('07/06/2026');
  });
  it('formats Christmas', () => {
    expect(formatDate('2026-12-25T12:00:00Z')).toBe('25/12/2026');
  });
  it('matches dd/mm/yyyy shape', () => {
    expect(formatDate('2026-01-15T12:00:00Z')).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it.each([null, undefined, '', 'not-a-date', '2026-13-99'])(
    'returns dash for %p',
    (input) => {
      expect(formatDate(input as string)).toBe('—');
    },
  );
});

describe('formatDateTime', () => {
  it('contains date and time parts', () => {
    const out = formatDateTime('2026-06-07T12:00:00Z');
    expect(out).toContain('07/06/2026');
    expect(out).toContain('09:00');
  });
  it.each([null, undefined, '', 'garbage'])('returns dash for %p', (input) => {
    expect(formatDateTime(input as string)).toBe('—');
  });
});

describe('formatTime', () => {
  const cases: [string, string][] = [
    ['2026-06-07T12:00:00Z', '09:00'],
    ['2026-06-07T23:30:00Z', '20:30'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });
  it.each([null, undefined, '', 'bad'])('returns dash for %p', (input) => {
    expect(formatTime(input as string)).toBe('—');
  });
});

describe('formatSlotTime (America/Sao_Paulo)', () => {
  const cases: [string, string][] = [
    ['2026-06-07T13:30:00Z', '10:30'],
    ['2026-06-07T12:00:00Z', '09:00'],
    ['2026-06-07T00:00:00Z', '21:00'],
    ['2026-06-07T15:45:00Z', '12:45'],
    ['2026-06-07T10:15:00Z', '07:15'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(formatSlotTime(input)).toBe(expected);
  });
  it('returns dash for invalid', () => {
    expect(formatSlotTime('nope')).toBe('—');
  });
});

/**
 * `isoDate` devolve o dia LOCAL (a suíte roda com TZ=America/Sao_Paulo, ver
 * package.json). Antes devolvia o dia em UTC, e das 21:00 em diante o "hoje" do
 * painel virava amanhã: a recepção abria o "Novo +" às 21:30 e o campo Data já
 * vinha com o dia seguinte. Dois casos deste bloco gravavam a convenção antiga
 * (00:00Z esperando o dia UTC) e foram reescritos para o dia local.
 */
describe('isoDate (dia LOCAL)', () => {
  const cases: [Date, string][] = [
    [new Date(Date.UTC(2026, 5, 7, 12)), '2026-06-07'],
    // 00:00Z é 21:00 do dia ANTERIOR em São Paulo — inclusive na virada do ano.
    [new Date(Date.UTC(2026, 0, 1, 0)), '2025-12-31'],
    [new Date(Date.UTC(2026, 5, 7, 0, 0)), '2026-06-06'],
    // 23:00Z ainda é 20:00 do mesmo dia: o corte é às 21:00, não à meia-noite.
    [new Date(Date.UTC(2026, 11, 31, 23)), '2026-12-31'],
    [new Date(Date.UTC(2024, 1, 29, 12)), '2024-02-29'],
    [new Date(Date.UTC(2026, 5, 7, 23, 59)), '2026-06-07'],
  ];
  it.each(cases)('formats %p as %p', (input, expected) => {
    expect(isoDate(input)).toBe(expected);
  });

  // O caso do laudo, escrito em horário local para não depender de aritmética de
  // fuso na leitura: 21:30 de 09/08 continua sendo 09/08. Com o `isoDate` antigo
  // (`toISOString().slice(0, 10)`) isto devolvia '2026-08-10' e falhava.
  it('mantém o dia às 21:30, quando o UTC já virou', () => {
    expect(isoDate(new Date(2026, 7, 9, 21, 30))).toBe('2026-08-09');
  });

  // Toda célula de calendário do painel nasce assim (`new Date(ano, mês, dia)`).
  // Precisa continuar valendo o dia da própria célula — é o que garante que a
  // mudança não mexeu na grade da agenda nem nos date pickers.
  it('não muda para um Date à meia-noite local (célula de calendário)', () => {
    expect(isoDate(new Date(2026, 7, 9))).toBe('2026-08-09');
    expect(isoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

/**
 * `isoDateUtc` é o corpo ANTIGO do `isoDate`, preservado para reler campos que o
 * backend grava à meia-noite UTC a partir de "YYYY-MM-DD"
 * (Transaction.dueDate/paidAt/competenceDate, Purchase.date). Lidos em horário
 * local voltariam um dia — reabrir a despesa só para trocar o valor puxaria o
 * vencimento para trás e salvar gravaria o erro.
 */
describe('isoDateUtc (dia em UTC, p/ campos data-only)', () => {
  it('devolve o dia gravado para um vencimento à meia-noite UTC', () => {
    expect(isoDateUtc(new Date('2026-08-09T00:00:00.000Z'))).toBe('2026-08-09');
  });
  it('não escorrega na virada do ano', () => {
    expect(isoDateUtc(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
  });
  // É justamente onde ele difere do `isoDate`: mesmo instante, respostas
  // diferentes de propósito. Se um dia as duas baterem, alguém unificou errado.
  it('difere do isoDate num instante das 21:30 locais', () => {
    const noite = new Date(2026, 7, 9, 21, 30);
    expect(isoDate(noite)).toBe('2026-08-09');
    expect(isoDateUtc(noite)).toBe('2026-08-10');
  });
});

describe('toDateInput', () => {
  const cases: [string | null | undefined, string][] = [
    ['2026-06-07T12:00:00Z', '2026-06-07'],
    ['2026-01-15T08:00:00Z', '2026-01-15'],
    ['2026-12-31T12:00:00Z', '2026-12-31'],
    ['2024-02-29T12:00:00Z', '2024-02-29'],
    [null, ''],
    [undefined, ''],
    ['', ''],
    ['invalid', ''],
  ];
  it.each(cases)('maps %p to %p', (input, expected) => {
    expect(toDateInput(input)).toBe(expected);
  });
});
