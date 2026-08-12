# Regras permanentes do projeto

## WhatsApp e notificações de agendamento

- É proibido disparar mensagem automática sem autorização explícita.
- O padrão sistêmico de toda automação é **desligado**.
- Uma confirmação só pode sair se a empresa ativou o padrão da conta ou se o
  envio foi autorizado especificamente naquele agendamento.
- O opt-in do cliente é uma trava adicional; sozinho, ele nunca autoriza o envio.
- O backend é a autoridade dessa regra. Um toggle apenas no frontend não basta.
- Todo disparo precisa de idempotência, histórico e status honesto:
  `na fila`, `enviado`, `entregue`, `lido` ou `falhou`.
- “Enviado” não significa “recebido”; somente o ACK `delivered` confirma entrega
  ao aparelho e `read` confirma leitura quando o destinatário fornece esse recibo.
- Nunca conectar/drenar uma fila de produção ou fazer teste real sem revisar o
  backlog e obter autorização para o destinatário exato. Use no máximo um envio
  controlado quando o dono pedir teste sem spam.
