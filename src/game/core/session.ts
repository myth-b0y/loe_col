import Phaser from "phaser";

import {
  clampPointToGalaxyTravelBounds,
  createGalaxyDefinition,
  createGalaxySeed,
  getDefaultGalaxySpawnPoint,
  getGalaxyHomeworldByRace,
  getGalaxyHomeworldPlanets,
  getGalaxyPlanetById,
  getGalaxyStationById as getGalaxyStationByIdFromGalaxy,
  getGalaxyZoneById as getGalaxyZoneByIdFromGalaxy,
  getGalaxyZoneBySystemId as getGalaxyZoneBySystemIdFromGalaxy,
  getGalaxySpawnPointForRace,
  getMissionPlanetForMission as getMissionPlanetForMissionFromGalaxy,
  normalizeGalaxyDefinition,
  type GalaxyDefinition,
  type GalaxyMissionPlanet,
  type GalaxyPoint,
  type GalaxyPlanetRecord,
  type GalaxyStationRecord,
  type GalaxyZoneRecord,
} from "../content/galaxy";
import {
  createFactionForceState,
  normalizeFactionForceState,
  type FactionForceState,
} from "../content/factionForces";
import {
  createFactionWarState,
  normalizeFactionWarState,
  type FactionWarState,
} from "../content/factionWar";
import {
  DEFAULT_SQUAD_ASSIGNMENTS,
  canCompanionOccupySlot,
  getCompanionDefinition,
  getFormationSlot,
  type CompanionDefinition,
  type CompanionId,
  type FormationSlotId,
  type SquadAssignment,
} from "../content/companions";
import {
  ALL_EQUIPMENT_SLOT_IDS,
  DEFAULT_CARGO_SLOTS,
  DEFAULT_CRAFTING_MATERIALS,
  DEFAULT_EQUIPMENT,
  addItemToCargoSlots,
  addCraftingMaterials,
  canItemEquipToSlot,
  calculatePlayerCombatProfile,
  cloneCargoSlots,
  cloneCraftingMaterials,
  cloneEquipmentLoadout,
  cloneInventoryItem,
  createEmptyCargoSlots,
  createEmptyEquipment,
  getCompatibleEquipmentSlots,
  isGearItem,
  summarizeEquippedWeapon,
  type CraftingMaterials,
  type EquipmentLoadout,
  type EquipmentSlotId,
  type InventoryItem,
  type PlayerCombatProfile,
  type RaceId,
} from "../content/items";
import { type MissionRewardBundle } from "../content/loot";
import {
  createDefaultMissionActivityState,
  getMissionContracts,
  type MissionActivityState,
} from "../content/missions";
import {
  DEFAULT_RUN_CONFIG,
  GAME_MODE_RULES,
  type GameModeRules,
  type PlayerCount,
  type RunConfig,
  type SessionType,
} from "./gameModes";

export type GraphicsQuality = "High" | "Balanced" | "Performance";
export type InputModePreference = "Auto" | "Desktop" | "Touch";
export type ResolvedInputMode = "desktop" | "touch";
export type GameplayDifficulty = "Novice" | "Knight" | "Legend" | "Mythic";
export type ControlSensitivity = 60 | 80 | 100 | 120 | 140;

export type DifficultyProfile = {
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;
  enemyCooldown: number;
};

export type RewardData = MissionRewardBundle;
export type ShipTravelStatus = "docked" | "in-transit" | "arrived";
export type ShipSystemId = "hull" | "reactor" | "engines" | "lifeSupport" | "navigation";
export type ShipSystemState = {
  integrity: number;
  online: boolean;
};
export type ShipSystemsState = Record<ShipSystemId, ShipSystemState>;
export type ShipTravelState = {
  status: ShipTravelStatus;
  destinationMissionId: string | null;
  arrivedMissionId: string | null;
  lastDepartureAt: string | null;
  lastArrivalAt: string | null;
};
export type ShipSpacePosition = GalaxyPoint;

export type ShipRepairState = {
  lastInspectionAt: string | null;
  lastRepairAt: string | null;
};
export type ShipStorageState = {
  cargo: Array<InventoryItem | null>;
};
export type ShipState = {
  travel: ShipTravelState;
  systems: ShipSystemsState;
  repair: ShipRepairState;
  storage: ShipStorageState;
  spacePosition: ShipSpacePosition;
};

const SHIP_SYSTEM_IDS: ShipSystemId[] = ["hull", "reactor", "engines", "lifeSupport", "navigation"];
const DEFAULT_SHIP_STORAGE_SLOT_COUNT = 40;
const SHIP_REPAIR_INTEGRITY_COST = 0.35;
const SHIP_REPAIR_OFFLINE_SURCHARGE = 12;
const SHIP_REPAIR_MINIMUM_COST = 8;

function clampShipIntegrity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 100;
  }

  return Phaser.Math.Clamp(Math.round(value), 0, 100);
}

function normalizeOptionalTimestamp(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function createDefaultShipSystemsState(): ShipSystemsState {
  return {
    hull: { integrity: 100, online: true },
    reactor: { integrity: 100, online: true },
    engines: { integrity: 100, online: true },
    lifeSupport: { integrity: 100, online: true },
    navigation: { integrity: 100, online: true },
  };
}

function normalizeShipSystemsState(
  systems: Partial<Record<ShipSystemId, Partial<ShipSystemState>>> | undefined,
): ShipSystemsState {
  const defaults = createDefaultShipSystemsState();

  SHIP_SYSTEM_IDS.forEach((systemId) => {
    const parsed = systems?.[systemId];
    if (!parsed) {
      return;
    }

    const integrity = clampShipIntegrity(parsed.integrity);
    defaults[systemId] = {
      integrity,
      online: typeof parsed.online === "boolean" ? parsed.online && integrity > 0 : integrity > 0,
    };
  });

  return defaults;
}

function normalizeShipTravelState(travel: Partial<ShipTravelState> | undefined): ShipTravelState {
  const destinationMissionId = typeof travel?.destinationMissionId === "string" && travel.destinationMissionId.length > 0
    ? travel.destinationMissionId
    : null;
  const arrivedMissionId = typeof travel?.arrivedMissionId === "string" && travel.arrivedMissionId.length > 0
    ? travel.arrivedMissionId
    : null;

  let status: ShipTravelStatus = travel?.status === "in-transit" || travel?.status === "arrived" || travel?.status === "docked"
    ? travel.status
    : "docked";

  if (status === "in-transit" && !destinationMissionId) {
    status = arrivedMissionId ? "arrived" : "docked";
  } else if (status === "arrived" && !arrivedMissionId) {
    status = destinationMissionId ? "in-transit" : "docked";
  }

  if (status === "docked") {
    return {
      status,
      destinationMissionId: null,
      arrivedMissionId: null,
      lastDepartureAt: normalizeOptionalTimestamp(travel?.lastDepartureAt),
      lastArrivalAt: normalizeOptionalTimestamp(travel?.lastArrivalAt),
    };
  }

  if (status === "in-transit") {
    return {
      status,
      destinationMissionId,
      arrivedMissionId: null,
      lastDepartureAt: normalizeOptionalTimestamp(travel?.lastDepartureAt),
      lastArrivalAt: normalizeOptionalTimestamp(travel?.lastArrivalAt),
    };
  }

  return {
    status,
    destinationMissionId: arrivedMissionId ?? destinationMissionId,
    arrivedMissionId,
    lastDepartureAt: normalizeOptionalTimestamp(travel?.lastDepartureAt),
    lastArrivalAt: normalizeOptionalTimestamp(travel?.lastArrivalAt),
  };
}

function normalizeShipRepairState(repair: Partial<ShipRepairState> | undefined): ShipRepairState {
  return {
    lastInspectionAt: normalizeOptionalTimestamp(repair?.lastInspectionAt),
    lastRepairAt: normalizeOptionalTimestamp(repair?.lastRepairAt),
  };
}

function normalizeShipSpacePosition(
  spacePosition: Partial<ShipSpacePosition> | undefined,
  raceId: RaceId | undefined,
  galaxy?: GalaxyDefinition | undefined,
): ShipSpacePosition {
  const fallback = raceId ? getGalaxySpawnPointForRace(raceId, galaxy) : getDefaultGalaxySpawnPoint(galaxy);
  const x = typeof spacePosition?.x === "number" && Number.isFinite(spacePosition.x) ? spacePosition.x : fallback.x;
  const y = typeof spacePosition?.y === "number" && Number.isFinite(spacePosition.y) ? spacePosition.y : fallback.y;
  return clampPointToGalaxyTravelBounds(Math.round(x), Math.round(y));
}

function createDefaultShipState(raceId?: RaceId, galaxy?: GalaxyDefinition): ShipState {
  return {
    travel: {
      status: "docked",
      destinationMissionId: null,
      arrivedMissionId: null,
      lastDepartureAt: null,
      lastArrivalAt: null,
    },
    systems: createDefaultShipSystemsState(),
    repair: {
      lastInspectionAt: null,
      lastRepairAt: null,
    },
    storage: {
      cargo: createEmptyCargoSlots(DEFAULT_SHIP_STORAGE_SLOT_COUNT),
    },
    spacePosition: normalizeShipSpacePosition(undefined, raceId, galaxy),
  };
}

function rewardHasValue(reward: RewardData | null | undefined): boolean {
  if (!reward) {
    return false;
  }

  return reward.credits > 0
    || reward.xp > 0
    || reward.items.length > 0
    || (reward.materials.alloy ?? 0) > 0
    || (reward.materials.shardDust ?? 0) > 0
    || (reward.materials.filament ?? 0) > 0;
}

export const INPUT_MODE_OPTIONS: InputModePreference[] = ["Auto", "Desktop", "Touch"];
export const DIFFICULTY_OPTIONS: GameplayDifficulty[] = ["Novice", "Knight", "Legend", "Mythic"];

export const DIFFICULTY_PROFILES: Record<GameplayDifficulty, DifficultyProfile> = {
  Novice: {
    enemyHp: 0.82,
    enemyDamage: 0.78,
    enemySpeed: 0.92,
    enemyCooldown: 1.12,
  },
  Knight: {
    enemyHp: 0.9,
    enemyDamage: 0.9,
    enemySpeed: 0.96,
    enemyCooldown: 1.06,
  },
  Legend: {
    enemyHp: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    enemyCooldown: 1,
  },
  Mythic: {
    enemyHp: 1.16,
    enemyDamage: 1.18,
    enemySpeed: 1.08,
    enemyCooldown: 0.9,
  },
};

export type GameSettings = {
  graphics: {
    quality: GraphicsQuality;
    brightness: 90 | 100 | 110;
    screenShake: boolean;
    hitFlash: boolean;
    uiColor: number;
  };
  audio: {
    master: 100 | 80 | 60 | 40 | 20 | 0;
    music: 100 | 80 | 60 | 40 | 20 | 0;
    sfx: 100 | 80 | 60 | 40 | 20 | 0;
  };
  controls: {
    move: "WASD / Touch Stick";
    aim: "Mouse / Stick Facing";
    attack: "LMB Hold / Attack Button";
    pause: "Esc / Pause Button";
    inputMode: InputModePreference;
    autoAim: boolean;
    autoFire: boolean;
    mouseSensitivity: ControlSensitivity;
    touchSensitivity: ControlSensitivity;
  };
  gameplay: {
    difficulty: GameplayDifficulty;
  };
};

export type SaveData = {
  version: 12;
  meta: {
    lastSavedAt: string | null;
  };
  profile: {
    callsign: string;
    raceId: RaceId;
    level: number;
    xp: number;
    credits: number;
  };
  loadout: {
    weapon: string;
    ability: string;
    support: string;
    companion: string;
    squad: SquadAssignment[];
    equipment: EquipmentLoadout;
    cargo: Array<InventoryItem | null>;
    crafting: CraftingMaterials;
  };
  missions: {
    acceptedMissionIds: string[];
    selectedMissionId: string | null;
    activityStates: Record<string, MissionActivityState>;
    liveGrantedMissionIds: string[];
  };
  progression: {
    completedMissionIds: string[];
    exhaustedMissionIds: string[];
    unlockedMissionIds: string[];
  };
  galaxy: GalaxyDefinition;
  war: FactionWarState;
  forces: FactionForceState;
  ship: ShipState;
};

export type SaveSlot = {
  index: number;
  label: string;
  data: SaveData | null;
  isActive: boolean;
};

const SLOT_COUNT = 3;
const LEGACY_SAVE_KEY = "loe-col-save-v1";
const SAVE_SLOTS_KEY = "loe-col-save-slots-v2";
const SETTINGS_KEY = "loe-col-settings-v1";
const DEFAULT_UNLOCKED_MISSION_IDS = getMissionContracts().map((contract) => contract.id);

const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: "High",
    brightness: 100,
    screenShake: true,
    hitFlash: true,
    uiColor: 0x79c9ff,
  },
  audio: {
    master: 100,
    music: 80,
    sfx: 100,
  },
  controls: {
    move: "WASD / Touch Stick",
    aim: "Mouse / Stick Facing",
    attack: "LMB Hold / Attack Button",
    pause: "Esc / Pause Button",
    inputMode: "Auto",
    autoAim: true,
    autoFire: true,
    mouseSensitivity: 100,
    touchSensitivity: 100,
  },
  gameplay: {
    difficulty: "Knight",
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hashSeedFragment(seed: number, fragment: string): number {
  let nextSeed = seed >>> 0;
  for (let index = 0; index < fragment.length; index += 1) {
    nextSeed ^= fragment.charCodeAt(index);
    nextSeed = Math.imul(nextSeed, 16777619);
  }
  return nextSeed >>> 0;
}

function deriveLegacyGalaxySeed(parsed: Partial<SaveData>, raceId: RaceId): number {
  const fragments = [
    parsed.meta?.lastSavedAt ?? "",
    parsed.profile?.callsign ?? "Champion",
    parsed.profile?.raceId ?? raceId,
    `${parsed.profile?.level ?? 1}`,
    `${parsed.profile?.xp ?? 0}`,
    `${parsed.profile?.credits ?? 140}`,
    [...(parsed.missions?.acceptedMissionIds ?? [])].sort().join("|"),
    [...(parsed.progression?.completedMissionIds ?? [])].sort().join("|"),
    [...(parsed.progression?.exhaustedMissionIds ?? [])].sort().join("|"),
  ];

  const hashed = fragments.reduce((seed, fragment) => hashSeedFragment(seed, fragment), 2166136261);
  return hashed === 0 ? 0x41c6_ce57 : hashed;
}

function normalizeMissionActivityState(value: Partial<MissionActivityState> | undefined): MissionActivityState {
  const defaults = createDefaultMissionActivityState();
  return {
    stepIndex: typeof value?.stepIndex === "number" && Number.isFinite(value.stepIndex)
      ? Math.max(0, Math.floor(value.stepIndex))
      : defaults.stepIndex,
    completedStepIds: Array.isArray(value?.completedStepIds)
      ? Array.from(new Set(value.completedStepIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
      : [],
    flags: value?.flags && typeof value.flags === "object" && !Array.isArray(value.flags)
      ? Object.entries(value.flags).reduce<Record<string, string | number | boolean>>((flags, [key, flagValue]) => {
          if (
            typeof flagValue === "string"
            || typeof flagValue === "number"
            || typeof flagValue === "boolean"
          ) {
            flags[key] = flagValue;
          }
          return flags;
        }, {})
      : {},
  };
}

function normalizeMissionActivityStates(value: unknown): Record<string, MissionActivityState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, Partial<MissionActivityState>>)
    .reduce<Record<string, MissionActivityState>>((states, [missionId, state]) => {
      if (typeof missionId === "string" && missionId.length > 0) {
        states[missionId] = normalizeMissionActivityState(state);
      }
      return states;
    }, {});
}

function createDefaultSaveData(galaxySeed = createGalaxySeed()): SaveData {
  const profileRaceId: RaceId = "olydran";
  const galaxy = createGalaxyDefinition(galaxySeed);
  const war = createFactionWarState(galaxy);
  return {
    version: 12,
    meta: {
      lastSavedAt: null,
    },
    profile: {
      callsign: "Champion",
      raceId: profileRaceId,
      level: 1,
      xp: 0,
      credits: 140,
    },
    loadout: {
      weapon: "Unarmed",
      ability: "Pulse Burst",
      support: "Arc Lance",
      companion: "Rook / Sera / Lyra",
      squad: clone([...DEFAULT_SQUAD_ASSIGNMENTS]),
      equipment: cloneEquipmentLoadout(DEFAULT_EQUIPMENT),
      cargo: cloneCargoSlots(DEFAULT_CARGO_SLOTS),
      crafting: cloneCraftingMaterials(DEFAULT_CRAFTING_MATERIALS),
    },
    missions: {
      acceptedMissionIds: [],
      selectedMissionId: null,
      activityStates: {},
      liveGrantedMissionIds: [],
    },
    progression: {
      completedMissionIds: [],
      exhaustedMissionIds: [],
      unlockedMissionIds: [...DEFAULT_UNLOCKED_MISSION_IDS],
    },
    galaxy,
    war,
    forces: createFactionForceState(galaxy, war),
    ship: createDefaultShipState(profileRaceId, galaxy),
  };
}

const DEFAULT_SAVE: SaveData = createDefaultSaveData(0x41c6_ce57);

function createEmptySlots(): Array<SaveData | null> {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

function summarizeSquadAssignments(assignments: SquadAssignment[]): string {
  if (assignments.length === 0) {
    return "No companions assigned";
  }

  return assignments
    .map((assignment) => getCompanionDefinition(assignment.companionId)?.name ?? assignment.companionId)
    .join(" / ");
}

function normalizeSquadAssignments(assignments: SquadAssignment[]): SquadAssignment[] {
  const normalized: SquadAssignment[] = [];
  const seenCompanions = new Set<CompanionId>();
  const seenSlots = new Set<FormationSlotId>();

  assignments.forEach((assignment) => {
    const companion = getCompanionDefinition(assignment.companionId);
    const slot = getFormationSlot(assignment.slotId);
    if (!companion || !slot || seenCompanions.has(companion.id) || seenSlots.has(slot.id) || !canCompanionOccupySlot(companion, slot)) {
      return;
    }

    seenCompanions.add(companion.id);
    seenSlots.add(slot.id);
    normalized.push({
      companionId: companion.id,
      slotId: slot.id,
    });
  });

  return normalized.slice(0, 3);
}

function normalizeEquipmentLoadout(
  equipment: Partial<Record<EquipmentSlotId, unknown>> | undefined,
): EquipmentLoadout {
  const defaults = createEmptyEquipment();
  if (!equipment) {
    return defaults;
  }

  ALL_EQUIPMENT_SLOT_IDS.forEach((slotId) => {
    const value = equipment[slotId];
    defaults[slotId] = isGearItem(value as InventoryItem | null | undefined)
      ? cloneInventoryItem(value as InventoryItem) as typeof defaults[typeof slotId]
      : null;
  });

  return defaults;
}

function normalizeCargoSlots(cargo: unknown[] | undefined, count = DEFAULT_CARGO_SLOTS.length): Array<InventoryItem | null> {
  const defaults = createEmptyCargoSlots(count);
  if (!cargo || cargo.length === 0) {
    return defaults;
  }

  return defaults.map((_, index) => {
    const value = cargo[index];
    if (!value || typeof value !== "object") {
      return null;
    }

    return cloneInventoryItem(value as InventoryItem);
  });
}

function mergeSaveData(parsed: Partial<SaveData>): SaveData {
  const profile = { ...clone(DEFAULT_SAVE.profile), ...parsed.profile };
  const normalizedGalaxy = normalizeGalaxyDefinition(
    parsed.galaxy as Partial<GalaxyDefinition> | undefined,
    deriveLegacyGalaxySeed(parsed, profile.raceId),
  );
  const normalizedWar = normalizeFactionWarState(parsed.war as Partial<FactionWarState> | undefined, normalizedGalaxy);
  const merged = {
    ...clone(DEFAULT_SAVE),
    ...parsed,
    version: 12 as const,
    meta: { ...clone(DEFAULT_SAVE.meta), ...parsed.meta },
    profile,
    loadout: {
      ...clone(DEFAULT_SAVE.loadout),
      ...parsed.loadout,
      equipment: normalizeEquipmentLoadout(parsed.loadout?.equipment as Partial<Record<EquipmentSlotId, unknown>> | undefined),
      crafting: { ...clone(DEFAULT_SAVE.loadout.crafting), ...parsed.loadout?.crafting },
      cargo: normalizeCargoSlots(parsed.loadout?.cargo),
    },
    missions: {
      ...clone(DEFAULT_SAVE.missions),
      ...parsed.missions,
      activityStates: normalizeMissionActivityStates(parsed.missions?.activityStates),
      liveGrantedMissionIds: Array.from(new Set((parsed.missions?.liveGrantedMissionIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0))),
    },
    progression: {
      ...clone(DEFAULT_SAVE.progression),
      ...parsed.progression,
      unlockedMissionIds: Array.from(new Set([
        ...DEFAULT_UNLOCKED_MISSION_IDS,
        ...(parsed.progression?.unlockedMissionIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0),
      ])),
    },
    galaxy: normalizedGalaxy,
    war: normalizedWar,
    forces: normalizeFactionForceState(parsed.forces as Partial<FactionForceState> | undefined, normalizedGalaxy, normalizedWar),
    ship: {
      ...createDefaultShipState(profile.raceId, normalizedGalaxy),
      ...parsed.ship,
      travel: normalizeShipTravelState(parsed.ship?.travel),
      systems: normalizeShipSystemsState(parsed.ship?.systems as Partial<Record<ShipSystemId, Partial<ShipSystemState>>> | undefined),
      repair: normalizeShipRepairState(parsed.ship?.repair),
      storage: {
        cargo: normalizeCargoSlots(parsed.ship?.storage?.cargo, DEFAULT_SHIP_STORAGE_SLOT_COUNT),
      },
      spacePosition: normalizeShipSpacePosition(
        parsed.ship?.spacePosition as Partial<ShipSpacePosition> | undefined,
        profile.raceId,
        normalizedGalaxy,
      ),
    },
  };

  const normalizedSquad = normalizeSquadAssignments(merged.loadout.squad ?? DEFAULT_SAVE.loadout.squad);
  const validMissionIds = new Set(DEFAULT_UNLOCKED_MISSION_IDS);
  const acceptedMissionIds = Array.from(new Set((merged.missions.acceptedMissionIds ?? []).filter((id) => Boolean(id) && validMissionIds.has(id))));
  const selectedMissionId = merged.missions.selectedMissionId && acceptedMissionIds.includes(merged.missions.selectedMissionId)
    ? merged.missions.selectedMissionId
    : null;

  merged.loadout.squad = normalizedSquad;
  merged.loadout.companion = summarizeSquadAssignments(normalizedSquad);
  merged.loadout.weapon = summarizeEquippedWeapon(merged.loadout.equipment);
  merged.missions.acceptedMissionIds = acceptedMissionIds;
  merged.missions.selectedMissionId = selectedMissionId;
  merged.missions.liveGrantedMissionIds = Array.from(new Set((merged.missions.liveGrantedMissionIds ?? []).filter((id) => validMissionIds.has(id))));
  merged.missions.activityStates = Object.fromEntries(
    Object.entries(merged.missions.activityStates ?? {}).filter(([missionId]) => validMissionIds.has(missionId)),
  );
  merged.progression.completedMissionIds = Array.from(new Set((merged.progression.completedMissionIds ?? []).filter((id) => validMissionIds.has(id))));
  merged.progression.exhaustedMissionIds = Array.from(new Set((merged.progression.exhaustedMissionIds ?? []).filter((id) => validMissionIds.has(id))));
  return merged;
}

function sortByMostRecent(slots: Array<SaveData | null>): number | null {
  let bestIndex: number | null = null;
  let bestTime = -1;

  slots.forEach((slot, index) => {
    const lastSavedAt = slot?.meta.lastSavedAt;
    const timestamp = lastSavedAt ? Date.parse(lastSavedAt) : Number.NaN;
    if (!Number.isFinite(timestamp) || timestamp <= bestTime) {
      return;
    }

    bestTime = timestamp;
    bestIndex = index;
  });

  return bestIndex;
}

export class GameSession extends Phaser.Events.EventEmitter {
  settings: GameSettings = clone(DEFAULT_SETTINGS);
  saveData: SaveData = clone(DEFAULT_SAVE);
  runConfig: RunConfig = clone(DEFAULT_RUN_CONFIG);
  activeMissionId: string | null = null;
  pendingReward: RewardData | null = null;
  private activeSlotIndex = 0;
  private saveSlots: Array<SaveData | null> = createEmptySlots();
  private hasTouchInput = false;
  private prefersCoarsePointer = false;
  private lastInputMode: ResolvedInputMode = "desktop";

  get acceptedMissionId(): string | null {
    return this.getSelectedMissionId();
  }

  bootstrap(): void {
    this.loadSettings();
    this.loadSaveSlots();

    const latestSlot = sortByMostRecent(this.saveSlots);
    if (latestSlot !== null) {
      this.loadSave(latestSlot);
      return;
    }

    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.activeSlotIndex = 0;
    this.saveData = clone(DEFAULT_SAVE);
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
    this.emit("slots-changed", this.getSaveSlots());
  }

  getSaveSlots(): SaveSlot[] {
    return this.saveSlots.map((slot, index) => ({
      index,
      label: `Slot ${index + 1}`,
      data: slot ? clone(slot) : null,
      isActive: index === this.activeSlotIndex,
    }));
  }

  getActiveSlotIndex(): number {
    return this.activeSlotIndex;
  }

  getRunConfig(): RunConfig {
    return clone(this.runConfig);
  }

  getModeRules(mode = this.runConfig.mode): GameModeRules {
    return GAME_MODE_RULES[mode];
  }

  configureRun(nextConfig: Partial<RunConfig>): void {
    const mode = nextConfig.mode ?? this.runConfig.mode;
    const modeRules = GAME_MODE_RULES[mode];
    const sessionType = nextConfig.sessionType ?? this.runConfig.sessionType;
    const requestedPlayerCount = nextConfig.playerCount ?? this.runConfig.playerCount;
    const clampedPlayerCount = Phaser.Math.Clamp(requestedPlayerCount, 1, modeRules.maxPlayers) as PlayerCount;
    const resolvedPlayerCount = mode === "story" ? 1 : clampedPlayerCount;
    const resolvedSessionType: SessionType = resolvedPlayerCount === 1 ? "solo" : sessionType;

    this.runConfig = {
      mode,
      sessionType: resolvedSessionType,
      playerCount: resolvedPlayerCount,
    };

    this.emit("run-config-changed", this.getRunConfig());
  }

  configureDeviceContext(hasTouchInput: boolean, prefersCoarsePointer: boolean): void {
    const previousMode = this.getResolvedInputMode();
    this.hasTouchInput = hasTouchInput;
    this.prefersCoarsePointer = prefersCoarsePointer;

    if (!hasTouchInput) {
      this.lastInputMode = "desktop";
    } else if (this.settings.controls.inputMode === "Auto") {
      this.lastInputMode = prefersCoarsePointer ? "touch" : this.lastInputMode;
    }

    const resolvedMode = this.getResolvedInputMode();
    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  getResolvedInputMode(hasTouchInput = this.hasTouchInput): ResolvedInputMode {
    if (!hasTouchInput) {
      return "desktop";
    }

    if (this.settings.controls.inputMode === "Desktop") {
      return "desktop";
    }

    if (this.settings.controls.inputMode === "Touch") {
      return "touch";
    }

    return this.prefersCoarsePointer ? "touch" : this.lastInputMode;
  }

  shouldUseTouchUi(hasTouchInput = this.hasTouchInput): boolean {
    return hasTouchInput && this.getResolvedInputMode(hasTouchInput) === "touch";
  }

  reportInputMode(mode: ResolvedInputMode, hasTouchInput = this.hasTouchInput): void {
    if (mode === "touch" && !hasTouchInput) {
      return;
    }

    const previousMode = this.getResolvedInputMode(hasTouchInput);
    this.lastInputMode = mode;
    const resolvedMode = this.getResolvedInputMode(hasTouchInput);

    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  getDifficultyProfile(): DifficultyProfile {
    return DIFFICULTY_PROFILES[this.settings.gameplay.difficulty];
  }

  getSquadAssignments(): SquadAssignment[] {
    return clone(this.saveData.loadout.squad);
  }

  getSelectedCompanions(): Array<{ companion: CompanionDefinition; slotId: FormationSlotId }> {
    return this.getSquadAssignments()
      .map((assignment) => {
        const companion = getCompanionDefinition(assignment.companionId);
        if (!companion) {
          return null;
        }

        return {
          companion,
          slotId: assignment.slotId,
        };
      })
      .filter((entry): entry is { companion: CompanionDefinition; slotId: FormationSlotId } => entry !== null);
  }

  setSquadAssignments(assignments: SquadAssignment[]): boolean {
    const normalized = normalizeSquadAssignments(assignments);
    this.saveData.loadout.squad = normalized;
    this.saveData.loadout.companion = summarizeSquadAssignments(normalized);
    this.emit("save-changed", this.saveData);
    return true;
  }

  getEquipmentLoadout(): EquipmentLoadout {
    return cloneEquipmentLoadout(this.saveData.loadout.equipment);
  }

  getCargoSlots(): Array<InventoryItem | null> {
    return cloneCargoSlots(this.saveData.loadout.cargo);
  }

  getCraftingMaterials(): CraftingMaterials {
    return cloneCraftingMaterials(this.saveData.loadout.crafting);
  }

  getShipState(): ShipState {
    return clone(this.saveData.ship);
  }

  getShipTravelState(): ShipTravelState {
    return clone(this.saveData.ship.travel);
  }

  getTrackedMissionId(): string | null {
    return this.activeMissionId
      ?? this.saveData.ship.travel.arrivedMissionId
      ?? this.saveData.ship.travel.destinationMissionId
      ?? this.getSelectedMissionId();
  }

  getGalaxyDefinition(): GalaxyDefinition {
    return clone(this.saveData.galaxy);
  }

  setGalaxyDefinition(galaxy: GalaxyDefinition, emit = false): void {
    this.saveData.galaxy = normalizeGalaxyDefinition(galaxy, galaxy.seed);
    this.saveData.war = normalizeFactionWarState(this.saveData.war, this.saveData.galaxy);
    this.saveData.forces = normalizeFactionForceState(this.saveData.forces, this.saveData.galaxy, this.saveData.war);
    if (emit) {
      this.emit("save-changed", this.saveData);
    }
  }

  getFactionWarState(): FactionWarState {
    return clone(this.saveData.war);
  }

  setFactionWarState(warState: FactionWarState, emit = false): void {
    this.saveData.war = normalizeFactionWarState(warState, this.saveData.galaxy);
    this.saveData.forces = normalizeFactionForceState(this.saveData.forces, this.saveData.galaxy, this.saveData.war);
    if (emit) {
      this.emit("save-changed", this.saveData);
    }
  }

  getFactionForceState(): FactionForceState {
    return clone(this.saveData.forces);
  }

  setFactionForceState(forceState: FactionForceState, emit = false): void {
    this.saveData.forces = normalizeFactionForceState(forceState, this.saveData.galaxy, this.saveData.war);
    if (emit) {
      this.emit("save-changed", this.saveData);
    }
  }

  getGalaxyStations(): GalaxyStationRecord[] {
    return this.saveData.galaxy.stations.map((station) => ({ ...station }));
  }

  getGalaxyStationById(stationId: string): GalaxyStationRecord | null {
    const station = getGalaxyStationByIdFromGalaxy(this.saveData.galaxy, stationId);
    return station ? { ...station } : null;
  }

  getGalaxyZones(): GalaxyZoneRecord[] {
    return this.saveData.galaxy.zones.map((zone) => ({ ...zone }));
  }

  getGalaxyZoneById(zoneId: string): GalaxyZoneRecord | null {
    const zone = getGalaxyZoneByIdFromGalaxy(this.saveData.galaxy, zoneId);
    return zone ? { ...zone } : null;
  }

  getGalaxyZoneBySystemId(systemId: string): GalaxyZoneRecord | null {
    const zone = getGalaxyZoneBySystemIdFromGalaxy(this.saveData.galaxy, systemId);
    return zone ? { ...zone } : null;
  }

  getMissionPlanetForMission(missionId = this.getTrackedMissionId(), orbitTimeMs = 0): GalaxyMissionPlanet | null {
    const missionPlanet = getMissionPlanetForMissionFromGalaxy(missionId, this.saveData.galaxy, orbitTimeMs);
    return missionPlanet ? clone(missionPlanet) : null;
  }

  getHomeworldPlanetByRace(raceId = this.getPlayerRaceId()): GalaxyPlanetRecord | null {
    const homeworld = getGalaxyHomeworldByRace(this.saveData.galaxy, raceId);
    if (!homeworld) {
      return null;
    }

    const planet = getGalaxyPlanetById(this.saveData.galaxy, homeworld.planetId);
    return planet ? clone(planet) : null;
  }

  getHomeworldPlanets(): GalaxyPlanetRecord[] {
    return clone(getGalaxyHomeworldPlanets(this.saveData.galaxy));
  }

  getShipSpacePosition(): ShipSpacePosition {
    return { ...this.saveData.ship.spacePosition };
  }

  setShipSpacePosition(x: number, y: number): ShipSpacePosition {
    this.saveData.ship.spacePosition = clampPointToGalaxyTravelBounds(Math.round(x), Math.round(y));
    return this.getShipSpacePosition();
  }

  resetShipSpacePosition(): ShipSpacePosition {
    this.saveData.ship.spacePosition = getGalaxySpawnPointForRace(this.saveData.profile.raceId, this.saveData.galaxy);
    return this.getShipSpacePosition();
  }

  getArrivedMissionId(): string | null {
    return this.saveData.ship.travel.arrivedMissionId;
  }

  canDeployArrivedMission(missionId = this.getSelectedMissionId()): boolean {
    return Boolean(
      missionId
      && this.saveData.ship.travel.status === "arrived"
      && this.saveData.ship.travel.arrivedMissionId === missionId,
    );
  }

  startShipTravel(missionId: string): boolean {
    if (!missionId) {
      return false;
    }

    this.saveData.ship.travel = {
      ...this.saveData.ship.travel,
      status: "in-transit",
      destinationMissionId: missionId,
      arrivedMissionId: null,
      lastDepartureAt: new Date().toISOString(),
    };
    this.emitShipTravelChanged();
    return true;
  }

  markShipArrived(missionId = this.saveData.ship.travel.destinationMissionId): boolean {
    if (!missionId) {
      return false;
    }

    this.saveData.ship.travel = {
      ...this.saveData.ship.travel,
      status: "arrived",
      destinationMissionId: missionId,
      arrivedMissionId: missionId,
      lastArrivalAt: new Date().toISOString(),
    };
    this.emitShipTravelChanged();
    return true;
  }

  clearShipTravel(): void {
    this.setShipDockedState();
    this.emitShipTravelChanged();
  }

  getShipSystemsState(): ShipSystemsState {
    return clone(this.saveData.ship.systems);
  }

  getDamagedShipSystemIds(): ShipSystemId[] {
    return SHIP_SYSTEM_IDS.filter((systemId) => {
      const system = this.saveData.ship.systems[systemId];
      return system.integrity < 100 || !system.online;
    });
  }

  hasShipSystemDamage(systemId?: ShipSystemId): boolean {
    if (systemId) {
      const system = this.saveData.ship.systems[systemId];
      return system.integrity < 100 || !system.online;
    }

    return this.getDamagedShipSystemIds().length > 0;
  }

  getCredits(): number {
    return this.saveData.profile.credits;
  }

  canAffordCredits(amount: number): boolean {
    return this.saveData.profile.credits >= Math.max(0, Math.round(amount));
  }

  spendCredits(amount: number): boolean {
    const safeAmount = Math.max(0, Math.round(amount));
    if (safeAmount <= 0) {
      return true;
    }
    if (!this.canAffordCredits(safeAmount)) {
      return false;
    }

    this.saveData.profile.credits -= safeAmount;
    this.emit("save-changed", this.saveData);
    return true;
  }

  getShipRepairCost(): number {
    if (!this.hasShipSystemDamage()) {
      return 0;
    }

    let missingIntegrity = 0;
    let offlineSystems = 0;
    SHIP_SYSTEM_IDS.forEach((systemId) => {
      const system = this.saveData.ship.systems[systemId];
      missingIntegrity += Math.max(0, 100 - system.integrity);
      if (!system.online) {
        offlineSystems += 1;
      }
    });

    const calculatedCost = Math.ceil(missingIntegrity * SHIP_REPAIR_INTEGRITY_COST) + (offlineSystems * SHIP_REPAIR_OFFLINE_SURCHARGE);
    return Math.max(SHIP_REPAIR_MINIMUM_COST, calculatedCost);
  }

  inspectShipSystems(): void {
    this.saveData.ship.repair.lastInspectionAt = new Date().toISOString();
    this.emitShipChanged();
  }

  setShipSystemIntegrity(systemId: ShipSystemId, integrity: number): number {
    const nextIntegrity = clampShipIntegrity(integrity);
    const system = this.saveData.ship.systems[systemId];
    system.integrity = nextIntegrity;
    if (nextIntegrity === 0) {
      system.online = false;
    }
    this.emitShipChanged();
    return nextIntegrity;
  }

  setShipSystemOnline(systemId: ShipSystemId, online: boolean): void {
    const system = this.saveData.ship.systems[systemId];
    system.online = system.integrity > 0 ? online : false;
    this.emitShipChanged();
  }

  repairShipSystem(systemId: ShipSystemId): void {
    this.saveData.ship.systems[systemId] = {
      integrity: 100,
      online: true,
    };
    this.saveData.ship.repair.lastRepairAt = new Date().toISOString();
    this.emitShipChanged();
  }

  repairAllShipSystems(): void {
    SHIP_SYSTEM_IDS.forEach((systemId) => {
      this.saveData.ship.systems[systemId] = {
        integrity: 100,
        online: true,
      };
    });
    this.saveData.ship.repair.lastRepairAt = new Date().toISOString();
    this.emitShipChanged();
  }

  repairAllShipSystemsForCredits(): { success: boolean; cost: number } {
    const cost = this.getShipRepairCost();
    if (cost <= 0) {
      return { success: true, cost: 0 };
    }
    if (!this.canAffordCredits(cost)) {
      return { success: false, cost };
    }

    this.saveData.profile.credits -= cost;
    SHIP_SYSTEM_IDS.forEach((systemId) => {
      this.saveData.ship.systems[systemId] = {
        integrity: 100,
        online: true,
      };
    });
    this.saveData.ship.repair.lastRepairAt = new Date().toISOString();
    this.emitShipChanged();
    return { success: true, cost };
  }

  getShipStorageSlots(): Array<InventoryItem | null> {
    return cloneCargoSlots(this.saveData.ship.storage.cargo);
  }

  addItemToShipStorage(item: InventoryItem): boolean {
    const success = addItemToCargoSlots(this.saveData.ship.storage.cargo, item);
    if (!success) {
      return false;
    }

    this.emitShipChanged();
    return true;
  }

  storeCargoItem(cargoIndex: number): boolean {
    const cargo = this.saveData.loadout.cargo;
    if (cargoIndex < 0 || cargoIndex >= cargo.length) {
      return false;
    }

    const item = cargo[cargoIndex];
    if (!item) {
      return false;
    }

    const success = addItemToCargoSlots(this.saveData.ship.storage.cargo, item);
    if (!success) {
      return false;
    }

    cargo[cargoIndex] = null;
    this.emitShipChanged();
    return true;
  }

  retrieveShipStorageItem(storageIndex: number): boolean {
    const storage = this.saveData.ship.storage.cargo;
    if (storageIndex < 0 || storageIndex >= storage.length) {
      return false;
    }

    const item = storage[storageIndex];
    if (!item) {
      return false;
    }

    const success = addItemToCargoSlots(this.saveData.loadout.cargo, item);
    if (!success) {
      return false;
    }

    storage[storageIndex] = null;
    this.emitShipChanged();
    return true;
  }

  dropShipStorageItem(storageIndex: number): boolean {
    const storage = this.saveData.ship.storage.cargo;
    if (storageIndex < 0 || storageIndex >= storage.length || storage[storageIndex] === null) {
      return false;
    }

    storage[storageIndex] = null;
    this.emitShipChanged();
    return true;
  }

  getPlayerRaceId(): RaceId {
    return this.saveData.profile.raceId;
  }

  getPlayerCombatProfile(): PlayerCombatProfile {
    return calculatePlayerCombatProfile(this.saveData.loadout.equipment);
  }

  addItemToCargo(item: InventoryItem): boolean {
    const cargo = this.saveData.loadout.cargo;
    const success = addItemToCargoSlots(cargo, item);
    if (!success) {
      return false;
    }

    this.emit("save-changed", this.saveData);
    return true;
  }

  equipCargoItemToSlot(cargoIndex: number, slotId: EquipmentSlotId): boolean {
    const cargo = this.saveData.loadout.cargo;
    if (cargoIndex < 0 || cargoIndex >= cargo.length) {
      return false;
    }

    const item = cargo[cargoIndex];
    if (!item || !canItemEquipToSlot(item, slotId)) {
      return false;
    }

    const equippedItem = this.saveData.loadout.equipment[slotId];
    this.saveData.loadout.equipment[slotId] = cloneInventoryItem(item) as typeof equippedItem;
    cargo[cargoIndex] = equippedItem ?? null;
    this.syncLoadoutSummary();
    this.emit("save-changed", this.saveData);
    return true;
  }

  autoEquipCargoItem(cargoIndex: number): EquipmentSlotId | null {
    const cargo = this.saveData.loadout.cargo;
    if (cargoIndex < 0 || cargoIndex >= cargo.length) {
      return null;
    }

    const item = cargo[cargoIndex];
    if (!isGearItem(item)) {
      return null;
    }

    const compatibleSlots = getCompatibleEquipmentSlots(item).map((slot) => slot.id);
    if (compatibleSlots.length === 0) {
      return null;
    }

    const preferredSlots = item.slot.startsWith("accessory")
      ? compatibleSlots
      : [item.slot, ...compatibleSlots.filter((slotId) => slotId !== item.slot)];
    const emptySlot = preferredSlots.find((slotId) => this.saveData.loadout.equipment[slotId] === null) ?? preferredSlots[0];
    return this.equipCargoItemToSlot(cargoIndex, emptySlot) ? emptySlot : null;
  }

  unequipItemFromSlot(slotId: EquipmentSlotId): boolean {
    const item = this.saveData.loadout.equipment[slotId];
    if (!item) {
      return false;
    }

    const success = this.addItemToCargo(item);
    if (!success) {
      return false;
    }

    this.saveData.loadout.equipment[slotId] = null;
    this.syncLoadoutSummary();
    this.emit("save-changed", this.saveData);
    return true;
  }

  dropCargoItem(cargoIndex: number): boolean {
    const cargo = this.saveData.loadout.cargo;
    if (cargoIndex < 0 || cargoIndex >= cargo.length || cargo[cargoIndex] === null) {
      return false;
    }

    cargo[cargoIndex] = null;
    this.emit("save-changed", this.saveData);
    return true;
  }

  dropEquippedItem(slotId: EquipmentSlotId): boolean {
    if (!this.saveData.loadout.equipment[slotId]) {
      return false;
    }

    this.saveData.loadout.equipment[slotId] = null;
    this.syncLoadoutSummary();
    this.emit("save-changed", this.saveData);
    return true;
  }

  getAcceptedMissionIds(): string[] {
    return [...this.saveData.missions.acceptedMissionIds];
  }

  getSelectedMissionId(): string | null {
    return this.saveData.missions.selectedMissionId;
  }

  getMissionActivityState(missionId: string): MissionActivityState {
    return clone(this.saveData.missions.activityStates[missionId] ?? createDefaultMissionActivityState());
  }

  setMissionActivityState(missionId: string, state: MissionActivityState, emit = false): void {
    if (!missionId) {
      return;
    }

    this.saveData.missions.activityStates[missionId] = normalizeMissionActivityState(state);
    if (emit) {
      this.emit("save-changed", this.saveData);
    }
  }

  advanceMissionActivityStep(missionId: string, completedStepId: string): MissionActivityState {
    const state = this.saveData.missions.activityStates[missionId] ?? createDefaultMissionActivityState();
    const completedStepIds = new Set(state.completedStepIds);
    completedStepIds.add(completedStepId);
    const nextState = normalizeMissionActivityState({
      ...state,
      stepIndex: state.stepIndex + 1,
      completedStepIds: [...completedStepIds],
    });
    this.saveData.missions.activityStates[missionId] = nextState;
    this.emit("save-changed", this.saveData);
    return clone(nextState);
  }

  resetMissionActivityState(missionId: string, emit = false): void {
    delete this.saveData.missions.activityStates[missionId];
    if (emit) {
      this.emit("save-changed", this.saveData);
    }
  }

  isLiveMissionGranted(missionId: string): boolean {
    return this.saveData.missions.liveGrantedMissionIds.includes(missionId);
  }

  grantLiveMission(missionId: string): boolean {
    if (
      !this.isMissionUnlocked(missionId)
      || this.isMissionExhausted(missionId)
      || this.isMissionCompleted(missionId)
    ) {
      return false;
    }

    const liveGranted = new Set(this.saveData.missions.liveGrantedMissionIds);
    liveGranted.add(missionId);
    this.saveData.missions.liveGrantedMissionIds = [...liveGranted];

    const accepted = new Set(this.saveData.missions.acceptedMissionIds);
    accepted.add(missionId);
    this.saveData.missions.acceptedMissionIds = [...accepted];
    this.emit("save-changed", this.saveData);
    this.emit("mission-accepted", missionId);
    return true;
  }

  getCompletedMissionIds(): string[] {
    return [...this.saveData.progression.completedMissionIds];
  }

  isMissionUnlocked(missionId: string): boolean {
    return this.saveData.progression.unlockedMissionIds.includes(missionId);
  }

  isMissionAccepted(missionId: string): boolean {
    return this.saveData.missions.acceptedMissionIds.includes(missionId);
  }

  isMissionCompleted(missionId: string): boolean {
    return this.saveData.progression.completedMissionIds.includes(missionId);
  }

  isMissionExhausted(missionId: string): boolean {
    return this.saveData.progression.exhaustedMissionIds.includes(missionId);
  }

  acceptMission(missionId: string): void {
    if (!this.isMissionUnlocked(missionId) || this.isMissionExhausted(missionId)) {
      return;
    }

    const accepted = new Set(this.saveData.missions.acceptedMissionIds);
    accepted.add(missionId);
    this.saveData.missions.acceptedMissionIds = [...accepted];

    this.emit("save-changed", this.saveData);
    this.emit("mission-accepted", missionId);
  }

  acceptAllMissions(missionIds: string[]): void {
    const accepted = new Set(this.saveData.missions.acceptedMissionIds);
    missionIds.forEach((missionId) => {
      if (this.isMissionUnlocked(missionId) && !this.isMissionExhausted(missionId)) {
        accepted.add(missionId);
      }
    });

    this.saveData.missions.acceptedMissionIds = [...accepted];
    this.emit("save-changed", this.saveData);
    this.emit("mission-accepted", null);
  }

  setSelectedMission(missionId: string | null): boolean {
    if (missionId === null) {
      this.saveData.missions.selectedMissionId = null;
      this.emit("save-changed", this.saveData);
      return true;
    }

    if (!this.saveData.missions.acceptedMissionIds.includes(missionId)) {
      return false;
    }

    this.saveData.missions.selectedMissionId = missionId;
    this.emit("save-changed", this.saveData);
    return true;
  }

  abandonAcceptedMission(missionId: string): boolean {
    if (!this.saveData.missions.acceptedMissionIds.includes(missionId)) {
      return false;
    }

    this.saveData.missions.acceptedMissionIds = this.saveData.missions.acceptedMissionIds.filter((id) => id !== missionId);
    if (this.saveData.missions.selectedMissionId === missionId) {
      this.saveData.missions.selectedMissionId = null;
    }
    delete this.saveData.missions.activityStates[missionId];
    if (this.clearShipTravelForMission(missionId)) {
      this.emitShipTravelChanged();
      return true;
    }

    this.emit("save-changed", this.saveData);
    return true;
  }

  getPreferredNewGameSlot(): number {
    return this.firstEmptySlotOrActive();
  }

  startNewGame(slotIndex = this.firstEmptySlotOrActive()): void {
    this.activeSlotIndex = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.saveData = createDefaultSaveData();
    this.saveData.ship = createDefaultShipState(this.saveData.profile.raceId, this.saveData.galaxy);
    this.activeMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
    this.emit("slots-changed", this.getSaveSlots());
  }

  hasSaveData(slotIndex?: number): boolean {
    if (slotIndex !== undefined) {
      return this.saveSlots[slotIndex] !== null;
    }

    return this.saveSlots.some((slot) => slot !== null);
  }

  saveToDisk(slotIndex = this.activeSlotIndex): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const safeSlot = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);

    try {
      this.activeSlotIndex = safeSlot;
      this.saveData.meta.lastSavedAt = new Date().toISOString();
      this.saveSlots[safeSlot] = clone(this.saveData);
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(this.saveSlots));
      this.emit("save-changed", this.saveData);
      this.emit("slots-changed", this.getSaveSlots());
      return true;
    } catch {
      return false;
    }
  }

  loadSave(slotIndex = this.activeSlotIndex): boolean {
    const safeSlot = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    const slot = this.saveSlots[safeSlot];
    if (!slot) {
      return false;
    }

    this.saveData = mergeSaveData(slot);
    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.activeSlotIndex = safeSlot;
    this.activeMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
    this.emit("slots-changed", this.getSaveSlots());
    return true;
  }

  deleteSave(slotIndex = this.activeSlotIndex): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const safeSlot = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    if (!this.saveSlots[safeSlot]) {
      return false;
    }

    try {
      this.saveSlots[safeSlot] = null;
      if (this.activeSlotIndex === safeSlot) {
        const latestSlot = sortByMostRecent(this.saveSlots);
        this.activeSlotIndex = latestSlot ?? safeSlot;
      }
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(this.saveSlots));
      this.emit("slots-changed", this.getSaveSlots());
      return true;
    } catch {
      return false;
    }
  }

  startMission(missionId: string): void {
    this.activeMissionId = missionId;
    this.saveData.missions.acceptedMissionIds = this.saveData.missions.acceptedMissionIds.filter((id) => id !== missionId);
    if (this.saveData.missions.selectedMissionId === missionId) {
      this.saveData.missions.selectedMissionId = null;
    }
    this.emit("save-changed", this.saveData);
    this.emit("mission-started", missionId);
  }

  completeMission(missionId: string, reward: RewardData): void {
    this.activeMissionId = null;
    this.saveData.missions.acceptedMissionIds = this.saveData.missions.acceptedMissionIds.filter((id) => id !== missionId);
    if (this.saveData.missions.selectedMissionId === missionId) {
      this.saveData.missions.selectedMissionId = null;
    }
    delete this.saveData.missions.activityStates[missionId];

    if (!this.saveData.progression.completedMissionIds.includes(missionId)) {
      this.saveData.progression.completedMissionIds.push(missionId);
    }
    if (!this.saveData.progression.exhaustedMissionIds.includes(missionId)) {
      this.saveData.progression.exhaustedMissionIds.push(missionId);
    }

    this.saveData.profile.credits += reward.credits;
    this.saveData.profile.xp += reward.xp;
    this.saveData.profile.level = 1 + Math.floor(this.saveData.profile.xp / 160);
    this.saveData.loadout.crafting = addCraftingMaterials(this.saveData.loadout.crafting, reward.materials);
    reward.items.forEach((item) => {
      this.addItemToCargo(item);
    });
    this.pendingReward = clone(reward);
    if (this.clearShipTravelForMission(missionId)) {
      this.emitShipTravelChanged();
      return;
    }

    this.emit("save-changed", this.saveData);
  }

  extractMissionLoot(reward: RewardData): void {
    this.activeMissionId = null;
    this.saveData.profile.credits += reward.credits;
    this.saveData.loadout.crafting = addCraftingMaterials(this.saveData.loadout.crafting, reward.materials);
    reward.items.forEach((item) => {
      this.addItemToCargo(item);
    });
    this.pendingReward = rewardHasValue(reward) ? clone(reward) : null;
    this.emit("save-changed", this.saveData);
  }

  refreshMissionBoard(): void {
    this.saveData.progression.exhaustedMissionIds = [];
    this.saveData.progression.unlockedMissionIds = [...DEFAULT_UNLOCKED_MISSION_IDS];
    this.emit("save-changed", this.saveData);
  }

  leaveMission(options?: { missionId?: string | null; requeue?: boolean; preservePendingReward?: boolean }): void {
    const missionId = options?.missionId ?? this.activeMissionId;
    this.activeMissionId = null;
    if (!options?.preservePendingReward) {
      this.pendingReward = null;
    }
    let shipTravelChanged = false;

    if (options?.requeue && missionId) {
      this.saveData.missions.acceptedMissionIds = [
        missionId,
        ...this.saveData.missions.acceptedMissionIds.filter((id) => id !== missionId),
      ];
      this.saveData.missions.selectedMissionId = missionId;
    } else if (missionId) {
      shipTravelChanged = this.clearShipTravelForMission(missionId);
    }

    if (options?.requeue && missionId) {
      this.emit("save-changed", this.saveData);
    } else if (shipTravelChanged) {
      this.emitShipTravelChanged();
    }

    this.emit("mission-left", {
      missionId,
      requeue: Boolean(options?.requeue && missionId),
    });
  }

  consumePendingReward(): RewardData | null {
    const reward = this.pendingReward;
    this.pendingReward = null;
    return reward;
  }

  persistSettings(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.emit("settings-changed", this.settings);
      return true;
    } catch {
      return false;
    }
  }

  setGraphicsQuality(value: GraphicsQuality): void {
    this.settings.graphics.quality = value;
    this.persistSettings();
  }

  setBrightness(value: 90 | 100 | 110): void {
    this.settings.graphics.brightness = value;
    this.persistSettings();
  }

  setScreenShake(value: boolean): void {
    this.settings.graphics.screenShake = value;
    this.persistSettings();
  }

  setHitFlash(value: boolean): void {
    this.settings.graphics.hitFlash = value;
    this.persistSettings();
  }

  setUiColor(value: number): void {
    this.settings.graphics.uiColor = value;
    this.persistSettings();
  }

  setAudioValue(key: keyof GameSettings["audio"], value: 100 | 80 | 60 | 40 | 20 | 0): void {
    this.settings.audio[key] = value;
    this.persistSettings();
  }

  setInputMode(value: InputModePreference): void {
    const previousMode = this.getResolvedInputMode();
    this.settings.controls.inputMode = value;
    this.persistSettings();

    const resolvedMode = this.getResolvedInputMode();
    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  setAutoAim(value: boolean): void {
    this.settings.controls.autoAim = value;
    this.persistSettings();
  }

  setAutoFire(value: boolean): void {
    this.settings.controls.autoFire = value;
    this.persistSettings();
  }

  setMouseSensitivity(value: ControlSensitivity): void {
    this.settings.controls.mouseSensitivity = value;
    this.persistSettings();
  }

  setTouchSensitivity(value: ControlSensitivity): void {
    this.settings.controls.touchSensitivity = value;
    this.persistSettings();
  }

  setDifficulty(value: GameplayDifficulty): void {
    this.settings.gameplay.difficulty = value;
    this.persistSettings();
  }

  private emitShipChanged(): void {
    this.emit("ship-changed", this.getShipState());
    this.emit("save-changed", this.saveData);
  }

  private emitShipTravelChanged(): void {
    this.emit("ship-travel-changed", this.getShipTravelState());
    this.emitShipChanged();
  }

  private setShipDockedState(): void {
    this.saveData.ship.travel = {
      ...this.saveData.ship.travel,
      status: "docked",
      destinationMissionId: null,
      arrivedMissionId: null,
    };
  }

  private clearShipTravelForMission(missionId: string | null | undefined): boolean {
    if (!missionId) {
      return false;
    }

    if (
      this.saveData.ship.travel.destinationMissionId !== missionId
      && this.saveData.ship.travel.arrivedMissionId !== missionId
    ) {
      return false;
    }

    this.setShipDockedState();
    return true;
  }

  private syncLoadoutSummary(): void {
    this.saveData.loadout.weapon = summarizeEquippedWeapon(this.saveData.loadout.equipment);
  }

  private loadSaveSlots(): void {
    if (typeof window === "undefined") {
      this.saveSlots = createEmptySlots();
      return;
    }

    const raw = window.localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) {
      this.migrateLegacySave();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Array<Partial<SaveData> | null>;
      const normalized = createEmptySlots();
      parsed.slice(0, SLOT_COUNT).forEach((slot, index) => {
        normalized[index] = slot ? mergeSaveData(slot) : null;
      });
      this.saveSlots = normalized;
    } catch {
      this.saveSlots = createEmptySlots();
    }
  }

  private migrateLegacySave(): void {
    if (typeof window === "undefined") {
      this.saveSlots = createEmptySlots();
      return;
    }

    const legacy = window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) {
      this.saveSlots = createEmptySlots();
      return;
    }

    try {
      const parsed = JSON.parse(legacy) as Partial<SaveData>;
      this.saveSlots = createEmptySlots();
      this.saveSlots[0] = mergeSaveData(parsed);
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(this.saveSlots));
    } catch {
      this.saveSlots = createEmptySlots();
    }
  }

  private loadSettings(): void {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      this.settings = {
        graphics: { ...DEFAULT_SETTINGS.graphics, ...parsed.graphics },
        audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
        controls: { ...DEFAULT_SETTINGS.controls, ...parsed.controls },
        gameplay: { ...DEFAULT_SETTINGS.gameplay, ...parsed.gameplay },
      };
    } catch {
      this.settings = clone(DEFAULT_SETTINGS);
    }
  }

  private firstEmptySlotOrActive(): number {
    const emptyIndex = this.saveSlots.findIndex((slot) => slot === null);
    return emptyIndex >= 0 ? emptyIndex : this.activeSlotIndex;
  }
}

export const gameSession = new GameSession();
