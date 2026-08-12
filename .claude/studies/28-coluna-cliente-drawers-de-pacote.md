# 28 — Coluna do cliente nos drawers de pacote (Visualizando pacote #N e Novo pacote)

Superfície: **Pacotes**. Quadros do vídeo: `f_0146` (carregando), `f_0148`/`f_0149`
("Visualizando pacote #9" com a coluna preenchida), `f_0153` ("Novo pacote" sem cliente).
Folha de contato: `sheets/sheet_08.jpg` (quadros 141–160).

Objetivo: ligar o componente compartilhado `ClienteBlocosLaterais`
(`apps/web/src/components/ClienteBlocosLaterais.tsx:44`) nos dois drawers de pacote,
com o cabeçalho do cliente (avatar + nome + telefone + "Conversar") ao lado.

---

## 1. O que o vídeo mostra (nada aqui é inventado)

`f_0148.jpg` — drawer full-screen "Visualizando pacote #9". Coluna ESQUERDA (~250 px):

- avatar redondo grande, nome **BRUNA** centralizado, telefone `+55 (89) 99938-7007`
  e uma pílula verde **Conversar** (WhatsApp) ao lado do telefone;
- bloco **Informações** — 5 linhas fixas azuis com ícone: "Aniversário não definido",
  "R$ 0,00 em cashback", "R$ 0,00 em crédito", "0 comandas em aberto",
  "0 pagamentos em aberto";
- bloco **Pacotes** — uma única linha de contagem "1 pacote não consumido" (sem "+ Adicionar");
- bloco **Anotações** — com "+ Adicionar" à direita e o vazio "Nenhuma anotação encontrada".

NÃO existe bloco "Assinaturas" nesta superfície (ele só aparece no drawer de agendamento).

`f_0146.jpg` — mesma tela carregando: círculo cinza + barras cinza no lugar das linhas.

`f_0153.jpg` — "Novo pacote": a coluna esquerda tem só o avatar placeholder e um seletor
"Busque por um cliente". **Nenhum dos blocos aparece enquanto não há cliente.**

O vídeo nunca clica no "+ Adicionar" — o que ele abre não está no material.

---

## 2. Estado atual do nosso código (lido, com evidência)

### 2.1 `apps/web/src/pages/PacotePerfilModal.tsx`

- `apps/web/src/pages/PacotePerfilModal.tsx:78` — `PacotePerfilModal({ packageId, isOpen, onClose })`
  busca o detalhe com `useCustomerPackage` em `apps/web/src/pages/PacotePerfilModal.tsx:87`.
- `apps/web/src/pages/PacotePerfilModal.tsx:91` — monta um `FullDrawer` **sem `sections`**;
  o título hoje é "Itens do pacote" + "#N" (`apps/web/src/pages/PacotePerfilModal.tsx:96` e
  `apps/web/src/pages/PacotePerfilModal.tsx:98`). No vídeo o título é "Visualizando pacote #9"
  (`f_0149`).
- `apps/web/src/pages/PacotePerfilModal.tsx:199` — `PackageEditor` devolve um fragmento:
  `<div className="flex flex-col gap-4">` (coluna ÚNICA) em
  `apps/web/src/pages/PacotePerfilModal.tsx:201`, com card-resumo do cliente em
  `apps/web/src/pages/PacotePerfilModal.tsx:203` (nome em
  `apps/web/src/pages/PacotePerfilModal.tsx:207`), aviso de vencido em
  `apps/web/src/pages/PacotePerfilModal.tsx:239`, abas Itens|Sessões em
  `apps/web/src/pages/PacotePerfilModal.tsx:246` e o footer sticky
  Excluir / Ver pagamentos / Salvar em `apps/web/src/pages/PacotePerfilModal.tsx:279`.
- Grep por `Informaç|Anotaç|Assinatura|Conversar|Adicionar` no arquivo: só bate nas linhas de
  `cashback` do formulário de descontos (`apps/web/src/pages/PacotePerfilModal.tsx:133`,
  `apps/web/src/pages/PacotePerfilModal.tsx:380`). **Nenhum dos blocos existe hoje.**

### 2.2 `apps/web/src/pages/PacotesPage.tsx`

- `apps/web/src/pages/PacotesPage.tsx:1171` — `NovoPacoteDrawer({ isOpen, onClose })`.
- Estado do cliente escolhido: `selectedCustomer` (`PickedCustomer`) em
  `apps/web/src/pages/PacotesPage.tsx:1177`, resetado ao abrir em
  `apps/web/src/pages/PacotesPage.tsx:1211`.
- `apps/web/src/pages/PacotesPage.tsx:1308` — `FullDrawer` **com 4 sections**
  (`apps/web/src/pages/PacotesPage.tsx:1312`), footer Cancelar/Salvar em
  `apps/web/src/pages/PacotesPage.tsx:1322`.
- Sub-drawers `CustomerPickerDrawer` / `ItemPickerDrawer` já montados dentro do children em
  `apps/web/src/pages/PacotesPage.tsx:1334` e `apps/web/src/pages/PacotesPage.tsx:1339`.
- O corpo é um único `<div className="flex flex-col gap-4">` aberto em
  `apps/web/src/pages/PacotesPage.tsx:1345` e fechado em
  `apps/web/src/pages/PacotesPage.tsx:1550` (logo antes de `</FullDrawer>` em
  `apps/web/src/pages/PacotesPage.tsx:1551`).
- A seção 'cliente' já tem avatar + nome + telefone + "Trocar" em
  `apps/web/src/pages/PacotesPage.tsx:1350`–`apps/web/src/pages/PacotesPage.tsx:1372` e o
  placeholder "Busque por um cliente" em `apps/web/src/pages/PacotesPage.tsx:1379`
  (mesmo texto do vídeo).
- Imports já presentes que vou reaproveitar: `CustomerAvatar`/`PickedCustomer`
  (`apps/web/src/pages/PacotesPage.tsx:24`), `formatPhone`
  (`apps/web/src/pages/PacotesPage.tsx:46`), `useCustomer`
  (`apps/web/src/pages/PacotesPage.tsx:52`).

### 2.3 `apps/web/src/components/ClienteBlocosLaterais.tsx` (não vou editar)

- `apps/web/src/components/ClienteBlocosLaterais.tsx:44` — assinatura; `blocos` default em
  `apps/web/src/components/ClienteBlocosLaterais.tsx:25`.
- `apps/web/src/components/ClienteBlocosLaterais.tsx:76` — sem `customerId` devolve `null`
  (exatamente o comportamento de `f_0153`).
- `apps/web/src/components/ClienteBlocosLaterais.tsx:59` — usa `useCustomerPackages` de
  `queries/clientes` (não o homônimo de `queries/pacotes`).
- Bloco Pacotes = linha de contagem (`apps/web/src/components/ClienteBlocosLaterais.tsx:91`),
  vazio "Não há pacotes disponíveis"
  (`apps/web/src/components/ClienteBlocosLaterais.tsx:98`); Anotações com
  "Nenhuma anotação encontrada" (`apps/web/src/components/ClienteBlocosLaterais.tsx:123`).

### 2.4 Precedentes de layout já aceitos no repo (copiar, não reinventar)

- Drawer de comanda: duas colunas dentro do próprio children —
  `apps/web/src/components/ComandaDrawer.tsx:345` (`flex flex-col gap-6 lg:flex-row
  lg:items-start lg:gap-10`) e `<aside ... lg:w-[300px]>` em
  `apps/web/src/components/ComandaDrawer.tsx:348`; blocos ligados em
  `apps/web/src/components/ComandaDrawer.tsx:365`.
- Cabeçalho do cliente com "Conversar": `apps/web/src/components/ComandaDrawer.tsx:539`
  (`OrderCustomerCard`), botão WhatsApp em `apps/web/src/components/ComandaDrawer.tsx:580`.
- Caixa inline de nova anotação: `apps/web/src/components/ComandaDrawer.tsx:666`
  (`AddNoteInline`, usa `useCreateNote` em `apps/web/src/components/ComandaDrawer.tsx:673`).
- Drawer de agendamento: mesma coluna em `apps/web/src/pages/AgendaPage.tsx:1707`.

### 2.5 `apps/web/src/components/FullDrawer.tsx` — por que NÃO vou mexer

- `apps/web/src/components/FullDrawer.tsx:102` — props aceitas hoje; não há slot de `aside`.
- Corpo em três ramos: vertical (`apps/web/src/components/FullDrawer.tsx:256`), horizontal
  (`apps/web/src/components/FullDrawer.tsx:277`) e sem sections
  (`apps/web/src/components/FullDrawer.tsx:288`).

Decisão: **não** acrescentar `aside` ao `FullDrawer`. (a) O arquivo é compartilhado por dezenas
de drawers e há outros agentes editando o repo em paralelo — prop nova ali é conflito garantido
por ganho estético pequeno. (b) Os dois drawers irmãos que o Belasis desenha igual
(agendamento e comanda) resolvem a coluna DENTRO do children
(`apps/web/src/components/ComandaDrawer.tsx:345`), então fazer diferente aqui seria a
inconsistência, não a paridade. Custo assumido: no "Novo pacote" a coluna começa abaixo das
abas horizontais (as abas já são divergência nossa; o Belasis não tem abas nesse drawer).

### 2.6 Dados — o que existe

- `CustomerPackageDetail.customerId` existe (`apps/web/src/lib/types.ts:446`), mas o `customer`
  embutido só traz `{ id, name }` (`apps/web/src/lib/types.ts:454`) — sem telefone/avatar.
  Confirmado no backend: `apps/api/src/modules/packages/packages.service.ts:117` seleciona
  `customer: { select: { id: true, name: true } }`.
- Telefone/avatar saem de `useCustomer` (`apps/web/src/lib/queries/clientes.ts:215`,
  `enabled: Boolean(id)` em `apps/web/src/lib/queries/clientes.ts:219`); `CustomerFull` tem
  `avatarUrl` (`apps/web/src/lib/types.ts:43`) e herda `phone` de `Customer`.
- Criar anotação: `useCreateNote` (`apps/web/src/lib/queries/clientes.ts:366`) →
  `POST /customers/:id/notes`, exige `clientes:manage`; a mutação invalida
  `['customer-notes', id]` (`apps/web/src/lib/queries/clientes.ts:372`), então o bloco se
  atualiza sozinho.
- Permissão: `useCan` em `apps/web/src/lib/queries/permissions.ts:59`.

---

## 3. O que vou escrever

### 3.1 NOVO: `apps/web/src/components/PacoteClienteAside.tsx`

Componente da coluna esquerda dos DOIS drawers de pacote (por isso um arquivo só, e não duas
cópias: `apps/web/src/pages/PacotesPage.tsx:49` já importa `PacotePerfilModal`, mas pendurar um
componente de UI num arquivo de modal seria pior de achar).

Conteúdo, exatamente o que `f_0148`/`f_0153` mostram:
1. avatar grande + nome + telefone + pílula "Conversar" (`wa.me`, mesma navegação de
   `apps/web/src/components/ComandaDrawer.tsx:352`); sem cliente → avatar vazio + botão
   "Busque por um cliente" (só quando o chamador passa o callback, que é o caso do "Novo pacote");
2. `<ClienteBlocosLaterais blocos={['pacotes','anotacoes']} onAdicionarAnotacao={...} />` —
   sem "Assinaturas" e sem "+ Adicionar" em Pacotes, conforme `f_0148`;
3. caixa inline de nova anotação (mesmo formato de
   `apps/web/src/components/ComandaDrawer.tsx:666`), aberta pelo "+ Adicionar" e escondida
   para quem não tem `clientes:manage` (sem a permissão o callback nem é passado, e aí o
   componente compartilhado não desenha o link —
   `apps/web/src/components/ClienteBlocosLaterais.tsx:168`).

O bloco **Informações** NÃO entra (ver seção 4).

### 3.2 `apps/web/src/pages/PacotePerfilModal.tsx`

- Título do `FullDrawer` (`apps/web/src/pages/PacotePerfilModal.tsx:94`) passa a
  "Visualizando pacote #N" (`f_0149`).
- `PackageEditor` (`apps/web/src/pages/PacotePerfilModal.tsx:199`) vira duas colunas: `aside`
  com `PacoteClienteAside` + a coluna atual (`apps/web/src/pages/PacotePerfilModal.tsx:201`)
  virando `flex-1`. O footer sticky (`apps/web/src/pages/PacotePerfilModal.tsx:279`) fica fora
  das colunas, como está.
- `customerId` = `pkg.customerId` (`apps/web/src/lib/types.ts:446`), nome de fallback =
  `pkg.customerName ?? pkg.customer?.name` (já usado em
  `apps/web/src/pages/PacotePerfilModal.tsx:207`).

### 3.3 `apps/web/src/pages/PacotesPage.tsx`

- Envolver o corpo do `NovoPacoteDrawer` (`apps/web/src/pages/PacotesPage.tsx:1345` até
  `apps/web/src/pages/PacotesPage.tsx:1549`) numa linha `lg:flex-row` com o `PacoteClienteAside`
  à esquerda; os sub-drawers (`apps/web/src/pages/PacotesPage.tsx:1334`) continuam fora da linha.
- O aside recebe `selectedCustomer` (`apps/web/src/pages/PacotesPage.tsx:1177`) e
  `onSelecionarCliente={() => setCustomerPickerOpen(true)}` — o MESMO picker do campo "Cliente"
  (`apps/web/src/pages/PacotesPage.tsx:1376`), não um fluxo novo.

---

## 4. Fora de escopo (declarado, não esquecido)

**Bloco "Informações"** (5 linhas de `f_0148`). Não entra nesta rodada:

- o drawer de comanda, que é a mesma coluna no Belasis, também não tem
  (`apps/web/src/components/ComandaDrawer.tsx:365` liga só `ClienteBlocosLaterais`) — colocar
  só aqui criaria divergência entre duas telas que o vídeo desenha idênticas;
- duas das cinco linhas não têm contador em endpoint nenhum: `GET /customers/:id/panel`
  devolve `debitosTotal` como SOMA em R$ e `pacotesEmAberto`
  (`apps/web/src/lib/types.ts:78`; cálculo em
  `apps/api/src/modules/customers/customers.service.ts:230`), **não** contagem de comandas
  abertas nem de pagamentos em aberto. Fazer no front custaria mais dois GETs por abertura de
  drawer (`useCustomerOrders` em `apps/web/src/lib/queries/clientes.ts:339` e
  `useCustomerDebts` em `apps/web/src/lib/queries/clientes.ts:233`).

Pertence a um componente próprio, compartilhado pelas três superfícies, com dois `count` novos
no `Promise.all` de `apps/api/src/modules/customers/customers.service.ts:200`.

---

## 5. Decisões tomadas durante a escrita (registro)

- **Avatar de 96 px desenhado no próprio aside** em vez de `CustomerAvatar`
  (`apps/web/src/components/CustomerPickerDrawer.tsx:24`): as iniciais dele são fixas em 13 px
  (`apps/web/src/components/CustomerPickerDrawer.tsx:36`) e sumiriam num círculo desse tamanho.
  Com foto → `<img>`; sem foto → boneco genérico, que é exatamente o que `f_0148` e `f_0153`
  mostram.
- **Prop `buscarContato`** em vez de sempre chamar `useCustomer`: no "Novo pacote" o picker já
  devolve telefone e foto (`apps/web/src/components/CustomerPickerDrawer.tsx:10`), então lá a
  request não sai. No "Visualizando pacote" ela é obrigatória — sem ela não há telefone nem
  "Conversar".
- **Título** do drawer de visualização passou a "Visualizando pacote #N"
  (`apps/web/src/pages/PacotePerfilModal.tsx:95`). "Itens do pacote" continua existindo, mas como
  o nome da TABELA dentro do drawer, que é o papel dele no Belasis.
- **Validação**: `pnpm -C apps/web exec tsc --noEmit -p tsconfig.json` sem nenhuma saída.
  As três telas NÃO foram abertas em runtime (o Vite da 5173 estava fora do ar durante a tarefa).
