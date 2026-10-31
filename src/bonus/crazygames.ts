import { loadScript, type AdOutcome, type AdProvider } from './types';

/** CrazyGames HTML5 SDK v3. https://docs.crazygames.com/ */
interface CgSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  ad: { requestAd(type: 'rewarded' | 'midgame', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void };
  game: { gameplayStart(): void; gameplayStop(): void };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CgSdk };
  }
}

let sdk: CgSdk | null = null;
let playing = false;

export const crazyGamesProvider: AdProvider = {
  id: 'crazygames',
  async init() {
    try {
      await loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js');
      sdk = window.CrazyGames!.SDK;
      await sdk.init();
    } catch {
      sdk = null;
      return false;
    }
    return sdk.environment !== 'disabled';
  },
  rewarded: (_placement) =>
    new Promise<AdOutcome>((resolve) => {
      if (!sdk) return resolve('unavailable');
      let started = false;
      sdk.ad.requestAd('rewarded', {
        adStarted: () => (started = true),
        adFinished: () => resolve('watched'),
        adError: () => resolve(started ? 'skipped' : 'unavailable'),
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
