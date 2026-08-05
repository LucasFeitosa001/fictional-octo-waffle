/**
 * Normalizadores/validadores de campos de cadastro — ver estudo 125.
 *
 * Vivem aqui, fora do arquivo do DTO, porque também são reaproveitados pelo
 * SalonPayService (mesmos formatos, mesmos riscos). Cada função devolve o valor
 * "limpo" ou lança `BadRequestException` — o `@Transform` do DTO chama, e o
 * PipeValidation devolve 400 antes de o service ver o lixo.
 */
import { BadRequestException } from '@nestjs/common';

/**
 * Extrai só dígitos e valida um telefone brasileiro ou internacional.
 *
 * Regras que essa função protege:
 *  - `"5555555"` (o bug de 05/08): 7 dígitos, menor que qualquer telefone real,
 *    é rejeitado;
 *  - `""` / `"  "`: viram vazio, tratados como "não informado" (o campo é
 *    opcional em quase todo cadastro; quem torna obrigatório é o `@IsString`
 *    sem `@IsOptional`);
 *  - `"(89) 98131-2500"`: aceito, devolvido como `"89981312500"`;
 *  - `"+55 (11) 99999-9999"`: aceito, devolvido como `"5511999999999"` (13);
 *  - `"12345678"` (8 dígitos): rejeitado — nenhum país da lista aceita menos
 *    que 10 nacionais (o menor é Uruguai com 8, mas com DDI 598 dá 11).
 *
 * O formato interno de todo o resto do código é "só dígitos": ver
 * `voltr-forwarder`, `whatsapp.service`, `notifications`. Mudar isso aqui
 * seria quebrar todos.
 */
export function normalizarTelefone(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('Telefone precisa ser texto.');
  }
  const digitos = bruto.replace(/\D+/g, '');
  if (!digitos) return undefined;
  if (digitos.length < 10) {
    throw new BadRequestException(
      `Telefone inválido — precisa ter pelo menos 10 dígitos (recebido: "${bruto.trim()}").`,
    );
  }
  if (digitos.length > 15) {
    throw new BadRequestException('Telefone inválido — dígitos demais.');
  }
  return digitos;
}

/**
 * Valida CPF pelo algoritmo do dígito verificador. Rejeita:
 *  - texto que não gera 11 dígitos ("abc" → 0 dígitos, `"111.222"` → 6);
 *  - repetição óbvia ("11111111111"); é matematicamente válido pelo checksum,
 *    mas a Receita não emite CPF assim e ele quase sempre indica gente
 *    preenchendo campo de qualquer jeito;
 *  - qualquer combinação em que os DVs não batem.
 *
 * Devolve o CPF em "só dígitos" para o banco não guardar duas formatações
 * diferentes do mesmo documento.
 */
export function normalizarCpf(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('CPF precisa ser texto.');
  }
  const digitos = bruto.replace(/\D+/g, '');
  // Texto sem dígito nenhum ("abc", "-", " ") é tratado como AUSÊNCIA — o
  // campo é opcional, e persistir vazio ali é o mesmo que não persistir. O que
  // não pode passar é dígito PARCIAL (11 diferente, tudo igual, DV errado).
  if (!digitos) return undefined;
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) {
    throw new BadRequestException(`CPF inválido (recebido: "${bruto.trim()}").`);
  }
  const calc = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  if (calc(digitos.slice(0, 9)) !== Number(digitos[9])) {
    throw new BadRequestException(`CPF inválido — dígito verificador não bate.`);
  }
  if (calc(digitos.slice(0, 10)) !== Number(digitos[10])) {
    throw new BadRequestException(`CPF inválido — dígito verificador não bate.`);
  }
  return digitos;
}

/**
 * Valida CNPJ pelo algoritmo dos dois DVs. Mesma filosofia do CPF: rejeita
 * texto solto e repetição óbvia. Devolve só dígitos.
 */
export function normalizarCnpj(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('CNPJ precisa ser texto.');
  }
  const digitos = bruto.replace(/\D+/g, '');
  if (!digitos) return undefined;
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) {
    throw new BadRequestException(`CNPJ inválido (recebido: "${bruto.trim()}").`);
  }
  const calc = (base: string, pesos: number[]) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) soma += Number(base[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calc(digitos.slice(0, 12), pesos1) !== Number(digitos[12])) {
    throw new BadRequestException(`CNPJ inválido — dígito verificador não bate.`);
  }
  if (calc(digitos.slice(0, 13), pesos2) !== Number(digitos[13])) {
    throw new BadRequestException(`CNPJ inválido — dígito verificador não bate.`);
  }
  return digitos;
}

/**
 * Aceita CPF (11) OU CNPJ (14). Usado no SalonPay (`taxId` é PF ou PJ).
 */
export function normalizarDocumento(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('Documento precisa ser texto.');
  }
  const digitos = bruto.replace(/\D+/g, '');
  if (!digitos) return undefined;
  if (digitos.length === 11) return normalizarCpf(bruto);
  if (digitos.length === 14) return normalizarCnpj(bruto);
  throw new BadRequestException(
    `Documento precisa ser CPF (11 dígitos) ou CNPJ (14) — recebido: "${bruto.trim()}".`,
  );
}

/**
 * CEP: 8 dígitos, sem checksum (o serviço dos Correios não expõe algoritmo
 * local). Devolve só dígitos para não guardar "01310-000" e "01310000" como
 * dois CEPs distintos.
 */
export function normalizarCep(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('CEP precisa ser texto.');
  }
  const digitos = bruto.replace(/\D+/g, '');
  if (!digitos) return undefined;
  if (digitos.length !== 8) {
    throw new BadRequestException(`CEP inválido — precisa ter 8 dígitos.`);
  }
  return digitos;
}

/**
 * Chave PIX aceita quatro formatos: CPF, CNPJ, e-mail, telefone (E.164) ou
 * chave aleatória (UUID). Sem validação de existência no BC — só de FORMATO,
 * que já barra "não é uma chave", que era o cenário do SalonPay.
 */
export function normalizarChavePix(bruto: unknown): string | undefined {
  if (bruto == null) return undefined;
  if (typeof bruto !== 'string') {
    throw new BadRequestException('Chave PIX precisa ser texto.');
  }
  const limpo = bruto.trim();
  if (!limpo) return undefined;
  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return limpo.toLowerCase();
  // UUID (chave aleatória do BC)
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(limpo)) {
    return limpo.toLowerCase();
  }
  const digitos = limpo.replace(/\D+/g, '');
  // Telefone E.164 (com "+" opcional). O BC exige +55 no PIX; aqui aceitamos
  // sem para não travar cadastros antigos, mas normalizamos.
  if (limpo.startsWith('+') && digitos.length >= 11 && digitos.length <= 13) {
    return `+${digitos}`;
  }
  // CPF/CNPJ como chave.
  if (digitos.length === 11) return normalizarCpf(limpo);
  if (digitos.length === 14) return normalizarCnpj(limpo);
  throw new BadRequestException(
    `Chave PIX precisa ser CPF, CNPJ, e-mail, telefone (+55…) ou chave aleatória (UUID).`,
  );
}
