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
