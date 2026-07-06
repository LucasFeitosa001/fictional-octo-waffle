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
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md bg-white">
        <Card.Content className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <img
            src="/brand/salonpass-wordmark.svg"
            alt="Salonpass"
            className="h-9 w-auto object-contain"
          />
          <div>
            <h1 className="font-brand text-xl text-foreground">Agende seu horário</h1>
            <p className="mt-1 text-sm text-muted">
              Digite o link do salão para começar.
            </p>
          </div>
          <form className="flex w-full flex-col gap-3" onSubmit={go}>
            <TextField value={slug} onChange={setSlug} isRequired>
              <Label className="sr-only">Link do salão</Label>
              <Input placeholder="ex.: salao-da-samya" />
            </TextField>
            <Button type="submit" variant="primary" className="gap-1.5">
              <Magnifier width={18} height={18} />
              Abrir agendamento
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
