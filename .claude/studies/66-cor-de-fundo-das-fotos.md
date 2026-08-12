# Estudo 66 — Cor de fundo das fotos do agendamento online

Pedido do dono, na aba Personalização:

> *"crie uma personalização para eu mudar a cor de fundo das foto que só tem o rosa"*

Na prévia dele, os três serviços sem foto aparecem com um retângulo rosa e um ícone de câmera. Esse
rosa é fixo no código, independente das cores que ele escolheu.

## 66.1 — Onde o rosa está preso

`apps/web-club/src/pages/BookingPage.tsx:1230`-`:1244` — quando o serviço não tem imagem:

```
backgroundImage:
  'radial-gradient(120px 120px at 30% 20%, rgba(240,140,165,0.22), transparent 70%),
   linear-gradient(160deg, #fbe2e8 0%, #f4cdd6 100%)'
…
<span className="… text-[#d79bab]"><Camera /></span>
```

Três valores rosa cravados (`#fbe2e8`, `#f4cdd6`, `#d79bab`) — não passam por variável de tema,
então trocar "Cor principal" ou "Cor de fundo" não muda nada ali. O mesmo padrão aparece no
avatar do salão sem logo (`:968`-`:975`), mas esse já usa variáveis (`--booking-accent-soft`).

## 66.2 — O que já existe de personalização

A aparência é um `Setting` por empresa (`booking.appearance`,
`apps/api/src/modules/marketing/marketing.service.ts:30`) com quatro campos hoje
(`:36`-`:41`): `hideNavbar`, `primaryColor`, `accentColor`, `backgroundColor`, normalizados por
`coerceBookingAppearance` (`:53`) e validados como hex ou vazio no
`UpdateBookingAppearanceDto` (`apps/api/src/modules/marketing/dto.ts:105`-`:119`).

No painel, a aba Personalização monta um `ColorField` por cor
(`apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx:251`, usados em `:900`-`:923`) e a prévia
do celular recebe o rascunho por query param (`:408`-`:423`, `spPreview=1`).

No web-club, `useBookingAppearance` (`apps/web-club/src/lib/booking.ts:118`) resolve a aparência do
portal (ou do preview) e `useBookingAccent` (`:143`) escreve as variáveis CSS `--booking-accent`,
`--booking-accent-2` e `--club-bg`.

## 66.3 — Correção

Um quinto campo, `photoColor`, no mesmo caminho de ponta a ponta:

- **API** (`marketing.service.ts`, `dto.ts`): `photoColor: string | null` em `BookingAppearance`,
  nos defaults, no `coerceBookingAppearance` e no DTO (hex ou vazio).
- **Painel** (`apps/web/src/lib/queries/agendamento-online.ts`,
  `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx`): campo "Cor de fundo das fotos" com
  sugestões próprias, e o parâmetro na prévia — assim o dono vê a mudança no celular antes de salvar.
- **Página pública** (`apps/web-club/src/lib/booking.ts`,
  `apps/web-club/src/pages/BookingPage.tsx`): variável `--booking-photo` e o placeholder passa a
  derivar dela com `color-mix` (fundo claro → escuro e o ícone num tom mais forte da MESMA cor).
  Sem valor definido, cai no rosa de hoje — quem não personalizar não vê diferença.

Precisa de três deploys: API, painel (`beautypass-web`) e página pública
(`beautypassagenda-web`, distribuição `E1D9PTC66EFAJ7`).
