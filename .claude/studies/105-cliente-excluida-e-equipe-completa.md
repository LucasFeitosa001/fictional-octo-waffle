# Estudo 105 — cliente EXCLUÍDA aceita pela ponte + rota da equipe completa

Dois achados de uma varredura adversarial no fluxo de agendamento da IA, medidos
antes de mexer. Arquivos tocados:

- `apps/api/src/modules/voltr/voltr-agenda.service.ts`
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts`
- `apps/api/src/modules/usecase-tests/voltr.usecases.test.ts`

---

## Achado 1 — `deletedAt: null` falta na resolução de identidade

### O que o código faz hoje

`resolverCliente` confere o `customerId` que a Voltr guardou:

- `apps/api/src/modules/voltr/voltr-agenda.service.ts:753` —
  `this.prisma.client.customer.findFirst({ where: { id: idInformado, companyId } })`.
  O WHERE tem `companyId` (isolamento por empresa, ok) e **não tem `deletedAt`**.
- `apps/api/src/modules/voltr/voltr-agenda.service.ts:758` — a única outra trava é
  o telefone bater (`telefoneBate`).
- `apps/api/src/modules/voltr/voltr-agenda.service.ts:760` — batendo, devolve
  `{ id: guardado.id, criado: false }` e o agendamento é gravado nesse id.

A busca por telefone tem o mesmo buraco:

- `apps/api/src/modules/voltr/voltr-agenda.service.ts:690` — `candidatosPorTelefone`
  faz `findMany({ where: { companyId, ...extra, phone: { contains } } })`, sem
  `deletedAt`. `extra` só carrega `active` (chamada em
  `apps/api/src/modules/voltr/voltr-agenda.service.ts:770`).
- `apps/api/src/modules/voltr/voltr-agenda.service.ts:716` — `acharCliente`
  (usada por `meus`/`cancelar`) chama a mesma função sem nem o `active`.

### Por que isso é dano real

`Customer.deletedAt` é soft-delete: `packages/db/prisma/schema.prisma` documenta
"quando setado, o registro é escondido de toda lista admin e de toda leitura de
agendamento público". Ou seja: o agendamento é gravado apontando para uma cliente
que **não aparece em nenhuma tela do salão**. Ninguém vê, ninguém atende.

Comparação dentro do próprio arquivo — as outras leituras já filtram:
`voltr-agenda.service.ts:154` (serviços), `:203` (produtos), `:278` (profissionais),
`:296` e `:302` (diagnóstico de lista vazia).

### Medição no banco de produção (5434, SELECT)

```
      empresa      | excluidos | com_telefone
-------------------+-----------+--------------
 Fátima Cabelos    |         1 |            1
 Studio Borboletas |         3 |            3
```

4 clientes soft-deleted, todas com telefone. Não é hipótese.

### Conserto

`deletedAt: null` nos dois WHEREs (`:755` e `:691`). Cliente excluída deixa de ser
encontrada, e o fluxo cai no cadastro novo — que é o comportamento honesto: quem
foi excluída não existe mais para o salão.

---

## Achado 2 — não existe rota para "a equipe inteira e o que cada um faz"

### O que existe hoje

- `apps/api/src/modules/voltr/voltr-agenda.service.ts:266` — `profissionais(companyId, serviceId)`
  **exige** o serviço: `voltr-agenda.service.ts:267` lança `BadRequestException`
  sem ele, e o WHERE em `:275-280` filtra por `services: { some: { serviceId } }`.
- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:51` — a rota `profissionais`
  repassa `body?.serviceId ?? ''`.

Consequência medida do lado da Voltr: a IA não consegue falar de um profissional
antes de fixar o serviço. "quero corta com o Carlos ele está disponível hoje?"
recebe o catálogo inteiro, porque nenhum id de serviço foi resolvido ainda.

### Dado real de produção (empresa `cmryy21zj000hjx01lmccyco0`)

```
Lucas Feitosa   -> Corte masculino de cabelo, Pes, Selagem para Cabelos, Unhas
Carlos Ferreira -> Selagem para Cabelos
Amanda/Bruna/Carla/Diego -> Pes, Unhas
```

Com isso a resposta certa é "o Carlos faz Selagem, mas não corte; quem corta é o
Lucas" — dado que hoje o backend não sabe entregar numa chamada só.

### Conserto

Rota nova `POST /voltr/agenda/equipe`, nos mesmos moldes de `servicos`/`produtos`:

- mesma guarda de assinatura (`VoltrSignatureGuard`, `voltr-agenda.controller.ts:20`);
- mesmo escopo (`@EscopoVoltr('agenda')`, `voltr-agenda.controller.ts:26`);
- `companyId` do guard, nunca do corpo (`voltr-agenda.controller.ts:28`);
- `deletedAt: null`, `active`, `onlineBookable` no profissional — os mesmos filtros
  de `voltr-agenda.service.ts:275-280`;
- os serviços de cada um filtrados pelos mesmos critérios de `servicos()`
  (`voltr-agenda.service.ts:147-156`): `onlineBookable`, `active`, `visible`,
  `deletedAt: null`.
