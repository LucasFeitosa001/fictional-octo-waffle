/**/
# Estudo 151 — o relatório de Mensagens mostra mensagem de outro salão

Achado durante a varredura do WhatsApp do agendamento online. Não foi relatado
pelo dono — apareceu no mapeamento e é o item mais grave da leva, então vai
antes do que ele pediu.

## Arquivos tocados

- `apps/api/src/modules/reports/reports.service.ts`

## O defeito

`reports.service.ts:570-585` monta o filtro do relatório assim:

```ts
AND: [
  { OR: [ { companyId }, ...phoneTails.map((t) => ({ toPhone: { endsWith: t } })) ] },
  …
]
```

O segundo braço do `OR` casa **só pelo final do telefone**, sem nenhum vínculo
com a empresa. Basta que uma cliente de outro salão tenha os mesmos 8 dígitos
finais para a mensagem daquele salão entrar na tabela — e a coluna
`textPreview` (`:618`) traz os primeiros 140 caracteres do texto.

Não é hipotético: sufixo de 8 dígitos colide com frequência entre DDDs
diferentes, e o relatório é aberto por qualquer usuário com `relatorios:view`.

O ramo por telefone existe por um motivo legítimo: `companyId` é nullable e há
registros antigos no outbox sem empresa. A intenção era alcançá-los; o efeito
foi alcançar também os das outras empresas.

## A correção

A mesma que `customers.service.ts:998-1013` já aplicou na consulta gêmea (a
timeline do cliente), que foi corrigida antes e serve de padrão: o `companyId`
sobe para fora, como `AND` obrigatório, e o `OR` fica só com o que ele já
delimita.

```ts
AND: [
  { companyId },
  { OR: [ { customerId: … }, { toPhone: { endsWith: tail } } ] },
]
```

Com isso, registros órfãos (`companyId = null`) deixam de aparecer no relatório
— é a troca consciente que a consulta gêmea já fez. Alcançar órfão de outro
salão para não perder órfão do próprio é um preço que não se paga: o vazamento
é dano permanente, a ausência de um registro antigo é incômodo.

Somei a **defesa em profundidade** que a gêmea também tem (`:1046`): mesmo que
alguém reescreva a query, a linha de outra empresa não passa pela montagem do
resultado.

## Por que a gêmea foi corrigida e esta não

A correção de `customers.service.ts` cita explicitamente o problema no
comentário. Quem corrigiu não procurou a segunda ocorrência do mesmo padrão —
que é o modo normal de uma correção de segurança ficar pela metade.
