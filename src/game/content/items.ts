export type RaceId = "olydran" | "rakkan" | "nevari" | "elsari" | "svarin" | "ashari" | "aaruian";

export type EquipmentSlotId =
  | "head"
  | "chest"
  | "legs"
  | "leftHand"
  | "rightHand"
  | "belt"
  | "back"
  | "accessory1"
  | "accessory2"
  | "accessory3";

export type ItemCategory =
  | "weapon"
  | "shield"
  | "armor"
  | "belt"
  | "back"
  | "accessory"
  | "quest";

export type ItemRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type ItemStatKey =
  | "vitality"
  | "power"
  | "focus"
  | "guard"
  | "shieldCapacity"
  | "shieldRecovery"
  | "haste";

export type ItemStatBlock = Partial<Record<ItemStatKey, number>>;

export type ItemPerk = {
  label: string;
  description: string;
};

export type GearItemInstance = {
  instanceId: string;
  kind: "gear";
  templateId: string;
  name: string;
  shortLabel: string;
  description: string;
  category: ItemCategory;
  slot: EquipmentSlotId;
  rarity: ItemRarity;
  color: number;
  raceTag: RaceId;
  stats: ItemStatBlock;
  perks: ItemPerk[];
  legendarySetId?: string;
  setPieceId?: string;
};

export type QuestItemInstance = {
  instanceId: string;
  kind: "quest";
  name: string;
  shortLabel: string;
  description: string;
  rarity: ItemRarity;
  color: number;
  tag: string;
};

export type InventoryItem = GearItemInstance | QuestItemInstance;
export type EquipmentLoadout = Record<EquipmentSlotId, GearItemInstance | null>;

export type CraftingMaterials = {
  alloy: number;
  shardDust: number;
  filament: number;
};

export type PlayerCombatProfile = {
  maxHp: number;
  primaryFireDamage: number;
  primaryFireCooldown: number;
  pulseDamage: number;
  arcDamage: number;
  moveSpeedMultiplier: number;
  abilityCooldownMultiplier: number;
  guardMitigation: number;
  shieldCapacity: number;
  shieldRecoveryRate: number;
  shieldRegenDelay: number;
  companionShieldCapacity: number;
  companionShieldRecoveryRate: number;
  activeSetBonuses: string[];
};

type GearTemplate = {
  id: string;
  slot: EquipmentSlotId;
  category: ItemCategory;
  baseName: string;
  shortLabel: string;
  description: string;
  color: number;
  baseStats: ItemStatBlock;
  perkPool: ItemPerk[];
  nameSuffixes: string[];
  affixPool: ItemStatKey[];
};

type ItemAffix = {
  id: string;
  label: string;
  description: string;
  stats: ItemStatBlock;
};

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(min + (max - min + 1) * this.next());
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }
}

export const ALL_EQUIPMENT_SLOT_IDS: EquipmentSlotId[] = [
  "head",
  "chest",
  "legs",
  "leftHand",
  "rightHand",
  "belt",
  "back",
  "accessory1",
  "accessory2",
  "accessory3",
];

const ITEM_STAT_LABELS: Record<ItemStatKey, string> = {
  vitality: "Vitality",
  power: "Power",
  focus: "Focus",
  guard: "Guard",
  shieldCapacity: "Shield Capacity",
  shieldRecovery: "Shield Recovery",
  haste: "Haste",
};

const RACE_LABELS: Record<RaceId, string> = {
  olydran: "Olydran",
  rakkan: "Rakkan",
  nevari: "Nevari",
  elsari: "Elsari",
  svarin: "Svarin",
  ashari: "Ashari",
  aaruian: "Aaruian",
};

const RARITY_COLORS: Record<ItemRarity, number> = {
  Common: 0x9fb6d0,
  Rare: 0x70c4ff,
  Epic: 0xc49bff,
  Legendary: 0xffcc74,
  Mythic: 0xff6fd3,
};

const PROCEDURAL_TEMPLATES: Record<"belt" | "weapon" | "back", GearTemplate[]> = {
  belt: [
    {
      id: "belt-aegis-harness",
      slot: "belt",
      category: "belt",
      baseName: "Aegis Harness",
      shortLabel: "Harness",
      description: "A shield lattice belt that extends a lighter aegis shell to the whole field team.",
      color: 0x7de6ff,
      baseStats: { shieldCapacity: 16, shieldRecovery: 4, guard: 2 },
      perkPool: [
        {
          label: "Squad Link",
          description: "Companions inherit a portion of the belt shield grid.",
        },
        {
          label: "Field Refractor",
          description: "Shield break downtime is slightly softer than raw capacity suggests.",
        },
      ],
      nameSuffixes: ["of the Verge", "of Ember Watch", "of the Glass Run"],
      affixPool: ["shieldCapacity", "shieldRecovery", "guard", "vitality"],
    },
  ],
  weapon: [
    {
      id: "weapon-lumen-carbine",
      slot: "rightHand",
      category: "weapon",
      baseName: "Lumen Carbine",
      shortLabel: "Carbine",
      description: "A compact primary weapon tuned for stable energy discharge and clean lane pressure.",
      color: 0x87d9ff,
      baseStats: { power: 8, haste: 3, focus: 2 },
      perkPool: [
        {
          label: "Clean Sightline",
          description: "Primary fire feels steadier and rewards keeping pressure on one lane.",
        },
        {
          label: "Arc Routing",
          description: "Arc Lance charge discipline improves when this carbine is fitted.",
        },
      ],
      nameSuffixes: ["of Ashfall", "of the Breach", "of the Relay Rim"],
      affixPool: ["power", "focus", "haste", "vitality"],
    },
  ],
  back: [
    {
      id: "back-nightmantle",
      slot: "back",
      category: "back",
      baseName: "Nightmantle Cape",
      shortLabel: "Cape",
      description: "A reactive back mantle that catches momentum and redirects it into cleaner movement and focus.",
      color: 0xb8a2ff,
      baseStats: { focus: 8, haste: 4, guard: 2 },
      perkPool: [
        {
          label: "Void Slip",
          description: "Momentum recovery feels quicker after evasive movement.",
        },
        {
          label: "Battle Veil",
          description: "Maintains composure under pressure and helps abilities reset more cleanly.",
        },
      ],
      nameSuffixes: ["of the Abyss", "of Nightglass", "of the Descent"],
      affixPool: ["focus", "haste", "guard", "vitality"],
    },
  ],
};

const ITEM_AFFIXES: Record<ItemStatKey, ItemAffix[]> = {
  vitality: [
    { id: "vitality-steady", label: "Steady", description: "Bolsters base health.", stats: { vitality: 4 } },
    { id: "vitality-bastion", label: "Bastion", description: "Carries extra life into long fights.", stats: { vitality: 6 } },
  ],
  power: [
    { id: "power-flare", label: "Flare", description: "Increases raw offensive pressure.", stats: { power: 4 } },
    { id: "power-lance", label: "Lance", description: "Sharpens burst damage output.", stats: { power: 6 } },
  ],
  focus: [
    { id: "focus-clear", label: "Clear", description: "Accelerates active ability rhythm.", stats: { focus: 4 } },
    { id: "focus-relay", label: "Relay", description: "Keeps abilities cycling under pressure.", stats: { focus: 6 } },
  ],
  guard: [
    { id: "guard-warded", label: "Warded", description: "Adds more stability against incoming pressure.", stats: { guard: 4 } },
    { id: "guard-anchor", label: "Anchor", description: "Improves damage resistance while holding ground.", stats: { guard: 6 } },
  ],
  shieldCapacity: [
    { id: "shield-capacity-deep", label: "Deep", description: "Expands the shield reservoir.", stats: { shieldCapacity: 14 } },
    { id: "shield-capacity-array", label: "Array", description: "Feeds a wider shield lattice.", stats: { shieldCapacity: 20 } },
  ],
  shieldRecovery: [
    { id: "shield-recovery-live", label: "Live", description: "Improves shield recovery speed.", stats: { shieldRecovery: 5 } },
    { id: "shield-recovery-reactive", label: "Reactive", description: "Shortens recovery cadence after pressure breaks.", stats: { shieldRecovery: 8 } },
  ],
  haste: [
    { id: "haste-quick", label: "Quick", description: "Improves pace and handling.", stats: { haste: 4 } },
    { id: "haste-flux", label: "Flux", description: "Keeps motion and fire cadence responsive.", stats: { haste: 6 } },
  ],
};

const LEGENDARY_SET_ID = "sunforged-vigil";

const LEGENDARY_SET_BONUS_LABELS: Record<number, string> = {
  2: "Sunforged Vigil (2): +18 Vitality and stronger field resilience.",
  3: "Sunforged Vigil (3): Pulse and Arc Lance hit harder and cycle faster.",
};

export const EQUIPMENT_SLOTS: Array<{ id: EquipmentSlotId; label: string }> = [
  { id: "head", label: "Head" },
  { id: "chest", label: "Chest" },
  { id: "legs", label: "Legs" },
  { id: "leftHand", label: "Left Hand" },
  { id: "rightHand", label: "Right Hand" },
  { id: "belt", label: "Belt" },
  { id: "back", label: "Back" },
  { id: "accessory1", label: "Accessory 1" },
  { id: "accessory2", label: "Accessory 2" },
  { id: "accessory3", label: "Accessory 3" },
];

export const DEFAULT_CARGO_SLOTS: Array<InventoryItem | null> = Array.from({ length: 20 }, () => null);

export const DEFAULT_CRAFTING_MATERIALS: CraftingMaterials = {
  alloy: 0,
  shardDust: 0,
  filament: 0,
};

export const DEFAULT_EQUIPMENT: EquipmentLoadout = createEmptyEquipment();

export function createEmptyEquipment(): EquipmentLoadout {
  return {
    head: null,
    chest: null,
    legs: null,
    leftHand: null,
    rightHand: null,
    belt: null,
    back: null,
    accessory1: null,
    accessory2: null,
    accessory3: null,
  };
}

export function createEmptyCargoSlots(count = DEFAULT_CARGO_SLOTS.length): Array<InventoryItem | null> {
  return Array.from({ length: count }, () => null);
}

export function cloneEquipmentLoadout(loadout: EquipmentLoadout): EquipmentLoadout {
  const next = createEmptyEquipment();
  ALL_EQUIPMENT_SLOT_IDS.forEach((slotId) => {
    next[slotId] = cloneInventoryItem(loadout[slotId]) as GearItemInstance | null;
  });
  return next;
}

export function cloneCargoSlots(cargo: Array<InventoryItem | null>): Array<InventoryItem | null> {
  return cargo.map((item) => cloneInventoryItem(item));
}

export function cloneInventoryItem(item: InventoryItem | null | undefined): InventoryItem | null {
  if (!item) {
    return null;
  }

  return JSON.parse(JSON.stringify(item)) as InventoryItem;
}

export function cloneCraftingMaterials(materials: CraftingMaterials): CraftingMaterials {
  return {
    alloy: materials.alloy,
    shardDust: materials.shardDust,
    filament: materials.filament,
  };
}

export function addCraftingMaterials(base: CraftingMaterials, addition: Partial<CraftingMaterials>): CraftingMaterials {
  return {
    alloy: base.alloy + (addition.alloy ?? 0),
    shardDust: base.shardDust + (addition.shardDust ?? 0),
    filament: base.filament + (addition.filament ?? 0),
  };
}

export function hasCraftingMaterials(materials: Partial<CraftingMaterials> | null | undefined): boolean {
  if (!materials) {
    return false;
  }

  return (materials.alloy ?? 0) > 0 || (materials.shardDust ?? 0) > 0 || (materials.filament ?? 0) > 0;
}

export function isGearItem(item: InventoryItem | null | undefined): item is GearItemInstance {
  return Boolean(item && item.kind === "gear");
}

export function isQuestItem(item: InventoryItem | null | undefined): item is QuestItemInstance {
  return Boolean(item && item.kind === "quest");
}

export function canItemEquipToSlot(item: InventoryItem | null | undefined, slotId: EquipmentSlotId): boolean {
  if (!isGearItem(item)) {
    return false;
  }

  if (item.category === "accessory") {
    return slotId.startsWith("accessory");
  }

  if (item.category === "belt") {
    return slotId === "belt";
  }

  if (item.category === "back") {
    return slotId === "back";
  }

  if (item.category === "weapon" || item.category === "shield") {
    return slotId === item.slot || (item.slot === "leftHand" && slotId === "rightHand");
  }

  return slotId === item.slot;
}

export function getCompatibleEquipmentSlots(item: InventoryItem | null | undefined): Array<{ id: EquipmentSlotId; label: string }> {
  return EQUIPMENT_SLOTS.filter((slot) => canItemEquipToSlot(item, slot.id));
}

export function getItemColor(item: InventoryItem | null | undefined): number {
  return item?.color ?? 0x365a82;
}

export function getItemRarityColor(rarity: ItemRarity): number {
  return RARITY_COLORS[rarity];
}

export function getItemShortLabel(item: InventoryItem | null | undefined): string {
  if (!item) {
    return "";
  }

  return item.shortLabel;
}

export function getItemName(item: InventoryItem | null | undefined): string {
  return item?.name ?? "Empty";
}

export function summarizeEquippedWeapon(loadout: EquipmentLoadout): string {
  return loadout.rightHand?.name ?? loadout.leftHand?.name ?? "Unarmed";
}

export function describeCraftingMaterials(materials: Partial<CraftingMaterials>): string[] {
  const lines: string[] = [];
  if ((materials.alloy ?? 0) > 0) {
    lines.push(`Alloy x${materials.alloy}`);
  }
  if ((materials.shardDust ?? 0) > 0) {
    lines.push(`Shard Dust x${materials.shardDust}`);
  }
  if ((materials.filament ?? 0) > 0) {
    lines.push(`Filament x${materials.filament}`);
  }
  return lines;
}

export function summarizeItemStats(stats: ItemStatBlock): string[] {
  return Object.entries(stats)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([key, value]) => `+${value} ${ITEM_STAT_LABELS[key as ItemStatKey]}`);
}

export function describeInventoryItem(item: InventoryItem | null | undefined): string[] {
  if (!item) {
    return [];
  }

  if (item.kind === "quest") {
    return [item.description];
  }

  return [
    `${item.rarity} ${getSlotLabel(item.slot)}`,
    ...summarizeItemStats(item.stats),
    ...item.perks.map((perk) => `${perk.label}: ${perk.description}`),
  ];
}

export function getSlotLabel(slotId: EquipmentSlotId): string {
  return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
}

export function countSetPieces(loadout: EquipmentLoadout, setId: string): number {
  return ALL_EQUIPMENT_SLOT_IDS.reduce((count, slotId) => {
    const item = loadout[slotId];
    return count + (item?.legendarySetId === setId ? 1 : 0);
  }, 0);
}

export function calculatePlayerCombatProfile(loadout: EquipmentLoadout): PlayerCombatProfile {
  const stats = ALL_EQUIPMENT_SLOT_IDS.reduce<ItemStatBlock>((accumulator, slotId) => {
    const item = loadout[slotId];
    if (!item) {
      return accumulator;
    }

    Object.entries(item.stats).forEach(([key, value]) => {
      const statKey = key as ItemStatKey;
      accumulator[statKey] = (accumulator[statKey] ?? 0) + (value ?? 0);
    });

    return accumulator;
  }, {});

  const setPieces = countSetPieces(loadout, LEGENDARY_SET_ID);
  const activeSetBonuses: string[] = [];
  let bonusVitality = 0;
  let bonusPowerFactor = 0;
  let bonusAbilityFactor = 0;

  if (setPieces >= 2) {
    activeSetBonuses.push(LEGENDARY_SET_BONUS_LABELS[2]);
    bonusVitality += 18;
  }
  if (setPieces >= 3) {
    activeSetBonuses.push(LEGENDARY_SET_BONUS_LABELS[3]);
    bonusPowerFactor += 0.1;
    bonusAbilityFactor += 0.12;
  }

  const vitality = (stats.vitality ?? 0) + bonusVitality;
  const power = stats.power ?? 0;
  const focus = stats.focus ?? 0;
  const guard = stats.guard ?? 0;
  const shieldCapacityStat = stats.shieldCapacity ?? 0;
  const shieldRecovery = stats.shieldRecovery ?? 0;
  const haste = stats.haste ?? 0;

  const powerFactor = 1 + power * 0.045 + bonusPowerFactor;
  const hasteFactor = 1 + haste * 0.014;
  const abilityFactor = 1 + focus * 0.018 + haste * 0.006 + bonusAbilityFactor;
  const shieldCapacity = shieldCapacityStat > 0 ? Math.round(shieldCapacityStat * 4.6) : 0;
  const shieldRecoveryRate = shieldCapacity > 0
    ? Math.round(10 + shieldRecovery * 2.5 + shieldCapacity * 0.08)
    : 0;
  const companionShieldCapacity = shieldCapacity > 0 ? Math.round(shieldCapacity * 0.62) : 0;
  const companionShieldRecoveryRate = companionShieldCapacity > 0
    ? Math.max(8, Math.round(shieldRecoveryRate * 0.68))
    : 0;

  return {
    maxHp: 100 + vitality * 6,
    primaryFireDamage: Math.round(12 * powerFactor + power * 0.4),
    primaryFireCooldown: Math.max(0.09, 0.16 / hasteFactor),
    pulseDamage: Math.round(28 * powerFactor + power * 0.8),
    arcDamage: Math.round(40 * powerFactor + power * 1.1),
    moveSpeedMultiplier: 1 + haste * 0.012,
    abilityCooldownMultiplier: abilityFactor,
    guardMitigation: Math.min(0.34, guard * 0.018),
    shieldCapacity,
    shieldRecoveryRate,
    shieldRegenDelay: shieldCapacity > 0 ? Math.max(1.75, 3.25 - shieldRecovery * 0.07) : 3.25,
    companionShieldCapacity,
    companionShieldRecoveryRate,
    activeSetBonuses,
  };
}

export function createLegendarySetPiece(slot: "head" | "chest" | "legs", raceTag: RaceId, seed: number): GearItemInstance {
  const labelPrefix = RACE_LABELS[raceTag];
  const baseConfig = slot === "head"
    ? {
        templateId: "legendary-sunforged-head",
        name: `${labelPrefix} Sunforged Helm`,
        shortLabel: "Sun Helm",
        description: "The visor piece of a hand-authored legendary set that sharpens battlefield rhythm and clarity.",
        stats: { vitality: 6, focus: 7, guard: 3 },
        perks: [
          { label: "Crown of Focus", description: "Arc discipline stays cleaner under pressure." },
        ],
      }
    : slot === "chest"
      ? {
          templateId: "legendary-sunforged-chest",
          name: `${labelPrefix} Sunforged Cuirass`,
          shortLabel: "Sun Chest",
          description: "The central plate of the Sunforged Vigil set, built to carry the line through long engagements.",
          stats: { vitality: 10, guard: 6, power: 2 },
          perks: [
            { label: "Linebreaker Plate", description: "Improves overall resilience while pressing forward." },
          ],
        }
      : {
          templateId: "legendary-sunforged-legs",
          name: `${labelPrefix} Sunforged Greaves`,
          shortLabel: "Sun Legs",
          description: "The lower frame of the legendary set, tuned for steadier motion and cleaner resets between bursts.",
          stats: { vitality: 5, haste: 6, power: 4 },
          perks: [
            { label: "Stride Memory", description: "Movement cadence and firing rhythm stay tight while advancing." },
          ],
        };

  return {
    instanceId: `legendary-${slot}-${seed}`,
    kind: "gear",
    templateId: baseConfig.templateId,
    name: baseConfig.name,
    shortLabel: baseConfig.shortLabel,
    description: baseConfig.description,
    category: "armor",
    slot,
    rarity: "Legendary",
    color: RARITY_COLORS.Legendary,
    raceTag,
    stats: baseConfig.stats,
    perks: [
      ...baseConfig.perks,
      { label: "Set Piece", description: "Part of the Sunforged Vigil set." },
    ],
    legendarySetId: LEGENDARY_SET_ID,
    setPieceId: slot,
  };
}

export function createProceduralBossGear(slot: "belt" | "weapon" | "back", raceTag: RaceId, difficulty: "easy" | "medium" | "hard", seed: number): GearItemInstance {
  const rng = new SeededRandom(seed ^ hashString(`${slot}-${raceTag}-${difficulty}`));
  const template = rng.pick(PROCEDURAL_TEMPLATES[slot]);
  const rarity: ItemRarity = difficulty === "easy" ? "Rare" : "Epic";
  const difficultyFactor = difficulty === "easy" ? 1 : difficulty === "medium" ? 1.18 : 1.34;
  const stats: ItemStatBlock = scaleStats(template.baseStats, difficultyFactor);
  const pickedAffixes = pickUniqueAffixes(template.affixPool, rarity === "Rare" ? 2 : 3, rng);

  pickedAffixes.forEach((affix) => {
    Object.entries(scaleStats(affix.stats, difficultyFactor)).forEach(([key, value]) => {
      const statKey = key as ItemStatKey;
      stats[statKey] = (stats[statKey] ?? 0) + (value ?? 0);
    });
  });

  const perk = rng.pick(template.perkPool);
  const suffix = rng.pick(template.nameSuffixes);
  const raceLabel = RACE_LABELS[raceTag];

  return {
    instanceId: `${template.id}-${seed}`,
    kind: "gear",
    templateId: template.id,
    name: `${raceLabel} ${template.baseName} ${suffix}`,
    shortLabel: template.shortLabel,
    description: template.description,
    category: template.category,
    slot: template.slot,
    rarity,
    color: RARITY_COLORS[rarity],
    raceTag,
    stats,
    perks: [
      {
        label: pickedAffixes.map((affix) => affix.label).join(" / "),
        description: pickedAffixes.map((affix) => affix.description).join(" "),
      },
      perk,
    ],
  };
}

function scaleStats(stats: ItemStatBlock, factor: number): ItemStatBlock {
  const scaled: ItemStatBlock = {};
  Object.entries(stats).forEach(([key, value]) => {
    scaled[key as ItemStatKey] = Math.max(1, Math.round((value ?? 0) * factor));
  });
  return scaled;
}

function pickUniqueAffixes(keys: ItemStatKey[], count: number, rng: SeededRandom): ItemAffix[] {
  const pool = [...keys];
  const results: ItemAffix[] = [];
  while (pool.length > 0 && results.length < count) {
    const keyIndex = rng.int(0, pool.length - 1);
    const [key] = pool.splice(keyIndex, 1);
    const variants = ITEM_AFFIXES[key];
    results.push(rng.pick(variants));
  }

  return results;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
