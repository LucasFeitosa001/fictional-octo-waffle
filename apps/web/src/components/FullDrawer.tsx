import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Tabs } from '@heroui/react';
import { IconChevron, IconLayers, IconX } from './icons';
import { IconTip } from './IconTip';
import { useIsMobile } from '../hooks/useIsMobile';

// FullDrawer — drawer QUASE FULLSCREEN estilo Belasis (1200px+):
//   ┌──────────────────────────────────────────────────────────┐
//   │ [Título]                                             [X] │
//   ├────────────────┬─────────────────────────────────────────┤
//   │ ▎ Cadastro     │                                         │
//   │   Endereço     │        (conteúdo da seção)              │
//   │   Usuário      │                                         │
//   │   Expediente   │                                         │
//   │   ...          │                                         │
//   ├────────────────┴─────────────────────────────────────────┤
//   │                            [Ajuda] [Cancelar] [Salvar]    │
//   └──────────────────────────────────────────────────────────┘
//
// Usado por drawers de EDITAR/VISUALIZAR do Belasis (Comanda, Cliente, Profissional,
// Serviço, Produto…). NÃO usado por drawers curtos (Marcas, Categorias, Confirmar).
//
// Uso:
//   <FullDrawer
//     isOpen={open} title="Editando comanda #3327" onClose={close}
//     sections={[{ key: 'cliente', label: 'Cliente' }, ...]}
//     activeSection={sec} onSectionChange={setSec}
//     footer={<><Button>Cancelar</Button><Button>Salvar</Button></>}
//   >
//     {sec === 'cliente' && <ClienteForm/>}
//     {sec === 'itens' && <ItensList/>}
//   </FullDrawer>

const EXIT_MS = 380;

export type Section = {
  key: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
};

function DrawerSectionTabs({
  sections,
  activeSection,
  onSectionChange,
  orientation,
  className,
  listContainerClassName,
}: {
  sections: Section[];
  activeSection?: string;
  onSectionChange?: (key: string) => void;
  orientation: 'horizontal' | 'vertical';
  className?: string;
  listContainerClassName?: string;
}) {
  return (
    <Tabs
      selectedKey={activeSection}
      onSelectionChange={(key) => onSectionChange?.(String(key))}
      orientation={orientation}
      variant="secondary"
      className={className}
    >
      <Tabs.ListContainer
        className={[
          'max-w-full overflow-auto bg-canvas p-2',
          orientation === 'horizontal' ? 'border-b border-line' : 'h-full border-r border-line',
          listContainerClassName ?? '',
        ].join(' ')}
      >
        <Tabs.List
          aria-label="Seções do formulário"
          className={orientation === 'vertical' ? 'flex min-w-full flex-col gap-1' : 'min-w-max gap-1'}
        >
          {sections.map((section) => (
            <Tabs.Tab
              key={section.key}
              id={section.key}
              isDisabled={section.disabled}
              className={[
                'group inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-ink transition-[color,background-color,box-shadow,transform] duration-200 hover:bg-card hover:text-ink data-[selected]:bg-card data-[selected]:text-primary data-[selected]:shadow-[var(--shadow-soft)] active:scale-[0.99]',
                orientation === 'vertical' ? 'w-full justify-start' : 'shrink-0',
              ].join(' ')}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-warm-white text-muted-ink transition-colors group-data-[selected]:bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] group-data-[selected]:text-primary">
                {section.icon ?? <IconLayers size={15} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
              {section.badge}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

export function FullDrawer({
  isOpen,
  onClose,
  title,
  sections,
  activeSection,
  onSectionChange,
  children,
  footer,
  sidebarWidth = 'md:w-[220px]',
  orientation = 'horizontal',  // Belasis PADRÃO: tabs horizontais no topo. 'vertical' pra menu à esquerda.
  widthClass,
  mobileBackLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  sections?: Section[];  // opcional: se vazio/undefined, mostra apenas children (form único, tipo Comanda)
  activeSection?: string;
  onSectionChange?: (key: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  sidebarWidth?: string;
  orientation?: 'horizontal' | 'vertical';
  /**
   * Desktop: se informado (ex. "sm:w-[600px]"), o drawer vira LATERAL —
   * desliza da direita com essa largura em vez de ocupar a tela inteira.
   * Sem `widthClass` mantém o comportamento full-screen padrão. Não afeta mobile.
   */
  widthClass?: string;
  /** Mobile only: replaces the close icon with a contextual back action. */
  mobileBackLabel?: string;
}) {
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      // Monta fechado (translate-y-full) e só no 2º frame vira aberto —
      // DOUBLE requestAnimationFrame garante que o estado fechado PINTA antes
      // de flipar pra aberto, senão os dois estados caem no mesmo frame e a
      // transição de entrada não roda (o drawer "aparece" sem subir). Mesmo
      // padrão do Drawer.tsx.
      setShow(false);
      setMounted(true);
      document.body.style.overflow = 'hidden';
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShow(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        document.body.style.overflow = '';
      };
    }
    setShow(false);
    document.body.style.overflow = '';
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharPeloUsuario(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  /**
   * BOTÃO VOLTAR fecha este drawer em vez de sair da página. Mesma correção do
   * Drawer.tsx — ver estudo 166. Sem isto, abrir um produto/cliente não criava
   * entrada no histórico e o voltar saía da tela inteira, caindo numa página
   * que dependia do caminho percorrido antes (parecia aleatório).
   */
  const entradaEmpilhada = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ spDrawer: true }, '');
    entradaEmpilhada.current = true;
    const onPop = () => {
      entradaEmpilhada.current = false;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** X, ESC e clique no fundo consomem a entrada empilhada. */
  function fecharPeloUsuario() {
    if (entradaEmpilhada.current) {
      entradaEmpilhada.current = false;
      window.history.back();
      return;
    }
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div
        className={[
          'absolute inset-0 cursor-pointer bg-black/40 backdrop-blur-[1px] transition-opacity duration-[380ms] ease-out',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={fecharPeloUsuario}
      />
      {/* panel — mobile: bottom-sheet sobe (translate-y). desktop: tela cheia
          (inset-0); só vira faixa lateral deslizante quando `widthClass` é
          passado, o que é a exceção, não a regra. */}
      <div
        ref={panelRef}
        className={[
          // `sp-drawer-panel`: âncora usada pelo index.css para dar bordas/altura
          // de toque a inputs/selects dentro de qualquer drawer (mobile-first).
          'sp-drawer-panel absolute flex w-full flex-col border-line bg-warm-white shadow-[var(--shadow-pop)]',
          'transform-gpu transition-transform duration-[380ms] will-change-transform [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          isMobile
            ? `inset-0 h-dvh border-t ${show ? 'translate-y-0' : 'translate-y-full'}`
            : widthClass
              ? `bottom-0 right-0 top-0 h-dvh border-l ${widthClass} ${show ? 'translate-x-0' : 'translate-x-full'}`
              : `inset-0 h-dvh ${show ? 'translate-x-0' : 'translate-x-full'}`,
        ].join(' ')}
      >
        {/* HEADER
            No MOBILE o painel é `inset-0 h-dvh` (ancorado no topo físico), então
            o header SEMPRE precisa reservar a safe-area do topo — senão o
            título/X fica sob o notch no PWA instalado (standalone). Usamos
            `var(--sp-safe-top)` (pega o +0.5rem do standalone) em vez de
            `env(...)` cru, igual ao MobileBackHeader. Vale COM e SEM
            `mobileBackLabel` (antes o ramo `else` = `py-4` não reservava nada).
            No desktop o header é normal (`px-6 py-4`); no Safari com URL bar a
            inset é 0 e tudo cai no piso normal. */}
        <header
          className={[
            'shrink-0 border-b border-line bg-warm-white',
            isMobile && mobileBackLabel
              ? 'grid min-h-14 grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center px-4 pb-2 pt-[max(0.5rem,var(--sp-safe-top))]'
              : isMobile
                ? 'flex items-center justify-between px-6 pb-4 pt-[max(1rem,var(--sp-safe-top))]'
                : 'flex items-center justify-between px-6 py-4',
          ].join(' ')}
        >
          {isMobile && mobileBackLabel ? (
            <>
              <button
                type="button"
                onClick={fecharPeloUsuario}
                aria-label={mobileBackLabel}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-primary"
              >
                <span className="rotate-90">
                  <IconChevron size={18} />
                </span>
                {mobileBackLabel}
              </button>
              <h2 className="min-w-0 truncate px-2 text-center text-sm font-semibold text-ink">
                {title}
              </h2>
              <span aria-hidden />
            </>
          ) : (
            <>
              <h2 className="min-w-0 truncate text-lg font-semibold text-ink">{title}</h2>
              <IconTip label="Fechar" placement="bottom">
                <button
                  type="button"
                  onClick={fecharPeloUsuario}
                  aria-label="Fechar"
                  className="rounded-md p-1.5 text-muted-ink hover:bg-canvas hover:text-ink"
                >
                  <IconX size={20} />
                </button>
              </IconTip>
            </>
          )}
        </header>
        {/* BODY: layout depende de orientation + presença de sections */}
        {sections && sections.length > 0 && orientation === 'vertical' ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <DrawerSectionTabs
              sections={sections}
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              orientation="vertical"
              className={['hidden h-full shrink-0 md:block', sidebarWidth].join(' ')}
              listContainerClassName="py-3"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <DrawerSectionTabs
                sections={sections}
                activeSection={activeSection}
                onSectionChange={onSectionChange}
                orientation="horizontal"
                className="shrink-0 md:hidden"
              />
              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
            </div>
          </div>
        ) : sections && sections.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DrawerSectionTabs
              sections={sections}
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              orientation="horizontal"
              className="shrink-0"
            />
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          </div>
        ) : (
          // SEM sections: form único scrollable (Comandas)
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        )}
        {/* FOOTER sticky */}
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-warm-white px-4 py-3 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
