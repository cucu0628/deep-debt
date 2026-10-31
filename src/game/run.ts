import { ARTIFACTS } from './data/artifacts';
import { biomeFor } from './data/biomes';
import { clauseBonus } from './data/clauses';
import { LEGACY_MAP } from './data/legacy';
import { MUTATORS, claimTiers, type Claim } from './data/mutators';
import { ORES, ORE_INFO, type Ore } from './data/tiles';
import { SKILL_BY_ID, activeNode, nodeState, perkCost } from './data/skilltree';
import { TOOLS, UPGRADES, upgradeCost, type ToolId, type UpgradeId } from './data/upgrades';
import { dynamite, drill, generateMine, hit, scan, type ChainResult, type MineCtx } from './mine';
import { Rng, newSeed } from './rng';
import { SAVE_VERSION, type Game, type Meta, type Run } from './state';
import { derive } from './stats';

export const DEBT_BASE = 120;

/** Each installment grows by a factor that itself climbs, so every run eventually forecloses. */
export function debtFor(index: number, growth: number): number {
  let amt = DEBT_BASE;
  for (let k = 0; k < index; k++) amt *= growth + 0.3 * k;
  return Math.round(amt);
}

export function newMeta(): Meta {
  return {
    shards: 0,
    legacy: {},
    relics: {},
    stats: { rebirths: 0, bestDay: 0, bestCombo: 0, totalEarned: 0, deepest: 1, debtsPaid: 0, biggestWin: 0 },
  };
}

const flatPrices = () => Object.fromEntries(ORES.map((o) => [o, 1])) as Record<Ore, number>;

export function withRng<T>(g: Game, fn: (r: Rng) => T): T {
  const r = new Rng(g.run.rng);
  const out = fn(r);
  g.run.rng = r.s;
  return out;
}

export function startRun(g: Game, seed = newSeed()) {
  const L = (id: string) => g.meta.legacy[id] ?? 0;
  const run: Run = {
    rng: seed,
    day: 1,
    phase: 'town',
    minedToday: false,
    cash: 20 + 40 * L('start_cash'),
    earned: 0,
    inventory: {},
    prices: flatPrices(),
    prevPrices: flatPrices(),
    upgrades: {},
    skills: {},
    tools: { dynamite: 2 * L('kit'), drill: L('kit'), scanner: L('kit'), drink: 0 },
    artifacts: [],
    debtIndex: 0,
    debtAmount: 0,
    debtPaid: 0,
    debtDue: 0,
    debtsPaid: 0,
    maxLayer: 1 + 3 * L('depth'),
    lastLayer: 1,
    mine: null,
    pendingChoices: null,
    hilo: null,
    lastSummary: null,
    morning: null,
    bestCombo: 0,
    shardsEarned: 0,
    clauses: [...(g.meta.clauses ?? [])],
  };
  g.run = run;
  withRng(g, (r) => {
    for (let n = 0; n < L('heirloom'); n++) {
      const pool = ARTIFACTS.filter((a) => !run.artifacts.includes(a.id));
      run.artifacts.push(r.pick(pool).id);
    }
  });
  const s = derive(g);
  run.debtAmount = debtFor(0, s.debtGrowth);
  run.debtDue = s.debtPeriod;
  run.claims = withRng(g, (r) => rollClaims(g, r));
}

/** Today's claims: one per tier, each with that many distinct mutators. */
export function rollClaims(g: Game, r: Rng): Claim[] {
  const cursed = (g.run.clauses ?? []).includes('cursed');
  let tiers = claimTiers(g.run.maxLayer);
  if (cursed && g.run.maxLayer >= 4) tiers = tiers.map((n) => n + 1);
  const ids = MUTATORS.map((m) => m.id);
  return tiers.map((n) => ({ mods: r.shuffle(ids).slice(0, n) }));
}

/** Claims for today, rolling them for saves made before claims existed. */
export function todaysClaims(g: Game): Claim[] {
  if (!g.run.claims?.length) g.run.claims = withRng(g, (r) => rollClaims(g, r));
  return g.run.claims;
}

export function newGame(seed?: number): Game {
  const g = { v: SAVE_VERSION, meta: newMeta(), run: null as unknown as Run };
  startRun(g, seed);
  return g;
}

function ctxFor(g: Game, rng: Rng): MineCtx {
  return { stats: derive(g), arts: new Set(g.run.artifacts), rng };
}

// ---------- Mine ----------

export function descend(g: Game, layer: number, claim = 0): boolean {
  const run = g.run;
  if (run.phase !== 'town' || run.minedToday || run.pendingChoices) return false;
  layer = Math.max(1, Math.min(run.maxLayer, Math.floor(layer)));
  const claims = todaysClaims(g);
  const mods = claims[Math.max(0, Math.min(claims.length - 1, claim))]?.mods ?? [];
  const s = derive(g);
  run.mine = withRng(g, (r) => generateMine(layer, s, new Set(run.artifacts), r, mods));
  let energy = s.maxEnergy + s.digBonusEnergy;
  if (mods.includes('shortshift')) energy = Math.floor(energy * 0.6);
  if (mods.includes('gassy')) energy -= 5;
  run.mine.energy = Math.max(3, energy);
  run.lastLayer = layer;
  run.phase = 'mine';
  run.hilo = null;
  return true;
}

export function dupeRelicCash(layer: number) {
  return 25 * layer;
}

function applyChain(g: Game, res: ChainResult) {
  const run = g.run;
  const m = run.mine!;
  for (const [k, n] of Object.entries(res.cargo) as [Ore, number][]) run.inventory[k] = (run.inventory[k] ?? 0) + n;
  run.cash += res.cash;
  run.earned += res.cash;
  for (const [t, n] of Object.entries(res.tools) as [ToolId, number][]) run.tools[t] += n;
  for (const r of res.relics) {
    if (g.meta.relics[r]) {
      run.cash += dupeRelicCash(m.layer);
      run.earned += dupeRelicCash(m.layer);
    }
    g.meta.relics[r] = (g.meta.relics[r] ?? 0) + 1;
  }
  if (res.newBottom && m.layer >= run.maxLayer && m.layer + 1 <= derive(g).permitLayer) {
    run.maxLayer = m.layer + 1;
    g.meta.stats.deepest = Math.max(g.meta.stats.deepest, run.maxLayer);
  }
  run.bestCombo = Math.max(run.bestCombo, res.combo);
  g.meta.stats.bestCombo = Math.max(g.meta.stats.bestCombo, res.combo);
}

export function mineHit(g: Game, i: number): ChainResult | null {
  if (g.run.phase !== 'mine' || !g.run.mine) return null;
  const res = withRng(g, (r) => hit(g.run.mine!, i, ctxFor(g, r)));
  if (res) applyChain(g, res);
  return res;
}

export function applyTool(g: Game, tool: ToolId, i: number): ChainResult | null {
  const run = g.run;
  const m = run.mine;
  if (run.phase !== 'mine' || !m || run.tools[tool] <= 0) return null;
  if (i < 0 || i >= m.cells.length) return null;
  run.tools[tool]--;
  const res = withRng(g, (r) => {
    const ctx = ctxFor(g, r);
    if (tool === 'dynamite') return dynamite(m, i, ctx);
    if (tool === 'drill') return drill(m, i, ctx);
    return scan(m, i, ctx);
  });
  applyChain(g, res);
  return res;
}

export const DRINK_ENERGY = 6;

export function drinkEnergy(g: Game): boolean {
  const run = g.run;
  if (run.phase !== 'mine' || !run.mine || run.tools.drink <= 0) return false;
  run.tools.drink--;
  run.mine.energy += DRINK_ENERGY;
  return true;
}

export function surface(g: Game) {
  const run = g.run;
  const m = run.mine;
  if (run.phase !== 'mine' || !m) return;
  const newLayer = m.bottomReached && run.maxLayer === m.layer + 1;
  run.lastSummary = {
    day: run.day,
    layer: m.layer,
    cargo: m.haul,
    bestCombo: m.bestCombo,
    cash: m.cashFound,
    relics: m.relicsFound,
    newLayer,
    tiles: m.tilesBroken,
  };
  run.mine = null;
  run.phase = 'town';
  run.minedToday = true;
}

// ---------- Town ----------

export function unitPrice(g: Game, ore: Ore): number {
  return ORE_INFO[ore].value * g.run.prices[ore] * derive(g).sellBonus;
}

export function sell(g: Game, ore?: Ore): number {
  const run = g.run;
  let total = 0;
  for (const o of ore ? [ore] : ORES) {
    const n = run.inventory[o] ?? 0;
    if (n <= 0) continue;
    total += Math.floor(n * unitPrice(g, o));
    run.inventory[o] = 0;
  }
  run.cash += total;
  run.earned += total;
  return total;
}

export function inventoryValue(g: Game): number {
  return ORES.reduce((sum, o) => sum + Math.floor((g.run.inventory[o] ?? 0) * unitPrice(g, o)), 0);
}

export function upgradePrice(g: Game, id: UpgradeId): number | null {
  const u = UPGRADES.find((x) => x.id === id)!;
  const lvl = g.run.upgrades[id] ?? 0;
  if (lvl >= u.max) return null;
  const node = activeNode(id, g.run);
  if (!node || nodeState(node, g.run) !== 'available') return null;
  return upgradeCost(u, lvl);
}

export function buyUpgrade(g: Game, id: UpgradeId): boolean {
  const cost = upgradePrice(g, id);
  if (cost === null || g.run.cash < cost) return false;
  g.run.cash -= cost;
  g.run.upgrades[id] = (g.run.upgrades[id] ?? 0) + 1;
  return true;
}

/** Buys one level of any skill-tree node. */
export function buySkill(g: Game, id: string): boolean {
  const n = SKILL_BY_ID[id];
  if (!n) return false;
  if (n.kind === 'up') return activeNode(n.upgrade, g.run) === n && buyUpgrade(g, n.upgrade);
  const cost = perkCost(n, g.run);
  if (cost === null || g.run.cash < cost) return false;
  g.run.cash -= cost;
  g.run.skills = { ...(g.run.skills ?? {}), [id]: (g.run.skills?.[id] ?? 0) + 1 };
  return true;
}

export function toolPrice(g: Game, id: ToolId): number {
  return Math.round(TOOLS[id].price * (1 + 0.3 * (g.run.maxLayer - 1)) * (1 - derive(g).toolDiscount));
}

export function buyTool(g: Game, id: ToolId): boolean {
  const cost = toolPrice(g, id);
  if (g.run.cash < cost) return false;
  g.run.cash -= cost;
  g.run.tools[id]++;
  return true;
}

export const debtRemaining = (run: Run) => run.debtAmount - run.debtPaid;

export function payDebt(g: Game, amount: number): number {
  const run = g.run;
  const pay = Math.floor(Math.max(0, Math.min(amount, run.cash, debtRemaining(run))));
  if (pay <= 0) return 0;
  run.cash -= pay;
  run.debtPaid += pay;
  if (debtRemaining(run) <= 0) {
    const s = derive(g);
    run.debtsPaid++;
    run.debtIndex++;
    run.debtPaid = 0;
    run.debtAmount = debtFor(run.debtIndex, s.debtGrowth);
    run.debtDue += s.debtPeriod;
    if ((run.clauses ?? []).includes('puritan')) {
      const cash = 100 * run.debtIndex;
      run.cash += cash;
      run.earned += cash;
    } else {
      run.pendingChoices = withRng(g, (r) => rollArtifacts(g, r, s.artifactChoices));
      if (!run.pendingChoices.length) run.pendingChoices = null;
    }
  }
  return pay;
}

export function rollArtifacts(g: Game, r: Rng, n: number): string[] {
  const pool = ARTIFACTS.filter((a) => !g.run.artifacts.includes(a.id)).map((a) => a.id);
  return r.shuffle(pool).slice(0, n);
}

export function pickArtifact(g: Game, id: string | null) {
  const run = g.run;
  if (!run.pendingChoices) return;
  if (id && run.pendingChoices.includes(id)) run.artifacts.push(id);
  else run.cash += 50 * run.debtIndex;
  run.pendingChoices = null;
}

export function baseShards(run: Run): number {
  return Math.floor(2 * Math.log2(1 + run.earned / 100) + (run.maxLayer - 1) / 2) + run.debtsPaid * 2;
}

export function calcShards(run: Run): number {
  return Math.floor(baseShards(run) * (1 + clauseBonus(run.clauses)));
}

export function toggleClause(g: Game, id: string) {
  const cur = g.meta.clauses ?? [];
  g.meta.clauses = cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id];
}

/** Ends the day. Returns false if the run was foreclosed instead. */
export function endDay(g: Game): boolean {
  const run = g.run;
  if (run.phase !== 'town' || run.pendingChoices || !run.minedToday) return true;
  if (run.day >= run.debtDue && debtRemaining(run) > 0) {
    foreclose(g);
    return false;
  }
  const s = derive(g);
  run.day++;
  run.minedToday = false;
  run.hilo = null;
  withRng(g, (r) => {
    run.prevPrices = { ...run.prices };
    for (const o of ORES) {
      let f = run.prices[o];
      f += (1 - f) * 0.25 + r.normal() * 0.13;
      if (r.chance(0.06)) f = r.range(1.6, 2.1);
      run.prices[o] = Math.round(Math.max(0.5, Math.min(2.2, f)) * 100) / 100;
    }
  });
  // Miners haul ore from the deepest unlocked layer, so they keep pace as you go deeper.
  const minerOre = (run.upgrades.miner ?? 0) * s.minerOre;
  const ores = biomeFor(run.maxLayer).ores;
  let miners = 0;
  withRng(g, (r) => {
    for (let n = 0; n < minerOre; n++) {
      const o = r.weighted(ores);
      run.inventory[o] = (run.inventory[o] ?? 0) + 1;
      miners += unitPrice(g, o);
    }
  });
  miners = Math.floor(miners);
  run.claims = withRng(g, (r) => rollClaims(g, r));
  const interest = run.artifacts.includes('interest') ? Math.floor(Math.min(run.cash * 0.04, 40 * run.day)) : 0;
  run.cash += interest;
  run.morning = minerOre + interest > 0 ? { miners, minerOre, interest } : null;
  return true;
}

export function foreclose(g: Game) {
  const run = g.run;
  if (run.phase === 'foreclosed' || run.phase === 'legacy') return;
  run.mine = null;
  run.hilo = null;
  run.pendingChoices = null;
  run.phase = 'foreclosed';
  run.shardsEarned = calcShards(run);
}

export function rebirth(g: Game) {
  const run = g.run;
  if (run.phase !== 'foreclosed') return;
  const st = g.meta.stats;
  g.meta.shards += run.shardsEarned;
  st.rebirths++;
  st.bestDay = Math.max(st.bestDay, run.day);
  st.totalEarned += run.earned;
  st.debtsPaid += run.debtsPaid;
  run.phase = 'legacy';
}

export function legacyPrice(g: Game, id: string): number | null {
  const d = LEGACY_MAP[id];
  const lvl = g.meta.legacy[id] ?? 0;
  return lvl >= d.max ? null : d.cost(lvl);
}

export function buyLegacy(g: Game, id: string): boolean {
  const cost = legacyPrice(g, id);
  if (cost === null || g.meta.shards < cost) return false;
  g.meta.shards -= cost;
  g.meta.legacy[id] = (g.meta.legacy[id] ?? 0) + 1;
  return true;
}
