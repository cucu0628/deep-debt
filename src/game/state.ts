import type { Ore } from './data/tiles';
import type { ToolId, UpgradeId } from './data/upgrades';
import type { MineState } from './mine';
import type { Claim } from './data/mutators';

export interface MetaStats {
  rebirths: number;
  bestDay: number;
  bestCombo: number;
  totalEarned: number;
  deepest: number;
  debtsPaid: number;
  biggestWin: number;
}

export interface Meta {
  shards: number;
  legacy: Record<string, number>;
  relics: Record<string, number>;
  stats: MetaStats;
  /** Loan clauses selected for the next run (absent in old saves). */
  clauses?: string[];
  /** The player switched off the first-run tips. */
  tipsOff?: boolean;
}

export interface HiLo {
  bet: number;
  pot: number;
  card: number;
  streak: number;
}

export interface DaySummary {
  day: number;
  layer: number;
  cargo: Partial<Record<Ore, number>>;
  bestCombo: number;
  cash: number;
  relics: string[];
  newLayer: boolean;
  tiles: number;
}

export type Phase = 'town' | 'mine' | 'foreclosed' | 'legacy';

export interface Run {
  rng: number;
  day: number;
  phase: Phase;
  minedToday: boolean;
  cash: number;
  /** Money earned this run (selling, chests, winnings), used for Legacy Shards. */
  earned: number;
  inventory: Partial<Record<Ore, number>>;
  prices: Record<Ore, number>;
  prevPrices: Record<Ore, number>;
  upgrades: Partial<Record<UpgradeId, number>>;
  /** Skill-tree perk levels (absent in pre-tree saves). */
  skills?: Record<string, number>;
  tools: Record<ToolId, number>;
  artifacts: string[];
  debtIndex: number;
  debtAmount: number;
  debtPaid: number;
  debtDue: number;
  debtsPaid: number;
  maxLayer: number;
  lastLayer: number;
  mine: MineState | null;
  pendingChoices: string[] | null;
  hilo: HiLo | null;
  lastSummary: DaySummary | null;
  /** `miners` is the value of the ore they hauled at today's prices. */
  morning: { miners: number; minerOre: number; interest: number } | null;
  bestCombo: number;
  shardsEarned: number;
  /** Today's claims to choose from in the mine (absent in old saves). */
  claims?: Claim[];
  /** Loan clauses active this run. */
  clauses?: string[];
  /** Rewarded-ad placements used, mapped to the day they were used. */
  adsUsed?: Partial<Record<'reroll' | 'haul' | 'crate' | 'shards', number>>;
}

export interface Game {
  v: number;
  meta: Meta;
  run: Run;
}

export const SAVE_VERSION = 1;
