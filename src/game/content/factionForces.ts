import { GALAXY_SECTORS, getGalaxySystemById, type GalaxyDefinition, type GalaxyZoneRecord } from "./galaxy";
import {
  getFactionAssetBuildTimeMs,
  getFactionAssetDefinition,
  getFactionAssetDefinitionForShipRole,
  getFactionAssetMobilityValue,
  getFactionAssetShipRole,
  getFactionAssetStrategicPriority,
  isFactionAssetCaptureEligible,
  isFactionAssetCommandEligible,
} from "./factionAssets";
import { type RaceId } from "./items";

export type FactionForcePoolKind = "zone" | "prime-world";
export type FactionForceAllianceStatus = "empire" | "neutral" | "republic";
export type FactionForceShipRole = "base-fighter" | "support-fighter" | "attack-warship" | "defense-warship";
export type FactionForceAssignmentKind = "defend" | "invade" | "reclaim";
export type FactionForceFleetMode =
  | "solo-ship"
  | "patrol-group"
  | "single-fleet"
  | "multi-fleet"
  | "hold-position"
  | "regroup"
  | "retreat"
  | "capture-force"
  | "defensive-response-force";
export type FactionForceShipSlotKind = "command" | "escort";

export type FactionForceActiveShipState = {
  id: string;
  assetId: string;
  role: FactionForceShipRole;
  assignmentKind: FactionForceAssignmentKind;
  assignmentZoneId: string | null;
  slotKind: FactionForceShipSlotKind;
  fleetId: string | null;
  fleetGroupId: string | null;
  fleetMode: FactionForceFleetMode;
  travelFromSystemId: string;
  travelToSystemId: string;
  travelProgress: number;
  captureIntent: boolean;
};

export type FactionForceFleetRecord = {
  id: string;
  poolId: string;
  raceId: RaceId;
  originZoneId: string;
  assignmentZoneId: string | null;
  mode: FactionForceFleetMode;
  commandShipId: string | null;
  escortShipIds: string[];
  fleetGroupId: string | null;
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
  productionAssetId: string | null;
  spawnCooldownRemainingMs: number;
  desiredDefenseShips: number;
  desiredReserveShips: number;
};

export type FactionForceState = {
  pools: FactionForcePoolRecord[];
  fleets: FactionForceFleetRecord[];
};

export type FactionForceActiveShipRecord = {
  shipId: string;
  assetId: string;
  role: FactionForceShipRole;
  assignmentKind: FactionForceAssignmentKind;
  assignmentZoneId: string | null;
  slotKind: FactionForceShipSlotKind;
  fleetId: string | null;
  fleetGroupId: string | null;
  fleetMode: FactionForceFleetMode;
  travelFromSystemId: string;
  travelToSystemId: string;
  travelProgress: number;
  captureIntent: boolean;
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
  productionAssetId: string | null;
  spawnCooldownRemainingMs: number;
  productionBuildTimeMs: number;
  productionProgress: number;
  controlledZoneCount: number;
};

export type FactionForceFleetDebugRecord = {
  id: string;
  poolId: string;
  raceId: RaceId;
  originZoneId: string;
  assignmentZoneId: string | null;
  mode: FactionForceFleetMode;
  commandShipId: string | null;
  escortShipIds: string[];
  fleetGroupId: string | null;
};

export type FactionForceDebugSnapshot = {
  zoneShipPoolCap: number;
  primeWorldBaseShipPoolCap: number;
  primeWorldZoneBonusPerControlledZone: number;
  primeWorldDefenseTarget: number;
  zoneDefenseTarget: number;
  startingZoneShips: number;
  startingZoneShipsByAlignment: Record<FactionForceAllianceStatus, number>;
  startingPrimeWorldShips: number;
  fleetSlots: {
    command: number;
    escort: number;
  };
  respawnCooldownsMs: {
    zone: Record<FactionForceShipRole, number>;
    primeWorld: Record<FactionForceShipRole, number>;
  };
  totalPools: number;
  totalActiveShips: number;
  totalFleets: number;
  pools: FactionForcePoolDebugRecord[];
  fleets: FactionForceFleetDebugRecord[];
};

export const ZONE_SHIP_POOL_CAP = 5;
export const PRIME_WORLD_BASE_SHIP_POOL_CAP = 10;
export const PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE = 1;
export const PRIME_WORLD_DEFENSE_TARGET = 3;
export const ZONE_DEFENSE_TARGET = 3;
export const STARTING_ZONE_SHIP_COUNTS: Record<FactionForceAllianceStatus, number> = {
  neutral: 1,
  republic: 2,
  empire: 3,
};
export const STARTING_ZONE_SHIP_COUNT = STARTING_ZONE_SHIP_COUNTS.neutral;
export const STARTING_PRIME_WORLD_SHIP_COUNT = 5;
export const FLEET_COMMAND_SLOT_COUNT = 1;
export const FLEET_ESCORT_SLOT_COUNT = 4;

const BASE_FLEET_TRAVEL_DURATION_MS = 22000;
const MIN_FLEET_TRAVEL_DURATION_MS = 5500;

const PRIME_WORLD_DEFENSE_ROSTER: readonly string[] = [
  "ship/attack-warship",
  "ship/defense-warship",
  "ship/support-fighter",
  "ship/base-fighter",
  "ship/base-fighter",
] as const;

const ZONE_DEFENSE_ROSTER: readonly string[] = [
  "ship/base-fighter",
  "ship/defense-warship",
  "ship/support-fighter",
  "ship/base-fighter",
  "ship/attack-warship",
] as const;

const PRIME_WORLD_RESERVE_ROSTER: readonly string[] = [
  "ship/attack-warship",
  "ship/base-fighter",
  "ship/support-fighter",
  "ship/attack-warship",
  "ship/defense-warship",
  "ship/base-fighter",
] as const;

const ZONE_RESERVE_ROSTER: readonly string[] = [
  "ship/base-fighter",
  "ship/support-fighter",
  "ship/defense-warship",
] as const;

type FactionForceWarStateLike = {
  empireRaceId?: RaceId | null;
  republicRaceIds?: RaceId[] | readonly RaceId[] | null;
};

function getForceAllianceStatus(warState: FactionForceWarStateLike | null | undefined, raceId: RaceId): FactionForceAllianceStatus {
  if (warState?.empireRaceId === raceId) {
    return "empire";
  }
  if (warState?.republicRaceIds?.includes(raceId)) {
    return "republic";
  }
  return "neutral";
}

function getStartingZoneShipCountForRace(
  warState: FactionForceWarStateLike | null | undefined,
  raceId: RaceId,
): number {
  return STARTING_ZONE_SHIP_COUNTS[getForceAllianceStatus(warState, raceId)];
}

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
  return value === "defend" || value === "invade" || value === "reclaim";
}

function isFactionForceShipSlotKind(value: unknown): value is FactionForceShipSlotKind {
  return value === "command" || value === "escort";
}

function isFactionForceFleetMode(value: unknown): value is FactionForceFleetMode {
  return value === "solo-ship"
    || value === "patrol-group"
    || value === "single-fleet"
    || value === "multi-fleet"
    || value === "hold-position"
    || value === "regroup"
    || value === "retreat"
    || value === "capture-force"
    || value === "defensive-response-force";
}

function getFallbackRaceForZone(zone: GalaxyZoneRecord): RaceId {
  return GALAXY_SECTORS.find((sector) => sector.id === zone.coreSectorId)?.raceId
    ?? GALAXY_SECTORS.find((sector) => sector.id === zone.sectorId)?.raceId
    ?? GALAXY_SECTORS[0].raceId;
}

function getRaceForZoneController(
  zone: GalaxyZoneRecord,
  warState?: FactionForceWarStateLike | null,
): RaceId {
  if (isRaceId(zone.currentControllerId)) {
    return zone.currentControllerId;
  }
  if (zone.currentControllerId === "empire" && isRaceId(warState?.empireRaceId)) {
    return warState.empireRaceId;
  }
  if (zone.currentControllerId === "republic") {
    const coreRaceId = getFallbackRaceForZone(zone);
    return warState?.republicRaceIds?.includes(coreRaceId)
      ? coreRaceId
      : warState?.republicRaceIds?.[0] ?? coreRaceId;
  }
  return getFallbackRaceForZone(zone);
}

function createShipId(poolId: string, serial: number): string {
  return `${poolId}:ship:${serial}`;
}

function getPoolDefenseRoster(kind: FactionForcePoolKind): readonly string[] {
  return kind === "prime-world" ? PRIME_WORLD_DEFENSE_ROSTER : ZONE_DEFENSE_ROSTER;
}

function getPoolReserveRoster(kind: FactionForcePoolKind): readonly string[] {
  return kind === "prime-world" ? PRIME_WORLD_RESERVE_ROSTER : ZONE_RESERVE_ROSTER;
}

function getDesiredDefenseAssets(kind: FactionForcePoolKind, desiredDefenseShips: number): string[] {
  const roster = getPoolDefenseRoster(kind);
  if (desiredDefenseShips <= 0 || roster.length <= 0) {
    return [];
  }

  const assets: string[] = [];
  for (let index = 0; index < desiredDefenseShips; index += 1) {
    assets.push(roster[index % roster.length] ?? roster[0]);
  }
  return assets;
}

function getDesiredReserveAssets(kind: FactionForcePoolKind, desiredReserveShips: number): string[] {
  const roster = getPoolReserveRoster(kind);
  if (desiredReserveShips <= 0 || roster.length <= 0) {
    return [];
  }

  const assets: string[] = [];
  for (let index = 0; index < desiredReserveShips; index += 1) {
    assets.push(roster[index % roster.length] ?? roster[0]);
  }
  return assets;
}

function getAssetCounts(ships: readonly Pick<FactionForceActiveShipState, "assetId">[]): Record<string, number> {
  return ships.reduce<Record<string, number>>((counts, ship) => {
    counts[ship.assetId] = (counts[ship.assetId] ?? 0) + 1;
    return counts;
  }, {});
}

function pickMissingAssetId(
  desiredAssetIds: readonly string[],
  activeShips: readonly Pick<FactionForceActiveShipState, "assetId">[],
): string | null {
  if (desiredAssetIds.length <= 0) {
    return null;
  }
  const activeCounts = getAssetCounts(activeShips);
  const desiredCounts = desiredAssetIds.reduce<Record<string, number>>((counts, assetId) => {
    counts[assetId] = (counts[assetId] ?? 0) + 1;
    return counts;
  }, {});
  return desiredAssetIds.find((assetId) => (activeCounts[assetId] ?? 0) < (desiredCounts[assetId] ?? 0)) ?? null;
}

function getNextDefenseAssetId(pool: Pick<FactionForcePoolRecord, "kind" | "desiredDefenseShips" | "activeShips">): string {
  const desiredAssets = getDesiredDefenseAssets(pool.kind, pool.desiredDefenseShips);
  return pickMissingAssetId(desiredAssets, pool.activeShips) ?? desiredAssets[desiredAssets.length - 1] ?? "ship/base-fighter";
}

function getNextReserveAssetId(
  pool: Pick<FactionForcePoolRecord, "kind" | "desiredReserveShips" | "desiredDefenseShips" | "activeShips">,
): string {
  const desiredAssets = getDesiredReserveAssets(pool.kind, pool.desiredReserveShips);
  const activeReserveShips = pool.activeShips.slice(Math.min(pool.desiredDefenseShips, pool.activeShips.length));
  return pickMissingAssetId(desiredAssets, activeReserveShips) ?? desiredAssets[desiredAssets.length - 1] ?? "ship/base-fighter";
}

function createActiveShipState(
  pool: Pick<FactionForcePoolRecord, "originZoneId" | "originSystemId">,
  shipId: string,
  assetId: string,
  assignmentKind: FactionForceAssignmentKind,
  assignmentZoneId: string | null,
): FactionForceActiveShipState {
  return {
    id: shipId,
    assetId,
    role: getFactionAssetShipRole(assetId),
    assignmentKind,
    assignmentZoneId,
    slotKind: isFactionAssetCommandEligible(assetId) ? "command" : "escort",
    fleetId: null,
    fleetGroupId: null,
    fleetMode: "hold-position",
    travelFromSystemId: pool.originSystemId,
    travelToSystemId: pool.originSystemId,
    travelProgress: 1,
    captureIntent: false,
  };
}

function createZonePool(zone: GalaxyZoneRecord, warState?: FactionForceWarStateLike | null): FactionForcePoolRecord {
  const raceId = getRaceForZoneController(zone, warState);
  const pool: FactionForcePoolRecord = {
    id: `zone-pool:${zone.id}`,
    kind: "zone",
    raceId,
    sectorId: zone.sectorId,
    originZoneId: zone.id,
    originSystemId: zone.systemId,
    activeShips: [],
    nextShipSerial: 1,
    productionAssetId: null,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: ZONE_DEFENSE_TARGET,
    desiredReserveShips: 0,
  };

  const startingAssets = getDesiredDefenseAssets("zone", getStartingZoneShipCountForRace(warState, raceId));
  pool.activeShips = startingAssets.map((assetId, index) => createActiveShipState(
    pool,
    createShipId(pool.id, index + 1),
    assetId,
    "defend",
    zone.id,
  ));
  pool.nextShipSerial = pool.activeShips.length + 1;
  return pool;
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

  const pool: FactionForcePoolRecord = {
    id: `prime-pool:${raceId}`,
    kind: "prime-world",
    raceId,
    sectorId: homeworld.sectorId,
    originZoneId: zone.id,
    originSystemId: homeworld.systemId,
    activeShips: [],
    nextShipSerial: 1,
    productionAssetId: null,
    spawnCooldownRemainingMs: 0,
    desiredDefenseShips: PRIME_WORLD_DEFENSE_TARGET,
    desiredReserveShips: 0,
  };

  const startingAssets = getDesiredDefenseAssets("prime-world", STARTING_PRIME_WORLD_SHIP_COUNT);
  pool.activeShips = startingAssets.map((assetId, index) => createActiveShipState(
    pool,
    createShipId(pool.id, index + 1),
    assetId,
    "defend",
    zone.id,
  ));
  pool.nextShipSerial = pool.activeShips.length + 1;
  return pool;
}

function sanitizeActiveShipRecord(
  candidate: Partial<FactionForceActiveShipState>,
  fallbackAssetId: string,
  fallbackAssignmentZoneId: string,
  fallbackOriginSystemId: string,
): FactionForceActiveShipState | null {
  if (typeof candidate.id !== "string" || candidate.id.length <= 0) {
    return null;
  }

  const assetId = typeof candidate.assetId === "string" && candidate.assetId.length > 0
    ? candidate.assetId
    : fallbackAssetId;
  const role = isFactionForceShipRole(candidate.role)
    ? candidate.role
    : getFactionAssetShipRole(assetId);
  const assignmentKind = isFactionForceAssignmentKind(candidate.assignmentKind)
    ? candidate.assignmentKind
    : "defend";
  const assignmentZoneId = typeof candidate.assignmentZoneId === "string" && candidate.assignmentZoneId.length > 0
    ? candidate.assignmentZoneId
    : fallbackAssignmentZoneId;

  return {
    id: candidate.id,
    assetId,
    role,
    assignmentKind,
    assignmentZoneId,
    slotKind: isFactionForceShipSlotKind(candidate.slotKind)
      ? candidate.slotKind
      : (isFactionAssetCommandEligible(assetId) ? "command" : "escort"),
    fleetId: typeof candidate.fleetId === "string" && candidate.fleetId.length > 0 ? candidate.fleetId : null,
    fleetGroupId: typeof candidate.fleetGroupId === "string" && candidate.fleetGroupId.length > 0 ? candidate.fleetGroupId : null,
    fleetMode: isFactionForceFleetMode(candidate.fleetMode) ? candidate.fleetMode : "hold-position",
    travelFromSystemId: typeof candidate.travelFromSystemId === "string" && candidate.travelFromSystemId.length > 0
      ? candidate.travelFromSystemId
      : fallbackOriginSystemId,
    travelToSystemId: typeof candidate.travelToSystemId === "string" && candidate.travelToSystemId.length > 0
      ? candidate.travelToSystemId
      : fallbackOriginSystemId,
    travelProgress: typeof candidate.travelProgress === "number" && Number.isFinite(candidate.travelProgress)
      ? Math.max(0, Math.min(1, candidate.travelProgress))
      : 1,
    captureIntent: typeof candidate.captureIntent === "boolean" ? candidate.captureIntent : false,
  };
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

export function getControlledZoneCountForRace(
  galaxy: GalaxyDefinition,
  raceId: RaceId,
  warState?: FactionForceWarStateLike | null,
): number {
  return galaxy.zones.reduce((count, zone) => count + (getRaceForZoneController(zone, warState) === raceId ? 1 : 0), 0);
}

export function getFactionForcePoolCapacity(
  galaxy: GalaxyDefinition,
  pool: Pick<FactionForcePoolRecord, "kind" | "raceId">,
  warState?: FactionForceWarStateLike | null,
): number {
  if (pool.kind === "prime-world") {
    return PRIME_WORLD_BASE_SHIP_POOL_CAP + (getControlledZoneCountForRace(galaxy, pool.raceId, warState) * PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE);
  }
  return ZONE_SHIP_POOL_CAP;
}

export function getFactionForceRespawnCooldownMs(kind: FactionForcePoolKind, role: FactionForceShipRole): number {
  return getFactionAssetBuildTimeMs(kind, getFactionAssetDefinitionForShipRole(role).id);
}

function isZoneSpawnSuppressed(
  galaxy: GalaxyDefinition,
  pool: Pick<FactionForcePoolRecord, "kind" | "originZoneId">,
): boolean {
  if (pool.kind !== "zone") {
    return false;
  }

  const zone = galaxy.zones.find((candidate) => candidate.id === pool.originZoneId);
  if (!zone) {
    return false;
  }

  return zone.zoneState !== "stable"
    || zone.captureAttackerRaceId !== null
    || zone.zoneCaptureProgress > 0;
}

function getShipTravelDurationMs(
  galaxy: GalaxyDefinition,
  fromSystemId: string,
  toSystemId: string,
  assetId: string,
): number {
  if (fromSystemId === toSystemId) {
    return 0;
  }
  const fromSystem = getGalaxySystemById(galaxy, fromSystemId);
  const toSystem = getGalaxySystemById(galaxy, toSystemId);
  if (!fromSystem || !toSystem) {
    return BASE_FLEET_TRAVEL_DURATION_MS;
  }
  const distance = Math.sqrt(((toSystem.x - fromSystem.x) ** 2) + ((toSystem.y - fromSystem.y) ** 2));
  const mobility = Math.max(0.55, getFactionAssetMobilityValue(assetId));
  return Math.max(
    MIN_FLEET_TRAVEL_DURATION_MS,
    Math.round((distance / 1800) * (BASE_FLEET_TRAVEL_DURATION_MS / mobility)),
  );
}

export function advanceFactionForceTravel(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  deltaMs: number,
): boolean {
  const safeDeltaMs = Math.max(0, Math.round(deltaMs));
  if (safeDeltaMs <= 0) {
    return false;
  }

  let changed = false;
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      const assignmentZone = ship.assignmentZoneId
        ? galaxy.zones.find((zone) => zone.id === ship.assignmentZoneId) ?? null
        : null;
      const nextDestinationSystemId = assignmentZone?.systemId ?? pool.originSystemId;
      if (ship.travelToSystemId !== nextDestinationSystemId) {
        ship.travelFromSystemId = ship.travelProgress >= 1 ? ship.travelToSystemId : ship.travelFromSystemId;
        ship.travelToSystemId = nextDestinationSystemId;
        ship.travelProgress = ship.travelFromSystemId === ship.travelToSystemId ? 1 : 0;
        changed = true;
      }

      if (ship.travelProgress >= 1 || ship.travelFromSystemId === ship.travelToSystemId) {
        if (ship.travelProgress !== 1) {
          ship.travelProgress = 1;
          changed = true;
        }
        return;
      }

      const durationMs = getShipTravelDurationMs(galaxy, ship.travelFromSystemId, ship.travelToSystemId, ship.assetId);
      if (durationMs <= 0) {
        ship.travelProgress = 1;
        changed = true;
        return;
      }
      const nextProgress = Math.max(0, Math.min(1, ship.travelProgress + (safeDeltaMs / durationMs)));
      if (nextProgress !== ship.travelProgress) {
        ship.travelProgress = nextProgress;
        changed = true;
      }
      if (nextProgress >= 1) {
        ship.travelFromSystemId = ship.travelToSystemId;
      }
    });
  });

  return changed;
}

function buildFleetMode(
  assignmentKind: FactionForceAssignmentKind,
  assignmentZoneId: string | null,
  originZoneId: string,
  shipCount: number,
  hasCommandShip: boolean,
  fleetCountInGroup: number,
): FactionForceFleetMode {
  if (assignmentKind === "invade" || assignmentKind === "reclaim") {
    return hasCommandShip ? "capture-force" : "regroup";
  }
  if (assignmentZoneId && assignmentZoneId !== originZoneId) {
    return shipCount <= 1 ? "regroup" : "defensive-response-force";
  }
  if (shipCount <= 1) {
    return "solo-ship";
  }
  if (!hasCommandShip) {
    return "patrol-group";
  }
  if (fleetCountInGroup > 1) {
    return "multi-fleet";
  }
  return "hold-position";
}

function sortShipsForFleetLayout(ships: readonly FactionForceActiveShipState[]): FactionForceActiveShipState[] {
  return [...ships].sort((left, right) => {
    const commandDelta = Number(isFactionAssetCommandEligible(right.assetId)) - Number(isFactionAssetCommandEligible(left.assetId));
    if (commandDelta !== 0) {
      return commandDelta;
    }
    const priorityDelta = getFactionAssetStrategicPriority(left.assetId) - getFactionAssetStrategicPriority(right.assetId);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return left.id.localeCompare(right.id);
  });
}

export function rebuildFactionCommanderFleets(forceState: FactionForceState): boolean {
  let changed = false;
  const nextFleets: FactionForceFleetRecord[] = [];

  const shipsByPoolAndAssignment = new Map<string, { pool: FactionForcePoolRecord; ships: FactionForceActiveShipState[] }>();
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      ship.fleetId = null;
      ship.fleetGroupId = null;
      ship.captureIntent = false;
      const groupKey = `${pool.id}:${ship.assignmentKind}:${ship.assignmentZoneId ?? pool.originZoneId}`;
      const existing = shipsByPoolAndAssignment.get(groupKey);
      if (existing) {
        existing.ships.push(ship);
        return;
      }
      shipsByPoolAndAssignment.set(groupKey, { pool, ships: [ship] });
    });
  });

  shipsByPoolAndAssignment.forEach(({ pool, ships }, groupKey) => {
    const sorted = sortShipsForFleetLayout(ships);
    const commandShips = sorted.filter((ship) => isFactionAssetCommandEligible(ship.assetId));
    const escortShips = sorted.filter((ship) => !isFactionAssetCommandEligible(ship.assetId));
    const leftoverCommandShips = [...commandShips];
    const leftoverEscortShips = [...escortShips];
    const fleetGroupId = sorted.length > (FLEET_COMMAND_SLOT_COUNT + FLEET_ESCORT_SLOT_COUNT)
      ? `fleet-group:${groupKey}`
      : null;
    const fleetRecords: FactionForceFleetRecord[] = [];

    while (leftoverCommandShips.length > 0 || leftoverEscortShips.length > 0) {
      const commandShip = leftoverCommandShips.shift() ?? null;
      const escorts: FactionForceActiveShipState[] = [];
      while (escorts.length < FLEET_ESCORT_SLOT_COUNT && leftoverEscortShips.length > 0) {
        escorts.push(leftoverEscortShips.shift()!);
      }
      while (escorts.length < FLEET_ESCORT_SLOT_COUNT && leftoverCommandShips.length > 0) {
        escorts.push(leftoverCommandShips.shift()!);
      }

      const members = [commandShip, ...escorts].filter((candidate): candidate is FactionForceActiveShipState => candidate !== null);
      const fleetId = `fleet:${groupKey}:${fleetRecords.length}`;
      const mode = buildFleetMode(
        members[0]?.assignmentKind ?? "defend",
        members[0]?.assignmentZoneId ?? pool.originZoneId,
        pool.originZoneId,
        members.length,
        commandShip !== null,
        1,
      );
      const fleetRecord: FactionForceFleetRecord = {
        id: fleetId,
        poolId: pool.id,
        raceId: pool.raceId,
        originZoneId: pool.originZoneId,
        assignmentZoneId: members[0]?.assignmentZoneId ?? pool.originZoneId,
        mode,
        commandShipId: commandShip?.id ?? null,
        escortShipIds: escorts.map((ship) => ship.id),
        fleetGroupId,
      };
      fleetRecords.push(fleetRecord);

      members.forEach((ship) => {
        const previousFleetId = ship.fleetId;
        const previousGroupId = ship.fleetGroupId;
        const previousMode = ship.fleetMode;
        const previousSlotKind = ship.slotKind;
        ship.fleetId = fleetId;
        ship.fleetGroupId = fleetGroupId;
        ship.fleetMode = mode;
        ship.slotKind = commandShip && ship.id === commandShip.id ? "command" : "escort";
        ship.captureIntent = mode === "capture-force"
          && fleetRecord.commandShipId !== null
          && isFactionAssetCaptureEligible(ship.assetId);
        if (
          previousFleetId !== ship.fleetId
          || previousGroupId !== ship.fleetGroupId
          || previousMode !== ship.fleetMode
          || previousSlotKind !== ship.slotKind
        ) {
          changed = true;
        }
      });
    }

    const fleetCountInGroup = fleetRecords.length;
    fleetRecords.forEach((fleet) => {
      const nextMode = buildFleetMode(
        ships.find((ship) => ship.fleetId === fleet.id)?.assignmentKind ?? "defend",
        fleet.assignmentZoneId,
        pool.originZoneId,
        Number(Boolean(fleet.commandShipId)) + fleet.escortShipIds.length,
        Boolean(fleet.commandShipId),
        fleetCountInGroup,
      );
      fleet.mode = nextMode;
      ships
        .filter((ship) => ship.fleetId === fleet.id)
        .forEach((ship) => {
          ship.fleetMode = nextMode;
          ship.captureIntent = nextMode === "capture-force"
            && fleet.commandShipId !== null
            && isFactionAssetCaptureEligible(ship.assetId);
        });
    });
    nextFleets.push(...fleetRecords);
  });

  const sameFleetShape = forceState.fleets.length === nextFleets.length
    && forceState.fleets.every((fleet, index) => {
      const nextFleet = nextFleets[index];
      return nextFleet
        && fleet.id === nextFleet.id
        && fleet.mode === nextFleet.mode
        && fleet.commandShipId === nextFleet.commandShipId
        && fleet.assignmentZoneId === nextFleet.assignmentZoneId
        && fleet.fleetGroupId === nextFleet.fleetGroupId
        && fleet.escortShipIds.join("|") === nextFleet.escortShipIds.join("|");
    });
  if (!sameFleetShape) {
    changed = true;
  }
  forceState.fleets = nextFleets;
  return changed;
}

export function createFactionForceState(
  galaxy: GalaxyDefinition,
  warState?: FactionForceWarStateLike | null,
): FactionForceState {
  const zonePools = galaxy.zones.map((zone) => createZonePool(zone, warState));
  const primePools = galaxy.homeworlds
    .map((homeworld) => createPrimeWorldPool(galaxy, homeworld.raceId))
    .filter((pool): pool is FactionForcePoolRecord => pool !== null);

  const state: FactionForceState = {
    pools: [...zonePools, ...primePools].sort(comparePoolPriority),
    fleets: [],
  };
  rebuildFactionCommanderFleets(state);
  return state;
}

export function normalizeFactionForceState(
  forceState: Partial<FactionForceState> | undefined,
  galaxy: GalaxyDefinition,
  warState?: FactionForceWarStateLike | null,
): FactionForceState {
  const fallback = createFactionForceState(galaxy, warState);
  if (!forceState || !Array.isArray(forceState.pools)) {
    return fallback;
  }

  const sourcePools = new Map<string, Partial<FactionForcePoolRecord>>();
  forceState.pools.forEach((pool) => {
    if (pool && typeof pool.id === "string" && pool.id.length > 0) {
      sourcePools.set(pool.id, pool as Partial<FactionForcePoolRecord>);
    }
  });

  const usedShipIds = new Set<string>();
  const normalized: FactionForceState = {
    pools: fallback.pools.map((defaultPool) => {
      const sourcePool = sourcePools.get(defaultPool.id);
      const capacity = getFactionForcePoolCapacity(galaxy, defaultPool, warState);
      const desiredDefenseShips = typeof sourcePool?.desiredDefenseShips === "number" && Number.isFinite(sourcePool.desiredDefenseShips)
        ? Math.max(0, Math.round(sourcePool.desiredDefenseShips))
        : defaultPool.desiredDefenseShips;
      const desiredReserveShips = typeof sourcePool?.desiredReserveShips === "number" && Number.isFinite(sourcePool.desiredReserveShips)
        ? Math.max(0, Math.round(sourcePool.desiredReserveShips))
        : defaultPool.desiredReserveShips;
      const fallbackAssets = [
        ...getDesiredDefenseAssets(defaultPool.kind, Math.max(desiredDefenseShips, capacity)),
        ...getDesiredReserveAssets(defaultPool.kind, Math.max(desiredReserveShips, capacity)),
      ];

      const activeShips = Array.isArray(sourcePool?.activeShips)
        ? (sourcePool.activeShips as Partial<FactionForceActiveShipState>[])
          .map((candidate, index) => sanitizeActiveShipRecord(
            candidate,
            fallbackAssets[index] ?? fallbackAssets[fallbackAssets.length - 1] ?? "ship/base-fighter",
            defaultPool.originZoneId,
            defaultPool.originSystemId,
          ))
          .filter((ship): ship is FactionForceActiveShipState => ship !== null && !usedShipIds.has(ship.id))
          .slice(0, capacity)
        : defaultPool.activeShips;

      activeShips.forEach((ship) => usedShipIds.add(ship.id));

      return {
        ...defaultPool,
        activeShips,
        nextShipSerial: typeof sourcePool?.nextShipSerial === "number" && Number.isFinite(sourcePool.nextShipSerial)
          ? Math.max(activeShips.length + 1, Math.floor(sourcePool.nextShipSerial))
          : Math.max(activeShips.length + 1, defaultPool.nextShipSerial),
        productionAssetId: typeof sourcePool?.productionAssetId === "string" && sourcePool.productionAssetId.length > 0
          ? getFactionAssetDefinition(sourcePool.productionAssetId).id
          : null,
        spawnCooldownRemainingMs: typeof sourcePool?.spawnCooldownRemainingMs === "number" && Number.isFinite(sourcePool.spawnCooldownRemainingMs)
          ? Math.max(0, Math.round(sourcePool.spawnCooldownRemainingMs))
          : 0,
        desiredDefenseShips,
        desiredReserveShips,
      };
    }),
    fleets: [],
  };

  rebuildFactionCommanderFleets(normalized);
  return normalized;
}

export function advanceFactionForceProduction(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  deltaMs: number,
  warState?: FactionForceWarStateLike | null,
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
    const capacity = getFactionForcePoolCapacity(galaxy, pool, warState);
    const desiredDefenseShips = Math.min(pool.desiredDefenseShips, capacity);
    const desiredReserveShips = Math.min(pool.desiredReserveShips, Math.max(0, capacity - desiredDefenseShips));
    const desiredTotalShips = isZoneSpawnSuppressed(galaxy, pool)
      ? Math.min(capacity, pool.activeShips.length)
      : Math.min(capacity, desiredDefenseShips + desiredReserveShips);
    if (pool.productionAssetId && (desiredTotalShips <= 0 || pool.activeShips.length >= desiredTotalShips)) {
      pool.productionAssetId = null;
      pool.spawnCooldownRemainingMs = 0;
      changed = true;
      return;
    }

    if (!pool.productionAssetId || pool.spawnCooldownRemainingMs > 0) {
      return;
    }

    const definition = getFactionAssetDefinition(pool.productionAssetId);
    const shipId = createShipId(pool.id, pool.nextShipSerial);
    pool.activeShips.push(createActiveShipState(
      pool,
      shipId,
      definition.id,
      "defend",
      pool.originZoneId,
    ));
    pool.nextShipSerial += 1;
    pool.productionAssetId = null;
    pool.spawnCooldownRemainingMs = 0;
    spawnedShipIds.push(shipId);
    changed = true;
  });

  orderedPools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool, warState);
    const desiredDefenseShips = Math.min(pool.desiredDefenseShips, capacity);
    const desiredReserveShips = Math.min(pool.desiredReserveShips, Math.max(0, capacity - desiredDefenseShips));
    const desiredTotalShips = isZoneSpawnSuppressed(galaxy, pool)
      ? Math.min(capacity, pool.activeShips.length)
      : Math.min(capacity, desiredDefenseShips + desiredReserveShips);
    if (desiredTotalShips <= 0 || pool.activeShips.length >= desiredTotalShips || pool.productionAssetId || pool.spawnCooldownRemainingMs > 0) {
      return;
    }

    const assetId = pool.activeShips.length < desiredDefenseShips
      ? getNextDefenseAssetId(pool)
      : getNextReserveAssetId(pool);
    pool.productionAssetId = getFactionAssetDefinition(assetId).id;
    pool.spawnCooldownRemainingMs = getFactionAssetBuildTimeMs(pool.kind, pool.productionAssetId);
    changed = true;
  });

  if (rebuildFactionCommanderFleets(forceState)) {
    changed = true;
  }

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
    void removedShip;
    rebuildFactionCommanderFleets(forceState);
    return true;
  }

  return false;
}

export function getActiveFactionForceShips(forceState: FactionForceState): FactionForceActiveShipRecord[] {
  return forceState.pools.flatMap((pool) => pool.activeShips.map((ship) => ({
    shipId: ship.id,
    assetId: ship.assetId,
    role: ship.role,
    assignmentKind: ship.assignmentKind,
    assignmentZoneId: ship.assignmentZoneId,
    slotKind: ship.slotKind,
    fleetId: ship.fleetId,
    fleetGroupId: ship.fleetGroupId,
    fleetMode: ship.fleetMode,
    travelFromSystemId: ship.travelFromSystemId,
    travelToSystemId: ship.travelToSystemId,
    travelProgress: ship.travelProgress,
    captureIntent: ship.captureIntent,
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
  warState?: FactionForceWarStateLike | null,
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
      capacity: getFactionForcePoolCapacity(galaxy, pool, warState),
      desiredDefenseShips: pool.desiredDefenseShips,
      desiredReserveShips: pool.desiredReserveShips,
      productionAssetId: pool.productionAssetId,
      spawnCooldownRemainingMs: Math.round(pool.spawnCooldownRemainingMs),
      productionBuildTimeMs: pool.productionAssetId
        ? getFactionAssetBuildTimeMs(pool.kind, pool.productionAssetId)
        : 0,
      productionProgress: pool.productionAssetId
        ? Number(Math.max(0, Math.min(
            1,
            1 - (pool.spawnCooldownRemainingMs / Math.max(1, getFactionAssetBuildTimeMs(pool.kind, pool.productionAssetId))),
          )).toFixed(3))
        : 0,
      controlledZoneCount: getControlledZoneCountForRace(galaxy, pool.raceId, warState),
    }));

  return {
    zoneShipPoolCap: ZONE_SHIP_POOL_CAP,
    primeWorldBaseShipPoolCap: PRIME_WORLD_BASE_SHIP_POOL_CAP,
    primeWorldZoneBonusPerControlledZone: PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE,
    primeWorldDefenseTarget: PRIME_WORLD_DEFENSE_TARGET,
    zoneDefenseTarget: ZONE_DEFENSE_TARGET,
    startingZoneShips: STARTING_ZONE_SHIP_COUNT,
    startingZoneShipsByAlignment: { ...STARTING_ZONE_SHIP_COUNTS },
    startingPrimeWorldShips: STARTING_PRIME_WORLD_SHIP_COUNT,
    fleetSlots: {
      command: FLEET_COMMAND_SLOT_COUNT,
      escort: FLEET_ESCORT_SLOT_COUNT,
    },
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
    totalFleets: forceState.fleets.length,
    pools,
    fleets: forceState.fleets.map((fleet) => ({ ...fleet, escortShipIds: [...fleet.escortShipIds] })),
  };
}
