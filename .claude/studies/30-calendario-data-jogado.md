# Estudo 30 — Calendário de data "jogado" na tela

Vídeo: `Desktop 2026.07.27 - 20.34.36.05.mp4` (7 quadros em `scratchpad/video-datas/`, recorte em
`z-cal.jpg`). Relato: *"olha como as data aparece, só jogada, tem que ser naturalmente em vez dessa
bug"*.

Cenário: Financeiro → Transações → Filtrar → clicar em **De**.

## Defeito 1 — o cabeçalho do mês não é português

`apps/web/src/components/DatePicker.tsx:198`-`:200`:
```tsx
<span className="tabular-nums">{viewMonth.getFullYear()}</span>{' '}
<span>{MONTHS_SHORT[viewMonth.getMonth()]}</span>
```
Renderiza **"2026 Jul"** — ano primeiro e mês abreviado. É leitura de máquina, não de gente; em
pt-BR se diz "Julho de 2026". É isso que dá a impressão de "jogado".

O componente **já tem** `MONTHS_LONG` (`apps/web/src/components/DatePicker.tsx:38`) e inclusive o usa
na forma correta no `aria-label` de `:230` (`${MONTHS_LONG[...]} de ${ano}`) e no de cada dia em
`:259`. Ou seja: a versão certa existe, só não é a que aparece na tela.

## Defeito 2 — o popover não é contido na horizontal

`apps/web/src/components/DatePicker.tsx:499`-`:507`:
```ts
const r = el.getBoundingClientRect();
const spaceBelow = window.innerHeight - r.bottom;
const openUp = spaceBelow < panelH + 16 && r.top > panelH + 16;
setPos({ top: openUp ? r.top - 8 : r.bottom + 8, left: r.left, openUp });
```
Transbordo **vertical** é tratado (vira `openUp`). Transbordo **horizontal** não: `left` é sempre
`r.left`, sem nenhum limite. O painel é `position: fixed` num portal
(`apps/web/src/components/DatePicker.tsx:566`-`:572`), então ele sai por cima de tudo.

Consequência visível no recorte `z-cal.jpg`: o campo "De" termina em ~x562 e o calendário vai até
~x630 — vaza para fora do painel de filtros (que tem 256px) e cobre a tabela ao lado. Com o campo
perto da borda direita da janela, o calendário sairia **para fora da tela**, e aí não é só feio: a
pessoa não consegue clicar no dia.

O `max-w-[calc(100vw-1.5rem)]` de `:574` limita a LARGURA, mas não reposiciona: um painel colado em
`left: 1800px` continua começando em 1800px.

## Correção

1. Cabeçalho: `MONTHS_LONG[mês] + " de " + ano` → "Julho de 2026".
2. Posição: prender `left` dentro da janela — `Math.max(8, Math.min(r.left, innerWidth − larguraDoPainel − 8))`.
   Usa a largura real do painel (`panelRef.current.offsetWidth`), com um padrão enquanto ele ainda
   não mediu.

## Arquivos tocados

- `apps/web/src/components/DatePicker.tsx`
