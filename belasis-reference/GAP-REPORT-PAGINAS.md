# Relatório de Gaps — Paridade de Páginas SalonPass vs. Belasis

> Consolidação de 15 áreas auditadas campo a campo contra os drawers/páginas do Belasis.
> Paridade média ponderada por área: ~64%. Nenhuma área classificada como prioridade **alta**;
> a criticidade real está nas áreas de prioridade **média** com baixa paridade (Lotes 3%, Import XML 15%, Assinaturas 35–40%).

---

## 1. Tabela resumo

| Área | Existe? | Paridade % | Prioridade | Top gaps (curto) |
|---|:---:|:---:|:---:|---|
| Produtos — Lotes | ❌ Não | 3% | Média | Feature inexistente end-to-end (sem model, endpoint, rota, drawer) |
| Notas fiscais (compra) | ⚠️ Parcial | 15% | Média | Importar XML é fake (alert); sem input file, sem upload/parser NF-e |
| Modelos de assinatura | ✅ Sim | 35% | Média | Sem imagem, descrição, switches Ativo/Visível; itens sem preço/desconto/total |
| Assinaturas (assinantes) | ✅ Sim | 40% | Média | Grid de itens não editável; descontos e data fake; Faturar só cria vínculo |
| Formas de pagamento | ✅ Sim | 55% | Média | Faltam Taxa fixa, switch Ativa, Tipo, Favorito (todos backend) |
| Profissionais | ✅ Sim | 70% | Média | Tabs Usuário/Assinatura digital fake; comissões avançadas ausentes |
| Compras | ✅ Sim | 70% | Média | Faturar fake; Outras Despesas/Receitas descartadas; Venda/Lote/Nº NF |
| Agenda (novo agendamento) | ✅ Sim | 78% | Média | Cor/Encaixar fake; múltiplos itens ausente; lembrete parcial |
| Serviços | ✅ Sim | 78% | Média | Selects de tipo de preço/unidade fake; 6 abas avançadas placeholder |
| Clientes (cadastro/perfil) | ✅ Sim | 80% | Média | Endereço e Observações ausentes; 3 abas fake; Redes sociais só falta UI |
| Financeiro — Contas | ✅ Sim | 80% | Baixa | Acesso e Belasis Pay fake; Saldo com semântica levemente diferente |
| Produtos | ✅ Sim | 82% | Média | Registro de saída ausente; Controlar estoque fake; Cashback R$/% e switch |
| Marcas | ✅ Sim | 90% | Média | Switch Ativo não persiste → filtro de Status também é fake |
| Fornecedores | ✅ Sim | 90% | Baixa | tel-input internacional, lookup ViaCEP, Cidade dependente (tudo UI) |
| Categorias/Grupos | ✅ Sim | 95% | Baixa | Só diferenças visuais (checkbox vs switch, modal vs drawer) |

---

## 2. Falta de verdade (ordenado por impacto)

> Nenhum item foi classificado como prioridade **alta** na auditoria. A ordenação abaixo agrupa por
> prioridade (**média → baixa**) e, dentro de cada grupo, do maior para o menor impacto funcional.
> Cada gap é marcado como **[só-UI]** (backend já suporta) ou **[precisa-backend]** (falta modelo/endpoint/campo).

### 🟠 Prioridade média

**Produtos — Lotes (3%) — feature inexistente**
- Módulo de Lotes e validades inteiro ausente: sub-aba está `<SubTab disabled>` com TODO. **[precisa-backend]** — nova tabela `ProductBatch` (FK Product), CRUD `/product-batches`, cálculo de estoque agregado, drawer "Novo lote" (Produto, Lote, Fabricação, Validade, Quantidade, Estoque read-only, switch Ativo) e listagem. Sem base de dado nem UI hoje.

**Notas fiscais / Importar XML de compra (15%)**
- Botão "Importar XML" só dispara `alert('…ainda não disponível')`; nenhum drawer abre. **[só-UI]** para o drawer + input file/Buscar/campo de nome.
- Upload e parser de NF-e inexistentes: só há `GET /purchases/xmls` (listagem). **[precisa-backend]** — `POST /purchases/xmls` + parser que gera a compra a partir do XML.

**Modelos de assinatura (35%)**
- Upload de imagem/avatar do modelo (Alterar/Remover). **[precisa-backend]** — storage + campo.
- Descrição (textarea com contador 750). **[precisa-backend]**
- Switches Ativo (sugestão) e Visível (agendamento online). **[precisa-backend]**
- Itens sem Preço unitário, Desconto (R$/%) e Total por linha; só `serviceId + quantidade`. Sem "Itens avulsos" e sem Total geral calculado (usamos Mensalidade flat). **[precisa-backend]** — redesenho do modelo de composição de preço.

**Assinaturas (assinantes) (40%)**
- Grid "Itens de assinatura" não é editável (hoje read-only derivado do modelo): faltam adicionar/remover linha, "Selecionar serviço", Qtde e Valor unitário editáveis. **[precisa-backend]**
- Descontos por item (toggle R$/%) e global editável — hoje estáticos em `formatMoney(0)`. **[precisa-backend]**
- Campo Data é Input disabled travado em hoje e nunca enviado (Belasis usa date picker). **[precisa-backend]**
- Observações não persistem (`handleSave` só envia `customerId + membershipPlanId`). **[precisa-backend]**
- "Faturar" só cria vínculo cliente↔modelo, sem gerar cobrança/comanda com itens+desconto+total. **[precisa-backend]**
- Busca de cliente com avatar no topo do drawer. **[só-UI]**

**Formas de pagamento (55%)**
- Taxa fixa (R$ por transação) — sem `feeFixed`; cálculo de taxa fica incompleto. **[precisa-backend]**
- Switch Ativa — `PaymentMethod` não tem campo `active`; impossível desativar. **[precisa-backend]**
- Tipo (select de classificação) — sem campo `type`. **[precisa-backend]**
- Favorito (switch) — sem campo `favorite`. **[precisa-backend]**
- Conta vinculada / Prazo de recebimento obrigatórios (no nosso são opcionais) + tooltips. **[só-UI]** (validação/UI).

**Profissionais (70%)**
- Tab "Usuário" (login/acesso do profissional) — habilitada no Belasis, fake no nosso. **[precisa-backend]**
- Tab "Assinatura digital" — habilitada no Belasis, fake no nosso. **[precisa-backend]**
- Switch "Contratado pela Lei do Salão Parceiro" (trocado por "Notificações por WhatsApp"). **[precisa-backend]**
- Comissões avançadas: só regra salon-wide; falta por serviço/categoria + módulos Salário, Vales, Permissões, Contas de banco, Comissões e Auxiliares (todos inertes). **[precisa-backend]**
- Celular como `react-tel-input` (DDI/bandeira + máscara). **[só-UI]**

**Compras (70%)**
- Botão "Faturar" é fake — chama o mesmo `handleSave` do Salvar; não gera fatura/contas a pagar. **[precisa-backend]**
- "Outras Despesas" e "Outras Receitas" digitadas são silenciosamente descartadas (só no preview do total; ausentes no DTO). **[precisa-backend]**
- "Venda" (preço editável por item na entrada) é read-only. **[precisa-backend]**
- "Lote" é div estático fake; "Número" (Nº NF) é readonly auto-gerado, sem registrar o nº real da nota. **[precisa-backend]**
- Botão "Ajuda". **[só-UI]**

**Agenda / novo agendamento (78%)**
- Múltiplos itens do agendamento (adicionar mais de 1 serviço) — backend já aceita `items[]`. **[só-UI]** ⭐ (bom custo-benefício)
- "Encaixar agendamento" (`squeezeIn`) setado mas nunca lido no submit — não faz overbooking. **[precisa-backend]**
- Campo "Cor" é display estático "Padrão", não select nem persiste. **[precisa-backend]**
- "Enviar lembrete" parcial (anexa nota de texto em vez de agendar lembrete real). **[precisa-backend]**
- "Aplicar alterações para os próximos" + "Próximos agendamentos" ausentes (recorrência). **[precisa-backend]**
- Botão "Ajuda" (fecha o drawer) e busca de cliente no rail esquerdo. **[só-UI]**

**Serviços (78%)**
- Select de tipo de preço em "Preço de venda" é `<span>` estático (chevron decorativo). **[precisa-backend]**
- Select de unidade em "Custo adicional" (R$/%) também fake. **[precisa-backend]**
- 6 abas avançadas placeholder disabled: Cuidados, Retorno, Comissões e Auxiliares, Personalizar, Produtos consumidos, Configurar nota fiscal (fiscal/NFe e baixa de estoque por serviço ausentes). **[precisa-backend]**

**Clientes / cadastro-perfil (80%)**
- Seção Endereço completa (CEP/logradouro/número/bairro/cidade/estado/complemento) — `Customer` não tem nenhum campo de endereço. **[precisa-backend]** (migração + form) — gap real de CRM.
- Observações inline no cadastro (distinto da aba Anotações) — sem coluna `notes`. **[precisa-backend]**
- Abas placeholder fake: Mensagens, Imagens e Arquivos, Vendas por Assinatura. **[precisa-backend]**
- Redes sociais — backend JÁ suporta (`socialProfiles`), só falta renderizar inputs. **[só-UI]** ⭐ (gap barato)
- Aba Anamneses parcial (lista fichas mas sem editor de perguntas/respostas) + tooltip no Apelido. **[só-UI]**

**Produtos (82%)**
- "Registro de saída" (select obrigatório da aba Cadastro) totalmente ausente. **[precisa-backend]**
- "Controlar estoque": `trackStock` é estado local que nunca entra no body do `handleSave` — não persiste. **[precisa-backend]**
- Cashback: switch Ativo (ligar/desligar por produto) e seletor R$/% (só suporta %). **[precisa-backend]**
- Custo adicional: falta o select (tipo/unidade); Categoria obrigatória; Observações como textarea; tooltip e divisória "Estoque". **[só-UI]**

**Marcas (90%)**
- Switch "Ativo" existe e alterna mas NÃO persiste (`handleSave` envia só `{name}`); API `/brands` não suporta `active` (TODO explícito). **[precisa-backend]**
- Como consequência, o filtro de Status (Ativos/Inativos) da listagem é fake — "Inativos" sempre retorna vazio. **[precisa-backend]** (mesmo campo).

### 🟡 Prioridade baixa

**Financeiro — Contas (80%)**
- Campo "Acesso" (admin_only) é Select hardcoded com onChange no-op — não persiste restrição. **[precisa-backend]**
- "Belasis Pay" é display/redirect; sem integração de gateway (equivalente SalonPass inexistente). **[precisa-backend]** (fora de escopo de paridade).
- "Saldo" mapeia para `initialBalance` e não para saldo corrente com spinner — semântica levemente diferente, mas funcional. **[só-UI]**

**Fornecedores (90%)**
- `react-tel-input` (bandeira/DDI/máscara) em Celular e Telefone. **[só-UI]**
- Auto-preenchimento de endereço via CEP (lookup ViaCEP). **[só-UI]** ⭐
- Cidade como select dependente do Estado (hoje texto livre). **[só-UI]**

**Categorias/Grupos (95%)**
- Sem gap funcional. "Ativo" como ant-switch (hoje checkbox) e apresentação como Drawer lateral (hoje Modal). **[só-UI]** — cosmético.

---

## 3. Já OK / paridade alta

Áreas com núcleo sólido e wired ao backend — pouco ou nenhum trabalho crítico:

- **Categorias/Grupos (95%)** — paridade de formulário completa (Nome + Ativo wired). Temos até **extras** sobre o Belasis: botão Excluir na edição, validação de nome, loading e tratamento de erro. Nada ausente nem fake.
- **Marcas (90%)** — todo o drawer em paridade (título, fechar, Nome obrigatório wired, Cancelar/Salvar ligados). Único gap é a persistência do switch Ativo.
- **Fornecedores (90%)** — todos os campos presentes e wired; gaps são só refinamentos de UX (tel-input, ViaCEP, cidade dependente).
- **Produtos (82%)** — aba Cadastro forte; gaps são campos secundários (Registro de saída, Cashback avançado).
- **Clientes (80%)** — núcleo do cadastro sólido: Foto (upload real), Nome, Apelido, contatos, datas, documentos, Dependentes, Indicado por, Tags, Desconto e switches — todos funcionais. Temos **mais** toggles que o Belasis (WhatsApp e SMS separados). 10 das 13 abas são reais e wired.
- **Financeiro — Contas (80%)** — CRUD central wired; gaps são campos acessórios (Acesso, Belasis Pay). Temos campo extra "Tipo" (Caixa/Banco).
- **Agenda (78%)** — fluxo de criação funcional; gaps concentrados em recorrência/encaixe/cor.
- **Serviços (78%)** — aba Cadastro com paridade forte (upload, Nome, Categoria, Preço, Custo, Comissão, Duração, Descrição wired); gaps nas abas avançadas (também disabled no create do Belasis).

---

## 4. Recomendação de ordem de execução (custo-benefício)

Ordenado para maximizar valor entregue por esforço. Waves 1–2 são baratas e destravam funcionalidade real; waves 3–4 são investimentos maiores de backend.

### Wave 1 — Quick wins só-UI (backend já suporta) ⚡
Alto valor, custo mínimo, sem migração:
1. **Clientes → Redes sociais**: renderizar inputs (`socialProfiles` já existe no backend).
2. **Agenda → Múltiplos itens do agendamento**: backend já aceita `items[]`; adicionar botão "adicionar item" + linhas. Alto valor operacional.
3. **Fornecedores → lookup ViaCEP** (preenche logradouro/bairro/estado/cidade) + `react-tel-input`.
4. **Formas de pagamento → validações**: tornar Conta e Prazo obrigatórios + tooltips.
5. **Produtos → refinos de Cadastro**: Categoria obrigatória, Observações como textarea, divisória "Estoque", tooltip do estoque mínimo.
6. **Agenda → botão Ajuda + busca de cliente no rail** (trivial).

### Wave 2 — Campos de backend baratos (1 coluna/flag cada) 💰
Pequena migração, destravam funcionalidade visível:
7. **Marcas → campo `active`**: persiste o switch Ativo E conserta o filtro de Status (dois gaps por um campo).
8. **Produtos → persistir `trackStock`**: o toggle já existe no front, só falta entrar no body + flag no backend.
9. **Formas de pagamento → `feeFixed`, `active`, `type`, `favorite`**: 4 campos que elevam a área de 55% → ~90%.
10. **Financeiro Contas → campo `admin_only`** (Acesso): persistir restrição.

### Wave 3 — Módulos de backend médios 🔨
Valor alto, exigem modelagem:
11. **Clientes → Seção Endereço** (migração + form): gap real de CRM de salão.
12. **Clientes → Observações inline** (coluna `notes`).
13. **Compras → Faturar real + Outras Despesas/Receitas + Nº NF editável**: corrige comportamento enganoso (Faturar fake) e persistência descartada.
14. **Produtos → Registro de saída + Cashback (switch Ativo + R$/%)**.
15. **Serviços → selects reais de tipo de preço e unidade de custo**.

### Wave 4 — Grandes investimentos (features novas) 🏗️
Maior esforço; agendar conforme roadmap de produto:
16. **Produtos — Lotes** (3% → feature completa): nova tabela `ProductBatch`, CRUD, cálculo de estoque, drawer e listagem, alertas de validade.
17. **Notas fiscais / Importar XML**: upload + parser de NF-e (`POST /purchases/xmls`) — desbloqueia entrada automatizada de compras.
18. **Assinaturas + Modelos de assinatura** (35–40%): redesenho do grid de itens (preço/desconto/total por linha, itens avulsos), imagem, descrição, switches, Faturar com cobrança real.
19. **Profissionais — módulos financeiros avançados**: Usuário, Assinatura digital, comissão por serviço, Salário, Vales, Permissões, Contas de banco.

> **Nota de arquitetura (memória do projeto):** ao implementar/ajustar qualquer drawer, seguir o padrão mobile — drawers/modais sobem de baixo (bottom-sheet), listas mobile sem Card wrapper, padding lateral só do DashboardLayout. Isso favorece migrar "Categorias" e "Marcas" de Modal para Drawer quando houver toque.
