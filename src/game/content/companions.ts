export type CompanionAttackStyle = "ranged" | "shield" | "melee" | "healer" | "caster" | "demolition";
export type CompanionId = "sera" | "rook" | "vex" | "lyra" | "orin" | "ember";
export type CompanionRole = "dps" | "tank" | "healer";
export type FormationZone = "front" | "back" | "side";
export type FormationSlotId = "front-left" | "front-right" | "back-left" | "back-right" | "left" | "right";

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

export type CompanionDefinition = {
  id: CompanionId;
  name: string;
  role: CompanionRole;
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
  hubPosition: {
    x: number;
    y: number;
  };
};

export const STORY_COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: "sera",
    name: "Sera",
    role: "dps",
    roleLabel: "Covering Fire",
    attackStyle: "ranged",
    coreColor: 0xf3cc7a,
    trimColor: 0xfff1ba,
    projectileColor: 0xffd779,
    radius: 12,
    maxHp: 50,
    maxShield: 22,
    formationSide: 1,
    formationDepth: 44,
    aggroWeight: 1.02,
    primaryGear: "Sunspike Repeater",
    supportGear: "Scout Harness Mk I",
    abilityLabel: "Suppressive Volley",
    hubPosition: {
      x: 520,
      y: 554,
    },
  },
  {
    id: "rook",
    name: "Rook",
    role: "tank",
    roleLabel: "Shield Vanguard",
    attackStyle: "shield",
    coreColor: 0x79d98e,
    trimColor: 0xd8ffd8,
    projectileColor: 0x97f6b1,
    radius: 14,
    maxHp: 92,
    maxShield: 26,
    formationSide: -1,
    formationDepth: 82,
    aggroWeight: 0.58,
    primaryGear: "Bulwark Shield Frame",
    supportGear: "Aegis Bash Emitter",
    abilityLabel: "Front Guard",
    hubPosition: {
      x: 600,
      y: 516,
    },
  },
  {
    id: "vex",
    name: "Vex",
    role: "dps",
    roleLabel: "Rift Skirmisher",
    attackStyle: "melee",
    coreColor: 0xff7979,
    trimColor: 0xffd6d6,
    projectileColor: 0xffa38a,
    radius: 12,
    maxHp: 58,
    maxShield: 18,
    formationSide: -1,
    formationDepth: 62,
    aggroWeight: 0.88,
    primaryGear: "Sunder Blades",
    supportGear: "Kinetic Anklets",
    abilityLabel: "Gap Cleave",
    hubPosition: {
      x: 680,
      y: 554,
    },
  },
  {
    id: "lyra",
    name: "Lyra",
    role: "healer",
    roleLabel: "Tide Medic",
    attackStyle: "healer",
    coreColor: 0x76c6ff,
    trimColor: 0xe7f7ff,
    projectileColor: 0x9be8ff,
    radius: 12,
    maxHp: 48,
    maxShield: 28,
    formationSide: -1,
    formationDepth: -54,
    aggroWeight: 0.76,
    primaryGear: "Mender Focus",
    supportGear: "Wave Harness",
    abilityLabel: "Restoration Pulse",
    hubPosition: {
      x: 760,
      y: 516,
    },
  },
  {
    id: "orin",
    name: "Orin",
    role: "dps",
    roleLabel: "Hex Channeler",
    attackStyle: "caster",
    coreColor: 0xb987ff,
    trimColor: 0xf1e1ff,
    projectileColor: 0xd7b4ff,
    radius: 12,
    maxHp: 46,
    maxShield: 32,
    formationSide: 1,
    formationDepth: -34,
    aggroWeight: 0.84,
    primaryGear: "Gloam Focus",
    supportGear: "Runed Veil",
    abilityLabel: "Hex Arc",
    hubPosition: {
      x: 840,
      y: 554,
    },
  },
  {
    id: "ember",
    name: "Ember",
    role: "dps",
    roleLabel: "Breach Demolitions",
    attackStyle: "demolition",
    coreColor: 0xffa35c,
    trimColor: 0xffedd4,
    projectileColor: 0xffcb8d,
    radius: 12,
    maxHp: 56,
    maxShield: 20,
    formationSide: 1,
    formationDepth: 52,
    aggroWeight: 0.92,
    primaryGear: "Fuse Cannon",
    supportGear: "Charge Rig",
    abilityLabel: "Breach Charge",
    hubPosition: {
      x: 920,
      y: 516,
    },
  },
] as const;

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
