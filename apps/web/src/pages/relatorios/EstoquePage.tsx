import { useState } from 'react';
import { Drawer } from '../../components/Drawer';
import { IconBox, IconDownload, IconInfo } from '../../components/icons';
import { formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  useReportsInventorySuggestion,
  type InventorySuggestionItem,
} from '../../lib/queries/relatorios';
import { InventoryReportShell } from './reportNav';

// ── card no estilo Belasis (branco + sombra suave), 100% themeable ────────────
const CARD = 'rounded-xl border border-line bg-card shadow-[var(--shadow-card)]';

export function EstoquePage() {
  // `generated` reproduz o fluxo do Belasis: o relatório só aparece após clicar
  // em "Gerar relatório". O data-wiring (query) é preservado do componente antigo.
  const [generated, setGenerated] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const query = useReportsInventorySuggestion();
  const d = query.data;
  // TODO: o endpoint /reports/inventory-suggestion retorna apenas os produtos
  // abaixo do mínimo. O "Estoque atual" do Belasis lista TODOS os produtos
  // ativos (com última compra/venda). Usamos o que existe até haver endpoint.
  const items = d?.items ?? [];
  const zerados = items.filter((i) => i.stock <= 0).length;

  function gerarRelatorio() {
    setGenerated(true);
    void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      'estoque-atual',
      [
        { header: 'Produto', value: (r: InventorySuggestionItem) => r.name },
        { header: 'Estoque atual', value: (r) => String(r.stock) },
        { header: 'Estoque mínimo', value: (r) => String(r.minStock) },
        { header: 'Sugestão de compra', value: (r) => String(r.deficit) },
      ],
      items,
    );
    setExportOpen(false);
  }

  return (
    <>
      <InventoryReportShell activeKey="stock">
          <div className={`${CARD} p-4 sm:p-5`}>
            {/* Alerta informativo (ant-alert-info, themeable) */}
            <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.06] p-4">
              <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
                <IconInfo size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Relatório de Estoque Atual</p>
                <p className="mt-1 text-sm text-muted-ink">
                  O sistema traz uma listagem de todos os produtos ativos ordenado pelo
                  nome, juntamente com a quantidade, última compra e venda e outras
                  informações.
                </p>
              </div>
            </div>

            {/* Botão split: Gerar relatório + "..." (opções de exportação) */}
            <div className="mt-4 flex justify-end">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={gerarRelatorio}
                  className="flex h-10 items-center justify-center rounded-l-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Gerar relatório
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  aria-label="Mais opções"
                  title="Mais opções"
                  className="flex h-10 w-10 items-center justify-center rounded-r-lg border-l border-primary-foreground/20 bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <span className="text-lg leading-none tracking-widest" aria-hidden>
                    ···
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Resultado do relatório (aparece após "Gerar relatório") */}
          {generated && (
            <>
              {query.isLoading ? (
                <div className={`${CARD} mt-4 flex h-64 items-center justify-center text-sm text-muted-ink`}>
                  Carregando…
                </div>
              ) : items.length === 0 ? (
                <div className={`${CARD} mt-4 flex h-64 flex-col items-center justify-center gap-1 text-center`}>
                  <span className="mb-1 text-muted-ink" aria-hidden>
                    <IconBox size={28} />
                  </span>
                  <p className="text-sm font-medium text-ink">Estoque em dia</p>
                  <p className="max-w-sm text-sm text-muted-ink">
                    Nenhum produto ativo a listar. Defina o estoque mínimo dos produtos
                    para acompanhar a reposição.
                  </p>
                </div>
              ) : (
                <div className={`${CARD} mt-4 overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h3 className="text-sm font-semibold text-ink">Estoque atual</h3>
                    <span className="text-xs text-muted-ink">
                      {formatNumber(items.length)} produto(s)
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                          <th className="px-5 py-3">Produto</th>
                          <th className="px-5 py-3 text-right">Estoque atual</th>
                          <th className="px-5 py-3 text-right">Estoque mínimo</th>
                          <th className="px-5 py-3">Última compra</th>
                          <th className="px-5 py-3">Última venda</th>
                          <th className="px-5 py-3 text-right">Sugestão de compra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r) => {
                          const semEstoque = r.stock <= 0;
                          return (
                            <tr
                              key={r.productId}
                              className="border-b border-line/70 last:border-0 hover:bg-primary/5"
                            >
                              <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                              <td
                                className={[
                                  'px-5 py-3 text-right',
                                  semEstoque ? 'font-semibold text-pink' : 'text-ink',
                                ].join(' ')}
                              >
                                {formatNumber(r.stock)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-ink">
                                {formatNumber(r.minStock)}
                              </td>
                              {/* TODO: sem campo de última compra no endpoint atual */}
                              <td className="px-5 py-3 text-muted-ink">—</td>
                              {/* TODO: sem campo de última venda no endpoint atual */}
                              <td className="px-5 py-3 text-muted-ink">—</td>
                              <td className="px-5 py-3 text-right">
                                <span
                                  className={[
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                                    semEstoque
                                      ? 'bg-pink/15 text-pink'
                                      : 'bg-gold/20 text-gold-strong',
                                  ].join(' ')}
                                >
                                  +{formatNumber(r.deficit)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-primary/5 font-semibold text-ink">
                          <td className="px-5 py-3">Total</td>
                          <td className="px-5 py-3 text-right">{formatNumber(items.length)}</td>
                          <td className="px-5 py-3" colSpan={2} />
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {formatNumber(zerados)} sem estoque
                          </td>
                          <td className="px-5 py-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
      </InventoryReportShell>

      {/* Drawer lateral: opções de exportação (split "..." do Belasis) */}
      <Drawer
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Exportar relatório"
      >
        <p className="mb-4 text-sm text-muted-ink">
          Escolha o formato para exportar o relatório de Estoque Atual.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={items.length === 0}
            className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconDownload size={18} />
            </span>
            <span className="flex flex-col">
              <span>Exportar CSV</span>
              <span className="text-xs font-normal text-muted-ink">
                Planilha com os produtos e quantidades
              </span>
            </span>
          </button>
          {/* TODO: exportação em Excel/PDF depende de endpoint dedicado no backend */}
          <button
            type="button"
            disabled
            className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left text-sm font-medium text-muted-ink opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconDownload size={18} />
            </span>
            <span className="flex flex-col">
              <span>Exportar PDF</span>
              <span className="text-xs font-normal text-muted-ink">Em breve</span>
            </span>
          </button>
        </div>
      </Drawer>
    </>
  );
}
