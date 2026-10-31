export type AdOutcome = 'watched' | 'skipped' | 'unavailable';

export interface AdProvider {
  id: string;
  /** Loads the SDK. Resolves false when ads can't run here (blocked network, missing config, ...). */
  init(): Promise<boolean>;
  /** Shows a rewarded ad. Only grant the reward on 'watched'. */
  rewarded(placement: string): Promise<AdOutcome>;
  /** Tells the platform whether the player is actively playing (CrazyGames wants this). */
  gameplay?(playing: boolean): void;
}

export function loadScript(src: string, attrs: Record<string, string> = {}, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    const timer = setTimeout(() => reject(new Error(`timeout: ${src}`)), timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`blocked: ${src}`));
    };
    document.head.appendChild(s);
  });
}
