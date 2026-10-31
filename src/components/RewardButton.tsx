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
        if (await watchAd(placement)) onReward();
        else toast('No reward this time. Watch the whole ad to get it.', 'info');
      }}
    >
      📺 {label}
    </Btn>
  );
}
