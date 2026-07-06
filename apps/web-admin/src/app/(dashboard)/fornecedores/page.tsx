'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconPlus, IconTruck } from '@/components/icons';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from '@/lib/queries/fornecedores';

export default function FornecedoresPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const suppliers = useSuppliers(search || undefined);
  const remove = useDeleteSupplier();
  const rows = suppliers.data?.data ?? [];
  const total = suppliers.data?.total ?? 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function handleRemove(s: Supplier) {
    if (window.confirm(`Remover o fornecedor "${s.name}"?`)) {
      remove.mutate(s.id);
    }
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Fornecedor',
      isRowHeader: true,
      render: (s) => <span className="font-medium text-foreground">{s.name}</span>,
    },
    { key: 'email', header: 'E-mail', render: (s) => s.email ?? '—' },
    { key: 'phone', header: 'Celular', render: (s) => s.phone ?? '—' },
    { key: 'cnpj', header: 'CNPJ', render: (s) => s.cnpj ?? '—' },
    { key: 'active', header: 'Status', render: (s) => <ActiveChip active={s.active} /> },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => handleRemove(s)}
          >
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle={total ? `${total} fornecedor(es)` : 'Cadastro de fornecedores'}
        onRefresh={() => suppliers.refetch()}
        isRefreshing={suppliers.isFetching}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo fornecedor
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
              aria-label="Buscar fornecedor"
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

          {suppliers.isLoading ? (
            <LoadingState />
          ) : suppliers.isError ? (
            <ErrorState onRetry={() => suppliers.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconTruck size={32} />}
              title="Nenhum fornecedor encontrado"
              description={search ? 'Tente outro termo.' : 'Cadastre seu primeiro fornecedor.'}
            />
          ) : (
            <DataTable
              aria-label="Fornecedores"
              columns={columns}
              rows={rows}
              getKey={(s) => s.id}
            />
          )}
        </Card.Content>
      </Card>

      <SupplierModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <SupplierModal
        mode="edit"
        supplier={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

function SupplierModal({
  mode,
  supplier,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  supplier?: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const addr =
        supplier?.addressJson && typeof supplier.addressJson === 'object'
          ? (supplier.addressJson as { line?: string; phone2?: string })
          : null;
      setName(supplier?.name ?? '');
      setEmail(supplier?.email ?? '');
      setPhone(supplier?.phone ?? '');
      setCnpj(supplier?.cnpj ?? '');
      setStateRegistration(supplier?.stateRegistration ?? '');
      setPhone2(addr?.phone2 ?? '');
      setAddress(
        addr?.line ??
          (typeof supplier?.addressJson === 'string' ? supplier.addressJson : ''),
      );
      setActive(supplier?.active ?? true);
      setError(null);
    }
  }, [isOpen, supplier]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    const addressJson =
      address.trim() || phone2.trim()
        ? {
            ...(address.trim() ? { line: address.trim() } : {}),
            ...(phone2.trim() ? { phone2: phone2.trim() } : {}),
          }
        : undefined;
    const body = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      cnpj: cnpj.trim() || undefined,
      stateRegistration: stateRegistration.trim() || undefined,
      addressJson,
      active,
    };
    try {
      if (mode === 'edit' && supplier) {
        await update.mutateAsync({ id: supplier.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o fornecedor.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg">
            <Modal.Header>
              <Modal.Heading>
                {mode === 'edit' ? 'Editar fornecedor' : 'Novo fornecedor'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome do fornecedor" />
                </TextField>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail">
                  <TextField value={email} onChange={setEmail} aria-label="E-mail">
                    <Input type="email" placeholder="email@exemplo.com" />
                  </TextField>
                </Field>
                <Field label="Celular">
                  <TextField value={phone} onChange={setPhone} aria-label="Celular">
                    <Input placeholder="(00) 00000-0000" />
                  </TextField>
                </Field>
                <Field label="Telefone">
                  <TextField value={phone2} onChange={setPhone2} aria-label="Telefone">
                    <Input placeholder="(00) 0000-0000" />
                  </TextField>
                </Field>
                <Field label="CNPJ">
                  <TextField value={cnpj} onChange={setCnpj} aria-label="CNPJ">
                    <Input placeholder="00.000.000/0000-00" />
                  </TextField>
                </Field>
                <Field label="Inscrição estadual">
                  <TextField
                    value={stateRegistration}
                    onChange={setStateRegistration}
                    aria-label="Inscrição estadual"
                  >
                    <Input placeholder="000.000.000.000" />
                  </TextField>
                </Field>
              </div>
              <Field label="Endereço">
                <TextField value={address} onChange={setAddress} aria-label="Endereço">
                  <Input placeholder="Rua, número, bairro, cidade" />
                </TextField>
              </Field>
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
