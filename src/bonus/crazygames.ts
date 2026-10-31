import { setPlatformMute } from '../fx/audio';
import { loadScript, type AdOutcome, type AdProvider } from './types';

/** CrazyGames HTML5 SDK v3. https://docs.crazygames.com/ */
interface CgSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  ad: { requestAd(type: 'rewarded' | 'midgame', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: { code?: string } | undefined) => void }): void };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(listener: (settings?: { muteAudio?: boolean }) => void): void;
  };
}

/**
 * Ads are off during CrazyGames' Basic Launch, and rewarded buttons without effect get a game
 * rejected. Build with VITE_CG_ADS=off for Basic Launch and switch it on after Full Launch.
 */
const ADS_ON = import.meta.env.VITE_CG_ADS === 'on';

declare global {
  interface Window {
    CrazyGames?: { SDK: CgSdk };
  }
}

let sdk: CgSdk | null = null;
let playing = false;

export const crazyGamesProvider: AdProvider = {
  id: 'crazygames',
  adsEnabled: ADS_ON,
  async init() {
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      sdk = window.CrazyGames!.SDK;
      await sdk.init();
    } catch {
      sdk = null;
      return false;
    }
    if (sdk.environment === 'disabled') return false;
    // CrazyGames' own mute toggle.
    const game = sdk.game;
    const apply = () => setPlatformMute(!!game.settings?.muteAudio);
    apply();
    try {
      game.addSettingsChangeListener?.(apply);
    } catch {
      // older SDKs: initial setting only
    }
    return true;
  },
  rewarded: (_placement) =>
    new Promise<AdOutcome>((resolve) => {
      if (!sdk) return resolve('unavailable');
      let started = false;
      sdk.ad.requestAd('rewarded', {
        adStarted: () => (started = true),
        adFinished: () => resolve('watched'),
        adError: (e) => resolve(e?.code === 'adsDisabled' ? 'disabled' : started ? 'skipped' : 'unavailable'),
      });
    }),
  gameplay(p) {
    if (!sdk || p === playing) return;
    playing = p;
    try {
      if (p) sdk.game.gameplayStart();
      else sdk.game.gameplayStop();
    } catch {
      // never let the platform SDK break the game
    }
  },
};
