/**/
# Estudo 154 — a comanda em preenchimento se perdia inteira

Pedido do dono, por áudio:

> "bota para poder conseguir a pessoa salvar aquela comanda como rascunho, caso
> ela está preenchendo aí depois sai"

## Arquivos tocados

- `apps/web/src/pages/ComandasPage.tsx`

## O rascunho já existia — o que faltava era não perder

`OrderStatus` tem três valores (`schema.prisma:72-76`): `open`, `finished`,
`canceled`. **`open` já é o rascunho**: a comanda fica na lista, aberta, e pode
ser retomada a qualquer momento. Não faltava um quarto status.

E "Salvar" (`ComandasPage.tsx:1436`) já cria exatamente isso — uma comanda
aberta, sem faturar. Em produção há 27 comandas nesse estado, uma delas desde
novembro de 2025.

O problema é que **o caminho até o Salvar era um campo minado**. Comanda aberta
pela agenda ou pelo perfil do cliente é criada no primeiro clique e cada ação
vira request na hora — nada se perde. Mas a criada pelo botão "Nova comanda"
vive só em estado local (`StagedItem[]`, `:1323`) até o Salvar, e o `useEffect`
de reset (`:1331-1344`) zera tudo a cada abertura.

Fechar era fácil demais, e nada avisava:

- **o botão "Ajuda" chamava `onClose`** (`:1430-1432`) — clicar em Ajuda
  descartava a comanda inteira. Não havia ajuda nenhuma; o botão só destruía;
- "Cancelar" (`:1433`), ESC (`Drawer.tsx:109`) e clique no fundo
  (`Drawer.tsx:127`) fechavam sem checar se havia algo preenchido.

## A correção

**O botão "Ajuda" deixou de existir.** Ele não ajudava — só descartava. No lugar
entrou uma frase que explica o que o dono estava pedindo: que Salvar guarda a
comanda como rascunho para terminar depois.

**"Salvar" virou "Salvar rascunho"**, que é o vocabulário do próprio dono e diz
o que o botão faz: guarda sem faturar, para retomar depois. "Faturar" continua
como está.

**Fechar com coisa preenchida agora pede confirmação** — Cancelar, ESC ou clique
no fundo. A checagem é sobre haver cliente OU itens OU observação; drawer vazio
fecha direto, sem atrapalhar quem só abriu por engano.

O aviso oferece a saída certa em vez de só barrar: quem confirma, descarta;
quem cancela, volta e pode salvar o rascunho.

## O que NÃO fiz

Não criei status novo nem persistência automática a cada tecla. Persistir a
comanda antes de ter cliente e item encheria a lista de comandas vazias — o
problema que o dono relatou é perder o que preencheu, e é isso que a
confirmação resolve, sem efeito colateral.
