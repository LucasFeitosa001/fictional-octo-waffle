'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tecnico } from '@/lib/types';

type RespostaLogin = { staff: Tecnico; expiraEm: string; trocarSenha: boolean };

/**
 * Entrada do console. Ver estudo 135.
 *
 * Não diz se o e-mail existe — a API já devolve a mesma mensagem para conta
 * inexistente, senha errada e conta desativada, e a tela não desfaz isso.
 */
export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Quem já tem sessão viva não precisa ver esta tela.
  useEffect(() => {
    api
      .get<Tecnico>('/platform/auth/me')
      .then((t) => router.replace(t.mustChangePassword ? '/trocar-senha' : '/'))
      .catch(() => undefined);
  }, [router]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api.post<RespostaLogin>('/platform/auth/login', { email, senha });
      router.replace(r.trocarSenha ? '/trocar-senha' : '/');
    } catch (erroLogin) {
      setErro(erroLogin instanceof Error ? erroLogin.message : 'Não foi possível entrar.');
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="rotulo">SalonPass</div>
          <h1 className="mt-1 text-2xl font-semibold">Console de suporte</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Acesso restrito à equipe. Toda ação feita aqui fica registrada com seu nome.
          </p>
        </div>

        <form onSubmit={entrar} className="painel space-y-4 p-5">
          <label className="block">
            <span className="rotulo">E-mail</span>
            <input
              className="campo mt-1"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              disabled={enviando}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="rotulo">Senha</span>
            <input
              className="campo mt-1"
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              disabled={enviando}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>

          {erro ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {erro}
            </p>
          ) : null}

          <button type="submit" className="botao botao-primario w-full" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
