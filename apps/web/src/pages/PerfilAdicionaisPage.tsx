import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import {
  IconChevron,
  IconMail,
  IconMegaphone,
  IconMessage,
  IconSparkles,
} from '../components/icons';
import { SegBtn } from '../components/SegBtn';

// TODO(backend): billing_addons — persistir seleção do tenant, integrar com
// cobrança do plano (bump no MRR + provisionar feature-flag), e listar
// dinamicamente os add-ons disponíveis (categoria, preço, dependências).

type AddonCategory = 'comunicacao' | 'marketing' | 'ia';

interface Addon {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  category: AddonCategory;
  icon: (p: { size?: number; className?: string }) => ReactNode;
}

const ADDONS: Addon[] = [
  {
    id: 'assinatura-digital',
    name: 'Assinatura Digital',
    description:
      'Colete assinaturas de termos, contratos e autorizações direto pelo celular do cliente, com validade jurídica.',
    priceMonthly: 16.9,
    category: 'comunicacao',
    icon: IconMail,
  },
  {
    id: 'automacao-marketing',
    name: 'Automação para Marketing',
    description:
      'Fluxos automáticos de aniversário, retorno e recuperação de clientes inativos disparados por gatilhos.',
    priceMonthly: 99,
    category: 'marketing',
    icon: IconMegaphone,
  },
  {
    id: 'sms-marketing',
    name: 'SMS Marketing',
    description:
      'Envie campanhas por SMS para clientes sem WhatsApp — ideal para lembretes e ofertas relâmpago.',
    priceMonthly: 29.9,
    category: 'comunicacao',
    icon: IconMessage,
  },
  {
    id: 'ia-atendimento-plus',
    name: 'IA Atendimento Plus',
    description:
      'Aumenta o volume de mensagens da IA de atendimento e libera modelos avançados para respostas mais naturais.',
    priceMonthly: 49.9,
    category: 'ia',
    icon: IconSparkles,
  },
];

const CATEGORIES: { id: AddonCategory | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'comunicacao', label: 'Comunicação' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'ia', label: 'IA' },
];

function formatMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PerfilAdicionaisPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<AddonCategory | 'todos'>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const visible = useMemo(
    () => (category === 'todos' ? ADDONS : ADDONS.filter((a) => a.category === category)),
    [category],
  );

  const selectedList = ADDONS.filter((a) => selected.has(a.id));
  const totalMonthly = selectedList.reduce((sum, a) => sum + a.priceMonthly, 0);

  function handleContinue() {
    // TODO(backend): POST /billing/addons { ids: selectedList.map(...) }
    // eslint-disable-next-line no-console
    console.log('[adicionais] continuar', {
      ids: selectedList.map((a) => a.id),
      totalMonthly,
    });
    showToast('Adicionais registrados (placeholder). Integração de cobrança em breve.');
  }

  return (
    <div className="pb-24">
      {/* Header com back + título */}
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-gold-strong hover:bg-cream"
        >
          <IconChevron size={22} className="rotate-90" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            Adicionais
          </h1>
          <p className="mt-1 text-sm leading-snug text-muted">
            Amplie seu plano com recursos extras cobrados por mês.
          </p>
        </div>
      </div>

      {/* Segmented por categoria */}
      <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map((c) => (
          <SegBtn key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </SegBtn>
        ))}
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((addon) => {
          const isSelected = selected.has(addon.id);
          const Icon = addon.icon;
          return (
            <div
              key={addon.id}
              className={
                'flex flex-col gap-3 rounded-2xl border bg-warm-white p-4 shadow-[var(--shadow-card)] transition-colors ' +
                (isSelected
                  ? 'border-gold-strong/60'
                  : 'border-[var(--color-soft-border)]')
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={
                    'grid h-11 w-11 shrink-0 place-items-center rounded-xl ' +
                    (isSelected ? 'bg-gold/20 text-gold-strong' : 'bg-cream text-muted-ink')
                  }
                >
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{addon.name}</div>
                  <div className="mt-0.5 text-sm font-bold text-ink">
                    {formatMoney(addon.priceMonthly)}
                    <span className="text-xs font-normal text-muted-ink">/mês</span>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-snug text-muted-ink">{addon.description}</p>
              <div className="mt-auto">
                {isSelected ? (
                  <Button
                    variant="outline"
                    className="w-full !border-rose-300 !text-rose-600 hover:!bg-rose-50"
                    onClick={() => toggle(addon.id)}
                  >
                    Remover
                  </Button>
                ) : (
                  <Button variant="primary" className="w-full" onClick={() => toggle(addon.id)}>
                    Selecionar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--color-soft-border)] bg-warm-white/60 p-8 text-center text-sm text-muted-ink">
          Nenhum adicional nesta categoria.
        </div>
      )}

      {/* Barra inferior fixa */}
      {selectedList.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-soft-border)] bg-warm-white/95 px-3 py-3 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.15)] backdrop-blur"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                {selectedList.length}{' '}
                {selectedList.length === 1 ? 'adicional selecionado' : 'adicionais selecionados'}
              </div>
              <div className="text-xs text-muted-ink">
                Total: <span className="font-medium text-ink">{formatMoney(totalMonthly)}</span>
                <span className="text-muted-ink">/mês</span>
              </div>
            </div>
            <Button variant="primary" onClick={handleContinue}>
              Continuar <IconChevron size={16} className="-rotate-90" />
            </Button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
