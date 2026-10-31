import { ORES } from './data/tiles';
import { debtRemaining, inventoryValue, upgradePrice } from './run';
import type { Game } from './state';

/**
 * First-run coaching: one short line about the next thing to do, plus which building to point at.
 * It only runs until the first installment is paid on the very first run, and can be switched off.
 */
export interface Tip {
  text: string;
  /** Town building to point at with a bubble. */
  building?: 'mine' | 'market' | 'shop' | 'company';
  label?: string;
}

export const tutorialActive = (g: Game) => g.meta.stats.rebirths === 0 && !g.meta.tipsOff && g.run.debtsPaid === 0;

export function currentTip(g: Game): Tip | null {
  if (!tutorialActive(g)) return null;
  const run = g.run;
  if (run.phase === 'mine' && run.mine) {
    const m = run.mine;
    if (m.energy <= 0) return null; // the out-of-energy panel already says what to do
    if (m.tilesBroken === 0) return { text: 'Click a glowing tile to dig. Each hit costs 1 ⚡ energy.' };
    if (run.day === 1 && !ORES.some((o) => m.haul[o])) return { text: 'Hit an ore tile: its whole vein breaks at once!' };
    if (run.day === 1 && m.tilesBroken < 20) return { text: 'Bigger chains = bonus ore. 🧨 TNT blasts everything around it!' };
    return null;
  }
  if (run.phase !== 'town' || run.pendingChoices) return null;
  if (!run.minedToday) return run.day === 1 ? { text: 'Click the MINE to start digging.', building: 'mine' } : null;
  if (inventoryValue(g) > 0) return { text: 'Sell your ore at the MARKET.', building: 'market', label: 'SELL!' };
  const pick = upgradePrice(g, 'pick');
  if (pick !== null && run.cash >= pick && !run.upgrades.pick) return { text: 'Buy a better pickaxe at the TOOL SHOP.', building: 'shop', label: 'UPGRADE' };
  if (run.day === 1) return { text: 'Done for today? Click 🌙 SLEEP.' };
  const rem = debtRemaining(run);
  if (rem > 0 && run.cash > 0) return { text: `Pay The Company $${rem} by Day ${run.debtDue}, or lose everything!`, building: 'company', label: 'PAY' };
  return { text: 'Done for today? Click 🌙 SLEEP.' };
}
