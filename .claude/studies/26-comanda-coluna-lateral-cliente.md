# Estudo 26 — Comanda: coluna lateral esquerda (mini-ficha do cliente)

Superfície: drawer **"Visualizando comanda #N"**. Objetivo: ligar o componente compartilhado
`ClienteBlocosLaterais` (Pacotes / Assinaturas / Anotações) e transformar o corpo do drawer em
duas colunas no desktop, como o Belasis.

## 1. Evidência de vídeo

- `video-fin/f_0090.jpg` — comanda #3324 aberta de `belasis.app/sales`. Coluna fixa à esquerda
  (x≈0..238 de 1280, ~240px): avatar redondo grande, nome em caixa alta, telefone + pílula verde
  "Conversar"; abaixo, **Informações** (5 linhas com ícone: "Aniversário em 21, abril",
  "R$ 0,00 em cashback", "R$ 0,00 em crédito", "0 comandas em aberto", "0 pagamentos em aberto"),
  **Pacotes** ("Não há pacotes disponíveis" + `+ Adicionar`), **Assinaturas** ("Não há assinaturas
  disponíveis" + `+ Adicionar`) e **Anotações** ("Nenhuma anotação encontrada" + `+ Adicionar`).
  O conteúdo da comanda começa em x≈250.
- `video-fin/f_0245.jpg` — comanda #3322 aberta do Financeiro → Transações. **Coluna idêntica**;
  a única diferença é a 1ª linha de Informações virar "Aniversário não definido" (cliente sem
  data de nascimento). Ou seja: os dois pontos de entrada compartilham a mesma coluna.
- O vídeo **nunca clica** em nenhum dos três `+ Adicionar` (nem em 87-90, nem em 241-260), e
  **nunca mostra** os três blocos preenchidos. Não há como copiar dali o destino do link.

## 2. Arquivo que vou editar (único)

### `/home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/ComandaDrawer.tsx`

É o drawer **vivo**: `ComandasPage.tsx:11` importa e `:993` renderiza `<ComandaDrawer …/>`;
`AgendaPage.tsx:8` e `:1398` idem. Estado atual, linha a linha:

- `ComandaDrawer.tsx:271` — já é `fullscreen` (estudo 21 aplicado), então há espaço para 2 colunas.
- `ComandaDrawer.tsx:333` — `<div className="flex flex-col gap-4">`: o corpo é **coluna única**.
  É esta linha que vira o contêiner `lg:flex-row` com `<aside>` + `<div>` de conteúdo.
- `ComandaDrawer.tsx:334`-`:345` — abas "Dados | Notas Fiscais". Não existem no Belasis, mas são
  nossas e pertencem ao conteúdo: vão para a coluna da direita.
- `ComandaDrawer.tsx:347`-`:357` — `{/* (1) Card do cliente + ações. */}` + `<OrderCustomerCard …/>`.
  Este bloco migra inteiro para dentro do `<aside>`; os três blocos entram logo depois dele.
- `ComandaDrawer.tsx:359`-`:365` — `{/* (2) Data por extenso. */}`, primeiro item da coluna direita.
- `ComandaDrawer.tsx:508`-`:563` — `OrderCustomerCard`: avatar (`:538`), nome (`:540`), telefone
  (`:541`) e o grid de 2 botões Conversar (`:551`) / Ver cliente (`:558`). **Não vou mexer no card**
  além de ele passar a viver na coluna — o bloco "Informações" fica fora deste lote (seção 5).
- `ComandaDrawer.tsx:566` — `AddDiscountInline`: precedente de formulário inline neste mesmo
  arquivo (input + Cancelar/Aplicar dentro de uma caixa). É o padrão que a composição de anotação
  copia, para não inventar um sub-drawer que o vídeo não mostra.
- `ComandaDrawer.tsx:1`-`:43` — bloco de imports onde entram `ClienteBlocosLaterais` e `useCreateNote`.

## 3. O que já existe e vai ser usado (nada de endpoint novo)

- `apps/web/src/components/ClienteBlocosLaterais.tsx:44` — componente compartilhado; busca os
  próprios dados a partir de `customerId` (`:59` `useCustomerPackages`, `:60` `useCustomerNotes`).
  `:76` devolve `null` sem cliente — cobre a comanda avulsa sem `if` extra do meu lado.
  `:113` documenta que Assinaturas é sempre vazio por falta de filtro por cliente na API.
- `apps/web/src/lib/queries/clientes.ts:366` — `useCreateNote(id)` → `POST /customers/:id/notes`,
  invalida `['customer-notes', id]` (`:372`), que é exatamente a chave que o bloco Anotações lê
  (`clientes.ts:358`). Logo, salvar uma anotação atualiza o bloco sozinho.
- `apps/web/src/pages/ClientePerfilTabs.tsx:1747` — `AnotacoesTab`, a UI de criação de anotação que
  já existe no nosso app (textarea + botão "Adicionar", erro em `text-xs text-danger` em `:1777`).
  A composição inline da comanda reusa esse comportamento, não inventa outro.
- `apps/web/src/lib/types.ts:316` — `OrderDetail.customerId`, e `:328` `customer?: Customer | null`:
  o id do cliente já vem no `GET /orders/:id`, sem request extra.
- `apps/web/src/pages/AgendaPage.tsx:1632`-`:1634` — o drawer irmão ("Visualizando agendamento") já
  resolveu o mesmo layout: `flex flex-col gap-8 lg:flex-row lg:gap-10 lg:items-start` +
  `<aside className="flex shrink-0 flex-col gap-3 lg:w-[300px]">`. Copio as classes para os dois
  drawers não divergirem (inclusive o empilhamento aside-primeiro no mobile).
- `apps/web/src/components/Drawer.tsx:147` — com `fullscreen` o painel é `w-full` no desktop;
  `:212` é o scroller único do corpo. Duas colunas dentro dele rolam juntas, que é o comportamento
  do Belasis (f_0090: a coluna esquerda não tem barra própria).

## 4. Decisões

1. **`+ Adicionar` de Anotações → composição inline**, logo abaixo dos blocos. Como a ordem padrão
   do componente termina em Anotações (`ClienteBlocosLaterais.tsx:25`), o formulário aparece colado
   ao bloco que o abriu. O vídeo não mostra o destino do link; usar o padrão de formulário inline
   que já existe neste arquivo (`AddDiscountInline`, `:566`) é o menor invento possível e o único
   dos três com backend pronto.
2. **`+ Adicionar` de Pacotes e Assinaturas → não são renderizados.** Sem callback o componente
   omite o link (`ClienteBlocosLaterais.tsx:168`). Não existe fluxo de "vender pacote/assinatura de
   dentro da comanda" no nosso app, e o vídeo não mostra o que o link abre — link morto engana mais
   do que ausência. Fica em pendências.
3. **Mobile empilha aside primeiro**, igual ao drawer de agendamento (`AgendaPage.tsx:1632`). Com os
   três blocos vazios são ~130px antes dos itens; divergir do drawer irmão custaria mais do que isso.
4. **Erro de anotação some ao reabrir a caixa**: a composição é desmontada ao fechar, então o estado
   local morre junto — sem `useEffect` de reset.

## 5. Fora deste lote

- **Bloco "Informações"** (5 linhas de f_0090). Não entra: o componente compartilhado o excluiu de
  propósito (`.claude/studies/22-blocos-laterais-cliente.md`, seção 4), e 2 das 5 linhas não têm
  origem em endpoint nenhum — `apps/api/src/modules/customers/customers.service.ts:197` devolve
  `debitosTotal` (soma em R$) / `creditosSaldo` / `cashbackSaldo` / `pacotesEmAberto`, e **não**
  contagem de comandas em aberto nem de pagamentos em aberto. As outras 3 linhas já estariam
  disponíveis (`orders.service.ts:208` devolve `customerBalance`, `types.ts:40` tem `birthday`),
  mas renderizar 3 de 5 seria divergir do vídeo sem ganho.
- `apps/web/src/pages/ComandasPage.tsx:1641` (`VerComandaDrawer`) — cópia morta, ninguém importa
  (grep por `VerComandaDrawer` em `apps/web/src` só acha a própria declaração). Não editar.
- `apps/web/src/pages/ComandaDetalhePage.tsx:65` — é página (`App.tsx:315`), não drawer, e o vídeo
  não mostra equivalente. Não inventar coluna lateral lá.
