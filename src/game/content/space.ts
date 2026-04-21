import {
  GALAXY_SECTORS,
  GALAXY_WORLD_CONFIG,
  getGalaxySectorAtPosition,
  getGalaxySectorById,
  getGalaxySpawnPointForRace,
  pointFromDegrees,
  type GalaxyPoint,
  type GalaxySectorConfig,
} from "./galaxy";

export type SpaceFieldObjectKind = "asteroid" | "debris";
export type SpaceFactionId = "empire" | "pirate" | "republic" | "smuggler";
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
  galaxyFloaterCount: number;
  deepSpaceFloaterCount: number;
  shipSpawnSafeRadius: number;
  sectorInnerPadding: number;
  sectorOuterPadding: number;
  deepSpaceMargin: number;
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

export type SpaceFieldObjectSeed = {
  id: string;
  cellKey: SpaceWorldCellKey;
  kind: SpaceFieldObjectKind;
  x: number;
  y: number;
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
  "olydran-expanse": { republic: 12, empire: 10, pirate: 4, smuggler: 3 },
  "aaruian-reach": { republic: 12, empire: 9, pirate: 4, smuggler: 3 },
  "elsari-veil": { pirate: 14, empire: 5, smuggler: 3 },
  "nevari-bloom": { smuggler: 5, pirate: 7, republic: 5, empire: 4 },
  "rakkan-drift": { pirate: 11, empire: 8, smuggler: 2 },
  "svarin-span": { pirate: 10, empire: 8, smuggler: 2 },
  "ashari-crown": { empire: 16, pirate: 6, republic: 4, smuggler: 2 },
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
  galaxyObjectCount: 42,
  deepSpaceObjectCount: 10,
  clusterMinSize: 3,
  clusterMaxSize: 6,
  galaxyFloaterCount: 92,
  deepSpaceFloaterCount: 28,
  shipSpawnSafeRadius: 1200,
  sectorInnerPadding: 720,
  sectorOuterPadding: 940,
  deepSpaceMargin: 2400,
};

export const SPACE_FACTIONS: Record<SpaceFactionId, SpaceFactionConfig> = {
  empire: {
    id: "empire",
    label: "Empire",
    color: 0xa82e38,
    trimColor: 0xff9ca4,
    glowColor: 0xff6670,
    hostiles: ["republic", "pirate"],
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
    hostiles: ["empire", "republic", "smuggler"],
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
};

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
  range: 2600,
  width: 246,
  height: 66,
  sweepSpeedDegPerSec: 165,
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
  baseVelocity?: { x: number; y: number },
): SpaceFieldObjectSeed {
  const radius = kind === "asteroid"
    ? randomBetween(random, 28, 58)
    : randomBetween(random, 16, 30);
  const speed = kind === "asteroid"
    ? randomBetween(random, 10, 36)
    : randomBetween(random, 16, 48);
  const heading = randomBetween(random, 0, Math.PI * 2);
  const hp = kind === "asteroid"
    ? Math.round(radius >= 46 ? 6 : radius >= 36 ? 5 : 4)
    : Math.round(radius >= 24 ? 3 : 2);

  return {
    id,
    cellKey: getSpaceCellKeyAtPosition(x, y, config),
    kind,
    x,
    y,
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

function canPlaceShipSeed(
  seeds: SpaceFactionShipSeed[],
  x: number,
  y: number,
  radius: number,
  buffer: number,
): boolean {
  return seeds.every((seed) => {
    const otherRadius = SPACE_FACTIONS[seed.factionId].radius;
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

function createFormationOffsets(
  factionId: SpaceFactionId,
  groupSize: number,
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
): boolean {
  return points.every((point) => (
    isPointInSectorBounds(point, sector, config)
    && !isPointNearAnySpawn(point, config.shipSpawnSafeRadius)
    && canPlaceShipSeed(seeds, point.x, point.y, radius, 150)
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
): SpaceFieldObjectSeed | null {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = randomBetween(random, 0, Math.PI * 2);
    const distance = randomBetween(random, config.nearbySafeRadius, config.nearbyFieldRadius);
    const kind = pickKind(random);
    const x = origin.x + (Math.cos(angle) * distance);
    const y = origin.y + (Math.sin(angle) * distance);
    const candidate = createFieldSeed(clusterId, kind, x, y, random, config);
    if (
      x >= 220
      && x <= config.width - 220
      && y >= 220
      && y <= config.height - 220
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
  options?: {
    deepSpaceOnly?: boolean;
    minCount?: number;
    maxCount?: number;
    radius?: number;
  },
): SpaceFieldObjectSeed[] {
  const created: SpaceFieldObjectSeed[] = [];
  const minCount = options?.minCount ?? config.clusterMinSize;
  const maxCount = options?.maxCount ?? config.clusterMaxSize;
  const clusterRadius = options?.radius ?? randomBetween(random, 260, 720);
  const baseVelocity = createClusterDrift(random, options?.deepSpaceOnly ?? false);
  const targetCount = Math.max(minCount, Math.round(randomBetween(random, minCount, maxCount + 0.999)));

  for (let memberIndex = 0; memberIndex < targetCount; memberIndex += 1) {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const angle = randomBetween(random, 0, Math.PI * 2);
      const distance = Math.pow(random(), 0.72) * clusterRadius;
      const x = center.x + (Math.cos(angle) * distance);
      const y = center.y + (Math.sin(angle) * distance);
      const kind = pickClusterKind(random);
      const candidate = createFieldSeed(createId(), kind, x, y, random, config, baseVelocity);
      if (
        x >= 220
        && x <= config.width - 220
        && y >= 220
        && y <= config.height - 220
        && canPlaceFieldSeed([...seeds, ...created], x, y, candidate.radius, 12)
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
  deepSpaceOnly = false,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const point = deepSpaceOnly
      ? pickPointInDeepSpace(config, random)
      : random() < 0.76
        ? pickPointInGalaxyBody(config, random)
        : pickPointInDeepSpace(config, random);
    const kind = pickKind(random);
    const candidate = createFieldSeed(id, kind, point.x, point.y, random, config);
    if (canPlaceFieldSeed(seeds, point.x, point.y, candidate.radius, 18)) {
      return candidate;
    }
  }

  const fallback = deepSpaceOnly ? pickPointInDeepSpace(config, random) : pickPointInGalaxyBody(config, random);
  return createFieldSeed(id, "asteroid", fallback.x, fallback.y, random, config);
}

function isPointNearAnySpawn(point: GalaxyPoint, safeRadius: number): boolean {
  const safeRadiusSq = safeRadius * safeRadius;
  return GALAXY_SECTORS.some((sector) => {
    const spawn = getGalaxySpawnPointForRace(sector.raceId);
    const dx = point.x - spawn.x;
    const dy = point.y - spawn.y;
    return (dx * dx) + (dy * dy) < safeRadiusSq;
  });
}

function createSpaceFieldSeedsInternal(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
): SpaceFieldObjectSeed[] {
  const rng = new SeededRandom(FIELD_WORLD_SEED);
  const seeds: SpaceFieldObjectSeed[] = [];
  let fieldIndex = 0;
  const createId = (): string => `field-${fieldIndex++}`;

  GALAXY_SECTORS.forEach((sector) => {
    const spawn = getGalaxySpawnPointForRace(sector.raceId);
    for (let clusterIndex = 0; clusterIndex < config.nearbyObjectCount; clusterIndex += 1) {
      const center = pickSpawnClusterCenter(spawn, config, () => rng.next());
      const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId, {
        minCount: config.clusterMinSize + 1,
        maxCount: config.clusterMaxSize + 1,
        radius: randomBetween(() => rng.next(), 240, 560),
      });
      if (clusterSeeds.length > 0) {
        seeds.push(...clusterSeeds);
        continue;
      }

      const fallbackSeed = createSpawnClusterSeed(createId(), spawn, config, seeds, () => rng.next());
      if (fallbackSeed) {
        seeds.push(fallbackSeed);
      }
    }
  });

  for (let index = 0; index < config.galaxyObjectCount; index += 1) {
    const center = pickPointInGalaxyBody(config, () => rng.next());
    const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId);
    if (clusterSeeds.length > 0) {
      seeds.push(...clusterSeeds);
    }
  }

  for (let index = 0; index < config.deepSpaceObjectCount; index += 1) {
    const center = pickPointInDeepSpace(config, () => rng.next());
    const clusterSeeds = createFieldClusterSeeds(center, config, seeds, () => rng.next(), createId, {
      deepSpaceOnly: true,
      minCount: config.clusterMinSize,
      maxCount: config.clusterMaxSize - 1,
      radius: randomBetween(() => rng.next(), 220, 480),
    });
    if (clusterSeeds.length > 0) {
      seeds.push(...clusterSeeds);
    }
  }

  for (let index = 0; index < config.galaxyFloaterCount; index += 1) {
    seeds.push(createDistantSeed(createId(), config, seeds, () => rng.next(), false));
  }

  for (let index = 0; index < config.deepSpaceFloaterCount; index += 1) {
    seeds.push(createDistantSeed(createId(), config, seeds, () => rng.next(), true));
  }

  return seeds;
}

function createSpaceFactionShipSeedsInternal(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
): SpaceFactionShipSeed[] {
  const rng = new SeededRandom(SHIP_WORLD_SEED);
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
          if (!canPlaceFormation(seeds, formationPoints, galaxySector, config, faction.radius)) {
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
): SpaceFieldObjectSeed[] {
  return createSpaceWorldDefinition(config).fieldSeeds;
}

export function createSpaceFactionShipSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
): SpaceFactionShipSeed[] {
  if (config === SPACE_WORLD_CONFIG && sectors === SPACE_SECTORS) {
    return createSpaceWorldDefinition(config).factionSeeds;
  }

  return createSpaceFactionShipSeedsInternal(config, sectors);
}

export function createSpaceWorldDefinition(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
): SpaceWorldDefinition {
  if (config === SPACE_WORLD_CONFIG && cachedSpaceWorldDefinition) {
    return cachedSpaceWorldDefinition;
  }

  const fieldSeeds = createSpaceFieldSeedsInternal(config);
  const factionSeeds = createSpaceFactionShipSeedsInternal(config);
  const definition: SpaceWorldDefinition = {
    fieldSeeds,
    factionSeeds,
    fieldSeedIndex: indexSeedsById(fieldSeeds),
    factionSeedIndex: indexSeedsById(factionSeeds),
    fieldSeedsByCell: groupSeedsByCell(fieldSeeds),
    factionSeedsByCell: groupSeedsByCell(factionSeeds),
    factionCounts: countFactionSeeds(factionSeeds),
  };

  if (config === SPACE_WORLD_CONFIG) {
    cachedSpaceWorldDefinition = definition;
  }

  return definition;
}
