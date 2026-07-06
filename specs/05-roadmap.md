# Beautypass — Roadmap (Fases)

Priorização do MVP até premium. Cada fase só começa com specs dos seus módulos prontas.

## Fase 1 — Base obrigatória (MVP núcleo)
Superfícies: **mobile admin**.
- [ ] Auth: login admin, login rápido cliente, Google, Apple, telefone, permissões.
- [ ] Empresa + usuários + perfil + permissões por usuário.
- [ ] Clientes (CRUD + painel + débitos/créditos).
- [ ] Profissionais (CRUD + serviços executados + horários + comissão).
- [ ] Serviços (CRUD + preço + duração + categoria).
- [ ] Agenda (calendário dia/semana/mês, status, filtros, CRUD agendamento).
- [ ] Comandas (CRUD, serviços/produtos, descontos, total automático).
- [ ] Pagamentos simples (dinheiro, pix, cartão; múltiplas formas).
- [ ] Caixa (abrir/fechar/conferir).
- [ ] Painel básico (vendas, agendamentos, comandas, período).

## Fase 2 — Gestão real
- [ ] Produtos + estoque (movimentações, mínimo, alerta).
- [ ] Fornecedores + compras (atualiza estoque).
- [ ] Financeiro (transações, contas, formas, categorias, fluxo de caixa).
- [ ] Comissões (regras + resumo + fechamento + pagamento).
- [ ] Relatórios básicos.

## Fase 3 — Online (agendamento público)
Superfície: **web (Next.js)**.
- [ ] Link de agendamento + slug/subdomínio.
- [ ] Página pública (tema escuro): detalhes, serviços, profissionais, assinaturas.
- [ ] Fluxo: serviço → profissional (ou sem preferência) → data/hora → login rápido → confirmação.
- [ ] Horários disponíveis (respeita ocupação + horário do profissional + duração).
- [ ] Agendamento público entra na agenda do salão.

## Fase 4 — Avançado
- [ ] Pacotes + pacotes predefinidos.
- [ ] Assinaturas (planos recorrentes).
- [ ] Cashback (config + saldo + uso na comanda).
- [ ] Campanhas, promoções/cupons, avaliações.
- [ ] Metas, gerador de documentos, anamneses.

## Fase 5 — Profissional / Premium
- [ ] Notas fiscais (NFS-e/NF-e/NFC-e).
- [ ] Pagamento online (gateway, Pix, cartão, repasse).
- [ ] Relatórios avançados + assinatura digital.
- [ ] Multiunidade (branches).
- [ ] Planos/Pro (feature flags + modal de upsell).
- [ ] Painel web admin completo.

## Ordem de scaffold (infra)
1. Monorepo root + `packages/db` (Prisma) + `packages/shared`.
2. `apps/api` (NestJS) — módulos Fase 1.
3. `apps/mobile` (Expo) — telas Fase 1.
4. `apps/web` (Next.js) — booking público (Fase 3).
