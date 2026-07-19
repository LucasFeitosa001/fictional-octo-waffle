import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ActiveChip } from '../components/StatusChip';
import { SegBtn } from '../components/SegBtn';
import {
  IconDownload,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
} from '../components/icons';
import { downloadCsv } from '../lib/csv';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
  type Supplier,
} from '../lib/queries/catalogo';

type StatusFilter = 'all' | 'active' | 'inactive';

export function FornecedoresPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const suppliers = useSuppliers(search || undefined);
  const remove = useDeleteSupplier();
  const serverRows = suppliers.data?.data ?? [];
  const total = suppliers.data?.total ?? 0;

  // Server handles the text search; status is filtered client-side over the
  // already-loaded rows (no backend param exists for it).
  const rows = useMemo(
    () =>
      serverRows.filter((s) => {
        if (status === 'active' && !s.active) return false;
        if (status === 'inactive' && s.active) return false;
        return true;
      }),
    [serverRows, status],
  );

  const hasFilters = Boolean(search) || status !== 'all';

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function exportCsv() {
    downloadCsv<Supplier>(
      'fornecedores',
      [
        { header: 'Fornecedor', value: (s) => s.name },
        { header: 'E-mail', value: (s) => s.email },
        { header: 'Celular', value: (s) => s.phone },
        { header: 'CNPJ', value: (s) => s.cnpj },
        { header: 'Status', value: (s) => (s.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
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
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${s.name}`}
            onClick={() => setEditing(s)}
          >
            <IconPencil size={16} /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            aria-label={`Remover ${s.name}`}
            onClick={() => handleRemove(s)}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const subtitle = suppliers.isLoading
    ? 'Cadastro de fornecedores'
    : hasFilters
      ? `${rows.length} de ${total} fornecedor(es)`
      : `${total} fornecedor(es)`;

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle={subtitle}
        actions={
          <>
            <Button
              variant="outline"
              isDisabled={rows.length === 0}
              onClick={exportCsv}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Novo fornecedor
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex max-w-md items-center gap-2">
              <TextField
                value={searchInput}
                onChange={setSearchInput}
                className="min-w-0 flex-1"
                aria-label="Buscar fornecedor"
              >
                <Input
                  placeholder="Buscar por nome, CNPJ, telefone…"
                  onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                />
              </TextField>
              <Button variant="primary" aria-label="Buscar" onClick={applySearch}>
                <IconSearch size={16} /> Buscar
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegBtn active={status === 'all'} onClick={() => setStatus('all')}>
                Todos
              </SegBtn>
              <SegBtn active={status === 'active'} onClick={() => setStatus('active')}>
                Ativos
              </SegBtn>
              <SegBtn
                active={status === 'inactive'}
                onClick={() => setStatus('inactive')}
              >
                Inativos
              </SegBtn>
            </div>
          </div>

          {suppliers.isLoading ? (
            <LoadingState />
          ) : suppliers.isError ? (
            <ErrorState onRetry={() => suppliers.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconTruck size={32} />}
              title="Nenhum fornecedor encontrado"
              description={
                hasFilters
                  ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                  : 'Cadastre seu primeiro fornecedor.'
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                      setStatus('all');
                    }}
                  >
                    Limpar filtros
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <IconPlus size={16} /> Novo fornecedor
                  </Button>
                )
              }
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
