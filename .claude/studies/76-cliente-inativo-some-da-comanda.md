# Estudo 76 — Cliente sumindo na hora de criar comanda

Chamado do dono, urgente: *"na Fátima Cabelos tem uma cliente chamada Kelly Rejane, ela não aparece
na hora de criar comandas, só nas comandas já concluídas. Cace todas as clientes que tão assim."*

## 76.1 — A cadeia, confirmada ponta a ponta

1. A cliente é **`KELY REJANE`** (um L só), id `cmrr2lt1j01jt0hyi2zaj9vdl`, e estava com
   **`active = false`**.
2. O seletor de cliente da comanda é o `CustomerPickerDrawer`, que chama `useCustomers(debounced)`
   **sem filtros**. Em `apps/web/src/lib/queries.ts:112`:
   ```
   const active = filters ? filters.active : true;
   ```
   Sem filtro explícito, o padrão é `active = true` — só lista cliente ativo.
3. Nas comandas **já concluídas** ela aparece porque a comanda referencia o cliente por **id**
   (`Order.customerId`), sem passar pelo filtro.

Ou seja: quem estivesse inativo ficava invisível para criar comanda, mas visível no histórico. Do
ponto de vista de quem usa, a cliente "existe e não existe" ao mesmo tempo.

## 76.2 — Quantas estavam assim

Medido em produção: **49 clientes da Fátima Cabelos**, todos com `legacySource = 'belasis-xls'`, e
**todos os 49 com comanda** — isto é, gente de verdade, que já foi atendida. Nenhuma outra empresa
tinha o problema (DesignModa, La Belle e Studio Borboletas: zero inativos).

Reativados os 49. A Fátima passou de 1.170 ativos + 49 inativos para **1.219 ativos, zero inativos**.
Backup da lista em `belasis-reference/_backup-clientes-inativos-2026-07-31/inativos.csv`, com o
`DESFAZER.sql` ao lado.

## 76.3 — Por que estavam inativos, e por que voltaria

`apps/api/src/importers/import-belasis-historico.ts:109` copia o estado do sistema antigo:

```
active: c.active !== false,
```

Os 49 estavam marcados como inativos no Belasis. Isso até faz sentido na primeira carga — mas a
linha `:113`-`:114` faz **update** de quem já existe com o mesmo bloco `data`, incluindo `active`.
Consequência: **rodar a importação de novo desfaz a correção** e some com as 49 outra vez.

Correção: no caminho de ATUALIZAÇÃO, o importador para de mexer em `active`. Quem já está no sistema
e tem movimento não pode ser desativado por uma planilha do sistema antigo. Na criação o valor da
planilha continua valendo, que é o comportamento certo para carga inicial.

## 76.4 — O que NÃO muda

O filtro `active = true` no seletor está certo e fica como está: seletor de cliente para uma comanda
nova não deve oferecer quem foi desativado de propósito. O defeito era o dado, não a regra.
