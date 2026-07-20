# Belasis — Sub-rotas FALTANDO: `/reports/*`, `/marketing/*`, `/commissions/*`

Fonte: `grep -oE '"/(reports|marketing|commissions)/[a-zA-Z0-9_/:-]+' /home/ubuntu/beautypass/belasis-reference/_shared/js/*.js` (caminho explícito, nunca recursivo).
"Capturada" = existe pasta correspondente em `belasis-reference/`.

**Resumo:**
- `/reports/*` extraídas do bundle: **44** (excl. índices). Capturadas: **31**. **FALTANDO: 13**
- `/commissions/*` extraídas: **4**. Capturadas: **4**. **FALTANDO: 0** ✅
- `/marketing/*`: **prefixo não existe** no bundle. O módulo "marketing" mora em rotas top-level (`/whatsapp/*`, `/campaigns`, `/cashback`, `/promotions`, `/reviews`) — ver nota no fim.

---

## `/reports/*`

| Rota (bundle) | Capturada | Pasta |
|---|:---:|---|
| `/reports/birthdays` | Y | `reports-birthdays/` |
| `/reports/calendars/all` | Y | `reports-calendars-all/` |
| `/reports/calendars/care-messages-today` | **N** | — **FALTANDO** |
| `/reports/calendars/creation` | Y | `reports-calendars-creation/` |
| `/reports/calendars/deleted` | Y | `reports-calendars-deleted/` |
| `/reports/calendars/origin` | Y | `reports-calendars-origin/` |
| `/reports/client/:id/late_payments` | **N** | — **FALTANDO** (rota com param) |
| `/reports/clients/all` | Y | `reports-clients-all/` |
| `/reports/clients/birthdays` | Y | `reports-clients-birthdays/` |
| `/reports/clients/inactives` | Y | `reports-clients-inactives/` |
| `/reports/clients/pendings` | Y | `reports-clients-pendings/` |
| `/reports/clients/rank` | Y | `reports-clients-rank/` |
| `/reports/clients/return` | Y | `reports-clients-return/` |
| `/reports/clients/return-today` | **N** | — **FALTANDO** |
| `/reports/detailed` | Y | `reports-detailed/` |
| `/reports/favorites` | Y | `reports-favorites/` |
| `/reports/financial` | Y | `reports-financial/` |
| `/reports/financial/bill-pays` | Y | `reports-financial-bill-pays/` |
| `/reports/financial/bill-recs` | Y | `reports-financial-bill-recs/` |
| `/reports/financial/billing-projection` | Y | `reports-financial-billing-projection/` |
| `/reports/financial/cash-movements` | Y | `reports-financial-cash-movements/` |
| `/reports/financial/dre` | Y | `reports-financial-dre/` (+ `reports-dre/`) |
| `/reports/financial/extract` | Y | `reports-financial-extract/` |
| `/reports/financial/extract-movements` | Y | `reports-financial-extract-movements/` |
| `/reports/financial/product-revenue` | Y | `reports-financial-product-revenue/` |
| `/reports/financial/service-revenue` | Y | `reports-financial-service-revenue/` |
| `/reports/inventory/products-consumed` | Y | `reports-inventory-products-consumed/` |
| `/reports/inventory/products-list` | Y | `reports-inventory-products-list/` |
| `/reports/inventory/purchase-suggestion` | Y | `reports-inventory-purchase-suggestion/` |
| `/reports/inventory/purchases` | Y | `reports-inventory-purchases/` |
| `/reports/inventory/stock` | Y | `reports-inventory-stock/` |
| `/reports/inventory/stock-movement` | Y | `reports-inventory-stock-movement/` |
| `/reports/messages/sent` | Y | `reports-messages-sent/` |
| `/reports/nf` | Y | `reports-nf/` |
| `/reports/nf/all` | **N** | — **FALTANDO** |
| `/reports/ranking/clients-invitee` | **N** | — **FALTANDO** |
| `/reports/ranking/products-services` | **N** | — **FALTANDO** |
| `/reports/sales/cashback-history` | **N** | — **FALTANDO** |
| `/reports/sales/customer_subscriptions` | **N** | — **FALTANDO** |
| `/reports/sales/packages` | **N** | — **FALTANDO** |
| `/reports/sales/pending-review-sends` | **N** | — **FALTANDO** |
| `/reports/sales/products-services` | **N** | — **FALTANDO** |
| `/reports/sales/sales-packages` | **N** | — **FALTANDO** |
| `/reports/tags` | **N** | — **FALTANDO** |

Índices/pais (redirecionam, não são página própria): `/reports/calendars`, `/reports/clients`, `/reports/inventory`, `/reports/messages`, `/reports/ranking`, `/reports/sales`.

### FALTANDO em `/reports/*` (13)
1. `/reports/calendars/care-messages-today`
2. `/reports/client/:id/late_payments`
3. `/reports/clients/return-today`
4. `/reports/nf/all`
5. `/reports/ranking/clients-invitee`
6. `/reports/ranking/products-services`
7. `/reports/sales/cashback-history`
8. `/reports/sales/customer_subscriptions`
9. `/reports/sales/packages`
10. `/reports/sales/pending-review-sends`
11. `/reports/sales/products-services`
12. `/reports/sales/sales-packages`
13. `/reports/tags`

> Nota: os módulos **`/reports/sales/*` (6 sub-rotas) e `/reports/ranking/*` (2) não têm nenhuma pasta capturada** — são os maiores buracos.

---

## `/commissions/*`

| Rota (bundle) | Capturada | Pasta |
|---|:---:|---|
| `/commissions/batch_payments` | Y | `commissions-batch/` |
| `/commissions/bulk_commissions` | Y | `commissions-bulk/` |
| `/commissions/settings` | Y | `commissions-settings/` |
| `/commissions/summary` | Y | `commissions-summary/` |

**FALTANDO: nenhuma.** ✅ (Índice `/commissions` → `commissions/`.)

---

## `/marketing/*`

O prefixo `/marketing` **não aparece** em `_shared/js/*.js`. O que o produto chama de "marketing" está em rotas top-level, capturadas em pastas próprias:

| Módulo marketing | Rota | Capturada |
|---|---|:---:|
| WhatsApp | `/whatsapp` | Y (`whatsapp/`) |
| WhatsApp | `/whatsapp/about-the-platform` | **N** |
| WhatsApp | `/whatsapp/billing` | **N** |
| WhatsApp | `/whatsapp/campaigns` | **N** |
| WhatsApp | `/whatsapp/inbox` (+ `/:id`) | **N** |
| WhatsApp | `/whatsapp/reports/overview` | **N** |
| WhatsApp | `/whatsapp/settings` | **N** |
| WhatsApp | `/whatsapp/templates` | **N** |
| Campanhas | `/campaigns` | Y (`campaigns-marketing/`) |
| Cashback | `/cashback` | Y (`cashback/`) |
| Promoções | `/promotions` | Y (`promotions/`) |
| Avaliações | `/reviews` | Y (`reviews/`) |

> Se "marketing" deve incluir as sub-rotas de `/whatsapp/*`, há **7 faltando** ali (só o índice `whatsapp/` foi capturado).
