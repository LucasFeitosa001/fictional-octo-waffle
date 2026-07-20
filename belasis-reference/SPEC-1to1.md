# Belasis 1:1 — Spec de reconstrução fiel (fonte da verdade p/ refinamento)

> Objetivo: cada página do SalonPass deve ficar **1:1 com o Belasis** — posições, tamanhos,
> espaçamentos, componentes, colunas, labels, estados vazios, modais, drawers e fluxos.
> NÃO redesenhar, NÃO simplificar, NÃO transformar tabela em card no desktop,
> NÃO trocar sidebar, NÃO mudar nomes de módulos.

## ⚡ MÁXIMA FIDELIDADE = SPEC + HTML (COMBINADOS, não escolher um)
Toda tarefa de auditoria/refino DEVE consultar as **duas fontes** — nunca só uma:

1. **Este arquivo (SPEC-1to1.md)** = *O QUE* precisa existir e por quê.
   Checklist por módulo: título/botões, colunas exatas da tabela, abas, drawer lateral,
   estados vazios, paletas, animações. É a INTENÇÃO/CONTRATO.

2. **`belasis-reference/<slug>/desktop.html`** (+ `mobile.html`, `drawer-*.html`) =
   *COMO* fica no pixel real do Belasis. É o GROUND TRUTH — a foto da tela.
   Use grep pontual (nunca recursivo, RAM) pra confirmar textos exatos, classes,
   ordem de elementos, valores de padding/gap. Se a spec for ambígua, o HTML decide.
   Se o HTML e a spec conflitam num detalhe visual → **o HTML vence** (é a foto real).
   Se um comportamento/label estiver na spec e não visível na captura → mantém a spec
   (a captura pode ser um estado específico, não cobre tudo).

Nunca refine sem consultar os dois: sem HTML você inventa; sem spec você perde o *porquê*
e o comportamento estrutural (drawer, mobile-na-navbar, tokens temáveis).

## REGRAS GLOBAIS (valem p/ todas as telas)
- **Cores = tokens themeable** (`bg-gold/text-ink/bg-canvas/bg-card/border-line/text-muted-ink/bg-primary/text-primary-foreground/bg-pink`), ZERO hex de marca hardcoded. Gráficos recharts via `useThemeColors` (paleta FIXA Belasis). Cores SEMÂNTICAS de status (verde sucesso, vermelho perigo, azul link, status de agendamento) podem ficar fixas p/ fidelidade.
- **Paleta Belasis:** sidebar azul/roxo #4F5BF6/#5158F6; item ativo #6872FF; banner topo laranja #F6B545; primário #4F5BF6; verde #40C463; vermelho #FF5B5B; bg #F7F7F8; borda #EAEAEA; texto #2E2E2E; secundário #777.
- **Tipografia:** sans (Inter-like). Títulos 24-28px 600/700; subtítulos 15-18px; texto 14px; tabela 13-14px; sidebar 14px branco 500; botões 14px 600.
- **Edição/Novo = DRAWER lateral** deslizando da direita (NUNCA modal central p/ formulário), usar `components/Drawer.tsx`. Fechar com X no topo direito. Rodapé fixo Cancelar/Salvar.
- **Botões:** primário azul/roxo radius 8-10 altura 38-44; secundário branco borda cinza; sucesso verde; perigo vermelho; icon-only transparente.
- **Tabelas:** header branco, linhas separadas por borda cinza clara, texto 13-14, links azuis, status em badges/pills, ações à direita (editar/excluir/menu/toggle), paginação no rodapé (total + páginas + "20/página" + "Vá até Página").
- **Estados vazios:** ícone cinza central + "Não há dados" + bastante espaço branco.
- **Modais:** overlay rgba preto, card central branco radius 10, ícone grande no topo em alguns, botões no rodapé direito, fade+scale.
- **Animações:** sidebar width 200ms ease; submenu collapse 180ms; tab underline 150ms; botão hover escurece + active scale .98; linha tabela hover #FAFAFA; dropdown fade+translateY(-4→0); modal overlay fade 150 + card scale .96→1; drawer slide direita 250ms ease-out; switch knob 180ms; spinner central azul/roxo; tooltip fundo escuro texto branco; toast canto inferior/superior direito fade/slide.

## LAYOUT GLOBAL
- Sidebar fixa esquerda ~228px, 100vh, azul/roxo, scroll próprio, rodapé "v5.7.12", logo "belasis," topo, perfil (avatar + "Olá, FATIMA" + "Meu perfil" + seta), botão branco grande "Novo +", item "IA" badge "Beta". Colapsada ~70px só ícones.
- Top banner laranja ~60px: "Sua assinatura vence hoje!" + "Cadastre um cartão e ganhe praticidade" + botão "Ver minha assinatura" + X.
- Área principal: padding-h ~24px, header título esquerda + ações direita (Buscar/Filtrar/Imprimir/Novo/Atualizar/Exportar), abas abaixo do título.
- Botão flutuante de chat azul/roxo bottom-right em algumas telas.

## SIDEBAR — estrutura (grupos → itens)
1. **Principal**: Painel, Agenda, Comandas, Pacotes, Vendas por Assinatura
2. **Financeiro**: Painel, Transações, Cadastros, Caixas abertos, Histórico de caixa, Belasis Pay, Notas Fiscais, Configurações
3. **Comissões**: Detalhadas, Pagas, Configurações
4. **Cadastros**: Anamneses, Convidar profissionais, Profissionais, Fornecedores
5. **Controle**: Serviços, Produtos, Pacotes Predefinidos, Categorias, Marcas, Compras, Gerador de Documentos
6. **Relatórios**: Painel, Metas
7. **WhatsApp API Oficial** (badge novo)
8. **Marketing**: Link de Agendamento, Agendamento Online, Automação de Marketing, Promoções, Avaliações, Cashback
9. **Configurações**  10. **Ajuda**  11. **Indique e ganhe**

## CHECKLIST POR MÓDULO (o que CADA tela precisa ter)

### Painel  (slug: wow → PainelPage)
Título "Olá, {nome}", filtro período + Atualizar. Cards: Vendas totais (valor, vendas do dia, badge verde %), Agendamentos (valor, linha roxa, badge verde), Comandas (valor, linha roxa, badge roxo). Abas Agendamentos/Comandas (underline azul). Gráfico barras "Tendência de Visitas", donut status. Cards: Ticket médio, Recebimento por profissional, Conversão. Mapa de calor 8h-19h × dias, células azul-claro→forte com números. Pódio/ocupação profissional (avatar vermelho, nome, barra, %, "baixa ocupação").

### Agenda  (slug: calendar → AgendaPage)
Calendário mensal, título "Julho, 2026", nav ‹ › Hoje, views Dia/Semana/Mês, botão Novo. Blocos de agendamento (horário, cliente, serviço, profissional). Drawer "Visualizando agendamento": esquerda perfil cliente; principal data/status/profissional/horário/serviço/repetir/observações; rodapé Cancelar/Salvar. Novo/editar = drawer com cliente/data/horário/profissional/serviço/status/recorrência/obs.

### Comandas  (slug: sales → ComandasPage)
Título "Comandas", botões Buscar/Filtrar/Novo. Tabela: Código, Data, Cliente(link azul), Status(badge aberto/pago), Valor, Pagamento, ações(menu/ver/editar/pagamento). Drawer "Visualizando comanda #NNNN" (X topo): esquerda foto+nome+telefone+botão verde "Conversar", Informações (aniversário/cashback/crédito/comandas aberto/pagamentos aberto), Pacotes/Assinaturas/Anotações (+Adicionar). Principal: Cliente/Data/Número/Itens (Descrição/Profissional/Qtde/Valor unit/Desconto/Total/menu). Resumo direita (Desconto/Crédito/Cashback/Total). Observações. Rodapé: Ajuda/Outros/Cancelar/Excluir(vermelho)/Ver pagamentos(verde). Pagamento: painel formas Pix/Cartão/Dinheiro + botão verde Pagar.

### Pacotes  (slug: packages → PacotesPage)
Título "Pacotes". Tabela: ID, data, cliente, status(badge), disponibilidade, valor, ações. Buscar/Filtrar/Novo, paginação. Drawer visualizar: esquerda perfil; principal dados/itens/profissional/qtde/saldo/valores/obs.

### Vendas por Assinatura  (slug: subscriptions → AssinaturasPage)
Título "Vendas por Assinatura", abas Vendas/Assinaturas, estado vazio, botão Novo. Nova assinatura (drawer): cliente/data/número/itens/profissional/valor/desconto/total; rodapé Ajuda/Cancelar/Salvar.

### Financeiro/Transações  (slug: finance-transactions → financeiro/TransacoesPage)
Título "Transações", botões Buscar/Filtrar/Calcular totais/Novo. Filtro LATERAL esquerdo: Período(2 datas), Tipo(Contas a receber/pagar), Tipo de data(Venc/Competência/Pagamento), Contas(Caixa/ITAU), Status(Bloqueado/Disponível/Em aberto/Atrasado/Pago), Formas de pagamento. Tabela: Data, Titular, Origem(link azul C#NNNN), Forma, Categoria, Valor bruto, Valor líquido, Status, Pago(toggle azul), ações. Linhas pagas fundo verde claro, "Pago" pill verde. Modal "Calcular totais": cards Total/Recebido/Pago/A pagar. Novo recebimento (drawer): valor/data/titular/forma/categoria/conta/obs, Cancelar/Salvar.

### Financeiro/Cadastros  (slug: finance-accounts → financeiro/ContasPage)
Título "Cadastros", abas Contas/Formas de pagamento/Categorias. Tabela categorias: Nome, Crédito(verde)/Débito(vermelho), Tela padrão, ações. Drawer "Conta bancária": Nome, Saldo, Acesso(select), toggle Belasis Pay, toggle Ativa, Cancelar/Salvar.

### Caixas abertos  (slug: finance-cash → financeiro/CaixasAbertosPage)
Título "Caixas abertos". Caixa/profissional, saldo inicial/entradas/saídas/dinheiro/pagamentos/total. Botões Fechar caixa/Ver detalhes/Conferência. Conferência: tabela pagamentos, totais por forma, linhas verde/vermelho, visual imprimível.

### Histórico de caixa  (slug: finance-cash-history → financeiro/CaixaHistoricoPage)
Tabela: nº caixa, responsável, usuário, data abertura, data fechamento, saldo inicial, saldo final, ações(menu). Paginação. Abre conferência.

### Notas Fiscais  (slug: invoices → financeiro/NotasFiscaisPage)
Config de notas em serviços/adicionais: NFCe/NFe/NFSe. Cards adicionais (título/descrição/thumb preto/preço mensal/Selecionar). "Precisa ser configurado". Barra inferior "1 adicional selecionado, continuar".

### Comissões  (slugs: commissions-summary/settings → comissoes/ComissoesResumoPage + ComissoesConfigPage)
Abas Detalhadas/Resumidas/Pagas/Configurações. Detalhadas: filtros período+profissionais, lista, "Buscar comissões", tabela (profissional/comissões/vales/bonificações/líquido), botão verde "Pagar comissões" (menu Pagar / Pagar com Belasis Pay), Imprimir, "Exportar para Excel". Pagamento (drawer): cards Comissões/Vales/Bonificações/Líquido, formas dinheiro/pix/cartão/transferência, Cancelar/Confirmar. Pagas: filtro lateral (período/profissional/assinadas), tabela rosada (Data/Pagamento/Profissional/Usuário/Comissões/Vales/Bonificações/Valor pago/ações). Config: regras com radios (por data pagamento/realização, por serviço/produto, assinatura digital), Salvar.

### Clientes  (slug: clients → ClientesPage + ClientePerfilTabs)
Título "Clientes", Buscar/Filtrar/Novo. Tabela: nome(link azul), e-mail, celular, nascimento, crédito, observação, ações(editar/excluir/menu), paginação. Drawer "Novo cliente" com MENU INTERNO lateral: Cadastro/Fotos/Dados/Créditos/Contatos/Agendamentos/Vendas/Pacotes/Mensagens/Anotações/Imagens e Arquivos/Assinaturas/Vendas por Assinatura. Cadastro: avatar central, nome/apelido/celular/e-mail/nascimento/CPF/gênero/profissão/obs; direita Endereço/Configurações/toggles/desconto padrão/bloquear agendamento online. Perfil cliente: cards superiores (financeiro/avaliação/cashback/dias sem retorno), abas Agenda/Vendas/Pacotes/Mensagens/Anotações/Imagens, estado vazio.

### Profissionais  (slug: employees → ProfissionaisPage)
Título "Profissionais", Buscar/Filtrar/Novo. Tabela: nome, celular, e-mail, ações. Drawer perfil (X topo, foto+nome) MENU INTERNO: Cadastro/Endereço/Usuário/Assinatura digital/Expediente/Personalizar serviços/Configurar comissões/Comissões e Auxiliares/Pagar salário/Vales e Bonificações/Permissões/Contas de banco. Expediente: horários por dia, tipo, dias ativos, pausas. Config comissões: lista serviços, select serviço, % , responsável, base "Valor bruto do serviço", excluir(vermelho). Vales: tabela rosada (Tipo/Vencimento/Valor/Observação/Pagamento), Pago verde, +Novo flutuante.

### Fornecedores  (slug: vendors → FornecedoresPage)
Título "Fornecedores", tabela nome/e-mail/telefone/celular/ações, Buscar/Filtrar/Novo. Drawer cadastro+endereço+toggles, Cancelar/Salvar.

### Serviços  (slug: services → ServicosPage)
Título "Serviços", tabela nome/valor/duração/comissão/categoria/status/ações, filtros+busca+Novo. Drawer "Editando serviço" MENU INTERNO: Cadastro/Configurações/Cashback/Cuidados/Retorno/Comissões e Auxiliares/Personalizar/Produtos consumidos/Configurar nota fiscal (Item lista serviço/CNAE/Código Serviço Municipal). Cancelar/Salvar.

### Produtos  (slug: products → ProdutosPage)
Título "Produtos", tabela imagem/nome/valor/estoque/categoria/status/ações, busca+filtro+Novo. Drawer: cadastro/preço venda/custo/estoque/categoria/marca/fornecedor/ativo/foto.

### Pacotes Predefinidos  (slug: package-templates → controle/PacotesPredefinidosPage)
Título "Pacotes Predefinidos", lista/tabela, modal tutorial possível, Novo. Drawer: nome/serviços/quantidade/valor/validade/config.

### Categorias / Marcas / Compras  (CategoriasPage / MarcasPage / controle/ComprasPage)
Categorias: tabela nome + tipo/associação + editar/excluir + Novo. Marcas: tabela nome + ações + Novo. Compras: lista, estado vazio, Novo, drawer (fornecedor/produtos/valores/forma pagamento).

### Relatórios  (RelatoriosPage hub + relatorios/*)
Abas: Favoritos/Financeiro/Agendamentos/Clientes/Vendas/Estoque/Notas Fiscais/Ranking/Mensagens. Layout: card lateral esquerdo lista de relatórios + área direita filtros + "Gerar relatório" + estrela favoritar.
- **Financeiro** (DrePage): lista (Início/Resultados Financeiros/Resultado Líquido Serviços/Produtos/Projeção Faturamento/Fluxo de Caixa/Recebimentos/Despesas/Extrato Contas/Extrato Movimentações/Histórico caixa). Filtros: Status pagamento/Período/Contas/Somente ativas/Formas/Por data de(Baixa/Vencimento/Competência)/Categorias.
- **Vendas** (VendasPage): lista (Comandas e Pacotes/Produtos e Serviços/Extrato Pacotes/Vendas por Assinatura/Histórico cashback/Avaliações pendentes). Filtros: Formato(Resumido/Detalhado)/Saldo/Renovação/Vencimento/Data venda/Status.
- **Clientes** (relatorios/ClientesPage): cards clientes novos/aniversariantes/sem retorno/inativos + gráfico barras.
- **Estoque** (EstoquePage): relatórios produtos/estoque, filtros período/produto/categoria/fornecedor.
- **Ranking** (RankingPage): ranking por profissional, período+conta, Gerar.
- **Mensagens** (MensagensPage): campanhas/mensagens, filtros período.
- **Aniversariantes** (AniversariantesPage), **Agendamentos** (relatorios/AgendamentosPage: breadcrumb "Todos os Agendamentos", Layout/Período/Colunas/Agrupar por, Gerar relatório).

### Marketing/Agendamento Online  (slug: online-booking → marketing/AgendamentoOnlinePage)
Abas: Detalhes da empresa/Configurações/Links/Canais de redes/Serviços/Horários de atendimento/Pagamentos. Config: Cor primária(seletor), Tema(select Opcional), Fluxo(select Serviços), Login obrigatório(toggle), Antecedência(select 0min), Cancelar agendamentos(toggle), Horas antecedência(campo), Status criados por clientes(select Confirmado), Clientes por horário(campo), Agrupar(toggle), Salvar. Serviços: 2 colunas Desativados/Ativados. **Preview mobile** (mockup celular preto à direita fixo: fundo escuro, cards serviços, botão roxo "Agendar agora").

### Campanhas/Automação  (slug: campaigns-marketing → marketing/CampanhasPage)
Abas Campanhas/Créditos. Créditos: card roxo gradiente (saldo 200 mensagens, Recarregar, toggle Recarga automática OFF), Histórico recargas (Data/Quantidade/Valor/Pagamento/Usuário/Status, estado vazio). Campanhas: grid de modelos (Lembrete agendamento/Recompra/Aniversário/Ganhe indicação/Confirmação/Cashback/Código Pix...), cada card título+descrição+toggle+configurar.

### Promoções  (slug: promotions → marketing/PromocoesPage)
Título/busca/filtro, tabela ou cards, Novo, estados vazio/modais.

### Avaliações  (slug: reviews → marketing/AvaliacoesPage)
Abas Painel/Avaliações/Perguntas/Configurações. Painel: cards média/estrelas, lista clientes/profissionais avatars, grade avaliações (nota/comentário/serviço/profissional). Config: mensagens solicitação + preview + salvar. Modal "não possui funcionalidade contratada" (ícone exclamação, Fechar/Contratar).

### Cashback  (slug: cashback → marketing/CashbackPage)
Abas Painel/Cupons/Configurações. Não-contratado: modal exclamação. Config: regras/percentual/prazo/status/salvar.

### Configurações  (slug: settings → ConfiguracoesPage)
Abas: Detalhes da empresa/Notificações/Personalizar/Admin/API. Personalizar: Idioma(badge Beta, select Português+bandeira), Cor(seletor cor menu). Notificações: lista preferências + toggles + textos (lançamentos retroativos/alteração faturas/múltiplos caixas). Admin: dados administrativos. API: chave/token/integração. Salvar rodapé.

### Anamneses  (slug: anamnesis → cadastros/AnamnesesPage)
Lista/gestão de fichas de anamnese (modelos), Novo, drawer de edição.

### Gerador de Documentos  (slug: document-templates → controle/GeradorDocumentoPage)
Lista de modelos de documento, Novo, editor/drawer.

## 🔴 MOBILE — FILTROS/AÇÕES VÃO NA NAVBAR (crítico, erro comum)
No mobile (<768px) os botões **Filtros / Ações / Novo NÃO ficam inline na página** — eles vão para a **BottomNav** (navbar inferior fixa). Regra obrigatória em TODA página com Buscar/Filtrar/Ações/Novo:
1. Registrar as ações via `useSetPageActions([{ key, label, icon: <IconFilter/>, onClick }], [deps])` importado de `../layout/PageActions` (ou `../../layout/PageActions` em subpastas). **Modelos prontos:** `pages/PainelPage.tsx` (~linha 847) e `pages/AgendaPage.tsx`. A `layout/BottomNav.tsx` consome `usePageActions()` e renderiza.
2. Os botões inline de Filtrar/Ações no header da página ficam **`hidden md:inline-flex`** (aparecem só no desktop). No mobile o usuário aciona pela BottomNav.
3. Ícone de filtro = `IconFilter` (de `components/icons`). Cada ação abre o mesmo drawer/painel que abriria no desktop.
NUNCA deixar botão "Filtrar" inline visível no mobile — é o erro a corrigir.

## ORDEM: desktop 1:1 primeiro (1920x1080), depois mobile responsivo (<768px: sidebar→drawer, cards empilhados, tabela→cards, form full-screen, **filtros/ações→BottomNav via useSetPageActions**).
