# Estudo 92 — Cliente quer agendar, mas não há profissional/horário

## Relato observado

No simulador, o cliente pediu corte para amanhã e a Mariana respondeu que iria
“confirmar com a equipe”. Nada no caminho atual cumpre essa promessa. Quando o
cliente respondeu apenas “sim”, o estado também se perdeu e o catálogo inteiro
foi apresentado novamente.

### Causa concreta do caso de 02/08

O banco de produção mostrou Lucas Feitosa ativo, `onlineBookable=true` e com
expediente no domingo (`weekday=0`) das 09:00 às 20:00. Porém, a junção
`ProfessionalService` entre Lucas e “Corte masculino de cabelo” não existia.
Por isso `/voltr/agenda/profissionais` devolvia lista vazia antes mesmo de o
motor consultar o expediente.

O vínculo faltante foi inserido sem substituir os serviços existentes. Depois,
a mesma rota assinada usada pela Mariana devolveu Lucas e a consulta de domingo
retornou 44 slots reais. A aba Expediente também precisa deixar explícito que o
horário só vale para serviços marcados em “Personalizar serviços”.

O primeiro smoke da conversa encontrou uma segunda falha: a SalonPass devolve
slots ISO em UTC e a tool os entregava crus ao modelo. Assim, o expediente local
09:00–20:00 apareceu à cliente como 12:00–22:45. O estado privado continua
guardando ISO (necessário para validar/agendar), mas o resultado exposto ao LLM
agora contém somente `HH:mm` em `BUSINESS_TIMEZONE`.

O smoke posterior ao deploy encontrou uma terceira falha: depois de reconhecer
“corte”, o modelo respondeu “deixa eu ver os horários” sem emitir a próxima
tool call. Como cada turno HTTP termina quando vem texto sem ferramenta, essa
promessa deixava a cliente esperando indefinidamente. O orquestrador agora
intercepta até duas promessas de consulta sem ação e força a próxima leitura na
mesma rodada; somente o resultado real pode encerrar o turno.

## Evidências do código atual

- `apps/api/src/autopilot/agenda-tools.service.ts:446` apenas entrega ao modelo
  a lista retornada por `listar_profissionais`; lista vazia não vira evento
  estruturado nem estado persistente.
- `apps/api/src/autopilot/brain.service.ts:94` persiste somente a oferta válida
  em `Conversa.raw.agenda`. Não existe estado “aguardando a equipe”.
- `apps/api/src/autopilot/autopilot.service.ts:407` já sabe criar
  `Notificacao` para o painel, com idempotência por conversa/gatilho, mas não há
  gatilho para indisponibilidade da agenda.
- `apps/api/src/conversas/conversas.gateway.ts:90` já entrega a notificação em
  tempo real e Web Push; não é necessário criar outro centro de alertas.
- `apps/api/src/mensageria/mensageria.service.ts:280` é o único caminho correto
  de saída: aplica autorização por tenant, idempotência e status de entrega.
- `apps/api/prisma/platform/schema.prisma` já possui `Empresa.waNumero`,
  `outboundAutorizado` e `iaTodosContatos`. O aviso interno pode usar o número
  vinculado sem aceitar destino vindo do modelo.
- `apps/api/src/app.module.ts:37` já registra `ScheduleModule`; o retorno ao
  cliente deve ser durável em cron, nunca em timer do request.

## Implementação decidida

Arquivos centrais no repositório Voltr:

- `apps/api/src/autopilot/agenda-tools.service.ts`: produz um impasse
  estruturado quando não há profissional ou horário, preserva serviço/data e
  entende “sim” como aceite da espera — sem voltar ao catálogo.
- `apps/api/src/autopilot/brain.service.ts`: persiste esse estado em
  `Conversa.raw.agendaEspera` e injeta o assunto pendente no prompt; perguntas
  laterais são respondidas brevemente e a conversa volta ao agendamento.
- `apps/api/src/autopilot/agenda-pendencias.service.ts` (novo): cria/reusa a
  `Notificacao` do painel, emite realtime/push e envia o aviso interno pelo
  `MensageriaService` usando `Empresa.waNumero`.
- `apps/api/src/autopilot/agenda-pendencias.scheduler.ts` (novo): a cada minuto
  processa pendências vencidas, cancela se humano respondeu/assumiu, procura
  opções reais novamente e envia um único retorno idempotente.
- `apps/api/src/autopilot/autopilot.service.ts` e
  `apps/api/src/autopilot/autopilot.module.ts`: ligam o impasse aos portões já
  existentes.
- `apps/api/src/platform/platform.service.ts`: só libera empresas presentes em
  `AGENDA_WAITLIST_TENANTS` e ainda exige `outboundAutorizado=true`. Lista
  ausente = automação desligada por padrão.
- `packages/shared/src/index.ts` e o sino do web: reconhecem
  `agenda_sem_disponibilidade` com rótulo claro.

## Travas

1. Simulador persiste somente o estado conversacional; não cria notificação
   real, não envia aviso e não agenda retorno.
2. `AGENDA_WAITLIST_TENANTS` nasce vazio. Produção habilita apenas DesignModa,
   conforme autorização do dono.
3. Retorno ao cliente exige também `OUTBOUND_ENABLED`,
   `Empresa.outboundAutorizado` e (`iaTodosContatos` ou
   `Conversa.iaHabilitada`). Opt-in sozinho nunca autoriza.
4. Aviso interno usa exclusivamente `Empresa.waNumero`; o modelo não escolhe o
   destinatário.
5. Aviso e retorno usam `Mensagem.externalId` determinístico. Reinício/retry
   não duplica.
6. Se um humano mandar mensagem, assumir ou resolver a conversa, o retorno
   automático não sai.
7. `AUTOPILOT_ENABLED` e um agente ativo também são exigidos no momento do
   retorno. Pausar a recepção interrompe até pendências já criadas.
8. Nenhum teste envia WhatsApp real. O runtime será validado com simulador e
   mocks; envio real exige destinatário exato e revisão do backlog.

## Estado de autorização encontrado antes do deploy

- Somente `emp_designmoda` possui `outboundAutorizado=true`; Alecrim,
  Barbearia Paulista, Silvia Hair e Timefit continuam bloqueadas.
- `iaTodosContatos=false` e havia zero conversas da DesignModa com
  `iaHabilitada=true`: o padrão por contato permanece desligado.
- `Empresa.waNumero` da DesignModa ainda estava vazio, embora a credencial
  Baileys persistida da SalonPass prove o número conectado. O deploy deve
  sincronizar esse número na plataforma para o alerta interno ter destinatário;
  o modelo nunca recebe nem escolhe esse campo.

## Texto de retorno

Com opção real encontrada, oferece um dia/profissional e poucos horários, e
mantém a oferta assinada para a resposta seguinte. Sem opção real, não inventa:
informa que ainda não houve liberação e oferece outro serviço ou continuidade
da verificação. O agradecimento é curto e natural, sem encerrar à força.
