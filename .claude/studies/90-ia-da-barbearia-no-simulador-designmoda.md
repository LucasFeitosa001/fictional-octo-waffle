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

O teste de produção revelou uma segunda corrida: `IngestService.persistir()`
sempre chamava `autopilot.processar(conversa.id)` em fire-and-forget
(`apps/api/src/ingest/ingest.service.ts:465`), enquanto
`SimuladorController` chamava outro `processar(..., { force: true, dryRun:
true })` logo depois. Assim havia dois cérebros para a mesma entrada: o dry-run
e um processamento normal sem o agente escolhido. O mesmo defeito existia no
laboratório de stories, que também persiste e chama o autopilot explicitamente.

## Decisão

1. O simulador recebe um `agenteId` opcional, validado dentro do tenant atual.
   Produção continua usando somente o agente ativo.
2. `AutopilotService` e `BrainService` aceitam a substituição apenas quando o
   chamador explícito a fornece; nenhum fluxo real passa esse campo.
3. O simulador chama o autopilot com `dryRun: true`: tools de leitura continuam
   consultando serviços/profissionais/horários reais da DesignModa, mas propostas
   de criar/cancelar nunca chegam ao executor.
   `IngestService.persistir` ganha ainda a opção interna
   `dispararEfeitos: false`; simulador e laboratório de stories a usam para não
   disparar um segundo autopilot nem automações em paralelo.
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

## 01/08 — “Ativo” e “pausado” não explicavam o estado real

O dono ativou a cópia da Barbearia e a tela voltou a mostrar a Recepção
DesignModa em produção. Os logs fecharam a sequência: a Barbearia foi ativada
às 14:41:02 e, 13 segundos depois, a Recepção DesignModa foi reativada.

A causa não estava no `POST /agentes/:id/ativar`. O editor
`apps/web/app/agentes/[id]/page.tsx` carregava `ativo` no estado do formulário,
mas não exibia nenhum controle correspondente. Ao salvar uma aba antiga, ele
reenviava escondido o `ativo: true` que tinha lido antes da troca. Então
`apps/api/src/agentes/agentes.service.ts:108` chamava `ativar(id)` e desfazia a
troca explícita.

Decisão:

1. `PATCH /agentes/:id` nunca muda o agente de produção. A única autoridade
   para isso é a rota explícita `/ativar`.
2. O formulário não carrega nem envia `ativo` escondido.
3. Na lista, “ATIVO/PAUSADO” vira “EM PRODUÇÃO/DISPONÍVEL PARA TESTE”. Só um
   agente atende conversas reais; os demais continuam totalmente testáveis.
4. O falso menu de três pontos — que ativava um agente sem abrir menu — sai.
5. Todo cartão ganha “Testar”, abrindo o simulador com aquele agente já
   selecionado. A troca de produção passa a dizer “Usar nas conversas” e pede
   confirmação informando qual agente será substituído.

## 01/08 — a confirmação “12:00, pode ser?” perdeu a oferta

Na conversa real do simulador, a IA consultou horários, apresentou a lista e,
quando o cliente respondeu “12:00, pode ser?”, caiu no texto fixo
`[SIMULAÇÃO Mariana]...`. O log da API às 14:44:53 fechou o motivo: Groq 400
`Failed to call a function`.

O problema não é a interrogação. A oferta assinada devolvida por
`consultar_horarios` só existia no array local de mensagens de ferramenta
dentro daquele request. O histórico persistido guarda apenas o texto visível da
IA. No turno seguinte, o modelo sabia que 12:00 tinha sido oferecido, mas já não
tinha a oferta opaca exigida por `criar_agendamento`; tentou fabricar a chamada
e o Groq recusou antes de ela chegar à aplicação.

Correção decidida:

- a oferta assinada nunca mais é argumento que o modelo precisa repetir;
- o backend guarda em `Conversa.raw.agenda` a última oferta, os slots, serviço,
  profissional e vencimento, preservando os outros campos de `raw`;
- a tool `criar_agendamento` recebe só o horário e o backend encaixa esse horário
  em um slot realmente ofertado, anexando o token guardado;
- frases curtas de confirmação com um único horário válido (“12:00, pode ser?”,
  “pode marcar 12h”, “12h tá bom”, “fechado 12:00”) têm resolução determinística
  antes do LLM. Negação, duas opções ou horário fora da oferta não executam;
- o servidor SalonPass continua como última autoridade e revalida assinatura,
  expiração e pertencimento do slot;
- o nome confiável já capturado do WhatsApp (`pushName`/agenda) passa a entrar no
  contexto como primeiro nome sanitizado, nunca como instrução;
- a memória durável existente deixa de ser específica de loja de bebês e passa
  a aprender também serviço, profissional e preferência de dia/horário. Ela não
  “treina o modelo” nem grava cada frase: guarda somente fatos duráveis por
  contato, para não memorizar ruído ou dado efêmero.

## 01/08 — o teste real encontrou mais duas oscilações antes da entrega

Depois do primeiro deploy, a reprodução em produção mostrou que “sim quero”,
diante de 41 horários, fez o modelo escolher 14h sozinho. O slot pertencia à
oferta, mas isso só provava disponibilidade — não autorização da cliente. A
tool `criar_agendamento` agora exige as duas provas no backend: o slot precisa
estar na oferta assinada **e** a fala da cliente precisa selecionar um horário
inequívoco. “Sim quero” conserva a oferta e pede a hora; “12:00, pode ser?”
autoriza 12:00. O argumento produzido pelo modelo nunca autoriza a si mesmo.

Outra rodada do Groq respondeu HTTP 200, mas serializou a tool literalmente no
texto (`<function=consultar_horarios>...</function>`) em vez de preencher
`tool_calls`. `groq.client.ts` normaliza apenas nomes presentes na allowlist de
tools enviada pela aplicação e somente quando os argumentos formam um objeto
JSON válido. Função desconhecida continua texto e nunca executa. O marcador
interno deixa de vazar para o cliente.

O backend também corrige um `serviceId` textual inválido somente quando a fala
do cliente cita exatamente um serviço real recém-listado. Não faz o mesmo com
profissional ambíguo: a IA deve perguntar a preferência, não escolher uma
pessoa escondido.

Certificação final:

- 37/37 testes direcionados passam, incluindo a frase do relato, cinco formas
  de escolher a hora, negação, pergunta, duas horas, interrupção por dúvida,
  oferta não exposta, tool textual permitida/negada e memória por contato;
- a suíte completa voltou a 98/98: três testes antigos tinham expectativas
  defasadas para os claims de embed e o payload de branding, e cinco testes do
  conector Pacto herdavam `PACTO_MOCK=true` do ambiente em vez de isolarem o
  caminho HTTP que pretendiam certificar;
- produção: “sim quero” não escolheu hora; “12:00, pode ser?” concluiu às 12h
  e chamou Paulo pelo nome; uma dúvida intermediária não apagou a oferta;
- todas as mensagens ficaram `simulada`; DesignModa teve zero agendamentos e
  zero linhas de WhatsApp criados durante a janela;
- os quatro contatos `sim:codex-*`, suas 36 mensagens e quatro memórias de
  teste foram removidos depois da prova;
- a Recepção DesignModa permaneceu o único agente em produção e a cópia da
  Barbearia permaneceu disponível somente para teste.

## Melhoria colateral encontrada no fechamento

O log antigo do Kanban mostrava `CrmCard.motivo does not exist`. A comparação
do schema revelou que os tenants antigos também não tinham `movidoEm`; apenas
`emp_barbeariapaulista` já nascera alinhado ao Prisma. As duas colunas aditivas
foram aplicadas em `emp_alecrim`, `emp_designmoda`, `emp_silviahair` e
`emp_timefit`, preservando todos os cards. `GET /crm/boards` da DesignModa
voltou 200 depois da correção.

## 01/08 — tool textual vazou e a autorização precisava de dois níveis

O modelo Groq devolveu duas variações de chamada serializada no texto:
`<function=listar_servicos={}></function>` e
`<function=listar_profissionais={"serviceId":"1"}></function>`. O parser em
`apps/api/src/autopilot/groq.client.ts` reconhecia apenas argumentos escritos
entre a abertura e o fechamento. A segunda forma ficou visível ao cliente; no
turno seguinte, sem resultado estruturado, o modelo inventou cortes e preços
que não existem na DesignModa.

Decisão:

1. O parser aceita as duas serializações, mas só executa nomes presentes na
   allowlist de tools enviada pela aplicação. Marcadores desconhecidos,
   truncados ou inválidos são removidos do texto; código de ferramenta nunca é
   resposta ao cliente.
2. Depois de `listar_servicos`, se o pedido não corresponde exatamente a um
   serviço real, `apps/api/src/autopilot/agenda-tools.service.ts` responde de
   forma determinística com os serviços retornados pela SalonPass. O modelo não
   recebe a oportunidade de fabricar alternativas ou preços.
3. A permissão de saída deixa de depender apenas do kill-switch global. O
   cadastro da empresa em `apps/api/prisma/platform/schema.prisma` ganha uma
   autorização de outbound, desligada por padrão. `apps/api/src/mensageria/
   mensageria.service.ts` exige o kill-switch **e** essa autorização por tenant.
4. O mesmo cadastro guarda se a IA atende todos os contatos. O padrão é false.
   Em `apps/api/src/autopilot/autopilot.service.ts`, a autonomia vale quando o
   modo todos está ligado ou quando `Conversa.iaHabilitada` liberou aquele
   contato. No modo selecionados, o switch já existente em
   `apps/web/app/components/crm/InboxChatHeader.tsx` continua sendo a seleção
   individual.
5. `apps/api/src/agentes/agentes.controller.ts`, `apps/api/src/agentes/
   agentes.service.ts` e `apps/web/app/agentes/page.tsx` expõem e explicam a
   política. A empresa vê se a saída real foi autorizada, mas só escolhe entre
   todos e selecionados; ela não pode autorizar a si própria.

A DesignModa (empresa do Lucas) é a única autorização inicial. Nenhum envio de
teste real é permitido sem número destinatário exato, revisão do backlog e
confirmação do dono, conforme `AGENTS.md`.

### Falha encontrada ao ligar a chave global

O primeiro smoke test depois de `OUTBOUND_ENABLED=true` revelou uma dependência
escondida: `dryRun` impedia criar/cancelar agenda, mas a resposta textual ainda
chamava `MensageriaService`; antes, era o kill-switch desligado que a segurava.
Com a DesignModa autorizada, um `waJid` iniciado por `sim:` atravessou o webhook
externo. A saída global foi desligada imediatamente.

Correção em defesa dupla:

- `AutopilotService` grava resposta de dry-run diretamente como `simulada` e
  nem chama a mensageria;
- `MensageriaService` recusa incondicionalmente qualquer `waJid` `sim:`, para
  cobrir aprovação manual e futuros chamadores que esqueçam a opção.

A linha criada no outbox da SalonPass precisa ser localizada e encerrada antes
de reativar a chave global; ela não pode ser drenada como teste.

## 01/08 — Fechamento da autorização, do incidente e do deploy

O artefato do primeiro smoke inseguro foi localizado pela `requestKey`
`421de263-de51-4f55-a0a2-5a54af5af60b`. A SalonPass o aceitou e o socket o
marcou como `sent` para um número sintético mascarado `160***126`; não existe
ACK `delivered` nem `read`. A linha foi preservada como histórico honesto — não
foi apagada nem reclassificada. Depois da defesa dupla de `dryRun` + prefixo
`sim:`, nenhum outro `voltr_outbound` nasceu.

A saída global voltou a ficar ligada, porém o backend agora exige os dois
níveis de autorização:

- `OUTBOUND_ENABLED=true` na infraestrutura;
- `Empresa.outboundAutorizado=true` no tenant.

Somente `designmoda` recebeu a autorização de tenant. `alecrim`,
`barbeariapaulista`, `silviahair` e `timefit` continuam `false`. Dentro da
DesignModa, `iaTodosContatos=false` e havia zero conversas com
`iaHabilitada=true` no fechamento: a empresa pode enviar, mas a IA automática
continua desligada para todos até alguém selecionar contatos ou confirmar o
modo “todos”.

O deploy seguinte revelou mais uma diferença importante: fila aceita não é
mensagem enviada. A Voltr ganhou o estado `na_fila`; somente o ACK `sent` do
WhatsApp promove para `enviada`, e os estados seguintes avançam
monotonicamente para `entregue` e `lida`. Ver estudo 91.

Após o App Runner reiniciar, a sessão da DesignModa precisou de duas tentativas
de 45 s e reconectou sem QR nem remoção de lease. A fila permaneceu vazia.

Na auditoria final, o banco ainda mostrava a cópia da Barbearia como agente de
produção — estado que contrariava a finalidade deste estudo. A situação foi
restaurada explicitamente:

- `Recepção DesignModa` = **EM PRODUÇÃO**;
- `Mariana · Barbearia Paulista (teste)` = **SÓ TESTE**.

Um smoke final em produção, com a frase “quero marcar para cortar daqui a
pouco”, gerou apenas saída `simulada`, sem marcador `<function...>` e sem linha
na outbox. A resposta listou os quatro serviços reais que existiam naquele
momento: Cabelos, Corte masculino de cabelo, Pes e Unhas. A conversa `sim:` e a
memória temporária foram removidas depois da prova.

## 01/08 — “Quero o corte” repetia o catálogo

Com os quatro serviços acima já exibidos, a cliente respondeu “quero o corte”.
Mesmo havendo uma única opção cujo nome continha “corte”, o resolvedor exigia o
nome completo “Corte masculino de cabelo”. Como não encontrou essa frase exata,
devolveu a lista inteira de novo.

A correção fica em `apps/api/src/autopilot/agenda-tools.service.ts`, no
repositório Voltr: referências naturais são pontuadas pelos termos relevantes
da última fala. Flexões simples compartilham a mesma raiz (`corta`, `cortar` e
`corte`; singular/plural), e também são aceitas escolhas por posição (“a
primeira”, “opção 2”) ou preço inequívoco (“o de 35 reais”).

A resolução continua fail-closed:

- só avança quando existe **um único melhor resultado**;
- se “corte” puder ser corte masculino ou infantil, mostra somente essas opções
  e pergunta qual, sem escolher por conta própria;
- palavras genéricas como “cabelo”, quando combinam igualmente com “Cabelos” e
  “Corte masculino de cabelo”, também permanecem ambíguas;
- o `serviceId` final continua vindo exclusivamente do catálogo retornado pela
  SalonPass, nunca do texto nem do modelo.

Certificação depois do deploy: 119/119 testes da Voltr passaram. No simulador
de produção, “quero marcar amanhã” exibiu o catálogo e a resposta seguinte,
“quero o corte”, não repetiu a lista: resolveu `Corte masculino de cabelo` e
avançou para a disponibilidade. Como não havia profissional disponível amanhã,
respondeu isso e ofereceu consultar hoje. As duas saídas ficaram `simulada`,
nenhum marcador de tool apareceu e a conversa temporária foi removida.
