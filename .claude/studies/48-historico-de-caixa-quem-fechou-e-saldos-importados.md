# Estudo 48 — Histórico de caixa: a coluna "Fechou o caixa" mente, e os saldos importados estão errados

Pedido do dono, olhando o Histórico de caixa da Fátima em produção: *"vi que tem varios que não
apareceu o nome da Fatima veja se esse local estar tudo correto"*.

São DOIS problemas independentes: um de código (a tela) e um de dados (a importação). Tudo abaixo
foi conferido no banco de PRODUÇÃO (`Fátima Cabelos`, `cmrqa8nzm00000hfbkyljwqrc`) e contra a
captura real do Belasis do mesmo salão.

---

## 48.1 — "Fechou o caixa" mostra quem ABRIU

`apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:138`-`:145`:

```tsx
{
  key: 'closedBy',
  header: 'Fechou o caixa',
  // TODO: sem responsável de fechamento no payload; usamos o de abertura
  // quando o caixa está fechado, senão "—".
  render: (c) => (c.status === 'closed' ? c.responsibleUser?.name ?? '—' : '—'),
}
```

O dado EXISTE. `CashRegister.closedByUserId` está no schema
(`packages/db/prisma/schema.prisma:1706`, relação `closedByUser` em `:1715`) e o fechamento grava:
`apps/api/src/modules/cash-registers/cash-registers.module.ts` — `closedByUserId: userId` no
`update` do `close()`. Quem não devolve é o `history()`, cujo include é só
`{ responsibleUser: { select: USER_SELECT } }`.

Em produção isso aparece nos três caixas que TÊM usuário:

```
#590  abriu=Fátima  fechou=null    (aberto)   → tela: "Fátima Cabelos | —"   ✔
#589  abriu=Fátima  fechou=Fátima             → tela: "Fátima | Fátima"      ✔ por coincidência
#588  abriu=null    fechou=Fátima             → tela: "— | —"                �’ ERRADO
```

O #588 foi fechado pela Fátima e a tela diz que ninguém fechou. E no #589 o acerto é sorte: ela
abriu e fechou. Se um recepcionista abrisse e a dona fechasse, a tela creditaria o fechamento ao
recepcionista.

## 48.2 — Os dois filtros de responsável não filtram nada

`CaixaHistoricoPage.tsx:22`-`:26` monta as opções a partir de **profissionais**:

```tsx
const professionals = useProfessionals(1, 100);
const professionalOptions = (professionals.data?.data ?? []).map((p) => ({ id: p.id, name: p.name }));
```

e `:59` compara com um **usuário**:

```tsx
if (openerId && c.responsibleUser?.id !== openerId) return false;
```

`Professional.id` ≠ `User.id` (`schema.prisma:791`/`:793`: `Professional.userId` é outra coluna).
Em produção, a Fátima é `professional=cmrr2dfic00130hyiet6h9xub` e
`user=q2a2KedTxTokkamoo4u3K2wEbUX8EcUb`. Escolher "FATIMA LACERDA" no filtro de abertura devolve
ZERO linhas — sempre. O de fechamento (`closerId`) nem chega a ser usado no `filter` (`:41`-`:42`
declara o TODO).

## 48.3 — Caixa aberto exibe "Saldo conferido R$ 0,00"

`CaixaHistoricoPage.tsx:167`-`:175` chama `formatMoney(c.countedBalance)`, e
`apps/web/src/lib/format.ts` faz `(value ?? 0)` — nulo vira `R$ 0,00`. O #590 está ABERTO
(`countedBalance = null`, conferido nunca aconteceu) e a tela afirma que foi conferido zero.

## 48.4 — O `note` do fechamento é aceito e jogado fora

`cash-registers.module.ts`, `CloseCashDto`: `// Sem coluna própria no schema; aceito mas não
persistido.` O hook `useCloseCashRegister` (`apps/web/src/lib/queries/caixa.ts:118`-`:136`) tem o
parâmetro `note`, e **nenhuma tela envia** — não há campo de anotação no fechamento
(`CaixasAbertosPage.tsx` só tem "Valor conferido (real)").

A coluna "Anotação" fixa em `'—'` (`CaixaHistoricoPage.tsx:180`-`:184`) não é divergência: a
captura `belasis-reference/finance-cash-history/desktop.html` mostra a coluna Anotação **vazia em
todas as 20 linhas** do Belasis. Fica anotado, não corrigido: sem campo que escreva, criar coluna
no banco seria mobília.

---

## 48.5 — O DADO importado está errado: cada dia desconta o fechamento do dia anterior

Este é o problema grande, e não é de tela.

A captura do Belasis do MESMO salão (`finance-cash-history/desktop.html`, v5.7.12, "573 no total")
tem `FATIMA LACERDA` nas duas colunas de nome em todas as linhas, e estes saldos:

```
20/06 718,08 | 23→24/06 268,03 | 25/06 876,66 | 26/06 956,93 | 27/06 140,00 | 29/06 0,00
30/06 290,00 | 01/07 548,50 | 02/07 989,25 | 03→04/07 470,00 | 06/07 442,00 | 07/07 1.332,14
08/07 650,08 | 09/07 240,58 | 10/07 840,85 | 11/07 670,00 | 13/07 555,00 | 14/07 175,00
15/07 230,00 | 16→17/07 512,62
```

O nosso banco, mesmo período:

```
01/07 216,50 | 02/07 440,75 | 03/07 −714,25 | 06/07 −328,00 | 07/07 890,14 | 08/07 −682,06
09/07 −409,50 | 10/07 600,27 | 11/07 −170,85 | 13/07 −115,00 | 14/07 −380,00 | 15/07 55,00
16/07 −165,00 | 17/07 447,62 | 18/07 −189,62
```

A regra é exata em nove dias seguidos: **nosso(d) = Belasis(d) − Belasis(d−1)**.

```
11/07:  670,00 − 840,85 = −170,85  ✔     13/07:  555,00 − 670,00 = −115,00  ✔
14/07:  175,00 − 555,00 = −380,00  ✔     15/07:  230,00 − 175,00 =   55,00  ✔
10/07:  840,85 − 240,58 =  600,27  ✔     09/07:  240,58 − 650,08 = −409,50  ✔
08/07:  650,08 − 1.332,14 = −682,06 ✔    07/07: 1.332,14 − 442,00 = 890,14  ✔
```

O mecanismo está nos movimentos. Cada caixa importado carrega um `out` descrito **"Fechamento de
caixa"** com o valor do fechamento do dia ANTERIOR:

```
#582 13/07  out 670,00   ← fechamento do Belasis de 11/07
#583 14/07  out 555,00   ← 13/07
#584 15/07  out 175,00   ← 14/07
#585 16/07  out 230,00   ← 15/07
#587 18/07  out 512,62   ← 16→17/07
```

São **527 movimentos "Fechamento de caixa"** na empresa. Ou seja: a retirada do dinheiro no
fechamento de um dia foi lançada como DESPESA do dia seguinte. Efeito colateral visível:
**219 dos 589 caixas fechados ficaram com "Saldo conferido" NEGATIVO** — gaveta de dinheiro não
fica negativa.

Outras duas divergências do mesmo import:

- **588 dos 590 caixas não têm responsável** (`responsibleUserId = null`); no Belasis todos são
  FATIMA LACERDA. É a causa direta do "—" que o dono viu. Só #588, #589 e #590 (criados dentro do
  SalonPass) têm usuário.
- O Belasis mantém caixas que **atravessam dias** (23→24/06, 03→04/07, 16→17/07); o import quebrou
  um caixa por dia. Por isso a numeração não bate (590 aqui × 573 lá).

### 48.6 — Por que os nomes não vieram: NENHUM relatório exportado tem essa coluna

Conferido nos 32 `.xls` que o dono baixou do Belasis (`/mnt/c/Users/Usuario/Downloads`, 18–19/07),
lendo o cabeçalho de cada um. Os financeiros:

```
Fluxo de Caixa            Baixa · Descrição · Conta · Forma de pagamento · Taxa · Movimentação
Extrato de Movimentações  Movimentação · Descrição · Histórico · Data vencimento · Data movimentação ·
                          Forma de pagamento · Conta · Categoria · Valor
Extrato de Contas         Data competência · Histórico · Vencimento · Pagamento/Baixa · Forma ·
                          Conta · Categoria · Saldo anterior · Bruto · Taxa · Líquido · Saldo
Recebimentos / Despesas   Histórico · Cliente|Fornecedor · Competência · Valor · Pago · Restante ·
                          Forma · Conta · Categoria · Vencimento · Baixa/Pagamento
```

Nenhum tem usuário/responsável — e **não existe relatório de CAIXA** no pacote. Os caixas foram
reconstruídos agrupando movimentos por dia; daí também vem "um caixa por dia" e "saldo inicial
R$ 0,00" em todos.

Que o Belasis sabe exportar "quem fez" está provado em outros relatórios do mesmo pacote:
`Agendamentos excluídos` traz **"Excluído por"** e `Criação de Agendamento` traz **"Criado por"**.
É o relatório de caixa que não existe na exportação.

### Correção aplicada em 29/07/2026: os nomes

Autorizado pelo dono (*"faça os nomes do historico de caixa ter o nome da Fatima"*). A empresa tem
**um único usuário** (`Fátima Cabelos`, `contato@fatimacabelos.com.br`), e a captura do Belasis
mostra `FATIMA LACERDA` nas duas colunas em todas as linhas — atribuir a ela é restaurar a origem,
não inventar.

```
responsibleUserId preenchido em 588 caixas
closedByUserId    preenchido em 587 caixas (só os fechados; o #590 está aberto e segue sem quem fechou)
restaram sem: 0 e 0
```

O nome exibido é **"Fátima Cabelos"** (nome da CONTA), não "FATIMA LACERDA" (nome do profissional):
o caixa aponta para `User`, e a `Professional` homônima é outro registro.

### Correção NÃO aplicada — os saldos (mexe em dinheiro de cliente em produção)

1. Apagar os 527 movimentos `description = 'Fechamento de caixa'` (eles não são despesa: são a
   contrapartida da própria conferência).
2. Recalcular `countedBalance`/`expectedBalance` de cada caixa importado a partir dos movimentos
   restantes e conferir contra a lista do Belasis dia a dia.
3. Preencher `responsibleUserId`/`closedByUserId` dos caixas importados com o usuário da Fátima.

Nada disso entra sem o dono mandar: é histórico financeiro de um salão real, e o passo 1 e o 2
reescrevem valores já auditados por ele.

## Arquivos tocados (só o 48.1–48.3)

- `apps/api/src/modules/cash-registers/cash-registers.module.ts` (history devolve `closedByUser`)
- `apps/web/src/lib/queries/caixa.ts` (`CashHistoryRow.closedByUser`)
- `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx` (coluna do fechamento, saldo não
  conferido, filtros por usuário de verdade)
