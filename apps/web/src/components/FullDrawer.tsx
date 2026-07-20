import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';

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
}: {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  sections: Section[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  sidebarWidth?: string;
}) {
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      {/* panel — quase fullscreen (100% mobile, 1200px desktop) sliding from right */}
      <div
        ref={panelRef}
        className={[
          'absolute bottom-0 right-0 top-0 flex h-dvh w-full flex-col border-l border-line bg-warm-white shadow-[var(--shadow-pop)]',
          widthClass,
          'transform-gpu transition-transform duration-[380ms] will-change-transform [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]',
          show ? 'translate-x-0' : 'translate-x-full',
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
        {/* BODY: menu vertical + conteúdo */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Menu vertical (esconde em mobile, aparece como scrollable-horizontal top se preciso) */}
          <nav className={['shrink-0 overflow-y-auto border-r border-line bg-canvas py-3', 'hidden md:block', sidebarWidth].join(' ')}>
            <ul className="flex flex-col">
              {sections.map((s) => {
                const active = s.key === activeSection;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      disabled={s.disabled}
                      onClick={() => onSectionChange(s.key)}
                      className={[
                        'group relative flex w-full items-center gap-2 px-5 py-2.5 text-sm text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                        active
                          ? 'bg-white font-semibold text-primary'
                          : 'text-ink hover:bg-white/60',
                      ].join(' ')}
                    >
                      {/* indicador vertical à esquerda (barra colorida) */}
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                      )}
                      <span className="flex-1">{s.label}</span>
                      {s.badge}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* Menu horizontal (mobile) */}
          <nav className="shrink-0 overflow-x-auto border-b border-line bg-canvas md:hidden">
            <ul className="flex">
              {sections.map((s) => {
                const active = s.key === activeSection;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      disabled={s.disabled}
                      onClick={() => onSectionChange(s.key)}
                      className={[
                        'flex-shrink-0 px-4 py-3 text-sm whitespace-nowrap transition-colors',
                        active ? 'border-b-2 border-primary font-semibold text-primary' : 'text-muted-ink',
                      ].join(' ')}
                    >
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {/* Conteúdo da seção */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </div>
        </div>
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
