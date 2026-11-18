/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_MOBILE_LAYOUT_ENABLED?: string;
  readonly VITE_PWA_ENABLED?: string;
  readonly VITE_OFFLINE_ENABLED?: string;
  /** Public Cloudflare Turnstile site key (never the secret). */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}