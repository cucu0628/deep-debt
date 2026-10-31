import type { Ore, Rock, Special } from './tiles';

export interface Biome {
  id: string;
  name: string;
  fromLayer: number;
  bg: string;
  rock: Partial<Record<Rock, number>>;
  ores: Partial<Record<Ore, number>>;
  /** Fraction of the grid that is ore. */
  oreDensity: number;
  /** Expected count of each special on a 9x9 grid. */
  specials: Partial<Record<Special, number>>;
  relicSet: string;
}

export const BIOMES: Biome[] = [
  {
    id: 'topsoil',
    name: 'Topsoil',
    fromLayer: 1,
    bg: '#2b1d14',
    rock: { dirt: 70, stone: 30 },
    ores: { coal: 50, copper: 35, iron: 12, silver: 3 },
    oreDensity: 0.24,
    specials: { tnt: 1.4, gas: 0.6, crystal: 0.5, energy: 1.4, chest: 0.8, magnet: 0.3, multi: 0.3, lava: 0.2 },
    relicSet: 'fossils',
  },
  {
    id: 'caverns',
    name: 'Caverns',
    fromLayer: 4,
    bg: '#1e1b24',
    rock: { dirt: 30, stone: 55, hardrock: 15 },
    ores: { coal: 20, copper: 30, iron: 30, silver: 15, gold: 5 },
    oreDensity: 0.26,
    specials: { tnt: 1.9, gas: 1.2, crystal: 0.8, energy: 1.5, chest: 0.9, magnet: 0.5, multi: 0.5, lava: 0.6 },
    relicSet: 'miners',
  },
  {
    id: 'crystal',
    name: 'Crystal Grotto',
    fromLayer: 7,
    bg: '#132430',
    rock: { stone: 50, hardrock: 50 },
    ores: { iron: 15, silver: 30, gold: 25, ruby: 15, emerald: 10, diamond: 2 },
    oreDensity: 0.27,
    specials: { tnt: 1.7, gas: 0.8, crystal: 3.2, energy: 1.6, chest: 1, magnet: 0.6, multi: 0.7, lava: 0.8 },
    relicSet: 'geodes',
  },
  {
    id: 'magma',
    name: 'Magma Depths',
    fromLayer: 10,
    bg: '#2a1210',
    rock: { stone: 15, hardrock: 60, obsidian: 25 },
    ores: { silver: 10, gold: 30, ruby: 30, emerald: 20, diamond: 10 },
    oreDensity: 0.28,
    specials: { tnt: 2.2, gas: 1.5, crystal: 1, energy: 1.8, chest: 1.1, magnet: 0.7, multi: 0.8, lava: 3 },
    relicSet: 'idols',
  },
  {
    id: 'abyss',
    name: 'The Abyss',
    fromLayer: 13,
    bg: '#0c0a18',
    rock: { hardrock: 40, obsidian: 52, bedrock: 8 },
    ores: { gold: 15, ruby: 20, emerald: 25, diamond: 25, voidstone: 15 },
    oreDensity: 0.3,
    specials: { tnt: 2.4, gas: 1.5, crystal: 1.5, energy: 2, chest: 1.2, magnet: 1, multi: 1, lava: 2 },
    relicSet: 'void',
  },
];

export function biomeFor(layer: number): Biome {
  let b = BIOMES[0];
  for (const x of BIOMES) if (layer >= x.fromLayer) b = x;
  return b;
}
