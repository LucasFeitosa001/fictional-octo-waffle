# 08 — Caixa

## User Stories
- Como admin/responsável, quero abrir, conferir e fechar o caixa diário.

## Critérios de Aceite
- O SISTEMA DEVE permitir abrir caixa com saldo inicial e responsável.
- O SISTEMA DEVE registrar movimentações por forma de pagamento (dinheiro, cartão, pix, outros).
- O SISTEMA DEVE exibir resumo e detalhado: saldo inicial, movimentações, total a receber, saldo em caixa.
- QUANDO o caixa é fechado, O SISTEMA DEVE comparar saldo esperado × saldo conferido e exibir diferença.
- O SISTEMA DEVE manter histórico de caixas (número, abertura, fechamento, saldo inicial/conferido, responsável) com filtros por período e responsável.
- Só DEVE haver um caixa aberto por vez (por empresa/branch).

## Telas
- Caixa aberto #N (responsável, abas Resumo/Detalhado), Histórico de caixa.
