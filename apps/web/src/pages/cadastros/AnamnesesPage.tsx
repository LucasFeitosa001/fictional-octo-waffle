import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconMessage, IconUsers } from '../../components/icons';

export function AnamnesesPage() {
  return (
    <ModulePlaceholder
      title="Anamneses"
      subtitle="Fichas e questionários de anamnese dos clientes"
      icon={<IconMessage size={30} />}
      statusLabel="Em configuração"
      description="As fichas de anamnese permitem registrar histórico de saúde, alergias, contraindicações e assinatura do cliente antes dos procedimentos. Este módulo está sendo preparado — nenhum modelo foi cadastrado ainda."
      bullets={[
        'Modelos de ficha por tipo de procedimento',
        'Preenchimento no atendimento e histórico por cliente',
        'Termos de consentimento com assinatura',
      ]}
      primaryAction={{
        label: 'Ir para Clientes',
        to: '/clientes',
        icon: <IconUsers size={16} />,
      }}
      note="Enquanto o módulo é configurado, o histórico dos clientes continua disponível na ficha de cada cliente."
    />
  );
}
