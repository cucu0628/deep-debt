import type { AdProvider, AdOutcome } from './types';

/** Fake rewarded ad for local development: a 3 second countdown you can skip. */
export const mockProvider: AdProvider = {
  id: 'mock',
  adsEnabled: true,
  init: async () => true,
  rewarded: (placement) =>
    new Promise<AdOutcome>((resolve) => {
      const el = document.createElement('div');
      el.className = 'dev-promo';
      el.innerHTML = `<div class="dev-promo-box px-panel"><b>TEST AD</b><div class="dim small">placement: ${placement}</div><div class="dev-promo-count">3</div><div class="row gap"><button class="btn btn-default" data-a="skip">Close (no reward)</button><button class="btn btn-gold" data-a="ok" disabled>Claim reward</button></div></div>`;
      document.body.appendChild(el);
      const count = el.querySelector<HTMLElement>('.dev-promo-count')!;
      const ok = el.querySelector<HTMLButtonElement>('[data-a=ok]')!;
      let n = 3;
      const t = setInterval(() => {
        n--;
        count.textContent = n > 0 ? String(n) : '✓';
        if (n <= 0) {
          clearInterval(t);
          ok.disabled = false;
        }
      }, 1000);
      el.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement).dataset.a;
        if (!a) return;
        clearInterval(t);
        el.remove();
        resolve(a === 'ok' ? 'watched' : 'skipped');
      });
    }),
};
