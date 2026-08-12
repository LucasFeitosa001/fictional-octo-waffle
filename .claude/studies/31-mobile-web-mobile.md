# Estudo 31 — Levar as mudanças do web para o app NATIVO (apps/mobile)

Frente A = `apps/mobile/**` (React Native / Expo). Frente B (`apps/web/**`) é de outro
agente — nada aqui toca no web.

Das 6 mudanças feitas no web, só a **3 (foto do cliente / avatarUrl)** e um efeito
colateral da **6 (profissional inativo)** têm destino real no nativo. As demais
(1 drawer fullscreen, 2 coluna do cliente, 4 DatePicker, 5 filtros de Transações)
não têm tela equivalente — evidência de cada uma na seção "Não se aplica".

---

## Arquivos que este estudo autoriza editar

1. `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/components/PersonAvatar.tsx` (novo)
2. `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/clientes.tsx`
3. `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/agenda.tsx`
4. `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/configuracoes.tsx`
5. `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/index.tsx`

---

## 1. `apps/mobile/components/PersonAvatar.tsx` (NOVO)

Espelha o `CustomerAvatar` do web: foto → iniciais → ícone de pessoa.

Evidência do original no web:
- `apps/web/src/components/CustomerPickerDrawer.tsx:23` — comentário
  `/** Circular avatar: photo when available, initials fallback otherwise. */`
- `apps/web/src/components/CustomerPickerDrawer.tsx:24-49` — `export function CustomerAvatar`
  com a cadeia `avatarUrl ? <img> : label && label !== '?' ? label : <IconUser>`

Evidência de que o `heroui-native` já suporta a cadeia sem gambiarra:
- `node_modules/.pnpm/heroui-native@1.0.4_e27e72187b56f39379647be6e68560f0/node_modules/heroui-native/lib/typescript/src/components/avatar/avatar.types.d.ts:140`
  — `AvatarFallbackProps.iconProps?: PersonIconProps` → `Avatar.Fallback` **sem children**
  já desenha o ícone de pessoa padrão. Logo: `Avatar.Image` (foto) +
  `Avatar.Fallback>{iniciais}` ou `Avatar.Fallback` vazio (ícone).
- mesmo arquivo `:12` — `export type AvatarSize = 'sm' | 'md' | 'lg';`
- mesmo arquivo `:20` — `export type AvatarColor = 'accent' | 'default' | ...`

Evidência de que o padrão `Avatar.Image` + `Avatar.Fallback` já é usado e compila
hoje no app (é o que vou extrair):
- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/profissionais.tsx:54-59`

Evidência de que `initials()` existe no nativo e é repetido tela a tela:
- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/lib/format.ts:54` — `export function initials(name: string): string`
- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/clientes.tsx:7` (import) e `:75` (uso)
- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/configuracoes.tsx:7` (import) e `:60` (uso)
- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/profissionais.tsx:7` (import) e `:58` (uso)

## 2. `apps/mobile/app/(drawer)/clientes.tsx` — foto na lista de clientes

- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/clientes.tsx:74-76`
  desenha só `<Avatar size="md" color="accent"><Avatar.Fallback>{initials(item.name)}</Avatar.Fallback></Avatar>`,
  sem `Avatar.Image` — é exatamente a "inicial no lugar da foto" que o web já corrigiu.
- O dado existe no tipo: `/home/lucssfeitosa/beautypass/beautypass/packages/shared/src/types.ts:63`
  — `avatarUrl?: string | null;` dentro de `interface Customer` (declarado em `:59-62` com
  comentário explicando que a API sempre devolveu a coluna).
- O dado existe no payload: `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/customers/customers.service.ts:47`
  usa `include: { tags: true, debts: {...} }` — `include` (não `select`), portanto **todos os
  escalares** do Customer, inclusive `avatarUrl`, vêm em `GET /customers`.
- A tela consome esse endpoint em `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/clientes.tsx:19-22`
  (`useFetch<Paginated<Customer>>('/customers', ...)`).

## 3. `apps/mobile/app/(drawer)/agenda.tsx` — foto do cliente no card do agendamento

- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/agenda.tsx:104-111`
  — o bloco central do card mostra só `item.customer?.name` e `item.professional?.name`,
  nenhum avatar.
- O objeto Customer completo já chega: `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/appointments/appointments.service.ts:109`
  — `include: { customer: true, professional: true, items: true }`.
- E já está tipado localmente: `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/agenda.tsx:18-21`
  — `interface AppointmentWithRelations extends Appointment { customer?: Customer | null; ... }`.

## 4. `apps/mobile/app/(drawer)/configuracoes.tsx` — foto do usuário logado

- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/configuracoes.tsx:59-61`
  — `<Avatar size="md" color="accent"><Avatar.Fallback>{initials(user?.name ?? 'Usuário')}</Avatar.Fallback></Avatar>`,
  sem `Avatar.Image`.
- **Correção da hipótese inicial:** o campo NÃO é `avatarUrl`. O `user` do contexto
  do nativo é um `BetterAuthUser`, não o `AuthUser` de `types.ts:24-32`:
  - `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/lib/auth-context.tsx:23`
    — `user: BetterAuthUser | null;`
  - `/home/lucssfeitosa/beautypass/beautypass/packages/shared/src/auth.ts:38-50`
    — `interface BetterAuthUser` tem `image?: string | null` (`:43`) e **não** tem `avatarUrl`.
  - `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/auth/better-auth.ts:158-166`
    — `additionalFields` expõe companyId/phone/provider/active/accountType; `avatarUrl`
    não está lá, então a sessão nunca devolve esse campo (a coluna existe em
    `packages/db/prisma/schema.prisma:329,332`, mas quem viaja na sessão é `image`).
  - O web usa exatamente `image` para o usuário logado:
    `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/MinhaContaDrawer.tsx:129`
    (`setAvatarUrl(user?.image ?? null)`) e `:178` (`api.post('/auth/update-user', { image: url })`).
  → no nativo, passar `user?.image` para o avatar.
- `user` vem do contexto em `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/configuracoes.tsx:11`.

## 5. `apps/mobile/app/(drawer)/index.tsx` — contador de Profissionais do Painel

Efeito colateral da mudança 6 (endpoint passou a devolver só ativos por padrão).

- `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/index.tsx:38`
  — `const professionals = useFetch<Paginated<unknown>>('/professionals', { pageSize: 1 });`
  (sem `active`), e `:121-125` exibe `professionals.data?.total` no bloco "Cadastros".
- `/home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/professionals/professionals.controller.ts:45-51`
  — sem `active` o status vira `'active'`. Ou seja, o total mudou de significado
  silenciosamente (antes: todos; agora: só ativos).
- Diverge da tela irmã: `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/profissionais.tsx:23-26`
  pede `active: 'all'` e lista os inativos junto — dois números diferentes para
  "Profissionais" dentro do mesmo app.

**Decisão:** passar `active: 'all'` no Painel. O bloco se chama "Cadastros"
(`index.tsx:112-114`) e conta cadastros, não ativos — igual à linha "Clientes"
(`index.tsx:115-119`), que usa `/customers` sem filtro de ativo. Isso restaura o
significado que o número tinha antes da mudança 6 e faz bater com a tela de
Profissionais, sem inventar texto novo de UI.

- `active: 'all'` é aceito pela assinatura do hook:
  `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/lib/use-fetch.ts:14-16`
  — `query?: Record<string, string | number | boolean | undefined>`.

---

## Regras de mobile — por que NÃO se aplicam aqui

As 4 regras do projeto (sem Card creme em lista mobile, drawer sobe de baixo,
padding só do layout, animação de dropdown) valem para o **web em tela pequena**
(frente B), não para o nativo:
- O `<Card>` do `heroui-native` já é o padrão de lista deste app —
  `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/profissionais.tsx:51`,
  `.../clientes.tsx:71`, `.../agenda.tsx:93`. Nenhuma edição minha muda a estrutura
  da lista, só o conteúdo do avatar.
- Padding vem do `contentContainerClassName="p-4 gap-3"` do próprio FlatList
  (`clientes.tsx:56`, `agenda.tsx:82`) — não mexo.
- Nenhum drawer/dropdown novo é criado.

---

## Não se aplica (sem arquivo a editar)

**1 — Drawer de registro em tela cheia.** Não existe drawer lateral de registro no
nativo. O único modal do app é
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/components/NewAppointmentModal.tsx:162-166`
(`RNModal animationType="slide" presentationStyle="pageSheet"`), que no nativo **já
sobe de baixo**. Não há prop `fullscreen`/`widthClass` a portar.

**2 — Coluna do cliente (Pacotes / Assinaturas / Anotações).** Não há onde encaixar:
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/clientes.tsx:70-99`
— o `renderItem` é um `<Card>` puro, sem `Pressable`/`onPress`, logo não existe tela
de detalhe de cliente no app admin. E
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/comandas.tsx:82-105`
é lista somente-leitura, não há `ComandaDrawer` no nativo.

**4 — DatePicker.** Todos os seletores de data do nativo são chevron ±1 dia, sem
popover: `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/agenda.tsx:46-71`
e `/home/lucssfeitosa/beautypass/beautypass/apps/mobile/components/NewAppointmentModal.tsx:110-122`.
Já em paridade com o formato novo do web:
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/index.tsx:26` usa
`toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })` → "julho de 2026".

**5 — Filtros de Transações.** Não existe módulo financeiro no nativo:
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/_layout.tsx:17-24`
lista os 8 módulos do menu e nenhum é financeiro.

**6 — Profissional inativo (parte HTTP).** Já aplicada:
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/app/(drawer)/profissionais.tsx:21-26`
manda `active: 'all'` (gestão) e
`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/components/NewAppointmentModal.tsx:67-70`
usa o padrão (só ativos), que é o comportamento desejado no seletor. Os usos em
`apps/mobile/app/staff-login.tsx:16` e `apps/mobile/app/(tabs)/*` são
`repos.professionals` do `@silvia/core` sobre AsyncStorage
(`/home/lucssfeitosa/beautypass/beautypass/apps/mobile/lib/silvia.ts:16-22`), não HTTP —
não tocar.
