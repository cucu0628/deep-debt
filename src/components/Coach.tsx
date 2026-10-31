import { currentTip } from '../game/tutorial';
import { useGame } from '../store';

/** One-line first-run hint, shown over the town scene or the mine. */
export function Coach() {
  // Select the game itself: a selector returning a fresh object every time would loop forever.
  const game = useGame((s) => s.game);
  const tip = currentTip(game);
  const act = useGame((s) => s.act);
  if (!tip) return null;
  return (
    <div className="coach" key={tip.text}>
      <span>{tip.text}</span>
      <button
        className="coach-x"
        aria-label="Hide tips"
        data-tip="Hide tips"
        onClick={() =>
          act((g) => {
            g.meta.tipsOff = true;
          })
        }
      >
        ×
      </button>
    </div>
  );
}
