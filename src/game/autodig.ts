import { biomeFor } from './data/biomes';
import { ORE_INFO, isOre } from './data/tiles';
import { canDig, hitCost, type MineState } from './mine';
import type { Game } from './state';
import { derive } from './stats';

/** Pickaxe power at which a biome becomes worth digging in. */
export const PICK_FOR_BIOME: Record<string, number> = { topsoil: 1, caverns: 2, crystal: 3, magma: 4, abyss: 6 };

function veinValue(m: MineState, i: number): number {
  const k = m.cells[i].k;
  if (!isOre(k)) return 0;
  const seen = new Set([i]);
  const q = [i];
  while (q.length) {
    const c = q.pop()!;
    const x = c % m.w;
    const y = Math.floor(c / m.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const n = ny * m.w + nx;
      if (!seen.has(n) && m.cells[n].k === k) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  return seen.size * ORE_INFO[k].value * (1 + Math.sqrt(seen.size) * 0.35);
}

const SPECIAL_SCORE: Record<string, number> = { tnt: 30, chest: 40, energy: 30, multi: 15, magnet: 25, crystal: 15, gas: 15, relic: 30, lava: -20 };

/** Greedy choice of the next tile to hit: value per energy spent, nudged downwards. -1 if nothing is diggable. */
export function bestCell(g: Game): number {
  const m = g.run.mine!;
  const s = derive(g);
  const power = s.pickPower;
  const nextBiome = biomeFor(m.layer + 1).id;
  const wantDeeper = m.layer + 1 > g.run.maxLayer - 1 && m.layer + 1 <= s.permitLayer && power >= PICK_FOR_BIOME[nextBiome];
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < m.cells.length; i++) {
    if (!canDig(m, i)) continue;
    const c = m.cells[i];
    const cost = Math.ceil(c.hp / power) * hitCost(m, i);
    const y = Math.floor(i / m.w);
    const value = isOre(c.k) ? veinValue(m, i) : c.k === 'stairs' ? (wantDeeper ? 400 : 0) : (SPECIAL_SCORE[c.k] ?? 0);
    const score = (value + 3 + y * 1.5) / cost;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
