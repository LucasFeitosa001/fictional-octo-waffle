import { useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { SalonPayDrawer } from '../../components/SalonPayDrawer';
import { LoadingState } from '../../components/States';
import { IconCreditCard, IconInfo } from '../../components/icons';
import { useSalonPay } from '../../lib/queries/salonpay';

/**
 * SalonPay — página do cadastro de recebimento, dentro de Financeiro.
 *
 * Substitui a antiga tela "SalonPay ainda não integrado", que era verdade
 * enquanto o cadastro não existia e passou a contradizer a de Comissões, onde o
 * formulário já abre.
 *
 * A página continua sendo honesta sobre o limite: cadastro salvo ≠ dinheiro
 * transferido. Enquanto não houver adquirente conectado, o SalonPay REGISTRA o
 * pagamento (quita a comissão e lança a despesa) e não transfere sozinho.
 */

const ROTULO: Record<string, string> = {
  cadastro: 'o cadastro',
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

export function SalonPayPage() {
  const state = useSalonPay();
  const [open, setOpen] = useState(false);
  const conta = state.data?.account;
  const completo = state.data?.complete ?? false;
  const podeLiquidar = state.data?.canSettle ?? false;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[1.4rem] font-bold leading-tight text-foreground sm:text-2xl">
            SalonPay
          </h1>
          <p className="text-sm text-muted">
            Cadastro de recebimento do salão — usado para receber pagamentos online e pagar
            comissões pelo SalonPay.
          </p>
        </div>
        <Button variant="primary" onPress={() => setOpen(true)}>
          <IconCreditCard size={16} />
          {conta ? 'Editar cadastro' : 'Fazer cadastro'}
        </Button>
      </div>

      {state.isLoading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Situação</span>
              <Chip
                color={podeLiquidar ? 'success' : completo ? 'warning' : 'default'}
                variant="soft"
                size="sm"
              >
                {podeLiquidar
                  ? 'Ativo'
                  : completo
                    ? 'Cadastro completo — aguardando conexão'
                    : 'Cadastro pendente'}
              </Chip>
            </div>

            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-sm text-foreground">
              <IconInfo size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {podeLiquidar ? (
                  'O SalonPay está conectado ao provedor e pode transferir os pagamentos.'
                ) : completo ? (
                  <>
                    O cadastro está completo. A conexão com o adquirente ainda não foi ativada, então
                    pagar comissão pelo SalonPay <strong>registra</strong> o pagamento (quita a
                    comissão e lança a despesa no Financeiro), mas <strong>não transfere</strong> o
                    valor automaticamente.
                  </>
                ) : (
                  <>
                    Falta preencher{' '}
                    {(state.data?.missing ?? []).map((f) => ROTULO[f] ?? f).join(', ')}. Sem o
                    cadastro completo, o SalonPay não pode ser habilitado.
                  </>
                )}
              </span>
            </div>

            {conta && (
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Linha
                  rotulo="Tipo de pessoa"
                  valor={conta.personType === 'company' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                />
                <Linha
                  rotulo={conta.personType === 'company' ? 'Razão Social' : 'Responsável'}
                  valor={conta.legalName ?? conta.ownerName}
                />
                <Linha
                  rotulo={conta.personType === 'company' ? 'CNPJ' : 'CPF'}
                  valor={formatarDoc(conta.taxId, conta.personType)}
                />
                <Linha rotulo="E-mail" valor={conta.email} />
                <Linha rotulo="Telefone" valor={conta.phone} />
                <Linha
                  rotulo="Endereço"
                  valor={
                    conta.street
                      ? `${conta.street}, ${conta.number ?? 's/n'} — ${conta.district ?? ''}`
                      : null
                  }
                />
                <Linha
                  rotulo="Recebe por"
                  valor={
                    [conta.acceptPix && 'PIX', conta.acceptCard && 'Cartão']
                      .filter(Boolean)
                      .join(' · ') || 'Nenhum meio selecionado'
                  }
                />
              </dl>
            )}
          </div>
        </div>
      )}

      <SalonPayDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/** CNPJ 00.000.000/0000-00 · CPF 000.000.000-00. Guardamos só dígitos. */
function formatarDoc(doc: string | null | undefined, tipo: string): string | null {
  const d = (doc ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (tipo === 'company' && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (tipo === 'individual' && d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return d;
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted">{rotulo}</dt>
      <dd className="text-sm text-foreground">{valor || '—'}</dd>
    </div>
  );
}
