/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_API_URL?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_INVITE_ONLY_REGISTRATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
