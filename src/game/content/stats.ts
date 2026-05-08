import type { CompanionDefinition, CompanionRole } from "./companions";

export type CharacterStatKey =
  | "health"
  | "shield"
  | "defense"
  | "resonance"
  | "resonanceRegen"
  | "power"
  | "critChance"
  | "critDamage"
  | "cooldownReduction"
  | "moveSpeed"
  | "healingPower";

export type ShipStatKey =
  | "hull"
  | "shields"
  | "defense"
  | "reactorEnergy"
  | "reactorRegen"
  | "weaponPower"
  | "speed"
  | "boostEfficiency";

export type CharacterStatBlock = Record<CharacterStatKey, number>;
export type ShipStatBlock = Record<ShipStatKey, number>;
export type CharacterStatModifierBlock = Partial<Record<CharacterStatKey, number>>;
export type ShipStatModifierBlock = Partial<Record<ShipStatKey, number>>;

export type StatModifierSource = {
  id: string;
  label: string;
  sourceType: "baseline" | "equipment" | "ship-component" | "skill" | "companion" | "temporary";
  character?: CharacterStatModifierBlock;
  ship?: ShipStatModifierBlock;
  tags?: string[];
};

export type ResolvedCharacterStats = {
  base: CharacterStatBlock;
  equipment: CharacterStatBlock;
  skills: CharacterStatBlock;
  total: CharacterStatBlock;
  modifiers: StatModifierSource[];
};

export type ResolvedShipStats = {
  base: ShipStatBlock;
  components: ShipStatBlock;
  skills: ShipStatBlock;
  total: ShipStatBlock;
  modifiers: StatModifierSource[];
};

export type ShipComponentSlotId = "hullPlating" | "shieldCore" | "reactor" | "engine" | "weaponMount";

export type ShipComponentRecord = {
  id: string;
  slot: ShipComponentSlotId;
  name: string;
  shortLabel: string;
  description: string;
  stats: ShipStatModifierBlock;
  tags: string[];
};

export type ShipComponentLoadout = Record<ShipComponentSlotId, ShipComponentRecord | null>;

export const CHARACTER_STAT_KEYS: CharacterStatKey[] = [
  "health",
  "shield",
  "defense",
  "resonance",
  "resonanceRegen",
  "power",
  "critChance",
  "critDamage",
  "cooldownReduction",
  "moveSpeed",
  "healingPower",
];

export const SHIP_STAT_KEYS: ShipStatKey[] = [
  "hull",
  "shields",
  "defense",
  "reactorEnergy",
  "reactorRegen",
  "weaponPower",
  "speed",
  "boostEfficiency",
];

export const SHIP_COMPONENT_SLOTS: Array<{ id: ShipComponentSlotId; label: string }> = [
  { id: "hullPlating", label: "Hull Plating" },
  { id: "shieldCore", label: "Shield Core" },
  { id: "reactor", label: "Reactor" },
  { id: "engine", label: "Engine" },
  { id: "weaponMount", label: "Weapon Mount" },
];

export const LEVEL_ONE_KNIGHT_CHARACTER_STATS: CharacterStatBlock = createCharacterStatBlock({
  health: 120,
  shield: 35,
  defense: 10,
  resonance: 100,
  resonanceRegen: 8,
  power: 18,
  critChance: 5,
  critDamage: 50,
  cooldownReduction: 0,
  moveSpeed: 100,
  healingPower: 10,
});

export const BASE_SHIP_STATS: ShipStatBlock = createShipStatBlock({
  hull: 100,
  shields: 55,
  defense: 6,
  reactorEnergy: 90,
  reactorRegen: 8,
  weaponPower: 14,
  speed: 92,
  boostEfficiency: 94,
});

const COMPANION_ROLE_BASE_STATS: Record<CompanionRole, CharacterStatBlock> = {
  dps: createCharacterStatBlock({
    health: 82,
    shield: 24,
    defense: 5,
    resonance: 75,
    resonanceRegen: 6,
    power: 18,
    critChance: 7,
    critDamage: 55,
    cooldownReduction: 2,
    moveSpeed: 104,
    healingPower: 4,
  }),
  tank: createCharacterStatBlock({
    health: 124,
    shield: 34,
    defense: 13,
    resonance: 70,
    resonanceRegen: 5,
    power: 12,
    critChance: 3,
    critDamage: 40,
    cooldownReduction: 0,
    moveSpeed: 96,
    healingPower: 6,
  }),
  healer: createCharacterStatBlock({
    health: 88,
    shield: 32,
    defense: 6,
    resonance: 112,
    resonanceRegen: 9,
    power: 10,
    critChance: 4,
    critDamage: 45,
    cooldownReduction: 5,
    moveSpeed: 100,
    healingPower: 24,
  }),
};

const DEFAULT_SHIP_COMPONENTS: Record<ShipComponentSlotId, ShipComponentRecord> = {
  hullPlating: {
    id: "starter-alloy-plating",
    slot: "hullPlating",
    name: "Starter Alloy Plating",
    shortLabel: "Alloy Plating",
    description: "Basic carrier armor that gives the starter ship real hull and defense modifiers.",
    stats: { hull: 28, defense: 3 },
    tags: ["defense", "starter"],
  },
  shieldCore: {
    id: "starter-aegis-core",
    slot: "shieldCore",
    name: "Starter Aegis Core",
    shortLabel: "Aegis Core",
    description: "A modest shield core for early defensive uptime.",
    stats: { shields: 25, defense: 1 },
    tags: ["defense", "shield", "starter"],
  },
  reactor: {
    id: "starter-reactor",
    slot: "reactor",
    name: "Starter Reactor",
    shortLabel: "Reactor",
    description: "A stable reactor that sets the baseline energy pool and recharge rate.",
    stats: { reactorEnergy: 20, reactorRegen: 3 },
    tags: ["reactor", "resource", "starter"],
  },
  engine: {
    id: "starter-scout-engine",
    slot: "engine",
    name: "Starter Scout Engine",
    shortLabel: "Scout Engine",
    description: "Light drive tuning that brings the starter ship up to normal handling speed.",
    stats: { speed: 8, boostEfficiency: 6 },
    tags: ["mobility", "starter"],
  },
  weaponMount: {
    id: "starter-lumen-mount",
    slot: "weaponMount",
    name: "Starter Lumen Mount",
    shortLabel: "Lumen Mount",
    description: "A simple weapon coupling that feeds the ship's primary fire rating.",
    stats: { weaponPower: 6 },
    tags: ["offense", "starter"],
  },
};

export function createCharacterStatBlock(overrides: CharacterStatModifierBlock = {}): CharacterStatBlock {
  return {
    health: overrides.health ?? 0,
    shield: overrides.shield ?? 0,
    defense: overrides.defense ?? 0,
    resonance: overrides.resonance ?? 0,
    resonanceRegen: overrides.resonanceRegen ?? 0,
    power: overrides.power ?? 0,
    critChance: overrides.critChance ?? 0,
    critDamage: overrides.critDamage ?? 0,
    cooldownReduction: overrides.cooldownReduction ?? 0,
    moveSpeed: overrides.moveSpeed ?? 0,
    healingPower: overrides.healingPower ?? 0,
  };
}

export function createShipStatBlock(overrides: ShipStatModifierBlock = {}): ShipStatBlock {
  return {
    hull: overrides.hull ?? 0,
    shields: overrides.shields ?? 0,
    defense: overrides.defense ?? 0,
    reactorEnergy: overrides.reactorEnergy ?? 0,
    reactorRegen: overrides.reactorRegen ?? 0,
    weaponPower: overrides.weaponPower ?? 0,
    speed: overrides.speed ?? 0,
    boostEfficiency: overrides.boostEfficiency ?? 0,
  };
}

export function cloneShipComponent(component: ShipComponentRecord | null | undefined): ShipComponentRecord | null {
  return component ? JSON.parse(JSON.stringify(component)) as ShipComponentRecord : null;
}

export function createDefaultShipComponentLoadout(): ShipComponentLoadout {
  return {
    hullPlating: cloneShipComponent(DEFAULT_SHIP_COMPONENTS.hullPlating),
    shieldCore: cloneShipComponent(DEFAULT_SHIP_COMPONENTS.shieldCore),
    reactor: cloneShipComponent(DEFAULT_SHIP_COMPONENTS.reactor),
    engine: cloneShipComponent(DEFAULT_SHIP_COMPONENTS.engine),
    weaponMount: cloneShipComponent(DEFAULT_SHIP_COMPONENTS.weaponMount),
  };
}

export function normalizeShipComponentLoadout(
  value: Partial<Record<ShipComponentSlotId, Partial<ShipComponentRecord> | null>> | undefined,
): ShipComponentLoadout {
  const normalized = createDefaultShipComponentLoadout();
  if (!value) {
    return normalized;
  }

  SHIP_COMPONENT_SLOTS.forEach((slot) => {
    const parsed = value[slot.id];
    if (parsed === null) {
      normalized[slot.id] = null;
      return;
    }
    if (!parsed || typeof parsed !== "object" || parsed.slot !== slot.id || typeof parsed.id !== "string") {
      return;
    }

    normalized[slot.id] = {
      id: parsed.id,
      slot: slot.id,
      name: typeof parsed.name === "string" && parsed.name.length > 0 ? parsed.name : "Unknown Component",
      shortLabel: typeof parsed.shortLabel === "string" && parsed.shortLabel.length > 0 ? parsed.shortLabel : "Component",
      description: typeof parsed.description === "string" ? parsed.description : "",
      stats: normalizeShipStatModifier(parsed.stats),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
        : [],
    };
  });

  return normalized;
}

export function resolveCharacterStats(
  base: CharacterStatBlock = LEVEL_ONE_KNIGHT_CHARACTER_STATS,
  modifiers: StatModifierSource[] = [],
): ResolvedCharacterStats {
  const equipment = createCharacterStatBlock();
  const skills = createCharacterStatBlock();
  modifiers.forEach((modifier) => {
    const target = modifier.sourceType === "skill" ? skills : equipment;
    addCharacterStats(target, modifier.character);
  });

  return {
    base: createCharacterStatBlock(base),
    equipment,
    skills,
    total: clampCharacterStats(addCharacterStatBlocks(base, equipment, skills)),
    modifiers,
  };
}

export function resolveCompanionStats(
  companion: CompanionDefinition,
  modifiers: StatModifierSource[] = [],
): ResolvedCharacterStats {
  const roleBase = COMPANION_ROLE_BASE_STATS[companion.role];
  const companionBase = createCharacterStatBlock({
    ...roleBase,
    health: Math.max(roleBase.health, companion.maxHp),
    shield: Math.max(roleBase.shield, companion.maxShield),
  });

  return resolveCharacterStats(companionBase, [
    {
      id: `${companion.id}-baseline`,
      label: `${companion.name} baseline`,
      sourceType: "companion",
      character: {
        moveSpeed: Math.round((1 - companion.aggroWeight * 0.04) * 10) / 10,
      },
      tags: [companion.role, companion.attackStyle],
    },
    ...modifiers,
  ]);
}

export function resolveShipStats(
  components: ShipComponentLoadout,
  modifiers: StatModifierSource[] = [],
): ResolvedShipStats {
  const componentModifiers = SHIP_COMPONENT_SLOTS
    .map((slot) => components[slot.id])
    .filter((component): component is ShipComponentRecord => Boolean(component))
    .map<StatModifierSource>((component) => ({
      id: component.id,
      label: component.name,
      sourceType: "ship-component",
      ship: component.stats,
      tags: component.tags,
    }));
  const allModifiers = [...componentModifiers, ...modifiers];
  const componentsBlock = createShipStatBlock();
  const skills = createShipStatBlock();

  allModifiers.forEach((modifier) => {
    const target = modifier.sourceType === "skill" ? skills : componentsBlock;
    addShipStats(target, modifier.ship);
  });

  return {
    base: createShipStatBlock(BASE_SHIP_STATS),
    components: componentsBlock,
    skills,
    total: clampShipStats(addShipStatBlocks(BASE_SHIP_STATS, componentsBlock, skills)),
    modifiers: allModifiers,
  };
}

export function summarizeCharacterStats(stats: ResolvedCharacterStats, label = "Character"): string[] {
  return [
    `${label} Stats`,
    `HP ${formatNumber(stats.total.health)} | Sh ${formatNumber(stats.total.shield)} | Def ${formatNumber(stats.total.defense)}`,
    `Res ${formatNumber(stats.total.resonance)} | Regen ${formatNumber(stats.total.resonanceRegen)}/s`,
    `Pwr ${formatNumber(stats.total.power)} | Crit ${formatPercent(stats.total.critChance)}/+${formatPercent(stats.total.critDamage)}`,
    `CD ${formatPercent(stats.total.cooldownReduction)} | Move ${formatPercent(stats.total.moveSpeed)} | Heal ${formatNumber(stats.total.healingPower)}`,
  ];
}

export function summarizeCharacterStatDeltas(stats: ResolvedCharacterStats): string[] {
  const lines: string[] = [];
  const equipmentTotal = CHARACTER_STAT_KEYS.reduce((total, key) => total + Math.abs(stats.equipment[key]), 0);
  if (equipmentTotal > 0) {
    lines.push(`Gear: ${summarizeCompactCharacterBlock(stats.equipment)}`);
  } else {
    lines.push("Gear: no stat modifiers equipped");
  }

  const skillTotal = CHARACTER_STAT_KEYS.reduce((total, key) => total + Math.abs(stats.skills[key]), 0);
  lines.push(skillTotal > 0 ? `Skills: ${summarizeCompactCharacterBlock(stats.skills)}` : "Skills: ready for future nodes");
  return lines;
}

export function summarizeShipStats(stats: ResolvedShipStats, label = "Ship"): string[] {
  return [
    `${label} Stats`,
    `Hull ${formatNumber(stats.total.hull)} | Sh ${formatNumber(stats.total.shields)} | Def ${formatNumber(stats.total.defense)}`,
    `Reactor ${formatNumber(stats.total.reactorEnergy)} | Regen ${formatNumber(stats.total.reactorRegen)}/s`,
    `Wpn ${formatNumber(stats.total.weaponPower)} | Speed ${formatPercent(stats.total.speed)} | Boost ${formatPercent(stats.total.boostEfficiency)}`,
  ];
}

export function summarizeShipComponents(components: ShipComponentLoadout): string[] {
  return SHIP_COMPONENT_SLOTS.map((slot) => {
    const component = components[slot.id];
    return component
      ? `${slot.label}: ${component.shortLabel}`
      : `${slot.label}: Empty`;
  });
}

function addCharacterStats(target: CharacterStatBlock, source: CharacterStatModifierBlock | undefined): void {
  if (!source) {
    return;
  }
  CHARACTER_STAT_KEYS.forEach((key) => {
    target[key] += source[key] ?? 0;
  });
}

function addShipStats(target: ShipStatBlock, source: ShipStatModifierBlock | undefined): void {
  if (!source) {
    return;
  }
  SHIP_STAT_KEYS.forEach((key) => {
    target[key] += source[key] ?? 0;
  });
}

function addCharacterStatBlocks(...blocks: Array<CharacterStatModifierBlock | undefined>): CharacterStatBlock {
  const total = createCharacterStatBlock();
  blocks.forEach((block) => addCharacterStats(total, block));
  return total;
}

function addShipStatBlocks(...blocks: Array<ShipStatModifierBlock | undefined>): ShipStatBlock {
  const total = createShipStatBlock();
  blocks.forEach((block) => addShipStats(total, block));
  return total;
}

function normalizeShipStatModifier(stats: unknown): ShipStatModifierBlock {
  const normalized: ShipStatModifierBlock = {};
  if (!stats || typeof stats !== "object") {
    return normalized;
  }

  SHIP_STAT_KEYS.forEach((key) => {
    const value = (stats as Partial<Record<ShipStatKey, unknown>>)[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    }
  });
  return normalized;
}

function clampCharacterStats(stats: CharacterStatBlock): CharacterStatBlock {
  return createCharacterStatBlock({
    health: Math.max(1, stats.health),
    shield: Math.max(0, stats.shield),
    defense: Math.max(0, stats.defense),
    resonance: Math.max(0, stats.resonance),
    resonanceRegen: Math.max(0, stats.resonanceRegen),
    power: Math.max(0, stats.power),
    critChance: Math.max(0, Math.min(100, stats.critChance)),
    critDamage: Math.max(0, stats.critDamage),
    cooldownReduction: Math.max(0, Math.min(75, stats.cooldownReduction)),
    moveSpeed: Math.max(40, stats.moveSpeed),
    healingPower: Math.max(0, stats.healingPower),
  });
}

function clampShipStats(stats: ShipStatBlock): ShipStatBlock {
  return createShipStatBlock({
    hull: Math.max(1, stats.hull),
    shields: Math.max(0, stats.shields),
    defense: Math.max(0, stats.defense),
    reactorEnergy: Math.max(0, stats.reactorEnergy),
    reactorRegen: Math.max(0, stats.reactorRegen),
    weaponPower: Math.max(0, stats.weaponPower),
    speed: Math.max(25, stats.speed),
    boostEfficiency: Math.max(25, stats.boostEfficiency),
  });
}

function summarizeCompactCharacterBlock(block: CharacterStatModifierBlock): string {
  const parts = CHARACTER_STAT_KEYS
    .filter((key) => typeof block[key] === "number" && block[key] !== 0)
    .slice(0, 5)
    .map((key) => `${block[key]! > 0 ? "+" : ""}${formatNumber(block[key]!)} ${getCharacterStatLabel(key)}`);
  return parts.length > 0 ? parts.join(", ") : "none";
}

function getCharacterStatLabel(key: CharacterStatKey): string {
  switch (key) {
    case "health":
      return "Health";
    case "shield":
      return "Shield";
    case "defense":
      return "Defense";
    case "resonance":
      return "Resonance";
    case "resonanceRegen":
      return "Resonance Regen";
    case "power":
      return "Power";
    case "critChance":
      return "Crit Chance";
    case "critDamage":
      return "Crit Damage";
    case "cooldownReduction":
      return "Cooldown";
    case "moveSpeed":
      return "Move";
    case "healingPower":
      return "Healing";
    default:
      return key;
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
