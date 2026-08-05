/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_SOURCE_AVAILABLE?: string;
  readonly VITE_APK_AVAILABLE?: string;
  readonly VITE_WINDOWS_PACKAGE_AVAILABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
