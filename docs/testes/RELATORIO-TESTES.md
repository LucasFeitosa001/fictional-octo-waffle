# Relatório da suíte de testes dos casos de uso

Data da execução: 27/07/2026.

## 1. Runner escolhido

Foi mantido o runner nativo do Node, `node:test`, já usado pelo teste
`dashboard.util.test.ts`. Não foi introduzido Jest.

O script adicionado a `apps/api/package.json` é:

```json
"test": "nest build && node --test --experimental-test-isolation=none dist/modules/usecase-tests/run-usecases.js"
```

A decisão evita dependências, transformadores e configurações novas, mantém o mesmo
modelo dos e2e existentes — compilar com Nest e executar JavaScript em `dist` — e
funciona hoje com Node v22.17.1 e pnpm 10.33.4. O agregador
`run-usecases.ts` carrega os arquivos no mesmo processo; isso permite que o TAP
conte cada `test()` individualmente. Sem o agregador, o isolamento padrão do
`node --test` reportaria arquivos TypeScript compilados como unidades, escondendo
a contagem individual das regras.

Os testes novos são unitários e usam doubles estritos dos repositórios Prisma.
Isso permite verificar cálculos, filtros, validações, alterações persistidas e
fronteiras de tenant sem banco. Não foi necessário criar um novo e2e: os gaps
priorizados podiam ser demonstrados de forma determinística antes de qualquer
I/O real. Os e2e existentes e seus scripts não foram alterados.

Nenhuma lógica de produção foi modificada.

## 2. Arquivos criados

| Arquivo completo | Cobertura |
|---|---|
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/agenda.usecases.test.ts` | Disponibilidade, colisão de horários, duração, expediente, profissional inativo e isolamento de tenant. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/orders-cash.usecases.test.ts` | Totais e regressões de comanda, teto de desconto, preço unitário zero, estorno, mudança direta de status, saldo e fechamento de caixa, forma de pagamento e consumo de plano. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/financial-commissions.usecases.test.ts` | Totais de compra, regras de comissão, auxiliares, data de disponibilidade, adiantamentos, pagamentos e período de comissão. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/customers-crm.usecases.test.ts` | Cashback, ajuste de ledger, timeline de WhatsApp, anamnese assinada, opt-out de campanhas e validade de promoções. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/catalog-stock.usecases.test.ts` | Baixo estoque, vínculos de tenant, movimentos, lotes, saldo negativo e custo médio. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/platform-access.usecases.test.ts` | Sessão multiempresa, segredo de autenticação, leitura de uploads, planos e adicionais. |
| `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/run-usecases.ts` | Agregador da suíte e inclusão das três regressões já existentes do funil do dashboard. |

Também foram criados o estudo obrigatório
`.claude/studies/13-suite-testes-casos-de-uso.md` e este relatório. A única
infraestrutura de teste alterada foi o script `test` de
`apps/api/package.json:12`.

Os testes que materializam lacunas conhecidas estão agrupados em
`describe('GAP: ...')`. Portanto, uma falha nesses grupos é o resultado esperado
da auditoria: ela torna executável a divergência entre o UC e o produto atual.

## 3. Resultado real da execução

Comando executado, literalmente:

```bash
pnpm --filter @beautypass/api test
```

O comando primeiro executou `nest build`, que terminou sem erro, e depois:

```bash
node --test --experimental-test-isolation=none dist/modules/usecase-tests/run-usecases.js
```

Resumo TAP real:

```text
# tests 52
# suites 24
# pass 19
# fail 33
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1346.905506
```

O processo terminou com código 1 devido às 33 asserções `GAP` que revelaram
comportamento ausente ou incorreto. Das falhas finais, 28 são da classe **(a)**,
5 da classe **(b)** e nenhuma é da classe **(c)**. As 19 aprovações incluem
regressões para bugs já corrigidos — preço unitário zero, desconto acima de 100%,
mudança direta de status, estorno de pagamento em comanda finalizada e funil do
dashboard — e, por isso, esses casos não são apresentados como bugs novos.

## 4. Classificação de cada falha

Classificação usada:

- **(a) bug real no produto:** a operação existe, mas viola regra, isolamento,
  cálculo ou consistência descritos pelo UC.
- **(b) comportamento que nunca existiu:** o próprio UC marca a capacidade como
  ausente e não há operação equivalente no código atual.
- **(c) teste mal escrito:** falso positivo ou premissa inválida do teste. Não
  restou nenhum caso dessa classe na execução final.

| # | Teste que falhou | Classe | Evidência no produto e no UC |
|---:|---|:---:|---|
| 1 | Agenda não deve oferecer expediente de profissional de outro tenant | (a) | A busca não filtra `companyId` em `apps/api/src/modules/appointments/appointments.service.ts:823-906`; o gap está em `docs/usecases/UC-01-agenda-atendimento.md:129-143`. |
| 2 | Agenda não deve oferecer slots quando o profissional está inativo | (a) | A relação só exige `deletedAt: null`, sem `active`/`generateSchedule`, em `appointments.service.ts:852-855`; exigência em `UC-01-agenda-atendimento.md:129-143`. |
| 3 | Total de `lowStock` deve representar apenas resultados filtrados | (a) | `count()` reutiliza apenas `companyId`, em `apps/api/src/modules/products/products.service.ts:47-61`; regra em `docs/usecases/UC-05-catalogo-estoque.md:687-701`. |
| 4 | Cadastro deve rejeitar categoria ou marca de outro tenant | (a) | O produto persiste IDs sem validar a empresa em `products.service.ts:73-77`; isolamento exigido em `UC-05-catalogo-estoque.md:50-57`. |
| 5 | Edição direta de saldo deve gerar `InventoryMovement` | (a) | `update()` altera o produto diretamente em `products.service.ts:80-86`; rastreabilidade de estoque em `UC-05-catalogo-estoque.md:17-20`. |
| 6 | Movimento manual deve ser incremento/decremento relativo e transacional | (a) | `stock` é tratado como valor absoluto em `products.service.ts:101-136`; regra em `UC-05-catalogo-estoque.md:41-48`. |
| 7 | Listagem de lotes deve retornar somente lote ativo, com saldo e não vencido | (a) | A consulta filtra apenas produto/empresa em `products.service.ts:242-250`; critérios em `UC-05-catalogo-estoque.md:37-39` e `725-745`. |
| 8 | Baixa de venda maior que estoque global deve ser rejeitada | (a) | A finalização decrementa sem validar saldo em `apps/api/src/modules/orders/orders.service.ts:1230-1288`; gap em `UC-05-catalogo-estoque.md:624-649`. |
| 9 | Consumo de lote vencido, inativo ou sem saldo deve ser rejeitado | (a) | A comanda valida existência, mas não validade/atividade/saldo, em `orders.service.ts:464-520`; regras em `UC-05-catalogo-estoque.md:37-45` e `725-745`. |
| 10 | Entrada de compra deve atualizar `costPrice` pelo custo médio ponderado | (b) | A entrada só incrementa saldo em `apps/api/src/modules/purchases/purchases.service.ts:308-333`; o UC declara o cálculo ausente em `UC-05-catalogo-estoque.md:703-723`. |
| 11 | Extrato não deve somar cashback expirado | (a) | A listagem soma todos os lançamentos sem filtrar expiração em `apps/api/src/modules/customers/customers.service.ts:424-431`; regra em `docs/usecases/UC-04-clientes-crm-marketing.md:132-141`. |
| 12 | Ajuste negativo não deve deixar o ledger abaixo de zero | (a) | O ajuste cria o lançamento sem consultar saldo em `customers.service.ts:479-490`; regra de saldo em `UC-04-clientes-crm-marketing.md:132-141`. |
| 13 | Timeline não deve misturar `WhatsappOutbox` de outro tenant | (a) | A busca por sufixo de telefone não inclui empresa em `customers.service.ts:689-700`; isolamento em `UC-04-clientes-crm-marketing.md:29-33` e `197-206`. |
| 14 | Anamnese assinada não deve permitir alterar respostas ou remover assinatura | (a) | `updateAnamnesis` aceita `answers` e `signatureUrl` após assinatura em `customers.service.ts:632-654`; imutabilidade em `UC-04-clientes-crm-marketing.md:171-180`. |
| 15 | Prévia `withPhone` deve respeitar opt-out | (a) | O filtro verifica apenas `phone != null` em `apps/api/src/modules/campaigns/campaigns.service.ts:309-318`; regra em `UC-04-clientes-crm-marketing.md:210-219`. |
| 16 | Promoção com fim anterior ao início deve ser rejeitada | (a) | `createPromotion()` persiste as datas sem comparar ordem em `apps/api/src/modules/marketing/marketing.service.ts:279-293`; regra em `UC-04-clientes-crm-marketing.md:392-401`. |
| 17 | Total de compra deve somar outras despesas e subtrair outras receitas | (a) | O total usa somente itens/desconto/frete em `purchases.service.ts:107` e `284-296`; fórmula em `docs/usecases/UC-03-financeiro-comissoes.md:204-213`. |
| 18 | Comissão deve usar regra global quando não existe regra específica | (a) | O cálculo consulta regras do profissional e cai em percentual fixo, ignorando a configuração global, em `orders.service.ts:1149-1219`; precedência em `UC-03-financeiro-comissoes.md:237-246`. |
| 19 | Comissão deve gerar parcela do auxiliar do item | (a) | A geração percorre apenas o profissional principal em `orders.service.ts:1082-1136`; regra em `UC-03-financeiro-comissoes.md:259-271` e `docs/usecases/UC-02-comandas-caixa.md:75-85`. |
| 20 | Pagamento deve selecionar apenas entradas com `availableDate` vencida | (a) | A consulta de pendências omite `availableDate` em `apps/api/src/modules/commissions/commissions.service.ts:390-402`; regra em `UC-03-financeiro-comissoes.md:306-315`. |
| 21 | Pagamento deve rejeitar profissional de outro tenant | (a) | O ID informado entra nas consultas e na criação sem validar empresa em `commissions.service.ts:384-442`; fronteira em `UC-03-financeiro-comissoes.md:306-315`. |
| 22 | Vale maior que a comissão disponível não deve ser consumido integralmente | (a) | O débito usa o valor inteiro do vale em `commissions.service.ts:404-456`; compensação limitada ao disponível em `UC-03-financeiro-comissoes.md:306-315`. |
| 23 | Entrada não pode virar `paid` sem `CommissionPayment` | (a) | `updateEntry()` permite alterar o status diretamente em `commissions.service.ts:356-367`; fluxo contábil em `UC-03-financeiro-comissoes.md:284-293`. |
| 24 | Deve existir operação de abertura e fechamento de período de comissão | (b) | Controller e service não oferecem a operação em `apps/api/src/modules/commissions/commissions.controller.ts:37-273` e `commissions.service.ts:438-478`; ausência declarada em `UC-03-financeiro-comissoes.md:328-337`. |
| 25 | Movimento de caixa deve rejeitar forma de pagamento de outro tenant | (a) | `createMovement()` usa o ID sem validar empresa em `apps/api/src/modules/cash-registers/cash-registers.module.ts:231-270`; regra em `UC-02-comandas-caixa.md:214-223`. |
| 26 | Fechamento de caixa deve persistir a anotação informada | (a) | O DTO aceita `notes`, mas o update omite o campo, em `cash-registers.module.ts:30-36` e `330-344`; fluxo em `UC-02-comandas-caixa.md:225-234`. |
| 27 | Plano deve expor consumo com saldo por ciclo e estorno | (b) | Memberships só oferece CRUD/consulta em `apps/api/src/modules/memberships/memberships.controller.ts:31-94` e `memberships.service.ts:100-179`; ausência em `UC-02-comandas-caixa.md:354-363`. |
| 28 | Troca de empresa sem `sessionId` deve ser rejeitada | (a) | O fallback altera `User.companyId`, estado global entre sessões, em `apps/api/src/auth/auth.service.ts:142-162`; sessão por empresa em `docs/usecases/UC-06-plataforma-acesso.md:267-315`. |
| 29 | `/session/me` deve devolver a empresa ativa da sessão | (a) | O endpoint lê `request.user.companyId` global em `auth.service.ts:20-24` e `180-198`; divergência descrita em `UC-06-plataforma-acesso.md:1194-1199`. |
| 30 | Não deve existir segredo Better Auth conhecido como fallback | (a) | Há literal previsível em `apps/api/src/auth/better-auth.ts:105-109`; exigência e risco em `UC-06-plataforma-acesso.md:68-72` e `1255-1258`. |
| 31 | Leitura de upload deve exigir autenticação e contexto de tenant | (a) | `GET /uploads/:filename` é público e busca só pelo nome em `apps/api/src/modules/uploads/uploads.controller.ts:112-127`; gap em `UC-06-plataforma-acesso.md:1152-1157`. |
| 32 | Plataforma deve possuir mutação real para alterar/cancelar plano | (b) | Feature flags oferecem apenas leitura em `apps/api/src/modules/feature-flags/feature-flags.controller.ts:1-52`; ausência em `UC-06-plataforma-acesso.md:783-826`. |
| 33 | Plataforma deve possuir mutação real para contratar/remover adicionais | (b) | Não há operação de add-on no controller em `feature-flags.controller.ts:1-52`; ausência em `UC-06-plataforma-acesso.md:828-870`. |

Uma fixture incompleta foi identificada na primeira compilação da suíte e corrigida
antes da execução final. Como ela não aparece no resultado final, não foi
contabilizada como falha nem como classe (c).

## 5. Dez bugs reais mais graves

Os itens abaixo excluem deliberadamente capacidades da classe (b) e os bugs que o
contexto da tarefa informou como já corrigidos.

1. **Crítico — segredo previsível de autenticação.** Se
   `BETTER_AUTH_SECRET` faltar, o backend usa um literal conhecido, permitindo
   falsificação de sessão em um ambiente mal configurado. Código:
   `apps/api/src/auth/better-auth.ts:105-109`. UC:
   `docs/usecases/UC-06-plataforma-acesso.md:68-72` e `1255-1258`.

2. **Crítico — vazamento de timeline de WhatsApp entre empresas.** A consulta
   procura o sufixo do telefone em `WhatsappOutbox` sem `companyId`; empresas com
   números coincidentes podem ver metadados de mensagens umas das outras. Código:
   `apps/api/src/modules/customers/customers.service.ts:689-700`. UC:
   `docs/usecases/UC-04-clientes-crm-marketing.md:29-33` e `197-206`.

3. **Crítico — uploads podem ser lidos sem autenticação nem tenant.** Conhecer ou
   descobrir o nome do arquivo basta para acessar o conteúdo, sem conferir
   proprietário ou empresa. Código:
   `apps/api/src/modules/uploads/uploads.controller.ts:112-127`. UC:
   `docs/usecases/UC-06-plataforma-acesso.md:1152-1157`.

4. **Alto — troca de empresa sem sessão altera estado global do usuário.** Na
   ausência de `sessionId`, a operação grava `User.companyId`, podendo afetar
   outras sessões simultâneas e romper o isolamento multiempresa. Código:
   `apps/api/src/auth/auth.service.ts:142-162`. UC:
   `docs/usecases/UC-06-plataforma-acesso.md:267-315`.

5. **Alto — `/session/me` usa a última empresa global, não a empresa da sessão.**
   Duas sessões do mesmo usuário podem receber a empresa errada, com risco de
   operar no tenant incorreto. Código:
   `apps/api/src/auth/auth.service.ts:20-24` e `180-198`. UC:
   `docs/usecases/UC-06-plataforma-acesso.md:1194-1199`.

6. **Alto — pagamento de comissão aceita profissional de outra empresa.** O ID
   externo não é validado contra `companyId`, permitindo vínculo financeiro
   cruzado e até registro de pagamento sem entradas válidas. Código:
   `apps/api/src/modules/commissions/commissions.service.ts:384-442`. UC:
   `docs/usecases/UC-03-financeiro-comissoes.md:306-315`.

7. **Alto — produto aceita categoria ou marca de outro tenant.** IDs são
   persistidos sem validar a empresa, criando referência cruzada e exposição
   indireta de catálogo. Código:
   `apps/api/src/modules/products/products.service.ts:73-77`. UC:
   `docs/usecases/UC-05-catalogo-estoque.md:50-57`.

8. **Alto — finalização de venda permite estoque global negativo.** A baixa faz
   `decrement` sem conferir disponibilidade, corrompendo saldo e indicadores.
   Código: `apps/api/src/modules/orders/orders.service.ts:1230-1288`. UC:
   `docs/usecases/UC-05-catalogo-estoque.md:624-649`.

9. **Alto — lote vencido, inativo ou sem saldo pode ser consumido.** A comanda
   confere apenas se o lote existe, permitindo venda inválida e saldo negativo por
   lote. Código: `apps/api/src/modules/orders/orders.service.ts:464-520`. UC:
   `docs/usecases/UC-05-catalogo-estoque.md:37-45` e `725-745`.

10. **Alto — adiantamento maior que a comissão perde todo o excedente.** A
    compensação debita o valor integral do vale mesmo quando a comissão disponível
    é menor, apagando crédito do profissional. Código:
    `apps/api/src/modules/commissions/commissions.service.ts:404-456`. UC:
    `docs/usecases/UC-03-financeiro-comissoes.md:306-315`.

## Conclusão

A suíte funciona no runner atual, não depende de banco e separa regressões
aprovadas de lacunas intencionais. O resultado de 33 falhas não é uma falha de
infraestrutura: é o inventário executável do comportamento divergente. Para uma
pipeline de correção incremental, cada grupo `GAP` pode ser convertido em teste
de regressão aprovado à medida que a lógica de produção for corrigida.
