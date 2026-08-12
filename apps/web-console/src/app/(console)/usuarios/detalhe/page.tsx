'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { acaoSensivel, formatarData, pode, rotuloAcao, useSessao } from '@/lib/sessao';
import { Carregando, Dado, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Confirmacao, SegredoDeUmaVez, type PedidoConfirmacao } from '@/components/Confirmacao';
import type { Tecnico, UsuarioDetalhe } from '@/lib/types';

type Segredo = { titulo: string; valor: string; detalhe?: string };

function Conteudo() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const cliente = useQueryClient();
  const { sessao } = useSessao();
  const tecnico: Tecnico | null = sessao.estado === 'autenticado' ? sessao.tecnico : null;

  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const [segredo, setSegredo] = useState<Segredo | null>(null);

  const consulta = useQuery({
    queryKey: ['usuario', id],
    queryFn: () => api.get<UsuarioDetalhe>(`/platform/usuarios/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });

  function recarregar() {
    void cliente.invalidateQueries({ queryKey: ['usuario', id] });
    void cliente.invalidateQueries({ queryKey: ['usuarios'] });
    void cliente.invalidateQueries({ queryKey: ['auditoria'] });
  }

  if (!id) return <Vazio titulo="Nenhum usuário indicado." detalhe="Volte e escolha uma conta." />;
  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) {
    return <Erro mensagem={(consulta.error as Error).message} aoTentar={() => consulta.refetch()} />;
  }
  const u = consulta.data;
  if (!u) return <Vazio titulo="Conta não encontrada." />;

  const oauth = u.accounts.filter((c) => c.providerId !== 'credential');
  const temCredencial = u.accounts.some((c) => c.providerId === 'credential');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/usuarios" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            ← Usuários
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
            {u.name}
            {u.active ? <Selo tom="ok">ativa</Selo> : <Selo tom="perigo">desativada</Selo>}
          </h1>
          <Mono>{u.email}</Mono>
        </div>
      </div>

      {/* ── Ações ─────────────────────────────────────────────────────────── */}
      <section className="painel p-4">
        <h2 className="rotulo">Ações</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {pode(tecnico, 'usuarios:email') ? (
            <button
              type="button"
              className="botao"
              onClick={() =>
                setPedido({
                  titulo: 'Alterar e-mail',
                  descricao: (
                    <>
                      O login passa a ser o endereço novo. As sessões abertas desta conta são
                      encerradas.
                    </>
                  ),
                  rotuloAcao: 'Alterar e-mail',
                  exigeJustificativa: true,
                  campo: {
                    rotulo: 'Novo e-mail',
                    tipo: 'email',
                    valorInicial: u.email,
                    obrigatorio: true,
                  },
                  executar: async ({ motivo, valor }) => {
                    await api.post(`/platform/usuarios/${u.id}/email`, {
                      email: valor,
                      reason: motivo,
                    });
                    recarregar();
                  },
                })
              }
            >
              Alterar e-mail
            </button>
          ) : null}

          {pode(tecnico, 'usuarios:senha') ? (
            <button
              type="button"
              className="botao"
              onClick={() =>
                setPedido({
                  titulo: 'Resetar senha',
                  descricao: (
                    <>
                      Gera uma senha temporária e encerra as sessões abertas. Ela aparece{' '}
                      <strong className="text-[var(--color-ink)]">uma única vez</strong> na tela
                      seguinte.
                      {!temCredencial ? (
                        <span className="mt-2 block text-[var(--color-danger)]">
                          Esta conta hoje só entra por login social. O reset cria um acesso por
                          senha.
                        </span>
                      ) : null}
                    </>
                  ),
                  rotuloAcao: 'Resetar senha',
                  exigeJustificativa: true,
                  executar: async ({ motivo }) => {
                    const r = await api.post<{ senhaTemporaria?: string }>(
                      `/platform/usuarios/${u.id}/senha`,
                      { reason: motivo },
                    );
                    recarregar();
                    if (r.senhaTemporaria) {
                      setSegredo({
                        titulo: 'Senha temporária',
                        valor: r.senhaTemporaria,
                        detalhe: `Passe para ${u.email} por um canal seguro e peça que troque no primeiro acesso.`,
                      });
                    }
                  },
                })
              }
            >
              Resetar senha
            </button>
          ) : null}

          {pode(tecnico, 'usuarios:sessoes') ? (
            <button
              type="button"
              className="botao"
              disabled={u.sessions.length === 0}
              onClick={() =>
                setPedido({
                  titulo: 'Encerrar sessões',
                  descricao: `Derruba ${u.sessions.length} sessão(ões) aberta(s). A pessoa precisa entrar de novo.`,
                  rotuloAcao: 'Encerrar sessões',
                  exigeJustificativa: true,
                  executar: async ({ motivo }) => {
                    await api.post(`/platform/usuarios/${u.id}/encerrar-sessoes`, { reason: motivo });
                    recarregar();
                  },
                })
              }
            >
              Encerrar sessões ({u.sessions.length})
            </button>
          ) : null}

          {pode(tecnico, 'usuarios:ativar') ? (
            <button
              type="button"
              className={u.active ? 'botao botao-perigo' : 'botao'}
              onClick={() =>
                setPedido({
                  titulo: u.active ? 'Desativar conta' : 'Reativar conta',
                  descricao: u.active
                    ? 'A pessoa perde o acesso na hora e as sessões abertas caem.'
                    : 'A pessoa volta a conseguir entrar.',
                  rotuloAcao: u.active ? 'Desativar' : 'Reativar',
                  perigosa: u.active,
                  exigeJustificativa: true,
                  executar: async ({ motivo }) => {
                    await api.post(`/platform/usuarios/${u.id}/ativo`, {
                      ativo: !u.active,
                      reason: motivo,
                    });
                    recarregar();
                  },
                })
              }
            >
              {u.active ? 'Desativar conta' : 'Reativar conta'}
            </button>
          ) : null}

          {pode(tecnico, 'usuarios:personificar') && u.active ? (
            <button
              type="button"
              className="botao botao-perigo"
              onClick={() =>
                setPedido({
                  titulo: 'Entrar como este usuário',
                  descricao: (
                    <>
                      Abre uma sessão do painel do salão em nome de {u.name}, válida por 30 minutos.
                      Ela fica marcada como sessão de suporte e tudo que você fizer aparece como
                      ação dessa pessoa.
                    </>
                  ),
                  rotuloAcao: 'Gerar acesso',
                  perigosa: true,
                  exigeJustificativa: true,
                  executar: async ({ motivo }) => {
                    const r = await api.post<{ token: string; expiraEm: string }>(
                      `/platform/usuarios/${u.id}/personificar`,
                      { reason: motivo },
                    );
                    recarregar();
                    setSegredo({
                      titulo: 'Token de acesso de suporte',
                      valor: r.token,
                      detalhe: `Use como Bearer na API do salão. Expira em ${formatarData(r.expiraEm)}.`,
                    });
                  },
                })
              }
            >
              Entrar como
            </button>
          ) : null}
        </div>
      </section>

      {/* ── Cadastro ──────────────────────────────────────────────────────── */}
      <section className="painel p-4">
        <h2 className="rotulo">Cadastro</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dado rotulo="Identificador">
            <Mono>{u.id}</Mono>
          </Dado>
          <Dado rotulo="Telefone">{u.phone || '—'}</Dado>
          <Dado rotulo="Tipo de conta">
            {u.accountType === 'customer' ? 'Cliente do portal' : 'Equipe do salão'}
          </Dado>
          <Dado rotulo="Salão principal">
            {u.company ? (
              <Link
                href={`/saloes/detalhe/?id=${encodeURIComponent(u.company.id)}`}
                className="underline underline-offset-2"
              >
                {u.company.name}
              </Link>
            ) : (
              '—'
            )}
          </Dado>
          <Dado rotulo="Criada em">{formatarData(u.createdAt)}</Dado>
          <Dado rotulo="Alterada em">{formatarData(u.updatedAt)}</Dado>
        </div>
      </section>

      {/* ── Acessos ───────────────────────────────────────────────────────── */}
      <section className="painel p-4">
        <h2 className="rotulo">Meios de acesso</h2>
        <div className="mt-3 space-y-2">
          {u.accounts.length === 0 ? (
            <p className="text-sm text-[var(--color-danger)]">
              Nenhum meio de acesso. Esta conta não consegue entrar — um reset de senha resolve.
            </p>
          ) : null}
          {u.accounts.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--color-hairline)] pb-2 last:border-0"
            >
              <span className="text-sm">
                {c.providerId === 'credential' ? 'Senha' : `Login social · ${c.providerId}`}
              </span>
              <span className="text-xs text-[var(--color-dim)]">
                desde {formatarData(c.createdAt)}
              </span>
              {c.providerId !== 'credential' && pode(tecnico, 'usuarios:desvincular-oauth') ? (
                <button
                  type="button"
                  className="botao botao-perigo ml-auto px-2 py-1"
                  disabled={u.accounts.length <= 1}
                  title={
                    u.accounts.length <= 1
                      ? 'É o único meio de acesso da conta.'
                      : undefined
                  }
                  onClick={() =>
                    setPedido({
                      titulo: `Desvincular ${c.providerId}`,
                      descricao: 'A pessoa deixa de conseguir entrar por esse provedor.',
                      rotuloAcao: 'Desvincular',
                      perigosa: true,
                      exigeJustificativa: true,
                      executar: async ({ motivo }) => {
                        await api.post(`/platform/usuarios/${u.id}/desvincular-oauth`, {
                          providerId: c.providerId,
                          reason: motivo,
                        });
                        recarregar();
                      },
                    })
                  }
                >
                  Desvincular
                </button>
              ) : null}
            </div>
          ))}
          {oauth.length === 0 && temCredencial ? (
            <p className="text-xs text-[var(--color-dim)]">Sem login social vinculado.</p>
          ) : null}
        </div>
      </section>

      {/* ── Vínculos ──────────────────────────────────────────────────────── */}
      <section className="painel p-4">
        <h2 className="rotulo">Salões em que trabalha</h2>
        {u.userCompanies.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhum vínculo.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {u.userCompanies.map((v) => (
              <li key={v.companyId} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/saloes/detalhe/?id=${encodeURIComponent(v.companyId)}`}
                  className="underline underline-offset-2"
                >
                  {v.company.name}
                </Link>
                {v.role ? <Selo tom="apagado">{v.role.name}</Selo> : null}
                {!v.company.active ? <Selo tom="perigo">salão desativado</Selo> : null}
                {v.permissions.length > 0 ? (
                  <span className="text-xs text-[var(--color-dim)]">
                    {v.permissions.length} permissão(ões) específica(s)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Sessões ───────────────────────────────────────────────────────── */}
      <section className="painel p-4">
        <h2 className="rotulo">Sessões abertas</h2>
        {u.sessions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhuma sessão aberta.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {u.sessions.map((s) => (
              <li key={s.id} className="border-b border-[var(--color-hairline)] pb-2 text-sm last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Mono>{s.ipAddress || 'IP desconhecido'}</Mono>
                  {s.impersonatedByStaffId ? <Selo tom="perigo">sessão de suporte</Selo> : null}
                  <span className="ml-auto text-xs text-[var(--color-dim)]">
                    expira {formatarData(s.expiresAt)}
                  </span>
                </div>
                {s.userAgent ? (
                  <div className="mt-0.5 truncate text-xs text-[var(--color-dim)]">{s.userAgent}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Histórico ─────────────────────────────────────────────────────── */}
      <section className="painel">
        <h2 className="rotulo border-b border-[var(--color-hairline)] px-4 py-3">
          O que o suporte já fez nesta conta
        </h2>
        {u.historico.length === 0 ? (
          <Vazio titulo="Nenhuma ação registrada." />
        ) : (
          <ul>
            {u.historico.map((r) => (
              <li
                key={r.id}
                className="border-b border-[var(--color-hairline)] px-4 py-2.5 text-sm last:border-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className={acaoSensivel(r.action) ? 'text-[var(--color-danger)]' : ''}>
                    {rotuloAcao(r.action)}
                  </span>
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

      <Confirmacao
        pedido={pedido}
        aoFechar={() => {
          setPedido(null);
        }}
      />
      {segredo ? (
        <SegredoDeUmaVez
          titulo={segredo.titulo}
          valor={segredo.valor}
          detalhe={segredo.detalhe}
          aoFechar={() => setSegredo(null)}
        />
      ) : null}
    </div>
  );
}

export default function DetalheUsuario() {
  // `useSearchParams` obriga a fronteira de Suspense na exportação estática.
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo />
    </Suspense>
  );
}
