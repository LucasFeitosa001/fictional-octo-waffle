import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCompany, useOrder } from '../lib/queries';
import { formatDate, formatMoney } from '../lib/format';

export type ModoImpressao = 'a4' | 'termica';

/**
 * Impressão da comanda — "Imprimir" (A4) e "Impressão térmica" (bobina 80 mm).
 *
 * Renderiza o recibo num nó IRMÃO do `#root` e deixa o `@media print` (em
 * `index.css`) esconder a aplicação. A alternativa comum — `window.open` +
 * `document.write` — morre em bloqueador de pop-up e no PWA do iOS, que é
 * justamente o "mobile" do pedido. Ver estudo 49.
 *
 * `@page` não aceita seletor de classe, então o tamanho do papel entra num
 * `<style>` escrito aqui, conforme o modo.
 */
export function ComandaImpressao({
  orderId,
  modo,
  onDone,
}: {
  orderId: string | null;
  modo: ModoImpressao;
  onDone: () => void;
}) {
  const pedido = useOrder(orderId ?? undefined);
  const empresa = useCompany();
  const d = pedido.data;
  const pronto = Boolean(orderId) && Boolean(d) && !pedido.isLoading;
  // Uma impressão por abertura: sem isto, cada refetch do react-query (foco na
  // janela, invalidação) dispararia o diálogo de novo.
  const jaImprimiu = useRef(false);

  useEffect(() => {
    if (!orderId) {
      jaImprimiu.current = false;
      return;
    }
    if (!pronto || jaImprimiu.current) return;
    jaImprimiu.current = true;

    const encerra = () => onDone();
    window.addEventListener('afterprint', encerra, { once: true });
    // Dois frames: o primeiro monta o portal, o segundo garante que o layout
    // (e a logo) já entraram antes do diálogo capturar a página.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', encerra);
    };
  }, [orderId, pronto, onDone]);

  const raiz = useMemo(() => {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('sp-print-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sp-print-root';
      document.body.appendChild(el);
    }
    return el;
  }, []);

  if (!orderId || !d || !raiz) return null;

  const termica = modo === 'termica';
  const emp = empresa.data;
  const desconto = Number(d.discountTotal ?? 0);
  const credito = Number(d.creditUsed ?? 0);
  const cashback = Number(d.cashbackUsed ?? 0);
  // Estornado não é pagamento: sai do recibo e não entra na soma.
  const pagos = d.payments.filter((p) => p.status !== 'reversed');
  const totalPago = pagos.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const restante = Number(d.netTotal ?? 0) - totalPago;

  return createPortal(
    <>
      <style>
        {termica
          ? '@page { size: 80mm auto; margin: 3mm; }'
          : '@page { size: A4; margin: 14mm; }'}
      </style>
      <div className={termica ? 'sp-print sp-print--termica' : 'sp-print sp-print--a4'}>
        <header className="sp-print__topo">
          {emp?.logoUrl && !termica && (
            <img src={emp.logoUrl} alt="" className="sp-print__logo" />
          )}
          <div>
            <strong className="sp-print__empresa">{emp?.name ?? 'Comanda'}</strong>
            {emp?.legalName && emp.legalName !== emp.name && (
              <div className="sp-print__linha-fraca">{emp.legalName}</div>
            )}
            {emp?.cnpj && <div className="sp-print__linha-fraca">CNPJ {emp.cnpj}</div>}
          </div>
        </header>

        <h1 className="sp-print__titulo">Comanda #{d.number}</h1>
        <div className="sp-print__meta">
          <span>Data: {formatDate(d.date)}</span>
          <span>Cliente: {d.customerName ?? d.customer?.name ?? 'Avulso'}</span>
          {d.professionalName && <span>Profissional: {d.professionalName}</span>}
        </div>

        <table className="sp-print__itens">
          <thead>
            <tr>
              <th>Item</th>
              <th className="sp-print__num">Qtd</th>
              <th className="sp-print__num">Unit.</th>
              <th className="sp-print__num">Total</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((it) => (
              <tr key={it.id}>
                <td>
                  {it.itemName ?? '—'}
                  {it.professionalName && (
                    <div className="sp-print__linha-fraca">{it.professionalName}</div>
                  )}
                </td>
                <td className="sp-print__num">{Number(it.quantity ?? 0)}</td>
                <td className="sp-print__num">{formatMoney(it.unitPrice)}</td>
                <td className="sp-print__num">
                  {formatMoney(Number(it.grossValue ?? 0) - Number(it.discount ?? 0))}
                </td>
              </tr>
            ))}
            {d.items.length === 0 && (
              <tr>
                <td colSpan={4}>Sem itens lançados.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="sp-print__totais">
          <Linha rotulo="Subtotal" valor={formatMoney(d.grossTotal)} />
          {desconto > 0 && <Linha rotulo="Descontos" valor={`− ${formatMoney(desconto)}`} />}
          {credito > 0 && <Linha rotulo="Crédito usado" valor={`− ${formatMoney(credito)}`} />}
          {cashback > 0 && <Linha rotulo="Cashback usado" valor={`− ${formatMoney(cashback)}`} />}
          <Linha rotulo="Total" valor={formatMoney(d.netTotal)} forte />
        </div>

        <div className="sp-print__pagamentos">
          <strong>Pagamentos</strong>
          {pagos.length === 0 ? (
            <div className="sp-print__linha-fraca">Nenhum pagamento registrado.</div>
          ) : (
            pagos.map((p) => (
              <Linha
                key={p.id}
                rotulo={`${p.paymentMethodName ?? p.description ?? 'Forma não informada'}${
                  p.status === 'paid' ? '' : ' (em aberto)'
                }`}
                valor={formatMoney(p.amount)}
              />
            ))
          )}
          {/* Arredonda para não imprimir "R$ 0,00 em aberto" por centavo de conta. */}
          {Math.abs(restante) >= 0.01 && (
            <Linha
              rotulo={restante > 0 ? 'Falta pagar' : 'Troco/crédito'}
              valor={formatMoney(Math.abs(restante))}
              forte
            />
          )}
        </div>

        {d.notes && (
          <div className="sp-print__obs">
            <strong>Observações</strong>
            <div>{d.notes}</div>
          </div>
        )}

        <footer className="sp-print__rodape">
          Emitido em {formatDate(new Date().toISOString())} · {emp?.name ?? ''}
        </footer>
      </div>
    </>,
    raiz,
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={forte ? 'sp-print__linha sp-print__linha--forte' : 'sp-print__linha'}>
      <span>{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}
