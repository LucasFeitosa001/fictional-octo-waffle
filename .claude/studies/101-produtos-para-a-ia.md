# 101 — A Mariana precisa conhecer os PRODUTOS do salão

O dono: "ela tem que entender os serviços do local, tanto os produtos e serviço".

Hoje a ponte da IA só enxerga **agenda**. Quando a cliente pergunta "vocês vendem
shampoo?", "quanto custa a pomada?", a Mariana não tem de onde tirar a resposta —
e o que ela faz hoje é pior do que não responder: cai no atalho do catálogo de
SERVIÇOS e devolve a lista de serviços para uma pergunta de produto.

## O que existe hoje (lido, não deduzido)

### SalonPass — a ponte

`apps/api/src/modules/voltr/voltr-agenda.controller.ts` tem SEIS rotas, todas
`@Post` + `@UseGuards(VoltrSignatureGuard)` + `@EscopoVoltr('agenda')`:

- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:25` — `servicos`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:31` — `profissionais`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:40` — `horarios`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:57` — `meus`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:63` — `cancelar`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:76` — `criar`

Nenhuma de produtos. O `companyId` NUNCA vem do corpo: vem de
`req.voltrCompanyId`, escrito pelo guard depois de provar a assinatura
(`apps/api/src/modules/voltr/voltr-signature.guard.ts:141`). O escopo por rota é
conferido em `apps/api/src/modules/voltr/voltr-signature.guard.ts:132`.

A rota `servicos` é o molde: `apps/api/src/modules/voltr/voltr-agenda.service.ts:99`.
Ela filtra `companyId, onlineBookable, active, visible, deletedAt: null` e devolve
só `{ id, nome, preco, duracaoMin, descricao }` — o mínimo para a IA falar preço
certo sem despejar o cadastro.

### SalonPass — o cadastro de produto

`packages/db/prisma/schema.prisma:1011` — `model Product`. Campos relevantes:

- `packages/db/prisma/schema.prisma:1016` `name`
- `packages/db/prisma/schema.prisma:1018` `salePrice` (Decimal) — é o que a cliente paga
- `packages/db/prisma/schema.prisma:1020` `employeePrice` — preço para PROFISSIONAL/funcionário
- `packages/db/prisma/schema.prisma:1021` `costPrice` / `:1023` `additionalCost` — custo interno
- `packages/db/prisma/schema.prisma:1024` `stock` / `:1025` `minStock`
- `packages/db/prisma/schema.prisma:1030` `itemCode` / `:1031` `barcode`
- `packages/db/prisma/schema.prisma:1033` `observation` — anotação livre interna
- `packages/db/prisma/schema.prisma:1036` `defaultCommissionPercent`
- `packages/db/prisma/schema.prisma:1038` `trackStock` (default **false**)
- `packages/db/prisma/schema.prisma:1044` `favorite` / `:1045` `active` / `:1051` `deletedAt`

Como as telas listam: `apps/api/src/modules/products/products.service.ts:31` filtra
apenas `companyId` + `deletedAt: null` e ordena por
`apps/api/src/modules/products/products.service.ts:51` `[{ favorite: 'desc' }, { name: 'asc' }]`.
O filtro de **status** (ativo/inativo) é do frontend:
`apps/web/src/pages/ProdutosPage.tsx:223` já abre em `'active'` e
`apps/web/src/pages/ProdutosPage.tsx:263` filtra `p.active`. Ou seja: a tela normal
mostra ATIVO e NÃO EXCLUÍDO — é esse o filtro que a IA tem que herdar.

Sobre estoque: a baixa de venda acontece em
`apps/api/src/modules/orders/orders.service.ts:589` e
`apps/api/src/modules/orders/orders.service.ts:1733` **sem olhar `trackStock`**.
E `trackStock` tem default `false` no schema enquanto a tela usa `true` para
produto novo (`apps/web/src/pages/ProdutosPage.tsx:1327`). Conclusão: para
produto importado/legado com `trackStock=false` e `stock=0`, dizer "em falta"
seria mentira. Regra honesta: quantidade só existe quando o salão controla estoque.

### Voltr — as ferramentas da IA

`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/agenda-tools.service.ts:258`
declara SEIS ferramentas (`listar_servicos`, `listar_profissionais`,
`consultar_horarios`, `criar_agendamento`, `listar_meus_agendamentos`,
`cancelar_agendamento`). Nenhuma de produtos. O cliente HTTP é
`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/salonpass-agenda.client.ts:84`.

**O atalho perigoso** está em
`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/agenda-tools.service.ts:698`:
depois de `listar_servicos`, se a fala da cliente não casa com NENHUM nome de
serviço, o backend devolve o catálogo de serviços inteiro
(`textoServicosReais`, mesmo arquivo:1134) e encerra o turno. Uma pergunta sobre
PRODUTO cai exatamente aí — a cliente pergunta "vocês vendem shampoo?" e recebe
a lista de cortes e manicures.

O catálogo próprio da Voltr (`model Produto`, RAG em
`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/brain.service.ts:638`) é
outro produto: é o estoque do e-commerce/story da Voltr, não o do salão. Não se
mexe nele.

## O que vou fazer

1. **SalonPass — rota `produtos`**, nos moldes exatos de `servicos`:
   - `apps/api/src/modules/voltr/voltr-agenda.controller.ts` — novo `@Post('produtos')`
     com `@EscopoVoltr('agenda')`, `companyId` vindo só do guard.
   - `apps/api/src/modules/voltr/voltr-agenda.service.ts` — novo método `produtos()`
     filtrando `companyId, active: true, deletedAt: null`, ordenado como a tela
     (`favorite desc, name asc`), com busca opcional por termo no NOME e limite.
   - Exponho `{ id, nome, preco, marca, estoque, emEstoque }`. NÃO exponho
     `costPrice`, `additionalCost`, `employeePrice`, `defaultCommissionPercent`,
     `minStock`, `barcode`, `itemCode`, `observation`, `cashback*`, `legacyId`:
     é dado interno/de margem que não pode chegar à conversa com a cliente.
   - Testes em `apps/api/src/modules/usecase-tests/voltr.usecases.test.ts`.

2. **Voltr — ferramenta `listar_produtos`** em
   `/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/agenda-tools.service.ts`,
   com cliente novo em
   `/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/salonpass-agenda.client.ts`
   e uma linha na persona
   (`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/persona.ts:254`).

3. **Fechar o atalho**: antes de devolver o catálogo de serviços para uma fala que
   não casou com serviço nenhum, consultar o cadastro REAL de produtos. Se a fala
   for de produto, responde produto. Se não, o comportamento de hoje continua
   igual (é o que o teste `serviço inexistente recebe somente a lista real` trava).

Nada disso dispara mensagem: são leituras. Nenhuma migração de schema — o
`model Product` já tem tudo.

---

# 101-B — "não encontrei profissional disponível" era mentira

## O incidente (simulador, 15:20)

    [cliente] "quero corta o cabelo"
    [IA]      "...eu tenho um profissional que faz isso: o Lucas Feitosa. Qual dia?"
    [cliente] "para hoje mesmo"
    [IA]      "Paulo, não encontrei profissional disponível para ESSE SERVIÇO
               para hoje. Vou avisar a equipe agora..."

O banco de produção diz o contrário: Lucas Feitosa (`cmryy224m001vjx019lztz3hy`)
`active=true`, `ProfessionalSchedule` weekday=1 das 09:00 às 18:00, os quatro
serviços vinculados, ZERO agendamentos no dia.

## Onde estava

O "esse serviço" é o fallback
`nomesServicos.get(serviceId) ?? 'esse serviço'` no ramo de
`listar_profissionais` vazio
(`/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/agenda-tools.service.ts:819`
antes da correção). Ele só sai quando o `serviceId` usado NÃO está no mapa de
nomes — ou seja, o id que foi para a ponte era inventado pelo modelo.

Por que a âncora não pegou: em `normalizarIdsDeLeitura`
(`agenda-tools.service.ts:1176` antes da correção) a âncora do serviço vem de
`estado?.serviceId || espera?.serviceId`. No turno 2 não havia oferta nem
pendência, e `servicoEscolhidoId` do pré-carregamento é calculado sobre a ÚLTIMA
fala — que era "para hoje mesmo", sem serviço nenhum. Sem âncora, o id cru vai
para a ponte.

E do lado da SalonPass, `voltr-agenda.service.ts` método `profissionais` devolvia
`{ profissionais: [] }` com HTTP 200 em TRÊS situações incompatíveis: serviço
inexistente, ninguém vinculado, ninguém agendável online. É a mesma classe de
falha que `availability` já tinha resolvido em
`apps/api/src/modules/appointments/appointments.service.ts:57`
(`AvailabilityEmptyReason`) e
`apps/api/src/modules/appointments/appointments.service.ts:1494` (`vazio()`).

## O que fiz

- `apps/api/src/modules/voltr/voltr-agenda.service.ts` — `ProfissionaisEmptyReason`
  + `PROFISSIONAIS_EMPTY_REASON_TEXT` + `ProfissionaisResult`, e `profissionais()`
  passa a devolver `motivo`/`motivoTexto` SÓ quando a lista vem vazia (aditivo,
  como em `availability`). As duas consultas de diagnóstico só rodam no caminho
  vazio. De quebra, o `findMany` ganhou `deletedAt: null`: profissional excluído
  estava sendo oferecido pela IA, enquanto `availability` já o descartava
  (`appointments.service.ts:1526`).
- `/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/agenda-tools.service.ts` —
  no ramo vazio, antes de abrir pendência, confere se o `serviceId` fecha
  (`motivo === 'servico_desconhecido'`, ou o id não está no catálogo real
  carregado no turno). Se não fecha, é encanamento: não abre pendência, não
  avisa a equipe, mostra o catálogo REAL e pergunta qual é.
- Mesmo arquivo — ambiguidade de serviço no pré-carregamento
  (`correspondentes.length > 1`) passa a PERGUNTAR via `textoServicosAmbiguos`,
  em vez de zerar a âncora e seguir. Não pergunta quando já há oferta/pendência
  (o serviço já foi decidido) e nunca repete a pergunta anterior — a trava de
  laço do estudo 97.
- `/home/lucssfeitosa/belivin-ia/apps/api/src/autopilot/salonpass-agenda.client.ts` —
  o tipo de `profissionais` passa a carregar `motivo` opcional.
