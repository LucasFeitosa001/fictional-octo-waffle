# Estudo 38 — Comissões: a estrutura das abas é diferente do Belasis

Vídeo `screen-capture (2).webm` (427 quadros) + 5 capturas do dono. Pedido: *"veja como a parte de
comissões é diferente da nossa, ela tem que ser igual cada parte"*, com dois apontamentos precisos:
*"essa parte de comissões em aberto não tinha"* e *"tá faltando a dela de Detalhadas"*.

## As abas não batem

| Belasis | Nosso (`ComissoesResumoPage.tsx:70`-`:73`) |
|---|---|
| **Detalhadas** | Resumo |
| **Resumidas** | **Comissões em aberto** ← não existe no Belasis |
| Pagas | Comissões pagas |
| Configurações | Configurações |

O dono está certo nos dois pontos:

1. **"Comissões em aberto" é invenção nossa.** O Belasis não tem essa aba — em aberto é um *estado*
   das linhas, não uma tela. Nossas rotas `/comissoes/em-aberto` e `/comissoes/pagas`
   (`apps/web/src/App.tsx:391`-`:392`) apontam para a MESMA página, que só muda um filtro de status
   (`ComissoesResumoPage.tsx:99`-`:101`).
2. **Falta a "Detalhadas" deles.** O que temos com esse nome no menu
   (`apps/web/src/layout/Sidebar.tsx:150`) leva ao Resumo. O detalhamento item a item existe, mas
   só como DRAWER lateral, aberto pelo "Ver detalhes" de cada linha
   (`ComissoesResumoPage.tsx:794` e `:893`), não como aba de primeira classe.

## O que a "Detalhadas" do Belasis é

**Sem profissional escolhido** (captura 1): um bloco central "Filtros — Selecione um período e
escolha o profissional", com o intervalo de datas, o toggle **"Mostrar comissões anteriores"** e
uma LISTA de profissionais em cartões clicáveis — foto, nome e telefone.

**Com profissional escolhido** (captura 2): painel de filtros à esquerda (Período, Profissional,
"Mostrar comissões anteriores") e, à direita, a tabela item a item:

`Data · Item · Valor · Taxa acumulada ⓘ · Comissão · Desconto de Auxiliares · Disponível · ⚙`

Rodapé com **Comissões · Vales · Bonificações · Líquido** e o botão verde **"Pagar comissões ▲"**.

## O que já temos para apoiar

- `GET /commissions/detail` (`apps/api/src/modules/commissions/commissions.controller.ts:107`) já
  existe e o service já puxa os itens da comanda
  (`apps/api/src/modules/commissions/commissions.service.ts:232`-`:243`: `orderIds`, `items`,
  `customer`). O hook `useCommissionDetail` está em
  `apps/web/src/lib/queries/comissoes.ts:284` e já é usado pelo drawer.
- O rodapé Comissões/Vales/Bonificações/Líquido já existe no drawer
  (`ComissoesResumoPage.tsx:1014` e vizinhança).
- Pagamento em lote já existe: `POST /commission-payments/bulk`
  (`commissions.controller.ts:161`).

Ou seja: os dados e o cálculo estão prontos. O que falta é **estrutura de navegação** — promover o
detalhamento de drawer para aba, e corrigir os nomes.

## Colunas que NÃO temos

`Taxa acumulada` e `Desconto de Auxiliares` não existem em `CommissionEntry`
(`packages/db/prisma/schema.prisma`: baseAmount, commissionAmount, bonusAmount, status,
competenceDate, availableDate, signed, paymentId). "Desconto de Auxiliares" pressupõe o conceito de
auxiliar por item — existe `OrderItemAuxiliary` no schema, mas nada liga isso ao cálculo de
comissão hoje. Não vou inventar as duas colunas com zero fixo: melhor entregar as que têm dado real
e registrar estas como pendência de produto.

## Ordem

1. Renomear as abas para as do Belasis e **remover "Comissões em aberto"**.
2. Promover o detalhamento a aba "Detalhadas", com o seletor de profissional em cartões.
3. "Resumidas" fica com o que hoje é o Resumo.

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/web/src/layout/Sidebar.tsx`
- `apps/web/src/App.tsx`
