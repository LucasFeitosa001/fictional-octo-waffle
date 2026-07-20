# Gaps Mobile SalonPass vs Belasis

## Resumo executivo (contagem por severidade)

- Alta: 4
- Média: 7
- Baixa: 4
- Match: 0
- Total analisado: 15

## Alta prioridade (severity=high) — features/estrutura faltando

### Itens do pacote
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotePerfilModal.tsx`
- Gaps:
  - Título do modal é 'Pacote #N', Belasis usa 'Itens do pacote'
  - Não há seção 'Descontos' (Valor/Crédito/Cashback) — SalonPass mostra apenas resumo estático de valor/validade
  - Falta seção 'Pagamentos' listando forma de pagamento (ex.: Cartão de Crédito)
  - Falta linha 'Total' consolidando valor bruto - descontos + créditos
  - Falta botão vermelho 'Excluir' (Belasis)
  - Falta botão amarelo 'Salvar' (edição inline no modal)
  - Falta botão verde 'Ver pagamentos' que abre detalhe financeiro
  - Modal é gerenciador de consumo (barra de progresso/Consumir 1/Desfazer) em vez do modal de edição financeira do Belasis
- Fixes:
  - Renomear título do Modal para 'Itens do pacote' (mantendo #N em subtítulo)
  - Adicionar seção 'Descontos' com 3 campos editáveis (Desconto, Crédito, Cashback) espelhando o SummaryRow do NovoPacoteDrawer
  - Adicionar seção 'Pagamentos' listando payment methods (integrar useCustomerPackage com payments) + fallback vazio
  - Adicionar rodapé com botões Excluir (danger), Salvar (primary/amarelo) e Ver pagamentos (success) — mapeados para deletePackage, updatePackage e navegação para financeiro
  - Preservar bloco de consumo/histórico como aba secundária ('Sessões') para não perder a funcionalidade atual

### Cadastros - Categorias
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/CategoriasPage.tsx`
- Gaps:
  - Rota difere: SalonPass usa /categorias, Belasis usa /financeiro/cadastros/categorias
  - Domínio errado: SalonPass gerencia categorias de PRODUTO; Belasis gerencia categorias de TRANSAÇÃO financeira
  - Sem badges de tipo (Débito / Comissão / Despesas) por categoria — Belasis exibe tipo em cada item
  - Sem campo 'tipo' no modelo/formulário (create/edit só tem nome e ativo)
  - Mobile usa DataTable (tabela) em vez de lista de cards empilhados como Belasis
  - Faltam categorias padrão financeiras (Aluguel, Comissão, Compras de Equipamentos, Despesas, Despesas Pessoais, Impostos)
  - Título 'Categorias' isolado; Belasis mostra breadcrumb/contexto 'Cadastros — Categorias'
  - Sem agrupamento/filtro por tipo (Débito/Crédito/Comissão/Despesa)
- Fixes:
  - Criar nova página FinanceiroCategoriasPage em /financeiro/cadastros/categorias focada em categorias de transação (entidade separada de ProductCategory)
  - Adicionar campo 'tipo' (enum: debito | credito | comissao | despesa) no modelo e exibir como <Chip> colorido ao lado do nome
  - Substituir DataTable por lista de cards mobile-first (ul.md:hidden) + tabela md:table, seguindo padrão Belasis
  - Popular seed com categorias padrão (Aluguel, Comissão, Compras de Equipamentos, Despesas, Despesas Pessoais, Impostos)
  - Adicionar filtro segmentado por tipo além do filtro Ativas/Inativas

### Belasis Pay - cadastro
- Arquivo: `apps/web/src/pages/financeiro/ContasPage.tsx` (rota /financeiro/belasis-pay NÃO existe)
- Gaps:
  - Rota /financeiro/belasis-pay não está registrada no App.tsx
  - Não existe página dedicada de cadastro Belasis Pay (só um InlineSwitch em ContasPage)
  - Falta seletor Tipo de pessoa (PF/PJ)
  - Falta bloco Detalhes da empresa: Razão Social, Tipo, CNPJ, Faturamento, E-mail, Telefone
  - Falta título/header 'Belasis Pay — cadastro' com resumo do onboarding PJ
  - Sem botões Cancelar / Suporte / Salvar do fluxo Belasis
  - Sem layout mobile (md:hidden) específico para o formulário
  - Sem integração/estado para submeter cadastro do gateway
- Fixes:
  - Criar apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx e registrar Route path="/financeiro/belasis-pay" em App.tsx
  - Implementar formulário PJ com campos: Razão Social, Tipo empresa (select), CNPJ (mask), Faturamento, E-mail, Telefone
  - Adicionar toggle Tipo de pessoa (PF/PJ) no topo controlando os campos exibidos
  - Rodapé fixo mobile com botões Cancelar, Suporte e Salvar (primary do tema)
  - Linkar o InlineSwitch Belasis Pay em ContasPage para navegar até /financeiro/belasis-pay quando ativado

### NFS-e - não contratada
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/NotasFiscaisPage.tsx`
- Gaps:
  - SalonPass não implementa o modal de upsell 'funcionalidade não contratada' — renderiza diretamente a página funcional de notas fiscais (abas + tabela vazia + drawer de emissão)
  - Falta o feature-gate/flag que decide entre exibir upsell ou a UI real (no Belasis mobile a rota abre modal bloqueante)
  - Sem alerta laranja explicando que NFS-e é um adicional Pro
  - Sem thumbnail de vídeo apresentando a funcionalidade 'Nota Fiscal de Serviço Adicional Pro'
  - Sem botões 'Fechar' e 'Contratar' — no SalonPass o CTA é 'Configurações financeiras' no empty state
  - Título divergente: Belasis usa 'Nota fiscal de serviço — não contratada'; SalonPass usa 'Nota fiscal de serviço' + subtítulo genérico
  - Ausência da aba/entry 'NFC-e' no upsell (Belasis lista NFS-e | NFC-e | Configurações no header do modal)
  - Empty state atual sugere configurar integração fiscal, mas não comunica que é módulo pago/contratação
- Fixes:
  - Adicionar flag de contratação (ex.: tenant.features.nfse) e, quando false, renderizar um <UpsellModal> bloqueando a rota /financeiro/notas-fiscais
  - Criar componente UpsellModal reutilizável (também servirá para Pacotes Predefinidos, Gerador de Documento, Cashback, WhatsApp) com alerta laranja + thumb de vídeo + Fechar/Contratar
  - Ajustar título dinâmico: quando não contratado, usar 'Nota fiscal de serviço — não contratada' e esconder toolbar (Buscar/Filtrar/Baixar/Emitir)
  - Substituir CTA 'Configurações financeiras' por 'Contratar' que abre link/rota de upgrade, mantendo 'Fechar' para voltar ao Painel
  - Incluir nas abas do upsell o par NFS-e | NFC-e | Configurações espelhando o Belasis, mesmo desabilitadas

## Média prioridade (severity=medium) — layout/labels diferentes

### Pacotes (lista)
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/PacotesPage.tsx`
- Gaps:
  - Bottom nav mobile nao expoe acao 'Selecionar' (bulk) esperada no Belasis (Menu | Filtros | Selecionar | Novo)
  - Sem FAB azul flutuante para 'Novo' no canto inferior direito
  - Placeholder de busca provavelmente diverge do Belasis ('Digite para buscar')
  - Card exibe '#number' com destaque; Belasis prioriza cliente + valor + badge status
  - Rotulo de status usa 'Em andamento'; Belasis usa 'Pendente' vs 'Finalizado'
  - Botoes 'Detalhes'/'Excluir' dentro do card nao existem no Belasis (acoes ficam no bottom nav via Selecionar)
  - Rodape de paginacao 'Anterior/Proxima' presente; Belasis mobile normalmente rola infinito ou usa '20 / pagina' discreto
- Fixes:
  - Registrar acao 'Selecionar' via useSetPageActions para habilitar modo selecao em massa na BottomNav
  - Adicionar FAB azul (Novo pacote) fixo no canto inferior direito em mobile
  - Renomear badge 'Em andamento' para 'Pendente' alinhando ao vocabulario Belasis
  - Ajustar placeholder do search para 'Digite para buscar' e reduzir botoes inline no card
  - Reorganizar hierarquia do card mobile: cliente em destaque, valor a direita, badge de status abaixo

### Vendas por Assinatura - Modelos
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AssinaturasPage.tsx`
- Gaps:
  - Aba Modelos abre por padrão em 'subscribers' (Assinaturas); usuário precisa clicar para ir em Modelos — Belasis rota /vendas-por-assinatura já mostra Modelos em contexto específico
  - Empty state usa 'Nenhum modelo de assinatura' em vez do padrão Belasis 'Nenhum registro' + link 'Clique aqui' para criar
  - Empty state do tab Modelos não tem CTA (button 'Novo modelo' / 'Clique aqui') no corpo — Belasis oferece atalho direto
  - BottomNav no tab Modelos só registra ação 'Novo modelo'; Belasis mostra Menu | Filtros | Novo (falta ação Filtros/Buscar)
  - Não há campo de busca no tab Modelos (Belasis tem search bar no header mobile da aba)
  - Sem FAB azul flutuante no mobile — Belasis usa FAB circular para 'Novo'
  - Header interno do tab ('Modelos de assinatura N modelo(s)' + botão Novo) duplica actions e não aparece no Belasis dessa forma
  - Falta indicador '0 registros no total' abaixo do empty state (padrão Belasis)
- Fixes:
  - Adicionar CTA 'Novo modelo' (botão + texto 'Clique aqui') dentro do EmptyState de planRows.length===0
  - Registrar useSetPageActions do tab 'plans' com Buscar/Filtrar/Novo para casar com bottom nav do Belasis
  - Padronizar textos do empty state para 'Nenhum registro' e mostrar contador 'N registros no total'
  - Considerar remover header interno duplicado quando lista vazia (deixar só o EmptyState maior, estilo Belasis)
  - Adicionar SearchField opcional no tab Modelos para filtrar planos por nome

### Vendas por Assinatura - Assinantes
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AssinaturasPage.tsx`
- Gaps:
  - Rota SalonPass é /assinaturas; Belasis usa /vendas-por-assinatura
  - Primeira aba rotulada 'Assinaturas' — Belasis usa 'Assinantes'
  - Aba 'Modelos de assinatura' — Belasis abrevia para 'Modelos' no mobile
  - Empty state não mostra contador '0 registros no total' visível abaixo da toolbar como Belasis
  - Search é toggle (oculto até clicar Buscar na BottomNav); Belasis exibe campo de busca sempre visível no topo
  - Botão 'Exportar CSV' aparece acima do empty state — Belasis não tem esse botão nesse contexto vazio
  - Ícone do empty state (IconRepeat) difere do ícone Belasis
- Fixes:
  - Renomear tab 'subscribers' de 'Assinaturas' para 'Assinantes' (e 'Modelos de assinatura' para 'Modelos' em viewport mobile)
  - Adicionar linha '0 registros no total' abaixo da tabbar/toolbar mesmo com lista vazia (usar contador de subRows.length)
  - Expor SearchField sempre visível no mobile (top da Card.Content) em vez de esconder atrás de useSetPageActions
  - Ocultar botão 'Exportar CSV' quando subRows.length === 0 para não poluir o empty state
  - Adicionar alias de rota /vendas-por-assinatura -> AssinaturasPage no App.tsx para paridade com Belasis

### Transações
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/TransacoesPage.tsx`
- Gaps:
  - Apenas 1 chip visível no mobile (Ordenado por data). Belasis mostra fileira: Contas a receber, período, Ver mais
  - Lista usa DataTable (tabela) no mobile - Belasis usa cards por lançamento
  - Sem chip de período/contas no topo mobile
  - Sem link 'Ver mais' para expor mais filtros como no Belasis
  - FAB chat inferior direito ausente (padrão Belasis mobile)
  - Paginação em botões desktop-style; Belasis usa scroll infinito/'Ver mais'
  - Coluna 'Pago' com switch fica escondida na tabela no mobile (overflow horizontal)
- Fixes:
  - Adicionar fileira horizontal de chips scrollable md:hidden: 'Contas a receber', 'Últimos 30 dias', 'Ver mais' (abre FiltrosDrawer)
  - Renderizar lista mobile como <ul className='md:hidden'> com card por transação (data, titular, valor colorido, chip status) e esconder DataTable em md:hidden
  - Substituir paginação por botão 'Ver mais' ou infinite-scroll no mobile
  - Adicionar FAB chat flutuante (canto inferior direito) reutilizando padrão do shell
  - Empty state mobile já OK — manter, apenas garantir icon/copy consistentes

### Cadastros - Formas de pagamento
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/ContasPage.tsx`
- Gaps:
  - Rota /financeiro/cadastros/formas-pagamento nao existe (SalonPass usa /financeiro/contas com aba 'formas')
  - Nao ha deep-link direto para a aba Formas de pagamento (aba selecionada por estado local, nao por URL)
  - Mobile renderiza DataTable (tabela horizontal) em vez de lista de cards nativa como Belasis
  - Skeleton loading generico via <LoadingState /> em vez de linhas skeleton estilo Belasis
  - Chip usa label 'Ordenando por Nome' vs Belasis 'Ordenado por Nome'
  - Sem itens seed default (Belasis mostra Dinheiro/Pix/Credito/Debito), SalonPass cai em EmptyState se vazio
- Fixes:
  - Adicionar rotas /financeiro/cadastros/formas-pagamento, /contas e /categorias que montam ContasPage com defaultTab correspondente e sincronizam aba <-> URL
  - Substituir DataTable no mobile por <ul className='md:hidden'> com cards (nome + taxa + prazo + toggle ativo) e manter DataTable em md:block
  - Trocar <LoadingState /> por SkeletonRows especifico (5-6 <li> com barras cinza) para casar com skeleton do Belasis
  - Ajustar copy do chip para 'Ordenado por Nome' quando ativo
  - Seed default de formas de pagamento (Dinheiro, Pix, Credito, Debito) no primeiro acesso do tenant

### Caixas abertos - Resumo
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/CaixasAbertosPage.tsx`
- Gaps:
  - Rota /financeiro/caixas-abertos/:id nao existe: SalonPass tem so /financeiro/caixas-abertos listando cards inline; Belasis abre bottom-sheet por caixa
  - Aba nomeada 'Resumido' em vez de 'Resumo' (label do Belasis)
  - Bug: no InnerCard Conferencia de caixa a linha 'Saldo inicial' aparece duplicada (linhas 277 e 281)
  - Header do card mostra numero '#N' no canto direito; Belasis coloca 'NOME #575' no titulo
  - Nao ha bottom-sheet mobile — cards em grid ocupam a viewport
  - 'Total a receber' fixo em 0 (TODO backend) — Belasis mostra valor real
  - Botao 'Fechar caixa' vermelho solido; Belasis usa outline vermelho mais discreto
- Fixes:
  - Renomear aba 'Resumido' para 'Resumo' alinhando ao Belasis
  - Remover linha duplicada 'Saldo inicial' no InnerCard resumido (manter apenas 1 ocorrencia)
  - Adicionar rota /financeiro/caixas-abertos/:id?tab=resumo|detalhado abrindo bottom-sheet com detalhe do caixa selecionado
  - Mover '#numero' para o titulo (ex.: 'FATIMA LACERDA #575') como no Belasis
  - Implementar backend para 'Total a receber' do caixa ou ocultar linha ate ter dado

### Caixas abertos - Detalhado
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/CaixasAbertosPage.tsx`
- Gaps:
  - Aba Detalhado/Resumido é state local (useState 'resumido'|'detalhado') e não lê nem escreve o querystring ?tab=detalhado — link direto sempre abre em Resumido
  - Belasis mobile mostra fluxo linear: Lançamento total, Saldo inicial, Movimentações, Saldo em caixa; SalonPass mostra Saldo em caixa mas não expõe as linhas 'Saldo inicial' e 'Movimentações' dentro do bloco Detalhado
  - Não há uma linha síntese 'Lançamento' agregando o total dos payments (Belasis mostra 'Lançamento R$ 320,00')
  - No mobile o Detalhado renderiza dois InnerCards lado a lado só em sm:, mas o card 'Outras movimentações' aparece sempre — Belasis mobile compacto foca só nos totais principais
  - Rota /financeiro/caixas-abertos/:id não existe: página lista todos os caixas abertos, não abre bottom-sheet individual pelo :id como o Belasis
  - Não é um bottom-sheet no mobile como o Belasis (é página inteira grid)
  - Header do bottom-sheet Belasis mostra 'FATIMA LACERDA #575' com tabs Resumo|Detalhado dentro do sheet — no SalonPass tabs ficam no header da página, fora do card
- Fixes:
  - Sincronizar view com useSearchParams: ler ?tab=resumido|detalhado no mount e chamar setSearchParams ao alternar Tab
  - Adicionar rota /financeiro/caixas-abertos/:id que abre um bottom-sheet (Drawer) do CashCard focado, com tabs Resumo|Detalhado internas — para bater com o padrão mobile do Belasis
  - No DetalhadoBody incluir Rows 'Saldo inicial', 'Movimentações' e uma linha resumo 'Lançamento' com o total dos payments antes da divisão por método
  - No mobile (< sm) esconder o InnerCard 'Outras movimentações' quando vazio, deixando só Lançamentos + totais — reduzir ruído para bater com o compacto Belasis
  - Renomear/uniformizar rótulo do tipo: 'resumido' → 'resumo' para casar com o querystring ?tab=resumo usado no Belasis

## Baixa (severity=low)

### Agenda
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/AgendaPage.tsx`
- Gaps:
  - Bottom nav mobile do Belasis inclui item 'Dia' (atalho para mudar view→day); SalonPass registra 'Criar' no lugar
  - Belasis exibe FAB inferior azul para novo agendamento; SalonPass depende do slot 'Criar' na BottomNav (sem FAB flutuante)
  - Header mobile: Belasis usa titulo grande 'Julho, 2026' em cinza-escuro; SalonPass usa mesma label em gold-strong (cor divergente do print)
  - Calendario mensal mobile do Belasis usa MONTH_WEEKDAYS em minusculo com ponto ('dom.', 'seg.'...); verificar se MonthView sub-componente aplica isso (constante existe mas nao vista no trecho)
- Fixes:
  - Adicionar item 'Dia' na registro do useSetPageActions apontando para setView('day') e mover 'Criar' para FAB
  - Renderizar FAB fixo (bottom-right) com IconPlus abrindo NewAppointmentModal em telas <lg, matching Belasis
  - Trocar cor do periodLabel mobile de text-gold-strong para text-ink/foreground para bater com screenshot Belasis
  - Confirmar que MonthView usa MONTH_WEEKDAYS (dom./seg./ter....) nao WEEKDAY_LETTERS

### Cadastros - Contas
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/ContasPage.tsx`
- Gaps:
  - Pílula de ordenação diz 'Ordenando por Nome' — Belasis usa 'Ordenado por Nome'
  - Contador do rodapé diz 'X no total' — Belasis usa 'X registros no total'
  - Lista mobile usa DataTable (linhas de tabela) em vez de cards empilhados típicos do Belasis mobile
  - Sem seletor visual de item ativo com dot/indicador que o Belasis exibe ao lado do nome da conta
  - Botão 'Novo' não presente no topo mobile (só na BottomNav) — Belasis exibe FAB/ação persistente
  - Ícone play-circle ao lado de 'Cadastros' pode ficar sobreposto no topo estreito de 375px
  - Aba 'Formas de pagamento' pode truncar/quebrar em 375px por ser texto longo lado a lado das outras duas
- Fixes:
  - Alterar rótulo da pílula para 'Ordenado por Nome' e do rodapé para '{n} registros no total'
  - No mobile (md:hidden) substituir DataTable por <ul> de cards com Nome + tipo (Caixa/Banco) e ações lápis/lixeira à direita
  - Reduzir o texto da aba longa no mobile (ex.: 'Formas pgto.') ou permitir wrap em 2 linhas para caber em 375px
  - Adicionar indicador de status (ponto verde/cinza) antes do nome quando active=false para diferenciar visualmente
  - Considerar esconder o botão play-circle no mobile ou movê-lo para um menu, evitando concorrer com o título

### Histórico de caixa
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/financeiro/CaixaHistoricoPage.tsx`
- Gaps:
  - Rota diverge do Belasis: SalonPass usa /financeiro/caixas/historico enquanto Belasis usa /financeiro/historico-caixa
  - Coluna 'Fechou o caixa' mostra o mesmo responsável da abertura (payload /cash-registers não expõe responsável de fechamento)
  - Coluna 'Anotação' sempre renderiza '—' (backend não retorna a anotação de fechamento)
  - Filtro 'Responsável pelo fechamento' existe visualmente no drawer mas não filtra nada (TODO no código)
  - Paginação é 100% client-side sobre allRows carregados de uma vez (endpoint /cash-registers não pagina server-side)
  - Sem indicador visual do responsável destacado no card mobile (Belasis destaca 'por FATIMA LACERDA' no card)
- Fixes:
  - Adicionar alias de rota /financeiro/historico-caixa apontando para CaixaHistoricoPage para paridade de URL com Belasis
  - Expandir o payload de /cash-registers para incluir closedByUser e closingNote e passar a renderizar de verdade (removendo os TODOs)
  - Ativar o filtro closerId (openerId) no filtered.filter uma vez que closedByUser exista
  - No card mobile, dar destaque tipográfico ao nome do responsável (ex.: 'por NOME' em uppercase abaixo do #número), replicando a hierarquia visual do Belasis
  - Mover paginação para o servidor (query param page/pageSize em /cash-registers) para escalar quando o histórico crescer

### Comissões - Resumo
- Arquivo: `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- Gaps:
  - 3 KPI cards presentes (Em aberto azul, Pagas verde, A liberar laranja) — OK
  - Barra de período clicável abre drawer de filtros — OK
  - Tabs Resumo/Em aberto/Pagas/Configurações presentes com labels ligeiramente mais longas ('Comissões em aberto/pagas') vs Belasis ('Em aberto/Pagas')
  - Abas Em aberto/Pagas filtram por status no lugar de navegar para rotas separadas (/comissoes/em-aberto, /comissoes/pagas) — divergência de fluxo vs Belasis
  - Não há FAB flutuante (Belasis mostra FAB na tela Resumo)
  - Bottom nav Belasis mostra 'Menu | Painel | Agenda | Filtros'; SalonPass registra apenas 'Filtros' + 'Exportar CSV' (Menu/Painel/Agenda vêm da BottomNav global — OK)
  - Página inclui tabela 'Comissões por profissional' abaixo dos cards (extra vs mockup mobile do Belasis, que só mostra os 3 cards na aba Resumo)
- Fixes:
  - Encurtar labels das abas mobile para 'Em aberto' e 'Pagas' (igual ao Belasis) — versão longa só no desktop
  - Fazer as abas 'Em aberto'/'Pagas' navegarem para /comissoes/em-aberto e /comissoes/pagas em vez de só alternar filtro de status
  - Considerar esconder a tabela 'Comissões por profissional' no mobile (md:hidden na tabela) para reproduzir a tela Resumo enxuta do Belasis, deixando o detalhe para as sub-rotas
  - Avaliar adicionar FAB de ação primária (ex.: 'Pagar comissão' / 'Selecionar profissional') para paridade com Belasis

## Já batendo (severity=match)

Nenhuma tela nesta análise foi classificada como match.
