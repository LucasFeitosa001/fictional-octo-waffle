# UC-05 — Catálogo e estoque

## Escopo, conceitos e critérios

Este documento descreve o comportamento observado no código do catálogo e do estoque: produtos, lotes, categorias, marcas, serviços, categorias de serviço, fornecedores, compras e a baixa decorrente de comandas. Os estados usados são:

- **IMPLEMENTADO**: o fluxo principal existe de ponta a ponta e suas regras essenciais estão aplicadas.
- **PARCIAL**: o fluxo existe, mas há regra, integração, validação ou consistência relevante incompleta.
- **AUSENTE**: não foi encontrado fluxo executável para a capacidade descrita.

O saldo global é `Product.stock`, enquanto o saldo de um lote é `ProductBatch.quantity`; são colunas independentes (`packages/db/prisma/schema.prisma:1005`, `packages/db/prisma/schema.prisma:1018`, `packages/db/prisma/schema.prisma:1349`, `packages/db/prisma/schema.prisma:1356`). O custo cadastral e o preço de venda também são independentes (`Product.costPrice` e `Product.salePrice`) e o custo efetivo de cada compra fica em `PurchaseItem.unitCost` (`packages/db/prisma/schema.prisma:1012`, `packages/db/prisma/schema.prisma:1015`, `packages/db/prisma/schema.prisma:1141`, `packages/db/prisma/schema.prisma:1143`).

## Diagnóstico transversal obrigatório

### 1. Quem soma e quem subtrai o estoque

| Momento | `Product.stock` | `ProductBatch.quantity` | Movimento/auditoria | Evidência |
|---|---|---|---|---|
| Cadastro de produto | Pode definir o saldo inicial diretamente. | Não altera. | Não cria `InventoryMovement`. | `apps/api/src/modules/products/dto.ts:22`, `apps/api/src/modules/products/products.service.ts:73`, `apps/api/src/modules/products/products.service.ts:77` |
| Edição de produto | Pode substituir `stock` diretamente. | Não altera. | Não cria `InventoryMovement`. | `apps/web/src/pages/ProdutosPage.tsx:1397`, `apps/web/src/pages/ProdutosPage.tsx:1401`, `apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:86` |
| Movimento manual `in` | Soma a quantidade. | Não altera. | Cria `InventoryMovement(in)`. | `apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:109`, `apps/api/src/modules/products/products.service.ts:122`, `apps/api/src/modules/products/products.service.ts:135` |
| Movimento manual `out` | Subtrai e rejeita o resultado menor que zero. | Não altera. | Cria `InventoryMovement(out)`. | `apps/api/src/modules/products/products.service.ts:110`, `apps/api/src/modules/products/products.service.ts:116`, `apps/api/src/modules/products/products.service.ts:122`, `apps/api/src/modules/products/products.service.ts:135` |
| Movimento manual `adjust` | Substitui o saldo pelo valor informado. | Não altera. | Cria `InventoryMovement(adjust)` cuja quantidade é o novo saldo, não a diferença. | `apps/api/src/modules/products/products.service.ts:117`, `apps/api/src/modules/products/products.service.ts:133` |
| Cadastro/edição de lote | Não altera. | Define/substitui diretamente a quantidade. | Não cria `InventoryMovement`. | `apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:269`, `apps/api/src/modules/products/products.service.ts:272`, `apps/api/src/modules/products/products.service.ts:290` |
| Criação de compra | Soma cada item ao saldo global. | Não altera lote. | Cria `InventoryMovement(in, refType=purchase)`. | `apps/api/src/modules/purchases/purchases.service.ts:146`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:330` |
| Edição de itens da compra | Subtrai a entrada antiga e soma a nova. | Não altera lote. | Registra `out` de estorno e novos `in`. | `apps/api/src/modules/purchases/purchases.service.ts:162`, `apps/api/src/modules/purchases/purchases.service.ts:193`, `apps/api/src/modules/purchases/purchases.service.ts:336`, `apps/api/src/modules/purchases/purchases.service.ts:368` |
| Exclusão de compra | Subtrai a entrada original; bloqueia se o saldo calculado ficar negativo. | Não altera lote. | Cria `InventoryMovement(out, refType=purchase)`. | `apps/api/src/modules/purchases/purchases.service.ts:247`, `apps/api/src/modules/purchases/purchases.service.ts:269`, `apps/api/src/modules/purchases/purchases.service.ts:348`, `apps/api/src/modules/purchases/purchases.service.ts:368` |
| Adição de produto consumido em serviço | Subtrai imediatamente, ainda com a comanda aberta. | Subtrai se foi escolhido lote. | Cria `InventoryMovement(out, refType=order_consumed)`. | `apps/api/src/modules/orders/orders.service.ts:424`, `apps/api/src/modules/orders/orders.service.ts:496` |
| Remoção de produto consumido/item de serviço | Soma de volta. | Soma de volta se havia lote. | Cria `InventoryMovement(in)` e exclui `OrderItemConsumedProduct`. | `apps/api/src/modules/orders/orders.service.ts:373`, `apps/api/src/modules/orders/orders.service.ts:380`, `apps/api/src/modules/orders/orders.service.ts:520`, `apps/api/src/modules/orders/orders.service.ts:551` |
| Finalização de venda direta de produto | Subtrai somente ao finalizar a comanda. | Subtrai se o item tem lote. | Cria `InventoryMovement(out, refType=order)`. | `apps/api/src/modules/orders/orders.service.ts:733`, `apps/api/src/modules/orders/orders.service.ts:741`, `apps/api/src/modules/orders/orders.service.ts:846`, `apps/api/src/modules/orders/orders.service.ts:851`, `apps/api/src/modules/orders/orders.service.ts:1206`, `apps/api/src/modules/orders/orders.service.ts:1224` |
| Reabertura de comanda finalizada | Soma de volta apenas produtos vendidos. | Soma de volta o lote da venda. | Cria `InventoryMovement(in)` compensatório. | `apps/api/src/modules/orders/orders.service.ts:1313`, `apps/api/src/modules/orders/orders.service.ts:1363`, `apps/api/src/modules/orders/orders.service.ts:1367`, `apps/api/src/modules/orders/orders.service.ts:1422` |
| Cancelamento por `DELETE /orders/:id` | Estorna vendidos se a comanda estava finalizada e estorna todos os consumidos. | Faz os mesmos estornos nos lotes associados. | Vendidos são estornados em uma transação; consumidos são estornados um a um. | `apps/api/src/modules/orders/orders.service.ts:1446`, `apps/api/src/modules/orders/orders.service.ts:1468` |
| Cancelamento por `PATCH /orders/:id` com `status=canceled` | Não há reconciliação de estoque nesse caminho. | Não há reconciliação. | Apenas altera o status e cria histórico. | `apps/api/src/modules/orders/dto.ts:25`, `apps/api/src/modules/orders/orders.service.ts:1425`, `apps/api/src/modules/orders/orders.service.ts:1443` |

**Conclusão de consistência:** `Product.stock` não é derivado de `InventoryMovement` e `ProductBatch.quantity` não é reconciliado com o saldo global. Movimentos manuais e compras só alteram `Product.stock`, enquanto CRUD de lote só altera `ProductBatch.quantity` (`apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:137`, `apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:290`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`). Portanto, os dois saldos podem divergir por operação normal.

### 2. Tratamento de lotes vencidos

O backend ordena lotes por ativo e validade, mas não filtra `active=true`, saldo positivo ou `expiresAt >= hoje` (`apps/api/src/modules/products/products.service.ts:242`, `apps/api/src/modules/products/products.service.ts:250`). A tela da comanda oferece todos os lotes retornados, exibindo apenas código e eventual quantidade positiva, sem desabilitar lote vencido/inativo/zerado (`apps/web/src/components/ItemEditDrawer.tsx:269`, `apps/web/src/components/ItemEditDrawer.tsx:289`, `apps/web/src/components/ItemEditDrawer.tsx:654`, `apps/web/src/components/ItemEditDrawer.tsx:669`). Ao associar lote a venda ou consumo, a API valida empresa e produto, mas não validade, atividade ou saldo do lote (`apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:447`). **Resultado confirmado:** lote vencido é aceito; a validade é informativa e não bloqueia venda/consumo.

### 3. Possibilidade de estoque negativo e concorrência

- A venda direta decrementa `Product.stock` e `ProductBatch.quantity` sem verificar disponibilidade; uma única comanda com quantidade maior que o saldo já pode produzir valor negativo (`apps/api/src/modules/orders/orders.service.ts:1201`, `apps/api/src/modules/orders/orders.service.ts:1224`).
- O consumo verifica apenas o saldo global lido antes da transação, mas nunca verifica `ProductBatch.quantity`; o lote pode ficar negativo mesmo quando o saldo global não fica (`apps/api/src/modules/orders/orders.service.ts:437`, `apps/api/src/modules/orders/orders.service.ts:454`, `apps/api/src/modules/orders/orders.service.ts:489`, `apps/api/src/modules/orders/orders.service.ts:493`).
- O lock explícito na finalização é sobre a linha da comanda, não sobre produto/lote (`apps/api/src/modules/orders/orders.service.ts:762`, `apps/api/src/modules/orders/orders.service.ts:770`). Assim, comandas diferentes podem decrementar o mesmo produto simultaneamente.
- O movimento manual calcula `nextStock` antes de iniciar a transação e depois grava valor absoluto (`apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:122`, `apps/api/src/modules/products/products.service.ts:133`). **Inferência técnica:** duas requisições concorrentes podem ambas validar o mesmo saldo, criar dois movimentos e uma sobrescrever o resultado da outra, deixando saldo e razão de movimentos divergentes.
- A compra carrega o estoque antes da transação e também grava valor absoluto (`apps/api/src/modules/purchases/purchases.service.ts:103`, `apps/api/src/modules/purchases/purchases.service.ts:109`, `apps/api/src/modules/purchases/purchases.service.ts:317`, `apps/api/src/modules/purchases/purchases.service.ts:320`). **Inferência técnica:** compra concorrente com compra, venda ou ajuste pode perder atualização.
- O estorno de compra lê, valida e depois grava sem `FOR UPDATE`/update condicional (`apps/api/src/modules/purchases/purchases.service.ts:342`, `apps/api/src/modules/purchases/purchases.service.ts:358`). **Inferência técnica:** a validação não garante o saldo até o momento da escrita em concorrência.

### 4. Auditoria de escopo por `companyId`

Os controllers do domínio recebem `companyId` do usuário autenticado e aplicam permissões (`apps/api/src/modules/products/products.controller.ts:29`, `apps/api/src/modules/products/products.controller.ts:210`, `apps/api/src/modules/services/services.controller.ts:19`, `apps/api/src/modules/services/services.controller.ts:77`, `apps/api/src/modules/suppliers/suppliers.controller.ts:19`, `apps/api/src/modules/suppliers/suppliers.controller.ts:69`, `apps/api/src/modules/purchases/purchases.controller.ts:19`, `apps/api/src/modules/purchases/purchases.controller.ts:80`). Não foi encontrado endpoint público nesses controllers. Porém, há queries/mutações internas sem filtro literal de empresa:

| Ponto sem `companyId` explícito | Defesa existente | Gap/risco cross-tenant |
|---|---|---|
| `product.create/update` aceita `categoryId` e `brandId` sem validar a empresa da categoria/marca (`apps/api/src/modules/products/products.service.ts:73`, `apps/api/src/modules/products/products.service.ts:86`). | A própria linha de produto recebe/valida `companyId` (`apps/api/src/modules/products/products.service.ts:65`, `apps/api/src/modules/products/products.service.ts:75`). | **Alto:** é possível tentar vincular categoria/marca de outra empresa; listagens incluem essas relações e podem expor seus nomes (`apps/api/src/modules/products/products.service.ts:48`, `apps/api/src/modules/products/products.service.ts:51`). |
| `service.create/update` aceita `categoryId` sem validar empresa (`apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:48`). | O serviço é criado com `companyId` e a linha editada é localizada antes com empresa (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:43`). | **Alto:** categoria cross-tenant pode ser ligada e retornada pelo `include category` da listagem (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:27`). |
| Updates/deletes de produto usam `where: { id }` depois de `findOne(companyId,id)` (`apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:97`). | Pré-checagem por empresa e IDs globais. | **Baixo, defesa indireta:** não há filtro atômico na escrita; a segurança depende da pré-checagem separada. |
| Updates/deletes de categoria usam `where: { id }`; a contagem de vínculos usa só `categoryId` (`apps/api/src/modules/products/products.service.ts:153`, `apps/api/src/modules/products/products.service.ts:182`). | A categoria é localizada por `id+companyId` antes (`apps/api/src/modules/products/products.service.ts:158`, `apps/api/src/modules/products/products.service.ts:172`). | **Baixo:** defesa indireta; a contagem também não explicita empresa. |
| Updates/deletes de marca usam `where: { id }`; a contagem usa só `brandId` (`apps/api/src/modules/products/products.service.ts:216`, `apps/api/src/modules/products/products.service.ts:238`). | A marca é localizada por `id+companyId` antes (`apps/api/src/modules/products/products.service.ts:217`, `apps/api/src/modules/products/products.service.ts:228`). | **Baixo:** defesa indireta; dados cross-tenant corrompidos poderiam afetar a decisão de exclusão. |
| Movimento manual cria `InventoryMovement` e atualiza produto apenas por `productId/id` (`apps/api/src/modules/products/products.service.ts:122`, `apps/api/src/modules/products/products.service.ts:135`). | `findOne(companyId,id)` é executado antes (`apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:102`). | **Baixo:** defesa indireta; `InventoryMovement` não possui `companyId` próprio (`packages/db/prisma/schema.prisma:1089`, `packages/db/prisma/schema.prisma:1101`). |
| Update/delete de lote e contagens de referências usam somente o ID após pré-checagem (`apps/api/src/modules/products/products.service.ts:272`, `apps/api/src/modules/products/products.service.ts:310`). | Lote é localizado por `id+companyId` (`apps/api/src/modules/products/products.service.ts:273`, `apps/api/src/modules/products/products.service.ts:297`). | **Baixo:** defesa indireta; as contagens não explicitam empresa (`apps/api/src/modules/products/products.service.ts:301`, `apps/api/src/modules/products/products.service.ts:304`). |
| Update/delete de serviço usam `where:{id}` (`apps/api/src/modules/services/services.service.ts:46`, `apps/api/src/modules/services/services.service.ts:59`). | `findOne(id,companyId)` anterior (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:52`). | **Baixo:** defesa indireta, não atômica. |
| Update/delete de fornecedor usam `where:{id}` (`apps/api/src/modules/suppliers/suppliers.service.ts:42`, `apps/api/src/modules/suppliers/suppliers.service.ts:63`). | `findOne(id,companyId)` anterior (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:28`). | **Baixo:** defesa indireta, não atômica. |
| Listagem/detalhe de compra incluem e pesquisam relações de fornecedor/conta/forma sem repetir `companyId` na relação (`apps/api/src/modules/purchases/purchases.service.ts:28`, `apps/api/src/modules/purchases/purchases.service.ts:55`, `apps/api/src/modules/purchases/purchases.service.ts:84`, `apps/api/src/modules/purchases/purchases.service.ts:97`). | A compra raiz é filtrada por empresa e os fluxos normais validam cada referência antes de gravar (`apps/api/src/modules/purchases/purchases.service.ts:28`, `apps/api/src/modules/purchases/purchases.service.ts:45`, `apps/api/src/modules/purchases/purchases.service.ts:392`, `apps/api/src/modules/purchases/purchases.service.ts:417`). | **Baixo/Médio:** dados importados/corrompidos com relação cross-tenant poderiam expor os campos incluídos. |
| Na compra, `purchaseItem.deleteMany/createMany`, `purchase.update/delete` e `findOneTx` operam por IDs sem empresa (`apps/api/src/modules/purchases/purchases.service.ts:168`, `apps/api/src/modules/purchases/purchases.service.ts:242`, `apps/api/src/modules/purchases/purchases.service.ts:254`, `apps/api/src/modules/purchases/purchases.service.ts:269`, `apps/api/src/modules/purchases/purchases.service.ts:420`, `apps/api/src/modules/purchases/purchases.service.ts:434`). | A compra é carregada por `id+companyId`; produtos, fornecedor, conta e forma são validados por empresa (`apps/api/src/modules/purchases/purchases.service.ts:153`, `apps/api/src/modules/purchases/purchases.service.ts:166`, `apps/api/src/modules/purchases/purchases.service.ts:372`, `apps/api/src/modules/purchases/purchases.service.ts:417`). | **Baixo:** defesa indireta; os filhos não têm `companyId` próprio e dependem do pai. |
| Helpers de estoque da compra fazem `product.findUnique/update` só por ID (`apps/api/src/modules/purchases/purchases.service.ts:317`, `apps/api/src/modules/purchases/purchases.service.ts:320`, `apps/api/src/modules/purchases/purchases.service.ts:343`, `apps/api/src/modules/purchases/purchases.service.ts:358`). | Produtos de entrada foram validados por `companyId`; no estorno, os IDs vêm dos itens de uma compra já escopada (`apps/api/src/modules/purchases/purchases.service.ts:154`, `apps/api/src/modules/purchases/purchases.service.ts:166`, `apps/api/src/modules/purchases/purchases.service.ts:378`, `apps/api/src/modules/purchases/purchases.service.ts:385`). | **Baixo:** defesa indireta; uma relação corrompida pode fazer o helper tocar produto externo. |
| No detalhe da comanda, resolução de nomes de serviço/produto usa apenas IDs (`apps/api/src/modules/orders/orders.service.ts:122`, `apps/api/src/modules/orders/orders.service.ts:138`). | A comanda pai é escopada (`apps/api/src/modules/orders/orders.service.ts:101`, `apps/api/src/modules/orders/orders.service.ts:120`). | **Médio:** `OrderItem.refId` é string, não FK (`packages/db/prisma/schema.prisma:1281`, `packages/db/prisma/schema.prisma:1285`); dado malformado pode expor nome cross-tenant. |
| Nome do serviço consumido, fallback de comissão e updates internos de produto/lote usam somente IDs (`apps/api/src/modules/orders/orders.service.ts:456`, `apps/api/src/modules/orders/orders.service.ts:460`, `apps/api/src/modules/orders/orders.service.ts:1142`, `apps/api/src/modules/orders/orders.service.ts:1155`, `apps/api/src/modules/orders/orders.service.ts:1216`, `apps/api/src/modules/orders/orders.service.ts:1224`). | Produto/lote é validado por empresa na adição; item pertence a comanda escopada (`apps/api/src/modules/orders/orders.service.ts:430`, `apps/api/src/modules/orders/orders.service.ts:447`). | **Baixo/Médio:** defesa indireta; o risco cresce porque `refId` não é FK e a mutação final não repete o escopo. |

## Casos de uso

### UC-CAT-001

**ID:** UC-CAT-001

**Nome:** Listar, buscar e consultar produtos

**Ator:** Usuário autenticado com `catalogo:view` (`apps/api/src/modules/products/products.controller.ts:112`, `apps/api/src/modules/products/products.controller.ts:133`).

**Pré-condições:** Empresa identificada no JWT; produtos não podem estar com `deletedAt` preenchido para aparecerem (`apps/api/src/modules/products/products.service.ts:31`, `apps/api/src/modules/products/products.service.ts:45`).

**Fluxo principal:**

1. O ator abre Produtos; a tela consulta produtos, categorias e marcas (`apps/web/src/pages/ProdutosPage.tsx:245`, `apps/web/src/pages/ProdutosPage.tsx:249`).
2. A API filtra por empresa, busca nome/código de barras/código do item e pode filtrar categoria (`apps/api/src/modules/products/products.service.ts:31`, `apps/api/src/modules/products/products.service.ts:45`).
3. A API retorna categoria e marca e ordena favoritos antes do nome (`apps/api/src/modules/products/products.service.ts:47`, `apps/api/src/modules/products/products.service.ts:54`).
4. Filtros adicionais de marca, favorito e status, além da paginação, são aplicados no cliente (`apps/web/src/pages/ProdutosPage.tsx:254`, `apps/web/src/pages/ProdutosPage.tsx:275`).

**Fluxos de exceção:** Produto inexistente, de outra empresa ou excluído gera `404 Produto não encontrado` no detalhe (`apps/api/src/modules/products/products.service.ts:64`, `apps/api/src/modules/products/products.service.ts:70`); falha de carga exibe `ErrorState` com retry (`apps/web/src/pages/ProdutosPage.tsx:695`).

**Endpoints envolvidos + telas envolvidas:** `GET /products`, `GET /products/:id`, `GET /product-categories`, `GET /brands`; tela `apps/web/src/pages/ProdutosPage.tsx` (`apps/api/src/modules/products/products.controller.ts:35`, `apps/api/src/modules/products/products.controller.ts:80`, `apps/api/src/modules/products/products.controller.ts:111`, `apps/api/src/modules/products/products.controller.ts:134`).

**Regras de negócio:** Saldo baixo é `stock <= minStock`; o filtro server-side é pós-query e o total retornado continua sendo o total anterior ao filtro (`apps/api/src/modules/products/products.service.ts:56`, `apps/api/src/modules/products/products.service.ts:61`). A tela também marca zerado/baixo pela mesma comparação (`apps/web/src/pages/ProdutosPage.tsx:793`, `apps/web/src/pages/ProdutosPage.tsx:846`).

**Estado:** **IMPLEMENTADO** — listagem, busca, detalhe e filtros essenciais estão ligados a endpoints reais (`apps/web/src/lib/queries/catalogo.ts:127`, `apps/web/src/lib/queries/catalogo.ts:149`).

**Gaps/riscos:** `page/pageSize` não são paginação real; toda a lista é carregada e o total fica incorreto quando `lowStock=true` (`apps/api/src/modules/products/products.service.ts:47`, `apps/api/src/modules/products/products.service.ts:61`). Categoria/marca relacionadas podem ser cross-tenant se um produto foi criado com FK externa, pois o `include` não restringe a relação (`apps/api/src/modules/products/products.service.ts:48`, `apps/api/src/modules/products/products.service.ts:51`).

### UC-CAT-002

**ID:** UC-CAT-002

**Nome:** Cadastrar produto

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/products/products.controller.ts:136`, `apps/api/src/modules/products/products.controller.ts:143`).

**Pré-condições:** Nome com pelo menos dois caracteres e preço de venda não negativo; a tela exige categoria, embora o DTO/API a deixe opcional (`apps/api/src/modules/products/dto.ts:13`, `apps/api/src/modules/products/dto.ts:18`, `apps/web/src/pages/ProdutosPage.tsx:1347`, `apps/web/src/pages/ProdutosPage.tsx:1361`).

**Fluxo principal:**

1. O ator informa cadastro, preço de venda, custo, saldo inicial, estoque mínimo, unidade, comissão, categoria/marca e configurações (`apps/web/src/pages/ProdutosPage.tsx:1362`, `apps/web/src/pages/ProdutosPage.tsx:1395`).
2. A tela chama `POST /products` (`apps/web/src/lib/queries/catalogo.ts:151`, `apps/web/src/lib/queries/catalogo.ts:159`).
3. A API persiste o corpo com o `companyId` do usuário e retorna categoria/marca (`apps/api/src/modules/products/products.service.ts:73`, `apps/api/src/modules/products/products.service.ts:77`).

**Fluxos de exceção:** Validações rejeitam valores negativos nos campos numéricos validados (`apps/api/src/modules/products/dto.ts:18`, `apps/api/src/modules/products/dto.ts:30`); a tela apresenta a mensagem da API no drawer (`apps/web/src/pages/ProdutosPage.tsx:1396`, `apps/web/src/pages/ProdutosPage.tsx:1415`).

**Endpoints envolvidos + telas envolvidas:** `POST /products`, com apoio de `GET /product-categories` e `GET /brands`; drawer em `apps/web/src/pages/ProdutosPage.tsx` (`apps/api/src/modules/products/products.controller.ts:136`, `apps/web/src/pages/ProdutosPage.tsx:1244`, `apps/web/src/pages/ProdutosPage.tsx:1416`).

**Regras de negócio:** `salePrice` e `costPrice` são valores independentes; saldo inicial e mínimo aceitam zero (`apps/api/src/modules/products/dto.ts:18`, `apps/api/src/modules/products/dto.ts:23`). `trackStock` é persistido, mas sua semântica não é aplicada nos fluxos de venda/consumo, que decrementam sem consultá-lo (`apps/api/src/modules/products/dto.ts:32`, `apps/api/src/modules/orders/orders.service.ts:1160`, `apps/api/src/modules/orders/orders.service.ts:1224`).

**Estado:** **PARCIAL** — o cadastro persiste os campos, mas não valida que `categoryId`/`brandId` pertencem à empresa e não cria movimento para o saldo inicial (`apps/api/src/modules/products/products.service.ts:73`, `apps/api/src/modules/products/products.service.ts:77`).

**Gaps/riscos:** Vínculo cross-tenant por categoria/marca; saldo inicial sem trilha em `InventoryMovement`; comissão de produto não tem `Max(100)` no DTO, apesar de a UI sugerir máximo 100 (`apps/api/src/modules/products/dto.ts:30`, `apps/web/src/pages/ProdutosPage.tsx:1647`, `apps/web/src/pages/ProdutosPage.tsx:1654`).

### UC-CAT-003

**ID:** UC-CAT-003

**Nome:** Editar, ativar ou desativar produto

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/products/products.controller.ts:145`, `apps/api/src/modules/products/products.controller.ts:153`).

**Pré-condições:** Produto deve existir, pertencer à empresa e não estar excluído (`apps/api/src/modules/products/products.service.ts:64`, `apps/api/src/modules/products/products.service.ts:81`).

**Fluxo principal:**

1. O drawer carrega os campos atuais, inclusive saldo, mínimo, custo, comissão e `trackStock` (`apps/web/src/pages/ProdutosPage.tsx:1297`, `apps/web/src/pages/ProdutosPage.tsx:1345`).
2. Ao salvar, a tela envia `PATCH /products/:id`, inclusive `stock` e `active` (`apps/web/src/pages/ProdutosPage.tsx:1397`, `apps/web/src/pages/ProdutosPage.tsx:1401`).
3. A API pré-valida o produto e atualiza os campos (`apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:86`).

**Fluxos de exceção:** Produto ausente/de outra empresa/excluído retorna `404` (`apps/api/src/modules/products/products.service.ts:64`, `apps/api/src/modules/products/products.service.ts:70`); números negativos são rejeitados pelo DTO (`apps/api/src/modules/products/dto.ts:45`, `apps/api/src/modules/products/dto.ts:65`).

**Endpoints envolvidos + telas envolvidas:** `PATCH /products/:id`; drawer de edição em `apps/web/src/pages/ProdutosPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:162`, `apps/web/src/lib/queries/catalogo.ts:174`).

**Regras de negócio:** Desativação é independente de exclusão; o schema mantém `active` e `deletedAt` separados (`packages/db/prisma/schema.prisma:1038`, `packages/db/prisma/schema.prisma:1047`). O saldo pode ser substituído diretamente no mesmo PATCH (`apps/web/src/pages/ProdutosPage.tsx:1397`, `apps/web/src/pages/ProdutosPage.tsx:1401`).

**Estado:** **PARCIAL** — edição funciona, mas alterar `stock` pelo cadastro não cria `InventoryMovement` e não sincroniza lotes (`apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:86`).

**Gaps/riscos:** Perda de auditabilidade do ajuste; divergência entre saldo global e lotes; categoria/marca não são revalidadas por empresa; `trackStock=false` não impede baixa em comanda (`apps/api/src/modules/orders/orders.service.ts:1201`, `apps/api/src/modules/orders/orders.service.ts:1224`).

### UC-CAT-004

**ID:** UC-CAT-004

**Nome:** Excluir produto do catálogo

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/products/products.controller.ts:155`, `apps/api/src/modules/products/products.controller.ts:162`).

**Pré-condições:** Produto existente, da empresa e ainda não excluído (`apps/api/src/modules/products/products.service.ts:64`, `apps/api/src/modules/products/products.service.ts:90`).

**Fluxo principal:**

1. A tela pede confirmação e chama a exclusão (`apps/web/src/pages/ProdutosPage.tsx:424`, `apps/web/src/pages/ProdutosPage.tsx:435`).
2. A API grava `deletedAt`, preservando produto, compras e movimentos (`apps/api/src/modules/products/products.service.ts:89`, `apps/api/src/modules/products/products.service.ts:97`).
3. Listagens deixam de retornar o produto porque exigem `deletedAt:null` (`apps/api/src/modules/products/products.service.ts:31`, `apps/api/src/modules/products/products.service.ts:45`).

**Fluxos de exceção:** Produto não encontrado gera `404`; falha da API é propagada pelo hook/tela (`apps/api/src/modules/products/products.service.ts:64`, `apps/api/src/modules/products/products.service.ts:70`, `apps/web/src/lib/queries/catalogo.ts:177`, `apps/web/src/lib/queries/catalogo.ts:185`).

**Endpoints envolvidos + telas envolvidas:** `DELETE /products/:id`; tela `apps/web/src/pages/ProdutosPage.tsx` (`apps/api/src/modules/products/products.controller.ts:155`, `apps/api/src/modules/products/products.controller.ts:162`).

**Regras de negócio:** Exclusão é lógica e não muda `active` nem estoque (`apps/api/src/modules/products/products.service.ts:89`, `apps/api/src/modules/products/products.service.ts:97`).

**Estado:** **IMPLEMENTADO** — soft delete preserva histórico e remove o item das consultas normais (`apps/api/src/modules/products/products.service.ts:31`, `apps/api/src/modules/products/products.service.ts:97`).

**Gaps/riscos:** Não há regra explícita sobre produtos excluídos ainda presentes em comandas abertas; itens guardam `refId` textual e a finalização tenta atualizar o produto por ID (`packages/db/prisma/schema.prisma:1281`, `packages/db/prisma/schema.prisma:1285`, `apps/api/src/modules/orders/orders.service.ts:1216`, `apps/api/src/modules/orders/orders.service.ts:1219`).

### UC-CAT-005

**ID:** UC-CAT-005

**Nome:** Registrar movimento manual de estoque

**Ator:** Usuário autenticado com `estoque:manage` (`apps/api/src/modules/products/products.controller.ts:164`, `apps/api/src/modules/products/products.controller.ts:173`).

**Pré-condições:** Produto existente da empresa; tipo `in`, `out` ou `adjust`; quantidade não negativa (`apps/api/src/modules/products/dto.ts:68`, `apps/api/src/modules/products/dto.ts:78`, `apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:102`).

**Fluxo principal:**

1. O ator abre “Movimentar estoque”, escolhe tipo, quantidade e motivo (`apps/web/src/pages/ProdutosPage.tsx:1780`, `apps/web/src/pages/ProdutosPage.tsx:1895`).
2. A tela chama `POST /products/:id/movements` (`apps/web/src/pages/ProdutosPage.tsx:1810`, `apps/web/src/pages/ProdutosPage.tsx:1817`).
3. A API calcula o novo saldo, cria o movimento e atualiza o produto em transação (`apps/api/src/modules/products/products.service.ts:104`, `apps/api/src/modules/products/products.service.ts:136`).

**Fluxos de exceção:** Saída que resultaria negativa retorna `400 Estoque insuficiente` (`apps/api/src/modules/products/products.service.ts:110`, `apps/api/src/modules/products/products.service.ts:116`); falha aparece no drawer (`apps/web/src/pages/ProdutosPage.tsx:1819`, `apps/web/src/pages/ProdutosPage.tsx:1825`).

**Endpoints envolvidos + telas envolvidas:** `POST /products/:id/movements`; drawer em `apps/web/src/pages/ProdutosPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:188`, `apps/web/src/lib/queries/catalogo.ts:195`).

**Regras de negócio:** `in` soma, `out` subtrai, `adjust` define o saldo (`apps/api/src/modules/products/products.service.ts:107`, `apps/api/src/modules/products/products.service.ts:120`). Quantidade zero é aceita pela UI e pelo DTO (`apps/api/src/modules/products/dto.ts:74`, `apps/web/src/pages/ProdutosPage.tsx:1808`).

**Estado:** **PARCIAL** — há transação e bloqueio simples de negativo, mas cálculo ocorre antes da transação, sem lock, e nenhum lote é alterado (`apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:137`).

**Gaps/riscos:** Race condition/lost update; `adjust` registra o novo saldo como quantidade do movimento, tornando a soma histórica ambígua; lote e saldo global divergem; motivo é opcional (`apps/api/src/modules/products/dto.ts:74`, `apps/api/src/modules/products/dto.ts:78`, `apps/api/src/modules/products/products.service.ts:117`, `apps/api/src/modules/products/products.service.ts:129`).

### UC-CAT-006

**ID:** UC-CAT-006

**Nome:** Gerenciar lotes e validades de produtos

**Ator:** Leitura: usuário com `catalogo:view`; criação, edição e exclusão: usuário com `estoque:manage` (`apps/api/src/modules/products/products.controller.ts:175`, `apps/api/src/modules/products/products.controller.ts:210`).

**Pré-condições:** Na criação, o produto deve existir, pertencer à empresa e não estar excluído; código é obrigatório e quantidade não negativa (`apps/api/src/modules/products/dto.ts:101`, `apps/api/src/modules/products/dto.ts:108`, `apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:258`).

**Fluxo principal:**

1. A subaba “Lotes e validades” lista todos os lotes da empresa (`apps/web/src/pages/ProdutosPage.tsx:1975`, `apps/web/src/pages/ProdutosPage.tsx:2007`).
2. O ator informa produto, código, fabricação, validade, quantidade e ativo e salva (`apps/web/src/pages/ProdutosPage.tsx:2179`, `apps/web/src/pages/ProdutosPage.tsx:2220`).
3. A API cria ou atualiza `ProductBatch`; a listagem ordena ativos primeiro e validade crescente (`apps/api/src/modules/products/products.service.ts:242`, `apps/api/src/modules/products/products.service.ts:290`).
4. Exclusão física é permitida quando o lote não está referenciado por item/consumo de comanda (`apps/api/src/modules/products/products.service.ts:293`, `apps/api/src/modules/products/products.service.ts:310`).

**Fluxos de exceção:** Produto/lote de outra empresa retorna `404`; lote referenciado retorna `409` orientando desativação (`apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:258`, `apps/api/src/modules/products/products.service.ts:293`, `apps/api/src/modules/products/products.service.ts:308`).

**Endpoints envolvidos + telas envolvidas:** `GET/POST /product-batches`, `PATCH/DELETE /product-batches/:id`; subaba de lotes em `apps/web/src/pages/ProdutosPage.tsx` (`apps/api/src/modules/products/products.controller.ts:175`, `apps/api/src/modules/products/products.controller.ts:210`, `apps/web/src/lib/queries/catalogo.ts:197`, `apps/web/src/lib/queries/catalogo.ts:245`).

**Regras de negócio:** Validade, fabricação e atividade são apenas dados; quantidade pode ser editada diretamente (`apps/api/src/modules/products/products.service.ts:279`, `apps/api/src/modules/products/products.service.ts:289`). Não há unicidade de código por produto/empresa no schema (`packages/db/prisma/schema.prisma:1349`, `packages/db/prisma/schema.prisma:1368`).

**Estado:** **PARCIAL** — CRUD existe, mas não sincroniza `Product.stock`, não gera movimentos e não aplica validade/atividade/saldo na venda (`apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:290`, `apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`).

**Gaps/riscos:** Saldos duplicados e divergentes; lote vencido/inativo/zerado selecionável; lote pode ficar negativo; códigos duplicados; compra não informa nem abastece lote (`apps/web/src/pages/controle/ComprasPage.tsx:1038`, `apps/web/src/pages/controle/ComprasPage.tsx:1049`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`).

### UC-CAT-007

**ID:** UC-CAT-007

**Nome:** Gerenciar categorias de produto

**Ator:** Leitura: usuário com `catalogo:view`; escrita: usuário com `catalogo:manage` (`apps/api/src/modules/products/products.controller.ts:35`, `apps/api/src/modules/products/products.controller.ts:68`).

**Pré-condições:** Nome com ao menos dois caracteres; para editar/excluir, categoria da empresa deve existir (`apps/api/src/modules/products/dto.ts:80`, `apps/api/src/modules/products/dto.ts:88`, `apps/api/src/modules/products/products.service.ts:153`, `apps/api/src/modules/products/products.service.ts:172`).

**Fluxo principal:**

1. A tela lista e filtra categorias por nome/status (`apps/web/src/pages/CategoriasPage.tsx:32`, `apps/web/src/pages/CategoriasPage.tsx:51`).
2. O ator cria/edita nome e atividade (`apps/web/src/pages/CategoriasPage.tsx:373`, `apps/web/src/pages/CategoriasPage.tsx:397`).
3. A API lista, cria e atualiza com escopo da empresa (`apps/api/src/modules/products/products.service.ts:139`, `apps/api/src/modules/products/products.service.ts:166`).
4. Ao excluir, a API bloqueia se houver produtos vinculados (`apps/api/src/modules/products/products.service.ts:168`, `apps/api/src/modules/products/products.service.ts:182`).

**Fluxos de exceção:** Categoria inexistente/de outra empresa retorna `404`; categoria com produto retorna `409` (`apps/api/src/modules/products/products.service.ts:158`, `apps/api/src/modules/products/products.service.ts:180`).

**Endpoints envolvidos + telas envolvidas:** `GET/POST /product-categories`, `PATCH/DELETE /product-categories/:id`; tela `apps/web/src/pages/CategoriasPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:247`, `apps/web/src/lib/queries/catalogo.ts:292`).

**Regras de negócio:** Categorias possuem `active`, mas a listagem de produtos não restringe categoria ativa (`packages/db/prisma/schema.prisma:976`, `packages/db/prisma/schema.prisma:989`, `apps/api/src/modules/products/products.service.ts:31`, `apps/api/src/modules/products/products.service.ts:51`).

**Estado:** **PARCIAL** — CRUD de categoria de produto funciona, mas a mesma tabela também é FK de `Service.categoryId`; a exclusão só verifica produtos (`packages/db/prisma/schema.prisma:958`, `packages/db/prisma/schema.prisma:960`, `apps/api/src/modules/products/products.service.ts:174`, `apps/api/src/modules/products/products.service.ts:182`).

**Gaps/riscos:** Exclusão de categoria usada por serviço pode falhar por FK sem mensagem de negócio; nomes duplicados são permitidos; contagem de vínculos não explicita empresa (`packages/db/prisma/schema.prisma:976`, `packages/db/prisma/schema.prisma:989`, `apps/api/src/modules/products/products.service.ts:174`, `apps/api/src/modules/products/products.service.ts:176`).

### UC-CAT-008

**ID:** UC-CAT-008

**Nome:** Gerenciar marcas

**Ator:** Leitura: usuário com `catalogo:view`; escrita: usuário com `catalogo:manage` (`apps/api/src/modules/products/products.controller.ts:70`, `apps/api/src/modules/products/products.controller.ts:109`).

**Pré-condições:** Nome com ao menos dois caracteres; marca da empresa existente para editar/excluir (`apps/api/src/modules/products/dto.ts:90`, `apps/api/src/modules/products/dto.ts:98`, `apps/api/src/modules/products/products.service.ts:216`, `apps/api/src/modules/products/products.service.ts:228`).

**Fluxo principal:**

1. A tela lista marcas, status e quantidade de produtos (`apps/web/src/pages/MarcasPage.tsx:57`, `apps/web/src/pages/MarcasPage.tsx:99`, `apps/web/src/pages/MarcasPage.tsx:475`, `apps/web/src/pages/MarcasPage.tsx:517`).
2. O ator cria/edita nome e atividade (`apps/web/src/pages/MarcasPage.tsx:828`, `apps/web/src/pages/MarcasPage.tsx:865`).
3. A API persiste e retorna `productCount` (`apps/api/src/modules/products/products.service.ts:185`, `apps/api/src/modules/products/products.service.ts:213`).
4. A exclusão é bloqueada quando há produto vinculado (`apps/api/src/modules/products/products.service.ts:224`, `apps/api/src/modules/products/products.service.ts:238`).

**Fluxos de exceção:** Marca inexistente/de outra empresa retorna `404`; marca vinculada retorna `409` (`apps/api/src/modules/products/products.service.ts:216`, `apps/api/src/modules/products/products.service.ts:236`).

**Endpoints envolvidos + telas envolvidas:** `GET/POST /brands`, `PATCH/DELETE /brands/:id`; tela `apps/web/src/pages/MarcasPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:294`, `apps/web/src/lib/queries/catalogo.ts:343`).

**Regras de negócio:** Filtro opcional do backend diferencia `active`/`inactive`; a tela atual carrega todos e filtra localmente (`apps/api/src/modules/products/products.controller.ts:70`, `apps/api/src/modules/products/products.controller.ts:80`, `apps/web/src/lib/queries/catalogo.ts:298`, `apps/web/src/lib/queries/catalogo.ts:302`).

**Estado:** **IMPLEMENTADO** — CRUD, status e bloqueio de exclusão por vínculo estão operacionais (`apps/api/src/modules/products/products.service.ts:185`, `apps/api/src/modules/products/products.service.ts:239`).

**Gaps/riscos:** A UI afirma que marcas inativas ficam ocultas nos cadastros, mas Produtos usa todas as marcas retornadas sem filtrar atividade (`apps/web/src/pages/MarcasPage.tsx:894`, `apps/web/src/pages/MarcasPage.tsx:900`, `apps/web/src/pages/ProdutosPage.tsx:247`, `apps/web/src/pages/ProdutosPage.tsx:448`). Nomes duplicados são permitidos pelo schema (`packages/db/prisma/schema.prisma:991`, `packages/db/prisma/schema.prisma:1003`).

### UC-CAT-009

**ID:** UC-CAT-009

**Nome:** Listar e consultar serviços

**Ator:** Usuário autenticado com `catalogo:view` (`apps/api/src/modules/services/services.controller.ts:41`, `apps/api/src/modules/services/services.controller.ts:55`).

**Pré-condições:** Serviço da empresa e sem `deletedAt`; categoria opcional para filtro (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:36`).

**Fluxo principal:**

1. A tela consulta serviços e categorias de produto (`apps/web/src/pages/ServicosPage.tsx:172`, `apps/web/src/pages/ServicosPage.tsx:175`).
2. A API retorna serviços com categoria, por `displayOrder` e nome (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:31`).
3. Busca, status, favorito, categoria, ordenação e paginação são aplicados no cliente (`apps/web/src/pages/ServicosPage.tsx:192`, `apps/web/src/pages/ServicosPage.tsx:252`).

**Fluxos de exceção:** Serviço inexistente/de outra empresa/excluído retorna `404` (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:37`); erro de listagem mostra retry (`apps/web/src/pages/ServicosPage.tsx:658`).

**Endpoints envolvidos + telas envolvidas:** `GET /services`, `GET /services/:id`, `GET /product-categories`; tela `apps/web/src/pages/ServicosPage.tsx` (`apps/web/src/lib/queries.ts:55`, `apps/web/src/lib/queries.ts:60`, `apps/web/src/lib/queries/catalogo.ts:251`, `apps/web/src/lib/queries/catalogo.ts:255`).

**Regras de negócio:** Favorito, ativo, visível e agendável online são flags independentes no schema (`packages/db/prisma/schema.prisma:944`, `packages/db/prisma/schema.prisma:948`).

**Estado:** **IMPLEMENTADO** — listagem/detalhe escopados e tela funcional (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:38`).

**Gaps/riscos:** A paginação é client-side; a API usa `ProductCategory` como relação, não `ServiceCategory` (`packages/db/prisma/schema.prisma:958`, `packages/db/prisma/schema.prisma:960`).

### UC-CAT-010

**ID:** UC-CAT-010

**Nome:** Cadastrar e editar serviço com comissão padrão

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/services/services.controller.ts:57`, `apps/api/src/modules/services/services.controller.ts:71`).

**Pré-condições:** Nome com dois caracteres, preço não negativo, duração mínima de um minuto e comissão entre 0 e 100 (`apps/api/src/modules/services/dto.ts:13`, `apps/api/src/modules/services/dto.ts:31`, `apps/api/src/modules/services/dto.ts:34`, `apps/api/src/modules/services/dto.ts:52`).

**Fluxo principal:**

1. O ator informa categoria, preço/tipo, custo adicional, duração, descrição, imagem, comissão, cashback e flags (`apps/web/src/pages/ServicosPage.tsx:1424`, `apps/web/src/pages/ServicosPage.tsx:1446`).
2. A tela chama `POST /services` ou `PATCH /services/:id` (`apps/web/src/pages/ServicosPage.tsx:1447`, `apps/web/src/pages/ServicosPage.tsx:1453`).
3. A API sincroniza a capa com a primeira imagem da galeria e persiste o serviço (`apps/api/src/modules/services/services.service.ts:5`, `apps/api/src/modules/services/services.service.ts:15`, `apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:49`).
4. No fechamento da comanda, regras específicas do profissional têm precedência; sem regra, usa-se `Service.defaultCommissionPercent` (`apps/api/src/modules/orders/orders.service.ts:1130`, `apps/api/src/modules/orders/orders.service.ts:1148`).

**Fluxos de exceção:** Serviço inexistente/de outra empresa retorna `404`; DTO rejeita comissão fora de 0–100 (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:37`, `apps/api/src/modules/services/dto.ts:27`, `apps/api/src/modules/services/dto.ts:48`).

**Endpoints envolvidos + telas envolvidas:** `POST /services`, `PATCH /services/:id`; drawer em `apps/web/src/pages/ServicosPage.tsx` (`apps/web/src/lib/queries.ts:71`, `apps/web/src/lib/queries.ts:91`, `apps/web/src/pages/ServicosPage.tsx:1286`, `apps/web/src/pages/ServicosPage.tsx:1461`).

**Regras de negócio:** Comissão padrão é percentual e fallback após regras de item/categoria/global do profissional (`packages/db/prisma/schema.prisma:941`, `packages/db/prisma/schema.prisma:943`, `apps/api/src/modules/orders/orders.service.ts:1130`, `apps/api/src/modules/orders/orders.service.ts:1148`). Cashback é independente da comissão (`apps/api/src/modules/services/dto.ts:25`, `apps/web/src/pages/ServicosPage.tsx:1755`, `apps/web/src/pages/ServicosPage.tsx:1759`).

**Estado:** **PARCIAL** — cadastro, edição e comissão funcionam, mas `categoryId` não é validado por empresa e aponta para categoria de produto (`apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:48`, `packages/db/prisma/schema.prisma:958`, `packages/db/prisma/schema.prisma:960`).

**Gaps/riscos:** Vínculo cross-tenant; tipos `priceType` e `additionalCostType` aceitam qualquer string no DTO (`apps/api/src/modules/services/dto.ts:17`, `apps/api/src/modules/services/dto.ts:20`); a seção visual “Comissões e Auxiliares” está desabilitada, apesar do campo simples de comissão existir no cadastro (`apps/web/src/pages/ServicosPage.tsx:1265`, `apps/web/src/pages/ServicosPage.tsx:1274`, `apps/web/src/pages/ServicosPage.tsx:1677`, `apps/web/src/pages/ServicosPage.tsx:1690`).

### UC-CAT-011

**ID:** UC-CAT-011

**Nome:** Excluir serviço do catálogo

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/services/services.controller.ts:73`, `apps/api/src/modules/services/services.controller.ts:77`).

**Pré-condições:** Serviço existente, da empresa e ainda não excluído (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:52`).

**Fluxo principal:**

1. A tela solicita confirmação e chama a exclusão (`apps/web/src/pages/ServicosPage.tsx:283`, `apps/web/src/pages/ServicosPage.tsx:293`).
2. A API grava `deletedAt` sem alterar `active`/`visible`, preservando histórico de agenda, pacotes e memberships (`apps/api/src/modules/services/services.service.ts:51`, `apps/api/src/modules/services/services.service.ts:59`).
3. Listagens deixam de retornar a linha (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:31`).

**Fluxos de exceção:** Serviço não encontrado retorna `404`; erro é exibido pela camada da tela/hook (`apps/api/src/modules/services/services.service.ts:34`, `apps/api/src/modules/services/services.service.ts:37`, `apps/web/src/lib/queries.ts:94`, `apps/web/src/lib/queries.ts:102`).

**Endpoints envolvidos + telas envolvidas:** `DELETE /services/:id`; tela `apps/web/src/pages/ServicosPage.tsx` (`apps/api/src/modules/services/services.controller.ts:73`, `apps/api/src/modules/services/services.controller.ts:77`).

**Regras de negócio:** Exclusão é lógica e independente das flags de visibilidade/atividade (`apps/api/src/modules/services/services.service.ts:53`, `apps/api/src/modules/services/services.service.ts:59`).

**Estado:** **IMPLEMENTADO** — soft delete preserva histórico e oculta o serviço (`apps/api/src/modules/services/services.service.ts:21`, `apps/api/src/modules/services/services.service.ts:59`).

**Gaps/riscos:** Item de comanda usa `refId` sem FK e uma comanda aberta pode conservar referência ao serviço excluído (`packages/db/prisma/schema.prisma:1281`, `packages/db/prisma/schema.prisma:1285`).

### UC-CAT-012

**ID:** UC-CAT-012

**Nome:** Gerenciar categorias de serviço

**Ator:** Leitura: usuário com `catalogo:view`; criação: usuário com `catalogo:manage` (`apps/api/src/modules/services/services.controller.ts:25`, `apps/api/src/modules/services/services.controller.ts:39`).

**Pré-condições:** Para criar, nome com ao menos dois caracteres; ordem opcional (`apps/api/src/modules/services/dto.ts:55`, `apps/api/src/modules/services/dto.ts:58`).

**Fluxo principal:**

1. A API lista `ServiceCategory` da empresa por `displayOrder` (`apps/api/src/modules/services/services.service.ts:62`, `apps/api/src/modules/services/services.service.ts:68`).
2. A API permite criar uma categoria com `companyId` (`apps/api/src/modules/services/services.service.ts:70`, `apps/api/src/modules/services/services.service.ts:72`).

**Fluxos de exceção:** Validação rejeita nome menor que dois caracteres (`apps/api/src/modules/services/dto.ts:55`, `apps/api/src/modules/services/dto.ts:58`). Não existem rotas de atualização ou exclusão no controller (`apps/api/src/modules/services/services.controller.ts:25`, `apps/api/src/modules/services/services.controller.ts:41`).

**Endpoints envolvidos + telas envolvidas:** `GET /service-categories`, `POST /service-categories`; não há tela do escopo usando esses hooks — `ServicosPage` usa `useProductCategories` (`apps/web/src/lib/queries.ts:63`, `apps/web/src/lib/queries.ts:68`, `apps/web/src/pages/ServicosPage.tsx:34`, `apps/web/src/pages/ServicosPage.tsx:173`).

**Regras de negócio:** `ServiceCategory` tem empresa, ordem e atividade, mas não possui relação com `Service`; `Service.categoryId` referencia `ProductCategory` (`packages/db/prisma/schema.prisma:912`, `packages/db/prisma/schema.prisma:924`, `packages/db/prisma/schema.prisma:926`, `packages/db/prisma/schema.prisma:960`).

**Estado:** **PARCIAL** — apenas criar/listar existe; editar/excluir e o vínculo real com serviços estão ausentes (`apps/api/src/modules/services/services.controller.ts:25`, `apps/api/src/modules/services/services.controller.ts:41`, `apps/api/src/modules/services/services.service.ts:62`, `apps/api/src/modules/services/services.service.ts:73`).

**Gaps/riscos:** Duas taxonomias concorrentes; categorias de serviço órfãs; inexistência de CRUD completo e de tela; serviços dependem indevidamente de categorias de produto (`packages/db/prisma/schema.prisma:958`, `packages/db/prisma/schema.prisma:960`, `packages/db/prisma/schema.prisma:984`, `packages/db/prisma/schema.prisma:987`).

### UC-CAT-013

**ID:** UC-CAT-013

**Nome:** Listar, buscar e consultar fornecedores

**Ator:** Usuário autenticado com `catalogo:view` (`apps/api/src/modules/suppliers/suppliers.controller.ts:25`, `apps/api/src/modules/suppliers/suppliers.controller.ts:41`).

**Pré-condições:** Fornecedor da empresa e não excluído (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:15`).

**Fluxo principal:**

1. A tela consulta fornecedores e envia busca por nome ao servidor (`apps/web/src/pages/FornecedoresPage.tsx:206`, `apps/web/src/pages/FornecedoresPage.tsx:223`).
2. A API filtra empresa/`deletedAt`, busca por nome e ordena alfabeticamente (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:20`).
3. Status e ordenação adicionais são aplicados no cliente (`apps/web/src/pages/FornecedoresPage.tsx:211`, `apps/web/src/pages/FornecedoresPage.tsx:223`).

**Fluxos de exceção:** Detalhe inexistente/de outra empresa/excluído retorna `404`; erro da lista oferece retry (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:28`, `apps/web/src/pages/FornecedoresPage.tsx:484`).

**Endpoints envolvidos + telas envolvidas:** `GET /suppliers`, `GET /suppliers/:id`; tela `apps/web/src/pages/FornecedoresPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:345`, `apps/web/src/lib/queries/catalogo.ts:363`).

**Regras de negócio:** Busca do backend cobre somente nome; status é filtrado depois, no cliente (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:15`, `apps/web/src/pages/FornecedoresPage.tsx:211`, `apps/web/src/pages/FornecedoresPage.tsx:218`).

**Estado:** **IMPLEMENTADO** — listagem, busca e detalhe estão escopados (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:29`).

**Gaps/riscos:** Não há paginação server-side; busca não cobre CNPJ/e-mail/telefone (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:20`).

### UC-CAT-014

**ID:** UC-CAT-014

**Nome:** Cadastrar e editar fornecedor

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/suppliers/suppliers.controller.ts:43`, `apps/api/src/modules/suppliers/suppliers.controller.ts:60`).

**Pré-condições:** Nome com ao menos dois caracteres; demais campos são opcionais (`apps/api/src/modules/suppliers/dto.ts:3`, `apps/api/src/modules/suppliers/dto.ts:11`, `apps/api/src/modules/suppliers/dto.ts:13`, `apps/api/src/modules/suppliers/dto.ts:21`).

**Fluxo principal:**

1. O ator informa cadastro, contatos, endereço e atividade; a tela serializa endereço/segundo telefone em `addressJson` (`apps/web/src/pages/FornecedoresPage.tsx:926`, `apps/web/src/pages/FornecedoresPage.tsx:1022`).
2. A tela chama `POST /suppliers` ou `PATCH /suppliers/:id` (`apps/web/src/pages/FornecedoresPage.tsx:1023`, `apps/web/src/pages/FornecedoresPage.tsx:1029`).
3. A API cria com `companyId` ou pré-valida a empresa e atualiza (`apps/api/src/modules/suppliers/suppliers.service.ts:31`, `apps/api/src/modules/suppliers/suppliers.service.ts:53`).

**Fluxos de exceção:** Fornecedor editado inexistente/de outra empresa retorna `404`; erros aparecem no drawer (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:28`, `apps/web/src/pages/FornecedoresPage.tsx:1030`, `apps/web/src/pages/FornecedoresPage.tsx:1036`).

**Endpoints envolvidos + telas envolvidas:** `POST /suppliers`, `PATCH /suppliers/:id`; drawer em `apps/web/src/pages/FornecedoresPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:365`, `apps/web/src/lib/queries/catalogo.ts:385`).

**Regras de negócio:** `addressJson` é estrutura livre; API faz cast para JSON sem schema de endereço (`apps/api/src/modules/suppliers/dto.ts:9`, `apps/api/src/modules/suppliers/suppliers.service.ts:31`, `apps/api/src/modules/suppliers/suppliers.service.ts:39`).

**Estado:** **IMPLEMENTADO** — criação/edição, status e endereço estão ligados à API e escopados na linha principal (`apps/api/src/modules/suppliers/suppliers.service.ts:31`, `apps/api/src/modules/suppliers/suppliers.service.ts:54`).

**Gaps/riscos:** CNPJ, e-mail e telefone são strings sem validação de formato/unicidade; `addressJson` não tem validação estrutural (`apps/api/src/modules/suppliers/dto.ts:5`, `apps/api/src/modules/suppliers/dto.ts:10`, `packages/db/prisma/schema.prisma:1063`, `packages/db/prisma/schema.prisma:1087`).

### UC-CAT-015

**ID:** UC-CAT-015

**Nome:** Excluir fornecedor

**Ator:** Usuário autenticado com `catalogo:manage` (`apps/api/src/modules/suppliers/suppliers.controller.ts:62`, `apps/api/src/modules/suppliers/suppliers.controller.ts:69`).

**Pré-condições:** Fornecedor existente, da empresa e não excluído (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:28`).

**Fluxo principal:**

1. A tela confirma a exclusão e chama a mutation (`apps/web/src/pages/FornecedoresPage.tsx:283`, `apps/web/src/pages/FornecedoresPage.tsx:301`).
2. A API grava `deletedAt`, preservando histórico de compras e sem mudar `active` (`apps/api/src/modules/suppliers/suppliers.service.ts:56`, `apps/api/src/modules/suppliers/suppliers.service.ts:64`).
3. O fornecedor some das listagens normais (`apps/api/src/modules/suppliers/suppliers.service.ts:10`, `apps/api/src/modules/suppliers/suppliers.service.ts:15`).

**Fluxos de exceção:** Fornecedor não encontrado retorna `404`; a tela exibe a mensagem da API (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:28`, `apps/web/src/pages/FornecedoresPage.tsx:292`, `apps/web/src/pages/FornecedoresPage.tsx:299`).

**Endpoints envolvidos + telas envolvidas:** `DELETE /suppliers/:id`; tela `apps/web/src/pages/FornecedoresPage.tsx` (`apps/web/src/lib/queries/catalogo.ts:388`, `apps/web/src/lib/queries/catalogo.ts:397`).

**Regras de negócio:** Exclusão é lógica para manter compras ligadas ao fornecedor (`apps/api/src/modules/suppliers/suppliers.service.ts:56`, `apps/api/src/modules/suppliers/suppliers.service.ts:64`).

**Estado:** **IMPLEMENTADO** — soft delete preserva histórico e respeita o tenant na pré-checagem (`apps/api/src/modules/suppliers/suppliers.service.ts:23`, `apps/api/src/modules/suppliers/suppliers.service.ts:64`).

**Gaps/riscos:** Compras novas não aceitam fornecedor excluído, mas compras antigas ainda incluem toda a relação no detalhe, como esperado para histórico (`apps/api/src/modules/purchases/purchases.service.ts:84`, `apps/api/src/modules/purchases/purchases.service.ts:99`, `apps/api/src/modules/purchases/purchases.service.ts:397`, `apps/api/src/modules/purchases/purchases.service.ts:403`).

### UC-CAT-016

**ID:** UC-CAT-016

**Nome:** Listar e consultar compras e XMLs importados

**Ator:** Usuário autenticado com `catalogo:view` (`apps/api/src/modules/purchases/purchases.controller.ts:26`, `apps/api/src/modules/purchases/purchases.controller.ts:52`).

**Pré-condições:** Compra ou XML pertencente à empresa (`apps/api/src/modules/purchases/purchases.service.ts:25`, `apps/api/src/modules/purchases/purchases.service.ts:45`, `apps/api/src/modules/purchases/purchases.service.ts:84`, `apps/api/src/modules/purchases/purchases.service.ts:99`, `apps/api/src/modules/purchases/purchases.service.ts:299`, `apps/api/src/modules/purchases/purchases.service.ts:305`).

**Fluxo principal:**

1. A tela consulta compras e permite busca por ID, fornecedor ou número (`apps/web/src/pages/controle/ComprasPage.tsx:136`, `apps/api/src/modules/purchases/purchases.service.ts:25`, `apps/api/src/modules/purchases/purchases.service.ts:45`).
2. A API retorna fornecedor, contagem de itens, valores, status e datas (`apps/api/src/modules/purchases/purchases.service.ts:47`, `apps/api/src/modules/purchases/purchases.service.ts:81`).
3. O detalhe inclui fornecedor, conta, forma e itens/produtos (`apps/api/src/modules/purchases/purchases.service.ts:84`, `apps/api/src/modules/purchases/purchases.service.ts:100`).
4. A subaba XML consulta os `ImportedXml` da empresa (`apps/api/src/modules/purchases/purchases.service.ts:299`, `apps/api/src/modules/purchases/purchases.service.ts:305`).

**Fluxos de exceção:** Compra inexistente/de outra empresa retorna `404`; telas exibem estado de erro/retry (`apps/api/src/modules/purchases/purchases.service.ts:84`, `apps/api/src/modules/purchases/purchases.service.ts:99`, `apps/web/src/pages/controle/ComprasPage.tsx:445`, `apps/web/src/pages/controle/ComprasPage.tsx:448`, `apps/web/src/pages/controle/ComprasPage.tsx:706`).

**Endpoints envolvidos + telas envolvidas:** `GET /purchases`, `GET /purchases/:id`, `GET /purchases/xmls`; tela `apps/web/src/pages/controle/ComprasPage.tsx` (`apps/web/src/lib/queries/compras.ts:117`, `apps/web/src/lib/queries/compras.ts:133`, `apps/web/src/lib/queries/compras.ts:177`, `apps/web/src/lib/queries/compras.ts:186`).

**Regras de negócio:** Status é uma string persistida e novas compras nascem `lancada`; a UI deriva “pagamento finalizado” apenas da presença de `paymentMethodId` (`apps/api/src/modules/purchases/purchases.service.ts:11`, `apps/api/src/modules/purchases/purchases.service.ts:16`, `apps/web/src/pages/controle/ComprasPage.tsx:54`, `apps/web/src/pages/controle/ComprasPage.tsx:78`).

**Estado:** **IMPLEMENTADO** — listagem, busca, detalhe e listagem real de XML estão conectados e escopados (`apps/api/src/modules/purchases/purchases.service.ts:25`, `apps/api/src/modules/purchases/purchases.service.ts:100`, `apps/api/src/modules/purchases/purchases.service.ts:299`, `apps/api/src/modules/purchases/purchases.service.ts:305`).

**Gaps/riscos:** Filtros de período, status, fornecedor e pagamento são client-side e operam sobre toda a lista; “status de pagamento” não existe no schema de compra (`apps/web/src/pages/controle/ComprasPage.tsx:151`, `apps/web/src/pages/controle/ComprasPage.tsx:186`, `packages/db/prisma/schema.prisma:1104`, `packages/db/prisma/schema.prisma:1136`).

### UC-CAT-017

**ID:** UC-CAT-017

**Nome:** Registrar compra e dar entrada no estoque

**Ator:** Usuário autenticado com `estoque:manage` (`apps/api/src/modules/purchases/purchases.controller.ts:54`, `apps/api/src/modules/purchases/purchases.controller.ts:61`).

**Pré-condições:** Ao menos um item; quantidade mínima 0,001; custo/descontos não negativos; produtos e referências devem pertencer à empresa (`apps/api/src/modules/purchases/dto.ts:13`, `apps/api/src/modules/purchases/dto.ts:32`, `apps/api/src/modules/purchases/purchases.service.ts:103`, `apps/api/src/modules/purchases/purchases.service.ts:105`, `apps/api/src/modules/purchases/purchases.service.ts:392`, `apps/api/src/modules/purchases/purchases.service.ts:417`).

**Fluxo principal:**

1. O ator informa fornecedor, data, itens, quantidades, custos, descontos, frete, despesas/receitas, conta, forma e observação (`apps/web/src/pages/controle/ComprasPage.tsx:901`, `apps/web/src/pages/controle/ComprasPage.tsx:918`).
2. A API calcula número sequencial e total, cria compra/itens com status `lancada` e, na mesma transação, aplica entrada de estoque (`apps/api/src/modules/purchases/purchases.service.ts:109`, `apps/api/src/modules/purchases/purchases.service.ts:149`).
3. Para cada item, soma em `Product.stock` e cria movimento `in` referenciando a compra (`apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`).

**Fluxos de exceção:** Referência cross-tenant/inválida retorna `400`; item vazio/quantidade/custo inválido é rejeitado (`apps/api/src/modules/purchases/purchases.service.ts:372`, `apps/api/src/modules/purchases/purchases.service.ts:417`, `apps/api/src/modules/purchases/dto.ts:13`, `apps/api/src/modules/purchases/dto.ts:32`).

**Endpoints envolvidos + telas envolvidas:** `POST /purchases`, apoiado por `GET /products`, `GET /suppliers`, contas e formas; drawer em `apps/web/src/pages/controle/ComprasPage.tsx` (`apps/web/src/lib/queries/compras.ts:136`, `apps/web/src/lib/queries/compras.ts:147`, `apps/web/src/pages/controle/ComprasPage.tsx:757`, `apps/web/src/pages/controle/ComprasPage.tsx:933`).

**Regras de negócio:** Total de linha é `max(0, quantidade × custo − descontoItem)`; total server-side é `max(0, Σlinhas + frete − descontoGeral)` (`apps/api/src/modules/purchases/purchases.service.ts:276`, `apps/api/src/modules/purchases/purchases.service.ts:297`). Entrada ocorre ao salvar, não há etapa de rascunho/faturamento distinta (`apps/api/src/modules/purchases/purchases.service.ts:11`, `apps/api/src/modules/purchases/purchases.service.ts:16`, `apps/web/src/pages/controle/ComprasPage.tsx:950`, `apps/web/src/pages/controle/ComprasPage.tsx:964`).

**Estado:** **PARCIAL** — compra/itens/movimentos são atômicos, mas a entrada usa saldo pré-carregado e valor absoluto, não atualiza lote nem custo médio (`apps/api/src/modules/purchases/purchases.service.ts:103`, `apps/api/src/modules/purchases/purchases.service.ts:109`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`).

**Gaps/riscos:** Lost update concorrente; nenhum lote é recebido apesar da célula “Lote” na UI ser apenas visual (`apps/web/src/pages/controle/ComprasPage.tsx:1038`, `apps/web/src/pages/controle/ComprasPage.tsx:1049`); UI calcula outras despesas/receitas no total, mas o servidor as ignora no cálculo (`apps/web/src/pages/controle/ComprasPage.tsx:875`, `apps/web/src/pages/controle/ComprasPage.tsx:886`, `apps/api/src/modules/purchases/purchases.service.ts:284`, `apps/api/src/modules/purchases/purchases.service.ts:297`); fornecedor aparece obrigatório na tela, mas o save/API permitem vazio (`apps/web/src/pages/controle/ComprasPage.tsx:983`, `apps/web/src/pages/controle/ComprasPage.tsx:994`, `apps/web/src/pages/controle/ComprasPage.tsx:888`, `apps/api/src/modules/purchases/dto.ts:24`, `apps/api/src/modules/purchases/dto.ts:26`).

### UC-CAT-018

**ID:** UC-CAT-018

**Nome:** Editar compra e reconciliar entrada de estoque

**Ator:** Usuário autenticado com `estoque:manage` (`apps/api/src/modules/purchases/purchases.controller.ts:63`, `apps/api/src/modules/purchases/purchases.controller.ts:71`).

**Pré-condições:** Compra da empresa existente; referências novas válidas; se itens mudarem, deve haver saldo para estornar toda a entrada antiga (`apps/api/src/modules/purchases/purchases.service.ts:153`, `apps/api/src/modules/purchases/purchases.service.ts:166`, `apps/api/src/modules/purchases/purchases.service.ts:168`, `apps/api/src/modules/purchases/purchases.service.ts:178`).

**Fluxo principal:**

1. A tela carrega detalhe e preenche itens/valores (`apps/web/src/pages/controle/ComprasPage.tsx:806`, `apps/web/src/pages/controle/ComprasPage.tsx:839`).
2. Ao salvar, envia todos os itens e campos por `PATCH /purchases/:id` (`apps/web/src/pages/controle/ComprasPage.tsx:895`, `apps/web/src/pages/controle/ComprasPage.tsx:925`).
3. Em transação, a API estorna itens antigos, substitui `PurchaseItem`, aplica novas entradas, recalcula total e atualiza a compra (`apps/api/src/modules/purchases/purchases.service.ts:168`, `apps/api/src/modules/purchases/purchases.service.ts:243`).

**Fluxos de exceção:** Compra não encontrada retorna `404`; estorno que deixaria saldo negativo retorna `409` e reverte toda a transação (`apps/api/src/modules/purchases/purchases.service.ts:153`, `apps/api/src/modules/purchases/purchases.service.ts:159`, `apps/api/src/modules/purchases/purchases.service.ts:348`, `apps/api/src/modules/purchases/purchases.service.ts:354`).

**Endpoints envolvidos + telas envolvidas:** `GET /purchases/:id`, `PATCH /purchases/:id`; drawer de edição em `apps/web/src/pages/controle/ComprasPage.tsx` (`apps/web/src/lib/queries/compras.ts:128`, `apps/web/src/lib/queries/compras.ts:133`, `apps/web/src/lib/queries/compras.ts:150`, `apps/web/src/lib/queries/compras.ts:161`).

**Regras de negócio:** Só há reconciliação de estoque quando `items` é enviado (`apps/api/src/modules/purchases/purchases.service.ts:162`, `apps/api/src/modules/purchases/purchases.service.ts:193`). A tela sempre envia `items`, portanto uma edição comum estorna/reaplica tudo (`apps/web/src/pages/controle/ComprasPage.tsx:901`, `apps/web/src/pages/controle/ComprasPage.tsx:918`).

**Estado:** **PARCIAL** — reconciliação transacional existe, mas mantém os mesmos gaps de concorrência, lote, custo médio e total das despesas/receitas (`apps/api/src/modules/purchases/purchases.service.ts:168`, `apps/api/src/modules/purchases/purchases.service.ts:243`, `apps/api/src/modules/purchases/purchases.service.ts:284`, `apps/api/src/modules/purchases/purchases.service.ts:297`).

**Gaps/riscos:** Uma alteração apenas de observação feita pela tela pode ser bloqueada se parte da mercadoria já saiu, pois todos os itens são reenviados e estornados; estorno/reentrada gera movimentos mesmo sem mudança material (`apps/web/src/pages/controle/ComprasPage.tsx:901`, `apps/web/src/pages/controle/ComprasPage.tsx:925`, `apps/api/src/modules/purchases/purchases.service.ts:168`, `apps/api/src/modules/purchases/purchases.service.ts:193`).

### UC-CAT-019

**ID:** UC-CAT-019

**Nome:** Excluir compra e estornar a entrada

**Ator:** Usuário autenticado com `estoque:manage` (`apps/api/src/modules/purchases/purchases.controller.ts:73`, `apps/api/src/modules/purchases/purchases.controller.ts:80`).

**Pré-condições:** Compra da empresa existente; todos os produtos precisam ter saldo global suficiente para retirar as quantidades originais (`apps/api/src/modules/purchases/purchases.service.ts:247`, `apps/api/src/modules/purchases/purchases.service.ts:265`).

**Fluxo principal:**

1. A tela alerta que a entrada será estornada e pede confirmação (`apps/web/src/pages/controle/ComprasPage.tsx:275`, `apps/web/src/pages/controle/ComprasPage.tsx:281`).
2. Em transação, a API subtrai os itens, cria movimentos `out` de estorno e exclui a compra; itens caem por cascade (`apps/api/src/modules/purchases/purchases.service.ts:254`, `apps/api/src/modules/purchases/purchases.service.ts:269`, `packages/db/prisma/schema.prisma:1148`, `packages/db/prisma/schema.prisma:1152`).

**Fluxos de exceção:** Compra não encontrada retorna `404`; falta de saldo retorna `409` e impede exclusão (`apps/api/src/modules/purchases/purchases.service.ts:247`, `apps/api/src/modules/purchases/purchases.service.ts:253`, `apps/api/src/modules/purchases/purchases.service.ts:348`, `apps/api/src/modules/purchases/purchases.service.ts:354`).

**Endpoints envolvidos + telas envolvidas:** `DELETE /purchases/:id`; tela `apps/web/src/pages/controle/ComprasPage.tsx` (`apps/web/src/lib/queries/compras.ts:164`, `apps/web/src/lib/queries/compras.ts:175`).

**Regras de negócio:** Exclusão é física e o movimento de estorno referencia a compra que será removida apenas por `refId` textual (`apps/api/src/modules/purchases/purchases.service.ts:359`, `apps/api/src/modules/purchases/purchases.service.ts:368`, `packages/db/prisma/schema.prisma:1089`, `packages/db/prisma/schema.prisma:1102`).

**Estado:** **PARCIAL** — estorno e exclusão são transacionais, mas a checagem de saldo não trava a linha do produto e lotes nunca são estornados (`apps/api/src/modules/purchases/purchases.service.ts:254`, `apps/api/src/modules/purchases/purchases.service.ts:269`, `apps/api/src/modules/purchases/purchases.service.ts:342`, `apps/api/src/modules/purchases/purchases.service.ts:369`).

**Gaps/riscos:** Race condition entre validação e escrita; compra não tem cancelamento lógico/auditoria própria; referências `InventoryMovement.refId` passam a apontar para ID sem registro de compra (`apps/api/src/modules/purchases/purchases.service.ts:267`, `apps/api/src/modules/purchases/purchases.service.ts:368`).

### UC-CAT-020

**ID:** UC-CAT-020

**Nome:** Registrar produto consumido na execução de serviço

**Ator:** Usuário autenticado com `comandas:edit` (`apps/api/src/modules/orders/orders.controller.ts:107`, `apps/api/src/modules/orders/orders.controller.ts:117`).

**Pré-condições:** Comanda aberta/editável; item deve ser de serviço; produto não excluído da mesma empresa; quantidade mínima 0,001; lote, se informado, deve ser da empresa e do produto (`apps/api/src/modules/orders/dto.ts:62`, `apps/api/src/modules/orders/dto.ts:73`, `apps/api/src/modules/orders/orders.service.ts:424`, `apps/api/src/modules/orders/orders.service.ts:447`).

**Fluxo principal:**

1. Na aba “Produtos consumidos”, o ator escolhe produto, custo, lote, unidade e extra (`apps/web/src/components/ItemEditDrawer.tsx:487`, `apps/web/src/components/ItemEditDrawer.tsx:520`, `apps/web/src/components/ItemEditDrawer.tsx:619`, `apps/web/src/components/ItemEditDrawer.tsx:691`).
2. A tela pré-preenche `unitValue` com `Product.costPrice` e chama o endpoint (`apps/web/src/components/ItemEditDrawer.tsx:522`, `apps/web/src/components/ItemEditDrawer.tsx:531`, `apps/web/src/components/ItemEditDrawer.tsx:537`, `apps/web/src/components/ItemEditDrawer.tsx:557`).
3. A API cria `OrderItemConsumedProduct`, movimento `out`, subtrai saldo global e, se houver, o lote, na mesma transação (`apps/api/src/modules/orders/orders.service.ts:463`, `apps/api/src/modules/orders/orders.service.ts:496`).
4. O consumo não recalcula o total da comanda (`apps/api/src/modules/orders/orders.service.ts:498`, `apps/api/src/modules/orders/orders.service.ts:499`).

**Fluxos de exceção:** Item que não é serviço, produto/lote inválido ou saldo global insuficiente retorna `400/404` (`apps/api/src/modules/orders/orders.service.ts:430`, `apps/api/src/modules/orders/orders.service.ts:454`).

**Endpoints envolvidos + telas envolvidas:** `POST /orders/:id/items/:itemId/consumed-products`, `GET /product-batches?productId=`; componente `apps/web/src/components/ItemEditDrawer.tsx` usado na edição da comanda (`apps/web/src/lib/queries.ts:422`, `apps/web/src/lib/queries.ts:449`).

**Regras de negócio:** A baixa considera apenas `quantity`; `extraQuantity` é armazenado, mas não baixa estoque (`apps/api/src/modules/orders/orders.service.ts:449`, `apps/api/src/modules/orders/orders.service.ts:470`). O relatório, porém, soma `quantity + extraQuantity` no consumo/custo (`apps/api/src/modules/reports/reports.service.ts:1291`, `apps/api/src/modules/reports/reports.service.ts:1320`).

**Estado:** **PARCIAL** — baixa imediata e auditada existe, mas não respeita `trackStock`, validade/atividade/saldo do lote e é vulnerável a concorrência (`apps/api/src/modules/orders/orders.service.ts:437`, `apps/api/src/modules/orders/orders.service.ts:496`).

**Gaps/riscos:** Lote negativo; lote vencido/inativo aceito; lost update do saldo global porque `nextStock` é calculado antes da transação e gravado de forma absoluta (`apps/api/src/modules/orders/orders.service.ts:449`, `apps/api/src/modules/orders/orders.service.ts:463`, `apps/api/src/modules/orders/orders.service.ts:487`); divergência entre estoque baixado e relatório por causa de `extraQuantity`.

### UC-CAT-021

**ID:** UC-CAT-021

**Nome:** Remover ou estornar produto consumido

**Ator:** Usuário autenticado com `comandas:edit`; cancelamento completo exige `comandas:delete` (`apps/api/src/modules/orders/orders.controller.ts:119`, `apps/api/src/modules/orders/orders.controller.ts:128`, `apps/api/src/modules/orders/orders.controller.ts:226`, `apps/api/src/modules/orders/orders.controller.ts:230`).

**Pré-condições:** Para remoção individual, comanda aberta/editável e consumo pertencente ao item; para remoção do item, o item deve pertencer à comanda (`apps/api/src/modules/orders/orders.service.ts:502`, `apps/api/src/modules/orders/orders.service.ts:515`, `apps/api/src/modules/orders/orders.service.ts:373`, `apps/api/src/modules/orders/orders.service.ts:380`).

**Fluxo principal:**

1. O ator remove o consumo na aba da comanda (`apps/web/src/components/ItemEditDrawer.tsx:572`, `apps/web/src/components/ItemEditDrawer.tsx:583`, `apps/web/src/components/ItemEditDrawer.tsx:606`, `apps/web/src/components/ItemEditDrawer.tsx:613`).
2. A API cria movimento `in`, incrementa produto e lote e exclui a linha consumida em transação (`apps/api/src/modules/orders/orders.service.ts:520`, `apps/api/src/modules/orders/orders.service.ts:551`).
3. Remover o item de serviço primeiro estorna todos os consumos associados (`apps/api/src/modules/orders/orders.service.ts:373`, `apps/api/src/modules/orders/orders.service.ts:380`, `apps/api/src/modules/orders/orders.service.ts:554`, `apps/api/src/modules/orders/orders.service.ts:560`).

**Fluxos de exceção:** Consumo/item inexistente retorna `404`; comanda não editável é bloqueada pela regra comum (`apps/api/src/modules/orders/orders.service.ts:508`, `apps/api/src/modules/orders/orders.service.ts:515`).

**Endpoints envolvidos + telas envolvidas:** `DELETE /orders/:id/items/:itemId/consumed-products/:consumedId`, `DELETE /orders/:id/items/:itemId`; componente `apps/web/src/components/ItemEditDrawer.tsx` e tela de comanda (`apps/web/src/lib/queries.ts:432`, `apps/web/src/lib/queries.ts:439`).

**Regras de negócio:** Estorno repõe exatamente `quantity`, não `extraQuantity`, coerente com a baixa original (`apps/api/src/modules/orders/orders.service.ts:524`, `apps/api/src/modules/orders/orders.service.ts:551`).

**Estado:** **IMPLEMENTADO** — remoção individual e por remoção do item repõem produto/lote e registram movimento (`apps/api/src/modules/orders/orders.service.ts:373`, `apps/api/src/modules/orders/orders.service.ts:380`, `apps/api/src/modules/orders/orders.service.ts:520`, `apps/api/src/modules/orders/orders.service.ts:551`).

**Gaps/riscos:** O estorno de vários consumos ocorre em uma transação separada por linha; falha intermediária pode deixar cancelamento/remoção parcialmente reposto (`apps/api/src/modules/orders/orders.service.ts:524`, `apps/api/src/modules/orders/orders.service.ts:559`, `apps/api/src/modules/orders/orders.service.ts:1464`, `apps/api/src/modules/orders/orders.service.ts:1469`).

### UC-CAT-022

**ID:** UC-CAT-022

**Nome:** Baixar estoque de produto vendido ao finalizar comanda

**Ator:** Usuário autenticado com `comandas:checkout` (`apps/api/src/modules/orders/orders.controller.ts:196`, `apps/api/src/modules/orders/orders.controller.ts:204`).

**Pré-condições:** Comanda não cancelada; pagamentos ativos devem somar exatamente o total líquido; caixa aplicável deve estar aberto quando o total é positivo (`apps/api/src/modules/orders/orders.service.ts:747`, `apps/api/src/modules/orders/orders.service.ts:798`, `apps/api/src/modules/orders/orders.service.ts:800`, `apps/api/src/modules/orders/orders.service.ts:831`).

**Fluxo principal:**

1. Produto adicionado à comanda usa `Product.salePrice` quando não é informado preço positivo (`apps/api/src/modules/orders/orders.service.ts:298`, `apps/api/src/modules/orders/orders.service.ts:326`).
2. Ao finalizar, a API trava a comanda, gera financeiro/caixa/comissão e chama a baixa de vendidos dentro de uma transação (`apps/api/src/modules/orders/orders.service.ts:762`, `apps/api/src/modules/orders/orders.service.ts:770`, `apps/api/src/modules/orders/orders.service.ts:846`, `apps/api/src/modules/orders/orders.service.ts:860`).
3. Cada item de produto cria movimento `out`, decrementa saldo global e lote associado (`apps/api/src/modules/orders/orders.service.ts:1160`, `apps/api/src/modules/orders/orders.service.ts:1225`).
4. A baixa é idempotente por saldo líquido de movimentos identificado pelo `orderItemId` embutido em `reason` (`apps/api/src/modules/orders/orders.service.ts:1185`, `apps/api/src/modules/orders/orders.service.ts:1203`).

**Fluxos de exceção:** Comanda cancelada ou pagamento incompleto bloqueia fechamento (`apps/api/src/modules/orders/orders.service.ts:747`, `apps/api/src/modules/orders/orders.service.ts:798`); comanda já finalizada retorna sem nova baixa (`apps/api/src/modules/orders/orders.service.ts:752`, `apps/api/src/modules/orders/orders.service.ts:758`).

**Endpoints envolvidos + telas envolvidas:** `POST /orders/:id/finish`, `PATCH /orders/:id/items/:itemId` para escolher lote; tela `apps/web/src/pages/ComandaDetalhePage.tsx` e `apps/web/src/components/ItemEditDrawer.tsx` (`apps/web/src/pages/ComandaDetalhePage.tsx:129`, `apps/web/src/pages/ComandaDetalhePage.tsx:165`, `apps/web/src/components/ItemEditDrawer.tsx:269`, `apps/web/src/components/ItemEditDrawer.tsx:297`).

**Regras de negócio:** Vendido gera receita e usa preço de venda; consumido é custo e já baixou antes, portanto não é baixado novamente no finish (`apps/api/src/modules/orders/orders.service.ts:733`, `apps/api/src/modules/orders/orders.service.ts:741`, `apps/web/src/components/ItemEditDrawer.tsx:491`, `apps/web/src/components/ItemEditDrawer.tsx:501`). Comissão usa regras do profissional e, por fallback, a comissão padrão do catálogo (`apps/api/src/modules/orders/orders.service.ts:1130`, `apps/api/src/modules/orders/orders.service.ts:1156`).

**Estado:** **PARCIAL** — fechamento é transacional/idempotente, mas a baixa não valida saldo global/lote, validade, atividade ou `trackStock` (`apps/api/src/modules/orders/orders.service.ts:1160`, `apps/api/src/modules/orders/orders.service.ts:1225`).

**Gaps/riscos:** Estoque negativo mesmo sem concorrência; lotes vencidos/zerados aceitos; lock é só da comanda, logo comandas distintas concorrem pelo mesmo produto (`apps/api/src/modules/orders/orders.service.ts:762`, `apps/api/src/modules/orders/orders.service.ts:770`, `apps/api/src/modules/orders/orders.service.ts:1201`, `apps/api/src/modules/orders/orders.service.ts:1225`).

### UC-CAT-023

**ID:** UC-CAT-023

**Nome:** Reabrir ou cancelar comanda e repor estoque

**Ator:** Reabertura: usuário com `comandas:checkout`; cancelamento: usuário com `comandas:delete` (`apps/api/src/modules/orders/orders.controller.ts:206`, `apps/api/src/modules/orders/orders.controller.ts:214`, `apps/api/src/modules/orders/orders.controller.ts:226`, `apps/api/src/modules/orders/orders.controller.ts:230`).

**Pré-condições:** Reabertura exige comanda finalizada; cancelamento recebe comanda não cancelada; configuração financeira pode impedir edição após fechamento de caixa (`apps/api/src/modules/orders/orders.service.ts:1406`, `apps/api/src/modules/orders/orders.service.ts:1412`, `apps/api/src/modules/orders/orders.service.ts:1375`, `apps/api/src/modules/orders/orders.service.ts:1403`, `apps/api/src/modules/orders/orders.service.ts:1452`, `apps/api/src/modules/orders/orders.service.ts:1455`).

**Fluxo principal:**

1. Reabertura estorna financeiro, comissão, caixa e estoque vendido e volta a comanda para `open` em transação (`apps/api/src/modules/orders/orders.service.ts:1367`, `apps/api/src/modules/orders/orders.service.ts:1422`).
2. Reabertura não repõe consumidos, pois eles continuam associados à comanda ativa (`apps/api/src/modules/orders/orders.service.ts:1369`, `apps/api/src/modules/orders/orders.service.ts:1373`).
3. Cancelamento via `DELETE` estorna o finish se necessário, repõe todos os consumidos e marca `canceled` (`apps/api/src/modules/orders/orders.service.ts:1446`, `apps/api/src/modules/orders/orders.service.ts:1483`).

**Fluxos de exceção:** Reabrir comanda não finalizada retorna `400`; caixa fechado pode bloquear; cancelamento repetido é idempotente (`apps/api/src/modules/orders/orders.service.ts:1406`, `apps/api/src/modules/orders/orders.service.ts:1411`, `apps/api/src/modules/orders/orders.service.ts:1452`, `apps/api/src/modules/orders/orders.service.ts:1455`).

**Endpoints envolvidos + telas envolvidas:** `POST /orders/:id/reopen`, `DELETE /orders/:id`; reabertura em `apps/web/src/pages/ComandaDetalhePage.tsx` (`apps/web/src/pages/ComandaDetalhePage.tsx:129`, `apps/web/src/pages/ComandaDetalhePage.tsx:165`, `apps/web/src/lib/queries.ts:525`).

**Regras de negócio:** Reposição do vendido é idempotente por saldo líquido de movimentos; produto/lote são incrementados na quantidade do item (`apps/api/src/modules/orders/orders.service.ts:1313`, `apps/api/src/modules/orders/orders.service.ts:1363`).

**Estado:** **PARCIAL** — reabertura e `DELETE` reconciliam estoque, porém o DTO permite `PATCH /orders/:id` com `status=canceled` e esse caminho só troca status, sem repor nada (`apps/api/src/modules/orders/dto.ts:25`, `apps/api/src/modules/orders/orders.service.ts:1425`, `apps/api/src/modules/orders/orders.service.ts:1443`).

**Gaps/riscos:** Dois caminhos de cancelamento com efeitos diferentes; reposição de consumidos no cancelamento ocorre em transações independentes; `remove` estorna o finish em uma transação e consumidos depois, permitindo estado parcial se uma etapa posterior falhar (`apps/api/src/modules/orders/orders.service.ts:1456`, `apps/api/src/modules/orders/orders.service.ts:1469`).

### UC-CAT-024

**ID:** UC-CAT-024

**Nome:** Identificar estoque mínimo e sugerir reposição

**Ator:** Listagem: usuário com `catalogo:view`; relatório: usuário com `relatorios:operacional` e feature `reports_advanced` (`apps/api/src/modules/products/products.controller.ts:112`, `apps/api/src/modules/products/products.controller.ts:125`, `apps/api/src/modules/reports/reports.controller.ts:13`, `apps/api/src/modules/reports/reports.controller.ts:15`, `apps/api/src/modules/reports/reports.controller.ts:40`, `apps/api/src/modules/reports/reports.controller.ts:44`).

**Pré-condições:** Produto da empresa; para o relatório, ativo, não excluído e `minStock > 0` (`apps/api/src/modules/reports/reports.service.ts:355`, `apps/api/src/modules/reports/reports.service.ts:367`).

**Fluxo principal:**

1. O ator define `minStock` no produto (`apps/web/src/pages/ProdutosPage.tsx:1603`, `apps/web/src/pages/ProdutosPage.tsx:1623`).
2. A listagem pode filtrar e destacar produtos com `stock <= minStock` (`apps/api/src/modules/products/products.service.ts:56`, `apps/api/src/modules/products/products.service.ts:59`, `apps/web/src/pages/ProdutosPage.tsx:420`, `apps/web/src/pages/ProdutosPage.tsx:422`).
3. O relatório calcula déficit `max(0,minStock-stock)` e ordena maior déficit primeiro (`apps/api/src/modules/reports/reports.service.ts:369`, `apps/api/src/modules/reports/reports.service.ts:387`).

**Fluxos de exceção:** Sem produtos abaixo do mínimo, o relatório retorna lista vazia e a tela mostra “Estoque em dia” (`apps/api/src/modules/reports/reports.service.ts:381`, `apps/api/src/modules/reports/reports.service.ts:387`, `apps/web/src/pages/relatorios/EstoquePage.tsx:99`, `apps/web/src/pages/relatorios/EstoquePage.tsx:108`).

**Endpoints envolvidos + telas envolvidas:** `GET /products?lowStock=true`, `GET /reports/inventory-suggestion`; telas `apps/web/src/pages/ProdutosPage.tsx` e `apps/web/src/pages/relatorios/EstoquePage.tsx` (`apps/web/src/lib/queries/catalogo.ts:127`, `apps/web/src/lib/queries/catalogo.ts:140`, `apps/web/src/lib/queries/relatorios.ts:120`, `apps/web/src/lib/queries/relatorios.ts:125`).

**Regras de negócio:** Produto no próprio mínimo já é considerado baixo; sugestão de compra é o déficit, que fica zero nesse caso (`apps/api/src/modules/products/products.service.ts:56`, `apps/api/src/modules/products/products.service.ts:59`, `apps/api/src/modules/reports/reports.service.ts:378`, `apps/api/src/modules/reports/reports.service.ts:382`).

**Estado:** **PARCIAL** — filtro, destaque e relatório sob demanda existem; não há disparo automático de alerta nesse fluxo, apenas sinalização/listagem consultada pelo usuário (`apps/web/src/pages/ProdutosPage.tsx:652`, `apps/web/src/pages/ProdutosPage.tsx:653`, `apps/web/src/pages/relatorios/EstoquePage.tsx:15`, `apps/web/src/pages/relatorios/EstoquePage.tsx:32`).

**Gaps/riscos:** Nenhuma notificação automática ou gatilho de reposição foi encontrado no domínio lido; o total de `GET /products?lowStock=true` não é recalculado após o filtro (`apps/api/src/modules/products/products.service.ts:47`, `apps/api/src/modules/products/products.service.ts:61`); relatório promete contexto de última compra/venda que o endpoint não fornece (`apps/web/src/pages/relatorios/EstoquePage.tsx:23`, `apps/web/src/pages/relatorios/EstoquePage.tsx:25`, `apps/web/src/pages/relatorios/EstoquePage.tsx:150`, `apps/web/src/pages/relatorios/EstoquePage.tsx:153`).

### UC-CAT-025

**ID:** UC-CAT-025

**Nome:** Recalcular custo médio do produto após entrada de compra

**Ator:** Usuário de estoque/gestor de compras.

**Pré-condições:** Produto com saldo/custo anterior e compra com quantidade/custo unitário (`packages/db/prisma/schema.prisma:1015`, `packages/db/prisma/schema.prisma:1018`, `packages/db/prisma/schema.prisma:1142`, `packages/db/prisma/schema.prisma:1143`).

**Fluxo principal:** **Não há fluxo implementado.** A compra persiste `PurchaseItem.unitCost`, soma apenas `Product.stock` e cria movimento; não escreve `Product.costPrice` (`apps/api/src/modules/purchases/purchases.service.ts:134`, `apps/api/src/modules/purchases/purchases.service.ts:146`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`).

**Fluxos de exceção:** Não aplicável porque o cálculo não existe. O custo cadastral continua editável manualmente no produto (`apps/api/src/modules/products/dto.ts:47`, `apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:86`).

**Endpoints envolvidos + telas envolvidas:** Nenhum endpoint específico. `POST/PATCH /purchases` recebe `unitCost`, e `PATCH /products/:id` pode alterar `costPrice` manualmente; telas `ComprasPage.tsx` e `ProdutosPage.tsx` (`apps/web/src/pages/controle/ComprasPage.tsx:1050`, `apps/web/src/pages/controle/ComprasPage.tsx:1057`, `apps/web/src/pages/ProdutosPage.tsx:1526`, `apps/web/src/pages/ProdutosPage.tsx:1533`).

**Regras de negócio:** Preço de venda vem de `Product.salePrice` na comanda; custo de consumo é pré-preenchido com `Product.costPrice`; custo da compra é histórico por item (`apps/api/src/modules/orders/orders.service.ts:320`, `apps/api/src/modules/orders/orders.service.ts:326`, `apps/web/src/components/ItemEditDrawer.tsx:522`, `apps/web/src/components/ItemEditDrawer.tsx:529`, `apps/api/src/modules/purchases/purchases.service.ts:134`, `apps/api/src/modules/purchases/purchases.service.ts:141`).

**Estado:** **AUSENTE** — não existe fórmula de média ponderada nem atualização de `costPrice` nos helpers de entrada/estorno (`apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:370`).

**Gaps/riscos:** Margem e custo de consumidos podem usar custo cadastral desatualizado; editar/excluir compra também não restaura/recalcula custo; `additionalCost` do produto e outras despesas/frete da compra não são rateados no custo (`packages/db/prisma/schema.prisma:1015`, `packages/db/prisma/schema.prisma:1017`, `apps/api/src/modules/purchases/purchases.service.ts:284`, `apps/api/src/modules/purchases/purchases.service.ts:297`).

### UC-CAT-026

**ID:** UC-CAT-026

**Nome:** Bloquear ou alertar venda/consumo de lote vencido

**Ator:** Usuário de comanda/estoque.

**Pré-condições:** Produto com lote que possui `expiresAt` anterior à data atual (`packages/db/prisma/schema.prisma:1349`, `packages/db/prisma/schema.prisma:1357`).

**Fluxo principal:** **Não há bloqueio/alerta implementado.** A listagem apenas ordena por validade; a seleção mostra todos os lotes; a validação da comanda confere ID/empresa/produto, sem comparar `expiresAt` (`apps/api/src/modules/products/products.service.ts:242`, `apps/api/src/modules/products/products.service.ts:250`, `apps/web/src/components/ItemEditDrawer.tsx:269`, `apps/web/src/components/ItemEditDrawer.tsx:289`, `apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:447`).

**Fluxos de exceção:** Lote inexistente ou de empresa/produto incompatível retorna `404/400`; lote vencido, inativo ou sem saldo não entra nesses fluxos de exceção (`apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:447`).

**Endpoints envolvidos + telas envolvidas:** `GET /product-batches`, `PATCH /orders/:id/items/:itemId`, `POST /orders/:id/items/:itemId/consumed-products`; telas `ProdutosPage.tsx` e `ItemEditDrawer.tsx` (`apps/api/src/modules/products/products.controller.ts:175`, `apps/api/src/modules/products/products.controller.ts:183`, `apps/api/src/modules/orders/orders.controller.ts:63`, `apps/api/src/modules/orders/orders.controller.ts:72`, `apps/api/src/modules/orders/orders.controller.ts:107`, `apps/api/src/modules/orders/orders.controller.ts:117`).

**Regras de negócio:** `expiresAt` e `active` são apenas persistidos/exibidos; não influenciam disponibilidade (`apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:290`, `apps/web/src/pages/ProdutosPage.tsx:2070`, `apps/web/src/pages/ProdutosPage.tsx:2090`).

**Estado:** **AUSENTE** — nenhum dos caminhos de seleção/baixa verifica data de validade (`apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:447`, `apps/api/src/modules/orders/orders.service.ts:1201`, `apps/api/src/modules/orders/orders.service.ts:1225`).

**Gaps/riscos:** Venda/consumo de lote vencido; ausência de alerta de vencimento próximo; lotes inativos/zerados continuam selecionáveis; decremento pode tornar o lote negativo (`apps/web/src/components/ItemEditDrawer.tsx:283`, `apps/web/src/components/ItemEditDrawer.tsx:288`, `apps/web/src/components/ItemEditDrawer.tsx:663`, `apps/web/src/components/ItemEditDrawer.tsx:668`, `apps/api/src/modules/orders/orders.service.ts:1220`, `apps/api/src/modules/orders/orders.service.ts:1224`).

## Resumo

### Contagem por estado

| Estado | Quantidade |
|---|---:|
| IMPLEMENTADO | 10 |
| PARCIAL | 14 |
| AUSENTE | 2 |
| **Total** | **26** |

### Cinco gaps/riscos mais relevantes

1. **Estoque pode ficar negativo:** finalização de venda decrementa produto/lote sem validar disponibilidade, e consumo não valida saldo do lote (`apps/api/src/modules/orders/orders.service.ts:1201`, `apps/api/src/modules/orders/orders.service.ts:1225`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:454`, `apps/api/src/modules/orders/orders.service.ts:489`, `apps/api/src/modules/orders/orders.service.ts:493`).
2. **Concorrência e perda de atualização:** ajuste manual, entrada de compra e consumo calculam saldo fora da transação/sem lock de produto; o único `FOR UPDATE` explícito do fechamento trava a comanda (`apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:133`, `apps/api/src/modules/purchases/purchases.service.ts:103`, `apps/api/src/modules/purchases/purchases.service.ts:320`, `apps/api/src/modules/orders/orders.service.ts:449`, `apps/api/src/modules/orders/orders.service.ts:487`, `apps/api/src/modules/orders/orders.service.ts:762`, `apps/api/src/modules/orders/orders.service.ts:770`).
3. **Lotes vencidos/inativos/zerados não são bloqueados:** validade é apenas ordenada/exibida e os fluxos de comanda não a validam (`apps/api/src/modules/products/products.service.ts:242`, `apps/api/src/modules/products/products.service.ts:250`, `apps/api/src/modules/orders/orders.service.ts:343`, `apps/api/src/modules/orders/orders.service.ts:352`, `apps/api/src/modules/orders/orders.service.ts:442`, `apps/api/src/modules/orders/orders.service.ts:447`).
4. **Saldo global, lotes e razão de movimentos podem divergir:** compras/movimentos manuais não alteram lotes, CRUD de lote não altera produto e edição direta de produto não gera movimento (`apps/api/src/modules/products/products.service.ts:80`, `apps/api/src/modules/products/products.service.ts:86`, `apps/api/src/modules/products/products.service.ts:101`, `apps/api/src/modules/products/products.service.ts:137`, `apps/api/src/modules/products/products.service.ts:253`, `apps/api/src/modules/products/products.service.ts:290`, `apps/api/src/modules/purchases/purchases.service.ts:308`, `apps/api/src/modules/purchases/purchases.service.ts:334`).
5. **Isolamento e modelagem de categoria incompletos:** produto/serviço aceitam FKs de categoria/marca sem validação por empresa; `Service` referencia `ProductCategory`, deixando `ServiceCategory` órfã do catálogo real (`apps/api/src/modules/products/products.service.ts:73`, `apps/api/src/modules/products/products.service.ts:86`, `apps/api/src/modules/services/services.service.ts:40`, `apps/api/src/modules/services/services.service.ts:48`, `packages/db/prisma/schema.prisma:912`, `packages/db/prisma/schema.prisma:924`, `packages/db/prisma/schema.prisma:958`, `packages/db/prisma/schema.prisma:960`).
