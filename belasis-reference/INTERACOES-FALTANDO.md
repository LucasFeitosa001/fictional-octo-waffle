# INTERAÇÕES FALTANDO — Belasis (para próxima geração de scripts Playwright)

> Fonte: auditoria de `belasis-reference/pixel/desktop/*` (14 rotas capturadas até aqui)
> Já capturado por rota: `page.html/png/css.json`, sidebar (expandida; algumas colapsadas),
> `new-open` (drawer novo), animação 3-frame do drawer (in/out 0/60/240ms),
> `row-menu` (3-pontinhos da 1ª linha), `pickers/*` (dropdowns internos ao drawer),
> e `tabs/*` (SÓ para `employees` — 12 abas internas).
>
> Também já foi capturado por `capture-pixel-perfect.js`:
> `delete-confirm` (modal excluir), `detail-open` (drawer detalhe em sales/calendar/packages/subscriptions),
> `detail-actions-menu` (menu "Mais"/"Ações" do detalhe).
>
> **Ordenação:** P0 (bloqueia paridade visual) → P1 (importante) → P2 (nice-to-have) → P3 (edge).

## Legenda

- **Rotas alvo** usa o slug do Belasis (`/calendar`, `/sales`, …) — todas as 14 já capturadas exceto onde marcado "TODAS" ou "\*novo módulo\*".
- **Como reproduzir** é um roteiro Playwright curto (seletor + ação). Assume que o script já está logado e navegou pra rota.
- Ícone ✱ = requer capturar overlay/animação em 3 frames (0/60/240ms).

---

## P0 — bloqueia paridade visual (fazer primeiro)

| # | Interação | Como reproduzir | Rotas alvo |
|---|---|---|---|
| 1 | **Hover em linha da tabela** (bg muda p/ #FAFAFA) | `page.hover('.ant-table-tbody > tr:nth-child(2)')` → screenshot + `getComputedStyle` da linha. Repetir para linha ímpar/par se houver zebra. | TODAS 14 |
| 2 | **Focus em input** (borda azul/roxa, ring, label ativo) | Abrir drawer `Novo`; `page.focus('.ant-drawer .ant-input:visible')`; capturar computed CSS `borderColor/boxShadow`. Fazer 1 input texto + 1 select + 1 date. | TODAS 14 (drawer novo) |
| 3 | **Sidebar COLAPSADA** (só ícones ~70px) + **tooltip hover** em cada item | Clicar em `.ant-layout-sider-trigger`; screenshot; depois `page.hover` em cada `.ant-menu-item` colapsado → tooltip aparece. | TODAS (só 6/14 têm collapsed hoje) |
| 4 | **Menu "Novo +" do sidebar aberto** (dropdown com Agendamento/Comanda/Cliente/…) | Do painel `/wow`, `page.click('button:has-text("Novo")')` no sidebar (NÃO no header da rota) → dumpa overlay + PNG + lista todos os itens. ✱ | qualquer rota (é global) |
| 5 | **Perfil do usuário — dropdown** (Meu perfil / Sair / Trocar empresa) | `page.click('.ant-layout-sider header, [class*="profile-trigger"]')` — o header do sidebar com "Olá, FÁTIMA" tem seta. Capturar overlay. ✱ | global |
| 6 | **Filtro APLICADO** (drawer/painel de filtros aberto + valores selecionados + botão Aplicar) | `page.click('button:has-text("Filtrar")')` no header; dentro escolher 2-3 valores em selects/datepickers; clicar Aplicar; capturar drawer + página com chips/tags de filtro ativo. ✱ | TODAS 14 |
| 7 | **Busca digitada com resultados** (input focado + resultados filtrados) | `page.click('button:has-text("Buscar")')` → aparece input inline OU drawer; `page.fill(input, "a")`; esperar tabela filtrar; screenshot. Repetir com valor real (ex: nome de cliente). | TODAS 14 |
| 8 | **Estado vazio da tabela** ("Não há dados" + ícone cinza central) | Buscar por string aleatória sem match ("zzzzz") OU aplicar filtro impossível. Screenshot da região da tabela vazia. | TODAS 14 |
| 9 | **Modal "não possui funcionalidade contratada"** (paywall — ícone exclamação + Fechar/Contratar) | Ir em `/reviews` ou `/cashback` (contas sem esses adicionais); a página abre com esse modal automaticamente. Se não abrir, clicar em qualquer CTA principal. ✱ | `/reviews`, `/cashback`, `/invoices`, `/whatsapp` |
| 10 | **Toast de sucesso** (canto direito, fade-in) | Dentro do drawer `Novo`, preencher campos mínimos válidos, clicar Salvar; capturar `.ant-notification-notice` em 3 frames. ✱ | TODAS 14 |
| 11 | **Modal de validação em form** (campos obrigatórios em vermelho + `Preencha os campos obrigatórios`) | Abrir drawer `Novo`, deixar tudo vazio, clicar Salvar; capturar drawer com labels vermelhos + toast erro. | TODAS 14 |
| 12 | **Skeleton loading** (esqueletos cinzas antes dos dados) | Navegar via `page.goto` **sem** aguardar `.ant-skeleton-active` sumir; screenshot em t=0ms e t=200ms. | TODAS 14 |
| 13 | **Comanda — pagamento completo** (painel formas + valor + Pagar + confirmação) | `/sales` → clicar 1ª linha → drawer detalhe → clicar botão verde `Ver pagamentos` → capturar painel formas Pix/Cartão/Dinheiro → escolher Dinheiro → digitar valor → clicar `Pagar` → capturar modal confirmação + estado pago (linha verde). ✱ (3 telas) | `/sales` |
| 14 | **Fechar caixa — fluxo completo** (conferência → confirmar → resumo imprimível) | `/finance-cash` → clicar `Fechar caixa` no card → conferência (tabela pagamentos) → confirmar → capturar tela de resumo/imprimível. | `/finance-cash` |
| 15 | **Abrir caixa — modal saldo inicial** | `/finance-cash` sem caixa aberto → botão "Abrir caixa" → modal com input saldo inicial → capturar. ✱ | `/finance-cash` |
| 16 | **Agenda — mudar view** (Dia / Semana / Mês) — 3 estados | `/calendar` → clicar botão "Dia" → screenshot; "Semana" → screenshot; "Mês" (default) → screenshot. Cada um tem grid diferente. | `/calendar` |
| 17 | **Agenda — navegar mês** (‹ › Hoje) | `/calendar` → capturar mês default → clicar ‹ → screenshot (mês anterior); clicar › → clicar Hoje → screenshot. | `/calendar` |
| 18 | **Agenda — clicar em célula VAZIA** (abre drawer "Novo" com data pré-preenchida) | `/calendar` → `page.click('.rbc-day-slot, .fc-timegrid-slot')` numa célula futura vazia → capturar drawer com data prefilled. ✱ | `/calendar` |
| 19 | **Agenda — clicar em BLOCO existente** (drawer visualizar) | `/calendar` → `page.click('.rbc-event, .fc-event, [class*="calendar-event"]')` → drawer "Visualizando agendamento" → capturar. ✱ | `/calendar` (já parcial em `detail-open`) |
| 20 | **Cliente — todas as abas do drawer perfil** (13 abas: Cadastro/Fotos/Dados/Créditos/Contatos/Agendamentos/Vendas/Pacotes/Mensagens/Anotações/Imagens/Assinaturas/Vendas por Assinatura) | `/clients` → clicar 1ª linha → drawer → iterar cada `.ant-tabs-tab` → screenshot + dump HTML de cada painel. | `/clients` (só `employees` tem tabs hoje) |
| 21 | **Serviço — todas as abas do drawer edit** (9 abas: Cadastro/Configurações/Cashback/Cuidados/Retorno/Comissões/Personalizar/Produtos consumidos/NF) | `/services` → clicar 1ª linha → iterar abas. | `/services` |
| 22 | **Comanda — drawer edit todas as abas + adicionar item** | `/sales` → clicar 1ª linha → drawer detalhe → clicar `+Adicionar` em Itens → picker de serviço aberto → screenshot. ✱ | `/sales` |
| 23 | **Configurações — trocar Cor do menu (Personalizar)** — before/after live | `/settings` → aba Personalizar → clicar color picker → escolher cor diferente → capturar sidebar mudando de cor em 3 frames. ✱ | `/settings-personalize` |
| 24 | **Pagar comissões — drawer completo** (Comissões/Vales/Bonificações/Líquido + formas + Confirmar) | `/commissions-summary` → selecionar profissional + período → clicar `Buscar comissões` → clicar `Pagar comissões` (menu: Pagar / Pagar com Belasis Pay) → drawer → escolher forma → capturar. ✱ | `/commissions-summary`, `/commissions-bulk` |
| 25 | **Banner topo laranja — X (fechar) e clique em "Ver minha assinatura"** | Recarregar página fresh (não killOverlays) → capturar banner → clicar X → capturar sem banner. Depois recarregar → clicar `Ver minha assinatura` → capturar destino. | global (todas rotas) |

## P1 — importante para paridade funcional

| # | Interação | Como reproduzir | Rotas alvo |
|---|---|---|---|
| 26 | **Menu de export "Imprimir / Excel"** (dropdown do botão Exportar) | Header da tabela → `page.click('button:has-text("Exportar")')` OU botão `⋯` → capturar dropdown com opções PDF/Excel/Imprimir. ✱ | TODAS 14 + `/commissions*` + `/reports*` |
| 27 | **Print preview** (layout imprimível) | Clicar `Imprimir` no menu de export → capturar nova aba/iframe com layout preto/branco A4. | `/sales` (comanda), `/finance-cash` (conferência), `/commissions-summary` |
| 28 | **Paginação — click em página + trocar "20/página" + "Vá até Página N"** | Rolar até rodapé da tabela → clicar página 2 (screenshot); abrir select `20/página` → escolher 50 (screenshot dropdown); digitar em `Vá até` input + Enter (screenshot). | TODAS 14 |
| 29 | **Ordenação de coluna** (click header — seta aparece) | `page.click('.ant-table-column-title:nth(1)')` → screenshot header com seta asc; click de novo → seta desc. | TODAS 14 |
| 30 | **Cancelar drawer com form dirty** (modal "descartar alterações?") | Abrir drawer `Novo`, preencher campo, clicar Cancelar/X → deve aparecer confirmação. Capturar modal. ✱ | TODAS 14 |
| 31 | **Autocomplete cliente — digitando com resultados** | Drawer Nova Comanda → focar campo `Cliente` → digitar "an" → capturar dropdown com resultados destacados. Repetir com valor sem match (empty state do dropdown). ✱ | `/sales`, `/calendar`, `/packages`, `/subscriptions` |
| 32 | **Date-range picker aberto com range selecionado** | Header `Filtrar` → date range → clicar dia início → hover em dia fim (deve destacar range em azul-claro) → clicar fim → capturar. ✱ | `/finance-transactions`, `/commissions*`, `/reports*` |
| 33 | **Time picker aberto** (colunas HH:MM) | Drawer Novo Agendamento → clicar campo Horário → capturar colunas. ✱ | `/calendar` |
| 34 | **Upload de foto — modal + preview + progress** | Drawer Novo Cliente → aba Fotos OU avatar central → clicar upload → capturar modal file picker (fake file) → progress bar → preview antes de salvar. ✱ | `/clients`, `/employees`, `/products` |
| 35 | **Cascader multi-nível de categoria (pai → filho)** | Drawer Novo Produto/Serviço → picker Categoria → capturar coluna nível 1; hover em item pai → coluna nível 2 abre à direita. ✱ | `/services`, `/products`, `/finance-transactions` |
| 36 | **Toggle/switch — before/after** (ex.: Ativa, Bloquear online, Pago) | Qualquer drawer com switch → capturar antes; click switch; capturar depois + animação knob deslizando. ✱ | `/finance-accounts`, `/clients` (Bloquear online), `/finance-transactions` (Pago) |
| 37 | **Bulk select (checkbox header) + menu ações em lote** | `/finance-transactions` → clicar checkbox no header → todas linhas selecionadas → menu de ações em lote aparece → capturar. | `/finance-transactions`, `/sales`, `/clients` |
| 38 | **Configurações — abas TODAS** (Detalhes/Notificações/Personalizar/Admin/API) | `/settings` → iterar cada `.ant-tabs-tab` → dumpar HTML/PNG. | `/settings-personalize`, `/settings-notifications`, `/settings-admin`, `/settings-api` |
| 39 | **Sidebar hover em grupo colapsado** (submenu fly-out) | Sidebar colapsada → `page.hover` em item que tem sub-itens (ex.: Financeiro) → capturar submenu voando à direita. ✱ | global |
| 40 | **Central de Notificações** (sino no topo) | Clicar sino header → dropdown/painel de notificações → screenshot + iterar tabs (Todas/Não lidas). ✱ | `/notifications` global |
| 41 | **Botão FAB de chat/IA** (canto inferior-direito) | Clicar `[class*="chat-fab"]` ou botão circular bottom-right → capturar painel de chat aberto. ✱ | global (algumas rotas) |
| 42 | **Painel financeiro — gráficos hover tooltip** | `/finance-dashboard` → hover em barra do recharts → tooltip preto aparece → capturar. | `/finance-dashboard`, `/wow` |
| 43 | **Aba de Relatório — Gerar relatório com resultado** | `/reports-*` → escolher relatório na lista lateral → preencher filtros → clicar `Gerar relatório` → capturar tabela/gráfico resultado + spinner loading antes. | 30+ slugs `reports-*` |
| 44 | **Favoritar relatório — estrela clicada** | `/reports` → hover em card → clicar estrela → animação + estado ativado. | `/reports`, `/reports-favorites` |
| 45 | **Agendamento Online — preview mobile ao vivo** | `/online-booking` → mudar cor primária → capturar mockup celular preto atualizando cor em tempo real. | `/online-booking` |
| 46 | **Campanha — card configurar (drawer específico por template)** | `/campaigns-marketing` → clicar `Configurar` em card "Lembrete agendamento" → drawer com steps → screenshot. Repetir p/ Aniversário, Recompra. | `/campaigns-marketing` |
| 47 | **Recarregar créditos (WhatsApp)** — modal | `/campaigns-marketing` aba Créditos → clicar `Recarregar` → modal com opções de pacote. ✱ | `/campaigns-marketing` |
| 48 | **Convidar profissional — modal/drawer** | `/employees` → clicar `Convidar` (não Novo) → modal com input e-mail + enviar → estado "pendente" na tabela. ✱ | `/employees` |
| 49 | **Trocar de empresa (multi-tenant)** — se a conta tiver múltiplas | Header perfil → dropdown → clicar `Trocar empresa` → modal listando empresas. ✱ | global |
| 50 | **Sidebar item ATIVO** — hover state (rota atual, com destaque #6872FF) | Já vem capturado na `page.png` mas isolar CSS: `page.hover` em item **não** ativo — deve mudar levemente. Extrair `getComputedStyle` de ativo vs hover vs default. | global |

## P2 — nice-to-have (cobre pixel-detail e edge)

| # | Interação | Como reproduzir | Rotas alvo |
|---|---|---|---|
| 51 | **Drag-drop de agendamento** (mover horário na Agenda) | `/calendar` view Semana → `page.dragAndDrop(fromSlot, toSlot)` em um evento → capturar ghost/highlight durante drag + estado final. ✱ | `/calendar` |
| 52 | **Resize de agendamento** (mudar duração) | Hover em bloco → aparece handle no bottom → drag pra baixo → capturar. ✱ | `/calendar` |
| 53 | **Agenda — filtro por profissional** (mostrar só X profissionais) | Header `/calendar` → filtro profissionais → desmarcar 2 → capturar calendário com menos colunas. | `/calendar` |
| 54 | **Estados vazios de cada tab do perfil cliente** | `/clients` → clicar cliente sem histórico → iterar abas Agendamentos/Vendas/Pacotes/Mensagens/Anotações/Imagens → capturar cada estado vazio ("Sem agendamentos"). | `/clients` |
| 55 | **Assinatura digital — canvas de assinatura** | `/employees` → aba Assinatura Digital → capturar canvas vazio + após rabisco (fake mousedown/move/up). ✱ | `/employees` |
| 56 | **Configurar comissões — adicionar linha por serviço** | `/employees` → aba Configurar Comissões → clicar `+ Novo` → linha nova aparece → escolher serviço + % → capturar cada etapa. | `/employees` |
| 57 | **Cadastro — Endereço com CEP autocompletado** | Drawer Novo Cliente → aba Endereço → digitar CEP → outros campos preenchem sozinhos (API viaCEP). Capturar antes/durante/depois. | `/clients`, `/employees`, `/vendors` |
| 58 | **Categorias — modal de tela padrão** (select associação) | `/finance-accounts` aba Categorias → drawer Nova → picker "Tela padrão" → capturar. | `/finance-accounts` |
| 59 | **Modal de erro 5xx da API** (se conseguir forçar) | Interceptar request via `page.route(url, r => r.fulfill({ status: 500 }))` → forçar ação → capturar toast/modal de erro. | qualquer |
| 60 | **Sem conexão (offline banner)** | `page.context().setOffline(true)` → tentar Salvar → capturar banner/toast. | qualquer |
| 61 | **Modal de exclusão em lote** | Selecionar múltiplas linhas → clicar Excluir → modal `Excluir 3 itens?`. ✱ | `/finance-transactions`, `/sales` |
| 62 | **Sidebar submenu expandindo** (grupo Financeiro clicado abre/fecha) | Sidebar expandida → clicar seta do grupo `Financeiro` → capturar animação collapse 3 frames. ✱ | global |
| 63 | **Anamneses — editor de formulário custom** | `/anamnesis-templates` → clicar Novo/Editar → editor drag-and-drop de campos → capturar toolbox lateral + área central. | `/anamnesis`, `/anamnesis-templates` |
| 64 | **Gerador de Documentos — editor rich-text** | `/document-templates` → Novo → editor tipo Word com barra de ferramentas → capturar. | `/document-templates` |
| 65 | **Avaliações — modal responder review** | `/reviews` (se contratado) → clicar review → modal com estrelas + resposta → capturar. ✱ | `/reviews` |
| 66 | **Metas — criar meta + progresso bar** | `/goals` → Novo → drawer + preencher → tela lista mostra barra de progresso animada. | `/goals` |
| 67 | **Idioma — dropdown com bandeiras** (Personalizar → Idioma) | `/settings-personalize` → picker Idioma → capturar dropdown com Português/Inglês/Espanhol + bandeiras. ✱ | `/settings-personalize` |
| 68 | **Trocar senha — modal** | Header perfil → Meu perfil → Trocar senha → modal com senha atual/nova/confirmar → validação vermelha se fraca. | `/perfil` |
| 69 | **Logout — confirmação** | Header perfil → Sair → modal `Deseja realmente sair?` → confirmar. ✱ | global |
| 70 | **Contas de banco — cadastro completo (aba do profissional)** | `/employees` → aba Contas de banco → Novo → drawer banco/agência/conta/PIX → capturar. | `/employees` |
| 71 | **Grupos de cliente** (não existe no SalonPass ainda) | `/groups` → capturar página inteira + fluxo Novo grupo + adicionar clientes ao grupo. | `/groups` |
| 72 | **Pacotes pré-definidos — modal tutorial** | `/package-templates` primeira visita → modal tutorial (se aparecer) → capturar cada slide. ✱ | `/package-templates` |
| 73 | **Compras — fluxo completo com produtos** | `/purchases` → Nova → escolher fornecedor → adicionar produtos linha a linha → forma pagamento → salvar → capturar cada etapa. | `/purchases` |
| 74 | **Belasis Pay — onboarding + transações + transferências** | `/belasis-pay*` → capturar 3 rotas + fluxos de ativação (se aparecer wizard). | `/belasis-pay`, `/belasis-pay-transactions`, `/belasis-pay-transfers` |

## P3 — edge / raros

| # | Interação | Como reproduzir | Rotas alvo |
|---|---|---|---|
| 75 | **Tooltip em ícones ambíguos** (info, ⚠️) | `page.hover` em cada `.anticon-info-circle, .anticon-question-circle, .anticon-exclamation` → capturar tooltip escuro. ✱ | TODAS |
| 76 | **Popover de aviso** (ex.: "assinatura expira em 3 dias" no header) | Se aparecer badge no perfil ou banner → hover/click → capturar popover. ✱ | global |
| 77 | **Modal de tutorial inicial** (primeira vez em módulo) | Login fresh + navegar em módulo virgem (fake account?) → capturar wizard step-by-step. ✱ | `/reports`, `/campaigns-marketing`, `/online-booking` |
| 78 | **Modal "quer voltar ao antigo?"** — feedback | Se Belasis oferecer opt-out do novo layout → capturar modal. | global |
| 79 | **Contexto de teclado** — atalhos (`?` mostra atalhos, `Ctrl+K` abre command palette se existir) | `page.keyboard.press('?')`, `page.keyboard.press('Control+K')` → capturar overlay. ✱ | global |
| 80 | **Scroll infinito / carregar mais** (se alguma tabela usar) | Rolar `.ant-table-body` até bottom → capturar spinner de "carregando mais". | listas grandes (`/clients`, `/sales`) |

---

## Sugestão de execução

1. **Sprint 1 (P0 1-25)** — bloqueadores diretos: hover/focus, sidebar collapsed universal, empty/loading/paywall/toast, todas as abas de drawer de cliente/serviço/comanda, banner. Gera ~40 novos artefatos por rota.
2. **Sprint 2 (P1 26-50)** — funcional: export, print, paginação, sort, bulk, upload, cascader, filtros aplicados, fluxos de comissão e caixa.
3. **Sprint 3 (P2 51-74)** — módulos ainda **NÃO** capturados (26 rotas em GAPS.md status FALTA TOTAL — reports/settings/anamnesis/document-templates/goals/campaigns/reviews/cashback/promotions/belasis-pay/notifications/subscription-*). Rodar `capture-pixel-perfect.js` estendido pra essas 26 rotas com o mesmo pipeline base já validado.
4. **Sprint 4 (P3 75-80)** — polimento fino.

## Sugestões de arquitetura para o novo script

Ao estender `capture-pixel-perfect.js` (ou criar `capture-interactions.js`) considerar:

- **Isolar interações que MUTAM estado** (Salvar, Excluir, Pagar) numa suíte separada com `--dry-run` ou conta de teste — não misturar com captura de estados read-only na conta de produção.
- Adicionar helpers: `hoverAndCapture(sel, name)`, `focusInputAndCapture(sel, name)`, `typeAndCapture(sel, value, name)`, `openFilterAndApply(values, name)`, `openTabsInPanel(name)` — funciona genérico p/ N drawers.
- Reusar o padrão `animate3` (frames 0/60/240ms) para: sidebar collapse, tabs switch, toast, modal in/out, dropdown, tooltip, drag-drop ghost, switch knob.
- Salvar estrutura paralela: `pixel/desktop/<slug>/interactions/<nome-interação>/{html,png,anim,css.json}` para não colidir com o layout atual `page/new-open/row-menu`.
- **Priorizar viewport desktop** primeiro para P0-P1, deixar mobile pra iteração seguinte (dobra o custo de captura).

## Cobertura estimada após executar todas as 80

- Módulos com pixel-perfect: **14 → 40** (26 novos)
- Interações capturadas por módulo: **~7 → ~35** (drawer novo, editar, filter aberto, filter aplicado, busca, hover, focus, empty, loading, toast, paywall se aplicável, sort, paginação, export dropdown, print, delete confirm, sidebar collapsed + hover, chrome global)
- Estimativa de artefatos totais: **~200 → ~1500 arquivos** de referência pixel-perfect
