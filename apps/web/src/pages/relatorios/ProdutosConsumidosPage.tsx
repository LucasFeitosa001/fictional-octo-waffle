import { InventoryReportShell } from './reportNav';
import { GenericReport } from './GenericReport';

export function ProdutosConsumidosPage() {
  return (
    <InventoryReportShell activeKey="consumed" title="Produtos Consumidos" subtitle="Produtos usados em serviços no período">
      <GenericReport
        endpoint="consumed-products"
        columns={[
          { key: 'name', label: 'Produto' },
          { key: 'qtd', label: 'Qtde', kind: 'number', align: 'right' },
          { key: 'custo', label: 'Custo', kind: 'money', align: 'right' },
        ]}
        totalCols={{ qtd: 'qtd', custo: 'custo' }}
      />
    </InventoryReportShell>
  );
}
