# Belasis — Comanda (Nova / Visualizar) — spec extraído dos frames do vídeo

Fonte: vídeo do usuário (belasis.app/sales), frames em
`/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/b219899f-68e5-40b0-a3bb-c02dbd910064/scratchpad/comanda-frames/f_*.jpg`
Frames-chave: **f_002** (Nova comanda topo), **f_003** (Visualizar #3328 completo),
**f_007/f_010** (editar item), **f_015/f_020/f_025** (ver cliente), **f_055/f_065** (pagamentos),
**f_005** (itens+desconto+pagamentos), **f_038** (aba Notas Fiscais = paywall).

## Estrutura do drawer da Comanda (lateral direita; largo no desktop)

Header: título **"Nova comanda"** (criar) / **"Visualizando comanda #NNNN"** (ver) + botão fechar (X).
Abas logo abaixo do título: **Dados** | **Notas Fiscais**  (Notas Fiscais = paywall no belasis).

### 1) Bloco Cliente
- **Vazio (criar):** botão **"Selecionar cliente"** (full-width). Ao clicar → SOBE um drawer com a
  LISTA de clientes: cada linha = **avatar (foto ou iniciais) + NOME (bold) + telefone (menor)**,
  com busca no topo. (É o pedido explícito do usuário: "subir o drawer completo da lista com
  imagens nome e numero".)
- **Preenchido:** card com **avatar + NOME (bold) + telefone** e 2 ações:
  **"Conversar"** (ícone chat → WhatsApp) e **"Ver cliente"** (ícone pessoa → perfil do cliente).

### 2) Data
- Mostrada por extenso: ex. **"segunda-feira, 20/07/2026"**. Editável (date picker). Default = hoje.

### 3) Itens da comanda
- Cada item = linha: **avatar/ícone + NOME do item + preço à direita (bold)**; 2ª linha:
  **nome do profissional (menor, com ícone) + chevron ">"** (abre editar item).
- Botão **"Selecionar item"** / "Selecionar serviço" (adiciona item). Ao clicar → picker de
  **serviços + produtos** (busca; nome + preço).
- **Editar item** (drawer): título = nome do item; rodapé **Cancelar | Salvar**.
  - Aba **Dados** (todos os itens): **Profissional** (select), **Preço** + **Quantidade**
    (mesma linha), **Desconto**, **Total** (calculado).
  - **Item de SERVIÇO** tem 3 abas (2º vídeo, item-edit-005/008): **Dados | Auxiliares |
    Produtos consumidos**.
    - *Auxiliares*: profissionais auxiliares (rateio de comissão). [precisa backend]
    - *Produtos consumidos*: **Produto** (select), **Valor**, **Lote**, **Unidade/Extra**,
      **Total** — baixa de estoque consumido no atendimento. [precisa backend: movimento de estoque]
  - **Item de PRODUTO** tem 2 abas (item-edit-002): **Dados | Lote** (rastreio de lote). [precisa backend]

> **Escopo:** a aba **Dados** é o núcleo (implementar já). *Auxiliares / Produtos consumidos / Lote*
> são avançadas e dependem de backend inexistente (rateio de comissão, movimento de estoque por
> serviço, lote de produto) → 2ª onda / confirmar com o usuário.

### 4) Desconto (f_005)
- Campos: **Desconto** (R$), **Crédito** (R$), **Cashback** (R$).

### 5) Pagamentos (f_055/f_065) — ciclo completo do pedido
- Rodapé com **"Outros ▲"** + botão verde **"Pagamentos"**.
- Drawer Pagamentos: **Valor**, **Parcelas**, **Pagamento** (data), botões **Dinheiro / Cartão / Outros**,
  lista **Pagamentos**, **Resumo da compra** (Descontos / Total / Total pago),
  **Calcular troco** + botão verde **Faturar**.

## Backend hoje (nosso)
- `POST /orders` (CreateOrderDto: customerId?, professionalId?, notes?) — **SEM date**. Adicionar `date?`.
- `POST /orders/:id/items` (AddItemDto: kind service|product, refId, professionalId?, quantity?, unitPrice, discount?).
- `DELETE /orders/:id/items/:itemId`.
- Order tem `date`, `items[]`, `discounts[]`, `payments[]`, `customer`.

## Escopo do build (create flow — foco do pedido)
MUST: (1) botão Selecionar cliente → **CustomerPickerDrawer** rico (avatar/nome/telefone, busca);
(2) **Data** editável (default hoje); (3) **Adicionar item** funcional (serviço/produto → linha com
profissional/qtde/preço/desconto/total, editar/remover, total ao vivo);
(4) Ao Salvar: `POST /orders {customerId,date,notes}` → `POST /orders/:id/items` por item → fechar.
Layout: drawer largo no desktop (coluna principal + aside de totais), bottom-sheet no mobile.
NICE (2ª onda): card do cliente com Conversar/Ver cliente; Desconto/Crédito/Cashback; Pagamentos/Faturar.
