# Estudo 33 — Filtros de Transações em multi-seleção, como na referência

Referência: `belasis-reference/_spec-paridade/03-transacoes-filtros.png`, mandada pelo dono com
"quero esses locais idênticos". Eu entreguei no commit `0a1a2fb` a versão **errada em tipo de
controle**: botões de seleção ÚNICA. A referência usa checkbox.

## O que a referência mostra, controle por controle

| Seção | Controle | Estado no print |
|---|---|---|
| Período | 2 campos de data | 05 jul, 2026 / 19 jul, 2026 |
| Tipo de transação | **checkbox** (multi) | Contas a receber ✓ · Contas a pagar |
| Tipo de data ⓘ | **radio** (única) | Venc/Disponibilidade · Competência · Pagamento ● |
| Contas | **checkbox** (multi), rótulo "Ativas" + link "Desmarcar tudo" | Caixa ✓ · ITAU ✓ |
| Status | **checkbox** (multi), cada um um CHIP colorido | Bloqueado(cinza) · Disponível(azul) · Em aberto(laranja) · Atrasado(vermelho) · Pago(verde) ✓ |
| Formas de pagamento | continua abaixo (cortado no print) | |

## O que temos hoje

`apps/web/src/pages/financeiro/TransacoesPage.tsx` depois do meu commit:
- Tipo → grid de 2 botões, seleção única
- Tipo de data → 2 botões (falta Competência), seleção única
- Status → grid de 4 botões sem cor, seleção única
- Contas, Categorias, Formas de pagamento → `OptionList`, seleção única

A API é o limite real: `apps/api/src/modules/financial/dto.ts:43`-`:62` declara
`accountId`, `categoryId`, `paymentMethodId` e `status` no **singular**, e
`apps/api/src/modules/financial/financial.service.ts:482`-`:484` monta igualdade simples
(`{ accountId: q.accountId }`). Multi-seleção exige `in`.

## Plano

**API** — aceitar listas separadas por vírgula, mantendo os campos singulares para não quebrar quem
já chama (o painel financeiro navega para `/financeiro/transacoes?status=paid`, ver
`apps/web/src/pages/financeiro/FinanceiroPainelPage.tsx`):

- `accountIds`, `categoryIds`, `paymentMethodIds`, `statuses`, `types` — todos `?a,b,c`
- No `where`: `{ accountId: { in: [...] } }` quando a lista vier; senão o campo singular; senão nada.

**Front** — checkbox nas seções multi, radio no Tipo de data, chips coloridos no Status.

## Os dois limites, de novo (já decididos com o dono)

1. **Competência** exige coluna nova em `Transaction` (`packages/db/prisma/schema.prisma` tem só
   `dueDate` e `paidAt`). O dono escolheu criar a coluna — mas é migração em banco de PRODUÇÃO, e
   isso eu aviso antes de rodar. Neste lote a opção fica **fora do radio**.
2. **Bloqueado / Disponível** descrevem liberação de dinheiro pelo gateway do Belasis Pay. O dono
   escolheu ficar só com os 3 que têm significado real: Em aberto, Atrasado, Pago.

## Arquivos tocados

- `apps/api/src/modules/financial/dto.ts`
- `apps/api/src/modules/financial/financial.service.ts`
- `apps/web/src/lib/queries/financeiro.ts`
- `apps/web/src/pages/financeiro/TransacoesPage.tsx`
