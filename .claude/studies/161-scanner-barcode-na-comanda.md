# Estudo 161 — scanner de código de barras na comanda

## Arquivos criados/tocados

- `apps/web/src/components/BarcodeScanner.tsx`
- `apps/web/src/components/ItemPickerDrawer.tsx`
- `apps/web/src/pages/ComandasPage.tsx`

## Evidências e integração

- `apps/web/src/components/ItemPickerDrawer.tsx:38` concentra a seleção comum de
  serviços e produtos. A prop do scanner deve ser opcional e desligada por padrão
  para não mudar os demais consumidores.
- `apps/web/src/components/ItemPickerDrawer.tsx:91` já envia a busca de produtos
  ao backend. Portanto, o código lido deve alimentar `search`/`debounced` e
  aguardar essa consulta, sem criar endpoint novo.
- `apps/web/src/components/ItemPickerDrawer.tsx:127` possui `pickRow`, a mesma
  função usada pelo clique da linha. O resultado único do scanner deve passar por
  ela para preservar a confirmação do preço.
- `apps/web/src/components/ItemPickerDrawer.tsx:153` usa `z-[90]`. O scanner será
  outro `Drawer` em `z-[110]`, acima do seletor aninhado.
- `apps/web/src/components/Drawer.tsx:24` expõe `zClass`, e
  `apps/web/src/components/Drawer.tsx:54` usa `z-[70]` por padrão. O scanner deve
  declarar sua camada explicitamente.
- `apps/web/src/pages/ComandasPage.tsx:1266` identifica `NovoComandaDrawer` como
  o fluxo de criação. Seu uso em `ComandasPage.tsx:1506` é o único que receberá
  `permitirScanner`; os usos em comanda existente, pacotes e assinaturas ficam
  com o default `false`.
- A referência `/home/lucssfeitosa/belivin-ia/apps/web/app/components/mobile/ProductScanner.tsx:42`
  confirma a sequência de fallback: `BarcodeDetector`, import dinâmico de ZXing
  e digitação manual sempre disponível. A adaptação troca o `BottomSheet` e o
  conjunto de ícones pelos componentes deste projeto.

## Comportamento decidido

O botão aparece ao lado da busca somente quando `permitirScanner` for verdadeiro
e a aba Produtos estiver ativa, pois serviços não possuem código de barras. Ao
detectar, o drawer do scanner fecha e o código preenche a busca. Depois da
consulta: um resultado abre a mesma confirmação de preço do clique; nenhum
resultado mostra `Código {codigo} não encontrado`; múltiplos resultados ficam
visíveis para escolha manual. Falha ou ausência de câmera nunca remove a entrada
manual.
