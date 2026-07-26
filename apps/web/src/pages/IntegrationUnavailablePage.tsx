import { Button } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/States';
import { IconLock } from '../components/icons';

export function IntegrationUnavailablePage({
  title,
  description,
  backTo = '/painel',
}: {
  title: string;
  description: string;
  backTo?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-line bg-card px-5 shadow-[var(--shadow-card)]">
      <EmptyState
        icon={<IconLock size={34} />}
        title={title}
        description={description}
        action={
          <Button variant="outline" onClick={() => navigate(backTo)}>
            Voltar
          </Button>
        }
      />
    </div>
  );
}
