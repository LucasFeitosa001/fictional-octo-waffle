# Estudo 62 — Área de IA em subdomínio próprio (ai.salonpass.com.br)

Pedido do dono:

> *"A IA VAI SER UMA PÁGINA NOVA DA SALONPASS SÓ FOCADA EM IA, E DADOS.
> AI.SALONPASS.COM.BR — E ABRIR NUMA JANELA NOVA E REUTILIZAR O LOGIN"*

Escopo decidido com ele nesta sessão: **v1 leva a IA que já existe + um painel de dados montado com
endpoints prontos** (sem backend novo), e o acesso é **só de dono/admin (`config:manage`)**. O chat
que responde perguntas sobre os dados fica para uma etapa seguinte.

## 62.1 — Reaproveitar o login é de graça (já está pronto)

`apps/api/src/auth/better-auth.ts:54`-`:71` (`cookieDomain()`) deriva o domínio do cookie do host de
`BETTER_AUTH_URL` **dropando o rótulo mais à esquerda**: `api.salonpass.com.br` →
`salonpass.com.br`. Isso alimenta `advanced.crossSubDomainCookies` (`:151`-`:154`), que já existe
porque o clube (`agenda.salonpass.com.br`) precisava ver a sessão iniciada no painel.

Consequência: **`ai.salonpass.com.br` já recebe o cookie de sessão**. Não precisa de token na URL,
nem de handoff, nem de segundo login.

O comentário em `:63`-`:67` registra a armadilha: nunca cortar por contagem fixa de rótulos — com
`.com.br` isso gera `com.br`, sufixo público que o navegador rejeita (esse bug já quebrou o login).

O que falta é liberar a ORIGEM nova, e é um único lugar: `AUTH_TRUSTED_ORIGINS` alimenta ao mesmo
tempo o Better Auth (`better-auth.ts:29`-`:32`, usado em `:139`) e o CORS
(`apps/api/src/main.ts:42`-`:55`, `credentials: true`). Hoje, em produção, essa variável está no
App Runner; sem `https://ai.salonpass.com.br` nela, o navegador barra as chamadas com credencial.

## 62.2 — O que existe hoje de "IA" no painel

- `apps/web/src/pages/ia/IAAtendimentoPage.tsx` (1558 linhas): a recepcionista virtual do WhatsApp —
  conversas, FAQ, tom, handoff, envio manual. Rota `/ia-atendimento`
  (`apps/web/src/App.tsx:473`), com `PaidProtectedRoute perm="marketing:view" feature="whatsapp_api"`.
- Entrada na sidebar: `apps/web/src/layout/Sidebar.tsx:110`-`:120` — item direto `IA`, badge `Beta`,
  `to: '/ia-atendimento'`.
- Backend de IA: só o atendente do WhatsApp (Groq em
  `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts`). Não existe módulo de
  insights/consulta em linguagem natural — daí a decisão de deixar o chat sobre dados para depois.

## 62.3 — Os dados que já dá para mostrar sem backend novo

`apps/web/src/lib/queries/dashboard.ts:97` (`useDashboard(from, to)`) devolve, numa chamada, tudo que
o painel usa (`:80`-`:95`): `vendasTotais` e `ticketMedio` com delta, `agendamentosCount`,
`comandasCount` com `taxaConversao`, `tendenciaVisitas` (série diária), `agendamentosPorStatus`,
`comparacaoPeriodos`, `atendimentosPorProfissional`, `vendasPorCategoria`, `funil`, `ocupacaoAgenda`
e `mapaCalor`. Escopado por empresa e no fuso dela.

Cores de gráfico já são themeáveis e por entidade: `apps/web/src/theme/dataColors.ts:27`
(`DATA_VIZ_PALETTE`, tokens `--sp-chart-categorical-*`) e `theme/useThemeColors.ts:25`
(`chartGrid`/`chartAxis`/semânticas). O painel usa recharts (`PainelPage.tsx:22`), que já está no
`apps/web/package.json:27`. Reuso, não invento paleta.

## 62.4 — Como o subdomínio vai servir a aplicação

Mesmo bundle, mesma distribuição do CloudFront, com **alias novo** `ai.salonpass.com.br`. A SPA
decide pelo HOSTNAME qual produto renderizar. Justificativa:

- o cookie de sessão é compartilhado no domínio-base (62.1), então não há nada a "reaproveitar" além
  de já estar lá;
- o padrão existe no código para o clube: `apps/web/src/lib/config.ts:20`-`:28`
  (`resolveClubOrigin()`), que troca a origem por hostname;
- evita segundo bucket, segundo build e segundo pipeline de deploy (o processo manual está na
  memória `deploy-producao-processo`).

Custo dessa escolha: o bundle da área de IA carrega o mesmo JS do painel (code-splitting já existe
por rota). Aceitável para v1.

## Arquivos

- `apps/web/src/lib/config.ts`: `AI_ORIGIN` (env `VITE_AI_ORIGIN`, produção
  `https://ai.salonpass.com.br`, dev `?app=ia` na mesma origem), no mesmo formato do clube.
- `apps/web/src/lib/aiHost.ts` (novo): `isAiHost()` (hostname `ai.` ou `?app=ia` fixado na sessão) e
  `abrirAreaDeIa()` (janela nova com `noopener`).
- `apps/web/src/ai/AiApp.tsx` (novo): casca própria (sem a sidebar do painel), guarda de sessão
  reaproveitando `useSession`, guarda `config:manage`, e rotas `/` (dados) e `/atendimento`.
- `apps/web/src/ai/AiDadosPage.tsx` (novo): painel de dados sobre `useDashboard`, com leituras
  automáticas do período — **regra, não modelo**, e a tela diz isso com essas palavras para não
  passar cálculo por IA.
- `apps/web/src/App.tsx`: quando `isAiHost()`, monta `AiApp` em vez do painel.
- `apps/web/src/layout/Sidebar.tsx`: o item `IA` passa a ABRIR a área nova em outra janela (mantendo
  a rota `/ia-atendimento` funcionando para quem tem link salvo).

## Infra (precisa de credencial AWS válida)

1. ACM: conferir se o certificado da distribuição cobre `ai.salonpass.com.br` (wildcard
   `*.salonpass.com.br` cobre; se for por nome, emitir/adicionar).
2. CloudFront `E1HFK0OO79ORZW`: adicionar o alias.
3. Route53: `ai.salonpass.com.br` → alias da distribuição.
4. App Runner: acrescentar `https://ai.salonpass.com.br` em `AUTH_TRUSTED_ORIGINS` (isto libera
   Better Auth e CORS de uma vez) e redeploy.

Sem o passo 4 a tela abre e as chamadas com credencial falham; sem 1–3 o domínio não resolve.
