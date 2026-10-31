import { describe, expect, it } from 'vitest';
import { AD_ENERGY, adCrate, adEnergy, adHaul, adReroll, adShards, canWatch } from '../rewards';
import { descend, endDay, foreclose, newGame, surface } from '../run';
import type { Game } from '../state';

function dayThree(): Game {
  const g = newGame(42);
  g.run.day = 3;
  g.run.debtDue = 99;
  return g;
}

describe('rewarded ads', () => {
  it('stay hidden for brand-new players', () => {
    const g = newGame(1);
    expect(canWatch(g, 'crate')).toBe(false);
    g.run.day = 3;
    expect(canWatch(g, 'crate')).toBe(true);
  });

  it('energy refill works once per dig', () => {
    const g = dayThree();
    descend(g, 1);
    const e = g.run.mine!.energy;
    expect(adEnergy(g)).toBe(true);
    expect(g.run.mine!.energy).toBe(e + AD_ENERGY);
    expect(adEnergy(g)).toBe(false);
  });

  it('haul bonus adds half of today\'s ore, once a day', () => {
    const g = dayThree();
    descend(g, 1);
    g.run.mine!.haul = { copper: 10 };
    surface(g);
    const before = g.run.inventory.copper ?? 0;
    expect(adHaul(g)).toBe(5);
    expect(g.run.inventory.copper).toBe(before + 5);
    expect(adHaul(g)).toBe(0);
  });

  it('claim reroll and free crate reset the next day', () => {
    const g = dayThree();
    g.run.maxLayer = 6;
    g.run.claims = [{ mods: [] }, { mods: ['dark'] }];
    expect(adReroll(g)).toBe(true);
    expect(adReroll(g)).toBe(false);
    const cash = g.run.cash;
    expect(adCrate(g)).not.toBeNull();
    expect(g.run.cash).toBeGreaterThanOrEqual(cash);
    expect(adCrate(g)).toBeNull();
    descend(g, 1);
    surface(g);
    endDay(g);
    expect(canWatch(g, 'crate')).toBe(true);
  });

  it('shard bonus once per foreclosure', () => {
    const g = dayThree();
    g.run.earned = 100000;
    foreclose(g);
    const base = g.run.shardsEarned;
    expect(adShards(g)).toBe(Math.ceil(base * 0.25));
    expect(adShards(g)).toBe(0);
  });

  it('no free crate under Prohibition', () => {
    const g = dayThree();
    g.run.clauses = ['dry'];
    expect(canWatch(g, 'crate')).toBe(false);
  });
});
