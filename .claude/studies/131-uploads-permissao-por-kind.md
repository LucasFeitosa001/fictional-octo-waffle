# Estudo 131 — uploads exigem a permissão do KIND

Pedido do dono: fechar os pontos MÉDIO/BAIXO da auditoria. O primeiro é o
`UploadsController.upload`, que aceita 5 permissões em OR e não confere se a
permissão do usuário casa com o `kind` do upload.

## O furo

`apps/api/src/modules/uploads/uploads.controller.ts:55-61` — a rota `POST /uploads`
tem `@RequirePermission('clientes:manage', 'equipe:manage', 'catalogo:manage',
'config:manage', 'marketing:manage')`. QUALQUER uma dessas keys autoriza a
subida — inclusive `marketing:manage` fazendo upload `kind=customer`.

**Cenário concreto:** um usuário com `marketing:manage` (que a rigor só devia
mexer em campanhas/promoções) sobe um arquivo `kind=customer`. O arquivo vai
para o storage com naming previsível (`<companyId>__customer__...`). Ele
depois anexa o arquivo à ficha de um cliente via `POST /customers/:id/files`
(que exige `clientes:manage` — passa a bloquear) — mas o arquivo já está no
servidor.

## O que este estudo muda

`apps/api/src/modules/uploads/uploads.controller.ts` — a rota `POST /uploads`
passa a exigir a permissão CORRESPONDENTE ao `kind`:

| kind         | permissão exigida             |
|--------------|-------------------------------|
| customer     | `clientes:manage`             |
| professional | `equipe:manage`               |
| product      | `catalogo:manage`             |
| service      | `catalogo:manage`             |
| logo         | `config:manage`               |
| whatsapp     | `marketing:manage`            |
| misc         | qualquer uma das 5 (fallback) |

A checagem sai do decorator (que só faz OR) e vai para o corpo do handler —
depois de resolver o `kind` normalizado. O `AuthService.permissions` já é
carregado pelo `PermissionGuard`; leio de novo aqui via `this.auth.permissions`.

## Arquivos tocados

- `apps/api/src/modules/uploads/uploads.controller.ts`
- `apps/api/src/modules/uploads/uploads.module.ts` — passa a exportar
  `AuthModule` para o controller ter `AuthService`.
- `apps/api/src/modules/usecase-tests/uploads-permissao.usecases.test.ts`
  (novo)

## O que fica de FORA

- `GET /uploads/file/:name` já isola por `companyId` no `resolveLocalFile`
  (o nome do arquivo começa com o `companyId`) — não precisa mexer.
- A rota `POST /uploads/presign` (S3 backward-compat) segue com as mesmas
  permissões da rota principal — aplico a mesma validação por kind.
