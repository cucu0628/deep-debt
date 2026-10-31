import { openCrate, type CrateResult } from './casino';
import { ORES } from './data/tiles';
import { rollClaims, withRng } from './run';
import type { Game } from './state';

/**
 * Optional rewarded-ad bonuses. Every reward is small, capped, and never needed to progress:
 * the game is balanced as if nobody ever watches an ad.
 */
export type AdPlacement = 'reroll' | 'energy' | 'haul' | 'crate' | 'shards';

export const AD_ENERGY = 6;
export const AD_HAUL = 0.5;
export const AD_SHARDS = 0.25;

/** No ads for brand-new players: they show up from day 3 of the first run. */
export const adsUnlocked = (g: Game) => g.meta.stats.rebirths > 0 || g.run.day >= 3;

export function canWatch(g: Game, p: AdPlacement): boolean {
  const run = g.run;
  if (!adsUnlocked(g) || run.pendingChoices) return false;
  const used = run.adsUsed ?? {};
  switch (p) {
    case 'reroll':
      return run.phase === 'town' && !run.minedToday && (run.claims?.length ?? 0) > 1 && used.reroll !== run.day;
    case 'energy':
      return run.phase === 'mine' && !!run.mine && !run.mine.adEnergy;
    case 'haul': {
      const sum = run.lastSummary;
      return run.phase === 'town' && run.minedToday && sum?.day === run.day && used.haul !== run.day && ORES.some((o) => (sum.cargo[o] ?? 0) > 0);
    }
    case 'crate':
      return run.phase === 'town' && used.crate !== run.day && !(run.clauses ?? []).includes('dry');
    case 'shards':
      return run.phase === 'foreclosed' && used.shards === undefined && run.shardsEarned > 0;
  }
}

function mark(g: Game, p: AdPlacement) {
  g.run.adsUsed = { ...(g.run.adsUsed ?? {}), [p]: g.run.day };
}

/** New set of claims for today. */
export function adReroll(g: Game): boolean {
  if (!canWatch(g, 'reroll')) return false;
  mark(g, 'reroll');
  g.run.claims = withRng(g, (r) => rollClaims(g, r));
  return true;
}

/** A second wind in the mine, once per dig. */
export function adEnergy(g: Game): boolean {
  if (!canWatch(g, 'energy')) return false;
  g.run.mine!.adEnergy = true;
  g.run.mine!.energy += AD_ENERGY;
  return true;
}

/** +50% of today's haul. Returns the ore added. */
export function adHaul(g: Game): number {
  if (!canWatch(g, 'haul')) return 0;
  mark(g, 'haul');
  let added = 0;
  for (const o of ORES) {
    const n = g.run.lastSummary!.cargo[o] ?? 0;
    if (n <= 0) continue;
    const extra = Math.max(1, Math.floor(n * AD_HAUL));
    g.run.inventory[o] = (g.run.inventory[o] ?? 0) + extra;
    added += extra;
  }
  return added;
}

/** One free Silver Crate a day. */
export function adCrate(g: Game): CrateResult | null {
  if (!canWatch(g, 'crate')) return null;
  const res = openCrate(g, 'silver', true);
  if (res) mark(g, 'crate');
  return res;
}

/** +25% Legacy Shards from a foreclosed run. Returns the extra shards. */
export function adShards(g: Game): number {
  if (!canWatch(g, 'shards')) return 0;
  mark(g, 'shards');
  const extra = Math.max(1, Math.ceil(g.run.shardsEarned * AD_SHARDS));
  g.run.shardsEarned += extra;
  return extra;
}
