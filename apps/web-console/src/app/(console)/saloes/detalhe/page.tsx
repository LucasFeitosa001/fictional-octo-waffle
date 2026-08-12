'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { acaoSensivel, formatarData, pode, rotuloAcao, useSessao } from '@/lib/sessao';
import { Carregando, Dado, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Confirmacao, type PedidoConfirmacao } from '@/components/Confirmacao';
import type { SalaoDetalhe, Tecnico } from '@/lib/types';

function Conteudo() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const cliente = useQueryClient();
  const { sessao } = useSessao();
  const tecnico: Tecnico | null = sessao.estado === 'autenticado' ? sessao.tecnico : null;
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);

  const consulta = useQuery({
    queryKey: ['salao', id],
    queryFn: () => api.get<SalaoDetalhe>(`/platform/saloes/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });

  if (!id) return <Vazio titulo="Nenhum salão indicado." />;
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) {
    return <Erro mensagem={(consulta.error as Error).message} aoTentar={() => consulta.refetch()} />;
  }
  const s = consulta.data;
  if (!s) return <Vazio titulo="Salão não encontrado." />;

  const assinatura = s.subscriptions[0];
  const endereco = (s.addressJson ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/saloes" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← Salões
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
          {s.name}
          {s.active ? <Selo tom="ok">ativo</Selo> : <Selo tom="perigo">desativado</Selo>}
        </h1>
        <Mono>{s.id}</Mono>
      </div>

      {pode(tecnico, 'saloes:ativar') ? (
        <section className="painel p-4">
          <h2 className="rotulo">Ações</h2>
          <div className="mt-3">
            <button
              type="button"
              className={s.active ? 'botao botao-perigo' : 'botao'}
              onClick={() =>
                setPedido({
                  titulo: s.active ? 'Desativar salão' : 'Reativar salão',
                  descricao: s.active ? (
                    <>
                      Todo mundo que trabalha neste salão perde o acesso na hora — as{' '}
                      {s._count.users} conta(s) vinculada(s) têm as sessões encerradas.
                    </>
                  ) : (
                    'O salão e sua equipe voltam a funcionar normalmente.'
                  ),
                  rotuloAcao: s.active ? 'Desativar salão' : 'Reativar salão',
                  perigosa: s.active,
                  exigeJustificativa: true,
                  executar: async ({ motivo }) => {
                    await api.post(`/platform/saloes/${s.id}/ativo`, {
                      ativo: !s.active,
                      reason: motivo,
                    });
                    void cliente.invalidateQueries({ queryKey: ['salao', id] });
                    void cliente.invalidateQueries({ queryKey: ['saloes'] });
                    void cliente.invalidateQueries({ queryKey: ['auditoria'] });
                  },
                })
              }
            >
              {s.active ? 'Desativar salão' : 'Reativar salão'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="painel p-4">
        <h2 className="rotulo">Cadastro</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dado rotulo="Razão social">{s.legalName || '—'}</Dado>
          <Dado rotulo="CNPJ">{s.cnpj || '—'}</Dado>
          <Dado rotulo="Fuso">{s.timezone}</Dado>
          <Dado rotulo="Telefone">{endereco.phone || '—'}</Dado>
          <Dado rotulo="E-mail de contato">{endereco.email || '—'}</Dado>
          <Dado rotulo="Cidade">
            {endereco.city ? `${endereco.city}${endereco.state ? ` / ${endereco.state}` : ''}` : '—'}
          </Dado>
          <Dado rotulo="Criado em">{formatarData(s.createdAt)}</Dado>
          <Dado rotulo="Plano">
            {assinatura ? `${assinatura.plan.name} · ${assinatura.status}` : 'sem assinatura'}
          </Dado>
          <Dado rotulo="Ciclo até">
            {assinatura?.currentPeriodEnd ? formatarData(assinatura.currentPeriodEnd) : '—'}
          </Dado>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ['Equipe', s._count.users],
              ['Clientes', s._count.customers],
              ['Profissionais', s._count.professionals],
              ['Serviços', s._count.services],
              ['Unidades', s._count.branches],
            ] as const
          ).map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded border border-[var(--color-hairline)] p-2.5">
              <div className="rotulo">{rotulo}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{valor}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="painel p-4">
        <h2 className="rotulo">Quem tem acesso</h2>
        {s.membros.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhum vínculo.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {s.membros.map((m) => (
              <li
                key={m.user.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--color-hairline)] pb-2 text-sm last:border-0"
              >
                <Link
                  href={`/usuarios/detalhe/?id=${encodeURIComponent(m.user.id)}`}
                  className="underline underline-offset-2"
                >
                  {m.user.name}
                </Link>
                <Mono>{m.user.email}</Mono>
                {m.role ? <Selo tom="apagado">{m.role.name}</Selo> : null}
                {!m.user.active ? <Selo tom="perigo">conta desativada</Selo> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {s.featureFlags.length > 0 ? (
        <section className="painel p-4">
          <h2 className="rotulo">Recursos ligados</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.featureFlags.map((f) => (
              <Selo key={f.key} tom={f.enabled ? 'ok' : 'apagado'}>
                {f.key}
              </Selo>
            ))}
          </div>
        </section>
      ) : null}

      <section className="painel">
        <h2 className="rotulo border-b border-[var(--color-hairline)] px-4 py-3">
          O que o suporte já fez neste salão
        </h2>
        {s.historico.length === 0 ? (
          <Vazio titulo="Nenhuma ação registrada." />
        ) : (
          <ul>
            {s.historico.map((r) => (
              <li
                key={r.id}
                className="border-b border-[var(--color-hairline)] px-4 py-2.5 text-sm last:border-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className={acaoSensivel(r.action) ? 'text-[var(--color-danger)]' : ''}>
                    {rotuloAcao(r.action)}
                  </span>
                  {r.targetLabel ? <Mono>{r.targetLabel}</Mono> : null}
                  <span className="ml-auto text-xs text-[var(--color-dim)]">
                    {r.staffEmail} · {formatarData(r.at)}
                  </span>
                </div>
                {r.reason ? (
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">{r.reason}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmacao pedido={pedido} aoFechar={() => setPedido(null)} />
    </div>
  );
}

export default function DetalheSalao() {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
