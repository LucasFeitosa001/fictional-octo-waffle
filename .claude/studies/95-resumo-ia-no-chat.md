# Estudo 95 — Resumo WhatsApp e IA precisa existir no Voltr Chat

- `apps/web/src/pages/ia/IAAtendimentoPage.tsx:565-718` já mostra número
  conectado, pausa da IA e quatro métricas reais.
- `apps/web/src/pages/VoltrCrmPage.tsx:183-210` renderizava somente o iframe
  do `/voltr-chat`; por isso a mesma área de Atendimento não tinha o resumo
  nem o controle global.
- As métricas são servidas pelo endpoint autenticado
  `/whatsapp/inbox/stats` e a configuração por `/whatsapp/inbox/config`.

Decisão: no escopo `chat`, renderizar o mesmo resumo real acima do iframe,
reutilizando os endpoints existentes; as demais áreas continuam full-bleed.
