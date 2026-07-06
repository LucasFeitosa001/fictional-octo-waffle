import { BookOpen, LifeBuoy, Mail, MessageCircle, Phone } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ModuleCard } from '../components/ModuleCard';
import { StatusBadge } from '../components/StatusBadge';

export function SuportePage() {
  return (
    <div>
      <PageHeader title="Suporte" description="Canais de atendimento e ajuda do Silvia Hair ERP." />

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModuleCard
          icon={MessageCircle}
          title="WhatsApp"
          description="Atendimento comercial e suporte técnico em horário comercial."
          badge={<StatusBadge tone="success">Recomendado</StatusBadge>}
        />
        <ModuleCard icon={Mail} title="E-mail" description="suporte@silviahair.com.br — retorno em até 1 dia útil." />
        <ModuleCard icon={Phone} title="Telefone" description="(11) 4000-0000 — segunda a sexta, das 9h às 18h." />
        <ModuleCard icon={BookOpen} title="Central de ajuda" description="Guias de uso dos módulos: agenda, caixa, estoque e financeiro." />
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
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
    </div>
  );
}
