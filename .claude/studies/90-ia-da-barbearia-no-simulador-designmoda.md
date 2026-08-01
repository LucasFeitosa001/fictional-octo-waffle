# Estudo 90 — IA da Barbearia Paulista no simulador da DesignModa

Pedido do dono em 01/08/2026: colocar a IA da Barbearia Paulista dentro da
DesignModa para inspecioná-la e testá-la pela aba **Testar IA**, sem substituir a
recepção atual.

## O comportamento real antes da mudança

- `apps/web/app/embed/ia/page.tsx:30` monta a aba Testar com a mesma
  `SimuladorPage` de `apps/web/app/simulador/page.tsx`.
- `apps/web/app/simulador/page.tsx:451` envia somente `texto` e `sessao` para
  `POST /simulador/cliente`; não existe escolha de agente.
- `apps/api/src/ingest/simulador.controller.ts:45` chama o autopilot com
  `{ force: true }`.
- `apps/api/src/autopilot/autopilot.service.ts:119` e
  `apps/api/src/autopilot/brain.service.ts:145` carregam sempre
  `agenteAtivo()`. Portanto, um segundo agente inativo aparece na configuração,
  mas nunca é usado pelo simulador.
- `apps/api/src/agentes/agentes.service.ts:123` garante um único agente ativo.
  Ativar a IA da Barbearia só para testá-la desativaria a recepção DesignModa.

## Risco encontrado no simulador

O prefixo `sim:` impede o envio ao WhatsApp, mas não impede efeitos na agenda.
Depois que as tools foram ligadas, `AutopilotService.processar(..., { force:
true })` podia executar `AgendaExecutorService` e criar/cancelar um agendamento
real da DesignModa durante um teste. O texto da tela diz “nenhuma mensagem vai
para o cliente real”, mas isso não é equivalente a “nenhum dado real será
alterado”.

## Decisão

1. O simulador recebe um `agenteId` opcional, validado dentro do tenant atual.
   Produção continua usando somente o agente ativo.
2. `AutopilotService` e `BrainService` aceitam a substituição apenas quando o
   chamador explícito a fornece; nenhum fluxo real passa esse campo.
3. O simulador chama o autopilot com `dryRun: true`: tools de leitura continuam
   consultando serviços/profissionais/horários reais da DesignModa, mas propostas
   de criar/cancelar nunca chegam ao executor.
4. A tela ganha um seletor e mostra nome, negócio e se o agente está ativo em
   produção ou disponível somente para teste. Trocar o agente abre uma nova
   sessão para não misturar históricos/personas.
5. A cópia da Barbearia nasce inativa, com aprovação obrigatória, sem
   reengajamento e sem blocos fictícios. Isso não altera nenhuma conversa real.

O provisionamento reproduzível dessa cópia fica em
`apps/api/prisma/tenant/bootstrap-barbearia-teste-designmoda.ts` no repositório
Voltr. O script aponta explicitamente para `emp_designmoda`, procura pelo nome
estável `Mariana · Barbearia Paulista (teste)` e só cria quando não existe; uma
segunda execução não duplica nem sobrescreve blocos que o dono editar na tela.

## Certificação necessária

- O agente escolhido chega ao cérebro; o agente ativo não é usado no lugar.
- `dryRun` não chama o executor mesmo quando o modelo propõe escrita.
- O simulador continua gravando apenas mensagens com entrega `simulada`.
- A IA da Barbearia aparece na lista do DesignModa e pode ser escolhida na aba
  Testar sem se tornar ativa.
- Um teste de conversa consulta tools reais, mas deixa zero agendamentos e zero
  mensagens de WhatsApp.
