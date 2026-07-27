# Estudo 26 — Segunda varredura de drawers em meia-tela

O agente `varrer:Drawer` do workflow `sweep-drawers-meia-tela` **caiu no meio** (erro de API), então
a varredura do componente `Drawer` ficou incompleta. Refiz por script, percorrendo todo
`apps/web/src` e classificando cada `<Drawer>` / `<FullDrawer>`:

- `Drawer` sem a prop `fullscreen` → abre em faixa (`apps/web/src/components/Drawer.tsx:147`)
- `FullDrawer` **com** `widthClass` → abre em faixa (`apps/web/src/components/FullDrawer.tsx:195`-`:196`)

Resultado: **24** ainda em meia-tela, fora os painéis `placement="bottom"`.

## CORRIGIR — drawers de registro (8 agora)

| Arquivo:linha | Título | Ação |
|---|---|---|
| `apps/web/src/pages/AgendamentosPage.tsx:283` | Detalhes do agendamento | +fullscreen |
| `apps/web/src/pages/ProfissionaisPage.tsx:949` | Editar profissional — X / Novo profissional (`widthClass="sm:w-[760px]"` em `:957`) | +fullscreen |
| `apps/web/src/pages/financeiro/CaixasAbertosPage.tsx:577` | Abrir/Fechar caixa · Suprimento · Sangria (título montado em `:574`) | +fullscreen |
| `apps/web/src/pages/financeiro/ContasPage.tsx:1407` | Conta bancária / Editar conta | +fullscreen |
| `apps/web/src/pages/financeiro/ContasPage.tsx:1603` | Forma de pagamento | +fullscreen |
| `apps/web/src/pages/financeiro/ContasPage.tsx:1804` | Categoria | +fullscreen |
| `apps/web/src/pages/financeiro/FinanceiroCategoriasPage.tsx:324` | Categoria | +fullscreen |
| `apps/web/src/pages/relatorios/DrePage.tsx:514` | Detalhe da categoria | +fullscreen |

Os três de `ContasPage` são confirmados pelo vídeo: em `scratchpad/video-fin/sheets/sheet_15.jpg` e
`sheet_16.jpg`, "Conta bancária", "Forma de pagamento" e "Categoria" ocupam a largura inteira, com
Cancelar/Salvar no rodapé à direita.

## ADIADO (1)

`apps/web/src/pages/financeiro/TransacoesPage.tsx:1558` — `FullDrawer` de Novo/Editar recebimento e
despesa, com `widthClass="sm:w-[520px]"` em `:1562`. É a tela `02-editando-recebimento.png` da spec
do estudo 24, que o dono quer em tela cheia. **Arquivo travado** — o workflow `belasis-blocos-cliente`
está editando agora. Aplicar assim que liberar.

## MANTER — 15 casos, por desenho

- **Pickers sobre drawer cheio**: `CustomerPickerDrawer.tsx:90`, `ItemPickerDrawer.tsx:129`.
  Virar tela cheia esconderia de onde o usuário veio.
- **Painéis de filtro**: `FilterAside.tsx:9` e `:31`.
- **Pop-ups da agenda**: `AgendaPage.tsx:1400` (Selecionar uma data), `:1480` (Ocupar horários),
  `:2204` (Agendamentos do dia).
- **Folhas de ação curtas**: `EstoquePage.tsx:190`, `VendasPage.tsx:484`,
  `financialReportKit.tsx:210` (todas "Exportar relatório"); `JustificativaDialog.tsx:58`.
- **Painéis persistentes**: `ChatSupportDrawer.tsx:123`, `NotificationBell.tsx:62`.
- **Sub-drawer**: `ProdutosPage.tsx:1832` (Movimentar estoque) — fica estreito de propósito, mas
  precisou de `zClass="z-[90]"` para não sumir atrás do FullDrawer (ver estudo 25).

## Revisão depois do feedback do dono — "Nova anotação"

`apps/web/src/pages/AgendaPage.tsx` ganhou um `<Drawer title="Nova anotação">` (criado pelo agente
do bloco Anotações). Eu o classifiquei como pop-up curto e deixei estreito. **O dono apontou que
fica cortado** — e tem razão: virou uma faixa de 440px colada na lateral enquanto o drawer de
agendamento atrás dela ocupa a tela toda, então ela recorta o conteúdo de baixo e parece um pedaço
solto.

Anotação **é um registro** (vai para `CustomerNote`), não um seletor auxiliar. Passa a `fullscreen`,
como os demais. O `zClass="z-[90]"` continua necessário: sem ele nasceria em z-[70], atrás do
`FullDrawer` do agendamento — o mesmo defeito que o verificador achou no "Movimentar estoque".

## DUVIDOSO (1) — não mexi

`apps/web/src/pages/ia/IAAtendimentoPage.tsx:1488` — "Nova conversa". É uma caixa de compor mensagem
que abre depois de escolher o destinatário, não um editor de registro. Deixei estreito; se o dono
quiser em tela cheia, é a mesma prop.
