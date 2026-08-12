const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%';
const ALL = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

function pick(source: string): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return source[value[0] % source.length];
}

/** Senha forte, sem caracteres visualmente ambíguos (0/O, 1/l/I). */
export function generateTemporaryPassword(length = 14): string {
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const swapWith = random[0] % (index + 1);
    [chars[index], chars[swapWith]] = [chars[swapWith], chars[index]];
  }
  return chars.join('');
}
