import {
  CalendarReportShell,
  FinancialReportShell,
  InventoryReportShell,
} from './reportNav';
import { GenericReport, type ReportCol } from './GenericReport';

/* -------------------------------------------------------------------------- */
/*  Relatórios sobre dados existentes (Order/OrderItem/Transaction/Appointment  */
/*  /InventoryMovement/Purchase). Cada um bate num endpoint /reports/<x> e       */
/*  renderiza via GenericReport (Período + tabela desktop / cards mobile).       */
/* -------------------------------------------------------------------------- */

const REVENUE_COLS = (first: string): ReportCol[] => [
  { key: 'name', label: first },
  { key: 'qtd', label: 'Qtde', kind: 'number', align: 'right' },
  { key: 'bruto', label: 'Bruto', kind: 'money', align: 'right' },
  { key: 'desconto', label: 'Desconto', kind: 'money', align: 'right' },
  { key: 'liquido', label: 'Líquido', kind: 'money', align: 'right' },
];
const REVENUE_TOTALS = { qtd: 'qtd', bruto: 'bruto', desconto: 'desconto', liquido: 'liquido' };

/* ------------------------------- Financeiro ------------------------------- */

export function ResultadoServicosPage() {
  return (
    <FinancialReportShell activeKey="service" title="Resultado Líquido de Serviços" subtitle="Receita de serviços por serviço no período">
      <GenericReport endpoint="service-revenue" columns={REVENUE_COLS('Serviço')} totalCols={REVENUE_TOTALS} />
    </FinancialReportShell>
  );
}

export function ResultadoProdutosPage() {
  return (
    <FinancialReportShell activeKey="product" title="Resultado Líquido de Produtos" subtitle="Receita de produtos por produto no período">
      <GenericReport endpoint="product-revenue" columns={REVENUE_COLS('Produto')} totalCols={REVENUE_TOTALS} />
    </FinancialReportShell>
  );
}

export function ProjecaoFaturamentoPage() {
  return (
    <FinancialReportShell activeKey="projection" title="Projeção de Faturamento" subtitle="Recebimentos futuros previstos por mês">
      <GenericReport
        endpoint="billing-projection"
        hasRange={false}
        columns={[
          { key: 'month', label: 'Mês' },
          { key: 'count', label: 'Lançamentos', kind: 'number', align: 'right' },
          { key: 'total', label: 'Previsto', kind: 'money', align: 'right' },
        ]}
        totalCols={{ total: 'total', count: 'count' }}
        emptyMsg="Sem recebimentos futuros previstos."
      />
    </FinancialReportShell>
  );
}

export function RecebimentosPage() {
  return (
    <FinancialReportShell activeKey="recs" title="Recebimentos" subtitle="Entradas no período por status">
      <GenericReport
        endpoint="receivables"
        columns={[
          { key: 'label', label: 'Status' },
          { key: 'count', label: 'Qtde', kind: 'number', align: 'right' },
          { key: 'total', label: 'Total', kind: 'money', align: 'right' },
        ]}
        totalCols={{ count: 'count', total: 'total' }}
      />
    </FinancialReportShell>
  );
}

export function DespesasPage() {
  return (
    <FinancialReportShell activeKey="pays" title="Despesas" subtitle="Saídas no período por categoria">
      <GenericReport
        endpoint="expenses"
        columns={[
          { key: 'category', label: 'Categoria' },
          { key: 'count', label: 'Qtde', kind: 'number', align: 'right' },
          { key: 'total', label: 'Total', kind: 'money', align: 'right' },
        ]}
        totalCols={{ count: 'count', total: 'total' }}
      />
    </FinancialReportShell>
  );
}

/* --------------------------------- Agenda --------------------------------- */

export function AgendamentosExcluidosPage() {
  return (
    <CalendarReportShell activeKey="deleted" title="Agendamentos excluídos" subtitle="Agendamentos cancelados no período">
      <GenericReport
        endpoint="appointments-deleted"
        columns={[
          { key: 'start', label: 'Data', kind: 'datetime' },
          { key: 'customer', label: 'Cliente' },
          { key: 'professional', label: 'Profissional' },
        ]}
        emptyMsg="Nenhum agendamento cancelado no período."
      />
    </CalendarReportShell>
  );
}

export function OrigemAgendamentosPage() {
  return (
    <CalendarReportShell activeKey="origin" title="Origem dos Agendamentos" subtitle="De onde vieram os agendamentos no período">
      <GenericReport
        endpoint="appointments-origin"
        columns={[
          { key: 'label', label: 'Origem' },
          { key: 'count', label: 'Qtde', kind: 'number', align: 'right' },
        ]}
        totalCols={{ count: 'count' }}
      />
    </CalendarReportShell>
  );
}

export function CriacaoAgendamentoPage() {
  return (
    <CalendarReportShell activeKey="creation" title="Criação de Agendamento" subtitle="Agendamentos criados por dia no período">
      <GenericReport
        endpoint="appointments-creation"
        columns={[
          { key: 'date', label: 'Data', kind: 'date' },
          { key: 'count', label: 'Criados', kind: 'number', align: 'right' },
        ]}
        totalCols={{ count: 'count' }}
      />
    </CalendarReportShell>
  );
}

export function CuidadosHojePage() {
  return (
    <CalendarReportShell activeKey="care" title="Cuidados para Hoje" subtitle="Agendamentos de hoje para follow-up">
      <GenericReport
        endpoint="care-today"
        hasRange={false}
        columns={[
          { key: 'start', label: 'Horário', kind: 'datetime' },
          { key: 'customer', label: 'Cliente' },
          { key: 'phone', label: 'Telefone' },
        ]}
        emptyMsg="Nenhum agendamento para hoje."
      />
    </CalendarReportShell>
  );
}

/* --------------------------------- Estoque -------------------------------- */

export function SugestaoCompraPage() {
  return (
    <InventoryReportShell activeKey="suggestion" title="Sugestão de Compra" subtitle="Produtos abaixo do estoque mínimo">
      <GenericReport
        endpoint="inventory-suggestion"
        hasRange={false}
        columns={[
          { key: 'name', label: 'Produto' },
          { key: 'stock', label: 'Estoque', kind: 'number', align: 'right' },
          { key: 'minStock', label: 'Mínimo', kind: 'number', align: 'right' },
          { key: 'suggested', label: 'Sugerido', kind: 'number', align: 'right' },
        ]}
        emptyMsg="Nenhum produto abaixo do mínimo."
      />
    </InventoryReportShell>
  );
}
