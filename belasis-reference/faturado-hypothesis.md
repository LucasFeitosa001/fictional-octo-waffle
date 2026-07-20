# Hipótese: como o Belasis calcula "Faturados" no Funil de agendamentos

Data: 2026-07-20
Autor: análise de código + inspeção do DOM capturado do Belasis (`belasis-reference/wow/desktop.html`).

> **Correção do doc anterior.** A versão prévia deste arquivo citava `dashboard.util.ts`,
> `dashboard.util.test.ts` e uma função `computeFunnel` "coberta por testes". **Nada disso
> existe no repo.** O funil roda 100% inline em `dashboard.service.ts:263-278`. Este
> documento reflete o código real e propõe *criar* o `dashboard.util.ts`.

---

## 1. Evidências (verificadas)

### 1.1 DOM real do Belasis (`belasis-reference/wow/desktop.html`)
- Widget "Funil de agendamentos" (Recharts `Funnel`) com três segmentos nomeados
  `Todos`, `Confirmados`, `Faturados` — larguras em progressão aritmética constante
  (541 → 432.8 → 324.6, Δ=108.2), que é como o Recharts.Funnel desenha **valores iguais**.
- Donut "Agendamentos por status" logo acima: `Total: 29`, `Confirmado 29 (100%)`.
- **Conclusão:** para o período filtrado, **Todos = Confirmados = Faturados = 29** e o
  status de 100% dos agendamentos é "Confirmado".

### 1.2 Schema da nossa DB (`packages/db/prisma/schema.prisma`)
- `enum OrderStatus { open, finished, canceled }` (linha 72). **"Comanda aberta" é um
  estado de primeira classe** — hoje ignorado pelo funil.
- `Appointment` (1014) **não tem** relação com `Order`; `Order` (1091) **não tem**
  `appointmentId`. **Não existe FK entre agendamento e comanda.**
- Ambos têm `legacyId`/`legacySource`, mas com prefixos disjuntos: appointment usa
  `apt:<start>:<cliente>:<prof>` (`import-belasis-agendamentos.ts:36`) e order usa
  `cmd:<num>` (`import-belasis-historico.ts:90`). **Nenhuma chave de junção comum.**

### 1.3 O que o importer realmente grava
- Appointments: `status: a.status` vindo do export (`import-belasis-agendamentos.ts:50`).
  O export do Belasis só expõe "Confirmado" → praticamente todos entram `confirmed`.
- Comandas: **`status: 'finished'` fixo** (`import-belasis-historico.ts:104`). Ou seja,
  **no dataset importado NÃO existe nenhuma order `open`.**

### 1.4 Nossa definição de produção (`dashboard.service.ts:267-278`)
```ts
const faturadoKeys = new Set(
  finishedOrders                       // <- SOMENTE status === finished
    .filter((o) => o.customerId)
    .map((o) => `${o.customerId}|${this.dayInTz(o.date, tz)}`),
);
const funil = {
  todos: agendamentosCount,
  confirmados: appointments.filter((a) => CONFIRMED_ONWARDS.includes(a.status)).length,
  faturados: appointments.filter(
    (a) => a.customerId && faturadoKeys.has(`${a.customerId}|${this.dayInTz(a.start, tz)}`),
  ).length,
};
```
Faturado = existe uma comanda **finished**, do **mesmo cliente**, no **mesmo dia** do agendamento.

Resultado observado em prod (Fátima Cabelos, julho): ~34 matches / ~1.349 appts ≈ **2,5%** —
muito longe dos 100% do Belasis.

---

## 2. As 4 hipóteses do algoritmo "Faturado" do Belasis

| # | Definição de "Faturado" no Belasis | Explica 29/29/29? | Requer no schema deles |
|---|---|---|---|
| **H1** | `appointment.status` virou "faturado/atendido" (status no próprio card) | Só se 100% dos cards foram fechados no período | transição de status no appt |
| **H2** | Agendamento tem comanda vinculada **finished/paga** (FK + pagamento) | Só se todas as 29 foram pagas | FK `order.appointmentId` + payments |
| **H3** | Agendamento gerou **qualquer comanda não-cancelada** (open **ou** finished) via FK — "abriu comanda a partir do agendamento" | **Sim, naturalmente** num salão saudável | FK `order.appointmentId` |
| **H4** | Heurística permissiva por `(cliente, dia)`: cliente tem **qualquer** comanda (open ou finished) no mesmo dia | Sim, se todo cliente-do-dia teve comanda | nada (só a heurística) |

Detalhamento:

- **H1** — Belasis marca o próprio agendamento como "faturado" ao fechar a comanda. É a
  *manifestação de superfície* de H3 (o status do card muda quando a comanda é aberta/fechada),
  mas semanticamente é um campo do appointment, não uma junção.
- **H2** — a leitura mais estrita ("faturado" = dinheiro entrou). Improvável ser a do widget:
  exigiria que todas as 29 estivessem pagas *no instante do print*, e comandas abertas do dia
  não contariam — o funil raramente bateria 100%.
- **H3** — a leitura de ERP maduro: no fluxo Belasis, confirmar → dar check-in → **abrir
  comanda** é o caminho padrão. A comanda existe (aberta) desde o atendimento; "Faturado"
  conta a *existência* da comanda, não o pagamento. Por isso Confirmados = Faturados.
- **H4** — nossa H atual, porém afrouxada em dois eixos: (a) incluir `open`, não só `finished`;
  (b) manter a junção por `(cliente, dia)` como proxy da FK ausente.

### O ponto que o usuário levantou ("qualquer appt com order aberto/finished conta")
Correto **como semântica do Belasis** (H3/H4): lá, comanda aberta já conta. **Mas há uma
pegadinha para os NOSSOS dados importados:** o importer grava toda comanda como `finished`
(§1.3), então **incluir `open` não muda nada no dataset atual** — não existem orders `open`
importadas. O `open` só passa a importar para dados nativos do SalonPass daqui pra frente.
Ou seja: a permissividade `open|finished` é necessária para *paridade semântica futura*,
mas **não é o que está travando os 2,5% → 100% hoje**. O gargalo real hoje é a **junção**
(a FK que o export não trouxe), não o filtro de status.

---

## 3. Veredito

**Mais provável: H3** — "Faturado" = agendamento com comanda não-cancelada vinculada por FK
(aberta ou finalizada). **H1** é como isso aparece na UI (o status do card acompanha a comanda).
**H2** é estrita demais para bater 100%; **H4** é a melhor aproximação que *nós* conseguimos
sem a FK.

Justificativa:
1. Belasis é ERP maduro; o fluxo "abrir comanda a partir do agendamento" cria a FK naturalmente.
2. 29/29/29 é o estado *saudável* de um salão que confirma e atende todo mundo — não é bug.
3. Nossos 2,5% não vêm de status errado: vêm da **FK ausente** no export. A junção por
   `(cliente, dia)` só reencontra ~34 pares porque a data da comanda (fechamento/pagamento)
   frequentemente não coincide com o dia do agendamento, e não há vínculo direto.

**Implicação prática para paridade:**
- Para dados **nativos** (pós-migração): implementar a FK `order.appointmentId` e contar
  comanda **não-cancelada** (open|finished) → bate H3 e reproduz 29/29/29 de forma correta.
- Para dados **legados importados**: sem FK, o melhor honesto é a heurística `(cliente, dia)`
  afrouxada (±1 dia, open|finished). Ela **não** garantirá 100% e deve ser rotulada como
  aproximação na UI.

---

## 4. Código: criar `dashboard.util.ts` + fiar no service

Objetivo do diff: extrair o funil para uma util pura e testável, e trocar a definição de
Faturado por **FK-first (H3) com fallback heurístico permissivo (H4: open|finished, ±1 dia)**.

### 4.1 Novo arquivo `apps/api/src/modules/dashboard/dashboard.util.ts`

```diff
--- /dev/null
+++ b/apps/api/src/modules/dashboard/dashboard.util.ts
@@
+import { AppointmentStatus, OrderStatus } from '@beautypass/db';
+
+// Statuses que contam como "confirmado" no funil (confirmado e tudo a jusante).
+export const CONFIRMED_ONWARDS: AppointmentStatus[] = [
+  AppointmentStatus.confirmed,
+  AppointmentStatus.waiting,
+  AppointmentStatus.in_progress,
+  AppointmentStatus.done,
+  AppointmentStatus.finished,
+];
+
+export interface FunnelAppointment {
+  id: string;
+  customerId: string | null;
+  status: AppointmentStatus;
+  start: Date;
+}
+
+export interface FunnelOrder {
+  // Presente só em dados nativos (SalonPass); null em comandas importadas do Belasis.
+  appointmentId?: string | null;
+  customerId: string | null;
+  status: OrderStatus;
+  date: Date;
+}
+
+export interface FunnelResult {
+  todos: number;
+  confirmados: number;
+  faturados: number;
+}
+
+// "Faturado" (semântica Belasis / H3): o agendamento gerou uma comanda não-cancelada.
+//
+//  1. FK-first: se a comanda tem `appointmentId` (dado nativo), casa direto — inclui
+//     comandas ABERTAS (open), não só finished. É o caminho que reproduz 29/29/29.
+//  2. Fallback heurístico (dados legados importados, sem FK): casa por
+//     (customerId, dia) com tolerância de +/- 1 dia e status open|finished. Aproximação
+//     rotulada — NÃO garante paridade, apenas a melhor estimativa sem o vínculo.
+export function computeFunnel(
+  appointments: FunnelAppointment[],
+  orders: FunnelOrder[],
+  dayInTz: (d: Date) => string,
+  addDaysInTz: (d: Date, n: number) => string,
+): FunnelResult {
+  const billable = (s: OrderStatus) => s !== OrderStatus.canceled; // open OU finished
+
+  // (1) vínculo direto por FK.
+  const faturadoAppointmentIds = new Set(
+    orders
+      .filter((o) => billable(o.status) && o.appointmentId)
+      .map((o) => o.appointmentId as string),
+  );
+
+  // (2) chaves heurísticas (cliente, dia) e (cliente, dia +/- 1) das comandas sem FK.
+  const faturadoKeys = new Set<string>();
+  for (const o of orders) {
+    if (!billable(o.status) || !o.customerId || o.appointmentId) continue;
+    faturadoKeys.add(`${o.customerId}|${dayInTz(o.date)}`);
+    faturadoKeys.add(`${o.customerId}|${addDaysInTz(o.date, -1)}`);
+    faturadoKeys.add(`${o.customerId}|${addDaysInTz(o.date, 1)}`);
+  }
+
+  const isFaturado = (a: FunnelAppointment) =>
+    faturadoAppointmentIds.has(a.id) ||
+    (a.customerId != null && faturadoKeys.has(`${a.customerId}|${dayInTz(a.start)}`));
+
+  return {
+    todos: appointments.length,
+    confirmados: appointments.filter((a) => CONFIRMED_ONWARDS.includes(a.status)).length,
+    faturados: appointments.filter(isFaturado).length,
+  };
+}
```

### 4.2 Fiar no service (`dashboard.service.ts`)

```diff
--- a/apps/api/src/modules/dashboard/dashboard.service.ts
+++ b/apps/api/src/modules/dashboard/dashboard.service.ts
@@
 import { AppointmentStatus, OrderStatus } from '@beautypass/db';
 import { PrismaService } from '../../prisma/prisma.service';
+import { computeFunnel } from './dashboard.util';
@@
-    // ---- 11. Funil de conversão -----------------------------------------------
-    // "Faturado" (Belasis) = o agendamento virou comanda. Como o export marca TODO
-    // agendamento como "Confirmado" (nunca "finished"), casamos o agendamento a uma
-    // comanda finalizada do MESMO cliente no MESMO dia.
-    const faturadoKeys = new Set(
-      finishedOrders
-        .filter((o) => o.customerId)
-        .map((o) => `${o.customerId}|${this.dayInTz(o.date, tz)}`),
-    );
-    const funil = {
-      todos: agendamentosCount,
-      confirmados: appointments.filter((a) => CONFIRMED_ONWARDS.includes(a.status)).length,
-      faturados: appointments.filter(
-        (a) => a.customerId && faturadoKeys.has(`${a.customerId}|${this.dayInTz(a.start, tz)}`),
-      ).length,
-    };
+    // ---- 11. Funil de conversão -----------------------------------------------
+    // "Faturado" (semântica Belasis / H3): agendamento gerou comanda NÃO-CANCELADA
+    // (open ou finished). FK-first quando existir order.appointmentId; senão heurística
+    // (cliente, dia +/- 1). Ver belasis-reference/faturado-hypothesis.md.
+    const funil = computeFunnel(
+      appointments,
+      // `orders` já vem filtrado à janela [startI, endI); passamos TODAS as não-canceladas
+      // (o filtro de status vira responsabilidade da util).
+      orders.map((o) => ({
+        appointmentId: (o as { appointmentId?: string | null }).appointmentId ?? null,
+        customerId: o.customerId,
+        status: o.status,
+        date: o.date,
+      })),
+      (d) => this.dayInTz(d, tz),
+      (d, n) => this.dayInTz(new Date(d.getTime() + n * 86400000), tz),
+    );
```

Notas de wiring:
- O `select` de `appointment` (linha 116) **já traz `id`, `customerId`, `status`, `start`** —
  nenhum ajuste de query necessário para os appointments.
- Enquanto **não** existir a coluna `order.appointmentId` no schema, o ramo FK fica inerte e o
  comportamento cai 100% na heurística — seguro de mergear antes da migração.
- `CONFIRMED_ONWARDS` passa a viver na util (exportada); pode-se remover a cópia local do
  service e importar de `./dashboard.util` para evitar duplicidade.

### 4.3 Migração para atingir H3 de verdade (dados nativos)

```diff
--- a/packages/db/prisma/schema.prisma
+++ b/packages/db/prisma/schema.prisma
@@ model Order {
   professionalId String?
+  // Vínculo agendamento -> comanda (H3). Null em comandas legadas importadas do Belasis.
+  appointmentId  String?
   status         OrderStatus @default(open)
@@
   @@index([companyId])
   @@index([companyId, date])
+  @@index([appointmentId])
 }
```
Popular `appointmentId` no fluxo "abrir comanda a partir do agendamento". A partir daí, dados
nativos reproduzem 29/29/29 corretamente e a heurística só serve ao acervo legado.

---

## 5. Ações sugeridas (ordem de prioridade)

1. **Criar `dashboard.util.ts`** com `computeFunnel` (§4.1) e cobrir com testes:
   (a) match por FK inclui comanda `open`; (b) match heurístico por dia +/- 1;
   (c) FK vence heurística; (d) comanda `canceled` nunca conta.
2. **Fiar no service** (§4.2) — resolve a definição e centraliza a lógica.
3. **Migração `order.appointmentId`** (§4.3) + popular no fluxo de comanda (paridade real).
4. **UI**: para empresas com dados legados (sem FK), rotular "Faturados" como estimativa
   (banner/tooltip), já que a heurística não garante os 100% do Belasis.

## 6. Ressalvas honestas

- Incluir `open` **não** move o número no dataset Belasis atual (toda comanda importada é
  `finished`). O ganho de `open` é para dados nativos futuros.
- A heurística `(cliente, dia +/- 1)` sobe a cobertura, mas **não** chega a 100% para dados
  importados — o export não carrega o vínculo agendamento↔comanda. Paridade fiel só com a FK.
- Não confundir "Faturado" (existência de comanda, H3) com "faturamento/receita" (dinheiro
  em comanda `finished`), que é outro widget (Vendas totais / Ticket médio).
