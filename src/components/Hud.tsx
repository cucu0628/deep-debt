import { minerIconURL } from '../fx/sprites';
import { ARTIFACT_MAP } from '../game/data/artifacts';
import { biomeFor } from '../game/data/biomes';
import { debtRemaining } from '../game/run';
import { money } from '../format';
import { useGame, useUi } from '../store';
import { AnimatedNumber, Icon } from './common';

export function Hud() {
  const run = useGame((s) => s.game.run);
  const shards = useGame((s) => s.game.meta.shards);
  const muted = useGame((s) => s.muted);
  const setMuted = useGame((s) => s.setMuted);
  const held = useUi((s) => s.heldCash);
  const inRun = run.phase === 'town' || run.phase === 'mine';
  const daysLeft = run.debtDue - run.day;
  const remaining = debtRemaining(run);
  const urgent = daysLeft <= 1 && remaining > 0;
  const open = (modal: 'collection' | 'legacy' | 'settings' | 'help') => useUi.setState({ modal });

  return (
    <header className="hud">
      <div className="hud-logo">
        <img src={minerIconURL()} alt="" className="px-icon" width={36} height={30} />
        <span>
          DEEP<b>DEBT</b>
        </span>
      </div>
      {inRun && (
        <>
          <div className="hud-box">
            <Icon e={run.minedToday ? '🌙' : '☀️'} size={28} />
            <div>
              <label>DAY</label>
              <b>{run.day}</b>
            </div>
          </div>
          <div className="hud-box cash">
            <Icon e="💰" size={28} />
            <div>
              <label>CASH</label>
              <AnimatedNumber value={held ?? run.cash} prefix="$" />
            </div>
          </div>
          <div className="hud-box" data-tip={`Deepest open layer · ${biomeFor(run.maxLayer).name}`}>
            <Icon e="⛏️" size={28} />
            <div>
              <label>DEPTH</label>
              <b>L{run.maxLayer}</b>
            </div>
          </div>
          <div className={`hud-box debt ${urgent ? 'urgent' : ''}`} data-tip="The Company's next installment">
            <Icon e="💀" size={28} />
            <div>
              <label>{daysLeft <= 0 ? 'DUE TONIGHT!' : `DUE IN ${daysLeft} DAY${daysLeft === 1 ? '' : 'S'}`}</label>
              <b>{money(remaining)}</b>
            </div>
          </div>
          <div className="hud-slots">
            {run.artifacts.map((id) => (
              <span key={id} className="slot" data-tip={`${ARTIFACT_MAP[id].name}: ${ARTIFACT_MAP[id].desc}`}>
                <Icon e={ARTIFACT_MAP[id].icon} size={24} />
              </span>
            ))}
          </div>
        </>
      )}
      <div className="hud-right">
        <button className="icon-btn shards" data-tip="Legacy tree" onClick={() => open('legacy')}>
          <Icon e="✨" size={20} /> {shards}
        </button>
        <button className="icon-btn" data-tip="Relic collection" onClick={() => open('collection')}>
          <Icon e="📖" size={20} />
        </button>
        <button className="icon-btn" data-tip="How to play" onClick={() => open('help')}>
          <Icon e="❓" size={20} />
        </button>
        <button className="icon-btn" data-tip="Stats & settings" onClick={() => open('settings')}>
          <Icon e="⚙️" size={20} />
        </button>
        <button className="icon-btn" data-tip={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(!muted)}>
          <Icon e={muted ? '🔇' : '🔊'} size={20} />
        </button>
      </div>
    </header>
  );
}
