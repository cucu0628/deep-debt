export interface LegacyDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  max: number;
  cost: (level: number) => number;
}

export const LEGACY: LegacyDef[] = [
  { id: 'start_cash', name: 'Nest Egg', icon: '💰', desc: 'Start each run with +$40.', max: 15, cost: (l) => 1 + l },
  { id: 'energy', name: 'Iron Lungs', icon: '🫁', desc: '+2 max energy.', max: 5, cost: (l) => 2 + 2 * l },
  { id: 'pick', name: 'Inherited Pickaxe', icon: '⛏️', desc: '+1 pickaxe power.', max: 5, cost: (l) => 4 + 4 * l },
  { id: 'demo', name: 'Demolition Expert', icon: '🧨', desc: '+1 blast damage.', max: 5, cost: (l) => 4 + 4 * l },
  { id: 'relief', name: 'Good Lawyer', icon: '⚖️', desc: 'Installments grow 0.06× slower.', max: 5, cost: (l) => 3 + 3 * l },
  { id: 'grace', name: 'Extension', icon: '📅', desc: '+1 day between installments.', max: 2, cost: (l) => 8 + 8 * l },
  { id: 'choices', name: 'Connoisseur', icon: '🃏', desc: '+1 artifact to choose from.', max: 2, cost: (l) => 6 + 6 * l },
  { id: 'miners', name: 'Miners Union', icon: '👷', desc: 'Each miner hauls +1 ore.', max: 5, cost: (l) => 3 + 3 * l },
  { id: 'depth', name: 'Old Maps', icon: '🗺️', desc: '+1 Mining Permit, and start runs 3 layers deeper.', max: 3, cost: (l) => 6 + 6 * l },
  { id: 'luck', name: "Prospector's Instinct", icon: '🍀', desc: '+1 luck.', max: 8, cost: (l) => 3 + 3 * l },
  { id: 'kit', name: 'Starter Kit', icon: '🧰', desc: 'Start runs with 2 dynamite, 1 drill and 1 scanner.', max: 3, cost: (l) => 2 + 2 * l },
  { id: 'heirloom', name: 'Heirloom', icon: '🏺', desc: 'Start runs with a random artifact.', max: 2, cost: (l) => 12 + 12 * l },
  { id: 'grid', name: 'Wider Claims', icon: '📐', desc: '+1 mine width and height.', max: 2, cost: (l) => 10 + 10 * l },
  { id: 'roulette', name: 'High Roller', icon: '🎡', desc: 'Unlock Roulette at the Saloon.', max: 1, cost: () => 5 },
  { id: 'foreman', name: 'Foreman', icon: '🤖', desc: 'Unlock AUTO-DIG in the mine: your foreman picks the best tiles for you.', max: 1, cost: () => 8 },
  { id: 'pierce', name: 'Piercing Pick', icon: '🗡️', desc: 'Leftover pickaxe damage punches through to the tiles behind.', max: 1, cost: () => 15 },
  { id: 'mastery', name: 'Mastery', icon: '🏅', desc: '+5% ore and +5% sell prices. No limit.', max: Infinity, cost: (l) => Math.round(10 * Math.pow(1.2, l)) },
];

export const LEGACY_MAP: Record<string, LegacyDef> = Object.fromEntries(LEGACY.map((l) => [l.id, l]));
