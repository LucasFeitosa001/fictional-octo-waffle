'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Tecnico } from '@/lib/types';

const MINIMA = 12;

/**
 * Troca obrigatória da senha temporária. Ver estudo 135.
 *
 * É a única rota que responde enquanto `mustChangePassword` está pendente — o
 * guard da API barra todo o resto. Repetimos aqui a política do servidor só
 * para o técnico ver o que falta ANTES de enviar; quem recusa de verdade é a API.
 */
export default function TrocarSenha() {
  const router = useRouter();
  const [tecnico, setTecnico] = useState<Tecnico | null>(null);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api
      .get<Tecnico>('/platform/auth/me')
      .then(setTecnico)
      .catch(() => router.replace('/entrar'));
  }, [router]);

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(nova)).length;
  const curta = nova.length > 0 && nova.length < MINIMA;
  const poucaVariedade = nova.length > 0 && classes < 3;
  const divergem = repetida.length > 0 && nova !== repetida;
  const podeEnviar = !curta && !poucaVariedade && !divergem && nova.length > 0 && atual.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post('/platform/auth/senha', { senhaAtual: atual, senhaNova: nova });
      router.replace('/');
    } catch (erroTroca) {
      setErro(erroTroca instanceof Error ? erroTroca.message : 'Não foi possível trocar a senha.');
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="rotulo">SalonPass · Console</div>
          <h1 className="mt-1 text-2xl font-semibold">Defina sua senha</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {tecnico
              ? `A senha atual de ${tecnico.email} foi criada por outra pessoa. Escolha uma só sua para continuar.`
              : 'A senha atual foi criada por outra pessoa. Escolha uma só sua para continuar.'}
          </p>
        </div>

        <form onSubmit={enviar} className="painel space-y-4 p-5">
          <label className="block">
            <span className="rotulo">Senha atual</span>
            <input
              className="campo mt-1"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              value={atual}
              disabled={enviando}
              onChange={(e) => setAtual(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="rotulo">Senha nova</span>
            <input
              className="campo mt-1"
              type="password"
              autoComplete="new-password"
              required
              value={nova}
              disabled={enviando}
              onChange={(e) => setNova(e.target.value)}
            />
            <span className="mt-1 block text-[0.6875rem] text-[var(--color-dim)]">
              Mínimo {MINIMA} caracteres, com pelo menos três tipos entre minúscula, maiúscula,
              número e símbolo.
            </span>
            {curta ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--color-danger)]">
                Faltam {MINIMA - nova.length} caracteres.
              </span>
            ) : null}
            {poucaVariedade ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--color-danger)]">
                Use mais um tipo de caractere ({classes} de 3).
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="rotulo">Repita a senha nova</span>
            <input
              className="campo mt-1"
              type="password"
              autoComplete="new-password"
              required
              value={repetida}
              disabled={enviando}
              onChange={(e) => setRepetida(e.target.value)}
            />
            {divergem ? (
              <span className="mt-1 block text-[0.6875rem] text-[var(--color-danger)]">
                As duas não conferem.
              </span>
            ) : null}
          </label>

          {erro ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {erro}
            </p>
          ) : null}

          <button
            type="submit"
            className="botao botao-primario w-full"
            disabled={!podeEnviar || enviando}
          >
            {enviando ? 'Salvando…' : 'Salvar e entrar'}
          </button>

          <p className="text-[0.6875rem] text-[var(--color-dim)]">
            Trocar a senha encerra suas outras sessões abertas.
          </p>
        </form>
      </div>
    </main>
  );
}
