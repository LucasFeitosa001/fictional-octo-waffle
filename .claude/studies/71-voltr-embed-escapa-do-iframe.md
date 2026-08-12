# Estudo 71 — O embed da Voltr escapa do iframe e o token fica sem escopo

Relato do dono, em cima de dois vídeos: *"como era para funcionar exatamente essa página? parece que
está desconectada das outras páginas e parece que nada funciona"* e *"por que fica tendo essas
piscada quando atualizo a página"*.

Decisões dele nesta rodada: **a nossa barra lateral é quem comanda** a navegação (o iframe mostra só
o miolo do módulo), e o tenant de produção passa a ser **um próprio do DesignModa**, não o Silvia
Hair de teste.

## 71.1 — O que o vídeo mostra, e o que é de verdade

No vídeo aparece uma barra "Voltr · Atendimentos · CRM · Apps" **dentro** do iframe, e a URL do
navegador é `app.salonpass.com.br/voltr-chat`. Isso parece contradizer o desenho, que manda o embed
ser sem casca.

Não contradiz: **o iframe tinha saído do `/embed`**. Conferi ao vivo, com um token novo emitido pela
produção — a página `/embed/chat` servida agora tem **zero** elementos `nav`/`header`, e o texto
começa direto em "Nenhum WhatsApp conectado". A barra que aparece no vídeo é o `PainelChrome` da
Voltr (`apps/web/app/components/PainelChrome.tsx:75` monta `TopNavigation`), que o `AppFrame` só
renderiza em rota **fora** de `/embed` (`apps/web/app/components/AppFrame.tsx:13`).

## 71.2 — As duas saídas (são só duas)

Varri as telas embutidas. Existem exatamente dois `router.push` que levam para fora de `/embed`:

1. **`apps/web/app/conversas/page.tsx:547`** — `router.push('/configuracoes/integracao')`, no botão
   "Ir para Integrações" (`:550`) do estado vazio "Nenhum WhatsApp conectado". É esta a porta do
   vídeo: um clique aqui joga o iframe no painel inteiro da Voltr.
2. **`apps/web/app/clientes/page.tsx:918`** — `router.push(`/conversas?id=${cv.id}`)`, ao abrir uma
   conversa a partir do contato no painel 360°.

Ambas usam `useRouter` (`conversas/page.tsx:4`, `clientes/page.tsx:4`).

## 71.3 — Por que dá "Este token de embed não tem o escopo 'crm'"

A mensagem nasce em `apps/api/src/auth/require-scope.guard.ts:57` da Voltr, e está certa: o nosso
`apps/api/src/modules/voltr/voltr.controller.ts:40` faz
`const scopes: VoltrScope[] = scope === 'chat' ? ['chat'] : ['crm'];` — **um escopo por token**. Uma
vez fora do embed, qualquer clique na barra da Voltr cai em superfície que o token não cobre.

Mesmo fechando as saídas, um escopo só não basta: a saída (2) é legítima e faz parte do produto —
do contato, abrir a conversa. Para ela funcionar dentro do iframe, o token precisa de `chat` **e**
`crm`. Isso não afrouxa a trava de verdade: o portão de módulo pago continua sendo avaliado por
escopo em `apps/api/src/embed/embed.service.ts:213`-`:223`, então tenant sem `atendimento` continua
sem chat.

## 71.4 — A piscada no refresh

Medi a cor de fundo da área de conteúdo quadro a quadro no vídeo do dono: `rgb(252,254,251)` aos
2,3s (splash do `index.html`), `rgb(245,250,246)` entre 2,7s e 3,3s (canvas do painel, esverdeado) e
`rgb(244,248,248)` de 3,6s em diante (fundo real da Voltr, azulado). São **três brancos diferentes**
trocando, mais o iframe que nasce branco.

A causa estrutural está em `apps/web/src/pages/VoltrCrmPage.tsx`: o `src` do iframe só é definido
**depois** de `GET /voltr/embed-token` voltar (`:37`-`:52`), que por sua vez faz um segundo salto até
a Voltr. Até lá a área fica com o `LoadingState` sobre o canvas do painel; quando o iframe entra, o
fundo muda de tom e depois muda de novo quando a Voltr pinta. Não dá para eliminar os dois saltos
sem trocar a arquitetura, mas dá para **eliminar a troca de cor**, pintando o contêiner com o mesmo
tom do app da Voltr desde o primeiro quadro.

## 71.5 — Correção

**Lado Voltr** — um helper novo e dois pontos de uso:
- `apps/web/app/lib/embed-nav.ts` (novo): `useNoEmbed()` devolve se a rota atual está sob `/embed`,
  usando `usePathname()`. Fica em arquivo próprio porque os dois consumidores estão em pastas
  diferentes e a regra tem de ser a mesma.
- `apps/web/app/conversas/page.tsx:547`: dentro do embed o botão "Ir para Integrações" **não é
  renderizado** — vincular WhatsApp é tarefa do painel da Voltr, e botão morto é pior que botão
  ausente. O texto explicativo continua.
- `apps/web/app/clientes/page.tsx:918`: dentro do embed navega para `/embed/chat?id=…`, ficando no
  iframe, em vez de `/conversas?id=…`.

**Lado SalonPass**:
- `apps/api/src/modules/voltr/voltr.controller.ts:40`: emite o token com os dois escopos. O `scope`
  da query continua decidindo **qual tela abre** (via `embedUrl`), só não limita mais a superfície.
- `apps/web/src/pages/VoltrCrmPage.tsx`: contêiner com o fundo da Voltr desde o início, para o
  refresh não piscar entre três brancos.

**Tenant do DesignModa**: criar `Empresa` slug `designmoda` / schema `emp_designmoda` com
`modulos` (`crm` e `atendimento` pagos e ativos) e `embedOrigins`, criar o schema no Postgres com o
DDL do `apps/api/prisma/schema.prisma`, e trocar o `VOLTR_TENANT_MAP` do App Runner para apontar o
`companyId` do DesignModa para `designmoda`.
