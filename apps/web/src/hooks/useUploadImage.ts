import { useMutation } from '@tanstack/react-query';
import { ApiClientError } from '@beautypass/shared';
import { API_BASE_URL } from '../lib/config';

export type UploadKind =
  | 'logo'
  | 'professional'
  | 'product'
  | 'service'
  | 'customer'
  | 'misc';

export interface UploadImageInput {
  file: File | Blob;
  kind?: UploadKind;
  /** Optional override filename when passing a Blob (e.g. from a canvas). */
  filename?: string;
}

export interface UploadImageResult {
  url: string;
  key: string;
}

/**
 * Uploads an image file to the backend `POST /api/v1/uploads` multipart
 * endpoint and returns `{ url, key }`. Uses cookie-based auth
 * (credentials: 'include') consistent with the rest of the web app.
 *
 * Consumers get standard React Query mutation state: `isPending`, `isError`,
 * `error`, plus `mutateAsync({ file, kind })` which resolves with the URL.
 */
export function useUploadImage() {
  return useMutation<UploadImageResult, Error, UploadImageInput>({
    mutationFn: async ({ file, kind = 'misc', filename }) => {
      const form = new FormData();
      const name =
        filename ??
        (file instanceof File && file.name ? file.name : 'upload.bin');
      form.append('file', file, name);
      if (kind) form.append('kind', kind);

      const res = await window.fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }

      if (!res.ok) {
        const body = json as { message?: string | string[] } | undefined;
        const message = body?.message
          ? Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message
          : res.statusText || 'Falha no envio da imagem';
        throw new ApiClientError(res.status, message);
      }

      const result = json as Partial<UploadImageResult> | undefined;
      if (!result?.url) {
        throw new Error('Resposta de upload inválida (sem url).');
      }
      return { url: result.url, key: result.key ?? '' };
    },
  });
}
