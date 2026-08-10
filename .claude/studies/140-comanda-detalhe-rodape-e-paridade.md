# 140 — /comandas/:id: rodapé atrás da BottomNav e paridade com o ComandaDrawer

Estudo obrigatório antes de editar. Itens tratados: os dois achados do laudo
`.claude/studies/139-achados-4-fluxos.md` que caem na página de detalhe da
comanda (seções "Faturar" e "Comanda"):

- [ALTO] (mobile) "Finalizar comanda"/"Reabrir"/"Voltar" e a mensagem de erro
  ficam ATRÁS da BottomNav (139:112-120 e 139:172-180).
- [ALTO] (ambos) A página é superfície de segunda classe frente ao
  ComandaDrawer: sem crédito/cashback, sem valor pré-preenchido, sem troco
  (139:122-130 e 139:212-220).

## Arquivos que vou tocar

- `apps/web/src/pages/ComandaDetalhePage.tsx`
- `apps/web/src/index.css` (só o bloco de espaçamento da BottomNav)

NÃO toco em `apps/web/src/components/ComandaDrawer.tsx` nem em
`apps/web/src/pages/ComandasPage.tsx` (fora da minha área). `BottomNav.tsx` foi
lido, mas não precisa mudar — quem está fora da convenção é a página.

---

## 1. Rodapé fixo debaixo da barra de navegação — CONFIRMADO no CSS real

Eu não deduzi de leitura rápida: li as três folhas envolvidas.

Rodapé da página (a barra que carrega os botões E a mensagem de erro):

- `apps/web/src/pages/ComandaDetalhePage.tsx:231` —
  `fixed inset-x-0 bottom-0 z-20 border-t … p-3 backdrop-blur sm:left-auto sm:right-6`
- `apps/web/src/pages/ComandaDetalhePage.tsx:233-237` — a mensagem `actionError`
  ("Registre o pagamento completo antes de faturar…") mora DENTRO dessa barra.
- `apps/web/src/pages/ComandaDetalhePage.tsx:238-262` — Voltar / Finalizar
  comanda / Reabrir comanda, na mesma barra.

Barra de navegação (a que fica por cima):

- `apps/web/src/layout/BottomNav.tsx:122` —
  `fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg … lg:hidden`
- `apps/web/src/layout/BottomNav.tsx:168` (TabButton) e
  `apps/web/src/layout/BottomNav.tsx:240` (ActionButton) — `min-h-16` = 4rem.
- `apps/web/src/index.css:869-871` — `.club-bottomnav` pinta `var(--sp-sidebar)`
  com gradiente: a barra é OPACA, não deixa o toque passar nem o texto aparecer.

Conta com os números do próprio projeto (a folha de estilo documenta a altura da
nav como 4.5rem em `apps/web/src/index.css:877`): a nav ocupa de ~8px a ~80px do
fundo; o rodapé da página ocupa de 0 a ~64px. Sobreposição total no intervalo em
que os botões vivem, e `z-40 > z-20` — o toque vai para Menu/Agenda/Criar.
`ComandaDetalhePage` não registra `usePageActions` (grep no arquivo = zero), então
a nav mostra o fallback e o toque cai em navegação, não em "Finalizar".

O `sm:left-auto sm:right-6` não salva: a nav só some em `lg` (1024px), e entre
640 e 1023px a barra da página continua ancorada no MESMO intervalo vertical.
Ou seja: quebra em celular e em tablet.

Conclusão: o achado se sustenta. Não é falso positivo.

### A convenção que já existe no projeto

- `apps/web/src/index.css:874-888` — comentário declarando o "ponto ÚNICO de
  verdade do offset inferior" e a classe `.fab-above-nav` com
  `bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 4.5rem + 0.75rem)`.
- `apps/web/src/index.css:890-894` — override `@media (min-width: 768px)`.
- Consumidores: `apps/web/src/pages/PacotesPage.tsx:848` e
  `apps/web/src/pages/AssinaturasPage.tsx:675`/`:685` — todos FABs redondos
  `md:hidden`, com `z-30` (abaixo da nav, nunca um z novo).

Duas observações que mudam o que eu vou escrever:

1. `.fab-above-nav` usa `bottom:`, o que serve para um FAB de 56px. O rodapé
   daqui é uma barra full-bleed: subir a barra inteira deixaria uma fresta de
   ~0,75rem com o conteúdo da página passando por baixo dela. O equivalente
   correto para BARRA é reservar o espaço POR DENTRO (padding-bottom) e manter a
   barra encostada no fundo, com a nav flutuando sobre a parte reservada.
2. O override de `.fab-above-nav` é `min-width: 768px`, mas a nav é `lg:hidden`
   (1024px) — o próprio laudo registra isso como observação (139:120). Não vou
   mexer em `.fab-above-nav` (é `md:hidden` nos três consumidores, então o
   override é inócuo para eles hoje e mudar mexeria em telas fora da minha
   área), mas a classe nova nasce com o breakpoint certo, `min-width: 1024px`.

Tailwind aqui é v4 via plugin (`apps/web/vite.config.ts:14`), então as
utilitárias vivem em `@layer utilities` e uma regra sem layer no `index.css`
ganha delas. Ainda assim vou trocar `p-3` por `px-3 pt-3` no elemento para não
deixar duas fontes disputando o `padding-bottom`.

---

## 2. Paridade com o ComandaDrawer — o que dá para fazer sem decisão de produto

O que a página tem hoje:

- `apps/web/src/pages/ComandaDetalhePage.tsx:18-31` — imports: só
  addDiscount/addItem/addPayment/finish/reopen/removeItem/reversePayment.
  Nada de crédito, cashback, imprimir ou cancelar.
- `apps/web/src/pages/ComandaDetalhePage.tsx:621-630` — crédito/cashback só
  APARECEM (texto morto) quando já foram aplicados em outro lugar.
- `apps/web/src/pages/ComandaDetalhePage.tsx:820` — `useState('')`: o campo de
  valor do pagamento nasce VAZIO.
- `apps/web/src/pages/ComandaDetalhePage.tsx:826-843` — `handleAdd` manda o
  valor digitado cru, sem teto e sem troco.

O que o drawer tem (referência, não vou editar):

- `apps/web/src/components/ComandaDrawer.tsx:528-546` — `LedgerLine` de Crédito
  e Cashback, com `maxApply = netTotal + jáAplicado`.
- `apps/web/src/components/ComandaDrawer.tsx:700-790` — a `LedgerLine`:
  `cap = max(0, min(saldoDoCliente, maxApply))`, aplicar/remover.
- `apps/web/src/components/ComandaDrawer.tsx:872` —
  `setAmount(remaining > 0 ? remaining.toFixed(2) : '')`.
- `apps/web/src/components/ComandaDrawer.tsx:881-882` —
  `troco = Math.max(0, typed - remaining)`.
- `apps/web/src/components/ComandaDrawer.tsx:922` — `amount: Math.min(value, remaining)`
  com o comentário explicando que o excedente é troco, não pagamento.

Infra que já existe e a página só não usa:

- `apps/web/src/lib/queries.ts:589-625` — `useApplyOrderCredit`,
  `useRemoveOrderCredit`, `useApplyOrderCashback`, `useRemoveOrderCashback`
  (POST/DELETE `/orders/:id/credit|cashback`).
- `apps/web/src/lib/types.ts:344-350` — `OrderDetail.customerBalance`
  (`creditBalance`/`cashbackBalance`) — a página JÁ recebe esse dado no
  `useOrder`, só não lê.
- `apps/api/src/modules/orders/orders.service.ts:200-215` — `findOne` devolve
  `customerBalance`; zera quando a comanda é avulsa (sem `customerId`).
- `apps/api/src/modules/orders/orders.service.ts:831-843` — `applyCredit` exige
  `order.customerId` ("Comanda sem cliente — não é possível usar crédito.") →
  por isso só renderizo as linhas quando há cliente.
- `apps/api/src/modules/orders/orders.service.ts:965-971` — `addPayment` recusa
  valor acima do restante: `O pagamento ultrapassa o restante da comanda (X)`.
  É o 400 que o troco não tratado produz hoje nesta tela.
- `apps/api/src/modules/orders/orders.service.ts:961` (via laudo) — `finish`
  exige `paidTotal == netTotal`, daí o "Registre o pagamento completo antes de
  faturar" que hoje é impresso na barra coberta.

### Escopo do que vou implementar (prioridade = evitar erro de dinheiro)

1. Valor do pagamento pré-preenchido com o restante (mesma expressão do drawer).
2. Troco exibido e valor persistido limitado ao restante (evita o 400 e evita
   pagamento maior que a venda).
3. Guarda "já está integralmente pago" quando o restante é ~0.
4. Crédito e cashback aplicáveis/removíveis, com o mesmo teto do drawer.

Fica FORA (relato em pendências, não decido sozinho / é grande): atalhos
Dinheiro/Cartão/Outros com resolução de forma cadastrada, split em duas formas,
imprimir, cancelar, e a reorganização mobile da tela (a lista de itens em
`:311-397` está dentro de SectionCard creme, sem irmão `md:hidden`, contra a
regra de mobile do projeto — mexer nisso é redesenho da tela inteira, não
correção mínima).
