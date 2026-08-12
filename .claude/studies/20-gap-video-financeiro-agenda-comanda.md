# Estudo 20 — Gaps do vídeo `screen-capture.webm` (Belasis) vs. nosso web

Vídeo: `/mnt/c/Users/Usuario/Downloads/screen-capture.webm` — 1920×1080, **367s**, 367 quadros a 1fps
extraídos em `scratchpad/video-fin/f_*.jpg`, 19 folhas de contato em `sheets/`, ampliações em `zoom/`.

Roteiro do vídeo, por faixa de quadros:

| Quadros | Tela |
|---|---|
| 1–60 | Painel (dashboard) — KPIs, funil, ocupação de agenda, mapa de calor |
| 61–64 | Agenda (mês) |
| 65–90 | Drawer "Visualizando agendamento" |
| 91–100 | **Configurações da Agenda** (abas Geral / Visualização / Cores) |
| 101–120 | Comandas (lista) + "Visualizando comanda #3324" |
| 121–160 | Ficha do cliente (drawer full-screen com 13 seções) |
| 161–172 | Pacotes / Vendas por Assinatura |
| 173–176 | **Financeiro → Painel** |
| 177–200 | **Financeiro → Transações** (+ painel de filtros) |
| 201–220 | Drawers **Novo recebimento / Nova despesa / Novo vale / Nova transferência** |
| 221–248 | Editando recebimento; comanda #3322 |
| 249–258 | Drawer **Pagamentos** (Dinheiro/Cartão/Outros, resumo, Faturar) |
| 261–300 | **Financeiro → Cadastros** (Contas / Formas de pagamento / Categorias) |
| 301–320 | Conta bancária, Forma de pagamento, **Caixas abertos** |
| 321–340 | Belasis Pay, **Histórico de caixa** |
| 341–360 | **Conferência de caixa** (relatório imprimível) |
| 361–367 | Notas Fiscais (bloqueado), **Financeiro → Configurações** |

## O que JÁ bate 1:1 (conferido no nosso código)

- **Menu do Financeiro**: Painel, Transações, Cadastros, Caixas abertos, Histórico de caixa,
  SalonPay, Notas Fiscais, Configurações — `apps/web/src/layout/Sidebar.tsx:132`-`:140`, mesma ordem
  do vídeo.
- **Financeiro → Configurações**: os **4 toggles** com os mesmos títulos e descrições —
  `apps/web/src/pages/financeiro/FinanceiroConfiguracoesPage.tsx:30`-`:69`.
- **Financeiro → Painel**: A receber hoje / A pagar hoje + os 4 totais Recebidos / A Receber / Pagos /
  A Pagar — `FinanceiroPainelPage.tsx:231`,`:245`,`:292`-`:334`.
- **Transações**: `Novo ▾` com Recebimento / Despesa / Vale / Transferência (`TransacoesPage.tsx:568`-`:593`),
  botão **Calcular totais** (`:557`), colunas Titular / Origem / Categoria / Valor bruto / Valor líquido /
  Status / Pago (`:361`-`:465`).
- **Cadastros**: 3 abas Contas / Formas de pagamento / Categorias — `ContasPage.tsx:804` + colunas em
  `:466`-`:603`.
- **Caixas abertos**: abas Resumido/Detalhado, Conferência de caixa, Outros pagamentos, Suprimento,
  Sangria — `CaixasAbertosPage.tsx:121`,`:289`-`:306`,`:391`-`:395`.
- **Histórico de caixa**: as 8 colunas do vídeo (Número, Abriu, Fechou, Data abertura, Data
  fechamento, Saldo inicial, Saldo conferido, Anotação) — `CaixaHistoricoPage.tsx:116`-`:180`.
- **Configurador de colunas (engrenagem)**: já é genérico no `DataTable.tsx:176`.
- **Agenda**: Visualização (Diário/Semanal/Mensal), Filtrar (profissionais + status), Ações, Novo —
  `AgendaPage.tsx:904`,`:1068`,`:1102`.
- **Drawer de agendamento**: Cliente/Data/Status/Cor, Encaixar agendamento, os 3 avisos, "Avisar o
  cliente", "Além deste, repetir mais", Observações — `NewAppointmentModal.tsx:666`-`:1165`.
- **Drawer de pagamentos da comanda**: Dinheiro/Cartão/Outros, resumo, Faturar verde —
  `ComandaDrawer.tsx:804`-`:901`.

## GAPS confirmados

### G1 — Transações: faltam 3 seções de filtro e o Status está incompleto

Nosso painel tem só 5 seções (`TransacoesPage.tsx:995`,`:1022`,`:1030`,`:1053`,`:1075`):
Tipo · Período · Status de pagamento · Formas de pagamento · Estornadas.

O vídeo (ampliação `zoom/fin-transacoes.jpg`) tem 7:

| Seção do vídeo | Temos? |
|---|---|
| Período | sim |
| Tipo de transação (Contas a receber / Contas a pagar) | sim (chamado "Tipo") |
| **Tipo de data** (Venc/Disponibilidade · Competência · Pagamento) | **NÃO** |
| **Contas** (Ativas · Desmarcar tudo · uma linha por conta) | **NÃO** |
| Status | parcial — temos 3 (all/paid/pending), o vídeo tem **5**: Bloqueado, Disponível, Em aberto, Atrasado, Pago |
| Formas de pagamento | sim |
| **Categorias** | **NÃO** |

"Estornadas" é nosso, não existe no vídeo — manter (não atrapalha).

#### O que dá para fazer hoje, e o que esbarra no modelo

Boa notícia: `apps/web/src/lib/queries/financeiro.ts:243`-`:244` **já envia** `accountId` e `categoryId`,
e `apps/api/src/modules/financial/financial.service.ts:482`-`:483` **já os aplica** no `where`. Contas e
Categorias são, portanto, só UI — nada de backend.

Duas travas reais:

1. **Tipo de data.** `financial.service.ts:484` filtra sempre por `dueDate`. O model `Transaction`
   (`packages/db/prisma/schema.prisma`) tem `dueDate` e `paidAt`, mas **não tem coluna de
   competência**. Dá para entregar *Vencimento* e *Pagamento* agora; *Competência* exigiria migração
   de schema — fica fora deste lote, anotado.
2. **Status.** `enum PaymentStatus` só tem `pending | paid | reversed`, e `PaymentStatusDto`
   (`apps/api/src/modules/financial/dto.ts:20`-`:24`) espelha isso. Dos 5 chips do vídeo:
   - *Pago* = `paid`, *Em aberto* = `pending` — já temos;
   - *Atrasado* é **derivável** (`pending` + `dueDate < hoje`) — dá para entregar como filtro;
   - *Bloqueado* e *Disponível* descrevem liberação de dinheiro pelo **gateway do Belasis Pay**. Sem
     gateway integrado, não têm significado no nosso dado — **não inventar**.

### G2 — Histórico de caixa: sem ações de linha e sem o relatório

O vídeo mostra menu por linha com **Visualizar · Reabrir · Excluir**, e "Visualizar" abre a
**Conferência de caixa**: página imprimível com cabeçalho (período, número, saldo inicial, saldo
conferido, anotação, Operador, Fechado por) e, por forma de pagamento, uma tabela
Operação(Entrada/Saída) · Data · Descrição · Categoria · Valor bruto · Juros · Valor líquido, com
totais Entradas / Saídas / Juros / Saldo. Botões Imprimir e Fechar.

No nosso `CaixaHistoricoPage.tsx` não existe **nenhuma** ação de linha (grep por
`Reabrir|Visualizar|Excluir` não retorna nada) nem rota de relatório (grep por
`Conferência de caixa` fora de `CaixasAbertosPage` não retorna nada).

### G3 — Configurações da Agenda: tela inteira não existe

O vídeo abre, pela engrenagem da Agenda, uma tela **Configurações da Agenda** com 3 abas:

- **Geral**: "Filtrar profissionais por serviço" (off) e "Bloquear horários com agendamento
  cancelado" (on), com o aviso "As configurações nesta seção se aplicam a todo o sistema e afetam
  todos os usuários."
- **Visualização**
- **Cores**: tabela Nome · Cor · Status · Ações + botão Criar, com linhas Cliente VIP, Check-in, Em
  atendimento, Retrabalho e cores nomeadas (Verde, Azul, Laranja, Vermelho, Cinza Acinzado, Cinza,
  Roxo, Rosa, Verde, Púrpura, Vermelho).

Grep por `Configurações da Agenda` em `apps/web/src` não retorna nada — a tela não existe.

### G4 — Drawer de agendamento: faltam Pacotes / Assinaturas / Anotações

O vídeo mostra, na coluna esquerda do "Visualizando agendamento", abaixo de "Informações":
**Pacotes** ("Não há pacotes disponíveis" + `+ Adicionar`), **Assinaturas** ("Não há assinaturas
disponíveis" + `+ Adicionar`) e **Anotações** ("Nenhuma anotação encontrada" + `+ Adicionar`).

Grep por `Pacotes|Assinaturas|Anotações` em `NewAppointmentModal.tsx` não retorna nada — as 3 seções
faltam. O resto da coluna (mini-perfil do cliente + Informações) já existe.

## Ordem de ataque

G1 primeiro (é o pedido explícito "principalmente todos os locais de Financeiro", é contido e
testável por endpoint), depois G2, G4 e G3.
