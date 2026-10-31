import { useEffect } from 'react';
import { setGameplay } from './bonus';
import { Hud } from './components/Hud';
import { MineView } from './components/MineView';
import { ArtifactPick, DaySummary, Foreclosure, LegacyScreen, Modals, Toasts } from './components/Screens';
import { TownView } from './components/TownView';
import { useGame } from './store';

export function App() {
  const phase = useGame((s) => s.game.run.phase);

  useEffect(() => setGameplay(phase === 'town' || phase === 'mine'), [phase]);

  return (
    <div className={`app phase-${phase}`}>
      <Hud />
      <main>
        {phase === 'mine' && <MineView />}
        {phase === 'town' && <TownView />}
        {phase === 'foreclosed' && <Foreclosure />}
        {phase === 'legacy' && <LegacyScreen />}
      </main>
      <ArtifactPick />
      <DaySummary />
      <Modals />
      <Toasts />
    </div>
  );
}
