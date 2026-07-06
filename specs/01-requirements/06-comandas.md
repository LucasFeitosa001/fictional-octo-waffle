# 06 — Comandas

## User Stories
- Como admin, quero abrir uma comanda, adicionar serviços/produtos, aplicar descontos e finalizar a venda.

## Critérios de Aceite
- O SISTEMA DEVE listar comandas com número, cliente, data, valor, status; busca por cliente/número.
- O SISTEMA DEVE permitir CRUD: criar, abrir, editar, excluir, finalizar.
- O SISTEMA DEVE permitir adicionar serviço e produto (com quantidade, valor unitário, profissional vinculado).
- O SISTEMA DEVE permitir desconto, uso de crédito e uso de cashback antes do pagamento.
- O SISTEMA DEVE calcular automaticamente: valor bruto, descontos, total líquido.
- O SISTEMA DEVE vincular cliente, profissional, pacote e assinatura.
- QUANDO a comanda é finalizada, O SISTEMA DEVE registrar receita no financeiro, gerar lançamento de comissão e (opcional) permitir nota fiscal.
- O SISTEMA DEVE registrar histórico de status da comanda.
- Abas: Dados · Notas Fiscais.

## Regras
- Toda venda vira comanda. Itens: serviço, produto, pacote ou assinatura.
- Comanda pode ter múltiplos pagamentos (ver módulo Pagamentos).
