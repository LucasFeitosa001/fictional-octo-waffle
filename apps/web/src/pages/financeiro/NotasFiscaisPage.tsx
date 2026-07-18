import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconReceipt, IconSettings } from '../../components/icons';

export function NotasFiscaisPage() {
  return (
    <ModulePlaceholder
      title="Notas Fiscais"
      subtitle="Emissão e acompanhamento de notas fiscais"
      icon={<IconReceipt size={30} />}
      statusLabel="Em configuração"
      description="A emissão de notas fiscais (NFS-e e NFC-e) exige a integração com o provedor fiscal e os dados fiscais da empresa. Configure a integração para começar a emitir notas — nenhuma nota foi emitida ainda."
      bullets={[
        'Emissão de NFS-e para serviços e NFC-e para produtos',
        'Vínculo automático com comandas finalizadas',
        'Histórico e reenvio de notas emitidas',
      ]}
      primaryAction={{
        label: 'Configurações financeiras',
        to: '/financeiro/configuracoes',
        icon: <IconSettings size={16} />,
      }}
      note="A integração fiscal é habilitada nas configurações financeiras da empresa."
    />
  );
}
