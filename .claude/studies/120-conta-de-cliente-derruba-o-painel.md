# Estudo 120 — entrar como cliente derruba o acesso do dono ao painel

Relato do dono, com captura: no `app.salonpass.com.br/painel` aparece **"Acesso
restrito — Seu perfil não tem permissão para acessar esta área. Fale com o
responsável pela conta se precisar de acesso."**, e o menu lateral fica reduzido
a Painel / Ajuda / Indique e ganhe.

Ele É o responsável pela conta. A mensagem manda falar consigo mesmo.

## Arquivos tocados

- `apps/web/src/App.tsx`
- `apps/web/src/pages/LoginPage.tsx`

## Pergunta do dono: um CLIENTE consegue entrar na conta do salão?

Ele viu a tela "Minha conta" do painel exibindo a conta de cliente
(`lucssfeitosa@gmail.com`) com **Cargo / função: Proprietário(a)** e perguntou
se um cliente poderia estar acessando o salão, pedindo bloqueio.

**Resposta medida: nunca houve acesso a dado nenhum.** Com uma sessão de cliente
real contra a API:

```
/companies/current       401
/appointments            401
/customers               401
/orders                  401
/professionals           401
/reports/sales           401
/users/permissions       401
```

E na base, a conta de cliente não tem `companyId`, nem `UserCompany`, nem papel.

O "Proprietário(a)" da tela é falso alarme, mas é falso alarme NOSSO:
`apps/web/src/components/MinhaContaDrawer.tsx:95` faz
`const [cargo, setCargo] = useState<string>('proprietario')` — é o valor inicial
do campo, exibido para QUALQUER conta, e nunca o papel real. A tela mostrava
"Proprietário(a)" para um cliente.

**O que era real:** a conta de cliente ATRAVESSAVA a porta do painel
(`App.tsx:340-349` só checava `if (!session)`) e montava o shell vazio. Não
alcançava dados, mas parecia estar dentro da gestão — e a sessão dela
substituía a do dono.

Pedido explícito dele: *"essas contas de cliente que eu crio no agendamento
online não podem servir para entrar na conta do SalonPass"*. É o que a correção
faz — barra antes de montar qualquer coisa.

## O que os dados mostram

Sessões ativas das duas contas dele, em produção:

```
lucssfeitosa@gmail.com     | customer | 2026-08-04 19:09:41   ← a mais recente
lucasfeitasa999@gmail.com  | staff    | 2026-08-04 18:40:00
lucasfeitasa999@gmail.com  | staff    | 2026-08-04 18:36:47
…
```

A sessão mais nova é a da conta de CLIENTE, criada no portal de agendamento
(estudos 117–119). E o cookie de sessão é compartilhado entre subdomínios —
`better-auth.state`/`session_token` saem com `Domain=salonpass.com.br`
(`apps/api/src/auth/better-auth.ts`, `advanced.crossSubDomainCookies`, ligado
para que o login feito em `app.` valha em `agenda.`).

Consequência: **entrar no portal como cliente SUBSTITUI a sessão do painel**. O
painel então carrega com uma conta `customer`, que não tem empresa nem papel —
daí o menu reduzido e o 403.

Isso não é um bug do RBAC: o RBAC está certo ao negar. O defeito é a mensagem.

## Por que o texto atual é enganoso

`apps/web/src/App.tsx:187-208` — o `ForbiddenRoute` é único e assume um só
cenário: funcionário cujo cargo não alcança aquela rota.

```jsx
<h1>Acesso restrito</h1>
<p>Seu perfil não tem permissão para acessar esta área. Fale com o
   responsável pela conta se precisar de acesso.</p>
<Link to="/painel">Voltar ao painel</Link>
```

Para o caso real do dono, cada parte está errada:

- "Seu perfil não tem permissão" — o perfil dele TEM; a sessão é que é de outra
  conta;
- "Fale com o responsável" — ele é o responsável;
- "Voltar ao painel" — leva ao mesmo lugar bloqueado, em círculo.

E não há NENHUMA saída oferecida: nem trocar de conta, nem sair.

## O que este estudo muda

O `ForbiddenRoute` passa a distinguir os dois casos pela sessão:

1. **Conta de cliente** (`accountType === 'customer'`, o caso do dono): diz que
   a sessão em uso é a da conta de agendamento — com o e-mail na tela — e
   oferece **sair e entrar com a conta do salão**.
2. **Funcionário sem permissão** (o caso original): mantém o texto de hoje, que
   está correto para ele.

O que este estudo NÃO faz: manter as duas sessões vivas ao mesmo tempo. Sessão
simultânea por app exigiria cookie separado por subdomínio ou o plugin de
multi-sessão do Better Auth — mudança grande, e que derrubaria o compartilhamento
que o embed da Voltr e o portal usam hoje. Fica registrado como caminho possível
se o incômodo persistir.
