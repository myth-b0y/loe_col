import {
  GALAXY_SECTORS,
  getGalaxySystemById,
  getGalaxyZoneById,
  type GalaxyDefinition,
  type GalaxyZoneRecord,
} from "./galaxy";
import {
  PRIME_WORLD_DEFENSE_TARGET,
  ZONE_DEFENSE_TARGET,
  advanceFactionForceTravel,
  getFactionForcePoolCapacity,
  rebuildFactionCommanderFleets,
  type FactionForceActiveShipState,
  type FactionForcePoolRecord,
  type FactionForceShipRole,
  type FactionForceState,
} from "./factionForces";
import {
  getFactionAssetDefenseValue,
  getFactionAssetWarPower,
  isFactionAssetCaptureEligible,
  isFactionAssetCommandEligible,
} from "./factionAssets";
import { type RaceId } from "./items";

export type RaceAllianceStatus = "empire" | "neutral" | "republic";
export type FactionWarAssignmentKind = "defend" | "invade" | "reclaim";

export type FactionWarRaceState = {
  raceId: RaceId;
  activeTargetZoneId: string | null;
  activeTargetZoneIds: string[];
  retargetCooldownRemainingMs: number;
};

export type FactionWarState = {
  empireRaceId: RaceId;
  republicRaceIds: RaceId[];
  raceStates: FactionWarRaceState[];
};

export type FactionWarAdvanceResult = {
  changed: boolean;
  capturedZoneIds: string[];
};

export type FactionWarZoneAdjacency = Record<string, string[]>;
export type FactionCommanderDoctrine = {
  defenseBias: number;
  expansionBias: number;
  regroupBias: number;
  splitTolerance: number;
  maxConcurrentFronts: number;
  pressureShiftBias: number;
};

const EMPIRE_RETARGET_COOLDOWN_MS = 18000;
const REPUBLIC_RETARGET_COOLDOWN_MS = 24000;
const NEUTRAL_RETARGET_COOLDOWN_MS = 30000;
const EMPIRE_ATTACK_READY_SHIPS = 2;
const REPUBLIC_RECLAIM_READY_SHIPS = 2;
const NEUTRAL_RECLAIM_READY_SHIPS = 1;
const BASE_ZONE_CAPTURE_DURATION_MS = 120000;
const MIN_CAPTURE_PRESSURE = 0.28;
const BASE_ZONE_DEFENSE_POWER = 0.25;
const PRIME_WORLD_DEFENSE_POWER = 1.75;
const EMPIRE_PRIME_WORLD_HOLD_SHIPS = 1;
const REPUBLIC_PRIME_WORLD_HOLD_SHIPS = 1;
const NEUTRAL_PRIME_WORLD_HOLD_SHIPS = 1;
const EMPIRE_POST_CAPTURE_COOLDOWN_MULTIPLIER = 0.88;
const REPUBLIC_POST_CAPTURE_COOLDOWN_MULTIPLIER = 1.12;
const NEUTRAL_POST_CAPTURE_COOLDOWN_MULTIPLIER = 1.18;
const K_NEAREST_ZONE_NEIGHBORS = 5;
const ZONE_DEFENSE_REINFORCEMENT_MAX_DISTANCE = 18000;
const PRIME_WORLD_DEFENSE_REINFORCEMENT_MAX_DISTANCE = 26000;
const MIN_DEFENSE_REINFORCEMENT_DEFICIT = 0.45;
const REPUBLIC_COALITION_SUPPORT_DEMAND_BONUS = 2.05;
const MAX_EMPIRE_STARTING_BONUS_ZONES = 6;
const MIN_EMPIRE_STARTING_BONUS_ZONES = 4;
const MAX_RACE_ACTIVE_FRONTS = 3;
const DEFENSE_RECOVERY_RATE = 1.1;

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x1_0000_0000;
  }

  nextInt(maxExclusive: number): number {
    return Math.max(0, Math.min(maxExclusive - 1, Math.floor(this.next() * Math.max(1, maxExclusive))));
  }
}

function isRaceId(value: unknown): value is RaceId {
  return typeof value === "string" && GALAXY_SECTORS.some((sector) => sector.raceId === value);
}

function getRaceIds(): RaceId[] {
  return GALAXY_SECTORS.map((sector) => sector.raceId);
}

function getRaceStateById(warState: FactionWarState, raceId: RaceId): FactionWarRaceState {
  return warState.raceStates.find((state) => state.raceId === raceId)
    ?? {
      raceId,
      activeTargetZoneId: null,
      activeTargetZoneIds: [],
      retargetCooldownRemainingMs: 0,
    };
}

function getZoneCoreRaceId(zone: Pick<GalaxyZoneRecord, "coreSectorId" | "sectorId">): RaceId {
  return GALAXY_SECTORS.find((sector) => sector.id === zone.coreSectorId)?.raceId
    ?? GALAXY_SECTORS.find((sector) => sector.id === zone.sectorId)?.raceId
    ?? GALAXY_SECTORS[0].raceId;
}

function getZoneControllerRaceId(zone: GalaxyZoneRecord, warState: FactionWarState): RaceId {
  if (isRaceId(zone.currentControllerId)) {
    return zone.currentControllerId;
  }
  if (zone.currentControllerId === "empire") {
    return warState.empireRaceId;
  }
  return getZoneCoreRaceId(zone);
}

function getRetargetCooldownMs(alignment: RaceAllianceStatus): number {
  switch (alignment) {
    case "empire":
      return EMPIRE_RETARGET_COOLDOWN_MS;
    case "republic":
      return REPUBLIC_RETARGET_COOLDOWN_MS;
    default:
      return NEUTRAL_RETARGET_COOLDOWN_MS;
  }
}

function getCommanderDoctrine(warState: FactionWarState, raceId: RaceId): FactionCommanderDoctrine {
  const alignment = getRaceAllianceStatus(warState, raceId);
  const base: FactionCommanderDoctrine = alignment === "empire"
    ? {
        defenseBias: 0.84,
        expansionBias: 1.42,
        regroupBias: 0.74,
        splitTolerance: 1.24,
        maxConcurrentFronts: 3,
        pressureShiftBias: 1.22,
      }
    : alignment === "republic"
      ? {
          defenseBias: 1.2,
          expansionBias: 0.96,
          regroupBias: 1.08,
          splitTolerance: 1.02,
          maxConcurrentFronts: 2,
          pressureShiftBias: 1.04,
        }
      : {
          defenseBias: 1.16,
          expansionBias: 0.62,
          regroupBias: 1.16,
          splitTolerance: 0.72,
          maxConcurrentFronts: 1,
          pressureShiftBias: 0.76,
        };

  switch (raceId) {
    case "ashari":
      return { ...base, expansionBias: base.expansionBias * 1.08, defenseBias: base.defenseBias * 0.96 };
    case "svarin":
      return { ...base, splitTolerance: base.splitTolerance * 1.08, pressureShiftBias: base.pressureShiftBias * 1.08 };
    case "nevari":
    case "aaruian":
      return { ...base, defenseBias: base.defenseBias * 1.08, regroupBias: base.regroupBias * 1.08 };
    case "olydran":
      return { ...base, pressureShiftBias: base.pressureShiftBias * 1.06 };
    case "rakkan":
      return { ...base, expansionBias: base.expansionBias * 1.04 };
    case "elsari":
      return { ...base, splitTolerance: base.splitTolerance * 1.04 };
    default:
      return base;
  }
}

function getReadyShipThreshold(alignment: RaceAllianceStatus): number {
  switch (alignment) {
    case "empire":
      return EMPIRE_ATTACK_READY_SHIPS;
    case "republic":
      return REPUBLIC_RECLAIM_READY_SHIPS;
    default:
      return NEUTRAL_RECLAIM_READY_SHIPS;
  }
}

function getReserveTargetShips(
  alignment: RaceAllianceStatus,
  controlledZoneCount: number,
  hasActiveTarget: boolean,
  lostOwnedZones: number,
): number {
  switch (alignment) {
    case "empire":
      return Math.max(8, Math.min(17, 7 + Math.floor(controlledZoneCount * 0.24)));
    case "republic":
      return hasActiveTarget || lostOwnedZones > 0
        ? Math.max(6, Math.min(11, 4 + Math.floor(controlledZoneCount * 0.18)))
        : 2;
    default:
      return lostOwnedZones > 0
        ? Math.max(4, Math.min(7, 3 + Math.floor(controlledZoneCount * 0.12)))
        : 0;
  }
}

function getPrimeWorldHoldShips(alignment: RaceAllianceStatus): number {
  switch (alignment) {
    case "empire":
      return EMPIRE_PRIME_WORLD_HOLD_SHIPS;
    case "republic":
      return REPUBLIC_PRIME_WORLD_HOLD_SHIPS;
    default:
      return NEUTRAL_PRIME_WORLD_HOLD_SHIPS;
  }
}

function getPostCaptureCooldownMs(alignment: RaceAllianceStatus): number {
  const baseCooldown = getRetargetCooldownMs(alignment);
  switch (alignment) {
    case "empire":
      return Math.round(baseCooldown * EMPIRE_POST_CAPTURE_COOLDOWN_MULTIPLIER);
    case "republic":
      return Math.round(baseCooldown * REPUBLIC_POST_CAPTURE_COOLDOWN_MULTIPLIER);
    default:
      return Math.round(baseCooldown * NEUTRAL_POST_CAPTURE_COOLDOWN_MULTIPLIER);
  }
}

function isZoneUnderCapturePressure(zone: Pick<GalaxyZoneRecord, "zoneState" | "zoneCaptureProgress" | "captureAttackerRaceId">): boolean {
  return zone.zoneState !== "stable"
    || zone.zoneCaptureProgress > 0
    || zone.captureAttackerRaceId !== null;
}

export function isZoneActivelyContested(
  zone: Pick<GalaxyZoneRecord, "zoneState" | "captureAttackerRaceId">,
): boolean {
  return zone.zoneState === "capturing" && zone.captureAttackerRaceId !== null;
}

function getZoneSystemDistance(
  galaxy: GalaxyDefinition,
  fromZoneId: string,
  toZoneId: string,
): number | null {
  const fromZone = getGalaxyZoneById(galaxy, fromZoneId);
  const toZone = getGalaxyZoneById(galaxy, toZoneId);
  if (!fromZone || !toZone) {
    return null;
  }

  const fromSystem = getGalaxySystemById(galaxy, fromZone.systemId);
  const toSystem = getGalaxySystemById(galaxy, toZone.systemId);
  if (!fromSystem || !toSystem) {
    return null;
  }

  return Math.sqrt(((toSystem.x - fromSystem.x) ** 2) + ((toSystem.y - fromSystem.y) ** 2));
}

function canRaceReinforceZone(
  warState: FactionWarState,
  zone: GalaxyZoneRecord,
  raceId: RaceId,
): boolean {
  if (!isZoneUnderCapturePressure(zone) || !zone.captureAttackerRaceId) {
    return false;
  }

  const controllerRaceId = getZoneControllerRaceId(zone, warState);
  if (controllerRaceId === raceId) {
    return true;
  }

  const alignment = getRaceAllianceStatus(warState, raceId);
  if (alignment !== "republic" || zone.captureAttackerRaceId !== warState.empireRaceId) {
    return false;
  }

  return controllerRaceId !== warState.empireRaceId;
}

function getZoneDefenseDemandPower(
  zone: GalaxyZoneRecord,
  warState: FactionWarState,
): number {
  const controllerRaceId = getZoneControllerRaceId(zone, warState);
  const controllerAlignment = getRaceAllianceStatus(warState, controllerRaceId);
  let demand = zone.isPrimeWorldZone ? 6.4 : 4.35;
  if (zone.captureAttackerRaceId === warState.empireRaceId) {
    demand += 0.95;
  }
  if (zone.zoneState === "capturing") {
    demand += 0.55;
  } else if (zone.zoneState === "contested") {
    demand += 0.25;
  }
  demand += zone.zoneCaptureProgress * (zone.isPrimeWorldZone ? 2.6 : 1.85);
  if (controllerAlignment === "neutral") {
    demand += 0.15;
  }
  return demand;
}

function getPoolActiveWarPower(pool: Pick<FactionForcePoolRecord, "activeShips">): number {
  return pool.activeShips.reduce((total, ship) => total + getShipRoleWarPower(ship.role), 0);
}

function getPrimePoolDeployableWarPower(
  pool: FactionForcePoolRecord,
  alignment: RaceAllianceStatus,
): number {
  const committedHomeShips = Math.min(
    pool.activeShips.length,
    pool.desiredDefenseShips + getPrimeWorldHoldShips(alignment),
  );
  return pool.activeShips
    .slice(committedHomeShips)
    .reduce((total, ship) => total + getShipRoleWarPower(ship.role), 0);
}

function chooseBestDefenseTargetZone(
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  raceId: RaceId,
  sourceZoneId: string,
  availablePower: number,
  plannedDefensePowerByZone: ReadonlyMap<string, number>,
  maxDistance: number,
  sameSectorOnly: boolean,
  allowedZoneIds: Set<string> | null,
): string | null {
  if (availablePower <= 0) {
    return null;
  }

  const alignment = getRaceAllianceStatus(warState, raceId);
  const sourceZone = getGalaxyZoneById(galaxy, sourceZoneId);
  const sourceSystem = sourceZone ? getGalaxySystemById(galaxy, sourceZone.systemId) : null;
  const candidates = galaxy.zones
    .filter((zone) => canRaceReinforceZone(warState, zone, raceId))
    .filter((zone) => !allowedZoneIds || allowedZoneIds.has(zone.id))
    .map((zone) => {
      const controllerRaceId = getZoneControllerRaceId(zone, warState);
      const coreRaceId = getZoneCoreRaceId(zone);
      const distance = getZoneSystemDistance(galaxy, sourceZoneId, zone.id);
      const effectiveMaxDistance = alignment === "republic" && controllerRaceId !== warState.empireRaceId
        ? maxDistance * 2.2
        : maxDistance;
      if (distance === null || distance > effectiveMaxDistance) {
        return null;
      }
      const targetSystem = getGalaxySystemById(galaxy, zone.systemId);
      if (!targetSystem) {
        return null;
      }
      if (sameSectorOnly && sourceSystem && targetSystem.sectorId !== sourceSystem.sectorId) {
        return null;
      }

      const republicSupportDemand = alignment === "republic"
        && controllerRaceId !== raceId
        && controllerRaceId !== warState.empireRaceId
        ? REPUBLIC_COALITION_SUPPORT_DEMAND_BONUS
        : 0;
      const defenseDemand = getZoneDefenseDemandPower(zone, warState) + republicSupportDemand;
      const plannedDefensePower = plannedDefensePowerByZone.get(zone.id) ?? 0;
      const deficit = defenseDemand - plannedDefensePower;
      if (deficit <= MIN_DEFENSE_REINFORCEMENT_DEFICIT) {
        return null;
      }

      let score = 1000;
      score += zone.isPrimeWorldZone ? 260 : 0;
      score += zone.zoneState === "capturing" ? 170 : 90;
      score += zone.zoneCaptureProgress * 320;
      score += controllerRaceId === raceId ? 180 : 0;
      score += coreRaceId === raceId ? 140 : 0;
      if (alignment === "republic" && controllerRaceId !== raceId && controllerRaceId !== warState.empireRaceId) {
        score += 170;
      }
      score += Math.min(deficit, availablePower) * 180;
      score -= Math.max(0, availablePower - deficit) * 26;
      score -= distance / 85;
      if (zone.id === sourceZoneId) {
        score += 320;
      }

      return {
        zoneId: zone.id,
        score,
        deficit,
      };
    })
    .filter((candidate): candidate is { zoneId: string; score: number; deficit: number } => candidate !== null);

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.deficit !== left.deficit) {
      return right.deficit - left.deficit;
    }
    return left.zoneId.localeCompare(right.zoneId);
  });

  return candidates[0]?.zoneId ?? null;
}

function getShipRoleWarPower(role: FactionForceShipRole): number {
  switch (role) {
    case "support-fighter":
      return getFactionAssetWarPower("ship/support-fighter");
    case "attack-warship":
      return getFactionAssetWarPower("ship/attack-warship");
    case "defense-warship":
      return getFactionAssetWarPower("ship/defense-warship");
    default:
      return getFactionAssetWarPower("ship/base-fighter");
  }
}

function getTargetDefenseEstimate(
  forceState: FactionForceState,
  zone: GalaxyZoneRecord,
  warState: FactionWarState,
): number {
  const controllerRaceId = getZoneControllerRaceId(zone, warState);
  const defendingShips = forceState.pools
    .filter((pool) => pool.raceId === controllerRaceId && (pool.originZoneId === zone.id || (pool.kind === "prime-world" && zone.isPrimeWorldZone)))
    .reduce((count, pool) => count + pool.activeShips.length, 0);
  return defendingShips + (zone.isPrimeWorldZone ? 2 : 0);
}

function shuffleRaceIds(seed: number): RaceId[] {
  const shuffled = [...getRaceIds()];
  const rng = new SeededRandom((seed ^ 0x9e37_79b9) >>> 0);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.nextInt(index + 1);
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex] ?? current;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function chooseFallbackWarState(galaxy: GalaxyDefinition): FactionWarState {
  const shuffledRaceIds = shuffleRaceIds(galaxy.seed);
  const empireRaceId = shuffledRaceIds[0] ?? GALAXY_SECTORS[0].raceId;
  const republicRaceIds = shuffledRaceIds
    .filter((raceId) => raceId !== empireRaceId)
    .slice(0, 2);

  return {
    empireRaceId,
    republicRaceIds,
    raceStates: getRaceIds().map((raceId) => ({
      raceId,
      activeTargetZoneId: null,
      activeTargetZoneIds: [],
      retargetCooldownRemainingMs: 0,
    })),
  };
}

function getAvailableTargetZones(
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
  raceId: RaceId,
  alignment: RaceAllianceStatus,
): GalaxyZoneRecord[] {
  const buildCandidateZonesFromAnchors = (anchorZones: GalaxyZoneRecord[]): GalaxyZoneRecord[] => {
    const candidateZoneIds = new Set<string>();
    anchorZones.forEach((zone) => {
      (adjacency[zone.id] ?? []).forEach((adjacentZoneId) => candidateZoneIds.add(adjacentZoneId));
    });

    return [...candidateZoneIds]
      .map((zoneId) => getGalaxyZoneById(galaxy, zoneId))
      .filter((zone): zone is GalaxyZoneRecord => zone !== null);
  };

  const controlledZones = galaxy.zones.filter((zone) => getZoneControllerRaceId(zone, warState) === raceId);
  if (controlledZones.length <= 0) {
    return [];
  }

  const candidateZones = buildCandidateZonesFromAnchors(controlledZones)
    .filter((zone) => getZoneControllerRaceId(zone, warState) !== raceId);

  if (alignment === "empire") {
    return candidateZones.filter((zone) => getZoneControllerRaceId(zone, warState) !== warState.empireRaceId);
  }

  if (alignment === "republic") {
    const empireLiberationZones = galaxy.zones.filter((zone) => {
      const zoneControllerRaceId = getZoneControllerRaceId(zone, warState);
      if (zoneControllerRaceId !== warState.empireRaceId) {
        return false;
      }
      return getZoneCoreRaceId(zone) !== warState.empireRaceId;
    });

    const coalitionControlledZones = galaxy.zones.filter((zone) => (
      getRaceAllianceStatus(warState, getZoneControllerRaceId(zone, warState)) === "republic"
    ));
    const coalitionFrontZones = buildCandidateZonesFromAnchors(coalitionControlledZones)
      .filter((zone) => getZoneControllerRaceId(zone, warState) === warState.empireRaceId)
      .filter((zone) => getZoneCoreRaceId(zone) !== warState.empireRaceId);

    const ownLostZones = empireLiberationZones.filter((zone) => getZoneCoreRaceId(zone) === raceId);
    const alliedLostZones = empireLiberationZones.filter((zone) => (
      getZoneCoreRaceId(zone) !== raceId && warState.republicRaceIds.includes(getZoneCoreRaceId(zone))
    ));

    return [...new Map(
      [
        ...ownLostZones,
        ...alliedLostZones,
        ...coalitionFrontZones,
        ...empireLiberationZones,
      ].map((zone) => [zone.id, zone]),
    ).values()];
  }

  const ownOccupiedZones = galaxy.zones.filter((zone) => {
    const zoneControllerRaceId = getZoneControllerRaceId(zone, warState);
    return zoneControllerRaceId === warState.empireRaceId && getZoneCoreRaceId(zone) === raceId;
  });

  return [...new Map(
    [
      ...ownOccupiedZones,
      ...candidateZones.filter((zone) => {
        const zoneControllerRaceId = getZoneControllerRaceId(zone, warState);
        if (zoneControllerRaceId !== warState.empireRaceId) {
          return false;
        }

        return getZoneCoreRaceId(zone) === raceId;
      }),
    ].map((zone) => [zone.id, zone]),
  ).values()];
}

function chooseBestWarTargetZone(
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
  raceId: RaceId,
  currentTargetZoneId: string | null,
): string | null {
  const alignment = getRaceAllianceStatus(warState, raceId);
  const candidates = getAvailableTargetZones(galaxy, warState, adjacency, raceId, alignment);
  if (candidates.length <= 0) {
    return null;
  }

  const scoredCandidates = candidates.map((zone) => {
    const coreRaceId = getZoneCoreRaceId(zone);
    const controllerRaceId = getZoneControllerRaceId(zone, warState);
    const adjacentZoneIds = adjacency[zone.id] ?? [];
    const friendlyNeighborCount = adjacentZoneIds.reduce((count, adjacentZoneId) => {
      const adjacentZone = getGalaxyZoneById(galaxy, adjacentZoneId);
      if (!adjacentZone) {
        return count;
      }
      return count + (getZoneControllerRaceId(adjacentZone, warState) === raceId ? 1 : 0);
    }, 0);
    const hostileNeighborCount = adjacentZoneIds.reduce((count, adjacentZoneId) => {
      const adjacentZone = getGalaxyZoneById(galaxy, adjacentZoneId);
      if (!adjacentZone) {
        return count;
      }
      return count + (getZoneControllerRaceId(adjacentZone, warState) === raceId ? 0 : 1);
    }, 0);
    const defenseEstimate = getTargetDefenseEstimate(forceState, zone, warState);
    let score = 1000;

    if (alignment === "empire") {
      const controllerAlignment = getRaceAllianceStatus(warState, controllerRaceId);
      score += controllerAlignment === "republic" ? 148 : 118;
      score += zone.isPrimeWorldZone ? 118 : 0;
      score += zone.ringId === "second" ? 36 : zone.ringId === "third" ? 28 : 16;
      score += friendlyNeighborCount * 28;
      score += hostileNeighborCount * 12;
      score += Math.max(0, 7.4 - defenseEstimate) * 24;
    } else if (alignment === "republic") {
      score += coreRaceId === raceId ? 180 : getRaceAllianceStatus(warState, coreRaceId) === "republic" ? 120 : 70;
      score += zone.isPrimeWorldZone ? 80 : 24;
      score += controllerRaceId === warState.empireRaceId ? 130 : 0;
    } else {
      score += coreRaceId === raceId ? 220 : -400;
      score += zone.isPrimeWorldZone ? 90 : 0;
    }

    if (zone.id === currentTargetZoneId) {
      score += 140;
    }
    if (zone.captureAttackerRaceId === raceId) {
      score += 200;
    } else if (alignment === "republic" && zone.captureAttackerRaceId === warState.empireRaceId) {
      score += 220;
    } else if (zone.zoneState !== "stable") {
      score += 50;
    }

    score -= defenseEstimate * (alignment === "republic" ? 40 : alignment === "empire" ? 34 : 48);
    return { zone, score };
  });

  scoredCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.zone.id.localeCompare(right.zone.id);
  });

  return scoredCandidates[0]?.zone.id ?? null;
}

function chooseWarTargetZoneIds(
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
  raceId: RaceId,
  preferredZoneIds: readonly string[],
  maxTargets: number,
): string[] {
  const chosen: string[] = [];
  const preferred = preferredZoneIds.filter((zoneId, index, values) => zoneId && values.indexOf(zoneId) === index);
  preferred.forEach((zoneId) => {
    if (chosen.length >= maxTargets) {
      return;
    }
    const validated = validateRaceTarget(galaxy, warState, adjacency, raceId, zoneId);
    if (validated && !chosen.includes(validated)) {
      chosen.push(validated);
    }
  });

  while (chosen.length < maxTargets) {
    const nextTarget = chooseBestWarTargetZone(
      galaxy,
      forceState,
      warState,
      adjacency,
      raceId,
      chosen[0] ?? preferred[0] ?? null,
    );
    if (!nextTarget || chosen.includes(nextTarget)) {
      break;
    }
    chosen.push(nextTarget);
  }

  return chosen;
}

function chooseBestEmpirePoolTargetZone(
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
  raceId: RaceId,
  originZoneId: string,
): string | null {
  const frontierZones = [...new Set(adjacency[originZoneId] ?? [])]
    .map((zoneId) => getGalaxyZoneById(galaxy, zoneId))
    .filter((zone): zone is GalaxyZoneRecord => zone !== null)
    .filter((zone) => getZoneControllerRaceId(zone, warState) !== raceId);
  if (frontierZones.length <= 0) {
    return null;
  }

  const scoredZones = frontierZones.map((zone) => {
    const controllerRaceId = getZoneControllerRaceId(zone, warState);
    const controllerAlignment = getRaceAllianceStatus(warState, controllerRaceId);
    const adjacentZoneIds = adjacency[zone.id] ?? [];
    const empireNeighborCount = adjacentZoneIds.reduce((count, adjacentZoneId) => {
      const adjacentZone = getGalaxyZoneById(galaxy, adjacentZoneId);
      if (!adjacentZone) {
        return count;
      }
      return count + (getZoneControllerRaceId(adjacentZone, warState) === raceId ? 1 : 0);
    }, 0);
    const defenseEstimate = getTargetDefenseEstimate(forceState, zone, warState);
    let score = 1000;
    score += controllerAlignment === "republic" ? 165 : 118;
    score += zone.isPrimeWorldZone ? 108 : 0;
    score += empireNeighborCount * 34;
    score += Math.max(0, 7.8 - defenseEstimate) * 28;
    if (zone.captureAttackerRaceId === raceId) {
      score += 180;
    }
    if (zone.zoneState === "capturing" && zone.captureAttackerRaceId !== raceId) {
      score -= 40;
    }
    return { zone, score };
  });

  scoredZones.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.zone.id.localeCompare(right.zone.id);
  });
  return scoredZones[0]?.zone.id ?? null;
}

function validateRaceTarget(
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
  raceId: RaceId,
  zoneId: string | null,
): string | null {
  if (!zoneId) {
    return null;
  }

  const validTargets = new Set(
    getAvailableTargetZones(galaxy, warState, adjacency, raceId, getRaceAllianceStatus(warState, raceId)).map((zone) => zone.id),
  );
  return validTargets.has(zoneId) ? zoneId : null;
}

function getPrimeWorldPool(forceState: FactionForceState, raceId: RaceId): FactionForcePoolRecord | null {
  return forceState.pools.find((pool) => pool.kind === "prime-world" && pool.raceId === raceId) ?? null;
}

function getLostOwnedZoneCount(galaxy: GalaxyDefinition, warState: FactionWarState, raceId: RaceId): number {
  return galaxy.zones.reduce((count, zone) => {
    const coreRaceId = getZoneCoreRaceId(zone);
    if (coreRaceId !== raceId) {
      return count;
    }
    return count + (getZoneControllerRaceId(zone, warState) === raceId ? 0 : 1);
  }, 0);
}

function setShipAssignment(
  ship: FactionForceActiveShipState,
  kind: FactionWarAssignmentKind,
  zoneId: string,
): boolean {
  if (ship.assignmentKind === kind && ship.assignmentZoneId === zoneId) {
    return false;
  }

  ship.assignmentKind = kind;
  ship.assignmentZoneId = zoneId;
  return true;
}

function setPrimePoolAssignments(
  pool: FactionForcePoolRecord,
  warState: FactionWarState,
  defenseTargetZoneId: string | null,
): boolean {
  const primeZoneId = pool.originZoneId;
  const raceAlignment = getRaceAllianceStatus(warState, pool.raceId);
  const raceState = getRaceStateById(warState, pool.raceId);
  const holdShips = getPrimeWorldHoldShips(raceAlignment);
  const targetZoneIds = raceState.activeTargetZoneIds.length > 0
    ? raceState.activeTargetZoneIds
    : (raceState.activeTargetZoneId ? [raceState.activeTargetZoneId] : []);

  let changed = false;
  if (defenseTargetZoneId) {
    pool.activeShips.forEach((ship, index) => {
      const assignmentZoneId = index < (pool.desiredDefenseShips + holdShips)
        ? primeZoneId
        : defenseTargetZoneId;
      changed = setShipAssignment(ship, "defend", assignmentZoneId) || changed;
    });
    return changed;
  }

  const availableAttackers = Math.max(0, pool.activeShips.length - pool.desiredDefenseShips - holdShips);
  const readyShipThreshold = getReadyShipThreshold(raceAlignment);
  const canLaunch = targetZoneIds.length > 0 && availableAttackers >= readyShipThreshold;

  pool.activeShips.forEach((ship, index) => {
    if (index < (pool.desiredDefenseShips + holdShips) || !canLaunch || targetZoneIds.length <= 0) {
      changed = setShipAssignment(ship, "defend", primeZoneId) || changed;
      return;
    }

    const assignmentKind: FactionWarAssignmentKind = raceAlignment === "empire" ? "invade" : "reclaim";
    const targetIndex = Math.max(0, index - (pool.desiredDefenseShips + holdShips)) % targetZoneIds.length;
    changed = setShipAssignment(ship, assignmentKind, targetZoneIds[targetIndex] ?? targetZoneIds[0]) || changed;
  });

  return changed;
}

function syncZonePoolOwnership(forceState: FactionForceState, galaxy: GalaxyDefinition, warState: FactionWarState): boolean {
  let changed = false;
  forceState.pools.forEach((pool) => {
    if (pool.kind !== "zone") {
      return;
    }

    const zone = getGalaxyZoneById(galaxy, pool.originZoneId);
    if (!zone) {
      return;
    }

    const nextRaceId = getZoneControllerRaceId(zone, warState);
    if (pool.raceId !== nextRaceId) {
      pool.raceId = nextRaceId;
      pool.activeShips = [];
      pool.spawnCooldownRemainingMs = 0;
      pool.desiredDefenseShips = ZONE_DEFENSE_TARGET;
      pool.desiredReserveShips = 0;
      changed = true;
    }
  });
  return changed;
}

function refreshRaceTargets(
  warState: FactionWarState,
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  adjacency: FactionWarZoneAdjacency,
  deltaMs: number,
): boolean {
  let changed = false;
  warState.raceStates.forEach((raceState) => {
    if (raceState.retargetCooldownRemainingMs > 0) {
      const nextCooldown = Math.max(0, raceState.retargetCooldownRemainingMs - deltaMs);
      if (nextCooldown !== raceState.retargetCooldownRemainingMs) {
        raceState.retargetCooldownRemainingMs = nextCooldown;
        changed = true;
      }
    }

    const alignment = getRaceAllianceStatus(warState, raceState.raceId);
    const validatedTargets = raceState.activeTargetZoneIds
      .map((zoneId) => validateRaceTarget(galaxy, warState, adjacency, raceState.raceId, zoneId))
      .filter((zoneId): zoneId is string => Boolean(zoneId));
    const validatedTarget = validateRaceTarget(galaxy, warState, adjacency, raceState.raceId, raceState.activeTargetZoneId);
    const nextPrimaryTarget = validatedTargets[0] ?? validatedTarget ?? null;
    if (
      nextPrimaryTarget !== raceState.activeTargetZoneId
      || validatedTargets.join("|") !== raceState.activeTargetZoneIds.join("|")
    ) {
      raceState.activeTargetZoneId = nextPrimaryTarget;
      raceState.activeTargetZoneIds = validatedTargets.slice(0, MAX_RACE_ACTIVE_FRONTS);
      changed = true;
    }

    if (raceState.activeTargetZoneId && raceState.retargetCooldownRemainingMs > 0) {
      return;
    }

    const primePool = getPrimeWorldPool(forceState, raceState.raceId);
    const activePrimeShips = primePool ? Math.max(0, primePool.activeShips.length - PRIME_WORLD_DEFENSE_TARGET) : 0;
    const threshold = getReadyShipThreshold(alignment);
    if (primePool && activePrimeShips < threshold && raceState.activeTargetZoneId) {
      return;
    }

    const doctrine = getCommanderDoctrine(warState, raceState.raceId);
    const deployableFrontCount = Math.max(
      1,
      Math.min(
        MAX_RACE_ACTIVE_FRONTS,
        Math.round(
          doctrine.maxConcurrentFronts * Math.max(0.5, Math.min(1.2, activePrimeShips / Math.max(1, threshold))),
        ),
      ),
    );
    const nextTargetZoneIds = chooseWarTargetZoneIds(
      galaxy,
      forceState,
      warState,
      adjacency,
      raceState.raceId,
      raceState.activeTargetZoneIds,
      deployableFrontCount,
    );
    const nextTargetZoneId = nextTargetZoneIds[0] ?? null;
    if (
      nextTargetZoneId !== raceState.activeTargetZoneId
      || nextTargetZoneIds.join("|") !== raceState.activeTargetZoneIds.join("|")
    ) {
      raceState.activeTargetZoneId = nextTargetZoneId;
      raceState.activeTargetZoneIds = nextTargetZoneIds;
      raceState.retargetCooldownRemainingMs = nextTargetZoneId ? getRetargetCooldownMs(alignment) : 0;
      changed = true;
    }
  });
  return changed;
}

function applyPoolStrategy(
  forceState: FactionForceState,
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  _adjacency: FactionWarZoneAdjacency,
): boolean {
  let changed = false;
  const plannedDefensePowerByZone = new Map<string, number>();
  const zonePools = forceState.pools.filter((pool): pool is FactionForcePoolRecord => pool.kind === "zone");
  const primePools = forceState.pools.filter((pool): pool is FactionForcePoolRecord => pool.kind === "prime-world");
  const movableZonePools: FactionForcePoolRecord[] = [];

  zonePools.forEach((pool) => {
    const zone = getGalaxyZoneById(galaxy, pool.originZoneId);
    const controllerRaceId = zone ? getZoneControllerRaceId(zone, warState) : pool.raceId;
    const underCapturePressure = Boolean(
      zone
      && controllerRaceId === pool.raceId
      && isZoneUnderCapturePressure(zone),
    );
    const desiredDefenseShips = controllerRaceId === pool.raceId
      ? (underCapturePressure ? Math.min(pool.activeShips.length, ZONE_DEFENSE_TARGET) : ZONE_DEFENSE_TARGET)
      : 0;
    if (pool.desiredDefenseShips !== desiredDefenseShips) {
      pool.desiredDefenseShips = desiredDefenseShips;
      changed = true;
    }
    if (pool.desiredReserveShips !== 0) {
      pool.desiredReserveShips = 0;
      changed = true;
    }

    if (underCapturePressure) {
      pool.activeShips.forEach((ship) => {
        changed = setShipAssignment(ship, "defend", pool.originZoneId) || changed;
      });
      plannedDefensePowerByZone.set(
        pool.originZoneId,
        (plannedDefensePowerByZone.get(pool.originZoneId) ?? 0) + getPoolActiveWarPower(pool),
      );
      return;
    }

    movableZonePools.push(pool);
  });

  primePools.forEach((pool) => {
    if (pool.desiredDefenseShips !== PRIME_WORLD_DEFENSE_TARGET) {
      pool.desiredDefenseShips = PRIME_WORLD_DEFENSE_TARGET;
      changed = true;
    }
  });

  movableZonePools.forEach((pool) => {
    const zone = getGalaxyZoneById(galaxy, pool.originZoneId);
    const controllerRaceId = zone ? getZoneControllerRaceId(zone, warState) : pool.raceId;
    const alignment = getRaceAllianceStatus(warState, pool.raceId);
    const availablePower = controllerRaceId === pool.raceId ? getPoolActiveWarPower(pool) : 0;
    const defenseTargetZoneId = controllerRaceId === pool.raceId
      ? chooseBestDefenseTargetZone(
          galaxy,
          warState,
          pool.raceId,
          pool.originZoneId,
          availablePower,
          plannedDefensePowerByZone,
          ZONE_DEFENSE_REINFORCEMENT_MAX_DISTANCE,
          false,
          null,
        )
      : null;
    const canEmpirePressure = alignment === "empire"
      && controllerRaceId === pool.raceId
      && !defenseTargetZoneId
      && pool.activeShips.length >= 4
      && availablePower >= 3.1;
    const pressureTargetZoneId = canEmpirePressure
      ? chooseBestEmpirePoolTargetZone(galaxy, forceState, warState, _adjacency, pool.raceId, pool.originZoneId)
      : null;
    const assignmentZoneId = defenseTargetZoneId ?? pool.originZoneId;
    pool.activeShips.forEach((ship) => {
      if (pressureTargetZoneId) {
        const holdShips = 1;
        const shipIndex = pool.activeShips.indexOf(ship);
        if (shipIndex >= holdShips) {
          changed = setShipAssignment(ship, "invade", pressureTargetZoneId) || changed;
          return;
        }
      }
      changed = setShipAssignment(ship, "defend", assignmentZoneId) || changed;
    });
    if (defenseTargetZoneId) {
      plannedDefensePowerByZone.set(
        defenseTargetZoneId,
        (plannedDefensePowerByZone.get(defenseTargetZoneId) ?? 0) + availablePower,
      );
    } else if (pressureTargetZoneId) {
      plannedDefensePowerByZone.set(
        pressureTargetZoneId,
        (plannedDefensePowerByZone.get(pressureTargetZoneId) ?? 0) + Math.max(0, availablePower - 1),
      );
    }
  });

  primePools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool);
    const alignment = getRaceAllianceStatus(warState, pool.raceId);
    const raceState = getRaceStateById(warState, pool.raceId);
    const doctrine = getCommanderDoctrine(warState, pool.raceId);
    const defenseTargetZoneId = chooseBestDefenseTargetZone(
      galaxy,
      warState,
      pool.raceId,
      pool.originZoneId,
      getPrimePoolDeployableWarPower(pool, alignment),
      plannedDefensePowerByZone,
      PRIME_WORLD_DEFENSE_REINFORCEMENT_MAX_DISTANCE,
      false,
      null,
    );
    const controlledZoneCount = galaxy.zones.reduce((count, zone) => count + (getZoneControllerRaceId(zone, warState) === pool.raceId ? 1 : 0), 0);
    const lostOwnedZones = getLostOwnedZoneCount(galaxy, warState, pool.raceId);
    const desiredReserveShips = Math.max(
      0,
      Math.min(
        capacity - pool.desiredDefenseShips,
        Math.round(
          getReserveTargetShips(alignment, controlledZoneCount, Boolean(raceState.activeTargetZoneId || defenseTargetZoneId), lostOwnedZones)
          * doctrine.expansionBias,
        ),
      ),
    );
    if (pool.desiredReserveShips !== desiredReserveShips) {
      pool.desiredReserveShips = desiredReserveShips;
      changed = true;
    }

    changed = setPrimePoolAssignments(pool, warState, defenseTargetZoneId) || changed;
    if (defenseTargetZoneId) {
      plannedDefensePowerByZone.set(
        defenseTargetZoneId,
        (plannedDefensePowerByZone.get(defenseTargetZoneId) ?? 0) + getPrimePoolDeployableWarPower(pool, alignment),
      );
    }
  });

  return changed;
}

type ZoneCommanderPresence = {
  powerByRaceId: Map<RaceId, number>;
  commandPresenceByRaceId: Map<RaceId, number>;
  capturePresenceByRaceId: Map<RaceId, number>;
};

function getZoneCommanderPresence(forceState: FactionForceState): Map<string, ZoneCommanderPresence> {
  const presenceByZone = new Map<string, ZoneCommanderPresence>();
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      const zoneId = ship.assignmentZoneId;
      if (!zoneId || ship.travelProgress < 0.995) {
        return;
      }

      const presence = presenceByZone.get(zoneId) ?? {
        powerByRaceId: new Map<RaceId, number>(),
        commandPresenceByRaceId: new Map<RaceId, number>(),
        capturePresenceByRaceId: new Map<RaceId, number>(),
      };
      const warPower = getFactionAssetWarPower(ship.assetId);
      presence.powerByRaceId.set(pool.raceId, (presence.powerByRaceId.get(pool.raceId) ?? 0) + warPower);
      if (ship.slotKind === "command" || isFactionAssetCommandEligible(ship.assetId)) {
        presence.commandPresenceByRaceId.set(pool.raceId, (presence.commandPresenceByRaceId.get(pool.raceId) ?? 0) + 1);
      }
      if (ship.captureIntent && isFactionAssetCaptureEligible(ship.assetId)) {
        presence.capturePresenceByRaceId.set(pool.raceId, (presence.capturePresenceByRaceId.get(pool.raceId) ?? 0) + warPower);
      }
      presenceByZone.set(zoneId, presence);
    });
  });
  return presenceByZone;
}

function getDefensePowerByZone(forceState: FactionForceState): Map<string, number> {
  const defenseByZone = new Map<string, number>();
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      if (ship.assignmentKind !== "defend" || !ship.assignmentZoneId || ship.travelProgress < 0.995) {
        return;
      }

      defenseByZone.set(
        ship.assignmentZoneId,
        (defenseByZone.get(ship.assignmentZoneId) ?? 0) + getFactionAssetDefenseValue(ship.assetId),
      );
    });
  });
  return defenseByZone;
}

function resolveZoneCaptureControllerRaceId(
  zone: GalaxyZoneRecord,
  warState: FactionWarState,
  attackerRaceId: RaceId,
): RaceId {
  const alignment = getRaceAllianceStatus(warState, attackerRaceId);
  if (alignment === "empire") {
    return warState.empireRaceId;
  }
  return getZoneCoreRaceId(zone);
}

function advanceZoneCaptures(
  warState: FactionWarState,
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  deltaMs: number,
): FactionWarAdvanceResult {
  const capturedZoneIds: string[] = [];
  const attackPresenceByZone = getZoneCommanderPresence(forceState);
  const defensePowerByZone = getDefensePowerByZone(forceState);
  let changed = false;

  galaxy.zones.forEach((zone) => {
    const defendingRaceId = getZoneControllerRaceId(zone, warState);
    const presence = attackPresenceByZone.get(zone.id);
    const zoneAttackers = [...(presence?.capturePresenceByRaceId.entries() ?? [])]
      .filter(([raceId, attackPower]) => (
        raceId !== defendingRaceId
        && attackPower > 0
        && (presence?.commandPresenceByRaceId.get(raceId) ?? 0) > 0
      ))
      .sort((left, right) => right[1] - left[1]);
    const strongestAttacker = zoneAttackers[0] ?? null;
    const defendingPower = (defensePowerByZone.get(zone.id) ?? 0) + (zone.isPrimeWorldZone ? 1.35 : 0);

    if (!strongestAttacker) {
      if (zone.zoneCaptureProgress > 0 || zone.zoneState !== "stable" || zone.captureAttackerRaceId) {
        zone.zoneCaptureProgress = Math.max(0, zone.zoneCaptureProgress - (deltaMs / BASE_ZONE_CAPTURE_DURATION_MS) * DEFENSE_RECOVERY_RATE);
        zone.zoneState = zone.zoneCaptureProgress > 0 ? "contested" : "stable";
        if (zone.zoneCaptureProgress <= 0) {
          zone.captureAttackerRaceId = null;
        }
        changed = true;
      }
      return;
    }

    const [attackerRaceId, attackPower] = strongestAttacker;
    const defenseFloor = BASE_ZONE_DEFENSE_POWER + (zone.isPrimeWorldZone ? PRIME_WORLD_DEFENSE_POWER : 0);
    const activeDefendersPresent = (presence?.powerByRaceId.get(defendingRaceId) ?? 0) > 0.01;
    if (activeDefendersPresent) {
      if (zone.zoneState !== "contested") {
        zone.zoneState = zone.zoneCaptureProgress > 0 ? "contested" : "stable";
        changed = true;
      }
      return;
    }

    const capturePressure = attackPower - (defendingPower + defenseFloor);
    if (capturePressure <= MIN_CAPTURE_PRESSURE) {
      const nextProgress = Math.max(0, zone.zoneCaptureProgress - (deltaMs / BASE_ZONE_CAPTURE_DURATION_MS) * 0.95);
      if (nextProgress !== zone.zoneCaptureProgress || zone.zoneState !== "contested") {
        zone.zoneCaptureProgress = nextProgress;
        zone.zoneState = nextProgress > 0 ? "contested" : "stable";
        if (nextProgress <= 0) {
          zone.captureAttackerRaceId = null;
        }
        changed = true;
      }
      return;
    }

    const pressureFactor = Math.min(1.65, 1 + (capturePressure / Math.max(1.4, defendingPower + defenseFloor)));
    const progressGain = (deltaMs / BASE_ZONE_CAPTURE_DURATION_MS) * pressureFactor;
    if (zone.captureAttackerRaceId !== attackerRaceId) {
      zone.captureAttackerRaceId = attackerRaceId;
      zone.zoneCaptureProgress = Math.max(0.05, zone.zoneCaptureProgress * 0.2);
      changed = true;
    }
    zone.zoneCaptureProgress = Math.min(1, zone.zoneCaptureProgress + progressGain);
    zone.zoneState = "capturing";
    changed = true;

    if (zone.zoneCaptureProgress < 1) {
      return;
    }

    const nextControllerRaceId = resolveZoneCaptureControllerRaceId(zone, warState, attackerRaceId);
    if (zone.currentControllerId !== nextControllerRaceId) {
      zone.currentControllerId = nextControllerRaceId;
    }
    zone.zoneCaptureProgress = 0;
    zone.zoneState = "stable";
    zone.captureAttackerRaceId = null;
    const attackerRaceState = warState.raceStates.find((candidate) => candidate.raceId === attackerRaceId);
    if (attackerRaceState) {
      attackerRaceState.activeTargetZoneId = null;
      attackerRaceState.retargetCooldownRemainingMs = Math.max(
        attackerRaceState.retargetCooldownRemainingMs,
        getPostCaptureCooldownMs(getRaceAllianceStatus(warState, attackerRaceId)),
      );
    }
    capturedZoneIds.push(zone.id);
  });

  return {
    changed,
    capturedZoneIds,
  };
}

function chooseEmpireStartingBonusZones(
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency,
): string[] {
  const primeZone = galaxy.zones.find((zone) => zone.isPrimeWorldZone && getZoneCoreRaceId(zone) === warState.empireRaceId);
  if (!primeZone) {
    return [];
  }
  const primeSystem = getGalaxySystemById(galaxy, primeZone.systemId);
  if (!primeSystem) {
    return [];
  }

  const controlledFrontier = new Set<string>([primeZone.id]);
  const candidates = galaxy.zones
    .filter((zone) => zone.id !== primeZone.id && !zone.isPrimeWorldZone)
    .filter((zone) => getZoneControllerRaceId(zone, warState) !== warState.empireRaceId)
    .filter((zone) => {
      const neighbors = adjacency[zone.id] ?? [];
      return neighbors.some((neighborId) => controlledFrontier.has(neighborId) || getZoneControllerRaceId(getGalaxyZoneById(galaxy, neighborId) ?? zone, warState) === warState.empireRaceId);
    })
    .map((zone) => {
      const system = getGalaxySystemById(galaxy, zone.systemId);
      if (!system) {
        return null;
      }
      const distance = Math.sqrt(((system.x - primeSystem.x) ** 2) + ((system.y - primeSystem.y) ** 2));
      const randomBias = ((galaxy.seed ^ distance) % 97) / 97;
      return {
        zone,
        score: distance + (randomBias * 850),
      };
    })
    .filter((entry): entry is { zone: GalaxyZoneRecord; score: number } => entry !== null)
    .sort((left, right) => left.score - right.score);

  return candidates
    .slice(0, Math.min(MAX_EMPIRE_STARTING_BONUS_ZONES, Math.max(MIN_EMPIRE_STARTING_BONUS_ZONES, 4 + ((galaxy.seed >>> 3) % 3))))
    .map((entry) => entry.zone.id);
}

export function applyFactionWarStartingOwnership(
  galaxy: GalaxyDefinition,
  warState: FactionWarState,
  adjacency: FactionWarZoneAdjacency = buildFactionWarZoneAdjacency(galaxy),
): boolean {
  const bonusZoneIds = chooseEmpireStartingBonusZones(galaxy, warState, adjacency);
  let changed = false;
  bonusZoneIds.forEach((zoneId) => {
    const zone = getGalaxyZoneById(galaxy, zoneId);
    if (!zone || zone.currentControllerId === warState.empireRaceId) {
      return;
    }
    zone.currentControllerId = warState.empireRaceId;
    zone.zoneState = "stable";
    zone.zoneCaptureProgress = 0;
    zone.captureAttackerRaceId = null;
    changed = true;
  });
  return changed;
}

export function createFactionWarState(galaxy: GalaxyDefinition): FactionWarState {
  const warState = chooseFallbackWarState(galaxy);
  applyFactionWarStartingOwnership(galaxy, warState);
  return warState;
}

export function normalizeFactionWarState(
  source: Partial<FactionWarState> | undefined,
  galaxy: GalaxyDefinition,
): FactionWarState {
  const fallback = createFactionWarState(galaxy);
  if (!source) {
    return fallback;
  }

  const empireRaceId = isRaceId(source.empireRaceId) ? source.empireRaceId : fallback.empireRaceId;
  const republicRaceIds = Array.isArray(source.republicRaceIds)
    ? source.republicRaceIds.filter((raceId, index, values): raceId is RaceId => isRaceId(raceId) && raceId !== empireRaceId && values.indexOf(raceId) === index).slice(0, 2)
    : [];
  const normalizedRepublicRaceIds = republicRaceIds.length === 2
    ? republicRaceIds
    : fallback.republicRaceIds.filter((raceId) => raceId !== empireRaceId).slice(0, 2);
  const sourceRaceStates = Array.isArray(source.raceStates) ? source.raceStates : [];

  return {
    empireRaceId,
    republicRaceIds: normalizedRepublicRaceIds,
    raceStates: getRaceIds().map((raceId) => {
      const sourceRaceState = sourceRaceStates.find((candidate) => candidate?.raceId === raceId);
      return {
        raceId,
        activeTargetZoneId: typeof sourceRaceState?.activeTargetZoneId === "string" && sourceRaceState.activeTargetZoneId.length > 0
          ? sourceRaceState.activeTargetZoneId
          : null,
        activeTargetZoneIds: Array.isArray(sourceRaceState?.activeTargetZoneIds)
          ? sourceRaceState.activeTargetZoneIds.filter((zoneId): zoneId is string => typeof zoneId === "string" && zoneId.length > 0).slice(0, MAX_RACE_ACTIVE_FRONTS)
          : (typeof sourceRaceState?.activeTargetZoneId === "string" && sourceRaceState.activeTargetZoneId.length > 0
            ? [sourceRaceState.activeTargetZoneId]
            : []),
        retargetCooldownRemainingMs: typeof sourceRaceState?.retargetCooldownRemainingMs === "number" && Number.isFinite(sourceRaceState.retargetCooldownRemainingMs)
          ? Math.max(0, Math.round(sourceRaceState.retargetCooldownRemainingMs))
          : 0,
      };
    }),
  };
}

export function getRaceAllianceStatus(warState: FactionWarState, raceId: RaceId): RaceAllianceStatus {
  if (warState.empireRaceId === raceId) {
    return "empire";
  }
  if (warState.republicRaceIds.includes(raceId)) {
    return "republic";
  }
  return "neutral";
}

export function getSpaceFactionIdForRace(
  warState: FactionWarState,
  raceId: RaceId | null | undefined,
): "empire" | "homeguard" | "republic" {
  if (!raceId) {
    return "homeguard";
  }
  switch (getRaceAllianceStatus(warState, raceId)) {
    case "empire":
      return "empire";
    case "republic":
      return "republic";
    default:
      return "homeguard";
  }
}

export function buildFactionWarZoneAdjacency(galaxy: GalaxyDefinition): FactionWarZoneAdjacency {
  const systemsByZoneId = new Map(
    galaxy.zones.map((zone) => {
      const system = getGalaxySystemById(galaxy, zone.systemId);
      return [zone.id, system];
    }),
  );

  const adjacency = new Map<string, Set<string>>();
  galaxy.zones.forEach((zone) => {
    const originSystem = systemsByZoneId.get(zone.id);
    if (!originSystem) {
      return;
    }

    const nearestZones = galaxy.zones
      .filter((candidate) => candidate.id !== zone.id)
      .map((candidate) => {
        const candidateSystem = systemsByZoneId.get(candidate.id);
        if (!candidateSystem) {
          return null;
        }
        const dx = candidateSystem.x - originSystem.x;
        const dy = candidateSystem.y - originSystem.y;
        return {
          zoneId: candidate.id,
          distanceSq: (dx * dx) + (dy * dy),
        };
      })
      .filter((candidate): candidate is { zoneId: string; distanceSq: number } => candidate !== null)
      .sort((left, right) => left.distanceSq - right.distanceSq)
      .slice(0, K_NEAREST_ZONE_NEIGHBORS);

    const bucket = adjacency.get(zone.id) ?? new Set<string>();
    nearestZones.forEach(({ zoneId }) => {
      bucket.add(zoneId);
      const reverse = adjacency.get(zoneId) ?? new Set<string>();
      reverse.add(zone.id);
      adjacency.set(zoneId, reverse);
    });
    adjacency.set(zone.id, bucket);
  });

  return Object.fromEntries(
    galaxy.zones.map((zone) => [zone.id, [...(adjacency.get(zone.id) ?? new Set<string>())].sort()]),
  );
}

export function advanceFactionWarState(
  warState: FactionWarState,
  galaxy: GalaxyDefinition,
  forceState: FactionForceState,
  adjacency: FactionWarZoneAdjacency,
  deltaMs: number,
): FactionWarAdvanceResult {
  const safeDeltaMs = Math.max(0, Math.round(deltaMs));
  let changed = false;

  changed = syncZonePoolOwnership(forceState, galaxy, warState) || changed;
  changed = refreshRaceTargets(warState, galaxy, forceState, adjacency, safeDeltaMs) || changed;
  changed = applyPoolStrategy(forceState, galaxy, warState, adjacency) || changed;
  changed = rebuildFactionCommanderFleets(forceState) || changed;

  if (safeDeltaMs <= 0) {
    return {
      changed,
      capturedZoneIds: [],
    };
  }

  changed = advanceFactionForceTravel(forceState, galaxy, safeDeltaMs) || changed;
  changed = rebuildFactionCommanderFleets(forceState) || changed;
  const captureResult = advanceZoneCaptures(warState, galaxy, forceState, safeDeltaMs);
  changed = captureResult.changed || changed;
  if (captureResult.capturedZoneIds.length > 0) {
    changed = syncZonePoolOwnership(forceState, galaxy, warState) || changed;
    changed = refreshRaceTargets(warState, galaxy, forceState, adjacency, 0) || changed;
    changed = applyPoolStrategy(forceState, galaxy, warState, adjacency) || changed;
    changed = rebuildFactionCommanderFleets(forceState) || changed;
  }

  return {
    changed,
    capturedZoneIds: captureResult.capturedZoneIds,
  };
}
