import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Spinner } from '@heroui/react';
import { api } from '../lib/api';
import { IconPlus, IconX } from './icons';

type UploadKind = 'logo' | 'professional' | 'product' | 'service' | 'customer' | 'misc';

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  kind?: UploadKind;
  /** circle for avatars/logo, square for product images */
  shape?: 'circle' | 'square';
  size?: number;
  label?: string;
  /** Fallback text shown in the placeholder (e.g. initials) */
  placeholder?: string;
}

/** Square edge of the exported image, in px. */
const OUTPUT_SIZE = 768;
/** Edge of the crop viewport inside the editor modal, in px. */
const VIEWPORT = 300;

/**
 * Upload a JPEG blob to S3 via a presigned PUT and return its public url.
 * Shared by both the single ImageUpload and the multi ImageGalleryUpload.
 */
async function uploadImageBlob(blob: Blob, kind: UploadKind): Promise<string> {
  const { uploadUrl, publicUrl } = await api.post<PresignResponse>('/uploads/presign', {
    filename: 'image.jpg',
    contentType: 'image/jpeg',
    kind,
  });
  const res = await window.fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Falha no upload (${res.status})`);
  return publicUrl;
}

/**
 * Reusable image picker with a built-in crop/zoom editor. After the user picks
 * a file, an editor opens so they can frame the best part of the photo. On
 * confirm the selection is rendered to a canvas and exported as JPEG, which
 * both guarantees a bucket-supported format (iPhone HEIC, etc. are normalised)
 * and keeps every upload square. The JPEG is then uploaded to S3 via a
 * presigned PUT and the public url is returned through onChange.
 */
export function ImageUpload({
  value,
  onChange,
  kind = 'misc',
  shape = 'circle',
  size = 88,
  label,
  placeholder,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSrc, setEditSrc] = useState<string | null>(null);

  const radius = shape === 'circle' ? '9999px' : '14px';

  // Revoke the editor object url when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (editSrc) URL.revokeObjectURL(editSrc);
    };
  }, [editSrc]);

  async function uploadBlob(blob: Blob) {
    setError(null);
    setBusy(true);
    try {
      const publicUrl = await uploadImageBlob(blob, kind);
      onChange(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar imagem');
    } finally {
      setBusy(false);
    }
  }

  function pickFile(file: File) {
    setError(null);
    const url = URL.createObjectURL(file);
    setEditSrc(url);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex shrink-0 items-center justify-center overflow-hidden border border-[var(--color-soft-border)] bg-cream text-gold-strong transition-colors hover:border-gold"
        style={{ width: size, height: size, borderRadius: radius }}
        aria-label="Enviar imagem"
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-1 text-center text-xs font-semibold leading-tight">
            {placeholder ?? 'Foto'}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner size="sm" />
          </span>
        )}
      </button>

      <div className="flex flex-col gap-1.5">
        {label && <span className="text-sm font-medium text-[#2F3136]">{label}</span>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={busy}
            onPress={() => inputRef.current?.click()}
          >
            {value ? 'Alterar' : 'Enviar imagem'}
          </Button>
          {value && (
            <Button
              size="sm"
              variant="ghost"
              isDisabled={busy}
              className="text-red-500"
              onPress={() => onChange(null)}
            >
              Remover
            </Button>
          )}
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) pickFile(file);
          e.target.value = '';
        }}
      />

      {editSrc && (
        <ImageCropModal
          src={editSrc}
          shape={shape}
          onCancel={() => setEditSrc(null)}
          onConfirm={(blob) => {
            setEditSrc(null);
            void uploadBlob(blob);
          }}
        />
      )}
    </div>
  );
}

interface ImageCropModalProps {
  src: string;
  shape: 'circle' | 'square';
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

/**
 * Pan + zoom crop editor. The image is always scaled to at least cover the
 * square viewport, and panning is clamped so no empty area is exposed. Confirm
 * renders the visible viewport region to a {OUTPUT_SIZE}px JPEG.
 */
function ImageCropModal({ src, shape, onCancel, onConfirm }: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState(false);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const baseScale = nat ? Math.max(VIEWPORT / nat.w, VIEWPORT / nat.h) : 1;
  const scale = baseScale * zoom;
  const dispW = nat ? nat.w * scale : 0;
  const dispH = nat ? nat.h * scale : 0;

  const clamp = useCallback(
    (o: { x: number; y: number }) => ({
      x: Math.min(0, Math.max(VIEWPORT - dispW, o.x)),
      y: Math.min(0, Math.max(VIEWPORT - dispH, o.y)),
    }),
    [dispW, dispH],
  );

  // Re-centre / re-clamp whenever the rendered size changes.
  useEffect(() => {
    if (!nat) return;
    setOffset((o) => ({
      x: Math.min(0, Math.max(VIEWPORT - dispW, o.x === 0 ? (VIEWPORT - dispW) / 2 : o.x)),
      y: Math.min(0, Math.max(VIEWPORT - dispH, o.y === 0 ? (VIEWPORT - dispH) / 2 : o.y)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, scale]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    setOffset(clamp({ x: drag.current.ox + dx, y: drag.current.oy + dy }));
  }
  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !nat) return;
    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    const srcSize = VIEWPORT / scale;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      'image/jpeg',
      0.9,
    );
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onCancel()}>
      <Modal.Backdrop>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Ajustar imagem</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col items-center gap-4">
              {loadError ? (
                <p className="py-8 text-center text-sm text-red-500">
                  Não foi possível abrir esta imagem. Tente um arquivo JPG ou PNG.
                </p>
              ) : (
                <>
                  <div
                    className="relative touch-none select-none overflow-hidden bg-[#f1ece1]"
                    style={{
                      width: VIEWPORT,
                      height: VIEWPORT,
                      borderRadius: shape === 'circle' ? '9999px' : '16px',
                      cursor: drag.current ? 'grabbing' : 'grab',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    <img
                      ref={imgRef}
                      src={src}
                      alt=""
                      draggable={false}
                      onLoad={(e) =>
                        setNat({
                          w: e.currentTarget.naturalWidth,
                          h: e.currentTarget.naturalHeight,
                        })
                      }
                      onError={() => setLoadError(true)}
                      style={{
                        position: 'absolute',
                        left: offset.x,
                        top: offset.y,
                        width: dispW,
                        height: dispH,
                        maxWidth: 'none',
                      }}
                    />
                    <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10" />
                  </div>
                  <div className="flex w-full items-center gap-3 px-1">
                    <span className="text-xs text-[#9a8f7d]">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="h-1 flex-1 cursor-pointer accent-gold"
                    />
                  </div>
                  <p className="text-center text-xs text-[#9a8f7d]">
                    Arraste para reposicionar e use o zoom para enquadrar.
                  </p>
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button variant="ghost" onPress={onCancel}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                isDisabled={!nat || loadError}
                onPress={handleConfirm}
              >
                Usar imagem
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export interface ImageGalleryUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  kind?: UploadKind;
  /** Max number of photos allowed in the gallery. */
  max?: number;
}

/**
 * Multi-image picker for a service gallery. Each photo goes through the same
 * crop/zoom editor as the single ImageUpload (so the whole gallery stays square
 * and JPEG-normalised), then is appended to the list. Thumbnails can be removed
 * individually; the first photo is the card cover. The club renders the list as
 * a carousel when it has more than one image.
 */
export function ImageGalleryUpload({
  value,
  onChange,
  kind = 'service',
  max = 6,
}: ImageGalleryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSrc, setEditSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (editSrc) URL.revokeObjectURL(editSrc);
    };
  }, [editSrc]);

  const atLimit = value.length >= max;

  async function addBlob(blob: Blob) {
    setError(null);
    setBusy(true);
    try {
      const publicUrl = await uploadImageBlob(blob, kind);
      onChange([...value, publicUrl]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar imagem');
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div
            key={url}
            className="group relative h-20 w-20 overflow-hidden rounded-[14px] border border-[var(--color-soft-border)] bg-cream"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold text-white">
                Capa
              </span>
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label="Remover foto"
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-red-500"
            >
              <IconX size={12} />
            </button>
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-[14px] border border-dashed border-[var(--color-soft-border)] bg-cream text-gold-strong transition-colors hover:border-gold disabled:opacity-60"
            aria-label="Adicionar foto"
          >
            {busy ? <Spinner size="sm" /> : <IconPlus size={20} />}
          </button>
        )}
      </div>

      <span className="text-xs text-muted">
        {value.length > 1
          ? `A primeira foto é a capa. Adicione fotos de exemplos e de antes e depois — o cliente vê todas na galeria (até ${max}).`
          : `Adicione fotos do serviço, exemplos e antes e depois. O cliente vê todas na galeria (até ${max}).`}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setEditSrc(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />

      {editSrc && (
        <ImageCropModal
          src={editSrc}
          shape="square"
          onCancel={() => setEditSrc(null)}
          onConfirm={(blob) => {
            setEditSrc(null);
            void addBlob(blob);
          }}
        />
      )}
    </div>
  );
}
