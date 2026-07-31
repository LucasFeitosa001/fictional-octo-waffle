# Estudo 70 — Voltr: menu sem o Chat, e a tela não ocupa a largura

Relato do dono: *"Não tá carregando o menu da voltr por completo, com chat, e você tem que tirar por
completo o padding e margin da children nessa página, pra poder ocupar por completo na width."*

## 70.1 — Por que o Chat não aparece

São dois fatos somados, e nenhum é bug de carregamento:

1. **Nosso menu só tem UMA entrada.** `apps/web/src/layout/Sidebar.tsx:130`-`:139` declara um único
   `kind: 'link'` com `key: 'voltr'`, `to: '/voltr-crm'`, `label: 'Voltr CRM'`. A rota do chat existe
   — `apps/web/src/App.tsx:480` mapeia `/voltr-chat` para `<VoltrCrmPage scope="chat" />` — mas
   **ninguém chega nela**, porque não há item de menu apontando para lá.

2. **O embed não tem navegação por dentro, de propósito.** Na Voltr,
   `apps/web/app/embed/layout.tsx:5` diz "BARE: sem top-nav, sidebar ou tab bar", e
   `apps/web/app/components/AppFrame.tsx:13` põe `/embed` na lista `SEM_CASCA_PREFIXO`. Ou seja: o
   iframe entrega só o miolo. Quem tem de oferecer a troca Chat ↔ CRM somos nós.

Conclusão: a correção é **do nosso lado**, acrescentando o Chat ao menu. O tipo já suporta agrupar —
`NavGroup` em `apps/web/src/layout/Sidebar.tsx:99`-`:104` tem `title`, `icon` e `items: NavItem[]`,
exatamente como o grupo "Principal" em `:141`-`:148`.

## 70.2 — Por que a tela não ocupa a largura

Duas camadas apertam o conteúdo:

- **A página se limita sozinha.** `apps/web/src/pages/VoltrCrmPage.tsx:86` abre com
  `mx-auto flex h-full max-w-6xl flex-col` — `max-w-6xl` trava em 72rem e `mx-auto` centraliza. Ainda
  há o `PageHeader` (`:87`) e um cartão em `:96` com `mt-3`, `rounded-2xl`, `border` e sombra, que
  rouba mais alguns pixels de cada lado.
- **O layout adiciona padding.** `apps/web/src/layout/DashboardLayout.tsx:88` envolve as páginas
  comuns em `mx-auto min-w-0 max-w-[1560px] px-3 … sm:px-4 lg:px-5 lg:py-6`.

O layout **já tem o modo certo pronto**: `apps/web/src/layout/DashboardLayout.tsx:27` define
`const fullBleed = pathname === '/agenda'`, e quando ele é verdadeiro a rota cai no `<main>` de
`:79` (`flex min-h-0 flex-1 flex-col overflow-hidden`), **sem padding, sem max-width e sem o scroll
do main** — a própria página cuida da altura. É o mesmo que a agenda usa.

## 70.3 — Correção

1. `apps/web/src/layout/Sidebar.tsx`: o link solto vira **grupo "Voltr"** com dois itens —
   Atendimento (`/voltr-chat`, `IconMessage`) e CRM (`/voltr-crm`, `IconUsers`), preservando
   `feature: 'whatsapp_api'` e `perm: 'marketing:view'` em cada um. São os únicos dois ícones do
   conjunto que servem aqui (`apps/web/src/components/icons.tsx` só tem `IconMessage` e `IconUsers`
   nessa família).
2. `apps/web/src/layout/DashboardLayout.tsx:27`: `fullBleed` passa a valer também para
   `/voltr-crm` e `/voltr-chat`.
3. `apps/web/src/pages/VoltrCrmPage.tsx`: fora `mx-auto`, `max-w-6xl`, o `PageHeader`, o `mt-3` e a
   moldura do cartão. O iframe passa a ocupar 100% de largura e altura. Os estados de carregando e
   de erro continuam, agora centralizados na área cheia — sumir com eles deixaria a tela preta sem
   explicação quando a Voltr não responde.

Fica registrado o que NÃO muda: o `postMessage` continua com origem estrita e o token continua vindo
do nosso backend. Isto aqui é só enquadramento de tela e navegação.
