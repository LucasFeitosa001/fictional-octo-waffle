# 144 — Revisão adversarial: seleção em lote de /comandas e recibo impresso

Revisão do trabalho descrito em `.claude/studies/140-comanda-lista-selecao-e-recibo.md`
(achados `[ALTO] seleção em lote` e `[MEDIO] recibo não diz o status`, laudo
`.claude/studies/139-achados-4-fluxos.md:182-200`).

## O que verifiquei e passou

- `apps/web/src/hooks/useSelectMode.ts` — o diff é **só docblock** (:15-23). A
  lógica (`toggle` :38-45, `allSelected` :49-52, `selectAll` :54-60) está intacta,
  então as outras 10 telas que usam o hook (`ClientesPage`, `ProdutosPage`,
  `ServicosPage`, `TransacoesPage`, `ContasPage`, `FornecedoresPage`,
  `PacotesPage`, `MarcasPage`, `ProfissionaisPage`, `cadastros/AnamnesesPage`)
  não mudaram de comportamento.
- `apps/web/src/pages/ComandasPage.tsx:545-550` — o novo efeito usa só
  PRIMITIVOS nas deps (`range.from`/`range.to`, não o objeto `range`). Importa
  porque o `DatePicker.tsx` está sendo alterado por outro agente nesta rodada:
  mesmo que ele passe a emitir `onChange` repetido, `setRange((r) => ({...r, from: v}))`
  cria objeto novo mas `range.from` continua igual → o efeito NÃO dispara. Sem
  laço e sem limpar seleção à toa.
- `payMethods` é `useState<Set>` (:429) e só é reatribuído uma vez, no efeito de
  inicialização travado por `paymentMethodsInitialized` (:457-461). Não é
  referência nova a cada render, então não zera a seleção em todo render.
- `refetchOnWindowFocus: false` (`apps/web/src/main.tsx:99`) — não há refetch por
  voltar para a aba, então a lista não se desloca por baixo de uma seleção ativa.
  O caso restante (refetch por reconexão de rede) fica coberto pelo diálogo, que
  agora LISTA nome/número/valor de cada comanda resolvida contra `allRows`.
- `remove()` é idempotente para comanda já cancelada
  (`apps/api/src/modules/orders/orders.service.ts:2264-2266`), então um id que
  sobreviva na seleção não estoura o `Promise.all`.
- Dinheiro: `somaAlvos` (`ComandasPage.tsx:578`) é `Number(...)` só para EXIBIR
  no diálogo, e passa por `formatMoney` (Intl, 2 casas). Mesmo padrão já usado em
  `ComandaImpressao.tsx:86-92`. Nenhum valor calculado no front é enviado ao
  backend — a exclusão manda só ids.
- `apps/web` — `npx tsc --noEmit` limpo e `pnpm test` 202/202.

## O problema que achei: `canceladaEm` é ramo MORTO e o comentário afirma o contrário

`apps/web/src/components/ComandaImpressao.tsx:81-85`:

```
  // Data do cancelamento, quando o histórico registrou a transição — dá ao papel
  // um "quando" verificável em vez de só um carimbo.
  const canceladaEm = cancelada
    ? d.statusHistory?.filter((h) => h.toStatus === 'canceled').at(-1)?.at
    : undefined;
```

O backend **nunca grava** transição para `canceled`. As duas únicas escritas em
`OrderStatusHistory` no repositório inteiro são:

- `apps/api/src/modules/orders/orders.service.ts:1197` — `toStatus: 'finished'` (finish);
- `apps/api/src/modules/orders/orders.service.ts:2215` — `toStatus: 'open'` (reopen).

`remove()` termina em `order.update({ data: { status: 'canceled', ... } })`
(`orders.service.ts:2298-2301`) **sem** `statusHistory: { create: ... }`.
Confirmei por grep em `apps/api/src` + `packages/db`: não há nenhum outro
escritor.

Consequência: `canceladaEm` é sempre `undefined` e o papel imprime SEMPRE o texto
alternativo ("Os valores abaixo ficam só como histórico."). A tarja funciona — o
que não existe é a data. O defeito é o comentário: quem ler daqui a seis meses
vai acreditar que o recibo carrega a data do cancelamento e não vai procurar o
buraco no backend. Mesmo buraco atinge o drawer "Histórico" da comanda
(`ComandasPage.tsx:2256-2274`), que para uma comanda cancelada mostra o histórico
sem a linha do cancelamento.

### O que vou tocar

- `apps/web/src/components/ComandaImpressao.tsx:81-85` — **só o comentário**.
  Mantenho o ramo (custa zero e passa a funcionar no dia em que o backend
  registrar a transição), mas escrito de forma honesta: hoje ele nunca resolve.

Não mexo em `apps/api/src/modules/orders/orders.service.ts`: (1) o arquivo está
sendo editado por outro agente nesta mesma rodada (`git status` mostra `M`), e
(2) passar a gravar histórico de cancelamento é mudança de comportamento do
backend — vai como pendência.
