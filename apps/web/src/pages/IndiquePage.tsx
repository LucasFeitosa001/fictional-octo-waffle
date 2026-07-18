import { ModulePlaceholder } from './shared/ModulePlaceholder';
import { IconShare } from '../components/icons';

export function IndiquePage() {
  return (
    <ModulePlaceholder
      title="Indique e ganhe"
      subtitle="Programa de indicação do Salonpass"
      icon={<IconShare size={30} />}
      statusLabel="Em breve"
      description="Indique o Salonpass para outros salões e profissionais e ganhe benefícios quando eles começarem a usar. O programa de indicação está sendo preparado — em breve você terá um link exclusivo para compartilhar."
      bullets={[
        'Link de indicação exclusivo da sua conta',
        'Acompanhamento das indicações realizadas',
        'Benefícios por cada indicação convertida',
      ]}
      note="Nenhuma indicação foi registrada ainda. Você será avisado quando o programa estiver disponível."
    />
  );
}
