export type UpgradeId = 'pick' | 'energy' | 'blast' | 'radius' | 'lantern' | 'prospect' | 'luck' | 'haggle' | 'miner';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  desc: string;
  base: number;
  growth: number;
  /** Infinity for upgrades that never cap out. */
  max: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'pick', name: 'Pickaxe Power', icon: '⛏️', desc: '+1 damage per hit.', base: 50, growth: 2.25, max: Infinity },
  { id: 'blast', name: 'Explosives', icon: '🧨', desc: '+1 TNT damage. Tougher rock needs stronger blasts.', base: 90, growth: 2.35, max: Infinity },
  { id: 'energy', name: 'Stamina', icon: '🔋', desc: '+2 max energy.', base: 40, growth: 1.9, max: 12 },
  { id: 'prospect', name: 'Prospector', icon: '🧭', desc: '+10% ore from every chain.', base: 70, growth: 1.8, max: Infinity },
  { id: 'luck', name: 'Luck', icon: '🍀', desc: 'Rarer ore and more special tiles.', base: 80, growth: 2.1, max: 12 },
  { id: 'haggle', name: 'Haggling', icon: '🤝', desc: '+8% sell prices.', base: 100, growth: 1.9, max: Infinity },
  { id: 'miner', name: 'Hire Miner', icon: '👷', desc: 'Each miner hauls ore from your deepest layer every morning.', base: 45, growth: 1.32, max: Infinity },
  { id: 'lantern', name: 'Lantern', icon: '🏮', desc: '+1 vision through the fog.', base: 120, growth: 5, max: 2 },
  { id: 'radius', name: 'Blast Radius', icon: '💥', desc: '+1 TNT and dynamite radius.', base: 2500, growth: 1, max: 1 },
];

export const upgradeCost = (u: UpgradeDef, level: number) => Math.round(u.base * Math.pow(u.growth, level));

export type ToolId = 'dynamite' | 'drill' | 'scanner' | 'drink';

export interface ToolDef {
  id: ToolId;
  name: string;
  icon: string;
  desc: string;
  price: number;
  /** Tools without a target are used instantly. */
  targeted: boolean;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  dynamite: { id: 'dynamite', name: 'Dynamite', icon: '🧨', desc: 'Blows up a big area anywhere, ignoring hardness. Cracks stairs too.', price: 30, targeted: true },
  drill: { id: 'drill', name: 'Drill', icon: '🪛', desc: 'Bores through an entire row, ignoring hardness.', price: 45, targeted: true },
  scanner: { id: 'scanner', name: 'Scanner', icon: '📡', desc: 'Reveals a 7×7 area.', price: 15, targeted: true },
  drink: { id: 'drink', name: 'Energy Drink', icon: '🥤', desc: '+6 energy right now.', price: 30, targeted: false },
};

export const TOOL_IDS = Object.keys(TOOLS) as ToolId[];
