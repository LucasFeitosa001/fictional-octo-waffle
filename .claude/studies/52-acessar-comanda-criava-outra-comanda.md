# Estudo 52 — "Acessar comanda" criava uma comanda nova a cada clique

Relato do dono: *"toda vez que eu clico em acessar comanda, ele cria uma nova, ajeite esse erro
crítico"*.

## O defeito

`apps/web/src/pages/AgendaPage.tsx:1644`-`:1648` — o botão do drawer do agendamento:

```tsx
<Button variant="primary" isDisabled={createOrder.isPending}
  onClick={() => createComanda(selected)}>
  Acessar comanda
</Button>
```

e `AgendaPage.tsx:614`-`:637`:

```tsx
async function createComanda(a: AppointmentRow) {
  ...
  const order = await createOrder.mutateAsync({ ... });   // SEMPRE cria
  setSelected(null);
  setComandaOrder(order);
}
```

Não há nenhuma checagem de "este agendamento já tem comanda". O botão diz **Acessar** e faz
**Criar**: abrir o agendamento e clicar duas vezes gera duas comandas, cada uma com os itens do
agendamento repetidos.

`isDisabled={createOrder.isPending}` só protege o clique duplo DURANTE a requisição — reabrir o
agendamento e clicar de novo cria outra.

## Por que não dava para "só verificar antes"

Não existe vínculo entre agendamento e comanda no schema. Em
`packages/db/prisma/schema.prisma`, `model Order` (`:1251`) não tem `appointmentId`, e
`model Appointment` (a partir de `:1160`) não tem `orderId` — `grep -n appointmentId` só devolve
`AppointmentItem`, `AppointmentStatusHistory` e `AppointmentNotification`.

Sem esse campo, "já existe comanda deste agendamento?" só poderia ser adivinhado por
cliente+dia+status, que erra quando a pessoa tem duas comandas no mesmo dia — exatamente o cenário
de um salão movimentado.

## Correção

1. **Schema (aditivo)**: `Order.appointmentId String? @unique` com relação para `Appointment`
   (`onDelete: SetNull` — apagar o agendamento não pode apagar a comanda, que é documento fiscal).
   O índice único é o que garante, no BANCO, uma comanda por agendamento: dois cliques simultâneos
   de dois aparelhos não furam a regra.
2. **API**: `POST /orders` aceita `appointmentId`. Dentro da transação (já existe um
   `pg_advisory_xact_lock` por empresa em `orders.service.ts:245`), se já houver comanda não
   cancelada para aquele agendamento, **devolve a existente** em vez de criar outra.
3. **Web**: `createComanda` manda `appointmentId`; como a API devolve a comanda existente, o mesmo
   botão passa a ABRIR o que já existe — o nome dele finalmente descreve o que ele faz.

A migração é aditiva (coluna nova nullable). Não altera nada do que já está gravado.

## Arquivos tocados

- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/orders/dto.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/web/src/lib/types.ts` (`CreateOrderBody.appointmentId`)
- `apps/web/src/pages/AgendaPage.tsx`
