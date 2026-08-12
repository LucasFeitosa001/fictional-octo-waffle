# Revisão adversarial — Criar e editar cliente (correções do estudo 141)

Revisor da área "Criar e editar cliente" do laudo
`.claude/studies/139-achados-4-fluxos.md`. Objetivo: descobrir se a correção
QUEBROU caminho que funcionava, se resolve o caminho de dor de verdade e se os
testes falhariam com o código antigo.

## O que conferi (e passou)

- **PhoneField** — extraí as funções puras REAIS do arquivo
  (`apps/web/src/components/PhoneField.tsx:13-143`) e rodei com `tsx`
  simulando o campo (valor gravado + máscara + país escolhido):
  - colar `+55 11 99999-9999` → grava `5511999999999`, mostra `(11) 99999-9999`;
  - colar `55999998888` (DDD 55, Santa Maria) → grava `5555999998888`, mostra
    `(55) 99999-8888` — o DDD 55 NÃO é comido, que era o risco da regra nova;
  - digitar tecla a tecla `89981291426`, `5532221234`, `55999998888`,
    `11987654321`, `1133334444`: em nenhum passo aparece o `(55)` fantasma do
    bug antigo (estudo do "5555555"), e o valor gravado acompanha a exibição;
  - apagar de trás para frente até esvaziar volta a `''` sem lixo;
  - `+1 918 238-4714` e `+351 912 345 678` trocam a bandeira.
- **`idsPorDigitos`** (`apps/api/src/modules/customers/customers.service.ts:52-79`)
  — rodei o SQL contra o banco local de produção (5434):
  `regexp_replace(...) LIKE '%98129142%'` devolve **2** linhas, que são
  exatamente a 'Scheila' (`(89) 98129-1426`) e a 'Sheila' (`89981291426`) que o
  laudo cita. Nome de tabela/colunas conferem com o schema (sem `@@map`,
  `deletedAt` existe).
- **Isolamento multi-tenant** — o `$queryRaw` filtra `companyId` e a lista de
  ids volta como `{ id: { in } }` DENTRO do `OR`, com `companyId` no AND da
  raiz. Não vaza entre empresas.
- **`null` no PATCH** — `@IsOptional()` do class-validator ignora os validadores
  quando o valor é `null`, e os 16 campos apagáveis são `String?` no schema
  (`packages/db/prisma/schema.prisma`, model Customer). Nenhum deles é NOT NULL.
- **O formulário não apaga o que não carregou** — o medo legítimo de trocar
  "omitir" por `null` é gravar `null` num campo que a tela nunca recebeu.
  `ClientePerfilTabs.tsx:2876` usa `panel.data?.customer ?? customer`, e o
  `customer` de fallback vem de `list()`, que faz `include` (não `select`) —
  ou seja, traz TODOS os escalares. Os únicos que faltam no fallback são
  `dependents` e `socialProfiles`, que já iam como array e já limpavam antes
  desta rodada (o próprio laudo registra isso). Sem regressão.
- **Baseline da suíte** — 351 testes, 331 passando, 20 falhas; as 20 são as
  mesmas `GAP: UC-*` de antes (nenhuma em customers). `npx tsc --noEmit` limpo
  nos dois lados.

## O que vou EDITAR

- `apps/web/src/lib/queries.ts` (`useCreateCustomer`, :126-133)

**Evidência do defeito:** existem DOIS `useCreateCustomer` no painel —
`apps/web/src/lib/queries/clientes.ts:200` (o corrigido, com o toast do aviso de
duplicidade) e `apps/web/src/lib/queries.ts:126` (sem toast nenhum). O
`NewAppointmentModal` importa o SEGUNDO
(`apps/web/src/components/NewAppointmentModal.tsx:29` importa de `'../lib/queries'`,
e usa em :309). Portanto o aviso de duplicata **não** aparece no "+ Novo
cliente" do agendamento, ao contrário do que o relato da correção afirma — e é
justamente ali que a recepção cadastra de novo a cliente que não achou.

**Correção mínima:** o segundo hook passa a ler o mesmo campo
`avisoDuplicidade` da resposta e levantar o mesmo toque amarelo. Nada mais muda:
continua criando o cliente, continua invalidando `['customers']`.
