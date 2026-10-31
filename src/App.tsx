import { useEffect } from 'react';
import { setGameplay } from './bonus';
import { Hud } from './components/Hud';
import { MineView } from './components/MineView';
import { ArtifactPick, DaySummary, Foreclosure, LegacyScreen, Modals, Toasts } from './components/Screens';
import { TownView } from './components/TownView';
import { useGame, useUi } from './store';

export function App() {
  const phase = useGame((s) => s.game.run.phase);

  useEffect(() => setGameplay(phase === 'town' || phase === 'mine'), [phase]);

  useEffect(() => {
    try {
      if (!localStorage.getItem('deep-debt-help')) {
        localStorage.setItem('deep-debt-help', '1');
        useUi.setState({ modal: 'help' });
      }
    } catch {
      // Storage may be unavailable; the help button still works.
    }
  }, []);

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
