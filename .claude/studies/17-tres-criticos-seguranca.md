# Estudo 17 — Três críticos de segurança (revelados pela suíte de testes)

Fonte: `docs/testes/RELATORIO-TESTES.md` seção 5 (suíte gerada a partir dos casos de uso).

## Crítico 1 — segredo de autenticação previsível

`apps/api/src/auth/better-auth.ts:107`:
```ts
secret: process.env.BETTER_AUTH_SECRET ?? 'dev-better-auth-secret-change-me-32chars',
```
Se a variável faltar, o backend sobe com um literal **público** (está no repositório). Quem conhece
esse valor consegue **forjar sessão** de qualquer usuário no ambiente afetado.

Produção hoje define `BETTER_AUTH_SECRET` (confirmado: está entre as 18 env vars do App Runner), então
o risco é de ambiente mal configurado — mas o fallback silencioso é o defeito: uma variável perdida
num deploy futuro derruba a autenticação inteira sem ninguém perceber.

**Correção:** falhar no boot quando o segredo estiver ausente em produção, em vez de assumir um valor
conhecido. Em desenvolvimento, manter um default (não trava o time), mas avisando.

## Crítico 2 — timeline de WhatsApp vaza entre empresas

`apps/api/src/modules/customers/customers.service.ts:689`–`:697`:
```ts
const outboxRows = await this.prisma.client.whatsappOutbox.findMany({
  where: { OR: [ { customerId: id }, ...(phoneTail ? [{ toPhone: { endsWith: phoneTail } }] : []) ] },
  ...
```
O ramo por telefone (`endsWith`) **não filtra `companyId`**. Dois salões com o mesmo número (ou
sufixo coincidente — o match é por final do telefone) enxergam metadados de mensagem um do outro.

**Correção:** escopar a consulta por `companyId` — o método já recebe a empresa do chamador.

## Crítico 3 — uploads legíveis sem autenticação nem tenant

`apps/api/src/modules/uploads/uploads.controller.ts:112`–`:127`: o endpoint serve o arquivo a partir
do nome, **sem exigir sessão nem conferir a empresa dona**. Saber/adivinhar o nome basta para ler
arquivo de qualquer salão (fotos de clientes, documentos, anamnese).

Precisa de análise mais cuidadosa que os outros dois: em produção os uploads ficam no **S3**
(`beautypass-uploads-834424012647`, base pública `UPLOADS_PUBLIC_BASE`, política de bucket pública —
ver memória `salonpass-aws-infra`). Ou seja, **tornar a rota autenticada não resolve sozinho** se o
objeto continua público no S3; e alguns consumos legítimos dependem de URL direta (ex.: `<img src>`,
avatar no e-mail). A correção correta envolve decidir entre URL assinada temporária ou proxy
autenticado, e migrar os consumidores — não é troca de uma linha.

**Decisão:** corrigir 1 e 2 agora (contidos e verificáveis) e **não improvisar o 3** — ele fica
documentado com o caminho recomendado para ser feito com o cuidado que merece.
