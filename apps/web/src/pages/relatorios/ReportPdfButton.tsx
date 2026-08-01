import { useEffect, useState } from 'react';
import { IconDownload } from '../../components/icons';

/**
 * Abre uma versão limpa do relatório no diálogo nativo de impressão.
 * O navegador permite escolher "Salvar como PDF" e a versão impressa sempre
 * inclui a área de assinatura. Não depende de um endpoint nem de biblioteca
 * externa, portanto funciona também nos relatórios legados que só têm CSV.
 */
export function printCurrentReport(signatureName = '') {
  const report = document.querySelector<HTMLElement>('.mobile-page-content');
  if (!report) {
    window.print();
    return;
  }
  // Não usamos `noopener` aqui: alguns navegadores retornam `null` para a
  // janela recém-aberta quando essa flag é passada, impedindo escrever o PDF.
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) {
    window.print();
    return;
  }
  // A janela de impressão é separada pelo navegador. Deixar o SalonPass
  // visível atrás dela dava a impressão de que o relatório estava duplicado ou
  // piscando. Escondemos a aplicação original até a janela ser fechada.
  const appRoot = document.getElementById('root');
  const previousVisibility = appRoot?.style.visibility ?? '';
  if (appRoot) appRoot.style.visibility = 'hidden';
  let restored = false;
  const restoreApp = () => {
    if (restored) return;
    restored = true;
    if (appRoot) appRoot.style.visibility = previousVisibility;
  };
  popup.addEventListener('beforeunload', restoreApp);
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('');
  const today = new Intl.DateTimeFormat('pt-BR').format(new Date());
  const reportMeta = Array.from(document.querySelectorAll<HTMLElement>('[data-report-pdf-meta]'))
    .map((node) => node.dataset.reportPdfMeta || node.textContent || '')
    .filter(Boolean)
    .join(' · ');
  const layout = document.querySelector<HTMLElement>('[data-report-pdf-layout]')?.dataset.reportPdfLayout;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório</title>${styles}<style>
    @page { size: A4 ${layout === 'landscape' ? 'landscape' : 'portrait'}; margin: 14mm; }
    html,body { background:#fff !important; color:#111827 !important; }
    body { font-family: ui-sans-serif,system-ui,sans-serif; }
    .report-no-print, form, nav, button, input, select, textarea { display:none !important; }
    .report-signature-print { display:block !important; margin-top:32px; break-inside:avoid; color:#111827; }
    .report-signature-print .line { border-bottom:1px solid #374151; width:280px; margin:34px auto 8px; }
    .report-signature-print .meta { display:flex; justify-content:space-between; gap:24px; font-size:11px; color:#4b5563; }
    .report-pdf-meta { margin:0 0 18px; padding:8px 10px; border:1px solid #d1d5db; font-size:11px; color:#374151; }
    .mobile-page-content { max-width:none !important; padding:0 !important; }
  </style></head><body><main>${reportMeta ? `<div class="report-pdf-meta"><strong>Filtros:</strong> ${escapeHtml(reportMeta)}</div>` : ''}${report.innerHTML}
    <section class="report-signature-print" aria-label="Assinatura do relatório">
      <div style="text-align:center;font-weight:600">Responsável pelo relatório</div>
      <div class="line"></div>
      <div class="meta"><span>${escapeHtml(signatureName || 'Nome e assinatura')}</span><span>Data: ${today}</span></div>
    </section>
  </main></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => {
    popup.print();
  }, 500);
  const watch = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(watch);
      restoreApp();
    }
  }, 250);
}

/** Solicita o modal da instância de PDF montada na página. */
export function requestReportPdf(prepare?: () => void | Promise<void>) {
  window.dispatchEvent(new CustomEvent('sp:open-report-pdf', { detail: { prepare } }));
}

/** Ação que pode ser colocada ao lado de qualquer botão "Gerar relatório". */
export function ReportPdfOption() {
  return (
    <button
      type="button"
      onClick={() => requestReportPdf()}
      className="report-no-print inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
    >
      <IconDownload size={16} /> Gerar PDF
    </button>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

export function ReportPdfModalHost() {
  const [open, setOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepare, setPrepare] = useState<(() => void | Promise<void>) | undefined>();

  useEffect(() => {
    const openModal = (event: Event) => {
      const detail = (event as CustomEvent<{ prepare?: () => void | Promise<void> }>).detail;
      setPrepare(() => detail?.prepare);
      setOpen(true);
    };
    window.addEventListener('sp:open-report-pdf', openModal);
    return () => window.removeEventListener('sp:open-report-pdf', openModal);
  }, []);

  async function confirm() {
    setPreparing(true);
    await prepare?.();
    setOpen(false);
    setPreparing(false);
    printCurrentReport(signatureName);
  }

  return (
    <>
      {open && (
        <div className="report-no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Gerar PDF">
          <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-pop)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Gerar PDF</h2>
                <p className="mt-1 text-sm text-muted-ink">Informe quem será responsável pela assinatura do relatório.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl text-muted-ink hover:text-ink" aria-label="Fechar">×</button>
            </div>
            <label className="mt-5 block text-sm font-medium text-ink">
              Nome do responsável
              <input
                autoFocus
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Digite o nome do responsável"
                className="mt-1.5 h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink outline-none ring-primary focus:ring-2"
              />
            </label>
            <p className="mt-3 text-xs text-muted-ink">O PDF terá uma linha para assinatura manual e a data de emissão.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-canvas">Cancelar</button>
              <button type="button" onClick={() => void confirm()} disabled={preparing} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"><IconDownload size={16} /> {preparing ? 'Preparando relatório…' : 'Gerar PDF'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Compatibilidade para páginas que ainda importam o botão antigo. */
export function ReportPdfButton() {
  return <ReportPdfOption />;
}
