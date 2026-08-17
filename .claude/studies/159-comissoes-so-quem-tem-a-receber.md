/**/
# Estudo 159 — ver só quem tem comissão a pagar

Pedido do dono:

> "em comissões tem como deixar visível só o que tem para ser pago"

## Arquivos tocados

- `apps/web/src/pages/comissoes/ComissoesResumoPage.tsx`

## O que já existia e o que faltava

Na tela **Detalhadas** já dá: o filtro de tipos (estudo 156) tem a linha
"Situação", e desmarcar "Pagas" e "Estornadas" deixa só o que está em aberto.

O buraco está na **Resumidas**, que é onde o salão decide a quem pagar. Ali a
tabela do desktop lista `rows` — TODOS os profissionais do período, inclusive
quem já foi pago e quem não tem nada. Num salão com 15 profissionais, quem vai
pagar precisa varrer a coluna procurando os que ainda têm saldo.

Curioso: o recorte já existia no arquivo e era usado só no celular.
`ComissoesResumoPage.tsx:265` define `linhasEmAberto` (`openCount > 0`) e a aba
mobile "Comissões em aberto" (`:884`) renderiza com ele. O desktop (`:1036`)
ficou com a lista completa.

## A correção

Um switch **"Só quem tem a receber"** na coluna de filtros, ligado ao mesmo
`linhasEmAberto` que o mobile já usa. Nasce **desligado** para a tela abrir como
sempre abriu.

O recorte é por `openCount > 0`, e não por `liquido > 0`. A diferença importa:
quem tem comissão em aberto inteiramente consumida por vales fica com líquido
zero e **mesmo assim precisa aparecer** — sumir da lista faria o salão achar que
a comissão daquela pessoa evaporou. O comentário em `:259-264` já registrava
esse cuidado para o mobile; agora ele vale para os dois.

## Os totais

Diferente do filtro da tela Detalhadas (estudo 156), aqui os totais **podem**
acompanhar o filtro sem risco: o rodapé desta tela já mostra os números da
SELEÇÃO quando há alguma (`:272-275`), e o botão paga exatamente a seleção. Como
esconder linhas não seleciona nem desseleciona ninguém, o par
"número exibido / valor pago" continua verdadeiro.

Ainda assim, a tela avisa quantos profissionais estão fora de vista quando o
filtro está ligado — quem não vê o número não sabe que ele existe.
