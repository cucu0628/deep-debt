import { describe, expect, it } from 'vitest';
import { bestCell } from '../autodig';
import { MUTATORS, mutatorReward } from '../data/mutators';
import type { TileKind } from '../data/tiles';
import { generateMine, hit, hitCost, type MineCtx, type MineState } from '../mine';
import { Rng } from '../rng';
import { buyLegacy, calcShards, baseShards, descend, mineHit, newGame, payDebt, rebirth, startRun, toggleClause } from '../run';
import { derive, type Stats } from '../stats';

function grid(rows: string[], hp = 1): MineState {
  const key: Record<string, TileKind> = { '.': 'empty', d: 'dirt', s: 'stone', c: 'copper', B: 'bedrock' };
  const cells = rows.join('').split('').map((ch) => ({ k: key[ch], hp, max: hp, rev: true }));
  return { w: rows[0].length, h: rows.length, layer: 1, cells, energy: 10, bottomReached: false, haul: {}, bestCombo: 0, cashFound: 0, relicsFound: [], tremorUsed: false, tilesBroken: 0 };
}

const ctx = (over: Partial<Stats> = {}): MineCtx => ({ stats: { ...derive(newGame(1)), ...over }, arts: new Set(), rng: new Rng(7) });

describe('piercing pick', () => {
  it('leftover damage breaks the tiles behind, in the swing direction', () => {
    const m = grid(['dddd', 'dddd', 'dddd', 'dddd']);
    hit(m, 1, ctx({ pickPower: 3, pierce: 1 }));
    // From the surface the swing goes down: 1 for the target, 2 more pierce through.
    expect([1, 5, 9].map((i) => m.cells[i].k)).toEqual(['empty', 'empty', 'empty']);
    expect(m.cells[13].k).toBe('dirt');
    expect(m.cells[0].k).toBe('dirt');
  });

  it('without the upgrade nothing pierces', () => {
    const m = grid(['dddd', 'dddd']);
    hit(m, 1, ctx({ pickPower: 3, pierce: 0 }));
    expect(m.cells[5].k).toBe('dirt');
  });

  it('pierce stops at bedrock and cracks tiles it cannot break', () => {
    const m = grid(['dd', 'dd', 'BB']);
    m.cells[2] = { k: 'stone', hp: 5, max: 5, rev: true };
    hit(m, 0, ctx({ pickPower: 3, pierce: 1 }));
    expect(m.cells[2].k).toBe('stone');
    expect(m.cells[2].hp).toBe(3);
  });
});

describe('mutators', () => {
  it('every mutator generates a valid mine', () => {
    const s = derive(newGame(1));
    for (const mu of MUTATORS) {
      for (const layer of [1, 8, 20]) {
        const m = generateMine(layer, s, new Set(), new Rng(layer), [mu.id]);
        expect(m.cells.filter((c) => c.k === 'stairs')).toHaveLength(1);
        expect(m.mods).toEqual([mu.id]);
        expect(m.bonus).toBeCloseTo(mu.reward);
      }
    }
  });

  it('flooded rows cost 2 energy per hit', () => {
    const m = generateMine(5, derive(newGame(1)), new Set(), new Rng(1), ['flooded']);
    expect(hitCost(m, 0)).toBe(1);
    expect(hitCost(m, m.cells.length - 1)).toBe(2);
  });

  it('pitch black reveals ore through the fog', () => {
    const m = generateMine(5, derive(newGame(1)), new Set(), new Rng(3), ['dark']);
    const deepOre = m.cells.filter((c, i) => Math.floor(i / m.w) > 4 && ['coal', 'copper', 'iron', 'silver', 'gold'].includes(c.k));
    expect(deepOre.length).toBeGreaterThan(0);
    expect(deepOre.every((c) => c.rev)).toBe(true);
  });

  it('crumbling mines cave back in every 4th hit', () => {
    const m = grid(['dddd', 'dddd', 'dddd']);
    m.mods = ['cavein'];
    const c = ctx();
    for (let k = 0; k < 4; k++) hit(m, k, c);
    // The 3rd hit collapses all 3 open tiles back into rock (the chain's own tile is spared), then the 4th digs one.
    expect(m.cells.filter((x) => x.k === 'empty')).toHaveLength(2);
  });

  it('mutator loot bonus multiplies ore', () => {
    const plain = grid(['cccd']);
    const rich = grid(['cccd']);
    rich.bonus = 1;
    const a = hit(plain, 0, ctx())!;
    const b = hit(rich, 0, ctx())!;
    expect(b.cargo.copper!).toBeGreaterThan(a.cargo.copper!);
    expect(mutatorReward(['flooded', 'hardened'])).toBeCloseTo(0.5);
  });
});

describe('claims & clauses', () => {
  it('claims open up at layer 4 and get harder in the Abyss', () => {
    const g = newGame(11);
    expect(g.run.claims).toHaveLength(1);
    g.run.maxLayer = 13;
    startRun(g, 12);
    g.run.maxLayer = 13;
    // Re-roll for the deeper max layer, like a new morning would.
    g.run.claims = undefined;
    descend(g, 13, 2);
    expect(g.run.mine!.mods).toHaveLength(3);
  });

  it('clauses multiply shards and change stats', () => {
    const g = newGame(2);
    const before = derive(g);
    toggleClause(g, 'usury');
    toggleClause(g, 'frail');
    startRun(g, 3);
    const after = derive(g);
    expect(after.debtGrowth).toBeCloseTo(before.debtGrowth + 0.25);
    expect(after.maxEnergy).toBe(before.maxEnergy - 3);
    g.run.earned = 50000;
    g.run.debtsPaid = 3;
    expect(calcShards(g.run)).toBe(Math.floor(baseShards(g.run) * 1.5));
  });

  it('puritan pays cash instead of offering artifacts', () => {
    const g = newGame(4);
    toggleClause(g, 'puritan');
    startRun(g, 5);
    g.run.cash = 1e6;
    payDebt(g, g.run.debtAmount);
    expect(g.run.pendingChoices).toBeNull();
    expect(g.run.debtsPaid).toBe(1);
  });

  it('mastery is unlimited', () => {
    const g = newGame(6);
    g.meta.shards = 1e6;
    for (let k = 0; k < 40; k++) expect(buyLegacy(g, 'mastery')).toBe(true);
    expect(derive(g).oreBonus).toBeGreaterThan(2.9);
    rebirth(g);
  });

  it('the foreman auto-digs until energy runs out', () => {
    const g = newGame(8);
    descend(g, 1);
    let hits = 0;
    while (g.run.mine!.energy > 0 && hits < 200) {
      const i = bestCell(g);
      if (i < 0) break;
      expect(mineHit(g, i)).not.toBeNull();
      hits++;
    }
    expect(hits).toBeGreaterThan(0);
  });
});
