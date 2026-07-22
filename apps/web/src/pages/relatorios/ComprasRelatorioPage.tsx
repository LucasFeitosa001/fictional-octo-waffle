import { InventoryReportShell } from './reportNav';
import { GenericReport } from './GenericReport';

export function ComprasRelatorioPage() {
  return (
    <InventoryReportShell activeKey="purchases" title="Compras" subtitle="Compras por fornecedor no período">
      <GenericReport
        endpoint="purchases"
        columns={[
          { key: 'supplier', label: 'Fornecedor' },
          { key: 'count', label: 'Compras', kind: 'number', align: 'right' },
          { key: 'total', label: 'Total', kind: 'money', align: 'right' },
        ]}
        totalCols={{ count: 'count', total: 'total' }}
      />
    </InventoryReportShell>
  );
}
