# Estudo 49 — Menu da comanda: sai "Editar", entram "Imprimir" e "Impressão térmica"

Duas capturas lado a lado do dono (nossa × Belasis):

```
nosso    Ver comanda · Editar · Excluir
Belasis  Ver comanda · Imprimir · Impressão térmica · Excluir
```

*"faça igual do belasis em comanda… retira o editar e colocar as mesma que estar ai, faça para web
e mobile"*.

## 49.1 — "Editar" já não fazia nada de diferente

`apps/web/src/pages/ComandasPage.tsx:872`-`:877`:

```tsx
<RowMenu
  onView={() => setViewing(o)}
  onEdit={() => setViewing(o)}   // ← MESMA coisa que "Ver comanda"
  onRemove={() => handleRemove(o)}
  disableRemove={o.status === 'canceled' || del.isPending}
/>
```

O menu está em `ComandasPage.tsx:180`-`:240` (`RowMenu`, com `MenuItem` em `:241`). Tirar "Editar"
não remove capacidade nenhuma: os dois itens abriam o mesmo drawer.

## 49.2 — Impressão não existe em lugar nenhum do produto

`grep -rn "window.print|@media print" apps/web/src` não devolve nada. Não há folha de estilo de
impressão, componente de recibo nem endpoint. Ou seja: os dois itens novos não são "ligar um botão
que já existia" — é preciso construir o que vai para o papel, senão viram os itens decorativos de
sempre.

O dado necessário já está pronto:

- `useOrder(id)` (`apps/web/src/lib/queries.ts:320`) → `OrderDetail`
  (`apps/web/src/lib/types.ts:315`-`:347`): `number`, `date`, `customerName`, `professionalName`,
  `items[]` (com `itemName`, `quantity`, `unitPrice`, `grossValue`, `discount`,
  `professionalName`), `discounts[]`, `payments[]` (com `paymentMethodName`, `amount`, `status`),
  `grossTotal`, `discountTotal`, `creditUsed`, `cashbackUsed`, `netTotal`, `notes`.
- `useCompany()` (`queries.ts:598`) → `CompanyInfo` (`types.ts:360`): `name`, `legalName`, `cnpj`,
  `logoUrl`. Não há endereço/telefone no payload — o cabeçalho usa o que existe.

## 49.3 — O nome "Impressão térmica" é o da referência

`belasis-reference/_shared/js/index-Bd9916Am.js` (bundle real do Belasis) traz o dicionário:

```js
sale: { thermal_print: "Impressão térmica", ... }
```

Confere com a captura do dono. A diferença entre os dois itens é o PAPEL: "Imprimir" é folha A4
(uma via com cabeçalho, itens em tabela e totais); "Impressão térmica" é bobina de 80 mm (coluna
estreita, monoespaçada, sem cor de fundo).

## 49.4 — No celular o cartão não tem menu

`ComandasPage.tsx:897`-`:975`: o cartão inteiro é um `<button>` que abre a comanda; não há ações
por linha. No Belasis mobile as ações vêm por SWIPE — `belasis-reference/sales/mobile.html` mostra
`Excluir | Selecionar` repetido a cada cartão, que é o par revelado ao arrastar.

O pedido é ter as mesmas opções nas duas plataformas. Um botão "⋮" no cartão abrindo bottom-sheet
com os quatro itens é o caminho: é descoberto sem gesto escondido e respeita a regra de que todo
drawer do celular sobe de baixo. O toque no resto do cartão continua abrindo a comanda.

## 49.5 — Como imprimir sem quebrar a tela

Impressão em SPA tem duas saídas: abrir janela nova (`window.open` + `document.write`) ou renderizar
no próprio documento e esconder o resto no `@media print`. A primeira morre em popup blocker e no
PWA do iOS — que é justamente o "mobile" do pedido. Fica a segunda:

- um nó irmão do `#root` (`apps/web/index.html:47`) recebe o recibo via portal;
- `@media print` esconde `#root` e mostra o nó;
- o `@page` (A4 ou 80 mm) entra num `<style>` que o próprio componente escreve, porque `@page` não
  aceita seletor de classe;
- `window.print()` é chamado depois da renderização, e o `afterprint` fecha o estado.

## Arquivos tocados

- `apps/web/src/components/ComandaImpressao.tsx` (novo — folha A4 e bobina 80 mm)
- `apps/web/src/index.css` (regras de `@media print`)
- `apps/web/src/components/icons.tsx` (`IconPrinter`, `IconFileText`)
- `apps/web/src/pages/ComandasPage.tsx` (menu do desktop sem "Editar"; menu do celular)
