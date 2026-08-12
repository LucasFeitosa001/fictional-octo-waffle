# Plano executável — 3 pedidos do dono (comanda/agendamento/rascunho)

Verifiquei os arquivos em runtime de código (leitura direta). Duas correções ao mapeamento recebido, antes do plano:

- **`CustomerForm` NÃO usa o `ImageUpload` (z-[100])** — a foto é `<input type="file">` nativo + `useUploadImage` (`apps/web/src/pages/ClientePerfilTabs.tsx:193-210`). Idem `ServiceDrawer` (`apps/web/src/pages/ServicosPage.tsx:1320-1327`). Logo **não existe** a restrição de teto z-[100]; a faixa z-[95] continua sendo a escolha certa, mas por outro motivo (ficar abaixo do `ConfirmDialog` z-[9999]).
- **`CustomerCreated extends CustomerFull`** (`apps/web/src/lib/queries/clientes.ts:64`) → já tem `id/name/phone/avatarUrl`, é estruturalmente compatível com `PickedCustomer` (`apps/web/src/components/CustomerPickerDrawer.tsx:10-15`). Não precisa de adaptador.

---

## PEDIDO 1 — Criar cliente durante a comanda

**Estado atual: não atendido na comanda.** O `CustomerPickerDrawer` só seleciona. Mas o formulário completo já existe e já é reusado em 3 telas — não escrever formulário novo.

### 1.1 `CustomerForm` passa a devolver o cliente criado
`apps/web/src/pages/ClientePerfilTabs.tsx:138-147` — trocar a assinatura:
```ts
onDone: (created?: CustomerCreated) => void;
```
`apps/web/src/pages/ClientePerfilTabs.tsx:406-413` — hoje:
```ts
        await create.mutateAsync(body);      // retorno descartado
      }
      onDone();
```
para:
```ts
        const criado = await create.mutateAsync(body);
        onDone(criado);
        return;
      }
      onDone();
```
Não-destrutivo: os call sites atuais passam `onDone={onClose}` (ignora o argumento).

### 1.2 `CustomerCreateModal` ganha `onCreated` e `zClass`
`apps/web/src/pages/ClientePerfilTabs.tsx:2237-2245` — props:
```ts
export function CustomerCreateModal({ isOpen, onClose, onCreated, zClass }: {
  isOpen: boolean; onClose: () => void;
  onCreated?: (c: CustomerCreated) => void;
  zClass?: string;
})
```
`:2247-2252` — repassar `zClass={zClass}` ao `<Drawer>` (o `Drawer` já aceita, `apps/web/src/components/Drawer.tsx:24,54`).
`:2262` — `onDone={(c) => { if (c && onCreated) onCreated(c); onClose(); }}`.

### 1.3 Ponto de entrada dentro do picker compartilhado (resolve comanda + pacotes + IA de uma vez)
`apps/web/src/components/CustomerPickerDrawer.tsx:56-63` — nova prop opcional:
```ts
onCreateNew?: (nomeDigitado: string) => void;
```
Renderizar em **dois** lugares do mesmo arquivo:
- `:118-124` (empty state): quando `debounced` e `onCreateNew`, botão `+ Cadastrar "«debounced»"`; quando vazio, botão `+ Novo cliente`.
- `:112-116` (logo abaixo do input): link discreto `+ Novo cliente`, mesmo estilo do `NewAppointmentModal.tsx:948-950` (`text-xs font-medium text-gold-strong hover:underline`).

Quem não passar `onCreateNew` não muda de comportamento (`PacotesPage.tsx:1421`, `IAAtendimentoPage.tsx:1481` seguem iguais até serem ligados).

### 1.4 Ligar na comanda
`apps/web/src/pages/ComandasPage.tsx:1323` (bloco de states do `NovoComandaDrawer`) — adicionar:
```ts
const [novoClienteOpen, setNovoClienteOpen] = useState(false);
const [novoClienteNome, setNovoClienteNome] = useState('');
```
`:1331-1344` (reset no open) — zerar os dois junto com o resto.
`:1446-1450` — passar ao picker:
```tsx
onCreateNew={(nome) => { setNovoClienteNome(nome); setNovoClienteOpen(true); }}
```
Logo após `:1461` (depois do `EditItemDrawer`), montar:
```tsx
<CustomerCreateModal
  isOpen={novoClienteOpen}
  zClass="z-[95]"
  onClose={() => setNovoClienteOpen(false)}
  onCreated={(c) => {
    setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone, avatarUrl: c.avatarUrl });
    setNovoClienteOpen(false);
    setPickerOpen(false);   // volta direto para a comanda, com o cliente escolhido
  }}
/>
```
Import novo em `ComandasPage.tsx` (topo, junto de `CustomerPickerDrawer`): `import { CustomerCreateModal } from './ClientePerfilTabs';`.

**Pré-preencher o nome digitado:** `CustomerForm` não aceita valor inicial em `create`. Adicionar prop `initialName?: string` em `apps/web/src/pages/ClientePerfilTabs.tsx:138-147`, usar no `useState` de `name` (`:154`) e no reset por `mode`, e repassar por `CustomerCreateModal` (`:2262`). É opcional — se ficar caro, cortar do escopo 1 e deixar o campo vazio; não bloqueia o fluxo.

**Aviso multi-tenant:** nada aqui grava preferência; `useCreateCustomer` já é escopado por empresa pelo backend. Sem risco de vazamento entre salões.

---

## PEDIDO 2 — Criar serviço durante o agendamento

**Este pedido está PARCIALMENTE atendido — e o que falta não é o que parece.**

Já existe:
- `ServiceDrawer` reutilizável e **já montado fora da página de Serviços** (`apps/web/src/layout/CreateDrawer.tsx:117-122`), com `FullDrawer` z-[80] > agendamento z-[70]. Não precisa criar drawer nem formulário.
- Detecção e mensagem do caso "profissional não executa este serviço": backend `apps/api/src/modules/appointments/appointments.service.ts:1514-1520` + texto `:72`, renderizado em `apps/web/src/components/NewAppointmentModal.tsx:1085-1094`.
- Criação inline de cliente no mesmo modal (`NewAppointmentModal.tsx:939-952`), padrão visual a copiar.

Falta de verdade, em ordem de valor:

### 2.A (mais valioso) Botão "Vincular a «profissional»" na caixa amarela — o serviço já existe, falta o vínculo
`apps/web/src/components/NewAppointmentModal.tsx:1089-1094` — dentro do `motivo === 'profissional_nao_vinculado'`, abaixo da frase, inserir botão que:
1. lê os vínculos atuais de `profissionalDoHorario.data?.services` — o hook **já está montado** em `NewAppointmentModal.tsx:306` (`useProfessionalDetail(primary.professionalId)`), hoje só o `.schedules` é lido (`:307`);
2. chama `useSetProfessionalServices()` (`apps/web/src/lib/queries/profissionais.ts:88-98`) com a **UNIÃO**:
```ts
const atuais = (profissionalDoHorario.data?.services ?? []).map((s) => s.serviceId);
await setServices.mutateAsync({ id: primary.professionalId, serviceIds: [...new Set([...atuais, primary.serviceId])] });
qc.invalidateQueries({ queryKey: ['availability'] });
```
**Armadilha obrigatória:** `apps/api/src/modules/professionals/professionals.service.ts:99-106` faz `deleteMany` + `createMany` (substituição total). Mandar só `[novoId]` **apaga todos os vínculos** da profissional. A união não é opcional.
**Guarda:** se `profissionalDoHorario.isLoading` ou `data?.services === undefined`, **desabilitar o botão** — disparar o PUT sem a lista atual carregada é o cenário exato que zera os vínculos.
**Invalidação:** `useSetProfessionalServices` invalida `['professionals']` e `['professional', id]`, **não** `['availability', …]` (`apps/web/src/lib/queries.ts:294`). Sem o `invalidateQueries(['availability'])` acima, a caixa amarela continua na tela depois de vincular.
**Permissão:** `PUT /professionals/:id/services` exige `equipe:manage` (`apps/api/src/modules/professionals/professionals.controller.ts:92-93`). Condicionar com `useCan()` (`apps/web/src/lib/queries/permissions.ts:57-71`): `const { can } = useCan(); can('equipe:manage')`. Sem a permissão, esconder o botão e manter só a frase atual.

### 2.B Botão "+ Novo serviço" abaixo do select de serviço
`apps/web/src/components/NewAppointmentModal.tsx:1031-1032` — entre `</Select>` e `</Field>`:
```tsx
{can('catalogo:manage') && (
  <button type="button" onClick={() => { setServicoNovoParaItem(idx); setServiceDrawerOpen(true); }}
    className="self-start text-xs font-medium text-gold-strong hover:underline">
    + Novo serviço
  </button>
)}
```
`POST /services` exige `catalogo:manage` (`apps/api/src/modules/services/services.controller.ts:57-58`) — permissão **diferente** de `equipe:manage`. Quem cria pode não poder vincular; por isso 2.A e 2.B são gatilhos separados, não um botão só.

### 2.C `ServiceDrawer` devolver o serviço criado
`apps/web/src/pages/ServicosPage.tsx:1286-1298` — adicionar `onCreated?: (s: ServiceRow) => void`.
`apps/web/src/pages/ServicosPage.tsx:1448-1453`:
```ts
      } else {
        const criado = await create.mutateAsync(body);
        onCreated?.(criado);
      }
      onClose();
```
`useCreateService` já tipa o retorno (`apps/web/src/lib/queries.ts:75`) e já invalida `['services']`, então o `Select` do item (`NewAppointmentModal.tsx:313,1024`) se repovoa sozinho.

### 2.D Montar o `ServiceDrawer` dentro do `NewAppointmentModal`
Depois do `</Drawer>` interno do modal — ou como irmão, já que é portal (`apps/web/src/components/FullDrawer.tsx:175`):
```tsx
<ServiceDrawer
  mode="create"
  isOpen={serviceDrawerOpen}
  categories={productCategoryOptions}
  onClose={() => setServiceDrawerOpen(false)}
  onCreated={async (s) => {
    pickService(servicoNovoParaItem, s.id);          // NewAppointmentModal.tsx:322-325
    const profId = items[servicoNovoParaItem]?.professionalId;
    if (profId && can('equipe:manage')) { /* mesmo PUT de união do 2.A */ }
  }}
/>
```
**Categorias:** o `ServiceDrawer` exige `categoryId` para salvar (`ServicosPage.tsx:1416-1422`) e a fonte real é `useProductCategories()` (`apps/web/src/lib/queries/catalogo.ts:251`; `ServicosPage.tsx:173`) — **não** `useServiceCategories()` (`lib/queries.ts:64`, endpoint diferente, não usado pela tela). Copiar o mapeamento pronto de `apps/web/src/layout/CreateDrawer.tsx:96-102`.
**Desktop:** o `ServiceDrawer` deliberadamente não passa `widthClass` (`ServicosPage.tsx:1475-1478`) → cobre a tela inteira por cima do agendamento. Aceitável e coerente com o "Novo" global; se o dono reclamar, expor `widthClass?` na assinatura de `ServiceDrawer` e passar `sm:w-[720px]`.
**Bug de scroll que vem junto:** ver item 4.3 — fechar o `ServiceDrawer` destrava o scroll do body com o agendamento ainda aberto. Corrigir no 4.3 antes de entregar o 2.

### O que NÃO fazer aqui
Não filtrar a lista de serviços por profissional. Hoje `useServices()` não aceita `professionalId` (`apps/web/src/lib/queries.ts:56-62`) e a lista cheia é o que permite descobrir o vínculo faltante e criá-lo. Filtrar esconderia o problema em vez de resolver.

---

## PEDIDO 3 — "Salvar como rascunho": o dono está apontando para OUTRA perda

**Diagnóstico.** `open` **já é o rascunho**: `packages/db/prisma/schema.prisma:1267` (`status @default(open)`), o botão **Salvar** de `apps/web/src/pages/ComandasPage.tsx:1436-1438` grava a comanda sem faturar, e comanda vinda da agenda nasce persistida no clique (`AgendaPage.tsx:777`, `NewAppointmentModal.tsx:698-702`) com toda edição posterior indo direto ao servidor (`components/ComandaDrawer.tsx:234,252,650,737,948`).

**A perda real é o drawer "Nova comanda" antes do primeiro Salvar** (`ComandasPage.tsx:1270-1279` `StagedItem[]` em memória; reset total em `:1331-1344`). Fechar é trivial demais e **sem nenhum aviso**:
- `Cancelar` (`ComandasPage.tsx:1433`);
- **`Ajuda` também chama `onClose` — clicar em "Ajuda" apaga a comanda inteira** (`ComandasPage.tsx:1429-1432`). Isso é bug, não feature;
- ESC (`components/Drawer.tsx:105-113`) e clique no backdrop (`components/Drawer.tsx:126-127`), ambos sem checagem de sujeira.

**Não criar status novo.** Justificativa concreta, não estilística:
1. `apps/api/src/modules/orders/dto.ts:32-35` — `UpdateOrderDto` só aceita `status` e `notes`, e `orders.service.ts:2238-2242` **recusa** troca de status pelo PATCH. `customerId`, `professionalId` e `date` são **write-once no create**, e `useUpdateOrder` (`apps/web/src/lib/queries.ts:423`) é código morto. Persistir cedo deixaria o rascunho com cabeçalho congelado → inutilizável sem estender o PATCH e a UI.
2. `orders.service.ts:259-261,378-386` consome número sequencial sob advisory lock. Rascunho abandonado **queima número de comanda** e entra na lista/relatórios como "Aberta" (`orders.service.ts:24-41` lista todos os status; `ComandasPage.tsx:420` chama `useOrders()` sem filtro).
3. Um 4º valor no enum obriga migração + revisão de todo filtro/relatório que hoje lê `open` = "em aberto" (`packages/shared/src/enums.ts:15-19,61-65`).

### 3.1 Guard de fechamento (obrigatório, resolve 80% da dor)
Em `apps/web/src/pages/ComandasPage.tsx`, dentro do `NovoComandaDrawer`:
```ts
const sujo = Boolean(selectedCustomer || selectedProfessionalId || notes.trim() || items.length);
const confirm = useConfirm();            // components/ConfirmDialog.tsx:17
async function tentarFechar() {
  if (!sujo) return onClose();
  const ok = await confirm({
    title: 'Descartar esta comanda?',
    message: 'Os itens e o cliente que você preencheu ainda não foram salvos.',
    confirmLabel: 'Descartar', cancelLabel: 'Continuar preenchendo', danger: true,
  });
  if (ok) onClose();
}
```
Trocar `onClose` por `tentarFechar` em `:1422` (prop do `Drawer`, cobre ESC e backdrop) e `:1433` (Cancelar).
`ConfirmDialog` é z-[9999] (`components/ConfirmDialog.tsx:57`) → aparece por cima de tudo, sem conflito com a pilha.

### 3.2 Corrigir o "Ajuda" (bug isolado)
`apps/web/src/pages/ComandasPage.tsx:1429-1432` — o botão Ajuda **não pode** fechar o drawer. Ou abre um `IconTip`/painel de ajuda, ou some. Enquanto não existir conteúdo de ajuda, remover o botão é a correção honesta.

### 3.3 Autosave local do rascunho (o "salvar rascunho" que o dono descreveu: "preenchendo e depois sai")
Novo arquivo `apps/web/src/lib/rascunhoComanda.ts`:
- `chave = 'sp:rascunho-comanda:' + companyId` — **escopo por empresa obrigatório** (mesmo padrão de `apps/web/src/lib/queries/notificacoes.ts:291-292,301`, via `useMinhasContas()` → `contas.find(c => c.active)?.companyId`). Sem isso o rascunho de um salão aparece no outro na troca de tenant.
- `salvar(estado)` com debounce 500ms; `ler()`; `limpar()`; descartar rascunho com mais de 24h (`savedAt`).
Em `ComandasPage.tsx:1331-1344` (efeito de reset): ao abrir, se houver rascunho da empresa ativa, **não zerar** — mostrar uma faixa no topo do corpo do drawer: *"Você tinha uma comanda em preenchimento (há X). [Retomar] [Começar do zero]"*. `Começar do zero` chama `limpar()` e o reset atual.
Gravar em `useEffect` sobre `[selectedCustomer, selectedProfessionalId, date, notes, items]`; `limpar()` no sucesso de `handleSave` (`ComandasPage.tsx:1400-1404`, logo antes do `onCreated`).
**Anti-decorativo:** só entrega valor se o *Retomar* de fato repopular `items`/`selectedCustomer` — o critério de aceite é fechar o drawer com 3 itens, reabrir e ver os 3 itens.

### 3.4 Mesmo tratamento no `NewAppointmentModal` (segunda maior perda, já documentada no código)
`apps/web/src/components/NewAppointmentModal.tsx:336-390` — o comentário em `:382-390` registra que essa perda **já aconteceu com o dono**. Aplicar 3.1 (guard de fechamento) usando `onOpenChange(false)` como saída; o autosave (3.3) é opcional aqui, o guard não é.

---

## 4 — Empilhamento de drawers: o que já funciona e o que precisa mudar

**Funciona hoje:** portal para `document.body` (`components/Drawer.tsx:122`), `zClass` por instância (`:24,54,123`), e 4 pilhas de 2 níveis já em produção (`ComandasPage.tsx:1445-1461`, `ComandaDrawer.tsx:313-339`, `PacotesPage.tsx:1418-1430`, `AppointmentConfirmationDrawer.tsx:409`). Escala em uso: Drawer 70 → FullDrawer 80 (fixo) → sub-drawers 90 → confirmação 95 → ConfirmDialog 9999.

Quatro correções, todas em `Drawer.tsx`/`FullDrawer.tsx` (valem para os 3 pedidos):

**4.1 ESC fecha a pilha inteira — bug latente HOJE.** `components/Drawer.tsx:105-113` registra `keydown` no `document` por instância, sem saber se é o topo; `components/FullDrawer.tsx:167-171` faz o mesmo no `window`. Hoje um ESC no `CustomerPickerDrawer` fecha **a comanda junto**, perdendo os itens staged. Com 3 níveis (comanda → picker → novo cliente) fica pior.
Criar `apps/web/src/components/drawerStack.ts`:
```ts
const pilha: string[] = [];
export function pushDrawer(id: string) { pilha.push(id); }
export function popDrawer(id: string) { const i = pilha.lastIndexOf(id); if (i >= 0) pilha.splice(i, 1); }
export function isTopDrawer(id: string) { return pilha[pilha.length - 1] === id; }
```
`Drawer.tsx:105-113` e `FullDrawer.tsx:167-171`: `if (e.key === 'Escape' && isTopDrawer(id)) { e.stopPropagation(); onClose(); }`, com `id = useId()` e push/pop no mesmo efeito de `mounted`.

**4.2 Scroll lock por contagem.** `components/Drawer.tsx:96-103` guarda/restaura o valor anterior — funciona empilhado só se o de fora desmontar depois do de dentro. Trocar por refcount no mesmo módulo `drawerStack.ts` (`lockScroll()`/`unlockScroll()`, `hidden` enquanto contador > 0).

**4.3 `FullDrawer` zera o overflow do body (bug real do pedido 2).** `components/FullDrawer.tsx:149,157,161` faz `document.body.style.overflow = ''` no fechamento — não restaura o valor anterior. Fechar o `ServiceDrawer` por cima do agendamento **destrava o scroll do body com o agendamento aberto**. Corrigir junto com 4.2 (mesmo refcount).

**4.4 `FullDrawer` tem z fixo `z-[80]`** (`components/FullDrawer.tsx:176`), sem prop. Para o pedido 2 (agendamento z-70 → serviço z-80) está correto e **não precisa mudar**. Mas se algum dia o `ServiceDrawer` for aberto de dentro de um sub-drawer z-90, ele nasce **atrás**. Adicionar `zClass?: string` com default `'z-[80]'` é 2 linhas e evita a próxima armadilha — faça junto, mas não é bloqueante.

**4.5 Foco.** `components/Drawer.tsx:116-118` foca o painel ao abrir, mas **não devolve o foco** ao fechar — depois de fechar o "Novo cliente" o foco volta para o `<body>` e o próximo ESC/Tab fica órfão. Guardar `document.activeElement` antes do focus e restaurar no cleanup. Não há focus trap em nenhum drawer (Tab escapa para a página de trás); fora do escopo destes 3 pedidos, registrar como dívida.

**Mobile:** nada a fazer. `Drawer` (`:60-61`) e `FullDrawer` (`:193-196`) já viram bottom-sheet em `<md` — a regra do projeto está satisfeita pelos componentes existentes, desde que ninguém introduza um drawer novo. Este plano não introduz nenhum.

---

## 5 — Ordem de execução e riscos

**Lote 0 — infraestrutura de pilha (pré-requisito dos outros dois lotes).** 4.1 + 4.2 + 4.3 (+4.4 opcional). Arquivos: `components/drawerStack.ts` (novo), `components/Drawer.tsx:96-118`, `components/FullDrawer.tsx:140-172`.
*Risco:* mexe em **todo** drawer do painel. Regressão possível: body travado sem drawer aberto (refcount desbalanceado). Teste manual: abrir/fechar comanda, picker, ServiceDrawer via "Novo", e um `LancamentoModal` (mount-controlled, `CreateDrawer.tsx:144-145`) — este último desmonta em vez de fechar, é o caso que quebra refcount ingênuo.

**Lote 1 — pedido 3 (rascunho), partes 3.1 e 3.2.** Menor superfície, maior alívio imediato, e protege o teste dos lotes seguintes (sem o guard, cada ESC durante o teste do pedido 1 apaga a comanda). Arquivos: `pages/ComandasPage.tsx:1422,1429-1433`.
*Risco:* baixo. Cuidado com `sujo` disparando confirm em drawer intocado (checar `items.length` e trim).

**Lote 2 — pedido 1 (cliente na comanda).** 1.1 → 1.2 → 1.3 → 1.4. Arquivos: `pages/ClientePerfilTabs.tsx:138-147,406-413,2237-2265`, `components/CustomerPickerDrawer.tsx:56-124`, `pages/ComandasPage.tsx:1323,1331-1344,1446-1450,+1462`.
*Risco:* `ClientePerfilTabs.tsx` é o arquivo mais reusado do painel (`ClientesPage.tsx:892`, `layout/CreateDrawer.tsx:111`). As 3 mudanças são aditivas com default opcional — rodar `tsc` e abrir os 3 call sites. Import cruzado `ComandasPage → ClientePerfilTabs`: conferir se não cria ciclo (hoje `ClientePerfilTabs.tsx:2861-2891` cria comanda mas por `api.post` direto, não importa `ComandasPage` — não há ciclo, mas revalide após editar).

**Lote 3 — pedido 2 (serviço no agendamento).** 2.C → 2.A → 2.B/2.D. Entregar 2.A **primeiro e sozinho** se o tempo apertar: é o cenário frequente (serviço existe, falta vínculo) e cabe em uma tela.
*Riscos, em ordem de gravidade:*
1. **Apagar todos os vínculos da profissional** se o PUT for disparado sem a lista atual (`professionals.service.ts:99-106` é substituição total). Mitigação: botão desabilitado enquanto `useProfessionalDetail` não resolveu. Este é o único risco de perda de dado do plano inteiro.
2. **403 no meio do fluxo:** `catalogo:manage` cria o serviço, `equipe:manage` vincula. Sem gating por `useCan()`, a pessoa cria o serviço e leva erro no vínculo — pior que não oferecer. Gating é obrigatório, não polimento.
3. Caixa amarela persistir após vincular se faltar `invalidateQueries(['availability'])`.

**Lote 4 — 3.3 (autosave) e 3.4 (guard no agendamento).** Último porque é o de maior superfície e o único que ganha estado persistido. *Risco multi-tenant:* chave sem `companyId` vaza rascunho entre salões — regra do projeto, não detalhe.

**Fora do escopo, registrar como dívida:** `VerComandaDrawer` (`pages/ComandasPage.tsx:1840`, ~460 linhas) não é importado em lugar nenhum e duplica `components/ComandaDrawer.tsx`. Ao editar a página, **não manter os dois** — apagar em commit separado, antes do Lote 2, para não revisar código morto.