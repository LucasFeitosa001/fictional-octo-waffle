import { Button } from '@heroui/react';
import { IconChevron, IconWallet } from '../../components/icons';
import { formatMoney } from '../../lib/format';
import type { CommissionSummaryRow } from '../../lib/queries/comissoes';

/**
 * Lista de comissões por profissional NO CELULAR — cartão compacto.
 *
 * Existe porque `DataTable` no mobile (`components/DataTable.tsx:259`) vira uma
 * linha por COLUNA: com as nove colunas do resumo, cada profissional ocupava
 * Seleção · Comissões · Vales · Bonificações · Líquido · Valor vendido · Status ·
 * Assinatura · botões — e quatro pessoas enchiam a tela de rolagem. Aqui o
 * cartão diz o essencial (quem, quanto, quantos lançamentos) e o resto abre no
 * drawer de detalhe.
 *
 * Serve às DUAS abas do celular, por isso a `variante`: "Comissões em aberto"
 * mostra o líquido a pagar e o botão de pagar; "Comissões pagas" mostra o total
 * quitado. Uma lista para cada uma viraria duas cópias divergentes da mesma
 * coisa (estudo 47).
 */
export function ComissoesListaMobile({
  rows,
  variante,
  onAbrir,
  onPagar,
}: {
  rows: CommissionSummaryRow[];
  variante: 'aberto' | 'pagas';
  /** Toque no cartão — abre o detalhamento item a item. */
  onAbrir: (row: CommissionSummaryRow) => void;
  /** Só na variante "aberto": registra o pagamento daquele profissional. */
  onPagar?: (row: CommissionSummaryRow) => void;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label={
      variante === 'aberto' ? 'Comissões em aberto por profissional' : 'Comissões pagas por profissional'
    }>
      {rows.map((r) => {
        const podePagar = r.liquido > 0 && r.openCount > 0;
        return (
          <li key={r.professionalId}>
            <div
              role="button"
              tabIndex={0}
              onClick={(event) => {
                // Mesma proteção do DataTable: o toque no botão de pagar não
                // pode abrir o drawer de detalhe por baixo.
                const target = event.target;
                if (target instanceof Element && target.closest('button')) return;
                onAbrir(r);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onAbrir(r);
                }
              }}
              className="flex w-full flex-col gap-2 rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-3 text-left transition-colors active:bg-cream"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate font-medium uppercase text-foreground">
                  {r.professionalName}
                </span>
                <IconChevron size={16} className="shrink-0 -rotate-90 text-muted" />
              </div>

              {variante === 'aberto' ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted">
                      {r.openCount} lançamento(s) em aberto
                    </span>
                    <span className="text-lg font-bold text-data-income">
                      {formatMoney(r.liquido)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted">
                      Comissões {formatMoney(r.comissaoAberta)}
                      {r.vales > 0 && (
                        <span className="text-danger"> · Vales −{formatMoney(r.vales)}</span>
                      )}
                    </span>
                    {onPagar && (
                      <Button
                        variant="primary"
                        size="sm"
                        isDisabled={!podePagar}
                        onClick={() => onPagar(r)}
                      >
                        <IconWallet size={15} /> Pagar
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-muted">
                    {r.paidCount} lançamento(s) pago(s)
                    {r.bonus > 0 && ` · Bonificações ${formatMoney(r.bonus)}`}
                  </span>
                  <span className="text-lg font-bold text-data-income">
                    {formatMoney(r.total)}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
