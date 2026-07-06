import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Modal, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconPencil,
  IconPercent,
  IconPlus,
  IconSettings,
  IconTrash,
} from '../../components/icons';
import {
  useCommissionRules,
  useCreateCommissionRule,
  useDeleteCommissionRule,
  useUpdateCommissionRule,
  type AmountType,
  type CommissionRule,
  type CommissionRuleSettings,
  type CommissionScopeType,
} from '../../lib/queries/comissoes';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const SCOPE_LABELS: Record<CommissionScopeType, string> = {
  service: 'Serviços',
  product: 'Produtos',
  category: 'Categoria',
  all: 'Tudo',
};

const SCOPE_FILTERS: { id: 'all' | CommissionScopeType; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'service', label: 'Serviços' },
  { id: 'product', label: 'Produtos' },
  { id: 'category', label: 'Categoria' },
];

const PAYER_OPTIONS = [
  { id: 'company', name: 'Empresa' },
  { id: 'professional', name: 'Profissional' },
];

export function ComissoesConfigPage() {
  const rules = useCommissionRules();
  const del = useDeleteCommissionRule();
  const [editing, setEditing] = useState<CommissionRule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | CommissionScopeType>('all');

  const allRules = rules.data ?? [];
  const data = useMemo(
    () =>
      scopeFilter === 'all'
        ? allRules
        : allRules.filter((r) => r.scopeType === scopeFilter),
    [allRules, scopeFilter],
  );

  async function handleRemove(rule: CommissionRule) {
    if (!window.confirm('Remover esta regra de comissão?')) return;
    try {
      await del.mutateAsync(rule.id);
    } catch {
      window.alert('Não foi possível remover a regra.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Configuração de comissões"
        subtitle="Regras de cálculo, taxas e descontos"
        onRefresh={() => rules.refetch()}
        isRefreshing={rules.isFetching}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Nova regra
          </Button>
        }
      />

      {/* Scope filter — shown once there are enough rules to warrant it */}
      {allRules.length > 3 && (
        <Card className={`mb-4 ${CARD_CLASS}`}>
          <Card.Content className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-medium text-muted">Aplica-se a</span>
            <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-soft-border)] bg-white p-1">
              {SCOPE_FILTERS.map((s) => {
                const active = scopeFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScopeFilter(s.id)}
                    className={
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                      (active
                        ? 'bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]'
                        : 'text-muted hover:text-foreground')
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-muted">{data.length} regra(s)</span>
          </Card.Content>
        </Card>
      )}

      {rules.isLoading ? (
        <LoadingState />
      ) : rules.isError ? (
        <ErrorState onRetry={() => rules.refetch()} />
      ) : data.length === 0 ? (
        <Card className={CARD_CLASS}>
          <Card.Content className="p-4">
            <EmptyState
              icon={<IconSettings size={32} />}
              title={
                allRules.length === 0
                  ? 'Nenhuma regra de comissão'
                  : 'Nenhuma regra para este escopo'
              }
              description="Crie regras para definir percentuais e quem paga taxas e descontos."
            />
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((rule) => (
            <Card key={rule.id} className={CARD_CLASS}>
              <Card.Content className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                        <IconPercent size={16} />
                      </span>
                      <span className="text-base font-semibold text-foreground">
                        {SCOPE_LABELS[rule.scopeType]}
                      </span>
                      <Chip variant="soft" color="accent" size="sm">
                        {rule.type === 'percent'
                          ? `${rule.value}%`
                          : `R$ ${rule.value}`}
                      </Chip>
                    </div>
                    <dl className="mt-3 space-y-1 text-sm text-muted">
                      <InfoRow label="Taxa de cartão paga por" value={rule.settingsJson?.cardFeePaidBy} />
                      <InfoRow label="Desconto pago por" value={rule.settingsJson?.discountPaidBy} />
                      <InfoRow
                        label="Custo adicional pago por"
                        value={rule.settingsJson?.additionalCostPaidBy}
                      />
                    </dl>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(rule)}>
                      <IconPencil size={15} /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={del.isPending}
                      onClick={() => handleRemove(rule)}
                    >
                      <IconTrash size={15} /> Remover
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      <RuleModal
        mode="create"
        isOpen={createOpen}
        rule={null}
        onClose={() => setCreateOpen(false)}
      />
      <RuleModal
        mode="edit"
        isOpen={editing != null}
        rule={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const text =
    value === 'company' ? 'Empresa' : value === 'professional' ? 'Profissional' : '—';
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{text}</dd>
    </div>
  );
}

function RuleModal({
  mode,
  isOpen,
  rule,
  onClose,
}: {
  mode: 'create' | 'edit';
  isOpen: boolean;
  rule: CommissionRule | null;
  onClose: () => void;
}) {
  const create = useCreateCommissionRule();
  const update = useUpdateCommissionRule();
  const [scopeType, setScopeType] = useState<CommissionScopeType>('service');
  const [type, setType] = useState<AmountType>('percent');
  const [value, setValue] = useState('');
  const [cardFeePaidBy, setCardFeePaidBy] = useState('company');
  const [discountPaidBy, setDiscountPaidBy] = useState('company');
  const [additionalCostPaidBy, setAdditionalCostPaidBy] = useState('company');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (rule) {
      setScopeType(rule.scopeType);
      setType(rule.type);
      setValue(rule.value);
      setCardFeePaidBy(rule.settingsJson?.cardFeePaidBy ?? 'company');
      setDiscountPaidBy(rule.settingsJson?.discountPaidBy ?? 'company');
      setAdditionalCostPaidBy(rule.settingsJson?.additionalCostPaidBy ?? 'company');
    } else {
      setScopeType('service');
      setType('percent');
      setValue('');
      setCardFeePaidBy('company');
      setDiscountPaidBy('company');
      setAdditionalCostPaidBy('company');
    }
  }, [isOpen, rule]);

  const pending = create.isPending || update.isPending;
  const canSave = value !== '' && Number(value) >= 0;

  async function handleSave() {
    setError(null);
    const settingsJson: CommissionRuleSettings = {
      cardFeePaidBy: cardFeePaidBy as 'company' | 'professional',
      discountPaidBy: discountPaidBy as 'company' | 'professional',
      additionalCostPaidBy: additionalCostPaidBy as 'company' | 'professional',
    };
    try {
      if (mode === 'edit' && rule) {
        await update.mutateAsync({
          id: rule.id,
          body: { scopeType, type, value: Number(value), settingsJson },
        });
      } else {
        await create.mutateAsync({ scopeType, type, value: Number(value), settingsJson });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a regra.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{mode === 'edit' ? 'Editar regra' : 'Nova regra'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Aplica-se a">
                <Select
                  aria-label="Escopo"
                  selectedKey={scopeType}
                  onSelectionChange={(k) => setScopeType((k ? String(k) : 'service') as CommissionScopeType)}
                >
                  <Select.Trigger>
                    <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="service" textValue="Serviços">Serviços</ListBox.Item>
                      <ListBox.Item id="product" textValue="Produtos">Produtos</ListBox.Item>
                      <ListBox.Item id="category" textValue="Categoria">Categoria</ListBox.Item>
                      <ListBox.Item id="all" textValue="Tudo">Tudo</ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>
              <Field label="Tipo">
                <Select
                  aria-label="Tipo"
                  selectedKey={type}
                  onSelectionChange={(k) => setType((k ? String(k) : 'percent') as AmountType)}
                >
                  <Select.Trigger>
                    <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="percent" textValue="Percentual">Percentual (%)</ListBox.Item>
                      <ListBox.Item id="fixed" textValue="Valor fixo">Valor fixo (R$)</ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>
            </div>

            <Field label={type === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}>
              <TextField value={value} onChange={setValue} aria-label="Valor">
                <Input type="number" placeholder="0" />
              </TextField>
            </Field>

            <PayerField label="Taxa de cartão paga por" value={cardFeePaidBy} onChange={setCardFeePaidBy} />
            <PayerField label="Desconto pago por" value={discountPaidBy} onChange={setDiscountPaidBy} />
            <PayerField
              label="Custo adicional pago por"
              value={additionalCostPaidBy}
              onChange={setAdditionalCostPaidBy}
            />

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
              isDisabled={!canSave || pending}
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

function PayerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select
        aria-label={label}
        selectedKey={value}
        onSelectionChange={(k) => onChange(k ? String(k) : 'company')}
      >
        <Select.Trigger>
          <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {PAYER_OPTIONS.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                {o.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </Field>
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
