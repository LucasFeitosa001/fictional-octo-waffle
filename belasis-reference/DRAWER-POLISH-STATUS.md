## Drawer fix
{
  "task": "drawer polish",
  "status": "done",
  "summary": "Ambos drawers mobile agora seguem o padrão Belasis bottom-sheet: (1) max-h reduzido de 92dvh → 90dvh; (2) grip pill dark cinza (h-1.5 w-10 rounded-full bg-black/20, pt-2 pb-1, centralizado, shrink-0) renderizado apenas no branch mobile, antes do header; (3) o painel mobile mantém height auto capado em max-h-[90dvh] — h-dvh continua exclusivo do branch desktop (right-slide). Drawer.tsx guarda o grip com `isMobile && effectivePlacement === 'bottom'` para não aparecer quando `placement='bottom'` for forçado em desktop. FullDrawer.tsx usa apenas `isMobile`. tsc rodou limpo (sem output = zero erros).",
  "files": [
    "/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/Drawer.tsx",
    "/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/FullDrawer.tsx"
  ]
}

## Novo Agendamento cliente selector
{
  "task": "Fix Novo Agendamento mobile \"Selecionar cliente\" button not opening drawer",
  "status": "done",
  "summary": "Bug identified: em `apps/web/src/components/NewAppointmentModal.tsx`, o campo Cliente (branch \"buscar existente\") usava `<TextField>` + `<Select>` (HeroUI/React Aria) cujo `Select.Popover` trava dentro de outro bottom-sheet em mobile — o botão \"Selecionar cliente\" abre nada. Além disso, o Select só aparecia depois que o usuário digitava algo na busca, o que degradava a UX.\n\nFix aplicado (arquivo: /home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx):\n\n1) Substituí o combo TextField+Select por um botão único \"Selecionar cliente\" (mostra nome + telefone do cliente selecionado, ou o placeholder + chevron). O botão dispara `setPickerOpen(true)`.\n\n2) Adicionei um sub-drawer `CustomerPickerDrawer` no final do arquivo — bottom-sheet forçado via `placement=\"bottom\"` (herda z-index 70 do `<Drawer>`, portalado por cima do modal pai, funciona em mobile e desktop). Header \"Selecionar cliente\", input de busca \"Digite para buscar\" com ícone (autoFocus), lista com nome + telefone. Estados: loading (Spinner), vazio (dica), item selecionado destacado. Clicar seta `customerId` + `selectedCustomer` e fecha.\n\n3) Reutiliza o hook `useCustomers(customerSearch)` já presente — nenhuma nova query. Novo estado `selectedCustomer` mantém o rótulo visível mesmo se a busca for limpa (antes `selectedCustomerName` só resolvia se o cliente estivesse no payload atual). Reset completo no `useEffect(isOpen)` e no toggle \"+ Novo cliente\".\n\n4) Import adicional: `IconChevron`, `IconSearch`, `type Customer` de `@beautypass/shared`.\n\nVerificação: `npx tsc --noEmit` no `apps/web` → EXIT=0.\n\nArquivo alterado: /home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx",
  "files": [
    "/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/NewAppointmentModal.tsx"
  ]
}

## Verificação
{
  "drawers": [
    {
      "scenario": "/comandas → 1º card mobile → drawer ver comanda",
      "ok": true,
      "note": "panels=1 winner h=516 w=390 top=148 grip=true y0=true heightOk=true gripOk=true",
      "height": 516
    },
    {
      "scenario": "/comandas → BottomNav Novo → drawer nova comanda",
      "ok": true,
      "note": "panels=1 winner h=598 w=390 top=66 grip=true y0=true heightOk=true gripOk=true",
      "height": 598
    },
    {
      "scenario": "/clientes → 1º card mobile → drawer cliente",
      "ok": true,
      "note": "panels=1 winner h=598 w=390 top=66 grip=true y0=true heightOk=true gripOk=true",
      "height": 598
    },
    {
      "scenario": "/pacotes → 1º card mobile → drawer PacotePerfilModal (FullDrawer)",
      "ok": true,
      "note": "panels=1 winner h=598 w=390 top=66 grip=true y0=true heightOk=true gripOk=true",
      "height": 598
    },
    {
      "scenario": "/financeiro/transacoes → BottomNav Filtros → drawer filtros",
      "ok": true,
      "note": "panels=1 winner h=598 w=390 top=66 grip=true y0=true heightOk=true gripOk=true",
      "height": 598
    },
    {
      "scenario": "/financeiro/cadastros/categorias → BottomNav Nova → drawer categoria",
      "ok": true,
      "note": "panels=1 winner h=357 w=390 top=307 grip=true y0=true heightOk=true gripOk=true",
      "height": 357
    }
  ],
  "clienteSelect": {
    "ok": true,
    "note": "clicked=true searchInput=1 listCount=20 drawerTranslateY0=true — clique no seletor abriu drawer com input Digite para buscar e lista de clientes"
  },
  "passed": 7,
  "failed": 0
}

## Próximos passos
Nenhum item partial/blocked/failed. Todos os 7 cenários passaram.
