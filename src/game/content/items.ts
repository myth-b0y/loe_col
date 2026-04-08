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
  | "component"
  | "material";

export type ItemDefinition = {
  id: string;
  name: string;
  category: ItemCategory;
  slot?: EquipmentSlotId;
  color: number;
  rarity: "Common" | "Uncommon" | "Rare";
  shortLabel: string;
  description: string;
};

export type EquipmentLoadout = Record<EquipmentSlotId, string | null>;

export type CraftingMaterials = {
  alloy: number;
  shardDust: number;
  filament: number;
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

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  {
    id: "survey-hood",
    name: "Survey Hood",
    category: "armor",
    slot: "head",
    color: 0x8dc7ff,
    rarity: "Common",
    shortLabel: "Hood",
    description: "A light scanner hood used by forward crews.",
  },
  {
    id: "warden-plate",
    name: "Warden Plate",
    category: "armor",
    slot: "chest",
    color: 0x77a9ff,
    rarity: "Common",
    shortLabel: "Plate",
    description: "Starter chest armor built to carry power safely.",
  },
  {
    id: "pathrunner-greaves",
    name: "Pathrunner Greaves",
    category: "armor",
    slot: "legs",
    color: 0x88bfff,
    rarity: "Common",
    shortLabel: "Greaves",
    description: "Mobility-focused leg plating for boarding work.",
  },
  {
    id: "lumen-carbine",
    name: "Lumen Carbine",
    category: "weapon",
    slot: "rightHand",
    color: 0xf5fbff,
    rarity: "Common",
    shortLabel: "Carbine",
    description: "Balanced starter firearm with stable energy draw.",
  },
  {
    id: "signal-knife",
    name: "Signal Knife",
    category: "weapon",
    slot: "leftHand",
    color: 0xffc777,
    rarity: "Common",
    shortLabel: "Knife",
    description: "Backup off-hand blade used for boarding emergencies.",
  },
  {
    id: "basic-aegis-belt",
    name: "Basic Aegis Belt",
    category: "belt",
    slot: "belt",
    color: 0x7de6ff,
    rarity: "Common",
    shortLabel: "Aegis",
    description: "Starter shield belt with modest capacity and recharge.",
  },
  {
    id: "field-pack",
    name: "Field Pack",
    category: "back",
    slot: "back",
    color: 0x9cc6aa,
    rarity: "Common",
    shortLabel: "Pack",
    description: "Compact cargo pack with utility loops and battery storage.",
  },
  {
    id: "relay-charm",
    name: "Relay Charm",
    category: "accessory",
    slot: "accessory1",
    color: 0xffe18c,
    rarity: "Common",
    shortLabel: "Charm",
    description: "A small focus charm tuned for relay corridors.",
  },
  {
    id: "stabilizer-ring",
    name: "Stabilizer Ring",
    category: "accessory",
    slot: "accessory2",
    color: 0xa5f1ff,
    rarity: "Common",
    shortLabel: "Ring",
    description: "Helps hold aim steady during rapid movement.",
  },
  {
    id: "crest-tag",
    name: "Crest Tag",
    category: "accessory",
    slot: "accessory3",
    color: 0xffb3d7,
    rarity: "Common",
    shortLabel: "Tag",
    description: "A quiet mark of service carried by EDEN crews.",
  },
  {
    id: "relay-core-mk1",
    name: "Relay Core Mk I",
    category: "component",
    color: 0x8ef2ff,
    rarity: "Uncommon",
    shortLabel: "Core",
    description: "Recovered relay hardware useful for upgrades and crafting.",
  },
  {
    id: "ember-capacitor",
    name: "Ember Capacitor",
    category: "component",
    color: 0xffb16d,
    rarity: "Uncommon",
    shortLabel: "Cap",
    description: "Hot-running power core prized by gunners and tinkerers.",
  },
  {
    id: "nightglass-shard",
    name: "Nightglass Shard",
    category: "component",
    color: 0xc8a7ff,
    rarity: "Rare",
    shortLabel: "Shard",
    description: "A dangerous shadow-glass fragment taken from hard targets.",
  },
  {
    id: "lumen-battery",
    name: "Lumen Battery",
    category: "material",
    color: 0xa2fff6,
    rarity: "Common",
    shortLabel: "Cell",
    description: "A standard power cell used to keep field gear running.",
  },
  {
    id: "repair-patch",
    name: "Repair Patch",
    category: "material",
    color: 0x9de7b1,
    rarity: "Common",
    shortLabel: "Patch",
    description: "A quick-fix patch for armor and hull tears.",
  },
  {
    id: "shard-filament",
    name: "Shard Filament",
    category: "material",
    color: 0xffd9a5,
    rarity: "Common",
    shortLabel: "Wire",
    description: "A luminous filament used in energy routing and crafting.",
  },
] as const;

export const ITEM_REGISTRY: Record<string, ItemDefinition> = Object.fromEntries(
  ITEM_DEFINITIONS.map((item) => [item.id, item]),
);

export const DEFAULT_EQUIPMENT: EquipmentLoadout = {
  head: "survey-hood",
  chest: "warden-plate",
  legs: "pathrunner-greaves",
  leftHand: "signal-knife",
  rightHand: "lumen-carbine",
  belt: "basic-aegis-belt",
  back: "field-pack",
  accessory1: "relay-charm",
  accessory2: "stabilizer-ring",
  accessory3: "crest-tag",
};

export const DEFAULT_CARGO_SLOTS: Array<string | null> = [
  "relay-core-mk1",
  "lumen-battery",
  "repair-patch",
  "shard-filament",
  "ember-capacitor",
  null,
  null,
  null,
  "nightglass-shard",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

export const DEFAULT_CRAFTING_MATERIALS: CraftingMaterials = {
  alloy: 18,
  shardDust: 9,
  filament: 12,
};

export function getItemDefinition(itemId: string | null | undefined): ItemDefinition | null {
  if (!itemId) {
    return null;
  }

  return ITEM_REGISTRY[itemId] ?? null;
}

export function canItemEquipToSlot(itemOrId: ItemDefinition | string | null | undefined, slotId: EquipmentSlotId): boolean {
  const item = typeof itemOrId === "string" ? getItemDefinition(itemOrId) : itemOrId;
  if (!item) {
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

  if (item.category === "armor") {
    return item.slot === slotId;
  }

  if (item.category === "weapon" || item.category === "shield") {
    if (!item.slot) {
      return slotId === "leftHand" || slotId === "rightHand";
    }

    return item.slot === slotId;
  }

  return false;
}

export function getCompatibleEquipmentSlots(itemOrId: ItemDefinition | string | null | undefined): Array<{ id: EquipmentSlotId; label: string }> {
  return EQUIPMENT_SLOTS.filter((slot) => canItemEquipToSlot(itemOrId, slot.id));
}
