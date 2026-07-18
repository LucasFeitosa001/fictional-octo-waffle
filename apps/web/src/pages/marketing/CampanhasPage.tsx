import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconSend, IconMegaphone } from '../../components/icons';

export function CampanhasPage() {
  return (
    <ModulePlaceholder
      title="Campanhas"
      subtitle="Disparos e campanhas de relacionamento"
      icon={<IconSend size={30} />}
      statusLabel="Em configuração"
      description="Crie campanhas de mensagens para reengajar clientes — aniversários, retorno, lembretes e ofertas. O módulo está sendo preparado e nenhuma campanha foi criada ainda."
      bullets={[
        'Segmentação por histórico e frequência',
        'Mensagens por WhatsApp e outros canais',
        'Acompanhamento de envios e resultados',
      ]}
      primaryAction={{
        label: 'Ver promoções',
        to: '/marketing/promocoes',
        icon: <IconMegaphone size={16} />,
      }}
      note="As promoções ativas já podem ser criadas na página de Promoções."
    />
  );
}
