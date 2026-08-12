/**
 * Datas do "Novo agendamento" (src/lib/agendamentoDatas.ts).
 *
 * O bloco "Mensal" existe porque a recorrência TRANSBORDAVA o mês: com
 * `d.setMonth(d.getMonth() + times)`, a cliente que faz manutenção todo dia 31
 * recebia 03/03, 31/03 e 01/05 no lugar de 28/02, 31/03 e 30/04 — datas que
 * ninguém combinou, e que saem na mensagem de confirmação quando o padrão da
 * conta está ligado. Cada uma das asserções abaixo falha com aquele código.
 */
import {
  nextDate,
  problemaDeExpediente,
  type JanelaDeExpediente,
} from '../src/lib/agendamentoDatas';

/** "31/01/2026 13:00" (hora local — o jest roda com TZ=America/Sao_Paulo). */
function em(iso: string): Date {
  return new Date(iso);
}
const ddmm = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('nextDate — Mensal não transborda o mês', () => {
  it('31/01 vira 28/02, 31/03 e 30/04 (antes: 03/03, 31/03 e 01/05)', () => {
    const base = em('2026-01-31T13:00');
    expect(ddmm(nextDate(base, 'monthly', 1))).toBe('28/02/2026 13:00');
    expect(ddmm(nextDate(base, 'monthly', 2))).toBe('31/03/2026 13:00');
    expect(ddmm(nextDate(base, 'monthly', 3))).toBe('30/04/2026 13:00');
  });

  it('31/03 vira 30/04 (mês de 30 dias), não 01/05', () => {
    expect(ddmm(nextDate(em('2026-03-31T09:30'), 'monthly', 1))).toBe('30/04/2026 09:30');
  });

  it('30/01 vira 28/02, não 02/03', () => {
    expect(ddmm(nextDate(em('2026-01-30T15:00'), 'monthly', 1))).toBe('28/02/2026 15:00');
  });

  it('fevereiro bissexto aceita o dia 29', () => {
    expect(ddmm(nextDate(em('2028-01-31T10:00'), 'monthly', 1))).toBe('29/02/2028 10:00');
  });

  it('mantém o dia quando ele existe no mês de destino', () => {
    expect(ddmm(nextDate(em('2026-01-15T10:00'), 'monthly', 2))).toBe('15/03/2026 10:00');
  });

  it('semanal e quinzenal seguem inalterados', () => {
    const base = em('2026-01-31T13:00');
    expect(ddmm(nextDate(base, 'weekly', 1))).toBe('07/02/2026 13:00');
    expect(ddmm(nextDate(base, 'biweekly', 2))).toBe('28/02/2026 13:00');
    expect(ddmm(nextDate(base, 'none', 3))).toBe('31/01/2026 13:00');
  });
});

describe('problemaDeExpediente — qual data a série vai derrubar', () => {
  // Seg-sex, 09:00 às 18:00.
  const semana: JanelaDeExpediente[] = [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startTime: '09:00',
    endTime: '18:00',
  }));
  const quarta17h = em('2026-08-12T17:00'); // 12/08/2026 é quarta-feira
  const domingo17h = em('2026-08-16T17:00');

  it('não reclama quando o atendimento cabe', () => {
    expect(problemaDeExpediente(quarta17h, 30, semana)).toBeNull();
  });

  it('avisa quando a duração TOTAL passa do fim do expediente', () => {
    // É o caso do segundo serviço adicionado no drawer: 17:00 + 1h30 = 18:30.
    expect(problemaDeExpediente(quarta17h, 90, semana)).toBe(
      'o atendimento (1h 30min) passa do expediente, que vai até 18:00',
    );
  });

  it('avisa o dia da semana sem expediente (a recorrência escorregou)', () => {
    expect(problemaDeExpediente(domingo17h, 30, semana)).toBe(
      'a profissional não atende neste dia da semana',
    );
  });

  it('em expediente partido aponta o fim da janela em que o horário cai', () => {
    const partido: JanelaDeExpediente[] = [
      { weekday: 3, startTime: '09:00', endTime: '12:00' },
      { weekday: 3, startTime: '13:00', endTime: '18:00' },
    ];
    expect(problemaDeExpediente(em('2026-08-12T11:30'), 60, partido)).toBe(
      'o atendimento (1h) passa do expediente, que vai até 12:00',
    );
    expect(problemaDeExpediente(em('2026-08-12T11:00'), 60, partido)).toBeNull();
  });

  it('sem o expediente carregado não inventa aviso', () => {
    expect(problemaDeExpediente(domingo17h, 30, undefined)).toBeNull();
  });
});
