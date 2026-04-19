import { GALAXY_WORLD_CONFIG } from "./galaxy";

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
  distantObjectCount: number;
  shipSpawnSafeRadius: number;
  sectorShipPadding: number;
};

export type SpaceSectorBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpaceSectorConfig = {
  id: string;
  label: string;
  bounds: SpaceSectorBounds;
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

export const SPACE_WORLD_CONFIG: SpaceWorldConfig = {
  width: GALAXY_WORLD_CONFIG.width,
  height: GALAXY_WORLD_CONFIG.height,
  spawn: {
    x: GALAXY_WORLD_CONFIG.spawn.x,
    y: GALAXY_WORLD_CONFIG.spawn.y,
  },
  starCount: GALAXY_WORLD_CONFIG.starCount + GALAXY_WORLD_CONFIG.backgroundStarCount,
  nearbyFieldRadius: 1900,
  nearbySafeRadius: 320,
  nearbyObjectCount: 20,
  distantObjectCount: 64,
  shipSpawnSafeRadius: 460,
  sectorShipPadding: 180,
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

export const SPACE_SECTORS: SpaceSectorConfig[] = [
  {
    id: "empire-march",
    label: "Empire March",
    bounds: { x: 700, y: 700, width: 5400, height: 4700 },
    ships: { empire: 8, pirate: 1, smuggler: 1 },
  },
  {
    id: "pirate-verge-north",
    label: "Pirate Verge North",
    bounds: { x: 10100, y: 700, width: 5000, height: 4500 },
    ships: { pirate: 5, smuggler: 1 },
  },
  {
    id: "trade-drift-core",
    label: "Trade Drift Core",
    bounds: { x: 6900, y: 6900, width: 2200, height: 2200 },
    ships: { smuggler: 2, pirate: 1, empire: 1, republic: 1 },
  },
  {
    id: "trade-drift",
    label: "Trade Drift",
    bounds: { x: 5600, y: 5600, width: 4800, height: 4800 },
    ships: { smuggler: 2, pirate: 1 },
  },
  {
    id: "pirate-verge-south",
    label: "Pirate Verge South",
    bounds: { x: 900, y: 10700, width: 5000, height: 4300 },
    ships: { pirate: 5, smuggler: 1 },
  },
  {
    id: "republic-reach",
    label: "Republic Reach",
    bounds: { x: 9900, y: 10000, width: 5400, height: 4700 },
    ships: { republic: 8, pirate: 1, smuggler: 1 },
  },
];

function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
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

function pickPointInSector(
  bounds: SpaceSectorBounds,
  padding: number,
  random: () => number,
): { x: number; y: number } {
  return {
    x: randomBetween(random, bounds.x + padding, bounds.x + bounds.width - padding),
    y: randomBetween(random, bounds.y + padding, bounds.y + bounds.height - padding),
  };
}

function createNearbySeed(
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = randomBetween(random, 0, Math.PI * 2);
    const distance = randomBetween(random, config.nearbySafeRadius, config.nearbyFieldRadius);
    const kind = pickKind(random);
    const x = config.spawn.x + Math.cos(angle) * distance;
    const y = config.spawn.y + Math.sin(angle) * distance;
    const seed = createSeed(kind, x, y, random);
    if (canPlaceFieldSeed(seeds, x, y, seed.radius, 18)) {
      return seed;
    }
  }

  return createSeed("debris", config.spawn.x + config.nearbyFieldRadius, config.spawn.y, random);
}

function createDistantSeed(
  config: SpaceWorldConfig,
  seeds: SpaceFieldObjectSeed[],
  random: () => number,
): SpaceFieldObjectSeed {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const x = randomBetween(random, 220, config.width - 220);
    const y = randomBetween(random, 220, config.height - 220);
    const dx = x - config.spawn.x;
    const dy = y - config.spawn.y;
    if ((dx * dx) + (dy * dy) < config.nearbySafeRadius * config.nearbySafeRadius) {
      continue;
    }

    const kind = pickKind(random);
    const seed = createSeed(kind, x, y, random);
    if (canPlaceFieldSeed(seeds, x, y, seed.radius, 18)) {
      return seed;
    }
  }

  return createSeed(
    "asteroid",
    randomBetween(random, 220, config.width - 220),
    randomBetween(random, 220, config.height - 220),
    random,
  );
}

export function isFactionHostileByDefault(attacker: SpaceFactionId, target: SpaceFactionId): boolean {
  if (attacker === target) {
    return false;
  }

  return SPACE_FACTIONS[attacker].hostiles.includes(target);
}

export function getSpaceSectorAtPosition(
  x: number,
  y: number,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
): SpaceSectorConfig | null {
  const containing = sectors.find((sector) => (
    x >= sector.bounds.x
    && x <= sector.bounds.x + sector.bounds.width
    && y >= sector.bounds.y
    && y <= sector.bounds.y + sector.bounds.height
  ));
  if (containing) {
    return containing;
  }

  let nearest: SpaceSectorConfig | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  sectors.forEach((sector) => {
    const clampedX = Math.min(sector.bounds.x + sector.bounds.width, Math.max(sector.bounds.x, x));
    const clampedY = Math.min(sector.bounds.y + sector.bounds.height, Math.max(sector.bounds.y, y));
    const dx = x - clampedX;
    const dy = y - clampedY;
    const distanceSq = (dx * dx) + (dy * dy);
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = sector;
    }
  });

  return nearest;
}

export function createSpaceFieldSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  random: () => number = Math.random,
): SpaceFieldObjectSeed[] {
  const seeds: SpaceFieldObjectSeed[] = [];

  for (let index = 0; index < config.nearbyObjectCount; index += 1) {
    seeds.push(createNearbySeed(config, seeds, random));
  }

  for (let index = 0; index < config.distantObjectCount; index += 1) {
    seeds.push(createDistantSeed(config, seeds, random));
  }

  return seeds;
}

export function createSpaceFactionShipSeeds(
  config: SpaceWorldConfig = SPACE_WORLD_CONFIG,
  sectors: SpaceSectorConfig[] = SPACE_SECTORS,
  random: () => number = Math.random,
): SpaceFactionShipSeed[] {
  const seeds: SpaceFactionShipSeed[] = [];

  sectors.forEach((sector) => {
    const factionEntries = Object.entries(sector.ships) as Array<[SpaceFactionId, number | undefined]>;
    factionEntries.forEach(([factionId, count]) => {
      const shipCount = count ?? 0;
      const faction = SPACE_FACTIONS[factionId];
      for (let index = 0; index < shipCount; index += 1) {
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const point = pickPointInSector(sector.bounds, config.sectorShipPadding, random);
          const spawnDx = point.x - config.spawn.x;
          const spawnDy = point.y - config.spawn.y;
          if ((spawnDx * spawnDx) + (spawnDy * spawnDy) < config.shipSpawnSafeRadius * config.shipSpawnSafeRadius) {
            continue;
          }
          if (!canPlaceShipSeed(seeds, point.x, point.y, faction.radius, 150)) {
            continue;
          }

          const patrolPoint = pickPointInSector(sector.bounds, config.sectorShipPadding, random);
          const heading = randomBetween(random, 0, Math.PI * 2);
          const speed = randomBetween(random, 18, faction.maxSpeed * 0.24);
          seeds.push({
            factionId,
            sectorId: sector.id,
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

