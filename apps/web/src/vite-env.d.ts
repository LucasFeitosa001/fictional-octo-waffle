/// <reference types="vite/client" />

/** Versão do app, injetada pelo Vite `define` a partir do package.json. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
