import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconBox, IconTruck } from '../../components/icons';

export function ComprasPage() {
  return (
    <ModulePlaceholder
      title="Compras"
      subtitle="Pedidos de compra e entrada de estoque"
      icon={<IconBox size={30} />}
      statusLabel="Em configuração"
      description="O módulo de compras — pedidos a fornecedores, custos e entrada automática no estoque — está sendo preparado. Nenhum pedido de compra foi registrado ainda. Enquanto isso, as entradas de estoque podem ser lançadas direto na ficha de cada produto."
      bullets={[
        'Pedidos de compra vinculados a fornecedores',
        'Entrada de estoque com custo e nota',
        'Histórico de compras por período',
      ]}
      primaryAction={{
        label: 'Gerenciar produtos',
        to: '/produtos',
        icon: <IconBox size={16} />,
      }}
      secondaryAction={{
        label: 'Ver fornecedores',
        to: '/fornecedores',
        icon: <IconTruck size={16} />,
      }}
      note="Ajustes de estoque de entrada e saída já podem ser feitos na página de Produtos."
    />
  );
}
