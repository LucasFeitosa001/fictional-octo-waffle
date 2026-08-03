import { useEffect, useState } from 'react';
import { IconDownload } from '../../components/icons';
import { useEmpresa } from '../../lib/queries/empresa';

/**
 * Gera e baixa o PDF diretamente. A geração é semântica (título, filtros,
 * tabelas e assinatura), portanto não abre o diálogo de impressão nem captura
 * a tela inteira como uma imagem.
 */
export async function downloadCurrentReport(signatureName = '', companyName = 'SalonPass'): Promise<void> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const report = document.querySelector<HTMLElement>('.mobile-page-content');
  if (!report) throw new Error('Relatório não encontrado na página.');
  const layout = document.querySelector<HTMLElement>('[data-report-pdf-layout]')?.dataset.reportPdfLayout;
  const reportMeta = Array.from(document.querySelectorAll<HTMLElement>('[data-report-pdf-meta]'))
    .map((node) => node.dataset.reportPdfMeta || node.textContent || '')
    .map((text) => text.trim())
    .filter(Boolean);
  // Relatórios legados ainda não possuem um bloco de metadados próprio. Eles
  // continuam usando o mesmo quadro visual, sem deixar o PDF com um cabeçalho
  // vazio; quando a página não expõe filtros estruturados, registramos isso de
  // forma honesta em vez de inventar valores.
  // Período derivado da própria tela quando a página não se declara. Antes daqui
  // saía a frase "Período e filtros definidos na tela do relatório", que o painel
  // partia no primeiro espaço e imprimia como "Período: e filtros definidos…".
  // Ver estudo 97.
  if (!reportMeta.length) {
    const periodo = periodoDaTela();
    if (periodo) reportMeta.push(`Período: ${periodo}`);
  }
  let y = 20;
  const title = reportTitle(report, reportMeta);
  const appointmentReport = /agendamentos/i.test(title);
  const wideAppointment = appointmentReport && report.querySelectorAll('table').length > 0;
  const pdfOrientation = wideAppointment ? 'landscape' : (layout === 'landscape' ? 'landscape' : 'portrait');
  const doc = new JsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const themePrimary = getComputedStyle(document.documentElement).getPropertyValue('--sp-primary').trim() || '#4f46e5';
  const colorCanvas = document.createElement('canvas');
  const colorContext = colorCanvas.getContext('2d');
  if (!colorContext) throw new Error('canvas indisponível');
  colorContext.fillStyle = themePrimary;
  const normalizedColor = colorContext.fillStyle;
  const colorParts = normalizedColor.match(/\d+/g)?.map(Number) ?? [79, 70, 229];
  const primary: [number, number, number] = colorParts.length >= 3 ? [colorParts[0], colorParts[1], colorParts[2]] : [79, 70, 229];
  // O relatório operacional de agendamentos é entregue como uma folha única
  // paisagem quando há muitas colunas: evita quebrar o resumo e o detalhe em
  // páginas que parecem vazias para o usuário.
  if (wideAppointment && layout !== 'landscape') {
    doc.setProperties({ subject: 'Agendamentos em uma página paisagem' });
  }
  // Cabeçalho de documento, em vez de reproduzir a tela do sistema: faixa de
  // marca, título legível e contexto do período antes da tabela.
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 9, 'F');
  await drawSalonPassLogo(doc, primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 32);
  y = 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Empresa:', 14, y);
  const companyX = 14 + doc.getTextWidth('Empresa: ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(companyName, companyX, y);
  const companyWidth = doc.getTextWidth(companyName);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(' · Relatório operacional · Emitido em ' + new Intl.DateTimeFormat('pt-BR').format(new Date()), companyX + companyWidth + 1.5, y);
  doc.setTextColor(17, 24, 39);
  y += 7;
  if (reportMeta.length) {
    y = drawFilterPanel(doc, reportMeta, y, pageWidth, primary);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  // Só as tabelas VISÍVEIS: a tela tem um bloco desktop e outro `md:hidden`, e
  // pegar os dois duplicava cada linha no PDF. Ver estudo 97.
  const tables = Array.from(report.querySelectorAll('table')).filter(visivel);

  // Resumo (KPIs) ANTES das tabelas: é o dado mais importante da página e ficava
  // de fora sempre que existia alguma tabela.
  const resumo = lerResumo(report);
  if (resumo.length) {
    autoTable(doc, {
      head: [['Resumo', 'Valor']],
      body: resumo.map(([r, v]) => [normalizeReportCell(r), normalizeReportCell(v)]),
      startY: y,
      margin: { left: 14, right: 14 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      tableLineColor: [203, 213, 225],
      tableLineWidth: 0.15,
      theme: 'grid',
      didDrawPage: () => drawFooter(doc),
    });
    y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  }
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr:last-child');
    const head = headerRow
      ? [Array.from(headerRow.querySelectorAll('th,td')).map((cell) => normalizeReportCell(textoLegivel(cell) || cell.textContent))]
      : [];
    // `tfoot` junto: a linha de Total da tela não ia para o PDF. E `textoLegivel`
    // em vez de `textContent` para não grudar rótulo e valor dentro da célula.
    const body = Array.from(table.querySelectorAll('tbody tr, tfoot tr'))
      .filter(visivel)
      .map((row) =>
        Array.from(row.querySelectorAll('td,th')).map((cell) =>
          normalizeReportCell(textoLegivel(cell) || cell.textContent),
        ),
      );
    if (!head.length && !body.length) continue;
    // O resumo de agendamentos por serviço termina com uma coluna monetária
    // "Total". Mostramos também o somatório do período, para o relatório não
    // obrigar o responsável a somar linha por linha.
    const headerLabels = head[0] ?? [];
    const serviceSummary = headerLabels.some((label) => /^servi[cç]o$/i.test(label))
      && headerLabels.some((label) => /^quantidade$/i.test(label))
      && headerLabels.some((label) => /^total$/i.test(label));
    if (serviceSummary && body.length) {
      const totalIndex = headerLabels.findIndex((label) => /^total$/i.test(label));
      const total = body.reduce((sum, row) => sum + parseReportMoney(row[totalIndex] ?? ''), 0);
      const totalRow = Array.from({ length: headerLabels.length }, () => '');
      totalRow[Math.max(0, totalIndex - 1)] = 'Total geral';
      totalRow[totalIndex] = formatReportMoney(total);
      body.push(totalRow);
    }
    autoTable(doc, {
      head,
      body,
      startY: y,
      margin: { left: 14, right: 14 },
      // Quando o usuário escolhe retrato e marca muitas colunas, a tabela não
      // pode simplesmente desaparecer pela borda direita. O autoTable divide
      // as colunas em páginas horizontais mantendo o cabeçalho em cada uma.
      horizontalPageBreak: !wideAppointment,
      horizontalPageBreakRepeat: 1,
      styles: { font: 'helvetica', fontSize: wideAppointment ? 6 : 7, cellPadding: wideAppointment ? 1.3 : 2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: [203, 213, 225],
      tableLineWidth: 0.15,
      theme: 'grid',
      didDrawPage: () => drawFooter(doc),
    });
    y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    if (!wideAppointment && y > pageHeight - 45) { doc.addPage(); y = 16; }
  }
  if (!tables.length && !resumo.length) {
    // Sem tabela e sem KPI não há o que tabular. Antes daqui saía o `innerText`
    // da página inteira — título, subtítulo, banners e números colados uns nos
    // outros ("Òleo de Alecrim33R$ 66,00"). Ilegível, e pior que não dizer nada.
    //
    // Agora as LINHAS de dado da tela (que são `div`/grid, não `<table>`) são
    // lidas com separador; se nem isso existir, o PDF diz honestamente que não
    // há dados em vez de despejar a interface. Ver estudo 97.
    const linhas = Array.from(report.querySelectorAll<HTMLElement>('[data-report-row], li, tr'))
      .filter(visivel)
      .map((node) => textoLegivel(node))
      .filter((t) => t.length > 2)
      .slice(0, 400);
    if (linhas.length) {
      autoTable(doc, {
        head: [['Registro']],
        body: linhas.map((t) => [normalizeReportCell(t)]),
        startY: y,
        margin: { left: 14, right: 14 },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        tableLineColor: [203, 213, 225],
        tableLineWidth: 0.15,
        theme: 'grid',
        didDrawPage: () => drawFooter(doc),
      });
      y = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Nenhum dado no período consultado.', 14, y + 4);
      doc.setTextColor(17, 24, 39);
      y += 12;
    }
  }
  // Rodapé também nas páginas sem tabela: o `didDrawPage` do autoTable só roda
  // quando existe tabela, então esses PDFs saíam sem paginação.
  drawFooter(doc);
  if (!wideAppointment && y > pageHeight - 42) { doc.addPage(); y = 16; }
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


/** O elemento aparece na tela AGORA? Ver estudo 97. */
function visivel(node: Element): boolean {
  const el = node as HTMLElement;
  if (!el.isConnected) return false;
  // `offsetParent` é null para `display:none` e para ancestrais ocultos. É o que
  // elimina a DUPLICAÇÃO: as telas têm um bloco desktop e outro `md:hidden`, e
  // raspar os dois fazia cada linha sair duas vezes no PDF.
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

/**
 * Texto de um nó com SEPARADOR entre os filhos.
 *
 * `innerText`/`textContent` grudam rótulo e valor quando são elementos irmãos —
 * era daí que saíam `Òleo de Alecrim33R$ 66,00` e `31/07/20265`.
 */
function textoLegivel(node: Element): string {
  const partes: string[] = [];
  node.childNodes.forEach((filho) => {
    if (filho.nodeType === Node.TEXT_NODE) {
      const t = (filho.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) partes.push(t);
      return;
    }
    if (filho.nodeType !== Node.ELEMENT_NODE) return;
    if (!visivel(filho as Element)) return;
    const t = textoLegivel(filho as Element);
    if (t) partes.push(t);
  });
  return partes.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Cards de resumo (KPI) da tela: rótulo curto + valor destacado.
 *
 * Eles ficavam de fora do PDF sempre que a página tinha alguma tabela — e são o
 * dado mais importante do relatório (Entradas/Saídas/Saldo, totais de vendas).
 */
function lerResumo(report: HTMLElement): [string, string][] {
  const achados: [string, string][] = [];
  const vistos = new Set<string>();
  const candidatos = report.querySelectorAll<HTMLElement>('[data-report-kpi], .rounded-2xl, .rounded-xl');
  candidatos.forEach((card) => {
    if (!visivel(card) || card.querySelector('table')) return;
    // Card de KPI é raso: um rótulo e um número. Se tiver muito texto, é seção.
    const texto = textoLegivel(card);
    if (!texto || texto.length > 90) return;
    const valor = texto.match(/(-?R\$\s?[\d.,]+|-?\d+[\d.,]*\s?%?)\s*$/);
    if (!valor) return;
    const rotulo = texto.slice(0, texto.length - valor[0].length).replace(/[:·-]\s*$/, '').trim();
    if (!rotulo || rotulo.length < 2) return;
    const chave = `${rotulo}|${valor[0].trim()}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    achados.push([rotulo, valor[0].trim()]);
  });
  return achados.slice(0, 12);
}

/**
 * O período da tela, mesmo quando a página não se declara.
 *
 * Antes, só `/reports/calendars/all` emitia metadados, então 27 dos 28 PDFs
 * saíam sem dizer que intervalo cobriam — num documento assinado, isso o torna
 * inauditável. Ver estudo 97.
 */
function periodoDaTela(): string {
  const datas = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="date"]'))
    .filter((i) => visivel(i) && i.value)
    .map((i) => i.value);
  if (datas.length >= 2) {
    const [de, ate] = [datas[0], datas[datas.length - 1]];
    return `${formatReportMetadata(de)} a ${formatReportMetadata(ate)}`;
  }
  if (datas.length === 1) return formatReportMetadata(datas[0]);
  return '';
}

function normalizeReportCell(value: string | null): string {
  // A Helvetica embutida do jsPDF não tem o menos tipográfico (−, U+2212) nem
  // travessões/espaços finos: eles saíam como aspas com os dígitos espalhados
  // nos relatórios de extrato. Normalizar para ASCII antes de escrever.
  const text = (value ?? '')
    .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
    .replace(/[\u00a0\u2007\u202f\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const date = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(text);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  const status: Record<string, string> = {
    canceled: 'Cancelado', cancelled: 'Cancelado', confirmed: 'Confirmado',
    finished: 'Finalizado', scheduled: 'Agendado', pending: 'Pendente',
    no_show: 'Não compareceu', noShow: 'Não compareceu',
  };
  return status[text] ?? text;
}

async function drawSalonPassLogo(
  doc: { setFillColor: (r: number, g: number, b: number) => void; roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void; addImage: (image: string, format: string, x: number, y: number, w: number, h: number) => void; setFont: (font: string, style?: string) => void; setFontSize: (size: number) => void; setTextColor: (r: number, g: number, b: number) => void; text: (text: string, x: number, y: number) => void },
  primary: [number, number, number],
): Promise<void> {
  doc.setFillColor(...primary);
  doc.roundedRect(14, 12, 42, 10, 2, 2, 'F');
  try {
    const response = await fetch('/brand/salonpass-wordmark-white.svg');
    const svg = await response.text();
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 100;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas indisponível');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 17, 14, 36, 6);
  } catch {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('salonpass', 21, 18.3);
  }
}

function formatReportMetadata(value: string): string {
  return value.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3/$2/$1');
}

function parseReportMoney(value: string): number {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatReportMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function drawFilterPanel(
  doc: { setFont: (font: string, style?: string) => void; setFontSize: (size: number) => void; setTextColor: (r: number, g: number, b: number) => void; setFillColor: (r: number, g: number, b: number) => void; setDrawColor: (r: number, g: number, b: number) => void; roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void; text: (text: string | string[], x: number, y: number) => void; splitTextToSize: (text: string, size: number) => string[];
  },
  metadata: string[],
  startY: number,
  pageWidth: number,
  primary: [number, number, number],
): number {
  const items = metadata.join(';').split(';').map((item) => item.trim()).filter(Boolean)
    .map((item) => formatReportMetadata(item));
  const fields = items.find((item) => /^Campos\b/i.test(item));
  const regular = items.filter((item) => !/^Campos\b/i.test(item));
  const columnWidth = (pageWidth - 38) / 2;
  const rows = Math.ceil(regular.length / 2);
  const fieldLines = fields ? doc.splitTextToSize(fields.replace(/^Campos\s*/i, ''), pageWidth - 38) : [];
  const panelHeight = 9 + rows * 9 + (fields ? fieldLines.length * 3.5 + 8 : 3);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, startY - 4, pageWidth - 28, panelHeight, 2, 2, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('Filtros aplicados', 18, startY + 2);
  let y = startY + 9;
  regular.forEach((item, index) => {
    const column = index % 2;
    if (column === 0 && index > 0) y += 9;
    const x = 18 + column * (columnWidth + 4);
    const split = item.indexOf(' ');
    const label = split > 0 ? item.slice(0, split) : item;
    const value = split > 0 ? item.slice(split + 1) : '';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(value, x + 22, y);
  });
  if (fields) {
    y += rows ? 9 : 0;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Campos:', 18, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(fieldLines, 39, y);
    y += fieldLines.length * 3.5;
  }
  doc.setTextColor(17, 24, 39);
  return startY + panelHeight + 5;
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
  const empresa = useEmpresa();
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
      await downloadCurrentReport(signatureName, empresa.data?.name || 'SalonPass');
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
