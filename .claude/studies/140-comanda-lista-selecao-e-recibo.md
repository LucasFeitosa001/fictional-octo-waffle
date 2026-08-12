# 140 — Comanda: seleção em lote que sobrevive ao filtro, e recibo que não diz o status

Área do laudo `.claude/studies/139-achados-4-fluxos.md`, seção **Comanda**:

- `[ALTO] Seleção em lote não é limpa ao trocar filtro ou página` (139:182-190)
- `[MEDIO] Recibo impresso não diz o status` (139:192-200)

Arquivos que vou tocar (repo-relative):

- `apps/web/src/pages/ComandasPage.tsx`
- `apps/web/src/components/ComandaImpressao.tsx`
- `apps/web/src/hooks/useSelectMode.ts` (só comentário/doc — ver decisão no fim)

Fora do escopo por ordem explícita: `apps/web/src/pages/ComandaDetalhePage.tsx` e todo o backend.

---

## 1. Seleção em lote acumula fora do recorte visível

### O que o código faz hoje

- `apps/web/src/pages/ComandasPage.tsx:474-515` — `rows` é o resultado dos filtros
  (status excluídas, período `range.from`/`range.to`, cliente, forma de pagamento,
  busca), aplicados no cliente sobre `allRows`.
- `apps/web/src/pages/ComandasPage.tsx:517-520` — o único efeito que reage à troca
  de filtro faz `setPage(1)` e **nada mais**; a seleção não é tocada.
- `apps/web/src/pages/ComandasPage.tsx:522-525` — `pageRows` = fatia de 20 (`PAGE_SIZE`,
  :79) de `rows`.
- `apps/web/src/pages/ComandasPage.tsx:527-529` — `ids = pageRows.map(...)` e
  `const sel = useSelectMode(ids)`: o hook recebe **só os ids visíveis**.
- `apps/web/src/hooks/useSelectMode.ts:28-35` — `toggle` acumula num `Set` que
  ninguém poda: id marcado continua marcado depois que sai de `allIds`.
- `apps/web/src/hooks/useSelectMode.ts:39-42` — `allSelected` olha **só** `allIds`
  (os visíveis). Com 20 invisíveis marcados o checkbox do cabeçalho aparece
  DESMARCADO — a tela mente sobre o que está selecionado.
- `apps/web/src/hooks/useSelectMode.ts:44-50` — `selectAll` também opera só sobre
  os visíveis: "Selecionar todos" na página 1, ir para a 2 e repetir dá 40.
- `apps/web/src/pages/ComandasPage.tsx:546-563` — `handleRemoveSelected` itera
  `[...sel.selected]` INTEIRO (:547) e o diálogo só diz
  `Excluir ${n} comanda(s) selecionada(s)?` (:550), sem dizer QUAIS.
- Entrada desktop: `apps/web/src/pages/ComandasPage.tsx:766-778` (botão
  `Ações (N)`, `hidden md:inline-flex`), checkbox de cabeçalho em :838-851 e
  checkbox de linha em :890-903.
- Entrada mobile: `apps/web/src/pages/ComandasPage.tsx:580-596`
  (`buildSelectActions` na BottomNav) e o cartão em :991-1057.

### Por que dói (o caminho concreto)

Marcar 20 comandas de julho → trocar o período para agosto (a lista troca inteira,
o botão continua `Ações (20)`) → `Excluir selecionadas` → cancela as 20 de JULHO,
que nem estão na tela. É irreversível em dinheiro: o backend grava
`status: 'canceled'` (`apps/api/src/modules/orders/orders.service.ts:2013`) e
`reopen()` só aceita comanda `finished` (`orders.service.ts:1935`).

### Precedente no próprio repositório

`apps/web/src/pages/financeiro/ContasPage.tsx:662-666` já resolve exatamente isto
ao trocar de aba:

```
// Ao trocar de aba, sai do modo e limpa a seleção (padrão Belasis).
useEffect(() => { sel.cancel(); }, [tab]);
```

Vou seguir o mesmo padrão em Comandas, estendendo o gatilho para todo o recorte
(filtros **e** página), já que `allSelected`/`selectAll` são definidos sobre os
ids visíveis — ou a seleção acompanha o visível, ou a tela mente.

### Diálogo

`apps/web/src/components/ConfirmDialog.tsx:6-12` — `ConfirmOpts.message` é
`ReactNode` (:8) e é renderizado como bloco (:91-93). Ou seja, dá para LISTAR as
comandas sem mexer no componente de confirmação.

Dados disponíveis para a lista: `OrderRow` tem `number`, `date`, `customer` e
`netTotal` (`apps/web/src/lib/types.ts:205-217`); `formatMoney`/`formatDate` já
estão importados em `ComandasPage.tsx:69`.

### Decisão sobre o hook compartilhado

`useSelectMode` é usado por 11 telas — grep: `FornecedoresPage.tsx:249`,
`PacotesPage.tsx:225`, `ComandasPage.tsx:529`, `ClientesPage.tsx:249`,
`MarcasPage.tsx:108`, `ProfissionaisPage.tsx:126`, `ServicosPage.tsx:257`,
`ProdutosPage.tsx:280`, `cadastros/AnamnesesPage.tsx:101`,
`financeiro/TransacoesPage.tsx:285`, `financeiro/ContasPage.tsx:660`.

Podar o `Set` dentro do hook mudaria o comportamento das 11 de uma vez, sem que
eu consiga verificar cada uma em runtime. Então **não altero a lógica do hook** —
só acrescento o aviso no docblock (`useSelectMode.ts:5-14` / :37-42) de que o
`Set` é acumulativo e que a página é responsável por limpar quando o recorte
muda, apontando o precedente. Correção de comportamento fica em ComandasPage.

---

## 2. Recibo impresso não diz o status

### O que o código faz hoje

- `apps/web/src/components/ComandaImpressao.tsx:66-76` — monta o recibo a partir
  de `d` (`OrderDetail`, `apps/web/src/lib/types.ts:321-352`, que TEM `status` em
  :327 e `statusHistory` em :343). O componente **nunca lê `d.status`** (grep
  `status` no arquivo só acha `p.status` de pagamento, :74 e :156).
- `apps/web/src/components/ComandaImpressao.tsx:99-104` — cabeçalho do recibo:
  título `Comanda #N` e o bloco `sp-print__meta` com Data / Cliente /
  Profissional. Nenhuma menção a situação.
- `apps/web/src/components/ComandaImpressao.tsx:139-170` — Totais e Pagamentos.
  Uma comanda cancelada continua imprimindo `Total` cheio e cada pagamento com o
  rótulo limpo, porque o backend não mexe em `OrderPayment.status` ao cancelar
  (`orders.service.ts:1988` chama `reverseFinishReconciliation`, que estorna
  Transaction/comissão/estoque e deixa o pagamento como `paid`) — logo o `p.status
  === 'paid' ? '' : ' (em aberto)'` (:156) imprime a forma como se fosse boa.
- `apps/web/src/components/ComandaImpressao.tsx:184-201` — duas linhas de
  assinatura (cliente e responsável), impressas para qualquer status.
- `apps/web/src/components/ComandaImpressao.tsx:80-84` — o componente já escreve
  um `<style>` próprio (só `@page` hoje) porque `@page` não aceita seletor. É o
  lugar natural para o CSS da tarja, sem tocar em `index.css` (arquivo global
  disputado por outros agentes nesta rodada).
- Menus que disparam a impressão: desktop `ComandasPage.tsx:938-944` (só
  `disableRemove` é condicionado a `canceled`, :943) e mobile
  `ComandasPage.tsx:1102-1130` (idem, :1124). Ou seja, imprimir comanda cancelada
  é liberado — e não vou bloquear: conferência é caso de uso legítimo; o defeito é
  o papel não dizer o que é.

### Por que dói

Comanda #312 faturada e depois cancelada. Qualquer um imprime pelo `⋮` e sai um
papel com cabeçalho do salão, itens, `Total R$ 320,00`, pagamentos como pagos e
espaço de assinatura — indistinguível de uma venda válida. Esse papel circula.

### Rótulos

`packages/shared/src/enums.ts:61-65` — `ORDER_STATUS_LABELS`:
`open: 'Aberta'`, `finished: 'Finalizada'`, `canceled: 'Cancelada'`. Já é o que a
tela usa (`apps/web/src/components/StatusChip.tsx:21-27`), então o papel passa a
falar a mesma língua da tela.

### Plano

1. `Situação: <rótulo>` no `sp-print__meta` para todo status.
2. Comanda cancelada: tarja em caixa alta logo abaixo do título — borda preta
   sólida (borda e texto sobrevivem em impressora que descarta fundo) — com a
   data do cancelamento tirada de `statusHistory`.
3. Comanda cancelada: linha de aviso dentro de "Pagamentos", porque o
   `OrderPayment` continua `paid` no banco e o papel não pode apresentá-lo como
   recebimento válido.
4. Comanda cancelada: **sem** bloco de assinatura — não se assina venda cancelada,
   e é a assinatura que faz o papel parecer comprovante.

Sem alteração de regra de negócio, sem backend, sem schema.
