/**/
# Estudo 157 — o WhatsApp da La Belle caiu e ninguém foi avisado

Relato do dono:

> "na La Belle de Jour o WhatsApp tá desconectado... por que tá desconectando
> pra caramba, veja o que rolou"

## Arquivos tocados

- `apps/api/src/modules/whatsapp/whatsapp.service.ts`

## O que aconteceu de verdade (linha do tempo dos logs de produção)

| quando | o quê |
|---|---|
| 11/08 18:14 → 12/08 03:02 | **conectado**, com quedas de ~1h em 1h (códigos 500/503/428), todas reconectando em 3s |
| 12/08 12:42 | mais uma queda 500 → reconectou normalmente |
| **12/08 12:47:33** | **`sessão encerrada — novo QR necessário`** ← a sessão morreu de verdade |
| 12/08 12:49:26 | alguém gerou código de pareamento; 26s depois, encerrada de novo |
| 12/08 12:49 → agora | **loop de QR a cada 45s**, ininterrupto |

O primeiro engano meu foi ler o loop de QR e concluir "nunca conectou". O dono
corrigiu: ele pareou, viu conectado na plataforma e no celular. Os logs
confirmam — funcionou por ~18 horas.

`sessão encerrada` é `DisconnectReason.loggedOut` (401), que vem **do lado do
WhatsApp**, não do nosso código. Verificado:

- **não houve restart/deploy** da API perto das 12:47 (nenhum "Nest application
  successfully started" nas 11h anteriores);
- **ninguém clicou em desconectar** — não há chamada ao endpoint de logout no
  período; o pareamento por código às 12:49 foi a tentativa de recuperar,
  posterior à queda;
- **a DesignModa, na mesma instância e mesmo código, teve ZERO quedas em 11h.**

Ou seja, a causa está no aparelho/conta da La Belle — dispositivo removido em
"Aparelhos conectados", reinstalação do WhatsApp, ou a própria invalidação do
WhatsApp. Não há o que corrigir no servidor quanto a isso.

As quedas de 1h em 1h que antecederam também apontam para lá: a DesignModa não
tem nenhuma. Vale checar bateria/economia de energia e a rede do aparelho dela.

## O que ERA culpa nossa, e foi corrigido

**1. Ninguém foi avisado.** `handleLoggedOut` apagava as credenciais
(`clear()`), reconectava para expor um QR novo e pronto — em silêncio. O salão
ficou das 12:47 até a noite achando que estava funcionando; quem descobriu foi o
dono, olhando. Uma sessão que exige repareamento humano e não avisa ninguém é
uma sessão que fica caída o dia inteiro.

Agora o loggedOut grava uma notificação no sino do painel, com o texto dizendo o
que fazer (reconectar em WhatsApp integrado, lendo o QR).

**2. O loop era infinito.** Sem credencial, o ciclo
`connect → QR → timeout 45s → connect` roda para sempre. Em ~6h foram centenas
de ciclos, cada um abrindo um WebSocket para o WhatsApp — desperdício e, pior,
risco de o número ser marcado por tentativas repetidas.

Agora, depois de **10 tentativas** sem ninguém parear (~8 min), o ciclo PARA. A
retomada é natural: o painel chama `ensureConnecting` sempre que a tela de
conexão é aberta (`whatsapp.service.ts:743-749`), então basta o dono abrir a
tela para o QR voltar. O contador zera a cada conexão bem-sucedida.

Isso não atrapalha quem está parando para escanear: 8 minutos com o QR
rotativo é muito mais do que o tempo de pegar o celular e ler o código.
