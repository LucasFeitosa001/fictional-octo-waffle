'use client';

import { useEffect, useState } from 'react';
import { Avatar, Button, Card, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconPlus, IconUsers } from '@/components/icons';
import {
  useCustomers,
  useCreateCustomer,
  useDeleteCustomer,
  useUpdateCustomer,
  type CustomerBody,
} from '@/lib/queries';
import { initials, toDateInput } from '@/lib/format';
import type { CustomerFull } from '@/lib/types';

export default function ClientesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFull | null>(null);

  const customers = useCustomers(search, page, pageSize);
  const remove = useDeleteCustomer();
  const data = customers.data;
  const rows = (data?.data ?? []) as CustomerFull[];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleRemove(c: CustomerFull) {
    if (window.confirm(`Remover o cliente "${c.name}"?`)) {
      remove.mutate(c.id);
    }
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleRemove(c)}>
            Remover
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
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo cliente
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          <div className="mb-4 flex max-w-md items-center gap-2">
            <TextField
              value={searchInput}
              onChange={setSearchInput}
              className="flex-1"
              aria-label="Buscar cliente"
            >
              <Input
                placeholder="Buscar por nome…"
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
            </TextField>
            <Button variant="primary" onClick={applySearch}>
              Buscar
            </Button>
          </div>

          {customers.isLoading ? (
            <LoadingState />
          ) : customers.isError ? (
            <ErrorState onRetry={() => customers.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={32} />}
              title="Nenhum cliente encontrado"
              description={search ? 'Tente outro termo de busca.' : 'Cadastre seu primeiro cliente.'}
              action={
                !search ? (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Novo cliente
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTable aria-label="Clientes" columns={columns} rows={rows} getKey={(c) => c.id} />
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
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o cliente.');
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
                    <Input placeholder="Como é chamado" />
                  </TextField>
                </Field>
                <Field label="Celular">
                  <TextField value={phone} onChange={setPhone} aria-label="Celular">
                    <Input placeholder="(00) 00000-0000" />
                  </TextField>
                </Field>
                <Field label="Telefone secundário">
                  <TextField value={secondaryPhone} onChange={setSecondaryPhone} aria-label="Telefone secundário">
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
                    className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground [color-scheme:dark]"
                  />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
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
