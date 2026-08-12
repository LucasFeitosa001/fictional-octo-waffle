# Estudo 11 — Subdomínio próprio exclusivo do PRO/MAX

Regra de produto definida pelo dono (27/07):
- **starter** → só `agenda.salonpass.com.br/<slug>` (link por caminho)
- **pro / max** → também `<slug>.salonpass.com.br` (subdomínio próprio), e pode **editar o slug**

## O que JÁ existe (verificado, nada a construir)

Infra (conferida na AWS):
- DNS curinga resolvendo: `labelledejour.salonpass.com.br` responde **HTTP 200**
- Certificado ACM `*.salonpass.com.br` — **ISSUED**
- CloudFront `E1D9PTC66EFAJ7`, aliases `agenda.salonpass.com.br` + `*.salonpass.com.br`,
  origem `beautypassagenda-web-834424012647`

Código:
- `apps/web-club/src/lib/config.ts:54` `getSubdomainSlug()` — extrai o slug do host, com
  `RESERVED_SUBDOMAINS = {agenda, app, www, admin, api}` (`:52`)
- `apps/web-club/src/App.tsx:112` `const tenantSlug = getSubdomainSlug() || DEFAULT_BOOKING_SLUG`
- API pública por slug: `apps/api/src/modules/public-booking/public-booking.controller.ts:31`
- Modelo `BookingLink { slug @unique, active, configJson }`
- Tela de configuração com as 8 seções pedidas (`AgendamentoOnlinePage`): detalhes, config,
  personalizacao, links, galeria, servicos, horario, pagamentos

Dados (produção): as 4 empresas já têm link ativo —
`la-belle-de-jour`, `fatima-cabelos`, `studioborboletas`, `designmoda`.

## O que FALTA (o gate de plano)

**Hoje não há checagem de plano nenhuma**: qualquer empresa com slug ativo já é servida pelo
subdomínio. E `online_booking` está em `STARTER_FEATURES`
(`apps/api/src/modules/feature-flags/feature-catalog.ts:38`), ou seja, o agendamento online em si
é de todos os planos — o que muda é só o **subdomínio** e a **edição do slug**.

### Implementação em 3 camadas

1. **Catálogo de features** (`apps/api/src/modules/feature-flags/feature-catalog.ts`)
   - nova key `custom_subdomain`, presente em `PRO_FEATURES` e `MAX_FEATURES`, ausente do starter.

2. **API pública** (`public-booking`) — o `web-club` é público e não sabe o plano.
   O payload do portal (`getPortal(slug)`) passa a expor `customSubdomain: boolean`, resolvido pelo
   plano da empresa (mesma regra do FeatureFlagsService: assinatura ativa mais recente + overrides).

3. **web-club** (`App.tsx:112`)
   - se veio por subdomínio E o portal responder `customSubdomain: false` →
     **redirecionar** para `https://agenda.salonpass.com.br/<slug>` (301 no cliente), em vez de
     servir o portal. Assim o starter não ganha o recurso por acidente e o link não quebra.

4. **Admin** (`AgendamentoOnlinePage`, seção "links")
   - campo de editar slug só habilitado com `custom_subdomain`; sem ele, mostra o link por caminho
     e um aviso de upgrade. Usar `useCan`/features do front (fail-closed).

### Cuidados

- **Trocar slug quebra link divulgado.** Se o salão já divulgou `agenda.salonpass.com.br/<antigo>`,
  a troca derruba o antigo. Decidir com o dono: manter um alias do slug antigo (coluna nova ou
  tabela de redirects) ou aceitar a quebra.
- Validar slug: minúsculas, sem acento, `[a-z0-9-]`, não pode colidir com `RESERVED_SUBDOMAINS`,
  único (já é `@unique`).
- La Belle de Jour hoje é `la-belle-de-jour`; o dono quer `labelledejour`. Fátima seria `fatimacabelos`.
  **Confirmar antes de trocar** (ver quebra de link acima).

## Evidências da implementação (levantadas ao codificar)

`apps/api/src/modules/public-booking/public-booking.service.ts`:
- `apps/api/src/modules/public-booking/public-booking.service.ts:180` `getPortal(slug)` — resolve a
  empresa pelo slug (`:181`) e já monta o payload público do portal (`:204` em diante), incluindo
  `slug`, `name` e `plan`.
- `apps/api/src/modules/public-booking/public-booking.service.ts:261` `planLabel(companyId)` — lê a
  assinatura mais recente **sem filtrar status** e mapeia só `pro|premium|basic` (`:267`–`:275`);
  **ignora `max`** e devolve rótulo de exibição, não serve como gate.
- O módulo (`apps/api/src/modules/public-booking/public-booking.module.ts:10`) **não importa**
  FeatureFlagsModule, então o gate é resolvido aqui com a mesma regra (assinatura ativa mais recente).

Decisão: novo `hasCustomSubdomain(companyId)` — assinatura com status `active|trialing` mais recente,
plano `pro` ou `max` → true. Exposto no payload do portal como `customSubdomain`, que é a única fonte
para o `web-club` (público, sem sessão) decidir entre servir o subdomínio ou redirecionar.

`apps/web-club/src/App.tsx:112` consome `getSubdomainSlug()`; o redirect do starter entra aí.

Slugs em produção (27/07): `la-belle-de-jour`, `fatima-cabelos`, `studioborboletas`, `designmoda`.
Dono decidiu trocar para versões SEM hífen, **sem alias** (ninguém usa o agendamento online ainda).
