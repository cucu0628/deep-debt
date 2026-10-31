import { loadScript, type AdOutcome, type AdProvider } from './types';

/**
 * Google AdSense "H5 Games Ads" (Ad Placement API) for the self-hosted build.
 * https://developers.google.com/ad-placement
 */
interface BreakOpts {
  type: 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward: (showAdFn: () => void) => void;
  adDismissed: () => void;
  adViewed: () => void;
  adBreakDone: (info: { breakStatus: string }) => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: BreakOpts) => void;
    adConfig?: (o: Record<string, unknown>) => void;
  }
}

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT ?? '';
const TEST = import.meta.env.VITE_ADSENSE_TEST === 'on';

export const adsenseProvider: AdProvider = {
  id: 'adsense',
  adsEnabled: true,
  async init() {
    if (!/^ca-pub-\d{10,}$/.test(CLIENT)) return false;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = (o: object) => void window.adsbygoogle!.push(o);
    const attrs: Record<string, string> = { 'data-ad-client': CLIENT, crossorigin: 'anonymous', 'data-ad-frequency-hint': '30s' };
    if (TEST) attrs['data-adbreak-test'] = 'on';
    try {
      await loadScript(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`, attrs);
    } catch {
      return false; // ad blocker or a school/work filter: play without ads
    }
    window.adConfig!({ preloadAdBreaks: 'on', sound: 'on' });
    return true;
  },
  rewarded: (placement) =>
    new Promise<AdOutcome>((resolve) => {
      let outcome: AdOutcome = 'unavailable';
      let started = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(outcome);
      };
      // If Google never answers (blocked mid-session), give up quietly.
      setTimeout(() => !started && finish(), 8000);
      window.adBreak!({
        type: 'reward',
        name: placement,
        // The player already pressed our "watch an ad" button, so start right away.
        beforeReward: (show) => {
          started = true;
          show();
        },
        adDismissed: () => (outcome = 'skipped'),
        adViewed: () => (outcome = 'watched'),
        adBreakDone: finish,
      });
    }),
};
