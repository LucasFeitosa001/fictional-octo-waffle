# Estudo 96 — PDF e assinatura em todos os relatórios

## Evidências

- `apps/web/src/pages/relatorios/financialReportKit.tsx:196-245` tinha o
  `ExportDrawer`; a opção PDF estava desabilitada e marcada “Em breve”.
- `apps/web/src/pages/relatorios/*Page.tsx` exportava CSV em vários relatórios,
  mas não havia uma ação comum de PDF.
- `apps/web/src/pages/relatorios/reportNav.tsx:172-295` concentra as cascas
  Financeiro, Agendamentos e Estoque; `reportShared.tsx` é usado também por
  Clientes, Ranking, Vendas, Mensagens e Aniversariantes.
- `apps/web/src/index.css:1149-1170` já possui infraestrutura de impressão para
  comandas, mas ela esconde o aplicativo inteiro e não atende relatórios.

## Decisão

Adicionar uma ação compartilhada “Gerar PDF” em `BackToReports` e no hub de
Relatórios. Ela abre uma cópia limpa do conteúdo de `.mobile-page-content` no
diálogo nativo de impressão (o usuário escolhe “Salvar como PDF”), com um campo
para o nome do responsável e bloco de assinatura/data no final. O PDF funciona
para todas as rotas existentes sem depender de endpoint novo ou biblioteca
externa; o CSV continua disponível.

## Critério

Nenhuma exportação altera dados ou envia mensagens. O nome informado é apenas
impresso no documento; a assinatura manuscrita/digital continua sendo feita no
PDF pelo responsável.
