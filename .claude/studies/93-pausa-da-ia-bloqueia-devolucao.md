# Estudo 93 — Pausar a IA precisa bloquear a devolução da conversa

## Evidência

- `apps/web/src/pages/ia/IAAtendimentoPage.tsx:918-940` já desabilita
  visualmente “Devolver para IA” quando `config.enabled` é falso, mas isso era
  apenas frontend.
- `apps/api/src/modules/whatsapp-inbox/whatsapp-inbox.service.ts:373-409`
  aceitava `handledByAi: true` sem consultar a configuração global. Uma
  chamada direta à API podia religar a IA em uma conversa enquanto o painel
  mostrava “IA pausada”.
- Os indicadores de topo já existem em
  `apps/web/src/pages/ia/IAAtendimentoPage.tsx:697-718`, alimentados por
  `/whatsapp/inbox/stats`; o ajuste deve preservar esses números reais.

## Decisão

Manter os quatro indicadores reais no topo e tornar a regra de pausa
autoritativa no backend: `handledByAi: true` só pode ser salvo quando a
configuração global estiver habilitada. A tela também mantém o botão
desabilitado e explica o motivo.
