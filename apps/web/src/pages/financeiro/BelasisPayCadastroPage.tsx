import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { IconHelpCircle } from '../../components/icons';

type PersonType = 'PJ' | 'PF';

type CompanyType = 'mei' | 'ltda' | 'sa' | 'eireli' | 'outro';

const COMPANY_TYPES: { id: CompanyType; label: string }[] = [
  { id: 'mei', label: 'MEI' },
  { id: 'ltda', label: 'LTDA' },
  { id: 'sa', label: 'S/A' },
  { id: 'eireli', label: 'EIRELI' },
  { id: 'outro', label: 'Outro' },
];

// Máscaras (front-only): CPF 000.000.000-00 / CNPJ 00.000.000/0000-00 /
// telefone (00) 00000-0000. Numérico apenas; corta no tamanho máximo do doc.
function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function maskMoney(v: string) {
  // Faturamento em BRL — aceita dígitos e formata como "R$ 1.234,56".
  const d = v.replace(/\D/g, '');
  if (!d) return '';
  const cents = d.padStart(3, '0');
  const int = cents.slice(0, -2).replace(/^0+(?=\d)/, '');
  const dec = cents.slice(-2);
  const withThousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${withThousands},${dec}`;
}

export function BelasisPayCadastroPage() {
  const navigate = useNavigate();
  const [personType, setPersonType] = useState<PersonType>('PJ');
  const [toast, setToast] = useState<string | null>(null);

  // PJ
  const [razaoSocial, setRazaoSocial] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>('ltda');
  const [cnpj, setCnpj] = useState('');
  const [faturamento, setFaturamento] = useState('');

  // PF
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');

  // comum
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCancel() {
    navigate('/financeiro/contas');
  }

  function handleSuporte() {
    // Placeholder: em produção abriria widget de chat / e-mail suporte.
    setToast('Suporte: em breve.');
  }

  function handleSalvar() {
    const payload =
      personType === 'PJ'
        ? { personType, razaoSocial, companyType, cnpj, faturamento, email, telefone }
        : { personType, nome, cpf, email, telefone };
    // TODO: integrar com backend Belasis Pay.
    // eslint-disable-next-line no-console
    console.log('[BelasisPayCadastro] salvar', payload);
    setToast('Cadastro enviado. Aguarde retorno da equipe Belasis Pay.');
  }

  return (
    <div className="pb-24">
      {/* Cabeçalho */}
      <div className="mb-5">
        <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
          Belasis Pay — cadastro
        </h1>
        <p className="mt-1 text-sm text-muted">
          Preencha os dados abaixo para solicitar a habilitação da conta digital Belasis Pay.
        </p>
      </div>

      {/* Toggle Tipo de pessoa */}
      <div
        role="tablist"
        aria-label="Tipo de pessoa"
        className="mb-6 inline-flex rounded-full border border-[var(--color-soft-border)] bg-warm-white p-1"
      >
        {(['PJ', 'PF'] as PersonType[]).map((t) => {
          const active = personType === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPersonType(t)}
              className={
                'min-w-[110px] rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (active
                  ? 'bg-[color:var(--sp-primary,#505afb)] text-white shadow-sm'
                  : 'text-muted hover:text-foreground')
              }
            >
              {t === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}
            </button>
          );
        })}
      </div>

      {/* Bloco de dados */}
      <div className="rounded-lg border-0 bg-transparent p-0 shadow-none md:border md:border-[var(--color-soft-border)] md:bg-warm-white md:p-5 md:shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {personType === 'PJ' ? 'Detalhes da empresa' : 'Detalhes pessoais'}
          </h2>
          <span className="text-muted" title="Estes dados são enviados para análise.">
            <IconHelpCircle size={14} />
          </span>
        </div>

        {personType === 'PJ' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Razão Social" required>
              <TextField value={razaoSocial} onChange={setRazaoSocial} aria-label="Razão Social">
                <Input placeholder="Nome da empresa" />
              </TextField>
            </Field>

            <Field label="Tipo empresa" required>
              <Select
                aria-label="Tipo empresa"
                selectedKey={companyType}
                onSelectionChange={(k) => setCompanyType(String(k) as CompanyType)}
              >
                <Select.Trigger>
                  <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {COMPANY_TYPES.map((c) => (
                      <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                        {c.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            <Field label="CNPJ" required>
              <TextField
                value={cnpj}
                onChange={(v) => setCnpj(maskCNPJ(v))}
                aria-label="CNPJ"
              >
                <Input placeholder="00.000.000/0000-00" inputMode="numeric" />
              </TextField>
            </Field>

            <Field label="Faturamento mensal">
              <TextField
                value={faturamento}
                onChange={(v) => setFaturamento(maskMoney(v))}
                aria-label="Faturamento"
              >
                <Input placeholder="R$ 0,00" inputMode="numeric" />
              </TextField>
            </Field>

            <Field label="E-mail" required>
              <TextField value={email} onChange={setEmail} aria-label="E-mail">
                <Input placeholder="empresa@dominio.com" type="email" />
              </TextField>
            </Field>

            <Field label="Telefone" required>
              <TextField
                value={telefone}
                onChange={(v) => setTelefone(maskPhone(v))}
                aria-label="Telefone"
              >
                <Input placeholder="(00) 00000-0000" inputMode="tel" />
              </TextField>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome" required>
              <TextField value={nome} onChange={setNome} aria-label="Nome">
                <Input placeholder="Nome completo" />
              </TextField>
            </Field>

            <Field label="CPF" required>
              <TextField value={cpf} onChange={(v) => setCpf(maskCPF(v))} aria-label="CPF">
                <Input placeholder="000.000.000-00" inputMode="numeric" />
              </TextField>
            </Field>

            <Field label="E-mail" required>
              <TextField value={email} onChange={setEmail} aria-label="E-mail">
                <Input placeholder="voce@dominio.com" type="email" />
              </TextField>
            </Field>

            <Field label="Telefone" required>
              <TextField
                value={telefone}
                onChange={(v) => setTelefone(maskPhone(v))}
                aria-label="Telefone"
              >
                <Input placeholder="(00) 00000-0000" inputMode="tel" />
              </TextField>
            </Field>
          </div>
        )}
      </div>

      {/* Rodapé sticky: Cancelar · Suporte · Salvar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-soft-border)] bg-warm-white/95 px-4 py-3 backdrop-blur md:sticky md:mt-6 md:rounded-lg md:border md:bg-warm-white md:px-5 md:py-3 md:shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-3xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="w-full sm:w-auto" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleSuporte}>
            Suporte
          </Button>
          <Button variant="primary" className="w-full sm:w-auto" onClick={handleSalvar}>
            Salvar
          </Button>
        </div>
      </div>

      {/* Toast placeholder */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground/90 px-4 py-2 text-sm text-white shadow-lg md:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
