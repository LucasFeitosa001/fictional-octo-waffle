# Beautypass — Modelo de Dados

Postgres via Prisma (`packages/db/prisma/schema.prisma`). Tudo multi-tenant por `companyId`
(e `branchId` quando multiunidade). Convenções: PK `id` cuid, `createdAt`/`updatedAt`,
soft-delete via `active` ou `deletedAt` onde fizer sentido. Valores monetários em `Decimal`.

## Domínio: Empresa & Usuários
- **companies** — id, name, legalName, cnpj, logoUrl, timezone(default America/Sao_Paulo), currency(BRL), addressJson, businessHoursJson, active.
- **branches** — id, companyId, name, addressJson, active. (multiunidade, fase 5)
- **users** — id, companyId, name, email(unique), phone, passwordHash, avatarUrl, provider(local|google|apple|phone), active.
- **roles** — id, companyId, name. **permissions** — id, key. **role_permissions** — roleId, permissionId.
- **user_company** — userId, companyId, roleId (vínculo + papel).
- **plans** — id, name(free|basic|pro|premium), priceMonthly, featuresJson.
- **subscriptions** — id, companyId, planId, status, currentPeriodEnd. (assinatura DA empresa ao SaaS)
- **feature_flags** — id, companyId, key, enabled. (controle "funcionalidade contratada")

## Domínio: Clientes
- **customers** — id, companyId, name, nickname, phone, secondaryPhone, email, birthday, cpf, cnpj, active.
- **customer_addresses** — id, customerId, street, number, district, city, state, zip.
- **customer_credits** — id, customerId, amount, reason, createdAt. (saldo de crédito)
- **customer_cashback** — id, customerId, amount, expiresAt, sourceType, sourceId.
- **customer_anamnesis** — id, customerId, templateId, answersJson, signedAt. (fase 4)
- **customer_notes** — id, customerId, text, authorId.

## Domínio: Profissionais
- **professionals** — id, companyId, userId?, name, nickname, phone, profession, birthday, avatarUrl, onlineBookable, active.
- **professional_schedules** — id, professionalId, weekday, startTime, endTime. (horário de atendimento)
- **professional_services** — professionalId, serviceId. (quais serviços executa)
- **professional_commission_rules** — id, professionalId, scopeType(service|product|category|all), scopeId?, type(percent|fixed), value.
- **professional_invites** — id, companyId, email/phone, status(pending|accepted|expired), token.

## Domínio: Serviços
- **service_categories** — id, companyId, name, displayOrder, active.
- **services** — id, companyId, categoryId, name, price, durationMin, description, additionalCost, cashbackPercent, onlineBookable, favorite, visible, displayOrder, active.

## Domínio: Produtos & Estoque
- **product_categories** — id, companyId, name, active.
- **brands** — id, companyId, name.
- **products** — id, companyId, categoryId, brandId, name, imageUrl, salePrice, costPrice, stock, minStock, cashbackPercent, favorite, active.
- **suppliers** — id, companyId, name, email, phone, stateRegistration, cnpj, addressJson, active.
- **inventory_movements** — id, productId, type(in|out|adjust), quantity, reason, refType, refId, createdAt.
- **purchases** — id, companyId, supplierId, accountId, paymentMethodId, total, date.
- **purchase_items** — id, purchaseId, productId, quantity, unitCost.

## Domínio: Agenda
- **appointments** — id, companyId, customerId, professionalId, status(scheduled|confirmed|unconfirmed|waiting|in_progress|done|finished|canceled), start, end, notes, source(admin|online).
- **appointment_items** — id, appointmentId, serviceId, professionalId, durationMin, price.
- **appointment_status_history** — id, appointmentId, fromStatus, toStatus, at, byUserId.
- **appointment_notifications** — id, appointmentId, type, sentAt, channel.

## Domínio: Comandas
- **orders** — id, companyId, number(seq por empresa), customerId, professionalId?, status(open|finished|canceled), grossTotal, discountTotal, creditUsed, cashbackUsed, netTotal, notes, date.
- **order_items** — id, orderId, kind(service|product), refId, professionalId?, quantity, unitPrice, grossValue, discount, packageId?, membershipId?.
- **order_discounts** — id, orderId, type(percent|value), value, reason.
- **order_payments** — id, orderId, paymentMethodId, accountId, amount, dueDate, paidAt, status(pending|paid|reversed), description.
- **order_status_history** — id, orderId, fromStatus, toStatus, at, byUserId.

## Domínio: Pacotes
- **package_templates** — id, companyId, name, price, validityDays, discount, active.
- **package_template_items** — id, templateId, serviceId, sessions.
- **customer_packages** — id, companyId, customerId, templateId?, number, price, status(active|expired|finished), expiresAt.
- **customer_package_items** — id, customerPackageId, serviceId, sessionsTotal, sessionsUsed.
- **package_usage** — id, customerPackageItemId, orderId, usedAt.

## Domínio: Assinaturas (membership)
- **membership_plans** — id, companyId, name, recurringPrice, intervalMonths, active.
- **membership_services** — membershipPlanId, serviceId, quantityPerCycle.
- **customer_memberships** — id, companyId, customerId, membershipPlanId, status(active|canceled|overdue), nextDueDate.
- **membership_payments** — id, customerMembershipId, amount, dueDate, paidAt, status.

## Domínio: Financeiro
- **financial_accounts** — id, companyId, name, type(cash|bank), initialBalance, active. (ex: Caixa, Itaú)
- **payment_methods** — id, companyId, name(dinheiro|pix|crédito|débito|outros), feePercent, settlementDays, defaultAccountId, goesToCash.
- **financial_categories** — id, companyId, name, kind(debit|credit), countsAsCommission, isExpense, active.
- **transactions** — id, companyId, kind(income|expense), accountId, categoryId, paymentMethodId, partyType(customer|professional|supplier)?, partyId?, description, grossAmount, dueDate, paidAt, status(pending|paid|reversed), recurrenceJson, attachmentUrl, orderId?.
- **cash_registers** — id, companyId, number(seq), responsibleUserId, openingBalance, countedBalance?, openedAt, closedAt, status(open|closed).
- **cash_movements** — id, cashRegisterId, type(in|out), paymentMethodId, amount, refType, refId, at.

## Domínio: Comissões
- **commission_rules** — id, companyId, scopeType, scopeId?, type(percent|fixed), value, settings(quem paga taxa/desconto, custo, competência×disponibilidade, todas×finalizadas).
- **commission_entries** — id, companyId, professionalId, orderId?, baseAmount, commissionAmount, bonusAmount, status(open|paid|reversed), competenceDate, availableDate, signed.
- **commission_payments** — id, companyId, professionalId, amount, paidAt, closingId.
- **commission_closings** — id, companyId, periodStart, periodEnd, status.

## Domínio: Fiscal (fase 5)
- **fiscal_settings** — id, companyId, municipalRegistration, cnae, serviceCode, taxProfileJson, certificateRef.
- **invoices** — id, companyId, orderId?, type(nfse|nfe|nfce), status, number, issuedAt, customerSnapshotJson, payloadJson, returnJson.
- **invoice_items** — id, invoiceId, description, quantity, unitPrice.
- **tax_profiles** — id, companyId, name, rulesJson.

## Domínio: Marketing
- **booking_links** — id, companyId, slug(unique), active, configJson.
- **campaigns** — id, companyId, name, channel(whatsapp|sms|email), segmentJson, status.
- **campaign_messages** — id, campaignId, customerId, status, sentAt.
- **promotions** — id, companyId, name, scopeType, scopeId?, discountType, discountValue, validFrom, validTo, usageLimit, appliesOnline.
- **coupons** — id, companyId, code, promotionId, usageLimit, usedCount.
- **reviews** — id, companyId, customerId, professionalId?, serviceId?, rating, comment, createdAt.
- **cashback_rules** — id, companyId, scopeType, scopeId?, percent, validityDays, active.

## Domínio: Sistema
- **notifications** — id, companyId, userId?, type, title, body, readAt, createdAt.
- **audit_logs** — id, companyId, userId, action, entityType, entityId, dataJson, at.
- **files** — id, companyId, url, mime, size, ownerType, ownerId.
- **documents** / **document_templates** — gerador de documentos (fase 4).
- **settings** — id, companyId, key, valueJson.
- **goals** (metas) — id, companyId, period, scopeType, scopeId?, target, kind(sales|appointments|...).
- **reports_cache** — id, companyId, key, payloadJson, generatedAt.

## Regras de integridade (resumo)
- Comanda finalizada ⇒ cria `transactions` (receita) + `commission_entries` + opcional `invoices`.
- Venda de produto ⇒ `inventory_movements(out)`; compra ⇒ `inventory_movements(in)`.
- Pagamento em dinheiro ⇒ `cash_movements(in)` no caixa aberto; pix/cartão conforme `payment_methods.goesToCash`.
- Não excluir marca/categoria com itens vinculados.
- Agendamento não pode colidir com horário ocupado do profissional nem violar seu `professional_schedules`.
