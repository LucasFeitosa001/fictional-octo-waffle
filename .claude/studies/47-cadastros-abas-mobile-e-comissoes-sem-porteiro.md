# Estudo 47 — Abas de Cadastros no celular, e Comissões sem porteiro

Pedido do dono, uma frase, três telas:

> *"do mesmo jeito que voce fez aquela alternancia de comissoes, faça da mesma forma em cadastros
> do financeiro, e bote icones, aquele que alterna, contas, categorias. no comissoes no mobile, os
> cards nao vai ter clicar em ver detalhes, comissoes em aberto que vai ter as em aberto, e pagas
> vai ter as pagas, e o filtros a pessoa pode filtrar por profissionais, mas de padrão não vem
> filtrado ninguem."*

---

## 47.1 — Cadastros do Financeiro: a régua de abas nunca virou a do celular

`apps/web/src/pages/financeiro/ContasPage.tsx:804`-`:810` monta as abas assim:

```tsx
<AppTabs items={TABS} selectedKey={tab} onSelectionChange={changeTab} ariaLabel="Cadastros financeiros" className="mb-4" />
```

Sem `stacked`. No celular isso é a régua rolante: captura `atual/m-cadastros.png` mostra
`Contas · Formas de pagamento · Cate…` com a terceira aba **cortada pela borda direita**.

O modo do celular já existe — `apps/web/src/components/AppTabs.tsx:19` (`stacked = false`),
`:65`-`:80` (grid de colunas iguais, `overflow-visible`) e `:92` (ícone em cima, sublinhado na
ativa). Foi escrito para Comissões (estudo 44) e ninguém ligou aqui.

Os ícones já estão escolhidos e o comentário de `ContasPage.tsx:86`-`:88` **já diz** o que fazer:

```tsx
// Abas do Belasis (Contas · Formas de pagamento · Categorias). No mobile o
// Belasis empilha ícone acima do rótulo (bank/dollar/profile → wallet/dollar/
// layers); no desktop mantém underline de texto puro.
const TABS = [
  { id: 'contas', label: 'Contas', icon: <IconWallet size={16} /> },      // :90
  { id: 'formas', label: 'Formas de pagamento', icon: <IconDollar size={16} /> },
  { id: 'categorias', label: 'Categorias', icon: <IconLayers size={16} /> },
];
```

Confere com a captura real: `belasis-reference/finance-accounts/mobile.html` traz os três botões
com a **mesma classe** da régua mobile de Comissões (`wb__sc-1d9hylv-0`) e os ícones
`bank` (Contas), `dollar` (Formas de pagamento), `profile` (Categorias).

O ícone é 16 no desktop e 18 no empilhado (é o tamanho que Comissões usa em
`pages/comissoes/tabs.tsx:25`-`:27`). Como o `size` passa a depender da plataforma, `TABS` guarda
o COMPONENTE do ícone e a tela renderiza no tamanho certo — duas listas (uma "mobile", outra
"desktop") foi exatamente como as abas de Comissões divergiram (estudo 41, "Sobra 2").

Desktop fica como está: a captura `finance-accounts/desktop.html` mostra
`Contas | Formas de pagamento | Categorias` em texto, sem empilhar.

## 47.2 — Os cards do celular oferecem "Ver detalhes" para lugar nenhum

`ComissoesResumoPage.tsx:748`-`:773` dá `onClick` aos três cards, e
`ComissoesResumoPage.tsx:1174`-`:1178` desenha o rodapé só por causa dele:

```tsx
{onClick && (
  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/90">
    Ver detalhes <IconChevron size={13} className="-rotate-90" />
  </div>
)}
```

Os destinos são `/comissoes/em-aberto` (que cai em **Resumidas**, `:100`-`:106`) e
`/comissoes/pagas` — ou seja, no celular "Ver detalhes" do card de *em aberto* devolve a pessoa
para a MESMA tela onde ela já está. As abas do topo levam aos mesmos dois lugares, com nome.

A captura confirma que a referência não tem esse link: `commissions-summary/mobile.html` é
`abas · intervalo · três cards` e mais nada — nenhum "Ver detalhes".

Correção: no celular os cards não recebem `onClick` (sem `onClick`, o rodapé não é renderizado —
não é preciso mexer no `KpiCard`). Desktop segue clicável.

## 47.3 — "Comissões em aberto" no celular é um porteiro, não uma lista

A aba renderiza `ComissoesDetalhadasView` (`ComissoesResumoPage.tsx:797`-`:809`), e essa tela tem
um estado 1 que **bloqueia** até escolher alguém — `ComissoesDetalhadasView.tsx:227`-`:286`:

```tsx
if (!professionalId) {
  return (... "Filtros — Selecione um período e escolha o profissional" + lista de profissionais)
}
```

No celular (captura `atual/m-aberto.png`) o resultado é: dois campos de data, um toggle e quatro
cartões de nome. Nenhuma comissão à vista numa aba chamada "Comissões em aberto".

A referência mobile NÃO faz isso: `belasis-reference/commissions/mobile.html` renderiza a área de
dados sem profissional escolhido — o texto visível é `Não há dados | Nenhuma comissão encontrada |
Selecionar profissional`. Ou seja, a lista aparece (vazia naquele salão) e a escolha de
profissional é um FILTRO opcional. No desktop, aí sim, a referência tem o estado "escolha alguém"
(`finance`… não: `commissions-summary/desktop.html` mostra `Período | Profissional | Selecionar
profissional | ... | Filtros | Selecione um período e escolha o profissional`).

Correção, só no celular: a aba "Comissões em aberto" deixa de montar
`ComissoesDetalhadasView` e passa a listar as linhas do resumo que TÊM comissão em aberto
(`openCount > 0`), em cartões. `ComissoesDetalhadasView` continua intacta e é o que o desktop
mostra — é a tela do Belasis desktop, e nada nela muda.

## 47.4 — "Pagas" no celular vira cartão de nove linhas

`ComissoesResumoPage.tsx:841`-`:848` e `:868`-`:874` usam `DataTable` nas duas listas da aba. E
`components/DataTable.tsx:259`-`:308` transforma **cada coluna numa linha do cartão** no celular
(`<ul className="... md:hidden">`). Com as colunas de `:316`-`:493`, cada profissional ocupa
Seleção · Comissões · Vales · Bonificações · Líquido · Valor vendido · Status · Assinatura ·
Detalhes/Pagar. É a mesma reclamação do estudo 44, que só tinha sido resolvida na Resumidas.

Correção: no celular as duas listas da aba "Pagas" viram cartões compactos (nome + valor + toque
para abrir o detalhe); o `DataTable` continua sendo o desktop.

## 47.5 — O filtro do celular escolhe E abre o detalhe

`ComissoesResumoPage.tsx:1023`-`:1030`: tocar num profissional dentro do drawer de Filtros grava o
filtro, fecha o drawer **e** abre o drawer de detalhe daquela pessoa. Como filtro, isso é um
sequestro: quem só queria restringir a lista cai numa terceira tela.

E `ComissoesResumoPage.tsx:889`-`:906`, no ramo do celular da Resumidas, o único conteúdo abaixo
dos cards é o botão **"Escolher profissional para ver as comissões"** — a mesma ideia de porteiro
do 47.3, agora na tela de resumo. A referência (`commissions-summary/mobile.html`) não tem esse
botão.

Correções:
- tocar num profissional no drawer de Filtros **só filtra** (grava + fecha);
- o botão "Escolher profissional…" sai; o acesso ao filtro já existe em dois lugares (a barra de
  período, `:735`-`:744`, e a ação "Filtros" da BottomNav, `:207`-`:212`);
- o padrão continua sendo **ninguém filtrado** (`professionalId` nasce `''`,
  `ComissoesResumoPage.tsx:115`) — o que muda é que agora isso mostra a lista inteira em vez de
  uma tela de espera. Com filtro ativo, aparece uma tarja com o nome e um X, senão a lista some
  sem explicação.

## Arquivos tocados

- `apps/web/src/pages/financeiro/ContasPage.tsx` (abas empilhadas no celular, ícone por tamanho)
- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx` (cards sem link, listas do celular,
  filtro que só filtra)
- `apps/web/src/pages/comissoes/ComissoesListaMobile.tsx` (novo — cartão compacto por
  profissional, usado por "Comissões em aberto" e "Pagas")
