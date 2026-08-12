# Estudo 50 — Pacote: clicar na linha não abre nada, e ver ≠ criar

Pedido do dono, com duas capturas do Belasis ("Visualizando pacote #9" e "Novo pacote"):

> *"hoje nós não consegue vizualizar pacote e quando criar um novo pacote é diferente dessa imagem
> tem que ser ambos parecidos igual a imagem faça isso no web e mobile"* … *"faça eu consegui
> vizualizar os pacote clico neles tambem"*

## 50.1 — Só o ticket abre; a linha inteira não

`apps/web/src/pages/PacotesPage.tsx:640` põe o `onClick` no **link do ticket**:

```tsx
<button onClick={() => setDetailId(p.id)}>#{p.number}</button>
```

O `<tr>` não tem clique. Verificado no navegador: clicar em qualquer parte da linha não abre nada;
clicar exatamente no "#1" abre o drawer `Visualizando pacote #1`. Quem clica no nome, no valor ou
no espaço vazio conclui que "não dá para visualizar" — foi o que o dono relatou.

No celular a lista JÁ abre com o toque no cartão (`PacotesPage.tsx:729`, `else setDetailId(p.id)`),
então o defeito é só do desktop.

## 50.2 — As duas telas são desenhos diferentes entre si e do Belasis

**Belasis (as duas capturas)** — mesma folha, muda só o cabeçalho e o rodapé:

```
Cliente*            | Data              | Validade ⓘ
Pacote Predefinido  | Vendedor
Itens do pacote
  Descrição | [Saldo] | Qtde. | Valor unitário | Desconto | Total | [Utilizados]
                                    Desconto / Crédito / Cashback / Total
Observação
rodapé:  novo → Ajuda · Cancelar · Salvar · Faturar
         ver  → Ajuda · Outros ▲ · Cancelar · Excluir · Salvar · Ver pagamentos
```

`Saldo` e `Utilizados` (links "Comanda #2951", "Comanda #2963") só existem no modo VER.

**Nosso "Novo pacote"** (`PacotesPage.tsx:1172`-`:1571`): quebra o formulário em QUATRO abas —
`Cliente / Dados`, `Itens do pacote`, `Pagamentos`, `Observações` (`:1316`-`:1321`). O próprio
código já registra a dívida: *"nossas abas horizontais são divergência nossa"* (`:1358`).

**Nosso "Visualizando pacote"** (`pages/PacotePerfilModal.tsx`): outra tela — cartão de resumo
(Valor · Validade · Sessões usadas · Restantes), abas `Itens | Sessões`, lista simples de serviços,
bloco Descontos, bloco Pagamentos. Nada da tabela de itens do Belasis.

Ou seja: três desenhos para o mesmo objeto.

## 50.3 — O que o backend já dá, e o que não existe

`GET /customer-packages/:id` (`apps/api/src/modules/packages/packages.service.ts:125`, enriquecido
em `:324`) devolve por item: `serviceName`, `sessionsTotal`, `sessionsUsed`, **`saldo`** e
`usages[]` com `{ id, usedAt, orderId }`.

Falta o NÚMERO da comanda para escrever "Comanda #2951" — o include de `:22` traz `usages` sem
`order`. É o único ajuste de API necessário.

Não existem no schema (`packages/db/prisma/schema.prisma:1454`-`:1491`), e por isso não entram:

- **data da venda** (só `createdAt`, que nos importados é a data do IMPORT — ver 50.4);
- **vendedor**, **observação**, **desconto/crédito/cashback** por pacote;
- endpoint de **update** (`PATCH /customer-packages/:id` não existe — `PacotePerfilModal.tsx:53`
  tem um stub chamando um endpoint inexistente) e de **faturar**.

Botão que não salva é pior que botão ausente (o dono já cobrou isso em Comissões), então no modo
VER o rodapé leva **Excluir · Fechar**, e os campos sem coluna aparecem desabilitados como no
Belasis — que também os mostra assim na captura.

## 50.4 — Conferência com os relatórios da Fátima (produção)

`Pacotes adquiridos.xls` (baixado 18/07) × banco de produção:

```
relatório                                        nosso banco
P#1 KERLLEY   ESCOVA        qtd 4 saldo 0 120    P#1 120 — SEM ITEM
P#2 KERLLEY   ESCOVA        qtd 4 saldo 0 120    P#2 120 — SEM ITEM
P#3 KERLLEY   ESCOVA        qtd 4 saldo 0 120    P#3 120 — SEM ITEM
P#4 SOLANGE   TRATAMENTO    qtd 4 saldo 0 350    P#4 350 — TRATAMENTO 4/4 ✔
P#5 PAULA     TRATAMENTO    qtd 4 saldo 0 450    P#5 450 — TRATAMENTO 4/4 ✔
P#6 KERLLEY   ESCOVA        qtd 4 saldo 0 120    P#6 120 — SEM ITEM
P#7 KERLLEY   ESCOVA        qtd 4 saldo 0 120    P#7 120 — SEM ITEM
P#8 MARIA IZ. TRAT.+ESCOVA  qtd 4 saldo 0 400    P#8 400 — TRATAMENTO 4/4 (ESCOVA não veio)
P#9 BRUNA     TRAT.+ESCOVA  qtd 3 saldo 1 279,03 P#9 279,03 — TRATAMENTO 3/2 saldo 1 ✔
```

Preços e validades batem (P#1 27/08/2024, P#2 24/09/2024, P#8 17/12/2025, resto vazio). O que não
bate:

1. **Cinco pacotes ficaram sem item nenhum** — todos os da KERLLEY, cujo serviço é
   `ESCOVA (A PARTIR DE R$ 45,00)`. O nome com parêntese/preço provavelmente não casou no import.
2. **`createdAt` é 19/07/2026 em TODOS** (data do import). A "Data da venda" do relatório
   (27/07/2024 … 17/03/2026) se perdeu — e não há coluna para guardá-la.
3. **Nenhum `PackageUsage`**: o P#9 tem `sessionsUsed = 2`, mas zero linhas de uso. A coluna
   "Utilizados" do Belasis (Comanda #2951, #2963) fica vazia para os importados, porque o vínculo
   com a comanda não veio.

Nada disso é corrigido aqui — é dado de cliente em produção, como no estudo 48. Fica registrado
com a evidência para o dono decidir.

## Arquivos tocados

- `apps/api/src/modules/packages/packages.service.ts` (usages devolvem o número da comanda)
- `apps/web/src/lib/types.ts` (`PackageUsage.orderNumber`)
- `apps/web/src/pages/PacoteDrawer.tsx` (novo — a folha única, modos "novo" e "ver")
- `apps/web/src/pages/PacotesPage.tsx` (linha inteira clicável; usa o drawer novo nos dois casos)
