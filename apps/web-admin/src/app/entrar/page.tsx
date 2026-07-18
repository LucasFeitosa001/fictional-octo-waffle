'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Label, Spinner, TextField } from '@heroui/react';
import { signIn, signOut, useSession } from '@/lib/auth';
import { APP_VERSION } from '@/lib/config';
import { SalonpassMark } from '@/components/Brand';

export default function EntrarPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState('admin@beautypass.dev');
  const [password, setPassword] = useState('beautypass123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A customer session (shared cookie from the club app on the same domain) is
  // not a staff login, so don't auto-redirect it into the dashboard.
  const isCustomer =
    (session?.user as { accountType?: string | null } | undefined)?.accountType === 'customer';

  // Redirect to the dashboard once a *staff* session is established.
  useEffect(() => {
    if (!isPending && session?.user && !isCustomer) router.replace('/');
  }, [isPending, session?.user, isCustomer, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn.email({ email: email.trim(), password });
    if (res.error) {
      setLoading(false);
      setError(res.error.message ?? 'Não foi possível entrar. Verifique suas credenciais.');
      return;
    }
    // Reject customer accounts: this is the staff console.
    const acct = (res.data?.user as { accountType?: string | null } | undefined)?.accountType;
    if (acct === 'customer') {
      setLoading(false);
      await signOut();
      setError('Esta conta é de cliente. Use o app do cliente para agendar.');
      return;
    }
    setLoading(false);
    router.replace('/');
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:p-6">
      <Card className="db-card w-full max-w-md shadow-2xl shadow-black/60">
        <Card.Header className="flex flex-col items-center gap-3 px-5 pt-8 sm:pt-9">
          <SalonpassMark size={46} />
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-brand text-lg font-semibold tracking-tight text-white">
              Salonpass Gestão
            </span>
            <span className="eyebrow text-muted">Seu estilo. Seu passo à frente.</span>
          </div>
        </Card.Header>
        <Card.Content className="px-5 py-6 sm:px-8">
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <TextField value={email} onChange={setEmail} type="email" isRequired autoComplete="email">
              <Label>E-mail</Label>
              <Input placeholder="voce@salão.com" />
            </TextField>

            <TextField
              value={password}
              onChange={setPassword}
              type="password"
              isRequired
              autoComplete="current-password"
            >
              <Label>Senha</Label>
              <Input placeholder="••••••••" />
            </TextField>

            {error && (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" variant="primary" isDisabled={loading} className="mt-2 min-h-12 w-full">
              {loading ? <Spinner size="sm" /> : 'Entrar'}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer className="justify-center pb-6 text-xs text-muted">{APP_VERSION}</Card.Footer>
      </Card>
    </div>
  );
}
