# Estudo 16 — SalonPay (cadastro do gateway), exclusivo da DesignModa

Referência: vídeo `WhatsApp Video 2026-07-27 at 17.44.43.mp4` (Belasis, mobile), quadros em
`scratchpad/salonpay/f_001..009.jpg`.

## O que a referência mostra

**Entrada:** Sidebar → **Financeiro** → item **"Belasis Pay"** com selo **novo**, posicionado entre
"Histórico de caixa" e "Notas Fiscais" (quadro f_004).

**Tela:** drawer com título "Belasis Pay" e X para fechar (f_006), contendo um formulário de cadastro:

| Campo | Obrigatório | Observação |
|---|---|---|
| E-mail | sim (*) | |
| Telefone | sim (*) | seletor de país com bandeira (BR +55) |
| — seção **Endereço** — | | separador com rótulo |
| CEP | sim (*) | |
| Logradouro | sim (*) | |
| Número | sim (*) | |
| Bairro | sim (*) | |

**Rodapé:** `Cancelar` · `Suporte` (ícone WhatsApp) · `Salvar` (primário).

O vídeo tem 9s e não mostra o que acontece após Salvar, nem estados de erro/sucesso, nem se há mais
campos abaixo de "Bairro" (a rolagem para ali). **Não inventar** o que não apareceu.

## O que já existe no nosso código

- Item de menu já criado: `apps/web/src/layout/Sidebar.tsx:138` →
  `{ to: '/financeiro/belasis-pay', label: 'SalonPay', icon: IconCreditCard, badge: 'em breve', perm: 'financeiro:view' }`
- Título/descrição da rota: `apps/web/src/layout/Topbar.tsx:24` →
  `{ path: '/financeiro/belasis-pay', title: 'SalonPay', description: 'Cadastro do gateway de pagamento' }`
- O tipo de selo aceita `'Beta' | 'novo' | 'em breve'` (`apps/web/src/layout/Sidebar.tsx:68`).

Ou seja: **falta a página/rota e a liberação por empresa**. O selo deve passar de "em breve" para
"novo" apenas para quem tem o recurso.

## Restrição do dono

**Só a empresa DesignModa** deve ver/usar. Empresa em produção: buscar por `name = 'DesignModa'`
(id `cmryy21zj000hjx01lmccyco0` em 2026-07-27; **resolver por nome, não fixar id no código**).

Padrão a usar: feature flag por empresa, como o resto do sistema
(`apps/api/src/modules/feature-flags/*`, `FeatureFlag` por companyId sobrepõe o plano). Criar a key
`salonpay` no catálogo, **fora de todos os planos**, e habilitar via `FeatureFlag` só para DesignModa —
assim liberar para outra empresa depois é um registro no banco, não um deploy.

## Persistência

Não criar tabela nova para um cadastro único por empresa: usar o `Setting` por empresa
(`companyId_key`), chave `salonpay.registration`, com o JSON dos campos. É o mesmo padrão já usado por
`finance.settings` e `booking.appearance`.

**Não** guardar nada sensível de pagamento (chave de API, token do gateway) nesse Setting sem
combinar antes — o vídeo não mostra esse tipo de campo.
