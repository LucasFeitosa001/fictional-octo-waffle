# Estudo 34 — "Ver cliente" quebrado e linhas de Informações clicáveis

Pedido do dono: *"acho que esses locais é clicávele me leva para cada um deles"*, sobre as 5 linhas
do bloco Informações. Na referência `belasis-reference/_spec-paridade/01-visualizando-comanda.png`
elas estão em cor de link, o que confirma a leitura.

## Bug encontrado no caminho: "Ver cliente" não vai a lugar nenhum

Três telas navegam para `/clientes/<id>`:

- `apps/web/src/components/ComandaDrawer.tsx:371`
- `apps/web/src/pages/ComandasPage.tsx:1909`
- `apps/web/src/pages/AgendaPage.tsx:1713`

Mas **essa rota não existe**. `apps/web/src/App.tsx:316` registra só
`<Route path="/clientes" element={<ClientesPage />} />`, e `apps/web/src/App.tsx:483` tem
`<Route path="*" element={<Navigate to="/" replace />} />`.

Ou seja: clicar em "Ver cliente" **descarta o drawer e joga a pessoa no Painel**, sem erro nenhum na
tela. Silencioso, e por isso ninguém reportou — parece que "não fez nada estranho", só voltou para o
começo.

## Como o perfil abre hoje

`ClientePerfilModal` (`apps/web/src/pages/ClientePerfilTabs.tsx:2605`) recebe `customer`, `isOpen` e
`onClose`, e controla a aba internamente com `useState('cadastro')` (`:2615`). O menu interno é
`PERFIL_MENU` (`apps/web/src/pages/ClientePerfilTabs.tsx:2589`-`:2603`), com os ids: `cadastro`,
`painel`, `debitos`, `creditos`, `cashback`, `agendamentos`, `vendas`, `pacotes`, `mensagens`,
`anotacoes`, `imagens`, `anamneses`, `assinaturas`.

É aberto de dentro de `ClientesPage.tsx:877`, `ComandasPage.tsx:1003` e `PacotesPage.tsx:844`.

## Correção

1. **Rota** `/clientes/:id` apontando para a mesma `ClientesPage`, que passa a ler o id da URL e
   abrir o perfil já montado. Conserta os três "Ver cliente" de uma vez.
2. **`?tab=`** para escolher a seção inicial — é o que permite cada linha de Informações levar ao
   lugar certo. `ClientePerfilModal` ganha `initialTab`.
3. **Linhas clicáveis** no bloco Informações, mapeadas para as abas que já existem:

| Linha | Aba de destino |
|---|---|
| Aniversário | `cadastro` |
| em cashback | `cashback` |
| em crédito | `creditos` |
| comandas em aberto | `vendas` |
| pagamentos em aberto | `debitos` |

O componente é compartilhado, então precisa receber o destino por prop — quem sabe navegar é a tela,
não o bloco (o drawer precisa se fechar antes de navegar, senão fica um drawer órfão por cima).

## Arquivos tocados

- `apps/web/src/App.tsx`
- `apps/web/src/pages/ClientesPage.tsx`
- `apps/web/src/pages/ClientePerfilTabs.tsx`
- `apps/web/src/components/ClienteBlocosLaterais.tsx`
- `apps/web/src/components/ComandaDrawer.tsx`
- `apps/web/src/pages/AgendaPage.tsx`
