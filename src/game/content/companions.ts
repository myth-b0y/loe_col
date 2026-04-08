export type CompanionAttackStyle =
  | "ranged"
  | "shield"
  | "melee"
  | "healer"
  | "caster"
  | "demolition"
  | "bulwark";
export type CompanionId = "sera" | "rook" | "vex" | "lyra" | "orin" | "ember";
export type CompanionRole = "dps" | "tank" | "healer";
export type FormationZone = "front" | "back" | "side";
export type FormationSlotId = "front-left" | "front-right" | "back-left" | "back-right" | "left" | "right";
export type CompanionKitId =
  | "covering-fire"
  | "shield-vanguard"
  | "rift-skirmisher"
  | "tide-medic"
  | "astral-weaver"
  | "purge-warden";

export type FormationSlotDefinition = {
  id: FormationSlotId;
  label: string;
  zone: FormationZone;
  boardX: number;
  boardY: number;
  missionForward: number;
  missionLateral: number;
};

export type SquadAssignment = {
  companionId: CompanionId;
  slotId: FormationSlotId;
};

export type CompanionCombatKit = {
  id: CompanionKitId;
  role: CompanionRole;
  roleBadge: string;
  roleLabel: string;
  attackStyle: CompanionAttackStyle;
  primaryGear: string;
  supportGear: string;
  abilityLabel: string;
  attackSummary: string;
  abilitySummary: string;
};

export type CompanionDefinition = {
  id: CompanionId;
  kitId: CompanionKitId;
  name: string;
  bio: string;
  role: CompanionRole;
  roleBadge: string;
  roleLabel: string;
  attackStyle: CompanionAttackStyle;
  coreColor: number;
  trimColor: number;
  projectileColor: number;
  radius: number;
  maxHp: number;
  maxShield: number;
  formationSide: -1 | 1;
  formationDepth: number;
  aggroWeight: number;
  primaryGear: string;
  supportGear: string;
  abilityLabel: string;
  attackSummary: string;
  abilitySummary: string;
  hubPosition: {
    x: number;
    y: number;
  };
};

type CompanionSeedDefinition = {
  id: CompanionId;
  kitId: CompanionKitId;
  name: string;
  bio: string;
  coreColor: number;
  trimColor: number;
  projectileColor: number;
  radius: number;
  maxHp: number;
  maxShield: number;
  formationSide: -1 | 1;
  formationDepth: number;
  aggroWeight: number;
  hubPosition: {
    x: number;
    y: number;
  };
};

export const COMPANION_COMBAT_KITS: Record<CompanionKitId, CompanionCombatKit> = {
  "covering-fire": {
    id: "covering-fire",
    role: "dps",
    roleBadge: "*",
    roleLabel: "Suppressor",
    attackStyle: "ranged",
    primaryGear: "Sunspike Repeater",
    supportGear: "Scout Harness Mk I",
    abilityLabel: "Suppressive Volley",
    attackSummary: "Rapid ranged bursts that keep targets pinned in their lane.",
    abilitySummary: "Fires a three-shot spread that slows enemy attack cadence.",
  },
  "shield-vanguard": {
    id: "shield-vanguard",
    role: "tank",
    roleBadge: "[]",
    roleLabel: "Shield Vanguard",
    attackStyle: "shield",
    primaryGear: "Bulwark Shield Frame",
    supportGear: "Aegis Bash Emitter",
    abilityLabel: "Front Guard",
    attackSummary: "Physical shield intercepts shots and hard-bashes anything that closes in.",
    abilitySummary: "Projects a guard pulse that restores nearby shields and stabilizes the front line.",
  },
  "rift-skirmisher": {
    id: "rift-skirmisher",
    role: "dps",
    roleBadge: "*",
    roleLabel: "Rift Skirmisher",
    attackStyle: "melee",
    primaryGear: "Sunder Blades",
    supportGear: "Kinetic Anklets",
    abilityLabel: "Gap Cleave",
    attackSummary: "Aggressive melee dives that rupture clustered enemies.",
    abilitySummary: "Blink-slashes into the target and leaves nearby enemies staggered.",
  },
  "tide-medic": {
    id: "tide-medic",
    role: "healer",
    roleBadge: "+",
    roleLabel: "Tide Medic",
    attackStyle: "healer",
    primaryGear: "Mender Focus",
    supportGear: "Wave Harness",
    abilityLabel: "Restoration Pulse",
    attackSummary: "No direct attack. Channels wave-mending into whoever is breaking first.",
    abilitySummary: "Large single-target heal with a smaller splash heal around the impact.",
  },
  "astral-weaver": {
    id: "astral-weaver",
    role: "healer",
    roleBadge: "+",
    roleLabel: "Astral Weaver",
    attackStyle: "healer",
    primaryGear: "Astral Loom",
    supportGear: "Bloom Veil",
    abilityLabel: "Astral Verse",
    attackSummary: "No direct attack. Weaves tempo wards and recovery buffs from the back line.",
    abilitySummary: "Refreshes nearby shields and accelerates allied cooldowns for a short burst.",
  },
  "purge-warden": {
    id: "purge-warden",
    role: "tank",
    roleBadge: "[]",
    roleLabel: "Purge Warden",
    attackStyle: "bulwark",
    primaryGear: "Cinder Maul",
    supportGear: "Purge Mantle",
    abilityLabel: "Cinder Purge",
    attackSummary: "Heavy breaker swings that force space open and hold the line.",
    abilitySummary: "Shockwave slam damages nearby enemies and grants a brief guard cleanse to allies.",
  },
};

const STORY_COMPANION_SEEDS: readonly CompanionSeedDefinition[] = [
  {
    id: "sera",
    kitId: "covering-fire",
    name: "Sera",
    bio: "A steady sharpshooter who turns clean lanes into kill zones for the squad.",
    coreColor: 0xf3cc7a,
    trimColor: 0xfff1ba,
    projectileColor: 0xffd779,
    radius: 12,
    maxHp: 50,
    maxShield: 22,
    formationSide: 1,
    formationDepth: 44,
    aggroWeight: 1.02,
    hubPosition: {
      x: 520,
      y: 554,
    },
  },
  {
    id: "rook",
    kitId: "shield-vanguard",
    name: "Rook",
    bio: "A plated vanguard built to eat the first hit and keep the route from collapsing.",
    coreColor: 0x79d98e,
    trimColor: 0xd8ffd8,
    projectileColor: 0x97f6b1,
    radius: 14,
    maxHp: 92,
    maxShield: 26,
    formationSide: -1,
    formationDepth: 82,
    aggroWeight: 0.58,
    hubPosition: {
      x: 600,
      y: 516,
    },
  },
  {
    id: "vex",
    kitId: "rift-skirmisher",
    name: "Vex",
    bio: "A close-range predator who lives off flanks, ruptures, and fast repositioning.",
    coreColor: 0xff7979,
    trimColor: 0xffd6d6,
    projectileColor: 0xffa38a,
    radius: 12,
    maxHp: 58,
    maxShield: 18,
    formationSide: -1,
    formationDepth: 62,
    aggroWeight: 0.88,
    hubPosition: {
      x: 680,
      y: 554,
    },
  },
  {
    id: "lyra",
    kitId: "tide-medic",
    name: "Lyra",
    bio: "A battlefield medic whose whole job is keeping the crew upright under pressure.",
    coreColor: 0x76c6ff,
    trimColor: 0xe7f7ff,
    projectileColor: 0x9be8ff,
    radius: 12,
    maxHp: 48,
    maxShield: 28,
    formationSide: -1,
    formationDepth: -54,
    aggroWeight: 0.76,
    hubPosition: {
      x: 760,
      y: 516,
    },
  },
  {
    id: "orin",
    kitId: "astral-weaver",
    name: "Orin",
    bio: "An astral support specialist who keeps the crew fast, warded, and hard to pin down.",
    coreColor: 0xb987ff,
    trimColor: 0xf1e1ff,
    projectileColor: 0xd7b4ff,
    radius: 12,
    maxHp: 44,
    maxShield: 30,
    formationSide: 1,
    formationDepth: -34,
    aggroWeight: 0.84,
    hubPosition: {
      x: 840,
      y: 554,
    },
  },
  {
    id: "ember",
    kitId: "purge-warden",
    name: "Ember",
    bio: "A hot-blooded breaker who crashes into the lane and burns pressure off the rest of the crew.",
    coreColor: 0xffa35c,
    trimColor: 0xffedd4,
    projectileColor: 0xffcb8d,
    radius: 13,
    maxHp: 84,
    maxShield: 22,
    formationSide: 1,
    formationDepth: 60,
    aggroWeight: 0.64,
    hubPosition: {
      x: 920,
      y: 516,
    },
  },
] as const;

function buildCompanionDefinition(seed: CompanionSeedDefinition): CompanionDefinition {
  const kit = COMPANION_COMBAT_KITS[seed.kitId];
  return {
    ...seed,
    role: kit.role,
    roleBadge: kit.roleBadge,
    roleLabel: kit.roleLabel,
    attackStyle: kit.attackStyle,
    primaryGear: kit.primaryGear,
    supportGear: kit.supportGear,
    abilityLabel: kit.abilityLabel,
    attackSummary: kit.attackSummary,
    abilitySummary: kit.abilitySummary,
  };
}

export const STORY_COMPANIONS: readonly CompanionDefinition[] = STORY_COMPANION_SEEDS.map(buildCompanionDefinition);

export const FORMATION_SLOTS: readonly FormationSlotDefinition[] = [
  {
    id: "front-left",
    label: "Front Left",
    zone: "front",
    boardX: -92,
    boardY: -94,
    missionForward: 64,
    missionLateral: -30,
  },
  {
    id: "front-right",
    label: "Front Right",
    zone: "front",
    boardX: 92,
    boardY: -94,
    missionForward: 64,
    missionLateral: 30,
  },
  {
    id: "back-left",
    label: "Back Left",
    zone: "back",
    boardX: -92,
    boardY: 94,
    missionForward: -62,
    missionLateral: -28,
  },
  {
    id: "back-right",
    label: "Back Right",
    zone: "back",
    boardX: 92,
    boardY: 94,
    missionForward: -62,
    missionLateral: 28,
  },
  {
    id: "left",
    label: "Left Wing",
    zone: "side",
    boardX: -142,
    boardY: 0,
    missionForward: 0,
    missionLateral: -72,
  },
  {
    id: "right",
    label: "Right Wing",
    zone: "side",
    boardX: 142,
    boardY: 0,
    missionForward: 0,
    missionLateral: 72,
  },
] as const;

export const DEFAULT_SQUAD_ASSIGNMENTS: readonly SquadAssignment[] = [
  { companionId: "rook", slotId: "front-left" },
  { companionId: "sera", slotId: "right" },
  { companionId: "lyra", slotId: "back-right" },
] as const;

export function getCompanionDefinition(companionId: CompanionId): CompanionDefinition | undefined {
  return STORY_COMPANIONS.find((companion) => companion.id === companionId);
}

export function getCompanionCombatKit(kitId: CompanionKitId): CompanionCombatKit {
  return COMPANION_COMBAT_KITS[kitId];
}

export function getFormationSlot(slotId: FormationSlotId): FormationSlotDefinition | undefined {
  return FORMATION_SLOTS.find((slot) => slot.id === slotId);
}

export function canCompanionOccupySlot(companion: CompanionDefinition, slot: FormationSlotDefinition): boolean {
  if (companion.role === "tank") {
    return slot.zone === "front";
  }

  if (companion.role === "healer") {
    return slot.zone === "back";
  }

  return true;
}

export function getCompanionRoleDisplay(companion: CompanionDefinition): string {
  return `${companion.roleBadge} ${companion.roleLabel}`;
}
