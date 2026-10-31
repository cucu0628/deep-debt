export const ORES = ['coal', 'copper', 'iron', 'silver', 'gold', 'ruby', 'emerald', 'diamond', 'voidstone'] as const;
export type Ore = (typeof ORES)[number];

export const ROCKS = ['dirt', 'stone', 'hardrock', 'obsidian', 'bedrock'] as const;
export type Rock = (typeof ROCKS)[number];

export const SPECIALS = ['tnt', 'gas', 'crystal', 'lava', 'energy', 'chest', 'magnet', 'multi', 'relic'] as const;
export type Special = (typeof SPECIALS)[number];

export type TileKind = 'empty' | 'stairs' | Rock | Ore | Special;

export interface OreInfo {
  name: string;
  value: number;
  hp: number;
  color: string;
}

export const ORE_INFO: Record<Ore, OreInfo> = {
  coal: { name: 'Coal', value: 2, hp: 1, color: '#2b2b2b' },
  copper: { name: 'Copper', value: 3, hp: 1, color: '#e08a4f' },
  iron: { name: 'Iron', value: 5, hp: 2, color: '#d6c4b0' },
  silver: { name: 'Silver', value: 8, hp: 2, color: '#e9f0f7' },
  gold: { name: 'Gold', value: 12, hp: 3, color: '#ffd34d' },
  ruby: { name: 'Ruby', value: 18, hp: 3, color: '#ff2f6d' },
  emerald: { name: 'Emerald', value: 27, hp: 4, color: '#2ee68a' },
  diamond: { name: 'Diamond', value: 40, hp: 5, color: '#9af6ff' },
  voidstone: { name: 'Voidstone', value: 60, hp: 6, color: '#b46bff' },
};

export interface TileInfo {
  name: string;
  hp: number;
  color: string;
  desc: string;
}

export const TILE_INFO: Record<Rock | Special | 'stairs', TileInfo> = {
  dirt: { name: 'Dirt', hp: 1, color: '#7a5230', desc: 'Soft. 1 hit.' },
  stone: { name: 'Stone', hp: 2, color: '#686872', desc: 'Takes 2 power.' },
  hardrock: { name: 'Hard Rock', hp: 3, color: '#474756', desc: 'Takes 3 power.' },
  obsidian: { name: 'Obsidian', hp: 5, color: '#2c2040', desc: 'Takes 5 power.' },
  bedrock: { name: 'Bedrock', hp: 999, color: '#141318', desc: 'Unbreakable.' },
  stairs: { name: 'Stairs Down', hp: 3, color: '#3d8bff', desc: 'Only your pickaxe, dynamite or a drill can break it. Unlocks the next layer.' },
  tnt: { name: 'TNT', hp: 1, color: '#d63a2f', desc: 'Explodes, damaging everything nearby. Rock too tough for the blast only cracks. Sets off other TNT.' },
  gas: { name: 'Gas Pocket', hp: 1, color: '#86b83a', desc: 'Ignites and damages its 4 neighbours. Gas chains.' },
  crystal: { name: 'Crystal', hp: 2, color: '#6fe3ff', desc: 'Shatters in 4 directions, piercing a line of tiles.' },
  lava: { name: 'Lava', hp: 1, color: '#ff6a1a', desc: 'Burns adjacent ore to nothing. Careful!' },
  energy: { name: 'Energy Crystal', hp: 1, color: '#ffe14d', desc: '+2 energy.' },
  chest: { name: 'Chest', hp: 2, color: '#a0662b', desc: 'Cash or tools inside.' },
  magnet: { name: 'Magnet', hp: 2, color: '#c0392b', desc: 'Pulls in every ore nearby.' },
  multi: { name: 'Multiplier Ore', hp: 2, color: '#b84dff', desc: '+1× multiplier for the chain it is in.' },
  relic: { name: 'Relic', hp: 3, color: '#e8d9b0', desc: 'A buried relic for your collection.' },
};

const ORE_SET = new Set<string>(ORES);
export const isOre = (k: TileKind): k is Ore => ORE_SET.has(k);

export function tileName(k: TileKind): string {
  if (k === 'empty') return 'Empty';
  return isOre(k) ? ORE_INFO[k].name : TILE_INFO[k].name;
}

export function tileHp(k: TileKind): number {
  if (k === 'empty') return 0;
  return isOre(k) ? ORE_INFO[k].hp : TILE_INFO[k].hp;
}
