# 07 — Pagamentos (da comanda)

## User Stories
- Como admin, quero registrar pagamentos na comanda em uma ou várias formas.

## Critérios de Aceite
- O SISTEMA DEVE aceitar: dinheiro, pix, cartão de crédito, cartão de débito, crédito do cliente, cashback (boleto opcional).
- O SISTEMA DEVE permitir múltiplas formas de pagamento na mesma comanda.
- Cada pagamento DEVE ter: forma, conta financeira (Caixa/banco), valor bruto, descrição, vencimento, recebido de, categoria.
- O SISTEMA DEVE permitir estornar um pagamento.
- QUANDO pagamento em dinheiro, O SISTEMA DEVE lançar entrada no caixa aberto.
- QUANDO pix/cartão, O SISTEMA DEVE direcionar para caixa ou banco conforme config da forma (`goesToCash`).
- O SISTEMA DEVE reduzir o saldo da comanda a cada pagamento e finalizar quando quitada.

## Fora de escopo (fase 1)
- Pagamento online / gateway (Fase 5). Taxas/prazo de recebimento detalhados (Fase 2).
