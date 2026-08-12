import { createAuthClient } from 'better-auth/react';
import { AUTH_BASE_URL } from './config';

/**
 * Better Auth client for the club app (cookie-based session, same as web).
 * Customers sign up with accountType: 'customer' so they never get a Company.
 */
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
});

export const { useSession, signIn, signUp, signOut } = authClient;

/**
 * Sessão de quem está agendando.
 *
 * ANTES (estudos 117/119): o portal só aceitava `accountType === 'customer'`,
 * porque dividia o cookie de `.salonpass.com.br` com o painel — um dono logado
 * na Gestão aparecia logado aqui sem nunca ter entrado, então a tela precisava
 * anular aquela sessão e explicar o motivo (`ehStaff`).
 *
 * AGORA (estudo 120): o portal tem instância de auth e cookie PRÓPRIOS. Estar
 * logado aqui virou um ato explícito de quem entrou nesta tela, então não há
 * mais o que filtrar — e filtrar atrapalhava de verdade, porque o e-mail é
 * único no sistema: quem é staff de um salão não conseguia agendar em nenhum
 * outro, nem abrir conta de cliente com o mesmo endereço.
 *
 * `ehStaff`/`emailDaConta` continuam no retorno, sempre neutros, para não
 * quebrar quem os lê; podem sair quando os call sites forem limpos.
 */
export function useCustomerSession() {
  const session = useSession();
  return { ...session, ehStaff: false, emailDaConta: null };
}
