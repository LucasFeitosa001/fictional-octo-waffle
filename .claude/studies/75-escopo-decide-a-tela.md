# Estudo 75 — A aba CRM abria o inbox, e o iframe não trocava de tela

Achados do mapeamento das 4 frentes, mais uma regressão minha que ele pegou.

## 75.1 — Regressão que eu causei

No estudo 71 passei a pedir os dois escopos de uma vez, para o contato conseguir abrir a conversa de
dentro do CRM:

```
apps/api/src/modules/voltr/voltr.controller.ts
const scopes: VoltrScope[] = ['chat', 'crm'];
```

Só que do lado da Voltr `apps/api/src/embed/embed.service.ts:247` monta a URL com **`scopes[0]`**
(`montarEmbedUrl(scopes[0], …)`). Com `['chat','crm']` fixo, **toda** requisição volta apontando para
`/embed/chat` — a aba CRM passou a abrir o inbox.

Conferido em produção agora:

```
scope=crm   -> https://alecrimdourado.belivin.com.br/embed/chat
scope=chat  -> https://alecrimdourado.belivin.com.br/embed/chat
```

Testei só o chat depois daquela mudança e não percebi. A correção é manter os dois escopos
concedidos — o motivo de tê-los continua válido — e colocar **o escopo pedido primeiro**.

## 75.2 — O iframe não troca ao navegar dentro do painel

`apps/web/src/pages/VoltrCrmPage.tsx:41` fixa o endereço uma vez só:

```
setSrc((atual) => atual ?? r.embedUrl);
```

As rotas `/voltr-chat` e `/voltr-crm` (`apps/web/src/App.tsx:479`-`:480`) têm árvore idêntica, então
o React não remonta o componente ao trocar de uma para a outra — e o `?? ` preserva o endereço
antigo. Hoje isso não aparece porque as duas devolvem a mesma tela; **assim que 75.1 for corrigido,
apareceria**: clicar de Atendimento para CRM continuaria mostrando o inbox até dar F5.

Corrijo junto, senão a correção de 75.1 nasce com um bug atrás.

## 75.3 — O fallback de tenant é fail-open

`apps/api/src/modules/voltr/voltr.config.ts` resolve o tenant assim:

```
return cfg.tenantMap[companyId] ?? cfg.defaultTenantSlug;
```

Empresa fora do mapa cai no tenant **padrão** — ou seja, veria o CRM de outro salão.

**Em produção isso não está acontecendo**: conferi as variáveis do App Runner agora e
`VOLTR_DEFAULT_TENANT_SLUG` está **ausente**, com o mapa contendo só o DesignModa. Empresa não
mapeada recebe 503 ("Este salão ainda não está vinculado a um espaço na Voltr"), que é o certo.

Mas a segurança está apoiada só na env estar vazia. Basta alguém preencher o padrão um dia para
todo salão não mapeado enxergar o espaço alheio — e isso contraria a regra multi-tenant do projeto.
Fecho no código: sem entrada no mapa, sem tenant.

## 75.4 — Certificação

`apps/api/src/modules/usecase-tests/voltr.usecases.test.ts` ganha os casos: o escopo pedido vem
primeiro no array (e os dois continuam concedidos), e empresa fora do mapa não recebe tenant nem
quando o padrão está preenchido.
