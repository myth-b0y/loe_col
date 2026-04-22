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
  getFactionForcePoolCapacity,
  type FactionForceActiveShipState,
  type FactionForcePoolRecord,
  type FactionForceShipRole,
  type FactionForceState,
} from "./factionForces";
import { type RaceId } from "./items";

export type RaceAllianceStatus = "empire" | "neutral" | "republic";
export type FactionWarAssignmentKind = "defend" | "invade" | "reclaim";

export type FactionWarRaceState = {
  raceId: RaceId;
  activeTargetZoneId: string | null;
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

const EMPIRE_RETARGET_COOLDOWN_MS = 26000;
const REPUBLIC_RETARGET_COOLDOWN_MS = 24000;
const NEUTRAL_RETARGET_COOLDOWN_MS = 30000;
const EMPIRE_ATTACK_READY_SHIPS = 7;
const REPUBLIC_RECLAIM_READY_SHIPS = 5;
const NEUTRAL_RECLAIM_READY_SHIPS = 4;
const BASE_ZONE_CAPTURE_DURATION_MS = 120000;
const MIN_CAPTURE_PRESSURE = 0.28;
const BASE_ZONE_DEFENSE_POWER = 0.25;
const PRIME_WORLD_DEFENSE_POWER = 1.75;
const EMPIRE_PRIME_WORLD_HOLD_SHIPS = 1;
const REPUBLIC_PRIME_WORLD_HOLD_SHIPS = 1;
const NEUTRAL_PRIME_WORLD_HOLD_SHIPS = 1;
const EMPIRE_POST_CAPTURE_COOLDOWN_MULTIPLIER = 1.05;
const REPUBLIC_POST_CAPTURE_COOLDOWN_MULTIPLIER = 1.12;
const NEUTRAL_POST_CAPTURE_COOLDOWN_MULTIPLIER = 1.18;
const K_NEAREST_ZONE_NEIGHBORS = 5;
const ZONE_DEFENSE_REINFORCEMENT_MAX_DISTANCE = 18000;
const PRIME_WORLD_DEFENSE_REINFORCEMENT_MAX_DISTANCE = 26000;
const MIN_DEFENSE_REINFORCEMENT_DEFICIT = 0.45;

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
      return Math.max(7, Math.min(15, 6 + Math.floor(controlledZoneCount * 0.2)));
    case "republic":
      return hasActiveTarget || lostOwnedZones > 0
        ? Math.max(5, Math.min(10, 4 + Math.floor(controlledZoneCount * 0.16)))
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
      if (distance === null || distance > maxDistance) {
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
        ? 1.4
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
        score += 120;
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
      return 0.9;
    case "attack-warship":
      return 1.65;
    case "defense-warship":
      return 1.35;
    default:
      return 1;
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
    let score = 1000;

    if (alignment === "empire") {
      score += getRaceAllianceStatus(warState, controllerRaceId) === "republic" ? 160 : 100;
      score += zone.isPrimeWorldZone ? 110 : 0;
      score += zone.ringId === "second" ? 36 : zone.ringId === "third" ? 28 : 16;
    } else if (alignment === "republic") {
      score += coreRaceId === raceId ? 180 : getRaceAllianceStatus(warState, coreRaceId) === "republic" ? 120 : 70;
      score += zone.isPrimeWorldZone ? 80 : 24;
    } else {
      score += coreRaceId === raceId ? 220 : -400;
      score += zone.isPrimeWorldZone ? 90 : 0;
    }

    if (zone.id === currentTargetZoneId) {
      score += 140;
    }
    if (zone.captureAttackerRaceId === raceId) {
      score += 200;
    } else if (zone.zoneState !== "stable") {
      score += 50;
    }

    score -= getTargetDefenseEstimate(forceState, zone, warState) * 48;
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
  const canLaunch = Boolean(raceState.activeTargetZoneId) && availableAttackers >= readyShipThreshold;

  pool.activeShips.forEach((ship, index) => {
    if (index < (pool.desiredDefenseShips + holdShips) || !canLaunch || !raceState.activeTargetZoneId) {
      changed = setShipAssignment(ship, "defend", primeZoneId) || changed;
      return;
    }

    const assignmentKind: FactionWarAssignmentKind = raceAlignment === "empire" ? "invade" : "reclaim";
    changed = setShipAssignment(ship, assignmentKind, raceState.activeTargetZoneId) || changed;
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
    const validatedTarget = validateRaceTarget(galaxy, warState, adjacency, raceState.raceId, raceState.activeTargetZoneId);
    if (validatedTarget !== raceState.activeTargetZoneId) {
      raceState.activeTargetZoneId = validatedTarget;
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

    const nextTargetZoneId = chooseBestWarTargetZone(
      galaxy,
      forceState,
      warState,
      adjacency,
      raceState.raceId,
      raceState.activeTargetZoneId,
    );
    if (nextTargetZoneId !== raceState.activeTargetZoneId) {
      raceState.activeTargetZoneId = nextTargetZoneId;
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
    const assignmentZoneId = defenseTargetZoneId ?? pool.originZoneId;
    pool.activeShips.forEach((ship) => {
      changed = setShipAssignment(ship, "defend", assignmentZoneId) || changed;
    });
    if (defenseTargetZoneId) {
      plannedDefensePowerByZone.set(
        defenseTargetZoneId,
        (plannedDefensePowerByZone.get(defenseTargetZoneId) ?? 0) + availablePower,
      );
    }
  });

  primePools.forEach((pool) => {
    const capacity = getFactionForcePoolCapacity(galaxy, pool);
    const alignment = getRaceAllianceStatus(warState, pool.raceId);
    const raceState = getRaceStateById(warState, pool.raceId);
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
        getReserveTargetShips(alignment, controlledZoneCount, Boolean(raceState.activeTargetZoneId || defenseTargetZoneId), lostOwnedZones),
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

function getAttackPowerByZone(forceState: FactionForceState): Map<string, Map<RaceId, number>> {
  const pressureByZone = new Map<string, Map<RaceId, number>>();
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      if (ship.assignmentKind === "defend" || !ship.assignmentZoneId) {
        return;
      }

      const zonePressure = pressureByZone.get(ship.assignmentZoneId) ?? new Map<RaceId, number>();
      const nextPower = (zonePressure.get(pool.raceId) ?? 0) + getShipRoleWarPower(ship.role);
      zonePressure.set(pool.raceId, nextPower);
      pressureByZone.set(ship.assignmentZoneId, zonePressure);
    });
  });
  return pressureByZone;
}

function getDefensePowerByZone(forceState: FactionForceState): Map<string, number> {
  const defenseByZone = new Map<string, number>();
  forceState.pools.forEach((pool) => {
    pool.activeShips.forEach((ship) => {
      if (ship.assignmentKind !== "defend" || !ship.assignmentZoneId) {
        return;
      }

      defenseByZone.set(
        ship.assignmentZoneId,
        (defenseByZone.get(ship.assignmentZoneId) ?? 0) + getShipRoleWarPower(ship.role),
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
  const attackPowerByZone = getAttackPowerByZone(forceState);
  const defensePowerByZone = getDefensePowerByZone(forceState);
  let changed = false;

  galaxy.zones.forEach((zone) => {
    const defendingRaceId = getZoneControllerRaceId(zone, warState);
    const zoneAttackers = [...(attackPowerByZone.get(zone.id)?.entries() ?? [])]
      .filter(([raceId]) => raceId !== defendingRaceId)
      .sort((left, right) => right[1] - left[1]);
    const strongestAttacker = zoneAttackers[0] ?? null;
    const defendingPower = (defensePowerByZone.get(zone.id) ?? 0) + (zone.isPrimeWorldZone ? 1.35 : 0);

    if (!strongestAttacker) {
      if (zone.zoneCaptureProgress > 0 || zone.zoneState !== "stable" || zone.captureAttackerRaceId) {
        zone.zoneCaptureProgress = Math.max(0, zone.zoneCaptureProgress - (deltaMs / BASE_ZONE_CAPTURE_DURATION_MS) * 1.6);
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

export function createFactionWarState(galaxy: GalaxyDefinition): FactionWarState {
  return chooseFallbackWarState(galaxy);
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

  if (safeDeltaMs <= 0) {
    return {
      changed,
      capturedZoneIds: [],
    };
  }

  const captureResult = advanceZoneCaptures(warState, galaxy, forceState, safeDeltaMs);
  changed = captureResult.changed || changed;
  if (captureResult.capturedZoneIds.length > 0) {
    changed = syncZonePoolOwnership(forceState, galaxy, warState) || changed;
    changed = refreshRaceTargets(warState, galaxy, forceState, adjacency, 0) || changed;
    changed = applyPoolStrategy(forceState, galaxy, warState, adjacency) || changed;
  }

  return {
    changed,
    capturedZoneIds: captureResult.capturedZoneIds,
  };
}
