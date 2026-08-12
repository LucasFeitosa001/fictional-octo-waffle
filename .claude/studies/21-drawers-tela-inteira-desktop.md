# Estudo 21 — Drawers de registro devem abrir em tela inteira no desktop

Pedido do dono: *"quando eu vizualizar a comanda tem que abri a tela inteira no web não somente uma
parte, faça isso para todas as tela que só abri a metade"*.

No vídeo do Belasis (estudo 20) **todo drawer de registro** — Visualizando comanda, Visualizando
agendamento, ficha do cliente, Novo recebimento, Nova despesa — ocupa a viewport inteira. Só os
painéis auxiliares (Filtrar, seletor de data) são estreitos.

## Como o nosso componente já resolve isso

`apps/web/src/components/Drawer.tsx:15`-`:16` e `:52`: existe `widthClass`, default `sm:w-[440px]`.
`:27` documenta a prop **`fullscreen`**, e `:147` mostra o efeito: com ela o painel vira `w-full` no
desktop, ignorando `widthClass`; sem ela fica `border-l ${widthClass}` — ou seja, uma faixa lateral.

Portanto a correção é **passar `fullscreen`**, não criar componente novo. Vários drawers já fazem isso
(`ComandasPage.tsx:1228`, `AgendaPage.tsx:1598`, `NewAppointmentModal.tsx:598`, `ItemEditDrawer.tsx:173`,
`metas/MetasPage.tsx:775`, `marketing/PromocoesPage.tsx:688`, `cadastros/AnamnesesPage.tsx:816`,
`controle/GeradorDocumentoPage.tsx:503`, `financeiro/NotasFiscaisPage.tsx:702`,
`AssinaturasPage.tsx:1150` e `:1349`) — os que faltam ficaram para trás por descuido, não por decisão.

## O caso relatado

Existem **DOIS** "Visualizando comanda", e nenhum é tela cheia:

- `apps/web/src/pages/ComandasPage.tsx:1782`-`:1783` — `widthClass="sm:w-[560px]"`, sem `fullscreen`
- `apps/web/src/components/ComandaDrawer.tsx:266`-`:270` — `widthClass="sm:w-[560px]"`, sem `fullscreen`

(O sub-drawer de Pagamentos de ambos — `ComandaDrawer.tsx:887` e `ComandasPage.tsx:2481` — já tem.)

## Inventário: o que passa a ser tela cheia

Drawers de **registro** (ver/criar/editar um dado) hoje em faixa lateral:

| Arquivo:linha | Título | Largura atual |
|---|---|---|
| `pages/ComandasPage.tsx:1783` | Visualizando comanda #N | `sm:w-[560px]` |
| `components/ComandaDrawer.tsx:270` | Visualizando comanda #N | `sm:w-[560px]` |
| `pages/ClientePerfilTabs.tsx:2210` | Novo cliente | `sm:w-[760px]` |
| `pages/ClientePerfilTabs.tsx:2661` | ficha do cliente | `sm:w-[760px]` |
| `pages/MarcasPage.tsx:872` | Editar/Nova marca | `sm:w-[480px]` |
| `pages/CategoriasPage.tsx:413` | Editar/Nova categoria | `sm:w-[480px]` |
| `pages/comissoes/ComissoesResumoPage.tsx:996` | Comissão — PROFISSIONAL | `sm:w-[560px]` |
| `pages/ProdutosPage.tsx:2235` | Editar/Novo lote | `sm:w-[600px]` |
| `pages/financeiro/TransacoesPage.tsx:1828` | Nova transferência | `sm:w-[520px]` |
| `pages/cadastros/UsuariosPage.tsx:427` | Criar acesso de usuário | `sm:w-[480px]` |
| `pages/controle/ComprasPage.tsx:940` | Editar/Nova Compra | `sm:w-[640px]` |
| `components/ValeModal.tsx:80` | Novo vale | `sm:w-[440px]` |
| `components/PagarComissaoDrawer.tsx:125` | Pagar comissão | `sm:w-[560px]` |
| `components/MinhaContaDrawer.tsx:347` | Minha conta | `sm:w-[480px]` |

## O que NÃO muda, e por quê

- **Filtros** (`placement="bottom"`): `ComandasPage.tsx:1015`, `PainelPage.tsx:1168`,
  `TransacoesPage.tsx:1258`, `FinanceiroPainelPage.tsx:479`, `NotasFiscaisPage.tsx:616`,
  `ComissoesResumoPage.tsx:788`, `AnamnesesPage.tsx:482`. São painel auxiliar; no Belasis também são
  estreitos.
- **Seletores/peek da Agenda**: `AgendaPage.tsx:1404` (Selecionar uma data), `:1484` (Ocupar
  horários), `:2208` (agendamentos do dia). São pop-ups pequenos — tela cheia para escolher uma data
  seria pior.
- **Pickers dentro de outro drawer**: `CustomerPickerDrawer.tsx:94`, `ItemPickerDrawer.tsx:133`,
  `NewAppointmentModal.tsx:1218`. Abrem POR CIMA de um drawer que já é tela cheia; virar tela cheia
  também esconderia o contexto de onde o usuário veio.
- **Exportar relatório** (`EstoquePage.tsx:193`, `VendasPage.tsx:487`) e
  `RelatoriosPage.tsx:247` — folhas de ação curtas.

Se o dono quiser algum desses na tela inteira também, é a mesma prop — mas eles não são "tela pela
metade", são painéis auxiliares por desenho.

## Risco

`fullscreen` não afeta mobile (`Drawer.tsx:27` e `:147`: o ramo mobile é bottom-sheet independente),
então nada do que já foi ajustado no celular regride.
