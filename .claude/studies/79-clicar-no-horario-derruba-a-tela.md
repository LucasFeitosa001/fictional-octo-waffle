# Estudo 79 — Clicar num horário derruba a tela de novo agendamento

Achado do mapeamento do fluxo de agendamento, confirmado pelo cético e reproduzido por mim fora do
navegador.

## 79.1 — A cadeia, provada elo a elo

1. **O backend devolve ISO completo.** `apps/api/src/modules/appointments/appointments.service.ts:1300`:
   ```
   start: new Date(slotStart).toISOString(),
   ```
2. **A tela guarda esse ISO inteiro.** `apps/web/src/components/NewAppointmentModal.tsx:959`:
   ```
   onClick={() => { setSlotStart(slot.start); … }}
   ```
3. **E depois remonta como se fosse `HH:MM`.** `NewAppointmentModal.tsx:383`:
   ```
   inicio: new Date(`${date}T${slotStart || '09:00'}:00`),
   ```
   Com `date = 'YYYY-MM-DD'`, sai `2026-08-01T2026-08-01T12:00:00.000Z:00`.
4. **Isso vira `Invalid Date` e explode na formatação.** Rodei em node com os valores reais:
   ```
   string montada : 2026-08-01T2026-08-01T12:00:00.000Z:00
   vira Date      : Invalid Date
   formatToParts  : LANÇOU -> RangeError: Invalid time value
   ```
   A chamada vive em `apps/web/src/lib/queries/messageTemplates.ts:192` (`diaLocal`), dentro de um
   `useMemo` — ou seja, **durante o render**, sem `try/catch`. O único anteparo é o boundary de rota
   (`App.tsx:106`), que troca a tela por "Algo deu errado nesta página".

## 79.2 — O alcance

`NewAppointmentModal` é o **único** modal de criação do painel — usado por `AgendaPage.tsx:1521`,
`ClientePerfilTabs.tsx:2759` e `layout/CreateDrawer.tsx:137` (o botão "Novo" global). Não existe
caminho alternativo, e escolher horário é obrigatório para salvar.

Indício no banco, coerente com isso: agendamentos com `source='admin'` param em **30/07 19:10**;
depois só entram os `online`. Nos dias anteriores havia 15, 1, 4, 15 por dia. É indício, não prova —
o volume diário já oscilava —, mas casa com o defeito.

## 79.3 — Correção

1. `NewAppointmentModal.tsx`: normalizar antes de montar a data. `slotStart` pode ser ISO completo
   (veio da grade) ou `HH:MM` (o padrão `'09:00'`); tratar os dois.
2. `messageTemplates.ts`: `variaveisDoAgendamento` deixa de derrubar o render quando recebe data
   inválida. Um texto de pré-visualização não pode ser capaz de tirar a tela do ar — mesmo depois de
   corrigida a origem, essa função continua exposta a qualquer chamador futuro.

A segunda parte é o que impede a classe do problema, não só este caso.
