import { perkFx } from './data/skilltree';
import { BIOMES } from './data/biomes';
import { completedSets } from './data/relics';
import type { Game } from './state';

export interface Stats {
  pickPower: number;
  maxEnergy: number;
  digBonusEnergy: number;
  vision: number;
  blastRadius: number;
  /** Damage TNT deals to rock and ore. Weaker tiles break, tougher ones only crack. */
  blastPower: number;
  gasPower: number;
  shardPower: number;
  luck: number;
  oreBonus: number;
  sellBonus: number;
  casinoBonus: number;
  magnetRadius: number;
  crystalRange: number;
  comboRate: number;
  /** Ore each hired miner hauls up every morning. */
  minerOre: number;
  debtGrowth: number;
  debtPeriod: number;
  artifactChoices: number;
  gridSize: number;
  permitLayer: number;
  /** Fraction knocked off tool prices (skill tree). */
  toolDiscount: number;
  /** 1 if leftover pickaxe damage pierces into the next tile. */
  pierce: number;
}

/** Each Mining Permit opens one more biome (3 layers). The Abyss has no floor. */
export function permitLayer(permits: number): number {
  return permits >= BIOMES.length ? Infinity : BIOMES[permits].fromLayer - 1;
}

export function derive(g: Game): Stats {
  const up = g.run.upgrades;
  const lg = g.meta.legacy;
  const has = (id: string) => g.run.artifacts.includes(id);
  const sets = completedSets(g.meta.relics);
  const relicCount = Object.keys(g.meta.relics).length;
  const L = (id: string) => lg[id] ?? 0;
  const clause = (id: string) => (g.run.clauses ?? []).includes(id);

  const s: Stats = {
    pickPower: 1 + (up.pick ?? 0) + L('pick') + (has('heavy_hands') ? 1 : 0),
    maxEnergy: 10 + (up.energy ?? 0) * 3 + L('energy') * 2 + (sets.has('fossils') ? 2 : 0) - (has('heavy_hands') ? 2 : 0),
    digBonusEnergy: has('deep_pockets') ? 3 : 0,
    vision: 1 + (up.lantern ?? 0) + (has('geologist') ? 1 : 0),
    blastRadius: 1 + (up.radius ?? 0) + (has('pyromaniac') ? 1 : 0) + (sets.has('idols') ? 1 : 0),
    blastPower: 2 + (up.blast ?? 0) + L('demo') + (has('pyromaniac') ? 1 : 0),
    gasPower: 2 + (has('gas_mask') ? 2 : 0) + Math.floor(((up.blast ?? 0) + L('demo')) / 2),
    shardPower: 3 + (has('resonance') ? 1 : 0) + Math.floor(((up.blast ?? 0) + L('demo')) / 2),
    luck: (up.luck ?? 0) + L('luck'),
    oreBonus: 1 + 0.1 * (up.prospect ?? 0) + (sets.has('miners') ? 0.1 : 0) + 0.05 * L('mastery'),
    sellBonus:
      1 + 0.08 * (up.haggle ?? 0) + (has('black_market') ? 0.2 : 0) + (sets.has('geodes') ? 0.1 : 0) + 0.01 * relicCount + 0.05 * L('mastery'),
    casinoBonus: 1 + (has('gamblers_coin') ? 0.15 : 0) + (sets.has('charms') ? 0.1 : 0),
    magnetRadius: 2 + (has('magnetism') ? 2 : 0),
    crystalRange: has('resonance') ? 99 : 3,
    comboRate: 0.35 * (has('echo') ? 1.5 : 1),
    minerOre: 3 + L('miners'),
    debtGrowth: 3.2 - 0.06 * L('relief') - (sets.has('void') ? 0.1 : 0) + (clause('usury') ? 0.25 : 0),
    debtPeriod: 5 + L('grace') - (clause('deadline') ? 1 : 0),
    artifactChoices: 3 + L('choices'),
    gridSize: 9 + L('grid'),
    permitLayer: permitLayer(g.run.debtsPaid + 1 + L('depth')),
    toolDiscount: 0,
    pierce: L('pierce') > 0 ? 1 : 0,
  };
  const fx = perkFx(g.run);
  for (const [k, v] of Object.entries(fx) as [keyof Stats, number][]) s[k] += v;
  s.toolDiscount = Math.min(0.6, s.toolDiscount);
  if (clause('frail')) s.maxEnergy = Math.max(3, s.maxEnergy - 3);
  if (clause('taxed')) s.sellBonus *= 0.85;
  return s;
}
