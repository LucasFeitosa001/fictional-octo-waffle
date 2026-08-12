# Estudo 23 — A foto do cliente não aparece nos drawers de agendamento

Vídeo: `/mnt/c/Users/Usuario/Videos/NVIDIA/Desktop/Desktop 2026.07.27 - 19.35.13.03.mp4` (8s, 17
quadros a 2fps em `scratchpad/video-foto/g_*.jpg`, recortes em `z-picker.jpg` e `z-drawer.jpg`).

**É o NOSSO app** (`app.salonpass.com.br/agenda`), não o Belasis. O dono perguntou: *"era para
amostra a foto? quando o usuario já tem uma foto de perfil tipo o Paulo"*.

## A inconsistência, no mesmo cliente

Cliente **Paulo**, telefone `+1 (918) 238-4714`, nos dois recortes:

- `z-picker.jpg` — drawer **"Selecionar cliente"**: Paulo aparece com a **FOTO real**. Daniel mostra
  "D" e Paulo de Tasso mostra "PT" (iniciais), então o componente sabe alternar foto × iniciais.
- `z-drawer.jpg` — drawer **"Visualizando agendamento"**: o mesmo Paulo vira um **círculo salmão com
  a letra P**.

Ou seja: a foto existe no banco e chega em algum lugar — some só nesses drawers. Sim, era para
mostrar a foto.

## O componente certo já existe e já resolve isso

`apps/web/src/components/CustomerPickerDrawer.tsx:24`-`:50` exporta **`CustomerAvatar`**, que faz
exatamente a cascata desejada (`:40`-`:46`): `avatarUrl` → `<img>`; senão iniciais; senão
`IconUser`. Aceita `size`.

Já é usado por `ComandaDrawer.tsx`, `ComandasPage.tsx`, `PacotesPage.tsx` e pelo próprio picker
(`NewAppointmentModal.tsx:1264`).

## Defeito 1 — "Visualizando agendamento" desenha a inicial na mão

`apps/web/src/pages/AgendaPage.tsx:1637`-`:1641`:
```tsx
<div className="grid h-24 w-24 shrink-0 place-items-center rounded-full text-2xl font-semibold text-white"
  style={{ backgroundColor: eventColor(selected) }}
  aria-hidden>
  {(selected.customer?.name ?? 'A').trim().charAt(0).toUpperCase()}
</div>
```
Nunca lê `avatarUrl`. É o **único** lugar do web que ainda desenha a inicial do cliente à mão — um
`grep -rn "charAt(0)"` em `apps/web/src` só devolve este caso (os outros hits são o nome do usuário
logado na Sidebar/Minha conta e formatação de mês).

**O dado está disponível:** `apps/api/src/modules/appointments/appointments.service.ts:109` faz
`include: { customer: true, ... }` — o registro INTEIRO do cliente, e `Customer.avatarUrl` existe
(`packages/db/prisma/schema.prisma`, model Customer). Nada a mudar no backend.

## Defeito 2 — "Novo agendamento" mostra um boneco fixo

`apps/web/src/components/NewAppointmentModal.tsx:640`-`:642`:
```tsx
<div className="grid h-[120px] w-[120px] place-items-center rounded-full bg-cream text-primary/70">
  <UserGlyph />
</div>
```
`UserGlyph` (`:177`) é um SVG **estático**. Esse círculo não muda nem depois de escolher o cliente —
por isso o vídeo mostra o boneco genérico com "Paulo" escrito logo abaixo, no quadro seguinte ao da
seleção.

O nome do escolhido já é resolvido em `:388`-`:389`:
```ts
const selectedCustomerName =
  selectedCustomer?.name ?? customerItems.find((c) => c.id === customerId)?.name;
```
`customerItems` vem de `useCustomers(customerSearch)` (`:269`, `:281`) — a mesma lista que o picker
usa para desenhar a foto em `:1264`, logo **carrega `avatarUrl`**. Basta resolver o avatar pelo mesmo
caminho do nome.

Cuidado: `selectedCustomer` (o objeto do picker) pode não ter `avatarUrl` no tipo; e depois de trocar
a busca, `customerItems` pode não conter mais o cliente escolhido. O fallback tem que aguentar
`undefined` sem quebrar — a cascata do `CustomerAvatar` já cobre isso.

## Correção

Trocar os dois blocos por `<CustomerAvatar>` com o tamanho atual (96px na Agenda, 120px no Novo
agendamento), preservando o círculo colorido por status como fundo apenas quando não houver foto —
a cor de status é informação útil e o vídeo a mostra.

## Defeito 3 (descoberto ao corrigir) — o tipo compartilhado esconde o campo

`packages/shared/src/types.ts` declara `interface Customer` com id, companyId, name, nickname,
phone, email, cpf e active — **sem `avatarUrl`**, embora a API devolva (o model `Customer` do Prisma
tem a coluna e `appointments.service.ts:109` faz `include: { customer: true }`).

Por isso `CustomerPickerDrawer.tsx:21` precisou de uma gambiarra local:
```ts
type CustomerListItem = Customer & { avatarUrl?: string | null };
```
e `apps/web/src/lib/types.ts:11`-`:14` faz o mesmo remendo para `Professional`, com o comentário
"API returns avatarUrl + birthday on professionals; extend the shared type" — ou seja, o problema já
era conhecido e nunca foi resolvido na raiz.

Corrigir no tipo compartilhado (campo **opcional**, portanto aditivo e sem quebrar api/web/mobile) é
melhor do que espalhar mais uma coercção `as`: sem isso, todo consumidor novo repete o remendo.

## Arquivos tocados

- `packages/shared/src/types.ts` (acrescenta `avatarUrl?` em `Customer`)
- `apps/web/src/pages/AgendaPage.tsx`
- `apps/web/src/components/NewAppointmentModal.tsx`
