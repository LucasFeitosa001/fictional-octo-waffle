# Estudo 122 — a aba "Adicionais" nunca teve tela

Pedido do dono: *"essa mensagem que aparece ao clicar em Adicionais em
assinatura, desfaça isso para todas as contas. Esse local era para ter vários
módulos para adicionar na assinatura, verifica se você encontra os módulos"*.

## Arquivos tocados

- `apps/web/src/App.tsx`
- `apps/web/src/pages/PerfilAdicionaisPage.tsx` (novo)

## O que existe hoje

A aba existe no cabeçalho da assinatura e aponta para uma rota sem tela:

- apps/web/src/pages/PerfilAssinaturaPage.tsx:100-103 — `MAIN_TABS` tem
  `{ id: 'adicionais', label: 'Adicionais', to: '/perfil/adicionais' }`.
- apps/web/src/App.tsx:624-633 — a rota `/perfil/adicionais` renderiza um
  `IntegrationUnavailablePage` com "Contratação de adicionais ainda não
  habilitada".

## Os módulos: existem, e estão completos

`apps/api/src/modules/feature-flags/feature-catalog.ts` é a fonte única:

- :14-27 — **12 chaves**: `online_booking`, `custom_subdomain`, `cashback`,
  `goals`, `commissions`, `packages`, `memberships`, `messaging`, `campaigns`,
  `reports_advanced`, `whatsapp_api`, `nfe`.
- :96+ — `FEATURE_META` traz label e descrição em pt-BR para cada uma
  ("Programa de cashback — Devolva parte do valor como crédito e traga o cliente
  de volta para gastar mais.").
- :39-58 — os planos são cumulativos: `starter` = agendamento online;
  `pro` acrescenta subdomínio, cashback, metas, comissões, pacotes,
  assinaturas, relatórios avançados, mensagens e campanhas; `max` acrescenta
  WhatsApp e NF-e.
- :67-71 — preços sugeridos: starter 99, pro 199, max 349.

E o backend já ENTREGA isso pronto para a UI:

- apps/api/src/modules/feature-flags/feature-flags.controller.ts:49 —
  `GET /plans` devolve o catálogo (`getPlanCatalog()`), com features, labels e
  descrições.
- :22 — `GET /feature-flags` devolve as features EFETIVAS da empresa (plano +
  overrides de `FeatureFlag`).
- No front, `usePlans()` (lib/queries/plans.ts:34) e `useFeatures()`
  (lib/queries/features.ts:39) já consomem as duas.

Ou seja: os módulos, os textos, os planos e as duas rotas necessárias já
existiam. Faltava só a tela.

## O que NÃO existe

Nenhuma rota de contratação, checkout ou cobrança — grep por
`checkout|subscribe|contratar` no backend não devolve nada. A mensagem de
"ainda não habilitada" era honesta quanto a isso: sem cobrança, "contratar"
seria liberar recurso pago de graça.

## Decisão do dono

Perguntei o que o botão deveria fazer, dado que a tela lida com dinheiro. Ele
escolheu **pedir contato**: o botão abre uma conversa de WhatsApp com o módulo
já preenchido na mensagem, e a ativação continua manual, depois do pagamento
acertado. Entrega a tela sem fingir cobrança e sem liberar recurso pago.

## O que este estudo muda

`/perfil/adicionais` passa a renderizar uma tela real:

- **Ativos** — o que a empresa já tem, marcado, sem botão;
- **Disponíveis** — o que falta, com a descrição do módulo e em qual plano ele
  entra;
- em cada indisponível, "Quero contratar", que abre o WhatsApp com o nome do
  módulo e do salão na mensagem.

O `IntegrationUnavailablePage` sai dessa rota. Ele continua existindo e sendo
usado por outras integrações que de fato não existem.

## Segunda rodada — separar o que funciona do que é promessa

Pedidos do dono depois de ver a tela:

1. trazer de volta, **como vitrine**, os módulos que ainda não existem — quem
   tenta adicionar cai no suporte;
2. **auditar os 12** e mover para essa vitrine os que não funcionam de verdade;
3. na página de **Nota Fiscal**, duas mensagens conforme o plano: quem não tem o
   Max precisa subir de plano; quem já tem, precisa da integração.

### Auditoria — arquivos tocados nesta rodada

- `apps/web/src/pages/PerfilAdicionaisPage.tsx`
- `apps/web/src/pages/financeiro/NotasFiscaisBloqueioPage.tsx` (novo)
- `apps/web/src/App.tsx`

### O que a auditoria mediu

Para cada uma das 12 chaves, contei rotas com `@RequireFeature('<chave>')` em
`apps/api/src` e o gate correspondente no menu (`feature="<chave>"` em App.tsx):

```
online_booking     backend=1  menu=1     cashback        backend=3  menu=1
goals              backend=1  menu=1     commissions     backend=2  menu=1
packages           backend=1  menu=1     memberships     backend=1  menu=1
messaging          backend=2  menu=0     campaigns       backend=2  menu=1
reports_advanced   backend=1  menu=1     whatsapp_api    backend=2  menu=1
custom_subdomain   backend=0  menu=0  ←  nfe             backend=0  menu=0  ←
```

Os dois de backend=0:

- **`nfe`** — não existe módulo algum no backend, e as duas telas
  (`/financeiro/notas-fiscais`, `/reports/invoices`) já apontavam para
  `IntegrationUnavailablePage`. `NotasFiscaisPage.tsx` é uma maquete de 782
  linhas com ZERO chamadas de API — o mesmo padrão da tela de adicionais.
- **`custom_subdomain`** — vendido no plano Pro e a chave **não é conferida em
  lugar nenhum**: grep em `apps/api/src` e `apps/web/src` fora do catálogo não
  devolve nada. Vender como pronto o que não tem gate é a mesma mentira que esta
  tela veio corrigir.

Os outros 10 têm rota no backend e tela real — incluindo o `whatsapp_api`, que
já se comporta como o dono descreveu: só no Max, com `FeatureGate` barrando quem
está no Pro.

### O que a segunda rodada muda

- `AINDA_NAO_FUNCIONA = {nfe, custom_subdomain}`: nunca aparecem como ativos nem
  como contratáveis, mesmo que o plano os inclua;
- seção **"Em desenvolvimento"**, com esses dois mais cinco itens sem
  equivalente real que sobreviveram da maquete (Assinatura digital,
  Contabilidade, Envio de imagens e arquivos, Gerador de documentos, Integração
  via API). Sem preço e sem data — só selo "Em breve" e "Tenho interesse", que
  abre o suporte. Os itens da maquete que duplicavam módulos reais (Cashback,
  Metas, Promoções, Pacotes, Vendas por assinatura, WhatsApp) ficaram de fora;
- `NotasFiscaisBloqueioPage`: lê `GET /feature-flags` e escolhe entre "está no
  plano Max" (para quem não tem) e "ainda não configurada" (para quem já tem) —
  mandar quem já assina o Max "assinar o Max" seria mentira.
