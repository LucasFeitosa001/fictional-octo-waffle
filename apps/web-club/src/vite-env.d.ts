/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_BOOKING_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
