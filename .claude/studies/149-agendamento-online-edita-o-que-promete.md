/**/
# Estudo 149 — Agendamento Online promete editar logo e foto, e não edita

Dois relatos do dono, na mesma tela (`Marketing → Agendamento Online`):

> "não tá dando pra botar a logo da empresa no agendamento online"

> "pra colocar fotos pros serviços, tá tendo uma aba Biblioteca de fotos. Mas já
> tem como adicionar fotos na aba de serviços? Verifique. E unifique."

São o mesmo defeito em dois lugares: a tela **descreve** o que edita e não
oferece o campo.

## Arquivos tocados

- `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx`

## O que a tela promete

`AgendamentoOnlinePage.tsx:67` (seção "Dados da empresa"):

> "Defina a **logo**, o endereço, a descrição e as redes sociais do seu
> estabelecimento."

`:91-95` (seção "Serviços"):

> "Selecione quais serviços podem ser agendados com seus respectivos tempos,
> valores, descrições, **fotos** e profissionais."

## O que ela faz hoje

**Logo** — `:731-741` apenas EXIBE `empresa.data?.logoUrl` num `<img>`; quando
não há logo, mostra um ícone de casa. Não existe upload na seção. O campo real
vive em `ConfiguracoesPage.tsx:1540-1556`, noutra área do menu. Quem entra em
Agendamento Online para montar a página pública não encontra e não tem como
adivinhar.

Há upload de **CAPA** ali perto (`:938-945`, `coverUrl`), o que reforça a
confusão: existe um `ImageUpload` na tela, só que para outra imagem.

**Serviços** — `:1152-1164` renderiza cada serviço como um `Switch` de
"disponível online" e nada mais. Nenhuma foto, nem para ver nem para trocar. O
único caminho é o botão "Gerenciar serviços" (`:1166-1170`), que leva para
`/servicos`.

## Sobre "unifique" — o que NÃO fiz, e por quê

A "Galeria de fotos" (`:85-89`) parecia duplicar a foto do serviço. Não duplica:
`GalleryPhoto` (`lib/queries/agendamento-online.ts:112-119`) tem só `url`,
`caption` e `displayOrder` — são fotos DO SALÃO, exibidas na primeira etapa do
agendamento (`web-club/BookingPage.tsx:1225`), sem vínculo com serviço nenhum.

Fundir as duas custaria a vitrine do salão ou encheria a galeria de fotos de
serviço. O dono confirmou o caminho (a): manter a Galeria como vitrine e trazer
a foto do serviço para a aba Serviços.

## A correção

Os dois campos passam a existir na tela, reusando o dado que JÁ EXISTE — nenhum
campo novo no schema, nenhuma foto duplicada:

- **Logo**: `ImageUpload` com `kind="logo"` gravando em `Company.logoUrl` via
  `useUpdateEmpresa` (`lib/queries/empresa.ts:54`), o mesmo par que
  Configurações usa. Editar num lugar reflete no outro porque é a mesma coluna.
- **Foto do serviço**: `ImageUpload` com `kind="service"` gravando em
  `Service.imageUrl` via a mesma mutation do cadastro. A lista da aba passa a
  mostrar a foto atual ao lado do switch.

Persistência imediata no upload, como Configurações já faz
(`ConfiguracoesPage.tsx:1544-1549`): sem isso, quem envia a imagem e sai da tela
sem salvar deixa o arquivo órfão e perde a foto.
