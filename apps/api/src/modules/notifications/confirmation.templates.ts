export const NOTIFICATION_CONFIRMATION_TEMPLATES_KEY =
  'notifications.confirmationTemplates';

export const CONFIRMATION_TEMPLATE_VARIABLES = [
  'cliente',
  'quando',
  'hora',
  'hora_curta',
  'servico',
  'estabelecimento',
] as const;

export interface ConfirmationTemplate {
  id: string;
  label: string;
  message: string;
  builtIn: boolean;
}

export interface ConfirmationTemplateSettings {
  defaultTemplateId: string;
  templates: ConfirmationTemplate[];
}

export interface ConfirmationTemplateVariables {
  cliente: string;
  quando: string;
  hora: string;
  hora_curta: string;
  servico: string;
  estabelecimento: string;
}

export interface ConfirmationTemplateData {
  companyName: string;
  timezone: string;
  customerName: string | null;
  serviceNames: string[];
  start: Date;
}

export const BUILTIN_CONFIRMATION_TEMPLATES: readonly ConfirmationTemplate[] = [
  {
    id: 'carinhoso-la-belle',
    label: 'Carinhoso (La Belle de Jour)',
    message: [
      'Olá, {cliente}! 💕',
      'Seu horário foi marcado com sucesso para {quando} às {hora}, para o serviço de {servico}.',
      '',
      'Agradecemos a preferência, é sempre um prazer tê-la conosco e cuidar da sua beleza. ✨',
      '',
      'Nos vemos {quando} às {hora_curta} ✨🌸💖',
    ].join('\n'),
    builtIn: true,
  },
] as const;

export const DEFAULT_CONFIRMATION_TEMPLATE_ID =
  BUILTIN_CONFIRMATION_TEMPLATES[0].id;

function dateParts(date: Date, timezone: string): {
  year: string;
  month: string;
  day: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return { year: read('year'), month: read('month'), day: read('day') };
}

function localDayNumber(date: Date, timezone: string): number {
  const parts = dateParts(date, timezone);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  );
}

function whenLabel(start: Date, now: Date, timezone: string): string {
  const dayDiff = Math.round(
    (localDayNumber(start, timezone) - localDayNumber(now, timezone)) /
      86_400_000,
  );
  if (dayDiff === 0) return 'hoje';
  if (dayDiff === 1) return 'amanhã';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(start);
}

function timeLabels(
  start: Date,
  timezone: string,
): { hora: string; horaCurta: string } {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(start);
  const hour = Number(
    parts.find((part) => part.type === 'hour')?.value ?? '0',
  );
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  if (minute === '00') {
    return { hora: `${hour} horas`, horaCurta: `${hour}hrs` };
  }
  return { hora: `${hour}h${minute}`, horaCurta: `${hour}h${minute}` };
}

function serviceList(names: string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return 'seu atendimento';
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} e ${clean.at(-1)}`;
}

export function confirmationTemplateVariables(
  data: ConfirmationTemplateData,
  now = new Date(),
): ConfirmationTemplateVariables {
  const timezone = data.timezone || 'America/Sao_Paulo';
  const time = timeLabels(data.start, timezone);
  return {
    cliente: data.customerName?.trim().split(/\s+/)[0] || 'cliente',
    quando: whenLabel(data.start, now, timezone),
    hora: time.hora,
    hora_curta: time.horaCurta,
    servico: serviceList(data.serviceNames),
    estabelecimento: data.companyName.trim() || 'salão',
  };
}

export function renderConfirmationTemplate(
  template: string,
  variables: ConfirmationTemplateVariables,
): string {
  let rendered = template;
  for (const variable of CONFIRMATION_TEMPLATE_VARIABLES) {
    rendered = rendered.replace(
      new RegExp(`\\{${variable}\\}`, 'g'),
      variables[variable],
    );
  }
  return rendered.trim();
}

export function unresolvedConfirmationVariables(message: string): string[] {
  return [
    ...new Set(
      [...message.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1].trim()),
    ),
  ];
}
