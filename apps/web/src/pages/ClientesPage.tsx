import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ActiveChip } from '../components/StatusChip';
import { MonthField } from '../components/DateRangeFilter';
import { IconDownload, IconPencil, IconPlus, IconTrash, IconUsers } from '../components/icons';
import { useCustomers } from '../lib/queries';
import {
  useCreateCustomer,
  useDeleteCustomer,
  useUpdateCustomer,
  type CustomerBody,
} from '../lib/queries/clientes';
import { formatDate, initials, toDateInput } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import type { CustomerFull } from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';

type ContactFilter = 'all' | 'phone' | 'email';

export function ClientesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [contactFilter, setContactFilter] = useState<ContactFilter>('all');
  const [birthdayMonth, setBirthdayMonth] = useState(''); // YYYY-MM

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFull | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const customers = useCustomers(search, page, pageSize);
  const remove = useDeleteCustomer();
  const data = customers.data;
  const allRows = (data?.data ?? []) as CustomerFull[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Contact/birthday filters aren't supported server-side, so filter the
  // current page's rows client-side.
  const rows = useMemo(() => {
    const mm = birthdayMonth ? birthdayMonth.slice(5, 7) : '';
    return allRows.filter(
      (c) =>
        (contactFilter === 'all' ||
          (contactFilter === 'phone' ? Boolean(c.phone) : Boolean(c.email))) &&
        (!mm || (c.birthday ? c.birthday.slice(5, 7) === mm : false)),
    );
  }, [allRows, contactFilter, birthdayMonth]);

  const hasFilters = Boolean(
    search || contactFilter !== 'all' || birthdayMonth,
  );

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleRemove(c: CustomerFull) {
    if (window.confirm(`Remover o cliente "${c.name}"?`)) {
      remove.mutate(c.id);
    }
  }

  function exportCsv() {
    downloadCsv<CustomerFull>(
      'clientes',
      [
        { header: 'Nome', value: (c) => c.name },
        { header: 'Apelido', value: (c) => c.nickname },
        { header: 'Celular', value: (c) => c.phone },
        { header: 'Telefone secundário', value: (c) => c.secondaryPhone },
        { header: 'E-mail', value: (c) => c.email },
        { header: 'Aniversário', value: (c) => (c.birthday ? formatDate(c.birthday) : '') },
        { header: 'Status', value: (c) => (c.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  const columns: Column<CustomerFull>[] = [
    {
      key: 'name',
      header: 'Cliente',
      isRowHeader: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">{c.name}</div>
            {c.nickname && <div className="text-xs text-muted">{c.nickname}</div>}
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Celular', render: (c) => c.phone ?? '—' },
    { key: 'email', header: 'E-mail', render: (c) => c.email ?? '—' },
    { key: 'active', header: 'Status', render: (c) => <ActiveChip active={c.active} /> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-label="Editar"
            onClick={() => setEditing(c)}
          >
            <IconPencil size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Remover"
            className="text-danger"
            onClick={() => handleRemove(c)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={total ? `${total} cliente(s)` : undefined}
        onRefresh={() => customers.refetch()}
        isRefreshing={customers.isFetching}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Novo cliente
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-3 flex max-w-md items-center gap-2">
            <TextField
              value={searchInput}
              onChange={setSearchInput}
              className="min-w-0 flex-1"
              aria-label="Buscar cliente"
            >
              <Input
                placeholder="Buscar por nome…"
                className="focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
            </TextField>
            <Button variant="primary" onClick={applySearch}>
              Buscar
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="inline-flex rounded-lg border border-[var(--color-soft-border)] bg-white p-0.5">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'phone', label: 'Com celular' },
                  { id: 'email', label: 'Com e-mail' },
                ] as { id: ContactFilter; label: string }[]
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setContactFilter(o.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    contactFilter === o.id
                      ? 'bg-[#f2b33d] text-[#3a2a06] shadow-[var(--shadow-gold)]'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <MonthField
              label="Aniversário (mês)"
              value={birthdayMonth}
              onChange={setBirthdayMonth}
            />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setContactFilter('all');
                  setBirthdayMonth('');
                  setPage(1);
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {customers.isLoading ? (
            <LoadingState />
          ) : customers.isError ? (
            <ErrorState onRetry={() => customers.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={32} />}
              title="Nenhum cliente encontrado"
              description={
                hasFilters
                  ? 'Tente ajustar a busca ou os filtros.'
                  : 'Cadastre seu primeiro cliente.'
              }
              action={
                !hasFilters ? (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Novo cliente
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {rows.length} cliente(s) nesta página
                {total ? ` · ${total} no total` : ''}
              </p>
              <DataTable
                aria-label="Clientes"
                columns={columns}
                rows={rows}
                getKey={(c) => c.id}
              />
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      <CustomerModal mode="create" isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <CustomerModal
        mode="edit"
        customer={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

function CustomerModal({
  mode,
  customer,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  customer?: CustomerFull | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(customer?.name ?? '');
      setNickname(customer?.nickname ?? '');
      setPhone(customer?.phone ?? '');
      setSecondaryPhone(customer?.secondaryPhone ?? '');
      setEmail(customer?.email ?? '');
      setBirthday(toDateInput(customer?.birthday));
      setActive(customer?.active ?? true);
      setError(null);
    }
  }, [isOpen, customer]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    const body: CustomerBody = {
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      secondaryPhone: secondaryPhone.trim() || undefined,
      email: email.trim() || undefined,
      birthday: birthday || undefined,
      active,
    };
    try {
      if (mode === 'edit' && customer) {
        await update.mutateAsync({ id: customer.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o cliente.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container size="lg" placement="center">
        <Modal.Dialog className="w-full max-w-lg">
          <Modal.Header>
            <Modal.Heading>{mode === 'edit' ? 'Editar cliente' : 'Novo cliente'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome completo" />
                </TextField>
              </Field>
              <Field label="Apelido">
                <TextField value={nickname} onChange={setNickname} aria-label="Apelido">
                  <Input placeholder="Como é chamado(a)" />
                </TextField>
              </Field>
              <Field label="Celular">
                <TextField value={phone} onChange={setPhone} aria-label="Celular">
                  <Input placeholder="(00) 00000-0000" />
                </TextField>
              </Field>
              <Field label="Telefone secundário">
                <TextField
                  value={secondaryPhone}
                  onChange={setSecondaryPhone}
                  aria-label="Telefone secundário"
                >
                  <Input placeholder="(00) 0000-0000" />
                </TextField>
              </Field>
              <Field label="E-mail">
                <TextField value={email} onChange={setEmail} aria-label="E-mail">
                  <Input type="email" placeholder="email@exemplo.com" />
                </TextField>
              </Field>
              <Field label="Aniversário">
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  aria-label="Aniversário"
                  className="w-full rounded-lg border border-default-300 bg-white px-3 py-2 text-sm text-foreground"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Ativo
            </label>

            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canSave}
              onClick={handleSave}
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
