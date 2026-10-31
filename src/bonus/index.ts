import { create } from 'zustand';
import { pauseAudio } from '../fx/audio';
import type { AdOutcome, AdProvider } from './types';

/**
 * Which ad network this build talks to, set per build in the .env.<mode> files:
 * `mock` (dev), `adsense` (GitHub Pages), `crazygames` or `none`.
 * The game must always work without ads, so every failure ends up as "no ad buttons".
 */
const KIND = import.meta.env.VITE_ADS ?? 'none';

interface AdState {
  /** An ad network is loaded and rewarded ads may be offered. */
  ready: boolean;
  /** An ad is showing right now. */
  busy: boolean;
}

export const useAds = create<AdState>()(() => ({ ready: false, busy: false }));

let provider: AdProvider | null = null;
/** Gameplay state reported before the SDK finished loading, replayed once it's ready. */
let playing = false;

async function load(): Promise<AdProvider | null> {
  if (KIND === 'mock') return (await import('./dev')).mockProvider;
  if (KIND === 'adsense') return (await import('./google')).adsenseProvider;
  if (KIND === 'crazygames') return (await import('./crazygames')).crazyGamesProvider;
  return null;
}

export async function initAds() {
  try {
    const p = await load();
    if (p && (await p.init())) {
      provider = p;
      p.gameplay?.(playing);
      useAds.setState({ ready: p.adsEnabled });
    }
  } catch {
    provider = null;
  }
}

export const adPlatform = () => provider?.id ?? 'none';

export function setGameplay(p: boolean) {
  playing = p;
  provider?.gameplay?.(p);
}

/** Shows a rewarded ad. Only grant the reward when it resolves to 'watched'. */
export async function watchAd(placement: string): Promise<AdOutcome> {
  if (!provider || !provider.adsEnabled || useAds.getState().busy) return 'unavailable';
  useAds.setState({ busy: true });
  pauseAudio(true);
  let out: AdOutcome = 'unavailable';
  try {
    out = await provider.rewarded(placement);
  } catch {
    out = 'unavailable';
  } finally {
    pauseAudio(false);
    useAds.setState({ busy: false });
  }
  // The platform has ads switched off: never show buttons that can't do anything.
  if (out === 'disabled') {
    provider.adsEnabled = false;
    useAds.setState({ ready: false });
  }
  return out;
}
