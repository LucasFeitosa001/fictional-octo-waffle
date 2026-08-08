'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatarData, rotuloAcao, acaoSensivel } from '@/lib/sessao';
import { Carregando, Erro, Mono, Selo, Vazio } from '@/components/Estados';
import type { Pagina, RegistroAuditoria, Resumo } from '@/lib/types';

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe?: string }) {
  return (
    <div className="painel p-4">
      <div className="rotulo">{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor.toLocaleString('pt-BR')}</div>
      {detalhe ? <div className="mt-0.5 text-xs text-[var(--color-dim)]">{detalhe}</div> : null}
    </div>
  );
}

export default function VisaoGeral() {
  const resumo = useQuery({
    queryKey: ['resumo'],
    queryFn: () => api.get<Resumo>('/platform/resumo'),
  });

  const recentes = useQuery({
    queryKey: ['auditoria', 'recentes'],
    queryFn: () => api.get<Pagina<RegistroAuditoria>>('/platform/auditoria?porPagina=12'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Visão geral</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Estado da plataforma e o que a equipe fez nos últimos dias.
        </p>
      </div>

      {resumo.isLoading ? <Carregando /> : null}
      {resumo.error ? (
        <Erro mensagem={(resumo.error as Error).message} aoTentar={() => resumo.refetch()} />
      ) : null}

      {resumo.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Numero
            rotulo="Salões"
            valor={resumo.data.saloes}
            detalhe={`${resumo.data.saloesAtivos} ativos · ${resumo.data.saloesInativos} desativados`}
          />
          <Numero
            rotulo="Usuários"
            valor={resumo.data.usuarios}
            detalhe={`${resumo.data.usuariosAtivos} ativos · ${resumo.data.usuariosInativos} desativados`}
          />
          <Numero rotulo="Salões novos (7 dias)" valor={resumo.data.novosSaloes7d} />
          <Numero rotulo="Ações do console (7 dias)" valor={resumo.data.acoesConsole7d} />
        </div>
      ) : null}

      <section className="painel">
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-4 py-3">
          <h2 className="text-sm font-semibold">Atividade recente</h2>
          <Link href="/auditoria" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            Ver tudo
          </Link>
        </div>

        {recentes.isLoading ? <Carregando /> : null}
        {recentes.data && recentes.data.data.length === 0 ? (
          <Vazio titulo="Nada registrado ainda." />
        ) : null}

        <ul>
          {recentes.data?.data.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--color-hairline)] px-4 py-2.5 text-sm last:border-0"
            >
              <span className={acaoSensivel(r.action) ? 'text-[var(--color-danger)]' : ''}>
                {rotuloAcao(r.action)}
              </span>
              {r.targetLabel ? <Mono>{r.targetLabel}</Mono> : null}
              <span className="ml-auto text-xs text-[var(--color-dim)]">
                {r.staffEmail} · {formatarData(r.at)}
              </span>
              {r.reason ? (
                <span className="w-full text-xs text-[var(--color-muted)]">{r.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-[var(--color-dim)]">
        Toda ação deste console é registrada com seu nome, IP e justificativa. A trilha não pode ser
        editada nem apagada por ninguém pela interface. <Selo tom="apagado">somente leitura</Selo>
      </p>
    </div>
  );
}
