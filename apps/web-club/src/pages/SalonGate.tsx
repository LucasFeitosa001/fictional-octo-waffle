import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { Magnifier } from '@gravity-ui/icons';

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
    <div className="club-page flex flex-col bg-[#111111]">
      <header className="px-5 pb-12 pt-[calc(1.25rem+env(safe-area-inset-top))] text-white sm:pb-16">
        <div className="mx-auto w-full max-w-md">
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass"
            className="h-7 w-auto object-contain"
          />
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#f2b33d]">
            Agendamento online
          </p>
          <h1 className="mt-2 max-w-sm font-brand text-3xl leading-tight text-white sm:text-4xl">
            Encontre seu salão e agende em poucos toques.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            Cole o link compartilhado pelo salão ou informe apenas o nome que aparece no final dele.
          </p>
        </div>
      </header>

      <main className="-mt-6 flex flex-1 rounded-t-[28px] bg-[#f7f3ea] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-7 sm:rounded-t-[36px]">
        <Card className="mx-auto h-fit w-full max-w-md border border-[var(--color-soft-border)] bg-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-5 px-5 py-6 sm:px-7 sm:py-8">
            <div>
              <h2 className="font-brand text-xl text-foreground">Abrir página do salão</h2>
              <p className="mt-1 text-sm text-muted">Você não precisa criar uma conta para consultar horários.</p>
            </div>
          <form className="flex w-full flex-col gap-3" onSubmit={go}>
            <TextField value={slug} onChange={setSlug} isRequired>
              <Label>Link ou identificador do salão</Label>
              <Input placeholder="ex.: salao-da-samya" autoCapitalize="none" autoCorrect="off" />
            </TextField>
            <Button type="submit" variant="primary" className="min-h-12 gap-1.5">
              <Magnifier width={18} height={18} />
              Abrir agendamento
            </Button>
          </form>
          </Card.Content>
        </Card>
      </main>
    </div>
  );
}
