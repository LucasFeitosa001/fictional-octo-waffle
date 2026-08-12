import { useMemo, useState } from 'react';
import { Input, ListBox, Select, TextField } from '@heroui/react';

/**
 * Campo de telefone com país — Brasil (+55) por padrão.
 *
 * Antes eram `TextField` crus e cada tela pedia um formato diferente
 * (`(00) 00000-0000`, `+55 (11) 99999-9999`, `+1 (918) 238-4714`), então o
 * cadastro saía metade com DDI e metade sem — e o WhatsApp precisa do DDI para
 * enviar. Aqui o país é escolhido numa lista e o valor emitido é sempre
 * `DDI + número`, só dígitos. Ver estudo 57.
 */
export interface Pais {
  código: string;
  nome: string;
  bandeira: string;
  /** Dígitos do número NACIONAL (sem DDI), para a máscara e a validação. */
  digitos: number[];
}

// Brasil primeiro; o resto é o que aparece na clientela de salão por aqui.
export const PAISES: Pais[] = [
  { código: '55', nome: 'Brasil', bandeira: '🇧🇷', digitos: [10, 11] },
  { código: '351', nome: 'Portugal', bandeira: '🇵🇹', digitos: [9] },
  { código: '1', nome: 'EUA / Canadá', bandeira: '🇺🇸', digitos: [10] },
  { código: '54', nome: 'Argentina', bandeira: '🇦🇷', digitos: [10] },
  { código: '595', nome: 'Paraguai', bandeira: '🇵🇾', digitos: [9] },
  { código: '598', nome: 'Uruguai', bandeira: '🇺🇾', digitos: [8, 9] },
  { código: '34', nome: 'Espanha', bandeira: '🇪🇸', digitos: [9] },
  { código: '39', nome: 'Itália', bandeira: '🇮🇹', digitos: [9, 10] },
  { código: '56', nome: 'Chile', bandeira: '🇨🇱', digitos: [9] },
  { código: '57', nome: 'Colômbia', bandeira: '🇨🇴', digitos: [10] },
  { código: '52', nome: 'México', bandeira: '🇲🇽', digitos: [10] },
  { código: '44', nome: 'Reino Unido', bandeira: '🇬🇧', digitos: [10] },
];

const BRASIL = PAISES[0];

/** Máscara nacional: (00) 00000-0000 no Brasil, agrupada em blocos fora dele. */
function mascarar(digitos: string, pais: Pais): string {
  if (pais.código === '55') {
    const d = digitos.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  const max = Math.max(...pais.digitos);
  return digitos.slice(0, max).replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/**
 * Separa um valor gravado (`5589999387007`, `89981312500`, `+55 (89) 9...`) em
 * país + número nacional. Sem DDI reconhecível, assume Brasil — que é o caso da
 * base antiga.
 */
export function separarTelefone(valor: string | null | undefined): { pais: Pais; nacional: string } {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return { pais: BRASIL, nacional: '' };
  // (1) Match perfeito primeiro: DDI + resto com tamanho nacional válido.
  //     Do maior código para o menor, para "55" não roubar o "555…" de ninguém.
  const candidatos = [...PAISES].sort((a, b) => b.código.length - a.código.length);
  for (const p of candidatos) {
    if (!digitos.startsWith(p.código)) continue;
    const resto = digitos.slice(p.código.length);
    if (p.digitos.includes(resto.length)) return { pais: p, nacional: resto };
  }
  // (2) BUG que o dono reproduziu: enquanto o número está sendo DIGITADO no
  //     Brasil, o valor gravado é "55" + os dígitos parciais. Sem match perfeito,
  //     a função caía no fallback (pais=Brasil, nacional=<tudo>) — e a máscara
  //     mostrava "(55) 5" para quem só tinha digitado "5", depois "(55) 55",
  //     "(55) 555"…, com o "55" do DDI virando DDD na cara do usuário.
  //     Se o valor começa com "55", tratamos como Brasil parcial: o resto é
  //     mostrado sem o "55" pré-fixado.
  if (digitos.startsWith('55') && digitos.length <= 13) {
    return { pais: BRASIL, nacional: digitos.slice(2) };
  }
  // (3) Sem DDI reconhecível: assume Brasil (base antiga sem prefixo).
  return { pais: BRASIL, nacional: digitos };
}

/** Quantos dígitos nacionais o país aceita, no máximo. É o teto da máscara. */
function tetoNacional(pais: Pais): number {
  return Math.max(...pais.digitos);
}

/**
 * Interpreta o que a pessoa DIGITOU OU COLOU no campo do número.
 *
 * O caminho do COLAR ficou de fora da correção anterior (a do "5555555", ver o
 * comentário da regra 2 acima) e produzia o pior estrago do cadastro: a
 * atendente copia "+55 11 99999-9999" da conversa do WhatsApp, cola no Celular,
 * e o campo passa a mostrar "(55) 55119-9999" — porque `emitir` grudava o DDI do
 * país escolhido na FRENTE de um número que já vinha com DDI
 * ("55" + "5511999999999" = 15 dígitos). O número resultante não existe, então
 * confirmação e lembrete nunca chegam.
 *
 * Duas regras, nesta ordem:
 *
 *  (a) O "+" é sinal EXPLÍCITO de DDI: com ele, procura-se o país antes de
 *      qualquer outra coisa, e colar "+1 918 238 4714" troca a bandeira para
 *      EUA em vez de virar um número brasileiro impossível.
 *
 *  (b) Sem "+", o DDI só é removido quando NÃO HÁ AMBIGUIDADE: o total não é um
 *      tamanho nacional válido do país atual E o que sobra depois do DDI é um
 *      tamanho válido. Isso é o que protege o DDD 55 (Santa Maria/RS):
 *      "55999998888" tem 11 dígitos, é um celular nacional legítimo, e sai
 *      intacto. E protege a DIGITAÇÃO parcial: "5", "55", "5511" não casam com
 *      nada e são devolvidos como estão, sem o DDI virar DDD na cara de quem
 *      está digitando.
 *
 * No fim, o número é cortado no mesmo teto que a máscara já usava — antes o
 * valor gravado passava de 11 dígitos enquanto a tela mostrava 11, e os dois
 * discordavam em silêncio.
 */
export function interpretarEntradaTelefone(
  bruto: string,
  atual: Pais,
): { pais: Pais; nacional: string } {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  if (!digitos) return { pais: atual, nacional: '' };

  const veioComMais = String(bruto ?? '').trim().startsWith('+');
  const cabeNoPaisAtual = atual.digitos.includes(digitos.length);

  if (veioComMais || !cabeNoPaisAtual) {
    // O país ATUAL vem primeiro: se o que foi colado é do país que já está
    // escolhido, não há motivo para trocar a bandeira. Depois, do maior código
    // para o menor, para "55" não roubar o "555…" de ninguém (mesma ordem de
    // `separarTelefone`).
    const candidatos = [
      atual,
      ...[...PAISES].sort((a, b) => b.código.length - a.código.length),
    ];
    for (const p of candidatos) {
      if (!digitos.startsWith(p.código)) continue;
      const resto = digitos.slice(p.código.length);
      if (p.digitos.includes(resto.length)) return { pais: p, nacional: resto };
    }
  }

  return { pais: atual, nacional: digitos.slice(0, tetoNacional(atual)) };
}

export function PhoneField({
  value,
  onChange,
  ariaLabel = 'Telefone',
  placeholder,
  isDisabled,
}: {
  /** Valor gravado: DDI + número, só dígitos. */
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  placeholder?: string;
  isDisabled?: boolean;
}) {
  const separado = useMemo(() => separarTelefone(value), [value]);
  // O país escolhido à mão manda enquanto o campo estiver em edição — senão,
  // apagar o número inteiro faria a lista pular de volta para o Brasil.
  const [paisEscolhido, setPaisEscolhido] = useState<string | null>(null);
  const pais = PAISES.find((p) => p.código === paisEscolhido) ?? separado.pais;

  /** Digitado/colado no campo do número: interpreta antes de gravar. */
  function emitirDoCampo(bruto: string) {
    const { pais: destino, nacional } = interpretarEntradaTelefone(bruto, pais);
    // Colar um número com DDI de outro país troca a bandeira junto — senão a
    // tela mostraria "+55" ao lado de um número americano.
    if (destino.código !== pais.código) setPaisEscolhido(destino.código);
    onChange(nacional ? `${destino.código}${nacional}` : '');
  }

  /**
   * Troca de país na lista: NÃO re-interpreta o número. Quem escolheu a bandeira
   * foi a pessoa; sair "detectando" outro país aqui faria escolher Portugal e
   * receber EUA de volta. Só corta no teto do país novo, que é o teto que a
   * máscara já aplicava na exibição.
   */
  function emitirTrocandoPais(nacional: string, p: Pais) {
    const digitos = nacional.replace(/\D/g, '').slice(0, tetoNacional(p));
    onChange(digitos ? `${p.código}${digitos}` : '');
  }

  return (
    <div className="flex items-stretch gap-2">
      <div className="w-[7.5rem] shrink-0">
        <Select
          aria-label="País"
          isDisabled={isDisabled}
          selectedKey={pais.código}
          onSelectionChange={(k) => {
            const novo = PAISES.find((p) => p.código === String(k)) ?? BRASIL;
            setPaisEscolhido(novo.código);
            emitirTrocandoPais(separado.nacional, novo);
          }}
        >
          <Select.Trigger>
            <Select.Value>
              {() => (
                <span className="whitespace-nowrap">
                  {pais.bandeira} +{pais.código}
                </span>
              )}
            </Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {PAISES.map((p) => (
                <ListBox.Item key={p.código} id={p.código} textValue={`${p.nome} +${p.código}`}>
                  {p.bandeira} {p.nome} +{p.código}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <TextField
        className="min-w-0 flex-1"
        value={mascarar(separado.nacional, pais)}
        onChange={emitirDoCampo}
        aria-label={ariaLabel}
        isDisabled={isDisabled}
      >
        <Input
          type="tel"
          inputMode="tel"
          placeholder={placeholder ?? (pais.código === '55' ? '(00) 00000-0000' : 'Número')}
        />
      </TextField>
    </div>
  );
}
