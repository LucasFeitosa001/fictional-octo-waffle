# Estudo 88 — Mapa: a IA do CRM agendando pela conversa

Pedido do dono: *"faça ela ser possível conseguir agendar conversando com um cliente, mapeia tudo
isso e faça os testes, ela tem que ser capaz de saber todo o fluxo"*.

Mapeamento em seis frentes sobre os dois repositórios (SalonPass e Voltr/Belivin), com céticos. O que
segue é o terreno — a implementação depende de duas decisões do dono (§88.7).

## 88.1 — A boa notícia: o fluxo de agendar já existe sem login

O módulo `public-booking` faz exatamente o percurso, sem usuário autenticado, sob
`api/v1/public/booking/:slug` (`public-booking.controller.ts:27`; prefixo em `main.ts:39`):

| passo | rota | observação |
| --- | --- | --- |
| serviços | `GET .../services` | só `onlineBookable && active && visible` (`public-booking.service.ts:397`) |
| profissionais | `GET .../professionals?serviceId=` | `serviceId` obrigatório; só quem executa todos (`:438`) |
| horários | `GET .../availability?serviceId=&professionalId=&date=` | mesmo motor do painel; já exclui passado e ocupado (`:463` → `appointments.service.ts:1422`) |

O `:slug` vem de um `BookingLink` ATIVO; sem ele, 404. Não há tenant no token — o tenant **é** o slug.

## 88.2 — A IA não tem ferramentas, e o cérebro não comporta

`groq.client.ts:75`-`:89` manda só `{model, messages, temperature, max_tokens}` — sem `tools`,
`tool_choice` nem leitura de `tool_calls`; `complete()` devolve `string`. O endpoint é compatível com
OpenAI e o modelo em produção (`llama-3.3-70b-versatile`) **suporta** tool use, conferido na doc do
Groq — o que falta é o cliente.

Dois detalhes que decidem o desenho:

- `brain.service.ts:139`-`:169` monta o system inteiro do banco a cada turno e chama o LLM **uma
  vez**. Ferramenta exige segunda chamada com o resultado — o formato atual (retorna string) não
  comporta.
- No caminho Groq o parâmetro `query` é **ignorado**: o cérebro relê as 12 últimas mensagens do banco
  (`:63`, `:101`, e o comentário em `autopilot.service.ts:186`). O único canal de contexto extra é
  `catalogoExtra`, que hoje carrega **produtos** (`:431`-`:511`) — não existe serviço, profissional,
  duração nem horário no prompt.

## 88.3 — A ponte Voltr → SalonPass está QUEBRADA, não só desligada

Achado mais grave do mapeamento.

- A Voltr assina `HMAC-SHA256(timestamp + "." + nonce + "." + rawBody)`
  (`belivin-ia/apps/api/src/mensageria/mensageria.service.ts:339`-`:357`).
- A SalonPass confere `HMAC-SHA256(rawBody)` (`voltr-signature.guard.ts:70`), e nem lê
  `x-timestamp`/`x-nonce`.

Ou seja: ligar a ponte hoje dá **403 em toda chamada**. E como não há janela de tempo nem nonce do
lado que valida, o esquema atual também não tem anti-replay.

Dois agravantes para qualquer rota nova de agenda:

- o `rawBody` só é guardado para URLs que começam com `/api/v1/voltr/whatsapp/` (`main.ts:80`-`:89`),
  então `/voltr/agenda/*` reprovaria em 100% das chamadas até o filtro ser ampliado — e, como a
  validação é sobre o corpo, teria de ser POST;
- o guard **não tem escopo**: quem tem o segredo do tenant pode chamar qualquer rota que o use. Não
  existe distinção entre "mandar mensagem" e "criar agendamento".

## 88.4 — O mecanismo de aprovação já existe, mas só carrega TEXTO

`autopilot.service.ts:364`-`:419`: no modo aprovação a IA gera e **não envia** — grava uma
`Notificacao` com `draftResposta` e volta. Quem aprova: `POST /conversas/:id/aprovar|negar|
editar-aprovar`.

O limite: `Notificacao` (`schema.prisma:152`-`:175`) tem `draftResposta` como **texto livre**. Não há
campo para uma AÇÃO estruturada (profissional, serviço, data/hora, duração). "Aprovar" hoje significa
só "mande este texto".

E o gate que segura é heurístico por palavra-chave (`intent.ts:21`-`:130`,
`PADROES_FECHAMENTO_SAIDA`): **não há nenhum padrão de horário/marcação**. Hoje uma conversa de
agendamento passa direto pelo gate.

## 88.5 — Produção: ninguém está exposto, e a IA não sabe nada do salão

Do banco da Voltr (EC2 sa-east-1):

- **2 agentes** em 4 tenants: `designmoda` → "Recepção DesignModa" (recepcionista,
  llama-3.3-70b-versatile, temperatura 0.6, `podeFecharVenda=false`, **`exigirAprovacao=true`**);
  `alecrim` → "Mariana" (`exigirAprovacao=true`). `silviahair` e `timefit`: zero.
- **`iaHabilitada` é por conversa, default FALSE**, com auditoria (`ia_habilitar`/`ia_desabilitar`).
  No designmoda está ligada em **zero** das 5 conversas; no alecrim, 1 de 1226.
- A persona da Recepção tem `negocio` = **"Salão de beleza"** — sem nome, sem serviços, sem preços,
  sem horários. E `regrasExtras` diz literalmente: *"Nunca prometa horário sem confirmar a agenda."*

Essa última linha é a regra certa. O caminho não é afrouxá-la no prompt: é dar à IA a capacidade real
de consultar a agenda.

## 88.6 — Riscos confirmados pelos céticos

1. **Criar agendamento dispara WhatsApp de confirmação** quando o padrão da conta está ligado — e na
   DesignModa está. A IA agendando vira a IA mandando mensagem, o que colide com a regra permanente
   do projeto.
2. **A blindagem protege o que a IA DIZ, não o que ela FAZ.** O escudo anti-manipulação é regex de
   entrada + filtro de saída, com ~2% de falha residual em 760 casos adversariais pela própria
   documentação deles (`SEGURANCA-ANTI-MANIPULACAO.md:9`-`:20`). Nenhum padrão cobre manipulação de
   PARÂMETRO ("marca em nome da Fulana", "a Vitória liberou 22h") — frases indistinguíveis de cliente
   real.
3. **O texto do cliente entra cru no prompt** como `user`, sem sanitização
   (`brain.service.ts:376`-`:390`). Enquanto a saída era texto, o dano era reputacional; com escrita
   na agenda, passa a influenciar uma gravação.
4. **Sem escopo no guard**, uma rota de agenda herda autorização total do segredo do tenant.

## 88.7 — O caminho proposto

Ordem obrigatória — o item 1 é pré-requisito de tudo:

1. **Consertar a assinatura** entre os dois lados (adotar `ts.nonce.rawBody` do lado da SalonPass,
   com janela de tempo e cache de nonce) e ampliar a captura de `rawBody`. Sem isso nada trafega.
2. **Rotas de agenda no conector**, com **escopo por rota** (o segredo deixa de ser passe livre):
   consultar serviços/profissionais/horários e criar agendamento — reaproveitando o motor do
   `public-booking`, não o endpoint do painel.

   O escopo mora em **`apps/api/src/modules/voltr/voltr-escopo.decorator.ts`** (novo):
   `EscopoVoltr('mensagem' | 'agenda')`, lido por `voltr-signature.guard.ts` via `Reflector`. A
   concessão vem do ambiente (`VOLTR_SCOPES=designmoda:mensagem|agenda`), fail-closed: tenant fora
   da lista não recebe escopo nenhum. Rota sem escopo declarado segue como hoje — é o caso do
   `/whatsapp/send` (`voltr.controller.ts:120`), que não pode quebrar.

   Motivo de existir: hoje o guard só prova QUEM está chamando, não O QUE pode fazer. Mandar
   mensagem e gravar na agenda de um profissional não podem ter o mesmo peso.
3. **Tool calling no cérebro**: `groq.client` passa a mandar `tools` e a ler `tool_calls`, com
   segunda chamada; as ferramentas são só as quatro acima. A IA nunca inventa horário — ela lê.
4. **Agendamento entra no fluxo de aprovação que já existe**, com `Notificacao` ganhando payload
   ESTRUTURADO da ação proposta. A IA propõe "Unhas, com a Vitória, terça 14h"; o atendente aprova;
   só então grava.
5. **Alimentar a persona** com o que ela precisa saber (serviços, duração, faixa de preço, horário de
   funcionamento) vindos da SalonPass, em vez de texto fixo.

### As duas decisões que são do dono

- **A IA grava sozinha ou propõe e alguém aprova?** Os dois agentes já estão com
  `exigirAprovacao=true`, e a regra do projeto sobre disparo automático empurra para *propor*. Sigo
  por aí salvo instrução contrária.
- **O agendamento feito pela IA dispara a confirmação automática ao cliente?** Se sim, é a IA
  mandando WhatsApp — precisa de autorização explícita do dono para essa classe de envio.
