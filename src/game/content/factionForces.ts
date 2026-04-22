import { GALAXY_SECTORS, type GalaxyDefinition, type GalaxyZoneRecord } from "./galaxy";
import { type RaceId } from "./items";

export type FactionForcePoolKind = "zone" | "prime-world";

export type FactionForcePoolRecord = {
  id: string;
  kind: FactionForcePoolKind;
  raceId: RaceId;
  sectorId: string;
  originZoneId: string;
  originSystemId: string;
  activeShipIds: string[];
  nextShipSerial: number;
  spawnCooldownRemainingMs: number;
  desiredDefenseShips: number;
};

export type FactionForceState = {
  pools: FactionForcePoolRecord[];
};

export type FactionForceActiveShipRecord = {
  shipId: string;
  poolId: string;
  kind: FactionForcePoolKind;
  raceId: RaceId;
  sectorId: string;
  originZoneId: string;
  originSystemId: string;
};

export type FactionForcePoolDebugRecord = {
  id: string;
  kind: FactionForcePoolKind;
  raceId: RaceId;
  sectorId: string;
  originZoneId: string;
  originSystemId: string;
  activeShipCount: number;
  activeShipIds: string[];
  capacity: number;
  desiredDefenseShips: number;
  spawnCooldownRemainingMs: number;
  controlledZoneCount: number;
};

export type FactionForceDebugSnapshot = {
  zoneShipPoolCap: number;
  primeWorldBaseShipPoolCap: number;
  primeWorldZoneBonusPerControlledZone: number;
  primeWorldDefenseTarget: number;
  zoneDefenseTarget: number;
  totalPools: number;
  totalActiveShips: number;
  pools: FactionForcePoolDebugRecord[];
};

export const ZONE_SHIP_POOL_CAP = 5;
export const PRIME_WORLD_BASE_SHIP_POOL_CAP = 10;
export const PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE = 1;
export const PRIME_WORLD_DEFENSE_TARGET = 3;
export const ZONE_DEFENSE_TARGET = 0;
export const PRIME_WORLD_RESPAWN_COOLDOWN_MS = 18000;
export const ZONE_RESPAWN_COOLDOWN_MS = 24000;

function isRaceId(value: unknown): value is RaceId {
  return typeof value === "string" && GALAXY_SECTORS.some((sector) => sector.raceId === value);
}

function getFallbackRaceForZone(zone: GalaxyZoneRecord): RaceId {
  return GALAXY_SECTORS.find((sector) => sector.id === zone.coreSectorId)?.raceId
    ?? GALAXY_SECTORS.find((sector) => sector.id === zone.sectorId)?.raceId
    ?? GALAXY_SECTORS[0].raceId;
}

function getRaceForZoneController(zone: GalaxyZoneRecord): RaceId {
  return isRaceId(zone.currentControllerId) ? zone.currentControllerId : getFallbackRaceForZone(zone);
}

function createPrimeShipId(poolId: string, serial: number): string {
  return `${poolId}:ship:${serial}`;
}

function createZonePool(zone: GalaxyZoneRecord): FactionForcePoolRecord {
  return {
    id: `zone-pool:${zone.id}`,
    kind: "zone",
    raceId: getRaceForZoneController(zone),
    sectorId: zone.sectorId,
    originZoneId: zone.id,
    originSystemId: zone.systemId,
    activeShipIds: [],
    nextShipSerial: 1,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: ZONE_DEFENSE_TARGET,
  };
}

function createPrimeWorldPool(galaxy: GalaxyDefinition, raceId: RaceId): FactionForcePoolRecord | null {
  const homeworld = galaxy.homeworlds.find((candidate) => candidate.raceId === raceId);
  if (!homeworld) {
    return null;
  }

  const zone = galaxy.zones.find((candidate) => candidate.systemId === homeworld.systemId);
  if (!zone) {
    return null;
  }

  const poolId = `prime-pool:${raceId}`;
  const activeShipIds = Array.from({ length: PRIME_WORLD_DEFENSE_TARGET }, (_, index) => createPrimeShipId(poolId, index + 1));
  return {
    id: poolId,
    kind: "prime-world",
    raceId,
    sectorId: homeworld.sectorId,
    originZoneId: zone.id,
    originSystemId: homeworld.systemId,
    activeShipIds,
    nextShipSerial: activeShipIds.length + 1,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: PRIME_WORLD_DEFENSE_TARGET,
  };
}

function getUniqueShipIds(activeShipIds: unknown[], maxCount: number, usedIds: Set<string>): string[] {
  const sanitized: string[] = [];
  activeShipIds.forEach((candidate) => {
    if (sanitized.length >= maxCount || typeof candidate !== "string" || candidate.length <= 0 || usedIds.has(candidate)) {
      return;
    }
    usedIds.add(candidate);
    sanitized.push(candidate);
  });
  return sanitized;
}

function comparePoolPriority(left: FactionForcePoolRecord, right: FactionForcePoolRecord): number {
  if (left.kind !== right.kind) {
    return left.kind === "prime-world" ? -1 : 1;
  }

  const leftSectorIndex = GALAXY_SECTORS.findIndex((sector) => sector.id === left.sectorId);
  const rightSectorIndex = GALAXY_SECTORS.findIndex((sector) => sector.id === right.sectorId);
  if (leftSectorIndex !== rightSectorIndex) {
    return leftSectorIndex - rightSectorIndex;
  }

  return left.id.localeCompare(right.id);
}

export function getControlledZoneCountForRace(galaxy: GalaxyDefinition, raceId: RaceId): number {
  return galaxy.zones.reduce((count, zone) => count + (zone.currentControllerId === raceId ? 1 : 0), 0);
}

export function getFactionForcePoolCapacity(galaxy: GalaxyDefinition, pool: Pick<FactionForcePoolRecord, "kind" | "raceId">): number {
  if (pool.kind === "prime-world") {
    return PRIME_WORLD_BASE_SHIP_POOL_CAP + (getControlledZoneCountForRace(galaxy, pool.raceId) * PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE);
  }
  return ZONE_SHIP_POOL_CAP;
}

export function getFactionForceRespawnCooldownMs(kind: FactionForcePoolKind): number {
  return kind === "prime-world" ? PRIME_WORLD_RESPAWN_COOLDOWN_MS : ZONE_RESPAWN_COOLDOWN_MS;
}

export function createFactionForceState(galaxy: GalaxyDefinition): FactionForceState {
  const zonePools = galaxy.zones.map((zone) => createZonePool(zone));
  const primePools = galaxy.homeworlds
    .map((homeworld) => createPrimeWorldPool(galaxy, homeworld.raceId))
    .filter((pool): pool is FactionForcePoolRecord => pool !== null);

  return {
    pools: [...zonePools, ...primePools].sort(comparePoolPriority),
  };
}

export function normalizeFactionForceState(
  forceState: Partial<FactionForceState> | undefined,
  galaxy: GalaxyDefinition,
): FactionForceState {
  const fallback = createFactionForceState(galaxy);
  if (!forceState || !Array.isArray(forceState.pools)) {
    return fallback;
  }

  const sourcePools = new Map<string, Partial<FactionForcePoolRecord>>();
  forceState.pools.forEach((pool) => {
    if (pool && typeof pool.id === "string" && pool.id.length > 0) {
      sourcePools.set(pool.id, pool);
    }
  });

  const usedShipIds = new Set<string>();
  return {
    pools: fallback.pools.map((defaultPool) => {
      const sourcePool = sourcePools.get(defaultPool.id);
      const capacity = getFactionForcePoolCapacity(galaxy, defaultPool);
      const activeShipIds = getUniqueShipIds(Array.isArray(sourcePool?.activeShipIds) ? sourcePool.activeShipIds : defaultPool.activeShipIds, capacity, usedShipIds);
      return {
        ...defaultPool,
        activeShipIds,
        nextShipSerial: typeof sourcePool?.nextShipSerial === "number" && Number.isFinite(sourcePool.nextShipSerial)
          ? Math.max(activeShipIds.length + 1, Math.floor(sourcePool.nextShipSerial))
          : Math.max(activeShipIds.length + 1, defaultPool.nextShipSerial),
        spawnCooldownRemainingMs: typeof sourcePool?.spawnCooldownRemainingMs === "number" && Number.isFinite(sourcePool.spawnCooldownRemainingMs)
          ? Math.max(0, Math.round(sourcePool.spawnCooldownRemainingMs))
          : 0,
        desiredDefenseShips: typeof sourcePool?.desiredDefenseShips === "number" && Number.isFinite(sourcePool.desiredDefenseShips)
          ? Math.max(0, Math.round(sourcePool.desiredDefenseShips))
          : defaultPool.desiredDefenseShips,
      };
    }),
  };
}

export function advanceFactionForceProduction(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  deltaMs: number,
): { changed: boolean; spawnedShipIds: string[] } {
  const safeDeltaMs = Math.max(0, Math.round(deltaMs));
  if (safeDeltaMs <= 0) {
    return { changed: false, spawnedShipIds: [] };
  }

  let changed = false;
  const spawnedShipIds: string[] = [];
  forceState.pools.forEach((pool) => {
    if (pool.spawnCooldownRemainingMs <= 0) {
      return;
    }
    const nextCooldown = Math.max(0, pool.spawnCooldownRemainingMs - safeDeltaMs);
    if (nextCooldown !== pool.spawnCooldownRemainingMs) {
      pool.spawnCooldownRemainingMs = nextCooldown;
      changed = true;
    }
  });

  const orderedPools = [...forceState.pools].sort(comparePoolPriority);
  orderedPools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool);
    const desiredDefenseShips = Math.min(pool.desiredDefenseShips, capacity);
    if (desiredDefenseShips <= 0 || pool.activeShipIds.length >= desiredDefenseShips || pool.spawnCooldownRemainingMs > 0) {
      return;
    }

    const shipId = createPrimeShipId(pool.id, pool.nextShipSerial);
    pool.activeShipIds.push(shipId);
    pool.nextShipSerial += 1;
    pool.spawnCooldownRemainingMs = getFactionForceRespawnCooldownMs(pool.kind);
    spawnedShipIds.push(shipId);
    changed = true;
  });

  return { changed, spawnedShipIds };
}

export function markFactionForceShipDestroyed(
  forceState: FactionForceState,
  shipId: string,
): boolean {
  for (const pool of forceState.pools) {
    const shipIndex = pool.activeShipIds.indexOf(shipId);
    if (shipIndex < 0) {
      continue;
    }

    pool.activeShipIds.splice(shipIndex, 1);
    pool.spawnCooldownRemainingMs = Math.max(pool.spawnCooldownRemainingMs, getFactionForceRespawnCooldownMs(pool.kind));
    return true;
  }

  return false;
}

export function getActiveFactionForceShips(forceState: FactionForceState): FactionForceActiveShipRecord[] {
  return forceState.pools.flatMap((pool) => pool.activeShipIds.map((shipId) => ({
    shipId,
    poolId: pool.id,
    kind: pool.kind,
    raceId: pool.raceId,
    sectorId: pool.sectorId,
    originZoneId: pool.originZoneId,
    originSystemId: pool.originSystemId,
  })));
}

export function getFactionForceDebugSnapshot(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
): FactionForceDebugSnapshot {
  const pools = [...forceState.pools]
    .sort(comparePoolPriority)
    .map<FactionForcePoolDebugRecord>((pool) => ({
      id: pool.id,
      kind: pool.kind,
      raceId: pool.raceId,
      sectorId: pool.sectorId,
      originZoneId: pool.originZoneId,
      originSystemId: pool.originSystemId,
      activeShipCount: pool.activeShipIds.length,
      activeShipIds: [...pool.activeShipIds],
      capacity: getFactionForcePoolCapacity(galaxy, pool),
      desiredDefenseShips: pool.desiredDefenseShips,
      spawnCooldownRemainingMs: Math.round(pool.spawnCooldownRemainingMs),
      controlledZoneCount: getControlledZoneCountForRace(galaxy, pool.raceId),
    }));

  return {
    zoneShipPoolCap: ZONE_SHIP_POOL_CAP,
    primeWorldBaseShipPoolCap: PRIME_WORLD_BASE_SHIP_POOL_CAP,
    primeWorldZoneBonusPerControlledZone: PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE,
    primeWorldDefenseTarget: PRIME_WORLD_DEFENSE_TARGET,
    zoneDefenseTarget: ZONE_DEFENSE_TARGET,
    totalPools: pools.length,
    totalActiveShips: pools.reduce((count, pool) => count + pool.activeShipCount, 0),
    pools,
  };
}
