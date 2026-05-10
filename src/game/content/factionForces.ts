import { GALAXY_SECTORS, getGalaxySystemById, type GalaxyDefinition, type GalaxyZoneRecord } from "./galaxy";
import {
  getFactionAssetBuildTimeMs,
  getFactionAssetCargoCapacity,
  getFactionAssetDefinition,
  getFactionAssetDefinitionForShipRole,
  getFactionAssetMobilityValue,
  getFactionAssetResourceCost,
  getFactionAssetShipRole,
  getFactionAssetStrategicPriority,
  isFactionAssetCaptureEligible,
  isFactionAssetCommandEligible,
} from "./factionAssets";
import { type RaceId } from "./items";

export type FactionForcePoolKind = "zone" | "prime-world";
export type FactionForceAllianceStatus = "empire" | "neutral" | "republic";
export type FactionForceShipRole = "base-fighter" | "support-fighter" | "attack-warship" | "defense-warship" | "miner-ship";
export type FactionShipRankLevel = 1 | 2 | 3 | 4 | 5;
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
export type FactionResourceType = "iron-ore" | "aetherium-ore" | "starforged-alloy" | "scrap-ship-parts";
export type FactionResourceNodeVisualKind = "iron" | "aetherium" | "starforged" | "scrap";
export type FactionForceMinerState = "idle" | "travel-to-node" | "mining" | "returning" | "depositing" | "fleeing";
export type FactionShipCargoState = Partial<Record<FactionResourceType, number>>;

export type FactionForceSystemStockpileRecord = {
  systemId: string;
  zoneId: string;
  raceId: RaceId;
  kind: FactionForcePoolKind;
  resources: FactionShipCargoState;
};

export type FactionResourceNodeRecord = {
  id: string;
  fieldId: string;
  systemId: string;
  zoneId: string;
  sectorId: string;
  cellKey: string;
  x: number;
  y: number;
  placementType: "single" | "cluster" | "belt";
  isLarge: boolean;
  resourceType: FactionResourceType;
  visualKind: FactionResourceNodeVisualKind;
  totalYield: number;
  remainingYield: number;
  respawnDurationMs: number;
  depletedUntilSimTimeMs: number | null;
};

export type FactionForceActiveShipState = {
  id: string;
  assetId: string;
  role: FactionForceShipRole;
  rankLevel: FactionShipRankLevel;
  rankXp: number;
  kills: number;
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
  cargo: FactionShipCargoState;
  minerState: FactionForceMinerState | null;
  targetResourceNodeId: string | null;
  cargoCarrierShipId: string | null;
  miningProgress: number;
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
  minerProductionAssetId: string | null;
  minerSpawnCooldownRemainingMs: number;
  desiredDefenseShips: number;
  desiredReserveShips: number;
};

export type FactionForceState = {
  pools: FactionForcePoolRecord[];
  fleets: FactionForceFleetRecord[];
  rankBoostChargesByRace: Partial<Record<RaceId, number>>;
  systemStockpiles: FactionForceSystemStockpileRecord[];
  resourceNodes: FactionResourceNodeRecord[];
  simulationTimeMs: number;
};

export type FactionForceActiveShipRecord = {
  shipId: string;
  assetId: string;
  role: FactionForceShipRole;
  rankLevel: FactionShipRankLevel;
  rankXp: number;
  kills: number;
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
  cargo: FactionShipCargoState;
  minerState: FactionForceMinerState | null;
  targetResourceNodeId: string | null;
  cargoCarrierShipId: string | null;
  miningProgress: number;
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
  minerProductionAssetId: string | null;
  minerSpawnCooldownRemainingMs: number;
  minerProductionBuildTimeMs: number;
  minerProductionProgress: number;
  activeWarShipCount: number;
  activeMinerCount: number;
  minerCapacity: number;
  controlledZoneCount: number;
  stockpile: FactionShipCargoState;
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
  zoneMinerPoolCap: number;
  primeWorldMinerPoolCap: number;
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
  totalActiveWarShips: number;
  totalActiveMiners: number;
  totalFleets: number;
  rankBoostChargesByRace: Partial<Record<RaceId, number>>;
  systemStockpiles: FactionForceSystemStockpileRecord[];
  resourceNodes: FactionResourceNodeRecord[];
  pools: FactionForcePoolDebugRecord[];
  fleets: FactionForceFleetDebugRecord[];
};

export const FACTION_SHIP_RANK_LABELS: Record<FactionShipRankLevel, string> = {
  1: "Recruit",
  2: "Veteran",
  3: "Elite",
  4: "Officer",
  5: "Commander",
};

export const FACTION_RESOURCE_TYPES: readonly FactionResourceType[] = [
  "iron-ore",
  "aetherium-ore",
  "starforged-alloy",
  "scrap-ship-parts",
] as const;

const FACTION_SHIP_RANK_XP_TO_NEXT: Partial<Record<FactionShipRankLevel, number>> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

export const ZONE_SHIP_POOL_CAP = 5;
export const PRIME_WORLD_BASE_SHIP_POOL_CAP = 10;
export const PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE = 1;
export const ZONE_MINER_POOL_CAP = 5;
export const PRIME_WORLD_MINER_POOL_CAP = 8;
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

const PRIME_WORLD_STARTING_STOCKPILE: Readonly<Record<FactionResourceType, number>> = {
  "iron-ore": 96,
  "aetherium-ore": 10,
  "starforged-alloy": 2,
  "scrap-ship-parts": 42,
};

const SYSTEM_STARTING_STOCKPILE: Readonly<Record<FactionResourceType, number>> = {
  "iron-ore": 42,
  "aetherium-ore": 3,
  "starforged-alloy": 0,
  "scrap-ship-parts": 16,
};

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
    || value === "defense-warship"
    || value === "miner-ship";
}

function createEmptyShipCargo(): FactionShipCargoState {
  return {};
}

function normalizeShipCargo(value: unknown): FactionShipCargoState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createEmptyShipCargo();
  }
  return FACTION_RESOURCE_TYPES.reduce<FactionShipCargoState>((cargo, resourceType) => {
    const amount = (value as Partial<Record<FactionResourceType, unknown>>)[resourceType];
    if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
      cargo[resourceType] = Math.max(0, Math.round(amount));
    }
    return cargo;
  }, {});
}

function createEmptyResourceStockpile(): FactionShipCargoState {
  return {};
}

function normalizeResourceStockpile(value: unknown): FactionShipCargoState {
  return normalizeShipCargo(value);
}

function getCargoAmount(cargo: FactionShipCargoState | null | undefined, resourceType: FactionResourceType): number {
  return Math.max(0, Math.round(cargo?.[resourceType] ?? 0));
}

function getCargoTotal(cargo: FactionShipCargoState | null | undefined): number {
  return FACTION_RESOURCE_TYPES.reduce((total, resourceType) => total + getCargoAmount(cargo, resourceType), 0);
}

function addCargoAmount(cargo: FactionShipCargoState, resourceType: FactionResourceType, amount: number): void {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount <= 0) {
    return;
  }
  cargo[resourceType] = getCargoAmount(cargo, resourceType) + safeAmount;
}

function consumeCargoAmount(cargo: FactionShipCargoState, resourceType: FactionResourceType, amount: number): number {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount <= 0) {
    return 0;
  }
  const available = getCargoAmount(cargo, resourceType);
  const consumed = Math.min(available, safeAmount);
  const remaining = available - consumed;
  if (remaining > 0) {
    cargo[resourceType] = remaining;
  } else {
    delete cargo[resourceType];
  }
  return consumed;
}

function cloneCargoState(cargo: FactionShipCargoState | null | undefined): FactionShipCargoState {
  return normalizeShipCargo(cargo);
}

function isFactionForceMinerState(value: unknown): value is FactionForceMinerState {
  return value === "idle"
    || value === "travel-to-node"
    || value === "mining"
    || value === "returning"
    || value === "depositing"
    || value === "fleeing";
}

function clampFactionShipRankLevel(value: unknown): FactionShipRankLevel {
  const rounded = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 1;
  if (rounded <= 1) {
    return 1;
  }
  if (rounded >= 5) {
    return 5;
  }
  return rounded as FactionShipRankLevel;
}

export function getFactionShipRankLabel(rankLevel: FactionShipRankLevel): string {
  return FACTION_SHIP_RANK_LABELS[clampFactionShipRankLevel(rankLevel)];
}

export function getFactionShipRankHullMultiplier(rankLevel: FactionShipRankLevel): number {
  switch (clampFactionShipRankLevel(rankLevel)) {
    case 2:
      return 1.08;
    case 3:
      return 1.16;
    case 4:
      return 1.24;
    case 5:
      return 1.34;
    default:
      return 1;
  }
}

export function getFactionShipRankDamageMultiplier(rankLevel: FactionShipRankLevel): number {
  switch (clampFactionShipRankLevel(rankLevel)) {
    case 2:
      return 1.06;
    case 3:
      return 1.12;
    case 4:
      return 1.2;
    case 5:
      return 1.3;
    default:
      return 1;
  }
}

export function getFactionShipRankDefenseMultiplier(rankLevel: FactionShipRankLevel): number {
  switch (clampFactionShipRankLevel(rankLevel)) {
    case 2:
      return 1.04;
    case 3:
      return 1.08;
    case 4:
      return 1.14;
    case 5:
      return 1.22;
    default:
      return 1;
  }
}

export function getFactionShipRankSpeedMultiplier(rankLevel: FactionShipRankLevel): number {
  switch (clampFactionShipRankLevel(rankLevel)) {
    case 2:
      return 1.01;
    case 3:
      return 1.03;
    case 4:
      return 1.05;
    case 5:
      return 1.07;
    default:
      return 1;
  }
}

export function getFactionShipRankPlayerXpReward(rankLevel: FactionShipRankLevel): number {
  return clampFactionShipRankLevel(rankLevel) * 6;
}

export function getFactionShipRankKillXpReward(rankLevel: FactionShipRankLevel): number {
  return clampFactionShipRankLevel(rankLevel);
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

function isMinerShipRole(role: FactionForceShipRole): boolean {
  return role === "miner-ship";
}

function countActiveWarShips(ships: readonly Pick<FactionForceActiveShipState, "role">[]): number {
  return ships.reduce((count, ship) => count + (isMinerShipRole(ship.role) ? 0 : 1), 0);
}

function countActiveMinerShips(ships: readonly Pick<FactionForceActiveShipState, "role">[]): number {
  return ships.reduce((count, ship) => count + (isMinerShipRole(ship.role) ? 1 : 0), 0);
}

function createStartingSystemStockpile(kind: FactionForcePoolKind): FactionShipCargoState {
  const source = kind === "prime-world" ? PRIME_WORLD_STARTING_STOCKPILE : SYSTEM_STARTING_STOCKPILE;
  return FACTION_RESOURCE_TYPES.reduce<FactionShipCargoState>((stockpile, resourceType) => {
    const amount = source[resourceType] ?? 0;
    if (amount > 0) {
      stockpile[resourceType] = amount;
    }
    return stockpile;
  }, {});
}

function createSystemStockpileRecord(pool: Pick<FactionForcePoolRecord, "originSystemId" | "originZoneId" | "raceId" | "kind">): FactionForceSystemStockpileRecord {
  return {
    systemId: pool.originSystemId,
    zoneId: pool.originZoneId,
    raceId: pool.raceId,
    kind: pool.kind,
    resources: createStartingSystemStockpile(pool.kind),
  };
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
  rankLevel: FactionShipRankLevel = 1,
): FactionForceActiveShipState {
  return {
    id: shipId,
    assetId,
    role: getFactionAssetShipRole(assetId),
    rankLevel,
    rankXp: 0,
    kills: 0,
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
    cargo: createEmptyShipCargo(),
    minerState: getFactionAssetShipRole(assetId) === "miner-ship" ? "idle" : null,
    targetResourceNodeId: null,
    cargoCarrierShipId: null,
    miningProgress: 0,
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
    minerProductionAssetId: null,
    minerSpawnCooldownRemainingMs: 0,
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
    1,
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
    minerProductionAssetId: null,
    minerSpawnCooldownRemainingMs: 0,
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
    index === startingAssets.length - 1 ? 3 : 1,
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
    rankLevel: clampFactionShipRankLevel(candidate.rankLevel),
    rankXp: typeof candidate.rankXp === "number" && Number.isFinite(candidate.rankXp)
      ? Math.max(0, Math.round(candidate.rankXp))
      : 0,
    kills: typeof candidate.kills === "number" && Number.isFinite(candidate.kills)
      ? Math.max(0, Math.round(candidate.kills))
      : 0,
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
    cargo: normalizeShipCargo(candidate.cargo),
    minerState: isFactionForceMinerState(candidate.minerState)
      ? candidate.minerState
      : (role === "miner-ship" ? "idle" : null),
    targetResourceNodeId: typeof candidate.targetResourceNodeId === "string" && candidate.targetResourceNodeId.length > 0
      ? candidate.targetResourceNodeId
      : null,
    cargoCarrierShipId: typeof candidate.cargoCarrierShipId === "string" && candidate.cargoCarrierShipId.length > 0
      ? candidate.cargoCarrierShipId
      : null,
    miningProgress: typeof candidate.miningProgress === "number" && Number.isFinite(candidate.miningProgress)
      ? Math.max(0, candidate.miningProgress)
      : 0,
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

export function getFactionForceMinerPoolCapacity(
  galaxy: GalaxyDefinition,
  pool: Pick<FactionForcePoolRecord, "kind" | "originZoneId">,
): number {
  if (pool.kind === "prime-world") {
    return PRIME_WORLD_MINER_POOL_CAP;
  }
  const zone = galaxy.zones.find((candidate) => candidate.id === pool.originZoneId);
  if (zone?.isPrimeWorldZone) {
    return 0;
  }
  return ZONE_MINER_POOL_CAP;
}

function getSystemStockpileRecord(
  forceState: FactionForceState,
  systemId: string,
): FactionForceSystemStockpileRecord | null {
  return forceState.systemStockpiles.find((stockpile) => stockpile.systemId === systemId) ?? null;
}

function hasResourcesForCost(
  stockpile: FactionShipCargoState,
  cost: Partial<Record<FactionResourceType, number>>,
): boolean {
  return FACTION_RESOURCE_TYPES.every((resourceType) => getCargoAmount(stockpile, resourceType) >= Math.max(0, Math.round(cost[resourceType] ?? 0)));
}

function spendResourceCost(
  stockpile: FactionShipCargoState,
  cost: Partial<Record<FactionResourceType, number>>,
): void {
  FACTION_RESOURCE_TYPES.forEach((resourceType) => {
    consumeCargoAmount(stockpile, resourceType, Math.max(0, Math.round(cost[resourceType] ?? 0)));
  });
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
    const rankDelta = right.rankLevel - left.rankLevel;
    if (rankDelta !== 0) {
      return rankDelta;
    }
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
      if (ship.role === "miner-ship") {
        ship.fleetId = null;
        ship.fleetGroupId = null;
        ship.fleetMode = "patrol-group";
        ship.slotKind = "escort";
        ship.captureIntent = false;
        return;
      }
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

function normalizeResourceNodeRecord(
  candidate: Partial<FactionResourceNodeRecord> | undefined,
  fallback: FactionResourceNodeRecord,
): FactionResourceNodeRecord {
  return {
    ...fallback,
    remainingYield: typeof candidate?.remainingYield === "number" && Number.isFinite(candidate.remainingYield)
      ? Math.max(0, Math.round(candidate.remainingYield))
      : fallback.totalYield,
    depletedUntilSimTimeMs: typeof candidate?.depletedUntilSimTimeMs === "number" && Number.isFinite(candidate.depletedUntilSimTimeMs)
      ? Math.max(0, Math.round(candidate.depletedUntilSimTimeMs))
      : null,
  };
}

function createNormalizedResourceNodes(resourceNodes: readonly FactionResourceNodeRecord[]): FactionResourceNodeRecord[] {
  return resourceNodes.map((node) => normalizeResourceNodeRecord(node, {
    ...node,
    remainingYield: node.totalYield,
    depletedUntilSimTimeMs: null,
  }));
}

function createNormalizedSystemStockpiles(
  orderedPools: readonly FactionForcePoolRecord[],
  sourceStockpiles?: readonly Partial<FactionForceSystemStockpileRecord>[] | null,
): FactionForceSystemStockpileRecord[] {
  const sourceBySystemId = new Map<string, Partial<FactionForceSystemStockpileRecord>>();
  sourceStockpiles?.forEach((stockpile) => {
    if (stockpile && typeof stockpile.systemId === "string" && stockpile.systemId.length > 0) {
      sourceBySystemId.set(stockpile.systemId, stockpile);
    }
  });

  return orderedPools
    .filter((pool, index, pools) => pools.findIndex((candidate) => candidate.originSystemId === pool.originSystemId) === index)
    .map((pool) => {
      const fallback = createSystemStockpileRecord(pool);
      const source = sourceBySystemId.get(pool.originSystemId);
      return {
        systemId: fallback.systemId,
        zoneId: fallback.zoneId,
        raceId: pool.raceId,
        kind: pool.kind,
        resources: normalizeResourceStockpile(source?.resources ?? fallback.resources),
      };
    });
}

function clampPoolActiveShips(
  ships: readonly FactionForceActiveShipState[],
  warshipCapacity: number,
  minerCapacity: number,
): FactionForceActiveShipState[] {
  const keptWarships: FactionForceActiveShipState[] = [];
  const keptMiners: FactionForceActiveShipState[] = [];
  ships.forEach((ship) => {
    if (ship.role === "miner-ship") {
      if (keptMiners.length < minerCapacity) {
        keptMiners.push(ship);
      }
      return;
    }
    if (keptWarships.length < warshipCapacity) {
      keptWarships.push(ship);
    }
  });
  return [...keptWarships, ...keptMiners];
}

export function createFactionForceState(
  galaxy: GalaxyDefinition,
  warState?: FactionForceWarStateLike | null,
  resourceNodes: readonly FactionResourceNodeRecord[] = [],
): FactionForceState {
  const zonePools = galaxy.zones.map((zone) => createZonePool(zone, warState));
  const primePools = galaxy.homeworlds
    .map((homeworld) => createPrimeWorldPool(galaxy, homeworld.raceId))
    .filter((pool): pool is FactionForcePoolRecord => pool !== null);
  const orderedPools = [...zonePools, ...primePools].sort(comparePoolPriority);

  const state: FactionForceState = {
    pools: orderedPools,
    fleets: [],
    rankBoostChargesByRace: {},
    systemStockpiles: createNormalizedSystemStockpiles(orderedPools),
    resourceNodes: createNormalizedResourceNodes(resourceNodes),
    simulationTimeMs: 0,
  };
  rebuildFactionCommanderFleets(state);
  return state;
}

export function normalizeFactionForceState(
  forceState: Partial<FactionForceState> | undefined,
  galaxy: GalaxyDefinition,
  warState?: FactionForceWarStateLike | null,
  resourceNodes: readonly FactionResourceNodeRecord[] = [],
): FactionForceState {
  const fallback = createFactionForceState(galaxy, warState, resourceNodes);
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
      const minerCapacity = getFactionForceMinerPoolCapacity(galaxy, defaultPool);
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

      const candidateShips = Array.isArray(sourcePool?.activeShips)
        ? (sourcePool.activeShips as Partial<FactionForceActiveShipState>[])
          .map((candidate, index) => sanitizeActiveShipRecord(
            candidate,
            fallbackAssets[index] ?? fallbackAssets[fallbackAssets.length - 1] ?? "ship/base-fighter",
            defaultPool.originZoneId,
            defaultPool.originSystemId,
          ))
          .filter((ship): ship is FactionForceActiveShipState => ship !== null && !usedShipIds.has(ship.id))
        : defaultPool.activeShips;
      const activeShips = clampPoolActiveShips(candidateShips, capacity, minerCapacity);

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
        minerProductionAssetId: typeof sourcePool?.minerProductionAssetId === "string" && sourcePool.minerProductionAssetId.length > 0
          ? getFactionAssetDefinition(sourcePool.minerProductionAssetId).id
          : null,
        minerSpawnCooldownRemainingMs: typeof sourcePool?.minerSpawnCooldownRemainingMs === "number" && Number.isFinite(sourcePool.minerSpawnCooldownRemainingMs)
          ? Math.max(0, Math.round(sourcePool.minerSpawnCooldownRemainingMs))
          : 0,
        desiredDefenseShips,
        desiredReserveShips,
      };
    }),
    fleets: [],
    rankBoostChargesByRace: GALAXY_SECTORS.reduce<Partial<Record<RaceId, number>>>((charges, sector) => {
      const raceId = sector.raceId;
      const value = forceState.rankBoostChargesByRace?.[raceId];
      charges[raceId] = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
      return charges;
    }, {}),
    systemStockpiles: createNormalizedSystemStockpiles(fallback.pools, forceState.systemStockpiles),
    resourceNodes: fallback.resourceNodes.map((fallbackNode) => normalizeResourceNodeRecord(
      Array.isArray(forceState.resourceNodes)
        ? forceState.resourceNodes.find((candidate) => candidate?.id === fallbackNode.id)
        : undefined,
      fallbackNode,
    )),
    simulationTimeMs: typeof forceState.simulationTimeMs === "number" && Number.isFinite(forceState.simulationTimeMs)
      ? Math.max(0, Math.round(forceState.simulationTimeMs))
      : 0,
  };

  rebuildFactionCommanderFleets(normalized);
  return normalized;
}

function isResourceNodeAvailable(node: FactionResourceNodeRecord, simulationTimeMs: number): boolean {
  return node.remainingYield > 0 && (node.depletedUntilSimTimeMs === null || node.depletedUntilSimTimeMs <= simulationTimeMs);
}

function refreshResourceNodeRespawns(forceState: FactionForceState): boolean {
  let changed = false;
  forceState.resourceNodes.forEach((node) => {
    if (node.remainingYield > 0) {
      return;
    }
    if (node.depletedUntilSimTimeMs === null || node.depletedUntilSimTimeMs > forceState.simulationTimeMs) {
      return;
    }
    node.remainingYield = node.totalYield;
    node.depletedUntilSimTimeMs = null;
    changed = true;
  });
  return changed;
}

function getResourceNodesForSystem(
  forceState: FactionForceState,
  systemId: string,
): FactionResourceNodeRecord[] {
  return forceState.resourceNodes.filter((node) => node.systemId === systemId);
}

function getDesiredMinerShipCount(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  pool: FactionForcePoolRecord,
): number {
  const minerCapacity = getFactionForceMinerPoolCapacity(galaxy, pool);
  if (minerCapacity <= 0) {
    return 0;
  }
  const zone = galaxy.zones.find((candidate) => candidate.id === pool.originZoneId);
  if (!zone || zone.zoneState !== "stable" || zone.captureAttackerRaceId) {
    return 0;
  }
  const stockpile = getSystemStockpileRecord(forceState, pool.originSystemId)?.resources ?? createEmptyResourceStockpile();
  const availableNodes = getResourceNodesForSystem(forceState, pool.originSystemId)
    .filter((node) => isResourceNodeAvailable(node, forceState.simulationTimeMs));
  if (availableNodes.length <= 0) {
    return 0;
  }
  const richNodes = availableNodes.filter((node) => node.resourceType !== "iron-ore").length;
  const lowFlow = getCargoAmount(stockpile, "iron-ore") < 30 || getCargoAmount(stockpile, "scrap-ship-parts") < 12;
  const baseDesired = pool.kind === "prime-world" ? 3 : 1;
  const richnessBonus = richNodes >= 4 ? 2 : richNodes >= 2 ? 1 : 0;
  const scarcityBonus = lowFlow ? 1 : 0;
  return Math.min(minerCapacity, Math.max(baseDesired, Math.min(minerCapacity, baseDesired + richnessBonus + scarcityBonus)));
}

function pickAffordableWarshipAssetId(
  pool: FactionForcePoolRecord,
  stockpile: FactionShipCargoState,
  desiredDefenseShips: number,
): string | null {
  const preferredAssetId = countActiveWarShips(pool.activeShips) < desiredDefenseShips
    ? getNextDefenseAssetId(pool)
    : getNextReserveAssetId(pool);
  const candidates = [
    preferredAssetId,
    "ship/base-fighter",
    "ship/support-fighter",
    "ship/defense-warship",
    "ship/attack-warship",
  ];
  for (const assetId of candidates) {
    if (!assetId) {
      continue;
    }
    const definition = getFactionAssetDefinition(assetId);
    if (definition.shipRole === "miner-ship") {
      continue;
    }
    if (hasResourcesForCost(stockpile, getFactionAssetResourceCost(definition.id))) {
      return definition.id;
    }
  }
  return null;
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
  forceState.simulationTimeMs += safeDeltaMs;
  if (refreshResourceNodeRespawns(forceState)) {
    changed = true;
  }
  forceState.pools.forEach((pool) => {
    if (pool.spawnCooldownRemainingMs <= 0) {
      if (pool.minerSpawnCooldownRemainingMs <= 0) {
        return;
      }
    }
    if (pool.spawnCooldownRemainingMs > 0) {
      const nextCooldown = Math.max(0, pool.spawnCooldownRemainingMs - safeDeltaMs);
      if (nextCooldown !== pool.spawnCooldownRemainingMs) {
        pool.spawnCooldownRemainingMs = nextCooldown;
        changed = true;
      }
    }
    if (pool.minerSpawnCooldownRemainingMs > 0) {
      const nextMinerCooldown = Math.max(0, pool.minerSpawnCooldownRemainingMs - safeDeltaMs);
      if (nextMinerCooldown !== pool.minerSpawnCooldownRemainingMs) {
        pool.minerSpawnCooldownRemainingMs = nextMinerCooldown;
        changed = true;
      }
    }
  });

  const orderedPools = [...forceState.pools].sort(comparePoolPriority);
  orderedPools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool, warState);
    const warshipCount = countActiveWarShips(pool.activeShips);
    const desiredDefenseShips = Math.min(pool.desiredDefenseShips, capacity);
    const desiredReserveShips = Math.min(pool.desiredReserveShips, Math.max(0, capacity - desiredDefenseShips));
    const desiredTotalShips = isZoneSpawnSuppressed(galaxy, pool)
      ? Math.min(capacity, warshipCount)
      : Math.min(capacity, desiredDefenseShips + desiredReserveShips);
    if (pool.productionAssetId && (desiredTotalShips <= 0 || warshipCount >= desiredTotalShips)) {
      pool.productionAssetId = null;
      pool.spawnCooldownRemainingMs = 0;
      changed = true;
    }

    if (pool.productionAssetId && pool.spawnCooldownRemainingMs <= 0) {
      const definition = getFactionAssetDefinition(pool.productionAssetId);
      const shipId = createShipId(pool.id, pool.nextShipSerial);
      pool.activeShips.push(createActiveShipState(
        pool,
        shipId,
        definition.id,
        "defend",
        pool.originZoneId,
        1,
      ));
      pool.nextShipSerial += 1;
      pool.productionAssetId = null;
      pool.spawnCooldownRemainingMs = 0;
      spawnedShipIds.push(shipId);
      changed = true;
    }

    const minerCapacity = getFactionForceMinerPoolCapacity(galaxy, pool);
    const activeMinerCount = countActiveMinerShips(pool.activeShips);
    const desiredMinerCount = getDesiredMinerShipCount(forceState, galaxy, pool);
    if (pool.minerProductionAssetId && (desiredMinerCount <= 0 || activeMinerCount >= desiredMinerCount || activeMinerCount >= minerCapacity)) {
      pool.minerProductionAssetId = null;
      pool.minerSpawnCooldownRemainingMs = 0;
      changed = true;
    }

    if (pool.minerProductionAssetId && pool.minerSpawnCooldownRemainingMs <= 0 && activeMinerCount < minerCapacity) {
      const minerId = createShipId(pool.id, pool.nextShipSerial);
      pool.activeShips.push(createActiveShipState(
        pool,
        minerId,
        "ship/miner-ship",
        "defend",
        pool.originZoneId,
        1,
      ));
      pool.nextShipSerial += 1;
      pool.minerProductionAssetId = null;
      pool.minerSpawnCooldownRemainingMs = 0;
      spawnedShipIds.push(minerId);
      changed = true;
    }
  });

  orderedPools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool, warState);
    const warshipCount = countActiveWarShips(pool.activeShips);
    const stockpile = getSystemStockpileRecord(forceState, pool.originSystemId)?.resources ?? createEmptyResourceStockpile();
    const desiredDefenseShips = Math.min(pool.desiredDefenseShips, capacity);
    const desiredReserveShips = Math.min(pool.desiredReserveShips, Math.max(0, capacity - desiredDefenseShips));
    const desiredTotalShips = isZoneSpawnSuppressed(galaxy, pool)
      ? Math.min(capacity, warshipCount)
      : Math.min(capacity, desiredDefenseShips + desiredReserveShips);
    if (desiredTotalShips > 0 && warshipCount < desiredTotalShips && !pool.productionAssetId && pool.spawnCooldownRemainingMs <= 0) {
      const assetId = pickAffordableWarshipAssetId(pool, stockpile, desiredDefenseShips);
      if (assetId) {
        pool.productionAssetId = assetId;
        pool.spawnCooldownRemainingMs = getFactionAssetBuildTimeMs(pool.kind, pool.productionAssetId);
        spendResourceCost(stockpile, getFactionAssetResourceCost(pool.productionAssetId));
        changed = true;
      }
    }

    const minerCapacity = getFactionForceMinerPoolCapacity(galaxy, pool);
    const activeMinerCount = countActiveMinerShips(pool.activeShips);
    const desiredMinerCount = getDesiredMinerShipCount(forceState, galaxy, pool);
    if (desiredMinerCount > 0 && activeMinerCount < desiredMinerCount && activeMinerCount < minerCapacity && !pool.minerProductionAssetId && pool.minerSpawnCooldownRemainingMs <= 0) {
      pool.minerProductionAssetId = "ship/miner-ship";
      pool.minerSpawnCooldownRemainingMs = getFactionAssetBuildTimeMs(pool.kind, pool.minerProductionAssetId);
      changed = true;
    }
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

export function getFactionForceShipById(
  forceState: FactionForceState,
  shipId: string,
): FactionForceActiveShipState | null {
  for (const pool of forceState.pools) {
    const ship = pool.activeShips.find((candidate) => candidate.id === shipId);
    if (ship) {
      return ship;
    }
  }
  return null;
}

export function getFactionResourceNodeById(
  forceState: FactionForceState,
  nodeId: string,
): FactionResourceNodeRecord | null {
  return forceState.resourceNodes.find((node) => node.id === nodeId) ?? null;
}

export function getFactionResourceStockpileForSystem(
  forceState: FactionForceState,
  systemId: string,
): FactionShipCargoState {
  return cloneCargoState(getSystemStockpileRecord(forceState, systemId)?.resources);
}

export function depositFactionResourcesToSystem(
  forceState: FactionForceState,
  systemId: string,
  cargo: FactionShipCargoState,
): boolean {
  const stockpile = getSystemStockpileRecord(forceState, systemId);
  if (!stockpile) {
    return false;
  }
  let changed = false;
  FACTION_RESOURCE_TYPES.forEach((resourceType) => {
    const amount = getCargoAmount(cargo, resourceType);
    if (amount <= 0) {
      return;
    }
    addCargoAmount(stockpile.resources, resourceType, amount);
    changed = true;
  });
  return changed;
}

export function clearFactionShipCargo(ship: FactionForceActiveShipState): FactionShipCargoState {
  const cargo = cloneCargoState(ship.cargo);
  ship.cargo = createEmptyShipCargo();
  return cargo;
}

export function addFactionShipCargo(
  ship: FactionForceActiveShipState,
  resourceType: FactionResourceType,
  amount: number,
): number {
  const cargoCapacity = Math.max(0, getFactionAssetCargoCapacity(ship.assetId));
  const currentCargo = getCargoTotal(ship.cargo);
  const spaceRemaining = Math.max(0, cargoCapacity - currentCargo);
  const added = Math.min(spaceRemaining, Math.max(0, Math.round(amount)));
  if (added > 0) {
    addCargoAmount(ship.cargo, resourceType, added);
  }
  return added;
}

export function getFactionShipCargoAmount(ship: FactionForceActiveShipState): number {
  return getCargoTotal(ship.cargo);
}

export function markFactionResourceNodeDepleted(
  forceState: FactionForceState,
  nodeId: string,
  respawnDurationMs?: number,
): FactionResourceNodeRecord | null {
  const node = getFactionResourceNodeById(forceState, nodeId);
  if (!node) {
    return null;
  }
  node.remainingYield = 0;
  node.depletedUntilSimTimeMs = forceState.simulationTimeMs + Math.max(0, Math.round(respawnDurationMs ?? node.respawnDurationMs));
  return node;
}

function getRankXpToNext(rankLevel: FactionShipRankLevel): number {
  return FACTION_SHIP_RANK_XP_TO_NEXT[clampFactionShipRankLevel(rankLevel)] ?? Number.POSITIVE_INFINITY;
}

export function awardFactionForceShipKill(
  forceState: FactionForceState,
  shipId: string,
  defeatedRankLevel: FactionShipRankLevel,
): { changed: boolean; rankLevel: FactionShipRankLevel | null } {
  const ship = getFactionForceShipById(forceState, shipId);
  if (!ship) {
    return { changed: false, rankLevel: null };
  }

  ship.kills += 1;
  ship.rankXp += getFactionShipRankKillXpReward(defeatedRankLevel);
  let changed = true;
  let currentRank = ship.rankLevel;
  while (currentRank < 5) {
    const requiredXp = getRankXpToNext(currentRank);
    if (ship.rankXp < requiredXp) {
      break;
    }

    ship.rankXp -= requiredXp;
    currentRank = clampFactionShipRankLevel(currentRank + 1);
    ship.rankLevel = currentRank;
  }

  return {
    changed,
    rankLevel: ship.rankLevel,
  };
}

export function grantFactionRankBoostCharges(
  forceState: FactionForceState,
  raceId: RaceId,
  amount: number,
): number {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount <= 0) {
    return forceState.rankBoostChargesByRace[raceId] ?? 0;
  }

  forceState.rankBoostChargesByRace[raceId] = (forceState.rankBoostChargesByRace[raceId] ?? 0) + safeAmount;
  return forceState.rankBoostChargesByRace[raceId] ?? 0;
}

export function applyAvailableFactionRankBoosts(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  raceId: RaceId,
  maxBoosts = Number.POSITIVE_INFINITY,
): string[] {
  const available = Math.min(
    Math.max(0, Math.round(forceState.rankBoostChargesByRace[raceId] ?? 0)),
    Math.max(0, Math.round(maxBoosts)),
  );
  if (available <= 0) {
    return [];
  }

  const zoneById = new Map(galaxy.zones.map((zone) => [zone.id, zone] as const));
  const candidates = forceState.pools
    .filter((pool) => pool.raceId === raceId)
    .flatMap((pool) => pool.activeShips.map((ship) => ({ pool, ship })))
    .filter(({ ship }) => ship.rankLevel < 5)
    .sort((left, right) => {
      const leftZone = zoneById.get(left.ship.assignmentZoneId ?? left.pool.originZoneId);
      const rightZone = zoneById.get(right.ship.assignmentZoneId ?? right.pool.originZoneId);
      const leftScore = Number(left.pool.kind === "prime-world") * 20
        + Number(leftZone?.isPrimeWorldZone) * 18
        + Number(left.ship.assignmentKind === "defend") * 10
        + Number(left.ship.assignmentKind === "reclaim" || left.ship.assignmentKind === "invade") * 6
        + Number(isFactionAssetCommandEligible(left.ship.assetId)) * 6
        + left.ship.rankLevel * 2;
      const rightScore = Number(right.pool.kind === "prime-world") * 20
        + Number(rightZone?.isPrimeWorldZone) * 18
        + Number(right.ship.assignmentKind === "defend") * 10
        + Number(right.ship.assignmentKind === "reclaim" || right.ship.assignmentKind === "invade") * 6
        + Number(isFactionAssetCommandEligible(right.ship.assetId)) * 6
        + right.ship.rankLevel * 2;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return left.ship.id.localeCompare(right.ship.id);
    });

  const boostedShipIds: string[] = [];
  for (const { ship } of candidates) {
    if (boostedShipIds.length >= available) {
      break;
    }

    ship.rankLevel = clampFactionShipRankLevel(ship.rankLevel + 1);
    ship.rankXp = 0;
    boostedShipIds.push(ship.id);
  }

  if (boostedShipIds.length > 0) {
    forceState.rankBoostChargesByRace[raceId] = Math.max(0, (forceState.rankBoostChargesByRace[raceId] ?? 0) - boostedShipIds.length);
    rebuildFactionCommanderFleets(forceState);
  }

  return boostedShipIds;
}

export function getActiveFactionForceShips(forceState: FactionForceState): FactionForceActiveShipRecord[] {
  return forceState.pools.flatMap((pool) => pool.activeShips.map((ship) => ({
    shipId: ship.id,
    assetId: ship.assetId,
    role: ship.role,
    rankLevel: ship.rankLevel,
    rankXp: ship.rankXp,
    kills: ship.kills,
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
    cargo: cloneCargoState(ship.cargo),
    minerState: ship.minerState,
    targetResourceNodeId: ship.targetResourceNodeId,
    cargoCarrierShipId: ship.cargoCarrierShipId,
    miningProgress: ship.miningProgress,
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
      activeShips: pool.activeShips.map((ship) => ({ ...ship, cargo: cloneCargoState(ship.cargo) })),
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
      minerProductionAssetId: pool.minerProductionAssetId,
      minerSpawnCooldownRemainingMs: Math.round(pool.minerSpawnCooldownRemainingMs),
      minerProductionBuildTimeMs: pool.minerProductionAssetId
        ? getFactionAssetBuildTimeMs(pool.kind, pool.minerProductionAssetId)
        : 0,
      minerProductionProgress: pool.minerProductionAssetId
        ? Number(Math.max(0, Math.min(
            1,
            1 - (pool.minerSpawnCooldownRemainingMs / Math.max(1, getFactionAssetBuildTimeMs(pool.kind, pool.minerProductionAssetId))),
          )).toFixed(3))
        : 0,
      activeWarShipCount: countActiveWarShips(pool.activeShips),
      activeMinerCount: countActiveMinerShips(pool.activeShips),
      minerCapacity: getFactionForceMinerPoolCapacity(galaxy, pool),
      controlledZoneCount: getControlledZoneCountForRace(galaxy, pool.raceId, warState),
      stockpile: cloneCargoState(getSystemStockpileRecord(forceState, pool.originSystemId)?.resources),
    }));

  return {
    zoneShipPoolCap: ZONE_SHIP_POOL_CAP,
    primeWorldBaseShipPoolCap: PRIME_WORLD_BASE_SHIP_POOL_CAP,
    primeWorldZoneBonusPerControlledZone: PRIME_WORLD_ZONE_BONUS_PER_CONTROLLED_ZONE,
    zoneMinerPoolCap: ZONE_MINER_POOL_CAP,
    primeWorldMinerPoolCap: PRIME_WORLD_MINER_POOL_CAP,
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
        "miner-ship": getFactionForceRespawnCooldownMs("zone", "miner-ship"),
      },
      primeWorld: {
        "base-fighter": getFactionForceRespawnCooldownMs("prime-world", "base-fighter"),
        "support-fighter": getFactionForceRespawnCooldownMs("prime-world", "support-fighter"),
        "attack-warship": getFactionForceRespawnCooldownMs("prime-world", "attack-warship"),
        "defense-warship": getFactionForceRespawnCooldownMs("prime-world", "defense-warship"),
        "miner-ship": getFactionForceRespawnCooldownMs("prime-world", "miner-ship"),
      },
    },
    totalPools: pools.length,
    totalActiveShips: pools.reduce((count, pool) => count + pool.activeShipCount, 0),
    totalActiveWarShips: pools.reduce((count, pool) => count + pool.activeWarShipCount, 0),
    totalActiveMiners: pools.reduce((count, pool) => count + pool.activeMinerCount, 0),
    totalFleets: forceState.fleets.length,
    rankBoostChargesByRace: { ...forceState.rankBoostChargesByRace },
    systemStockpiles: forceState.systemStockpiles.map((stockpile) => ({
      ...stockpile,
      resources: cloneCargoState(stockpile.resources),
    })),
    resourceNodes: forceState.resourceNodes.map((node) => ({ ...node })),
    pools,
    fleets: forceState.fleets.map((fleet) => ({ ...fleet, escortShipIds: [...fleet.escortShipIds] })),
  };
}
