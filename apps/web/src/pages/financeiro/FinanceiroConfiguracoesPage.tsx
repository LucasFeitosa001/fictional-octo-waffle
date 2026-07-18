import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import {
  IconCash,
  IconChevron,
  IconCreditCard,
  IconDollar,
  IconReceipt,
  IconSettings,
} from '../../components/icons';

interface SettingLink {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
}

const LINKS: SettingLink[] = [
  {
    to: '/financeiro/contas',
    title: 'Contas e métodos de pagamento',
    description: 'Contas bancárias, carteiras e formas de pagamento aceitas.',
    icon: <IconCreditCard size={20} />,
  },
  {
    to: '/financeiro/transacoes',
    title: 'Transações e categorias',
    description: 'Lançamentos de receitas e despesas e suas categorias.',
    icon: <IconDollar size={20} />,
  },
  {
    to: '/financeiro/caixas',
    title: 'Caixas',
    description: 'Caixas abertos e histórico de aberturas e fechamentos.',
    icon: <IconCash size={20} />,
  },
  {
    to: '/financeiro/notas-fiscais',
    title: 'Notas fiscais',
    description: 'Integração fiscal e emissão de NFS-e / NFC-e.',
    icon: <IconReceipt size={20} />,
    badge: 'Em configuração',
  },
];

export function FinanceiroConfiguracoesPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Ajustes do módulo financeiro"
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
              <IconSettings size={16} />
            </span>
            Áreas de configuração
          </div>
          <ul className="flex flex-col gap-2">
            {LINKS.map((link) => (
              <li key={link.to}>
                <button
                  type="button"
                  onClick={() => navigate(link.to)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white p-3 text-left transition-colors hover:border-[#f2b33d]/50 hover:bg-[#f2b33d]/[0.06]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                    {link.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{link.title}</span>
                      {link.badge && (
                        <span className="rounded-full border border-[#f2b33d]/40 bg-[#f2b33d]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a67c1e]">
                          {link.badge}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{link.description}</span>
                  </span>
                  <span className="shrink-0 text-muted">
                    <IconChevron size={18} className="-rotate-90" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
