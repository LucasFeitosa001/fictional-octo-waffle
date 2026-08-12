# Estudo 97 — O PDF dos relatórios está quebrado em quase todos

Relato do dono: *"vários estão bugados… esses PDFs tão com logos quebradas, todos eles têm que estar
lindos, ajeitados, dando pra ver os dados relevantes da forma certa"*.

Auditoria: 24 rotas de relatório abertas em produção, PDF gerado de verdade, arquivo lido e
comparado com a tela. 28 PDFs capturados; cada defeito reproduzido por um cético antes de entrar
aqui.

## 97.1 — A medida do estrago

**27 dos 28 PDFs** saem com o painel de filtros quebrado. O único que escapa é
`/reports/calendars/all`, e é justamente o único que **declara** seus filtros para o PDF.

Comparação visual (renderizei os dois):

- `agendamentos-all.pdf`: filtros em duas colunas, tabelas com cabeçalho, total geral, assinatura.
  É o padrão de qualidade que os outros deveriam ter.
- `financeiro-1-dre.pdf`: painel quebrado e o conteúdo inteiro como texto colado —
  `Total de receitasR$ 116,00Total de despesasR$ 349,14Resultado-R$ 233,14Receitas ×Despesas ×…`

## 97.2 — As causas, todas em `apps/web/src/pages/relatorios/ReportPdfButton.tsx`

1. **Painel de filtros parte no primeiro espaço** (`:236`-`:242`):
   ```
   const split = item.indexOf(' ');
   const label = item.slice(0, split);   // "Período"
   const value = item.slice(split + 1);  // "e filtros definidos na tela do relatório"
   ```
   A string de reserva (`:26`, "Período e filtros definidos na tela do relatório") vira
   `Período: e filtros definidos na tela do relatório`. E qualquer filtro com rótulo de duas
   palavras ("Data inicial 01/01") sai deformado.

2. **Período nunca chega ao PDF.** Só `/reports/calendars/all` emite `[data-report-pdf-meta]`. Num
   documento que é assinado, não dizer o período consultado o torna inauditável.

3. **Sem `<table>` → despejo de `innerText`** (`:126`-`:137`). A maioria das telas desenha o quadro
   com `div`/grid, não com `<table>`. O texto sai sem separador: `Òleo de Alecrim33R$ 66,00`,
   `31/07/20265`. Ilegível.

4. **Dado DUPLICADO.** As telas têm bloco desktop e bloco mobile (`md:hidden`). `querySelectorAll`
   pega os dois, e o `innerText` do clone também — cada linha sai duas vezes.

5. **Cards de resumo somem.** Quando existe `<table>`, só a tabela vai. Os KPIs (Entradas/Saídas/
   Saldo, totais de vendas) ficam de fora — é o dado mais importante da página.

6. **Colunas 1 e 2 trocadas** em vários (estoque, vendas, extrato). O cabeçalho usa
   `thead tr:last-child` (`:82`) e o corpo `td,th` (`:87`): quando a tabela tem uma coluna sem
   `<th>` correspondente (ação/ícone), a grade desalinha.

7. **`<tfoot>` ignorado** (`:86` lê só `tbody tr`): a linha de Total da tela não vai para o PDF.

8. **Negativo corrompido**: o menos tipográfico (−, U+2212) não existe na Helvetica do jsPDF e sai
   como aspas com dígitos espalhados. Confirmado em extrato e extrato de movimentações.

9. **Sem rodapé nem numeração** quando não há tabela: `drawFooter` só roda no `didDrawPage` do
   autoTable (`:121`).

10. **Quatro rotas sem botão de PDF**: `/reports/financial/cash-movements`,
    `/reports/financial/extract`, `/reports/financial/extract-movements`,
    `/reports/inventory/products-services` — só oferecem CSV.

11. **Texto de interface no corpo**: título, subtítulo e banners da tela são reimpressos dentro do
    relatório.

## 97.3 — Correção

Reescrever a extração para ser SEMÂNTICA em vez de raspar texto:

- ignorar o que está oculto (`display:none`, `md:hidden` fora do breakpoint) — mata a duplicação;
- ler os cards de resumo (rótulo + valor) e emiti-los como um quadro "Resumo" ANTES das tabelas;
- ler `thead`/`tbody`/`tfoot` respeitando a ordem e a contagem de colunas;
- normalizar sinais (−, –, espaços finos) para ASCII antes de escrever no PDF;
- derivar o período automaticamente do controle de datas da tela, sem exigir que cada página se
  declare;
- painel de filtros separando rótulo e valor por `:`, e sem inventar "Período" quando não há;
- rodapé com paginação em TODAS as páginas, inclusive nas sem tabela;
- quando não houver tabela nem cards, dizer honestamente que não há dados — em vez de despejar a
  interface.

E acrescentar a ação de PDF nas quatro rotas que não a têm.

## 97.4 — O que NÃO muda

Nenhuma exportação altera dado nem envia mensagem. O CSV continua. A assinatura continua sendo do
responsável, feita no PDF.
