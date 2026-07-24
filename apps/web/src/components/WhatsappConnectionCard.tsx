import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Spinner, Tabs, TextField } from '@heroui/react';
import {
  useLogoutWhatsapp,
  usePairWhatsapp,
  useSaveWhatsappManager,
  useWhatsappManager,
  useWhatsappQr,
  useWhatsappStatus,
  type WhatsappStatus,
} from '../lib/queries/whatsapp';
import { useConfirm } from './ConfirmDialog';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconInfo,
  IconPhone,
  IconQr,
  IconRefresh,
  IconWhatsApp,
} from './icons';
import { formatPhone } from '../lib/format';

/** Máscara BR progressiva: (11) 98765-4321. */
function maskPhoneBr(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Código de pareamento em 8 chars → "ABCD-EFGH". */
function formatPairingCode(code: string): string {
  const c = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (c.length <= 4) return c;
  return `${c.slice(0, 4)}-${c.slice(4, 8)}`;
}

interface StatusMeta {
  label: string;
  dot: string;
  chip: string;
}

const STATUS_META: Record<WhatsappStatus, StatusMeta> = {
  open: {
    label: 'Conectado',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  },
  qr: {
    label: 'Conectando…',
    dot: 'bg-amber-500 animate-pulse',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
  connecting: {
    label: 'Conectando…',
    dot: 'bg-amber-500 animate-pulse',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
  },
  closed: {
    label: 'Desconectado',
    dot: 'bg-rose-500',
    chip: 'border-rose-500/30 bg-rose-500/10 text-rose-600',
  },
  disabled: {
    label: 'Indisponível neste ambiente',
    dot: 'bg-muted-ink/50',
    chip: 'border-line bg-canvas text-muted-ink',
  },
};

interface WhatsappConnectionCardProps {
  /** Leva o usuário para a aba Notificações (config de follow-up/lembretes). */
  onGoToNotifications?: () => void;
}

export function WhatsappConnectionCard({ onGoToNotifications }: WhatsappConnectionCardProps) {
  const statusQuery = useWhatsappStatus();
  const status: WhatsappStatus = statusQuery.data?.status ?? 'connecting';
  const hasQr = statusQuery.data?.hasQr ?? false;
  const meta = STATUS_META[status];

  return (
    <div className="flex flex-col gap-5">
      {/* Explicação: por que conectar */}
      <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
        <IconWhatsApp size={20} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-sm leading-relaxed text-muted-ink">
          Conecte o WhatsApp do salão para enviar automaticamente{' '}
          <b className="text-ink">lembretes</b>, <b className="text-ink">follow-ups</b> e{' '}
          <b className="text-ink">campanhas</b> aos clientes. Sem conexão, as mensagens não
          são enviadas.
          {onGoToNotifications ? (
            <>
              {' '}
              <button
                type="button"
                onClick={onGoToNotifications}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Configurar lembretes e follow-up
              </button>
              .
            </>
          ) : null}
        </p>
      </div>

      {/* Status no topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Conexão do WhatsApp</p>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chip}`}
        >
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {statusQuery.isLoading ? 'Verificando…' : meta.label}
        </span>
      </div>

      {/* Corpo por estado */}
      {status === 'disabled' ? (
        <DisabledState />
      ) : status === 'open' ? (
        <ConnectedState
          phone={statusQuery.data?.phone ?? null}
          onRelinked={() => void statusQuery.refetch()}
        />
      ) : (
        <ConnectSection status={status} hasQr={hasQr} />
      )}

      <div className="h-px bg-line" />

      <ManagerNumberSection />
    </div>
  );
}

function DisabledState() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
      <IconInfo size={18} className="mt-0.5 shrink-0 text-muted-ink" />
      <p className="text-sm leading-relaxed text-muted-ink">
        O envio pelo WhatsApp está desligado neste ambiente. As mensagens automáticas
        ficam disponíveis quando a integração é ativada em produção.
      </p>
    </div>
  );
}

/* ----------------------------- Conectado ----------------------------- */

function ConnectedState({
  phone,
  onRelinked,
}: {
  phone: string | null;
  onRelinked: () => void;
}) {
  const logout = useLogoutWhatsapp();
  const confirm = useConfirm();

  async function handleDisconnect() {
    const ok = await confirm({
      title: 'Desconectar o WhatsApp?',
      message:
        'O salão deixará de enviar lembretes, follow-ups e campanhas até você conectar de novo. Você poderá religar a qualquer momento.',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;
    await logout.mutateAsync();
    onRelinked();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-3">
        <IconCircleCheck size={22} className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-ink">WhatsApp conectado</p>
          <p className="mt-1 text-sm text-muted-ink">
            O salão já pode enviar lembretes, follow-ups e campanhas automaticamente.
          </p>
          {phone ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-card px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <IconPhone size={13} />
              {formatPhone(phone)}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        variant="secondary"
        onPress={handleDisconnect}
        isDisabled={logout.isPending}
        className="self-start"
      >
        {logout.isPending ? (
          <>
            <Spinner size="sm" /> Desconectando…
          </>
        ) : (
          'Desconectar'
        )}
      </Button>
    </div>
  );
}

/* --------------------------- Desconectado ---------------------------- */

// Mesmo tratamento de "selecionado" das abas de Configurações, para consistência.
const CONNECT_TAB_CLASS =
  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] hover:text-ink data-[selected]:bg-card data-[selected]:text-primary data-[selected]:shadow-[var(--shadow-soft)]';

function ConnectSection({ status, hasQr }: { status: WhatsappStatus; hasQr: boolean }) {
  const [tab, setTab] = useState<'qr' | 'code'>('qr');

  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as 'qr' | 'code')}>
      <Tabs.ListContainer className="rounded-xl border border-line bg-canvas p-1">
        <Tabs.List aria-label="Como conectar o WhatsApp" className="gap-1">
          <Tabs.Tab id="qr" className={CONNECT_TAB_CLASS}>
            <IconQr size={16} /> QR Code
          </Tabs.Tab>
          <Tabs.Tab id="code" className={CONNECT_TAB_CLASS}>
            <IconPhone size={16} /> Código
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      <Tabs.Panel id="qr" className="pt-4">
        <QrPanel status={status} hasQr={hasQr} />
      </Tabs.Panel>
      <Tabs.Panel id="code" className="pt-4">
        <PairingCodePanel />
      </Tabs.Panel>
    </Tabs>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2 text-sm text-muted-ink">
      {items.map((step, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {i + 1}
          </span>
          <span className="leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function QrPanel({ status, hasQr }: { status: WhatsappStatus; hasQr: boolean }) {
  const qr = useWhatsappQr(hasQr);
  const url = qr.data ?? null;

  // The query hands back a fresh object URL each fetch; revoke the previous one
  // when it changes (and on unmount) so we don't leak blobs during polling.
  const prevUrl = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== url) URL.revokeObjectURL(prevUrl.current);
    prevUrl.current = url;
    return () => {
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = null;
      }
    };
  }, [url]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center justify-center self-center sm:self-start">
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-line bg-white p-3">
          {url ? (
            <img
              src={url}
              alt="QR Code para conectar o WhatsApp"
              className="h-full w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center text-muted-ink">
              <Spinner size="sm" />
              <span className="text-xs">
                {hasQr ? 'Carregando QR…' : 'Gerando código…'}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm font-semibold text-ink">Escaneie com o WhatsApp</p>
        <Steps
          items={[
            'Abra o WhatsApp no celular do salão.',
            'Toque em Aparelhos conectados → Conectar um aparelho.',
            'Aponte a câmera para o QR Code ao lado.',
          ]}
        />
        <p className="text-xs text-muted-ink">
          A tela vira para <b className="text-ink">Conectado</b> sozinha assim que o
          pareamento terminar.
        </p>
        {status === 'connecting' && !hasQr ? (
          <p className="inline-flex items-center gap-2 text-xs text-amber-600">
            <IconRefresh size={14} className="animate-spin" /> Preparando o código…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PairingCodePanel() {
  const pair = usePairWhatsapp();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const digits = phone.replace(/\D/g, '');
  const canSubmit = digits.length >= 10 && !pair.isPending;

  async function handleGenerate() {
    setCode(null);
    setNotFound(false);
    setCopied(false);
    const res = await pair.mutateAsync(digits);
    if (res.code) setCode(res.code);
    else setNotFound(true);
  }

  const formatted = useMemo(() => (code ? formatPairingCode(code) : ''), [code]);

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard bloqueado — o usuário digita o código manualmente
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">Conectar com número de telefone</p>
        <p className="mt-1 text-sm text-muted-ink">
          Informe o número do WhatsApp do salão e gere um código de 8 dígitos para digitar
          no aparelho.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextField
          value={phone}
          onChange={(v) => {
            setPhone(maskPhoneBr(v));
            if (code || notFound) {
              setCode(null);
              setNotFound(false);
            }
          }}
          aria-label="Número do WhatsApp do salão"
          className="sm:flex-1"
        >
          <Input placeholder="(11) 98765-4321" inputMode="tel" />
        </TextField>
        <Button
          variant="primary"
          onPress={handleGenerate}
          isDisabled={!canSubmit}
          className="sm:w-auto"
        >
          {pair.isPending ? (
            <>
              <Spinner size="sm" /> Gerando…
            </>
          ) : (
            'Gerar código'
          )}
        </Button>
      </div>

      {code ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-ink">
              {formatted}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-primary/40 hover:text-primary"
            >
              {copied ? (
                <>
                  <IconCheck size={14} /> Copiado
                </>
              ) : (
                <>
                  <IconCopy size={14} /> Copiar
                </>
              )}
            </button>
          </div>
          <Steps
            items={[
              'No WhatsApp do salão: Aparelhos conectados → Conectar um aparelho.',
              'Toque em Conectar com número de telefone.',
              `Digite o código ${formatted}.`,
            ]}
          />
          <p className="text-xs text-muted-ink">
            O código expira em alguns minutos. Se não funcionar, gere um novo.
          </p>
        </div>
      ) : null}

      {notFound ? (
        <p className="inline-flex items-start gap-2 text-sm text-rose-600">
          <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
          Não foi possível gerar o código agora. Confira o número e tente novamente em
          instantes.
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------- Número gerente -------------------------- */

function ManagerNumberSection() {
  const manager = useWhatsappManager();
  const save = useSaveWhatsappManager();
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);

  const loaded = manager.data?.phone ?? null;
  useEffect(() => {
    if (manager.data) setValue(manager.data.phone ? formatPhone(manager.data.phone) : '');
  }, [manager.data]);

  async function handleSave() {
    setSaved(false);
    await save.mutateAsync(value.replace(/\D/g, ''));
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">Número do salão (recebe as confirmações)</p>
        <p className="mt-1 text-sm text-muted-ink">
          Quando um cliente agendar online, este número recebe uma mensagem no WhatsApp para{' '}
          <b className="text-ink">confirmar</b>, <b className="text-ink">cancelar</b> ou{' '}
          <b className="text-ink">sugerir outro horário</b> — basta responder{' '}
          <b className="text-ink">1</b>, <b className="text-ink">2</b> ou{' '}
          <b className="text-ink">3</b>. O cliente só é avisado depois que você confirma.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <TextField
          value={value}
          onChange={(v) => {
            setValue(maskPhoneBr(v));
            if (saved) setSaved(false);
          }}
          aria-label="Número do salão"
          className="sm:flex-1"
        >
          <Input placeholder="(89) 99999-9999" inputMode="tel" />
        </TextField>
        <Button
          variant="primary"
          onPress={handleSave}
          isDisabled={save.isPending || manager.isLoading}
          className="sm:w-auto"
        >
          {save.isPending ? (
            <>
              <Spinner size="sm" /> Salvando…
            </>
          ) : (
            'Salvar número'
          )}
        </Button>
      </div>
      {saved && !save.isPending && (
        <p className="text-sm font-medium text-emerald-600">
          {value.trim() ? 'Número salvo!' : 'Número removido.'}
        </p>
      )}
      {!loaded && !manager.isLoading && !saved && (
        <p className="inline-flex items-start gap-2 text-xs text-amber-600">
          <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
          Sem um número aqui, os agendamentos são confirmados automaticamente sem passar
          pelo salão.
        </p>
      )}
    </div>
  );
}
