export interface RelicSet {
  id: string;
  name: string;
  where: string;
  bonus: string;
  relics: { id: string; name: string; icon: string }[];
}

export const RELIC_SETS: RelicSet[] = [
  {
    id: 'fossils',
    name: 'Fossils',
    where: 'Topsoil',
    bonus: '+2 max energy',
    relics: [
      { id: 'trilobite', name: 'Trilobite', icon: '🪲' },
      { id: 'ammonite', name: 'Ammonite', icon: '🐚' },
      { id: 'fern', name: 'Fern Imprint', icon: '🌿' },
      { id: 'raptor_claw', name: 'Raptor Claw', icon: '🦖' },
    ],
  },
  {
    id: 'miners',
    name: "Old Miner's Kit",
    where: 'Caverns',
    bonus: '+10% ore from chains',
    relics: [
      { id: 'lantern', name: 'Rusty Lantern', icon: '🪔' },
      { id: 'helmet', name: "Miner's Helmet", icon: '⛑️' },
      { id: 'old_pick', name: 'Lucky Pickaxe', icon: '⚒️' },
      { id: 'canary', name: 'Canary Cage', icon: '🐤' },
    ],
  },
  {
    id: 'geodes',
    name: 'Geodes',
    where: 'Crystal Grotto',
    bonus: '+10% sell prices',
    relics: [
      { id: 'amethyst', name: 'Amethyst Geode', icon: '🔮' },
      { id: 'quartz', name: 'Singing Quartz', icon: '🎐' },
      { id: 'prism', name: 'Prism Shard', icon: '🌈' },
      { id: 'moonstone', name: 'Moonstone', icon: '🌙' },
    ],
  },
  {
    id: 'idols',
    name: 'Magma Idols',
    where: 'Magma Depths',
    bonus: '+1 blast radius',
    relics: [
      { id: 'obsidian_idol', name: 'Obsidian Idol', icon: '🗿' },
      { id: 'salamander', name: 'Salamander Scale', icon: '🦎' },
      { id: 'ember_heart', name: 'Ember Heart', icon: '❤️‍🔥' },
      { id: 'molten_crown', name: 'Molten Crown', icon: '👑' },
    ],
  },
  {
    id: 'void',
    name: 'Void Relics',
    where: 'The Abyss',
    bonus: 'Debt grows 0.1× slower',
    relics: [
      { id: 'void_eye', name: 'Void Eye', icon: '👁️' },
      { id: 'starmetal', name: 'Starmetal', icon: '☄️' },
      { id: 'gear', name: 'Ancient Gear', icon: '⚙️' },
      { id: 'skull', name: 'Whispering Skull', icon: '💀' },
    ],
  },
  {
    id: 'charms',
    name: 'Lucky Charms',
    where: 'Saloon crates & slots',
    bonus: 'Saloon winnings +10%',
    relics: [
      { id: 'clover', name: 'Four-Leaf Clover', icon: '☘️' },
      { id: 'die', name: 'Loaded Die', icon: '🎲' },
      { id: 'horseshoe', name: 'Silver Horseshoe', icon: '🧲' },
      { id: 'chip', name: 'Golden Chip', icon: '🥇' },
    ],
  },
];

export const ALL_RELICS = RELIC_SETS.flatMap((s) => s.relics.map((r) => ({ ...r, set: s.id })));
export const RELIC_MAP = Object.fromEntries(ALL_RELICS.map((r) => [r.id, r]));

export function completedSets(owned: Record<string, number>): Set<string> {
  return new Set(RELIC_SETS.filter((s) => s.relics.every((r) => owned[r.id])).map((s) => s.id));
}
