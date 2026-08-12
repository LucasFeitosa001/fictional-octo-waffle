/**/
# Estudo 155 — criar cliente e resolver o serviço sem sair da tela

Pedido do dono, por áudio:

> "na hora de criar uma comanda, a pessoa consegue criar um cliente também.
> Outra coisa na parte de criar agendamento, se um profissional não tiver um
> serviço, poder ele criar um serviço. Tudo isso via Drawer (...) porque senão
> a pessoa tem que sair da página."

## Arquivos tocados

- `apps/web/src/components/CustomerPickerDrawer.tsx`
- `apps/web/src/pages/ClientePerfilTabs.tsx`
- `apps/web/src/pages/ComandasPage.tsx`
- `apps/web/src/components/NewAppointmentModal.tsx`

## Parte 1 — criar cliente durante a comanda

O `CustomerPickerDrawer` só sabia SELECIONAR. Quem descobria, no meio da
comanda, que a cliente não estava cadastrada tinha de fechar tudo (perdendo o
que preencheu — ver estudo 154), ir em Clientes, cadastrar, e recomeçar.

O formulário completo já existia e já era reusado em três telas, então não
escrevi formulário novo. O que faltava era encadear:

- `CustomerForm` passou a **devolver o cliente criado** em `onDone(criado)`.
  Quem só quer fechar ignora o argumento — nenhum uso antigo mudou;
- `CustomerCreateModal` ganhou `onCreated`, `initialName` e `zClass`;
- o **botão nasceu dentro do picker compartilhado**, não da comanda. Com isso
  Pacotes e IA ganham o mesmo caminho quando quiserem, sem código duplicado. É
  `onCreateNew` opcional: quem não passa continua idêntico.

Dois pontos de entrada, porque são dois momentos diferentes: um link discreto
sempre visível, e um botão **"+ Cadastrar «nome digitado»"** dentro do vazio da
busca — que é exatamente quando a pessoa descobre que a cliente não existe. O
nome digitado vai junto; ninguém deve escrever de novo o que acabou de procurar.

### Só nome e telefone (correção pedida pelo dono)

A primeira versão abria o cadastro COMPLETO (`CustomerCreateModal`: apelido,
e-mail, CPF, CNPJ, RG, aniversário, desconto, endereço…). O dono corrigiu:

> "faça ser igual aparece em criar no agendamento, colocando somente o nome e o
> número"

Ele está certo, e o argumento é o contexto: quem está montando uma comanda com
a cliente na frente não vai preencher CPF e endereço — quer o nome, o telefone,
e voltar para a comanda. O agendamento já resolvia assim
(`NewAppointmentModal.tsx:958-967`: `TextField` de nome + `PhoneField`), e ter
dois padrões diferentes para a mesma tarefa é o que confunde.

Agora o picker mostra os **dois campos ali mesmo**, sem abrir outro drawer.
Salva com `useCreateCustomer` (`{ name, phone }`), a cliente entra já
selecionada e o picker fecha.

O cadastro completo continua alcançável por um link **"Preencher cadastro
completo"** abaixo dos campos, levando o que já foi digitado — quem precisa de
CPF na hora não fica sem caminho. Por isso `initialName`/`onCreated`/`zClass`
seguem em uso, e não viraram código morto.

## Parte 2 — o serviço no agendamento

Aqui o diagnóstico mudou o que eu ia fazer. O pedido era "poder criar um
serviço", mas o caso real que trava o agendamento é outro: **o serviço quase
sempre já existe — o que falta é o vínculo com a profissional**.

O sintoma é a lista de horários vazia. O backend já devolve o motivo pronto
(`appointments.service.ts:1514-1520`) e a tela já explica bem
(`NewAppointmentModal.tsx:1089-1094`): *"Trocar a data não resolve — escolha
outra profissional ou vincule este serviço a ela."* Ela dizia o que fazer e não
deixava fazer: vincular exigia sair para Equipe.

Então cobri os dois casos, com gatilhos separados porque as **permissões são
diferentes**:

- **"Vincular a «profissional»"** na própria caixa amarela — `equipe:manage`;
- **"+ Novo serviço"** abaixo do seletor, abrindo o `ServiceDrawer` que já é
  reutilizável e já sobe por cima (`FullDrawer` z-80 > agendamento z-70) —
  `catalogo:manage`.

### A armadilha do vínculo

`PUT /professionals/:id/services` **substitui a lista inteira**
(`professionals.service.ts:99-106` faz `deleteMany` + `createMany`). Mandar só
o serviço novo **apagaria todos os outros vínculos da profissional** — um
estrago silencioso, que só apareceria dias depois com a agenda dela recusando
serviços que ela sempre fez.

Por isso o botão envia a **união** com os vínculos atuais, e fica
**desabilitado enquanto a lista atual não carregou**: disparar o PUT sem ela é
o cenário exato que zera tudo.

E invalida `['availability']` — a mutation só invalida `professionals`, então
sem isso a caixa amarela continuaria na tela depois de vincular, parecendo que
o botão não fez nada.
