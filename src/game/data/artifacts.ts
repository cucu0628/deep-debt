export interface ArtifactDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ARTIFACTS: ArtifactDef[] = [
  { id: 'copper_heart', name: 'Copper Heart', icon: '🧡', desc: 'Copper veins of 5+ tiles explode when mined.' },
  { id: 'gold_fever', name: 'Gold Fever', icon: '🤑', desc: 'Every Gold-or-better ore in a chain adds +0.25 to its multiplier.' },
  { id: 'chain_lightning', name: 'Chain Lightning', icon: '⚡', desc: 'Every explosion adds +3 combo.' },
  { id: 'lucky_pick', name: 'Lucky Pick', icon: '🎲', desc: '15% chance a hit costs no energy.' },
  { id: 'gamblers_coin', name: "Gambler's Coin", icon: '🪙', desc: 'Saloon winnings +15%.' },
  { id: 'pyromaniac', name: 'Pyromaniac', icon: '🔥', desc: '+1 blast radius and +1 blast damage, but lava is twice as common.' },
  { id: 'geologist', name: 'Geologist', icon: '🔎', desc: '+1 vision through the fog.' },
  { id: 'forge', name: 'Living Forge', icon: '⚒️', desc: 'Lava smelts ore instead of burning it: double yield.' },
  { id: 'coal_power', name: 'Coal Furnace', icon: '🚂', desc: 'Each coal mined has a 12% chance to give +1 energy.' },
  { id: 'deep_pockets', name: 'Thermos', icon: '☕', desc: '+3 energy at the start of every dig.' },
  { id: 'resonance', name: 'Resonance', icon: '🔔', desc: 'Crystal shards fly across the whole grid and hit harder.' },
  { id: 'magnetism', name: 'Lodestone', icon: '🧲', desc: 'Magnets pull from 2 tiles further.' },
  { id: 'heavy_hands', name: 'Heavy Hands', icon: '🦾', desc: '+1 pickaxe power, -2 max energy.' },
  { id: 'interest', name: 'Piggy Bank', icon: '🐷', desc: 'Earn 4% interest on cash every morning (max $40 × day).' },
  { id: 'black_market', name: 'Black Market', icon: '🕶️', desc: 'Sell prices +20%.' },
  { id: 'tremor', name: 'Tremor Boots', icon: '🥾', desc: 'The first hit each dig also sets off a small blast.' },
  { id: 'gem_cutter', name: 'Gem Cutter', icon: '💎', desc: 'Ruby, Emerald, Diamond and Voidstone yield +50%.' },
  { id: 'echo', name: 'Echo Chamber', icon: '📢', desc: 'Combo multiplier grows 50% faster.' },
  { id: 'treasure_hunter', name: 'Treasure Map', icon: '🗺️', desc: 'Twice as many chests, and they hold twice as much.' },
  { id: 'aftershock', name: 'Aftershock', icon: '🌋', desc: 'Chains of 15+ tiles refund 3 energy.' },
  { id: 'vein_tap', name: 'Vein Tap', icon: '🩸', desc: 'Veins of 4+ tiles yield +50%.' },
  { id: 'gas_mask', name: 'Gas Mask', icon: '😷', desc: 'Gas pockets are 3× as common, burn hotter and ignite diagonals too.' },
];

export const ARTIFACT_MAP: Record<string, ArtifactDef> = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
