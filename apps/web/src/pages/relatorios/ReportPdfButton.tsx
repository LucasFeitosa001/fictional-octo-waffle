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
  const reportMeta = Array.from(document.querySelectorAll<HTMLElement>('[data-report-pdf-meta]'))
    .map((node) => node.dataset.reportPdfMeta || node.textContent || '')
    .map((text) => text.trim())
    .filter(Boolean);
  let y = 20;
  const title = reportTitle(report, reportMeta);
  // Cabeçalho de documento, em vez de reproduzir a tela do sistema: faixa de
  // marca, título legível e contexto do período antes da tabela.
  doc.setFillColor(67, 56, 202);
  doc.rect(0, 0, pageWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`SalonPass · Relatório operacional · Emitido em ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, 14, y);
  doc.setTextColor(17, 24, 39);
  y += 7;
  if (reportMeta.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(`Filtros aplicados: ${formatReportMetadata(reportMeta.join(' · '))}`, pageWidth - 28);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y - 4, pageWidth - 28, lines.length * 4 + 8, 2, 2, 'FD');
    doc.text(lines, 14, y);
    doc.setTextColor(17, 24, 39);
    y += lines.length * 4 + 11;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const tables = Array.from(report.querySelectorAll('table'));
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr:last-child');
    const head = headerRow
      ? [Array.from(headerRow.querySelectorAll('th,td')).map((cell) => normalizeReportCell(cell.textContent))]
      : [];
    const body = Array.from(table.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('td,th')).map((cell) => normalizeReportCell(cell.textContent)),
    );
    if (!head.length && !body.length) continue;
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: 14, right: 14 },
      // Quando o usuário escolhe retrato e marca muitas colunas, a tabela não
      // pode simplesmente desaparecer pela borda direita. O autoTable divide
      // as colunas em páginas horizontais mantendo o cabeçalho em cada uma.
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 1,
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [203, 213, 225],
      tableLineWidth: 0.15,
      theme: 'grid',
      didDrawPage: () => drawFooter(doc),
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
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y - 5, pageWidth - 28, 31, 2, 2, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Responsável pelo relatório', pageWidth / 2, y, { align: 'center' });
  y += 14;
  doc.setDrawColor(55, 65, 81);
  doc.line(pageWidth / 2 - 38, y, pageWidth / 2 + 38, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(signatureName.trim() || 'Nome e assinatura', pageWidth / 2 - 38, y + 5);
  doc.text(`Data: ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`, pageWidth / 2 + 8, y + 5);
  const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'relatorio';
  doc.save(`${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function normalizeReportCell(value: string | null): string {
  const text = value?.replace(/\s+/g, ' ').trim() || '';
  const date = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  const status: Record<string, string> = {
    canceled: 'Cancelado', cancelled: 'Cancelado', confirmed: 'Confirmado',
    finished: 'Finalizado', scheduled: 'Agendado', pending: 'Pendente',
    no_show: 'Não compareceu', noShow: 'Não compareceu',
  };
  return status[text] ?? text;
}

function formatReportMetadata(value: string): string {
  return value.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
}

const REPORT_TITLE_BY_PATH: Record<string, string> = {
  '/reports/calendars/all': 'Relatório de Agendamentos',
  '/relatorios/agendamentos': 'Relatório de Agendamentos',
  '/relatorios/aniversariantes': 'Relatório de Aniversariantes',
  '/relatorios/ranking': 'Relatório de Ranking',
  '/relatorios/financeiro/dre': 'Demonstrativo de Resultado (DRE)',
  '/reports/calendars/deleted': 'Relatório de Agendamentos Excluídos',
  '/reports/calendars/origin': 'Relatório de Origem dos Agendamentos',
  '/reports/calendars/creation': 'Relatório de Criação de Agendamentos',
  '/reports/calendars/care-messages-today': 'Relatório de Cuidados para Hoje',
  '/reports/financial/dre': 'Demonstrativo de Resultado (DRE)',
  '/reports/financial/service-revenue': 'Resultado Líquido de Serviços',
  '/reports/financial/product-revenue': 'Resultado Líquido de Produtos',
  '/reports/financial/billing-projection': 'Projeção de Faturamento',
  '/reports/financial/cash-movements': 'Fluxo de Caixa',
  '/reports/financial/bill-recs': 'Relatório de Recebimentos',
  '/reports/financial/bill-pays': 'Relatório de Despesas',
  '/reports/financial/extract': 'Extrato de Contas',
  '/reports/financial/extract-movements': 'Extrato de Movimentações',
  '/relatorios/vendas': 'Relatório de Vendas',
  '/relatorios/clientes': 'Relatório de Clientes',
  '/relatorios/mensagens': 'Relatório de Mensagens',
  '/relatorios/estoque': 'Relatório de Estoque',
  '/reports/inventory/stock': 'Relatório de Estoque Atual',
  '/reports/inventory/movements': 'Relatório de Movimentação de Estoque',
  '/reports/inventory/purchases': 'Relatório de Compras',
  '/reports/inventory/products-services': 'Lista de Produtos e Serviços',
  '/reports/inventory/suggestion': 'Sugestão de Compra',
  '/reports/inventory/consumed': 'Relatório de Produtos Consumidos',
};

function reportTitle(report: HTMLElement, metadata: string[]): string {
  const explicit = report.closest('[data-report-pdf-title]')?.getAttribute('data-report-pdf-title')
    || document.querySelector<HTMLElement>('[data-report-pdf-title]')?.dataset.reportPdfTitle;
  const base = explicit?.trim() || REPORT_TITLE_BY_PATH[window.location.pathname] || Array.from(report.querySelectorAll('h1, h2'))
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '')
    .find((text) => text && text.toLowerCase() !== 'relatórios') || 'Relatório';
  const period = /Período\s+(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})/i.exec(metadata.join(' '));
  if (period) return `${stripReportPrefix(base)} · ${formatDate(period[1])} a ${formatDate(period[2])}`;
  return stripReportPrefix(base);
}

function stripReportPrefix(value: string): string {
  return value.replace(/^Relatório de /i, '').replace(/^Relatório /i, '').trim();
}

function formatDate(value: string): string {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) ?? [];
  return year ? `${day}/${month}/${year}` : value;
}

function drawFooter(doc: { internal: { pageSize: { getWidth: () => number; getHeight: () => number }; getCurrentPageInfo?: () => { pageNumber: number } }; setFontSize: (size: number) => void; setTextColor: (r: number, g: number, b: number) => void; text: (text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }) => void }) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SalonPass · Relatório gerado pelo sistema', 14, height - 8);
  const page = doc.internal.getCurrentPageInfo?.().pageNumber;
  if (page) doc.text(`Página ${page}`, width - 14, height - 8, { align: 'right' });
  doc.setTextColor(17, 24, 39);
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
