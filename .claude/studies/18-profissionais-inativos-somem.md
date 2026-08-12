# Estudo 18 — Profissional inativo deve sumir de todo seletor

Pedido do dono: *"faça os que estão desativados não aparecer ativos quando voce tenta criar um
agendamento ou qualquer outra coisa que aparece o nome do profissional desativado, ele é para sumir
quando estar Inativos"*.

Contexto: o `remove()` de profissional é **soft-delete** (`deletedAt`), e além disso existe o flag
`active` (aba Ativos/Inativos na tela de Profissionais). Os 6 profissionais da Fátima que foram
"excluídos" viraram `active: false` (tratados como desativados, não excluídos). Hoje eles **continuam
aparecendo** em todos os seletores.

## Causa raiz — uma única fonte, sem filtro

`apps/api/src/modules/professionals/professionals.service.ts:16`:
```ts
const where = { companyId, deletedAt: null };
```
Filtra só o soft-delete. **`active` não entra na consulta.** O controller
(`apps/api/src/modules/professionals/professionals.controller.ts:37`-`:43`) só repassa `page`/`pageSize`,
sem nenhum parâmetro de status.

O front tem **um único hook** para essa rota — `apps/web/src/lib/queries.ts:134`
(`useProfessionals`) — consumido por **15 telas**. Ou seja, o defeito é de origem: qualquer lugar que
liste profissional herda a lista com os inativos dentro.

## Inventário dos 15 consumidores (verificado um a um)

Seletor de trabalho novo → **só ativos**:

| Arquivo:linha | O que é |
|---|---|
| `apps/web/src/components/NewAppointmentModal.tsx:268` | criar agendamento (o caso do pedido) |
| `apps/web/src/components/ComandaDrawer.tsx:175` | itens da comanda |
| `apps/web/src/components/ValeModal.tsx:33` | vale/adiantamento |
| `apps/web/src/pages/ComandasPage.tsx:1112` | nova comanda — `<select>` "Profissional" em `:1317` e `EditItemDrawer` em `:1259` |
| `apps/web/src/pages/ComandasPage.tsx:1653` | `ItemEditDrawer` em `:1856` |
| `apps/web/src/pages/ComandaDetalhePage.tsx:321` | editor de item |
| `apps/web/src/pages/ComandaDetalhePage.tsx:425` | adicionar item |
| `apps/web/src/pages/AgendaPage.tsx:303` | colunas da agenda + criação |
| `apps/web/src/pages/PacotesPage.tsx:1175` | vendedor do pacote |
| `apps/web/src/pages/financeiro/TransacoesPage.tsx:1293` | despesa → "Pago para: Profissional" |
| `apps/web/src/pages/cadastros/ConvidarProfissionaisPage.tsx:30` | convite de acesso |
| `apps/web/src/pages/ConfiguracoesPage.tsx:794` | toggles de notificação por profissional (`:1474`) |
| `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx:214` | filtro (só monta options) |
| `apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx:23` | filtro abriu/fechou (só monta options) |

Precisa da lista **completa** (resolve nome de registro histórico ou é tela de gestão):

| Arquivo:linha | Por quê |
|---|---|
| `apps/web/src/pages/ProfissionaisPage.tsx:96` | é a gestão; filtra client-side em `:111`-`:112` com as abas `Ativos`/`Inativos` (`:88`-`:89`) |
| `apps/web/src/pages/metas/MetasPage.tsx:124` | `profName` em `:129`-`:133` rotula metas antigas (`:365`, `:411`). Se sumir da lista, a meta exibe rótulo errado. As **options** (`:290`, `:450`) sim filtram ativos |
| `apps/mobile/app/(drawer)/profissionais.tsx:21` | gestão no mobile |
| `apps/web-admin/src/lib/queries.ts:152` | tem CRUD de profissional (gestão) |

`apps/mobile/components/NewAppointmentModal.tsx:67` e `apps/mobile/app/(drawer)/index.tsx:38` (KPI de
contagem) ficam com o padrão novo — só ativos — que é o comportamento desejado nos dois.

## Decisão de default: fail-closed

`list()` passa a filtrar **`active: true` por padrão**, e quem precisa dos inativos pede
explicitamente (`?active=all`). Assim qualquer tela nova ou que eu tenha deixado passar já nasce
correta — o inverso (default = tudo) esconderia o defeito de novo.

## Backend também precisa recusar, não só esconder

Esconder do `<select>` não impede uma chamada direta nem um formulário com estado velho. Os pontos que
aceitam profissional hoje checam empresa/soft-delete mas **não checam `active`**:

- `apps/api/src/modules/appointments/appointments.service.ts:1020`-`:1026` `assertProfessionalExists`
  — usado em `create` (`:176`), `createSeries` (`:306`, `:317`), `block` (`:471`), `update` (`:516`).
- `apps/api/src/modules/orders/orders.service.ts:59`-`:69` `assertProfessionalOfCompany` — usado em
  `addItem` (`:300`) e `updateItem` (`:362`).
- `apps/api/src/modules/orders/orders.service.ts:254`-`:256` — o `create` da comanda conta os
  profissionais **sem `deletedAt: null` e sem `active`** (aceita até profissional excluído).
- `apps/api/src/modules/appointments/appointments.service.ts:853` — a disponibilidade lê os horários
  com `professional: { deletedAt: null }`, sem `active`.
- `apps/api/src/modules/dashboard/dashboard.service.ts:72`-`:79` — busca `{ companyId, deletedAt: null }`
  e usa o resultado em DOIS papéis: mapa de nomes em `:164`-`:166` (rotula venda antiga, precisa do
  inativo) e ranking de **ocupação de agenda** em `:284` (não pode listar inativo, senão entra uma
  linha 0% de quem não atende mais). Correção: manter a consulta trazendo todos, selecionar também
  `active`, e filtrar só no ponto de uso `:284`.

**Cuidado com edição de registro antigo:** se o profissional foi desativado *depois*, reeditar um
agendamento/item que já é dele não pode quebrar. Por isso a exigência de `active` só vale quando o
valor **muda**:
- `appointments.update` (`:516`): exigir ativo só se `dto.professionalId !== current.professionalId`
  (`current` já carregado em `:511`).
- `orders.updateItem` (`:362`): mesma regra contra `item.professionalId` — exige mover o assert para
  **depois** do `loadItem` de `:363`.

## Consequência que o dono precisa saber

Nos filtros de histórico (Comissões `:214`, Histórico de caixa `:23`) o profissional inativo deixa de
ser listado, então não dá mais para filtrar o passado por ele. Os **nomes continuam aparecendo**
normalmente nas linhas, porque vêm do próprio registro, não dessa lista. Se ele quiser o inativo de
volta nesses dois filtros, é trocar o default nessas duas telas.

## Referência do padrão que já está certo

`apps/api/src/modules/public-booking/public-booking.service.ts:419`-`:427` e `:470` já filtram
`active: true, deletedAt: null`. O agendamento online, portanto, **já** esconde inativo — é só o
painel interno que não.
