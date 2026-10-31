import { biomeFor } from '../data/biomes';
import type { UpgradeId } from '../data/upgrades';
import { PICK_FOR_BIOME, bestCell } from '../autodig';
import {
  buyUpgrade,
  debtRemaining,
  descend,
  drinkEnergy,
  endDay,
  mineHit,
  payDebt,
  pickArtifact,
  sell,
  surface,
  upgradePrice,
} from '../run';
import type { Game } from '../state';
import { derive } from '../stats';

const PRIORITY: UpgradeId[] = ['pick', 'energy', 'blast', 'prospect', 'luck', 'haggle', 'miner', 'lantern', 'radius'];

function shop(g: Game, avgIncome: number) {
  const run = g.run;
  const daysLeft = Math.max(0, run.debtDue - run.day);
  const reserve = Math.max(0, debtRemaining(run) - avgIncome * daysLeft * 0.8);
  for (let guard = 0; guard < 50; guard++) {
    let bought = false;
    for (const id of PRIORITY) {
      const p = upgradePrice(g, id);
      if (p !== null && run.cash - p >= reserve) {
        buyUpgrade(g, id);
        bought = true;
        break;
      }
    }
    if (!bought) break;
  }
}

export interface SimResult {
  days: number;
  debtsPaid: number;
  earned: number;
  maxLayer: number;
  shards: number;
}

export function simulateRun(g: Game, maxDays = 120, log?: (line: string) => void, pickClaim: (g: Game) => number = () => 0): SimResult {
  let income = 40;
  for (let d = 0; d < maxDays; d++) {
    const run = g.run;
    const power = derive(g).pickPower;
    let layer = 1;
    for (let l = run.maxLayer; l >= 1; l--) {
      if (power >= PICK_FOR_BIOME[biomeFor(l).id]) {
        layer = l;
        break;
      }
    }
    descend(g, layer, pickClaim(g));
    let hits = 0;
    let biggest = 0;
    for (let guard = 0; guard < 500; guard++) {
      const m = g.run.mine!;
      if (m.energy <= 0 && !drinkEnergy(g)) break;
      const i = bestCell(g);
      if (i < 0) break;
      const res = mineHit(g, i);
      hits++;
      biggest = Math.max(biggest, res?.combo ?? 0);
    }
    const m = g.run.mine!;
    const area = m.cells.length;
    const cleared = m.tilesBroken;
    surface(g);
    const before = g.run.cash;
    sell(g);
    const sold = g.run.cash - before;
    income = income * 0.6 + sold * 0.4;
    if (g.run.cash >= debtRemaining(g.run) || g.run.day >= g.run.debtDue) payDebt(g, g.run.cash);
    if (g.run.pendingChoices) pickArtifact(g, g.run.pendingChoices[0]);
    shop(g, income);
    const s = derive(g);
    log?.(
      `d${g.run.day} L${layer} hits ${hits} cleared ${Math.round((100 * cleared) / area)}% biggest chain ${Math.round((100 * biggest) / area)}% ` +
        `sold $${Math.round(sold)} miners ${g.run.morning?.minerOre ?? 0} ore debt #${g.run.debtIndex} $${g.run.debtAmount} pick ${s.pickPower} blast ${s.blastPower}`,
    );
    if (!endDay(g)) break;
  }
  return {
    days: g.run.day,
    debtsPaid: g.run.debtsPaid,
    earned: g.run.earned,
    maxLayer: g.run.maxLayer,
    shards: g.run.shardsEarned,
  };
}
