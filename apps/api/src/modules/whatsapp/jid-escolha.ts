/**
 * Qual endereço usar para um telefone que já tem conversa. Ver estudo 83.
 *
 * Está fora do serviço de propósito: a regra decide PARA QUEM a mensagem é
 * cifrada, e errar aqui manda a mensagem para outra pessoa. Função pura, com
 * teste — dentro do serviço exigiria mockar o Prisma.
 */

export interface ConversaConhecida {
  remoteJid: string | null;
  phone: string | null;
}

const soDigitos = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/**
 * `null` quando não dá para decidir com segurança — quem chama volta a
 * endereçar pelo telefone, que é o comportamento antigo.
 */
export function escolherJidConhecido(
  telefoneAlvo: string,
  conversas: ConversaConhecida[],
): string | null {
  const alvo = soDigitos(telefoneAlvo);
  // Menos de 8 dígitos não identifica ninguém com segurança.
  if (alvo.length < 8) return null;
  const fim = alvo.slice(-8);

  const candidatas = conversas.filter((c) => {
    const d = soDigitos(c.phone);
    // Os últimos 8 dígitos são o único pedaço estável: o telefone é gravado ora
    // com `+`, ora sem, ora com 55 na frente, e o celular brasileiro aparece com
    // e sem o nono dígito. A diferença de tamanho limita a variação ao prefixo —
    // sem isso, 8 dígitos iguais casariam outro cliente.
    return d.endsWith(fim) && Math.abs(d.length - alvo.length) <= 4;
  });
  if (candidatas.length === 0) return null;

  const numeros = new Set(candidatas.map((c) => soDigitos(c.phone).slice(-11)));
  // Ambíguo: dois números diferentes batendo. Não se adivinha destinatário.
  if (numeros.size > 1) return null;

  // Prefere `@lid`: quando o contato tem as duas formas gravadas (acontece — o
  // mesmo Paulo tinha `19182384714@s.whatsapp.net` e `49040423161879@lid`), o
  // LID é o endereço vivo do chat. Cifrar para a forma por telefone produz uma
  // mensagem que os outros aparelhos da própria conta não abrem: é exatamente o
  // "Aguardando mensagem" que o dono viu.
  const lid = candidatas.find((c) => c.remoteJid?.endsWith('@lid'));
  const escolhida = lid ?? candidatas[0];
  const jid = escolhida?.remoteJid ?? '';
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return null;
  return soDigitos(jid.split('@')[0]) ? jid : null;
}
