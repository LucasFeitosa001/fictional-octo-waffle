import { ModulePlaceholder } from '../shared/ModulePlaceholder';
import { IconUserPlus, IconScissors } from '../../components/icons';

export function ConvidarProfissionaisPage() {
  return (
    <ModulePlaceholder
      title="Convidar profissionais"
      subtitle="Traga sua equipe para o Salonpass"
      icon={<IconUserPlus size={30} />}
      statusLabel="Em configuração"
      description="O convite por link e e-mail para que profissionais acessem a própria agenda e comissões está em preparação. Por enquanto, você mesmo pode cadastrar os profissionais da equipe e definir serviços e horários."
      bullets={[
        'Convite por e-mail com acesso próprio à agenda',
        'Cada profissional acompanha suas comissões',
        'Permissões e horários definidos pelo salão',
      ]}
      primaryAction={{
        label: 'Cadastrar profissional',
        to: '/profissionais?new=1',
        icon: <IconScissors size={16} />,
      }}
      secondaryAction={{
        label: 'Ver equipe',
        to: '/profissionais',
      }}
      note="Os profissionais cadastrados já aparecem na agenda e no cálculo de comissões."
    />
  );
}
