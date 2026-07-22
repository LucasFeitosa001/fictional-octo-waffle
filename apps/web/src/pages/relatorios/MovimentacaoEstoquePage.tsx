import { InventoryReportShell } from './reportNav';
import { GenericReport } from './GenericReport';

export function MovimentacaoEstoquePage() {
  return (
    <InventoryReportShell activeKey="movements" title="Movimentação de Estoque" subtitle="Entradas e saídas por produto no período">
      <GenericReport
        endpoint="inventory-movements"
        columns={[
          { key: 'name', label: 'Produto' },
          { key: 'in', label: 'Entradas', kind: 'number', align: 'right' },
          { key: 'out', label: 'Saídas', kind: 'number', align: 'right' },
          { key: 'net', label: 'Saldo', kind: 'number', align: 'right' },
        ]}
        totalCols={{ in: 'in', out: 'out' }}
      />
    </InventoryReportShell>
  );
}
