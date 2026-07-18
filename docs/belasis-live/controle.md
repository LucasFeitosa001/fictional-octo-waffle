# Belasis LIVE — Módulo Controle

> Evidência de capturas ao vivo (viewport mobile/iPhone, conta real — salão com catálogo grande de serviços/produtos/estoque).
> Fonte: `scratchpad/belasis-capture/ctrl-*` (page.txt + api.json + shot.png). Não copiar marca/cores/nome Belasis — alvo é HeroUI/Salonpass, mobile-first.
> Refina o status de `docs/belasis-gap-analysis.md` (linhas 423–547, "Controle") com a evidência real das requisições GraphQL.

## Estrutura do grupo "Controle" (7 telas capturadas)

| # | Tela Belasis | Rota real | Operation principal | Nossa rota | Status |
|---|--------------|-----------|---------------------|------------|--------|
| 1 | Serviços | `/services` | `ServicesList` | `/servicos` | EXISTENTE |
| 2 | Produtos | `/products` | `ProductsList` | `/produtos` | PARCIAL (falta aba Lotes/Validades) |
| 3 | Categorias | `/groups` | `GroupsList` | `/categorias` | EXISTENTE |
| 4 | Marcas | `/brands` | `BrandsList` | `/marcas` | EXISTENTE (falta campo `active` na entidade) |
| 5 | Pacotes Predefinidos | `/package-templates` | `PacakageTemplatesList` | (parcial em `/pacotes`, sem rota própria) | GATED no Belasis |
| 6 | Compras | `/purchases` | `PurchasesList` | (sem rota) | AUSENTE |
| 7 | Gerador de Documento | `/document-templates` | `fetchDocumentTemplates` | (sem rota) | AUSENTE / GATED |

### Padrão comum a todas as telas de lista deste módulo (do DOM + screenshots)
- **Header:** título grande + (algumas) botão-tour circular ▶.
- **Busca:** input placeholder **"Digite para buscar"** (full-width, ícone de lupa).
- **Ordenação:** chip/pill **"Ordenando por Nome"** (Compras: **"Ordenando por Ticket"**) com seta → dropdown.
- **Barra inferior contextual flutuante:** `Menu · Filtros · Selecionar · Criar` (4 ícones). Nas telas sem seleção em lote reduz para `Menu · Filtros · Criar` (Compras e Gerador de Documento).
- **Ações por linha:** `Excluir` e `Selecionar` presentes no DOM por item (swipe/menu).
- **Estado vazio:** ícone de caixa + **"Nenhum item encontrado"** / **"Verifique seus filtros e tente novamente."** + link **"Clique para criar"** + rodapé **"N registros no total"**.
- **Boot compartilhado (mesmo em todas as telas):** `GlobalCurrentUserContext`, `findMultiSalons`, `Notifications`, `BirthdayClientsQuery`, `Banners`, `CalendarsCalendar`, `TutorialCategories`, `FetchWhatsappStatus`, e o bloco de pré-carga `Webook*`: `WebookAllInventoryProducts/Groups/Brands`, `WebookAllEmployees`, `WebookScheduleColors`, `WebookFinancePayments/Charts/Accounts`, `WebookMessageModelsGroups`, `WebookStatusMessage`, `WebookAddons`.

> **Descoberta de modelagem importante:** no Belasis **Serviços e Produtos são o mesmo tipo GraphQL `Product`** (envelope `all_inventory_products`). A distinção é por campos/uso: serviço tem `duration` (segundos) e sem controle de estoque; produto tem `cost_cents`, `quantity`, `unit_quantity`, `und`. Nosso app já modela `Service` e `Product` separados — divergência intencional, manter.

---

## 1. Serviços

**Rota real Belasis:** `https://belasis.app/services`
**Tela equivalente:** `/servicos` → `apps/web/src/pages/ServicosPage.tsx` (App.tsx:58).

### Operations GraphQL
- **`ServicesList`** ← query principal (corpo: `data.all_inventory_products.all[]`).

### Campos reais (corpo de `ServicesList`, tipo `Product`)
- `id` (string, ex. "885674")
- `description` (nome do serviço, MAIÚSCULAS, ex. "ADIANTAMENTO DE MAKE") — **é o "nome"**
- `price_cents` (int, centavos, ex. 5000 = R$ 50,00; pode ser 0)
- `duration` (int, **segundos**: 300 = 5 min, 900 = 15 min, 9000 = 02:30 h)
- `favorite` (bool)
- `active` (bool)
- `image_url` (URL S3 ou null → fallback)
- `image_blurhash` (string ou null — placeholder da imagem)
- `__typename: "Product"`

### UI e textos exatos
- Título: **"Serviços"**.
- Busca "Digite para buscar"; chip **"Ordenando por Nome"**.
- Cada card: avatar/ícone à esquerda (placeholder "be" quando sem imagem), **nome em CAPS**, **preço** `R$ 50,00`, **duração** `5 min` / `02:30 h` (à direita), **estrela** de favorito (canto sup. direito, cinza=off).
- Ações por linha: `Excluir`, `Selecionar`.
- Barra inferior: `Menu · Filtros · Selecionar · Criar`.
- (Um popup de NPS "InMoment" aparece sobreposto — é widget de terceiro, ignorar.)

### Layout MOBILE
Lista de cards verticais, um por serviço: miniatura quadrada à esquerda, nome+preço à esquerda-centro, duração alinhada à direita na base, estrela de favorito no topo direito. Bottom nav flutuante 4 ícones.

### Gap vs nosso app
- **EXISTENTE** (gap 423–432, 100% na maioria). Nosso `Service` tem `name`, `price`, `durationMin`, `favorite`, `active`, `imageUrl`/`imageUrls`, `categoryId`. Endpoints GET/POST/PATCH `/services`.
- **Divergência de unidade:** Belasis guarda `duration` em **segundos**; nós em **minutos** (`durationMin`). Manter minutos (mais legível), sem ação.
- Refinamentos já apontados no gap e confirmados: sem toggle de favorito **inline** na linha (só no modal) — gap 429; sem ordenação escolhível pelo usuário (só default backend) — gap 424; sem seleção múltipla/ações em lote — gap 431. **Confirmado pela captura:** a estrela de favorito É visível por linha (só falta ser clicável inline no nosso app).

---

## 2. Produtos

**Rota real Belasis:** `https://belasis.app/products`
**Tela equivalente:** `/produtos` → `apps/web/src/pages/ProdutosPage.tsx` (App.tsx:59).

### Operations GraphQL
- **`ProductsList`** ← query principal (corpo: `data.all_inventory_products.all[]`).

### Campos reais (corpo de `ProductsList`, tipo `Product`)
- `id` (string), `description` (nome, ex. "6D DEFRIZZ"), `active`
- `price_cents` (venda, ex. 10175 = R$ 101,75)
- `cost_cents` (custo, ex. 5500; pode ser 0)
- `employee_price_cents` (preço p/ funcionário, ex. 0)
- `quantity` (float, estoque atual, ex. 0.0 / 2.0)
- `unit_quantity` (float, ex. 1.0 — fator de unidade)
- `und` (string unidade de medida, ex. **"Unidade"**)
- `observation` (string ou null)
- `favorite` (bool), `image_url`/`image_blurhash`
- `__typename: "Product"`

### UI e textos exatos
- Título: **"Produtos"** + botão-tour ▶.
- **Duas abas (Tabs):** **"Produtos"** (ativa) | **"Lotes e validades"** (ícone relógio).
- Busca "Digite para buscar"; chip **"Ordenando por Nome"**.
- Cada card: **foto real** do produto (S3) ou placeholder "be", nome em CAPS, **preço** `R$ 101,75`, e **estoque** à direita: **"0 unidade"** em **VERMELHO** quando zerado / **"2 unidades"** em **VERDE** quando disponível. Estrela de favorito no topo direito.
- Ações por linha: `Excluir` (Selecionar aparece via barra).
- Barra inferior: `Menu · Filtros · Selecionar · Criar`.

### Layout MOBILE
Igual a Serviços mas com **foto real** proeminente e **badge de estoque colorido** (verde/vermelho) alinhado à direita na base do card. Aba secundária "Lotes e validades" no topo.

### Gap vs nosso app
- **PARCIAL** (gap 455–501). Já temos: busca server-side, foto, nome, preço (`salePrice`), estoque (`stock`), favorito, filtros (categoria/marca/estoque baixo/favoritos), criação, estado vazio.
- **AUSENTE — aba "Lotes e validades"** (gap 455): não há modelo `ProductLot` nem aba. Confirmado pela captura como Tab real ao lado de "Produtos".
- **Cores de estoque** (gap 462/463): captura confirma **verde = disponível / vermelho = zerado**. No nosso app estoque saudável usa `text-foreground` (não verde) e zero pode cair em `text-muted` — ajustar para verde/vermelho explícitos.
- **Campos extra do Belasis** que valem conferir no nosso `Product`: `cost_cents` (custo — temos `cost`?), `employee_price_cents` (preço funcionário — provável AUSENTE), `und`/`unit_quantity` (unidade de medida — provável AUSENTE), `observation`.

---

## 3. Categorias

**Rota real Belasis:** `https://belasis.app/groups`
**Tela equivalente:** `/categorias` → `apps/web/src/pages/CategoriasPage.tsx` (App.tsx:60).

### Operations GraphQL
- **`GroupsList`** ← query principal (corpo: `data.all_inventory_groups.all[]`).

### Campos reais (corpo de `GroupsList`, tipo `Inventory_Group`)
- `id` (string, ex. "172020")
- `name` (MAIÚSCULAS, ex. "ACQUAFLORA", "CABELO", "DEPILAÇÃO")
- `active` (bool)
- `__typename: "Inventory_Group"`

### UI e textos exatos
- Título: **"Categorias"**.
- Busca + chip **"Ordenando por Nome"**.
- Cada card: **nome** em CAPS + subtítulo **contagem de vínculos**: `"Possui 12 itens associados"` / `"Possui um item associado"` (singular) / `"Nenhum item associado"` (zero, em cinza claro).
- Ações por linha: `Excluir`, `Selecionar`.
- Barra inferior: `Menu · Filtros · Selecionar · Criar`.
- Observação: existem **categorias duplicadas** (ex. "LONDON COSMETICOS" 2x) e a contagem é o `_count` de itens vinculados.

### Layout MOBILE
Cards simples de duas linhas (nome + contagem), sem avatar. A contagem em cor de destaque (azul/roxo) quando >0, cinza quando 0.

### Gap vs nosso app
- **EXISTENTE** (gap 502–509, 100%). Já temos busca, ordenação por nome (backend), filtro Todas/Ativas/Inativas, criação (`CategoryModal`), estado vazio, contagem no subtítulo.
- **Nota de escopo:** no Belasis "Groups" é **um único conceito** (categoria de inventário unificada para serviços+produtos). Nosso app separa `ServiceCategory` e `ProductCategory`, e `/categorias` mostra apenas **categorias de produto** (subtítulo "Categorias de produto"). Divergência de modelagem — as categorias de serviço vivem no módulo de serviços.
- Belasis expõe **contagem textual** ("Possui X itens associados"); confirmar se nosso subtítulo/coluna já traz o `_count` por categoria (Marcas já traz, gap 513).

---

## 4. Marcas

**Rota real Belasis:** `https://belasis.app/brands`
**Tela equivalente:** `/marcas` → `apps/web/src/pages/MarcasPage.tsx` (App.tsx:61).

### Operations GraphQL
- **`BrandsList`** ← query principal (corpo: `data.all_inventory_brands.all[]`).

### Campos reais (corpo de `BrandsList`, tipo `Inventory_Brand`)
- `id` (string, ex. "482620")
- `name` (MAIÚSCULAS, ex. "ACQUAFLORA", "MILASSOL")
- `active` (bool)
- `__typename: "Inventory_Brand"`

### UI e textos exatos
- Título: **"Marcas"**.
- Busca + chip **"Ordenando por Nome"**.
- Cada card idêntico a Categorias: nome CAPS + **"Possui N itens associados"** / **"Possui um item associado"** / **"Nenhum item associado"**.
- Rodapé: **"20 registros no total"**.
- Ações por linha: `Excluir`, `Selecionar`. Barra inferior: `Menu · Filtros · Selecionar · Criar`.

### Layout MOBILE
Idêntico a Categorias (cards nome + contagem). Contagem em cor de destaque quando >0.

### Gap vs nosso app
- **EXISTENTE** (gap 510–517, 100%). Temos busca, ordenação por nome (backend), coluna de contagem (`_count.products`), filtro Todas/Com/Sem produtos, criação e edição (`BrandModal`).
- **AUSENTE — situação ativa** (gap 518): o corpo do Belasis expõe `active: true` por marca, mas nosso modelo `Brand` **não tem campo `active`** nem toggle/filtro. Ação: adicionar `active Boolean @default(true)` em `Brand` + DTO + toggle no `BrandModal` + filtro.
- Diferença cosmética: Belasis usa bottom-sheet mobile; nosso `BrandModal` é modal central (gap 517) — opcional.

---

## 5. Pacotes Predefinidos

**Rota real Belasis:** `https://belasis.app/package-templates`
**Tela equivalente parcial:** não há rota própria; templates de pacote existem embutidos em `/pacotes` (`PacotesPage` → `TemplateModal`, gap 121). App.tsx:63 = `/pacotes`.

### Operations GraphQL
- **`PacakageTemplatesList`** (grafia do Belasis, com "Pacakage") ← corpo: `data.all_package_templates` = `{ all: [], total_count: 0, __typename: "AllPackageTemplates" }`.

### Campos reais
Lista **vazia** nesta conta (`total_count: 0`); não há campos de item para observar. Envelope: `all_package_templates.all[]`.

### UI e textos exatos
- Título: **"Pacotes Predefinidos"**.
- Estado vazio: **"Nenhum item encontrado"** / **"Verifique seus filtros e tente novamente."** / **"Clique para criar"** / **"0 registros no total"**.
- **Modal de upsell sobreposto (recurso não contratado):** ícone `!` roxo + **"Você ainda não possui essa funcionalidade contratada"** + vídeo tutorial ("Pacotes Predefinidos Adicionar") + botões **"Fechar"** / **"Contratar"**.
- Barra inferior: `Menu · Filtros · Selecionar · Criar`.

### Layout MOBILE
Tela de lista padrão coberta por modal de gating (dialog central com ícone de alerta, thumbnail de vídeo YouTube, dois botões inferiores lado a lado).

### Gap vs nosso app
- No Belasis é **feature gated** (upsell). Nós já temos `PackageTemplate` (POST `/package-templates`) e o `TemplateModal` em `/pacotes` — **funcionalmente PARCIAL/EXISTENTE**, sem a tela dedicada nem o gating por plano.
- Relaciona-se ao gap 22 (modal de "módulo não contratado" — AUSENTE no nosso app: sem entitlements/plano na `Company`). Se o produto quiser paridade de upsell, modelar entitlements + modal (sem marca Belasis).
- Ação opcional: rota/aba dedicada "Modelos de pacote" reusando o `TemplateModal` existente.

---

## 6. Compras

**Rota real Belasis:** `https://belasis.app/purchases`
**Tela equivalente:** **NÃO EXISTE** rota `/compras` no nosso app (App.tsx sem entrada; sem módulo API `purchases`). Só há `Purchase`/`PurchaseItem`/`Supplier` no schema, sem API/UI.

### Operations GraphQL
- **`PurchasesList`** ← corpo: `data.all_inventory_purchases` = `{ all: [], total_count: 0, __typename: "AllPurchases" }`.
- Também dispara **`FetchDocumentTemplates`** no boot desta tela (pré-carga).

### Campos reais
Lista **vazia** (`total_count: 0`); sem itens para observar campos. Envelope: `all_inventory_purchases.all[]`.

### UI e textos exatos
- Título: **"Compras"**.
- **Duas abas (Tabs):** **"Compras"** (ativa, ícone carrinho) | **"XMLs Importados"** (ícone documento "x").
- Ordenação: chip **"Ordenando por Ticket"** (não "Nome"!) → indica campo **ticket/número sequencial** na compra.
- Estado vazio: "Nenhum item encontrado" / "Verifique seus filtros e tente novamente." / **"Clique para criar"** / **"0 registros no total"**.
- Barra inferior: **`Menu · Filtros · Criar`** (3 ícones — **sem "Selecionar"**).

### Layout MOBILE
Header título + Tabs (Compras / XMLs Importados) + busca + chip "Ordenando por Ticket" + ilustração de caixa vazia centralizada com CTA "Clique para criar". Bottom nav flutuante de 3 ícones.

### Gap vs nosso app
- **AUSENTE** integral (gap 519–540). Precisa: módulo API `purchases` + rota `/compras` + página com abas Compras/XMLs.
- Campos/entidades já no schema para reuso: `Purchase` (`date`, `total`, `supplierId`, `paymentMethodId`, `accountId`), `PurchaseItem` (`quantity`, `unitCost`), `Supplier`, `InventoryMovement`.
- Confirmado pela captura: **campo "ticket"** (ordenação por Ticket) — nosso `Purchase` não tem número/ticket sequencial (gap 521). Adicionar.
- Confirmado: **aba "XMLs Importados"** (gap 519/538) — precisa modelo `ImportedXml` + parse de NF-e (chave 44 díg., associação item-XML→Product).
- **Entrada de estoque automática** (gap 537): ao confirmar compra, gerar `InventoryMovement` (type in) por item — hoje só há movimentação manual por produto.

---

## 7. Gerador de Documento

**Rota real Belasis:** `https://belasis.app/document-templates`
**Tela equivalente:** **NÃO EXISTE** (sem rota `/documentos`, sem modelo `GeneratedDocument`/`DocumentTemplate`).

### Operations GraphQL
- **`fetchDocumentTemplates`** ← corpo: `data.document_templates` = `{ all: [], total_count: 0, __typename: "DocumentTemplates" }`.

### Campos reais
Lista **vazia** (`total_count: 0`); sem itens. Envelope: `document_templates.all[]`.

### UI e textos exatos
- Título: **"Gerador de Documento"**.
- Estado vazio: "Nenhum item encontrado" / "Verifique seus filtros e tente novamente." / "Clique para criar" / "0 registros no total".
- **Modal de upsell (recurso não contratado):** ícone `!` roxo + **"Você ainda não possui essa funcionalidade contratada"** + **"Fechar"** / **"Contratar"** (sem thumbnail de vídeo nesta tela).
- Barra inferior: **`Menu · Filtros · Criar`** (3 ícones, sem Selecionar).

### Layout MOBILE
Tela de lista padrão coberta por dialog de gating central (ícone alerta grande + dois botões inferiores). Bottom nav de 3 ícones ao fundo.

### Gap vs nosso app
- **AUSENTE / GATED** (gap 541–547). Módulo inexistente no nosso app. No Belasis é **upsell pago** (não contratado nesta conta).
- Se o produto priorizar: criar modelo `GeneratedDocument`/`DocumentTemplate` + rota + editor a partir de templates. Caso contrário, depende de decisão comercial/feature-flag (gap 545/547 = "DEPENDE DE CONTRATAÇÃO").
- Reaproveita o mesmo padrão de **modal de upsell** de Pacotes Predefinidos (gap 22 — entitlements por plano na `Company`, ainda AUSENTE).

---

## Resumo de refinamentos ao gap-analysis (evidência das capturas)

1. **Serviços e Produtos = tipo `Product`/`all_inventory_products`** no Belasis (mesma entidade). `duration` em **segundos**. Nosso split `Service`/`Product` é divergência intencional aceitável.
2. **Categorias = `Inventory_Group`** e **Marcas = `Inventory_Brand`**, ambos `{id, name, active}` com contagem textual "Possui N itens associados". **Marca expõe `active`** → confirma gap 518 (nosso `Brand` sem `active`).
3. **Produtos:** cores de estoque **verde=disponível / vermelho=zerado** confirmadas; aba **"Lotes e validades"** é Tab real (gap 455 AUSENTE). Campos extra Belasis: `cost_cents`, `employee_price_cents`, `und`, `unit_quantity`, `observation`.
4. **Compras:** ordenação por **"Ticket"** (número sequencial), abas **Compras / XMLs Importados**, barra inferior de 3 ícones. Módulo AUSENTE (schema tem entidades, falta API+UI).
5. **Pacotes Predefinidos** e **Gerador de Documento** são **feature-gated** no Belasis (modal "Você ainda não possui essa funcionalidade contratada" + Fechar/Contratar) → reforça necessidade do gap 22 (entitlements/plano na `Company`).
6. Padrão de barra inferior contextual: `Menu · Filtros · Selecionar · Criar` (listas com seleção) vs `Menu · Filtros · Criar` (Compras, Gerador de Documento).
