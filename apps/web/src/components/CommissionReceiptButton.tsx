import { useState } from 'react';
import { IconDownload, IconX } from './icons';

export interface CommissionReceiptData {
  companyName?: string;
  companyLogoUrl?: string | null;
  professionalName: string;
  paidAt: string;
  createdAt?: string;
  amount: number;
  commissionTotal: number;
  bonusTotal: number;
  advancesTotal: number;
  entriesCount: number;
  from?: string;
  to?: string;
}

/** Baixa um recibo individual, pronto para a assinatura do profissional. */
export function CommissionReceiptButton({ data, compact = false }: { data: CommissionReceiptData; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [signatureName, setSignatureName] = useState(data.professionalName);

  async function download() {
    const { default: JsPDF } = await import('jspdf');
    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const width = doc.internal.pageSize.getWidth();
    const themePrimary = getComputedStyle(document.documentElement).getPropertyValue('--sp-primary').trim() || '#4f46e5';
    const colorCanvas = document.createElement('canvas');
    const colorContext = colorCanvas.getContext('2d');
    if (!colorContext) throw new Error('canvas indisponível');
    colorContext.fillStyle = themePrimary;
    const normalizedColor = colorContext.fillStyle;
    const colorParts = normalizedColor.match(/\d+/g)?.map(Number) ?? [79, 70, 229];
    const [primaryR, primaryG, primaryB] = colorParts.length >= 3 ? colorParts : [79, 70, 229];
    // A Helvetica embutida do jsPDF não tem o menos tipográfico (−, U+2212), o
    // travessão nem o espaço fino: eles saem como aspas com os dígitos
    // espalhados. Num recibo que o profissional ASSINA, isso é inaceitável —
    // e era exatamente o que acontecia na linha dos vales. Ver estudo 97.
    const ascii = (t: string) =>
      t
        .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
        .replace(/[\u00a0\u2007\u202f\u2009]/g, ' ');
    const money = (value: number) =>
      ascii(value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    const date = (value: string) => {
      // Datas de competência vêm como YYYY-MM-DD. Criar `new Date` diretamente
      // interpreta esse formato em UTC e pode voltar um dia no fuso do salão.
      const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? (() => {
            const [year, month, day] = value.split('-').map(Number);
            return new Date(year, month - 1, day);
          })()
        : new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('pt-BR');
    };
    // O PNG antigo com nome `salonpass-logo` era, na verdade, a marca
    // BeautyPass. No recibo usamos o wordmark oficial branco do SalonPass
    // sobre a faixa azul da marca.
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
      doc.setFillColor(primaryR, primaryG, primaryB);
      doc.rect(0, 0, width, 9, 'F');
      doc.roundedRect(18, 12, 42, 10, 2, 2, 'F');
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 21, 14, 36, 6);
    } catch {
      // Mesmo sem o SVG, a faixa temática e o nome da marca permanecem.
      doc.setFillColor(primaryR, primaryG, primaryB);
      doc.rect(0, 0, width, 9, 'F');
      doc.roundedRect(18, 12, 42, 10, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('salonpass', 25, 18.3);
    }
    const slug = data.professionalName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profissional';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('Recibo de pagamento de comissão', 18, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const companyLabel = data.companyName || 'Empresa';
    const companyX = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(companyLabel, companyX, 40);
    const companyWidth = doc.getTextWidth(companyLabel);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(' · Comissões', companyX + companyWidth + 1.5, 40);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(18, 46, width - 36, 34, 3, 3, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('PROFISSIONAL', 25, 56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    // Nome longo invadia o bloco de "Pagamento:" à direita; corta na largura útil.
    doc.text(
      doc.splitTextToSize(ascii(data.professionalName), width - 25 - 82)[0] ?? '',
      25,
      64,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Pagamento: ${date(data.paidAt)}`, width - 78, 56);
    if (data.from || data.to) doc.text(`Período: ${date(data.from ?? '')} a ${date(data.to ?? '')}`, width - 78, 64);

    let y = 98;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo do pagamento', 18, y);
    y += 10;
    const lines: [string, string][] = [
      ['Comissões', money(data.commissionTotal)],
      ['Bonificações', money(data.bonusTotal)],
      ['Vales descontados', `- ${money(data.advancesTotal)}`],
      ['Lançamentos quitados', String(data.entriesCount)],
    ];
    doc.setFontSize(10);
    lines.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); doc.text(ascii(label), 22, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42); doc.text(ascii(value), width - 22, y, { align: 'right' });
      doc.setDrawColor(226, 232, 240); doc.line(18, y + 3, width - 18, y + 3); y += 9;
    });
    // O destaque do valor líquido acompanha a mesma cor do cabeçalho, mas
    // suavizada para preservar contraste e leitura no papel.
    doc.setFillColor(
      Math.round(primaryR + (255 - primaryR) * 0.88),
      Math.round(primaryG + (255 - primaryG) * 0.88),
      Math.round(primaryB + (255 - primaryB) * 0.88),
    );
    doc.roundedRect(18, y + 3, width - 36, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(primaryR, primaryG, primaryB);
    doc.text('Valor líquido pago', 25, y + 15);
    doc.text(money(data.amount), width - 25, y + 15, { align: 'right' });

    y += 55;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    const declaration = 'Declaro ter recebido o valor acima referente às comissões apuradas no período indicado.';
    doc.text(doc.splitTextToSize(declaration, width - 36), 18, y);
    y += 38;
    doc.setDrawColor(51, 65, 85); doc.line(58, y, width - 58, y);
    doc.setFontSize(9); doc.text(ascii(signatureName.trim() || data.professionalName), width / 2, y + 6, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(100, 116, 139); doc.text('Assinatura do profissional', width / 2, y + 12, { align: 'center' });
    doc.text(`Emitido em ${date(new Date().toISOString())}`, 18, 282);
    doc.text('Documento gerado pelo SalonPass', width - 18, 282, { align: 'right' });
    doc.save(`recibo-comissao-${slug}-${date(data.paidAt).replace(/\//g, '-')}.pdf`);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={(event) => { event.stopPropagation(); setOpen(true); }} className={compact ? 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10' : 'inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:border-primary hover:text-primary'}>
        <IconDownload size={15} /> {compact ? 'Recibo' : 'Baixar recibo'}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Gerar recibo de comissão</h2>
                <p className="mt-1 text-sm text-muted">Informe o profissional que assinará o recebimento.</p>
              </div>
              <button type="button" className="rounded-lg p-1 text-muted hover:bg-cream" onClick={() => setOpen(false)} aria-label="Fechar"><IconX size={18} /></button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
              Nome para assinatura
              <input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} className="h-10 rounded-lg border border-line bg-white px-3 outline-none focus:border-primary" placeholder="Nome do profissional" />
            </label>
            <p className="mt-3 text-xs text-muted">O PDF será baixado diretamente com a linha de assinatura e os dados deste pagamento.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-foreground" onClick={() => setOpen(false)}>Cancelar</button>
              <button type="button" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white" onClick={() => void download()}>Gerar e baixar PDF</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
