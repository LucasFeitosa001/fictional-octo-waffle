import { useNavigate } from 'react-router-dom';
import { Calendar, Bell, Person, Scissors, ShieldCheck, ArrowRight } from '@gravity-ui/icons';

/**
 * Public, login-free institutional landing for Salonpass. Exists primarily so the
 * Google OAuth consent screen has a verifiable homepage that (a) is reachable
 * without authentication and (b) clearly states what the app does — the two
 * things Google's brand verification flagged on the bare booking portal. Content
 * is platform-level (Salonpass), pt-BR, and links out to the legal pages.
 */
const FEATURES: { icon: typeof Calendar; title: string; body: string }[] = [
  {
    icon: Calendar,
    title: 'Agende em segundos',
    body: 'Escolha o serviço, o profissional e o horário pelo link do seu salão — sem ligações, a qualquer hora.',
  },
  {
    icon: Bell,
    title: 'Lembretes no WhatsApp',
    body: 'Você recebe a confirmação e os avisos do seu horário direto no WhatsApp, para nunca esquecer.',
  },
  {
    icon: Person,
    title: 'Entre com o Google',
    body: 'Crie sua conta em um toque com "Continuar com Google" e acompanhe seus agendamentos.',
  },
  {
    icon: Scissors,
    title: 'Feito para o salão',
    body: 'Salões parceiros gerenciam agenda, profissionais e serviços em um painel simples e completo.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="club-topbar sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <img src="/brand/salonpass-wordmark-white.svg" alt="Salonpass" className="h-7 w-auto" />
          <a
            href="#agendar"
            className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink shadow-gold transition-transform hover:-translate-y-0.5"
          >
            Agendar
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-5xl px-5 pb-16 pt-14 text-center sm:pt-20">
            <span className="inline-flex items-center gap-2 rounded-full border border-soft-border bg-warm-white px-4 py-1.5 text-xs font-medium text-muted-ink shadow-card">
              <Scissors width={14} height={14} className="text-pink" />
              Plataforma de agendamento para salões de beleza
            </span>
            <h1 className="font-brand mx-auto mt-6 max-w-3xl text-4xl leading-[1.08] text-ink sm:text-5xl">
              Seu próximo horário no salão,{' '}
              <span className="bg-gradient-to-r from-pink to-gold-strong bg-clip-text text-transparent">
                a um toque de distância
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-ink">
              O Salonpass conecta você aos seus salões favoritos. Agende serviços de beleza online,
              receba lembretes no WhatsApp e tenha tudo organizado em um só lugar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                id="agendar"
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-warm-white shadow-pop transition-transform hover:-translate-y-0.5"
              >
                Como funciona
                <ArrowRight width={16} height={16} />
              </a>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Abrir um salão
              </button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="como-funciona" className="mx-auto max-w-5xl px-5 py-12">
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-soft-border bg-warm-white p-6 shadow-card"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-pink">
                  <f.icon width={22} height={22} />
                </div>
                <h2 className="font-brand mt-4 text-lg text-ink">{f.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-ink">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For salons */}
        <section className="mx-auto max-w-5xl px-5 pb-12">
          <div className="overflow-hidden rounded-2xl bg-ink p-8 text-warm-white shadow-pop sm:p-10">
            <div className="flex items-center gap-2 text-gold">
              <ShieldCheck width={18} height={18} />
              <span className="text-xs font-semibold uppercase tracking-wide">Para salões</span>
            </div>
            <h2 className="font-brand mt-3 max-w-xl text-2xl text-warm-white sm:text-3xl">
              Uma agenda inteligente para o seu salão
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-beige-deep">
              Gerencie horários, profissionais e serviços, receba agendamentos online e confirme
              tudo pelo WhatsApp. O Salonpass cuida da agenda para você focar no atendimento.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-soft-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <img src="/brand/salonpass-wordmark.svg" alt="Salonpass" className="h-6 w-auto" />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-ink">
            <button type="button" onClick={() => navigate('/privacidade')} className="hover:text-ink">
              Privacidade
            </button>
            <button type="button" onClick={() => navigate('/termos')} className="hover:text-ink">
              Termos
            </button>
            <a href="mailto:contato@salonpass.com.br" className="hover:text-ink">
              contato@salonpass.com.br
            </a>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-ink">
          © {new Date().getFullYear()} Salonpass — plataforma de agendamento para salões de beleza.
        </p>
      </footer>
    </div>
  );
}
