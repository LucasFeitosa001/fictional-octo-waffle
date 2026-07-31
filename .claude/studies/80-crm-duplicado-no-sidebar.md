# Estudo 80 — O CRM duplicado no sidebar

Pedido do dono, repetido: *"tem um CRM ali embaixo no sidebar, já vai ter ele ali na lista não
precisa duplicar"*. Continua na tela — conferido na captura de agora, rodapé do sidebar, abaixo do
zoom.

## 80.1 — São TRÊS atalhos, não um

Todos chamam o mesmo aviso `CrmLockedModal` ("Módulo não adquirido",
`apps/web/src/components/CrmLockedModal.tsx:27`):

1. **Rodapé do sidebar** — `apps/web/src/layout/Sidebar.tsx:1165`-`:1198`, `onOpenCrm`. É o que o
   dono aponta.
2. **Ícone no topo do sidebar** — `Sidebar.tsx:856`-`:866`, mesmo `onOpenCrm`.
3. **Botão flutuante global** — `apps/web/src/layout/DashboardLayout.tsx:117`-`:133`, `setCrmOpen`.

Os três nasceram antes do CRM existir de verdade: eram o lugar de dizer "esse módulo você não tem".

## 80.2 — Por que hoje são redundantes, inclusive para quem NÃO tem o módulo

Cheguei a considerar preservá-los como upsell de quem está em plano sem `whatsapp_api`. Não se
sustenta: item travado **não some do menu**. `Sidebar.tsx:72`-`:74` diz e o código faz —
`isLocked(item.feature)` (`:445`) só acrescenta `LockBadge` (`:691`, `:739`, `:800`), e a própria
página mostra o upsell.

Logo o grupo `title: 'CRM'` (`Sidebar.tsx:136`), com Atendimento / Contatos / Kanban / Inteligência
artificial, aparece para **todo** plano — com cadeado quando não incluso. O aviso separado não cobre
nenhum caso que a lista já não cubra. É duplicata em qualquer plano.

## 80.3 — O ajuste que passa a não ajustar nada

`ConfiguracoesPage.tsx:1618`-`:1622` tem o interruptor "Mostrar atalho do CRM"
(`useCrmShortcutEnabled`), que só governa o botão flutuante (`DashboardLayout.tsx:117`,
`crmShortcutEnabled`). Sem o botão, o interruptor vira decoração — o padrão que já custou caro neste
projeto. Sai junto.

`apps/web/src/theme/crmShortcut.ts` e a sincronia em `useThemeSync.ts:155` **ficam**: são só
persistência da preferência, sem consumidor visível, e mexer nelas mudaria o formato do payload de
aparência que a API troca. Fica anotado como resto a limpar, não como parte desta correção.

## 80.4 — Correção

1. `Sidebar.tsx`: remover o bloco do rodapé e o ícone do topo; a prop `onOpenCrm` deixa de existir.
2. `DashboardLayout.tsx`: remover o botão flutuante, o `CrmLockedModal` e o estado `crmOpen`.
3. `ConfiguracoesPage.tsx`: remover a linha do interruptor.

O que **não** muda: o grupo CRM do menu, seu gate por `whatsapp_api` e os cadeados. Quem não tem o
módulo continua vendo os quatro itens com cadeado e o upsell da página — que era, afinal, a única
função do aviso.
