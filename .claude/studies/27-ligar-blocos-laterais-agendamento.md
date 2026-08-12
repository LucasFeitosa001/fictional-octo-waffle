# Estudo 27 — Ligar `ClienteBlocosLaterais` na superfície AGENDAMENTO

Superfície: drawer **Visualizando agendamento** (`apps/web/src/pages/AgendaPage.tsx`) e drawer
**Novo agendamento** (`apps/web/src/components/NewAppointmentModal.tsx`).

Componente já pronto (outro lote): `apps/web/src/components/ClienteBlocosLaterais.tsx`
(estudo `.claude/studies/22-blocos-laterais-cliente.md`).

## 1. Evidência no vídeo (quadros lidos agora, não deduzidos)

`scratchpad/video-fin/f_0062.jpg` — `belasis.app/calendar`, drawer **Visualizando agendamento**,
cliente `ISABEL DE LIMA GODER`. Coluna esquerda, de cima para baixo: avatar, nome, telefone +
pílula verde `Conversar`, e então **quatro** blocos:

| Bloco | Conteúdo | `+ Adicionar`? |
|---|---|---|
| Informações | 5 linhas lilás com ícone (`Aniversário em 11, julho`, `R$ 0,00 em cashback`, `R$ 0,00 em crédito`, `0 comandas em aberto`, `0 pagamentos em aberto`) | não |
| Pacotes | `Não há pacotes disponíveis` | **não** |
| Assinaturas | `Não há assinaturas disponíveis` | **não** |
| Anotações | `Nenhuma anotação encontrada` | **sim** |

`f_0090.jpg` (drawer da comanda) tem a MESMA coluna, mas com `+ Adicionar` nos três blocos. Ou
seja: no agendamento, `+ Adicionar` em Pacotes/Assinaturas **não existe** — não inventar.

O que o vídeo **não** mostra, e portanto não vou desenhar como paridade:
- o drawer **Novo agendamento** do Belasis (nenhum quadro). O que existe de mais próximo é
  `f_0153.jpg` (drawer **Novo pacote** sem cliente): a coluna esquerda de um drawer de CRIAÇÃO é a
  mesma coluna, com avatar placeholder + `Busque por um cliente`, e **sem nenhum bloco** porque não
  há cliente. Isso é exatamente o comportamento do componente (`ClienteBlocosLaterais.tsx:76`
  devolve `null` sem `customerId`), então ligar o componente lá é coerente com o padrão observado —
  mas registro que é **decisão nossa**, não paridade comprovada.
- o que o `+ Adicionar` de Anotações abre. Ver seção 4.

## 2. Como a coluna está hoje (lido, com linha)

### `apps/web/src/pages/AgendaPage.tsx`
- `apps/web/src/pages/AgendaPage.tsx:1593` — `<Drawer ... title="Visualizando agendamento"
  widthClass="sm:w-[min(1180px,94vw)]" fullscreen>`; corpo em `:1632` (`{selected && (`), layout de
  2 colunas em `:1633` (`flex ... lg:flex-row`).
- `apps/web/src/pages/AgendaPage.tsx:1635` — `<aside className="flex shrink-0 flex-col gap-3
  lg:w-[300px]">`. O `gap-3` já dá o espaçamento entre filhos: o componente **não** leva margem.
- `:1636`-`:1677` — ÚNICO filho da aside: o cartão de perfil (`rounded-2xl border border-line
  bg-white p-5 text-center`). Avatar desenhado à mão em `:1637`-`:1641` (**não tocar** — é o alvo do
  estudo 23, outro agente), nome `:1643`, telefone `:1646`, `Conversar` (wa.me) `:1652`-`:1660`,
  `Ver cliente` `:1667`-`:1675`.
- `:1678` — `</aside>`. Não há nada entre o cartão e o fechamento: **os 4 blocos do Belasis não
  existem aqui**. Confirmado por `grep -n "</aside>" apps/web/src/pages/AgendaPage.tsx` → 1 ocorrência
  (1678), e o estudo 22 (`:110`-`:117`) já tinha registrado que nenhum dos textos do vídeo existe em
  `apps/web/src`.
- `:659` — `const [notesDraft, setNotesDraft] = useState('')`; `:1785`-`:1794` — `<textarea>` da seção
  `Observação`, persistido por `persistAppointmentEdits()` (`:715`) via
  `PATCH /appointments/:id { notes }`. **É a nota DO AGENDAMENTO**, não as Anotações do cliente. As
  duas coisas convivem na mesma tela e não podem ser confundidas.
- `:660` — `const [moreMenuOpen, setMoreMenuOpen] = useState(false)`; `:671` — reset por
  agendamento selecionado (efeito com dep `selected?.id`); `:773`-`:780` — `closeDetail()` zera todos
  os estados locais do drawer. É onde entra o reset do sub-drawer novo.
- `:19` — import dos ícones; `:1`-`:26` — bloco de imports (nenhum import de `queries/clientes` hoje).

### `apps/web/src/components/NewAppointmentModal.tsx`
- `apps/web/src/components/NewAppointmentModal.tsx:592` — `<Drawer title="Novo agendamento"
  widthClass="sm:w-[min(1180px,94vw)]" fullscreen>`; corpo em `:637`.
- `:639` — `<aside className="flex shrink-0 flex-col items-center gap-4 lg:w-[190px] lg:pt-1">`.
  Filhos: círculo com `<UserGlyph />` (`:640`-`:642`, alvo do estudo 23 — **não tocar**) e o botão que
  abre o `CustomerPickerDrawer` (`:645`-`:661`). `:662` — `</aside>` (única ocorrência no arquivo).
- `:210` — `const [customerId, setCustomerId] = useState('')`; `:610` — `setCustomerId(c.id)` quando o
  picker devolve o cliente. É o id que o componente precisa.
- ARMADILHA: no modo "criar cliente novo" (`creatingNew`, `:669`) `customerId` é `''`. O componente
  faz `const id = customerId ?? null` (`ClienteBlocosLaterais.tsx:53`) e depois `if (!id) return null`
  (`:76`) — string vazia é falsy, então não renderiza e não dispara request
  (`enabled: Boolean(id)` em `clientes.ts:352` e `:361`). Mesmo assim passo `customerId || null`
  para deixar a intenção explícita.
- A aside tem `items-center`: o componente precisa de `w-full` senão os blocos encolhem para o
  tamanho do texto e ficam centralizados.

## 3. API do componente (lida em `apps/web/src/components/ClienteBlocosLaterais.tsx`)

- `:44`-`:52` — props: `customerId`, `blocos`, `onAdicionarPacote/Assinatura/Anotacao`,
  `maxAnotacoes`, `className`.
- `:59`-`:60` — busca sozinho: `useCustomerPackages` e `useCustomerNotes` de
  `apps/web/src/lib/queries/clientes.ts:348` e `:357`. O chamador **não** faz prefetch nem passa dado.
- `:64`-`:65` — erro (403 de quem não tem `clientes:view`) degrada para vazio, não estoura tela de erro.
- `:168` — `+ Adicionar` só aparece se houver callback. Logo, para reproduzir `f_0062` basta passar
  **só** `onAdicionarAnotacao`.
- `:113` — bloco Assinaturas é sempre o vazio `Não há assinaturas disponíveis` (limitação de backend
  documentada no estudo 22 `:95`-`:108`: `GET /customer-memberships` não aceita `customerId` —
  `apps/api/src/modules/memberships/memberships.controller.ts:71`,
  `apps/api/src/modules/memberships/memberships.service.ts:102`). Isso bate com o quadro `f_0062`,
  onde o bloco está vazio de qualquer forma.

## 4. O `+ Adicionar` das Anotações — decisão

O link existe no quadro (`f_0062`), mas o vídeo **nunca** mostra o que ele abre. Duas saídas
honestas: (a) não renderizar o link e divergir do quadro, ou (b) renderizar e abrir o formulário
mínimo que já existe no nosso app. Escolhi (b) e registro que o conteúdo do formulário é nosso,
não do Belasis.

- Par listar/criar já existe: `apps/web/src/lib/queries/clientes.ts:357` (`useCustomerNotes`) e
  `:366` (`useCreateNote` → `POST /customers/:id/notes`, que invalida `['customer-notes', id]` em
  `:371` — o bloco se atualiza sozinho depois de salvar).
- Backend: `apps/api/src/modules/customers/customers.controller.ts:187` `@Post(':id/notes')` com
  `@RequirePermission('clientes:manage')` em `:188`.
- UI de referência (mesma mutação, mesmo texto de botão): `AnotacoesTab` em
  `apps/web/src/pages/ClientePerfilTabs.tsx:1747`-`:1790` (valida texto vazio em `:1755`, trata
  `ApiClientError` em `:1764`, limpa o campo em `:1761`).
- Forma: sub-drawer do próprio projeto (`apps/web/src/components/Drawer.tsx:46`), empilhado com
  `zClass="z-[90]"` (`Drawer.tsx:24` documenta o padrão; `CustomerPickerDrawer.tsx:95` e
  `ItemPickerDrawer.tsx:134` já usam esse valor sobre um drawer `z-[70]`). No mobile ele sobe como
  bottom-sheet, que é a regra da casa.
- Estilo do campo: mesma classe do `<textarea>` de Observação (`AgendaPage.tsx:1792`) para não
  inventar visual novo.
- Gating: `useCan()` em `apps/web/src/lib/queries/permissions.ts:59` (fail-closed, `:64`). Sem
  `clientes:manage` o callback não é passado → o link some (`ClienteBlocosLaterais.tsx:168`) em vez
  de virar um botão que só sabe dar 403.
- No drawer **Novo agendamento** não passo callback nenhum: não há quadro, e abrir um terceiro nível
  de drawer para anotar sobre o cliente no meio da criação do agendamento seria invenção pura.

## 5. Fora deste lote (fica em pendências)

Bloco **Informações** (as 5 linhas lilás de `f_0062`). Declarado fora do escopo do componente
compartilhado no estudo 22 `:138`-`:144`, e continua fora daqui para não nascer uma cópia local que
diverge da que a comanda vai precisar (`f_0090` mostra o MESMO bloco lá). Levantamento do que
custaria, já conferido:
- aniversário/cashback/crédito: 1 request — `useCustomerPanel(id)`
  (`apps/web/src/lib/queries/clientes.ts:224` → `GET /customers/:id/panel`,
  `apps/api/src/modules/customers/customers.controller.ts:70`), que devolve `cashbackSaldo` e
  `creditosSaldo` (`apps/api/src/modules/customers/customers.service.ts:301`-`:302`) e o `customer`
  inteiro (`:296`), de onde sai `birthday` (`apps/web/src/lib/types.ts:40`).
- `N comandas em aberto` e `N pagamentos em aberto`: **não existem prontos**. O `/panel` devolve
  `debitosTotal` como SOMA em R$ (`customers.service.ts:290`-`:293`), não contagem, e não conta
  comandas abertas. Ou se derivam no front com `useCustomerOrders` (`clientes.ts:339`) +
  `useCustomerDebts` (`clientes.ts:233`) — 2 requests extras por abertura de drawer — ou se
  acrescentam dois `count` no `Promise.all` de `customers.service.ts:200`-`:247`.

## 6. Arquivos que este lote edita

1. `apps/web/src/pages/AgendaPage.tsx`
   - novo import de `ClienteBlocosLaterais`, `useCreateNote`/`useCustomerNotes` (só o create) e
     `useCan`;
   - estado `noteDrawerOpen` junto de `moreMenuOpen` (`:660`), zerado no efeito de `:671` e em
     `closeDetail()` (`:773`);
   - `<ClienteBlocosLaterais>` como irmão do cartão de perfil, antes do `</aside>` de `:1678`;
   - sub-drawer local `NovaAnotacaoDrawer` (componente novo no mesmo arquivo).
2. `apps/web/src/components/NewAppointmentModal.tsx`
   - novo import de `ClienteBlocosLaterais`;
   - `<ClienteBlocosLaterais customerId={customerId || null} className="w-full" />` antes do
     `</aside>` de `:662`, sem nenhum `+ Adicionar`.

Nenhum outro arquivo é tocado (estudo 23 mexe nas linhas do avatar dos MESMOS dois arquivos —
`AgendaPage.tsx:1637` e `NewAppointmentModal.tsx:640` — por isso as edições daqui são ancoradas no
`</aside>` e nos imports, sem encostar no bloco do avatar).

## 7. Validação

`pnpm -C apps/web exec tsc --noEmit -p tsconfig.json` (o tsconfig liga `noUnusedLocals` /
`noUnusedParameters`: import sobrando quebra o build).
