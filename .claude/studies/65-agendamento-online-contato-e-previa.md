# Estudo 65 — Agendamento online: telefone/e-mail não editáveis e prévia cortada

Relato do dono, na tela Marketing → Agendamento online → **Detalhes da empresa**:

> *"não consigo digitar e-mail e telefone e arrume o tamanho da tela para eu ver todo o local"*
> *"verifica para mim se todo fluxo de agendamento online funciona"*

## 65.1 — Telefone e e-mail são TEXTO, não campo

`apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx`:

- `:591` — `const address = empresa.data?.addressJson ?? null;`
- `:652` — endereço em `<p>`: `{address?.address || 'Endereço não informado'}`
- `:656`-`:664` — telefone e e-mail dentro de um `<dl>`, como `<dd>`:
  `{address?.phone || '—'}` e `{address?.email || '—'}`.

São **rótulos de leitura**. Não há input, então não há como digitar — exatamente o relato. Os três
campos vivem em `Company.addressJson` (`apps/web/src/lib/queries/empresa.ts:4`-`:16`) e só são
editáveis em outra tela (Configurações → Detalhes), via `PATCH /companies/current`
(`empresa.ts:52`-`:57`).

Detalhe que explica a confusão: nesta MESMA aba, descrição/site/Instagram/Facebook **são** editáveis,
porque pertencem a outro backend (o perfil da página pública, `DETALHES_FIELDS` em `:487`, salvo por
`saveProfileSection` em `:504`). Ou seja: metade da aba salva, metade só mostra.

**Correção:** telefone, e-mail e endereço viram campos de verdade na aba, com rascunho local, e o
"Salvar" da seção passa a gravar as duas coisas — o perfil da página (como já fazia) e o
`addressJson` da empresa. O botão só habilita quando algo mudou, incluindo os campos novos.

## 65.2 — A prévia do celular corta a página

`:149`-`:160` (`PhonePreview`): moldura fixa de `w-[300px]` e, dentro, um `<iframe class="h-full
w-full">`. O iframe recebe ~278px de largura útil, e a página pública é desenhada para telefone real
(~390px): o conteúdo não cabe, aparece barra de rolagem horizontal e o lado direito some — os botões
"Selecionar" e o filtro ficam cortados, como na captura que o dono mandou.

**Correção:** renderizar o iframe no tamanho de um telefone de verdade (390×823) e **escalar** para
caber na moldura (`transform: scale`), com a moldura um pouco maior. Assim a página é renderizada
como no celular e aparece inteira, sem corte e sem rolagem lateral.

## 65.3 — Fluxo público, ponta a ponta

Verificação em produção na página do DesignModa (`agenda.salonpass.com.br/designmoda`), passo a
passo: serviços → profissional → data/hora → identificação → confirmação, coletando erros de
console e respostas 4xx/5xx da API. Resultado registrado abaixo, com capturas em
`belasis-reference/_out/` (scratchpad da sessão).

## Arquivos

- `apps/web/src/pages/marketing/AgendamentoOnlinePage.tsx` — contato editável + prévia escalada.
