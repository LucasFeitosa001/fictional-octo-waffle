# Achados da varredura dos 4 fluxos (09/08) — base para as correções

Gerado da varredura com 8 agentes (4 investigam, 4 derrubam falso positivo).
Cada item já passou por revisão adversarial. Os dois críticos foram
reconferidos à mão antes de entrar aqui.

---

## Criar um agendamento (painel web + mobile) — revisão adversarial

### [ALTO] (ambos) A marca "(ocupado)" — única trava que existe — é calculada com a duração ERRADA quando o agendamento tem mais de um serviço ou a duração é editada

**Onde:** apps/web/src/lib/queries.ts:178-195 · apps/web/src/components/NewAppointmentModal.tsx:281-285, :474-479, :1004-1007 · apps/api/src/modules/appointments/appointments.service.ts:1505-1512, :1553-1571 · apps/api/src/modules/appointments/appointments.controller.ts:100-107 e :213

**Caminho de dor:** A Laila atende a Joana das 14:30 às 15:30. A recepção marca a Maria: serviço "Escova" (30min) com a Laila, o chip das 14:00 aparece BRANCO (livre, sem etiqueta). Ela clica em "adicionar item" e acrescenta "Hidratação" (60min) — o chip continua branco, porque a lista de horários não é recalculada. Salva liso: o agendamento nasce 14:00→15:30 e engole a Joana. Mesmo efeito ao trocar o campo "Duração" de 30 para 90. A recepção viu "livre" e o sistema deixou marcar em cima.

**Por que:** `useAvailability(primary.serviceId, primary.professionalId, date)` (NewAppointmentModal.tsx:281) manda SÓ o serviço do primeiro item, e a queryKey (`['availability', serviceId, professionalId, date]`, queries.ts:185) não inclui a duração nem os itens extras — adicionar item ou mexer na Duração não refaz a busca. No backend, `durationMin` sai do(s) serviço(s) recebidos (appointments.service.ts:1508) e o teste `ocupado` usa `slotEnd = slotStart + durationMin` (:1553-1560). Já o agendamento gravado usa `end` que o front manda: `dur = soma das durationMin de TODOS os itens` (NewAppointmentModal.tsx:474-479). As duas janelas são diferentes. E como o controller passa `allowOverlap: true` incondicionalmente (:213), `assertNoOverlap` (:834) nunca roda para corrigir — só `assertWithinSchedule` (:793/:1661), que olha expediente, não ocupação. Ou seja: o produto decidiu (e documentou) que a trava é VISUAL; o cálculo dessa trava visual está errado.

**Revisor:** Isto é o que sobrou do achado 1 do relatório original, que estava exagerado (ver derrubados). Achado extra da mesma linha, gravidade baixa: o front NÃO envia `durationMin` por item (itemsPayload em :478-482 leva só serviceId/professionalId) e o backend grava `durationMin = svc.durationMin` (appointments.service.ts:803). Resultado: a Duração escolhida na tela muda o `end` do agendamento mas não a duração registrada no item — a soma dos itens fica divergente do bloco na grade.

### [ALTO] (ambos) Repetição ("Além deste, repetir mais") cria as ocorrências às cegas — sem consulta de disponibilidade e sem dizer qual data quebrou

**Onde:** apps/web/src/components/NewAppointmentModal.tsx:281-285 e :503-508 · apps/api/src/modules/appointments/appointments.service.ts:942-952 e :974-986 · appointments.controller.ts:224

**Caminho de dor:** (a) A dona marca a cliente fixa "Semanal, 11 vezes". Ela só viu a grade do primeiro dia. As outras 11 datas ninguém olhou — e não há como olhar, a tela não busca disponibilidade delas. As 12 são criadas em silêncio, inclusive por cima de quem já estava marcado. (b) Variante mais frequente: uma das datas cai num dia em que a profissional não trabalha (recorrência mensal escorregando de sábado para domingo). Aí a série INTEIRA é recusada com "Profissional não atende neste dia da semana", sem dizer qual das 12 datas é a culpada, e nada é criado — a dona refaz do zero sem saber o que mudar.

**Por que:** O front só consulta `useAvailability` para `date` (a data do PRIMEIRO agendamento, :281-285); `additionalStarts` são calculados localmente (:503-508) e enviados direto. No backend, `createSeries` roda `assertWithinSchedule` por ocorrência ANTES da transação (:942-952) — daí o all-or-nothing com mensagem genérica — e o `assertNoOverlap` por ocorrência (:976) é pulado, porque o controller passa `allowOverlap: true` (:224). A justificativa documentada do allowOverlap ("a grade mostra os ocupados, então escolher é decisão consciente da recepção", controller :211-212) NÃO se aplica aqui: nas datas repetidas a recepção não vê grade nenhuma.

**Revisor:** Mantive alto justamente porque a decisão deliberada de liberar overlap foi tomada para o caso em que a pessoa VÊ o horário ocupado. Nas repetições ela não vê — a premissa da decisão não existe.

### [ALTO] (ambos) Recorrência mensal transborda o mês: 31/01 vira 03/03, e o intervalo entre as ocorrências fica irregular

**Onde:** apps/web/src/components/NewAppointmentModal.tsx:101-107 (linha :105) e :503-508

**Caminho de dor:** A cliente faz manutenção todo dia 31. A dona escolhe "Mensal · repetir mais 3" a partir de 31/01/2026. Espera 28/02, 31/03, 30/04. O sistema grava 03/03, 31/03 e 01/05 — datas que ninguém combinou. Se o padrão de confirmação da conta estiver ligado, a mensagem sai com essas datas.

**Por que:** `nextDate` faz `d.setMonth(d.getMonth() + times)` (:105), que transborda quando o mês destino não tem aquele dia (31 de fevereiro → 3 de março). Reproduzido em node com TZ=America/Sao_Paulo a partir de 31/01/2026 13:00: +1 → Tue Mar 03 2026, +2 → Tue Mar 31 2026, +3 → Fri May 01 2026. Como cada ocorrência é recalculada da base com `+times` (`nextDate(new Date(slot.start), freq, index + 1)`, :506), o erro não acumula mas o espaçamento entre as datas fica irregular.

**Revisor:** Confirmado por execução, não por leitura. Semanal e quinzenal (`setDate(+7*times)` / `+14*times`) estão corretos. Interage com o achado da série: uma data transbordada pode cair em dia sem expediente e derrubar a série inteira.

### [ALTO] (ambos) `isoDate` calcula o dia em UTC — depois das 21h o "hoje" do painel inteiro vira amanhã

**Onde:** apps/web/src/lib/format.ts:40-42 · apps/web/src/components/NewAppointmentModal.tsx:211 e :318 · apps/web/src/layout/CreateDrawer.tsx:137-142 · apps/web/src/pages/AgendaPage.tsx:254-257, :1327 e :2240

**Caminho de dor:** São 21:30. A cliente está saindo e pede para marcar "hoje mesmo, mais tarde", ou a recepção lança um atendimento retroativo do dia. Abre "Novo +" → o campo Data já veio preenchido com o dia SEGUINTE e os horários listados são os de amanhã. Como a pessoa não escolheu a data, ela não confere. O agendamento nasce um dia inteiro fora.

**Por que:** `isoDate(d)` faz `d.toISOString().slice(0,10)`, que é o dia em UTC. Em America/Sao_Paulo (UTC−3), das 21:00 em diante o instante local já é o dia seguinte em UTC. Verificado: `new Date('2026-08-09T21:30-03:00').toISOString().slice(0,10)` → `2026-08-10`; às 20:30 → `2026-08-09`. Atinge o botão global "Novo +" (CreateDrawer.tsx:137-142, que não passa `initialDate`), o botão "Novo" da agenda (`openNew()` sem argumento, AgendaPage.tsx:254 e :1327) e o reset ao reabrir o modal (:318). O clique num dia da grade (`openNew(isoDate(day))`) não sofre, porque `day` é meia-noite local (03:00Z, mesmo dia).

**Revisor:** Elevei/mantive em alto por um motivo que o relatório original não viu: a raiz está em `lib/format.ts` e `isoDate(new Date())` aparece em 65 lugares do painel — o "hoje" padrão do fechamento de caixa (CaixasAbertosPage.tsx:486), das comandas (ComandasPage.tsx:1261), das compras (ComprasPage.tsx:778), do pagamento de comissão (PagarComissaoDrawer.tsx:89 e :533) e o destaque de "hoje" na grade (AgendaPage.tsx:2240) escorregam junto. Isso é maior que a área de agendamento; o estudo 74 (fechar caixa de manhã) trata de um problema vizinho mas diferente (carimbo de meio-dia), não deste.

### [ALTO] (ambos) "+ Novo cliente": cada tentativa de salvar que falha deixa mais uma cliente duplicada no cadastro

**Onde:** apps/web/src/components/NewAppointmentModal.tsx:462-470, :509 e :538-555 · apps/api/src/modules/customers/customers.service.ts:105-140 · packages/db/prisma/schema.prisma:532-611

**Caminho de dor:** A recepção usa "+ Novo cliente", digita "Maria Silva" + telefone, escolhe um horário e adiciona um segundo serviço que estica o atendimento além do expediente. Salvar → erro vermelho "Horário fora do expediente do profissional". Ela corrige e clica Salvar de novo. Agora existem DUAS "Maria Silva" no cadastro. Três tentativas, três Marias — e o histórico/cashback da cliente fica repartido entre elas.

**Por que:** Em `submit()` o cliente é criado ANTES do agendamento (`createCustomer.mutateAsync`, :465) e o id volta só para a variável local `resolvedCustomerId` (:463/:469) — nenhum estado é atualizado (`customerId` continua vazio, `creatingNew` continua true, `newName` continua preenchido). Quando `createAppointmentSeries` (:509) lança, o catch (:538-555) só escreve `formError`; o Customer já foi commitado. Na retentativa o mesmo caminho roda de novo. O backend não deduplica: `customer.create` direto (customers.service.ts:105-140) e o schema não tem unique em nome nem telefone (só `@@unique([companyId, userId])` e `[companyId, legacyId]`). Os 400 que disparam isso são reais e frequentes: `assertWithinSchedule` (appointments.service.ts:1661-1688) recusa quando a soma das durações passa do fim do expediente — exatamente o caso do achado 1, em que a tela mostrou o horário como livre.

**Revisor:** Confirmado ponta a ponta. Note que o próprio achado 1 é o gerador de erro mais provável, então os dois se alimentam.

### [MEDIO] (ambos) "Nenhum horário disponível nesta data." engole o motivo que o backend já manda pronto — e os seletores oferecem a combinação impossível

**Onde:** apps/web/src/components/NewAppointmentModal.tsx:966-969, :919-928 e :944-953 · apps/web/src/lib/types.ts:387-393 · apps/api/src/modules/appointments/appointments.service.ts:1493-1501, :1514-1520, :1531

**Caminho de dor:** A dona escolhe o serviço "Escova" e a profissional Vitória. O campo Horário responde "Nenhum horário disponível nesta data.". Ela troca a data cinco vezes, sempre a mesma frase. A verdade é outra: a Vitória não está vinculada ao serviço Escova (ou não tem expediente nesse dia da semana). Nenhuma data vai funcionar e a tela nunca diz isso.

**Por que:** O backend devolve `motivo`/`motivoTexto` justamente para não repetir o "objeto mudo" (`vazio()`, appointments.service.ts:1493-1501, estudo 99): `profissional_nao_vinculado` (:1520), `sem_expediente` (:1531), `servico_desconhecido` (:1514), `sem_profissional`. O dado chega no navegador — só não é lido: `AvailabilityResponse` (types.ts:387-393) não declara os campos e o modal imprime uma frase fixa nos quatro casos (:966-969). Agrava: o `<Select>` de Profissional lista todos os profissionais ativos sem filtrar por quem executa o serviço escolhido (:944-953) e o de Serviço não filtra pelo profissional (:919-928).

**Revisor:** Rebaixei de alto para médio: é tempo perdido e diagnóstico impossível, mas não há dinheiro errado, perda de dado, vazamento entre empresas nem mensagem indevida. O estudo 99 documenta a metade backend como resolvida e diz explicitamente que a ponta consumidora "já recebe o motivo novo, só não lê" — o painel nunca foi ligado.

### [MEDIO] (ambos) Formulário do agendamento é apagado sozinho quando aberto pelo perfil do cliente (dependência instável no efeito de reset)

**Onde:** apps/web/src/pages/ClientePerfilTabs.tsx:2848-2850 e :2884 · apps/web/src/components/NewAppointmentModal.tsx:314-360 (array de dependências em :360)

**Caminho de dor:** A dona abre a ficha da cliente → "Agendar", monta o agendamento (3 serviços, horário escolhido, observação digitada). Basta o perfil por trás re-renderizar uma vez — o painel do cliente terminando de carregar, a rede caindo e voltando (refetchOnReconnect: 'always'), qualquer diálogo de confirmação abrindo (o ConfirmProvider fica acima de tudo, DashboardLayout.tsx:41) — e tudo volta em branco: serviços zerados, horário perdido, observação apagada, status de volta em "Confirmado". Ela acha que "a tela bugou".

**Por que:** `initialCustomer` é um objeto literal recriado a cada render de `ClientePerfilModal` (`customer ? { id, name, phone } : null`, ClientePerfilTabs.tsx:2848) e é passado como prop (:2884). O efeito de reset do modal tem `initialCustomer` no array de dependências (NewAppointmentModal.tsx:360) e, como React compara por identidade, ele volta a rodar em todo render do pai — limpando ~20 estados dentro do `if (isOpen)`. Não há `useMemo` nem comparação por id.

**Revisor:** O mecanismo está confirmado, mas o GATILHO que o relatório original descreveu está errado e eu o derrubo: "sai do navegador e volta" NÃO dispara nada — `refetchOnWindowFocus: false` é o padrão global (main.tsx:99), e a única exceção é a query do sino (lib/queries/notificacoes.ts:118-122), que vive em NotificationBell, componente irmão, sem re-renderizar o perfil. Os toasts também não contam: `AvisosGlobais` é irmão de `<App/>` (main.tsx:117). Rebaixei para médio por isso — é perda de trabalho digitado (não de dado salvo) e depende de um re-render do pai, não acontece sozinho com a tela parada. O mesmo padrão NÃO afeta a Agenda: lá `initialDate` é uma string estável (AgendaPage.tsx:223/254).

### Derrubados na revisão (NÃO mexer)

- **Painel não tem NENHUMA trava de horário ocupado — nem na tela, nem no backend** — Duas metades da afirmação são falsas. (a) NA TELA existe sinal: o painel sempre recebe a grade com os ocupados — o controller passa `{ includePast: true, includeBusy: true }` fixo (appointments.controller.ts:100-107), o slot volta com `busy: true` (appointments.service.ts:1562-1571) e o chip é renderizado em cor de alerta (`border-warning/60 bg-warning/10`), com `title="Horário já ocupado — será um encaixe"` e a etiqueta "(ocupado)" (NewAppointmentModal.tsx:990-1008). (b) NO BACKEND a liberação é decisão deliberada e documentada, não esquecimento: os comentários em appointments.controller.ts:210-213, :247-250 e appointments.service.ts:735-745 e :830-833 explicam que é o encaixe pedido pelo salão (mesma profissional, duas clientes, uma com a tinta agindo) e que o agendamento online continua com `assertNoOverlap` de pé. O que sobra de verdadeiro está no achado confirmado nº 1 — a trava visual existe, mas é calculada com a duração errada — e no nº 2, onde a premissa da decisão (a pessoa VÊ a grade) não existe.
- **`squeezeIn` do DTO virou campo morto porque o modal não envia** — É verdade que o modal não envia, mas não é defeito: o toggle "Encaixar agendamento" foi retirado do painel de propósito quando o overlap passou a ser sempre liberado (não há mais nenhuma ocorrência de "Encaixar"/`squeezeIn` em apps/web/src fora de um comentário em types.ts:382 e do exemplo em InlineToggle.tsx:5). O campo continua útil para quem chama a API direto e para o fluxo de reagendar (dto.ts:119-125). Sem caminho de dor para o usuário.
- **O tratamento de 409 no modal é código morto ("Esse horário acabou de ficar indisponível")** — Fato verdadeiro (com `allowOverlap: true` fixo, `assertNoOverlap` nunca roda e esse 409 não sai), mas é um branch defensivo de 5 linhas (NewAppointmentModal.tsx:540-545) que não produz nenhum comportamento errado nem nenhuma dor para quem usa. Gravidade real: irrelevante — não merece linha no relatório do dono.
- **O formulário é apagado quando a dona 'sai do navegador para conferir algo no WhatsApp e volta'** — O gatilho descrito não existe. `refetchOnWindowFocus: false` é o padrão global do QueryClient (apps/web/src/main.tsx:99, com comentário explicando a escolha) e a única query que o sobrescreve é a do sino (lib/queries/notificacoes.ts:118-122), montada em `NotificationBell`, componente irmão que não re-renderiza `ClientePerfilModal`. Voltar para a aba não refaz nada. O DEFEITO subjacente (dependência instável no efeito de reset) é real e foi mantido como achado confirmado, mas com gatilhos verificáveis e gravidade rebaixada para médio.

---

## Faturar o agendamento (agendamento → comanda → pagamento → fechar), web + mobile

### [CRITICO] (ambos) Comissão é calculada sobre o valor cheio: o desconto DA COMANDA não chega nela

**Onde:** apps/api/src/modules/orders/orders.service.ts:1314 e :1377; apps/api/src/modules/orders/orders.service.ts:2028-2037 (recalculate); apps/web/src/components/ComandaDrawer.tsx:517-523 → :637/:650 → apps/web/src/lib/queries.ts:493 (POST /orders/:id/discounts)

**Caminho de dor:** Serviço de R$ 200, profissional com 40%. No drawer da comanda o operador clica "Adicionar desconto" e põe 50% → a tela mostra Líquido R$ 100 e a cliente paga R$ 100. Ao faturar, nasce CommissionEntry de R$ 80 (40% de 200). O salão recebeu 100 e deve 80. Nada na tela de Comissões indica que a base é maior do que a venda.

**Por que:** 

**Revisor:** CONFIRMADO linha a linha. `generateCommissionEntries` monta `baseAmount = item.grossValue − item.discount` (:1314) — só o desconto DO ITEM (aba Dados do ItemEditDrawer). O desconto da comanda vive em OrderDiscount e só entra no `recalculate()` (:2029-2034), que escreve grossTotal/discountTotal/netTotal do cabeçalho e NUNCA volta para os itens. Rastreei o botão: ComandaDrawer:517 → AddDiscountInline:637 → useAddOrderDiscount → POST /orders/:id/discounts → addDiscount():798 → orderDiscount.create + recalculate. Ou seja, o caminho de desconto do PDV é exatamente o que não reduz comissão, e o caminho pouco usado (desconto no item) reduz. Não achei comentário nem estudo documentando isso como decisão (grep "desconto" nos estudos 38/40/41 = zero). Ressalva honesta para o dono: o conserto exige decisão dele — ratear o desconto da comanda proporcionalmente entre os itens (comissão cai) OU declarar que desconto de caixa sai do salão (comissão fica cheia). Hoje o sistema faz a segunda coisa sem dizer, e ainda se contradiz com o desconto de item. Mantida como crítico: é dinheiro pago a mais, todo mês, sem rastro.

### [ALTO] (ambos) Taxa de cartão de 3,5% inventada pelo sistema: receita entra líquida, caixa entra bruto e a taxa não vira despesa em lugar nenhum

**Onde:** apps/api/src/modules/orders/orders.service.ts:1169-1176 e :1178-1200 (Transaction com líquido, status pending, dueDate futuro) vs :1246-1257 (CashMovement com p.amount bruto); apps/api/src/auth/provision-financeiro.ts:45-62 (padrões 3,5%/30d e 1,5%/1d criados em TODA empresa nova, via better-auth.ts:326)

**Caminho de dor:** Salão novo é provisionado com "Cartão de Crédito 3,5% / 30 dias" e "Cartão de Débito 1,5% / 1 dia" — números que ninguém dele escolheu. Vende R$ 100 no crédito e fatura a comanda: o Financeiro grava R$ 96,50 como A RECEBER daqui a 30 dias; o Caixa grava R$ 100,00 agora. Os R$ 3,50 simplesmente somem: não há Transaction de despesa, não há linha de taxa, e a receita do mês fica 3,5% abaixo da venda real sem nada explicando. Quem confere Financeiro contra Caixa nunca fecha o mesmo número.

**Por que:** 

**Revisor:** CONFIRMADO no código, com a moldura do achado original CORRIGIDA em dois pontos. (1) A parte forte não é "caixa cobra o bruto do operador" — o caixa desta empresa é conferência de recebimentos POR FORMA e já inclui pix/crédito por desenho declarado (comentário em orders.service.ts:1205-1213); expectedBalance = saldoEmCaixa (cash-registers.module.ts:344) já divergia do dinheiro físico antes da taxa existir, então a divergência do fechamento não é causada pela taxa. (2) A parte que sobra, e é séria: `grep -rn feePercent apps/api/src` mostra que o único leitor é generateIncomeTransactions — a taxa é subtraída da receita e NÃO existe contrapartida de despesa. A venda bruta deixa de existir na contabilidade. Somado ao fato de o percentual ser um default do provisionamento (não o contrato do salão), todo salão que passa cartão hoje tem receita subnotificada. Suspeita não provada: não encontrei nenhum job que passe essas Transactions de `pending` para `paid` na data de liquidação — se não existir, toda venda no cartão fica "a receber" para sempre; faltou rodar o worker para provar.

### [ALTO] (mobile) No celular, "Finalizar comanda" (e a mensagem de erro) ficam EMBAIXO da barra de navegação

**Onde:** apps/web/src/pages/ComandaDetalhePage.tsx:231 (barra fixa) e :233-262 (erro + botões dentro dela); apps/web/src/layout/BottomNav.tsx:122 (nav) e :168/:240 (min-h-16); apps/web/src/index.css:885 (.fab-above-nav, a convenção que existe e esta tela ignora)

**Caminho de dor:** O dono cria "agendamento + comanda" pelo "+" do celular ou pela Agenda e cai em /comandas/:id. Rola até o fim e toca em "Finalizar comanda" — o toque abre Menu / Agenda / Criar. Tenta de novo, mesma coisa. E a mensagem que explicaria o bloqueio ("Registre o pagamento completo antes de faturar. Restante: R$ 120,00") é renderizada dentro da mesma barra coberta. A comanda não fecha por esse caminho e a tela não diz por quê.

**Por que:** 

**Revisor:** CONFIRMADO com as classes na mão. Barra da página: `fixed inset-x-0 bottom-0 z-20 … sm:left-auto sm:right-6`. Nav: `fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg lg:hidden`, botões `min-h-16` (64px) → ocupa ~8px a ~72px do rodapé, opaca (.club-bottomnav pinta var(--sp-sidebar)). Os botões da página vivem entre ~12px e ~52px: totalmente cobertos, e z-40 > z-20 (conferi DashboardLayout.tsx:82-100 — nenhum ancestral com transform/filter, os dois `fixed` são do viewport, então os z-index se comparam mesmo). ComandaDetalhePage não registra `usePageActions` (grep = zero), então a nav mostra o fallback Menu/Agenda/Criar/Clientes por cima. Rota confirmada em App.tsx:453 e o destino confirmado em NewAppointmentModal.tsx:626-628 e :735-739 (nav(`/comandas/${id}`) quando o pai não passa onCreatedOrder — AgendaPage.tsx:1582 e CreateDrawer.tsx:137 não passam). CORREÇÃO ao achado original: o `sm:` NÃO resolve a partir de 640px. Em 768px a nav fica centrada em ~128-640px e a barra da página, com left:auto/right:24px, encosta em 744px — as duas ainda se cruzam, e a nav só some em lg (1024px). Ou seja, quebra em celular E em tablet. GRAVIDADE REBAIXADA de crítico para alto: trava o fluxo no aparelho que o dono usa, mas não erra dinheiro nem perde dado, e existe caminho alternativo (Agenda → Acessar comanda → ComandaDrawer). Observação de brinde, não verificada em runtime: o próprio .fab-above-nav zera o offset em `min-width:768px` (index.css:890-894) enquanto a nav só some em `lg` — quem seguir a convenção herda o mesmo buraco de 768-1023px.

### [ALTO] (ambos) O botão verde "Criar comanda" leva a uma tela de comanda pobre — sem crédito/cashback, sem atalhos de forma, sem dividir, sem troco

**Onde:** apps/web/src/pages/ComandaDetalhePage.tsx:731-900 (PaymentsSection/AddPaymentForm) vs apps/web/src/components/ComandaDrawer.tsx:510-546 (Desconto/Crédito/Cashback) e :862-1191 (atalhos, split, troco); apps/web/src/components/NewAppointmentModal.tsx:624-629 e :732-739; apps/web/src/pages/AgendaPage.tsx:1582-1587 e :1587 (ComandaDrawer)

**Caminho de dor:** Agenda (ou "+" do celular) → Novo agendamento → botão verde "Criar comanda" → cai em /comandas/:id. Lá não existe saldo de crédito/cashback da cliente, nem atalho Dinheiro/Cartão/Outros, nem dividir em duas formas, nem troco, nem valor pré-preenchido com o restante: o campo nasce vazio (useState('')) dentro de um formulário que só abre depois de clicar "Adicionar pagamento". Clicando direto em "Finalizar comanda" toma 400 "Registre o pagamento completo antes de faturar". No MESMO agendamento, o botão "Acessar comanda" da Agenda abre a MESMA comanda no drawer completo, com tudo isso. A cliente com R$ 80 de crédito não consegue usar por um caminho e consegue pelo outro.

**Por que:** 

**Revisor:** CONFIRMADO. Duas implementações vivas para a mesma comanda. Li as duas: ComandaDetalhePage:816-900 tem só Select de forma + valor + descrição; ComandaDrawer tem LedgerLine de Crédito/Cashback (:528-546), quickMethod com resolução de forma (:901-911), splitMode (:1056) e Troco (:1184). O 400 vem de orders.service.ts:971-973, mensagem conferida. A navegação para a tela pobre é o DEFAULT: NewAppointmentModal só delega quando recebe `onCreatedOrder`, e nenhum dos três chamadores (AgendaPage:1582, CreateDrawer:137, ClientePerfilTabs:2881) passa. Consequência prática que reforça: no celular esta é a tela em que o botão de faturar está coberto (achado acima) — os dois se somam no mesmo caminho.

### [MEDIO] (ambos) Vender produto derruba o estoque para negativo em silêncio; gastar o mesmo produto no serviço é bloqueado

**Onde:** apps/api/src/modules/orders/orders.service.ts:1731-1734 (decrement sem checagem) e :404-425 (addItem não olha estoque) vs :588-592 (addConsumedProduct recusa: "Estoque insuficiente para este consumo"); apps/web/src/components/ItemPickerDrawer.tsx (não exibe estoque em lugar nenhum)

**Caminho de dor:** Sobrou 1 shampoo. A cliente leva 3 — o seletor de itens não mostra quantidade nenhuma. Adiciona, paga, fatura: tudo passa e Product.stock vira −2, sem aviso em momento algum. No mesmo sistema, se a profissional lançar esse shampoo como "produto consumido" no serviço, leva erro na cara.

**Por que:** 

**Revisor:** CONFIRMADO nos três pontos. `decrementSoldStock` faz `stock: { decrement: qty }` direto (:1731-1734), sem ler saldo; `addItem` (:404) também não valida — então não há trava mais acima. `addConsumedProduct` calcula nextStock e lança BadRequest (:589-592). Nenhuma constraint no banco: schema.prisma:1033 é `stock Decimal @default(0)`, sem CHECK. `grep -n stock` no ItemPickerDrawer = zero. Não há comentário nem estudo declarando "venda pode furar estoque" (procurei em .claude/studies). Gravidade medio mantida: não erra dinheiro na hora, mas o relatório de estoque e a reposição passam a mentir e a incoerência entre os dois caminhos é o que confunde a operação.

### [MEDIO] (ambos) Comissão JÁ PAGA sobrevive ao cancelamento/reabertura da comanda, sem aviso

**Onde:** apps/api/src/modules/orders/orders.service.ts:1804-1807 (updateMany com where status:'open') dentro de reverseFinishReconciliation; chamado por reopen (:1940) e remove (:1988)

**Caminho de dor:** Comanda faturada dia 01. Dia 05 o salão paga as comissões do período e a entry vira `paid`. Dia 07 a venda é cancelada: receita estornada, caixa estornado, estoque devolvido, cashback retirado — e a comissão paga continua lá, contada como devida e quitada sobre uma venda que não existe mais. Nada na tela avisa quem cancelou que já saiu dinheiro para a profissional.

**Por que:** 

**Revisor:** CONFIRMADO. O estorno é explicitamente escopado em `status: 'open'` (:1804-1806) e o docblock em :1748 diz "CommissionEntry `open` da comanda → `reversed`" — ou seja, o autor sabia do recorte, mas nenhum comentário justifica o que fazer com as `paid`, e não há aviso nem bloqueio: a única guarda perto disso é `assertClosedCashAllowsOrderEdit` (:1902), que só olha caixa fechado e só quando `finance.settings.allowEditAfterCashClose === false` (o padrão deixa passar). Defensável não reverter automaticamente (o dinheiro já saiu do bolso do salão), mas o silêncio é o defeito: quem cancela não fica sabendo, e a comissão paga não vira vale/desconto no próximo pagamento. Medio mantido.

### Derrubados na revisão (NÃO mexer)

- **"O sm:left-auto sm:right-6 do ComandaDetalhePage tira o problema a partir de 640px"** — Falso, e subestima o alcance. A BottomNav é `lg:hidden` (1024px), não `sm:hidden`. Em 768px a nav fica centrada em ~128-640px (inset-x-3 + mx-auto max-w-lg) e a barra da página, com left:auto e right:24px, termina em 744px — as duas continuam se cruzando na faixa de ~444-640px, e no mesmo intervalo vertical (nav 8-72px, botões 12-52px). A sobreposição vai de 0 a 1023px de largura: celular E tablet. Corrigi isso dentro do achado, que sobreviveu.
- **"O fechamento do caixa cobra os R$ 100 do operador e a diferença entre Caixa e Financeiro é sempre a taxa"** — A premissa está errada. O caixa deste produto é, por desenho declarado, conferência de recebimentos POR FORMA — o comentário em orders.service.ts:1205-1213 diz isso com todas as letras ("nenhuma forma pode fazer a comanda sumir do caixa aberto"). O `expectedBalance = saldoEmCaixa` (cash-registers.module.ts:344) já somava pix e cartão INTEIROS antes de a taxa existir, então a divergência do fechamento é o valor cheio do cartão, não os 3,5%. Manter essa frase mandaria o dono caçar a taxa num lugar onde ela não é a causa. O que sobrou do achado — taxa subtraída da receita sem contrapartida de despesa, e percentual que é default do provisionamento e não contrato do salão — foi reescrito e mantido como alto.
- **"A comissão de 40% sobre R$ 200 é simplesmente um bug de cálculo" (enquadramento do achado 2)** — O cálculo não é acidental: existe um caminho de desconto que É respeitado (item.discount, :1314) e outro que não é (OrderDiscount). Não derruba o achado — a divergência entre os dois é real e não está documentada em lugar nenhum —, mas o conserto não é "corrigir a fórmula": é o dono decidir a política (ratear o desconto da comanda entre os itens vs. desconto sai do salão) e a tela passar a dizer qual das duas está valendo. Registrei isso na nota do achado para ele não receber um patch que muda a regra de comissão do salão sem escolher.

---

## Comanda — abrir, adicionar/remover itens, editar, imprimir, cancelar (lista + drawer + página de detalhe + backend orders)

### [CRITICO] (ambos) Desconto do ITEM não tem teto: zera a comanda inteira e deixa faturar R$ 0,00 sem pagamento e sem caixa aberto

**Onde:** apps/web/src/components/ItemEditDrawer.tsx:135-139 e :154; apps/api/src/modules/orders/dto.ts:45 e :56; apps/api/src/modules/orders/orders.service.ts:502, :2025, :961, :999

**Caminho de dor:** Comanda com Escova R$ 100 e Shampoo R$ 50. A recepção abre o item Escova, tipo 'Desconto em R$', digita 200 (queria 20). O drawer mostra Total R$ 0,00 e o Salvar passa. Depois de salvo a comanda inteira mostra bruto NEGATIVO e líquido R$ 0,00 — o shampoo de R$ 50 sumiu do total. Como o líquido é 0, o 'Faturar' passa sem nenhum pagamento e sem caixa aberto: entra uma venda de R$ 0,00 no Financeiro e o estoque do shampoo é baixado assim mesmo (InventoryMovement out é criado no finish, orders.service.ts:1678).

**Por que:** 

**Revisor:** VERIFIQUEI LINHA A LINHA E CONFERE. Front: `effectiveDiscount = Math.max(0, parseNum(discount))` (ItemEditDrawer.tsx:138) só clampa em 0 por baixo, nunca pelo bruto; `total = Math.max(0, gross - effectiveDiscount)` (:139) clampa só a EXIBIÇÃO e o envio é o valor cru (:154). Backend: `UpdateOrderItemDto.discount` é `@IsOptional() @IsNumber() @Min(0)` sem máximo (dto.ts:56) — e `AddItemDto.discount` tem o MESMO buraco (dto.ts:45), então o POST de item também aceita. `updateItem` grava sem validar (orders.service.ts:502). `recalculate` soma `acc.add(it.grossValue).sub(it.discount)` SEM clamp por item (:2025) — só `base` e `net` são clampados em 0, então o item negativo canibaliza os outros. `finish`: `if (!paidTotal.equals(netTotal))` com 0==0 passa (:961) e o guard de caixa é `if (netTotal.greaterThan(0) && !openCash)` (:999), que não dispara. O contraste que sela o caso: `addDiscount` (desconto DA COMANDA) tem o teto explícito em :802-815 com o comentário 'Sem isso, 500% zerava a comanda... e dava para faturar R$ 0 sem pagamento nenhum' — é o item L do estudo 05, aplicado só ao desconto da comanda e nunca ao desconto do item. Não há constraint no Prisma. Único achado que merece 'crítico'.

### [ALTO] (mobile) Ação em lote no rodapé de /comandas/:id fica ATRÁS da BottomNav no celular — 'Finalizar comanda' não recebe o toque

**Onde:** apps/web/src/pages/ComandaDetalhePage.tsx:231; apps/web/src/layout/BottomNav.tsx:122; apps/web/src/index.css:874-887

**Caminho de dor:** Pelo celular, o dono chega em /comandas/:id (histórico da ficha do cliente, ClientePerfilTabs.tsx:1601/:2861/:2888, ou 'Acessar comanda' do NewAppointmentModal.tsx:628/:732), rola até o fim e tenta tocar em 'Finalizar comanda' / 'Reabrir comanda' / 'Voltar'. Os botões aparecem por baixo do vidro da navbar flutuante e o toque vai para a navbar.

**Por que:** 

**Revisor:** CONFIRMADO com medida. Rodapé: `fixed inset-x-0 bottom-0 z-20 ... p-3` (ComandaDetalhePage.tsx:231) → ocupa ~0..64px do fundo. BottomNav: `fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 ... lg:hidden` (BottomNav.tsx:122); a própria folha de estilo do projeto documenta a altura da nav como 4.5rem (index.css:879) → ela ocupa ~8..80px do fundo. Sobreposição total, e z-40 > z-20 captura o clique. O projeto TEM a solução canônica para isso — a classe `.fab-above-nav` (index.css:886) com `bottom: calc(max(0.5rem, safe-area) + 4.5rem + 0.75rem)` — e esta página não a usa. A rota está dentro do DashboardLayout (App.tsx:453), então a BottomNav existe mesmo. O `sm:left-auto sm:right-6` do rodapé só reposiciona a partir de 640px; abaixo disso não muda nada, e a nav só some em `lg:`.

### [ALTO] (ambos) Seleção em lote não é limpa ao trocar filtro ou página — 'Excluir selecionadas' cancela comandas que sumiram da tela

**Onde:** apps/web/src/pages/ComandasPage.tsx:518-520, :528-529, :546-563, :766-778, :840; apps/web/src/hooks/useSelectMode.ts:28-50

**Caminho de dor:** O dono entra no modo de seleção, marca 20 comandas de julho, troca o filtro de período para agosto. A lista inteira troca, o botão continua dizendo 'Ações (20)'. Ele abre Ações → 'Excluir selecionadas', o diálogo só diz 'Excluir 20 comanda(s) selecionada(s)?' (não lista quais), ele confirma, e o sistema cancela as 20 de JULHO. Mesma coisa entre páginas: 'Selecionar todos' na página 1, ir para a 2, 'Selecionar todos' de novo → 40, 20 invisíveis.

**Por que:** 

**Revisor:** CONFIRMADO, e a marcação 'ambos' está certa (eu duvidei porque o useSelectMode se descreve como infra 'das listas mobile'): o desktop tem o mesmo botão 'Ações (N)' em ComandasPage.tsx:766-778 com `hidden md:inline-flex` e os checkboxes da tabela em :840/:892. O useEffect de filtro só faz `setPage(1)` (:519), nunca `sel.cancel()`. `useSelectMode(ids)` recebe `ids = pageRows` (:528-529) mas o Set é acumulativo (useSelectMode.ts:28-35) e `handleRemoveSelected` itera `[...sel.selected]` inteiro (:547). Efeito colateral que o achado original não citou: `allSelected` também é calculado só sobre os ids visíveis (useSelectMode.ts:39-42), então o checkbox do cabeçalho aparece DESMARCADO enquanto 20 invisíveis seguem marcados. Irreversibilidade confirmada: `remove()` grava `status: 'canceled'` (orders.service.ts:2013) e `reopen()` recusa tudo que não seja 'finished' (:1935). Mantive 'alto' e não subi para crítico porque exige uma sequência deliberada e o diálogo mostra a contagem correta — não é silencioso, é armadilha.

### [MEDIO] (ambos) Recibo impresso (A4 e térmica) não diz o status: comanda CANCELADA sai com itens, total e pagamentos 'Pago', igual a uma venda válida

**Onde:** apps/web/src/components/ComandaImpressao.tsx:99-104 e :139-170 e :184-201; apps/web/src/pages/ComandasPage.tsx:939-940 e :1102-1119 vs :943 e :1124

**Caminho de dor:** A comanda #312 (já faturada) é cancelada. Alguém abre o '⋮' da linha, ou o bottom-sheet no celular, e imprime — para conferência ou por engano. Sai papel com cabeçalho do salão, itens, 'Total R$ 320,00', a seção Pagamentos listando as formas como pagas e duas linhas de assinatura, sem uma palavra dizendo que a comanda foi cancelada.

**Por que:** 

**Revisor:** CONFIRMADO no essencial e PIOR do que o relatado no caso cancelado, mas EXAGERADO no caso 'em aberto' — por isso baixei de alto para médio e reescrevi. O componente realmente nunca lê `d.status`: `sp-print__meta` traz só Data/Cliente/Profissional (:100-104) e não há tarja/rótulo em nenhum ponto do arquivo. Nos dois menus só 'Excluir' é gated por status (ComandasPage.tsx:943 e :1124); Imprimir/Térmica são liberados para qualquer status. O agravante que o achado não viu: `remove()` chama `reverseFinishReconciliation` (orders.service.ts:1988), que estorna Transaction/comissão/estoque mas NÃO toca em `OrderPayment.status` — então o recibo de uma comanda cancelada continua imprimindo os pagamentos como pagos. Já a metade 'comanda aberta parece comprovante' eu derrubo: o recibo imprime 'Falta pagar R$ X' em negrito (ComandaImpressao.tsx:163-169) e cada pagamento pendente ganha o sufixo '(em aberto)' (:156). Não é 'rodapé discreto'. Gravidade médio: é documento desonesto entregue ao cliente, mas não move dinheiro nem perde dado.

### [MEDIO] (ambos) Item sem profissional é faturado sem gerar comissão nenhuma, sem entrar no aviso que já existe para os outros casos

**Onde:** apps/api/src/modules/orders/orders.service.ts:1358-1360 (vs :1363-1375); apps/web/src/lib/queries.ts:573-583; apps/web/src/components/ComandaDrawer.tsx:242; apps/web/src/components/ItemPickerDrawer.tsx (arquivo inteiro, zero ocorrência de 'professional'); apps/web/src/pages/ComandaDetalhePage.tsx:373-375 e :429

**Caminho de dor:** O balcão abre uma comanda SEM profissional no cabeçalho (venda de produto, ou atendimento ainda indefinido), adiciona itens pelo picker e fatura. A profissional espera a comissão; não há lançamento e ninguém foi avisado no momento de faturar — só abrindo item a item da comanda fechada se descobre.

**Por que:** 

**Revisor:** O código confere, mas eu baixei de alto para médio porque existem duas travas visuais que o achado ignorou. Backend: `if (!professionalId) continue;` (orders.service.ts:1359) pula sem registrar nada, enquanto o ramo seguinte (item COM profissional e SEM percentual) alimenta `semPercentual` → `commissionSkipped` → toast (queries.ts:573-583). A assimetria é real: o caso 'sem profissional' nunca chega ao aviso. Front: `handleAddPicked` só herda quando o cabeçalho tem profissional (ComandaDrawer.tsx:242 — a correção do item O do estudo 07 foi parcial), o ItemPickerDrawer de fato não pergunta profissional em momento nenhum, e o AddItemForm da página de detalhe nasce com `useState('')` (:429). MAS: na lista de itens do ComandaDrawer cada item órfão é rotulado 'Sem profissional' (ComandaDrawer.tsx:478), o ItemEditDrawer permite corrigir item a item, e um `reopen` regenera as comissões — é recuperável. O agravante fica na página /comandas/:id, onde o item órfão não mostra NADA (`{item.professionalName && ...}`, :373-375): lá o defeito é invisível. Faltaria para subir a gravidade: confirmar em runtime que nenhum outro aviso aparece no faturamento; eu não rodei o fluxo.

### [MEDIO] (ambos) /comandas/:id é uma superfície de segunda classe: sem imprimir, sem cancelar, sem crédito/cashback, e sem nenhum breakpoint

**Onde:** apps/web/src/pages/ComandaDetalhePage.tsx:18-31 (imports), :168-229, :311-397

**Caminho de dor:** O dono chega nessa rota por quatro caminhos reais (histórico da ficha do cliente e 'Acessar comanda' do agendamento) e tem uma comanda com MENOS capacidade que o drawer da lista: não consegue imprimir, não consegue cancelar, e não consegue APLICAR crédito/cashback do cliente — o painel mostra 'Crédito usado' só quando já existe. Cliente com R$ 80 de crédito acaba pagando os R$ 80 em dinheiro e o crédito fica parado.

**Por que:** 

**Revisor:** CONFIRMADO como gap de paridade, rebaixado de alto para médio e reescrito porque metade do enunciado original não procede. DERRUBEI a parte 'não mostra status': a página mostra o `OrderStatusChip` no cabeçalho (:179), um banner 'Comanda finalizada — reabra para editar' (:192-196) e um banner 'Comanda cancelada.' (:197-200). O que SOBRA e confere: os imports (:18-31) não trazem nenhum hook de imprimir, cancelar, aplicar crédito ou cashback — só finish/reopen/addItem/removeItem/addDiscount/addPayment/reversePayment; e `grep 'md:|lg:'` no arquivo devolve ZERO — as duas únicas classes responsivas são `sm:` na linha 231/239, ou seja, a tela é a mesma em celular e desktop. A lista de itens é um `<ul>` dentro de um SectionCard creme (:311-397) sem irmão `md:hidden`, que é exatamente o padrão que o projeto proíbe para lista no celular. Não achei comentário nem estudo dizendo que a rota é deliberadamente reduzida.

### Derrubados na revisão (NÃO mexer)

- **[metade do achado 4] Comanda EM ABERTO imprime como se fosse comprovante — 'Falta pagar' fica num rodapé discreto** — ComandaImpressao.tsx:163-169 imprime 'Falta pagar R$ X' com `forte` (negrito, mesma ênfase da linha 'Total'), e cada pagamento não-pago recebe o sufixo '(em aberto)' no próprio rótulo (:156). Não é discreto e não é omissão. O que sobrevive do achado é só o caso CANCELADO, que mantive separado.
- **[metade do achado 6] A página /comandas/:id não diz o status da comanda** — Ela diz, em três lugares: `<OrderStatusChip status={order.status} />` ao lado do número (ComandaDetalhePage.tsx:179), banner âmbar 'Comanda finalizada — reabra para editar' (:192-196) e banner vermelho 'Comanda cancelada.' (:197-200). O relatório confundiu a página com o recibo impresso — quem não imprime status é o ComandaImpressao.
- **[sub-alegação do achado 3] O AddItemForm da página de detalhe não tem como atribuir profissional** — Ele tem: o formulário carrega `useProfessionals()` (ComandaDetalhePage.tsx:325) e renderiza um Select de profissional, enviando `professionalId: professionalId || undefined` (:478). O defeito real é só a ausência de HERANÇA do cabeçalho (nasce em `useState('')`, :429) — não a ausência do campo. Corrigi a redação no achado que mantive.

---

## Criar e editar cliente (tela de Clientes, perfil do cliente, criação em linha no agendamento) — painel web + mobile — REVISÃO ADVERSARIAL

### [ALTO] (ambos) Colar telefone com +55 grava 15 dígitos e o campo passa a mostrar outro número

**Onde:** apps/web/src/components/PhoneField.tsx:102-105 (emitir), :57-80 (separarTelefone), :40-50 (mascarar); apps/api/src/modules/customers/dto-helpers.ts:41-43; apps/api/src/modules/customers/dto.ts:49 e :98; apps/web/src/lib/format.ts:77-99 (formatPhone)

**Caminho de dor:** A atendente copia "+55 11 99999-9999" da conversa do WhatsApp e cola no campo Celular (cadastro completo OU criação em linha do agendamento, NewAppointmentModal.tsx:811 — é o mesmo PhoneField). Espera ver o número que colou. O campo passa a exibir "(55) 55119-9999" com a bandeira +55 ao lado, e o valor gravado é "555511999999999" (15 dígitos). O mesmo com "5511999999999" colado só em dígitos, e com um dígito a mais digitado no fim de um número já completo (vira 14). O número não existe: confirmação e lembrete de WhatsApp não chegam, e a lista mobile (ClientesPage.tsx:766, formatPhone) e a coluna Celular do desktop (:698) mostram o lixo cru, porque formatPhone só conhece 10/11/12/13 dígitos e devolve `raw` no resto. O cabeçalho do perfil (ClientePerfilTabs.tsx:2905) já imprime `customer.phone` sem formatação nenhuma.

**Por que:** 

**Revisor:** CONFIRMADO linha a linha. emitir() concatena `${p.código}${digitos}` com TODOS os dígitos, sem tirar DDI colado e sem teto; mascarar() só corta a EXIBIÇÃO em 11. Na volta, separarTelefone falha a regra 1 (resto de 13 não está em [10,11]), a regra 2 exige `length <= 13` e cai na regra 3 (Brasil + tudo). Backend não barra: normalizarTelefone só recusa >15 e @MaxLength(15) passa com exatamente 15. Não há guarda no front (canSave só exige nome com 2+ caracteres). O estudo 57 documenta a intenção do PhoneField e o comentário do :68-74 mostra que já conheciam o irmão desse bug (digitação parcial) — o caso do DDI colado ficou de fora, não é decisão deliberada. REBAIXADO de crítico para alto: não é dinheiro errado, vazamento entre empresas nem mensagem indevida — o número resultante não existe, então o envio falha em vez de ir para o destinatário errado; e a corrupção fica VISÍVEL no campo na hora, o que salva parte dos casos. Continua sendo o achado mais fácil de disparar da área.

### [ALTO] (ambos) Não existe jeito de APAGAR telefone, e-mail, CPF, aniversário, endereço ou observações de um cliente — e o toast diz "Cliente salvo"

**Onde:** apps/web/src/pages/ClientePerfilTabs.tsx:345-387 (handleSave; phone em :351, birthday em :354, observations em :386); packages/shared/src/api-client.ts:90 (JSON.stringify); apps/api/src/modules/customers/dto-helpers.ts:35; apps/api/src/modules/customers/dto.ts:98-99; apps/api/src/modules/customers/customers.service.ts:142-150; apps/web/src/lib/queries/clientes.ts:190-200 (toastSuccess 'Cliente salvo')

**Caminho de dor:** O cadastro ficou com o telefone de outra pessoa (o estudo 121 já produziu isso na base: o mesmo 89981312500 em 'Lucas Feitosa', 'Lucas Carvalho Feitosa' e 'Paulo de Tasso'). A recepcionista abre o perfil, apaga o campo Celular, clica em Salvar, recebe o toast verde "Cliente salvo" — e o telefone antigo continua lá quando ela reabre. Ela repete, fecha, reabre e conclui que "o sistema não salva". Vale para nickname, phone, secondaryPhone, email, birthday, cpf, cnpj, rg, cep, street, number, district, city, state, complement e observations. Como o telefone é o destino das mensagens, um número de terceiro fica preso no cadastro para sempre — e a confirmação do agendamento vai para quem não é a cliente.

**Por que:** 

**Revisor:** CONFIRMADO, e é PIOR do que o achado descreve. Confirmei as duas travas: (1) `campo.trim() || undefined` + JSON.stringify que omite a chave; (2) `...rest` no Prisma, onde undefined é 'não mexa'. Mas testei também a hipótese 'bastaria o front mandar null': para phone/cpf/cnpj/cep NÃO bastaria — o @Transform roda antes da validação e `normalizarTelefone(null)` devolve undefined logo na primeira linha (dto-helpers.ts:30), então nem null limpa. O conserto exige backend. Só birthday e os campos sem @Transform aceitariam null hoje (customers.service.ts:150 já tem o caminho `birthday ? new Date : null`), e mesmo assim o front nunca manda. A única exceção real é a foto (ClientePerfilTabs.tsx:227 manda avatarUrl: ''), e tags/dependents/socialProfiles, que vão como array e limpam. Mantida a gravidade alto.

### [ALTO] (ambos) A busca de cliente só olha o NOME, e criar cliente não checa duplicata — duplicatas confirmadas na base

**Onde:** apps/api/src/modules/customers/customers.service.ts:40 (WHERE só com name) e :105-135 (create sem findFirst); packages/db/prisma/schema.prisma (model Customer: só @@unique([companyId,userId]) e ([companyId,legacyId]); phone/email/cpf sem @unique); apps/api/src/modules/public-booking/public-booking.service.ts:1212-1218 (o portal público FAZ a checagem por telefone)

**Caminho de dor:** A cliente diz o telefone. A atendente digita "98129-1426" na busca de Clientes (desktop: InlineSearch no header, ClientesPage.tsx:348; mobile: input de busca em :425-439 — os dois mandam o mesmo `search` para o servidor) ou no seletor de cliente do agendamento (NewAppointmentModal.tsx:702, CustomerPickerDrawer, mesma rota) e recebe "Nenhum cliente encontrado". Cadastra de novo com o nome que ouviu. Na base (Studio Borboletas, 38 clientes ativos) já existem: 'Adriana Araújo' e 'Mãe Adriana' com o mesmo 89994008076; 'Scheila' e 'Sheila' com o mesmo número gravado em formatos diferentes ('(89) 98129-1426' e '89981291426'); 'Amanda Dias' duplicada com '+55 89 99457-2834' e '89994572834'. Cada duplicata parte histórico, cashback e débito em duas fichas.

**Por que:** 

**Revisor:** CONFIRMADO no código e nos dados (consultei o banco 5434). Duas correções ao achado original, ambas AGRAVANTES: (a) o formato gravado é inconsistente na base legada — 'Scheila' está como '(89) 98129-1426' e 'Amanda Dias' como '+55 89 99457-2834' —, então um `findFirst({ phone })` de igualdade exata, que é exatamente o que resolveGuestCustomer usa no portal público, NÃO acharia essas duplicatas; qualquer conserto precisa comparar por dígitos normalizados, não por string; (b) o placeholder da busca é genérico ('Buscar cliente' / 'Digite para buscar'), então nada avisa a atendente de que só o nome conta. Mantida a gravidade alto: não é perda de dado, mas parte o histórico financeiro do cliente em duas.

### [MEDIO] (ambos) Aniversário aparece um dia antes do que foi cadastrado, e a tela de Clientes discorda do relatório de Aniversariantes

**Onde:** apps/api/src/modules/customers/customers.service.ts:112 (`new Date(birthday)`); apps/web/src/lib/format.ts:16-21 (formatDate, sem timeZone) e :44-49 (toDateInput, em UTC); apps/web/src/pages/ClientesPage.tsx:703 (coluna Nascimento, desktop); apps/web/src/pages/relatorios/ClientesPage.tsx:31 (formatDate no relatório de clientes); apps/api/src/modules/reports/reports.service.ts:740-747 (getMonth/getDate no fuso do servidor)

**Caminho de dor:** A atendente escolhe 10/05/1990 e salva. A coluna "Nascimento" da lista (desktop) e a coluna "Aniversário" do relatório de Clientes (desktop e mobile) mostram 09/05/1990. Reabrindo o perfil, o campo mostra 10/05 de novo — a pessoa não sabe qual é a data certa. Quem nasceu dia 1º cai no mês anterior (01/06 vira 31/05). E o relatório de Aniversariantes, que lê a data no servidor, lista o dia 10 enquanto a lista de Clientes mostra 09.

**Por que:** 

**Revisor:** CONFIRMADO e reproduzido: rodei `TZ=America/Sao_Paulo node` com o mesmo par de chamadas — `new Date('1990-05-10')` → 1990-05-10T00:00:00Z, formatDate → 09/05/1990, toDateInput → '1990-05-10', e 01/06 → 31/05/1990. Na base, os 459 aniversários da Fátima estão todos gravados como 00:00:00 UTC, então o defeito atinge todos. REBAIXADO de alto para médio: o dado GRAVADO está certo (só a exibição erra), não há dinheiro nem mensagem envolvidos, e verifiquei a hipótese mais grave e ela NÃO se confirma — a campanha diária de aniversário (campaigns.service.ts:385-403 + queues.service.ts:343, cron '0 0 9 * * *') lê getMonth/getDate no fuso do SERVIDOR, e com o servidor em UTC ela acerta o dia; só dispararia errado se o container rodasse em America/Sao_Paulo, o que não consegui provar (não achei TZ fixado em Dockerfile/main.ts). Fica como suspeita separada, a provar lendo a TZ do container em produção. Corrigi também o 'onde': a coluna Nascimento da lista de Clientes é `hidden md:block` (só desktop); no mobile o sintoma aparece pelo relatório de Clientes.

### [ALTO] (ambos) Para cadastrar data de nascimento é preciso clicar ~490 vezes na seta de mês anterior — na prática o campo fica vazio

**Onde:** apps/web/src/components/DatePicker.tsx:294-296 (viewMonth começa no mês atual quando não há valor), :185-221 (cabeçalho só com 'Mês anterior'/'Próximo mês'; o título é um <div>, não botão), :655-694 (o gatilho é um <button>, não existe <input> para digitar); uso em apps/web/src/pages/ClientePerfilTabs.tsx:484-486

**Caminho de dor:** A atendente cadastra uma cliente nascida em 1985. Clica no campo Aniversário, o calendário abre em agosto/2026 (mês atual, porque o valor está vazio). Não há campo para digitar "10/05/1985", não há seletor de ano nem de mês — só duas setas de um mês por vez, ~490 toques. No celular o calendário é bottom-sheet, e são 490 toques na tela. Ela desiste e deixa o campo vazio.

**Por que:** 

**Revisor:** CONFIRMADO no código e nos dados: no Studio Borboletas, 0 de 38 clientes têm birthday preenchido; na Fátima Cabelos, 459 de 1216 — e esses 459 estão todos como 00:00:00 UTC, assinatura da importação do Belasis, não da tela. Verifiquei que não é decisão documentada: o estudo 30 mexeu neste componente, mas só no formato do cabeçalho ('2026 Jul' → 'Julho de 2026') e na contenção do popover; nada sobre navegação por ano. Mantida a gravidade alto — não por incômodo, mas porque zera na prática o campo que alimenta o relatório de Aniversariantes e a campanha de aniversário; uma automação inteira do produto fica sem insumo. O mesmo DatePicker atende filtros de período, onde as datas são próximas e o componente serve bem: o defeito é usar o mesmo componente para data de nascimento.

### [MEDIO] (ambos) O Salvar do cadastro de cliente fica no fim de uma rolagem longa; o Drawer já tem rodapé fixo e este é o único cadastro que não usa

**Onde:** apps/web/src/pages/ClientePerfilTabs.tsx:2205-2230 (CustomerCreateModal: Drawer sem a prop `footer`) e :806-820 (Cancelar/Salvar soltos no fim do corpo do formulário); apps/web/src/components/Drawer.tsx:13-16 (a prop `footer` existe: 'Sticky footer (e.g. Cancelar / Salvar)'); comparar com apps/web/src/pages/ProfissionaisPage.tsx:961-976 (`footer={<Cancelar/Salvar>}`)

**Caminho de dor:** No celular a dona abre "Novo cliente", digita nome e telefone e procura o botão de salvar. Ele não está à vista: é preciso rolar por Cadastro, Configuração, Relacionamento, Redes sociais, Endereço e Observações até o fim. No mesmo painel, 'Novo profissional' tem os dois botões grudados no rodapé o tempo todo.

**Por que:** 

**Revisor:** CONFIRMADO: o Drawer expõe `footer` e o CustomerCreateModal (:2205) e o ClientePerfilModal (:2960, mesmo CustomerForm no modo edit) não passam nenhum. REBAIXADO de alto para médio: é ergonomia e inconsistência, sem perda de dado nem risco financeiro. Um agravante que o achado não citou e eu confirmei: a régua de seções do formulário (PerfilMenuLateral) é `hidden ... md:flex` (ClientePerfilTabs.tsx:2759), ou seja, no CELULAR a criação não tem NENHUMA navegação entre seções — é uma coluna única de seis blocos com o botão no fim. No perfil de um cliente já salvo existe o AppTabs mobile (:2947), na criação não existe.

### Derrubados na revisão (NÃO mexer)

- **Gravidade 'crítico' do bug de colar telefone com +55** — O achado é real, mas a gravidade não. Pelo critério do dono, crítico é dinheiro errado, perda de dado, vazamento entre empresas ou mensagem indevida ao cliente. O número resultante (15 dígitos, '555511999999999') não existe em lugar nenhum: o envio falha, não vai para o destinatário errado. E a corrupção fica visível no próprio campo no instante da colagem — '(55) 55119-9999' com bandeira +55 ao lado —, então não é silenciosa. Rebaixado para alto.
- **'Scheila e Sheila com o MESMO telefone 89981291426' e 'Adriana … além de Lilian, Karol e Amanda Dias repetidas'** — A evidência foi apresentada de forma imprecisa. Consultando a base 5434: só 'Adriana Araújo'/'Mãe Adriana' têm a string de telefone literalmente igual (89994008076) — é a única linha que um GROUP BY por phone encontra. 'Scheila'/'Sheila' e as duas 'Amanda Dias' têm o mesmo NÚMERO em formatos DIFERENTES ('(89) 98129-1426' vs '89981291426'; '+55 89 99457-2834' vs '89994572834'), o que é um fato distinto e mais grave, não o mesmo fato. E 'Lilian' (99984549519 vs 89984549519) e 'Karol' (89994036910 vs 99984594129) têm telefones DIFERENTES — são suspeitas de duplicata, não duplicatas provadas; podem ser pessoas distintas. O achado de fundo (busca só por nome, create sem checagem, sem @unique) continua confirmado; o que caiu foi a forma como a prova foi contada.
- **Gravidade 'alto' do aniversário com um dia a menos** — O dado gravado está correto; só a renderização erra, e a hipótese que justificaria 'alto' — a campanha automática de aniversário disparando no dia errado — não se sustenta com o servidor em UTC: campaigns.service.ts:385-403 compara getMonth/getDate do birthday (00:00:00Z) com os de hoje no MESMO fuso do servidor, e o cron roda 09:00 (queues.service.ts:343), então em UTC a data casa. Não achei TZ fixado no Dockerfile nem em main.ts, então isso só viraria mensagem no dia errado se o container rodasse em America/Sao_Paulo — não consegui provar, fica como suspeita à parte. Rebaixado para médio.
- **Gravidade 'alto' do botão Salvar sem rodapé fixo** — É inconsistência de ergonomia com o resto do painel, sem perda de dado, sem risco financeiro e sem violar nenhuma das regras de mobile do produto (a lista não está em Card, o drawer sobe de baixo, a animação existe). O botão está lá e funciona; o custo é rolagem. Rebaixado para médio.
- **'O formulário não mostra o erro porque toDateInput corta a string ISO em UTC' apresentado como defeito** — toDateInput (format.ts:44-49) está CERTO para um campo date-only guardado em UTC-meia-noite — é ele que devolve '1990-05-10', a data que a pessoa escolheu. Quem erra é formatDate (:16-21), que aplica o fuso do navegador a um instante que não representa um instante. Não são dois bugs: é um só, e o conserto é no formatDate (ou no armazenamento), não no toDateInput.
