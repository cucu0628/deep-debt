import { describe, expect, it } from 'vitest';
import { SLOT_PAIR, SLOT_SYMBOLS, SLOT_TRIPLE, SLOT_WEIGHTS, boosted, hiloMult, hiloOdds } from '../casino';
import type { TileKind } from '../data/tiles';
import { canDig, dynamite, hit, type MineCtx, type MineState } from '../mine';
import { Rng } from '../rng';
import { newGame } from '../run';
import { derive } from '../stats';

function grid(rows: string[]): MineState {
  const key: Record<string, TileKind> = { '.': 'empty', d: 'dirt', s: 'stone', c: 'copper', g: 'gold', T: 'tnt', L: 'lava', E: 'energy', B: 'bedrock', X: 'crystal' };
  const cells = rows.join('').split('').map((ch) => ({ k: key[ch], hp: 1, max: 1, rev: true }));
  return { w: rows[0].length, h: rows.length, layer: 1, cells, energy: 10, bottomReached: false, haul: {}, bestCombo: 0, cashFound: 0, relicsFound: [], tremorUsed: false, tilesBroken: 0 };
}

const ctx = (arts: string[] = []): MineCtx => ({ stats: derive(newGame(1)), arts: new Set(arts), rng: new Rng(7) });

describe('mine chains', () => {
  it('mining one ore collects the whole vein', () => {
    const m = grid(['cccd', 'dddc', 'dddd']);
    const r = hit(m, 0, ctx())!;
    expect(r.combo).toBe(3);
    expect(m.cells[3].k).toBe('dirt');
    expect(m.cells[7].k).toBe('copper');
    expect(r.cargo.copper).toBeGreaterThanOrEqual(3);
  });

  it('TNT chains into other TNT', () => {
    const m = grid(['Tddd', 'dTdd', 'ddTd', 'dddd']);
    const r = hit(m, 0, ctx())!;
    expect(r.events.filter((e) => e.t === 'explode')).toHaveLength(3);
    expect(m.cells[15].k).toBe('empty');
  });

  it('TNT only cracks rock tougher than its blast', () => {
    const m = grid(['Tdd', 'ddd']);
    m.cells[1] = { k: 'obsidian', hp: 5, max: 5, rev: true };
    const r = hit(m, 0, ctx())!;
    expect(m.cells[1].k).toBe('obsidian');
    expect(m.cells[1].hp).toBe(5 - derive(newGame(1)).blastPower);
    expect(m.cells[3].k).toBe('empty');
    expect(r.events.some((e) => e.t === 'hit' && e.i === 1)).toBe(true);
  });

  it('hand-placed dynamite ignores hardness and cracks stairs', () => {
    const m = grid(['ddd', 'ddd', 'ddd']);
    m.cells[4] = { k: 'obsidian', hp: 50, max: 50, rev: true };
    m.cells[7] = { k: 'stairs', hp: 20, max: 20, rev: true };
    const r = dynamite(m, 4, ctx());
    expect(m.cells[4].k).toBe('empty');
    expect(m.cells[7].k).toBe('empty');
    expect(r.newBottom).toBe(true);
  });

  it('lava burns adjacent ore without collecting it', () => {
    const m = grid(['Lgdd', 'dddd']);
    const r = hit(m, 0, ctx())!;
    expect(m.cells[1].k).toBe('empty');
    expect(r.cargo.gold).toBeUndefined();
    const m2 = grid(['Lgdd', 'dddd']);
    expect(hit(m2, 0, ctx(['forge']))!.cargo.gold).toBeGreaterThanOrEqual(2);
  });

  it('crystal shards stop at bedrock', () => {
    const m = grid(['dXdBd']);
    hit(m, 1, ctx(['resonance']));
    expect(m.cells[2].k).toBe('empty');
    expect(m.cells[3].k).toBe('bedrock');
    expect(m.cells[4].k).toBe('dirt');
  });

  it('only tiles next to open ground are diggable', () => {
    const m = grid(['dd', 'dd', 'dd']);
    expect(canDig(m, 0)).toBe(true);
    expect(canDig(m, 4)).toBe(false);
    hit(m, 0, ctx());
    expect(canDig(m, 2)).toBe(true);
  });

  it('energy crystals refund energy', () => {
    const m = grid(['Ed']);
    const r = hit(m, 0, ctx())!;
    expect(r.energy).toBe(2);
    expect(m.energy).toBe(11);
  });
});

describe('saloon odds', () => {
  it('slots keep a house edge even with every bonus', () => {
    const total = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
    let ev = 0;
    for (const a of SLOT_SYMBOLS)
      for (const b of SLOT_SYMBOLS)
        for (const c of SLOT_SYMBOLS) {
          const p = (SLOT_WEIGHTS[a] * SLOT_WEIGHTS[b] * SLOT_WEIGHTS[c]) / total ** 3;
          let mult = 0;
          if (a === b && b === c) mult = SLOT_TRIPLE[a];
          else if (a === b || a === c) mult = SLOT_PAIR[a];
          else if (b === c) mult = SLOT_PAIR[b];
          ev += p * boosted(1000, 1000 * mult, 1.25) / 1000;
        }
    console.log('slots RTP with max bonus', ev.toFixed(3));
    expect(ev).toBeLessThan(1);
  });

  it('High-Low pays less than fair odds', () => {
    for (let card = 2; card <= 12; card++) expect(hiloOdds(card, 'hi') * hiloMult(card, 'hi')).toBeLessThan(1);
  });
});
