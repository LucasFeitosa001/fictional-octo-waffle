'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, query } from '@/lib/api';
import { formatarDataCurta } from '@/lib/sessao';
import { Busca } from '@/components/Campo';
import { Carregando, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Paginacao, Tabela, type Coluna } from '@/components/Tabela';
import type { Pagina, UsuarioLista } from '@/lib/types';

export default function Usuarios() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState('');
  const [tipo, setTipo] = useState('');
  const [pagina, setPagina] = useState(1);

  const lista = useQuery({
    queryKey: ['usuarios', busca, ativo, tipo, pagina],
    queryFn: () =>
      api.get<Pagina<UsuarioLista>>(
        `/platform/usuarios${query({ busca, ativo, accountType: tipo, pagina, porPagina: 25 })}`,
      ),
  });

  const colunas: Coluna<UsuarioLista>[] = [
    {
      chave: 'pessoa',
      titulo: 'Pessoa',
      render: (u) => (
        <div className="min-w-0">
          <div className="truncate">{u.name}</div>
          <Mono>{u.email}</Mono>
        </div>
      ),
    },
    {
      chave: 'salao',
      titulo: 'Salão',
      render: (u) =>
        u.company ? (
          <div className="min-w-0">
            <div className="truncate text-[var(--color-muted)]">{u.company.name}</div>
            {!u.company.active ? <Selo tom="perigo">salão desativado</Selo> : null}
          </div>
        ) : (
          <span className="text-[var(--color-dim)]">—</span>
        ),
    },
    {
      chave: 'tipo',
      titulo: 'Tipo',
      largura: '7rem',
      render: (u) => (
        <Selo tom="apagado">{u.accountType === 'customer' ? 'cliente' : 'equipe'}</Selo>
      ),
    },
    {
      chave: 'estado',
      titulo: 'Estado',
      largura: '8rem',
      render: (u) =>
        u.active ? <Selo tom="ok">ativa</Selo> : <Selo tom="perigo">desativada</Selo>,
    },
    {
      chave: 'sessoes',
      titulo: 'Sessões',
      largura: '5rem',
      alinhar: 'direita',
      render: (u) => <span className="tabular-nums text-[var(--color-muted)]">{u._count.sessions}</span>,
    },
    {
      chave: 'criada',
      titulo: 'Criada',
      largura: '7rem',
      alinhar: 'direita',
      render: (u) => (
        <span className="text-xs text-[var(--color-dim)]">{formatarDataCurta(u.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Contas de todos os salões. Busque por nome, e-mail, telefone ou identificador.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Busca
          valor={texto}
          aoMudar={setTexto}
          aoBuscar={() => {
            setBusca(texto.trim());
            setPagina(1);
          }}
          placeholder="Nome, e-mail, telefone ou ID"
        />
        <select
          className="campo sm:w-40"
          value={ativo}
          aria-label="Filtrar por estado"
          onChange={(e) => {
            setAtivo(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todos os estados</option>
          <option value="true">Ativas</option>
          <option value="false">Desativadas</option>
        </select>
        <select
          className="campo sm:w-40"
          value={tipo}
          aria-label="Filtrar por tipo"
          onChange={(e) => {
            setTipo(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todos os tipos</option>
          <option value="staff">Equipe do salão</option>
          <option value="customer">Cliente</option>
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
          <Vazio
            titulo="Nenhuma conta encontrada."
            detalhe={busca ? `Nada corresponde a "${busca}".` : undefined}
          />
        ) : null}
        {lista.data && lista.data.data.length > 0 ? (
          <>
            <Tabela
              colunas={colunas}
              linhas={lista.data.data}
              chaveDe={(u) => u.id}
              aoClicar={(u) => router.push(`/usuarios/detalhe/?id=${encodeURIComponent(u.id)}`)}
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
    </div>
  );
}
