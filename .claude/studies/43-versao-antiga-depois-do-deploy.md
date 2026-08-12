# Estudo 43 — Depois do deploy, o app continua na versão antiga

Reclamação do dono, duas vezes: *"quando clico em Configurações fica com aquela tela antiga"*, e
depois de resolvido no desktop, *"no mobile está com o mesmo defeito"*.

## Não era cache do navegador dele

Conferi a produção com navegador limpo, em viewport de celular, autenticado na conta dele:

```
bundle carregado: index-clbcqMMf.js   (o mais recente)
/comissoes/config     → [Detalhadas · Resumidas · Pagas · Configurações]
/comissoes/resumidas  → [Detalhadas · Resumidas · Pagas · Configurações]
```

Ou seja, o servidor está certo. O que segura a versão velha é o **service worker**.

## O mecanismo

`apps/web/vite.config.ts:15`-`:16` usa `VitePWA({ registerType: 'autoUpdate', injectRegister:
'auto' })`, e o `sw.js` gerado tem `skipWaiting` e `clientsClaim` (confirmado com
`grep -o "skipWaiting\|clientsClaim" apps/web/dist/sw.js`). O SW novo assume o controle assim que
instala.

**Mas nada no app reage a isso.** `grep -rn "registerSW|virtual:pwa-register|onNeedRefresh"
apps/web/src` não devolve nada — o registro é o injetado pelo plugin, que atualiza o service
worker e **não recarrega a página**. Resultado: a aba que já está aberta continua executando o JS
ANTIGO até o usuário navegar/recarregar de novo. Daí o padrão "abri, estava velho; recarreguei,
apareceu".

## Por que isso é mais que cosmético

Front antigo conversando com API nova envia requisição fora do contrato. Foi assim que nasceram os
três pagamentos de R$ 0,00: o bundle velho não mandava `accountId`/`paymentMethodId` e não
conhecia a recusa nova. Um front desatualizado num módulo financeiro grava dado errado, não só
mostra tela errada.

## Correção

Recarregar a página quando o service worker novo assumir, com duas guardas:

1. **Primeira instalação não recarrega.** Com `clientsClaim`, o evento `controllerchange` também
   dispara na primeira visita (quando não havia controlador). Recarregar ali seria um reload
   gratuito em todo primeiro acesso.
2. **Não recarregar em cima de digitação.** Se houver campo focado ou modal/drawer aberto, avisar
   com toast em vez de recarregar — perder um formulário preenchido no meio é pior que ficar mais
   um minuto na versão anterior.

## Arquivos tocados

- `apps/web/src/main.tsx`
