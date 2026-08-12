import { Link } from 'react-router-dom';
import { Button } from '@heroui/react';
import { EmptyState } from '../../components/States';
import { IconLock } from '../../components/icons';
import { useFeatures } from '../../lib/queries/features';

/**
 * Emissão fiscal — a tela existe, o módulo ainda não.
 *
 * Não há NADA de NF-e no backend, e `NotasFiscaisPage.tsx` é uma maquete de 782
 * linhas sem uma única chamada de API — por isso a rota já apontava para um
 * aviso.
 *
 * O dono pediu DUAS mensagens conforme o plano de quem chega, e a distinção
 * muda o que a pessoa tem a fazer:
 *
 *  - quem NÃO tem o plano Max precisa subir de plano (a NF-e é módulo do Max no
 *    catálogo). É o caso do La Belle de Jour, que está no Pro;
 *  - quem JÁ tem o Max não tem o que contratar — para essa pessoa o pendente é a
 *    integração fiscal, e mandá-la "assinar o Max" seria mentira.
 *
 * Ver estudo 122.
 */
export function NotasFiscaisBloqueioPage() {
  const { data } = useFeatures();
  // `features` traz o que a empresa REALMENTE tem. `nfe` só existe no plano Max,
  // então responde "esta pessoa já está no plano certo?".
  const temPlanoComNfe = (data?.features ?? []).includes('nfe');

  return (
    <div className="rounded-2xl border border-line bg-card px-5 shadow-[var(--shadow-card)]">
      <EmptyState
        icon={<IconLock size={34} />}
        title={
          temPlanoComNfe
            ? 'Emissão fiscal ainda não configurada'
            : 'Emissão fiscal está no plano Max'
        }
        description={
          temPlanoComNfe
            ? 'Seu plano já inclui a emissão fiscal, mas ela ainda depende da integração com um provedor. Fale com o suporte para acompanhar a liberação — nenhuma nota é emitida por esta tela.'
            : 'A emissão de notas fiscais faz parte do plano Max. No seu plano atual ela não está disponível — veja em Adicionais o que muda ao subir de plano.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              to="/perfil/adicionais"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {temPlanoComNfe ? 'Ver meus módulos' : 'Ver planos e adicionais'}
            </Link>
            <Button variant="outline" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </div>
        }
      />
    </div>
  );
}
