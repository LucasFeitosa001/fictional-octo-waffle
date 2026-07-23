import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { IconLock, IconSparkles } from './icons';
import { useFeature, type FeatureKey } from '../lib/queries/features';
import { usePlans, findPlanForFeature, findFeatureMeta } from '../lib/queries/plans';

/**
 * FASE 2 — paid modules / feature gating (client side).
 *
 * <FeatureGate feature="messaging"> renders its children only when the logged-in
 * company's plan includes `feature`. Otherwise it renders `fallback` (or a
 * default <UpsellCard feature="messaging"> when no fallback is given) — the
 * upsell explains exactly what that feature delivers and in which plan it lives.
 *
 * FAIL-OPEN: `useFeature` returns true while loading or on error, so children
 * render normally during a network blip — the upsell only shows when we KNOW the
 * feature is missing.
 */
export interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  /** Custom UI shown when the feature is missing. Defaults to <UpsellCard>. */
  fallback?: ReactNode;
  /** Overrides the default upsell copy when no explicit fallback is provided. */
  title?: string;
  description?: ReactNode;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  title,
  description,
}: FeatureGateProps) {
  const enabled = useFeature(feature);
  if (enabled) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <UpsellCard feature={feature} title={title} description={description} />;
}

/**
 * Reusable upsell surface, in the app's warm-white card style. Use standalone or
 * as the default <FeatureGate> fallback.
 *
 * When given a `feature`, it pulls that feature's real label + description and
 * the plan it unlocks in from GET /plans, so the copy is specific ("Mensagens
 * automáticas — lembretes e campanhas de WhatsApp — disponível no plano Pro")
 * instead of generic. The primary button always routes to /perfil/assinatura.
 */
export interface UpsellCardProps {
  /** The locked feature — drives the label/description/plan copy. */
  feature?: FeatureKey;
  /** Explicit overrides (fall back to the feature's catalog metadata). */
  title?: string;
  description?: ReactNode;
  /** Small badge/eyebrow above the title. */
  eyebrow?: string;
  className?: string;
}

export function UpsellCard({
  feature,
  title,
  description,
  eyebrow,
  className,
}: UpsellCardProps) {
  const navigate = useNavigate();
  const { data: plans } = usePlans();

  const meta = feature ? findFeatureMeta(plans, feature) : null;
  const unlockPlan = feature ? findPlanForFeature(plans, feature) : null;

  const resolvedEyebrow =
    eyebrow ?? (unlockPlan ? `Disponível no plano ${unlockPlan.label}` : 'Plano superior');
  const resolvedTitle = title ?? meta?.label ?? 'Recurso de um plano superior';
  const resolvedDescription =
    description ??
    meta?.description ??
    'Este recurso faz parte de um plano superior — faça upgrade para desbloquear.';
  const ctaLabel = unlockPlan
    ? `Ver o plano ${unlockPlan.label}`
    : 'Ver planos';

  return (
    <div
      className={[
        'flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-soft-border)] bg-warm-white px-6 py-10 text-center shadow-[var(--shadow-card)]',
        className ?? '',
      ].join(' ')}
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream text-muted-ink">
        <IconLock size={26} />
      </span>

      <div className="flex items-center gap-1.5">
        <span className="rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
          {resolvedEyebrow}
        </span>
      </div>

      <h3 className="text-lg font-bold text-foreground">{resolvedTitle}</h3>
      <p className="max-w-md text-sm leading-snug text-muted-ink">
        {resolvedDescription}
      </p>

      <Button
        variant="primary"
        className="mt-1 gap-2"
        onClick={() => navigate('/perfil/assinatura')}
      >
        <IconSparkles size={16} />
        {ctaLabel}
      </Button>
    </div>
  );
}
