/**/
# Estudo 166 — o "voltar" do navegador saía da página em vez de fechar o item

Relato do dono, com vídeo:

> "independente de onde eu estou, quando clico em voltar ele vai para a página
> inicial de comanda ou agendamento"

## Arquivos tocados

- `apps/web/src/components/Drawer.tsx`
- `apps/web/src/components/FullDrawer.tsx`

## O que estava acontecendo

No vídeo ele está em **"Editando produto"**, em tela cheia, e a barra de
endereço mostra `app.salonpass.com.br/produtos`. Clica em voltar e cai em
`/comandas`.

Parece aleatório, e não é: **abrir um produto não cria endereço próprio**. O
drawer é estado local do React; para o navegador, nada aconteceu. Então o botão
voltar faz o que sempre fez — sai de `/produtos` inteiro e vai para a entrada
anterior do histórico, que naquele momento era `/comandas`.

Reproduzi localmente: com o drawer aberto, `history.length` não muda, e o
`goBack` leva para a tela anterior de verdade. O destino "aleatório" é só o
histórico do dia — por isso ora cai em comandas, ora em agenda.

Descartei duas hipóteses antes de chegar aqui: o `Drawer` não mexe em
`pushState`/`replaceState`, e o menu lateral não navega com `replace` (o
histórico empilha certo, um passo por página).

O `HomeRoute` (`App.tsx:290-303`) manda para `/agenda` ou `/comandas` conforme a
permissão — mas ele só entra em cena na rota `/`, e não é o culpado aqui.

## A correção

Enquanto um drawer está aberto, ele passa a ocupar uma entrada no histórico:
ao abrir, empilha um estado marcado; o `popstate` fecha o drawer em vez de
deixar o navegador trocar de página.

Fica no `Drawer`/`FullDrawer`, então vale de uma vez para comanda, agendamento,
cliente, produto e todos os outros — em vez de corrigir tela a tela.

Três detalhes que a implementação respeita:

- **Fechar pelo X / ESC / clique no fundo** também consome a entrada que foi
  empilhada (`history.back()`), senão sobraria lixo no histórico e o próximo
  "voltar" não faria nada visível;
- **Drawers empilhados** (o picker de cliente sobre a comanda, por exemplo)
  funcionam porque cada um empilha a sua própria entrada — o voltar fecha de
  cima para baixo, na ordem em que foram abertos;
- **Não muda a URL.** Dar endereço próprio a cada item (`/produtos/abc123`)
  resolveria isso e ainda permitiria copiar link, mas mexeria em muitas telas;
  o dono escolheu a correção de comportamento, que é o que ele sentiu falta.
