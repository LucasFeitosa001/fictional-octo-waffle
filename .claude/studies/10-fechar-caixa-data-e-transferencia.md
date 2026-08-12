# Estudo 10 — Fechar caixa: data de fechamento editável + transferir o dinheiro do dia

Pedido da dona do salão (Fátima, WhatsApp 27/07): no Belasis, ao fechar o caixa dava para
(a) **transferir o dinheiro do dia para outra conta** (opções "Caixa" e "Itaú") e
(b) **alterar a data do fechamento**, porque o fechamento costuma ser feito **no dia seguinte**.

Arquivos: `apps/api/src/modules/cash-registers/cash-registers.module.ts`,
`apps/web/src/pages/financeiro/CaixasAbertosPage.tsx`, `apps/web/src/lib/queries/caixa.ts`,
`apps/web/src/lib/queries/financeiro.ts`

## (a) Data de fechamento — hoje é sempre "agora"

`apps/api/src/modules/cash-registers/cash-registers.module.ts:29`–`:33` — `CloseCashDto` só tem
`countedBalance` e `note` (o `note` nem é persistido).

`apps/api/src/modules/cash-registers/cash-registers.module.ts:317` grava **`closedAt: new Date()`** —
o instante da requisição. Quem fecha o caixa de ontem hoje de manhã registra a data errada, e o
`CashRegister.closedAt` é o que a tela mostra na coluna "Fechamento"
(`apps/web/src/pages/CaixaPage.tsx:55`).

O schema já tem a coluna: `CashRegister.closedAt DateTime?` (`packages/db/prisma/schema.prisma`).

**Correção:** aceitar `closedAt` opcional no DTO e usá-lo quando vier; sem ele, mantém `new Date()`.
Validar que não é futuro e não é anterior à abertura (`openedAt`), senão o caixa fecharia antes de abrir.

## (b) Transferência — a máquina já existe, falta ligar no fechamento

- Front já tem `useCreateTransfer` (`apps/web/src/lib/queries/financeiro.ts:331`) e o corpo
  `CreateTransferBody { amount, fromAccountId, toAccountId, categoryId?, description?, date? }`
  (`apps/web/src/lib/queries/financeiro.ts:150`–`:157`).
- O fechamento acontece em `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:515`–`:520`
  (`mode === 'close'` → `closeCash.mutateAsync({ id, countedBalance })`).
- `useCloseCashRegister` (`apps/web/src/lib/queries/caixa.ts:118`) manda só `{ countedBalance, note }`.

**Decisão:** fazer a transferência **no front, logo após o fechamento dar certo**, chamando o endpoint de
transferência que já existe — em vez de acoplar o módulo de caixa ao financeiro no backend. Menos código
novo em regra financeira, reusando um caminho já testado.

Custo aceito e explicitado: não é atômico. Se o fechamento passar e a transferência falhar, o caixa fica
fechado sem a transferência — situação recuperável lançando a transferência à mão, e o erro é mostrado ao
usuário em vez de silencioso. Fechar o caixa é a operação crítica; a transferência é um lançamento que
pode ser refeito.

O valor padrão da transferência é o **saldo conferido** (`countedBalance`), que é o dinheiro do dia.
