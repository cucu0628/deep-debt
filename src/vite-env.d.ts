/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADS?: 'mock' | 'adsense' | 'crazygames' | 'none';
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_TEST?: string;
}
