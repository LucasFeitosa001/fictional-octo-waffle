# Criar e editar cliente — colar telefone, apagar campo, achar pelo telefone, data de nascimento

Área do laudo 139, seção "Criar e editar cliente". Seis achados, todos com o
caminho de dor já confirmado lá. Este estudo lista o que vou tocar e a evidência
que sustenta cada mudança.

## Arquivos que vou editar

- /home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/PhoneField.tsx
- /home/lucssfeitosa/beautypass/beautypass/apps/web/src/components/DatePicker.tsx
- /home/lucssfeitosa/beautypass/beautypass/apps/web/src/pages/ClientePerfilTabs.tsx
- /home/lucssfeitosa/beautypass/beautypass/apps/web/src/lib/queries/clientes.ts
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/customers/dto-helpers.ts
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/customers/dto.ts
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/customers/customers.service.ts
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/customers-dto.usecases.test.ts
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/customers-cadastro.usecases.test.ts (novo)
- /home/lucssfeitosa/beautypass/beautypass/apps/api/src/modules/usecase-tests/run-usecases.ts (só a linha de import do teste novo)

NÃO vou tocar em NewAppointmentModal.tsx (outra pessoa está nele). O PhoneField
é compartilhado, então a correção chega lá sozinha.

---

## 1. [ALTO] Colar "+55 11 99999-9999" grava 15 dígitos e o campo mostra outro número

**Evidência**

- PhoneField.tsx:102-105 — `emitir()` faz `onChange(`${p.código}${digitos}`)` com
  TODOS os dígitos do que foi colado. Colando "+55 11 99999-9999" o campo
  nacional recebe 13 dígitos e o valor gravado vira `"55" + "5511999999999"` =
  `555511999999999` (15).
- PhoneField.tsx:40-50 — `mascarar()` corta só a EXIBIÇÃO em 11 (`d = digitos.slice(0, 11)`),
  então tela e valor divergem.
- PhoneField.tsx:57-80 — na volta, `separarTelefone("555511999999999")` falha a
  regra 1 (resto de 13 não está em `[10,11]`), falha a regra 2 (`length <= 13`) e
  cai na regra 3 (Brasil + tudo) → a máscara imprime `(55) 55119-9999`.
- apps/api/src/modules/customers/dto-helpers.ts:41-43 — o backend só recusa acima
  de 15; exatamente 15 passa. dto.ts:49 tem `@MaxLength(15)`.

**Regressão que NÃO pode voltar** (comentário em PhoneField.tsx:68-74 e estudo 125):
o bug do "5555555" — enquanto o número é DIGITADO, o valor é `55` + dígitos
parciais e o `55` do DDI aparecia como DDD. A regra 2 do `separarTelefone`
existe por causa disso. Também não posso arrancar DDI cegamente: **DDD 55
existe** (Santa Maria/RS), então `55999998888` (11 dígitos) é número nacional
legítimo e não pode perder o "55".

**Correção:** interpretar a ENTRADA (não só concatenar). Um dígito de DDI só é
removido quando o tamanho total NÃO é um tamanho nacional válido do país atual e
o resto DEPOIS do DDI é válido — aí não há ambiguidade. Com `+` colado, a
detecção de país roda primeiro (é sinal explícito), então `+1 918 238 4714` troca
a bandeira para EUA em vez de virar número brasileiro. E o valor emitido passa a
respeitar o mesmo teto da máscara (`max(pais.digitos)`), para tela e valor nunca
mais discordarem.

## 2. [ALTO] Não existe como APAGAR telefone/e-mail/CPF/aniversário/endereço/observações

**Evidência**

- ClientePerfilTabs.tsx:345-387 — `handleSave` monta `campo.trim() || undefined`
  em 16 campos (phone :351, birthday :354, observations :386). `JSON.stringify`
  (packages/shared/src/api-client.ts:90) OMITE a chave.
- customers.service.ts:145-150 — `...rest` no `update`: `undefined` é "não mexa"
  no Prisma. O campo volta preenchido e queries/clientes.ts:200 dá o toast verde
  "Cliente salvo".
- dto-helpers.ts:30 — mandar `null` também não resolve hoje: o `@Transform`
  (dto.ts:98) roda ANTES da validação e `normalizarTelefone(null)` devolve
  `undefined` na primeira linha. Vale para phone/secondaryPhone/cpf/cnpj/cep.
- customers.service.ts:150 — `birthday` JÁ tem o caminho de apagar
  (`birthday ? new Date(...) : null`); o front é que nunca manda.

**Correção:** o contrato do PATCH passa a ser explícito nas três camadas —
ausente = não mexa, `null` = apague, texto = grave. `null` atravessa os
normalizadores (hoje ele é engolido), os campos apagáveis do DTO aceitam
`string | null`, e o formulário manda `null` no modo edição quando o campo ficou
vazio. `''` continua significando "não informado" (é o que os importadores e o
SalonPay mandam hoje) — só `null` apaga.

O teste customers-dto.usecases.test.ts:57-60 afirma o contrato ANTIGO
(`normalizarTelefone(null) === undefined`); ele muda junto, com o porquê escrito.

## 3. [ALTO] A busca só olha o NOME; criar não avisa de duplicata

**Evidência**

- customers.service.ts:40 — `...(search ? { name: { contains: search } } : {})`.
  Telefone, e-mail e documento não entram.
- customers.service.ts:105-140 — `create` vai direto no `customer.create`, sem
  nenhum `findFirst`. schema.prisma (model Customer) não tem `@unique` em phone,
  email nem cpf — só `[companyId,userId]` e `[companyId,legacyId]`.
- O laudo confirmou na base: 'Adriana Araújo'/'Mãe Adriana' com o mesmo
  89994008076, e 'Scheila'/'Sheila' com o MESMO número em formatos DIFERENTES
  ('(89) 98129-1426' vs '89981291426'). Por isso comparação por igualdade de
  string não serve: tem que ser por dígitos.

**Correção:** a busca ganha nome + apelido + e-mail + (telefone/2º telefone/CPF/
CNPJ comparados **por dígitos**, via `regexp_replace` no Postgres, que é a única
forma de casar os dois formatos gravados). O `create` procura o mesmo telefone
(por dígitos) antes de gravar e, se achar, **cria assim mesmo** e devolve
`avisoDuplicidade` — o dono ainda não decidiu bloquear, e avisar já resolve o
caso da atendente. O aviso vira um toast amarelo no `useCreateCustomer`, então
aparece também na criação em linha do agendamento sem eu tocar naquele arquivo.

Cuidado de teste: os fixtures de `usecase-tests` montam um Prisma falso sem
`$queryRaw` (customers-dto.usecases.test.ts:195-207). A consulta por dígitos é
guardada por `typeof ... === 'function'`, como commissions.service.ts:516 já faz.

## 4. [ALTO] Data de nascimento exige ~490 cliques na seta

**Evidência**

- DatePicker.tsx:294-296 — sem valor, `viewMonth` começa no mês atual.
- DatePicker.tsx:185-221 — o cabeçalho só tem "Mês anterior"/"Próximo mês"; o
  título é um `<div>` (:201-210), não um controle.
- DatePicker.tsx:655-694 — o gatilho é um `<button>`; não existe input para
  digitar a data.
- Uso em ClientePerfilTabs.tsx:484-486 (campo Aniversário).

**Correção:** o título vira dois seletores (Mês e Ano) no mesmo lugar. É o menor
acréscimo que resolve 1985 em dois toques e **não muda em nada** o uso normal: as
setas continuam, a grade continua, e escolher um dia perto de hoje segue sendo um
clique. Vale para o modo range (filtros) também, que usa o mesmo `Calendar`.

## 5. [MEDIO] Aniversário aparece um dia antes

**Evidência**

- customers.service.ts:112 — `new Date(birthday)`. Com "1990-05-10" (data pura)
  o resultado é meia-noite UTC, que é a convenção do produto
  (format.ts:84-96, `toDateInput` lê em UTC de propósito). Mas com um ISO COM
  hora e sem fuso ("1990-05-10T00:00:00") o Node interpreta em horário do
  SERVIDOR — num container a leste de Greenwich isso grava 09/05.
- A parte que o usuário vê (09/05 na lista) é format.ts:16-21 (`formatDate` sem
  timeZone), arquivo de OUTRA pessoa nesta rodada.

**Correção:** só a metade que é minha — gravar aniversário sempre como
meia-noite UTC, explicitamente, para o valor no banco não depender do fuso do
container. A correção do `formatDate` fica em pendências.

## 6. [MEDIO] O "Salvar" do cadastro fica no fim de uma rolagem longa

**Evidência**

- ClientePerfilTabs.tsx:806-820 — Cancelar/Salvar soltos no fim do corpo.
- ClientePerfilTabs.tsx:2205-2231 (CustomerCreateModal) e :2871-2878
  (ClientePerfilModal) — nenhum passa a prop `footer` do Drawer.
- Drawer.tsx:13-16 e :216-224 — a prop existe e vira uma faixa `sticky bottom-0`.

**Correção:** a barra de ações do formulário passa a ser `sticky bottom-0` dentro
do corpo do Drawer, com a MESMA aparência do rodapé do Drawer (borda em cima,
fundo warm-white, respiro do safe-area). Não uso a prop `footer` porque quem tem
o estado (`canSave`, `pending`, `handleSave`) é o `CustomerForm`, e passar dois
botões para o Drawer exigiria içar o estado do formulário inteiro para os dois
chamadores — refatoração grande num achado de ergonomia. O efeito na tela é o
mesmo: botão sempre visível, no celular e no desktop.
