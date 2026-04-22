import { GALAXY_SECTORS, type GalaxyDefinition, type GalaxyZoneRecord } from "./galaxy";
import { type RaceId } from "./items";

export type FactionForcePoolKind = "zone" | "prime-world";
export type FactionForceShipRole = "base-fighter" | "support-fighter" | "attack-warship" | "defense-warship";
export type FactionForceAssignmentKind = "defend" | "invade" | "reclaim";

export type FactionForceActiveShipState = {
  id: string;
  role: FactionForceShipRole;
  assignmentKind: FactionForceAssignmentKind;
  assignmentZoneId: string | null;
};

export type FactionForcePoolRecord = {
  id: string;
  kind: FactionForcePoolKind;
  raceId: RaceId;
  sectorId: string;
  originZoneId: string;
  originSystemId: string;
  activeShips: FactionForceActiveShipState[];
  nextShipSerial: number;
  spawnCooldownRemainingMs: number;
  desiredDefenseShips: number;
  desiredReserveShips: number;
};

export type FactionForceState = {
  pools: FactionForcePoolRecord[];
};

export type FactionForceActiveShipRecord = {
  shipId: string;
  role: FactionForceShipRole;
  assignmentKind: FactionForceAssignmentKind;
  assignmentZoneId: string | null;
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
  activeShips: FactionForceActiveShipState[];
  capacity: number;
  desiredDefenseShips: number;
  desiredReserveShips: number;
  spawnCooldownRemainingMs: number;
  controlledZoneCount: number;
};

export type FactionForceDebugSnapshot = {
  zoneShipPoolCap: number;
  primeWorldBaseShipPoolCap: number;
  primeWorldZoneBonusPerControlledZone: number;
  primeWorldDefenseTarget: number;
  zoneDefenseTarget: number;
  respawnCooldownsMs: {
    zone: Record<FactionForceShipRole, number>;
    primeWorld: Record<FactionForceShipRole, number>;
  };
  totalPools: number;
  totalActiveShips: number;
  pools: FactionForcePoolDebugRecord[];
};

export const ZONE_SHIP_POOL_CAP = 5;
export const PRIME_WORLD_BASE_SHIP_POOL_CAP = 10;
export const PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE = 1;
export const PRIME_WORLD_DEFENSE_TARGET = 3;
export const ZONE_DEFENSE_TARGET = 3;

const BASE_RESPAWN_COOLDOWNS_MS: Record<FactionForceShipRole, number> = {
  "base-fighter": 14000,
  "support-fighter": 18000,
  "attack-warship": 27000,
  "defense-warship": 24000,
};

const PRIME_WORLD_PRODUCTION_MULTIPLIER = 0.72;

const PRIME_WORLD_DEFENSE_ROSTER: readonly FactionForceShipRole[] = [
  "attack-warship",
  "support-fighter",
  "defense-warship",
  "base-fighter",
];

const ZONE_DEFENSE_ROSTER: readonly FactionForceShipRole[] = [
  "base-fighter",
  "defense-warship",
  "support-fighter",
  "attack-warship",
  "base-fighter",
];

const PRIME_WORLD_RESERVE_ROSTER: readonly FactionForceShipRole[] = [
  "attack-warship",
  "base-fighter",
  "support-fighter",
  "attack-warship",
  "defense-warship",
  "base-fighter",
];

const ZONE_RESERVE_ROSTER: readonly FactionForceShipRole[] = [
  "base-fighter",
  "support-fighter",
  "defense-warship",
];

function isRaceId(value: unknown): value is RaceId {
  return typeof value === "string" && GALAXY_SECTORS.some((sector) => sector.raceId === value);
}

function isFactionForceShipRole(value: unknown): value is FactionForceShipRole {
  return value === "base-fighter"
    || value === "support-fighter"
    || value === "attack-warship"
    || value === "defense-warship";
}

function isFactionForceAssignmentKind(value: unknown): value is FactionForceAssignmentKind {
  return value === "defend"
    || value === "invade"
    || value === "reclaim";
}

function getFallbackRaceForZone(zone: GalaxyZoneRecord): RaceId {
  return GALAXY_SECTORS.find((sector) => sector.id === zone.coreSectorId)?.raceId
    ?? GALAXY_SECTORS.find((sector) => sector.id === zone.sectorId)?.raceId
    ?? GALAXY_SECTORS[0].raceId;
}

function getRaceForZoneController(zone: GalaxyZoneRecord): RaceId {
  return isRaceId(zone.currentControllerId) ? zone.currentControllerId : getFallbackRaceForZone(zone);
}

function createShipId(poolId: string, serial: number): string {
  return `${poolId}:ship:${serial}`;
}

function getPoolDefenseRoster(kind: FactionForcePoolKind): readonly FactionForceShipRole[] {
  return kind === "prime-world" ? PRIME_WORLD_DEFENSE_ROSTER : ZONE_DEFENSE_ROSTER;
}

function getPoolReserveRoster(kind: FactionForcePoolKind): readonly FactionForceShipRole[] {
  return kind === "prime-world" ? PRIME_WORLD_RESERVE_ROSTER : ZONE_RESERVE_ROSTER;
}

function getDesiredDefenseRoles(
  kind: FactionForcePoolKind,
  desiredDefenseShips: number,
): FactionForceShipRole[] {
  const roster = getPoolDefenseRoster(kind);
  if (desiredDefenseShips <= 0 || roster.length <= 0) {
    return [];
  }

  const roles: FactionForceShipRole[] = [];
  for (let index = 0; index < desiredDefenseShips; index += 1) {
    roles.push(roster[index % roster.length] ?? roster[0]);
  }
  return roles;
}

function getDesiredReserveRoles(
  kind: FactionForcePoolKind,
  desiredReserveShips: number,
): FactionForceShipRole[] {
  const roster = getPoolReserveRoster(kind);
  if (desiredReserveShips <= 0 || roster.length <= 0) {
    return [];
  }

  const roles: FactionForceShipRole[] = [];
  for (let index = 0; index < desiredReserveShips; index += 1) {
    roles.push(roster[index % roster.length] ?? roster[0]);
  }
  return roles;
}

function getRoleCounts(ships: readonly Pick<FactionForceActiveShipState, "role">[]): Record<FactionForceShipRole, number> {
  return ships.reduce<Record<FactionForceShipRole, number>>((counts, ship) => {
    counts[ship.role] += 1;
    return counts;
  }, {
    "base-fighter": 0,
    "support-fighter": 0,
    "attack-warship": 0,
    "defense-warship": 0,
  });
}

function getNextDefenseRole(pool: Pick<FactionForcePoolRecord, "kind" | "desiredDefenseShips" | "activeShips">): FactionForceShipRole {
  const desiredRoles = getDesiredDefenseRoles(pool.kind, pool.desiredDefenseShips);
  if (desiredRoles.length <= 0) {
    return pool.kind === "prime-world" ? "attack-warship" : "base-fighter";
  }

  const activeRoleCounts = getRoleCounts(pool.activeShips);
  const desiredRoleCounts = getRoleCounts(desiredRoles.map((role) => ({ role })));
  const missingRole = desiredRoles.find((role) => activeRoleCounts[role] < desiredRoleCounts[role]);
  return missingRole ?? desiredRoles[desiredRoles.length - 1] ?? desiredRoles[0];
}

function getNextReserveRole(
  pool: Pick<FactionForcePoolRecord, "kind" | "desiredReserveShips" | "desiredDefenseShips" | "activeShips">,
): FactionForceShipRole {
  const desiredRoles = getDesiredReserveRoles(pool.kind, pool.desiredReserveShips);
  if (desiredRoles.length <= 0) {
    return pool.kind === "prime-world" ? "attack-warship" : "base-fighter";
  }

  const activeReserveShips = pool.activeShips.slice(Math.min(pool.desiredDefenseShips, pool.activeShips.length));
  const activeRoleCounts = getRoleCounts(activeReserveShips);
  const desiredRoleCounts = getRoleCounts(desiredRoles.map((role) => ({ role })));
  const missingRole = desiredRoles.find((role) => activeRoleCounts[role] < desiredRoleCounts[role]);
  return missingRole ?? desiredRoles[desiredRoles.length - 1] ?? desiredRoles[0];
}

function createZonePool(zone: GalaxyZoneRecord): FactionForcePoolRecord {
  return {
    id: `zone-pool:${zone.id}`,
    kind: "zone",
    raceId: getRaceForZoneController(zone),
    sectorId: zone.sectorId,
    originZoneId: zone.id,
    originSystemId: zone.systemId,
    activeShips: [],
    nextShipSerial: 1,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: ZONE_DEFENSE_TARGET,
    desiredReserveShips: 0,
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
  const activeShips = getDesiredDefenseRoles("prime-world", PRIME_WORLD_DEFENSE_TARGET).map((role, index) => ({
    id: createShipId(poolId, index + 1),
    role,
    assignmentKind: "defend" as const,
    assignmentZoneId: zone.id,
  }));

  return {
    id: poolId,
    kind: "prime-world",
    raceId,
    sectorId: homeworld.sectorId,
    originZoneId: zone.id,
    originSystemId: homeworld.systemId,
    activeShips,
    nextShipSerial: activeShips.length + 1,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: PRIME_WORLD_DEFENSE_TARGET,
    desiredReserveShips: 0,
  };
}

function sanitizeUniqueActiveShips(
  activeShips: unknown[],
  fallbackRoles: FactionForceShipRole[],
  fallbackAssignmentZoneId: string,
  maxCount: number,
  usedIds: Set<string>,
): FactionForceActiveShipState[] {
  const sanitized: FactionForceActiveShipState[] = [];
  activeShips.forEach((candidate, index) => {
    if (sanitized.length >= maxCount || !candidate || typeof candidate !== "object") {
      return;
    }

    const record = candidate as Partial<FactionForceActiveShipState>;
    if (typeof record.id !== "string" || record.id.length <= 0 || usedIds.has(record.id)) {
      return;
    }

    usedIds.add(record.id);
    sanitized.push({
      id: record.id,
      role: isFactionForceShipRole(record.role) ? record.role : (fallbackRoles[index] ?? fallbackRoles[fallbackRoles.length - 1] ?? "base-fighter"),
      assignmentKind: isFactionForceAssignmentKind(record.assignmentKind) ? record.assignmentKind : "defend",
      assignmentZoneId: typeof record.assignmentZoneId === "string" && record.assignmentZoneId.length > 0
        ? record.assignmentZoneId
        : fallbackAssignmentZoneId,
    });
  });

  return sanitized;
}

function sanitizeLegacyActiveShipIds(
  activeShipIds: unknown[],
  fallbackRoles: FactionForceShipRole[],
  fallbackAssignmentZoneId: string,
  maxCount: number,
  usedIds: Set<string>,
): FactionForceActiveShipState[] {
  const sanitized: FactionForceActiveShipState[] = [];
  activeShipIds.forEach((candidate, index) => {
    if (sanitized.length >= maxCount || typeof candidate !== "string" || candidate.length <= 0 || usedIds.has(candidate)) {
      return;
    }

    usedIds.add(candidate);
    sanitized.push({
      id: candidate,
      role: fallbackRoles[index] ?? fallbackRoles[fallbackRoles.length - 1] ?? "base-fighter",
      assignmentKind: "defend",
      assignmentZoneId: fallbackAssignmentZoneId,
    });
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

export function getFactionForceRespawnCooldownMs(kind: FactionForcePoolKind, role: FactionForceShipRole): number {
  const baseCooldown = BASE_RESPAWN_COOLDOWNS_MS[role];
  return kind === "prime-world"
    ? Math.max(5000, Math.round(baseCooldown * PRIME_WORLD_PRODUCTION_MULTIPLIER))
    : baseCooldown;
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

  const sourcePools = new Map<string, Partial<FactionForcePoolRecord> & { activeShipIds?: unknown[] }>();
  forceState.pools.forEach((pool) => {
    if (pool && typeof pool.id === "string" && pool.id.length > 0) {
      sourcePools.set(pool.id, pool as Partial<FactionForcePoolRecord> & { activeShipIds?: unknown[] });
    }
  });

  const usedShipIds = new Set<string>();
  return {
    pools: fallback.pools.map((defaultPool) => {
      const sourcePool = sourcePools.get(defaultPool.id);
      const capacity = getFactionForcePoolCapacity(galaxy, defaultPool);
      const desiredDefenseShips = typeof sourcePool?.desiredDefenseShips === "number" && Number.isFinite(sourcePool.desiredDefenseShips)
        ? Math.max(0, Math.round(sourcePool.desiredDefenseShips))
        : defaultPool.desiredDefenseShips;
      const desiredReserveShips = typeof sourcePool?.desiredReserveShips === "number" && Number.isFinite(sourcePool.desiredReserveShips)
        ? Math.max(0, Math.round(sourcePool.desiredReserveShips))
        : defaultPool.desiredReserveShips;
      const fallbackRoles = [
        ...getDesiredDefenseRoles(defaultPool.kind, Math.max(desiredDefenseShips, capacity)),
        ...getDesiredReserveRoles(defaultPool.kind, Math.max(desiredReserveShips, capacity)),
      ];
      const activeShips = Array.isArray(sourcePool?.activeShips)
        ? sanitizeUniqueActiveShips(sourcePool.activeShips, fallbackRoles, defaultPool.originZoneId, capacity, usedShipIds)
        : sanitizeLegacyActiveShipIds(Array.isArray(sourcePool?.activeShipIds) ? sourcePool.activeShipIds : defaultPool.activeShips.map((ship) => ship.id), fallbackRoles, defaultPool.originZoneId, capacity, usedShipIds);
      return {
        ...defaultPool,
        activeShips,
        nextShipSerial: typeof sourcePool?.nextShipSerial === "number" && Number.isFinite(sourcePool.nextShipSerial)
          ? Math.max(activeShips.length + 1, Math.floor(sourcePool.nextShipSerial))
          : Math.max(activeShips.length + 1, defaultPool.nextShipSerial),
        spawnCooldownRemainingMs: typeof sourcePool?.spawnCooldownRemainingMs === "number" && Number.isFinite(sourcePool.spawnCooldownRemainingMs)
          ? Math.max(0, Math.round(sourcePool.spawnCooldownRemainingMs))
          : 0,
        desiredDefenseShips,
        desiredReserveShips,
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
    const desiredReserveShips = Math.min(pool.desiredReserveShips, Math.max(0, capacity - desiredDefenseShips));
    const desiredTotalShips = Math.min(capacity, desiredDefenseShips + desiredReserveShips);
    if (desiredTotalShips <= 0 || pool.activeShips.length >= desiredTotalShips || pool.spawnCooldownRemainingMs > 0) {
      return;
    }

    const role = pool.activeShips.length < desiredDefenseShips
      ? getNextDefenseRole(pool)
      : getNextReserveRole(pool);
    const shipId = createShipId(pool.id, pool.nextShipSerial);
    pool.activeShips.push({
      id: shipId,
      role,
      assignmentKind: "defend",
      assignmentZoneId: pool.originZoneId,
    });
    pool.nextShipSerial += 1;
    pool.spawnCooldownRemainingMs = getFactionForceRespawnCooldownMs(pool.kind, role);
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
    const shipIndex = pool.activeShips.findIndex((ship) => ship.id === shipId);
    if (shipIndex < 0) {
      continue;
    }

    const [removedShip] = pool.activeShips.splice(shipIndex, 1);
    pool.spawnCooldownRemainingMs = Math.max(
      pool.spawnCooldownRemainingMs,
      getFactionForceRespawnCooldownMs(pool.kind, removedShip?.role ?? "base-fighter"),
    );
    return true;
  }

  return false;
}

export function getActiveFactionForceShips(forceState: FactionForceState): FactionForceActiveShipRecord[] {
  return forceState.pools.flatMap((pool) => pool.activeShips.map((ship) => ({
    shipId: ship.id,
    role: ship.role,
    assignmentKind: ship.assignmentKind,
    assignmentZoneId: ship.assignmentZoneId,
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
      activeShipCount: pool.activeShips.length,
      activeShipIds: pool.activeShips.map((ship) => ship.id),
      activeShips: pool.activeShips.map((ship) => ({ ...ship })),
      capacity: getFactionForcePoolCapacity(galaxy, pool),
      desiredDefenseShips: pool.desiredDefenseShips,
      desiredReserveShips: pool.desiredReserveShips,
      spawnCooldownRemainingMs: Math.round(pool.spawnCooldownRemainingMs),
      controlledZoneCount: getControlledZoneCountForRace(galaxy, pool.raceId),
    }));

  return {
    zoneShipPoolCap: ZONE_SHIP_POOL_CAP,
    primeWorldBaseShipPoolCap: PRIME_WORLD_BASE_SHIP_POOL_CAP,
    primeWorldZoneBonusPerControlledZone: PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE,
    primeWorldDefenseTarget: PRIME_WORLD_DEFENSE_TARGET,
    zoneDefenseTarget: ZONE_DEFENSE_TARGET,
    respawnCooldownsMs: {
      zone: {
        "base-fighter": getFactionForceRespawnCooldownMs("zone", "base-fighter"),
        "support-fighter": getFactionForceRespawnCooldownMs("zone", "support-fighter"),
        "attack-warship": getFactionForceRespawnCooldownMs("zone", "attack-warship"),
        "defense-warship": getFactionForceRespawnCooldownMs("zone", "defense-warship"),
      },
      primeWorld: {
        "base-fighter": getFactionForceRespawnCooldownMs("prime-world", "base-fighter"),
        "support-fighter": getFactionForceRespawnCooldownMs("prime-world", "support-fighter"),
        "attack-warship": getFactionForceRespawnCooldownMs("prime-world", "attack-warship"),
        "defense-warship": getFactionForceRespawnCooldownMs("prime-world", "defense-warship"),
      },
    },
    totalPools: pools.length,
    totalActiveShips: pools.reduce((count, pool) => count + pool.activeShipCount, 0),
    pools,
  };
}
