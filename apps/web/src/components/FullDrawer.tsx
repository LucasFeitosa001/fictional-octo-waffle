import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';
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

export type Section = { key: string; label: string; badge?: ReactNode; disabled?: boolean };

export function FullDrawer({
  isOpen,
  onClose,
  title,
  sections,
  activeSection,
  onSectionChange,
  children,
  footer,
  widthClass = 'md:w-[1200px]',
  sidebarWidth = 'md:w-[220px]',
  orientation = 'horizontal',  // Belasis PADRÃO: tabs horizontais no topo. 'vertical' pra menu à esquerda.
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  sections?: Section[];  // opcional: se vazio/undefined, mostra apenas children (form único, tipo Comanda)
  activeSection?: string;
  onSectionChange?: (key: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  sidebarWidth?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => setShow(true));
      document.body.style.overflow = 'hidden';
    } else {
      setShow(false);
      document.body.style.overflow = '';
      const t = window.setTimeout(() => setMounted(false), EXIT_MS);
      return () => window.clearTimeout(t);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div
        className={[
          'absolute inset-0 cursor-pointer bg-black/40 backdrop-blur-[1px] transition-opacity duration-[380ms] ease-out',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={onClose}
      />
      {/* panel — mobile: bottom-sheet sobe (translate-y). desktop: right-slide (translate-x, 1200px). */}
      <div
        ref={panelRef}
        className={[
          'absolute flex w-full flex-col border-line bg-warm-white shadow-[var(--shadow-pop)]',
          'transform-gpu transition-transform duration-[380ms] will-change-transform [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          isMobile
            ? `inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl border-t ${show ? 'translate-y-0' : 'translate-y-full'}`
            : `bottom-0 right-0 top-0 h-dvh border-l ${widthClass} ${show ? 'translate-x-0' : 'translate-x-full'}`,
        ].join(' ')}
      >
        {/* HEADER */}
        <header className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-ink hover:bg-canvas hover:text-ink"
          >
            <IconX size={20} />
          </button>
        </header>
        {/* BODY: layout depende de orientation + presença de sections */}
        {sections && sections.length > 0 && orientation === 'vertical' ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <nav className={['shrink-0 overflow-y-auto border-r border-line bg-canvas py-3', 'hidden md:block', sidebarWidth].join(' ')}>
              <ul className="flex flex-col">
                {sections.map((s) => {
                  const active = s.key === activeSection;
                  return (
                    <li key={s.key}>
                      <button type="button" disabled={s.disabled} onClick={() => onSectionChange?.(s.key)}
                        className={['group relative flex w-full items-center gap-2 px-5 py-2.5 text-sm text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                          active ? 'bg-white font-semibold text-primary' : 'text-ink hover:bg-white/60'].join(' ')}>
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />}
                        <span className="flex-1">{s.label}</span>{s.badge}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
            </div>
          </div>
        ) : sections && sections.length > 0 ? (
          // HORIZONTAL: tabs no topo (padrão Belasis desktop)
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <nav className="shrink-0 overflow-x-auto border-b border-line bg-canvas">
              <ul className="flex">
                {sections.map((s) => {
                  const active = s.key === activeSection;
                  return (
                    <li key={s.key}>
                      <button type="button" disabled={s.disabled} onClick={() => onSectionChange?.(s.key)}
                        className={['relative flex-shrink-0 px-5 py-3 text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                          active ? 'font-semibold text-primary' : 'text-muted-ink hover:text-ink'].join(' ')}>
                        <span>{s.label}</span>{s.badge}
                        {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </div>
        ) : (
          // SEM sections: form único scrollable (Comandas)
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        )}
        {/* FOOTER sticky */}
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-warm-white px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
