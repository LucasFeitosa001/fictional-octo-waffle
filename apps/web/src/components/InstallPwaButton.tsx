import { useEffect, useState } from 'react';
import { IconDownload } from './icons';

// O evento beforeinstallprompt não está nos tipos padrão do DOM.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Botão "Instalar app" (PWA). Captura o `beforeinstallprompt` que o navegador
 * dispara quando o app é instalável (SW + manifest + HTTPS) e, no clique, abre
 * o prompt NATIVO de instalação (Android/Samsung/Chrome). Não renderiza nada
 * quando o app já está instalado (standalone) ou quando o navegador não expõe o
 * evento (iOS Safari usa "Adicionar à Tela de Início" pelo próprio menu).
 * Fica no rodapé do sidebar.
 */
export function InstallPwaButton({ collapsed = false }: { collapsed?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // impede o mini-infobar automático; usamos nosso botão
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Instalar app"
        title="Instalar app"
        className="grid h-10 w-full place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10"
      >
        <IconDownload size={18} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={install}
      className="mx-2.5 flex w-[calc(100%-1.25rem)] items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
    >
      <IconDownload size={16} /> Instalar app
    </button>
  );
}
