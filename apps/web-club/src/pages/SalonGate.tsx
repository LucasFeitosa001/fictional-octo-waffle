import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { Calendar, CircleCheck, Magnifier, Person, Tag } from '@gravity-ui/icons';

const BOOKING_STEPS = [
  { label: 'Serviço', icon: Tag },
  { label: 'Profissional', icon: Person },
  { label: 'Horário', icon: Calendar },
  { label: 'Confirmar', icon: CircleCheck },
] as const;

/**
 * Shown when no salon slug is configured/in the URL. Lets the customer open a
 * salon's booking page by its link (slug). The slug is the BookingLink the salon
 * shares with its clients.
 */
export function SalonGate() {
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const s = slug.trim().replace(/^.*\//, '');
    if (s) navigate(`/${encodeURIComponent(s)}`);
  }

  return (
    <div className="club-page flex flex-col">
      <header className="club-topbar sticky top-0 z-20 border-b border-white/10">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass"
            className="h-6 w-auto object-contain"
          />
          <span className="rounded-lg bg-[#FCE4EA] px-2.5 py-1 text-[11px] font-semibold text-[#A84065]">
            Para clientes
          </span>
        </div>
      </header>

      <main className="club-page-main mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 py-6 sm:py-10">
        <section className="mx-auto w-full max-w-xl text-center">
          <span className="inline-flex items-center rounded-full bg-[#FCE4EA] px-3 py-1 text-xs font-semibold text-[#B84F70]">
            Seu próximo horário começa aqui
          </span>
          <h1 className="mt-3 font-brand text-2xl leading-tight text-foreground sm:text-4xl">
            Encontre seu salão e escolha o melhor horário.
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Cole o link compartilhado pelo estabelecimento ou informe o identificador que aparece no final dele.
          </p>
        </section>

        <div className="club-scroll-row mx-auto flex w-full max-w-xl gap-2 overflow-x-auto pb-1">
          {BOOKING_STEPS.map(({ label, icon: Icon }, index) => (
            <div
              key={label}
              className="flex min-w-[124px] flex-1 items-center gap-2 rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5 text-left shadow-[var(--shadow-soft)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FCE4EA] text-[#B84F70]">
                <Icon width={16} height={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Passo {index + 1}
                </span>
                <span className="block truncate text-xs font-semibold text-foreground">{label}</span>
              </span>
            </div>
          ))}
        </div>

        <Card className="mx-auto h-fit w-full max-w-xl border border-[var(--color-soft-border)] bg-white shadow-[var(--shadow-card)]">
          <Card.Content className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
            <div>
              <h2 className="font-brand text-lg text-foreground">Abrir salão</h2>
              <p className="mt-0.5 text-xs text-muted">Consulte serviços e horários sem criar conta.</p>
            </div>
            <span className="hidden text-xs font-medium text-[#378251] sm:block">Sem cadastro obrigatório</span>
            <form className="flex w-full flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-end" onSubmit={go}>
              <TextField value={slug} onChange={setSlug} isRequired className="min-w-0 flex-1">
                <Label>Link ou identificador do salão</Label>
                <Input placeholder="ex.: salao-da-samya" autoCapitalize="none" autoCorrect="off" />
              </TextField>
              <Button type="submit" variant="primary" className="min-h-11 shrink-0 gap-1.5 sm:px-5">
                <Magnifier width={18} height={18} />
                Abrir salão
              </Button>
            </form>
          </Card.Content>
        </Card>
      </main>
    </div>
  );
}
