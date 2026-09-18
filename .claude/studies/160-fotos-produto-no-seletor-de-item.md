# Estudo 160 — fotos de produto no seletor de item

## Arquivo tocado

- `apps/web/src/components/ItemPickerDrawer.tsx`

## Estado atual

- `apps/web/src/components/ItemPickerDrawer.tsx:11` define `PickedItem` somente com
  tipo, referência, nome e preço. A foto disponível no produto não acompanha a
  linha escolhida.
- `apps/web/src/components/ItemPickerDrawer.tsx:93` transforma serviços e produtos
  em uma lista comum. No ramo de produto (`ItemPickerDrawer.tsx:102`), hoje entram
  apenas `id`, `name` e `salePrice`.
- `apps/web/src/components/ItemPickerDrawer.tsx:232` faz a linha inteira selecionar
  o item. A imagem precisa interromper a propagação do clique para ampliar sem
  também abrir a confirmação de preço.
- `apps/web/src/components/ItemPickerDrawer.tsx:134` abre o picker em `z-[90]`.
  Como o painel do `Drawer` usa transformação para animar, o lightbox será
  portado para `document.body`, com camada superior, para cobrir a viewport toda.

## Implementação decidida

`PickedItem` recebe `imageUrl` opcional e somente o mapeamento de produtos o
preenche. Cada produto mostra uma miniatura quadrada de 48 px, com cantos
arredondados e `IconBox` quando não há foto. Clicar na miniatura com foto abre
um lightbox sem dependência externa; clique no fundo e ESC fecham a ampliação,
sem selecionar a linha da comanda.
