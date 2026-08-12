# Estudo 22 — Blocos laterais do cliente (Pacotes / Assinaturas / Anotações)

Objetivo: **um** componente compartilhado, `apps/web/src/components/ClienteBlocosLaterais.tsx`,
para as 4 superfícies que no Belasis mostram a mesma coluna do cliente — agendamento, comanda,
pacote e (só de passagem) financeiro. Hoje isso não existe em lugar nenhum e a alternativa seria
4 cópias divergentes.

Arquivo a **criar**: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ClienteBlocosLaterais.tsx`
(arquivo novo — nenhum arquivo existente é editado neste lote; a ligação nas 4 telas é dos
próximos agentes).

## 1. Evidência no vídeo (quadros lidos, não deduzidos)

`scratchpad/video-fin/f_0062.jpg` — drawer **Visualizando agendamento** (`belasis.app/calendar`),
coluna esquerda, de cima para baixo: avatar, `ISABEL DE LIMA GODER`, telefone + pílula verde
`Conversar`, e então:

| Bloco | Conteúdo no quadro | `+ Adicionar`? |
|---|---|---|
| **Informações** | 5 linhas lilás com ícone: `Aniversário em 11, julho` · `R$ 0,00 em cashback` · `R$ 0,00 em crédito` · `0 comandas em aberto` · `0 pagamentos em aberto` | não |
| **Pacotes** | `Não há pacotes disponíveis` | **não** |
| **Assinaturas** | `Não há assinaturas disponíveis` | **não** |
| **Anotações** | `Nenhuma anotação encontrada` | **sim** |

`f_0090.jpg` — drawer **Visualizando comanda #3324** (`belasis.app/sales`), mesma coluna, mesmos
textos, mas agora **os três** blocos (Pacotes, Assinaturas, Anotações) têm `+ Adicionar`.

`f_0148.jpg` — drawer **Visualizando pacote #9** (`belasis.app/packages`), cliente `BRUNA`:
**não existe bloco Assinaturas** nesta superfície; `Pacotes` **não** tem `+ Adicionar`; e é o
**único quadro do vídeo inteiro com o bloco Pacotes preenchido** — ele não vira lista, vira UMA
linha de contagem, azul, com ícone de grade: **`1 pacote não consumido`**. (O item do pacote da
BRUNA está em Saldo 1 / Qtde 3 — ou seja, "não consumido" = ainda tem sessão sobrando, não =
intocado.) `Anotações` tem `+ Adicionar`.

`f_0153.jpg` — drawer **Novo pacote** sem cliente escolhido: avatar placeholder + `Busque por um
cliente` e **nenhum dos blocos**. Ou seja: sem cliente vinculado, a coluna não renderiza os blocos.

Financeiro (`zoom/novo-recebimento.jpg`, `zoom/novo-vale.jpg`, `zoom/nova-transferencia.jpg`,
`f_0204/f_0211/f_0219/f_0226`): os drawers de lançamento **não têm coluna esquerda nenhuma**. Os
blocos aparecem em `/finance/transactions` só quando se abre o drawer da comanda pelo link
`C#3322` da coluna Origem (`f_0245`) — é a superfície COMANDA, não a financeiro.

**O que o vídeo NUNCA mostra** (portanto não vou desenhar): o estado preenchido de Assinaturas;
o estado preenchido de Anotações; o que o `+ Adicionar` abre em qualquer um dos três; e nenhuma
lista de pacotes item a item dentro desta coluna.

Divergência assumida de propósito: no Belasis o título do bloco é preto/bold ~15px, **não** é
caixa alta. Vou usar a classe que já é o padrão de título de seção dos nossos drawers
(`AgendaPage.tsx:1697`), a pedido da tarefa — está registrado aqui para não parecer descuido.

## 2. O que já existe no nosso código (lido, com linha)

### Estilo a copiar (não inventar classe)
- `apps/web/src/pages/AgendaPage.tsx:1697` —
  `<h3 className="text-xs font-semibold uppercase tracking-wide text-muted-ink">Serviços</h3>`
  é o título de seção da coluna do drawer de agendamento. É essa classe que os blocos usam.
- `apps/web/src/pages/AgendaPage.tsx:1635` — o `<aside className="flex shrink-0 flex-col gap-3
  lg:w-[300px]">` já dá `gap-3` entre filhos: o componente **não** deve por margem própria.
- `apps/web/src/pages/AgendaPage.tsx:1701` — card de item da coluna:
  `flex items-start gap-3 rounded-lg border border-line bg-white p-3`.
- `apps/web/src/pages/FornecedoresPage.tsx:456` — link pequeno já usado no projeto:
  `className="text-xs font-medium text-primary hover:underline"`. É o `+ Adicionar`.
- Tokens conferidos em `apps/web/src/index.css:35` (`--color-muted-ink`), `:36` (`--color-line`),
  `:21` (`--color-primary`) — as classes acima existem nos 7 temas, não são hardcode.
- Ícones: `apps/web/src/components/icons.tsx:114` `IconPlus`, `:128` `IconLayers`. Não existe
  `IconGrid`; `IconLayers` já é o ícone de pacote do projeto
  (`apps/web/src/pages/ClientePerfilTabs.tsx:1686`).

### Dados — PACOTES: pronto, sem backend novo
- Hook: `apps/web/src/lib/queries/clientes.ts:348` `useCustomerPackages(id)` →
  `GET /customers/:id/packages`, `enabled: Boolean(id)` em `:352` (dá para desligar a query
  passando `null`, sem quebrar regra de hooks).
- Endpoint: `apps/api/src/modules/customers/customers.controller.ts:159`, permissão
  `clientes:view|clientes:manage` (`:160`) — **sem** feature flag. Serviço em
  `apps/api/src/modules/customers/customers.service.ts:525`-`:535`, filtra `companyId + customerId`
  e inclui `template` e `items.service`.
- Tipo: `apps/web/src/lib/queries/clientes.ts:103`-`:117` `CustomerPackageView`, com
  `items[].sessionsTotal` (`:113`) e `items[].sessionsUsed` (`:114`) — é daí que sai
  "não consumido".
- **ARMADILHA**: existe um segundo `useCustomerPackages` em
  `apps/web/src/lib/queries/pacotes.ts:134`, mesmo nome, queryKey colidindo
  (`['customer-packages', id]` em `clientes.ts:350` vs `['customer-packages', filters]` em
  `pacotes.ts:136`) e **shape de resposta diferente**. Este componente importa o de `clientes.ts`
  porque o de `pacotes.ts` exige `catalogo:view` — recepção/caixa tomaria 403 dentro da comanda.

### Dados — ANOTAÇÕES: pronto, leitura e escrita
- `apps/web/src/lib/queries/clientes.ts:357` `useCustomerNotes(id)` → `GET /customers/:id/notes`
  (`customers.controller.ts:165`, serviço `customers.service.ts:539`).
- Tipo `CustomerNoteView` em `clientes.ts:119`-`:124` (`text`, `createdAt`, `author`).
- Criação existe (`clientes.ts:366` `useCreateNote` → `customers.controller.ts:188`, exige
  `clientes:manage`), mas **fica fora deste componente**: o `+ Adicionar` é só um callback, quem
  decide o que abrir é a superfície. UI de referência do formulário:
  `apps/web/src/pages/ClientePerfilTabs.tsx:1747`-`:1818`.

### Dados — ASSINATURAS POR CLIENTE: NÃO EXISTE (gap real de backend)
- `apps/web/src/lib/queries/assinaturas.ts:174` `useCustomerMemberships(status?)` só aceita
  `status`.
- `apps/api/src/modules/memberships/memberships.controller.ts:67` `GET /customer-memberships` só
  lê `@Query('status')` (`:71`), e ainda está atrás de `catalogo:view|catalogo:manage` (`:68`).
- `apps/api/src/modules/memberships/memberships.service.ts:101`-`:102` monta
  `const where: Prisma.CustomerMembershipWhereInput = { companyId }` + status. Sem `customerId`.
- O model tem o campo (`CustomerMembership.customerId`, tipado em `assinaturas.ts:88`) — falta só
  passar o filtro ponta a ponta.
- **Decisão**: o bloco Assinaturas renderiza SEMPRE o estado vazio do vídeo
  (`Não há assinaturas disponíveis`). Não vou baixar a lista de assinantes da empresa inteira para
  filtrar no cliente (custo + 403 para quem não tem `catalogo:view`), e não vou criar endpoint
  neste lote. Quando `customerId` entrar no controller/serviço/hook, é só trocar a constante `[]`
  pelo hook — o resto do bloco já está pronto.

### O que eu confirmei que NÃO existe hoje no web
- `grep -rn "Não há pacotes disponíveis\|Não há assinaturas disponíveis\|Nenhuma anotação
  encontrada" apps/web/src` → zero. Nenhum dos três textos do vídeo existe.
- `grep -rn "Pacotes\|Assinaturas\|Anotaç" apps/web/src/components/ComandaDrawer.tsx` → zero; o
  `OrderCustomerCard` (`ComandaDrawer.tsx:508`-`:563`) para nos dois botões Conversar/Ver cliente
  (`:551`, `:558`).
- Em `apps/web/src/pages/AgendaPage.tsx` a `<aside>` (`:1635`-`:1678`) tem UM filho só, o cartão de
  perfil — nada abaixo dele.

## 3. Decisões de renderização (e por quê)

1. **Sem `customerId` → o componente devolve `null`.** Evidência: `f_0153.jpg`, o "Novo pacote" sem
   cliente não mostra bloco nenhum. Também evita disparar query com id vazio.
2. **Pacotes preenchido = linha de contagem, não lista.** É literalmente o único formato que o
   vídeo mostra (`f_0148.jpg`: `1 pacote não consumido`). Inventar uma lista item a item aqui seria
   UI que o Belasis não tem. "Não consumido" = pacote com pelo menos uma sessão sobrando
   (`sessionsUsed < sessionsTotal`), derivado de `CustomerPackageView.items`.
3. **Anotações preenchido = lista curta** (texto + data · autor). O vídeo nunca mostra, mas anotação
   é texto: contagem não serviria. Fica o mínimo, no mesmo dado que `AnotacoesTab` já exibe
   (`ClientePerfilTabs.tsx:1807`-`:1810`).
4. **Erro de request é tratado como vazio**, não como tela de erro. Motivo concreto: um usuário sem
   `clientes:view` toma 403 em `/customers/:id/notes` e o certo é a coluna degradar para o texto
   vazio, não estourar `ErrorState` dentro de um drawer de comanda.
5. **`+ Adicionar` só aparece se vier callback** — nada de botão morto (regra da tarefa, e é o que
   diferencia agendamento de comanda no próprio vídeo: mesmos blocos, `+ Adicionar` diferente).
6. **Blocos opcionais e ordenados por prop** — `blocos={['pacotes','anotacoes']}` é exatamente o
   caso do drawer de pacote (`f_0148.jpg`, sem Assinaturas).

## 4. Fora de escopo (declarado)

- O bloco **Informações** (5 linhas fixas) NÃO entra aqui: não tem lista, nem estado vazio, nem
  `+ Adicionar`, e duas das 5 linhas (`N comandas em aberto`, `N pagamentos em aberto`) não têm
  contador em endpoint nenhum — `apps/api/src/modules/customers/customers.service.ts:295`-`:305`
  devolve `debitosTotal` (SOMA em R$) e `pacotesEmAberto`, não contagem de comandas abertas nem de
  débitos abertos. É outro componente/outro lote.
- Ligar o componente nas 4 telas: próximos agentes (pontos de inserção já mapeados —
  `AgendaPage.tsx:1678`, `ComandaDrawer.tsx:357`, `PacotePerfilModal.tsx:199`,
  `PacotesPage.tsx:1308`).

## 5. Validação

`pnpm -C apps/web exec tsc --noEmit -p tsconfig.json` (o tsconfig tem `noUnusedLocals` e
`noUnusedParameters` ligados — import sobrando quebra o build).
