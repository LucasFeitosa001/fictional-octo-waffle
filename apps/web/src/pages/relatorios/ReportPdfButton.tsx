import { useEffect, useState } from 'react';
import { IconDownload } from '../../components/icons';

/**
 * Gera e baixa o PDF diretamente. A geração é semântica (título, filtros,
 * tabelas e assinatura), portanto não abre o diálogo de impressão nem captura
 * a tela inteira como uma imagem.
 */
export async function downloadCurrentReport(signatureName = ''): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const report = document.querySelector<HTMLElement>('.mobile-page-content');
  if (!report) throw new Error('Relatório não encontrado na página.');
  const layout = document.querySelector<HTMLElement>('[data-report-pdf-layout]')?.dataset.reportPdfLayout;
  const doc = new JsPDF({ orientation: layout === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 16;
  const title = report.querySelector('h1, h2')?.textContent?.trim() || document.title || 'Relatório';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, y);
  y += 8;
  const reportMeta = Array.from(document.querySelectorAll<HTMLElement>('[data-report-pdf-meta]'))
    .map((node) => node.dataset.reportPdfMeta || node.textContent || '')
    .map((text) => text.trim())
    .filter(Boolean);
  if (reportMeta.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(`Filtros: ${reportMeta.join(' · ')}`, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 5;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const tables = Array.from(report.querySelectorAll('table'));
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr:last-child');
    const head = headerRow
      ? [Array.from(headerRow.querySelectorAll('th,td')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || '')]
      : [];
    const body = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td,th')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() || ''),
    );
    if (!head.length && !body.length) continue;
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      theme: 'grid',
    });
    y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    if (y > pageHeight - 45) { doc.addPage(); y = 16; }
  }
  if (!tables.length) {
    const clone = report.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('form,nav,button,input,select,textarea,[data-report-pdf-meta],.report-no-print').forEach((node) => node.remove());
    const text = clone.innerText.replace(/\n{3,}/g, '\n\n').trim();
    if (text) {
      const lines = doc.splitTextToSize(text, pageWidth - 28);
      for (const line of lines) {
        if (y > pageHeight - 20) { doc.addPage(); y = 16; }
        doc.text(line, 14, y); y += 4;
      }
    }
  }
  if (y > pageHeight - 42) { doc.addPage(); y = 16; }
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Responsável pelo relatório', pageWidth / 2, y, { align: 'center' });
  y += 14;
  doc.setDrawColor(55, 65, 81);
  doc.line(pageWidth / 2 - 38, y, pageWidth / 2 + 38, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(signatureName.trim() || 'Nome e assinatura', pageWidth / 2 - 38, y + 5);
  doc.text(`Data: ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, pageWidth / 2 + 8, y + 5);
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'relatorio';
  doc.save(`${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
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
    try {
      await prepare?.();
      await downloadCurrentReport(signatureName);
      setOpen(false);
    } finally {
      setPreparing(false);
    }
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
