/*
 * Workflow: refina cada rota do SalonPass usando as capturas pixel-perfect do Playwright.
 * DEPENDÊNCIA: rodar antes `belasis-reference/capture-pixel-perfect.js` (gera pixel/**).
 * Rodar: Workflow({scriptPath:'belasis-reference/pixel-refine.workflow.js'})  (Ultracode).
 *
 * Fases:
 *   1) Extrair-Especificação (por rota): agente lê pixel/desktop/<slug>/{page.png,new-open.png,pickers/**},
 *      DOM (html) e CSS computed (css.json), e produz uma SPEC-PIXEL detalhada:
 *      cores exatas, larguras, animações (duration/easing), colunas de tabela, drawer, tabs, pickers, hovers.
 *   2) Refinar-Componente (por rota): agente reescreve o(s) arquivo(s) do SalonPass pra bater 1:1 com a spec-pixel,
 *      respeitando drawer/mobile-navbar/useConfirm; roda tsc.
 *   3) Verificar (adversarial, por rota): agente compara implementação FINAL × spec-pixel × captura,
 *      reporta ainda-divergentes (score 0-100), aprovando só o que está 1:1.
 *   4) Sync + commit no repo local.
 */
export const meta = {
  name: 'pixel-refine',
  description: 'Refino pixel-perfect usando capturas dinâmicas do Belasis (screenshots/HTML/CSS computed)',
  phases: [
    { title: 'Extract-Spec', detail: 'gera SPEC-PIXEL por rota' },
    { title: 'Refine',       detail: 'reescreve pra bater 1:1' },
    { title: 'Verify',       detail: 'adversarial compare + score' },
    { title: 'Sync',         detail: 'rsync VM->local e commit' },
  ],
}

// Paths LOCAIS — o Playwright captura local, e o refino roda local via Workflow tool.
// (Pra "misturar" com AWS: pode também disparar `claude -p` na VM 32GB em paralelo — ver
//  belasis-reference/pixel-refine.vm.sh que faz o fan-out headless na VM.)
const REPO = '/home/lucssfeitosa/beautypass/beautypass'
const REF = `${REPO}/belasis-reference`
const WEB = `${REPO}/apps/web`
const PIXEL = `${REF}/pixel`

// Rotas alvo: mesmas do capture-pixel-perfect.js
const ROUTES = [
  { slug: 'calendar',              target: 'src/pages/AgendaPage.tsx',                         mod: 'Agenda' },
  { slug: 'sales',                 target: 'src/pages/ComandasPage.tsx',                       mod: 'Comandas' },
  { slug: 'clients',               target: 'src/pages/ClientesPage.tsx',                       mod: 'Clientes' },
  { slug: 'employees',             target: 'src/pages/ProfissionaisPage.tsx',                  mod: 'Profissionais' },
  { slug: 'products',              target: 'src/pages/ProdutosPage.tsx',                       mod: 'Produtos' },
  { slug: 'services',              target: 'src/pages/ServicosPage.tsx',                       mod: 'Serviços' },
  { slug: 'packages',              target: 'src/pages/PacotesPage.tsx',                        mod: 'Pacotes' },
  { slug: 'subscriptions',         target: 'src/pages/AssinaturasPage.tsx',                    mod: 'Vendas por Assinatura' },
  { slug: 'vendors',               target: 'src/pages/FornecedoresPage.tsx',                   mod: 'Fornecedores' },
  { slug: 'brands',                target: 'src/pages/MarcasPage.tsx',                         mod: 'Marcas' },
  { slug: 'finance-transactions',  target: 'src/pages/financeiro/TransacoesPage.tsx',          mod: 'Financeiro/Transações' },
  { slug: 'finance-accounts',      target: 'src/pages/financeiro/ContasPage.tsx',              mod: 'Financeiro/Cadastros' },
  { slug: 'purchases',             target: 'src/pages/controle/ComprasPage.tsx',               mod: 'Compras' },
  { slug: 'package-templates',     target: 'src/pages/controle/PacotesPredefinidosPage.tsx',   mod: 'Pacotes Predefinidos' },
]

const RAM = '🚨 RAM: grep sempre com caminho de arquivo EXPLÍCITO. Nunca recursivo/sem caminho. Nunca carregue bundles inteiros.'

const SPEC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'page', 'drawer', 'pickers', 'animations'],
  properties: {
    slug: { type: 'string' },
    page: {
      type: 'object', additionalProperties: false,
      required: ['header', 'colunas', 'notas'],
      properties: {
        header: { type: 'string', description: 'título + botões (ex: "Título Comandas + Buscar/Filtrar/Novo")' },
        colunas: { type: 'array', items: { type: 'string' }, description: 'nomes exatos das colunas na ordem' },
        estadoVazio: { type: 'string' },
        paginacao: { type: 'string' },
        notas: { type: 'string' },
      },
    },
    drawer: {
      type: 'object', additionalProperties: false,
      required: ['largura', 'titulo', 'tabs', 'camposPrincipais'],
      properties: {
        largura: { type: 'string', description: 'ex: "sm:w-[520px]" ou "1200px"' },
        titulo: { type: 'string' },
        tabs: { type: 'array', items: { type: 'string' } },
        camposPrincipais: { type: 'array', items: { type: 'string' } },
        rodape: { type: 'string' },
      },
    },
    pickers: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['label', 'tipo', 'overlayComportamento'],
        properties: {
          label: { type: 'string' },
          tipo: { type: 'string', enum: ['autocomplete', 'select', 'date', 'daterange', 'cascader', 'input'] },
          overlayComportamento: { type: 'string', description: 'ex: "dropdown 320px alt 6 items com search" ou "drawer bottom mobile"' },
          desktopMobile: { type: 'string', description: 'diferenças desktop vs mobile' },
        },
      },
    },
    animations: {
      type: 'object', additionalProperties: false,
      required: ['drawer', 'modal', 'dropdown'],
      properties: {
        drawer: { type: 'string', description: 'transition + duration + easing (do CSS computed)' },
        modal: { type: 'string' },
        dropdown: { type: 'string' },
        deleteConfirm: { type: 'string' },
      },
    },
    coresBelasis: {
      type: 'array', items: { type: 'string' },
      description: 'lista de HEX/RGB reais aparecendo nos elementos (do CSS computed) - usar como semânticas',
    },
  },
}

phase('Extract-Spec')
const specs = await parallel(ROUTES.map((R) => () =>
  agent(
    `${RAM}\nVocê é ANALISTA PIXEL-PERFECT. Rota SalonPass "${R.mod}" (${R.target}).\n` +
    `Leia estes arquivos APENAS (nunca recursivo):\n` +
    `- ${PIXEL}/desktop/${R.slug}/page.html      (DOM da tela base)\n` +
    `- ${PIXEL}/desktop/${R.slug}/page.css.json  (CSS computed dos containers-chave)\n` +
    `- ${PIXEL}/desktop/${R.slug}/new-open.html  (drawer/modal de Novo)\n` +
    `- ${PIXEL}/desktop/${R.slug}/new-panel-only.html\n` +
    `- ${PIXEL}/desktop/${R.slug}/new-open.css.json (CSS computed com drawer aberto - pega transition/duration/easing REAL)\n` +
    `- Todos os arquivos em ${PIXEL}/desktop/${R.slug}/pickers/*/overlay.html (cada picker aberto)\n` +
    `- ${PIXEL}/desktop/${R.slug}/pickers/*/css.json (CSS computed dos overlays)\n` +
    `- ${PIXEL}/mobile/${R.slug}/new-open.html   (versão mobile do drawer, se existir)\n` +
    `- ${PIXEL}/desktop/${R.slug}/delete-confirm.html (modal de excluir, se existir) + .css.json\n\n` +
    `Extraia uma SPEC-PIXEL estruturada com:\n` +
    `- page: header (título + ordem exata dos botões), COLUNAS exatas da tabela na ordem, estado vazio, paginação\n` +
    `- drawer: LARGURA REAL (do rect no css.json), título, tabs internas (se houver), campos principais, rodapé\n` +
    `- pickers: cada picker (label real + tipo: autocomplete/select/date/daterange/cascader/input; overlay real: "dropdown 320px 6 items com search"; desktop vs mobile — se mobile abre bottom-drawer)\n` +
    `- animations: LEIA transitionDuration/transitionTimingFunction dos css.json e reporte EXATO (ex: "drawer: transform 400ms cubic-bezier(0.7,0.3,0.1,1)")\n` +
    `- coresBelasis: lista de HEX/RGB que aparecem nos css.json (backgroundColor/color/borderColor dos principais)\n\n` +
    `Retorne o objeto estruturado (schema).`,
    { label: `spec:${R.slug}`, phase: 'Extract-Spec', agentType: 'general-purpose', schema: SPEC_SCHEMA },
  ),
))

phase('Refine')
// Pipeline por rota: implementa DEPOIS do spec dela ficar pronto — sem barrier.
const refined = await pipeline(
  ROUTES.map((R, i) => ({ R, spec: specs[i] })),
  ({ R, spec }) => agent(
    `${RAM}\nREFINE ${WEB}/${R.target} pra bater 1:1 com a SPEC-PIXEL abaixo. Preserve data-wiring (hooks/queries).\n\n` +
    `SPEC-PIXEL (extraído do HTML+CSS REAIS do Belasis):\n${JSON.stringify(spec, null, 2)}\n\n` +
    `Regras:\n` +
    `1) Ordem exata dos botões no header conforme spec.page.header. Colunas da tabela conforme spec.page.colunas.\n` +
    `2) Drawer com largura EXATA (spec.drawer.largura), tabs internas (spec.drawer.tabs), campos (spec.drawer.camposPrincipais), rodapé (spec.drawer.rodape).\n` +
    `3) Cada picker de spec.pickers: use EntityPicker se autocomplete/select (desktop=autocomplete unificado; mobile=drawer bottom). Datepicker antd-like.\n` +
    `4) Animações batendo spec.animations: transition-duration + timing-function no Drawer.tsx e no ConfirmDialog global (não editar globais aqui; se divergirem, reporte).\n` +
    `5) Mobile: filtros/ações via useSetPageActions (BottomNav). Excluir usa useConfirm() do ConfirmDialog global.\n` +
    `6) cd ${WEB} && npx tsc --noEmit até limpar. Não rode vite build.\n` +
    `Responda 1 parágrafo: mudanças aplicadas + 'TSC LIMPO'.`,
    { label: `refine:${R.slug}`, phase: 'Refine', agentType: 'general-purpose', effort: 'xhigh' },
  ),
  ({ R, spec }, prev) => {
    // Verify adversarial por rota — imediatamente após o refine
    const VERIFY_SCHEMA = {
      type: 'object', additionalProperties: false,
      required: ['slug', 'score', 'verdict', 'divergencias'],
      properties: {
        slug: { type: 'string' },
        score: { type: 'integer' },
        verdict: { type: 'string', enum: ['1:1', 'quase', 'divergente'] },
        divergencias: { type: 'array', items: { type: 'string' } },
      },
    }
    return agent(
      `${RAM}\nVERIFICAÇÃO ADVERSARIAL rota "${R.slug}". Rigoroso. Só '1:1' se REALMENTE bate.\n` +
      `Compare ${WEB}/${R.target} × SPEC-PIXEL abaixo × captura ${PIXEL}/desktop/${R.slug}/page.html.\n` +
      `SPEC-PIXEL:\n${JSON.stringify(spec, null, 2)}\n` +
      `Reporte score 0-100 e lista de divergências residuais (nomes de coluna erradas? drawer sem tabs? pickers não substituídos? animação com duração errada?). Máximo 6 divergências mais críticas.`,
      { label: `verify:${R.slug}`, phase: 'Verify', agentType: 'general-purpose', schema: VERIFY_SCHEMA },
    ).then((v) => ({ R, spec, refineNote: prev, verdict: v }))
  },
)

phase('Sync')
const sync = await agent(
  `Já está tudo no LOCAL. Só validar + commit:\n` +
  `1) cd ${WEB} && npx tsc --noEmit — reporte contagem de errors.\n` +
  `2) cd ${REPO} && git status --short apps/web/src | head -20 — o que mudou?\n` +
  `3) git add apps/web/src && git commit -m 'Refino pixel-perfect (captura dinâmica Belasis): <rotas>'\n` +
  `Reporte: nº arquivos mudados, tsc rc, hash do commit.`,
  { label: 'validate-commit', phase: 'Sync', agentType: 'general-purpose' },
)

return {
  totalRoutes: ROUTES.length,
  refinedOk: refined.filter((r) => r && r.verdict && r.verdict.verdict === '1:1').length,
  quase: refined.filter((r) => r && r.verdict && r.verdict.verdict === 'quase').length,
  divergentes: refined.filter((r) => r && r.verdict && r.verdict.verdict === 'divergente').length,
  detalhes: refined.filter(Boolean).map((r) => ({ slug: r.R.slug, verdict: r.verdict })),
  sync,
}
