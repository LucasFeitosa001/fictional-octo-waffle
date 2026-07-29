# Estudo 44 — No celular, Comissões é cards + drawers, não tabela

Instrução do dono, com vídeo: *"no mobile é só os cards de destaque, esses resumos é pra mostrar
ao clicar em filtros vai abrindo os drawers"*.

## O que o vídeo mostra hoje

Cada profissional vira um cartão empilhado com NOVE linhas — Seleção, Comissões, Vales,
Bonificações, Líquido, Valor vendido, Status, Assinatura, e os botões Detalhes/Pagar. É o
`DataTable` transformando cada coluna numa linha do cartão. Quatro profissionais = uma rolagem
enorme antes de chegar a qualquer coisa.

## O que o Belasis faz (capturas mobile, verificado)

`grep -c '<table\|<th'` nas três capturas mobile devolve **zero**. Não existe tabela nenhuma no
celular:

- `belasis-reference/commissions-summary/mobile.html` → abas · intervalo de datas · **só os três
  cards** (`Comissões em aberto R$ 86,72`, `Comissões pagas R$ 0,00`, `Comissões a liberar
  R$ 0,00`). Nada abaixo disso.
- `belasis-reference/commissions-bulk/mobile.html` → o painel **Filtros**: *"Selecione um período
  e escolha o profissional"*, o toggle *"Mostrar comissões anteriores"*, o link **"Selecionar
  tudo"** e a lista de profissionais em cartões (nome + telefone).
- `belasis-reference/commissions/mobile.html` (Detalhadas) → vazio com *"Não há dados / Nenhuma
  comissão encontrada"* e **"Selecionar profissional"**.

Ou seja: no celular a entrada são os cards; a escolha de profissional acontece DENTRO do fluxo de
filtros, e o detalhe vem em drawer.

## Nota de lado: os rótulos das abas no mobile

As capturas mobile usam `Resumo · Comissões em aberto · Comissões pagas · Configurações` — os
nomes longos. No desktop são `Detalhadas · Resumidas · Pagas · Configurações`. Nós padronizamos
nos do desktop de propósito, e o dono já reclamou de ver os longos. Fica como está.

## O que muda

1. `ComissoesResumoPage.tsx` — no mobile, a aba Resumidas mostra abas + período + KPI cards e
   **não** renderiza a tabela por profissional (`DataTable` já é `md:` para cima em várias telas;
   aqui a lista precisa sumir de vez, não virar cartão).
2. O bottom-sheet de Filtros ganha o que a captura mostra: o toggle "Mostrar comissões
   anteriores", o link "Selecionar tudo" e os cartões de profissional (nome + telefone) —
   reaproveitando o cartão que já existe em `ComissoesDetalhadasView.tsx`.
3. Tocar num profissional abre o drawer de detalhe que já existe (`DetailDrawer`), que é o
   "vai abrindo os drawers" do pedido.

## O cartão de profissional já existe — e viraria a segunda cópia

O cartão com foto/nome/telefone está escrito em `ComissoesDetalhadasView.tsx:263`-`:285` (a lista
do estado "sem profissional escolhido"), com o `Avatar` local em `ComissoesDetalhadasView.tsx:401`
e o `formatPhone` de `apps/web/src/lib/format.ts:77`. O filtro do celular precisa exatamente
desse cartão. Extrair para `apps/web/src/components/ProfissionalCard.tsx` em vez de copiar —
duas cópias da mesma lista foi como as abas divergiram (estudo 41, "Sobra 2").

## Onde a tela decide o que renderizar

- `ComissoesResumoPage.tsx:117` — `const isMobile = useIsMobile()`, já disponível.
- `ComissoesResumoPage.tsx:800`-`:810` — o bottom-sheet de Filtros no celular (`isMobile &&
  <Drawer placement="bottom">`), que hoje recebe o mesmo `filterBody` do desktop.
- `ComissoesResumoPage.tsx:787`-`:794` — o `DataTable` do resumo por profissional, que no celular
  vira o cartão de nove linhas que aparece no vídeo.
- `ComissoesResumoPage.tsx:813`-`:821` — o `DetailDrawer`, que já é o destino do toque num
  profissional.

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`
- `apps/web/src/components/ProfissionalCard.tsx` (novo — cartão compartilhado)
- `apps/web/src/pages/comissoes/ComissoesDetalhadasView.tsx` (passa a usar o cartão compartilhado)
