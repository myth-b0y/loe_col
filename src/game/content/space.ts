import {
  GALAXY_SECTORS,
  GALAXY_WORLD_CONFIG,
  getGalaxySectorAtPosition,
  getGalaxySectorById,
  getGalaxySpawnPointForRace,
  getGalaxySystemById,
  getGalaxyZoneById,
  pointFromDegrees,
  type GalaxyDefinition,
  type GalaxyPoint,
  type GalaxySectorConfig,
} from "./galaxy";
import {
  getActiveFactionForceShips,
  type FactionForceActiveShipRecord,
  type FactionForceAssignmentKind,
  type FactionForceShipRole,
  type FactionForceState,
} from "./factionForces";
import {
  getSpaceFactionIdForRace,
  type FactionWarState,
} from "./factionWar";
import { type RaceId } from "./items";

export type SpaceFieldObjectKind = "asteroid" | "debris";
export type SpaceFieldPlacementType = "single" | "cluster" | "belt";
export type SpaceFactionId = "empire" | "pirate" | "republic" | "smuggler" | "homeguard";
export type SpaceWorldCellKey = `${number},${number}`;

export type SpaceWorldConfig = {
  width: number;
  height: number;
  spawn: {
    x: number;
    y: number;
  };
  starCount: number;
  cellSize: number;
  activeFieldCellRadius: number;
  activeShipCellRadius: number;
  nearbyFieldRadius: number;
  nearbySafeRadius: number;
  nearbyObjectCount: number;
  galaxyObjectCount: number;
  deepSpaceObjectCount: number;
  clusterMinSize: number;
  clusterMaxSize: number;
  beltCount: number;
  deepSpaceBeltCount: number;
  beltMinSize: number;
  beltMaxSize: number;
  galaxyFloaterCount: number;
  deepSpaceFloaterCount: number;
  shipSpawnSafeRadius: number;
  sectorInnerPadding: number;
  sectorOuterPadding: number;
  deepSpaceMargin: number;
  asteroidSystemBuffer: number;
  asteroidStationBuffer: number;
};

export type SpaceSectorConfig = {
  id: string;
  ships: Partial<Record<SpaceFactionId, number>>;
};

export type SpaceFactionConfig = {
  id: SpaceFactionId;
  label: string;
  color: number;
  trimColor: number;
  glowColor: number;
  hostiles: SpaceFactionId[];
  attackPlayerByDefault: boolean;
  avoidCombat: boolean;
  maxHull: number;
  radius: number;
  acceleration: number;
  maxSpeed: number;
  detectRange: number;
  fireRange: number;
  preferredRange: number;
  fireCooldown: number;
  bulletSpeed: number;
};

export type SpaceRaceDefenseProfile = {
  hullBonus: number;
  accelerationMultiplier: number;
  maxSpeedMultiplier: number;
  detectRangeMultiplier: number;
  fireRangeMultiplier: number;
  preferredRangeMultiplier: number;
  fireCooldownMultiplier: number;
  bulletSpeedMultiplier: number;
  formationSpacingMultiplier: number;
  guardRadiusMultiplier: number;
  patrolRadiusMin: number;
  patrolRadiusMax: number;
  interceptPadding: number;
  anchorPriority: number;
  damagedTargetBias: number;
  strafeStrength: number;
  combatAdvanceBias: number;
  allyAlertRadius: number;
};

export type SpaceShipRoleCombatProfile = {
  radiusMultiplier: number;
  hullMultiplier: number;
  accelerationMultiplier: number;
  maxSpeedMultiplier: number;
  detectRangeMultiplier: number;
  fireRangeMultiplier: number;
  preferredRangeMultiplier: number;
  fireCooldownMultiplier: number;
  bulletSpeedMultiplier: number;
  damageMultiplier: number;
  leadPriority: number;
  supportRepairAmount: number;
  supportRepairCooldownMs: number;
  supportRepairRange: number;
};

export type SpaceFieldObjectSeed = {
  id: string;
  cellKey: SpaceWorldCellKey;
  kind: SpaceFieldObjectKind;
  placementType: SpaceFieldPlacementType;
  isLarge: boolean;
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  hp: number;
  velocityX: number;
  velocityY: number;
  spin: number;
  rotation: number;
};

export type SpaceFactionShipSeed = {
  id: string;
  cellKey: SpaceWorldCellKey;
  factionId: SpaceFactionId;
  shipRole?: FactionForceShipRole | null;
  assignmentKind?: FactionForceAssignmentKind | null;
  assignmentZoneId?: string | null;
  sectorId: string;
  groupId: string;
  leaderId: string | null;
  formationOffsetX: number;
  formationOffsetY: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  patrolX: number;
  patrolY: number;
  customColor?: number | null;
  customTrimColor?: number | null;
  customGlowColor?: number | null;
  guardAnchorX?: number | null;
  guardAnchorY?: number | null;
  guardRadius?: number | null;
  originPoolId?: string | null;
  originPoolKind?: "zone" | "prime-world" | null;
  originZoneId?: string | null;
  originSystemId?: string | null;
  originRaceId?: RaceId | null;
};

export type SpaceWorldDefinition = {
  fieldSeeds: SpaceFieldObjectSeed[];
  factionSeeds: SpaceFactionShipSeed[];
  fieldSeedIndex: Record<string, SpaceFieldObjectSeed>;
  factionSeedIndex: Record<string, SpaceFactionShipSeed>;
  fieldSeedsByCell: Record<SpaceWorldCellKey, SpaceFieldObjectSeed[]>;
  factionSeedsByCell: Record<SpaceWorldCellKey, SpaceFactionShipSeed[]>;
  factionCounts: Record<SpaceFactionId, number>;
};

export type SpaceHyperdriveState = "normal" | "charging" | "active" | "cooldown";

export type ShipHyperdriveConfig = {
  chargeDurationMs: number;
  countdownIntervalMs: number;
  cooldownDurationMs: number;
  speedMultiplier: number;
  exitBlendDurationMs: number;
  exitDrag: number;
  postDropSpeedMultiplier: number;
  proximitySafetyPadding: number;
  waypointAutoDropPadding: number;
};

export type ShipRadarConfig = {
  range: number;
  width: number;
  height: number;
  sweepSpeedDegPerSec: number;
  sweepWidthDeg: number;
  memoryFadeMs: number;
  memoryClearMs: number;
};

export type ShipHyperdriveSystemState = {
  state: SpaceHyperdriveState;
  chargeElapsedMs: number;
  cooldownRemainingMs: number;
  exitBlendRemainingMs: number;
  lockedDirectionX: number;
  lockedDirectionY: number;
  lastDisengageReason: string | null;
};

const SPACE_SECTOR_SHIPS: Record<string, Partial<Record<SpaceFactionId, number>>> = {
  "olydran-expanse": { pirate: 4, smuggler: 3 },
  "aaruian-reach": { pirate: 4, smuggler: 3 },
  "elsari-veil": { pirate: 14, smuggler: 3 },
  "nevari-bloom": { pirate: 7, smuggler: 5 },
  "rakkan-drift": { pirate: 11, smuggler: 2 },
  "svarin-span": { pirate: 10, smuggler: 2 },
  "ashari-crown": { pirate: 6, smuggler: 2 },
};

const FIELD_WORLD_SEED = 0x3c71_2a6d;
const SHIP_WORLD_SEED = 0x8f14_b39b;
let cachedSpaceWorldDefinition: SpaceWorldDefinition | null = null;

export const SPACE_WORLD_CONFIG: SpaceWorldConfig = {
  width: GALAXY_WORLD_CONFIG.width,
  height: GALAXY_WORLD_CONFIG.height,
  spawn: {
    x: GALAXY_WORLD_CONFIG.spawn.x,
    y: GALAXY_WORLD_CONFIG.spawn.y,
  },
  starCount: GALAXY_WORLD_CONFIG.starCount + GALAXY_WORLD_CONFIG.backgroundStarCount,
  cellSize: 3200,
  activeFieldCellRadius: 1,
  activeShipCellRadius: 2,
  nearbyFieldRadius: 2400,
  nearbySafeRadius: 360,
  nearbyObjectCount: 3,
  galaxyObjectCount: 48,
  deepSpaceObjectCount: 12,
  clusterMinSize: 4,
  clusterMaxSize: 7,
  beltCount: 12,
  deepSpaceBeltCount: 3,
  beltMinSize: 10,
  beltMaxSize: 18,
  galaxyFloaterCount: 116,
  deepSpaceFloaterCount: 34,
  shipSpawnSafeRadius: 1200,
  sectorInnerPadding: 720,
  sectorOuterPadding: 940,
  deepSpaceMargin: 2400,
  asteroidSystemBuffer: 920,
  asteroidStationBuffer: 760,
};

export const SPACE_FACTIONS: Record<SpaceFactionId, SpaceFactionConfig> = {
  empire: {
    id: "empire",
    label: "Empire",
    color: 0xa82e38,
    trimColor: 0xff9ca4,
    glowColor: 0xff6670,
    hostiles: ["republic", "pirate", "homeguard"],
    attackPlayerByDefault: true,
    avoidCombat: false,
    maxHull: 5,
    radius: 24,
    acceleration: 260,
    maxSpeed: 228,
    detectRange: 860,
    fireRange: 560,
    preferredRange: 330,
    fireCooldown: 0.74,
    bulletSpeed: 520,
  },
  pirate: {
    id: "pirate",
    label: "Pirates",
    color: 0xb38d16,
    trimColor: 0xffdf76,
    glowColor: 0xffd24d,
    hostiles: ["empire", "republic", "smuggler", "homeguard"],
    attackPlayerByDefault: true,
    avoidCombat: false,
    maxHull: 4,
    radius: 22,
    acceleration: 300,
    maxSpeed: 252,
    detectRange: 900,
    fireRange: 520,
    preferredRange: 280,
    fireCooldown: 0.62,
    bulletSpeed: 560,
  },
  republic: {
    id: "republic",
    label: "Republic",
    color: 0x2c5cab,
    trimColor: 0x92c5ff,
    glowColor: 0x69b7ff,
    hostiles: ["empire", "pirate"],
    attackPlayerByDefault: false,
    avoidCombat: false,
    maxHull: 5,
    radius: 23,
    acceleration: 250,
    maxSpeed: 220,
    detectRange: 860,
    fireRange: 560,
    preferredRange: 340,
    fireCooldown: 0.78,
    bulletSpeed: 520,
  },
  smuggler: {
    id: "smuggler",
    label: "Smugglers",
    color: 0x767e8a,
    trimColor: 0xd6dbe2,
    glowColor: 0xb7c1cf,
    hostiles: [],
    attackPlayerByDefault: false,
    avoidCombat: true,
    maxHull: 4,
    radius: 24,
    acceleration: 230,
    maxSpeed: 214,
    detectRange: 760,
    fireRange: 500,
    preferredRange: 420,
    fireCooldown: 0.92,
    bulletSpeed: 500,
  },
  homeguard: {
    id: "homeguard",
    label: "Home Guard",
    color: 0x3a8fd9,
    trimColor: 0xe6f6ff,
    glowColor: 0x8ad8ff,
    hostiles: ["empire", "pirate"],
    attackPlayerByDefault: false,
    avoidCombat: false,
    maxHull: 7,
    radius: 21,
    acceleration: 280,
    maxSpeed: 238,
    detectRange: 960,
    fireRange: 600,
    preferredRange: 360,
    fireCooldown: 0.7,
    bulletSpeed: 580,
  },
};

const DEFAULT_HOMEGUARD_RACE_PROFILE: SpaceRaceDefenseProfile = {
  hullBonus: 0,
  accelerationMultiplier: 1,
  maxSpeedMultiplier: 1,
  detectRangeMultiplier: 1,
  fireRangeMultiplier: 1,
  preferredRangeMultiplier: 1,
  fireCooldownMultiplier: 1,
  bulletSpeedMultiplier: 1,
  formationSpacingMultiplier: 1,
  guardRadiusMultiplier: 1,
  patrolRadiusMin: 0.48,
  patrolRadiusMax: 0.82,
  interceptPadding: 260,
  anchorPriority: 0.72,
  damagedTargetBias: 0,
  strafeStrength: 1,
  combatAdvanceBias: 0,
  allyAlertRadius: 1700,
};

const DEFAULT_SHIP_ROLE_COMBAT_PROFILE: SpaceShipRoleCombatProfile = {
  radiusMultiplier: 1,
  hullMultiplier: 1,
  accelerationMultiplier: 1,
  maxSpeedMultiplier: 1,
  detectRangeMultiplier: 1,
  fireRangeMultiplier: 1,
  preferredRangeMultiplier: 1,
  fireCooldownMultiplier: 1,
  bulletSpeedMultiplier: 1,
  damageMultiplier: 1,
  leadPriority: 2,
  supportRepairAmount: 0,
  supportRepairCooldownMs: 0,
  supportRepairRange: 0,
};

const HOMEGUARD_SHIP_ROLE_PROFILES: Record<FactionForceShipRole, SpaceShipRoleCombatProfile> = {
  "base-fighter": {
    ...DEFAULT_SHIP_ROLE_COMBAT_PROFILE,
    leadPriority: 3,
  },
  "support-fighter": {
    ...DEFAULT_SHIP_ROLE_COMBAT_PROFILE,
    hullMultiplier: 0.96,
    accelerationMultiplier: 0.96,
    maxSpeedMultiplier: 0.95,
    detectRangeMultiplier: 1.06,
    fireRangeMultiplier: 0.94,
    preferredRangeMultiplier: 1.08,
    fireCooldownMultiplier: 1.12,
    damageMultiplier: 0.72,
    leadPriority: 2,
    supportRepairAmount: 1,
    supportRepairCooldownMs: 3200,
    supportRepairRange: 270,
  },
  "attack-warship": {
    ...DEFAULT_SHIP_ROLE_COMBAT_PROFILE,
    radiusMultiplier: 1.42,
    hullMultiplier: 1.72,
    accelerationMultiplier: 0.76,
    maxSpeedMultiplier: 0.8,
    detectRangeMultiplier: 1.08,
    fireRangeMultiplier: 1.14,
    preferredRangeMultiplier: 1.08,
    fireCooldownMultiplier: 0.84,
    bulletSpeedMultiplier: 1.08,
    damageMultiplier: 1.82,
    leadPriority: 0,
  },
  "defense-warship": {
    ...DEFAULT_SHIP_ROLE_COMBAT_PROFILE,
    radiusMultiplier: 1.56,
    hullMultiplier: 2.05,
    accelerationMultiplier: 0.68,
    maxSpeedMultiplier: 0.7,
    detectRangeMultiplier: 1.1,
    preferredRangeMultiplier: 0.92,
    fireCooldownMultiplier: 0.92,
    damageMultiplier: 1.34,
    leadPriority: 1,
  },
};

const HOMEGUARD_RACE_PROFILES: Record<RaceId, SpaceRaceDefenseProfile> = {
  nevari: {
    hullBonus: 2,
    accelerationMultiplier: 0.94,
    maxSpeedMultiplier: 0.91,
    detectRangeMultiplier: 1.04,
    fireRangeMultiplier: 1.08,
    preferredRangeMultiplier: 1.08,
    fireCooldownMultiplier: 1.08,
    bulletSpeedMultiplier: 0.98,
    formationSpacingMultiplier: 0.94,
    guardRadiusMultiplier: 0.92,
    patrolRadiusMin: 0.34,
    patrolRadiusMax: 0.6,
    interceptPadding: 180,
    anchorPriority: 0.95,
    damagedTargetBias: 0.14,
    strafeStrength: 0.52,
    combatAdvanceBias: -0.08,
    allyAlertRadius: 2200,
  },
  olydran: {
    hullBonus: 0,
    accelerationMultiplier: 1,
    maxSpeedMultiplier: 0.98,
    detectRangeMultiplier: 1.18,
    fireRangeMultiplier: 1.14,
    preferredRangeMultiplier: 1.12,
    fireCooldownMultiplier: 0.94,
    bulletSpeedMultiplier: 1.12,
    formationSpacingMultiplier: 0.92,
    guardRadiusMultiplier: 1,
    patrolRadiusMin: 0.4,
    patrolRadiusMax: 0.68,
    interceptPadding: 240,
    anchorPriority: 0.78,
    damagedTargetBias: 0.55,
    strafeStrength: 0.46,
    combatAdvanceBias: -0.02,
    allyAlertRadius: 1540,
  },
  aaruian: {
    hullBonus: 1,
    accelerationMultiplier: 0.96,
    maxSpeedMultiplier: 0.95,
    detectRangeMultiplier: 1.06,
    fireRangeMultiplier: 1.01,
    preferredRangeMultiplier: 1.02,
    fireCooldownMultiplier: 0.98,
    bulletSpeedMultiplier: 1.02,
    formationSpacingMultiplier: 0.82,
    guardRadiusMultiplier: 0.9,
    patrolRadiusMin: 0.32,
    patrolRadiusMax: 0.56,
    interceptPadding: 220,
    anchorPriority: 0.96,
    damagedTargetBias: 0.18,
    strafeStrength: 0.38,
    combatAdvanceBias: -0.04,
    allyAlertRadius: 2320,
  },
  elsari: {
    hullBonus: 0,
    accelerationMultiplier: 1.02,
    maxSpeedMultiplier: 1,
    detectRangeMultiplier: 1.1,
    fireRangeMultiplier: 1.06,
    preferredRangeMultiplier: 1.05,
    fireCooldownMultiplier: 0.96,
    bulletSpeedMultiplier: 1.06,
    formationSpacingMultiplier: 0.9,
    guardRadiusMultiplier: 1.04,
    patrolRadiusMin: 0.38,
    patrolRadiusMax: 0.72,
    interceptPadding: 300,
    anchorPriority: 0.72,
    damagedTargetBias: 0.4,
    strafeStrength: 0.78,
    combatAdvanceBias: 0.08,
    allyAlertRadius: 1820,
  },
  rakkan: {
    hullBonus: 1,
    accelerationMultiplier: 1.04,
    maxSpeedMultiplier: 0.98,
    detectRangeMultiplier: 0.97,
    fireRangeMultiplier: 0.95,
    preferredRangeMultiplier: 0.84,
    fireCooldownMultiplier: 0.92,
    bulletSpeedMultiplier: 1,
    formationSpacingMultiplier: 1,
    guardRadiusMultiplier: 0.94,
    patrolRadiusMin: 0.38,
    patrolRadiusMax: 0.64,
    interceptPadding: 270,
    anchorPriority: 0.84,
    damagedTargetBias: 0.28,
    strafeStrength: 0.44,
    combatAdvanceBias: 0.2,
    allyAlertRadius: 1660,
  },
  ashari: {
    hullBonus: 1,
    accelerationMultiplier: 1.12,
    maxSpeedMultiplier: 1.08,
    detectRangeMultiplier: 0.95,
    fireRangeMultiplier: 0.92,
    preferredRangeMultiplier: 0.78,
    fireCooldownMultiplier: 0.86,
    bulletSpeedMultiplier: 1.04,
    formationSpacingMultiplier: 1.08,
    guardRadiusMultiplier: 1.08,
    patrolRadiusMin: 0.46,
    patrolRadiusMax: 0.8,
    interceptPadding: 360,
    anchorPriority: 0.66,
    damagedTargetBias: 0.18,
    strafeStrength: 0.34,
    combatAdvanceBias: 0.34,
    allyAlertRadius: 1540,
  },
  svarin: {
    hullBonus: -1,
    accelerationMultiplier: 1.12,
    maxSpeedMultiplier: 1.14,
    detectRangeMultiplier: 1.02,
    fireRangeMultiplier: 0.98,
    preferredRangeMultiplier: 0.9,
    fireCooldownMultiplier: 0.9,
    bulletSpeedMultiplier: 1.08,
    formationSpacingMultiplier: 1.18,
    guardRadiusMultiplier: 1.1,
    patrolRadiusMin: 0.44,
    patrolRadiusMax: 0.84,
    interceptPadding: 330,
    anchorPriority: 0.62,
    damagedTargetBias: 0.42,
    strafeStrength: 0.94,
    combatAdvanceBias: 0.12,
    allyAlertRadius: 1480,
  },
};

const HOMEGUARD_RACE_CONFIGS: Record<RaceId, SpaceFactionConfig> = Object.fromEntries(
  (Object.keys(HOMEGUARD_RACE_PROFILES) as RaceId[]).map((raceId) => {
    const profile = HOMEGUARD_RACE_PROFILES[raceId];
    return [
      raceId,
      {
        ...SPACE_FACTIONS.homeguard,
        maxHull: Math.max(4, SPACE_FACTIONS.homeguard.maxHull + profile.hullBonus),
        acceleration: SPACE_FACTIONS.homeguard.acceleration * profile.accelerationMultiplier,
        maxSpeed: SPACE_FACTIONS.homeguard.maxSpeed * profile.maxSpeedMultiplier,
        detectRange: SPACE_FACTIONS.homeguard.detectRange * profile.detectRangeMultiplier,
        fireRange: SPACE_FACTIONS.homeguard.fireRange * profile.fireRangeMultiplier,
        preferredRange: SPACE_FACTIONS.homeguard.preferredRange * profile.preferredRangeMultiplier,
        fireCooldown: SPACE_FACTIONS.homeguard.fireCooldown * profile.fireCooldownMultiplier,
        bulletSpeed: SPACE_FACTIONS.homeguard.bulletSpeed * profile.bulletSpeedMultiplier,
      } satisfies SpaceFactionConfig,
    ] as const;
  }),
) as Record<RaceId, SpaceFactionConfig>;

export function getSpaceRaceDefenseProfile(raceId: RaceId | null | undefined): SpaceRaceDefenseProfile {
  if (!raceId) {
    return DEFAULT_HOMEGUARD_RACE_PROFILE;
  }
  return HOMEGUARD_RACE_PROFILES[raceId] ?? DEFAULT_HOMEGUARD_RACE_PROFILE;
}

export function getSpaceFactionConfig(
  factionId: SpaceFactionId,
  raceId: RaceId | null | undefined = null,
): SpaceFactionConfig {
  if ((factionId === "homeguard" || factionId === "empire" || factionId === "republic") && raceId) {
    const profile = getSpaceRaceDefenseProfile(raceId);
    const baseFaction = factionId === "homeguard"
      ? HOMEGUARD_RACE_CONFIGS[raceId] ?? SPACE_FACTIONS.homeguard
      : SPACE_FACTIONS[factionId];
    return {
      ...baseFaction,
      maxHull: Math.max(4, baseFaction.maxHull + profile.hullBonus),
      acceleration: baseFaction.acceleration * profile.accelerationMultiplier,
      maxSpeed: baseFaction.maxSpeed * profile.maxSpeedMultiplier,
      detectRange: baseFaction.detectRange * profile.detectRangeMultiplier,
      fireRange: baseFaction.fireRange * profile.fireRangeMultiplier,
      preferredRange: baseFaction.preferredRange * profile.preferredRangeMultiplier,
      fireCooldown: baseFaction.fireCooldown * profile.fireCooldownMultiplier,
      bulletSpeed: baseFaction.bulletSpeed * profile.bulletSpeedMultiplier,
    };
  }
  return SPACE_FACTIONS[factionId];
}

export function getSpaceShipRoleCombatProfile(
  role: FactionForceShipRole | null | undefined,
): SpaceShipRoleCombatProfile {
  if (!role) {
    return DEFAULT_SHIP_ROLE_COMBAT_PROFILE;
  }
  return HOMEGUARD_SHIP_ROLE_PROFILES[role] ?? DEFAULT_SHIP_ROLE_COMBAT_PROFILE;
}

export const SHIP_HYPERDRIVE_CONFIG: ShipHyperdriveConfig = {
  chargeDurationMs: 3000,
  countdownIntervalMs: 1000,
  cooldownDurationMs: 30000,
  speedMultiplier: 7,
  exitBlendDurationMs: 650,
  exitDrag: 6.4,
  postDropSpeedMultiplier: 0.44,
  proximitySafetyPadding: 620,
  waypointAutoDropPadding: 980,
};

export const SHIP_RADAR_CONFIG: ShipRadarConfig = {
  range: 1880,
  width: 304,
  height: 88,
  sweepSpeedDegPerSec: 84,
  sweepWidthDeg: 14,
  memoryFadeMs: 1400,
  memoryClearMs: 2400,
};

export const SPACE_SECTORS: SpaceSectorConfig[] = GALAXY_SECTORS.map((sector) => ({
  id: sector.id,
  ships: SPACE_SECTOR_SHIPS[sector.id] ?? {},
}));

export function createShipHyperdriveSystemState(): ShipHyperdriveSystemState {
  return {
    state: "normal",
    chargeElapsedMs: 0,
    cooldownRemainingMs: 0,
    exitBlendRemainingMs: 0,
    lockedDirectionX: 0,
    lockedDirectionY: -1,
    lastDisengageReason: null,
  };
}

export function getShipHyperdriveTopSpeed(
  normalMaxSpeed: number,
  config: ShipHyperdriveConfig = SHIP_HYPERDRIVE_CONFIG,
): number {
  return Math.round(normalMaxSpeed * config.speedMultiplier);
}

export function isShipHyperdriveCombatLocked(state: SpaceHyperdriveState): boolean {
  return state === "charging" || state === "active";
}

export function isShipHyperdriveTurningLocked(state: SpaceHyperdriveState): boolean {
  return state === "active";
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + ((max - min) * this.next());
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

function hashStringToSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + ((max - min) * random());
}

function wrapAngleDegrees(angleDeg: number): number {
  let wrapped = angleDeg % 360;
  if (wrapped < 0) {
    wrapped += 360;
  }
  return wrapped;
}

function expandWrappedArc(startAngleDeg: number, endAngleDeg: number): { start: number; end: number } {
  const start = wrapAngleDegrees(startAngleDeg);
  let end = wrapAngleDegrees(endAngleDeg);
  if (end <= start) {
    end += 360;
  }
  return { start, end };
}

function getGalaxySectorSpawnBounds(
  sector: GalaxySectorConfig,
  config: SpaceWorldConfig,
): { minRadius: number; maxRadius: number } {
  const minRadius = Math.min(
    sector.outerRadius - config.sectorOuterPadding - 240,
    sector.innerRadius + config.sectorInnerPadding,
  );
  const maxRadius = Math.max(
    minRadius + 240,
    sector.outerRadius - config.sectorOuterPadding,
  );
  return { minRadius, maxRadius };
}

function createCellKey(cellX: number, cellY: number): SpaceWorldCellKey {
  return `${cellX},${cellY}`;
}

function createFieldSeed(
  id: string,
  kind: SpaceFieldObjectKind,
  x: number,
  y: number,
  random: () => number,
  config: SpaceWorldConfig,
  options?: {
    baseVelocity?: { x: number; y: number };
    placementType?: SpaceFieldPlacementType;
    isLarge?: boolean;
  },
): SpaceFieldObjectSeed {
  const placementType = options?.placementType ?? "single";
  const isLarge = Boolean(options?.isLarge && kind === "asteroid");
  const radius = isLarge
    ? randomBetween(random, 76, 124)
    : kind === "asteroid"
      ? randomBetween(random, 28, placementType === "belt" ? 64 : 58)
      : randomBetween(random, 16, placementType === "belt" ? 34 : 30);
  const speed = kind === "asteroid"
    ? randomBetween(random, isLarge ? 4 : 10, isLarge ? 18 : 36)
    : randomBetween(random, 16, 48);
  const heading = randomBetween(random, 0, Math.PI * 2);
  const hp = isLarge
    ? Math.round(radius >= 110 ? 26 : radius >= 92 ? 22 : 18)
    : kind === "asteroid"
      ? Math.round(radius >= 52 ? 7 : radius >= 42 ? 6 : radius >= 34 ? 5 : 4)
      : Math.round(radius >= 24 ? 3 : 2);
  const baseVelocity = options?.baseVelocity;

  return {
    id,
    cellKey: getSpaceCellKeyAtPosition(x, y, config),
    kind,
    placementType,
    isLarge,
    x,
    y,
    baseRadius: radius,
    radius,
    hp,
    velocityX: baseVelocity
      ? baseVelocity.x + (Math.cos(heading) * speed * 0.18)
      : Math.cos(heading) * speed,
    velocityY: baseVelocity
      ? baseVelocity.y + (Math.sin(heading) * speed * 0.18)
      : Math.sin(heading) * speed,
    spin: randomBetween(random, -0.65, 0.65),
    rotation: randomBetween(random, 0, Math.PI * 2),
  };
}

function canPlaceFieldSeed(
  seeds: SpaceFieldObjectSeed[],
  x: number,
  y: number,
  radius: number,
  buffer: number,
): boolean {
  return seeds.every((seed) => {
    const minimumDistance = seed.radius + radius + buffer;
    const dx = seed.x - x;
    const dy = seed.y - y;
    return (dx * dx) + (dy * dy) >= minimumDistance * minimumDistance;
  });
}

function isPointNearGeneratedSystems(
  point: GalaxyPoint,
  safeRadius: number,
  galaxyDefinition: GalaxyDefinition | null | undefined,
): boolean {
  if (!galaxyDefinition || safeRadius <= 0) {
    return false;
  }

  const safeRadiusSq = safeRadius * safeRadius;
  return galaxyDefinition.systems.some((system) => {
    const dx = point.x - system.x;
    const dy = point.y - system.y;
    return (dx * dx) + (dy * dy) < safeRadiusSq;
  });
}

function isPointNearReservedStationArea(
  point: GalaxyPoint,
  safeRadius: number,
  galaxyDefinition: GalaxyDefinition | null | undefined,
): boolean {
  if (!galaxyDefinition || safeRadius <= 0) {
    return false;
  }

  const safeRadiusSq = safeRadius * safeRadius;
  return galaxyDefinition.stations.some((station) => {
    const dx = point.x - station.x;
    const dy = point.y - station.y;
    return (dx * dx) + (dy * dy) < safeRadiusSq;
  });
}

function isPointBlockedForFieldSeed(
  point: GalaxyPoint,
  radius: number,
  config: SpaceWorldConfig,
  galaxyDefinition: GalaxyDefinition | null | undefined,
  extraBuffer = 0,
): boolean {
  return isPointNearGeneratedSystems(
    point,
    config.asteroidSystemBuffer + radius + extraBuffer,
    galaxyDefinition,
  ) || isPointNearReservedStationArea(
    point,
    config.asteroidStationBuffer + radius + extraBuffer,
    galaxyDefinition,
  );
}

function canPlaceShipSeed(
  seeds: SpaceFactionShipSeed[],
  x: number,
  y: number,
  radius: number,
  buffer: number,
): boolean {
  return seeds.every((seed) => {
    const otherRadius = SPACE_FACTIONS[seed.factionId].radius
      * getSpaceShipRoleCombatProfile(seed.shipRole ?? null).radiusMultiplier;
    const minimumDistance = otherRadius + radius + buffer;
    const dx = seed.x - x;
    const dy = seed.y - y;
    return (dx * dx) + (dy * dy) >= minimumDistance * minimumDistance;
  });
}

function getFactionGroupSize(
  factionId: SpaceFactionId,
  remaining: number,
  random: () => number,
): number {
  if (factionId === "smuggler") {
    return 1;
  }

  if (factionId === "pirate") {
    if (remaining === 4) {
      return 2;
    }
    if (remaining <= 3) {
      return remaining;
    }
    return Math.min(remaining, random() > 0.42 ? 3 : 2);
  }

  if (remaining >= 10) {
    return 5;
  }
  if (remaining === 9 || remaining === 8 || remaining === 5) {
    return 5;
  }
  if (remaining === 7 || remaining === 4) {
    return 4;
  }
  if (remaining >= 3) {
    return 3;
  }
  return remaining;
}

function scaleFormationOffsets(
  offsets: Array<{ x: number; y: number }>,
  spacingMultiplier: number,
): Array<{ x: number; y: number }> {
  if (Math.abs(spacingMultiplier - 1) <= 0.001) {
    return offsets;
  }
  return offsets.map((offset) => ({
    x: offset.x * spacingMultiplier,
    y: offset.y * spacingMultiplier,
  }));
}

function createFormationOffsets(
  factionId: SpaceFactionId,
  groupSize: number,
  raceId: RaceId | null = null,
): Array<{ x: number; y: number }> {
  if (groupSize <= 1) {
    return [{ x: 0, y: 0 }];
  }

  if (factionId === "pirate") {
    if (groupSize === 2) {
      return [
        { x: 0, y: 0 },
        { x: -72, y: 70 },
      ];
    }

    return [
      { x: 0, y: 0 },
      { x: -72, y: 68 },
      { x: 72, y: 84 },
    ];
  }

  if (factionId === "homeguard") {
    const baseOffsets = [
      { x: 0, y: 0 },
      { x: -64, y: 72 },
      { x: 64, y: 72 },
      { x: 0, y: 152 },
    ].slice(0, groupSize);
    return scaleFormationOffsets(baseOffsets, getSpaceRaceDefenseProfile(raceId).formationSpacingMultiplier);
  }

  const offsets: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  const wingSpacing = 88;
  const trailSpacing = 92;
  let rank = 1;

  while (offsets.length < groupSize) {
    offsets.push({ x: -wingSpacing * rank, y: trailSpacing * rank });
    if (offsets.length >= groupSize) {
      break;
    }
    offsets.push({ x: wingSpacing * rank, y: trailSpacing * rank });
    rank += 1;
  }

  if (groupSize === 4) {
    offsets[3] = { x: 0, y: trailSpacing * 2.1 };
  }

  return offsets;
}

function rotateFormationOffset(
  anchor: GalaxyPoint,
  headingRad: number,
  offsetX: number,
  offsetY: number,
): GalaxyPoint {
  const forwardX = Math.cos(headingRad);
  const forwardY = Math.sin(headingRad);
  const rightX = -forwardY;
  const rightY = forwardX;
  return {
    x: anchor.x + (rightX * offsetX) - (forwardX * offsetY),
    y: anchor.y + (rightY * offsetX) - (forwardY * offsetY),
  };
}

function isPointInSectorBounds(
  point: GalaxyPoint,
  sector: GalaxySectorConfig,
  config: SpaceWorldConfig,
): boolean {
  if (point.x < 220 || point.x > config.width - 220 || point.y < 220 || point.y > config.height - 220) {
    return false;
  }

  const matchingSector = getGalaxySectorAtPosition(point.x, point.y);
  return matchingSector.id === sector.id;
}

function canPlaceFormation(
  seeds: SpaceFactionShipSeed[],
  points: GalaxyPoint[],
  sector: GalaxySectorConfig,
  config: SpaceWorldConfig,
  radius: number,
  galaxyDefinition?: GalaxyDefinition | null,
): boolean {
  return points.every((point) => (
    isPointInSectorBounds(point, sector, config)
    && !isPointNearAnySpawn(point, config.shipSpawnSafeRadius, galaxyDefinition)
    && canPlaceShipSeed(seeds, point.x, point.y, radius, 150)
  ));
}

function canPlaceGuardFormation(
  seeds: SpaceFactionShipSeed[],
  points: GalaxyPoint[],
  sector: GalaxySectorConfig,
  config: SpaceWorldConfig,
  radius: number,
): boolean {
  return points.every((point) => (
    isPointInSectorBounds(point, sector, config)
    && canPlaceShipSeed(seeds, point.x, point.y, radius, 120)
  ));
}

function pickKind(random: () => number): SpaceFieldObjectKind {
  return random() > 0.32 ? "asteroid" : "debris";
}

function pickClusterKind(random: () => number): SpaceFieldObjectKind {
  return random() > 0.16 ? "asteroid" : "debris";
}

function pickPointInGalaxySector(
  sector: GalaxySectorConfig,
  config: SpaceWorldConfig,
  random: () => number,
): GalaxyPoint {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const { minRadius, maxRadius } = getGalaxySectorSpawnBounds(sector, config);
  const angleDeg = randomBetween(random, start, end);
  const radialT = Math.pow(random(), 0.82);
  const radius = minRadius + ((maxRadius - minRadius) * radialT);
  return pointFromDegrees(angleDeg, radius);
}

function pickPointInGalaxyBody(
  config: SpaceWorldConfig,
  random: () => number,
): GalaxyPoint {
  const sector = GALAXY_SECTORS[Math.floor(random() * GALAXY_SECTORS.length)] ?? GALAXY_SECTORS[0];
  return pickPointInGalaxySector(sector, config, random);
}

function pickPointInDeepSpace(
  config: SpaceWorldConfig,
  random: () => number,
): GalaxyPoint {
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const point = {
      x: randomBetween(random, 220, config.width - 220),
      y: randomBetween(random, 220, config.height - 220),
    };
    const dx = point.x - GALAXY_WORLD_CONFIG.center.x;
    const dy = (point.y - GALAXY_WORLD_CONFIG.center.y) / GALAXY_WORLD_CONFIG.verticalScale;
    const radialDistance = Math.sqrt((dx * dx) + (dy * dy));
    if (radialDistance >= GALAXY_WORLD_CONFIG.radius + config.deepSpaceMargin) {
      return point;
    }
  }

  return {
    x: config.width - 280,
    y: config.height - 280,
  };
}

function createSpawnClusterSeed(
  clusterId: string,
  origin: GalaxyPoint,
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
  galaxyDefinition: GalaxyDefinition | null | undefined,
): SpaceFieldObjectSeed | null {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = randomBetween(random, 0, Math.PI * 2);
    const distance = randomBetween(random, config.nearbySafeRadius, config.nearbyFieldRadius);
    const kind = pickKind(random);
    const x = origin.x + (Math.cos(angle) * distance);
    const y = origin.y + (Math.sin(angle) * distance);
    const candidate = createFieldSeed(clusterId, kind, x, y, random, config, {
      placementType: "cluster",
    });
    if (
      x >= 220
      && x <= config.width - 220
      && y >= 220
      && y <= config.height - 220
      && !isPointBlockedForFieldSeed({ x, y }, candidate.radius, config, galaxyDefinition)
      && canPlaceFieldSeed(seeds, x, y, candidate.radius, 18)
    ) {
      return candidate;
    }
  }

  return null;
}

function createClusterDrift(random: () => number, deepSpaceOnly = false): { x: number; y: number } {
  const speed = deepSpaceOnly
    ? randomBetween(random, 4, 14)
    : randomBetween(random, 6, 20);
  const heading = randomBetween(random, 0, Math.PI * 2);
  return {
    x: Math.cos(heading) * speed,
    y: Math.sin(heading) * speed,
  };
}

function createFieldClusterSeeds(
  center: GalaxyPoint,
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
  createId: () => string,
  galaxyDefinition: GalaxyDefinition | null | undefined,
  options?: {
    deepSpaceOnly?: boolean;
    minCount?: number;
    maxCount?: number;
    radius?: number;
    placementType?: SpaceFieldPlacementType;
    allowLargeAsteroids?: boolean;
  },
): SpaceFieldObjectSeed[] {
  const created: SpaceFieldObjectSeed[] = [];
  const minCount = options?.minCount ?? config.clusterMinSize;
  const maxCount = options?.maxCount ?? config.clusterMaxSize;
  const clusterRadius = options?.radius ?? randomBetween(random, 260, 720);
  const baseVelocity = createClusterDrift(random, options?.deepSpaceOnly ?? false);
  const placementType = options?.placementType ?? "cluster";
  const targetCount = Math.max(minCount, Math.round(randomBetween(random, minCount, maxCount + 0.999)));

  for (let memberIndex = 0; memberIndex < targetCount; memberIndex += 1) {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const angle = randomBetween(random, 0, Math.PI * 2);
      const distance = Math.pow(random(), 0.72) * clusterRadius;
      const x = center.x + (Math.cos(angle) * distance);
      const y = center.y + (Math.sin(angle) * distance);
      const kind = pickClusterKind(random);
      const candidate = createFieldSeed(createId(), kind, x, y, random, config, {
        baseVelocity,
        placementType,
        isLarge: Boolean(options?.allowLargeAsteroids && kind === "asteroid" && random() > 0.84),
      });
      if (
        x >= 220
        && x <= config.width - 220
        && y >= 220
        && y <= config.height - 220
        && !isPointBlockedForFieldSeed({ x, y }, candidate.radius, config, galaxyDefinition)
        && canPlaceFieldSeed([...seeds, ...created], x, y, candidate.radius, 12)
      ) {
        created.push(candidate);
        break;
      }
    }
  }

  return created;
}

function createFieldBeltSeeds(
  center: GalaxyPoint,
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
  createId: () => string,
  galaxyDefinition: GalaxyDefinition | null | undefined,
  options?: {
    deepSpaceOnly?: boolean;
  },
): SpaceFieldObjectSeed[] {
  const created: SpaceFieldObjectSeed[] = [];
  const heading = randomBetween(random, 0, Math.PI * 2);
  const beltRadiusX = randomBetween(random, 980, 1760);
  const beltRadiusY = beltRadiusX * randomBetween(random, 0.24, 0.42);
  const baseVelocity = createClusterDrift(random, options?.deepSpaceOnly ?? false);
  const targetCount = Math.round(randomBetween(random, config.beltMinSize, config.beltMaxSize + 0.999));
  if (isPointBlockedForFieldSeed(center, beltRadiusX, config, galaxyDefinition, 120)) {
    return created;
  }

  for (let memberIndex = 0; memberIndex < targetCount; memberIndex += 1) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const angle = randomBetween(random, 0, Math.PI * 2);
      const ringBias = 0.62 + (Math.pow(random(), 0.34) * 0.38);
      const localX = Math.cos(angle) * beltRadiusX * ringBias;
      const localY = Math.sin(angle) * beltRadiusY * randomBetween(random, 0.72, 1.08);
      const rotatedX = (localX * Math.cos(heading)) - (localY * Math.sin(heading));
      const rotatedY = (localX * Math.sin(heading)) + (localY * Math.cos(heading));
      const x = center.x + rotatedX;
      const y = center.y + rotatedY;
      const kind = random() > 0.22 ? "asteroid" : "debris";
      const candidate = createFieldSeed(createId(), kind, x, y, random, config, {
        baseVelocity,
        placementType: "belt",
        isLarge: kind === "asteroid" && random() > 0.82,
      });
      if (
        x >= 220
        && x <= config.width - 220
        && y >= 220
        && y <= config.height - 220
        && !isPointBlockedForFieldSeed({ x, y }, candidate.radius, config, galaxyDefinition)
        && canPlaceFieldSeed([...seeds, ...created], x, y, candidate.radius, candidate.isLarge ? 16 : 8)
      ) {
        created.push(candidate);
        break;
      }
    }
  }

  return created;
}

function pickSpawnClusterCenter(
  origin: GalaxyPoint,
  config: SpaceWorldConfig,
  random: () => number,
): GalaxyPoint {
  const angle = randomBetween(random, 0, Math.PI * 2);
  const distance = randomBetween(random, config.nearbySafeRadius + 140, config.nearbyFieldRadius - 120);
  return {
    x: origin.x + (Math.cos(angle) * distance),
    y: origin.y + (Math.sin(angle) * distance),
  };
}

function createDistantSeed(
  id: string,
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
  galaxyDefinition: GalaxyDefinition | null | undefined,
  deepSpaceOnly = false,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const point = deepSpaceOnly
      ? pickPointInDeepSpace(config, random)
      : random() < 0.76
        ? pickPointInGalaxyBody(config, random)
        : pickPointInDeepSpace(config, random);
    const kind = pickKind(random);
    const candidate = createFieldSeed(id, kind, point.x, point.y, random, config, {
      placementType: "single",
    });
    if (
      !isPointBlockedForFieldSeed(point, candidate.radius, config, galaxyDefinition)
      && canPlaceFieldSeed(seeds, point.x, point.y, candidate.radius, 18)
    ) {
      return candidate;
    }
  }

  const fallback = deepSpaceOnly ? pickPointInDeepSpace(config, random) : pickPointInGalaxyBody(config, random);
  return createFieldSeed(id, "asteroid", fallback.x, fallback.y, random, config, {
    placementType: "single",
  });
}

function isPointNearAnySpawn(
  point: GalaxyPoint,
  safeRadius: number,
  galaxyDefinition?: GalaxyDefinition | null,
): boolean {
  const safeRadiusSq = safeRadius * safeRadius;
  return GALAXY_SECTORS.some((sector) => {
    const spawn = getGalaxySpawnPointForRace(sector.raceId, galaxyDefinition);
    const dx = point.x - spawn.x;
    const dy = point.y - spawn.y;
    return (dx * dx) + (dy * dy) < safeRadiusSq;
  });
}

function createSpaceFieldSeedsInternal(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  galaxyDefinition: GalaxyDefinition | null = null,
  fieldSeedSalt = 0,
): SpaceFieldObjectSeed[] {
  const rng = new SeededRandom((FIELD_WORLD_SEED ^ (galaxyDefinition?.seed ?? 0) ^ fieldSeedSalt) >>> 0);
  const seeds: SpaceFieldObjectSeed[] = [];
  let fieldIndex = 0;
  const createId = (): string => `field-${fieldIndex++}`;

  GALAXY_SECTORS.forEach((sector) => {
    const spawn = getGalaxySpawnPointForRace(sector.raceId, galaxyDefinition);
    for (let clusterIndex = 0; clusterIndex < config.nearbyObjectCount; clusterIndex += 1) {
      const center = pickSpawnClusterCenter(spawn, config, () => rng.next());
      const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId, galaxyDefinition, {
        minCount: config.clusterMinSize + 1,
        maxCount: config.clusterMaxSize + 1,
        radius: randomBetween(() => rng.next(), 240, 560),
        placementType: "cluster",
      });
      if (clusterSeeds.length > 0) {
        seeds.push(...clusterSeeds);
        continue;
      }

      const fallbackSeed = createSpawnClusterSeed(createId(), spawn, config, seeds, () => rng.next(), galaxyDefinition);
      if (fallbackSeed) {
        seeds.push(fallbackSeed);
      }
    }
  });

  for (let index = 0; index < config.galaxyObjectCount; index += 1) {
    const center = pickPointInGalaxyBody(config, () => rng.next());
    const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId, galaxyDefinition, {
      placementType: "cluster",
    });
    if (clusterSeeds.length > 0) {
      seeds.push(...clusterSeeds);
    }
  }

  for (let index = 0; index < config.deepSpaceObjectCount; index += 1) {
    const center = pickPointInDeepSpace(config, () => rng.next());
    const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId, galaxyDefinition, {
      deepSpaceOnly: true,
      minCount: config.clusterMinSize,
      maxCount: config.clusterMaxSize - 1,
      radius: randomBetween(() => rng.next(), 220, 480),
      placementType: "cluster",
    });
    if (clusterSeeds.length > 0) {
      seeds.push(...clusterSeeds);
    }
  }

  for (let index = 0; index < config.beltCount; index += 1) {
    const center = pickPointInGalaxyBody(config, () => rng.next());
    const beltSeeds = createFieldBeltSeeds(center, config, seeds, () => rng.next(), createId, galaxyDefinition);
    if (beltSeeds.length > 0) {
      seeds.push(...beltSeeds);
    }
  }

  for (let index = 0; index < config.deepSpaceBeltCount; index += 1) {
    const center = pickPointInDeepSpace(config, () => rng.next());
    const beltSeeds = createFieldBeltSeeds(center, config, seeds, () => rng.next(), createId, galaxyDefinition, {
      deepSpaceOnly: true,
    });
    if (beltSeeds.length > 0) {
      seeds.push(...beltSeeds);
    }
  }

  for (let index = 0; index < config.galaxyFloaterCount; index += 1) {
    seeds.push(createDistantSeed(createId(), config, seeds, () => rng.next(), galaxyDefinition, false));
  }

  for (let index = 0; index < config.deepSpaceFloaterCount; index += 1) {
    seeds.push(createDistantSeed(createId(), config, seeds, () => rng.next(), galaxyDefinition, true));
  }

  return seeds;
}

function getForcePatrolHeading(anchor: GalaxyPoint, patrolAnchor: GalaxyPoint, fallbackAngle: number): number {
  const headingDeltaX = patrolAnchor.x - anchor.x;
  const headingDeltaY = patrolAnchor.y - anchor.y;
  if (Math.abs(headingDeltaX) + Math.abs(headingDeltaY) <= 0.001) {
    return fallbackAngle + (Math.PI * 0.5);
  }
  return Math.atan2(headingDeltaY, headingDeltaX);
}

function createSeededGuardFormation(
  groupShips: FactionForceActiveShipRecord[],
  galaxyDefinition: GalaxyDefinition,
  warState: FactionWarState | null,
  config: SpaceWorldConfig,
  existingSeeds: SpaceFactionShipSeed[],
  groupSalt = 0,
): SpaceFactionShipSeed[] {
  if (groupShips.length <= 0) {
    return [];
  }

  const leader = groupShips[0];
  const assignmentZone = leader.assignmentZoneId
    ? getGalaxyZoneById(galaxyDefinition, leader.assignmentZoneId)
    : null;
  const anchorSystem = getGalaxySystemById(galaxyDefinition, assignmentZone?.systemId ?? leader.originSystemId);
  const targetSector = anchorSystem ? getGalaxySectorById(anchorSystem.sectorId) : null;
  const originSector = getGalaxySectorById(leader.sectorId) ?? targetSector;
  if (!anchorSystem || !targetSector || !originSector) {
    return [];
  }

  const rng = new SeededRandom((hashStringToSeed(`${leader.poolId}:${leader.shipId}`) ^ groupSalt) >>> 0);
  const raceProfile = getSpaceRaceDefenseProfile(leader.raceId);
  const factionId = warState
    ? getSpaceFactionIdForRace(warState, leader.raceId)
    : "homeguard";
  const formationOffsets = createFormationOffsets(factionId, groupShips.length, leader.raceId);
  const faction = getSpaceFactionConfig(factionId, leader.raceId);
  const largestMemberRadius = groupShips.reduce((largest, ship) => {
    const roleProfile = getSpaceShipRoleCombatProfile(ship.role);
    return Math.max(largest, faction.radius * roleProfile.radiusMultiplier);
  }, faction.radius);

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const orbitAngle = rng.range(0, Math.PI * 2);
    const baseOrbitRadius = leader.kind === "prime-world"
      ? 440 + (attempt * 18) + rng.range(0, 120)
      : 320 + (attempt * 16) + rng.range(0, 96);
    const orbitRadius = baseOrbitRadius * raceProfile.guardRadiusMultiplier;
    const anchor = {
      x: anchorSystem.x + (Math.cos(orbitAngle) * orbitRadius),
      y: anchorSystem.y + (Math.sin(orbitAngle) * orbitRadius),
    };
    const patrolAngle = orbitAngle + rng.range(0.86, 1.34);
    const patrolRadius = orbitRadius + (rng.range(80, 170) * raceProfile.formationSpacingMultiplier);
    const patrolAnchor = {
      x: anchorSystem.x + (Math.cos(patrolAngle) * patrolRadius),
      y: anchorSystem.y + (Math.sin(patrolAngle) * patrolRadius),
    };
    const heading = getForcePatrolHeading(anchor, patrolAnchor, orbitAngle);
    const formationPoints = formationOffsets.map((offset) => rotateFormationOffset(anchor, heading, offset.x, offset.y));
    if (!canPlaceGuardFormation(existingSeeds, formationPoints, targetSector, config, largestMemberRadius)) {
      continue;
    }

    return groupShips.map((ship, memberIndex) => {
      const offset = formationOffsets[memberIndex] ?? { x: 0, y: 0 };
      const point = formationPoints[memberIndex] ?? anchor;
      const patrolPoint = rotateFormationOffset(patrolAnchor, heading, offset.x, offset.y);
      const roleProfile = getSpaceShipRoleCombatProfile(ship.role);
      const speed = (14 + rng.range(0, faction.maxSpeed * 0.14)) * roleProfile.maxSpeedMultiplier * rng.range(0.92, 1.04);
      return {
        id: ship.shipId,
        cellKey: getSpaceCellKeyAtPosition(point.x, point.y, config),
        factionId,
        shipRole: ship.role,
        assignmentKind: ship.assignmentKind,
        assignmentZoneId: ship.assignmentZoneId,
        sectorId: anchorSystem.sectorId,
        groupId: `force-group:${leader.poolId}:${ship.assignmentKind}:${ship.assignmentZoneId ?? leader.originZoneId}`,
        leaderId: memberIndex === 0 ? null : leader.shipId,
        formationOffsetX: offset.x,
        formationOffsetY: offset.y,
        x: point.x,
        y: point.y,
        velocityX: Math.cos(heading) * speed,
        velocityY: Math.sin(heading) * speed,
        rotation: heading + Math.PI * 0.5,
        patrolX: patrolPoint.x,
        patrolY: patrolPoint.y,
        customColor: originSector.color,
        customTrimColor: originSector.borderColor,
        customGlowColor: originSector.borderColor,
        guardAnchorX: anchorSystem.x,
        guardAnchorY: anchorSystem.y,
        guardRadius: orbitRadius + (leader.kind === "prime-world" ? 260 : 190) + raceProfile.interceptPadding,
        originPoolId: ship.poolId,
        originPoolKind: ship.kind,
        originZoneId: ship.originZoneId,
        originSystemId: ship.originSystemId,
        originRaceId: ship.raceId,
      };
    });
  }

  const fallbackPoint = {
    x: anchorSystem.x + 360,
    y: anchorSystem.y,
  };
  return groupShips.map((ship, memberIndex) => {
    const offset = formationOffsets[memberIndex] ?? { x: 0, y: 0 };
    const point = {
      x: fallbackPoint.x + (memberIndex * 60),
      y: fallbackPoint.y + (memberIndex * 44),
    };
    return {
      id: ship.shipId,
      cellKey: getSpaceCellKeyAtPosition(point.x, point.y, config),
      factionId,
      shipRole: ship.role,
      assignmentKind: ship.assignmentKind,
      assignmentZoneId: ship.assignmentZoneId,
      sectorId: anchorSystem.sectorId,
      groupId: `force-group:${leader.poolId}:${ship.assignmentKind}:${ship.assignmentZoneId ?? leader.originZoneId}:fallback`,
      leaderId: memberIndex === 0 ? null : leader.shipId,
      formationOffsetX: offset.x,
      formationOffsetY: offset.y,
      x: point.x,
      y: point.y,
      velocityX: 0,
      velocityY: 0,
      rotation: Math.PI * 0.5,
      patrolX: point.x,
      patrolY: point.y,
      customColor: originSector.color,
      customTrimColor: originSector.borderColor,
      customGlowColor: originSector.borderColor,
      guardAnchorX: anchorSystem.x,
      guardAnchorY: anchorSystem.y,
      guardRadius: ((leader.kind === "prime-world" ? 560 : 420) * raceProfile.guardRadiusMultiplier) + raceProfile.interceptPadding,
      originPoolId: ship.poolId,
      originPoolKind: ship.kind,
      originZoneId: ship.originZoneId,
      originSystemId: ship.originSystemId,
      originRaceId: ship.raceId,
    };
  });
}

export function createSpaceForceShipSeeds(
  galaxyDefinition: GalaxyDefinition | null,
  forceState: FactionForceState | null,
  warState: FactionWarState | null,
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  groupSalt = 0,
): SpaceFactionShipSeed[] {
  if (!galaxyDefinition || !forceState) {
    return [];
  }

  const activeForceShips = getActiveFactionForceShips(forceState);
  const groupedShips = activeForceShips.reduce<Map<string, FactionForceActiveShipRecord[]>>((lookup, ship) => {
    const groupKey = `${ship.poolId}:${ship.assignmentKind}:${ship.assignmentZoneId ?? ship.originZoneId}`;
    const bucket = lookup.get(groupKey);
    if (bucket) {
      bucket.push(ship);
      return lookup;
    }
    lookup.set(groupKey, [ship]);
    return lookup;
  }, new Map());

  const seeds: SpaceFactionShipSeed[] = [];
  groupedShips.forEach((poolShips, poolId) => {
    const sortedShips = [...poolShips].sort((left, right) => {
      const priorityDelta = getSpaceShipRoleCombatProfile(left.role).leadPriority - getSpaceShipRoleCombatProfile(right.role).leadPriority;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return left.shipId.localeCompare(right.shipId);
    });
    for (let groupStart = 0; groupStart < sortedShips.length; groupStart += 4) {
      const groupShips = sortedShips.slice(groupStart, groupStart + 4);
      const groupSeeds = createSeededGuardFormation(groupShips, galaxyDefinition, warState, config, seeds, groupSalt ^ hashStringToSeed(`${poolId}:${groupStart}`));
      seeds.push(...groupSeeds);
    }
  });

  return seeds;
}

function createSpaceFactionShipSeedsInternal(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
  galaxyDefinition: GalaxyDefinition | null = null,
  forceState: FactionForceState | null = null,
  warState: FactionWarState | null = null,
): SpaceFactionShipSeed[] {
  const rng = new SeededRandom((SHIP_WORLD_SEED ^ (galaxyDefinition?.seed ?? 0)) >>> 0);
  const seeds: SpaceFactionShipSeed[] = [];
  let shipIndex = 0;
  let groupIndex = 0;

  sectors.forEach((sectorConfig) => {
    const galaxySector = getGalaxySectorById(sectorConfig.id);
    if (!galaxySector) {
      return;
    }

    const factionEntries = Object.entries(sectorConfig.ships) as Array<[SpaceFactionId, number | undefined]>;
    factionEntries.forEach(([factionId, count]) => {
      let remainingShips = count ?? 0;
      const faction = SPACE_FACTIONS[factionId];
      while (remainingShips > 0) {
        const groupSize = getFactionGroupSize(factionId, remainingShips, () => rng.next());
        const formationOffsets = createFormationOffsets(factionId, groupSize);
        let placedGroup = false;

        for (let attempt = 0; attempt < 72; attempt += 1) {
          const anchor = pickPointInGalaxySector(galaxySector, config, () => rng.next());
          const patrolAnchor = pickPointInGalaxySector(galaxySector, config, () => rng.next());
          const headingDeltaX = patrolAnchor.x - anchor.x;
          const headingDeltaY = patrolAnchor.y - anchor.y;
          const heading = Math.abs(headingDeltaX) + Math.abs(headingDeltaY) <= 0.001
            ? randomBetween(() => rng.next(), 0, Math.PI * 2)
            : Math.atan2(headingDeltaY, headingDeltaX);
          const formationPoints = formationOffsets.map((offset) => rotateFormationOffset(anchor, heading, offset.x, offset.y));
          if (!canPlaceFormation(seeds, formationPoints, galaxySector, config, faction.radius, galaxyDefinition)) {
            continue;
          }

          const groupId = `group-${groupIndex}`;
          const leaderShipId = `faction-${shipIndex}`;
          const baseSpeed = randomBetween(() => rng.next(), 18, faction.maxSpeed * 0.18);

          formationOffsets.forEach((offset, memberIndex) => {
            const point = formationPoints[memberIndex] ?? anchor;
            const patrolPoint = rotateFormationOffset(patrolAnchor, heading, offset.x, offset.y);
            const shipId = `faction-${shipIndex}`;
            const speed = baseSpeed * randomBetween(() => rng.next(), 0.92, 1.06);
            seeds.push({
              id: shipId,
              cellKey: getSpaceCellKeyAtPosition(point.x, point.y, config),
              factionId,
              sectorId: sectorConfig.id,
              groupId,
              leaderId: memberIndex === 0 ? null : leaderShipId,
              formationOffsetX: offset.x,
              formationOffsetY: offset.y,
              x: point.x,
              y: point.y,
              velocityX: Math.cos(heading) * speed,
              velocityY: Math.sin(heading) * speed,
              rotation: heading + Math.PI * 0.5,
              patrolX: patrolPoint.x,
              patrolY: patrolPoint.y,
              originPoolId: null,
              originPoolKind: null,
              originZoneId: null,
              originSystemId: null,
              originRaceId: null,
            });
            shipIndex += 1;
          });

          remainingShips -= groupSize;
          groupIndex += 1;
          placedGroup = true;
          break;
        }

        if (!placedGroup) {
          remainingShips -= 1;
        }
      }
    });
  });

  if (galaxyDefinition && forceState) {
    const forceSeeds = createSpaceForceShipSeeds(galaxyDefinition, forceState, warState, config);
    seeds.push(...forceSeeds);
  }

  return seeds;
}

function countFactionSeeds(seeds: SpaceFactionShipSeed[]): Record<SpaceFactionId, number> {
  return seeds.reduce<Record<SpaceFactionId, number>>((counts, seed) => {
    counts[seed.factionId] += 1;
    return counts;
  }, {
    empire: 0,
    pirate: 0,
    republic: 0,
    smuggler: 0,
    homeguard: 0,
  });
}

function groupSeedsByCell<T extends { cellKey: SpaceWorldCellKey }>(seeds: T[]): Record<SpaceWorldCellKey, T[]> {
  return seeds.reduce<Record<SpaceWorldCellKey, T[]>>((grouped, seed) => {
    if (!grouped[seed.cellKey]) {
      grouped[seed.cellKey] = [];
    }
    grouped[seed.cellKey].push(seed);
    return grouped;
  }, {} as Record<SpaceWorldCellKey, T[]>);
}

function indexSeedsById<T extends { id: string }>(seeds: T[]): Record<string, T> {
  return seeds.reduce<Record<string, T>>((indexed, seed) => {
    indexed[seed.id] = seed;
    return indexed;
  }, {});
}

export function isFactionHostileByDefault(attacker: SpaceFactionId, target: SpaceFactionId): boolean {
  if (attacker === target) {
    return false;
  }

  return SPACE_FACTIONS[attacker].hostiles.includes(target);
}

export function getSpaceSectorById(
  sectorId: string,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
): SpaceSectorConfig | null {
  return sectors.find((sector) => sector.id === sectorId) ?? null;
}

export function getSpaceSectorAtPosition(
  x: number,
  y: number,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
): SpaceSectorConfig | null {
  const galaxySector = getGalaxySectorAtPosition(x, y);
  return getSpaceSectorById(galaxySector.id, sectors);
}

export function getSpaceCellCoordinatesForPosition(
  x: number,
  y: number,
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
): { cellX: number; cellY: number } {
  return {
    cellX: Math.max(0, Math.floor(x / config.cellSize)),
    cellY: Math.max(0, Math.floor(y / config.cellSize)),
  };
}

export function getSpaceCellKeyAtPosition(
  x: number,
  y: number,
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
): SpaceWorldCellKey {
  const { cellX, cellY } = getSpaceCellCoordinatesForPosition(x, y, config);
  return createCellKey(cellX, cellY);
}

export function getSpaceCellKeysAroundPosition(
  x: number,
  y: number,
  radius: number,
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
): SpaceWorldCellKey[] {
  const { cellX, cellY } = getSpaceCellCoordinatesForPosition(x, y, config);
  const maxCellX = Math.ceil(config.width / config.cellSize) - 1;
  const maxCellY = Math.ceil(config.height / config.cellSize) - 1;
  const keys: SpaceWorldCellKey[] = [];

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const nextCellX = Math.min(maxCellX, Math.max(0, cellX + offsetX));
      const nextCellY = Math.min(maxCellY, Math.max(0, cellY + offsetY));
      const key = createCellKey(nextCellX, nextCellY);
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  return keys;
}

export function createSpacePatrolTarget(
  sectorId: string,
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  random: () => number = Math.random,
): GalaxyPoint {
  const galaxySector = getGalaxySectorById(sectorId) ?? getGalaxySectorAtPosition(config.spawn.x, config.spawn.y);
  return pickPointInGalaxySector(galaxySector, config, random);
}

export function createSpaceFieldSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  galaxyDefinition: GalaxyDefinition | null = null,
  fieldSeedSalt = 0,
): SpaceFieldObjectSeed[] {
  return createSpaceWorldDefinition(config, galaxyDefinition, fieldSeedSalt).fieldSeeds;
}

export function createSpaceFactionShipSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
  galaxyDefinition: GalaxyDefinition | null = null,
  forceState: FactionForceState | null = null,
  warState: FactionWarState | null = null,
): SpaceFactionShipSeed[] {
  if (config === SPACE_WORLD_CONFIG && sectors === SPACE_SECTORS && !galaxyDefinition && !forceState && !warState) {
    return createSpaceWorldDefinition(config).factionSeeds;
  }

  return createSpaceFactionShipSeedsInternal(config, sectors, galaxyDefinition, forceState, warState);
}

export function createSpaceWorldDefinition(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  galaxyDefinition: GalaxyDefinition | null = null,
  fieldSeedSalt = 0,
  forceState: FactionForceState | null = null,
  warState: FactionWarState | null = null,
): SpaceWorldDefinition {
  if (config === SPACE_WORLD_CONFIG && !galaxyDefinition && !forceState && !warState && fieldSeedSalt === 0 && cachedSpaceWorldDefinition) {
    return cachedSpaceWorldDefinition;
  }

  const fieldSeeds = createSpaceFieldSeedsInternal(config, galaxyDefinition, fieldSeedSalt);
  const factionSeeds = createSpaceFactionShipSeedsInternal(config, SPACE_SECTORS, galaxyDefinition, forceState, warState);
  const definition: SpaceWorldDefinition = {
    fieldSeeds,
    factionSeeds,
    fieldSeedIndex: indexSeedsById(fieldSeeds),
    factionSeedIndex: indexSeedsById(factionSeeds),
    fieldSeedsByCell: groupSeedsByCell(fieldSeeds),
    factionSeedsByCell: groupSeedsByCell(factionSeeds),
    factionCounts: countFactionSeeds(factionSeeds),
  };

  if (config === SPACE_WORLD_CONFIG && !galaxyDefinition && !forceState && !warState && fieldSeedSalt === 0) {
    cachedSpaceWorldDefinition = definition;
  }

  return definition;
}
