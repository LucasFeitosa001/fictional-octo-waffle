# Estudo 57 — Telefone com seletor de país, e excluir agendamento pelo próprio agendamento

Dois pedidos do dono:

> *"No cadastro de profissional ou cliente tem que ficar botando +55. Bote um seletor de países com
> o Brasil sendo padrão com o +55, ao invés de ficar me pedindo pra selecionar."*
>
> *"Só dá pra cancelar agendamento, não tá dando pra excluir."*

## 57.1 — Hoje o DDI é digitado na unha

Os campos de telefone são `TextField` puros, sem máscara e sem país:

- `apps/web/src/pages/ProfissionaisPage.tsx:1073`-`:1076` — "Celular" obrigatório,
  `placeholder="(00) 00000-0000"`;
- `apps/web/src/pages/ClientePerfilTabs.tsx:462`-`:474` — "Celular" com
  `placeholder="+55 (11) 99999-9999"` e "Telefone" com `placeholder="+1 (918) 238-4714"`;
- `apps/web/src/components/NewAppointmentModal.tsx:742` — o cliente novo criado ali dentro.

O valor vai cru para a API. Quem depende dele é o WhatsApp — e lá o número **precisa** do DDI. Os
placeholders são contraditórios (um pede +55, o outro sugere +1, o terceiro não pede DDI nenhum), o
que explica o dado bagunçado que aparece na base da Fátima: `5589999840091` (com DDI) convivendo
com `89981312500` (sem).

`formatPhone` (`apps/web/src/lib/format.ts:77`-`:100`) já lê os dois formatos na EXIBIÇÃO — só a
entrada é que não ajuda ninguém.

**Correção:** um componente `PhoneField` com seletor de país (Brasil padrão, +55) + campo nacional
com máscara. O valor emitido é sempre `DDI + número` só com dígitos (ex.: `5589999387007`), que é o
que o WhatsApp espera. Ao editar um cadastro antigo, o componente reconhece o DDI que já estiver lá
e, na falta dele, assume Brasil.

## 57.2 — Excluir agendamento só existe no lote

O drawer "Visualizando agendamento" tem, no menu "Outros" (`apps/web/src/pages/AgendaPage.tsx`,
rodapé do drawer): **Reagendar · Sugerir horário · Cancelar agendamento**. Não há "Excluir".

Excluir de verdade só acontece pela seleção múltipla da agenda
(`AgendaPage.tsx:378`, `api.delete('/appointments/:id')` em `Promise.all`) — caminho que quase
ninguém percorre para um agendamento só.

O backend tem a rota (`DELETE /appointments/:id`) e ela agora recusa com 409 quando existe comanda
viva (estudo 56).

**Correção:** "Excluir agendamento" entra no menu "Outros", em vermelho, com confirmação que avisa
ser definitivo — e mostrando a mensagem REAL da API quando ela recusar (o 409 explica que existe
comanda).

## Arquivos tocados

- `apps/web/src/components/PhoneField.tsx` (novo)
- `apps/web/src/pages/ProfissionaisPage.tsx`
- `apps/web/src/pages/ClientePerfilTabs.tsx`
- `apps/web/src/components/NewAppointmentModal.tsx`
- `apps/web/src/pages/AgendaPage.tsx`
