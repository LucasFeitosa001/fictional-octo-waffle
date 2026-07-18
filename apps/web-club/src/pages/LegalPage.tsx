import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@gravity-ui/icons';

/**
 * Static legal pages (Privacy Policy / Terms of Service) for the Salonpass
 * booking club. These exist mainly so the Google OAuth consent screen can point
 * at public, resolvable URLs (https://agenda.salonpass.com.br/privacidade and
 * /termos) — a requirement for publishing the "Continuar com Google" flow.
 * Content is platform-level (Salonpass), in pt-BR, and intentionally generic.
 */
const CONTACT_EMAIL = 'contato@salonpass.com.br';
const LAST_UPDATED = '9 de junho de 2026';

type LegalKind = 'privacy' | 'terms';

const PRIVACY: Section[] = [
  {
    title: '1. Quais dados coletamos',
    body: [
      'Coletamos os dados que você fornece ao criar sua conta e ao agendar: nome, e-mail, telefone e, quando você entra com o Google, o nome e o e-mail associados à sua Conta Google.',
      'Também registramos informações dos seus agendamentos (serviço, profissional, data e horário) para que o salão possa atendê-lo.',
    ],
  },
  {
    title: '2. Como usamos seus dados',
    body: [
      'Usamos seus dados para criar e gerenciar sua conta, processar e confirmar agendamentos, enviar avisos sobre seus horários (por e-mail e/ou WhatsApp) e melhorar o serviço.',
      'Não vendemos seus dados pessoais.',
    ],
  },
  {
    title: '3. Compartilhamento',
    body: [
      'Seus dados de agendamento são compartilhados com o salão em que você agenda, para que ele realize o atendimento.',
      'Podemos usar provedores de tecnologia (hospedagem, envio de e-mail e mensagens) que processam dados em nosso nome, sob obrigações de confidencialidade.',
    ],
  },
  {
    title: '4. Login com Google',
    body: [
      'Ao usar "Continuar com Google", recebemos apenas seu nome e e-mail básicos do perfil, para identificar sua conta. Não acessamos seus contatos, e-mails ou outros dados da sua Conta Google.',
    ],
  },
  {
    title: '5. Seus direitos',
    body: [
      'Você pode acessar, corrigir ou solicitar a exclusão dos seus dados a qualquer momento, conforme a Lei Geral de Proteção de Dados (LGPD).',
      `Para exercer esses direitos, fale conosco em ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: '6. Contato',
    body: [`Dúvidas sobre esta política? Entre em contato em ${CONTACT_EMAIL}.`],
  },
];

const TERMS: Section[] = [
  {
    title: '1. Sobre o serviço',
    body: [
      'O Salonpass é uma plataforma que permite agendar serviços de beleza em salões parceiros. O atendimento é prestado pelo salão escolhido; o Salonpass intermedeia o agendamento.',
    ],
  },
  {
    title: '2. Sua conta',
    body: [
      'Você é responsável por manter a confidencialidade do acesso à sua conta e pelas informações que fornece. Mantenha seus dados de contato atualizados para receber avisos sobre seus agendamentos.',
    ],
  },
  {
    title: '3. Agendamentos, cancelamentos e remarcações',
    body: [
      'Ao agendar, você concorda em comparecer no horário marcado. O salão pode confirmar, recusar ou sugerir outro horário para o seu pedido.',
      'Políticas de cancelamento, atraso e remarcação podem variar conforme o salão. O pagamento, quando aplicável, é realizado diretamente com o salão.',
    ],
  },
  {
    title: '4. Uso adequado',
    body: [
      'Você concorda em não usar a plataforma para fins ilícitos, nem realizar agendamentos falsos ou abusivos.',
    ],
  },
  {
    title: '5. Limitação de responsabilidade',
    body: [
      'O Salonpass não se responsabiliza pela qualidade ou execução dos serviços prestados pelos salões, que são de responsabilidade exclusiva de cada estabelecimento.',
    ],
  },
  {
    title: '6. Alterações',
    body: [
      'Podemos atualizar estes termos periodicamente. O uso contínuo da plataforma após mudanças significa concordância com a versão vigente.',
    ],
  },
  {
    title: '7. Contato',
    body: [`Dúvidas sobre estes termos? Entre em contato em ${CONTACT_EMAIL}.`],
  },
];

interface Section {
  title: string;
  body: string[];
}

export function LegalPage({ kind, backTo }: { kind: LegalKind; backTo: string }) {
  const navigate = useNavigate();
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Política de Privacidade' : 'Termos de Serviço';
  const sections = isPrivacy ? PRIVACY : TERMS;

  return (
    <div className="club-page flex flex-col">
      <header className="club-topbar sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-3 md:py-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label="Voltar"
            className="club-touch grid place-items-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft width={22} height={22} />
          </button>
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass"
            className="h-6 w-auto sm:h-7"
          />
        </div>
      </header>

      <main className="club-page-main mx-auto w-full max-w-3xl flex-1 py-7 sm:py-10">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-pink)]">Transparência e segurança</span>
        <h1 className="mt-2 font-brand text-2xl text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">Última atualização: {LAST_UPDATED}</p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:gap-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
              <h2 className="font-semibold text-foreground">{s.title}</h2>
              <div className="mt-2 flex flex-col gap-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-7 text-muted sm:text-sm sm:leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-[#111111] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-semibold">Ainda tem alguma dúvida?</p>
            <p className="mt-1 text-sm text-white/60">Fale diretamente com a equipe Salonpass.</p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#f2b33d] px-4 py-2 text-sm font-semibold text-[#111111] sm:mt-0">
            Entrar em contato
          </a>
        </div>
      </main>
    </div>
  );
}
