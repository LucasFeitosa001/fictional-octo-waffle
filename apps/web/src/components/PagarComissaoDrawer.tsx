import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Chip, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { CommissionReceiptButton } from './CommissionReceiptButton';
import { LoadingState } from './States';
import { DateField } from './DateRangeFilter';
import { IconGift, IconInfo, IconReceipt, IconWallet } from './icons';
import { formatDate, formatMoney, isoDate } from '../lib/format';
import { useFinancialAccounts, usePaymentMethods } from '../lib/queries/financeiro';
import { useEmpresa } from '../lib/queries/empresa';
import { useSalonPay, useSalonPayRecipients } from '../lib/queries/salonpay';
import { apiErrorMessage } from '../lib/toast';
import {
  useCommissionAdvances,
  usePayCommissionsBulk,
  type CommissionAdvance,
  type CommissionPaymentRecord,
  type CommissionSummaryRow,
} from '../lib/queries/comissoes';

/**
 * Drawer de pagamento de comissões (estilo Belasis).
 *
 * Para cada profissional selecionado exibe a fórmula:
 *   Comissões (Σ) − Vales (Σ marcados) + Bonificações = **Valor a pagar**
 *
 * Os vales `open` do profissional podem ser marcados/desmarcados para deduzir.
 * Ao confirmar, dispara POST /commission-payments/bulk com um item por
 * profissional (entryIds vazio = o backend quita TODAS as entries `open`).
 */
export function PagarComissaoDrawer({
  open,
  rows,
  closingId,
  rail = 'manual',
  from,
  to,
  onClose,
  onPaid,
}: {
  open: boolean;
  rows: CommissionSummaryRow[];
  closingId?: string;
  /**
   * Período que a TELA está mostrando. Vai junto no pagamento para o backend
   * quitar exatamente os lançamentos que foram somados aqui — sem isto ele
   * quitava todas as comissões em aberto do profissional, de qualquer mês.
   */
  from?: string;
  to?: string;
  /**
   * Trilho escolhido no menu "Pagar comissões": `manual` (o salão pagou por
   * fora e está registrando) ou `salonpay`.
   */
  rail?: 'manual' | 'salonpay';
  onClose: () => void;
  /** Chamado após o pagamento em lote ser registrado com sucesso. */
  onPaid?: () => void;
}) {
  const bulk = usePayCommissionsBulk();
  // Todos os vales `open` da empresa; agrupamos por profissional no cliente.
  const advancesQuery = useCommissionAdvances({ status: 'open' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    count: number;
    total: number;
    payments: CommissionPaymentRecord[];
  } | null>(null);
  // Forma de pagamento, conta e data — os três campos que o Belasis marca como
  // obrigatórios. São eles que permitem gerar a despesa no Financeiro; sem
  // conta, o pagamento some do fechamento do mês.
  const methods = usePaymentMethods();
  const accounts = useFinancialAccounts();
  const salonpay = useSalonPay();
  const empresa = useEmpresa();
  // Quem tem chave PIX. Sem destino não há transferência — precisa aparecer
  // ANTES de pagar, por profissional, e não falhar depois.
  const recipients = useSalonPayRecipients();
  const salonPay = rail === 'salonpay';
  const semDestino = salonPay
    ? rows.filter((r) => {
        const dest = (recipients.data ?? []).find((d) => d.id === r.professionalId);
        return dest && !dest.temDestino;
      })
    : [];
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paidAt, setPaidAt] = useState(() => isoDate(new Date()));

  // advanceIds marcados por profissional (default: todos marcados).
  const [checkedByProf, setCheckedByProf] = useState<Record<string, Set<string>>>({});

  const advancesByProf = useMemo(() => {
    const map = new Map<string, CommissionAdvance[]>();
    for (const a of advancesQuery.data ?? []) {
      const list = map.get(a.professional.id) ?? [];
      list.push(a);
      map.set(a.professional.id, list);
    }
    return map;
  }, [advancesQuery.data]);

  // Ao abrir (ou quando os vales carregam), marca todos os vales por padrão.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setPaidAt(isoDate(new Date()));
  }, [open]);

  // Os vales são carregados depois que o drawer abre. Atualizar os checkboxes
  // quando essa consulta termina não pode limpar o resultado do pagamento —
  // caso contrário o refetch disparado por `onPaid` apagava os botões de recibo
  // antes que o operador conseguisse baixá-los.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, Set<string>> = {};
    for (const row of rows) {
      const list = advancesByProf.get(row.professionalId) ?? [];
      next[row.professionalId] = new Set(list.map((a) => a.id));
    }
    setCheckedByProf(next);
  }, [open, advancesByProf]);

  function toggleAdvance(profId: string, advanceId: string) {
    setCheckedByProf((prev) => {
      const set = new Set(prev[profId] ?? []);
      if (set.has(advanceId)) set.delete(advanceId);
      else set.add(advanceId);
      return { ...prev, [profId]: set };
    });
  }

  /**
   * Valor a pagar por profissional (sempre ≥ 0), pela fórmula do Belasis.
   *
   * Usa `comissaoAberta`/`bonusAberto`, NÃO `comissao`/`bonus`: estes últimos
   * são o total do período e incluem o que já foi pago. Com eles, a Fátima
   * aparecia com R$ 528,07 quando o backend quitaria R$ 462,00 — os R$ 66,07 de
   * três lançamentos já pagos entravam de novo na conta. O `payItem` só toca em
   * `status = 'open'`, então a tela prometia mais do que o pagamento registra.
   * Ver estudo 51.
   */
  function amountFor(row: CommissionSummaryRow): number {
    const list = advancesByProf.get(row.professionalId) ?? [];
    const checked = checkedByProf[row.professionalId];
    const advancesTotal = list
      .filter((a) => checked?.has(a.id))
      .reduce((s, a) => s + a.amount, 0);
    const gross = row.comissaoAberta + row.bonusAberto - advancesTotal;
    return gross > 0 ? gross : 0;
  }

  const grandTotal = rows.reduce((s, r) => s + amountFor(r), 0);
  const loadingAdvances = advancesQuery.isLoading;

  // Quebra do LOTE para os cards de topo. Os vales contados são só os
  // MARCADOS — o card tem que bater com o Líquido logo abaixo dele. E as
  // comissões são as EM ABERTO, pelo mesmo motivo de `amountFor`.
  const totais = useMemo(() => {
    let comissoes = 0;
    let bonus = 0;
    let vales = 0;
    // Quanto do período já estava quitado — vira a nota explicativa.
    let jaPago = 0;
    for (const row of rows) {
      comissoes += row.comissaoAberta;
      bonus += row.bonusAberto;
      jaPago += Math.max(0, row.comissao - row.comissaoAberta) + Math.max(0, row.bonus - row.bonusAberto);
      const list = advancesByProf.get(row.professionalId) ?? [];
      const checked = checkedByProf[row.professionalId];
      vales += list.filter((a) => checked?.has(a.id)).reduce((s, a) => s + a.amount, 0);
    }
    return { comissoes, bonus, vales, jaPago };
  }, [rows, advancesByProf, checkedByProf]);

  async function handleConfirm() {
    setError(null);
    if (!accountId) {
      setError('Escolha a conta — é ela que lança a despesa no Financeiro.');
      return;
    }
    // No trilho manual a forma de pagamento é obrigatória; no SalonPay a forma
    // É o SalonPay, então perguntar seria pedir uma informação que não existe.
    if (!salonPay && !paymentMethodId) {
      setError('Escolha a forma de pagamento — é ela que classifica a saída no Financeiro.');
      return;
    }
    try {
      const res = await bulk.mutateAsync({
        closingId,
        paymentMethodId,
        accountId,
        // Data de HOJE guarda o instante real (auditoria sabe a hora do
        // pagamento). Retroativo guarda meio-dia: não existe hora conhecida, e
        // meio-dia impede o fuso de jogar o lançamento para o dia vizinho.
        paidAt: paidAt ? instanteDoPagamento(paidAt) : undefined,
        rail,
        from,
        to,
        items: rows.map((row) => ({
          professionalId: row.professionalId,
          advanceIds: [...(checkedByProf[row.professionalId] ?? [])],
        })),
      });
      const total = res.payments.reduce((s, p) => s + Number(p.amount), 0);
      setResult({ count: res.count, total, payments: res.payments });
      onPaid?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? apiErrorMessage(err) : 'Não foi possível registrar o pagamento.');
    }
  }

  const title =
    rail === 'salonpay'
      ? 'Pagamento de comissões — SalonPay'
      : rows.length === 1
        ? `Pagar — ${rows[0]?.professionalName ?? ''}`
        : `Pagar ${rows.length} profissionais`;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={title}
      widthClass="sm:w-[560px]"
      fullscreen
      footer={
        result ? (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={rows.length === 0 || bulk.isPending}
              onClick={handleConfirm}
            >
              <IconWallet size={16} />
              {bulk.isPending ? 'Pagando…' : `Pagar ${formatMoney(grandTotal)}`}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--sp-data-income)]/15 text-[var(--sp-data-income)]">
            <IconWallet size={28} />
          </span>
          <p className="text-lg font-semibold text-foreground">Pagamento concluído</p>
          <p className="text-sm text-muted">
            {result.count} {result.count === 1 ? 'pagamento registrado' : 'pagamentos registrados'} · total de{' '}
            <span className="font-semibold text-foreground">{formatMoney(result.total)}</span>
          </p>
          <div className="mt-3 w-full max-w-md divide-y divide-[var(--color-soft-border)] rounded-xl border border-[var(--color-soft-border)] bg-white text-left">
            {result.payments.map((payment) => {
              const row = rows.find((item) => item.professionalId === payment.professionalId);
              return (
                <div key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {row?.professionalName ?? 'Profissional'}
                    </div>
                    <div className="text-xs text-muted">{formatMoney(Number(payment.amount))} · recibo para assinatura</div>
                  </div>
                  <CommissionReceiptButton
                    compact
                    data={{
                      professionalName: row?.professionalName ?? 'Profissional',
                      companyName: empresa.data?.name,
                      companyLogoUrl: empresa.data?.logoUrl,
                      paidAt,
                      amount: Number(payment.amount),
                      commissionTotal: Number(payment.commissionTotal),
                      bonusTotal: Number(payment.bonusTotal),
                      advancesTotal: Number(payment.advancesTotal),
                      entriesCount: payment.entriesCount,
                      from,
                      to,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Cards de topo do Belasis: Comissões · Vales · Bonificações e o
              Líquido em destaque. É o resumo do LOTE inteiro. */}
          <div className="grid grid-cols-3 gap-3">
            <CardTotal label="Comissões" value={totais.comissoes} />
            <CardTotal label="Vales" value={totais.vales} negativo />
            <CardTotal label="Bonificações" value={totais.bonus} />
          </div>
          <div className="rounded-xl border border-[var(--color-soft-border)] bg-white py-4 text-center">
            <div className="text-sm font-medium text-muted">Líquido</div>
            <div className="text-2xl font-bold text-data-income">{formatMoney(grandTotal)}</div>
            {/* A lista mostra o período INTEIRO; aqui só o que ainda está em
                aberto. Sem esta linha, ver 462,00 depois de ler 528,07 na
                tabela parece erro de conta. */}
            {totais.jaPago > 0.004 && (
              <div className="mt-1 px-3 text-xs text-muted">
                {formatMoney(totais.jaPago)} do período já foram pagos e não entram aqui.
              </div>
            )}
          </div>

          {/* SalonPay ainda não liquida sozinho — dizer isso aqui, e não depois. */}
          {rail === 'salonpay' && !salonpay.data?.canSettle && (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs text-foreground">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                A conexão do SalonPay com o adquirente ainda não está ativa. O pagamento será
                REGISTRADO (comissões quitadas e despesa lançada no Financeiro), mas a
                transferência para a profissional não sai automaticamente.
              </span>
            </div>
          )}

          {/* Destino do repasse — só no SalonPay, que é conta digital: o dinheiro
              vai por PIX para a profissional, não por uma "forma de pagamento". */}
          {salonPay && (
            <div className="rounded-xl border border-[var(--color-soft-border)] bg-white p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Destino do repasse
              </div>
              <ul className="flex flex-col gap-1.5">
                {rows.map((r) => {
                  const dest = (recipients.data ?? []).find((d) => d.id === r.professionalId);
                  return (
                    <li
                      key={r.professionalId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">{r.professionalName}</span>
                      {dest?.temDestino ? (
                        <span className="shrink-0 font-medium text-muted">
                          PIX {mascararChave(dest.pixKey)}
                        </span>
                      ) : (
                        <span className="shrink-0 font-medium text-danger">
                          sem chave PIX cadastrada
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {semDestino.length > 0 && (
                <p className="mt-2 text-xs text-danger">
                  {semDestino.length === 1
                    ? `${semDestino[0].professionalName} está sem chave PIX. O repasse fica registrado como pendente de destino até a chave ser cadastrada em Cadastros → Profissionais.`
                    : `${semDestino.length} profissionais estão sem chave PIX. Os repasses ficam pendentes de destino até as chaves serem cadastradas.`}
                </p>
              )}
            </div>
          )}

          {/* Forma de pagamento · Conta · Data — obrigatórios como na referência */}
          <div className={`grid grid-cols-1 gap-3 ${salonPay ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {salonPay ? null : (
            <CampoPg label="Forma de pagamento" obrigatorio>
              <Select
                aria-label="Forma de pagamento"
                selectedKey={paymentMethodId || null}
                onSelectionChange={(k) => setPaymentMethodId(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ selectedText }) => selectedText || 'Forma de pagamento'}
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {(methods.data ?? []).map((m) => (
                      <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                        {m.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </CampoPg>
            )}

            <CampoPg label={salonPay ? 'Conta de origem' : 'Conta'} obrigatorio>
              <Select
                aria-label="Conta"
                selectedKey={accountId || null}
                onSelectionChange={(k) => setAccountId(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>{({ selectedText }) => selectedText || 'Conta'}</Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {(accounts.data ?? []).map((c) => (
                      <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                        {c.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </CampoPg>

            <CampoPg label="Data">
              <DateField value={paidAt} onChange={setPaidAt} />
            </CampoPg>
          </div>

          {loadingAdvances ? (
            <LoadingState label="Carregando vales…" />
          ) : (
            rows.map((row) => {
              const advances = advancesByProf.get(row.professionalId) ?? [];
              const checked = checkedByProf[row.professionalId];
              const deduzido = advances
                .filter((a) => checked?.has(a.id))
                .reduce((s, a) => s + a.amount, 0);
              const valor = amountFor(row);
              return (
                <div
                  key={row.professionalId}
                  className="rounded-xl border border-[var(--color-soft-border)] bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="font-semibold text-foreground">{row.professionalName}</span>
                    <span className="text-lg font-bold text-data-payable">{formatMoney(valor)}</span>
                  </div>

                  {/* Fórmula: Comissões − Vales + Bonificações = Valor a pagar */}
                  <div className="flex flex-col gap-1.5 rounded-lg bg-cream/60 p-3 text-sm">
                    <FormulaLine
                      label="Comissões"
                      value={formatMoney(row.comissaoAberta)}
                      icon={<IconReceipt size={14} />}
                    />
                    <FormulaLine
                      label="Vales (deduzidos)"
                      value={`− ${formatMoney(deduzido)}`}
                      negative
                      icon={<IconWallet size={14} />}
                    />
                    <FormulaLine
                      label="Bonificações"
                      value={`+ ${formatMoney(row.bonusAberto)}`}
                      icon={<IconGift size={14} />}
                    />
                    <div className="mt-1 flex items-center justify-between border-t border-[var(--color-soft-border)] pt-2">
                      <span className="text-sm font-semibold text-foreground">Valor a pagar</span>
                      <span className="text-base font-bold text-foreground">{formatMoney(valor)}</span>
                    </div>
                  </div>

                  {/* Vales em aberto do profissional — marcar quais deduzir */}
                  {advances.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Vales em aberto ({advances.length})
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {advances.map((a) => (
                          <li key={a.id}>
                            <Checkbox
                              isSelected={checked?.has(a.id) ?? false}
                              onChange={() => toggleAdvance(row.professionalId, a.id)}
                              aria-label={`Deduzir vale de ${formatMoney(a.amount)}`}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream"
                            >
                              <Checkbox.Content className="flex min-w-0 flex-1 items-center gap-2">
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                  <span className="min-w-0 truncate text-sm text-foreground">
                                    {formatDate(a.date)}
                                    {a.note ? <span className="text-muted"> · {a.note}</span> : null}
                                  </span>
                                  <span className="shrink-0 text-sm font-semibold text-foreground">
                                    {formatMoney(a.amount)}
                                  </span>
                                </span>
                              </Checkbox.Content>
                            </Checkbox>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {rows.length > 1 && !loadingAdvances && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-soft-border)] bg-warm-white px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Total a pagar</span>
              <Chip color="success" variant="soft" size="sm" className="text-base font-bold">
                {formatMoney(grandTotal)}
              </Chip>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/**
 * Instante a gravar para a data escolhida no drawer.
 *
 * Se a pessoa manteve HOJE, o pagamento está acontecendo agora — grava o
 * momento real. Se escolheu outro dia (lançamento retroativo), não há hora
 * conhecida: meio-dia é o ponto do dia que nenhum fuso empurra para a data
 * vizinha.
 */
function instanteDoPagamento(dataEscolhida: string): string {
  const hoje = isoDate(new Date());
  if (dataEscolhida === hoje) return new Date().toISOString();
  return new Date(`${dataEscolhida}T12:00:00`).toISOString();
}

/**
 * Chave PIX parcialmente escondida. CPF e telefone completos numa tela que
 * qualquer pessoa da recepção abre é exposição desnecessária — o que importa
 * aqui é confirmar que EXISTE destino, não ler a chave inteira.
 */
function mascararChave(chave: string | null): string {
  if (!chave) return '—';
  const limpa = chave.trim();
  if (limpa.length <= 4) return limpa;
  return `••••${limpa.slice(-4)}`;
}

function CardTotal({
  label,
  value,
  negativo,
}: {
  label: string;
  value: number;
  negativo?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white py-3 text-center">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div
        className={
          negativo && value > 0
            ? 'text-base font-bold text-danger'
            : 'text-base font-bold text-foreground'
        }
      >
        {negativo && value > 0 ? `−${formatMoney(value)}` : formatMoney(value)}
      </div>
    </div>
  );
}

function CampoPg({
  label,
  obrigatorio,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-foreground">
        {obrigatorio && <span className="mr-1 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function FormulaLine({
  label,
  value,
  icon,
  negative,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-muted">
        {icon}
        {label}
      </span>
      <span className={negative ? 'font-medium text-danger' : 'font-medium text-foreground'}>{value}</span>
    </div>
  );
}
