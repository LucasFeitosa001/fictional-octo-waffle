# Estudo 89 — Mariana: o fluxo de agenda foi implantado, mas não foi ligado

Pedido do dono: **“Arrume tudo e veja o que pode melhorar”**, depois de auditar o
trabalho do estudo 88.

Este estudo substitui o estado otimista do fim da sessão anterior pelo estado
observado no código dos dois repositórios. Nenhum envio real de WhatsApp faz parte
da certificação: a regra permanente exige destinatário exato e autorização.

## 89.1 — O cérebro nunca recebe as ferramentas

No repositório Voltr (`/home/lucssfeitosa/belivin-ia`):

- `apps/api/src/autopilot/groq.client.ts:136` aceita `tools` no método privado,
  porém o `JSON.stringify` de `:151`-`:157` envia só `model`, `messages`,
  `temperature` e `max_tokens`. Assim o Groq nunca pode devolver `tool_calls`.
- `apps/api/src/autopilot/brain.service.ts:53` injeta `AgendaToolsService`, mas
  `:182`-`:186` chama sempre `groq.complete`; zero chamadas a
  `agendaTools.conversar`.
- `brain.service.ts:95` declara `agendaSchema` e `:98` declara `aoPropor`, mas
  nenhum dos dois é usado.
- `brain.service.ts:255` é chamado pelo autopilot sem schema; `:257` tenta ler
  `r.proposta`, embora `chat()` (`brain.service.ts:60`-`:82`) nunca a devolva.

Resultado: criar, consultar e cancelar pela Mariana estão inertes apesar de a
ponte HTTP funcionar.

## 89.2 — Os blocos são salvos, mas não entram no prompt

- `apps/api/src/agentes/agentes.service.ts:151`-`:166` normaliza e grava os
  blocos corretamente.
- `apps/api/src/autopilot/persona.ts:226`-`:248` sabe montar a seção de
  conhecimento.
- Porém `brain.service.ts:135`-`:143` chama `montarPersona` sem `conhecimento`
  e sem `podeAgendar`.

Produção, leitura em 01/08/2026: o agente “Recepção DesignModa” está ativo,
`exigirAprovacao=true`, possui três blocos (`Endereço e horário`, `Pagamento`,
`Desligado`) e a IA está habilitada em 0 de 5 conversas. Os blocos foram criados
para teste na sessão anterior; não são conhecimento fornecido pelo dono.

## 89.3 — Aprovação pode mentir para o cliente

- `apps/api/src/autopilot/autopilot.service.ts:376`-`:406` grava/atualiza o
  rascunho, mas não grava `propostaAgenda` em `acaoProposta`.
- `apps/api/src/conversas/conversas.service.ts:224`-`:252` só executa uma ação
  quando `pendente.acaoProposta` existe. Portanto “aprovar” manda o texto de
  confirmação sem criar o agendamento.
- `conversas.service.ts:294`-`:307` (“editar e aprovar”) nunca olha a ação —
  enviaria o texto editado sem executar nada mesmo que a ação estivesse salva.
- Ao reutilizar um rascunho aberto, a ação anterior também precisa ser apagada
  quando o novo turno não propõe ação; do contrário uma aprovação futura pode
  executar proposta velha.

## 89.4 — Cancelamento existe só na SalonPass

No SalonPass:

- `apps/api/src/modules/voltr/voltr-agenda.controller.ts:57` expõe `meus` e
  `:63` expõe `cancelar`.
- `apps/api/src/modules/voltr/voltr-agenda.service.ts:198` lista os próximos e
  `:232` cancela conferindo o telefone da própria cliente.

Na Voltr:

- `apps/api/src/autopilot/agenda-tools.service.ts:43`-`:111` declara apenas
  listar serviços/profissionais/horários e criar.
- `apps/api/src/autopilot/salonpass-agenda.client.ts:83`-`:117` termina em
  `criar`; não possui clientes para `meus`/`cancelar`.
- `apps/api/src/autopilot/agenda-executor.service.ts:26`-`:50` executa somente
  criação.

Cancelar é uma escrita e deve seguir a mesma divisão de segurança: a ferramenta
apenas propõe; o autopilot executa se a IA estiver liberada naquele contato, ou o
humano executa ao aprovar.

## 89.5 — Idempotência e honestidade

`apps/api/src/modules/voltr/voltr-agenda.service.ts:150` cria diretamente. Uma
repetição de aprovação/fetch pode tentar criar duas vezes. O agendamento comum
tem lock contra sobreposição (`appointments.service.ts:766`-`:798`), mas não uma
chave própria da ação da IA.

Sem migração, o conector pode tornar a criação idempotente por identidade de
negócio: mesma empresa, cliente, profissional, serviço, início e status não
cancelado devolvem o agendamento existente. A busca deve acontecer antes da
criação e novamente após conflito, pois chamadas concorrentes serializam dentro
do `AppointmentsService`.

O cancelamento já é naturalmente idempotente: `voltr-agenda.service.ts:250`
devolve sucesso se já estava cancelado.

## 89.6 — Arquivos cobertos pela correção

SalonPass:

- `apps/api/src/modules/voltr/voltr-agenda.service.ts`
- `apps/api/src/modules/usecase-tests/voltr.usecases.test.ts`

Voltr (`/home/lucssfeitosa/belivin-ia`):

- `apps/api/src/autopilot/groq.client.ts`
- `apps/api/src/autopilot/brain.service.ts`
- `apps/api/src/autopilot/agenda-tools.service.ts`
- `apps/api/src/autopilot/agenda-executor.service.ts`
- `apps/api/src/autopilot/salonpass-agenda.client.ts`
- `apps/api/src/autopilot/autopilot.service.ts`
- `apps/api/src/autopilot/persona.ts`
- `apps/api/src/conversas/conversas.service.ts`
- `apps/api/test/agenda-flow.spec.ts` (novo)

## 89.7 — Certificação necessária

1. O corpo HTTP do Groq contém `tools` e `tool_choice: auto` somente no caminho
   com ferramentas; o caminho antigo permanece byte-semanticamente igual.
2. O cérebro injeta conhecimento, contexto de data/fuso e agenda, devolvendo a
   ação proposta depois do filtro de saída.
3. Leituras rodam; criar/cancelar nunca rodam dentro do cérebro.
4. IA liberada executa antes de enviar; IA não liberada persiste a ação.
5. Aprovar e editar/aprovar executam a ação antes da mensagem; falha impede a
   mensagem.
6. Proposta nova sem ação limpa ação antiga.
7. Criação repetida devolve o mesmo agendamento; cancelamento repetido é sucesso.
8. Nenhum teste envia WhatsApp real.

## 89.8 — Segundo tenant: Barbearia Paulista

Pedido complementar do dono: criar um tenant separado para **Barbearia
Paulista**, focado em agendamento e dúvidas respondidas por blocos de texto, sem
copiar uma versão enfraquecida da Mariana.

Evidência antes de provisionar, em produção em 01/08/2026:

- SalonPass: nenhuma linha de `Company` contém “Barbearia” ou “Paulista”.
- Voltr/platform: só existem `alecrim`, `designmoda`, `silviahair` e `timefit`.
- O runtime usa `BRAIN_PROVIDER=groq`, `AUTOPILOT_ENABLED=true`; por isso o novo
  agente precisa nascer com `exigirAprovacao=true`, zero conversas liberadas e
  nenhuma automação/reengajamento autônomo.
- A agenda só fica disponível quando o tenant aparece nos dois lados do par:
  `VOLTR_TENANT_MAP`/`VOLTR_SCOPES` na SalonPass e
  `SALONPASS_CONNECTOR_SECRETS` na Voltr. A ausência de qualquer lado é
  fail-closed.

Provisionamento reproduzível:

- SalonPass: `packages/db/prisma/bootstrap-barbearia-paulista.ts` cria somente
  a empresa **inativa**, sem usuário, WhatsApp, serviço ou dado inventado. O
  cadastro real continua dependendo do dono/e-mail e das informações do salão.
- Voltr: `apps/api/prisma/platform/bootstrap-barbearia-paulista.ts` cria
  `emp_barbeariapaulista`, aplica o schema atual e semeia um agente Mariana em
  modo aprovação, conhecimento vazio e canal WhatsApp. Nenhuma conversa nasce
  liberada.

O segredo HMAC nunca entra no repositório nem no estudo: é gerado na implantação
e configurado nos dois ambientes. A empresa/tenant existir não autoriza envio
real; ativação e teste de destinatário continuam sujeitos às regras permanentes
do WhatsApp.
