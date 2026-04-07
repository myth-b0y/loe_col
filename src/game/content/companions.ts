export type CompanionAttackStyle = "ranged" | "shield";
export type CompanionId = "sera" | "rook";

export type CompanionDefinition = {
  id: CompanionId;
  name: string;
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
  hubPosition: {
    x: number;
    y: number;
  };
};

export const STORY_COMPANIONS: readonly CompanionDefinition[] = [
  {
    id: "sera",
    name: "Sera",
    roleLabel: "Covering Fire",
    attackStyle: "ranged",
    coreColor: 0xf3cc7a,
    trimColor: 0xfff1ba,
    projectileColor: 0xffd779,
    radius: 12,
    maxHp: 52,
    maxShield: 24,
    formationSide: -1,
    formationDepth: 60,
    aggroWeight: 0.98,
    primaryGear: "Sunspike Repeater",
    supportGear: "Scout Harness Mk I",
    hubPosition: {
      x: 634,
      y: 530,
    },
  },
  {
    id: "rook",
    name: "Rook",
    roleLabel: "Shield Vanguard",
    attackStyle: "shield",
    coreColor: 0x79d98e,
    trimColor: 0xd8ffd8,
    projectileColor: 0x97f6b1,
    radius: 14,
    maxHp: 88,
    maxShield: 24,
    formationSide: 1,
    formationDepth: 80,
    aggroWeight: 0.6,
    primaryGear: "Bulwark Shield Frame",
    supportGear: "Aegis Bash Emitter",
    hubPosition: {
      x: 720,
      y: 530,
    },
  },
] as const;
