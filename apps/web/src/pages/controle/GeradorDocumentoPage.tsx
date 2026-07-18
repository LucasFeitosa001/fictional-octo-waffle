import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconCopy } from '../../components/icons';

export function GeradorDocumentoPage() {
  return (
    <ModulePlaceholder
      title="Gerador de documento"
      subtitle="Modelos de documentos e contratos"
      icon={<IconCopy size={30} />}
      statusLabel="Em configuração"
      description="Crie modelos de documentos — contratos, termos, recibos e declarações — com campos que são preenchidos automaticamente com os dados do cliente e do atendimento. Nenhum modelo foi criado ainda."
      bullets={[
        'Modelos com variáveis de cliente, serviço e valores',
        'Geração em PDF pronta para assinatura',
        'Reaproveitamento entre atendimentos',
      ]}
      note="Este recurso será habilitado assim que a configuração de modelos estiver disponível."
    />
  );
}
