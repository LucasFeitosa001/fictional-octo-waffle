# Estudo 24 — Especificação de paridade: 4 telas que o dono quer IDÊNTICAS

Referências salvas no repositório (não em /tmp — não some no reboot):
`belasis-reference/_spec-paridade/01..04.png`

Pedido literal: *"eu quero esses locais identico, o vizualizador de agendamento, o vizualizador de
comanda, editando recebimento, essa parte em transações e os demais locais que falta que o video
apresentou tem que parecer dessa mesma forma"*.

---

## 01 — Visualizando comanda #3322 (`01-visualizando-comanda.png`)

**Coluna esquerda** (largura ~310px, sem card ao redor, fundo branco):
1. Avatar circular grande (~140px) com a **FOTO REAL** do cliente
2. Nome em caixa alta, negrito, centralizado
3. Telefone + pílula verde **"Conversar"** com ícone WhatsApp, na MESMA linha
4. **Informações** — lista com ícone à esquerda, texto em azul-link:
   - 🎁 Aniversário não definido
   - 💰 R$ 0,00 em cashback
   - 💲 R$ 0,00 em crédito
   - 📋 0 comandas em aberto
   - ⚠️ 0 pagamentos em aberto
5. **Pacotes** — título negrito + `+ Adicionar` alinhado à direita; abaixo, cinza:
   "Não há pacotes disponíveis"
6. **Assinaturas** — `+ Adicionar`; "Não há assinaturas disponíveis"
7. **Anotações** — `+ Adicionar`; "Nenhuma anotação encontrada"

**Coluna direita**:
- Título "Visualizando comanda #3322" + X no canto
- Linha 1: **Cliente** (nome + telefone no mesmo campo, com chevron) | **Data** | **Número da comanda**
- **Itens da comanda**: cabeçalho Descrição ⓘ · Profissional · Qtde. · Valor unitário · Desconto ·
  Total · [☰]. O campo Desconto tem um seletor `R$ ▾` embutido à esquerda do valor.
- Bloco de totais alinhado à direita: **Desconto · Crédito · Cashback · Total**
- **Observações** (textarea, placeholder "Escreva aqui")

**Rodapé**: `Ajuda ⓘ` · `Outros ▲` · `Cancelar` · **`Excluir`** (vermelho) · **`Ver pagamentos`** (verde)

---

## 02 — Editando recebimento (`02-editando-recebimento.png`)

Drawer em **tela cheia**. Campos obrigatórios marcados com asterisco vermelho.

1. Toggle **"É uma receita organizacional?"** + hint cinza abaixo: *"Se ativo, não vincula a nenhum caixa"*
2. Linha: **Valor bruto\*** | **Taxas** | **Valor líquido** (os três desabilitados quando vindos de comanda)
3. **Descrição** — textarea larga, ocupa a linha toda
4. Linha: **Vencimento\*** (com ícone de calendário) | **Forma de pagamento\*** | **Conta\***
5. Linha: **Recebido de** | **Categoria\*** | **Baixa** (data, desabilitada)
6. Toggle **"Ajustar data de competência"**

---

## 03 — Painel Filtrar de Transações (`03-transacoes-filtros.png`)

**ATENÇÃO — meu lote anterior errou o tipo de controle.** Implementei botões de seleção
ÚNICA; a referência usa:

| Seção | Controle | Opções |
|---|---|---|
| Período | 2 campos de data | 05 jul, 2026 / 19 jul, 2026 |
| Tipo de transação | **checkbox** (multi) | Contas a receber ✓ · Contas a pagar |
| Tipo de data ⓘ | **radio** (única) | Venc/Disponibilidade · **Competência** · Pagamento ● |
| Contas | **checkbox** (multi) + rótulo "Ativas" + link **"Desmarcar tudo"** | Caixa ✓ · ITAU ✓ |
| Status | **checkbox** (multi) com CHIP COLORIDO | Bloqueado (cinza) · Disponível (azul) · Em aberto (laranja) · Atrasado (vermelho) · Pago (verde) ✓ |
| Formas de pagamento | (continua abaixo, cortado no print) | |

O que hoje está em `apps/web/src/pages/financeiro/TransacoesPage.tsx` depois do meu commit
`0a1a2fb`: Tipo de data como **dois botões** (falta Competência e falta ser radio), Contas e
Categorias como **lista de seleção única** (`OptionList`), Status como **grid de 4 botões** em vez de
5 chips coloridos multi-seleção.

**Trabalho real para ficar idêntico:**
1. Trocar Contas e Status para multi-seleção → a API aceita `accountId` string única
   (`apps/api/src/modules/financial/dto.ts:47`); precisa virar lista (`accountIds`).
2. Chips coloridos de status com as 5 cores.
3. **Competência exige coluna nova** em `Transaction` — o model só tem `dueDate` e `paidAt`
   (`packages/db/prisma/schema.prisma`, model Transaction). É migração de banco, decisão do dono.
4. "Bloqueado" e "Disponível" só fazem sentido com gateway de pagamento. **Perguntar** ao dono se
   quer os chips como estado puramente visual/manual ou se ficam de fora até existir gateway.

---

## 04 — Visualizando agendamento (`04-visualizando-agendamento.png`)

**Coluna esquerda** — mesma estrutura da comanda (item 01), com uma diferença: aqui **Pacotes** e
**Assinaturas** aparecem SEM o `+ Adicionar` (só **Anotações** tem). Confirmar se é regra ou só
estado da tela.

Avatar: cliente sem foto → ícone de pessoa em círculo cinza-claro, **não** círculo colorido com
inicial. Isso confirma o estudo 23.

**Coluna direita**:
- Linha 1: **Cliente** | **Data** | **Status** (com bolinha verde) | **Cor**
- **Itens do agendamento**: Descrição · Profissional · Horário · Duração · [🗑]
  O Horário mostra "08:00 (Indisponível)" — ou seja, o slot ocupado aparece rotulado, não some.
- Toggles em linha: **Enviar lembrete** (ligado) · **Encaixar agendamento** (desligado)
- **Além deste, repetir mais** → "Agendamento não se repete"
- **Observações**

**Rodapé**: `Ajuda ⓘ` · `Outros ▲` · `Cancelar` · `Excluir` (desabilitado aqui) ·
**`Acessar comanda`** (verde)

---

## Ordem sugerida

1. Coluna esquerda compartilhada (Informações + Pacotes/Assinaturas/Anotações + foto) — já em
   execução pelo workflow `belasis-blocos-cliente`; esta spec é o alvo exato dele.
2. Foto do cliente (estudo 23) — bloqueado até o workflow liberar os arquivos.
3. Filtros de Transações para multi-seleção + chips coloridos.
4. Editando recebimento conferido campo a campo contra `02-editando-recebimento.png`.
5. Competência: só depois de o dono decidir sobre a migração.
