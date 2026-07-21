---
title: "Comissões"
category: "financeiro"
tags: ["comissões", "profissionais", "financeiro", "pagamentos", "percentual"]
excerpt: "Configure percentuais por profissional e serviço, e feche o mês com o cálculo automático de comissões."
icon: "percent"
faq: false
---

As comissões são a forma mais comum de remunerar profissionais em salões de beleza. No SalonPass, o módulo de **Comissões** calcula automaticamente quanto cada profissional tem a receber com base nos serviços realizados, produtos vendidos e pacotes atendidos, seguindo as regras que você configurar.

Com esse módulo, você elimina planilhas paralelas, evita erros de cálculo no fechamento do mês e dá total transparência para a equipe sobre o que foi comissionado (e o que ainda está pendente).

## O que o módulo faz

- Calcula comissões automaticamente a cada comanda fechada.
- Permite definir **percentuais diferentes** por profissional, por serviço, por produto ou por categoria.
- Diferencia comissão de **serviço, produto e pacote**, cada uma com sua regra.
- Considera descontos, formas de pagamento e taxas de cartão (se você optar por descontá-las da base).
- Gera relatórios de **resumo por período** para conferência e pagamento.
- Marca comissões como **pagas** para não misturar competências.

## Como usar

1. Vá em **Financeiro > Comissões > Configurações**.
2. Escolha o profissional na lista e defina o **percentual padrão** dele (ex.: 40% em serviços, 10% em produtos).
3. Se precisar de exceções, use **Regras por serviço** ou **Regras por produto** para sobrescrever o percentual padrão em itens específicos.
4. Defina a **base de cálculo**: valor cheio, valor com desconto aplicado, ou valor líquido após taxa de cartão. Essa escolha vale para todo o salão.
5. Salve as regras. A partir daí, toda comanda fechada já entra no cálculo automaticamente.
6. No fim do mês (ou quinzena), acesse **Comissões > Resumo**, filtre pelo período e pelo profissional.
7. Confira o total apurado. Se estiver tudo certo, clique em **Marcar como paga** e registre o pagamento em **Transações** para que ele apareça no fluxo de caixa.

Pronto: a comissão sai da sua "lista a pagar" e o profissional passa a ver apenas o próximo ciclo em aberto.

## Dicas para não errar no cálculo

- **Cadastre o percentual antes de abrir comandas.** Comissões calculadas com regra antiga não são recalculadas automaticamente ao alterar o percentual depois.
- **Padronize a base de cálculo** logo no início. Mudar de "valor cheio" para "valor com desconto" no meio do mês gera confusão na conferência.
- **Use categorias de serviço** (coloração, corte, manicure) para aplicar percentuais em bloco, em vez de item por item.
- Se um profissional atende com **produto próprio**, crie uma regra específica reduzindo a comissão daquele produto para zero.
- Sempre **feche a comanda no mesmo dia** do atendimento — comandas em aberto não entram no resumo do período.

## Perguntas frequentes

**A comissão é calculada sobre o valor bruto ou líquido?**
Depende da configuração escolhida em **Base de cálculo**. Você pode usar o valor cheio do serviço, o valor após desconto do cliente, ou o valor líquido descontando a taxa da maquininha. A regra vale para o salão inteiro, mas o percentual continua individual por profissional.

**E se dois profissionais atenderem a mesma cliente na mesma comanda?**
Sem problema. Ao lançar cada item na comanda, você seleciona qual profissional executou aquele serviço específico. A comissão vai automaticamente para quem foi indicado em cada linha — não é dividida pela comanda inteira.

**Posso alterar o percentual só de um serviço específico, sem mudar o padrão?**
Sim. Em **Configurações > Regras por serviço**, você cria uma exceção apenas para aquele item (por exemplo: escova padrão 40%, mas progressiva 25%). A regra específica sempre vence o percentual padrão do profissional.

**Comissões pagas somem do relatório?**
Não somem, apenas mudam de status. Você continua vendo o histórico completo em **Resumo**, filtrando por "Pagas", "Em aberto" ou "Todas". Isso é importante para conferência posterior e para a contabilidade.

**E as comissões de pacotes?**
Pacotes são comissionados conforme cada sessão é utilizada pelo cliente, não no momento da venda do pacote. Assim o profissional recebe pelo atendimento efetivamente realizado, e não por uma venda feita por outra pessoa.
