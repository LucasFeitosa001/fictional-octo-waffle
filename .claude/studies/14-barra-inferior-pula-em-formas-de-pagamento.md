# Estudo 14 — Barra inferior "pula" na aba Formas de pagamento

Sintoma (vídeo 27/07, mobile): em Cadastros, ao trocar de **Contas** para **Formas de pagamento**, a
barra inferior muda de **4 botões** (Menu · Filtrar · Selecionar · Novo) para **2** (Menu · Novo) —
os botões restantes se reposicionam e a barra "fica mexendo".

Arquivo: `apps/web/src/pages/financeiro/ContasPage.tsx`

## Causa

Duas flags removem ações da barra só nessa aba:

- `apps/web/src/pages/financeiro/ContasPage.tsx:358` → `const supportsStatus = tab !== 'formas';`
  usada em `:721` para incluir (ou não) a ação **Filtrar**.
- `apps/web/src/pages/financeiro/ContasPage.tsx:709` →
  `const supportsSelectMode = tab === 'contas' || tab === 'categorias';`
  usada em `:731` para incluir (ou não) a ação **Selecionar**.

Como as ações são **removidas do array** (spread condicional), a barra encolhe e os botões mudam de
posição a cada troca de aba — em vez de manter o mesmo layout das outras telas.

## As duas restrições não se sustentam

1. **Filtrar/status:** o comentário em `:357` diz que status "só se aplica onde o backend expõe
   `active` (contas e categorias)". Mas `PaymentMethod` **tem** `active`
   (`packages/db/prisma/schema.prisma`, model `PaymentMethod`, campo `active Boolean @default(true)`),
   e o próprio front já filtra por ele em `apps/web/src/pages/financeiro/TransacoesPage.tsx`
   (`.filter((method) => method.active)`). Ou seja, o filtro funciona para formas.

2. **Selecionar:** o comentário em `:708` diz que formas "não usa selectMode nos cards", mas
   `selectableIds` **já inclui** os ids das formas —
   `apps/web/src/pages/financeiro/ContasPage.tsx:638` `if (tab === 'formas') return pageMethods.map((m) => m.id);`
   e o `useSelectMode(selectableIds)` está em `:641`. A infraestrutura de seleção já cobre a aba.

## Decisão

Remover as duas exceções: a aba Formas de pagamento passa a ter as mesmas 4 ações das demais, e a
barra inferior fica fixa ao trocar de aba — que é o comportamento pedido ("faça ficar fixo igual os
demais").

Observação registrada (não corrigida aqui): no vídeo o rótulo da aba aparece cortado
("Formas de paga…"), sintoma do problema geral de tabs no mobile — endereçado pelo componente
`apps/web/src/components/Tabs.tsx` (estudo 12), cuja migração desta tela segue na fila.
