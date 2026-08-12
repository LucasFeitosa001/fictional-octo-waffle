# Estudo 63 — Criar cliente sem régua, menu "Novo" incompleto e relatório que não alterna

Três relatos do dono, todos reproduzidos em produção com a conta dele:

> *"CRIAR CLIENTE TÁ FALTANDO AQUELE MENU VERTICAL DE TABS, QUANDO VOCE ALTEROU ISSO?"*
> *"AO CLICAR NO NOVO … TÁ FALTANDO EM PRINCIPAL, PACOTES E VENDAS POR ASSINATURA"*
> *"NENHUM DOS RELATORIOS FUNCIONA, VOCE CLICA ENTRE ITENS DA LISTA E NAO ALTERNA"*

## 63.0 — "Quando você alterou isso?" — não alterei

`git log -- apps/web/src/pages/ClientePerfilTabs.tsx` mostra que meu único commit nesse arquivo é
`7700c21` (telefone com país), e `git show 7700c21 --stat` nele: **8 linhas trocadas**, todas dentro
de `CustomerForm` (os dois campos de telefone). A régua nunca existiu na criação: `CustomerCreateModal`
(`ClientePerfilTabs.tsx:2202`-`:2220`) sempre renderizou `<Drawer>` + `<CustomerForm>` direto.
Quem tem a régua é o PERFIL de um cliente que já existe (`ClientePerfilModal`, `:2748`-`:2772`,
usando `PERFIL_MENU` de `:2593`).

Ou seja: é falta que sempre existiu, não regressão. O dono está certo sobre o QUE falta.

## 63.1 — A régua vertical na criação (referência real do Belasis)

`belasis-reference/_structure/drawers/clients--drawer-1.txt` mostra o "Novo cliente" do Belasis:
drawer com `ant-tabs.ant-tabs-left` e a lista **Cadastro** (ativa) seguida de Painel, Débitos,
Créditos, Cashback, Agendamentos, Vendas, Pacotes, Mensagens, Anotações, Imagens e Arquivos,
Anamneses e Vendas por Assinatura — todas com `ant-tabs-tab-disabled`, porque o cliente ainda não
existe.

Nosso `PERFIL_MENU` (`ClientePerfilTabs.tsx:2593`-`:2607`) já é essa lista, na mesma ordem e com os
mesmos rótulos. Falta só usá-la na criação, desabilitada.

**Correção:** extrair a régua num componente (`PerfilMenuLateral`) usado pelos dois — perfil e
criação. Na criação, só "Cadastro" clicável; as demais aparecem apagadas e explicam o porquê.

## 63.2 — O menu "Novo" não tem Pacote nem Venda por assinatura

`apps/web/src/layout/PageActions.tsx:66`-`:96` (`CREATE_GROUPS`): o grupo **Principal** tem só
`Agendamento` e `Comanda`. Pacote e Venda por assinatura existem no produto (sidebar
`Sidebar.tsx` → `/pacotes` e `/assinaturas`) mas não no atalho de criar.

Os drawers já existem e são completos, só não são exportados:
`PacoteDrawer` (`apps/web/src/pages/PacotesPage.tsx:1202`) e `NovaAssinaturaDrawer`
(`apps/web/src/pages/AssinaturasPage.tsx:915`), ambos com a mesma assinatura `{isOpen, onClose}` que
o `CreateDrawerHost` (`apps/web/src/layout/CreateDrawer.tsx:109`-`:132`) já usa para os outros.

**Correção:** exportar os dois, acrescentar os tipos `pacote` e `assinatura` e montá-los no host,
com os tiles no grupo Principal.

## 63.3 — O relatório de Vendas tem barra e submenu MORTOS

Este é o "clica e não alterna", e é literal:

- `apps/web/src/pages/relatorios/VendasPage.tsx:162`-`:177`: a barra de categorias
  (Favoritos/Financeiro/Agendamentos/…) é `<button type="button">` **sem `onClick`** — clicar não
  faz nada;
- `:186`-`:200`: o submenu lateral (`FIN_REPORTS`, `:61`) é `<div>` — **não é link nem botão**, e
  ainda marca "Resultado Líquido de Serviços" como atual (`current: true`) dentro da página de
  Vendas.

O resto do módulo está certo: `apps/web/src/pages/relatorios/reportNav.tsx` é a fonte única, com
`<NavLink>` de verdade (`:88` `ReportSubmenu`, shells em `:131`, `:157`, `:224`) — e o comentário
`:18`-`:22` já registra que o Belasis tinha esse mesmo problema de botão morto. 16 páginas de
relatório importam esse módulo; **VendasPage não importa** e reimplementou a navegação como
enfeite.

Varredura das 12 rotas de relatório em produção (`h1`, erro, vazio): nenhuma quebra, nenhuma vazia —
o que confirma que o problema é a NAVEGAÇÃO dentro da página de Vendas, não os relatórios em si.

Também sem barra de categorias (não navegam entre categorias):
`relatorios/ClientesPage.tsx`, `relatorios/AniversariantesPage.tsx`, `relatorios/RankingPage.tsx`,
`relatorios/MensagensPage.tsx` — nenhuma importa `reportNav`.

**Correção:** exportar uma barra de categorias única em `reportNav.tsx` (hoje duplicada dentro de
cada shell), fazer VendasPage usar navegação real, e dar a barra às quatro páginas que não têm.

## Arquivos

- `apps/web/src/pages/ClientePerfilTabs.tsx` — régua compartilhada + criação com Cadastro ativo.
- `apps/web/src/layout/PageActions.tsx` — Pacote e Venda por assinatura no grupo Principal.
- `apps/web/src/layout/CreateDrawer.tsx` — monta os dois drawers novos.
- `apps/web/src/pages/PacotesPage.tsx` / `apps/web/src/pages/AssinaturasPage.tsx` — exportar os drawers.
- `apps/web/src/pages/relatorios/reportNav.tsx` — `ReportCategoriesBar` exportada + lista de Vendas.
- `apps/web/src/pages/relatorios/VendasPage.tsx` — barra e submenu passam a navegar.
- `apps/web/src/pages/relatorios/{ClientesPage,AniversariantesPage,RankingPage,MensagensPage}.tsx` —
  ganham a barra de categorias.
