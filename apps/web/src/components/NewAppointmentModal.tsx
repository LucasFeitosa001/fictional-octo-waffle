import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  Input,
  ListBox,
  Select,
  Spinner,
  TextField,
} from '@heroui/react';
import { Drawer } from './Drawer';
import { DatePicker } from './DatePicker';
import { AppSwitch } from './SwitchRow';
import { InlineToggle } from './InlineToggle';
import { CustomerAvatar } from './CustomerPickerDrawer';
import { ClienteBlocosLaterais } from './ClienteBlocosLaterais';
import { useConfirm } from './ConfirmDialog';
import { PhoneField } from './PhoneField';
import { useNavigate } from 'react-router-dom';
import { IconChevron, IconInfo, IconSearch } from './icons';
import {
  ApiClientError,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type Customer,
} from '@beautypass/shared';
import {
  useAvailability,
  useCreateAppointmentSeries,
  useCreateCustomer,
  useCreateOrder,
  useCustomers,
  useProfessionals,
  useServices,
} from '../lib/queries';
import { useNotificationSettings } from '../lib/queries/notificationSettings';
import { AvisosDoCliente, type CampoDeAviso } from './AvisosDoCliente';
import { variaveisDoAgendamento } from '../lib/queries/messageTemplates';
import { useEmpresa } from '../lib/queries/empresa';
import { formatDuration, formatMoney, formatSlotTime, isoDate } from '../lib/format';
import type { AppointmentFollowUpInput, AvailabilitySlot } from '../lib/types';
import { FOLLOWUP_TEMPLATES } from '../lib/followupTemplates';

interface NewAppointmentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /**
   * Chamado após criar o agendamento + a comanda ("Criar comanda"), com o id da
   * order recém-criada. Se fornecido, o pai assume a navegação para a comanda
   * (fecha o drawer por conta própria); caso contrário o modal navega sozinho
   * para /comandas/:id.
   */
  onCreatedOrder?: (orderId: string) => void;
  /** Pre-select this date (ISO yyyy-mm-dd) when the modal opens. */
  initialDate?: string;
  /**
   * Pre-select this customer when the modal opens (fluxo cliente→agendamento a
   * partir do perfil). Evita re-buscar o cliente: usamos os dados já em mãos.
   */
  initialCustomer?: {
    id: string;
    name: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null;
}

const NONE = '';

// Um item do agendamento. O Belasis permite N serviços por agendamento (cada
// item = serviço + profissional + duração). O backend aceita items[]; o start
// (horário) é único e vem do primeiro item.
interface ApptItem {
  serviceId: string;
  professionalId: string;
  durationMin: number;
}
const emptyItem = (): ApptItem => ({ serviceId: '', professionalId: '', durationMin: 0 });

// Cores de status do Belasis (mesma paleta calendar_* da Agenda). Usadas no
// campo "Cor" do drawer, cujo padrão segue a cor do status selecionado.
const STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: '#90A4AE',
  confirmed: '#32c787',
  unconfirmed: '#2196F3',
  waiting: '#FFA500',
  in_progress: '#8b5cf6',
  done: '#607D8B',
  finished: '#334155',
  canceled: '#ff6b68',
};

type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';
const FREQ_OPTIONS: { id: Freq; label: string }[] = [
  { id: 'none', label: 'Não repete' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'biweekly', label: 'Quinzenal' },
  { id: 'monthly', label: 'Mensal' },
];

function nextDate(base: Date, freq: Freq, times: number): Date {
  const d = new Date(base);
  if (freq === 'weekly') d.setDate(d.getDate() + 7 * times);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * times);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + times);
  return d;
}

// ── "Avisar o cliente" (aviso personalizado no drawer) ─────────────────────
// Espelha a UX do FollowUpConfigCard (Configurações → Notificações): unidades de
// tempo (segundos → dias), âncora do disparo e chips de variáveis do template.
type WarnUnit = AppointmentFollowUpInput['delayUnit'];
const WARN_UNIT_OPTIONS: { id: WarnUnit; label: string }[] = [
  { id: 'seconds', label: 'segundos' },
  { id: 'minutes', label: 'minutos' },
  { id: 'hours', label: 'horas' },
  { id: 'days', label: 'dias' },
];
const WARN_UNIT_LABEL: Record<WarnUnit, string> = {
  seconds: 'segundos',
  minutes: 'minutos',
  hours: 'horas',
  days: 'dias',
};

type WarnWhen = NonNullable<AppointmentFollowUpInput['when']>;
const WARN_WHEN_OPTIONS: { id: WarnWhen; label: string }[] = [
  { id: 'after', label: 'Depois do atendimento' },
  { id: 'before', label: 'Antes do atendimento' },
  { id: 'from_now', label: 'A partir de agora' },
];
const WARN_WHEN_LABEL: Record<WarnWhen, string> = {
  after: 'Depois do atendimento',
  before: 'Antes do atendimento',
  from_now: 'A partir de agora',
};

// Variáveis suportadas na mensagem — clicar insere o token no textarea.
const WARN_VARS: { token: string; label: string }[] = [
  { token: '{cliente}', label: 'primeiro nome do cliente' },
  { token: '{estabelecimento}', label: 'nome do salão' },
  { token: '{servico}', label: 'serviços do agendamento' },
  { token: '{link}', label: 'link de reagendamento' },
];

// Belasis usa formulário horizontal: label 13px 600 acima de cada controle.
function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={'flex min-w-0 flex-col gap-1.5 ' + className}>
      <label className="text-[13px] font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

// Switch inline: HeroUI v3 Switch (AppSwitch) + rótulo clicável à direita.

// Avatar padrão do cliente (rail esquerdo do drawer).
function UserGlyph() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

/**
 * Instante de início a partir do dia e do horário escolhido.
 *
 * `slotStart` chega em DOIS formatos: o ISO completo que a grade devolve
 * (appointments.service.ts:1300 monta `new Date(slotStart).toISOString()`) ou o
 * `HH:MM` do padrão. Concatenar cegamente `${date}T${slotStart}:00` produzia
 * `2026-08-01T2026-08-01T12:00:00.000Z:00` — Invalid Date — e a formatação da
 * prévia derrubava a tela inteira ao clicar num horário. Ver estudo 79.
 */
function instanteDoSlot(date: string, slotStart: string | null): Date {
  if (slotStart && slotStart.includes('T')) return new Date(slotStart);
  return new Date(`${date}T${slotStart || '09:00'}:00`);
}

export function NewAppointmentModal({
  isOpen,
  onOpenChange,
  onCreated,
  onCreatedOrder,
  initialDate,
  initialCustomer,
}: NewAppointmentModalProps) {
  const nav = useNavigate();
  const [items, setItems] = useState<ApptItem[]>(() => [emptyItem()]);
  const [status, setStatus] = useState<AppointmentStatus>('confirmed');
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [slotStart, setSlotStart] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  // `avatarUrl` faz parte do estado, não é opcional por acaso: sem ele os
  // setters abaixo descartavam a foto e o rail esquerdo caía nas iniciais mesmo
  // com o cliente tendo foto — foi exatamente o defeito relatado.
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    phone?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [notes, setNotes] = useState('');
  // Ações
  // O DEFAULT do lembrete pré-atendimento vem da configuração do salão
  // (Configurações → Notificações → automation.reminder). Opt-in: começa
  // DESLIGADO quando o salão não ativou. A dona ainda pode ligar por agendamento.
  const notificationSettings = useNotificationSettings();
  const reminderDefault = notificationSettings.data?.reminder ?? false;
  const confirmationDefault = notificationSettings.data?.confirmation ?? false;
  const cancellationDefault = notificationSettings.data?.cancellation ?? false;
  const [sendReminder, setSendReminder] = useState(reminderDefault);
  const [sendConfirmation, setSendConfirmation] = useState(confirmationDefault);
  const [sendCancellation, setSendCancellation] = useState(cancellationDefault);
  // Marca se a dona já mexeu no toggle manualmente. Enquanto não mexeu, o toggle
  // segue o default da config (útil quando a config chega depois do modal abrir).
  const reminderTouched = useRef(false);
  const confirmationTouched = useRef(false);
  const cancellationTouched = useRef(false);
  function handleSendReminderChange(v: boolean) {
    reminderTouched.current = true;
    setSendReminder(v);
  }
  function handleSendConfirmationChange(v: boolean) {
    confirmationTouched.current = true;
    setSendConfirmation(v);
  }
  function handleSendCancellationChange(v: boolean) {
    cancellationTouched.current = true;
    setSendCancellation(v);
  }
  // Avisar o cliente (aviso personalizado agendado)
  const [warnEnabled, setWarnEnabled] = useState(false);
  const [warnTemplateId, setWarnTemplateId] = useState<string>('');
  const [warnMessage, setWarnMessage] = useState('');
  const [warnDelayValue, setWarnDelayValue] = useState('1');
  const [warnDelayUnit, setWarnDelayUnit] = useState<WarnUnit>('days');
  const [warnWhen, setWarnWhen] = useState<WarnWhen>('after');
  const [warnIncludeLink, setWarnIncludeLink] = useState(true);
  // Recorrência
  const [freq, setFreq] = useState<Freq>('none');
  const [repeatMore, setRepeatMore] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Id da comanda criada pelo botão "Criar comanda" — habilita o link de fallback
  // na tela de sucesso caso a navegação automática não aconteça.
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // O primeiro item define horário/disponibilidade — o agendamento tem um único
  // start; itens extras são serviços adicionais na mesma comanda.
  const primary = items[0] ?? emptyItem();

  const services = useServices();
  const professionals = useProfessionals();
  const customers = useCustomers(customerSearch);
  const availability = useAvailability(
    primary.serviceId || undefined,
    primary.professionalId || undefined,
    date || undefined,
  );
  const createAppointmentSeries = useCreateAppointmentSeries();
  const createCustomer = useCreateCustomer();
  const createOrder = useCreateOrder();
  const confirm = useConfirm();

  const serviceItems = services.data?.data ?? [];
  const professionalItems = professionals.data?.data ?? [];
  const customerItems = customers.data?.data ?? [];
  const slots = availability.data?.slots ?? [];

  function updateItem(idx: number, patch: Partial<ApptItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  // Ao escolher o serviço, herda a duração dele (o usuário ainda pode trocar).
  function pickService(idx: number, sid: string) {
    const svc = serviceItems.find((s) => s.id === sid);
    updateItem(idx, { serviceId: sid, durationMin: svc ? svc.durationMin : 0 });
  }
  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }
  function removeItem(idx: number) {
    // Última linha: em vez de remover (deixando 0 itens), limpa os campos.
    setItems((prev) => (prev.length <= 1 ? [emptyItem()] : prev.filter((_, i) => i !== idx)));
    if (items.length <= 1 || idx === 0) setSlotStart('');
  }

  // Reset everything whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setItems([emptyItem()]);
      setStatus('confirmed');
      setDate(initialDate || isoDate(new Date()));
      setSlotStart('');
      setCustomerSearch('');
      // Pré-seleciona o cliente vindo do perfil (fluxo cliente→agendamento),
      // usando os dados já em mãos — sem re-buscar pelo picker.
      setCustomerId(initialCustomer?.id ?? '');
      setSelectedCustomer(
        initialCustomer
          ? {
              id: initialCustomer.id,
              name: initialCustomer.name,
              phone: initialCustomer.phone ?? null,
              avatarUrl: initialCustomer.avatarUrl ?? null,
            }
          : null,
      );
      setPickerOpen(false);
      setCreatingNew(false);
      setNewName('');
      setNewPhone('');
      setNotes('');
      // Reflete o default da config do salão (opt-in): começa desligado quando
      // automation.reminder está off. Sincronizado abaixo se a config chegar depois.
      reminderTouched.current = false;
      setSendReminder(reminderDefault);
      confirmationTouched.current = false;
      cancellationTouched.current = false;
      setSendConfirmation(confirmationDefault);
      setSendCancellation(cancellationDefault);
      setWarnEnabled(false);
      setWarnTemplateId('');
      setWarnMessage('');
      setWarnDelayValue('1');
      setWarnDelayUnit('days');
      setWarnWhen('after');
      setWarnIncludeLink(true);
      setFreq('none');
      setRepeatMore(1);
      setFormError(null);
      setSuccess(false);
      setCreatedOrderId(null);
    }
  }, [isOpen, initialDate, initialCustomer]);

  // Sincroniza o toggle com o default da config quando ela carrega DEPOIS de o
  // modal já estar aberto — só enquanto a dona não mexeu manualmente (não trava a
  // edição). Ao mexer, reminderTouched fica true e o default para de sobrescrever.
  useEffect(() => {
    if (isOpen && !reminderTouched.current) {
      setSendReminder(reminderDefault);
    }
  }, [isOpen, reminderDefault]);

  useEffect(() => {
    if (isOpen && !confirmationTouched.current) {
      setSendConfirmation(confirmationDefault);
    }
    if (isOpen && !cancellationTouched.current) {
      setSendCancellation(cancellationDefault);
    }
  }, [isOpen, confirmationDefault, cancellationDefault]);

  // Clear the picked slot when the inputs that produced it change.
  useEffect(() => {
    setSlotStart('');
  }, [primary.serviceId, primary.professionalId, date]);

  // Prévia das mensagens: mesmas variáveis que o backend usa para renderizar.
  const empresa = useEmpresa();
  const variaveisDaPrevia = useMemo(
    () =>
      variaveisDoAgendamento({
        estabelecimento: empresa.data?.name ?? 'seu salão',
        cliente: selectedCustomer?.name ?? customerSearch ?? newName,
        profissional:
          professionalItems.find((p) => p.id === items[0]?.professionalId)?.name ?? null,
        servicos: items
          .map((it) => services.data?.data?.find((s) => s.id === it.serviceId)?.name)
          .filter((n): n is string => Boolean(n)),
        inicio: instanteDoSlot(date, slotStart),
      }),
    [
      empresa.data?.name,
      selectedCustomer?.name,
      customerSearch,
      newName,
      professionalItems,
      services.data,
      items,
      date,
      slotStart,
    ],
  );

  const primaryService = useMemo(
    () => serviceItems.find((s) => s.id === primary.serviceId),
    [serviceItems, primary.serviceId],
  );

  const durationOptions = useMemo(() => {
    const set = new Set([15, 30, 45, 60, 90, 120, 150, 180, 210, 240]);
    serviceItems.forEach((s) => set.add(s.durationMin));
    items.forEach((it) => it.durationMin && set.add(it.durationMin));
    return [...set].sort((a, b) => a - b);
  }, [serviceItems, items]);

  const canPickSlot = Boolean(primary.serviceId && primary.professionalId && date);
  const isBusy =
    createAppointmentSeries.isPending ||
    createCustomer.isPending ||
    createOrder.isPending;
  const canConfirm = Boolean(primary.serviceId && primary.professionalId && slotStart) && !isBusy;

  const selectedCustomerName =
    selectedCustomer?.name ?? customerItems.find((c) => c.id === customerId)?.name;
  // Foto do escolhido, pelo MESMO caminho do nome. Sem cast: `selectedCustomer`
  // agora carrega avatarUrl e o tipo `Customer` compartilhado também o declara.
  // O fallback pela lista cobre o caso de o estado ainda não ter sido preenchido;
  // se a busca mudou e o cliente saiu da lista, fica undefined e o CustomerAvatar
  // cai nas iniciais sozinho.
  const selectedCustomerAvatarUrl =
    selectedCustomer?.avatarUrl ??
    customerItems.find((c) => c.id === customerId)?.avatarUrl ??
    undefined;

  // Create the appointment(s) and apply the chosen status. Returns the primary
  // appointment (+ resolved customer) so callers can chain a comanda, or null on
  // validation/creation failure.
  async function submit(): Promise<{ id: string; customerId?: string } | null> {
    setFormError(null);
    const slot = slots.find((s: AvailabilitySlot) => s.start === slotStart);
    if (!slot) {
      setFormError('Selecione um horário disponível.');
      return null;
    }
    const validItems = items.filter((it) => it.serviceId);
    if (validItems.length === 0) {
      setFormError('Selecione ao menos um serviço.');
      return null;
    }
    if (creatingNew && !newName.trim()) {
      setFormError('Informe o nome do cliente.');
      return null;
    }
    try {
      let resolvedCustomerId = customerId || undefined;
      if (creatingNew && newName.trim()) {
        const created = await createCustomer.mutateAsync({
          name: newName.trim(),
          phone: newPhone.trim() || undefined,
        });
        resolvedCustomerId = created.id;
      }

      const combinedNotes = notes.trim() || undefined;
      // Duração total = soma das durações dos itens (o start é único).
      const dur =
        validItems.reduce((sum, it) => sum + (it.durationMin || 0), 0) ||
        primaryService?.durationMin ||
        60;
      const endFor = (startIso: string) =>
        new Date(new Date(startIso).getTime() + dur * 60000).toISOString();

      const apptProfessionalId = primary.professionalId || undefined;
      const itemsPayload = validItems.map((it) => ({
        serviceId: it.serviceId,
        professionalId: it.professionalId || undefined,
      }));

      // Aviso personalizado ("Avisar o cliente"): só monta o objeto quando o
      // toggle está ligado. Mensagem custom tem precedência; senão manda só o
      // templateId (o backend resolve o texto do modelo). O backend calcula o
      // atraso a partir de delayValue+delayUnit ancorado por `when`.
      const followUpPayload: AppointmentFollowUpInput | undefined = warnEnabled
        ? {
            enabled: true,
            message: warnMessage.trim() || undefined,
            templateId: warnMessage.trim() ? undefined : warnTemplateId || undefined,
            delayValue: Math.max(1, Number(warnDelayValue) || 1),
            delayUnit: warnDelayUnit,
            when: warnWhen,
            includeLink: warnIncludeLink,
          }
        : undefined;

      const additionalStarts =
        freq !== 'none' && repeatMore > 0
          ? Array.from({ length: repeatMore }, (_unused, index) =>
              nextDate(new Date(slot.start), freq, index + 1).toISOString(),
            )
          : [];
      const series = await createAppointmentSeries.mutateAsync({
        customerId: resolvedCustomerId,
        professionalId: apptProfessionalId,
        start: slot.start,
        end: endFor(slot.start),
        notes: combinedNotes,
        // Só vai o toggle em que a pessoa REALMENTE mexeu. Mandar os três
        // sempre gravava o padrão da conta dentro do agendamento, e aí desligar
        // a conta depois não alcançava mais nada — e não dava para distinguir
        // "eu autorizei este" de "o padrão era esse na hora". Omitido = NULL =
        // decide o padrão da conta na entrega. O visualizador da agenda já faz
        // assim (AgendaPage.tsx:853). Ver estudo 81.
        ...(reminderTouched.current ? { remindClient: sendReminder } : {}),
        ...(confirmationTouched.current
          ? { notifyConfirmation: sendConfirmation }
          : {}),
        ...(cancellationTouched.current
          ? { notifyCancellation: sendCancellation }
          : {}),
        items: itemsPayload,
        followUp: followUpPayload,
        additionalStarts,
        status,
      });
      const main = series.data[0];
      if (!main) throw new Error('A série não retornou o agendamento criado.');

      onCreated?.();
      return { id: main.id, customerId: resolvedCustomerId };
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setFormError('Esse horário acabou de ficar indisponível. Escolha outro horário.');
          availability.refetch();
          setSlotStart('');
          return null;
        }
        if (err.statusCode === 400) {
          setFormError(err.message || 'Horário fora do horário de trabalho do profissional.');
          return null;
        }
        setFormError(err.message || 'Não foi possível criar o agendamento.');
        return null;
      }
      setFormError('Não foi possível criar o agendamento. Tente novamente.');
      return null;
    }
  }

  /**
   * Salvar → pergunta se quer a comanda agora.
   *
   * O Belasis não pergunta: ele põe "Salvar" e "Criar comanda" lado a lado no
   * rodapé (captura em `belasis-reference/_structure/drawers/calendar--drawer-1.txt`,
   * linhas 237-246), e nós temos os dois. O dono pediu a pergunta mesmo assim —
   * e ela resolve um buraco real: no CELULAR o botão "Criar comanda" fica
   * escondido, então quem agenda pelo telefone não tinha caminho nenhum para a
   * comanda. Ver estudo 56.
   */
  async function handleConfirm() {
    const result = await submit();
    if (!result) return;
    const querComanda = await confirm({
      title: 'Criar comanda agora?',
      message:
        'O agendamento foi salvo. A comanda registra o atendimento e recebe os pagamentos — dá para criar agora ou depois, pelo próprio agendamento.',
      confirmLabel: 'Criar comanda',
      cancelLabel: 'Agora não',
    });
    if (!querComanda) {
      setSuccess(true);
      return;
    }
    await criarComandaPara(result);
  }

  /** Botão "Criar comanda": salva e vai direto, sem a pergunta. */
  async function handleComanda() {
    const result = await submit();
    if (!result) return;
    await criarComandaPara(result);
  }

  /** Cria a comanda do agendamento recém-salvo (usada pelos dois caminhos). */
  async function criarComandaPara(result: { id: string; customerId?: string }) {
    let orderId: string | null = null;
    try {
      const validItems = items.filter((item) => item.serviceId);
      const order = await createOrder.mutateAsync({
        // Amarra a comanda AO agendamento que acabou de nascer. Sem isto, criar
        // "agendamento + comanda" de uma vez deixava os dois soltos: o drawer do
        // agendamento voltava a oferecer "Abrir comanda" para algo que já tinha
        // uma, e o próximo clique gerava a segunda. Ver estudo 52.
        appointmentId: result.id,
        customerId: result.customerId,
        professionalId: primary.professionalId || undefined,
        notes: notes.trim() || undefined,
        items: validItems.map((item) => {
          const service = serviceItems.find(
            (candidate) => candidate.id === item.serviceId,
          );
          return {
            kind: 'service' as const,
            refId: item.serviceId,
            professionalId:
              item.professionalId || primary.professionalId || undefined,
            quantity: 1,
            unitPrice: Number(service?.price ?? 0),
          };
        }),
      });
      orderId = order.id;
      setCreatedOrderId(order.id);
      // Se o pai quer controlar a navegação (ex.: AgendaPage), delega e deixa
      // ele fechar o drawer; senão navega para a comanda e fecha aqui.
      if (onCreatedOrder) {
        onCreatedOrder(order.id);
      } else {
        onOpenChange(false);
        nav(`/comandas/${order.id}`);
      }
    } catch {
      // O agendamento já existe; a comanda, porém, é tudo-ou-nada.
      setSuccess(true);
      setFormError(
        orderId
          ? 'Agendamento criado. A comanda foi criada integralmente, mas não foi possível abrir sua tela.'
          : 'Agendamento criado, mas não foi possível criar a comanda.',
      );
    }
  }

  const footer = success ? (
    <Button variant="primary" onClick={() => onOpenChange(false)}>
      Fechar
    </Button>
  ) : (
    <>
      {/* Rodapé da referência: Ajuda · Cancelar · Salvar · Criar comanda
          (`belasis-reference/_structure/drawers/calendar--drawer-1.txt:237`-`:246`).

          Os DOIS botões de ação, agora também no celular — antes o verde era
          `hidden md:inline-flex` e quem agendava pelo telefone não tinha caminho
          para a comanda. `flex-wrap` no contêiner do rodapé impede que os quatro
          se atropelem em 390px. "Salvar" ainda pergunta se a comanda sai agora;
          "Criar comanda" vai direto. Ver estudo 56. */}
      {/* Ajuda abre a Central de Ajuda numa nova aba — não fecha o drawer, pra
          não perder o agendamento em andamento. */}
      <Button
        variant="outline"
        className="mr-auto hidden gap-1.5 text-muted md:inline-flex"
        onClick={() => window.open('/ajuda', '_blank', 'noopener,noreferrer')}
      >
        Ajuda <IconInfo size={15} />
      </Button>
      {/* Dica de validação mobile — só quando Salvar tá disabled */}
      {!canConfirm && !isBusy && (
        <span className="mr-auto w-full text-[11px] text-muted-ink md:hidden">
          {!primary.serviceId ? 'Escolha um serviço' : !primary.professionalId ? 'Escolha um profissional' : !slotStart ? 'Escolha um horário' : ''}
        </span>
      )}
      <Button variant="outline" className="flex-1 md:flex-none" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button variant="primary" className="flex-1 md:flex-none" isDisabled={!canConfirm} onClick={handleConfirm}>
        {isBusy ? 'Salvando…' : 'Salvar'}
      </Button>
      <Button
        variant="primary"
        className="w-full bg-success text-white hover:bg-success/90 md:w-auto"
        isDisabled={!canConfirm}
        onClick={handleComanda}
      >
        Criar comanda
      </Button>
    </>
  );

  const triggerCls = 'h-11 w-full rounded-lg border border-default-200 bg-white text-sm shadow-none';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => onOpenChange(false)}
      title="Novo agendamento"
      footer={footer}
      widthClass="sm:w-[min(1180px,94vw)]"
      fullscreen
    >
      {/* Sub-drawer: seletor de cliente (bottom-sheet, funciona em mobile). */}
      <CustomerPickerDrawer
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        search={customerSearch}
        onSearchChange={setCustomerSearch}
        items={customerItems}
        isLoading={customers.isFetching}
        selectedId={customerId}
        onPick={(c) => {
          setCustomerId(c.id);
          setSelectedCustomer({
            id: c.id,
            name: c.name,
            phone: c.phone,
            avatarUrl: c.avatarUrl ?? null,
          });
          setPickerOpen(false);
        }}
      />
      {success ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
            ✓
          </div>
          <p className="text-base font-semibold text-foreground">Agendamento criado com sucesso!</p>
          <p className="text-sm text-muted">A agenda foi atualizada.</p>
          {createdOrderId && (
            <Button
              variant="primary"
              className="mt-3 bg-success text-white hover:bg-success/90"
              onClick={() => {
                const id = createdOrderId;
                onOpenChange(false);
                nav(`/comandas/${id}`);
              }}
            >
              Abrir comanda
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* ── Rail esquerdo: avatar + busca de cliente ───────────────────
              `order-2 … lg:order-1`: no MOBILE o rail vai para DEPOIS do formulário,
              mesma inversão do ComandaDrawer.tsx:362 e do PacoteClienteAside.tsx:64.
              O rail é ILUSTRATIVO aqui — o formulário já abre com o campo "Cliente"
              (linha ~724), que é o mesmo picker do botão abaixo. Com o rail primeiro,
              "Novo agendamento" no celular começava com 120px de avatar + um segundo
              botão de busca + os blocos do cliente, e a data/serviço só apareciam
              depois de rolar. O DOM mantém o rail antes (contexto para leitor de tela). */}
          <aside className="order-2 flex shrink-0 flex-col items-center gap-4 lg:order-1 lg:w-[190px] lg:pt-1">
            {/* Antes era um <UserGlyph /> FIXO: o boneco não mudava nem depois de
                escolher o cliente. Agora reaproveita o mesmo CustomerAvatar do
                picker (foto → iniciais → boneco), então o cliente com foto aparece
                com ela aqui também. Sem cliente escolhido, o nome vazio faz o
                próprio componente cair no boneco — mesmo visual de antes. */}
            {selectedCustomerName ? (
              <CustomerAvatar
                name={selectedCustomerName}
                avatarUrl={selectedCustomerAvatarUrl}
                size={120}
              />
            ) : (
              <div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-cream text-primary/70">
                <UserGlyph />
              </div>
            )}
            {/* Busca de cliente pelo rail: abre o mesmo bottom-sheet do campo
                "Cliente" (useCustomers(customerSearch) já alimenta a lista). */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={
                'flex w-full max-w-[220px] items-center justify-center gap-1.5 truncate rounded-lg border border-default-200 bg-white px-3 py-2.5 text-center text-sm transition-colors hover:border-primary hover:text-foreground ' +
                (selectedCustomerName ? 'text-foreground' : 'text-muted')
              }
            >
              {selectedCustomerName ? (
                <span className="truncate">{selectedCustomerName}</span>
              ) : (
                <>
                  <IconSearch size={14} className="shrink-0" />
                  <span className="truncate">Busque pelo cliente</span>
                </>
              )}
            </button>

            {/* Mesma coluna do cliente do drawer de visualização (f_0062). O vídeo
                não tem nenhum quadro do "Novo agendamento" do Belasis — o que ele
                mostra (f_0153, "Novo pacote" sem cliente) é a coluna vazia, que é
                justamente o que o componente faz sem `customerId`. Sem cliente
                escolhido (inclusive no modo "criar cliente novo", em que
                `customerId` é '') ele não renderiza nem dispara request.
                `w-full` porque a aside centraliza os filhos (`items-center`).
                Sem "+ Adicionar": não há evidência de qual seria o fluxo aqui. */}
            <ClienteBlocosLaterais customerId={customerId || null} className="w-full" />
          </aside>

          {/* ── Formulário principal ───────────────────────────────────────
              `order-1 lg:order-2`: par da inversão do rail — no mobile o formulário
              é o primeiro da tela; no desktop volta para a direita. */}
          <div className="order-1 flex min-w-0 flex-1 flex-col gap-6 lg:order-2">
            {/* Linha 1: Cliente | Data | Status | Cor */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
              <Field label="Cliente" className="lg:col-span-5">
                {creatingNew ? (
                  <div className="flex flex-col gap-2">
                    <TextField value={newName} onChange={setNewName} aria-label="Nome do cliente">
                      <Input className={triggerCls} placeholder="Nome do cliente" />
                    </TextField>
                    {/* País + número: é o telefone que o WhatsApp vai usar, e o
                        placeholder antigo sugeria +1. Ver estudo 57. */}
                    <PhoneField value={newPhone} onChange={setNewPhone} ariaLabel="Telefone (WhatsApp)" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className={
                      triggerCls +
                      ' flex items-center justify-between gap-2 px-3 text-left ' +
                      (selectedCustomer ? 'text-foreground' : 'text-muted')
                    }
                  >
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="truncate">
                        {selectedCustomer?.name ?? 'Selecionar cliente'}
                      </span>
                      {selectedCustomer?.phone ? (
                        <span className="truncate text-xs text-muted">{selectedCustomer.phone}</span>
                      ) : null}
                    </span>
                    <IconChevron size={16} className="shrink-0 text-muted" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew((v) => !v);
                    setCustomerId('');
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                    setNewName('');
                    setNewPhone('');
                  }}
                  className="self-start text-xs font-medium text-gold-strong hover:underline"
                >
                  {creatingNew ? 'Buscar existente' : '+ Novo cliente'}
                </button>
              </Field>

              <Field label="Data" className="lg:col-span-2">
                <DatePicker value={date} onChange={setDate} ariaLabel="Data" />
              </Field>

              <Field label="Status" className="lg:col-span-3">
                <Select
                  aria-label="Status"
                  selectedKey={status}
                  onSelectionChange={(k) => setStatus(String(k) as AppointmentStatus)}
                >
                  <Select.Trigger className={`${triggerCls} min-h-[44px] touch-manipulation`}>
                    {/* Select.Value já renderiza a bolinha + label do item
                        selecionado (defaultChildren) — não duplicar a bolinha. */}
                    <span className="flex min-w-0 items-center gap-2">
                      <Select.Value />
                    </span>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {(Object.entries(APPOINTMENT_STATUS_LABELS) as [AppointmentStatus, string][]).map(
                        ([id, label]) => (
                          <ListBox.Item key={id} id={id} textValue={label}>
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: STATUS_COLOR[id] }}
                              />
                              {label}
                            </span>
                          </ListBox.Item>
                        ),
                      )}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>

              <Field label="Cor" className="lg:col-span-2">
                <div className="flex h-11 items-center gap-2.5 rounded-lg border border-default-200 bg-white px-3">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
                    style={{ backgroundColor: STATUS_COLOR[status] }}
                  />
                  <span className="text-sm text-muted">Padrão</span>
                </div>
              </Field>
            </div>

            {/* ── Itens do agendamento (N serviços por agendamento) ────── */}
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">Itens do agendamento</h3>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12 lg:items-end">
                  <Field label={idx === 0 ? 'Descrição' : `Item ${idx + 1}`} className="lg:col-span-5">
                    <Select
                      aria-label="Serviço"
                      selectedKey={item.serviceId || null}
                      onSelectionChange={(k) => pickService(idx, k ? String(k) : NONE)}
                    >
                      <Select.Trigger className={triggerCls}>
                        <Select.Value>
                          {({ isPlaceholder, selectedText }) =>
                            isPlaceholder ? 'Selecionar serviço' : selectedText
                          }
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {serviceItems.map((s) => (
                            <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                              {s.name} · {formatDuration(s.durationMin)} · {formatMoney(s.price)}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Field>

                  <Field label="Profissional" className="lg:col-span-3">
                    <Select
                      aria-label="Profissional"
                      selectedKey={item.professionalId || null}
                      onSelectionChange={(k) => updateItem(idx, { professionalId: k ? String(k) : NONE })}
                    >
                      <Select.Trigger className={triggerCls}>
                        <Select.Value>
                          {({ isPlaceholder, selectedText }) =>
                            isPlaceholder ? 'Selecionar profissional' : selectedText
                          }
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {professionalItems.map((p) => (
                            <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                              {p.name}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Field>

                  {/* Horário = start do agendamento; só o 1º item o define. Os
                      demais mantêm alinhamento com um espaçador no desktop. */}
                  {idx === 0 ? (
                    <Field label="Horário" className="lg:col-span-2">
                      {!canPickSlot ? (
                        <div className="flex min-h-[44px] items-center rounded-lg border border-default-200 bg-white px-3 text-sm text-muted">
                          Selecione serviço e profissional
                        </div>
                      ) : availability.isFetching ? (
                        <span className="flex min-h-[44px] items-center gap-2 text-sm text-muted">
                          <Spinner size="sm" /> Buscando horários…
                        </span>
                      ) : slots.length === 0 ? (
                        <div className="flex min-h-[44px] items-center rounded-lg border border-warning/40 bg-warning/5 px-3 text-sm text-foreground">
                          Nenhum horário disponível nesta data.
                        </div>
                      ) : (
                        <div
                          aria-label="Horários disponíveis"
                          className="flex max-h-44 flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1"
                        >
                          {slots.map((slot: AvailabilitySlot) => {
                            const selectedSlot = slot.start === slotStart;
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                aria-pressed={selectedSlot}
                                onClick={() => {
                                  setSlotStart(slot.start);
                                  setFormError(null);
                                }}
                                className={[
                                  'min-h-[44px] rounded-lg border px-3 text-sm font-medium transition-colors touch-manipulation',
                                  selectedSlot
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : slot.busy
                                      ? // Ocupado e oferecido só porque o encaixe
                                        // está ligado — precisa parecer diferente,
                                        // ou alguém marca em cima sem perceber.
                                        'border-warning/60 bg-warning/10 text-foreground hover:border-warning'
                                      : 'border-default-200 bg-white text-foreground hover:border-primary/50 hover:bg-primary/5',
                                ].join(' ')}
                                title={
                                  slot.busy
                                    ? 'Horário já ocupado — será um encaixe'
                                    : undefined
                                }
                              >
                                {formatSlotTime(slot.start)}
                                {slot.busy && (
                                  <span className="ml-1 text-xs font-normal opacity-80">
                                    (ocupado)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </Field>
                  ) : (
                    <div className="hidden lg:col-span-2 lg:block" aria-hidden />
                  )}

                  <div className="flex items-end gap-2 lg:col-span-2">
                    <Field label="Duração" className="flex-1">
                      <Select
                        aria-label="Duração"
                        selectedKey={item.durationMin ? String(item.durationMin) : null}
                        onSelectionChange={(k) => updateItem(idx, { durationMin: Number(k) || 0 })}
                      >
                        <Select.Trigger className={triggerCls}>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Duração' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {durationOptions.map((m) => (
                              <ListBox.Item key={m} id={String(m)} textValue={formatDuration(m)}>
                                {formatDuration(m)}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </Field>
                    <button
                      type="button"
                      aria-label={items.length > 1 ? 'Remover item' : 'Limpar item'}
                      title={items.length > 1 ? 'Remover item' : 'Limpar item'}
                      onClick={() => removeItem(idx)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-default-200 text-muted transition-colors hover:border-danger/40 hover:text-danger"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Belasis: "adicionar item" — nova linha de serviço na comanda. */}
              <button
                type="button"
                onClick={addItem}
                className="mt-0.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-default-300 px-3 py-2.5 text-sm font-medium text-gold-strong transition-colors hover:border-gold-strong hover:bg-cream md:w-auto md:self-start"
              >
                <span className="text-base leading-none">＋</span> Adicionar item
              </button>

              {primaryService?.description && (
                <p className="rounded-lg bg-cream px-3 py-2 text-sm text-muted">
                  {primaryService.description}
                </p>
              )}
            </div>

            {/* ── Mensagens automáticas para o cliente ────────────────────
                Antes eram três switches "Avisar…" soltos, e logo abaixo um bloco
                TAMBÉM chamado "Avisar o cliente" (que é o acompanhamento) —
                quatro rótulos parecidos para duas coisas diferentes. Agora cada
                linha diz quando sai e, ligada, mostra o texto que vai sair.
                Ver estudo 64. */}
            <AvisosDoCliente
              valores={{
                notifyConfirmation: sendConfirmation,
                notifyCancellation: sendCancellation,
                remindClient: sendReminder,
              }}
              onChange={(campo: CampoDeAviso, valor: boolean) => {
                if (campo === 'notifyConfirmation') handleSendConfirmationChange(valor);
                else if (campo === 'notifyCancellation') handleSendCancellationChange(valor);
                else handleSendReminderChange(valor);
              }}
              variaveis={variaveisDaPrevia}
            />

            {/* ── Avisar o cliente (aviso personalizado agendado) ──────────
                Distinto do lembrete fixo acima: mensagem/template + tempo (até
                segundos) + âncora + link, agendado como job atrasado no backend.
                Espelha a UX do FollowUpConfigCard (Configurações → Notificações). */}
            <div className="flex flex-col gap-4 rounded-xl border border-default-200 bg-cream/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Acompanhamento <span className="font-normal text-muted">(depois do atendimento)</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Uma mensagem sua por WhatsApp no tempo que você escolher DEPOIS
                    do atendimento — com texto pronto ou seu, e o link de reagendamento.
                    Não confunda com o lembrete, que é antes.
                  </p>
                </div>
                <AppSwitch
                  checked={warnEnabled}
                  onChange={setWarnEnabled}
                  aria-label="Acompanhamento depois do atendimento"
                />
              </div>

              {warnEnabled && (
                <div className="flex flex-col gap-5">
                  {/* Modelos prontos: preenchem a mensagem (ainda editável). */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-foreground">Modelo</span>
                    <div className="flex flex-wrap gap-1.5">
                      {FOLLOWUP_TEMPLATES.map((tpl) => {
                        const active = warnTemplateId === tpl.id && !warnMessage.trim();
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setWarnTemplateId(tpl.id);
                              setWarnMessage(tpl.message);
                            }}
                            title="Preencher a mensagem com este modelo (você ainda pode editar)"
                            className={
                              'rounded-full border px-3 py-1 text-xs transition-colors ' +
                              (active
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-default-200 bg-white text-muted hover:border-primary/50 hover:text-foreground')
                            }
                          >
                            {tpl.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mensagem editável + chips de variáveis. */}
                  <Field label="Mensagem">
                    <textarea
                      value={warnMessage}
                      onChange={(e) => setWarnMessage(e.target.value)}
                      rows={4}
                      placeholder="Escreva a mensagem ou escolha um modelo acima. Deixe em branco para usar o texto padrão."
                      className="resize-none rounded-lg border border-default-200 bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted">Variáveis:</span>
                      {WARN_VARS.map((v) => (
                        <button
                          key={v.token}
                          type="button"
                          onClick={() => setWarnMessage((m) => `${m}${v.token}`)}
                          title={v.label}
                          className="rounded-md border border-default-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-cream"
                        >
                          {v.token}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {/* Tempo (valor + unidade) e âncora do disparo. */}
                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
                    <Field label="Enviar" className="lg:col-span-3">
                      <TextField
                        value={warnDelayValue}
                        onChange={setWarnDelayValue}
                        aria-label="Quantidade de tempo do aviso"
                      >
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          className={triggerCls}
                        />
                      </TextField>
                    </Field>

                    <Field label="Unidade" className="lg:col-span-3">
                      <Select
                        aria-label="Unidade de tempo do aviso"
                        selectedKey={warnDelayUnit}
                        onSelectionChange={(k) => setWarnDelayUnit(String(k) as WarnUnit)}
                      >
                        <Select.Trigger className={triggerCls}>
                          <Select.Value>
                            {({ selectedText }) => selectedText || WARN_UNIT_LABEL[warnDelayUnit]}
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {WARN_UNIT_OPTIONS.map((u) => (
                              <ListBox.Item key={u.id} id={u.id} textValue={u.label}>
                                {u.label}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </Field>

                    <Field label="Quando" className="lg:col-span-6">
                      <Select
                        aria-label="Âncora do aviso"
                        selectedKey={warnWhen}
                        onSelectionChange={(k) => setWarnWhen(String(k) as WarnWhen)}
                      >
                        <Select.Trigger className={triggerCls}>
                          <Select.Value>
                            {({ selectedText }) => selectedText || WARN_WHEN_LABEL[warnWhen]}
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {WARN_WHEN_OPTIONS.map((w) => (
                              <ListBox.Item key={w.id} id={w.id} textValue={w.label}>
                                {w.label}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </Field>
                  </div>
                  <p className="-mt-2 text-xs text-muted">
                    Ex.: <strong>1 dia · Depois do atendimento</strong>. Use{' '}
                    <strong>segundos</strong> para testar o disparo rápido.
                  </p>

                  {/* Link de reagendamento. */}
                  <InlineToggle
                    checked={warnIncludeLink}
                    onChange={setWarnIncludeLink}
                    label="Incluir link de reagendamento"
                  />
                </div>
              )}
            </div>

            {/* ── Além deste, repetir mais ─────────────────────────────── */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
              <Field label="Além deste, repetir mais" className="lg:col-span-5">
                <Select
                  aria-label="Além deste, repetir mais"
                  selectedKey={freq}
                  onSelectionChange={(k) => setFreq((k ? String(k) : 'none') as Freq)}
                >
                  <Select.Trigger className={triggerCls}>
                    <Select.Value>
                      {({ selectedText }) => selectedText || 'Agendamento não se repete'}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {FREQ_OPTIONS.map((f) => (
                        <ListBox.Item key={f.id} id={f.id} textValue={f.label}>
                          {f.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>

              {freq !== 'none' && (
                <Field label="Repetições" className="lg:col-span-3">
                  <Select
                    aria-label="Repetir mais"
                    selectedKey={String(repeatMore)}
                    onSelectionChange={(k) => setRepeatMore(Number(k) || 1)}
                  >
                    <Select.Trigger className={triggerCls}>
                      <Select.Value>
                        {({ selectedText }) => selectedText || '1 vez'}
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                          <ListBox.Item key={n} id={String(n)} textValue={`${n} ${n === 1 ? 'vez' : 'vezes'}`}>
                            {n} {n === 1 ? 'vez' : 'vezes'}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>
              )}
            </div>

            {/* ── Observações ──────────────────────────────────────────── */}
            <Field label="Observações">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Escreva aqui"
                className="resize-none rounded-lg border border-default-200 bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
              />
            </Field>

            {formError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/**
 * Sub-drawer bottom-sheet para escolher um cliente existente. Aparece por cima
 * do drawer de Novo agendamento (portal + z-index maior) e funciona 100% em
 * mobile — resolve o caso em que o <Select> do HeroUI não abre o popover
 * dentro de outro bottom-sheet.
 */
function CustomerPickerDrawer({
  isOpen,
  onClose,
  search,
  onSearchChange,
  items,
  isLoading,
  selectedId,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  items: Customer[];
  isLoading: boolean;
  selectedId: string;
  onPick: (c: Customer) => void;
}) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar cliente"
      placement="bottom"
      widthClass="sm:w-[520px]"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Digite para buscar"
            aria-label="Buscar cliente"
            autoFocus
            className="h-11 w-full rounded-lg border border-default-200 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
          />
        </div>

        {isLoading && items.length === 0 && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner size="sm" /> Buscando clientes…
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-default-200 px-3 py-6 text-center text-sm text-muted">
            {search.trim() ? 'Nenhum cliente encontrado.' : 'Digite para buscar um cliente.'}
          </div>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-default-200 rounded-lg border border-default-200 bg-white">
            {items.map((c) => {
              const isSelected = c.id === selectedId;
              // Sem cast: `Customer` já declara avatarUrl no pacote compartilhado.
              const avatarUrl = c.avatarUrl;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cream ' +
                      (isSelected ? 'bg-cream' : '')
                    }
                  >
                    <CustomerAvatar name={c.name} avatarUrl={avatarUrl} />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      {c.phone ? (
                        <span className="truncate text-xs text-muted">{c.phone}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
