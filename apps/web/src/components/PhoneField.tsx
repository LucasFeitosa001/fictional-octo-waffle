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
  // Do maior código para o menor, para "55" não roubar o "555…" de ninguém.
  const candidatos = [...PAISES].sort((a, b) => b.código.length - a.código.length);
  for (const p of candidatos) {
    if (!digitos.startsWith(p.código)) continue;
    const resto = digitos.slice(p.código.length);
    if (p.digitos.includes(resto.length)) return { pais: p, nacional: resto };
  }
  return { pais: BRASIL, nacional: digitos };
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

  function emitir(nacional: string, p: Pais) {
    const digitos = nacional.replace(/\D/g, '');
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
            emitir(separado.nacional, novo);
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
        onChange={(v) => emitir(v, pais)}
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
