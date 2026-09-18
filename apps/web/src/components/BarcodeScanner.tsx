import { useCallback, useEffect, useRef, useState } from 'react';
import { Drawer } from './Drawer';
import { IconQr, IconSearch } from './icons';

interface ScannerControls {
  stop(): void;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
};

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}

/**
 * Scanner do catálogo: BarcodeDetector nativo, ZXing dinâmico e, por fim,
 * digitação manual. O Drawer fica acima do ItemPickerDrawer (z-[90]).
 */
export function BarcodeScanner({ isOpen, onClose, onDetect }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const zxingControlsRef = useRef<ScannerControls | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [manualCode, setManualCode] = useState('');

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const deliver = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    if ('vibrate' in navigator) navigator.vibrate?.(80);
    stopCamera();
    onDetect(code);
    onClose();
  }, [onClose, onDetect, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setCameraAvailable(null);
    setCameraError('');
    setManualCode('');
    let cancelled = false;

    const start = async () => {
      const hasCamera = Boolean(navigator.mediaDevices?.getUserMedia);
      if (!hasCamera) {
        setCameraAvailable(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraAvailable(true);
        const video = videoRef.current;
        if (!video) return;

        const NativeBarcodeDetector =
          (window as WindowWithBarcodeDetector).BarcodeDetector;
        if (NativeBarcodeDetector) {
          // Nível 1: API nativa, mais leve nos navegadores que a oferecem.
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          const detector = new NativeBarcodeDetector({
            formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'qr_code'],
          });
          scanningRef.current = true;
          const scanFrame = async () => {
            if (!scanningRef.current || cancelled) return;
            if (video.readyState >= 2) {
              try {
                const codes = await detector.detect(video);
                const detected = codes.find((item) => item.rawValue)?.rawValue;
                if (detected) {
                  deliver(detected);
                  return;
                }
              } catch {
                // Um frame ilegível não deve interromper as próximas tentativas.
              }
            }
            window.setTimeout(scanFrame, 180);
          };
          void scanFrame();
          return;
        }

        // Nível 2: fallback para Safari/iOS. O import só pesa quando necessário.
        const { BrowserMultiFormatReader, BarcodeFormat } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 180 });
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.UPC_A,
          BarcodeFormat.QR_CODE,
        ];
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result: { getText(): string } | undefined) => {
            const detected = result?.getText();
            if (detected && !cancelled) deliver(detected);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch (error) {
        stopCamera();
        setCameraAvailable(false);
        setCameraError(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Permita o acesso à câmera para escanear.'
            : 'Não foi possível abrir a câmera neste dispositivo.',
        );
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [deliver, isOpen, stopCamera]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [isOpen, onClose]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Escanear produto"
      widthClass="sm:w-[480px]"
      zClass="z-[110]"
      mobileBackLabel="Voltar"
    >
      <div className="flex flex-col gap-3">
        {cameraAvailable !== false ? (
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="Imagem da câmera para leitura do código"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-28 w-[78%] rounded-lg border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <p className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white drop-shadow">
              Aponte para o código de barras da etiqueta
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-default-200 bg-canvas p-4 text-sm text-muted">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <IconSearch size={16} /> Leitura pela câmera indisponível
            </p>
            <p className="mt-1 text-xs">
              {cameraError || 'Este navegador não suporta o leitor. Digite o código abaixo.'}
            </p>
          </div>
        )}

        {/* Nível 3: sempre disponível para câmera bloqueada ou etiqueta danificada. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            deliver(manualCode);
          }}
          className="flex gap-2 pb-2"
        >
          <input
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onFocus={(event) => {
              const input = event.currentTarget;
              window.setTimeout(
                () => input.scrollIntoView({ block: 'center', behavior: 'smooth' }),
                150,
              );
            }}
            inputMode="numeric"
            aria-label="Código de barras"
            placeholder="Ou digite o código"
            className="h-12 min-w-0 flex-1 rounded-xl border border-default-200 bg-white px-3.5 text-base text-foreground outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:opacity-90"
          >
            <IconQr size={17} /> Buscar
          </button>
        </form>
      </div>
    </Drawer>
  );
}
