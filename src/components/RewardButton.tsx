import { useAds, watchAd } from '../bonus';
import { sfx } from '../fx/audio';
import { canWatch, type AdPlacement } from '../game/rewards';
import { toast, useGame } from '../store';
import { Btn } from './common';

/**
 * Opt-in rewarded ad button. Renders nothing if ads are unavailable (blocked, no SDK) or the
 * reward was already used, so the game looks complete without it.
 */
export function RewardButton({ placement, label, onReward, className }: { placement: AdPlacement; label: string; onReward: () => void; className?: string }) {
  const ready = useAds((s) => s.ready);
  const busy = useAds((s) => s.busy);
  const ok = useGame((s) => canWatch(s.game, placement));
  if (!ready || !ok) return null;
  return (
    <Btn
      kind="good"
      className={`reward-btn ${className ?? ''}`}
      disabled={busy}
      onClick={async () => {
        sfx.click();
        const out = await watchAd(placement);
        if (out === 'watched') onReward();
        else if (out === 'skipped') toast('Watch the whole ad to get the reward.', 'info');
        else if (out === 'disabled') toast("Ads aren't available here.", 'info');
        else toast('No ad available right now. Try again later!', 'info');
      }}
    >
      📺 {label}
    </Btn>
  );
}
