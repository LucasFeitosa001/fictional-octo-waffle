'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, query } from '@/lib/api';
import { formatarDataCurta } from '@/lib/sessao';
import { Busca } from '@/components/Campo';
import { Carregando, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Paginacao, Tabela, type Coluna } from '@/components/Tabela';
import type { Pagina, SalaoLista } from '@/lib/types';

export default function Saloes() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState('');
  const [pagina, setPagina] = useState(1);

  const lista = useQuery({
    queryKey: ['saloes', busca, ativo, pagina],
    queryFn: () =>
      api.get<Pagina<SalaoLista>>(
        `/platform/saloes${query({ busca, ativo, pagina, porPagina: 25 })}`,
      ),
  });

  const colunas: Coluna<SalaoLista>[] = [
    {
      chave: 'salao',
      titulo: 'Salão',
      render: (s) => (
        <div className="min-w-0">
          <div className="truncate">{s.name}</div>
          {s.legalName ? (
            <div className="truncate text-xs text-[var(--color-dim)]">{s.legalName}</div>
          ) : null}
        </div>
      ),
    },
    {
      chave: 'plano',
      titulo: 'Plano',
      largura: '10rem',
      render: (s) => {
        const a = s.subscriptions[0];
        if (!a) return <span className="text-[var(--color-dim)]">sem assinatura</span>;
        return (
          <div>
            <div className="text-[var(--color-muted)]">{a.plan.name}</div>
            <Selo tom={a.status === 'active' ? 'ok' : a.status === 'canceled' ? 'perigo' : 'apagado'}>
              {a.status}
            </Selo>
          </div>
        );
      },
    },
    {
      chave: 'tamanho',
      titulo: 'Equipe / clientes',
      largura: '9rem',
      alinhar: 'direita',
      render: (s) => (
        <span className="tabular-nums text-[var(--color-muted)]">
          {s._count.users} / {s._count.customers}
        </span>
      ),
    },
    {
      chave: 'estado',
      titulo: 'Estado',
      largura: '8rem',
      render: (s) =>
        s.active ? <Selo tom="ok">ativo</Selo> : <Selo tom="perigo">desativado</Selo>,
    },
    {
      chave: 'criado',
      titulo: 'Criado',
      largura: '7rem',
      alinhar: 'direita',
      render: (s) => (
        <span className="text-xs text-[var(--color-dim)]">{formatarDataCurta(s.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Salões</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Busque por nome, razão social, CNPJ, identificador — ou pelo e-mail de quem trabalha lá.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Busca
          valor={texto}
          aoMudar={setTexto}
          aoBuscar={() => {
            setBusca(texto.trim());
            setPagina(1);
          }}
          placeholder="Nome, CNPJ, ID ou e-mail de um usuário"
        />
        <select
          className="campo sm:w-44"
          value={ativo}
          aria-label="Filtrar por estado"
          onChange={(e) => {
            setAtivo(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todos os estados</option>
          <option value="true">Ativos</option>
          <option value="false">Desativados</option>
        </select>
      </div>

      <div className="painel">
        {lista.isLoading ? <Carregando /> : null}
        {lista.error ? (
          <div className="p-4">
            <Erro mensagem={(lista.error as Error).message} aoTentar={() => lista.refetch()} />
          </div>
        ) : null}
        {lista.data && lista.data.data.length === 0 ? (
          <Vazio titulo="Nenhum salão encontrado." />
        ) : null}
        {lista.data && lista.data.data.length > 0 ? (
          <>
            <Tabela
              colunas={colunas}
              linhas={lista.data.data}
              chaveDe={(s) => s.id}
              aoClicar={(s) => router.push(`/saloes/detalhe/?id=${encodeURIComponent(s.id)}`)}
            />
            <Paginacao
              pagina={lista.data.pagina}
              porPagina={lista.data.porPagina}
              total={lista.data.total}
              aoMudar={setPagina}
            />
          </>
        ) : null}
      </div>
      <p className="text-xs text-[var(--color-dim)]">
        <Mono>Equipe / clientes</Mono> conta logins com acesso ao salão e fichas de cliente
        cadastradas.
      </p>
    </div>
  );
}
