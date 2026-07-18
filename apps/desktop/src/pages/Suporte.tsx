import { useState } from 'react';
import { BookOpen, LifeBuoy, Mail, MessageCircle, Phone } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ModuleCard } from '../components/ModuleCard';
import { StatusBadge } from '../components/StatusBadge';
import { Modal, ModalButton } from '../components/Modal';

/** Abre link externo pelo opener do Tauri; no navegador (vite dev) cai no window.open. */
async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    window.open(url, '_blank');
  }
}

const GUIDES: { title: string; steps: string[] }[] = [
  {
    title: 'Agenda',
    steps: [
      'Use “Novo agendamento” para marcar cliente, serviço, profissional, data e horário.',
      'Avance o status pelo próprio card: Confirmar → Iniciar → Finalizar (ou Cancelar).',
      'Filtre por dia/semana e por profissional no topo da página.',
    ],
  },
  {
    title: 'Caixa / Comandas',
    steps: [
      'Abra uma comanda escolhendo a cliente; adicione serviços e produtos pelo painel “Adicionar item”.',
      'Informe desconto e forma de pagamento e clique em “Receber” para fechar a conta.',
      'Produtos vendidos baixam o estoque automaticamente; o fechamento do dia soma as comandas pagas de hoje.',
    ],
  },
  {
    title: 'Estoque',
    steps: [
      'Registre entradas (com fornecedor, nota e valores) e saídas (com motivo).',
      'O saldo do produto é atualizado a cada movimentação; saída maior que o saldo é bloqueada.',
      'Acompanhe os produtos no nível crítico no quadro “Estoque crítico”.',
    ],
  },
  {
    title: 'Financeiro',
    steps: [
      'Lance contas a pagar e a receber com vencimento e categoria.',
      'Use o ícone de check para marcar uma conta como paga/recebida.',
      'O fluxo de caixa e o saldo projetado são calculados a partir dos lançamentos em aberto.',
    ],
  },
];

export function SuportePage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Suporte" description="Canais de atendimento e ajuda do Silvia Hair ERP." />

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModuleCard
          icon={MessageCircle}
          title="WhatsApp"
          description="(11) 94000-0000 — atendimento comercial e suporte técnico em horário comercial."
          badge={<StatusBadge tone="success">Recomendado</StatusBadge>}
          onClick={() => void openExternal('https://wa.me/5511940000000')}
        />
        <ModuleCard
          icon={Mail}
          title="E-mail"
          description="suporte@silviahair.com.br — retorno em até 1 dia útil."
          onClick={() => void openExternal('mailto:suporte@silviahair.com.br')}
        />
        <ModuleCard
          icon={Phone}
          title="Telefone"
          description="(11) 4000-0000 — segunda a sexta, das 9h às 18h."
          onClick={() => void openExternal('tel:+551140000000')}
        />
        <ModuleCard
          icon={BookOpen}
          title="Central de ajuda"
          description="Guias de uso dos módulos: agenda, caixa, estoque e financeiro."
          onClick={() => setHelpOpen(true)}
        />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:p-6">
        <p className="mb-2 flex items-center gap-2 font-semibold text-ink-900">
          <LifeBuoy className="size-4 text-brand-500" />
          Sobre esta versão
        </p>
        <ul className="space-y-1.5 text-sm text-ink-500">
          <li>• Silvia Hair ERP v1.0 — desktop (Tauri) + mobile para a equipe (Expo).</li>
          <li>• Dados desta versão são locais (demonstração); sincronização com servidor na próxima fase.</li>
          <li>• Integração com WhatsApp para confirmação de agenda: planejada.</li>
        </ul>
      </div>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Central de ajuda"
        subtitle="Guia rápido dos módulos principais"
        size="lg"
        footer={<ModalButton onClick={() => setHelpOpen(false)}>Fechar</ModalButton>}
      >
        <div className="space-y-5">
          {GUIDES.map((g) => (
            <section key={g.title}>
              <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-500">{g.title}</h4>
              <ul className="space-y-1.5 text-sm text-ink-700">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold text-brand-600">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </div>
  );
}
