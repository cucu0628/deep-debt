import { describe, expect, it } from 'vitest';
import { buyLegacy, newGame, rebirth, startRun } from '../run';
import type { Game } from '../state';
import { simulateRun, type SimResult } from './sim';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function summarize(label: string, rs: SimResult[]) {
  const s = {
    days: median(rs.map((r) => r.days)),
    debts: median(rs.map((r) => r.debtsPaid)),
    layer: median(rs.map((r) => r.maxLayer)),
    earned: median(rs.map((r) => r.earned)),
    shards: median(rs.map((r) => r.shards)),
  };
  console.log(label, JSON.stringify(s));
  return s;
}

describe('balance', () => {
  it('a fresh run ends in foreclosure after a reasonable number of days', () => {
    const rs = Array.from({ length: 40 }, (_, k) => simulateRun(newGame(1000 + k)));
    const s = summarize('fresh', rs);
    expect(s.days).toBeGreaterThanOrEqual(10);
    expect(s.days).toBeLessThanOrEqual(35);
    expect(rs.every((r) => r.days < 120)).toBe(true);
  });

  it('Legacy upgrades let later runs go further', () => {
    const results: SimResult[][] = [];
    for (let k = 0; k < 10; k++) {
      const g = newGame(5000 + k);
      const runs: SimResult[] = [];
      for (let n = 0; n < 6; n++) {
        runs.push(simulateRun(g));
        rebirth(g);
        for (let guard = 0; guard < 40; guard++) {
          const bought = ['pick', 'energy', 'relief', 'start_cash', 'luck', 'depth', 'miners', 'grace'].some((id) => buyLegacy(g, id));
          if (!bought) break;
        }
        startRun(g, 9000 + k * 10 + n);
      }
      results.push(runs);
    }
    const first = summarize('run 1', results.map((r) => r[0]));
    const last = summarize('run 6', results.map((r) => r[5]));
    expect(last.debts).toBeGreaterThan(first.debts);
  });

  it('hard claims are a gamble, not a strict upgrade', () => {
    const play = (pick: (g: Game) => number) =>
      median(
        Array.from({ length: 10 }, (_, k) => {
          const g = newGame(7000 + k);
          g.meta.legacy = { pick: 3, energy: 3, depth: 3, luck: 4, miners: 2 };
          startRun(g, 7100 + k);
          return simulateRun(g, 120, undefined, pick).earned;
        }),
      );
    const easy = play(() => 0);
    const hard = play((g) => (g.run.claims?.length ?? 1) - 1);
    console.log('claims', JSON.stringify({ easy: Math.round(easy), hard: Math.round(hard) }));
    expect(hard / easy).toBeGreaterThan(0.6);
    expect(hard / easy).toBeLessThan(1.6);
  });
});
