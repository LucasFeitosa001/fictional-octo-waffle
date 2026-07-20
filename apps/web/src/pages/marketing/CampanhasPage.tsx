import { useMemo, useState, type ComponentType } from 'react';
import { Button, Switch } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { Drawer } from '../../components/Drawer';
import {
  IconBox,
  IconCalendar,
  IconDollar,
  IconGift,
  IconInfo,
  IconMessage,
  IconPhone,
  IconRefresh,
  IconSparkles,
  IconUser,
  IconUsers,
  IconWhatsApp,
} from '../../components/icons';

// ---------------------------------------------------------------------------
// Catálogo de campanhas automáticas do Belasis (rota /campaigns → aba Campanhas).
// Textos capturados de belasis-reference/campaigns-marketing/mobile.html.
// Sem data-wiring no componente anterior (era placeholder); os toggles usam
// estado local e o botão "Personalizar" abre um drawer lateral.
// TODO: ligar a hooks reais de campanhas quando a API estiver disponível.
// ---------------------------------------------------------------------------

type IconType = ComponentType<{ size?: number; className?: string }>;

interface Campaign {
  id: string;
  icon: IconType;
  title: string;
  description: string;
  /** Mostra a linha "Envio automático" + switch. */
  hasAutoSwitch: boolean;
  /** Tooltip de ajuda ao lado do switch (ex.: "Clientes bem informados"). */
  autoHint?: string;
  /** Mostra o botão/linha "Personalizar". */
  hasPersonalizar: boolean;
  /** "Personalizar" aparece desabilitado (não clicável). */
  personalizarDisabled?: boolean;
}

const CAMPAIGNS: Campaign[] = [
  {
    id: 'aniversario',
    icon: IconGift,
    title: 'Parabenize seus clientes',
    description:
      'Reforce os laços com seus clientes e mostre o quanto eles são especiais! Envie uma mensagem automática parabenizando os aniversariantes do dia. Isso fará com que esse dia se torne ainda mais especial e fortalecerá a relação entre vocês!',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'reconquista',
    icon: IconUsers,
    title: 'Reconquiste clientes',
    description:
      'Já faz um tempo que o seu cliente não vem no seu estabelecimento? Recupere ele criando uma oferta super especial! Essa campanha enviará uma mensagem aos clientes que não retornaram após um período.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'lembretes',
    icon: IconInfo,
    title: 'Evite esquecimentos',
    description:
      'Na correria do dia a dia o seu cliente pode esquecer do seu agendamento! Evite que isso aconteça e envie quantos lembretes forem necessários com tempos personalizados para que ele não esqueça do seu horário.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cuidados',
    icon: IconSparkles,
    title: 'Cuidados',
    description:
      'Fortaleça o relacionamento com seus clientes enviando mensagens automáticas de pré e pós-atendimento, personalizadas por serviço. Essas mensagens são enviadas apenas para agendamentos confirmados.',
    hasAutoSwitch: true,
    hasPersonalizar: false,
  },
  {
    id: 'retornos',
    icon: IconRefresh,
    title: 'Garanta retornos',
    description:
      'Já passou um tempo e está na hora do seu cliente retornar para fazer novamente o serviço ou o produto dele está acabando? Lembre-o que está na hora dele retornar ao estabelecimento!',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'informados',
    icon: IconCalendar,
    title: 'Clientes bem informados',
    description:
      'Atualize o seu cliente sobre o andamento do seu agendamento! Envie mensagens avisando que o agendamento dele foi criado ou o seu status foi atualizado.',
    hasAutoSwitch: true,
    autoHint:
      'Envie mensagens automáticas quando o agendamento for criado ou tiver o status atualizado.',
    hasPersonalizar: true,
    personalizarDisabled: true,
  },
  {
    id: 'boas-vindas',
    icon: IconUser,
    title: 'Boas-vindas a novos clientes',
    description:
      'Que tal dar boas-vindas a um cliente e lhe ofertar um desconto? Esta campanha é enviada automaticamente aos clientes 1 dia após a sua primeira compra.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'convite-online',
    icon: IconPhone,
    title: 'Convide os clientes para agendar online',
    description:
      'Incentive os seus clientes a agendar online o seu próximo atendimento com uma oferta especial. Esta campanha é enviada aos clientes que nunca agendaram online.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cashback',
    icon: IconRefresh,
    title: 'Cashback',
    description: 'Envie ao seu cliente uma mensagem avisando sobre o seu saldo atual de cashback.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'pacote-expirando',
    icon: IconBox,
    title: 'Pacote expirando',
    description: 'Envie ao seu cliente uma mensagem avisando sobre o vencimento do pacote.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cobrancas',
    icon: IconDollar,
    title: 'Realize cobranças',
    description:
      'Seu cliente deixou uma fatura em aberto e esqueceu de quitar no tempo combinado?! Lembre-o que há uma fatura em aberto no seu estabelecimento.',
    hasAutoSwitch: false,
    hasPersonalizar: true,
  },
  {
    id: 'pin-whatsapp',
    icon: IconWhatsApp,
    title: 'Enviar código PIN',
    description:
      'Envie o código PIN através do whatsapp, facilitando o acesso ao agendamento online',
    hasAutoSwitch: true,
    hasPersonalizar: false,
  },
];

// ------------------------------------------------------------------ card tile

function CampaignCard({
  campaign,
  active,
  onToggle,
  onPersonalizar,
}: {
  campaign: Campaign;
  active: boolean;
  onToggle: (v: boolean) => void;
  onPersonalizar: () => void;
}) {
  const Icon = campaign.icon;
  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[0_0_10px_5px_color-mix(in_oklab,var(--sp-ink)_5%,transparent)]">
      {/* Conteúdo (wb__sc-u3tb4c-1) */}
      <div className="flex flex-1 flex-col items-center gap-3 p-4 text-center">
        <span className="mt-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={34} />
        </span>
        <span className="text-base font-semibold text-ink">{campaign.title}</span>
        <span className="text-sm leading-relaxed text-muted-ink">{campaign.description}</span>
      </div>

      {/* Envio automático (wb__sc-u3tb4c-3) */}
      {campaign.hasAutoSwitch && (
        <div className="mt-auto flex items-center justify-center gap-2 border-t border-line px-4 py-3.5">
          <span className="text-sm text-muted-ink">Envio automático</span>
          <Switch isSelected={active} onChange={onToggle} aria-label={`Envio automático — ${campaign.title}`}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
          {campaign.autoHint && (
            <span title={campaign.autoHint} className="inline-flex text-muted-ink">
              <IconInfo size={15} />
            </span>
          )}
        </div>
      )}

      {/* Personalizar (wb__sc-u3tb4c-2) */}
      {campaign.hasPersonalizar && (
        <div
          className={[
            'flex items-center justify-center border-t border-line px-4 py-3',
            campaign.hasAutoSwitch ? '' : 'mt-auto',
          ].join(' ')}
        >
          {campaign.personalizarDisabled ? (
            <span className="cursor-not-allowed text-sm font-medium text-muted-ink/60">
              Personalizar
            </span>
          ) : (
            <button
              type="button"
              onClick={onPersonalizar}
              className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Personalizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- créditos view

function CreditosView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* TODO: saldos reais de créditos de mensagens quando a API existir. */}
      {[
        { label: 'WhatsApp', value: '—', icon: IconWhatsApp, tint: 'text-primary' },
        { label: 'SMS', value: '—', icon: IconMessage, tint: 'text-pink' },
        { label: 'E-mail', value: '—', icon: IconInfo, tint: 'text-ink' },
      ].map((c) => (
        <div
          key={c.label}
          className="relative flex h-[140px] flex-col justify-center rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)]"
        >
          <span className="absolute right-3 top-3">
            <c.icon size={24} className={c.tint} />
          </span>
          <span className="text-[26px] font-bold leading-none text-ink">{c.value}</span>
          <span className="mt-1.5 text-sm text-muted-ink">Créditos de {c.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------- page

type View = 'campanhas' | 'creditos';

export function CampanhasPage() {
  const [view, setView] = useState<View>('campanhas');
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [message, setMessage] = useState('');

  const editingActive = editing ? (activeMap[editing.id] ?? false) : false;

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant={view === 'campanhas' ? 'primary' : 'outline'}
          onClick={() => setView('campanhas')}
        >
          <IconMessage size={16} /> Campanhas
        </Button>
        <Button
          variant={view === 'creditos' ? 'primary' : 'outline'}
          onClick={() => setView('creditos')}
        >
          <IconDollar size={16} /> Créditos
        </Button>
      </>
    ),
    [view],
  );

  function openPersonalizar(campaign: Campaign) {
    setEditing(campaign);
    setMessage('');
  }

  return (
    <div>
      <PageHeader
        title="Campanhas"
        subtitle="Automações de relacionamento com seus clientes"
        actions={headerActions}
      />

      {view === 'campanhas' ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {CAMPAIGNS.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              active={activeMap[campaign.id] ?? false}
              onToggle={(v) => setActiveMap((prev) => ({ ...prev, [campaign.id]: v }))}
              onPersonalizar={() => openPersonalizar(campaign)}
            />
          ))}
        </div>
      ) : (
        <CreditosView />
      )}

      {/* Drawer lateral de personalização (desliza da direita) */}
      <Drawer
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.title : 'Personalizar campanha'}
        widthClass="sm:w-[520px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setEditing(null)}>
              Salvar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-ink">{editing.description}</p>

            {editing.hasAutoSwitch && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-3">
                <span className="text-sm text-ink">Envio automático</span>
                <Switch
                  isSelected={editingActive}
                  onChange={(v: boolean) =>
                    setActiveMap((prev) => ({ ...prev, [editing.id]: v }))
                  }
                  aria-label="Envio automático"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Mensagem</span>
              <span className="text-xs text-muted-ink">
                Use %NOME% para o nome do cliente e %ESTABELECIMENTO% para o nome do seu negócio.
              </span>
              <textarea
                value={message}
                rows={6}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada ao cliente…"
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        )}
      </Drawer>
    </div>
  );
}
