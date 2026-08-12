# 140 — `isoDate` devolve o dia em UTC: depois das 21h o painel inteiro vira amanhã

Origem: achado ALTO do laudo `.claude/studies/139-achados-4-fluxos.md`, seção
"Criar um agendamento", item `isoDate`. Área desta correção: `lib/format.ts`,
`layout/CreateDrawer.tsx`, `pages/AgendaPage.tsx` (o `NewAppointmentModal.tsx` é
de outra pessoa — não é tocado aqui).

## O defeito, com a medida

`apps/web/src/lib/format.ts:40-42`

```ts
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

`toISOString()` sempre imprime o instante em UTC. Em America/Sao_Paulo (UTC−3),
das 21:00 em diante o instante local já pertence ao dia SEGUINTE em UTC.
Reproduzido em node com `TZ=America/Sao_Paulo`:

```
new Date('2026-08-09T21:30:00-03:00')  → UTC slice 2026-08-10 · LOCAL 2026-08-09
new Date(2026, 7, 9)  (meia-noite local) → UTC slice 2026-08-09 · LOCAL 2026-08-09
new Date('2026-08-09T00:00:00.000Z')     → UTC slice 2026-08-09 · LOCAL 2026-08-08
```

Ou seja: a função só erra quando recebe um Date com HORA (o `new Date()` de
agora, ou um instante vindo da API). Quando recebe meia-noite local — que é o
caso de toda célula de calendário do painel — os dois cálculos coincidem.

A convenção do projeto já é a local e está escrita:
`apps/web/src/components/DatePicker.tsx:26-28` diz "Datas trafegam como strings
ISO curtas 'YYYY-MM-DD' (mesmo formato que os antigos `<input type="date">` e
`lib/format.isoDate`), sem fuso: tudo é tratado em horário local para não pular
um dia por causa de UTC" — e o `toISO` local dele (DatePicker.tsx:41-46) é
exatamente a implementação que falta em `format.ts`.

## Varredura de TODOS os 95 usos de `isoDate` (exigência do laudo)

`grep -rn isoDate apps/web/src` → 95 ocorrências em 31 arquivos. Classificadas:

### A) "hoje"/janela relativa a agora — o dia LOCAL é o correto (maioria)

Todos passam um `new Date()` COM hora, direta ou indiretamente. São exatamente
os que hoje escorregam depois das 21h:

- `components/NewAppointmentModal.tsx:212` e `:340` — o campo Data do novo
  agendamento (é o caminho de dor do laudo; chega aqui pela raiz, sem tocar no
  arquivo).
- `pages/AgendaPage.tsx:232` (`blockDate` do "Ocupar horários"), `:1638`
  (destaque de hoje no date picker mobile), `:2240` (`todayIso` da MonthView).
- `pages/financeiro/CaixasAbertosPage.tsx:486` e `:503` (data do fechamento).
- `pages/ComandasPage.tsx:1261` e `:1275`.
- `pages/controle/ComprasPage.tsx:778` e `:794`.
- `components/PagarComissaoDrawer.tsx:89`, `:109`, `:533`.
- `components/ValeModal.tsx:37` e `:45`.
- `pages/financeiro/TransacoesPage.tsx:1526`, `:1574`, `:1920`, `:1968`.
- `pages/financeiro/FinanceiroPainelPage.tsx:235` e `:249`.
- Períodos padrão dos relatórios (`from`/`to` de N dias a partir de agora):
  `CaixaPage.tsx:17`, `RelatoriosPage.tsx:32`, `PainelPage.tsx:113`,
  `comissoes/ComissoesResumoPage.tsx:116` e `:118` e `:191`,
  `AgendamentosPage.tsx:77` e `:82`, e os `defaultRange()` de
  `relatorios/{ExtratoContas,Vendas,Mensagens,Ranking,OrigemAgendamentos,
  Aniversariantes,ExtratoMovimentacoes,FluxoCaixa,GenericReport,Dre,
  CriacaoAgendamento,AgendamentosExcluidos,Agendamentos}Page.tsx`,
  `relatorios/financialReportKit.tsx:33` e `:40`,
  `financeiro/FinanceiroPainelPage.tsx:37`, `marketing/AvaliacoesPage.tsx:35`.

### B) Date à meia-noite LOCAL — resultado idêntico antes e depois (sem risco)

- `AgendaPage.tsx:354-355` (`fetchFrom`/`fetchTo`): vêm de `days`, `monthCells`
  ou `new Date(ano, mês, dia)` — todos construídos com o construtor de campos
  locais (`AgendaPage.tsx:136-155`, `:282-296`, `:312-323`).
- `AgendaPage.tsx:550` (`openBlock`, `days[0]`), `:1411` e `:1452`
  (`openNew(isoDate(célula))`), `:1636-1637` (células do date picker),
  `:1777` (`peekDay`), `:2277` (célula da MonthView).
- `relatorios/AgendamentosPage.tsx:117` (`endExclusive` nasce de
  `new Date(\`${safeTo}T00:00:00\`)`, que é meia-noite local — `:115-116`).

### C) Instante real vindo da API — o dia LOCAL é o correto, e hoje está ERRADO

- `AgendaPage.tsx:448` — `const key = isoDate(new Date(r.start))` agrupa os
  agendamentos por dia para a MonthView/DayPeek. A CHAVE é calculada em UTC, mas
  a BUSCA (`:1777` e `:2277`) usa célula de meia-noite local. Um agendamento das
  21:30 recebe a chave de amanhã e some da célula de hoje no mês. A correção
  alinha os dois lados.
- `AgendaPage.tsx:863-865` — `openReschedule` mistura os dois fusos na MESMA
  função: `setReDate(isoDate(d))` (dia em UTC) ao lado de
  `setReTime(d.getHours()...)` (hora LOCAL). Num agendamento das 21:30 o drawer
  abre "amanhã 21:30", e `confirmReschedule` (`:949-952`) remonta o instante com
  `new Date(y, mo-1, d, h, m)` — local — e faz PATCH. Confirmar sem editar nada
  EMPURRA o agendamento um dia para frente. É o mesmo defeito, com perda de dado.

### D) Data-only da API gravada como MEIA-NOITE UTC — aqui o UTC é de propósito

Estes são os únicos que quebrariam com a mudança, e por isso ganham função
própria. O backend transforma a string "YYYY-MM-DD" com `new Date(...)`, o que
produz meia-noite UTC:

- `apps/api/src/modules/financial/financial.service.ts:761` e `:784-787`
  (`dueDate`, `paidAt`, `competenceDate`).
- `apps/api/src/modules/purchases/purchases.service.ts:133` e `:221` (`date`).

Consumidores no painel que releem esse valor para preencher `<input date>`:

- `pages/financeiro/TransacoesPage.tsx:1557` (`dueDate`), `:1561` (`paidAt`),
  `:1564` (`competenceDate`).
- `pages/controle/ComprasPage.tsx:812` (`detailData.date`).

Com o dia local, `2026-08-09T00:00:00.000Z` viraria `2026-08-08` e reabrir um
lançamento para editar puxaria a data um dia para trás — e salvar gravaria o
erro. Por isso NÃO viram local: passam a chamar `isoDateUtc`, que é a função
antiga com o nome dizendo o que ela faz.

`toDateInput` (`format.ts:45-50`) tem a mesma forma e é usada só para campos
data-only da mesma família (`ClientePerfilTabs.tsx:244` birthday,
`ProdutosPage.tsx:2202-2203` manufacturedAt/expiresAt, `ProfissionaisPage.tsx:803`
birthday) — fica como está; só ganha o comentário dizendo por quê.

## Arquivos que vou tocar

1. `apps/web/src/lib/format.ts` — `isoDate` passa a devolver o dia LOCAL
   (mesma conta do `DatePicker.toISO`); nasce `isoDateUtc` com o corpo antigo
   para os casos do grupo D; comentário no `toDateInput` explicando a diferença.
2. `apps/web/src/pages/financeiro/TransacoesPage.tsx:1557`, `:1561`, `:1564` —
   trocam `isoDate` por `isoDateUtc` (comportamento preservado, sem mudança de
   tela).
3. `apps/web/src/pages/controle/ComprasPage.tsx:812` — idem.
4. `apps/web/src/pages/AgendaPage.tsx:862-866` — comentário no `openReschedule`
   registrando que data e hora precisam sair do MESMO fuso (grupo C), para
   ninguém "otimizar" de volta para UTC.

`apps/web/src/layout/CreateDrawer.tsx:137-142` foi lido e NÃO precisa de
alteração: ele não passa `initialDate`, então o padrão vem do
`NewAppointmentModal`, que é corrigido pela raiz. Tocar nele seria inventar uma
segunda fonte de "hoje".

## Fora do escopo (relatar, não corrigir)

Mesmo defeito, mas em helpers locais fora dos três arquivos da área:
`pages/PacotesPage.tsx:1189`, `ai/AiDadosPage.tsx:51`,
`pages/relatorios/ReportPdfButton.tsx:225`, `pages/AssinaturasPage.tsx:310`
(os dois últimos só nomeiam arquivo exportado).
