/**
 * Claim mutators. Every morning the mine offers a few claims, each with a set of mutators that
 * change how the dig plays. Harder claims pay more: `reward` is added to the loot multiplier
 * (ore from chains and cash from chests).
 */
export interface MutatorDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  reward: number;
}

export const MUTATORS: MutatorDef[] = [
  { id: 'flooded', name: 'Flooded', icon: '🌊', desc: 'Two thirds of the mine are underwater: every hit down there costs 2 energy.', reward: 0.25 },
  { id: 'goldrush', name: 'Gold Rush', icon: '🤑', desc: '+30% ore and rarer veins, but no energy crystals and double lava.', reward: 0 },
  { id: 'cavein', name: 'Crumbling', icon: '🪨', desc: 'Every 3rd hit, 4 dug-out tiles cave back in as rock.', reward: 0.25 },
  { id: 'dark', name: 'Pitch Black', icon: '🌑', desc: 'Vision drops to 1, but ore glows through the fog.', reward: 0.15 },
  { id: 'volcanic', name: 'Volcanic', icon: '🌋', desc: '3× lava and 2× TNT.', reward: 0.2 },
  { id: 'hardened', name: 'Hardened', icon: '🧱', desc: 'Rock and ore have +50% HP.', reward: 0.25 },
  { id: 'motherlode', name: 'Giant Veins', icon: '⛰️', desc: 'Veins are twice as big, but rock has +3 HP.', reward: 0.05 },
  { id: 'haunted', name: 'Haunted', icon: '👻', desc: 'A relic is guaranteed, but half the energy crystals and chests.', reward: 0.15 },
  { id: 'gassy', name: 'Gas Field', icon: '☣️', desc: '3× gas pockets, but start with 5 less energy.', reward: 0.2 },
  { id: 'tremors', name: 'Tremors', icon: '💥', desc: 'Every 5th hit, a blast goes off somewhere random.', reward: 0 },
  { id: 'shortshift', name: 'Short Shift', icon: '⏳', desc: 'Start with 40% less energy.', reward: 0.35 },
  { id: 'vault', name: 'Treasure Vault', icon: '💰', desc: '3× chests, but 40% less ore.', reward: 0.15 },
];

export const MUTATOR_MAP: Record<string, MutatorDef> = Object.fromEntries(MUTATORS.map((m) => [m.id, m]));

export const mutatorReward = (mods: readonly string[]) => mods.reduce((s, id) => s + (MUTATOR_MAP[id]?.reward ?? 0), 0);

export interface Claim {
  mods: string[];
}

/** Mutators per claim, by the deepest layer reached. Early layers stay plain so new players learn the basics. */
export function claimTiers(maxLayer: number): number[] {
  if (maxLayer < 4) return [0];
  if (maxLayer < 13) return [0, 1, 2];
  return [1, 2, 3];
}
