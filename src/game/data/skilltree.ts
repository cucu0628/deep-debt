import type { Stats } from '../stats';
import { UPGRADES, upgradeCost, type UpgradeDef, type UpgradeId } from './upgrades';

/**
 * Skill tree. Two node kinds:
 * - `up` nodes cover a level range [from, to) of a classic upgrade (state lives in `run.upgrades`,
 *   so pre-tree saves migrate automatically).
 * - `perk` nodes are tree-only skills with their own levels in `run.skills`; their `fx` are added
 *   to the derived stats per level.
 */
export type Branch = 'core' | 'mining' | 'blasting' | 'fortune' | 'wealth' | 'crew' | 'saloon';
export type StatFx = Partial<Record<keyof Stats, number>>;

interface Base {
  id: string;
  name: string;
  parents: string[];
  branch: Branch;
  col: number;
  row: number;
  keystone?: boolean;
}
export interface UpNode extends Base {
  kind: 'up';
  upgrade: UpgradeId;
  from: number;
  to: number;
}
export interface PerkNode extends Base {
  kind: 'perk';
  icon: string;
  desc: string;
  max: number;
  base: number;
  growth: number;
  fx: StatFx;
}
export type SkillNode = UpNode | PerkNode;

export interface TreeOwner {
  upgrades: Partial<Record<UpgradeId, number>>;
  skills?: Record<string, number>;
}

const up = (id: string, upgrade: UpgradeId, name: string, from: number, to: number, branch: Branch, col: number, row: number, parents: string[]): UpNode =>
  ({ kind: 'up', id, upgrade, name, from, to, branch, col, row, parents });
const perk = (
  id: string, name: string, icon: string, desc: string, branch: Branch, col: number, row: number, parents: string[],
  max: number, base: number, growth: number, fx: StatFx, keystone = false,
): PerkNode => ({ kind: 'perk', id, name, icon, desc, branch, col, row, parents, max, base, growth, fx, keystone });

export const SKILL_NODES: SkillNode[] = [
  up('pick1', 'pick', 'Pickaxe I', 0, 2, 'core', 8, 0, []),

  // ---- Mining (cols 0-2)
  up('pick2', 'pick', 'Pickaxe II', 2, 5, 'mining', 1, 1, ['pick1']),
  up('energy1', 'energy', 'Stamina I', 0, 4, 'mining', 0, 2, ['pick2']),
  perk('m_sharp', 'Whetstone', '🪨', '+1 pickaxe damage.', 'mining', 1, 2, ['pick2'], 3, 150, 2.2, { pickPower: 1 }),
  perk('m_dig', 'Second Wind', '💨', '+1 energy back when you dig down a layer.', 'mining', 2, 2, ['pick2'], 3, 120, 2, { digBonusEnergy: 1 }),
  up('energy2', 'energy', 'Stamina II', 4, 8, 'mining', 0, 3, ['energy1']),
  up('pick3', 'pick', 'Pickaxe III', 5, Infinity, 'mining', 1, 3, ['m_sharp']),
  perk('m_lungs', 'Iron Lungs', '🫁', '+2 max energy.', 'mining', 2, 3, ['m_dig'], 3, 300, 2.1, { maxEnergy: 2 }),
  up('energy3', 'energy', 'Stamina III', 8, 12, 'mining', 0, 4, ['energy2']),
  perk('m_tough', 'Tempered Steel', '⚒️', '+1 pickaxe damage.', 'mining', 1, 4, ['pick3'], 5, 900, 2.0, { pickPower: 1 }),
  perk('m_rest', 'Catnap', '😴', '+1 energy back when you dig down a layer.', 'mining', 2, 4, ['m_lungs'], 2, 1200, 2.5, { digBonusEnergy: 1 }),
  perk('m_endure', 'Endurance', '🏃', '+3 max energy.', 'mining', 0, 5, ['energy3'], 3, 2500, 2.2, { maxEnergy: 3 }),
  perk('m_tireless', 'Tireless', '⚡', '+2 energy back when you dig down a layer.', 'mining', 2, 5, ['m_rest'], 1, 6000, 1, { digBonusEnergy: 2 }),
  perk('m_titan', 'TITAN', '🗿', 'KEYSTONE: +3 pickaxe damage and +4 max energy.', 'mining', 1, 6, ['m_tough', 'm_endure', 'm_tireless'], 1, 25000, 1, { pickPower: 3, maxEnergy: 4 }, true),

  // ---- Blasting (cols 3-5)
  up('blast1', 'blast', 'Explosives I', 0, 2, 'blasting', 4, 1, ['pick1']),
  perk('b_gas', 'Gas Mask', '😷', '+1 gas pocket power.', 'blasting', 3, 2, ['blast1'], 3, 160, 2, { gasPower: 1 }),
  up('blast2', 'blast', 'Explosives II', 2, Infinity, 'blasting', 4, 2, ['blast1']),
  perk('b_shard', 'Crystal Tap', '💎', '+1 crystal shard power.', 'blasting', 5, 2, ['blast1'], 3, 160, 2, { shardPower: 1 }),
  perk('b_fuse', 'Long Fuse', '🧯', '+1 TNT damage.', 'blasting', 3, 3, ['b_gas'], 3, 600, 2.2, { blastPower: 1 }),
  up('radius', 'radius', 'Blast Radius', 0, 1, 'blasting', 4, 3, ['blast2']),
  perk('b_crystal', 'Harmonics', '🔔', '+2 crystal chain range.', 'blasting', 5, 3, ['b_shard'], 3, 500, 2, { crystalRange: 2 }),
  perk('b_toxic', 'Volatile Gas', '☣️', '+2 gas pocket power.', 'blasting', 3, 4, ['b_fuse'], 2, 2000, 2.5, { gasPower: 2 }),
  perk('b_wide', 'Wide Charge', '🎆', '+1 TNT and dynamite radius.', 'blasting', 4, 4, ['radius'], 1, 9000, 1, { blastRadius: 1 }),
  perk('b_reson', 'Resonator', '🎵', '+3 crystal range, +1 shard power.', 'blasting', 5, 4, ['b_crystal'], 2, 2500, 2.5, { crystalRange: 3, shardPower: 1 }),
  perk('b_shaped', 'Shaped Charges', '🔺', '+2 TNT damage.', 'blasting', 4, 5, ['b_wide', 'b_toxic'], 3, 6000, 2.2, { blastPower: 2 }),
  perk('b_demolition', 'DEMOLITION', '☄️', 'KEYSTONE: +1 radius, +3 TNT damage, +2 gas and shard power.', 'blasting', 4, 6, ['b_shaped', 'b_reson'], 1, 40000, 1, { blastRadius: 1, blastPower: 3, gasPower: 2, shardPower: 2 }, true),

  // ---- Fortune (cols 6-8)
  up('lantern', 'lantern', 'Lantern', 0, 2, 'fortune', 7, 1, ['pick1']),
  perk('f_scout', 'Scout', '🔭', '+1 vision.', 'fortune', 6, 2, ['lantern'], 1, 1500, 1, { vision: 1 }),
  up('luck1', 'luck', 'Luck I', 0, 6, 'fortune', 7, 2, ['lantern', 'prospect1']),
  perk('f_magnet', 'Magnet', '🧲', '+1 magnet radius.', 'fortune', 8, 2, ['lantern'], 3, 250, 2, { magnetRadius: 1 }),
  perk('f_eye', 'Eagle Eye', '👁️', '+1 vision.', 'fortune', 6, 3, ['f_scout'], 1, 6000, 1, { vision: 1 }),
  up('luck2', 'luck', 'Luck II', 6, 12, 'fortune', 7, 3, ['luck1']),
  perk('f_pull', 'Lodestone', '🌀', '+1 magnet radius.', 'fortune', 8, 3, ['f_magnet'], 3, 1200, 2.2, { magnetRadius: 1 }),
  perk('f_relic', 'Curator', '🏺', '+1 artifact choice.', 'fortune', 6, 4, ['f_eye'], 1, 8000, 1, { artifactChoices: 1 }),
  perk('f_clover', 'Four Leaves', '☘️', '+1 luck.', 'fortune', 7, 4, ['luck2'], 5, 3000, 1.9, { luck: 1 }),
  perk('f_combo', 'Rhythm', '🥁', '+0.03 combo rate.', 'fortune', 8, 4, ['f_pull'], 5, 800, 1.8, { comboRate: 0.03 }),
  perk('f_fate', 'Fate Weaver', '🕸️', '+1 artifact choice.', 'fortune', 6, 5, ['f_relic', 'f_clover'], 1, 20000, 1, { artifactChoices: 1 }),
  perk('f_chain', 'Chain Reaction', '⛓️', '+0.05 combo rate.', 'fortune', 8, 5, ['f_combo'], 3, 5000, 2.2, { comboRate: 0.05 }),
  perk('f_seer', 'SEER', '🔮', 'KEYSTONE: +1 vision, +3 luck, +0.1 combo rate.', 'fortune', 7, 6, ['f_fate', 'f_chain'], 1, 50000, 1, { vision: 1, luck: 3, comboRate: 0.1 }, true),

  // ---- Wealth (cols 9-11)
  up('prospect1', 'prospect', 'Prospector I', 0, 3, 'wealth', 10, 1, ['pick1']),
  up('prospect2', 'prospect', 'Prospector II', 3, Infinity, 'wealth', 9, 2, ['prospect1']),
  perk('w_assay', 'Assayer', '🔬', '+5% ore from every chain.', 'wealth', 10, 2, ['prospect1'], 5, 300, 1.9, { oreBonus: 0.05 }),
  up('haggle1', 'haggle', 'Haggling I', 0, 3, 'wealth', 11, 2, ['prospect1']),
  perk('w_vein', 'Vein Sense', '🩸', '+5% ore from every chain.', 'wealth', 9, 3, ['prospect2'], 5, 1500, 1.9, { oreBonus: 0.05 }),
  perk('w_appraise', 'Appraiser', '📜', '+4% sell prices.', 'wealth', 10, 3, ['w_assay', 'haggle1'], 5, 1200, 1.9, { sellBonus: 0.04 }),
  up('haggle2', 'haggle', 'Haggling II', 3, Infinity, 'wealth', 11, 3, ['haggle1']),
  perk('w_motherlode', 'Motherlode', '⛰️', '+10% ore from every chain.', 'wealth', 9, 4, ['w_vein'], 3, 6000, 2.2, { oreBonus: 0.1 }),
  perk('w_broker', 'Ore Broker', '💼', '+5% sell prices.', 'wealth', 11, 4, ['haggle2'], 5, 5000, 2, { sellBonus: 0.05 }),
  perk('w_monopoly', 'Monopoly', '🎩', '+10% ore and +10% sell prices.', 'wealth', 10, 5, ['w_motherlode', 'w_broker', 'w_appraise'], 2, 20000, 2.5, { oreBonus: 0.1, sellBonus: 0.1 }),
  perk('w_midas', 'MIDAS TOUCH', '👑', 'KEYSTONE: +25% ore and +25% sell prices.', 'wealth', 10, 6, ['w_monopoly'], 1, 80000, 1, { oreBonus: 0.25, sellBonus: 0.25 }, true),

  // ---- Crew (cols 12-14)
  up('miner1', 'miner', 'Miners I', 0, 5, 'crew', 13, 1, ['prospect1']),
  perk('c_tools', 'Bulk Orders', '📦', '-5% tool prices.', 'crew', 12, 2, ['miner1'], 4, 200, 1.8, { toolDiscount: 0.05 }),
  up('miner2', 'miner', 'Miners II', 5, Infinity, 'crew', 13, 2, ['miner1']),
  perk('c_carts', 'Ore Carts', '🛒', '+1 ore hauled per miner.', 'crew', 14, 2, ['miner1'], 3, 400, 2, { minerOre: 1 }),
  perk('c_supply', 'Supply Deal', '🤝', '-5% tool prices.', 'crew', 12, 3, ['c_tools'], 3, 1500, 2, { toolDiscount: 0.05 }),
  perk('c_shifts', 'Double Shifts', '🕐', '+1 ore hauled per miner.', 'crew', 13, 3, ['miner2', 'c_carts'], 5, 1500, 1.9, { minerOre: 1 }),
  perk('c_rails', 'Mine Rails', '🛤️', '+2 ore hauled per miner.', 'crew', 14, 3, ['c_carts'], 3, 3000, 2.2, { minerOre: 2 }),
  perk('c_depot', 'Company Depot', '🏪', '-5% tool prices.', 'crew', 12, 4, ['c_supply'], 2, 6000, 2, { toolDiscount: 0.05 }),
  perk('c_foreman', 'FOREMAN', '🦺', 'KEYSTONE: +5 ore per miner and -10% tool prices.', 'crew', 13, 5, ['c_shifts', 'c_rails', 'c_depot'], 1, 30000, 1, { minerOre: 5, toolDiscount: 0.1 }, true),

  // ---- Saloon (cols 15-17)
  perk('s_regular', 'Regular', '🍺', '+3% casino winnings.', 'saloon', 16, 1, ['pick1'], 3, 150, 1.8, { casinoBonus: 0.03 }),
  perk('s_cards', 'Card Sharp', '🃏', '+3% casino winnings.', 'saloon', 15, 2, ['s_regular'], 3, 500, 1.9, { casinoBonus: 0.03 }),
  perk('s_dice', 'Loaded Dice', '🎲', '+3% casino winnings.', 'saloon', 17, 2, ['s_regular'], 3, 500, 1.9, { casinoBonus: 0.03 }),
  perk('s_charm', 'Lucky Charm', '🐇', '+1 luck.', 'saloon', 16, 3, ['s_cards', 's_dice'], 2, 3000, 2.2, { luck: 1 }),
  perk('s_lucky', 'Hot Streak', '🔥', '+5% casino winnings.', 'saloon', 15, 4, ['s_charm'], 3, 5000, 2, { casinoBonus: 0.05 }),
  perk('s_shark', 'Smooth Talker', '🗣️', '+3% sell prices.', 'saloon', 17, 4, ['s_charm', 'haggle2'], 3, 5000, 2, { sellBonus: 0.03 }),
  perk('s_highroller', 'HIGH ROLLER', '💰', 'KEYSTONE: +30% casino winnings.', 'saloon', 16, 5, ['s_lucky', 's_shark'], 1, 35000, 1, { casinoBonus: 0.3 }, true),
];

export const SKILL_BY_ID: Record<string, SkillNode> = Object.fromEntries(SKILL_NODES.map((n) => [n.id, n]));
export const upgradeDef = (id: UpgradeId): UpgradeDef => UPGRADES.find((u) => u.id === id)!;

export type NodeState = 'locked' | 'available' | 'purchased';

export const nodeIcon = (n: SkillNode) => (n.kind === 'up' ? upgradeDef(n.upgrade).icon : n.icon);
export const nodeDesc = (n: SkillNode) => (n.kind === 'up' ? upgradeDef(n.upgrade).desc : n.desc);
/** Number of levels this node can hold (may be Infinity). */
export const nodeSpan = (n: SkillNode) => (n.kind === 'up' ? Math.min(n.to, upgradeDef(n.upgrade).max) - n.from : n.max);

export function nodeLevels(n: SkillNode, o: TreeOwner): number {
  if (n.kind === 'perk') return o.skills?.[n.id] ?? 0;
  const lvl = o.upgrades[n.upgrade] ?? 0;
  return Math.max(0, Math.min(lvl, n.to) - n.from);
}

/** A parent counts as owned once at least one of its levels is bought. */
export const nodeOwned = (n: SkillNode, o: TreeOwner) => nodeLevels(n, o) > 0;

export function nodeState(n: SkillNode, o: TreeOwner): NodeState {
  if (n.kind === 'perk') {
    if (nodeLevels(n, o) >= n.max) return 'purchased';
  } else {
    const lvl = o.upgrades[n.upgrade] ?? 0;
    if (lvl >= Math.min(n.to, upgradeDef(n.upgrade).max)) return 'purchased';
    if (lvl < n.from) return 'locked';
  }
  return n.parents.every((p) => nodeOwned(SKILL_BY_ID[p], o)) ? 'available' : 'locked';
}

/** The upgrade node that the next level of an upgrade falls into. */
export function activeNode(id: UpgradeId, o: TreeOwner): UpNode | undefined {
  const lvl = o.upgrades[id] ?? 0;
  return SKILL_NODES.find((n): n is UpNode => n.kind === 'up' && n.upgrade === id && lvl >= n.from && lvl < n.to);
}

export function perkCost(n: PerkNode, o: TreeOwner): number | null {
  const lvl = nodeLevels(n, o);
  if (lvl >= n.max || nodeState(n, o) !== 'available') return null;
  return Math.round(n.base * Math.pow(n.growth, lvl));
}

export const upNodeCost = (n: UpNode, o: TreeOwner): number | null =>
  nodeState(n, o) === 'available' ? upgradeCost(upgradeDef(n.upgrade), o.upgrades[n.upgrade] ?? 0) : null;

/** Sum of all perk effects, applied on top of derived stats. */
export function perkFx(o: TreeOwner): StatFx {
  const out: StatFx = {};
  for (const n of SKILL_NODES) {
    if (n.kind !== 'perk') continue;
    const lvl = o.skills?.[n.id] ?? 0;
    if (!lvl) continue;
    for (const [k, v] of Object.entries(n.fx) as [keyof Stats, number][]) out[k] = (out[k] ?? 0) + v * lvl;
  }
  return out;
}
