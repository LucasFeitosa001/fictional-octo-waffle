import { useEffect, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { Drawer } from './Drawer';
import { LoadingState } from './States';
import { IconInfo, IconWhatsApp } from './icons';
import { apiErrorMessage } from '../lib/toast';
import { useSalonPay, useSaveSalonPay, type SalonPayPersonType } from '../lib/queries/salonpay';

/**
 * SalonPay — cadastro de recebimento do salão.
 *
 * Mesmos campos do formulário da referência: tipo de pessoa, dados da empresa
 * (razão social, tipo, CNPJ, faturamento), contato, endereço e os meios de
 * recebimento (PIX / Cartão).
 *
 * Uma coisa esta tela NÃO faz, e diz isso na cara: liquidar. Enquanto não
 * houver um adquirente conectado, o cadastro fica salvo e o pagamento é apenas
 * REGISTRADO. Num módulo financeiro, deixar o salão achar que o dinheiro saiu
 * quando não saiu é o pior defeito possível — o mês fecha em cima disso.
 */

const TIPO_PESSOA: { id: SalonPayPersonType; label: string }[] = [
  { id: 'company', label: 'Pessoa Jurídica' },
  { id: 'individual', label: 'Pessoa Física' },
];

const TIPO_EMPRESA = ['MEI', 'EI', 'LTDA', 'SLU', 'SA', 'Outro'];

const ROTULO_CAMPO: Record<string, string> = {
  cadastro: 'preencher o cadastro',
  legalName: 'Razão Social',
  companyType: 'Tipo da empresa',
  taxId: 'CNPJ/CPF',
  ownerName: 'Nome do responsável',
  email: 'E-mail',
  phone: 'Telefone',
  zipCode: 'CEP',
  street: 'Logradouro',
  number: 'Número',
  district: 'Bairro',
};

export function SalonPayDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useSalonPay();
  const save = useSaveSalonPay();
  const [erro, setErro] = useState<string | null>(null);

  const [personType, setPersonType] = useState<SalonPayPersonType>('company');
  const [legalName, setLegalName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [taxId, setTaxId] = useState('');
  const [revenue, setRevenue] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [numero, setNumero] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [acceptPix, setAcceptPix] = useState(true);
  const [acceptCard, setAcceptCard] = useState(true);

  // Carrega o que já existe ao abrir. Sem isto o salão reabriria o drawer e
  // veria o formulário em branco, achando que perdeu o cadastro.
  const conta = state.data?.account;
  useEffect(() => {
    if (!open || !conta) return;
    setPersonType(conta.personType);
    setLegalName(conta.legalName ?? '');
    setCompanyType(conta.companyType ?? '');
    setTaxId(conta.taxId ?? '');
    setRevenue(conta.revenue ? String(Number(conta.revenue)) : '');
    setOwnerName(conta.ownerName ?? '');
    setEmail(conta.email ?? '');
    setPhone(conta.phone ?? '');
    setZipCode(conta.zipCode ?? '');
    setStreet(conta.street ?? '');
    setNumero(conta.number ?? '');
    setDistrict(conta.district ?? '');
    setCity(conta.city ?? '');
    setUf(conta.state ?? '');
    setAcceptPix(conta.acceptPix);
    setAcceptCard(conta.acceptCard);
  }, [open, conta]);

  const pj = personType === 'company';

  async function salvar() {
    setErro(null);
    const valor = revenue.replace(/\./g, '').replace(',', '.');
    try {
      await save.mutateAsync({
        personType,
        legalName: legalName.trim() || undefined,
        companyType: companyType || undefined,
        taxId: taxId.trim() || undefined,
        revenue: valor ? Number(valor) : undefined,
        ownerName: ownerName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        street: street.trim() || undefined,
        number: numero.trim() || undefined,
        district: district.trim() || undefined,
        city: city.trim() || undefined,
        state: uf.trim() || undefined,
        acceptPix,
        acceptCard,
      });
      onClose();
    } catch (err) {
      setErro(apiErrorMessage(err));
    }
  }

  const faltando = state.data?.missing ?? [];

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="SalonPay"
      widthClass="sm:w-[560px]"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onPress={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onPress={() =>
              window.open('https://wa.me/5589994331471?text=Preciso%20de%20ajuda%20com%20o%20SalonPay', '_blank')
            }
          >
            <IconWhatsApp size={16} /> Suporte
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={save.isPending}
            onPress={salvar}
          >
            {save.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      }
    >
      {state.isLoading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-primary/5 px-4 py-3 text-center text-sm text-foreground">
            Informe alguns dados para começar a receber os pagamentos online.
          </p>

          {/* O estado real do cadastro, sem eufemismo. */}
          {state.data && !state.data.canSettle && (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs text-foreground">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {state.data.complete
                  ? 'Cadastro completo. A conexão com o adquirente ainda não está ativa, então os pagamentos feitos por aqui são REGISTRADOS, mas o dinheiro não é transferido automaticamente.'
                  : faltando.length === 1 && faltando[0] === 'cadastro'
                    ? 'Preencha os campos abaixo e salve para habilitar o recebimento.'
                    : `Ainda falta: ${faltando.map((f) => ROTULO_CAMPO[f] ?? f).join(', ')}.`}
              </span>
            </div>
          )}

          <Campo label="Tipo de pessoa" obrigatorio>
            <Select
              aria-label="Tipo de pessoa"
              selectedKey={personType}
              onSelectionChange={(k) => setPersonType(String(k) as SalonPayPersonType)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {TIPO_PESSOA.map((o) => (
                    <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                      {o.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Campo>

          <Secao titulo={pj ? 'Detalhes da empresa' : 'Detalhes do titular'} />

          {pj ? (
            <>
              <Campo
                label="Razão Social"
                obrigatorio
                ajuda="O nome empresarial é o nome registrado na Receita Federal, e pode ser encontrado no contrato social da empresa ou em documentos oficiais."
              >
                <TextField value={legalName} onChange={setLegalName} aria-label="Razão Social">
                  <Input placeholder="Razão Social" />
                </TextField>
              </Campo>

              <Campo label="Tipo da empresa" obrigatorio>
                <Select
                  aria-label="Tipo da empresa"
                  selectedKey={companyType || null}
                  onSelectionChange={(k) => setCompanyType(k ? String(k) : '')}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ selectedText }) => selectedText || 'Tipo da empresa'}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {TIPO_EMPRESA.map((t) => (
                        <ListBox.Item key={t} id={t} textValue={t}>
                          {t}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Campo>
            </>
          ) : (
            <Campo label="Nome do responsável" obrigatorio>
              <TextField value={ownerName} onChange={setOwnerName} aria-label="Nome do responsável">
                <Input placeholder="Nome completo" />
              </TextField>
            </Campo>
          )}

          <Campo label={pj ? 'CNPJ' : 'CPF'} obrigatorio>
            <TextField value={taxId} onChange={setTaxId} aria-label={pj ? 'CNPJ' : 'CPF'}>
              <Input placeholder={pj ? '00.000.000/0000-00' : '000.000.000-00'} inputMode="numeric" />
            </TextField>
          </Campo>

          <Campo label="Faturamento">
            <TextField value={revenue} onChange={setRevenue} aria-label="Faturamento">
              <Input placeholder="0,00" inputMode="decimal" />
            </TextField>
          </Campo>

          <Campo label="E-mail" obrigatorio>
            <TextField value={email} onChange={setEmail} aria-label="E-mail">
              <Input placeholder="voce@salao.com.br" type="email" />
            </TextField>
          </Campo>

          <Campo label="Telefone" obrigatorio>
            <TextField value={phone} onChange={setPhone} aria-label="Telefone">
              <Input placeholder="+55 (00) 00000-0000" inputMode="tel" />
            </TextField>
          </Campo>

          <Secao titulo="Endereço" />

          <div className="grid grid-cols-2 gap-3">
            <Campo label="CEP" obrigatorio>
              <TextField value={zipCode} onChange={setZipCode} aria-label="CEP">
                <Input placeholder="00000-000" inputMode="numeric" />
              </TextField>
            </Campo>
            <Campo label="Número" obrigatorio>
              <TextField value={numero} onChange={setNumero} aria-label="Número">
                <Input placeholder="123" />
              </TextField>
            </Campo>
          </div>

          <Campo label="Logradouro" obrigatorio>
            <TextField value={street} onChange={setStreet} aria-label="Logradouro">
              <Input placeholder="Rua / Avenida" />
            </TextField>
          </Campo>

          <Campo label="Bairro" obrigatorio>
            <TextField value={district} onChange={setDistrict} aria-label="Bairro">
              <Input placeholder="Bairro" />
            </TextField>
          </Campo>

          <div className="grid grid-cols-[1fr_88px] gap-3">
            <Campo label="Cidade">
              <TextField value={city} onChange={setCity} aria-label="Cidade">
                <Input placeholder="Cidade" />
              </TextField>
            </Campo>
            <Campo label="UF">
              <TextField value={uf} onChange={setUf} aria-label="UF">
                <Input placeholder="PI" maxLength={2} />
              </TextField>
            </Campo>
          </div>

          <Secao titulo="Receber pagamentos por" />
          <div className="flex items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={acceptPix}
                onChange={(e) => setAcceptPix(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              PIX
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={acceptCard}
                onChange={(e) => setAcceptCard(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              Cartão
            </label>
          </div>

          {erro && (
            <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {erro}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-sm font-semibold text-foreground">{titulo}</span>
      <span className="h-px flex-1 bg-[var(--color-soft-border)]" />
    </div>
  );
}

function Campo({
  label,
  obrigatorio,
  ajuda,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-foreground">
        {obrigatorio && <span className="mr-1 text-danger">*</span>}
        {label}
      </label>
      {children}
      {ajuda && <span className="text-xs text-muted">{ajuda}</span>}
    </div>
  );
}
