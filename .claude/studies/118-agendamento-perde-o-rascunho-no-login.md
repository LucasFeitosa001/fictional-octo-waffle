# Estudo 118 — o agendamento volta do zero depois do login com Google

Relato do dono, agora que o login funciona (estudo 117): ele escolhe serviço,
profissional, dia e horário, chega no passo 4, vincula a conta Google — e volta
para o portal **com o fluxo reiniciado**, tendo que escolher tudo de novo.

Pedido explícito: voltar do Google já no ponto de **confirmar**, com as escolhas
preservadas.

## Arquivos tocados

- `apps/web-club/src/pages/BookingPage.tsx`

## Evidência lida

Todo o estado do fluxo vive em `useState`, ou seja, só na memória da página:

- apps/web-club/src/pages/BookingPage.tsx:205 — `const [step, setStep] = useState<Step>('service')`
- :206 — `selectedServices`
- :210 — `professional`
- :211 — `date`
- :216 — `slot`
- :128-134 — `Step` é `'service' | 'professional' | 'datetime' | 'confirm'`

E o login social é uma NAVEGAÇÃO DE PÁGINA INTEIRA, não um popup:

- :762-769 — o botão do passo 4 chama `signIn.social({ provider:'google', … })`,
  que manda o navegador para `accounts.google.com` e depois de volta pelo
  `callbackURL`.
- `apps/web-club/src/pages/LoginPage.tsx:47-49` já registra a mesma natureza do
  fluxo: *"On success … navigate back to `backTo` … with a FULL reload
  (window.location)"*.

Sair da página descarta todo `useState`. Quando o navegador volta, o
`BookingPage` monta do zero: `step` volta para `'service'`, `selectedServices`
vazio, `professional` nulo, `slot` nulo. Não há nada em `sessionStorage` nem na
URL que carregue essas escolhas — grep por `sessionStorage|localStorage` no
arquivo não devolve nenhuma chave de rascunho (só `useFavorites`, que é outra
coisa e vive em `lib/favorites`).

Ou seja: o dado nunca foi perdido "por bug"; ele nunca foi guardado.

## O que este estudo muda

Um RASCUNHO do agendamento em `sessionStorage`, por salão:

1. gravado a cada mudança das escolhas (serviços, profissional, data, horário e
   passo);
2. restaurado na montagem, quando existir rascunho do MESMO salão e ainda
   fresco;
3. apagado ao concluir o agendamento e ao trocar de salão.

Decisões e seus porquês:

- **`sessionStorage`, não `localStorage`**: rascunho é da aba e daquela sessão.
  Em `localStorage` ele sobreviveria por dias e, na visita seguinte, ressuscitaria
  um horário provavelmente já ocupado.
- **Validade de 30 minutos**: o suficiente para o desvio do login, curto o
  bastante para não restaurar um horário velho. Rascunho expirado é descartado
  em silêncio.
- **O horário é revalidado, não confiado**: ao restaurar em `confirm`, o slot
  pode ter sido tomado por outra pessoa enquanto o dono estava no Google. A
  restauração devolve a pessoa ao passo salvo, mas a confirmação continua
  passando pela mesma verificação de disponibilidade de sempre — restaurar não é
  reservar.
- **Serviço/profissional são regravados pelo id**: o rascunho guarda os objetos
  como vieram da API, então nomes e preços exibidos na revisão são os do momento
  da escolha; a criação do agendamento usa os ids, que é o que o servidor valida.
