import { describe, expect, it } from 'vitest';
import { currentTip } from '../tutorial';
import { descend, mineHit, newGame, payDebt, sell, surface } from '../run';

describe('first-run tips', () => {
  it('walk a new player through the first day', () => {
    const g = newGame(3);
    expect(currentTip(g)?.building).toBe('mine');
    descend(g, 1);
    expect(currentTip(g)?.text).toMatch(/Click a glowing tile/);
    mineHit(g, 4);
    g.run.mine!.haul = { copper: 4 };
    surface(g);
    g.run.inventory = { copper: 4 };
    expect(currentTip(g)?.building).toBe('market');
    sell(g);
    expect(currentTip(g)?.building).not.toBe('market');
  });

  it('stop once the first installment is paid, or when switched off', () => {
    const g = newGame(4);
    g.meta.tipsOff = true;
    expect(currentTip(g)).toBeNull();
    const h = newGame(5);
    h.run.cash = 1e6;
    payDebt(h, h.run.debtAmount);
    expect(currentTip(h)).toBeNull();
  });
});
