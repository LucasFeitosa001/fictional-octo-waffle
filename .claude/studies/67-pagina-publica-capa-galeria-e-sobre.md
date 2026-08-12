Estudo 67 — Página pública: capa, galeria, "sobre" e o que o salão preenche sem aparecer

Pedido do dono, depois do levantamento: *"faça tudo isso"* — subir o que já estava pronto (cor de
fundo das fotos + fundo escuro) e elevar a personalização da página pública (capa/banner e o resto).

## 67.1 — O achado: trabalho preenchido que o cliente nunca vê

`apps/api/src/modules/public-booking/public-booking.service.ts:205`-`:228` (`getPortal`) devolve
apenas: `slug`, `name`, `logoUrl`, `timezone`, `open`, `todayHours`, `rating`, `location`, `plan`,
`customSubdomain`, `whatsapp`, `googleEnabled`, `accentColor` e `appearance`.

Ou seja, NÃO saem para a página pública:

- **Galeria de fotos** — existe modelo (`GalleryPhoto`, `schema.prisma:2412`) e três rotas no painel
  (`marketing.controller.ts:116`, `:123`, `:133`), mas nenhuma rota pública e nenhum uso no
  `apps/web-club` (grep por "gallery" só acha o lightbox das fotos de SERVIÇO). O salão sobe fotos
  que ninguém enxerga.
- **Descrição do estabelecimento, site, Instagram, Facebook** — colunas em `SalonWebProfile`
  (`schema.prisma:2390`-`:2393`), editáveis na aba "Detalhes da empresa", ausentes do payload.

Isto é o padrão de tela decorativa que já pegamos em outras áreas: o dono trabalha, o dado é
gravado, e não muda nada para o cliente.

## 67.2 — Capa (banner) não existe

Não há campo de capa em lugar nenhum (`grep coverUrl|banner|heroUrl` no service público: zero). A
página pública abre direto no cabeçalho com logo + nome + status. O upload de imagem já existe
(módulo `uploads` + `ImageUpload` no painel), então falta só o campo e o lugar de mostrar.

## 67.3 — O que sobe junto (estava pronto, sem deploy)

- `photoColor` na aparência (estudo 66) — fundo da foto do serviço sem imagem, que era rosa cravado
  em `apps/web-club/src/pages/BookingPage.tsx:1236`.
- Fundo escuro utilizável: `useBookingAccent` passa a marcar `data-club-dark` no `<html>` quando a
  cor de fundo é escura (luminância < 0,45) e `index.css` inverte texto, cartões (`.bg-white`),
  bordas e sombras, além de a doca do "Continuar" (`.club-action-dock`) e a barra inferior
  (`.club-bottomnav`) passarem a seguir `--booking-page-bg` em vez do creme fixo. Sem isso, com
  fundo preto, "Selecione os serviços" e "Filtros" sumiam e sobrava uma faixa clara embaixo do
  botão — exatamente o que o dono mostrou.

## 67.4 — O que este estudo entrega

1. **Portal público passa a devolver** `description`, `website`, `instagram`, `facebook`,
   `gallery[]` e a capa.
2. **Capa (`coverUrl` + `coverOverlay`)** na aparência: imagem no topo da página pública, com véu
   ajustável para o texto continuar legível sobre qualquer foto.
3. **Galeria** aparece como faixa rolável na página pública.
4. **Sobre o salão**: descrição + redes sociais na página pública.
5. **Título e ícone da aba por salão** (`document.title` e favicon a partir do logo) — barato e
   resolve metade do problema de compartilhamento.

Fica de fora, declarado: **cartão de preview (Open Graph) no WhatsApp/Instagram**. O `index.html` do
clube tem título fixo e nenhuma tag `og:` — gerar meta por salão exige HTML por slug
(SSR/Lambda@Edge), que é obra separada.

## Arquivos

- `packages/db/prisma/schema.prisma` + migração aditiva: nada novo (capa e véu vivem no Setting
  `booking.appearance`; galeria e textos já têm tabela).
- `apps/api/src/modules/marketing/marketing.service.ts` e `dto.ts`: `coverUrl`, `coverOverlay`.
- `apps/api/src/modules/public-booking/public-booking.service.ts`: portal com sobre + galeria.
- `apps/web-club/src/lib/booking.ts` e `pages/BookingPage.tsx`: capa, galeria, sobre, título/ícone.
- `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx` e
  `apps/web/src/lib/queries/agendamento-online.ts`: campos de capa no painel + prévia.
