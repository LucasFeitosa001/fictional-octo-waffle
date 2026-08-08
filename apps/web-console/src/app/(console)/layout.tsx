'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { pode, useSessao } from '@/lib/sessao';
import { Carregando } from '@/components/Estados';
import type { Capacidade } from '@/lib/types';

const NAVEGACAO: Array<{ href: string; rotulo: string; exige?: Capacidade }> = [
  { href: '/', rotulo: 'Visão geral' },
  { href: '/usuarios', rotulo: 'Usuários', exige: 'usuarios:ver' },
  { href: '/saloes', rotulo: 'Salões', exige: 'saloes:ver' },
  { href: '/tecnicos', rotulo: 'Técnicos', exige: 'tecnicos:ver' },
  { href: '/auditoria', rotulo: 'Auditoria', exige: 'auditoria:ver' },
];

export default function LayoutConsole({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const { sessao } = useSessao();

  useEffect(() => {
    if (sessao.estado === 'anonimo') router.replace('/entrar');
    else if (sessao.estado === 'autenticado' && sessao.tecnico.mustChangePassword) {
      router.replace('/trocar-senha');
    }
  }, [sessao, router]);

  if (sessao.estado !== 'autenticado') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Carregando texto="Verificando sessão…" />
      </main>
    );
  }

  const { tecnico } = sessao;
  const itens = NAVEGACAO.filter((i) => !i.exige || pode(tecnico, i.exige));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-[var(--color-hairline)] p-4 md:block">
        <div className="mb-6">
          <div className="rotulo">SalonPass</div>
          <div className="text-sm font-semibold">Console</div>
        </div>

        <nav className="space-y-0.5">
          {itens.map((item) => {
            const ativo =
              item.href === '/' ? caminho === '/' : caminho.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-2.5 py-1.5 text-sm ${
                  ativo
                    ? 'bg-[var(--color-raised)] text-[var(--color-ink)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
                aria-current={ativo ? 'page' : undefined}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-[var(--color-hairline)] pt-4">
          <div className="truncate text-sm">{tecnico.nome}</div>
          <div className="mono truncate text-[var(--color-dim)]">{tecnico.email}</div>
          <div className="mt-1 rotulo">{tecnico.rotuloPapel}</div>
          <button
            type="button"
            className="botao mt-3 w-full"
            onClick={async () => {
              await api.post('/platform/auth/logout').catch(() => undefined);
              router.replace('/entrar');
            }}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Navegação em telas estreitas: a lateral some, mas o console precisa
          continuar navegável no notebook pequeno do plantão. */}
      <div className="min-w-0 flex-1">
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-hairline)] px-3 py-2 md:hidden">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded px-2.5 py-1.5 text-sm text-[var(--color-muted)]"
            >
              {item.rotulo}
            </Link>
          ))}
        </div>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
