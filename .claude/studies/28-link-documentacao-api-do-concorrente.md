# Estudo 28 — "Ver documentação" manda o cliente para o site do concorrente

Relato do dono: em Configurações → API, o botão **"Ver documentação"** abre um site do Belasis.

## Confirmado

`apps/web/src/pages/ConfiguracoesPage.tsx:1722`:
```tsx
href="https://belasis-api.readme.io"
```
É a documentação pública da API do **Belasis**, concorrente direto. O botão está em
`apps/web/src/pages/ConfiguracoesPage.tsx:1721`-`:1728`, dentro da seção `current === 'api'`
(`:1704`), ao lado de "Ativar integração via API" (`:1715`), que aponta para `/perfil/adicionais` —
ou seja, a integração é um adicional pago que o salão ainda contrata à parte.

Sobrou do clone: a tela foi replicada com o link original junto.

## Não existe documentação nossa para apontar

Verificado:
- **Sem Swagger/OpenAPI**: `grep -n swagger apps/api/package.json` não retorna nada, e
  `apps/api/src/main.ts` não tem `SwaggerModule` nem `DocumentBuilder`.
- **Sem doc de API no repo**: `docs/` só tem os mapas do Belasis (`docs/belasis-api-map.md` é a API
  DELES, não a nossa) e a base de ajuda em `docs/help/*.md`, que não cobre API.

Existe, porém, uma central de ajuda real: `apps/web/src/App.tsx:461`-`:466` registra `/ajuda`,
`/ajuda/suporte`, `/ajuda/base-conhecimento`, `/ajuda/feedback` e `/ajuda/novidades`, e
`apps/web/src/pages/AjudaPage.tsx:55`-`:59` monta as abas. As categorias em
`apps/web/src/pages/AjudaPage.tsx:74`-`:84` batem com o frontmatter dos `.md` em `docs/help/` — e
**não há categoria de API**.

## Decisão

Trocar o link externo por `/ajuda/suporte`, com o rótulo **"Falar com o suporte"**.

Por que não manter "Ver documentação" apontando para a ajuda interna: seria prometer documentação
que não existe — o usuário clicaria esperando referência de endpoints e cairia numa central genérica.
Como a integração é um adicional que ainda passa por contratação (`/perfil/adicionais`), suporte é
para onde essa pessoa precisa ir de verdade.

Escrever documentação de API real é trabalho à parte (expor OpenAPI via `@nestjs/swagger` e publicar),
e inventar conteúdo de endpoint seria pior que não ter.

## Arquivos tocados

- `apps/web/src/pages/ConfiguracoesPage.tsx`
