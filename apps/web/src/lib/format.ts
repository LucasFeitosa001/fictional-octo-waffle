const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Money fields come from the API as Decimal strings (e.g. "180"). */
export function formatMoney(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  return BRL.format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR').format(value ?? 0);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(d);
}

/**
 * "YYYY-MM-DD" do dia em que esse instante cai no fuso de QUEM ESTÁ OLHANDO.
 *
 * Antes isto era `d.toISOString().slice(0, 10)`, que imprime o dia em UTC. Em
 * America/Sao_Paulo (UTC−3) isso quebrava todo dia das 21:00 em diante: são
 * 21:30, a cliente pede para marcar "hoje mesmo, mais tarde", a recepção abre
 * o "Novo +" e o campo Data já vem com AMANHÃ — e ela não confere, porque não
 * foi ela que escolheu. O agendamento nasce um dia inteiro fora. Medido:
 * `new Date('2026-08-09T21:30-03:00')` → UTC "2026-08-10", local "2026-08-09".
 * O mesmo escorregão atingia o "hoje" do fechamento de caixa, das comandas,
 * das compras e do pagamento de comissão — a função é usada em 95 lugares.
 *
 * Para um Date à meia-noite LOCAL (toda célula de calendário do painel, criada
 * com `new Date(ano, mês, dia)`) o resultado é idêntico ao de antes: 00:00 em
 * São Paulo é 03:00Z do MESMO dia. Quem muda de valor é só quem passa um Date
 * com hora — que é exatamente onde estava o erro.
 *
 * É a mesma conta do `toISO` do DatePicker, que já documenta a convenção do
 * projeto: data trafega como "YYYY-MM-DD" em horário local, sem fuso.
 *
 * Se o Date veio de um campo data-only que o backend gravou como MEIA-NOITE
 * UTC (Transaction.dueDate/paidAt/competenceDate, Purchase.date), use
 * `isoDateUtc` — aqui ele voltaria um dia.
 */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "YYYY-MM-DD" do dia em UTC — o comportamento antigo do `isoDate`, mantido só
 * para os campos data-only que o backend cria com `new Date('2026-08-09')` e
 * portanto guarda como `2026-08-09T00:00:00.000Z` (financial.service.ts:761 e
 * :784-787, purchases.service.ts:133 e :221). Ler esses valores em horário
 * local devolveria 08/08 — reabrir a despesa para editar puxaria a data um dia
 * para trás e salvar gravaria o erro. Para "que dia é hoje" ou para um instante
 * de verdade (início de agendamento), use `isoDate`.
 */
export function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * ISO datetime -> "YYYY-MM-DD" for <input type="date">.
 *
 * Fica em UTC de propósito, como o `isoDateUtc`: só alimenta campos data-only
 * gravados à meia-noite UTC (birthday do cliente e do profissional, validade e
 * fabricação do lote). Em horário local todos apareceriam um dia antes.
 */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Render a UTC ISO instant as HH:mm in America/Sao_Paulo (slot labels). */
export function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

/** Minutes -> "1h 30min" / "45min". */
export function formatDuration(min: number | null | undefined): string {
  const m = min ?? 0;
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

/**
 * Formata telefone BR a partir de string bruta (dígitos com/sem DDI).
 * Ex.: "5589981228494" → "+55 (89) 98122-8494"; "11987654321" → "(11) 98765-4321".
 * Retorna a string original quando não bate com um padrão conhecido.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  // 13 dígitos: DDI 55 + DDD + 9 dígitos (celular)
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  // 12 dígitos: DDI 55 + DDD + 8 dígitos (fixo)
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  // 11 dígitos: DDD + celular
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  // 10 dígitos: DDD + fixo
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/**
 * Tempo relativo curto em pt-BR a partir de um timestamp em ms (ex.: o
 * `dataUpdatedAt` do react-query v5). Usado no indicador "Atualizado há X"
 * do Painel. Re-chame periodicamente (setInterval) p/ manter o texto vivo.
 *
 * 0 ou inválido → "—". <45s → "agora mesmo". Depois: "há N min" / "há N h" /
 * "há N d".
 */
export function timeAgo(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'agora mesmo';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'agora mesmo';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} d`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
