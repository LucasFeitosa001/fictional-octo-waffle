'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, query } from '@/lib/api';
import { acaoSensivel, formatarData, rotuloAcao } from '@/lib/sessao';
import { Busca } from '@/components/Campo';
import { Carregando, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import { Paginacao } from '@/components/Tabela';
import type { Pagina, RegistroAuditoria } from '@/lib/types';

/** Antes/depois: só aparece quando existe, e sempre em fonte de código. */
function Diferenca({ rotulo, valor }: { rotulo: string; valor: unknown }) {
  if (valor === null || valor === undefined) return null;
  return (
    <div className="min-w-0 flex-1">
      <div className="rotulo">{rotulo}</div>
      <pre className="mono mt-0.5 overflow-x-auto rounded border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2 text-[var(--color-muted)]">
        {JSON.stringify(valor, null, 1)}
      </pre>
    </div>
  );
}

export default function Auditoria() {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<string | null>(null);

  const acoes = useQuery({
    queryKey: ['auditoria', 'acoes'],
    queryFn: () => api.get<string[]>('/platform/auditoria/acoes'),
  });

  const lista = useQuery({
    queryKey: ['auditoria', busca, acao, de, ate, pagina],
    queryFn: () =>
      api.get<Pagina<RegistroAuditoria>>(
        `/platform/auditoria${query({
          busca,
          action: acao,
          // O input `date` dá só a data; sem a hora o filtro "até" cortaria o
          // próprio dia escolhido.
          de: de ? `${de}T00:00:00` : '',
          ate: ate ? `${ate}T23:59:59` : '',
          pagina,
          porPagina: 50,
        })}`,
      ),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Auditoria</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Tudo que a equipe fez por este console. Somente leitura — não há como editar nem apagar
          pela interface.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <Busca
          valor={texto}
          aoMudar={setTexto}
          aoBuscar={() => {
            setBusca(texto.trim());
            setPagina(1);
          }}
          placeholder="Técnico, alvo, ID ou motivo"
        />
        <select
          className="campo lg:w-56"
          value={acao}
          aria-label="Filtrar por ação"
          onChange={(e) => {
            setAcao(e.target.value);
            setPagina(1);
          }}
        >
          <option value="">Todas as ações</option>
          {(acoes.data ?? []).map((a) => (
            <option key={a} value={a}>
              {rotuloAcao(a)}
            </option>
          ))}
        </select>
        <input
          className="campo lg:w-40"
          type="date"
          value={de}
          aria-label="Data inicial"
          onChange={(e) => {
            setDe(e.target.value);
            setPagina(1);
          }}
        />
        <input
          className="campo lg:w-40"
          type="date"
          value={ate}
          aria-label="Data final"
          onChange={(e) => {
            setAte(e.target.value);
            setPagina(1);
          }}
        />
      </div>

      <div className="painel">
        {lista.isLoading ? <Carregando /> : null}
        {lista.error ? (
          <div className="p-4">
            <Erro mensagem={(lista.error as Error).message} aoTentar={() => lista.refetch()} />
          </div>
        ) : null}
        {lista.data && lista.data.data.length === 0 ? (
          <Vazio titulo="Nada encontrado com esses filtros." />
        ) : null}

        <ul>
          {lista.data?.data.map((r) => {
            const expandido = aberto === r.id;
            const temDetalhe = Boolean(r.beforeJson || r.afterJson);
            return (
              <li key={r.id} className="border-b border-[var(--color-hairline)] last:border-0">
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-raised)]"
                  onClick={() => setAberto(expandido ? null : r.id)}
                  aria-expanded={expandido}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className={acaoSensivel(r.action) ? 'text-[var(--color-danger)]' : ''}>
                      {rotuloAcao(r.action)}
                    </span>
                    {r.targetLabel ? <Mono>{r.targetLabel}</Mono> : null}
                    {!r.reason && acaoSensivel(r.action) ? (
                      <Selo tom="apagado">sem motivo</Selo>
                    ) : null}
                    <span className="ml-auto text-xs text-[var(--color-dim)]">
                      {r.staffEmail} · {formatarData(r.at)}
                    </span>
                  </div>
                  {r.reason ? (
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">{r.reason}</div>
                  ) : null}
                </button>

                {expandido ? (
                  <div className="space-y-3 border-t border-[var(--color-hairline)] px-4 py-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="rotulo">Alvo</div>
                        <div className="mono mt-0.5 break-all">
                          {r.targetType}
                          {r.targetId ? ` · ${r.targetId}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="rotulo">Origem</div>
                        <div className="mono mt-0.5">{r.ipAddress || '—'}</div>
                      </div>
                      <div>
                        <div className="rotulo">Salão</div>
                        <div className="mono mt-0.5 break-all">{r.companyId || '—'}</div>
                      </div>
                    </div>
                    {temDetalhe ? (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Diferenca rotulo="Antes" valor={r.beforeJson} />
                        <Diferenca rotulo="Depois" valor={r.afterJson} />
                      </div>
                    ) : null}
                    {r.userAgent ? (
                      <div className="text-xs text-[var(--color-dim)] break-all">{r.userAgent}</div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {lista.data ? (
          <Paginacao
            pagina={lista.data.pagina}
            porPagina={lista.data.porPagina}
            total={lista.data.total}
            aoMudar={setPagina}
          />
        ) : null}
      </div>
    </div>
  );
}
