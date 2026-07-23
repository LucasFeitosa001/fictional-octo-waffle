import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Button } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { Drawer } from '../../components/Drawer';
import { HelpTooltip } from '../../components/HelpTooltip';
import { AppSwitch } from '../../components/SwitchRow';
import { LoadingState, ErrorState, EmptyState } from '../../components/States';
import { useConfirm } from '../../components/ConfirmDialog';
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useDispatchCampaign,
  usePreviewSegment,
  type Campaign,
  type CampaignChannel,
  type SegmentKind,
} from '../../lib/queries/campanhas';

// ---------------------------------------------------------------------------
// Página de Campanhas — ESTADO REAL vindo do backend (BullMQ → WhatsApp).
//
// O backend suporta campanhas de SEGMENTO com mensagem + disparo:
//   segmentos: birthday_today (aniversariantes), inactive (reconquista, N dias),
//   all (todos os clientes ativos). Variáveis da mensagem: %NOME% e
//   %ESTABELECIMENTO%. Não há tabela de créditos/saldo — a métrica real é o
//   total de mensagens já enfileiradas por campanha (_count.messages).
//
// Os "cards de automação" do Belasis viraram MODELOS (templates) que
// pré-preenchem o drawer de criação com nome + mensagem + segmento reais.
// Só mantivemos modelos que o backend REALMENTE resolve.
// ---------------------------------------------------------------------------

type IconType = ComponentType<{ size?: number; className?: string }>;
type IconProps = { size?: number; className?: string };

function AntIcon({
  size = 24,
  className,
  children,
  viewBox = '64 64 896 896',
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const AntGift: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M880 310H732.4c13.6-21.4 21.6-46.8 21.6-74 0-76.1-61.9-138-138-138-41.4 0-78.7 18.4-104 47.4-25.3-29-62.6-47.4-104-47.4-76.1 0-138 61.9-138 138 0 27.2 7.9 52.6 21.6 74H144c-17.7 0-32 14.3-32 32v200c0 4.4 3.6 8 8 8h40v344c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V550h40c4.4 0 8-3.6 8-8V342c0-17.7-14.3-32-32-32zm-334-74c0-38.6 31.4-70 70-70s70 31.4 70 70-31.4 70-70 70h-70v-70zm-138-70c38.6 0 70 31.4 70 70v70h-70c-38.6 0-70-31.4-70-70s31.4-70 70-70zM180 482V378h298v104H180zm48 68h250v308H228V550zm568 308H546V550h250v308zm48-376H546V378h298v104z" />
  </AntIcon>
);
const AntUsergroupAdd: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M892 772h-80v-80c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v80h-80c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h80v80c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-80h80c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM373.5 498.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 01-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.8-1.7-203.2 89.2-203.2 200 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 008 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.8-1.1 6.4-4.8 5.9-8.8zM824 472c0-109.4-87.9-198.3-196.9-200C516.3 270.3 424 361.2 424 472c0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 00-86.4 60.4C357 742.6 326 814.8 324 891.8a8 8 0 008 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5C505.8 695.7 563 672 624 672c110.4 0 200-89.5 200-200zm-109.5 90.5C690.3 586.7 658.2 600 624 600s-66.3-13.3-90.5-37.5a127.26 127.26 0 01-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4-.1 34.2-13.4 66.3-37.6 90.5z" />
  </AntIcon>
);
const AntNotification: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M880 112c-3.8 0-7.7.7-11.6 2.3L292 345.9H128c-8.8 0-16 7.4-16 16.6v299c0 9.2 7.2 16.6 16 16.6h56.4l60.5 216.2a16.07 16.07 0 0015.4 11.7h35.6c10.9 0 18.8-10.7 15.5-21.1L271.8 678H292l576 231.7c3.9 1.5 7.8 2.3 11.6 2.3 16.9 0 32.4-14.4 32.4-33.7V145.7C912 126.4 896.5 112 880 112zM256 621.4V400.6h27.6l6.3 2.5V619l-6.3 2.5H256zm34.8-1.4z" />
  </AntIcon>
);
const AntMessage: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M464 512a48 48 0 1096 0 48 48 0 10-96 0zm200 0a48 48 0 1096 0 48 48 0 10-96 0zm-400 0a48 48 0 1096 0 48 48 0 10-96 0zm661.2-173.6c-22.6-53.7-55-101.9-96.3-143.3a444.35 444.35 0 00-143.3-96.3C630.6 75.7 572.2 64 512 64h-2c-60.6.3-119.3 12.3-174.5 35.9a445.35 445.35 0 00-142 96.5c-40.9 41.3-73 89.3-95.2 142.8-23 55.4-34.6 114.3-34.3 174.9A449.4 449.4 0 00112 714v152a46 46 0 0046 46h152.1A449.4 449.4 0 00510 960h2.1c59.9 0 118-11.6 172.7-34.3a444.48 444.48 0 00142.8-95.2c41.3-40.9 73.8-88.7 96.5-142 23.6-55.2 35.6-113.9 35.9-174.5.3-60.9-11.5-120-34.8-175.6zM512 856h-1.8c-51.5-.3-102-12.2-149.9-35.5l-25.4-12.4-27.9 4.8c-25.8 4.4-52.3 6.7-79 6.8 6.1-11.6 9.4-24.4 9.4-38 0-13.7-3.4-26.5-9.4-38.1-31.1-42.7-49.6-92.9-53.4-146.5-.4-5.4-.6-10.9-.6-16.4 0-.5 0-1 .1-1.6 3.6-51.1 21.9-99.9 53.2-141.5.4-.5.8-1.1 1.1-1.7 6.1-11.6 9.4-24.4 9.4-38.1s-3.4-26.5-9.4-38.1c26.7.1 53.2 2.4 79 6.8l27.9 4.8 25.4-12.4C401 199.7 451.5 187.8 503 187.5h1.8c39.2 0 77 6 112.6 17.9 34.1 11.4 65.5 27.8 93.4 48.9 27.9 21.1 51.4 46.5 69.9 75.6 18.4 29 31.6 61 39.2 95.1a336.85 336.85 0 010 149.9c-7.6 34.1-20.8 66.1-39.2 95.1-18.5 29.1-42 54.5-69.9 75.6-27.9 21.1-59.3 37.5-93.4 48.9C589 850 551.2 856 512 856z" />
  </AntIcon>
);

const AntWhatsApp: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M713.5 599.9c-10.9-5.6-65.2-32.2-75.3-35.8-10.1-3.8-17.5-5.6-24.8 5.6-7.4 11.1-28.4 35.8-35 43.3-6.4 7.4-12.9 8.3-23.8 2.8-64.8-32.4-107.3-57.8-150-131.1-11.3-19.5 11.3-18.1 32.4-60.2 3.6-7.4 1.8-13.7-1-19.3-2.8-5.6-24.8-59.8-34-81.9-8.9-21.5-18.1-18.5-24.8-18.9-6.4-.4-13.7-.4-21.1-.4-7.4 0-19.3 2.8-29.4 13.7-10.1 11.1-38.6 37.8-38.6 92s39.5 106.7 44.9 114.1c5.6 7.4 77.7 118.6 188.4 166.5 70 30.2 97.4 32.8 132.4 27.6 21.3-3.2 65.2-26.6 74.3-52.5 9.1-25.8 9.1-47.9 6.4-52.5-2.7-4.9-10.1-7.7-21-13z" />
    <path d="M925.2 338.4c-22.6-53.7-55-101.9-96.3-143.3a444.35 444.35 0 00-143.3-96.3C630.6 75.7 572.2 64 512 64h-2c-60.6.3-119.3 12.3-174.5 35.9a445.35 445.35 0 00-142 96.5c-40.9 41.3-73 89.3-95.2 142.8-23 55.4-34.6 114.3-34.3 174.9A449.4 449.4 0 00112 714v152a46 46 0 0046 46h152.1A449.4 449.4 0 00510 960h2.1c59.9 0 118-11.6 172.7-34.3a444.48 444.48 0 00142.8-95.2c41.3-40.9 73.8-88.7 96.5-142 23.6-55.2 35.6-113.9 35.9-174.5.3-60.9-11.5-120-34.8-175.6zM774.1 776C704 845.8 611 884 512 884h-1.7c-60.3-.3-120.2-15.3-173.1-43.5l-8.4-4.5H188V695.2l-4.5-8.4C155.3 633.9 140.3 574 140 513.7c-.4-99.7 37.7-193.3 107.6-263.8 69.8-70.5 163.1-109.5 262.8-109.9h1.7c50 0 98.5 9.7 144.2 28.9 44.6 18.7 84.6 45.6 119 80 34.3 34.3 61.3 74.4 80 119 19.4 46.2 29.1 95.2 28.9 145.8-.6 99.6-39.7 192.9-110.1 262.7z" />
  </AntIcon>
);

// ------------------------------------------------------------- segment model

const SEGMENT_LABELS: Record<SegmentKind, string> = {
  birthday_today: 'Aniversariantes do dia',
  inactive: 'Clientes inativos',
  all: 'Todos os clientes',
};

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'E-mail',
};

/** Uma automação é "ativa" quando o backend já a considera em execução. */
function isActive(c: Campaign): boolean {
  return c.status === 'sent' || c.status === 'sending' || c.status === 'scheduled';
}

function segmentLabel(c: Campaign): string {
  const kind = c.segmentJson?.kind ?? 'all';
  if (kind === 'inactive') {
    const d = c.segmentJson?.inactiveDays ?? 90;
    return `Clientes inativos há ${d}+ dias`;
  }
  return SEGMENT_LABELS[kind];
}

// ---------------------------------------------------------------- templates
// Modelos que geram campanhas REAIS. Cada um mapeia para um segmento que o
// backend resolve, com uma mensagem sugerida (variáveis %NOME%/%ESTABELECIMENTO%).

interface Template {
  id: string;
  icon: IconType;
  title: string;
  description: string;
  suggested: {
    name: string;
    channel: CampaignChannel;
    kind: SegmentKind;
    inactiveDays?: number;
    message: string;
  };
}

const TEMPLATES: Template[] = [
  {
    id: 'aniversario',
    icon: AntGift,
    title: 'Parabenize aniversariantes',
    description:
      'Envie uma mensagem carinhosa aos clientes que fazem aniversário hoje e fortaleça o relacionamento. Vira uma automação diária quando ativada.',
    suggested: {
      name: 'Aniversariantes do dia',
      channel: 'whatsapp',
      kind: 'birthday_today',
      message:
        'Feliz aniversário, %NOME%! 🎉 A equipe do %ESTABELECIMENTO% deseja um dia incrível. Que tal comemorar com a gente? Responda esta mensagem para agendar.',
    },
  },
  {
    id: 'reconquista',
    icon: AntUsergroupAdd,
    title: 'Reconquiste clientes inativos',
    description:
      'Alcance quem não volta ao seu estabelecimento há um tempo com uma oferta especial e traga esses clientes de volta.',
    suggested: {
      name: 'Reconquista de inativos',
      channel: 'whatsapp',
      kind: 'inactive',
      inactiveDays: 90,
      message:
        'Oi, %NOME%! Sentimos sua falta no %ESTABELECIMENTO%. 💛 Preparamos uma condição especial para o seu retorno. Responda para agendar seu horário!',
    },
  },
  {
    id: 'broadcast',
    icon: AntNotification,
    title: 'Aviso para todos os clientes',
    description:
      'Comunique uma novidade, promoção ou aviso importante para toda a sua base de clientes ativos de uma vez.',
    suggested: {
      name: 'Comunicado geral',
      channel: 'whatsapp',
      kind: 'all',
      message:
        'Olá, %NOME%! Temos novidades no %ESTABELECIMENTO%. Fique de olho e agende seu próximo atendimento com a gente. 😉',
    },
  },
];

// ------------------------------------------------------------------ badges

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const map: Record<Campaign['status'], { label: string; cls: string }> = {
    draft: { label: 'Rascunho', cls: 'bg-black/5 text-muted-ink' },
    scheduled: {
      label: 'Agendada',
      cls: 'bg-[color-mix(in_oklab,var(--sp-primary)_15%,transparent)] text-primary',
    },
    sending: {
      label: 'Enviando',
      cls: 'bg-[color-mix(in_oklab,var(--sp-primary)_15%,transparent)] text-primary',
    },
    sent: {
      label: 'Ativa',
      cls: 'bg-[color-mix(in_oklab,#22a06b_16%,transparent)] text-[#1a7a51]',
    },
    canceled: { label: 'Cancelada', cls: 'bg-black/5 text-muted-ink' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// -------------------------------------------------------------- form state

interface FormState {
  name: string;
  channel: CampaignChannel;
  kind: SegmentKind;
  inactiveDays: number;
  message: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  channel: 'whatsapp',
  kind: 'all',
  inactiveDays: 90,
  message: '',
};

function toForm(c: Campaign): FormState {
  const kind = c.segmentJson?.kind ?? 'all';
  return {
    name: c.name,
    channel: c.channel,
    kind,
    inactiveDays: c.segmentJson?.inactiveDays ?? 90,
    message: c.segmentJson?.message ?? '',
  };
}

// ------------------------------------------------------------------ drawer

function CampaignDrawer({
  isOpen,
  editing,
  initialForm,
  onClose,
}: {
  isOpen: boolean;
  editing: Campaign | null;
  initialForm: FormState;
  onClose: () => void;
}) {
  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const preview = usePreviewSegment();

  const [form, setForm] = useState<FormState>(initialForm);

  // Reinicia o formulário sempre que o drawer abre com um alvo diferente.
  useEffect(() => {
    if (isOpen) setForm(initialForm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing?.id]);

  // Atualiza o preview de segmento sempre que o segmento muda (com o drawer aberto).
  useEffect(() => {
    if (!isOpen) return;
    const body =
      form.kind === 'inactive'
        ? { kind: form.kind, inactiveDays: form.inactiveDays }
        : { kind: form.kind };
    preview.mutate(body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, form.kind, form.inactiveDays]);

  const isPending = create.isPending || update.isPending;
  const canSave = form.name.trim().length >= 2 && !isPending;

  async function handleSave() {
    const segmentJson =
      form.kind === 'inactive'
        ? { kind: form.kind, inactiveDays: form.inactiveDays }
        : { kind: form.kind };
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          body: { name: form.name.trim(), channel: form.channel, segmentJson, message: form.message },
        });
      } else {
        await create.mutateAsync({
          name: form.name.trim(),
          channel: form.channel,
          segmentJson,
          message: form.message,
        });
      }
      onClose();
    } catch {
      /* erro tratado pelo MutationCache global (toast) */
    }
  }

  const inputCls =
    'w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar campanha' : 'Nova campanha'}
      widthClass="sm:w-[520px]"
      fullscreen
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" className="w-full sm:w-auto" isDisabled={!canSave} onClick={handleSave}>
            {isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Nome */}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">Nome da campanha</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex.: Aniversariantes do dia"
            className={inputCls}
          />
        </label>

        {/* Canal */}
        <label className="flex flex-col gap-1">
          <span className="inline-flex items-center text-sm font-medium text-ink">
            Canal
            <HelpTooltip>Por onde as mensagens serão enviadas. Hoje só o WhatsApp dispara de fato.</HelpTooltip>
          </span>
          <select
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as CampaignChannel }))}
            className={inputCls}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">E-mail</option>
          </select>
        </label>

        {/* Segmento */}
        <label className="flex flex-col gap-1">
          <span className="inline-flex items-center text-sm font-medium text-ink">
            Público
            <HelpTooltip>Quem vai receber a mensagem. O preview mostra quantos clientes casam agora.</HelpTooltip>
          </span>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as SegmentKind }))}
            className={inputCls}
          >
            <option value="all">Todos os clientes ativos</option>
            <option value="birthday_today">Aniversariantes do dia</option>
            <option value="inactive">Clientes inativos</option>
          </select>
        </label>

        {form.kind === 'inactive' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Sem agendar há (dias)</span>
            <input
              type="number"
              min={1}
              value={form.inactiveDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, inactiveDays: Math.max(1, Number(e.target.value) || 90) }))
              }
              className={inputCls}
            />
          </label>
        )}

        {/* Preview do segmento */}
        <div className="rounded-lg border border-line bg-canvas px-3 py-3 text-sm">
          {preview.isPending ? (
            <span className="text-muted-ink">Calculando público…</span>
          ) : preview.data ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-ink">
                {preview.data.count} {preview.data.count === 1 ? 'cliente' : 'clientes'} neste público
              </span>
              <span className="text-xs text-muted-ink">
                {preview.data.withPhone} com telefone cadastrado (só esses recebem no WhatsApp).
              </span>
            </div>
          ) : (
            <span className="text-muted-ink">Selecione um público para ver o alcance.</span>
          )}
        </div>

        {/* Mensagem */}
        <label className="flex flex-col gap-1">
          <span className="inline-flex items-center text-sm font-medium text-ink">
            Mensagem
            <HelpTooltip>Texto enviado ao cliente. Use as variáveis para personalizar.</HelpTooltip>
          </span>
          <span className="text-xs text-muted-ink">
            Use <code className="rounded bg-black/5 px-1">%NOME%</code> para o nome do cliente e{' '}
            <code className="rounded bg-black/5 px-1">%ESTABELECIMENTO%</code> para o nome do seu negócio.
          </span>
          <textarea
            value={form.message}
            rows={6}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            placeholder="Digite a mensagem que será enviada ao cliente…"
            className={inputCls}
          />
        </label>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------- template tile

function TemplateCard({
  template,
  onUse,
}: {
  template: Template;
  onUse: () => void;
}) {
  const Icon = template.icon;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-1 flex-col items-center gap-3 p-4 text-center">
        <span className="mt-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={30} />
        </span>
        <span className="text-base font-semibold text-ink">{template.title}</span>
        <span className="text-sm leading-relaxed text-muted-ink">{template.description}</span>
      </div>
      <div className="mt-auto border-t border-line px-4 py-3 text-center">
        <button
          type="button"
          onClick={onUse}
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Usar modelo
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- list row

function CampaignRow({
  campaign,
  onEdit,
  onToggle,
  onDispatch,
  onDelete,
  busy,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  onDispatch: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const sent = campaign._count?.messages ?? 0;
  const active = isActive(campaign);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {campaign.channel === 'whatsapp' ? <AntWhatsApp size={20} /> : <AntMessage size={20} />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{campaign.name}</span>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="mt-0.5 text-xs text-muted-ink">
            {CHANNEL_LABELS[campaign.channel]} · {segmentLabel(campaign)}
          </div>
          <div className="mt-0.5 inline-flex items-center text-xs text-muted-ink">
            {sent} {sent === 1 ? 'mensagem enfileirada' : 'mensagens enfileiradas'}
            <HelpTooltip>Total de mensagens já criadas/enviadas por esta campanha (dado real, não saldo).</HelpTooltip>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-1 inline-flex items-center gap-2 text-xs text-muted-ink">
          {active ? 'Ativa' : 'Pausada'}
          <AppSwitch
            checked={active}
            onChange={onToggle}
            isDisabled={busy}
            aria-label={`Ativar/pausar ${campaign.name}`}
          />
        </label>
        <Button variant="outline" size="sm" onClick={onEdit} isDisabled={busy}>
          Editar
        </Button>
        <Button variant="primary" size="sm" onClick={onDispatch} isDisabled={busy}>
          Disparar
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} isDisabled={busy}>
          Excluir
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- page

export function CampanhasPage() {
  const confirm = useConfirm();
  const campaignsQuery = useCampaigns();
  const update = useUpdateCampaign();
  const del = useDeleteCampaign();
  const dispatch = useDispatchCampaign();
  const preview = usePreviewSegment();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [initialForm, setInitialForm] = useState<FormState>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  const campaigns = campaignsQuery.data ?? [];

  function openNew() {
    setEditing(null);
    setInitialForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openFromTemplate(t: Template) {
    setEditing(null);
    setInitialForm({
      name: t.suggested.name,
      channel: t.suggested.channel,
      kind: t.suggested.kind,
      inactiveDays: t.suggested.inactiveDays ?? 90,
      message: t.suggested.message,
    });
    setDrawerOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setInitialForm(toForm(c));
    setDrawerOpen(true);
  }

  async function handleToggle(c: Campaign, active: boolean) {
    setBusyId(c.id);
    try {
      // "Ativa" = sent (o sweep de aniversário só age em sent/sending);
      // "Pausada" = draft. É a forma honesta de ligar/desligar sem re-disparar.
      await update.mutateAsync({ id: c.id, body: { status: active ? 'sent' : 'draft' } });
    } catch {
      /* toast global */
    } finally {
      setBusyId(null);
    }
  }

  async function handleDispatch(c: Campaign) {
    // Consulta o alcance atual para confirmar com números reais.
    let count = c._count?.messages ?? 0;
    try {
      const body =
        c.segmentJson?.kind === 'inactive'
          ? { kind: 'inactive' as const, inactiveDays: c.segmentJson?.inactiveDays ?? 90 }
          : { kind: (c.segmentJson?.kind ?? 'all') as SegmentKind };
      const p = await preview.mutateAsync(body);
      count = p.withPhone;
    } catch {
      /* segue com estimativa vazia se o preview falhar */
    }

    const ok = await confirm({
      title: 'Disparar campanha agora?',
      message: `Serão enfileiradas mensagens para até ${count} ${count === 1 ? 'cliente' : 'clientes'} com telefone. Clientes já contatados por esta campanha são ignorados.`,
      confirmLabel: 'Disparar',
    });
    if (!ok) return;

    setBusyId(c.id);
    try {
      const res = await dispatch.mutateAsync(c.id);
      await confirm({
        title: 'Campanha disparada',
        message:
          res.queued > 0
            ? `${res.queued} ${res.queued === 1 ? 'mensagem enfileirada' : 'mensagens enfileiradas'} para envio.${res.skipped > 0 ? ` ${res.skipped} ignoradas (sem telefone ou opt-out).` : ''}`
            : 'Nenhuma nova mensagem foi enfileirada — todos os clientes deste público já haviam sido contatados.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
      });
    } catch {
      /* toast global */
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: Campaign) {
    const ok = await confirm({
      title: `Excluir "${c.name}"?`,
      message: 'A campanha e seu histórico de mensagens serão removidos. Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await del.mutateAsync(c.id);
    } catch {
      /* toast global */
    } finally {
      setBusyId(null);
    }
  }

  const headerActions = useMemo(
    () => (
      <Button variant="primary" onClick={openNew}>
        Nova campanha
      </Button>
    ),
    [],
  );

  return (
    <div>
      <PageHeader title="Campanhas" actions={headerActions} />

      {/* Modelos rápidos */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Comece por um modelo</h2>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} onUse={() => openFromTemplate(t)} />
          ))}
        </div>
      </section>

      {/* Campanhas reais */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-ink">Suas campanhas</h2>

        {campaignsQuery.isLoading ? (
          <LoadingState label="Carregando campanhas…" />
        ) : campaignsQuery.isError ? (
          <ErrorState
            message="Não foi possível carregar as campanhas."
            onRetry={() => campaignsQuery.refetch()}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="Nenhuma campanha ainda"
            description="Use um dos modelos acima ou crie uma campanha do zero para começar a enviar mensagens aos seus clientes."
            action={
              <Button variant="primary" onClick={openNew}>
                Nova campanha
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                busy={busyId === c.id}
                onEdit={() => openEdit(c)}
                onToggle={(active) => handleToggle(c, active)}
                onDispatch={() => handleDispatch(c)}
                onDelete={() => handleDelete(c)}
              />
            ))}
          </div>
        )}
      </section>

      <CampaignDrawer
        isOpen={drawerOpen}
        editing={editing}
        initialForm={initialForm}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
