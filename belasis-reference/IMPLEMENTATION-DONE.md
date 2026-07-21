# Implementation Done — Belasis Parity (lote 10 páginas)

Data: 2026-07-20
Branch: `feat/belasis-etapa2`

## Resumo executivo

- **10 páginas** trabalhadas a partir do `FULL-PARITY-REPORT.md`.
- **9 páginas** com gaps aplicados; **1 página** (ServicosPage) sem mudança por dependência externa.
- **TypeCheck**: verde (`pnpm exec tsc --noEmit` sem erros).
- **Build**: OK (7.52s, PWA 58 precache entries).
- **Preview**: Vite em `:5173`, tunnel `https://conferences-collar-proof-mine.trycloudflare.com/`.
- **Verify Playwright**: 12/12 rotas passaram.

---

## Implementação por página

### 1. AgendaPage.tsx — 4 gaps aplicados
Arquivos:
- `apps/web/src/pages/AgendaPage.tsx`
- `apps/web/src/layout/DashboardLayout.tsx`

- **[P0] Seletor Visualização inline no header mobile**: chip pill "rounded-full border" com label derivado de `effectiveView` (Diário/Semanal/Mensal/Anual) + IconChevron; abre `mobileViewOpen` (bottom-sheet reusa `renderViewPanel`).
- **[P1] Botão Filtrar inline no header mobile/tablet**: IconFilter à direita do header `lg:hidden`, badge dourado com `activeFilterCount`; abre `mobileFilterOpen` (bottom-sheet com `renderFilterPanel`). Desktop `lg:flex` inalterado.
- **[P2] FAB de chat escondido em /agenda**: reuso do `fullBleed = pathname === '/agenda'` no `DashboardLayout`, envolvendo o botão do chat em `{!fullBleed && (...)}`.
- **[P2] Cor de evento fallback tokenizada**: `eventColor()` retorna `var(--sp-event-bg, #6b7280)` no default; cores de status conhecidos permanecem FIXAS (respeita `31654eb`).

Header mobile reestruturado para `[<] [Data + ViewChip] [>] [Play] [Filter]` (h-12), grupo central `flex-1 justify-center gap-1`; Prev/Next/Play encolhidos para h-10 w-10 para caber em 375px.

### 2. ClientesPage.tsx — 3 gaps
Arquivos:
- `apps/web/src/pages/ClientesPage.tsx`
- `apps/web/src/lib/format.ts`

- **Formatação de telefone**: nova helper `formatPhone(raw)` em `lib/format.ts` (trata 13/12/11/10 dígitos). Aplicada no card mobile e coluna desktop.
- **Avatar fallback com iniciais**: `Avatar.Fallback` passa a renderizar `initials(c.name)` em vez do ícone genérico.
- **Padding FAB**: container raiz recebe `pb-24 md:pb-0` para o FAB de chat não sobrepor o último item mobile.

### 3. PacotesPage.tsx — 4 gaps
Arquivo: `apps/web/src/pages/PacotesPage.tsx`

- Card mobile: prefixo "Data:" na data de criação.
- Card mobile: linha extra "Expira em: dd/mm/yyyy" ou "Não expira".
- Card mobile: segundo pill AvailBadge (Ativo/Vencido) ao lado do StatusBadge.
- Chip "Ordenando por Ticket/Data/Validade" acima da lista (SortChip com dropdown fade+scale), ligado ao state `sort` existente.

### 4. ProdutosPage.tsx — 5 gaps
Arquivo: `apps/web/src/pages/ProdutosPage.tsx`

- **Ordenação visível**: `SortBy` + state `sortBy`, sort client-side no `useMemo` de `rows`, subcomponente `SortSelect` (native `<select>` transparente) acima da tabela desktop e no header mobile.
- **Thumbnail do produto**: `Avatar` já usava `product.imageUrl` com fallback de iniciais/IconBox (mantido).
- **Banner "Ver minha assinatura"**: state `showSubscriptionBanner` + banner `bg-primary/6` com IconSparkles, botão de ação e "×" para fechar, entre header e sub-abas.
- **Estoque 0/negativo em vermelho**: `outOfStock` (qty ≤ 0) separado de `low`; célula desktop e subtitle mobile aplicam `text-danger`.
- **Contador mobile**: "N produto(s)" `text-[11px] font-normal text-muted-ink/80`, dentro de flex `justify-between` com o SortSelect.

### 5. ConfiguracoesPage.tsx — 6 gaps (todos aplicados)
Arquivo: `apps/web/src/pages/ConfiguracoesPage.tsx`

- Banner topo "Ver minha assinatura" → `/perfil/assinatura` (renderiza só quando `active===null`), pill com IconSparkles + chevron.
- Ícone play/tutorial ao lado dos H1 (mobile e desktop), botão 7x7 com IconPlay 14px.
- `EXTRA_ITEMS` (Minha conta / Admin / API / Sair) ao fim da lista mobile.
- Minha conta → `/perfil`; Admin → `/admin` (placeholder); API → `/api` (placeholder).
- Sair: botão vermelho, sem chevron, chama `handleSignOut()` (useConfirm `danger:true` → `signOut()` + navigate `/login` replace).

### 6. ComandasPage.tsx — 4 gaps
Arquivo: `apps/web/src/pages/ComandasPage.tsx`

- `pb-24` na `<ul>` mobile de comandas (FAB chat).
- HelpTooltip no `titleAdornment` do PageHeader.
- Cliente em destaque: `o.customer.name` em `font-semibold text-foreground`; "Avulso" apenas como fallback `italic text-muted`.
- PaymentTag `open` (Pendente): amarelo preenchido `#faad14` + texto branco (ant-tag solid warning), em vez do outline claro.

### 7. TransacoesPage.tsx — gaps aplicados
Arquivo: `apps/web/src/pages/financeiro/TransacoesPage.tsx`

- `selectMode`/`selected` (Set) + ação "Selecionar" (IconCheck) registrada na BottomNav com `active: selectMode`. Cards mobile mostram checkbox e ring; toque alterna seleção.
- Removido switch Pago/Pendente inline dos cards mobile (e `handleTogglePaid` + hook `updateStatus` dead); toggle vive só no drawer de edição.
- Helper local `formatDateBR` → "20 jul, 2026" nos cards mobile; desktop mantém `formatDate()`.
- Cards mais densos (py-2, px-2.5, gap-1.5; fontes 11.5/13/11). Valor com cor `success`/`danger`.
- FAB chat removido da página (comentado para retomada com integração real).

### 8. MarcasPage.tsx — 2 gaps
Arquivo: `apps/web/src/pages/MarcasPage.tsx`

- Botão play do tour ao lado do H1 recolorido para âmbar (`bg-amber-500` + ring amber/20).
- Contador do rodapé: "N registro(s) no total" / "N de M registro(s)" (Belasis usa "registros").
- FAB chat global mantido (sem sobreposição confirmada visualmente).

### 9. ServicosPage.tsx — sem mudança (blocked)
Gap CTA "Ver minha assinatura" no header classificado como opcional ("só se aplicável ao tenant"). Não há infra de flag/rota `tenant.hasSubscription` no projeto para condicionar exibição. Reabrir quando a rota/flag existir.

### 10. (slot vazio no lote — 10ª página não implementada)
Item enviado como `null` na lista de tasks; nenhuma ação executada.

---

## TypeCheck

- `pnpm exec tsc --noEmit` verde.
- Fix colateral: removidas 2 referências a `MobileFooterCount` (inexistente) em `apps/web/src/pages/financeiro/ContasPage.tsx` (linhas 922 e 969). O total de registros já aparece no header (~linha 855).

## Rebuild

- Build web: OK, 7.52s, PWA 58 precache entries.
- Vite preview: `:5173` (background task `bm1c3l2bv`).
- Tunnel: `https://conferences-collar-proof-mine.trycloudflare.com/`.

## Verify Playwright — 12/12 rotas OK

| Rota | Observação |
|---|---|
| /agenda | seletor Visualização presente (Diário/Semanal/Mensal) |
| /comandas | h1='Comandas' carregado |
| /clientes | telefones com parênteses: 11 ocorrências |
| /pacotes | linha 'Expira em' presente no card |
| /financeiro/transacoes | chip 'Selecionar' visível; formato 'jul,' confirmado |
| /financeiro/contas | aba 'Formas de pagamento' sem abreviação |
| /financeiro/cadastros/formas-pagamento | subtítulo contém 'Taxa' |
| /financeiro/notas-fiscais | h1='Nota fiscal de serviço' |
| /servicos | h1='Serviços' |
| /produtos | dropdown de ordenação presente; 4 imgs (thumbnails) |
| /marcas | botão play âmbar detectado no header |
| /configuracoes | itens Admin, API, Minha Conta, Sair presentes |

Passed: **12** · Failed: **0**

---

## Próximos passos

### Gaps partial / blocked
- **ServicosPage**: CTA "Ver minha assinatura" — bloqueado por ausência de `tenant.hasSubscription` + rota `/minha-assinatura`. Reabrir quando definidos.
- **Slot 10 do lote**: task ausente (null) — reconfirmar escopo com o orquestrador e agendar 11ª página se aplicável.

### Rotas com falha no verify
- Nenhuma. Todas as 12 rotas passaram no Playwright.

### Follow-ups recomendados
- Auditar demais páginas do financeiro (`ContasPage`) para consolidar padrão `MobileFooterCount` real (ou remover referência morta em outros pontos, se houver).
- Confirmar visualmente em device real (375px) o novo header da AgendaPage sob temas `salonpass` e `belasis`.
- Avaliar migração das cores fixas de status do calendário para tokens `--sp-event-status-*` numa etapa futura (fora do escopo desta rodada — decisão prévia `31654eb`).
