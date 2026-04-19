import {
  GALAXY_SECTORS,
  GALAXY_WORLD_CONFIG,
  getGalaxySectorAtPosition,
  getGalaxySectorById,
  pointFromDegrees,
  type GalaxyPoint,
  type GalaxySectorConfig,
} from "./galaxy";

export type SpaceFieldObjectKind = "asteroid" | "debris";
export type SpaceFactionId = "empire" | "pirate" | "republic" | "smuggler";

export type SpaceWorldConfig = {
  width: number;
  height: number;
  spawn: {
    x: number;
    y: number;
  };
  starCount: number;
  nearbyFieldRadius: number;
  nearbySafeRadius: number;
  nearbyObjectCount: number;
  galaxyObjectCount: number;
  deepSpaceObjectCount: number;
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
  factionId: SpaceFactionId;
  sectorId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  patrolX: number;
  patrolY: number;
};

const SPACE_SECTOR_SHIPS: Record<string, Partial<Record<SpaceFactionId, number>>> = {
  "olydran-expanse": { republic: 5, smuggler: 2, pirate: 1 },
  "aaruian-reach": { republic: 6, empire: 1, smuggler: 1 },
  "elsari-veil": { pirate: 5, smuggler: 2 },
  "nevari-bloom": { smuggler: 4, pirate: 2, republic: 1 },
  "rakkan-drift": { pirate: 4, empire: 2, smuggler: 1 },
  "svarin-span": { pirate: 3, empire: 2, smuggler: 1 },
  "ashari-crown": { empire: 6, pirate: 2, smuggler: 1 },
};

export const SPACE_WORLD_CONFIG: SpaceWorldConfig = {
  width: GALAXY_WORLD_CONFIG.width,
  height: GALAXY_WORLD_CONFIG.height,
  spawn: {
    x: GALAXY_WORLD_CONFIG.spawn.x,
    y: GALAXY_WORLD_CONFIG.spawn.y,
  },
  starCount: GALAXY_WORLD_CONFIG.starCount + GALAXY_WORLD_CONFIG.backgroundStarCount,
  nearbyFieldRadius: 2400,
  nearbySafeRadius: 360,
  nearbyObjectCount: 24,
  galaxyObjectCount: 180,
  deepSpaceObjectCount: 64,
  shipSpawnSafeRadius: 560,
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

export const SPACE_SECTORS: SpaceSectorConfig[] = GALAXY_SECTORS.map((sector) => ({
  id: sector.id,
  ships: SPACE_SECTOR_SHIPS[sector.id] ?? {},
}));

function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
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

function createSeed(
  kind: SpaceFieldObjectKind,
  x: number,
  y: number,
  random: () => number,
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
    kind,
    x,
    y,
    radius,
    hp,
    velocityX: Math.cos(heading) * speed,
    velocityY: Math.sin(heading) * speed,
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
    const minDistance = seed.radius + radius + buffer;
    const dx = seed.x - x;
    const dy = seed.y - y;
    return (dx * dx) + (dy * dy) >= minDistance * minDistance;
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
    const minDistance = otherRadius + radius + buffer;
    const dx = seed.x - x;
    const dy = seed.y - y;
    return (dx * dx) + (dy * dy) >= minDistance * minDistance;
  });
}

function pickKind(random: () => number): SpaceFieldObjectKind {
  return random() > 0.32 ? "asteroid" : "debris";
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

function createNearbySeed(
  config: SpaceWorldConfig,
  spawnPosition: GalaxyPoint,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = randomBetween(random, 0, Math.PI * 2);
    const distance = randomBetween(random, config.nearbySafeRadius, config.nearbyFieldRadius);
    const kind = pickKind(random);
    const x = spawnPosition.x + Math.cos(angle) * distance;
    const y = spawnPosition.y + Math.sin(angle) * distance;
    const seed = createSeed(kind, x, y, random);
    if (
      x >= 220
      && x <= config.width - 220
      && y >= 220
      && y <= config.height - 220
      && canPlaceFieldSeed(seeds, x, y, seed.radius, 18)
    ) {
      return seed;
    }
  }

  return createSeed("debris", spawnPosition.x + config.nearbyFieldRadius, spawnPosition.y, random);
}

function createDistantSeed(
  config: SpaceWorldConfig,
  spawnPosition: GalaxyPoint,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const point = random() < 0.76
      ? pickPointInGalaxyBody(config, random)
      : pickPointInDeepSpace(config, random);
    const dx = point.x - spawnPosition.x;
    const dy = point.y - spawnPosition.y;
    if ((dx * dx) + (dy * dy) < config.nearbySafeRadius * config.nearbySafeRadius) {
      continue;
    }

    const kind = pickKind(random);
    const seed = createSeed(kind, point.x, point.y, random);
    if (canPlaceFieldSeed(seeds, point.x, point.y, seed.radius, 18)) {
      return seed;
    }
  }

  const fallback = pickPointInGalaxyBody(config, random);
  return createSeed("asteroid", fallback.x, fallback.y, random);
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
  spawnPosition: GalaxyPoint = config.spawn,
  random: () => number = Math.random,
): SpaceFieldObjectSeed[] {
  const seeds: SpaceFieldObjectSeed[] = [];

  for (let index = 0; index < config.nearbyObjectCount; index += 1) {
    seeds.push(createNearbySeed(config, spawnPosition, seeds, random));
  }

  for (let index = 0; index < config.galaxyObjectCount + config.deepSpaceObjectCount; index += 1) {
    seeds.push(createDistantSeed(config, spawnPosition, seeds, random));
  }

  return seeds;
}

export function createSpaceFactionShipSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
  spawnPosition: GalaxyPoint = config.spawn,
  random: () => number = Math.random,
): SpaceFactionShipSeed[] {
  const seeds: SpaceFactionShipSeed[] = [];

  sectors.forEach((sectorConfig) => {
    const galaxySector = getGalaxySectorById(sectorConfig.id);
    if (!galaxySector) {
      return;
    }

    const factionEntries = Object.entries(sectorConfig.ships) as Array<[SpaceFactionId, number | undefined]>;
    factionEntries.forEach(([factionId, count]) => {
      const shipCount = count ?? 0;
      const faction = SPACE_FACTIONS[factionId];
      for (let index = 0; index < shipCount; index += 1) {
        for (let attempt = 0; attempt < 56; attempt += 1) {
          const point = pickPointInGalaxySector(galaxySector, config, random);
          const spawnDx = point.x - spawnPosition.x;
          const spawnDy = point.y - spawnPosition.y;
          if ((spawnDx * spawnDx) + (spawnDy * spawnDy) < config.shipSpawnSafeRadius * config.shipSpawnSafeRadius) {
            continue;
          }
          if (!canPlaceShipSeed(seeds, point.x, point.y, faction.radius, 150)) {
            continue;
          }

          const patrolPoint = pickPointInGalaxySector(galaxySector, config, random);
          const heading = randomBetween(random, 0, Math.PI * 2);
          const speed = randomBetween(random, 18, faction.maxSpeed * 0.24);
          seeds.push({
            factionId,
            sectorId: sectorConfig.id,
            x: point.x,
            y: point.y,
            velocityX: Math.cos(heading) * speed,
            velocityY: Math.sin(heading) * speed,
            rotation: heading + Math.PI * 0.5,
            patrolX: patrolPoint.x,
            patrolY: patrolPoint.y,
          });
          break;
        }
      }
    });
  });

  return seeds;
}
