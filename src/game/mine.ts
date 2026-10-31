import { biomeFor } from './data/biomes';
import { mutatorReward } from './data/mutators';
import { RELIC_SETS } from './data/relics';
import { ORES, ORE_INFO, ROCKS, SPECIALS, TILE_INFO, isOre, type Ore, type Special, type TileKind } from './data/tiles';
import { TOOL_IDS, type ToolId } from './data/upgrades';
import type { Rng } from './rng';
import type { Stats } from './stats';

export interface Cell {
  k: TileKind;
  hp: number;
  max: number;
  rev: boolean;
}

export interface MineState {
  w: number;
  h: number;
  layer: number;
  cells: Cell[];
  energy: number;
  bottomReached: boolean;
  haul: Partial<Record<Ore, number>>;
  bestCombo: number;
  cashFound: number;
  relicsFound: string[];
  tremorUsed: boolean;
  tilesBroken: number;
  /** Claim mutators active in this mine (absent in old saves). */
  mods?: string[];
  /** Extra loot multiplier from mutators. */
  bonus?: number;
  /** First flooded row, or -1. */
  water?: number;
  /** Successful pickaxe hits so far (drives cave-ins and tremors). */
  hits?: number;
  /** The rewarded-ad energy refill was used in this dig. */
  adEnergy?: boolean;
}

export const hasMod = (m: MineState, id: string) => !!m.mods?.includes(id);

/** Energy a pickaxe hit on cell `i` costs. */
export function hitCost(m: MineState, i: number): number {
  return m.water !== undefined && m.water >= 0 && Math.floor(i / m.w) >= m.water ? 2 : 1;
}

export type Cause = 'pick' | 'vein' | 'blast' | 'gas' | 'shard' | 'burn' | 'magnet' | 'drill' | 'tool';

/** Chain damage only cracks rock and ore it is strong enough for. Tools ignore hardness. */
const DAMAGING = new Set<Cause>(['blast', 'gas', 'shard']);
const BREAKS_STAIRS = new Set<Cause>(['pick', 'drill', 'tool']);

export type MineEvent =
  | { t: 'hit'; i: number; step: number }
  | { t: 'break'; i: number; k: TileKind; step: number; cause: Cause }
  | { t: 'burn'; i: number; k: TileKind; step: number }
  | { t: 'explode'; i: number; r: number; step: number }
  | { t: 'gas'; i: number; step: number }
  | { t: 'shard'; i: number; dx: number; dy: number; len: number; step: number }
  | { t: 'lava'; i: number; step: number }
  | { t: 'magnet'; i: number; r: number; step: number }
  | { t: 'energy'; i: number; amt: number; step: number }
  | { t: 'chest'; i: number; text: string; step: number }
  | { t: 'mult'; i: number; step: number }
  | { t: 'relic'; i: number; relic: string; step: number }
  | { t: 'reveal'; i: number; step: number }
  | { t: 'collapse'; i: number; step: number }
  | { t: 'quake'; step: number };

export interface ChainResult {
  events: MineEvent[];
  combo: number;
  /** Total multiplier applied to ore (combo × chain multipliers), excluding passive bonuses. */
  mult: number;
  cargo: Partial<Record<Ore, number>>;
  energy: number;
  cash: number;
  tools: Partial<Record<ToolId, number>>;
  relics: string[];
  steps: number;
  newBottom: boolean;
  freeHit: boolean;
}

export interface MineCtx {
  stats: Stats;
  arts: Set<string>;
  rng: Rng;
}

const ROCK_SET = new Set<TileKind>(ROCKS);

const DIR4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function generateMine(layer: number, stats: Stats, arts: Set<string>, rng: Rng, modList: string[] = []): MineState {
  const mods = new Set(modList);
  const w = stats.gridSize;
  const h = stats.gridSize;
  const area = w * h;
  const biome = biomeFor(layer);
  const depthIn = Math.min(2, layer - biome.fromLayer);
  const extraHp = Math.max(0, layer - 15);
  const luck = stats.luck;

  const hpFor = (k: TileKind) => {
    if (k === 'bedrock') return TILE_INFO.bedrock.hp;
    let hp = (isOre(k) ? ORE_INFO[k].hp : TILE_INFO[k as Special | 'stairs'].hp) + extraHp;
    if (ROCK_SET.has(k) && mods.has('motherlode')) hp += 3;
    if ((ROCK_SET.has(k) || isOre(k)) && mods.has('hardened')) hp = Math.ceil(hp * 1.5);
    return hp;
  };
  const cells: Cell[] = [];
  for (let i = 0; i < area; i++) {
    const k = rng.weighted(biome.rock);
    const hp = hpFor(k);
    cells.push({ k, hp, max: hp, rev: false });
  }
  const set = (i: number, k: TileKind) => {
    const hp = hpFor(k);
    cells[i] = { k, hp, max: hp, rev: false };
  };

  // Ore veins: luck and depth inside the biome skew towards the rarer ores.
  const oreW: Partial<Record<Ore, number>> = {};
  const ores = Object.entries(biome.ores) as [Ore, number][];
  const skew = 1 + 0.06 * luck + 0.1 * depthIn + (mods.has('goldrush') ? 0.25 : 0);
  ores.forEach(([o, wt], idx) => (oreW[o] = wt * Math.pow(skew, idx)));
  const density = (mods.has('goldrush') ? 1.3 : 1) * (mods.has('vault') ? 0.6 : 1);
  const target = Math.round(area * biome.oreDensity * (1 + 0.02 * luck) * density);
  let placed = 0;
  for (let guard = 0; placed < target && guard < 300; guard++) {
    const ore = rng.weighted(oreW);
    const size = (rng.int(2, 5) + (rng.chance(0.05 * luck) ? 2 : 0)) * (mods.has('motherlode') ? 2 : 1);
    let cur = rng.int(w, area - 1);
    const vein = [cur];
    if (!isOre(cells[cur].k)) {
      set(cur, ore);
      placed++;
    }
    for (let n = 1; n < size; n++) {
      const from = rng.pick(vein);
      const [dx, dy] = rng.pick(DIR4);
      const x = (from % w) + dx;
      const y = Math.floor(from / w) + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      cur = y * w + x;
      if (isOre(cells[cur].k)) continue;
      set(cur, ore);
      vein.push(cur);
      placed++;
    }
  }

  // Specials.
  const used = new Set<number>();
  const freeCell = (minY: number) => {
    for (let t = 0; t < 50; t++) {
      const i = rng.int(minY * w, area - 1);
      if (!used.has(i)) return i;
    }
    return -1;
  };
  for (const s of SPECIALS) {
    let e = (biome.specials[s] ?? 0) * (area / 81);
    if (s === 'lava' && arts.has('pyromaniac')) e *= 2;
    if (s === 'chest') e *= (arts.has('treasure_hunter') ? 2 : 1) * (1 + 0.05 * luck);
    if (s === 'gas' && arts.has('gas_mask')) e *= 3;
    if (s === 'energy' || s === 'multi' || s === 'magnet') e *= 1 + 0.08 * luck;
    if (s === 'energy' && mods.has('goldrush')) e = 0;
    if ((s === 'energy' || s === 'chest') && mods.has('haunted')) e *= 0.5;
    if (s === 'chest' && mods.has('vault')) e *= 3;
    if (s === 'lava' && mods.has('volcanic')) e *= 3;
    if (s === 'lava' && mods.has('goldrush')) e *= 2;
    if (s === 'tnt' && mods.has('volcanic')) e *= 2;
    if (s === 'gas' && mods.has('gassy')) e *= 3;
    const n = Math.floor(e) + (rng.chance(e % 1) ? 1 : 0);
    for (let c = 0; c < n; c++) {
      let i = freeCell(1);
      if (i < 0) continue;
      set(i, s);
      used.add(i);
      // Gas comes in pockets.
      if (s === 'gas') {
        const extra = rng.int(1, 3);
        for (let g = 0; g < extra; g++) {
          const [dx, dy] = rng.pick(DIR4);
          const x = (i % w) + dx;
          const y = Math.floor(i / w) + dy;
          if (x < 0 || y < 1 || x >= w || y >= h) continue;
          const j = y * w + x;
          if (used.has(j)) continue;
          set(j, 'gas');
          used.add(j);
          i = j;
        }
      }
    }
  }
  if (mods.has('haunted') || rng.chance(0.18 + 0.015 * layer)) {
    const i = freeCell(Math.floor(h / 3));
    if (i >= 0) {
      set(i, 'relic');
      used.add(i);
    }
  }

  const stairs = (h - 1) * w + rng.int(0, w - 1);
  set(stairs, 'stairs');
  cells[stairs].hp = cells[stairs].max = 2 + layer + extraHp;

  const m: MineState = {
    w,
    h,
    layer,
    cells,
    energy: 0,
    bottomReached: false,
    haul: {},
    bestCombo: 0,
    cashFound: 0,
    relicsFound: [],
    tremorUsed: false,
    tilesBroken: 0,
    mods: [...mods],
    bonus: mutatorReward([...mods]),
    water: mods.has('flooded') ? Math.floor(h / 3) : -1,
    hits: 0,
  };
  updateFog(m, stats.vision);
  return m;
}

/** The surface counts as an empty row above row 0. */
export function updateFog(m: MineState, vision: number) {
  const { w, h, cells } = m;
  const dark = hasMod(m, 'dark');
  if (dark) vision = 1;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c.rev) continue;
    if (dark && isOre(c.k)) {
      c.rev = true;
      continue;
    }
    const x = i % w;
    const y = Math.floor(i / w);
    if (y < vision) {
      c.rev = true;
      continue;
    }
    search: for (let dy = -vision; dy <= vision; dy++) {
      for (let dx = -vision; dx <= vision; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (cells[ny * w + nx].k === 'empty') {
          c.rev = true;
          break search;
        }
      }
    }
  }
}

export function canDig(m: MineState, i: number): boolean {
  const c = m.cells[i];
  if (!c || c.k === 'empty' || c.k === 'bedrock' || !c.rev) return false;
  const x = i % m.w;
  const y = Math.floor(i / m.w);
  if (y === 0) return true;
  for (const [dx, dy] of DIR4) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
    if (m.cells[ny * m.w + nx].k === 'empty') return true;
  }
  return false;
}

type Item = { i: number; cause: Cause; boom?: number; dmg?: number };

class Chain {
  buckets: Item[][] = [];
  done = new Set<number>();
  events: MineEvent[] = [];
  ores: Partial<Record<Ore, number>> = {};
  combo = 0;
  mult = 1;
  energy = 0;
  cash = 0;
  tools: Partial<Record<ToolId, number>> = {};
  relics: string[] = [];
  tiles = 0;
  stairs = false;

  constructor(
    private m: MineState,
    private ctx: MineCtx,
  ) {}

  push(i: number, step: number, cause: Cause, boom?: number, dmg?: number) {
    (this.buckets[step] ??= []).push({ i, cause, boom, dmg });
  }

  run() {
    for (let s = 0; s < this.buckets.length; s++) {
      const b = this.buckets[s];
      if (!b) continue;
      for (const it of b) {
        if (it.boom !== undefined) this.explode(it.i, it.boom, s, it.dmg ?? this.ctx.stats.blastPower, it.cause);
        else this.destroy(it.i, s, it.cause, it.dmg);
      }
    }
  }

  private xy(i: number) {
    return { x: i % this.m.w, y: Math.floor(i / this.m.w) };
  }

  private idx(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.m.w || y >= this.m.h) return -1;
    return y * this.m.w + x;
  }

  private addOre(k: Ore, n: number) {
    if (this.ctx.arts.has('gem_cutter') && ORES.indexOf(k) >= 5) n *= 1.5;
    this.ores[k] = (this.ores[k] ?? 0) + n;
  }

  explode(i: number, r: number, step: number, dmg: number, cause: Cause = 'blast') {
    this.events.push({ t: 'explode', i, r, step });
    if (this.ctx.arts.has('chain_lightning')) this.combo += 3;
    const { x, y } = this.xy(i);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const j = this.idx(x + dx, y + dy);
        if (j < 0) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d === 0) this.destroy(j, step, cause, dmg);
        else this.push(j, step + d, cause, undefined, dmg);
      }
    }
  }

  destroy(i: number, step: number, cause: Cause, dmg = Infinity) {
    const { m, ctx } = this;
    const c = m.cells[i];
    if (c.k === 'empty' || c.k === 'bedrock' || this.done.has(i)) return;
    if (c.k === 'stairs' && !BREAKS_STAIRS.has(cause)) return;
    // Specials are fragile and always go off; rock and ore resist weak chain damage.
    if (DAMAGING.has(cause) && (isOre(c.k) || ROCK_SET.has(c.k)) && dmg < c.hp) {
      c.hp -= dmg;
      this.events.push({ t: 'hit', i, step });
      return;
    }
    this.done.add(i);
    const k = c.k;
    c.k = 'empty';
    c.hp = 0;
    c.rev = true;

    if (cause === 'burn' && isOre(k)) {
      if (ctx.arts.has('forge')) {
        this.combo++;
        this.tiles++;
        this.addOre(k, 2);
        this.events.push({ t: 'break', i, k, step, cause });
      } else {
        this.events.push({ t: 'burn', i, k, step });
      }
      return;
    }

    this.combo++;
    this.tiles++;
    this.events.push({ t: 'break', i, k, step, cause });
    const { x, y } = this.xy(i);
    if (k === 'stairs') this.stairs = true;

    if (isOre(k)) {
      this.addOre(k, 1);
      if (ctx.arts.has('gold_fever') && ORES.indexOf(k) >= 4) this.mult += 0.25;
      if (k === 'coal' && ctx.arts.has('coal_power') && ctx.rng.chance(0.12)) {
        this.energy += 1;
        this.events.push({ t: 'energy', i, amt: 1, step });
      }
      if (cause !== 'vein') this.flood(i, k, step);
      return;
    }

    switch (k) {
      case 'tnt':
        this.explode(i, ctx.stats.blastRadius, step, ctx.stats.blastPower);
        break;
      case 'gas': {
        this.events.push({ t: 'gas', i, step });
        const diag = ctx.arts.has('gas_mask');
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx === 0 && dy === 0) || (!diag && dx !== 0 && dy !== 0)) continue;
            const j = this.idx(x + dx, y + dy);
            if (j >= 0) this.push(j, step + 1, 'gas', undefined, ctx.stats.gasPower);
          }
        }
        break;
      }
      case 'crystal':
        for (const [dx, dy] of DIR4) {
          let len = 0;
          for (let s = 1; s <= ctx.stats.crystalRange; s++) {
            const j = this.idx(x + dx * s, y + dy * s);
            if (j < 0 || m.cells[j].k === 'bedrock') break;
            this.push(j, step + s, 'shard', undefined, ctx.stats.shardPower);
            len = s;
          }
          if (len > 0) this.events.push({ t: 'shard', i, dx, dy, len, step });
        }
        break;
      case 'lava':
        this.events.push({ t: 'lava', i, step });
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const j = this.idx(x + dx, y + dy);
            if (j >= 0 && isOre(m.cells[j].k)) this.push(j, step + 1, 'burn');
          }
        }
        break;
      case 'energy':
        this.energy += 2;
        this.events.push({ t: 'energy', i, amt: 2, step });
        break;
      case 'chest': {
        const mul = ctx.arts.has('treasure_hunter') ? 2 : 1;
        if (ctx.rng.chance(0.65)) {
          const amt = Math.round((12 + m.layer * 10) * ctx.rng.range(0.8, 1.7) * mul * (1 + (m.bonus ?? 0)));
          this.cash += amt;
          this.events.push({ t: 'chest', i, text: `+$${amt}`, step });
        } else {
          const tool = ctx.rng.pick(TOOL_IDS);
          this.tools[tool] = (this.tools[tool] ?? 0) + mul;
          this.events.push({ t: 'chest', i, text: `+${mul} ${tool}`, step });
        }
        break;
      }
      case 'magnet': {
        const r = ctx.stats.magnetRadius;
        this.events.push({ t: 'magnet', i, r, step });
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const j = this.idx(x + dx, y + dy);
            if (j >= 0 && isOre(m.cells[j].k)) this.push(j, step + Math.max(Math.abs(dx), Math.abs(dy)), 'magnet');
          }
        }
        break;
      }
      case 'multi':
        this.mult += 1;
        this.events.push({ t: 'mult', i, step });
        break;
      case 'relic': {
        const set = RELIC_SETS.find((s) => s.id === biomeFor(m.layer).relicSet)!;
        const relic = ctx.rng.pick(set.relics).id;
        this.relics.push(relic);
        this.events.push({ t: 'relic', i, relic, step });
        break;
      }
    }
  }

  /** Crumbling mines: refill a few dug-out tiles with rock once the chain has played out. */
  collapse(n: number) {
    const { m, ctx } = this;
    const biome = biomeFor(m.layer);
    const rocks = Object.fromEntries(Object.entries(biome.rock).filter(([k]) => k !== 'bedrock')) as Partial<Record<string, number>>;
    const open: number[] = [];
    for (let i = 0; i < m.cells.length; i++) if (m.cells[i].k === 'empty' && !this.done.has(i)) open.push(i);
    const step = this.buckets.length + 1;
    const extraHp = Math.max(0, m.layer - 15);
    for (const i of ctx.rng.shuffle(open).slice(0, n)) {
      const k = ctx.rng.weighted(rocks) as TileKind;
      const hp = TILE_INFO[k as 'stone'].hp + extraHp;
      m.cells[i] = { k, hp, max: hp, rev: true };
      this.events.push({ t: 'collapse', i, step });
    }
    if (open.length) {
      this.events.push({ t: 'quake', step });
      this.buckets.length = step + 1;
    }
  }

  /** Mining one ore tile collects its whole connected vein. */
  private flood(i: number, k: Ore, step: number) {
    const { m, ctx } = this;
    const dist = new Map<number, number>([[i, 0]]);
    const q = [i];
    let far = i;
    let farD = 0;
    while (q.length) {
      const cur = q.shift()!;
      const d = dist.get(cur)!;
      const { x, y } = this.xy(cur);
      for (const [dx, dy] of DIR4) {
        const n = this.idx(x + dx, y + dy);
        if (n < 0 || dist.has(n) || this.done.has(n) || m.cells[n].k !== k) continue;
        dist.set(n, d + 1);
        q.push(n);
        if (d + 1 > farD) {
          farD = d + 1;
          far = n;
        }
      }
    }
    for (const [j, d] of dist) if (j !== i) this.push(j, step + d, 'vein');
    const size = dist.size;
    if (size >= 4 && ctx.arts.has('vein_tap')) this.addOre(k, Math.floor(size / 2));
    if (size >= 5 && k === 'copper' && ctx.arts.has('copper_heart')) this.push(far, step + farD + 1, 'blast', ctx.stats.blastRadius, ctx.stats.blastPower);
  }

  finish(freeHit: boolean): ChainResult {
    const { m, ctx } = this;
    const comboMult = 1 + Math.sqrt(Math.max(0, this.combo - 1)) * ctx.stats.comboRate;
    const total = comboMult * this.mult;
    const loot = ctx.stats.oreBonus * (1 + (m.bonus ?? 0));
    const cargo: Partial<Record<Ore, number>> = {};
    for (const [k, n] of Object.entries(this.ores) as [Ore, number][]) {
      cargo[k] = Math.max(1, Math.round(n * total * loot));
      m.haul[k] = (m.haul[k] ?? 0) + cargo[k]!;
    }
    if (this.tiles >= 15 && ctx.arts.has('aftershock')) this.energy += 3;
    m.energy += this.energy;
    m.cashFound += this.cash;
    m.relicsFound.push(...this.relics);
    m.bestCombo = Math.max(m.bestCombo, this.combo);
    m.tilesBroken += this.tiles;
    const newBottom = this.stairs && !m.bottomReached;
    if (this.stairs) m.bottomReached = true;
    updateFog(m, ctx.stats.vision);
    return {
      events: this.events,
      combo: this.combo,
      mult: total,
      cargo,
      energy: this.energy,
      cash: this.cash,
      tools: this.tools,
      relics: this.relics,
      steps: this.buckets.length,
      newBottom,
      freeHit,
    };
  }
}

export function hit(m: MineState, i: number, ctx: MineCtx): ChainResult | null {
  if (m.energy <= 0 || !canDig(m, i)) return null;
  const freeHit = ctx.arts.has('lucky_pick') && ctx.rng.chance(0.15);
  if (!freeHit) m.energy = Math.max(0, m.energy - hitCost(m, i));
  m.hits = (m.hits ?? 0) + 1;
  const chain = new Chain(m, ctx);
  // Tremors: every 5th hit sets off a blast somewhere in the mine.
  if (hasMod(m, 'tremors') && m.hits % 5 === 0) {
    const solid = m.cells.map((c, j) => (c.k !== 'empty' && c.k !== 'bedrock' && j !== i ? j : -1)).filter((j) => j >= 0);
    if (solid.length) chain.push(ctx.rng.pick(solid), 2, 'blast', 1, ctx.stats.blastPower);
  }
  if (ctx.arts.has('tremor') && !m.tremorUsed && m.cells[i].k !== 'stairs') {
    m.tremorUsed = true;
    chain.push(i, 0, 'blast', 1, ctx.stats.blastPower + ctx.stats.pickPower);
  } else {
    const c = m.cells[i];
    const before = c.hp;
    c.hp -= ctx.stats.pickPower;
    if (c.hp > 0) chain.events.push({ t: 'hit', i, step: 0 });
    else {
      chain.push(i, 0, 'pick');
      if (ctx.stats.pierce > 0) pierce(m, i, ctx.stats.pickPower - before, chain);
    }
  }
  chain.run();
  if (hasMod(m, 'cavein') && m.hits % 3 === 0) chain.collapse(4);
  return chain.finish(freeHit);
}

/** Leftover pickaxe damage travels on in the direction of the swing, breaking what it can. */
function pierce(m: MineState, i: number, over: number, chain: Chain) {
  const x = i % m.w;
  const y = Math.floor(i / m.w);
  // Swing direction: away from the open tile the miner stands in (the surface counts as open above row 0).
  let dir: readonly [number, number] = [0, 1];
  if (y > 0) {
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      if (m.cells[ny * m.w + nx].k === 'empty') {
        dir = [-dx, -dy];
        break;
      }
    }
  }
  for (let s = 1; over > 0; s++) {
    const nx = x + dir[0] * s;
    const ny = y + dir[1] * s;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) return;
    const j = ny * m.w + nx;
    const c = m.cells[j];
    if (c.k === 'empty' || c.k === 'bedrock') return;
    if (c.hp <= over) {
      over -= c.hp;
      chain.push(j, s, 'pick');
    } else {
      c.hp -= over;
      chain.events.push({ t: 'hit', i: j, step: s });
      chain.buckets.length = Math.max(chain.buckets.length, s + 1);
      return;
    }
  }
}

/** Hand-placed dynamite ignores hardness (bedrock aside) and can crack the stairs. */
export function dynamite(m: MineState, i: number, ctx: MineCtx): ChainResult {
  const chain = new Chain(m, ctx);
  chain.push(i, 0, 'tool', ctx.stats.blastRadius + 1, Infinity);
  chain.run();
  return chain.finish(false);
}

export function drill(m: MineState, i: number, ctx: MineCtx): ChainResult {
  const chain = new Chain(m, ctx);
  const x0 = i % m.w;
  const y = Math.floor(i / m.w);
  for (let x = 0; x < m.w; x++) chain.push(y * m.w + x, Math.abs(x - x0), 'drill');
  chain.run();
  return chain.finish(false);
}

export const SCAN_R = 3;

export function scan(m: MineState, i: number, ctx: MineCtx): ChainResult {
  const chain = new Chain(m, ctx);
  const x0 = i % m.w;
  const y0 = Math.floor(i / m.w);
  for (let dy = -SCAN_R; dy <= SCAN_R; dy++) {
    for (let dx = -SCAN_R; dx <= SCAN_R; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
      const c = m.cells[y * m.w + x];
      if (c.rev) continue;
      c.rev = true;
      chain.events.push({ t: 'reveal', i: y * m.w + x, step: Math.max(Math.abs(dx), Math.abs(dy)) });
    }
  }
  chain.buckets.length = SCAN_R + 1;
  return chain.finish(false);
}
