'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatarData, pode, useSessao } from '@/lib/sessao';
import { Campo } from '@/components/Campo';
import { Carregando, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Confirmacao, SegredoDeUmaVez, type PedidoConfirmacao } from '@/components/Confirmacao';
import { Tabela, type Coluna } from '@/components/Tabela';
import type { Papel, Tecnico, TecnicoLista } from '@/lib/types';

type PapelCatalogo = { codigo: Papel; rotulo: string; capacidades: string[] };
type Segredo = { titulo: string; valor: string; detalhe?: string };

export default function Tecnicos() {
  const cliente = useQueryClient();
  const { sessao } = useSessao();
  const eu: Tecnico | null = sessao.estado === 'autenticado' ? sessao.tecnico : null;
  const podeGerir = pode(eu, 'tecnicos:gerir');

  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const [segredo, setSegredo] = useState<Segredo | null>(null);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('support');
  const [erroForm, setErroForm] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ['tecnicos'],
    queryFn: () => api.get<{ data: TecnicoLista[] }>('/platform/tecnicos'),
  });

  const papeis = useQuery({
    queryKey: ['tecnicos', 'papeis'],
    queryFn: () => api.get<PapelCatalogo[]>('/platform/tecnicos/papeis'),
  });

  function recarregar() {
    void cliente.invalidateQueries({ queryKey: ['tecnicos'] });
    void cliente.invalidateQueries({ queryKey: ['auditoria'] });
  }

  const criar = useMutation({
    mutationFn: () =>
      api.post<TecnicoLista & { senhaTemporaria?: string }>('/platform/tecnicos', {
        nome,
        email,
        papel,
      }),
    onSuccess: (r) => {
      recarregar();
      setCriando(false);
      setNome('');
      setEmail('');
      setPapel('support');
      setErroForm(null);
      if (r.senhaTemporaria) {
        setSegredo({
          titulo: 'Senha temporária do técnico',
          valor: r.senhaTemporaria,
          detalhe: `Passe para ${r.email} por um canal seguro. A troca é obrigatória no primeiro acesso.`,
        });
      }
    },
    onError: (e) => setErroForm(e instanceof Error ? e.message : 'Não foi possível criar.'),
  });

  const colunas: Coluna<TecnicoLista>[] = [
    {
      chave: 'pessoa',
      titulo: 'Técnico',
      render: (t) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate">{t.name}</span>
            {t.id === eu?.id ? <Selo tom="apagado">você</Selo> : null}
          </div>
          <Mono>{t.email}</Mono>
        </div>
      ),
    },
    {
      chave: 'papel',
      titulo: 'Perfil',
      largura: '9rem',
      render: (t) => <Selo>{t.rotuloPapel}</Selo>,
    },
    {
      chave: 'estado',
      titulo: 'Estado',
      largura: '12rem',
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.active ? <Selo tom="ok">ativo</Selo> : <Selo tom="perigo">desativado</Selo>}
          {t.mustChangePassword ? <Selo tom="perigo">senha pendente</Selo> : null}
          {t.lockedUntil && new Date(t.lockedUntil) > new Date() ? (
            <Selo tom="perigo">bloqueado</Selo>
          ) : null}
          {t.sessoesAtivas > 0 ? <Selo tom="apagado">{t.sessoesAtivas} sessão(ões)</Selo> : null}
        </div>
      ),
    },
    {
      chave: 'acesso',
      titulo: 'Último acesso',
      largura: '10rem',
      render: (t) => (
        <span className="text-xs text-[var(--color-dim)]">{formatarData(t.lastLoginAt)}</span>
      ),
    },
    {
      chave: 'acoes',
      titulo: '',
      largura: '1%',
      alinhar: 'direita',
      render: (t) =>
        podeGerir ? (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="botao px-2 py-1"
              onClick={() =>
                setPedido({
                  titulo: `Resetar senha de ${t.name}`,
                  descricao:
                    'Gera uma senha temporária, destrava a conta e encerra as sessões abertas dele.',
                  rotuloAcao: 'Resetar senha',
                  perigosa: true,
                  exigeJustificativa: false,
                  executar: async () => {
                    const r = await api.post<{ senhaTemporaria: string }>(
                      `/platform/tecnicos/${t.id}/senha`,
                    );
                    recarregar();
                    setSegredo({
                      titulo: `Senha temporária de ${t.name}`,
                      valor: r.senhaTemporaria,
                      detalhe: 'A troca é obrigatória no próximo acesso dele.',
                    });
                  },
                })
              }
            >
              Resetar senha
            </button>
            {t.id !== eu?.id ? (
              <button
                type="button"
                className={t.active ? 'botao botao-perigo px-2 py-1' : 'botao px-2 py-1'}
                onClick={() =>
                  setPedido({
                    titulo: t.active ? `Desativar ${t.name}` : `Reativar ${t.name}`,
                    descricao: t.active
                      ? 'Perde o acesso ao console na hora e as sessões abertas caem.'
                      : 'Volta a conseguir entrar no console.',
                    rotuloAcao: t.active ? 'Desativar' : 'Reativar',
                    perigosa: t.active,
                    exigeJustificativa: false,
                    executar: async ({ motivo }) => {
                      await api.post(`/platform/tecnicos/${t.id}/ativo`, {
                        ativo: !t.active,
                        reason: motivo || undefined,
                      });
                      recarregar();
                    },
                  })
                }
              >
                {t.active ? 'Desativar' : 'Reativar'}
              </button>
            ) : null}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Técnicos</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Quem tem acesso a este console. Contas separadas das de salão.
          </p>
        </div>
        {podeGerir ? (
          <button type="button" className="botao botao-primario" onClick={() => setCriando((v) => !v)}>
            {criando ? 'Cancelar' : 'Novo técnico'}
          </button>
        ) : null}
      </div>

      {criando ? (
        <form
          className="painel space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Nome">
              <input
                className="campo"
                required
                minLength={2}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </Campo>
            <Campo rotulo="E-mail">
              <input
                className="campo"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Perfil">
              <select
                className="campo"
                value={papel}
                onChange={(e) => setPapel(e.target.value as Papel)}
              >
                {(papeis.data ?? []).map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {papeis.data ? (
            <div className="text-xs text-[var(--color-muted)]">
              <span className="rotulo">O que este perfil pode</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {papeis.data
                  .find((p) => p.codigo === papel)
                  ?.capacidades.map((c) => (
                    <Selo key={c} tom="apagado">
                      {c}
                    </Selo>
                  ))}
              </div>
            </div>
          ) : null}

          {erroForm ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {erroForm}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="botao botao-primario" disabled={criar.isPending}>
              {criar.isPending ? 'Criando…' : 'Criar técnico'}
            </button>
          </div>
          <p className="text-[0.6875rem] text-[var(--color-dim)]">
            A senha temporária aparece uma única vez depois de criar, e a troca é obrigatória no
            primeiro acesso.
          </p>
        </form>
      ) : null}

      <div className="painel">
        {lista.isLoading ? <Carregando /> : null}
        {lista.error ? (
          <div className="p-4">
            <Erro mensagem={(lista.error as Error).message} aoTentar={() => lista.refetch()} />
          </div>
        ) : null}
        {lista.data && lista.data.data.length === 0 ? <Vazio titulo="Nenhum técnico." /> : null}
        {lista.data && lista.data.data.length > 0 ? (
          <Tabela colunas={colunas} linhas={lista.data.data} chaveDe={(t) => t.id} />
        ) : null}
      </div>

      <Confirmacao pedido={pedido} aoFechar={() => setPedido(null)} />
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
