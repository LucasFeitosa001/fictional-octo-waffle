# Belasis LIVE — Módulo Relatórios (capturas mobile ao vivo)

> Análise de 3 capturas ao vivo (conta real "ESPAÇO FATIMA LACERDA", viewport iPhone/mobile). Fonte: `belasis-capture/rel-painel`, `rel-metas`, `rel-dre`. Refina os itens 548–609 de `docs/belasis-gap-analysis.md`.
> Alvo: HeroUI/Salonpass, mobile-first. Nunca copiar marca/cores/nome Belasis.

## Nota transversal (as 3 páginas)

Nenhuma das três páginas emitiu **operations GraphQL específicas de relatório**. Em todas, a captura registrou apenas o **bootstrap global do shell** (mesmas ops em painel/metas/DRE):

`GlobalCurrentUserContext`, `Banners`, `WebookStatusMessage`, `WebookAddons`, `TutorialCategories`, `FetchWhatsappStatus`, `CalendarsCalendar`, `BirthdayClientsQuery`, `Notifications`, `findMultiSalons`, e as queries de sincronização offline `WebookAllEmployees`, `WebookScheduleColors`, `WebookFinanceCharts`, `WebookFinanceAccounts`, `WebookFinancePayments`, `WebookAllInventoryBrands`, `WebookAllInventoryGroups`, `WebookAllInventoryProducts`, `WebookMessageModelsGroups` — todas retornando arrays vazios (`{"data":{"...":[]}}`) porque o cache local já estava sincronizado.

**Conclusão-chave:** no **app mobile** do Belasis os relatórios **não renderizam dados** — o painel de relatórios é uma lista estática de categorias e traz o aviso _"Para visualizar a versão completa dos relatórios acesse o sistema em seu computador"_. As telas de detalhe (DRE) vêm **em branco** no mobile. Isso valida a decisão de gap #557: no nosso admin web NÃO devemos replicar esse bloqueio — o nosso web JÁ é a versão completa. O trabalho de dados/gráficos de relatório deve ser observado em captura **desktop** (re-capturar).

---

## Página 1 — Painel de relatórios (hub)

### 1. Rota real / equivalente nosso
- **Belasis:** `https://belasis.app/reports/favorites` (hub "Relatórios" — lista de categorias favoritas/atalhos).
- **Nosso app:** `/relatorios` → `RelatoriosPage` (`apps/web/src/App.tsx:71`, `apps/web/src/pages/RelatoriosPage.tsx`).

### 2. Operations GraphQL
Apenas o bootstrap global (ver Nota transversal). **Nenhuma** op de relatório disparada — o hub é navegação estática, sem fetch de dados.

### 3. Campos/dados reais observados
Nenhum dado de relatório na resposta. O único conteúdo textual dinâmico é o banner de fatura (`WebookStatusMessage` → `title: "Sua fatura com vencimento 19/07/2026 já está disponível :)"`, botão `custom_link: /subscription`). O hub em si é uma lista fixa de rótulos de categoria.

### 4. UI e textos exatos (DOM + screenshot)
- Título da página: **"Relatórios"** (H1).
- Lista de categorias, cada linha com ícone à esquerda + rótulo + chevron `>` à direita:
  - **Financeiro** (ícone $ / cifrão)
  - **Agendamentos** (ícone calendário)
  - **Clientes** (ícone pessoa)
  - **Aniversariantes** (ícone pessoa)
  - **Vendas** (ícone etiqueta/tag)
  - **Estoque** (ícone grade/blocos)
  - **Notas Fiscais** (ícone documento)
  - **Ranking** (ícone troféu)
  - **Mensagens** (parcialmente coberto pela bottom nav)
- Cada item é separado por divisória horizontal fina; linhas altas, toque confortável (list-item ~72px).
- Rodapé em card destacado (fundo lilás/roxo claro): **"Para visualizar a versão completa dos relatórios acesse o sistema em seu computador através do endereço https://www.belasis.app/"**.
- Banner laranja fixo no topo com o aviso de fatura + botão azul **"Ver a minha assinatura"** (fechável por X no canto).

### 5. Ações visíveis
- **Selecionar categoria** (tap na linha → navega ao relatório da categoria; no mobile leva ao aviso/tela vazia).
- Fechar banner de fatura (X).
- CTA "Ver a minha assinatura".

### 6. Layout MOBILE
- Lista vertical full-width de linhas com ícone + label + chevron (padrão "list settings"/navigation list).
- **Bottom nav** flutuante (pill arredondada) com 4 itens: **Menu** (hambúrguer), **Painel** (velocímetro), **Agenda** (calendário), **Comandas** (documento/checklist). "Painel"/"Agenda"/"Comandas" são os atalhos globais; "Menu" abre o drawer.
- Sem FAB nesta tela.

### 7. Gap vs nosso app
- **Nosso `/relatorios` já é MAIS completo que o hub mobile Belasis:** renderiza KPIs, rankings (RankCard: produtos/serviços/profissionais), gráficos (LineChart/PieChart/BarChart via recharts), DateRangeFilter e export CSV — enquanto o hub mobile Belasis é só uma lista de links.
- **Falta (confirma gap 548–556):** transformar `/relatorios` em **hub de categorias** com cartões clicáveis por categoria (Financeiro, Agendamentos, Clientes, Aniversariantes, Vendas, Estoque, Ranking, Mensagens) que abrem relatórios dedicados. Hoje é uma página única com tudo agregado.
- **Categorias ausentes de destino:** Estoque (553 AUSENTE), Notas Fiscais (554 depende de integração fiscal), Mensagens (556 AUSENTE). "Aniversariantes"/"Clientes"/"Vendas"/"Ranking" existem como dados na overview mas sem cartão/página dedicada (PARCIAL).
- **Não replicar** o aviso "acesse pelo computador" (gap 557 — N/A no web).

---

## Página 2 — Metas

### 1. Rota real / equivalente nosso
- **Belasis:** `https://belasis.app/goals`.
- **Nosso app:** `/metas` → `MetasPage` (`apps/web/src/App.tsx:72`, `apps/web/src/pages/metas/MetasPage.tsx`).

### 2. Operations GraphQL
Só o bootstrap global. **Nenhuma op de metas/goals capturada** — a tela foi bloqueada pelo modal de "funcionalidade não contratada" antes de qualquer fetch de metas. **Captura de dados incompleta — re-capturar em conta com o módulo contratado** para observar a query real de goals e seus campos.

### 3. Campos/dados reais observados
Nenhum registro de meta (conta não contratou o recurso). Filtros expostos no DOM: **Período** = "Julho, 2026" (seletor de mês), **Profissionais** = "Todos".

### 4. UI e textos exatos (DOM + screenshot)
- Barra de filtros: **"Filtros"**, seletor de mês **"Julho, 2026"**, campo **"Período"**, campo **"Profissionais"** com valor **"Todos"**.
- Estado vazio: **"Nenhuma meta encontrada"** / subtítulo **"Verifique seus filtros e tente novamente."** / CTA **"Clique para criar"**.
- **Modal de gating** (screenshot): ícone circular roxo com "!", título **"Você ainda não possui essa funcionalidade contratada"**, dois botões no rodapé — **"Fechar"** (neutro, esquerda) e **"Contratar"** (destaque roxo, direita).
- Ação de topo: **"Ações"** e **"Criar"**.

### 5. Ações visíveis
- **Criar** meta (bloqueada → dispara modal de upsell).
- **Ações** (menu de ações em massa/contexto).
- **Filtrar** por Período (mês) e por Profissional.
- Modal: **Fechar** / **Contratar**.

### 6. Layout MOBILE
- Cabeçalho com filtros (mês + profissional).
- Área de conteúdo com empty state centralizado (ilustração/ícone + título + subtítulo + CTA).
- **Bottom nav contextual** desta tela: **Menu**, **Filtros**, **Ações**, **Criar** (barra inferior muda de contexto vs. o painel — aqui traz ações da página em vez dos atalhos globais).
- Modal de upsell ocupa quase tela cheia (bottom sheet grande), rodapé de 2 botões lado a lado.

### 7. Gap vs nosso app
- **Nosso `/metas` já EXISTE e é funcional** (gap 609 = EXISTENTE): CRUD de `Goal` via `/goals`, tipos `sales/appointments/customers/commission`, filtro por mês (MonthField), barra de progresso, cards de meta. **Já superamos o Belasis mobile** (que aqui está bloqueado por plano).
- **Alinhamento de UX a observar:** Belasis tem filtro por **Profissionais** ("Todos") além do período — conferir se nosso MetasPage filtra por profissional (o KIND inclui `commission`, sugere escopo por profissional). Refinar filtro de escopo.
- **Estado vazio:** padronizar nossos textos com o mesmo tom ("Nenhuma meta encontrada" + CTA "Criar") — nosso `EmptyState` já cobre isso.
- **Gating por plano:** Belasis trata Metas como **recurso pago** (modal Fechar/Contratar). Decisão comercial nossa: não gatear por padrão, mas o padrão de modal de upsell (título + Fechar/Contratar) é reaproveitável se algum módulo virar pago (ver gaps 545–547, 600–601).
- **Barra inferior contextual** (Menu/Filtros/Ações/Criar): nosso app usa PageHeader com ações no topo; o Belasis mobile move filtros/ações para a bottom bar. Reforça o gap 34 (botão "Filtros" na barra inferior contextual mobile).

---

## Página 3 — DRE (Demonstrativo de Resultado)

### 1. Rota real / equivalente nosso
- **Belasis:** `https://belasis.app/reports/financial/dre`.
- **Nosso app:** **sem equivalente** — não há rota `/relatorios/financeiro/dre` nem DRE em `RelatoriosPage`/`FinanceiroPainelPage`. Mais próximo: `/financeiro` (`FinanceiroPainelPage`, cards Entradas/Saídas/Saldo — não é DRE por categoria/linha).

### 2. Operations GraphQL
Só o bootstrap global (subconjunto reduzido). **Nenhuma op de DRE capturada.**

### 3. Campos/dados reais observados
Nenhum. A tela renderizou **em branco** no mobile (ver screenshot: área de conteúdo vazia, apenas seta de voltar `←` no topo). **Captura incompleta — re-capturar no DESKTOP**, onde o DRE efetivamente renderiza (o próprio Belasis avisa que relatórios completos só no computador).

### 4. UI e textos exatos (DOM + screenshot)
- DOM: só cabeçalho global ("Menu / Painel / Agenda / Comandas") + banner de fatura. Sem título nem linhas de DRE.
- Screenshot: banner laranja de fatura no topo, botão **"Ver a minha assinatura"**, **seta de voltar `←`** no canto superior esquerdo, resto da tela **em branco**.
- **Bottom nav:** Menu / Painel / Agenda / Comandas.

### 5. Ações visíveis
- **Voltar** (`←`). Nenhuma outra ação renderizada no mobile.

### 6. Layout MOBILE
- Cabeçalho com botão voltar; corpo vazio (relatório não suportado no mobile). Bottom nav global.

### 7. Gap vs nosso app
- **DRE é AUSENTE no nosso app** — não catalogado explicitamente em 548–609 além de "Financeiro" (548) e fluxo de caixa (564–567). O DRE é um relatório contábil por linhas (receita bruta → deduções → receita líquida → custos → despesas → resultado) que **não existe** hoje.
- **Ação recomendada:** re-capturar `/reports/financial/dre` no **desktop** para extrair as linhas/estrutura reais antes de especificar. Não fabricar as linhas do DRE a partir desta captura (veio vazia).
- Relaciona-se aos gaps AUSENTES 564–567 (fluxo de caixa/saldo acumulado) e 573 (despesas por categoria via `FinancialCategory`) — pré-requisitos de dados para um DRE.

---

## Resumo de refinamento ao gap-analysis (evidência ao vivo)

| Gap | Item | Status doc | Refino com captura ao vivo |
|-----|------|-----------|----------------------------|
| 548–556 | Categorias do hub de relatórios | PARCIAL/AUSENTE | Confirmado: hub Belasis mobile é **lista estática de 9 categorias** (Financeiro, Agendamentos, Clientes, Aniversariantes, Vendas, Estoque, Notas Fiscais, Ranking, Mensagens). Nosso `/relatorios` deve virar hub de cartões clicáveis. |
| 557 | Aviso "versão completa no computador" | AUSENTE | Confirmado como comportamento **mobile-only** do Belasis. N/A no nosso web (já é a versão completa). Não replicar. |
| 609 | Metas (submenu) | EXISTENTE | Confirmado que nosso `/metas` supera o Belasis (que aqui está **bloqueado por plano**). Belasis tem filtro extra por **Profissionais**; alinhar. |
| — | DRE `/reports/financial/dre` | (não catalogado) | **AUSENTE** no nosso app; captura mobile veio **em branco**. Re-capturar no desktop antes de especificar. |
| 34 | Barra inferior contextual (Filtros/Ações) | PARCIAL | Confirmado: em `/goals` a bottom bar vira **Menu/Filtros/Ações/Criar** (contextual). Reforça mover filtros/ações para bottom sheet no mobile. |

**Re-capturar (desktop):** `/reports/financial/dre` (linhas do DRE), demais categorias do hub e `/goals` em conta com o módulo contratado (ops e campos reais de Goal).
