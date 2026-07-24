import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CreateKind } from './PageActions';
// Create-drawers live inside their pages (eager-loaded in App.tsx — no React.lazy),
// so importing them here does NOT break code-splitting. The page-local drawers
// (FAB "+") stay intact; this host is a SECOND instance used only by the global
// "Novo" dropdown / mobile sheet. Only one create flow is open at a time.
import { CustomerCreateModal } from '../pages/ClientePerfilTabs';
import { ProfessionalDrawer } from '../pages/ProfissionaisPage';
import { ServiceDrawer } from '../pages/ServicosPage';
import { ProductDrawer } from '../pages/ProdutosPage';
import { CategoryModal } from '../pages/CategoriasPage';
import { SupplierDrawer } from '../pages/FornecedoresPage';
import { BrandDrawer } from '../pages/MarcasPage';
import { NovoComandaDrawer } from '../pages/ComandasPage';
import { LancamentoModal, TransferenciaModal } from '../pages/financeiro/TransacoesPage';
import { NewAppointmentModal } from '../components/NewAppointmentModal';
import { useBrands, useProductCategories } from '../lib/queries/catalogo';

export type { CreateKind };

// ─── Context ────────────────────────────────────────────────────────────────
type CreateDrawerContextValue = {
  openKind: CreateKind | null;
  openCreate: (kind: CreateKind) => void;
  closeCreate: () => void;
};

const CreateDrawerContext = createContext<CreateDrawerContextValue | null>(null);

export function CreateDrawerProvider({ children }: { children: ReactNode }) {
  const [openKind, setOpenKind] = useState<CreateKind | null>(null);
  const value = useMemo<CreateDrawerContextValue>(
    () => ({
      openKind,
      openCreate: (kind: CreateKind) => setOpenKind(kind),
      closeCreate: () => setOpenKind(null),
    }),
    [openKind],
  );
  return <CreateDrawerContext.Provider value={value}>{children}</CreateDrawerContext.Provider>;
}

export function useCreateDrawer(): CreateDrawerContextValue {
  const ctx = useContext(CreateDrawerContext);
  if (!ctx) {
    throw new Error('useCreateDrawer must be used within a <CreateDrawerProvider>');
  }
  return ctx;
}

// Keep the host mounted a touch longer than the drawer exit animation (380ms)
// so the closing slide-out plays before we tear the drawers down.
const EXIT_GRACE_MS = 420;

// ─── Host ─────────────────────────────────────────────────────────────────
/**
 * Renders EVERY create-drawer, wired to the global create context. Opening a
 * "Novo" item calls `openCreate(kind)` (imperative — NO navigation, NO ?new=1),
 * so it never collides with the pages' own useAutoCreate(?new=1) deep-link
 * handling (which stays the single owner of the URL-driven flow).
 *
 * To avoid running the drawers' internal queries on every page, the drawers are
 * only mounted while a create flow is active (openKind != null), plus a short
 * grace window so exit animations finish. Drawer/FullDrawer both animate their
 * entrance even when mounted already-open, so lazy-mounting keeps the animation.
 */
export function CreateDrawerHost() {
  const { openKind } = useCreateDrawer();
  const [render, setRender] = useState(openKind != null);

  useEffect(() => {
    if (openKind != null) {
      setRender(true);
      return;
    }
    const t = window.setTimeout(() => setRender(false), EXIT_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [openKind]);

  if (!render) return null;
  return <CreateDrawerHostContent />;
}

function CreateDrawerHostContent() {
  const { openKind, closeCreate } = useCreateDrawer();

  const productCategories = useProductCategories();
  const brands = useBrands();

  const productCategoryOptions = useMemo(
    () => (productCategories.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    [productCategories.data],
  );
  const brandOptions = useMemo(
    () => (brands.data ?? []).map((b) => ({ id: b.id, name: b.name })),
    [brands.data],
  );

  return (
    <>
      {/* Cadastros — all isOpen-driven, safe to keep mounted with isOpen toggled. */}
      <CustomerCreateModal isOpen={openKind === 'cliente'} onClose={closeCreate} />
      <ProfessionalDrawer mode="create" isOpen={openKind === 'profissional'} onClose={closeCreate} />
      <ServiceDrawer
        mode="create"
        isOpen={openKind === 'servico'}
        onClose={closeCreate}
        categories={productCategoryOptions}
      />
      <ProductDrawer
        mode="create"
        isOpen={openKind === 'produto'}
        onClose={closeCreate}
        categories={productCategoryOptions}
        brands={brandOptions}
      />
      <CategoryModal mode="create" isOpen={openKind === 'categoria'} onClose={closeCreate} />
      <SupplierDrawer mode="create" isOpen={openKind === 'fornecedor'} onClose={closeCreate} />
      <BrandDrawer mode="create" isOpen={openKind === 'marca'} onClose={closeCreate} />

      {/* Principal */}
      <NovoComandaDrawer isOpen={openKind === 'comanda'} onClose={closeCreate} />
      {/* NewAppointmentModal uses onOpenChange, not onClose — adapt close. */}
      <NewAppointmentModal
        isOpen={openKind === 'agendamento'}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
      />

      {/* Financeiro — LancamentoModal is MOUNT-controlled (no isOpen prop, its
          FullDrawer is hardcoded open), so it MUST be rendered conditionally,
          only while its kind is active. */}
      {openKind === 'despesa' && (
        <LancamentoModal mode="despesa" editing={null} onClose={closeCreate} />
      )}
      {openKind === 'receita' && (
        <LancamentoModal mode="recebimento" editing={null} onClose={closeCreate} />
      )}
      {openKind === 'vale' && (
        <LancamentoModal mode="vale" editing={null} onClose={closeCreate} />
      )}
      {/* TransferenciaModal is isOpen-driven — toggle for a proper exit slide. */}
      <TransferenciaModal isOpen={openKind === 'transferencia'} onClose={closeCreate} />
    </>
  );
}
