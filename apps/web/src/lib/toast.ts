import { ApiClientError } from '@beautypass/shared';

/**
 * Avisos do painel — implementação PRÓPRIA. Ver estudo 138.
 *
 * Substituiu o toast do HeroUI, que evaporava em ~0,3s dentro do fluxo real
 * (medido quadro a quadro no vídeo do dono cancelando um agendamento com
 * comanda aberta), mesmo recebendo `timeout: 4000` — a opção certa, que a lib
 * respeita. A fila do HeroUI envolve cada atualização em
 * `document.startViewTransition`, e não havia como desligar isso: o
 * `ToastProvider` aceita uma `queue`, mas a função global `toast()` continuaria
 * na interna, e metade dos avisos iria para cada fila.
 *
 * A API foi mantida de propósito (`toast.success/danger/info/warning`), então
 * as ~30 chamadas espalhadas em 13 arquivos seguem funcionando sem alteração.
 *
 *   import { toast } from '@/lib/toast';
 *   toast.success('Cliente salvo');
 *   toast.danger('Não foi possível salvar');
 */

export type TipoAviso = 'success' | 'danger' | 'info' | 'warning';

/** Botão opcional do aviso (ex.: "Abrir" no link copiado). */
export interface AcaoAviso {
  children: string;
  onPress: () => void;
}

export interface OpcoesAviso {
  /** ms; 0 = fica até fechar. Erro, por padrão, usa TOAST_TIMEOUT_ERRO. */
  timeout?: number;
  /** Segunda linha, menor (o link copiado, o corpo da notificação). */
  description?: string;
  /** Mesmo nome que o HeroUI usava, para as chamadas não mudarem. */
  actionProps?: AcaoAviso;
}

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  mensagem: string;
  description?: string;
  actionProps?: AcaoAviso;
}

/** Duração padrão (ms). ~4s conforme a UX pedida. */
export const TOAST_TIMEOUT = 4000;

/**
 * Erro fica MUITO mais tempo que sucesso.
 *
 * Sucesso é confirmação — 4s bastam para "Agendamento confirmado.". Erro quase
 * sempre é INSTRUÇÃO, e às vezes longa: a recusa de cancelar um agendamento com
 * comanda diz o número dela, a situação e o que fazer antes (~120 caracteres).
 */
export const TOAST_TIMEOUT_ERRO = 12000;

let sequencia = 0;
let avisos: Aviso[] = [];
const inscritos = new Set<(lista: Aviso[]) => void>();
const timers = new Map<number, number>();

function publicar() {
  const copia = [...avisos];
  inscritos.forEach((fn) => fn(copia));
}

/** Assina a lista de avisos. Devolve a função de cancelar (para o useEffect). */
export function assinarAvisos(fn: (lista: Aviso[]) => void): () => void {
  inscritos.add(fn);
  fn([...avisos]);
  return () => {
    inscritos.delete(fn);
  };
}

export function fecharAviso(id: number): void {
  const t = timers.get(id);
  if (t) {
    window.clearTimeout(t);
    timers.delete(id);
  }
  avisos = avisos.filter((a) => a.id !== id);
  publicar();
}

/**
 * Empilha um aviso.
 *
 * `timeout: 0` (ou erro, por padrão) = fica até a pessoa fechar. Erro é
 * instrução; quem decide quando terminou de ler é quem está lendo.
 */
function empilhar(tipo: TipoAviso, mensagem: string, opcoes?: OpcoesAviso): number {
  const id = ++sequencia;
  const padrao = tipo === 'danger' ? TOAST_TIMEOUT_ERRO : TOAST_TIMEOUT;
  const ms = opcoes?.timeout ?? padrao;

  // No máximo 3 na tela: acima disso a pilha vira ruído e esconde o conteúdo.
  avisos = [
    ...avisos,
    { id, tipo, mensagem, description: opcoes?.description, actionProps: opcoes?.actionProps },
  ].slice(-3);
  publicar();

  if (ms > 0) {
    timers.set(id, window.setTimeout(() => fecharAviso(id), ms));
  }
  return id;
}

/** Mesma superfície do toast do HeroUI, para as chamadas existentes. */
export const toast = {
  success: (mensagem: string, opcoes?: OpcoesAviso) => empilhar('success', mensagem, opcoes),
  danger: (mensagem: string, opcoes?: OpcoesAviso) => empilhar('danger', mensagem, opcoes),
  info: (mensagem: string, opcoes?: OpcoesAviso) => empilhar('info', mensagem, opcoes),
  warning: (mensagem: string, opcoes?: OpcoesAviso) => empilhar('warning', mensagem, opcoes),
};

/**
 * Extrai uma mensagem humana de um erro de API. `ApiError.message` pode vir como
 * string ou string[] (validação do Nest), então normalizamos ambos.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const bodyMsg = error.body?.message;
    if (Array.isArray(bodyMsg) && bodyMsg.length > 0) return bodyMsg[0];
    if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
    if (error.message && error.message.trim()) return error.message;
    return 'Não foi possível concluir a operação';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Ocorreu um erro inesperado';
}

/**
 * Handler global de erro para mutations. Ligado no `MutationCache` do
 * QueryClient (src/main.tsx), cobrindo TODAS as mutations de uma vez.
 */
export function toastMutationError(error: unknown): void {
  toast.danger(apiErrorMessage(error));
}

/** Erro avulso (fora de mutation). */
export function toastError(message: string): string {
  return String(toast.danger(message));
}

/** Atalho para avisos de sucesso com a duração padrão do app. */
export function toastSuccess(message: string): string {
  return String(toast.success(message));
}
