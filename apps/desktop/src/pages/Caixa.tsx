import { useMemo, useState } from 'react';
import { Banknote, PlusCircle, Trash2 } from 'lucide-react';
import type { Command, CommandItem, PaymentMethod } from '@silvia/core';
import {
  commandItemTotal,
  commandPaid,
  commandStatusLabels,
  commandTotal,
  formatBRL,
  formatDateTime,
  localDayOfISO,
  newId,
  nowLocalISO,
  paymentMethodLabels,
  todayISO,
} from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Modal, ModalButton } from '../components/Modal';
import { StatusBadge, commandStatusTones } from '../components/StatusBadge';
import { Tabs } from '../components/Tabs';

const METHODS = Object.keys(paymentMethodLabels) as PaymentMethod[];

function CommandDetail({
  command,
  onClose,
  onChange,
}: {
  command: Command;
  onClose: () => void;
  onChange: (id: string, patch: Partial<Omit<Command, 'id'>>) => Promise<unknown>;
}) {
  const lookups = useLookups();
  const [itemKind, setItemKind] = useState<'servico' | 'produto'>('servico');
  const [refId, setRefId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [professionalId, setProfessionalId] = useState('');
  const [discount, setDiscount] = useState(command.discountPercent);
  const [method, setMethod] = useState<PaymentMethod>('pix');

  const total = commandTotal({ ...command, discountPercent: discount });
  const paid = commandPaid(command);
  const open = command.status === 'aberta';

  const options =
    itemKind === 'servico'
      ? [...lookups.services.values()].filter((s) => s.active).map((s) => ({ id: s.id, label: s.name, price: s.avgPrice }))
      : [...lookups.products.values()].filter((p) => p.active).map((p) => ({ id: p.id, label: p.name, price: p.salePrice }));

  async function addItem() {
    const opt = options.find((o) => o.id === refId);
    if (!opt) return;
    const item: CommandItem = {
      id: newId('cmi'),
      kind: itemKind,
      refId: opt.id,
      description: opt.label,
      quantity,
      unitPrice: opt.price,
      discountPercent: 0,
      professionalId: professionalId || undefined,
    };
    await onChange(command.id, { items: [...command.items, item] });
    setRefId('');
    setQuantity(1);
  }

  async function removeItem(itemId: string) {
    await onChange(command.id, { items: command.items.filter((i) => i.id !== itemId) });
  }

  async function pay() {
    await onChange(command.id, {
      discountPercent: discount,
      status: 'paga',
      closedAt: nowLocalISO(),
      payments: [
        ...command.payments,
        { id: newId('pay'), method, amount: total - paid, paidAt: nowLocalISO() },
      ],
    });
    // Baixa de estoque dos produtos vendidos: registra a movimentação e decrementa o saldo.
    for (const item of command.items.filter((i) => i.kind === 'produto')) {
      const product = lookups.products.get(item.refId);
      if (!product?.trackStock) continue;
      await repos.stockMovements.create({
        productId: product.id,
        kind: 'saida',
        quantity: item.quantity,
        date: todayISO(),
        reason: `Venda comanda #${command.number}`,
        unitPrice: item.unitPrice,
      });
      await repos.products.update(product.id, { stock: Math.max(0, product.stock - item.quantity) });
    }
    onClose();
  }

  const selectClass =
    'min-h-12 w-full rounded-xl border border-ink-100 bg-white px-3 py-2 text-base text-ink-900 focus:border-brand-300 focus:outline-none sm:min-h-11 sm:w-auto sm:text-sm';

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Comanda #${command.number}`}
      subtitle={`${lookups.clientName(command.clientId)} · aberta em ${formatDateTime(command.openedAt)}`}
      wide
      footer={
        open ? (
          <>
            <ModalButton variant="ghost" onClick={() => onChange(command.id, { status: 'cancelada' }).then(onClose)}>
              Cancelar comanda
            </ModalButton>
            <ModalButton onClick={pay} disabled={command.items.length === 0}>
              Receber {formatBRL(total - paid)} ({paymentMethodLabels[method]})
            </ModalButton>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Itens</h4>
            <StatusBadge tone={commandStatusTones[command.status]}>{commandStatusLabels[command.status]}</StatusBadge>
          </div>
          {command.items.length === 0 ? (
            <p className="rounded-xl bg-paper px-4 py-6 text-center text-sm text-ink-500">Nenhum item lançado.</p>
          ) : (
            <ul className="divide-y divide-ink-100/70 rounded-xl border border-ink-100">
              {command.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm sm:flex-nowrap sm:px-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{item.description}</p>
                    <p className="text-xs text-ink-500">
                      {item.quantity}x {formatBRL(item.unitPrice)}
                      {item.discountPercent > 0 ? ` · ${item.discountPercent}% off` : ''}
                      {item.professionalId ? ` · ${lookups.professionalName(item.professionalId)}` : ''}
                    </p>
                  </div>
                  <span className="font-semibold text-ink-900">{formatBRL(commandItemTotal(item))}</span>
                  {open ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex size-11 items-center justify-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-600"
                      title="Remover item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {open ? (
          <div className="rounded-xl bg-paper p-3 sm:p-4">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Adicionar item</h4>
            <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
              <select value={itemKind} onChange={(e) => { setItemKind(e.target.value as 'servico' | 'produto'); setRefId(''); }} className={selectClass}>
                <option value="servico">Serviço</option>
                <option value="produto">Produto</option>
              </select>
              <select value={refId} onChange={(e) => setRefId(e.target.value)} className={`${selectClass} col-span-2 sm:min-w-48 sm:flex-1`}>
                <option value="">Selecione...</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} — {formatBRL(o.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className={`${selectClass} sm:w-20`}
                title="Quantidade"
              />
              <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} className={`${selectClass} col-span-2`}>
                <option value="">Sem profissional</option>
                {[...lookups.professionals.values()]
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addItem}
                disabled={!refId}
                className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                <PlusCircle className="size-4" />
                Adicionar
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-ink-100 p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Pagamento</h4>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {open ? (
              <>
                <label className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-ink-500">Desconto geral (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className={`${selectClass} text-right sm:w-24`}
                  />
                </label>
                <label className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-ink-500">Forma de pagamento</span>
                  <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={selectClass}>
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {paymentMethodLabels[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              command.payments.map((p) => (
                <p key={p.id} className="text-ink-700 sm:col-span-2">
                  {paymentMethodLabels[p.method]} · {formatBRL(p.amount)} · {formatDateTime(p.paidAt)}
                </p>
              ))
            )}
            <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-3 sm:col-span-2">
              <span className="font-semibold text-ink-900">Total</span>
              <span className="text-xl font-bold text-brand-700">{formatBRL(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export function CaixaPage() {
  const commands = useCollection(repos.commands);
  const lookups = useLookups();
  const [filter, setFilter] = useState<'aberta' | 'paga' | 'todas'>('aberta');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newClientId, setNewClientId] = useState('');

  const hoje = todayISO();
  const filtered = useMemo(
    () => (filter === 'todas' ? commands.items : commands.items.filter((c) => c.status === filter)),
    [commands.items, filter],
  );
  const detail = detailId ? commands.items.find((c) => c.id === detailId) ?? null : null;

  const paidToday = commands.items.filter((c) => c.status === 'paga' && localDayOfISO(c.closedAt) === hoje);
  const totalToday = paidToday.reduce((s, c) => s + commandTotal(c), 0);
  const byMethod = paidToday
    .flatMap((c) => c.payments)
    .reduce<Record<string, number>>((acc, p) => {
      acc[p.method] = (acc[p.method] ?? 0) + p.amount;
      return acc;
    }, {});

  async function openCommand() {
    if (!newClientId) return;
    const maxNumber = commands.items.reduce((max, c) => Math.max(max, c.number), 0);
    const created = await commands.create({
      number: maxNumber + 1,
      clientId: newClientId,
      openedAt: nowLocalISO(),
      status: 'aberta',
      items: [],
      discountPercent: 0,
      payments: [],
    });
    setNewOpen(false);
    setNewClientId('');
    setDetailId(created.id);
  }

  return (
    <div>
      <PageHeader
        title="Caixa / Comandas"
        description="Comandas de atendimento, recebimento e fechamento do dia."
        onNew={() => setNewOpen(true)}
        newLabel="Abrir comanda"
      />

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Banknote className="size-5" />
          </span>
          <div>
            <p className="text-sm text-ink-500">Fechamento do dia ({paidToday.length} comandas pagas)</p>
            <p className="text-xl font-semibold text-ink-900">{formatBRL(totalToday)}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="mb-2 text-sm text-ink-500">Por forma de pagamento</p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(byMethod).length === 0 ? (
              <span className="text-sm text-ink-300">Nenhum recebimento hoje.</span>
            ) : (
              Object.entries(byMethod).map(([m, v]) => (
                <span key={m} className="rounded-full bg-paper px-3 py-1.5 text-sm text-ink-700 ring-1 ring-inset ring-ink-100">
                  {paymentMethodLabels[m as PaymentMethod]}: <strong>{formatBRL(v)}</strong>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'aberta', label: 'Abertas' },
            { key: 'paga', label: 'Pagas' },
            { key: 'todas', label: 'Todas' },
          ]}
          active={filter}
          onChange={(k) => setFilter(k as typeof filter)}
        />
      </div>

      <DataTable
        columns={[
          { key: 'number', header: 'Nº', render: (c) => <span className="font-semibold text-ink-900">#{c.number}</span> },
          { key: 'client', header: 'Cliente', render: (c) => lookups.clientName(c.clientId) },
          { key: 'opened', header: 'Abertura', render: (c) => formatDateTime(c.openedAt) },
          { key: 'items', header: 'Itens', render: (c) => c.items.length, className: 'text-right' },
          { key: 'total', header: 'Total', render: (c) => <span className="font-semibold">{formatBRL(commandTotal(c))}</span>, className: 'text-right' },
          {
            key: 'status',
            header: 'Status',
            render: (c) => <StatusBadge tone={commandStatusTones[c.status]}>{commandStatusLabels[c.status]}</StatusBadge>,
          },
        ]}
        items={filtered}
        loading={commands.loading}
        onRowClick={(c) => setDetailId(c.id)}
        emptyTitle={filter === 'aberta' ? 'Nenhuma comanda aberta' : 'Nenhuma comanda encontrada'}
        emptyDescription="Clique em “Abrir comanda” para iniciar um atendimento."
      />

      {detail ? <CommandDetail command={detail} onClose={() => setDetailId(null)} onChange={commands.update} /> : null}

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Abrir comanda"
        size="md"
        footer={
          <>
            <ModalButton variant="ghost" onClick={() => setNewOpen(false)}>
              Cancelar
            </ModalButton>
            <ModalButton onClick={openCommand} disabled={!newClientId}>
              Abrir
            </ModalButton>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">Cliente</span>
          <select
            value={newClientId}
            onChange={(e) => setNewClientId(e.target.value)}
            className="w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm focus:border-brand-300 focus:outline-none"
          >
            <option value="">Selecione a cliente...</option>
            {[...lookups.clients.values()]
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      </Modal>
    </div>
  );
}
