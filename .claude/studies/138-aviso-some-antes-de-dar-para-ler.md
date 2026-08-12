# Estudo 138 — o aviso some antes de dar para ler (e o mais útil nem chega)

Relato do dono: ao cancelar/excluir um agendamento que ainda tem comanda para
faturar, aparece a mensagem mandando resolver a comanda antes — *"o problema é
que essa mensagem aparece muito rápido e some"*. E, no mesmo pedido: *"veja
outros locais que aparece uma notificação e some rápido"*.

São **três** defeitos distintos no caminho, não um.

## Arquivos tocados

- `apps/web/src/lib/toast.ts`
- `apps/web/src/components/AvisosGlobais.tsx` (novo)
- `apps/web/src/main.tsx`
- `apps/web/src/lib/queries.ts`
- `apps/web/src/pages/AgendaPage.tsx`
- `apps/web/src/pages/AgendamentosPage.tsx`
- `apps/web/src/components/MinhaContaDrawer.tsx`

Verificados e **deixados como estão**, porque não têm o defeito:

- `apps/web/src/pages/financeiro/BelasisPayCadastroPage.tsx` — os 2800ms valem só
  para confirmação ("Cadastro enviado.", "Suporte: em breve."); nenhum erro passa
  por ali, e o timer é cancelado pelo cleanup do `useEffect`.
- `apps/web/src/pages/marketing/LinkAgendamentoPage.tsx` — os 2200ms são do
  "Copiado!". Erro ali vai para `setError`, renderizado de forma PERSISTENTE
  (`:250`), que é o comportamento correto — e o `flash` dele já limpa o timer
  antes de reagendar. É de onde tirei o padrão para os outros.

## A mensagem que o backend manda é boa

`apps/api/src/modules/appointments/appointments.service.ts:1438-1453`
(`assertSemComandaViva`, usada por excluir E por cancelar):

```ts
throw new ConflictException(
  `Este agendamento tem a comanda #${comanda.number}, que ${situacao}. ` +
    `Cancele ou exclua a comanda antes de ${acao} o agendamento.`,
);
```

Ela diz o número da comanda, a situação ("já foi faturada" / "está aberta") e o
que fazer. São ~120 caracteres — uma instrução, não um aviso.

## Defeito 1 — na maior parte dos caminhos essa frase é JOGADA FORA

`catch` sem parâmetro descarta o erro e mostra um texto genérico:

| arquivo:linha | o que a pessoa vê no lugar |
|---|---|
| `AgendamentosPage.tsx:139` | "Erro ao atualizar o agendamento." |
| `AgendaPage.tsx:585` | "Erro ao atualizar." |
| `AgendaPage.tsx:884` | "Não foi possível salvar as alterações do agendamento." |
| `AgendamentosPage.tsx:153` | "Erro ao enviar sugestao." |
| `AgendaPage.tsx:598` | "Erro ao enviar sugestao." |

As duas primeiras são exatamente o fluxo do relato — mudar o status para
`canceled`. Ou seja: **na tela de cancelar, a frase sobre a comanda nunca
aparece**. O dono só a viu porque o caminho de EXCLUIR (`AgendaPage.tsx:408`)
usa `err.message`, ao contrário dos outros.

Existe um helper pronto para isso desde sempre — `apiErrorMessage`
(`lib/toast.ts:25-35`), que já trata `message` string ou array do Nest.

## Defeito 2 — a duração é fixa e não distingue aviso de instrução

`AgendaPage.tsx:512-515` e `AgendamentosPage.tsx:122-125` são a mesma função
copiada:

```ts
function flash(msg: string) {
  setToast(msg);
  setTimeout(() => setToast(null), 3000);
}
```

3 segundos para QUALQUER coisa — "Agendamento confirmado." e uma instrução de
duas linhas sobre faturamento recebem o mesmo tempo. E o toast global
(`lib/toast.ts:19`) tem `TOAST_TIMEOUT = 4000` usado igualmente para sucesso e
erro (`toastMutationError`, `:42-44`), que é o handler de TODAS as mutations.

Levantamento dos outros pontos, como o dono pediu:

| duração | onde | o que é |
|---|---|---|
| 2200ms | `marketing/LinkAgendamentoPage.tsx` | feedback |
| 2800ms | `financeiro/BelasisPayCadastroPage.tsx` | toast |
| 3000ms | `AgendaPage`, `AgendamentosPage`, `MinhaContaDrawer` | toast |
| 4000ms | `lib/toast.ts` (global) | sucesso E erro |
| 1500–1800ms | 6 lugares com "Copiado!" | ok assim: confirma um gesto |

Os de 220–300ms são debounce/animação, não mensagem.

## Defeito 3 — o timer não é cancelado, então uma mensagem mata a outra

O `setTimeout` do `flash` não guarda referência e nada o limpa. Duas mensagens
em sequência compartilham o destino da primeira:

```
t=0.0s  flash(A) → agenda timer A para t=3.0s
t=2.5s  flash(B) → agenda timer B para t=5.5s
t=3.0s  timer A dispara e apaga B, que estava na tela há 0,5s
```

É o que produz o sintoma literal do relato — a mensagem "aparece muito rápido e
some". Basta um segundo aviso encostar no primeiro. `LinkAgendamentoPage.tsx`
não tem esse defeito: ele guarda o timer em `timer.current` e limpa antes de
reagendar — o padrão certo já existe no repositório.

## Medição no vídeo do dono (09/08 18:00) — o número real é MUITO pior

Ele gravou a tela. Extraí os quadros com ffmpeg (10s, 1080p, 60fps) e medi o
trecho do erro a 20 quadros por segundo:

```
7,60s  o aviso começa a entrar (fade + subida)
7,75s  terminou de entrar
7,80s  visível, opaco
7,90s  visível
7,95s  SUMIU
```

**Cerca de 0,3 segundo na tela** — e boa parte disso é a animação de entrada.
Não são os 3s do `flash` nem os 4s do toast: alguma coisa está removendo o aviso
quase no mesmo instante em que ele aparece.

E o aviso do vídeo **não é o `flash`**: é o toast do HeroUI (cartão branco no
canto inferior direito, `ToastProvider placement="bottom end"` em `main.tsx:110`),
disparado pelo handler global `toastMutationError` do `MutationCache`
(`main.tsx:70-72`). O texto é o do servidor, completo — a frase da comanda #40.

O que descartei, verificando: ninguém chama `toast.clear()`/`close()` no
repositório; só existe um `ToastProvider`; `timeout` é a opção certa e o
`ToastQueue.add` a respeita (`dist/components/toast/toast-queue.js:31-37`); o
default da lib também é 4000 (`constants.js`).

A suspeita que sobra é da própria biblioteca: o `wrapUpdate` padrão do HeroUI
envolve cada atualização da fila em `document.startViewTransition`
(`toast-queue.js:21-28`), e há defeito conhecido de toast com View Transition
nessa linha (heroui-inc/heroui#6406, "Skipped ViewTransition due to another
transition starting"). Numa tela que dispara mutation + refetch + fechamento de
menu ao mesmo tempo, é exatamente o cenário. **Não provei isso** — ficaria caro
reproduzir, e a correção de raiz exigiria trocar a fila global do HeroUI (o
`ToastProvider` aceita `queue`, mas a função global `toast()` continuaria usando
a interna, então seria preciso reescrever todas as chamadas).

Por isso a decisão abaixo: para ESTE erro, não depender do toast.

## Segunda rodada: o aviso fixo resolveu, o toast continuou

O dono gravou de novo depois do deploy (09/08 18:35). Nos 3,4s do vídeo:

- **o aviso FIXO do drawer aparece e PERMANECE** em todos os quadros — a
  correção funcionou;
- **o toast do HeroUI continua evaporando** ("a notificação bugada continua").

Tentei fechar o diagnóstico com Playwright contra o painel local (API 3334 +
Vite 5173 + o agendamento real com comanda #7 do banco local). O que consegui
provar: o 409 chega com a mensagem completa. O que NÃO consegui: fazer o toast
aparecer no teste — `fetch` cru não passa pelo `MutationCache`, e as telas que
tentei para forçar mutation usam estado local em vez de toast. Fica registrado
que a medição in vitro falhou; a evidência do comportamento continua sendo o
vídeo.

### Decisão: trocar a fila do HeroUI por uma nossa

Não dá para configurar o `wrapUpdate` da fila global do HeroUI: o
`ToastProvider` aceita `queue`, mas a função global `toast()` continua usando a
interna, então metade dos avisos iria para uma fila e metade para outra.

Como `apps/web/src/lib/toast.ts` já é o ponto único por onde quase tudo passa
(só `lib/queries.ts` e `main.tsx` importavam direto de `@heroui/react`; as
outras ~30 chamadas em 13 arquivos vêm daqui), dá para trocar a implementação
por baixo **sem tocar em nenhuma chamada**: mesma API `toast.success/danger/
info/warning`.

O que ganhamos, além de parar de sumir: controle real da duração por
severidade, erro que só sai quando a pessoa fecha, e nenhuma dependência de
View Transition.

## A correção

1. `apiErrorMessage(err)` nos cinco `catch` que descartavam a frase do servidor.
2. Duração por severidade: erro passa a durar bem mais que sucesso, porque erro
   costuma ser instrução ("vá cancelar a comanda"), não confirmação. No toast
   global isso vira `TOAST_TIMEOUT_ERRO`; no `flash` local, um parâmetro.
3. Timer com referência, limpo antes de reagendar (padrão do
   `LinkAgendamentoPage`), para uma mensagem não herdar o prazo da anterior.
4. O aviso de erro ganha botão de fechar e cor própria — hoje é a mesma tarja
   escura do sucesso, e não há como mantê-lo na tela enquanto se lê.
5. **A recusa de cancelar/excluir passa a aparecer FIXA dentro do drawer**, ao
   lado do botão que a provocou, e não some sozinha: sai quando a pessoa fecha,
   tenta de novo ou troca de agendamento. É o que resolve o relato de verdade —
   qualquer que seja o motivo de o toast do HeroUI evaporar em 0,3s, este aviso
   não depende dele. E é melhor assim mesmo: o erro fica onde a ação foi feita,
   com a instrução visível enquanto a pessoa vai resolver a comanda.
