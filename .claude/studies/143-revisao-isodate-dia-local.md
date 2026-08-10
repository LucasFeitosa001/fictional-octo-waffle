# 143 — Revisão adversarial: `isoDate` passou a devolver o dia LOCAL

Revisão do estudo 140 (`.claude/studies/140-isodate-dia-local-agenda.md`), que
trocou `isoDate` de UTC para dia local e criou `isoDateUtc` para os 4 pontos que
releem campos data-only.

## Veredito da mudança de raiz

A troca está **certa** e resolve o caminho de dor do laudo 139 (linha 41). Percorri
os 60 pontos de chamada (`grep -rn "isoDate(" apps/web/src`) e separei em três
famílias:

1. **`isoDate(new Date())` como "hoje"** — 38 pontos (comanda, caixa, vale, compra,
   comissão, transação, bloqueio de agenda). Passam a mandar o dia LOCAL, que é o
   que a recepção quis dizer. Ganho real.
2. **`isoDate(célula do calendário)`** — a célula nasce de `new Date(ano, mês, dia)`
   (AgendaPage.tsx:136-155), meia-noite local = 03:00Z do mesmo dia. Resultado
   idêntico ao de antes. Sem risco.
3. **`isoDate(new Date(campo do backend))`** — só 4 pontos, todos já tratados com
   `isoDateUtc` no estudo 140.

Também confirmei duas melhorias colaterais que o estudo 140 não citou:

- `layoutDay`/`sameDay` (AgendaGrid.tsx:45-51) já comparava em horário LOCAL. A
  grade de dia/semana e o `apptsByDay` do mês estavam em fusos DIFERENTES; agora
  concordam. AgendaPage.tsx:453.
- `carimboDeFechamento` (CaixasAbertosPage.tsx:53-61) decide "é hoje?" com
  `getFullYear/getMonth/getDate` — local. Com `closeDate` em UTC, fechar o caixa às
  21:30 caía no ramo "retroativo" e carimbava **meio-dia de amanhã** em vez do
  instante real. Agora bate.

## Achado 1 — a suíte do frontend ficou VERMELHA (o estudo 140 diz que ela não existe)

O estudo 140 afirma "o frontend NÃO tem runner de unidade" e validou com `tsx`.
Existe runner: `apps/web/package.json:12` → `"test": "TZ=America/Sao_Paulo jest"`,
com 4 arquivos em `apps/web/tests/`, um deles `tests/format.test.ts` cobrindo
exatamente `isoDate`.

Estado medido:

- ANTES (com `apps/web/src/lib/format.ts` no stash): `tests/format.test.ts` →
  103 passando, 0 falhando.
- DEPOIS: `Tests: 2 failed, 195 passed` — `tests/format.test.ts:169-183`.

Os dois casos que quebram gravaram a convenção ANTIGA (dia em UTC):

- `tests/format.test.ts:172` — `Date.UTC(2026, 0, 1, 0)` esperando `'2026-01-01'`;
  em São Paulo esse instante é 31/12/2025 21:00 → agora `'2025-12-31'`.
- `tests/format.test.ts:175` — `Date.UTC(2026, 5, 7, 0, 0)` esperando `'2026-06-07'`;
  é 06/06 21:00 local → agora `'2026-06-06'`.

Não é defeito do código novo: é o teste que ainda descreve o comportamento que o
laudo mandou derrubar. Vou reescrever o bloco para a convenção nova e acrescentar
o caso das 21:30 do laudo — que **falha** com o `isoDate` antigo — mais um bloco
para `isoDateUtc`, hoje sem nenhuma cobertura.

Arquivo a tocar: `apps/web/tests/format.test.ts` (bloco `describe('isoDate')`,
linhas 169-183, e um `describe('isoDateUtc')` novo logo abaixo).

## Achado 2 — o comentário novo em TransacoesPage afirma algo falso

`apps/web/src/pages/financeiro/TransacoesPage.tsx:1556-1561` diz que `dueDate`,
`paidAt` e `competenceDate` "são data-only e o backend as cria com
`new Date('2026-08-09')`". Isso vale só para o lançamento feito por esta tela
(financial.service.ts:761 e :784-787). A transação nascida de comanda grava as
TRÊS colunas com instante real:

- `apps/api/src/modules/orders/orders.service.ts:1337-1339` —
  `dueDate: liquidacao`, `competenceDate: now`, `paidAt: now`.
- `apps/api/src/modules/orders/orders.service.ts:2033-2035` — estorno, `dueDate: now`,
  `paidAt: now`.

Ou seja: a coluna MISTURA data-only (meia-noite UTC) com carimbo real. `isoDateUtc`
acerta a primeira e erra a segunda; `isoDate` faria o inverso. A escolha do estudo
140 (`isoDateUtc`) é a certa porque preserva o comportamento anterior e evita a
deriva ao salvar — mas o comentário precisa dizer a verdade, senão o próximo a
mexer acha que a coluna é homogênea. Correção: só o texto do comentário.

Arquivo a tocar: `apps/web/src/pages/financeiro/TransacoesPage.tsx:1556-1561`.

## Achado 3 — o "como verificar" do estudo 140 está errado (relatar, não corrigir)

O estudo 140 manda conferir que "a data mostrada [no modal] tem de ser a mesma da
coluna Vencimento da lista". Elas **divergem**, e divergiam antes da mudança
também. Medido com `TZ=America/Sao_Paulo`:

| onde | função | saída p/ `dueDate = 2026-08-09T00:00:00.000Z` |
|---|---|---|
| tabela desktop | `formatDate` (TransacoesPage.tsx:440) | `08/08/2026` |
| lista mobile | `formatDateBR` (TransacoesPage.tsx:111-116) | `8 ago` |
| modal de edição | `isoDateUtc` (TransacoesPage.tsx:1563) | `09/08/2026` |

A lista renderiza em horário local um valor gravado à meia-noite UTC, então mostra
um dia a menos para todo lançamento criado à mão. Mesma coisa em
`ComprasPage.tsx:518` e `:584` para `Purchase.date`. É bug pré-existente e a saída
correta é decidir se data-only vira `@db.Date`/string no schema — decisão de
produto/migração. Fica em pendências.

## Achado 4 — intervalo padrão dos relatórios (relatar, não corrigir)

`dateRange` (apps/api/src/modules/reports/reports.service.ts:16-22) fecha o
período com `setUTCHours(23, 59, 59, 999)`, e `endOfDay`
(apps/api/src/modules/financial/financial.service.ts:50-57) faz o mesmo. Como
`Order.date` é instante real (schema.prisma:1274 `@default(now())`), um período que
termina em `2026-08-09` corta às **20:59:59 locais** — a venda das 21:30 fica de
fora.

Isso já acontecia sempre que alguém escolhia a data à mão no DatePicker (que emite
dia local, DatePicker.tsx:41-46). O que mudou: o intervalo PADRÃO dos relatórios
(`isoDate(new Date())` em ~20 telas) também passou a ser local, então das 21h à
meia-noite ele deixou de compensar o corte por acidente. Não dá para consertar no
front sem reintroduzir o bug da agenda, e corrigir no backend esbarra no mesmo
problema do achado 3 (o `gte` em fuso local excluiria os data-only gravados à
meia-noite UTC). Pendência.

## Achado 5 — `allowRetroactive` (relatar)

`isRetroactive` (financial.service.ts:120-126) compara com `new Date()` +
`setUTCHours(0,0,0,0)` — "hoje" no fuso do SERVIDOR (UTC). Com o front mandando o
dia local, das 21h em diante um lançamento datado de hoje é lido como retroativo e,
numa empresa que desligou `allowRetroactive`, volta 400. O padrão é `true`
(financial.service.ts:31), então não é o caso comum. Mesma família do achado 4.

## Não mexer

Nada em `toDateInput` (format.ts:91-96): birthday do cliente/profissional e
manufacturedAt/expiresAt do lote são data-only puros, sem irmão gravado com hora.
E nada nos `describe` de `formatDate`/`formatSlotTime`/`formatMoney` — passam.
