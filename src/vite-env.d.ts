/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADS?: 'mock' | 'adsense' | 'crazygames' | 'none';
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_TEST?: string;
  /** CrazyGames: 'on' only after Full Launch (ads are off during Basic Launch). */
  readonly VITE_CG_ADS?: 'on' | 'off';
}
