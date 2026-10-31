import { ARTIFACTS } from './data/artifacts';
import { ALL_RELICS, RELIC_SETS } from './data/relics';
import { TOOL_IDS, type ToolId } from './data/upgrades';
import type { Rng } from './rng';
import { dupeRelicCash, withRng } from './run';
import type { Game } from './state';
import { derive } from './stats';

/** Saloon bonuses only boost the profit part of a win, so the house always keeps an edge. */
export function boosted(bet: number, gross: number, bonus: number): number {
  return Math.floor(gross > bet ? bet + (gross - bet) * bonus : gross);
}

function recordWin(g: Game, bet: number, paid: number) {
  g.meta.stats.biggestWin = Math.max(g.meta.stats.biggestWin, paid - bet);
}

function grantArtifact(g: Game, r: Rng): string | null {
  const pool = ARTIFACTS.filter((a) => !g.run.artifacts.includes(a.id));
  if (!pool.length) return null;
  const id = r.pick(pool).id;
  g.run.artifacts.push(id);
  return id;
}

function grantRelic(g: Game, r: Rng): { id: string; dupe: boolean } {
  const charms = RELIC_SETS.find((s) => s.id === 'charms')!.relics;
  const id = r.chance(0.6) ? r.pick(charms).id : r.pick(ALL_RELICS).id;
  const dupe = !!g.meta.relics[id];
  g.meta.relics[id] = (g.meta.relics[id] ?? 0) + 1;
  if (dupe) g.run.cash += dupeRelicCash(g.run.maxLayer);
  return { id, dupe };
}

// ---------- Slots ----------

export const SLOT_SYMBOLS = ['coal', 'copper', 'silver', 'gold', 'diamond', 'tnt'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export const SLOT_WEIGHTS: Record<SlotSymbol, number> = { coal: 30, copper: 25, silver: 18, gold: 12, diamond: 5, tnt: 10 };
export const SLOT_TRIPLE: Record<SlotSymbol, number> = { coal: 4, copper: 8, silver: 15, gold: 30, diamond: 100, tnt: 0 };
export const SLOT_PAIR: Record<SlotSymbol, number> = { coal: 0.5, copper: 1, silver: 1.4, gold: 2.2, diamond: 3.5, tnt: 0 };

export function slotMultiplier(reels: SlotSymbol[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) return SLOT_TRIPLE[a];
  if (a === b || a === c) return SLOT_PAIR[a];
  if (b === c) return SLOT_PAIR[b];
  return 0;
}

export interface SlotResult {
  reels: SlotSymbol[];
  mult: number;
  win: number;
  artifact: string | null;
  relic: string | null;
}

export function spinSlots(g: Game, bet: number): SlotResult | null {
  bet = Math.floor(bet);
  if (bet <= 0 || bet > g.run.cash || g.run.phase !== 'town') return null;
  return withRng(g, (r) => {
    g.run.cash -= bet;
    const reels = [0, 1, 2].map(() => r.weighted(SLOT_WEIGHTS));
    const mult = slotMultiplier(reels);
    const win = boosted(bet, bet * mult, derive(g).casinoBonus);
    g.run.cash += win;
    recordWin(g, bet, win);
    let artifact: string | null = null;
    let relic: string | null = null;
    if (mult === SLOT_TRIPLE.diamond) artifact = grantArtifact(g, r);
    if (mult === SLOT_TRIPLE.gold) relic = grantRelic(g, r).id;
    return { reels, mult, win, artifact, relic };
  });
}

// ---------- High-Low ----------

export const HILO_EDGE = 0.94;

export function hiloOdds(card: number, dir: 'hi' | 'lo'): number {
  const winners = dir === 'hi' ? 13 - card : card - 1;
  return winners / 13;
}

export function hiloMult(card: number, dir: 'hi' | 'lo'): number {
  const p = hiloOdds(card, dir);
  return p <= 0 ? 0 : Math.min(12, Math.round((HILO_EDGE / p) * 100) / 100);
}

export function hiloStart(g: Game, bet: number): boolean {
  bet = Math.floor(bet);
  if (g.run.hilo || bet <= 0 || bet > g.run.cash || g.run.phase !== 'town') return false;
  withRng(g, (r) => {
    g.run.cash -= bet;
    g.run.hilo = { bet, pot: bet, card: r.int(1, 13), streak: 0 };
  });
  return true;
}

export function hiloGuess(g: Game, dir: 'hi' | 'lo'): { next: number; won: boolean } | null {
  const h = g.run.hilo;
  if (!h || hiloOdds(h.card, dir) <= 0) return null;
  return withRng(g, (r) => {
    const next = r.int(1, 13);
    const won = dir === 'hi' ? next > h.card : next < h.card;
    if (won) {
      h.pot = Math.floor(h.pot * hiloMult(h.card, dir));
      h.streak++;
      h.card = next;
    } else {
      g.run.hilo = null;
    }
    return { next, won };
  });
}

export function hiloCashout(g: Game): number {
  const h = g.run.hilo;
  if (!h || h.streak === 0) return 0;
  const paid = boosted(h.bet, h.pot, derive(g).casinoBonus);
  g.run.cash += paid;
  recordWin(g, h.bet, paid);
  g.run.hilo = null;
  return paid;
}

// ---------- Mystery crates ----------

export type CrateTier = 'bronze' | 'silver' | 'gold';

export const CRATES: Record<CrateTier, { name: string; base: number; odds: { cash: number; tools: number; relic: number; artifact: number }; cash: [number, number]; tools: [number, number] }> = {
  bronze: { name: 'Bronze Crate', base: 40, odds: { cash: 67, tools: 30, relic: 3, artifact: 0 }, cash: [0.2, 1.6], tools: [1, 2] },
  silver: { name: 'Silver Crate', base: 150, odds: { cash: 50, tools: 25, relic: 18, artifact: 7 }, cash: [0.3, 1.7], tools: [2, 4] },
  gold: { name: 'Gold Crate', base: 500, odds: { cash: 40, tools: 15, relic: 25, artifact: 20 }, cash: [0.4, 1.8], tools: [4, 7] },
};

export function cratePrice(g: Game, tier: CrateTier): number {
  return Math.round(CRATES[tier].base * Math.pow(1.7, g.run.debtIndex));
}

export type CrateResult =
  | { kind: 'cash'; amount: number }
  | { kind: 'tools'; tools: Partial<Record<ToolId, number>> }
  | { kind: 'relic'; id: string; dupe: boolean }
  | { kind: 'artifact'; id: string };

export function openCrate(g: Game, tier: CrateTier, free = false): CrateResult | null {
  const price = free ? 0 : cratePrice(g, tier);
  if (g.run.cash < price || g.run.phase !== 'town') return null;
  const def = CRATES[tier];
  return withRng(g, (r): CrateResult => {
    g.run.cash -= price;
    let kind = r.weighted(def.odds);
    if (kind === 'artifact') {
      const id = grantArtifact(g, r);
      if (id) return { kind: 'artifact', id };
      kind = 'cash';
    }
    if (kind === 'relic') return { kind: 'relic', ...grantRelic(g, r) };
    if (kind === 'tools') {
      const tools: Partial<Record<ToolId, number>> = {};
      const n = r.int(def.tools[0], def.tools[1]);
      for (let k = 0; k < n; k++) {
        const t = r.pick(TOOL_IDS);
        tools[t] = (tools[t] ?? 0) + 1;
        g.run.tools[t]++;
      }
      return { kind: 'tools', tools };
    }
    const stake = free ? cratePrice(g, tier) : price;
    const amount = boosted(stake, stake * r.range(def.cash[0], def.cash[1]), derive(g).casinoBonus);
    g.run.cash += amount;
    recordWin(g, price, amount);
    return { kind: 'cash', amount };
  });
}

// ---------- Roulette ----------

export type RouletteBet = 'red' | 'black' | 'green';
export const ROULETTE_SLOTS = 15;
export const rouletteColor = (n: number): RouletteBet => (n === 0 ? 'green' : n % 2 ? 'red' : 'black');
export const ROULETTE_PAY: Record<RouletteBet, number> = { red: 2, black: 2, green: 14 };

export function spinRoulette(g: Game, bet: number, choice: RouletteBet): { slot: number; win: number } | null {
  bet = Math.floor(bet);
  if (!g.meta.legacy.roulette || bet <= 0 || bet > g.run.cash || g.run.phase !== 'town') return null;
  return withRng(g, (r) => {
    g.run.cash -= bet;
    const slot = r.int(0, ROULETTE_SLOTS - 1);
    const win = rouletteColor(slot) === choice ? boosted(bet, bet * ROULETTE_PAY[choice], derive(g).casinoBonus) : 0;
    g.run.cash += win;
    recordWin(g, bet, win);
    return { slot, win };
  });
}
