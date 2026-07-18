# Belasis LIVE — Módulo Cadastros

> Evidência de capturas ao vivo (viewport mobile/iPhone, conta real FATIMA — Studio/salão com ~700 clientes).
> Fonte: `scratchpad/belasis-capture/cad-*` (page.txt + api.json + shot.png). Não copiar marca/cores/nome Belasis — alvo é HeroUI/Salonpass, mobile-first.

## Estrutura do menu "Cadastros" (do DOM da sidebar, capture cad-convidar)

O item **Cadastros** do menu lateral tem 5 sub-itens, nesta ordem:
1. Clientes → `/clients`
2. Anamneses → `/anamnesis`
3. Convidar profissionais → (modal/página; caiu em `/calendar` na captura)
4. Profissionais → (não capturado neste módulo)
5. Fornecedores → `/vendors`

Grupos irmãos no menu: Principal, Financeiro, Comissões, **Cadastros**, Controle, Relatórios, WhatsApp API Oficial (novo), Marketing, Configurações, Ajuda, Indique e ganhe. Rodapé: `v5.7.12`. Topo do menu: "Olá, FATIMA / Meu perfil", botão "Novo", chip "IA Beta".

Barra inferior contextual comum às telas de lista (do screenshot): **Menu · Filtros · Selecionar · Criar** (4 ícones). Em Anamneses a barra reduz para **Menu · Filtros · Criar** (sem Selecionar).

---

## 1. Clientes

**Rota real Belasis:** `https://belasis.app/clients`
**Tela equivalente no nosso app:** `/clientes` → `apps/web/src/pages/ClientesPage.tsx` (App.tsx:56).

### Operations GraphQL (a lógica que a tela consome)
- **`ClientsList`** ← query principal da lista.
- Contexto carregado junto (mesmo boot em todas as telas): `GlobalCurrentUserContext`, `findMultiSalons`, `Notifications`, `BirthdayClientsQuery`, `Banners`, `CalendarsCalendar`, `TutorialCategories`, `FetchWhatsappStatus`, e um bloco "Webook*" de pré-carga: `WebookAllInventoryProducts/Groups/Brands`, `WebookAllEmployees`, `WebookScheduleColors`, `WebookFinancePayments/Charts/Accounts`, `WebookMessageModelsGroups`, `WebookStatusMessage`, `WebookAddons`.

### Campos reais (corpo de `ClientsList`)
`data.all_clients.all[]` — cada `Client`:
- `id` (string, ex. "5337226")
- `name` (MAIÚSCULAS, ex. "ADELIA ARAUJO")
- `active` (bool)
- `avatar_url` (`/default_user.jpg` quando sem foto, senão URL S3 com `small_thumb_...`)
- `avatar_blurhash` (string ou null — placeholder de carregamento da foto)
- `phone2` (string dígitos c/ DDI, ex. "5589981228494", ou null → renderiza "Sem telefone")
- `__typename: "Client"`

Envelope: `all_clients` (não paginado no corpo observado; lista completa alfabética).

### UI e textos exatos
- Título: **"Clientes"** (com um botão redondo ▶ "play/tour" ao lado do título — ícone tutorial).
- Busca: input placeholder **"Digite para buscar"**.
- Ordenação: chip/botão **"Ordenando por Nome"** com seta (`⌃`) → dropdown de ordenação.
- Cada linha (por cliente): ações **"Excluir"** e **"Selecionar"** (aparecem no DOM por linha; provavelmente swipe/menu).
- Estado do telefone: **"Sem telefone"** como subtítulo quando `phone2` é null.
- Banner topo global (não é do módulo): "Sua fatura com vencimento 19/07/2026 já está disponível :) / Ver a minha assinatura".

### Ações visíveis
Buscar (texto), Ordenar (por Nome), **Criar** (barra inferior), **Selecionar** (modo multi-seleção), **Excluir** (por item), Filtros (barra inferior).

### Layout MOBILE (screenshot)
- Header simples: título grande "Clientes" + botão-tour circular.
- Input de busca full-width com ícone de lupa.
- Chip "Ordenando por Nome" (pill roxo) abaixo da busca.
- **Lista de cards** verticais, um por cliente: avatar circular à esquerda (ícone genérico de usuário roxo quando `/default_user.jpg`, foto real quando houver), nome em CAPS + telefone formatado `+55 (89) 98122 8494` ou "Sem telefone" abaixo.
- Telefone é exibido já **formatado com máscara BR** na UI (o corpo traz só dígitos crus).
- **Bottom nav flutuante** sobre a lista: Menu / Filtros / Selecionar / Criar.

### Gap vs nosso app
Nós já temos `/clientes` com busca por nome, ordenação por nome, ActiveChip, DataTable com colunas Nome/Apelido/Celular/Telefone secundário/Status e modal de criação/edição (CustomerModal). Gaps confirmados pela evidência:
- **Avatar com foto real:** Belasis usa `avatar_url` + `avatar_blurhash`; nosso Customer só mostra iniciais (gap já registrado ID 303). Confirmar: adicionar `avatarUrl` (+ blurhash opcional) ao model.
- **"Sem telefone" como estado:** Belasis mostra a string quando não há telefone; nós mostramos "—". Alinhar cópia mobile.
- **Modo Selecionar / Excluir por linha:** Belasis expõe seleção múltipla e exclusão por item na barra/lista; nosso DataTable não tem seleção (gap ID 308).
- **Layout mobile card-first:** Belasis é lista de cards (avatar+nome+telefone), não tabela. Nossa DataTable precisa de variante card no mobile.
- Campo do corpo é `phone2` (secundário exibido como principal aqui) — só um telefone aparece na lista; manter nosso mapeamento `phone`.

---

## 2. Anamneses

**Rota real Belasis:** `https://belasis.app/anamnesis`
**Tela equivalente no nosso app:** NÃO EXISTE rota/página (não há `/anamneses` em App.tsx). AUSENTE.

### Operations GraphQL
- **`AnamnesisList`** ← query da lista. Mesmo bloco de contexto/Webook das outras telas.

### Campos reais (corpo de `AnamnesisList`)
`data.all_anamnesis` — tipo **`AllAnamnesisType`**:
- `total_count` (int, aqui `0`)
- `all[]` (vazio nesta conta)
- `__typename: "AllAnamnesisType"`

> A conta capturada **não tem a funcionalidade contratada** (ver abaixo), então a lista vem vazia. Estrutura de item de anamnese NÃO foi observada no corpo — **captura incompleta para o schema do item; re-capturar em conta com Anamneses Pro**.

### UI e textos exatos
- Título: **"Anamneses"**.
- Abas/segmentos no DOM: **"Anamneses"** e **"Modelo de anamneses"** (duas visões: fichas preenchidas × modelos/templates).
- Estado vazio: **"Nenhum item encontrado / Verifique seus filtros e tente novamente. / Clique para criar"**.
- Contador: **"0 registros no total"**.
- Barra inferior: **Menu · Filtros · Criar** (sem "Selecionar").
- **Gating por plano (modal, do screenshot):** ícone `!` roxo, título **"Você ainda não possui essa funcionalidade contratada"**, card de vídeo "**Anamneses Adicional Pro** / Belasis / Assista no YouTube", botões **"Fechar"** e **"Contratar"**. (Do vídeo tutorial dá pra ver os campos do form desktop: *Modelo de anamnese, Data, Cliente, Status (Aberto), tipo de cabelo, cor dos olhos, Foto da face* — evidência secundária, não do nosso corpo.)

### Ações visíveis
Alternar Anamneses ↔ Modelo de anamneses, Filtros, **Criar** (bloqueado por "Contratar" nesta conta).

### Layout MOBILE (screenshot)
Tela coberta por modal de upsell. Por baixo: título "Anamneses", segmento de abas, empty state central. Barra inferior Menu/Filtros/Criar.

### Gap vs nosso app
**AUSENTE por completo** — confirma o gap-analysis (Cadastros puxado para baixo pelas "19 telas de Anamnese não detalhadas"). Necessário:
- Model/entidade Anamnesis + AnamnesisTemplate ("Modelo de anamneses").
- Página `/anamneses` com 2 abas (Fichas × Modelos), empty state, contador "N registros no total", Criar.
- Form: modelo, data, cliente, status (Aberto/…), campos dinâmicos por modelo, upload de foto.
- **Decidir gating por plano** (Belasis trata como add-on pago "Anamneses Adicional Pro"). No nosso app: ou entregar aberto, ou modelar feature-flag/plano. Especificar antes de construir — schema do item ainda não observado ao vivo.

---

## 3. Convidar profissionais

**Rota real Belasis:** captura caiu em `https://belasis.app/calendar` — é aberto como **modal/painel** sobreposto (não navegou para rota própria). **Captura parcial** do fundo, mas o **modal foi capturado inteiro** no DOM e no screenshot.
**Tela equivalente no nosso app:** NÃO EXISTE. Mais próximo: `/profissionais` (ProfissionaisPage) e `/marketing/link` (link de agendamento). AUSENTE como fluxo de convite por link.

### Operations GraphQL
Nenhuma operation específica de convite foi capturada (só o boot padrão: `GlobalCurrentUserContext`, `findMultiSalons`, `CalendarsCalendar`, etc.). O modal parece usar link estático + geração/rotação de link (sem GraphQL observado). **Re-capturar a ação "Alterar o link"/"Copiar" para ver a mutation.**

### Campos/dados reais
- Link de convite: `https://app.belasis.app/register?in...` (query truncada — token de convite; **não expor**).
- Contador de equipe: **"Na sua equipe, há 5 profissionais"**.
- Toggle de status do link: **Ativo / Inativo**.

### UI e textos exatos
- Banner/hero ilustrado (mock desktop+mobile) com bullets: **"Pensado para levar seu negócio para o próximo nível!"**, **"Com o agendamento online seu cliente pode agendar, realizar o pagamento e você é notificado na mesma hora!"**, **"Sistema disponível 24 horas, 7 dias na semana!"**.
- Título: **"Convide profissionais para entrar na sua equipe"** (no menu o item chama-se "Convidar profissionais").
- Subtítulo: **"Na sua equipe, há 5 profissionais"**.
- Campo de link (read-only) + botão **"Copiar"** (com ícone de share).
- Caixa de aviso: **"Qualquer pessoa que receber este link poderá acessar e entrar na sua equipe."** + link de ação **"Alterar o link"**.
- Toggle **"Ativo"** (switch on) / "Inativo".
- Rodapé legal: **"Este site é protegido por reCAPTCHA. São aplicáveis à Política de Privacidade e os Termos de Serviço do Google"**.
- Botão de fechar `×` no canto.

### Ações visíveis
Copiar link, **Alterar o link** (rotacionar/invalidar), Ativar/Inativar link, Fechar.

### Layout MOBILE (screenshot)
Modal full-screen fundo azul com ilustração no topo, título centralizado, contador, input de link + botão "Copiar" à direita, caixa informativa, toggle "Ativo", texto reCAPTCHA. `×` no topo direito.

### Gap vs nosso app
**AUSENTE.** Não temos fluxo de "convidar profissional por link público de auto-registro". Temos cadastro manual de profissionais em `/profissionais`. Necessário (se priorizado):
- Endpoint de geração de link de convite por empresa (token), com estados Ativo/Inativo e "rotacionar link".
- Rota pública `/register?invite=<token>` para o profissional entrar na equipe.
- Modal "Convidar profissionais" acessível pelo menu Cadastros, com contador da equipe, copiar link, alterar link, toggle ativo.
- Mutation/lógica ainda **não observada ao vivo — re-capturar**.

---

## 4. Fornecedores

**Rota real Belasis:** `https://belasis.app/vendors`
**Tela equivalente no nosso app:** `/fornecedores` → `apps/web/src/pages/FornecedoresPage.tsx` (App.tsx:62).

### Operations GraphQL
- **`VendorsList`** ← lista principal. Mesmo bloco de contexto/Webook.

### Campos reais (corpo de `VendorsList`)
`data.all_inventory_vendors.all[]` — cada **`Vendor`**:
- `id` (string, ex. "6362843")
- `name` (CAPS, ex. "AGESPISA")
- `email` (null na maioria)
- `phone1` (null observado)
- `phone2` (string dígitos ou null, ex. "5589999001990")
- `cnpj` (string, vazio `""` em todos os observados)
- `active` (bool)
- `__typename: "Vendor"`

Envelope: `all_inventory_vendors` (fornecedor é entidade de inventário/estoque).

### UI e textos exatos
- Título: **"Fornecedores"**.
- Busca: placeholder **"Digite para buscar"**.
- Sem chip de ordenação visível (diferente de Clientes) — lista alfabética por nome.
- Ações por linha no DOM: **"Excluir"** e **"Selecionar"**.
- Barra inferior: **Menu · Filtros · Selecionar · Criar**.

### Ações visíveis
Buscar, **Criar**, **Selecionar** (multi), **Excluir** (por item), Filtros.

### Layout MOBILE (screenshot)
- Header "Fornecedores" + input de busca full-width.
- **Lista de cards** simples (sem avatar): nome em CAPS; quando há telefone, aparece formatado abaixo (`+55 (89) 99900-1990`), senão só o nome.
- Bottom nav: Menu / Filtros / Selecionar / Criar.

### Gap vs nosso app
Já temos `/fornecedores` bem alinhado: busca (nome/CNPJ/telefone), filtro Ativo/Inativo/Todos, colunas Fornecedor/E-mail/Celular/CNPJ/Status, criar/editar/excluir. Alinhamentos vs evidência:
- Belasis expõe **dois telefones** (`phone1`, `phone2`); nós temos `phone` (celular). Confirmar se precisamos de 2º telefone.
- **Modo Selecionar** (multi-seleção) na barra — não temos seleção de linhas na DataTable (mesmo gap dos Clientes, ID 308/185).
- **Layout mobile card-first** (nome + telefone), não tabela — precisa variante card no mobile.
- CNPJ costuma vir vazio (`""`) — tratar como opcional na UI (nós já mostramos "—").
- Fornecedor é `all_inventory_vendors` (ligado a estoque/compras) — coerente com nosso módulo de produtos/compras.

---

## Resumo de gaps do módulo (refino do gap-analysis)

| Tela | Status atual doc | Evidência ao vivo | Ação |
|---|---|---|---|
| Clientes | EXISTENTE (parcial) | Card-first, avatar+blurhash, "Sem telefone", Selecionar/Excluir | Avatar real, seleção múltipla, variante card mobile |
| Anamneses | AUSENTE (19 telas não detalhadas) | Abas Fichas×Modelos, empty state, gating "Contratar", schema do item NÃO visto | Modelar entidade+template; **re-capturar item em conta Pro** |
| Convidar profissionais | AUSENTE | Modal link de auto-registro, "5 profissionais", Copiar/Alterar link, toggle Ativo | Novo fluxo de convite por token; **re-capturar mutation** |
| Fornecedores | EXISTENTE | Card-first, phone1/phone2, Selecionar/Excluir, CNPJ opcional | Seleção múltipla, variante card mobile, avaliar 2º telefone |

**Capturas incompletas:** Convidar profissionais (caiu em `/calendar`, só modal); Anamneses (funcionalidade não contratada → lista vazia, sem schema de item). Re-capturar ambas.
