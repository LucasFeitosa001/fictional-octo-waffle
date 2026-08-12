/**
 * Console de suporte da SalonPass — papéis, capacidades e verbos de auditoria.
 * Ver estudo 135.
 *
 * Este arquivo é a fonte única de "quem pode o quê". O guard lê daqui, e o
 * frontend lê daqui (via /platform/auth/me) para esconder o que o técnico não
 * pode fazer. Uma lista só evita o clássico de a interface esconder o botão e a
 * rota continuar aberta.
 */

export type PlatformRole = 'support' | 'engineer' | 'owner';

export type PlatformCapability =
  // Usuários de salão
  | 'usuarios:ver'
  | 'usuarios:email'
  | 'usuarios:senha'
  | 'usuarios:sessoes'
  | 'usuarios:desvincular-oauth'
  | 'usuarios:ativar'
  | 'usuarios:personificar'
  // Salões
  | 'saloes:ver'
  | 'saloes:ativar'
  // Técnicos da SalonPass
  | 'tecnicos:ver'
  | 'tecnicos:gerir'
  // Trilha
  | 'auditoria:ver';

/**
 * Capacidades por papel, CUMULATIVO de baixo para cima.
 *
 * A divisória entre `support` e `engineer` é deliberada: o suporte resolve o
 * problema do dia a dia (não consigo entrar, e-mail errado) sem nunca conseguir
 * desligar um salão nem entrar como outra pessoa. Essas duas ações mudam o que o
 * cliente vê ou pode fazer, e por isso exigem um degrau a mais.
 */
const SUPORTE: PlatformCapability[] = [
  'usuarios:ver',
  'usuarios:email',
  'usuarios:senha',
  'usuarios:sessoes',
  'usuarios:desvincular-oauth',
  'saloes:ver',
  'auditoria:ver',
];

const ENGENHARIA: PlatformCapability[] = [
  ...SUPORTE,
  'usuarios:ativar',
  'usuarios:personificar',
  'saloes:ativar',
];

const DONO: PlatformCapability[] = [...ENGENHARIA, 'tecnicos:ver', 'tecnicos:gerir'];

export const CAPACIDADES_POR_PAPEL: Record<PlatformRole, PlatformCapability[]> = {
  support: SUPORTE,
  engineer: ENGENHARIA,
  owner: DONO,
};

export function capacidadesDe(papel: PlatformRole): PlatformCapability[] {
  return CAPACIDADES_POR_PAPEL[papel] ?? [];
}

export function podeFazer(papel: PlatformRole, capacidade: PlatformCapability): boolean {
  return capacidadesDe(papel).includes(capacidade);
}

/** Rótulos exibidos na interface. */
export const ROTULO_PAPEL: Record<PlatformRole, string> = {
  support: 'Suporte',
  engineer: 'Engenharia',
  owner: 'Administração',
};

// =====================================================================
// Verbos de auditoria
// =====================================================================

export const ACOES = {
  loginOk: 'sessao.login',
  loginRecusado: 'sessao.login_recusado',
  logout: 'sessao.logout',
  senhaPropriaAlterada: 'sessao.senha_alterada',

  usuarioEmailAlterado: 'usuario.email_alterado',
  usuarioSenhaResetada: 'usuario.senha_resetada',
  usuarioSessoesEncerradas: 'usuario.sessoes_encerradas',
  usuarioDesativado: 'usuario.desativado',
  usuarioReativado: 'usuario.reativado',
  usuarioOauthDesvinculado: 'usuario.oauth_desvinculado',
  usuarioPersonificado: 'usuario.personificado',

  salaoDesativado: 'salao.desativado',
  salaoReativado: 'salao.reativado',

  tecnicoCriado: 'tecnico.criado',
  tecnicoAlterado: 'tecnico.alterado',
  tecnicoDesativado: 'tecnico.desativado',
  tecnicoReativado: 'tecnico.reativado',
  tecnicoSenhaResetada: 'tecnico.senha_resetada',
  tecnicoSessoesEncerradas: 'tecnico.sessoes_encerradas',
} as const;

export type PlatformAction = (typeof ACOES)[keyof typeof ACOES];

/**
 * Ações que EXIGEM justificativa escrita.
 *
 * Toda mutação sobre a conta de um cliente entra aqui. O motivo é auditoria
 * útil, não burocracia: seis meses depois, "resetou a senha da fulana" sem
 * contexto não permite julgar se o acesso foi legítimo. O campo é o que
 * transforma a trilha em prova.
 *
 * Fora da lista ficam só os atos do técnico sobre a própria conta (login,
 * logout, troca da própria senha), onde não há terceiro afetado.
 */
export const ACOES_COM_JUSTIFICATIVA: ReadonlySet<string> = new Set<string>([
  ACOES.usuarioEmailAlterado,
  ACOES.usuarioSenhaResetada,
  ACOES.usuarioSessoesEncerradas,
  ACOES.usuarioDesativado,
  ACOES.usuarioReativado,
  ACOES.usuarioOauthDesvinculado,
  ACOES.usuarioPersonificado,
  ACOES.salaoDesativado,
  ACOES.salaoReativado,
]);

/** Justificativa curta demais não é justificativa. */
export const JUSTIFICATIVA_MINIMA = 10;

// =====================================================================
// Sessão do console
// =====================================================================

/** Nome do cookie. Prefixo próprio para nunca colidir com o do Better Auth. */
export const COOKIE_SESSAO = 'sp_console_session';

/**
 * Prazo ABSOLUTO: a sessão morre 12h depois de nascer, mesmo em uso contínuo.
 * Um turno de trabalho; renovar exige digitar a senha de novo.
 */
export const SESSAO_DURACAO_MS = 12 * 60 * 60 * 1000;

/**
 * Prazo OCIOSO: 30 min sem requisição derruba. O console fica aberto em máquina
 * compartilhada e dá acesso a todos os salões — o custo de reautenticar é baixo
 * perto do de uma aba esquecida.
 */
export const SESSAO_OCIOSA_MS = 30 * 60 * 1000;

/**
 * `lastSeenAt` só é regravado quando passou disto. Sem essa folga, TODA
 * requisição do console viraria um UPDATE — o que transformaria a tabela de
 * sessão no gargalo de escrita da API.
 */
export const SESSAO_TOQUE_MINIMO_MS = 60 * 1000;

// =====================================================================
// Trava de força bruta
// =====================================================================

/**
 * Uma senha adivinhada aqui alcança TODOS os salões de uma vez, então a trava é
 * mais dura que a de um login comum: 5 tentativas, 15 min de bloqueio.
 */
export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;

/** Senha do técnico: mais longa que a de salão, pelo mesmo motivo. */
export const SENHA_MINIMA = 12;

/** Personificação é curta por desenho: tempo de reproduzir um problema. */
export const PERSONIFICACAO_DURACAO_MS = 30 * 60 * 1000;
