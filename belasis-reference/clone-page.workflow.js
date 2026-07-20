export const meta = {
  name: 'clone-page',
  description: 'Clona 100% fiel uma página do Belasis numa página-alvo do SalonPass: analisa seções → extrai cada uma do HTML+JS → reescreve o componente themeable → verifica seção a seção',
  phases: [
    { title: 'Analisar', detail: 'enumera as seções/cards/tabelas/drawers da página' },
    { title: 'Extrair', detail: 'um agente por seção lê o HTML+JS e escreve o spec fiel' },
    { title: 'Implementar', detail: 'reescreve o componente-alvo do SalonPass, preservando os dados' },
    { title: 'Verificar', detail: 'confere seção a seção contra o HTML do Belasis' },
  ],
}

const REF = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference'
const WEB = '/home/lucssfeitosa/beautypass/beautypass/apps/web'
const P = args // { slug, route, targetFile, pageName }
const SPEC = `${REF}/_spec/${P.slug}`

const CONV = `
🚨 REGRA CRÍTICA DE RAM (máquina de 11GB): TODO grep/rg/ugrep/find DEVE receber CAMINHO DE ARQUIVO EXPLÍCITO (ex.: grep -n padrao ${REF}/${P.slug}/desktop.html  •  grep -oE '\\.classe[^{]*{[^}]*}' ${REF}/_shared/js/Wow-DM2AXxwi.js). NUNCA rode grep/ugrep RECURSIVO nem sem caminho — varre node_modules/264 bundles e estoura 10GB, matando a sessão inteira. Leia arquivos específicos, nunca o repo todo.
CONTEXTO SalonPass web (${WEB}): React 19 + Tailwind v4 + HeroUI + recharts. Objetivo: clonar 100% a estrutura visual da página "${P.pageName}" do Belasis (rota ${P.route}) no componente ${WEB}/${P.targetFile}, com CORES 100% THEMEABLE (NUNCA hex de marca hardcoded).
FONTE DA VERDADE (HTML/CSS reais capturados):
- Desktop: ${REF}/${P.slug}/desktop.html   Mobile: ${REF}/${P.slug}/mobile.html
- Esqueleto legível: ${REF}/_structure/mobile/${P.slug}.txt (se existir)
- CSS dos styled-components está DENTRO dos bundles JS: ${REF}/_shared/js/*.js — ache com grep pelos nomes de classe semânticos (.header/.total/.card-footer/.icon-wrapper/etc) e por strings visíveis. USE grep pontual, NUNCA carregue os .js inteiros (RAM).
CONVENÇÕES DE CÓDIGO (obrigatório):
- Cores só via tokens: bg-gold/text-ink/bg-canvas/bg-card/border-line/text-muted-ink/bg-primary/text-primary-foreground/bg-pink etc. Para recharts (SVG) use o hook ${WEB}/src/theme/useThemeColors.ts -> {primary,primaryStrong,pink,ink,muted,canvas,cream,chartGrid,chartAxis,palette}. Para DOM use color-mix(in oklab, var(--sp-primary) N%, transparent). ZERO hex de marca.
- Ícone de card = badge 40x40 radius 12, fundo primary@9% cor primary.
- NÃO invente dados: PRESERVE todo o data-wiring atual do componente-alvo (hooks/queries que ele já usa). Só reestruture a APRESENTAÇÃO pra bater com o Belasis. Se faltar um campo de dado pro visual do Belasis, use o que já existe e deixe um comentário // TODO: campo X.
- ⚠️ EDIÇÃO/NOVO = DRAWER LATERAL (painel deslizante que entra da DIREITA), NUNCA modal central nem formulário inline — é EXATAMENTE assim no Belasis. Os drawers de Novo/Editar estão capturados em ${REF}/${P.slug}/drawer-*.html (clone o HTML/CSS deles fielmente). USE o componente Drawer do SalonPass (${WEB}/src/components/Drawer.tsx) — leia a API dele. O botão "Novo/Adicionar/+"/ícone editar de cada linha ABRE esse drawer. Trate CADA drawer como uma SEÇÃO obrigatória do clone.
`

async function inBatches(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    out.push(...await parallel(chunk.map((it, j) => () => fn(it, i + j))))
    log(`lote ${Math.floor(i / size) + 1}/${Math.ceil(items.length / size)} (${out.length}/${items.length})`)
  }
  return out
}

// ── Fase 1: analisar — enumerar as seções da página ──────────────────────────
phase('Analisar')
const ANALYZE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['sections'],
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'title', 'kind'],
        properties: {
          key: { type: 'string', description: 'slug-curto-da-secao' },
          title: { type: 'string', description: 'título/label visível no Belasis' },
          kind: { type: 'string', description: 'tipo: header|filtro|tabela|card-metrica|grafico|tabs|drawer|lista|toolbar|paginacao' },
        },
      },
    },
  },
}
const analysis = await agent(
  `${CONV}\n\nVocê é um ANALISTA DE ESTRUTURA. Leia ${REF}/${P.slug}/desktop.html e ${REF}/${P.slug}/mobile.html (e o esqueleto) e ENUMERE, em ordem de cima pra baixo, TODAS as seções visuais da página "${P.pageName}" do Belasis: cabeçalho/toolbar, filtros, abas, KPIs/cards, tabelas (com suas colunas), gráficos, listas, paginação, etc. E OBRIGATORIAMENTE inclua, como seções kind='drawer', TODOS os drawers de Novo/Editar — leia ${REF}/${P.slug}/drawer-*.html (um por arquivo). Não pule nada. Retorne a lista estruturada.`,
  { label: `analisar:${P.slug}`, phase: 'Analisar', agentType: 'general-purpose', schema: ANALYZE_SCHEMA },
)
const sections = (analysis && analysis.sections) ? analysis.sections : []
log(`seções encontradas: ${sections.length} — ${sections.map((s) => s.key).join(', ')}`)
const ORDER = sections.map((s, i) => `${i + 1}. ${s.title} (${s.kind})`).join('\n')

// ── Fase 2: extrair cada seção → spec ────────────────────────────────────────
phase('Extrair')
await inBatches(sections, 1, (s) =>
  agent(
    `${CONV}\n\nEXTRATOR FIEL. Seção alvo: "${s.title}" (tipo ${s.kind}, key ${s.key}).\n` +
    `1) Ache essa seção no HTML (desktop+mobile) fatiando pelo texto do título com node/grep. Liste a HIERARQUIA EXATA de elementos na ordem, TODOS os textos/labels/colunas, ícones (anticon-*), tipo de gráfico recharts.\n` +
    `2) Ache o CSS styled-component correspondente nos bundles JS (grep pontual). Anote valores exatos (padding/gap/font-size/radius/border/cores→token equivalente).\n` +
    `3) Escreva um spec COMPLETO em ${SPEC}/${s.key}.md com árvore de elementos, todos os labels, tipo de gráfico, valores CSS+token, e um bloco "IMPLEMENTAÇÃO React+Tailwind themeable" com JSX sugerido. NÃO PULE nada.\n` +
    `Retorne só: "${s.key}: <n> elementos".`,
    { label: `extrair:${s.key}`, phase: 'Extrair', agentType: 'general-purpose' },
  ),
)

// ── Fase 3: implementar o componente-alvo ────────────────────────────────────
phase('Implementar')
const implResult = await agent(
  `${CONV}\n\nREESCREVA ${WEB}/${P.targetFile} para ficar 100% FIEL à página "${P.pageName}" do Belasis.\n` +
  `1) Leia TODOS os specs em ${SPEC}/*.md. Leia o arquivo atual ${WEB}/${P.targetFile} e ENTENDA seu data-wiring (hooks/queries/estado) — PRESERVE tudo isso; só reestruture a apresentação.\n` +
  `2) Ordem EXATA das seções do Belasis:\n${ORDER}\n` +
  `3) Cores 100% themeable (tokens + useThemeColors), ZERO hex de marca. Gráficos recharts de verdade quando o Belasis usa gráfico. Tabelas/drawers/paginação fiéis.\n` +
  `4) Verifique com \`cd ${WEB} && npx tsc --noEmit\` (NÃO rode vite build — RAM) e conserte até o tsc passar limpo. Não termine quebrado.\n` +
  `Retorne um resumo das seções implementadas + confirmação do tsc limpo.`,
  { label: `implementar:${P.pageName}`, phase: 'Implementar', agentType: 'general-purpose', effort: 'xhigh' },
)

// ── Fase 4: verificar seção a seção ──────────────────────────────────────────
phase('Verificar')
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['section', 'verdict', 'missing', 'mismatches'],
  properties: {
    section: { type: 'string' },
    verdict: { type: 'string', enum: ['match', 'partial', 'missing'] },
    missing: { type: 'array', items: { type: 'string' } },
    mismatches: { type: 'array', items: { type: 'string' } },
  },
}
const verdicts = await inBatches(sections, 1, (s) =>
  agent(
    `${CONV}\n\nVERIFICAÇÃO ADVERSARIAL da seção "${s.title}". Compare o Belasis (${REF}/${P.slug}/desktop.html, ${SPEC}/${s.key}.md) com a implementação atual em ${WEB}/${P.targetFile}. Liste TUDO que falta/diverge: elementos, labels, colunas, ícones, tipo de gráfico, cores hardcoded. Rigoroso: só 'match' se realmente completo e fiel; em dúvida 'partial'.`,
    { label: `verificar:${s.key}`, phase: 'Verificar', agentType: 'general-purpose', schema: VERIFY_SCHEMA },
  ),
)

const clean = verdicts.filter(Boolean)
return {
  page: P.pageName,
  target: P.targetFile,
  sections: sections.length,
  implementacao: implResult,
  pendencias: clean.filter((v) => v.verdict !== 'match').map((v) => ({ section: v.section, verdict: v.verdict, missing: v.missing, mismatches: v.mismatches })),
}
