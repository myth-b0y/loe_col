import Phaser from "phaser";

import { retroSfx } from "../audio/retroSfx";
import {
  GALAXY_HAZE_NODES,
  GALAXY_STARS,
  GALAXY_WORLD_CONFIG,
  clampPointToGalaxyTravelBounds,
  getGalaxyMoonPositionAtTime,
  getGalaxyPlanetPositionAtTime,
  getGalaxyRegionLabelAtPosition,
  getGalaxySectorAtPosition,
  isGalaxyDeepSpaceAtPosition,
  type GalaxyDefinition,
  type GalaxyHazeNode,
  type GalaxyMissionPlanet,
  type GalaxyMoonRecord,
  type GalaxyPlanetRecord,
  type GalaxySectorConfig,
  type GalaxyStarSeed,
  type GalaxyStationRecord,
  type GalaxySystemRecord,
} from "../content/galaxy";
import {
  advanceFactionForceProduction,
  getFactionForceDebugSnapshot,
  markFactionForceShipDestroyed,
  type FactionForceAssignmentKind,
  type FactionForceShipRole,
  type FactionForceState,
} from "../content/factionForces";
import {
  advanceFactionWarState,
  buildFactionWarZoneAdjacency,
  getRaceAllianceStatus,
  type FactionWarState,
  type FactionWarZoneAdjacency,
} from "../content/factionWar";
import { getMissionContract } from "../content/missions";
import {
  SPACE_FACTIONS,
  SHIP_HYPERDRIVE_CONFIG,
  SHIP_RADAR_CONFIG,
  SPACE_WORLD_CONFIG,
  createShipHyperdriveSystemState,
  getSpaceFactionConfig,
  getSpaceRaceDefenseProfile,
  getSpaceShipRoleCombatProfile,
  createSpaceForceShipSeeds,
  createSpaceWorldDefinition,
  createSpacePatrolTarget,
  getShipHyperdriveTopSpeed,
  getSpaceCellKeyAtPosition,
  getSpaceCellKeysAroundPosition,
  isFactionHostileByDefault,
  isShipHyperdriveCombatLocked,
  isShipHyperdriveTurningLocked,
  type ShipHyperdriveSystemState,
  type SpaceFactionId,
  type SpaceFieldObjectKind,
  type SpaceFieldPlacementType,
  type SpaceWorldCellKey,
  type SpaceWorldDefinition,
} from "../content/space";
import { type RaceId } from "../content/items";
import { gameSession } from "../core/session";
import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { InventoryOverlay } from "../ui/InventoryOverlay";
import { GalaxyMapOverlay } from "../ui/GalaxyMapOverlay";
import { LogbookOverlay } from "../ui/LogbookOverlay";
import { SpaceRadarDisplay, type SpaceRadarContactSource } from "../ui/SpaceRadar";
import { SpaceStationOverlay, type SpaceStationOverlayState } from "../ui/SpaceStationOverlay";

type SpaceSceneData = {
  missionId?: string | null;
};

type SmugglerRouteTargetKind = "planet" | "moon" | "station";

type SpaceFieldObject = {
  id: string;
  kind: SpaceFieldObjectKind;
  placementType: SpaceFieldPlacementType;
  isLarge: boolean;
  root: Phaser.GameObjects.Container;
  visualRoot: Phaser.GameObjects.Container;
  damageRing: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  baseRadius: number;
  radius: number;
  hp: number;
  maxHp: number;
  spin: number;
  flash: number;
};

type SpaceFieldObjectState = {
  id: string;
  cellKey: SpaceWorldCellKey;
  kind: SpaceFieldObjectKind;
  placementType: SpaceFieldPlacementType;
  isLarge: boolean;
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  hp: number;
  maxHp: number;
  velocityX: number;
  velocityY: number;
  spin: number;
  rotation: number;
  flash: number;
  destroyed: boolean;
};

type SpaceFactionShip = {
  id: string;
  factionId: SpaceFactionId;
  originRaceId: RaceId | null;
  shipRole: FactionForceShipRole | null;
  assignmentKind: FactionForceAssignmentKind | null;
  assignmentZoneId: string | null;
  sectorId: string;
  groupId: string;
  leaderId: string | null;
  formationOffsetX: number;
  formationOffsetY: number;
  root: Phaser.GameObjects.Container;
  thruster: Phaser.GameObjects.Ellipse;
  damageRing: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  aimDirection: Phaser.Math.Vector2;
  patrolTarget: Phaser.Math.Vector2;
  customColor: number | null;
  customTrimColor: number | null;
  customGlowColor: number | null;
  guardAnchor: Phaser.Math.Vector2 | null;
  guardRadius: number;
  originPoolId: string | null;
  originPoolKind: "zone" | "prime-world" | null;
  originZoneId: string | null;
  originSystemId: string | null;
  radius: number;
  hp: number;
  maxHp: number;
  flash: number;
  fireCooldown: number;
  provokedByPlayer: boolean;
  provokedByShips: Set<string>;
  aggressionTimer: number;
  strafeSign: number;
  routeTargetKind: SmugglerRouteTargetKind | null;
  routeTargetId: string | null;
  routeWaitRemainingMs: number;
  supportRepairCooldown: number;
};

type SpaceFactionShipState = {
  id: string;
  cellKey: SpaceWorldCellKey;
  factionId: SpaceFactionId;
  originRaceId: RaceId | null;
  shipRole: FactionForceShipRole | null;
  assignmentKind: FactionForceAssignmentKind | null;
  assignmentZoneId: string | null;
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
  customColor: number | null;
  customTrimColor: number | null;
  customGlowColor: number | null;
  guardAnchorX: number | null;
  guardAnchorY: number | null;
  guardRadius: number | null;
  originPoolId: string | null;
  originPoolKind: "zone" | "prime-world" | null;
  originZoneId: string | null;
  originSystemId: string | null;
  aimX: number;
  aimY: number;
  radius: number;
  hp: number;
  maxHp: number;
  flash: number;
  fireCooldown: number;
  provokedByPlayer: boolean;
  provokedByShips: string[];
  aggressionTimer: number;
  strafeSign: number;
  routeTargetKind: SmugglerRouteTargetKind | null;
  routeTargetId: string | null;
  routeWaitRemainingMs: number;
  supportRepairCooldown: number;
  destroyed: boolean;
};

type SpaceProjectile = {
  id: string;
  ownerKind: "player" | "faction";
  ownerShipId: string | null;
  ownerFactionId: SpaceFactionId | null;
  sprite: Phaser.GameObjects.Arc;
  glow: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  life: number;
  radius: number;
  damage: number;
  canHitPlayer: boolean;
};

type SpaceBurstParticle = {
  sprite: Phaser.GameObjects.Shape;
  velocity: Phaser.Math.Vector2;
  rotationSpeed: number;
  life: number;
  maxLife: number;
};

type SpaceDamageSource =
  | { kind: "player" }
  | { kind: "ship"; shipId: string | null; factionId: SpaceFactionId | null };

type SpacePlayerTarget =
  | { kind: "ship"; ship: SpaceFactionShip }
  | { kind: "field"; fieldObject: SpaceFieldObject };

type SpaceHyperdriveDropTarget = {
  id: string;
  label: string;
  x: number;
  y: number;
  safetyRadius: number;
  autoDropRadius: number;
};

type SpaceCelestialPlanetView = {
  planetId: string;
  root: Phaser.GameObjects.Container;
  landingRing: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

type SpaceCelestialMoonView = {
  moonId: string;
  planetId: string;
  root: Phaser.GameObjects.Container;
  orbit: Phaser.GameObjects.Ellipse;
};

type SpaceCelestialSystemView = {
  systemId: string;
  root: Phaser.GameObjects.Container;
  planetIds: string[];
  moonIds: string[];
};

type SpaceStationView = {
  stationId: string;
  root: Phaser.GameObjects.Container;
  interactionRing: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

const PLAYER_RADIUS = 22;
const PLAYER_MAX_HULL = 8;
const PLAYER_ACCELERATION = 720;
const PLAYER_COAST_DRAG = 2.1;
const PLAYER_THRUST_DRAG = 0.85;
const PLAYER_MAX_SPEED = 420;
const PLAYER_HYPERDRIVE_MAX_SPEED = getShipHyperdriveTopSpeed(PLAYER_MAX_SPEED, SHIP_HYPERDRIVE_CONFIG);
const PLAYER_BULLET_SPEED = 880;
const PLAYER_FIRE_COOLDOWN = 0.14;
const PLAYER_PROJECTILE_LIFETIME = 1.25;
const FACTION_PROJECTILE_LIFETIME = 1.8;
const FACTION_DAMAGE = 1;
const PLAYER_DAMAGE = 1;
const AGGRESSION_DURATION = 12;
const MISSION_LANDING_RANGE_BUFFER = 150;
const FORMATION_RECOVERY_DISTANCE = 180;
const PLAYER_TARGET_LOCK_RANGE = 980;
const TOUCH_STICK_RADIUS = 72;
const TOUCH_STICK_DEADZONE = 18;
const HUD_REFRESH_INTERVAL_MS = 120;
const PROJECTILE_CULL_DISTANCE = SPACE_WORLD_CONFIG.cellSize * 2.2;
const BURST_CULL_DISTANCE = SPACE_WORLD_CONFIG.cellSize * 1.6;
const BACKDROP_CELL_SIZE = 1600;
const BACKDROP_CELL_RADIUS = 1;
const BACKDROP_HAZE_PADDING = 1800;
const CELESTIAL_CELL_RADIUS = 1;
const DEEP_SPACE_OVERLAY_COLOR = 0x132033;
const STATION_INTERACTION_BUFFER = 180;
const SMUGGLER_ROUTE_WAIT_MIN_MS = 2200;
const SMUGGLER_ROUTE_WAIT_MAX_MS = 4200;
const FORCE_STATE_SYNC_INTERVAL_MS = 1000;
const WAR_STATE_UPDATE_INTERVAL_MS = 1000;

function randomBetween(min: number, max: number): number {
  return min + (max - min) * Math.random();
}

function hashStringToUnitInterval(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function createRockPoints(radius: number, seedKey: string): number[] {
  const points: number[] = [];
  const pointCount = radius >= 42 ? 9 : 7;

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const pointRadius = radius * (0.74 + (hashStringToUnitInterval(`${seedKey}:${index}`) * 0.26));
    points.push(Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius);
  }

  return points;
}

function createStarPoints(
  outerRadius: number,
  innerRadius: number,
  pointCount = 4,
): number[] {
  const points: number[] = [];
  const totalPoints = pointCount * 2;
  for (let index = 0; index < totalPoints; index += 1) {
    const angle = (index / totalPoints) * Math.PI * 2 - (Math.PI * 0.5);
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return points;
}

function createStarburstGraphic(
  scene: Phaser.Scene,
  outerRadius: number,
  innerRadius: number,
  pointCount: number,
  fillColor: number,
  fillAlpha: number,
  strokeColor: number,
  strokeAlpha: number,
  lineWidth: number,
): Phaser.GameObjects.Graphics {
  const star = scene.add.graphics({ x: 0, y: 0 });
  const rawPoints = createStarPoints(outerRadius, innerRadius, pointCount);
  const points: Phaser.Types.Math.Vector2Like[] = [];
  for (let index = 0; index < rawPoints.length; index += 2) {
    points.push({ x: rawPoints[index], y: rawPoints[index + 1] });
  }

  star.fillStyle(fillColor, fillAlpha);
  star.fillPoints(points, true);
  star.lineStyle(lineWidth, strokeColor, strokeAlpha);
  star.strokePoints(points, true);
  return star;
}

function getDistanceToCameraView(view: Phaser.Geom.Rectangle, x: number, y: number): number {
  const dx = x < view.left
    ? view.left - x
    : x > view.right
      ? x - view.right
      : 0;
  const dy = y < view.top
    ? view.top - y
    : y > view.bottom
      ? y - view.bottom
      : 0;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function areCellKeyListsEqual(left: SpaceWorldCellKey[], right: SpaceWorldCellKey[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((key, index) => key === right[index]);
}

function createInitialFactionFireCooldown(seedId: string, maxCooldown: number): number {
  return hashStringToUnitInterval(`${seedId}:fire`) * maxCooldown;
}

function createInitialStrafeSign(seedId: string): 1 | -1 {
  return hashStringToUnitInterval(`${seedId}:strafe`) >= 0.5 ? 1 : -1;
}

function createBackdropCellKey(cellX: number, cellY: number): SpaceWorldCellKey {
  return `${cellX},${cellY}`;
}

function getBackdropCellCoordinatesForPosition(x: number, y: number): { cellX: number; cellY: number } {
  return {
    cellX: Math.max(0, Math.floor(x / BACKDROP_CELL_SIZE)),
    cellY: Math.max(0, Math.floor(y / BACKDROP_CELL_SIZE)),
  };
}

function getBackdropCellKeyAtPosition(x: number, y: number): SpaceWorldCellKey {
  const { cellX, cellY } = getBackdropCellCoordinatesForPosition(x, y);
  return createBackdropCellKey(cellX, cellY);
}

function getBackdropCellKeysAroundPosition(x: number, y: number): SpaceWorldCellKey[] {
  const { cellX, cellY } = getBackdropCellCoordinatesForPosition(x, y);
  const maxCellX = Math.ceil(SPACE_WORLD_CONFIG.width / BACKDROP_CELL_SIZE) - 1;
  const maxCellY = Math.ceil(SPACE_WORLD_CONFIG.height / BACKDROP_CELL_SIZE) - 1;
  const keys: SpaceWorldCellKey[] = [];

  for (let offsetY = -BACKDROP_CELL_RADIUS; offsetY <= BACKDROP_CELL_RADIUS; offsetY += 1) {
    for (let offsetX = -BACKDROP_CELL_RADIUS; offsetX <= BACKDROP_CELL_RADIUS; offsetX += 1) {
      const nextCellX = Math.min(maxCellX, Math.max(0, cellX + offsetX));
      const nextCellY = Math.min(maxCellY, Math.max(0, cellY + offsetY));
      const key = createBackdropCellKey(nextCellX, nextCellY);
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  return keys;
}

function parseBackdropCellKey(cellKey: SpaceWorldCellKey): { cellX: number; cellY: number } {
  const [cellXRaw, cellYRaw] = cellKey.split(",");
  return {
    cellX: Number(cellXRaw),
    cellY: Number(cellYRaw),
  };
}

function angleToDirection(rotation: number): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2(
    Math.cos(rotation - Math.PI * 0.5),
    Math.sin(rotation - Math.PI * 0.5),
  ).normalize();
}

export class SpaceScene extends Phaser.Scene {
  private shipRoot!: Phaser.GameObjects.Container;
  private shipThruster!: Phaser.GameObjects.Ellipse;
  private shipDamageRing!: Phaser.GameObjects.Arc;
  private shipVelocity = new Phaser.Math.Vector2();
  private keyboardMoveVector = new Phaser.Math.Vector2();
  private touchMoveVector = new Phaser.Math.Vector2();
  private touchAimVector = new Phaser.Math.Vector2(1, 0);
  private moveDirection = new Phaser.Math.Vector2();
  private aimDirection = new Phaser.Math.Vector2(1, 0);
  private pointerWorld = new Phaser.Math.Vector2();
  private galaxyDefinition!: GalaxyDefinition;
  private warState!: FactionWarState;
  private forceState!: FactionForceState;
  private zoneAdjacency: FactionWarZoneAdjacency = {};
  private worldDefinition!: SpaceWorldDefinition;
  private currentSector!: GalaxySectorConfig;
  private currentRegionLabel = "";
  private currentRegionIsDeepSpace = false;
  private trackedMissionPlanet: GalaxyMissionPlanet | null = null;
  private galaxySystemsByCell = new Map<SpaceWorldCellKey, GalaxySystemRecord[]>();
  private galaxySystemsById = new Map<string, GalaxySystemRecord>();
  private galaxyPlanetsById = new Map<string, GalaxyPlanetRecord>();
  private galaxyPlanetsBySystemId = new Map<string, GalaxyPlanetRecord[]>();
  private galaxyMoonsById = new Map<string, GalaxyMoonRecord>();
  private galaxyMoonsByPlanetId = new Map<string, GalaxyMoonRecord[]>();
  private galaxyStationsByCell = new Map<SpaceWorldCellKey, GalaxyStationRecord[]>();
  private galaxyStationsById = new Map<string, GalaxyStationRecord>();
  private fieldStates = new Map<string, SpaceFieldObjectState>();
  private shipStates = new Map<string, SpaceFactionShipState>();
  private galaxyStateDirty = false;
  private warStateDirty = false;
  private forceStateDirty = false;
  private forceStateSyncTimerMs = FORCE_STATE_SYNC_INTERVAL_MS;
  private warStateUpdateTimerMs = 0;
  private backdropSectorOverlay?: Phaser.GameObjects.Rectangle;
  private backdropStarSeedsByCell = new Map<SpaceWorldCellKey, GalaxyStarSeed[]>();
  private activeBackdropCellKeys: SpaceWorldCellKey[] = [];
  private activeBackdropStarCells = new Map<SpaceWorldCellKey, Phaser.GameObjects.Graphics>();
  private activeBackdropHazeNodes = new Map<number, Phaser.GameObjects.Arc>();
  private asteroids: SpaceFieldObject[] = [];
  private factionShips: SpaceFactionShip[] = [];
  private activeCelestialCellKeys: SpaceWorldCellKey[] = [];
  private activeCelestialSystems = new Map<string, SpaceCelestialSystemView>();
  private activePlanetViews = new Map<string, SpaceCelestialPlanetView>();
  private activeMoonViews = new Map<string, SpaceCelestialMoonView>();
  private activeStationViews = new Map<string, SpaceStationView>();
  private shots: SpaceProjectile[] = [];
  private burstParticles: SpaceBurstParticle[] = [];
  private activeFieldCellKeys: SpaceWorldCellKey[] = [];
  private activeShipCellKeys: SpaceWorldCellKey[] = [];
  private routeMissionId: string | null = null;
  private routeTitle = "Free roam launch";
  private radar?: SpaceRadarDisplay;
  private destroyedObjects = 0;
  private destroyedFactionShips = 0;
  private playerHull = PLAYER_MAX_HULL;
  private playerFlash = 0;
  private hyperdrive: ShipHyperdriveSystemState = createShipHyperdriveSystemState();
  private hyperdriveCountdownValue = 0;
  private fireCooldown = 0;
  private fireHeld = false;
  private hudRefreshTimerMs = 0;
  private thrusting = false;
  private returningToShip = false;
  private playerDestroyed = false;
  private touchCapable = false;
  private touchMode = false;
  private movePointerId: number | null = null;
  private attackPointerId: number | null = null;
  private hyperdrivePointerId: number | null = null;
  private hyperdriveTouchHeld = false;
  private hyperdriveTouchTapQueued = false;
  private hyperdriveKeyWasDown = false;
  private selectedTarget: SpacePlayerTarget | null = null;
  private autoAimTarget: SpacePlayerTarget | null = null;
  private moveBase?: Phaser.GameObjects.Arc;
  private moveKnob?: Phaser.GameObjects.Arc;
  private attackButton?: MenuButton;
  private targetButton?: MenuButton;
  private abilityOneButton?: MenuButton;
  private abilityTwoButton?: MenuButton;
  private desktopControlsText?: Phaser.GameObjects.Text;
  private touchUiObjects: Phaser.GameObjects.GameObject[] = [];
  private desktopUiObjects: Phaser.GameObjects.GameObject[] = [];
  private routeText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private contactText?: Phaser.GameObjects.Text;
  private coordinateText?: Phaser.GameObjects.Text;
  private waypointArrow?: Phaser.GameObjects.Triangle;
  private waypointLabel?: Phaser.GameObjects.Text;
  private logbookButton?: MenuButton;
  private pauseButton?: MenuButton;
  private returnButton?: MenuButton;
  private logbookOverlay?: LogbookOverlay;
  private inventoryOverlay?: InventoryOverlay;
  private galaxyMapOverlay?: GalaxyMapOverlay;
  private stationOverlay?: SpaceStationOverlay;
  private stationOverlayStationId: string | null = null;
  private stationOverlayStatusText = "";
  private inputKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
    hyperdrive: Phaser.Input.Keyboard.Key;
    returnToShip: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("space");
  }

  init(data: SpaceSceneData = {}): void {
    this.routeMissionId = typeof data.missionId === "string" && data.missionId.length > 0
      ? data.missionId
      : null;
    this.routeTitle = this.routeMissionId
      ? getMissionContract(this.routeMissionId)?.title ?? "Route staged"
      : "Free roam launch";
  }

  create(): void {
    this.touchCapable = this.sys.game.device.input.touch;
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    this.galaxyDefinition = gameSession.getGalaxyDefinition();
    this.warState = gameSession.getFactionWarState();
    this.forceState = gameSession.getFactionForceState();
    this.zoneAdjacency = buildFactionWarZoneAdjacency(this.galaxyDefinition);
    const initialWarUpdate = advanceFactionWarState(
      this.warState,
      this.galaxyDefinition,
      this.forceState,
      this.zoneAdjacency,
      0,
    );
    this.worldDefinition = createSpaceWorldDefinition(
      SPACE_WORLD_CONFIG,
      this.galaxyDefinition,
      Date.now() >>> 0,
      this.forceState,
      this.warState,
    );
    this.syncTrackedMissionPlanet();
    this.galaxySystemsByCell.clear();
    this.galaxySystemsById.clear();
    this.galaxyPlanetsById.clear();
    this.galaxyPlanetsBySystemId.clear();
    this.galaxyMoonsById.clear();
    this.galaxyMoonsByPlanetId.clear();
    this.galaxyStationsByCell.clear();
    this.galaxyStationsById.clear();
    this.fieldStates.clear();
    this.shipStates.clear();
    this.galaxyStateDirty = initialWarUpdate.changed;
    this.warStateDirty = initialWarUpdate.changed;
    this.forceStateDirty = initialWarUpdate.changed;
    this.forceStateSyncTimerMs = FORCE_STATE_SYNC_INTERVAL_MS;
    this.warStateUpdateTimerMs = 0;
    this.backdropStarSeedsByCell.clear();
    this.activeBackdropCellKeys = [];
    this.activeBackdropStarCells.clear();
    this.activeBackdropHazeNodes.clear();
    this.backdropSectorOverlay = undefined;
    this.radar = undefined;
    this.asteroids = [];
    this.factionShips = [];
    this.activeCelestialCellKeys = [];
    this.activeCelestialSystems.clear();
    this.activePlanetViews.clear();
    this.activeMoonViews.clear();
    this.activeStationViews.clear();
    this.shots = [];
    this.burstParticles = [];
    this.activeFieldCellKeys = [];
    this.activeShipCellKeys = [];
    this.destroyedObjects = 0;
    this.destroyedFactionShips = 0;
    this.restorePlayerHullFromSession();
    this.playerFlash = 0;
    this.hyperdrive = createShipHyperdriveSystemState();
    this.hyperdriveCountdownValue = 0;
    this.fireCooldown = 0;
    this.fireHeld = false;
    this.hudRefreshTimerMs = 0;
    this.shipVelocity.set(0, 0);
    this.keyboardMoveVector.set(0, 0);
    this.touchMoveVector.set(0, 0);
    this.touchAimVector.set(1, 0);
    this.moveDirection.set(0, 0);
    this.aimDirection.set(1, 0);
    this.selectedTarget = null;
    this.autoAimTarget = null;
    this.movePointerId = null;
    this.attackPointerId = null;
    this.hyperdrivePointerId = null;
    this.hyperdriveTouchHeld = false;
    this.hyperdriveTouchTapQueued = false;
    this.hyperdriveKeyWasDown = false;
    this.touchUiObjects = [];
    this.desktopUiObjects = [];
    this.thrusting = false;
    this.returningToShip = false;
    this.playerDestroyed = false;
    this.stationOverlayStationId = null;
    this.stationOverlayStatusText = "";

    this.cameras.main.setBackgroundColor("#040810");
    this.input.mouse?.disableContextMenu();

    this.createPlayerShip();
    this.indexGalaxyCelestials();
    this.currentSector = getGalaxySectorAtPosition(this.shipRoot.x, this.shipRoot.y);
    this.currentRegionLabel = getGalaxyRegionLabelAtPosition(this.shipRoot.x, this.shipRoot.y);
    this.currentRegionIsDeepSpace = isGalaxyDeepSpaceAtPosition(this.shipRoot.x, this.shipRoot.y);
    this.drawWorldBackdrop();
    this.initializeWorldStates();
    this.syncActiveWorld(true);
    this.createHud();
    this.createTouchUi();
    this.createCommandOverlays();
    this.syncInputMode();
    this.bindKeyboard();
    this.bindPointers();
    this.configureCamera();
    this.refreshHud();

    const syncInputMode = (): void => this.syncInputMode();
    const handleSettingsChanged = (): void => {
      this.syncInputMode();
      this.rebuildBackdropVisuals();
      this.refreshHud();
    };
    const handleResume = (): void => {
      this.syncInputMode();
      this.syncBackdropVisuals(true);
      this.refreshHud();
    };
    gameSession.on("settings-changed", handleSettingsChanged);
    gameSession.on("input-mode-changed", syncInputMode);
    this.events.on(Phaser.Scenes.Events.RESUME, handleResume);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameSession.off("settings-changed", handleSettingsChanged);
      gameSession.off("input-mode-changed", syncInputMode);
      this.events.off(Phaser.Scenes.Events.RESUME, handleResume);
      this.syncForceStateToSession();
      this.releaseTouchControls();
    });
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.hudRefreshTimerMs = Math.max(0, this.hudRefreshTimerMs - delta);
    this.syncTrackedMissionPlanet();

    if (this.isMenuOverlayVisible()) {
      if (this.hudRefreshTimerMs <= 0) {
        this.refreshHud();
        this.hudRefreshTimerMs = HUD_REFRESH_INTERVAL_MS;
      }
      return;
    }

    if (this.inputKeys && !this.playerDestroyed && Phaser.Input.Keyboard.JustDown(this.inputKeys.interact)) {
      this.tryHandlePrimaryInteraction();
    }

    if (this.inputKeys && !this.playerDestroyed && Phaser.Input.Keyboard.JustDown(this.inputKeys.returnToShip)) {
      this.returnToShip();
      return;
    }

    if (this.returningToShip || this.playerDestroyed) {
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.playerFlash = Math.max(0, this.playerFlash - (dt * 4));
    this.updateAimDirection();
    this.updateHyperdriveState(dt, delta);
    this.updatePlayerShip(dt);
    this.syncBackdropVisuals();
    this.syncActiveWorld();
    this.updateCelestialMotion();
    this.updateFieldObjects(dt);
    this.updateFactionWar(delta);
    this.updateForceProduction(delta);
    this.updateFactionShips(dt);
    this.resolveFactionShipCollisions();
    this.updateProjectiles(dt);
    this.updateBurstParticles(dt);
    this.updateRadar(dt);
    this.syncDirtyForceState(delta);
    if (this.hudRefreshTimerMs <= 0) {
      this.refreshHud();
      this.hudRefreshTimerMs = HUD_REFRESH_INTERVAL_MS;
    }
  }

  private drawWorldBackdrop(): void {
    this.add.rectangle(
      SPACE_WORLD_CONFIG.width * 0.5,
      SPACE_WORLD_CONFIG.height * 0.5,
      SPACE_WORLD_CONFIG.width,
      SPACE_WORLD_CONFIG.height,
      0x040810,
      1,
    ).setDepth(-30);

    this.backdropSectorOverlay = this.add.rectangle(
      SPACE_WORLD_CONFIG.width * 0.5,
      SPACE_WORLD_CONFIG.height * 0.5,
      SPACE_WORLD_CONFIG.width,
      SPACE_WORLD_CONFIG.height,
      this.currentRegionIsDeepSpace ? DEEP_SPACE_OVERLAY_COLOR : this.currentSector.color,
      this.currentRegionIsDeepSpace ? 0.034 : 0.05,
    ).setDepth(-29);

    this.add.ellipse(
      GALAXY_WORLD_CONFIG.center.x,
      GALAXY_WORLD_CONFIG.center.y,
      GALAXY_WORLD_CONFIG.restrictedCoreRadius * 2.24,
      GALAXY_WORLD_CONFIG.restrictedCoreRadius * 2.24 * GALAXY_WORLD_CONFIG.verticalScale,
      0x04050b,
      0.9,
    ).setStrokeStyle(5, 0x6db7ff, 0.12).setDepth(-27);

    this.add.ellipse(
      GALAXY_WORLD_CONFIG.center.x,
      GALAXY_WORLD_CONFIG.center.y,
      GALAXY_WORLD_CONFIG.coreRadius * 2.12,
      GALAXY_WORLD_CONFIG.coreRadius * 2.12 * GALAXY_WORLD_CONFIG.verticalScale,
      0x0f1d30,
      0.2,
    ).setStrokeStyle(2, 0xc3e4ff, 0.1).setDepth(-26);

    this.add.rectangle(
      SPACE_WORLD_CONFIG.width * 0.5,
      SPACE_WORLD_CONFIG.height * 0.5,
      SPACE_WORLD_CONFIG.width,
      SPACE_WORLD_CONFIG.height,
      0x000000,
      0,
    ).setStrokeStyle(3, 0x183552, 0.42).setDepth(-22);

    this.rebuildBackdropVisuals();
  }

  private rebuildBackdropVisuals(): void {
    this.activeBackdropStarCells.forEach((graphics) => graphics.destroy());
    this.activeBackdropStarCells.clear();
    this.activeBackdropHazeNodes.forEach((node) => node.destroy());
    this.activeBackdropHazeNodes.clear();
    this.activeBackdropCellKeys = [];
    this.backdropStarSeedsByCell.clear();
    this.indexBackdropStars();
    this.syncBackdropVisuals(true);
  }

  private indexBackdropStars(): void {
    GALAXY_STARS.forEach((star, index) => {
      if (!this.shouldRenderBackdropStar(star, index)) {
        return;
      }

      const cellKey = getBackdropCellKeyAtPosition(star.x, star.y);
      const bucket = this.backdropStarSeedsByCell.get(cellKey);
      if (bucket) {
        bucket.push(star);
        return;
      }
      this.backdropStarSeedsByCell.set(cellKey, [star]);
    });
  }

  private shouldRenderBackdropStar(star: GalaxyStarSeed, index: number): boolean {
    const quality = gameSession.settings.graphics.quality;
    if (quality === "High") {
      return true;
    }

    const isSmallBackgroundStar = star.armIndex === -1 && star.size <= 1.2 && star.alpha <= 0.55;
    if (quality === "Balanced") {
      return isSmallBackgroundStar ? index % 2 === 0 : true;
    }

    return isSmallBackgroundStar ? index % 4 === 0 : index % 2 === 0;
  }

  private syncBackdropVisuals(force = false): void {
    const nextCellKeys = getBackdropCellKeysAroundPosition(this.shipRoot.x, this.shipRoot.y);
    const backdropCellsChanged = force || !areCellKeyListsEqual(this.activeBackdropCellKeys, nextCellKeys);

    if (!backdropCellsChanged) {
      return;
    }

    const activeCellKeySet = new Set(nextCellKeys);
    this.activeBackdropStarCells.forEach((graphics, cellKey) => {
      if (activeCellKeySet.has(cellKey)) {
        return;
      }

      graphics.destroy();
      this.activeBackdropStarCells.delete(cellKey);
    });

    nextCellKeys.forEach((cellKey) => {
      if (this.activeBackdropStarCells.has(cellKey)) {
        return;
      }

      const stars = this.backdropStarSeedsByCell.get(cellKey);
      if (!stars || stars.length === 0) {
        return;
      }

      this.activeBackdropStarCells.set(cellKey, this.createBackdropStarCell(cellKey, stars));
    });

    this.syncBackdropHazeNodes();
    this.activeBackdropCellKeys = nextCellKeys;
  }

  private refreshCurrentSector(): void {
    const nextSector = getGalaxySectorAtPosition(this.shipRoot.x, this.shipRoot.y);
    const nextRegionLabel = getGalaxyRegionLabelAtPosition(this.shipRoot.x, this.shipRoot.y);
    const nextRegionIsDeepSpace = isGalaxyDeepSpaceAtPosition(this.shipRoot.x, this.shipRoot.y);
    if (
      nextSector.id === this.currentSector.id
      && nextRegionLabel === this.currentRegionLabel
      && nextRegionIsDeepSpace === this.currentRegionIsDeepSpace
    ) {
      return;
    }

    this.currentSector = nextSector;
    this.currentRegionLabel = nextRegionLabel;
    this.currentRegionIsDeepSpace = nextRegionIsDeepSpace;
    this.backdropSectorOverlay?.setFillStyle(
      this.currentRegionIsDeepSpace ? DEEP_SPACE_OVERLAY_COLOR : this.currentSector.color,
      this.currentRegionIsDeepSpace ? 0.034 : 0.05,
    );
  }

  private createBackdropStarCell(
    cellKey: SpaceWorldCellKey,
    stars: GalaxyStarSeed[],
  ): Phaser.GameObjects.Graphics {
    const { cellX, cellY } = parseBackdropCellKey(cellKey);
    const originX = cellX * BACKDROP_CELL_SIZE;
    const originY = cellY * BACKDROP_CELL_SIZE;
    const graphics = this.add.graphics({ x: originX, y: originY }).setDepth(-24);

    stars.forEach((star) => {
      graphics.fillStyle(star.color, star.alpha);
      graphics.fillCircle(star.x - originX, star.y - originY, Math.max(0.55, star.size));
    });

    return graphics;
  }

  private syncBackdropHazeNodes(): void {
    const quality = gameSession.settings.graphics.quality;
    const activeNodeIndexes = new Set<number>();

    if (quality !== "Performance") {
      GALAXY_HAZE_NODES.forEach((node, index) => {
        if (!this.isHazeNodeNearPlayer(node)) {
          return;
        }

        activeNodeIndexes.add(index);
        if (this.activeBackdropHazeNodes.has(index)) {
          return;
        }

        const alpha = quality === "Balanced" ? node.alpha * 0.78 : node.alpha;
        const hazeNode = this.add.circle(node.x, node.y, node.radius, node.color, alpha).setDepth(-28);
        this.activeBackdropHazeNodes.set(index, hazeNode);
      });
    }

    this.activeBackdropHazeNodes.forEach((node, index) => {
      if (activeNodeIndexes.has(index)) {
        return;
      }

      node.destroy();
      this.activeBackdropHazeNodes.delete(index);
    });
  }

  private isHazeNodeNearPlayer(node: GalaxyHazeNode): boolean {
    const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, node.x, node.y);
    return distance <= node.radius + BACKDROP_HAZE_PADDING;
  }

  private createPlayerShip(): void {
    const shadow = this.add.ellipse(4, 8, 42, 24, 0x000000, 0.22);
    const leftPod = this.add.rectangle(-18, 4, 12, 22, 0x3e5676, 0.96).setStrokeStyle(1, 0x7cb5ff, 0.26);
    const rightPod = this.add.rectangle(18, 4, 12, 22, 0x3e5676, 0.96).setStrokeStyle(1, 0x7cb5ff, 0.26);
    const body = this.add.rectangle(0, 2, 28, 34, 0x4e6c90, 0.98).setStrokeStyle(2, 0xcfe5ff, 0.7);
    const cockpit = this.add.triangle(0, -18, 0, -24, -10, -2, 10, -2, 0x8fe3ff, 0.96).setStrokeStyle(1, 0xeaf8ff, 0.6);
    const fin = this.add.rectangle(0, 20, 10, 12, 0x345172, 0.96).setStrokeStyle(1, 0x8bb5e8, 0.38);
    this.shipThruster = this.add.ellipse(0, 23, 14, 24, 0x76dfff, 0.24).setStrokeStyle(1, 0xc5f2ff, 0.3);
    this.shipDamageRing = this.add.circle(0, 0, 26, 0xff9f74, 0).setStrokeStyle(2, 0xffdbbc, 0);

    const spawn = gameSession.getShipSpacePosition();

    this.shipRoot = this.add.container(spawn.x, spawn.y, [
      shadow,
      this.shipDamageRing,
      this.shipThruster,
      leftPod,
      rightPod,
      fin,
      body,
      cockpit,
    ]).setDepth(20);
    this.shipRoot.setSize(62, 58);
    gameSession.setShipSpacePosition(this.shipRoot.x, this.shipRoot.y);
  }

  private indexGalaxyCelestials(): void {
    this.galaxyDefinition.systems.forEach((system) => {
      this.galaxySystemsById.set(system.id, system);
      const cellKey = getSpaceCellKeyAtPosition(system.x, system.y, SPACE_WORLD_CONFIG);
      const systemBucket = this.galaxySystemsByCell.get(cellKey);
      if (systemBucket) {
        systemBucket.push(system);
      } else {
        this.galaxySystemsByCell.set(cellKey, [system]);
      }
    });

    this.galaxyDefinition.planets.forEach((planet) => {
      this.galaxyPlanetsById.set(planet.id, planet);
      const systemBucket = this.galaxyPlanetsBySystemId.get(planet.systemId);
      if (systemBucket) {
        systemBucket.push(planet);
      } else {
        this.galaxyPlanetsBySystemId.set(planet.systemId, [planet]);
      }
    });

    this.galaxyDefinition.moons.forEach((moon) => {
      this.galaxyMoonsById.set(moon.id, moon);
      const planetBucket = this.galaxyMoonsByPlanetId.get(moon.planetId);
      if (planetBucket) {
        planetBucket.push(moon);
      } else {
        this.galaxyMoonsByPlanetId.set(moon.planetId, [moon]);
      }
    });

    this.galaxyDefinition.stations.forEach((station) => {
      this.galaxyStationsById.set(station.id, station);
      const cellKey = getSpaceCellKeyAtPosition(station.x, station.y, SPACE_WORLD_CONFIG);
      const stationBucket = this.galaxyStationsByCell.get(cellKey);
      if (stationBucket) {
        stationBucket.push(station);
      } else {
        this.galaxyStationsByCell.set(cellKey, [station]);
      }
    });
  }

  private getSystemStarRenderRadius(system: GalaxySystemRecord): number {
    return 34 + (system.starSize * 11);
  }

  private getPlanetRenderRadius(planet: GalaxyPlanetRecord): number {
    return Math.max(22, planet.radius * 0.95 * (planet.isHomeworld ? 0.66 : 0.54));
  }

  private getMoonRenderRadius(moon: GalaxyMoonRecord): number {
    return Math.max(10, moon.radius * 0.48);
  }

  private getOrbitTimeMs(): number {
    return this.time.now;
  }

  private getSessionHullIntegrity(): number {
    const hullSystem = gameSession.getShipSystemsState().hull;
    return Phaser.Math.Clamp(hullSystem.integrity, 0, 100);
  }

  private getPlayerHullFromSession(): number {
    return Phaser.Math.Clamp(
      Math.round((this.getSessionHullIntegrity() / 100) * PLAYER_MAX_HULL),
      0,
      PLAYER_MAX_HULL,
    );
  }

  private syncPlayerHullToSession(): void {
    const integrity = Phaser.Math.Clamp(Math.round((Math.max(0, this.playerHull) / PLAYER_MAX_HULL) * 100), 0, 100);
    gameSession.setShipSystemIntegrity("hull", integrity);
    gameSession.setShipSystemOnline("hull", integrity > 0);
  }

  private restorePlayerHullFromSession(): void {
    this.playerHull = this.getPlayerHullFromSession();
  }

  private syncTrackedMissionPlanet(orbitTimeMs = this.getOrbitTimeMs()): void {
    this.trackedMissionPlanet = gameSession.getMissionPlanetForMission(
      this.routeMissionId ?? gameSession.getTrackedMissionId(),
      orbitTimeMs,
    );
  }

  private updateCelestialMotion(orbitTimeMs = this.getOrbitTimeMs()): void {
    this.syncTrackedMissionPlanet(orbitTimeMs);
    this.activePlanetViews.forEach((planetView, planetId) => {
      const planet = this.galaxyPlanetsById.get(planetId);
      const system = planet ? this.galaxySystemsById.get(planet.systemId) : null;
      if (!planet || !system) {
        return;
      }

      const position = getGalaxyPlanetPositionAtTime(this.galaxyDefinition, planet, orbitTimeMs);
      planetView.root.setPosition(position.x - system.x, position.y - system.y);
    });

    this.activeMoonViews.forEach((moonView, moonId) => {
      const moon = this.galaxyMoonsById.get(moonId);
      const planet = moon ? this.galaxyPlanetsById.get(moon.planetId) : null;
      const system = moon ? this.galaxySystemsById.get(moon.systemId) : null;
      if (!moon || !planet || !system) {
        return;
      }

      const planetPosition = getGalaxyPlanetPositionAtTime(this.galaxyDefinition, planet, orbitTimeMs);
      const moonPosition = getGalaxyMoonPositionAtTime(this.galaxyDefinition, moon, orbitTimeMs);
      moonView.orbit.setPosition(planetPosition.x - system.x, planetPosition.y - system.y);
      moonView.root.setPosition(moonPosition.x - system.x, moonPosition.y - system.y);
    });
  }

  private createCelestialSystemView(system: GalaxySystemRecord): SpaceCelestialSystemView {
    const children: Phaser.GameObjects.GameObject[] = [];
    const starRadius = this.getSystemStarRenderRadius(system);
    const trackedMissionId = this.getTrackedMissionPlanet()?.missionId ?? null;
    const systemPlanets = this.galaxyPlanetsBySystemId.get(system.id) ?? [];
    const homeworldPlanet = systemPlanets.find((planet) => planet.isHomeworld) ?? null;
    const systemIsHomeworld = Boolean(homeworldPlanet);
    const starCoreColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(system.starColor),
      Phaser.Display.Color.IntegerToColor(0xffffff),
      100,
      systemIsHomeworld ? 42 : 34,
    ).color;
    const planetIds: string[] = [];
    const moonIds: string[] = [];
    const starHalo = this.add.circle(0, 0, starRadius * (systemIsHomeworld ? 1.42 : 1.24), system.starColor, systemIsHomeworld ? 0.2 : 0.14);
    const starGlow = this.add.circle(0, 0, starRadius * (systemIsHomeworld ? 0.9 : 0.78), system.starColor, systemIsHomeworld ? 0.32 : 0.24);
    const starBurst = createStarburstGraphic(
      this,
      starRadius * (systemIsHomeworld ? 0.98 : 0.84),
      starRadius * (systemIsHomeworld ? 0.42 : 0.34),
      systemIsHomeworld ? 8 : 4,
      system.starColor,
      systemIsHomeworld ? 0.99 : 0.95,
      0xffffff,
      systemIsHomeworld ? 0.5 : 0.34,
      1.8,
    );
    const starCoreGlow = this.add.circle(0, 0, starRadius * 0.22, starCoreColor, systemIsHomeworld ? 0.32 : 0.24);
    const starLabel = this.add.text(0, -(starRadius + 16), system.name, {
      fontFamily: "Arial",
      fontSize: systemIsHomeworld ? "14px" : "13px",
      color: systemIsHomeworld ? "#fff5d7" : "#f6fbff",
      fontStyle: systemIsHomeworld ? "bold" : "normal",
      backgroundColor: systemIsHomeworld ? "#10203acc" : "#08111bc0",
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5, 1).setAlpha(systemIsHomeworld ? 0.92 : 0.72);
    children.push(starHalo, starGlow, starBurst, starCoreGlow, starLabel);

    systemPlanets.forEach((planet) => {
      const localX = planet.x - system.x;
      const localY = planet.y - system.y;
      const orbitDistance = Phaser.Math.Distance.Between(system.x, system.y, planet.x, planet.y);
      const orbit = this.add.ellipse(0, 0, orbitDistance * 2, orbitDistance * 2, 0xffffff, 0)
        .setStrokeStyle(1, system.starColor, planet.isHomeworld ? 0.18 : 0.08);
      children.push(orbit);

      const planetRadius = this.getPlanetRenderRadius(planet);
      const landingRing = this.add.circle(0, 0, planetRadius * 1.48, 0xffffff, 0)
        .setStrokeStyle(2, 0xfff1cb, 0.12);
      const halo = this.add.circle(0, 0, planetRadius * (planet.isHomeworld ? 1.18 : 1.12), planet.color, planet.isHomeworld ? 0.24 : 0.16);
      const homeworldRing = planet.isHomeworld
        ? this.add.circle(0, 0, planetRadius + 4, 0xffffff, 0).setStrokeStyle(2, 0xfff1cf, 0.72)
        : null;
      const body = this.add.circle(0, 0, planetRadius, planet.color, 0.96)
        .setStrokeStyle(2, planet.isHomeworld ? 0xfff4d9 : 0xf2fbff, planet.isHomeworld ? 0.82 : 0.44);
      const homeworldCap = planet.isHomeworld
        ? this.add.circle(-(planetRadius * 0.24), -(planetRadius * 0.22), planetRadius * 0.24, 0xfff7e5, 0.3)
        : null;
      const glow = this.add.circle(-(planetRadius * 0.18), -(planetRadius * 0.2), planetRadius * 0.18, 0xffffff, planet.isHomeworld ? 0.3 : 0.24);
      const label = this.add.text(0, planetRadius + 12, planet.name, {
        fontFamily: "Arial",
        fontSize: planet.isHomeworld ? "13px" : "12px",
        color: planet.isHomeworld ? "#fff1cf" : "#dce9ff",
        fontStyle: planet.isHomeworld ? "bold" : "normal",
        backgroundColor: planet.isHomeworld ? "#10203ac8" : "#08111bcc",
        padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 0);
      label.setVisible(planet.isHomeworld || planet.missionIds.includes(trackedMissionId ?? ""));

      const planetChildren = homeworldRing && homeworldCap
        ? [landingRing, halo, homeworldRing, body, homeworldCap, glow, label]
        : [landingRing, halo, body, glow, label];
      const planetRoot = this.add.container(localX, localY, planetChildren);
      planetRoot.setSize(planetRadius * 3, planetRadius * 3);
      children.push(planetRoot);
      this.activePlanetViews.set(planet.id, {
        planetId: planet.id,
        root: planetRoot,
        landingRing,
        label,
      });
      planetIds.push(planet.id);

      const moons = this.galaxyMoonsByPlanetId.get(planet.id) ?? [];
      moons.forEach((moon) => {
        const localMoonX = moon.x - system.x;
        const localMoonY = moon.y - system.y;
        const moonOrbitDistance = Phaser.Math.Distance.Between(planet.x, planet.y, moon.x, moon.y);
        const moonOrbit = this.add.ellipse(localX, localY, moonOrbitDistance * 2, moonOrbitDistance * 2, 0xffffff, 0)
          .setStrokeStyle(1, planet.color, 0.1);
        const moonRadius = this.getMoonRenderRadius(moon);
        const moonHalo = this.add.circle(0, 0, moonRadius * 1.18, moon.color, 0.14);
        const moonBody = this.add.circle(0, 0, moonRadius, moon.color, 0.9)
          .setStrokeStyle(1, 0xf4fbff, 0.34);
        const moonRoot = this.add.container(localMoonX, localMoonY, [moonHalo, moonBody]);
        children.push(moonOrbit, moonRoot);
        this.activeMoonViews.set(moon.id, {
          moonId: moon.id,
          planetId: planet.id,
          root: moonRoot,
          orbit: moonOrbit,
        });
        moonIds.push(moon.id);
      });
    });

    const root = this.add.container(system.x, system.y, children).setDepth(5);
    root.setSize(starRadius * (systemIsHomeworld ? 5.6 : 4.8), starRadius * (systemIsHomeworld ? 5.6 : 4.8));
    return {
      systemId: system.id,
      root,
      planetIds,
      moonIds,
    };
  }

  private createStationView(station: GalaxyStationRecord): SpaceStationView {
    const halo = this.add.circle(0, 0, station.radius * 1.8, station.color, 0.08);
    const driftRing = this.add.ellipse(0, 0, station.radius * 2.1, station.radius * 1.28, 0xffffff, 0)
      .setRotation(0.36)
      .setStrokeStyle(3, station.borderColor, 0.78);
    const innerDriftRing = this.add.ellipse(0, 0, station.radius * 1.52, station.radius * 0.92, 0xffffff, 0)
      .setRotation(0.36)
      .setStrokeStyle(1.5, 0xeef7ff, 0.42);
    const spine = this.add.rectangle(0, 0, 20, station.radius * 1.68, 0xdfeeff, 0.96)
      .setStrokeStyle(2, station.borderColor, 0.52);
    const dockArmLeft = this.add.rectangle(-(station.radius * 0.52), 0, station.radius * 0.54, 14, station.color, 0.92)
      .setRotation(0.06)
      .setStrokeStyle(2, station.borderColor, 0.46);
    const dockArmRight = this.add.rectangle(station.radius * 0.52, 0, station.radius * 0.54, 14, station.color, 0.92)
      .setRotation(-0.06)
      .setStrokeStyle(2, station.borderColor, 0.46);
    const upperHab = this.add.circle(0, -(station.radius * 0.54), station.radius * 0.18, station.color, 0.92)
      .setStrokeStyle(2, station.borderColor, 0.52);
    const lowerHab = this.add.circle(0, station.radius * 0.54, station.radius * 0.18, station.color, 0.92)
      .setStrokeStyle(2, station.borderColor, 0.52);
    const dockPodLeft = this.add.circle(-(station.radius * 0.86), 0, station.radius * 0.14, 0xe8f4ff, 0.96)
      .setStrokeStyle(2, station.borderColor, 0.42);
    const dockPodRight = this.add.circle(station.radius * 0.86, 0, station.radius * 0.14, 0xe8f4ff, 0.96)
      .setStrokeStyle(2, station.borderColor, 0.42);
    const core = this.add.circle(0, 0, station.radius * 0.26, 0xf6fbff, 0.98)
      .setStrokeStyle(2.4, station.borderColor, 0.68);
    const coreGlow = this.add.circle(0, 0, station.radius * 0.44, station.borderColor, 0.12);
    const interactionRing = this.add.circle(0, 0, station.radius + STATION_INTERACTION_BUFFER, 0xffffff, 0)
      .setStrokeStyle(2, station.borderColor, 0.12);
    const label = this.add.text(0, station.radius + 18, station.name, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#e6f3ff",
      backgroundColor: "#08111bcc",
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5, 0).setAlpha(0.8);

    const root = this.add.container(station.x, station.y, [
      interactionRing,
      halo,
      driftRing,
      innerDriftRing,
      coreGlow,
      dockArmLeft,
      dockArmRight,
      spine,
      upperHab,
      lowerHab,
      dockPodLeft,
      dockPodRight,
      core,
      label,
    ]).setDepth(11);
    root.setSize((station.radius + STATION_INTERACTION_BUFFER) * 2.2, (station.radius + STATION_INTERACTION_BUFFER) * 2.2);

    return {
      stationId: station.id,
      root,
      interactionRing,
      label,
    };
  }

  private initializeWorldStates(): void {
    this.fieldStates = new Map<string, SpaceFieldObjectState>(this.worldDefinition.fieldSeeds.map((seed) => ([seed.id, {
      id: seed.id,
      cellKey: seed.cellKey,
      kind: seed.kind,
      placementType: seed.placementType,
      isLarge: seed.isLarge,
      x: seed.x,
      y: seed.y,
      baseRadius: seed.baseRadius,
      radius: seed.radius,
      hp: seed.hp,
      maxHp: seed.hp,
      velocityX: seed.velocityX,
      velocityY: seed.velocityY,
      spin: seed.spin,
      rotation: seed.rotation,
      flash: 0,
      destroyed: false,
    }] as const)));

    this.shipStates = new Map<string, SpaceFactionShipState>(this.worldDefinition.factionSeeds.map((seed) => ([seed.id, this.createShipStateFromSeed(seed)] as const)));
  }

  private createShipStateFromSeed(seed: SpaceWorldDefinition["factionSeeds"][number]): SpaceFactionShipState {
    const faction = getSpaceFactionConfig(seed.factionId, seed.originRaceId ?? null);
    const roleProfile = getSpaceShipRoleCombatProfile(seed.shipRole ?? null);
    const aimDirection = angleToDirection(seed.rotation);
    return {
      id: seed.id,
      cellKey: seed.cellKey,
      factionId: seed.factionId,
      originRaceId: seed.originRaceId ?? null,
      shipRole: seed.shipRole ?? null,
      assignmentKind: seed.assignmentKind ?? null,
      assignmentZoneId: seed.assignmentZoneId ?? null,
      sectorId: seed.sectorId,
      groupId: seed.groupId,
      leaderId: seed.leaderId,
      formationOffsetX: seed.formationOffsetX,
      formationOffsetY: seed.formationOffsetY,
      x: seed.x,
      y: seed.y,
      velocityX: seed.velocityX,
      velocityY: seed.velocityY,
      rotation: seed.rotation,
      patrolX: seed.patrolX,
      patrolY: seed.patrolY,
      customColor: seed.customColor ?? null,
      customTrimColor: seed.customTrimColor ?? null,
      customGlowColor: seed.customGlowColor ?? null,
      guardAnchorX: seed.guardAnchorX ?? null,
      guardAnchorY: seed.guardAnchorY ?? null,
      guardRadius: seed.guardRadius ?? null,
      originPoolId: seed.originPoolId ?? null,
      originPoolKind: seed.originPoolKind ?? null,
      originZoneId: seed.originZoneId ?? null,
      originSystemId: seed.originSystemId ?? null,
      aimX: aimDirection.x,
      aimY: aimDirection.y,
      radius: faction.radius * roleProfile.radiusMultiplier,
      hp: faction.maxHull * roleProfile.hullMultiplier,
      maxHp: faction.maxHull * roleProfile.hullMultiplier,
      flash: 0,
      fireCooldown: createInitialFactionFireCooldown(seed.id, faction.fireCooldown * roleProfile.fireCooldownMultiplier),
      provokedByPlayer: false,
      provokedByShips: [],
      aggressionTimer: 0,
      strafeSign: createInitialStrafeSign(seed.id),
      routeTargetKind: null,
      routeTargetId: null,
      routeWaitRemainingMs: 0,
      supportRepairCooldown: 0,
      destroyed: false,
    };
  }

  private syncActiveWorld(force = false): void {
    const desiredFieldCellKeys = getSpaceCellKeysAroundPosition(
      this.shipRoot.x,
      this.shipRoot.y,
      SPACE_WORLD_CONFIG.activeFieldCellRadius,
    );
    const desiredShipCellKeys = getSpaceCellKeysAroundPosition(
      this.shipRoot.x,
      this.shipRoot.y,
      SPACE_WORLD_CONFIG.activeShipCellRadius,
    );
    const desiredCelestialCellKeys = getSpaceCellKeysAroundPosition(
      this.shipRoot.x,
      this.shipRoot.y,
      CELESTIAL_CELL_RADIUS,
    );
    const shouldRefreshFields = force || !areCellKeyListsEqual(this.activeFieldCellKeys, desiredFieldCellKeys);
    const shouldRefreshShips = force || !areCellKeyListsEqual(this.activeShipCellKeys, desiredShipCellKeys);
    const shouldRefreshCelestials = force || !areCellKeyListsEqual(this.activeCelestialCellKeys, desiredCelestialCellKeys);

    this.activeFieldCellKeys = desiredFieldCellKeys;
    this.activeShipCellKeys = desiredShipCellKeys;
    this.activeCelestialCellKeys = desiredCelestialCellKeys;
    this.syncActiveFieldObjects(desiredFieldCellKeys, shouldRefreshFields);
    this.syncActiveFactionShips(desiredShipCellKeys, shouldRefreshShips);
    this.syncActiveCelestialSystems(desiredCelestialCellKeys, shouldRefreshCelestials);
    this.syncActiveStations(desiredCelestialCellKeys, shouldRefreshCelestials);
  }

  private syncActiveCelestialSystems(cellKeys: SpaceWorldCellKey[], shouldActivate: boolean): void {
    const activeCellKeySet = new Set(cellKeys);

    this.activeCelestialSystems.forEach((systemView, systemId) => {
      const system = this.galaxySystemsById.get(systemId);
      if (!system) {
        this.deactivateCelestialSystem(systemView);
        return;
      }

      const currentCellKey = getSpaceCellKeyAtPosition(system.x, system.y, SPACE_WORLD_CONFIG);
      if (activeCellKeySet.has(currentCellKey)) {
        return;
      }

      this.deactivateCelestialSystem(systemView);
    });

    if (!shouldActivate) {
      return;
    }

    const activeSystemIds = new Set(this.activeCelestialSystems.keys());
    cellKeys.forEach((cellKey) => {
      const systems = this.galaxySystemsByCell.get(cellKey) ?? [];
      systems.forEach((system) => {
        if (activeSystemIds.has(system.id)) {
          return;
        }

        const view = this.createCelestialSystemView(system);
        this.activeCelestialSystems.set(system.id, view);
      });
    });
  }

  private deactivateCelestialSystem(systemView: SpaceCelestialSystemView): void {
    systemView.planetIds.forEach((planetId) => {
      this.activePlanetViews.delete(planetId);
    });
    systemView.moonIds.forEach((moonId) => {
      this.activeMoonViews.delete(moonId);
    });
    systemView.root.destroy(true);
    this.activeCelestialSystems.delete(systemView.systemId);
  }

  private syncActiveStations(cellKeys: SpaceWorldCellKey[], shouldActivate: boolean): void {
    const activeCellKeySet = new Set(cellKeys);

    this.activeStationViews.forEach((stationView, stationId) => {
      const station = this.galaxyStationsById.get(stationId);
      if (!station) {
        this.deactivateStationView(stationView);
        return;
      }

      const currentCellKey = getSpaceCellKeyAtPosition(station.x, station.y, SPACE_WORLD_CONFIG);
      if (activeCellKeySet.has(currentCellKey)) {
        return;
      }

      this.deactivateStationView(stationView);
    });

    if (!shouldActivate) {
      return;
    }

    const activeStationIds = new Set(this.activeStationViews.keys());
    cellKeys.forEach((cellKey) => {
      const stations = this.galaxyStationsByCell.get(cellKey) ?? [];
      stations.forEach((station) => {
        if (activeStationIds.has(station.id)) {
          return;
        }

        const view = this.createStationView(station);
        this.activeStationViews.set(station.id, view);
      });
    });
  }

  private deactivateStationView(stationView: SpaceStationView): void {
    stationView.root.destroy(true);
    this.activeStationViews.delete(stationView.stationId);
  }

  private syncActiveFieldObjects(cellKeys: SpaceWorldCellKey[], shouldActivate: boolean): void {
    const activeCellKeySet = new Set(cellKeys);

    for (let index = this.asteroids.length - 1; index >= 0; index -= 1) {
      const fieldObject = this.asteroids[index];
      const currentCellKey = getSpaceCellKeyAtPosition(fieldObject.root.x, fieldObject.root.y, SPACE_WORLD_CONFIG);
      if (activeCellKeySet.has(currentCellKey)) {
        continue;
      }

      this.deactivateFieldObject(fieldObject);
    }

    if (!shouldActivate) {
      return;
    }

    const activeIds = new Set(this.asteroids.map((fieldObject) => fieldObject.id));
    this.fieldStates.forEach((state) => {
      if (state.destroyed || activeIds.has(state.id) || !activeCellKeySet.has(state.cellKey)) {
        return;
      }

      this.asteroids.push(this.createFieldObject(state));
    });
  }

  private syncActiveFactionShips(cellKeys: SpaceWorldCellKey[], shouldActivate: boolean): void {
    const activeCellKeySet = new Set(cellKeys);

    for (let index = this.factionShips.length - 1; index >= 0; index -= 1) {
      const ship = this.factionShips[index];
      const currentCellKey = getSpaceCellKeyAtPosition(ship.root.x, ship.root.y, SPACE_WORLD_CONFIG);
      if (activeCellKeySet.has(currentCellKey)) {
        continue;
      }

      this.deactivateFactionShip(ship);
    }

    if (!shouldActivate) {
      return;
    }

    const activeIds = new Set(this.factionShips.map((ship) => ship.id));
    this.shipStates.forEach((state) => {
      if (state.destroyed || activeIds.has(state.id) || !activeCellKeySet.has(state.cellKey)) {
        return;
      }

      this.factionShips.push(this.createFactionShip(state));
    });
  }

  private registerFactionSeed(seed: SpaceWorldDefinition["factionSeeds"][number]): void {
    this.worldDefinition.factionSeeds.push(seed);
    this.worldDefinition.factionSeedIndex[seed.id] = seed;
    if (!this.worldDefinition.factionSeedsByCell[seed.cellKey]) {
      this.worldDefinition.factionSeedsByCell[seed.cellKey] = [];
    }
    this.worldDefinition.factionSeedsByCell[seed.cellKey].push(seed);
    this.worldDefinition.factionCounts[seed.factionId] += 1;
  }

  private unregisterFactionSeed(seed: SpaceWorldDefinition["factionSeeds"][number]): void {
    delete this.worldDefinition.factionSeedIndex[seed.id];
    Phaser.Utils.Array.Remove(this.worldDefinition.factionSeeds, seed);
    const cellBucket = this.worldDefinition.factionSeedsByCell[seed.cellKey];
    if (cellBucket) {
      Phaser.Utils.Array.Remove(cellBucket, seed);
      if (cellBucket.length <= 0) {
        delete this.worldDefinition.factionSeedsByCell[seed.cellKey];
      }
    }
    this.worldDefinition.factionCounts[seed.factionId] = Math.max(0, this.worldDefinition.factionCounts[seed.factionId] - 1);
  }

  private replaceForceSeeds(forceSeeds: SpaceWorldDefinition["factionSeeds"]): void {
    [...this.worldDefinition.factionSeeds]
      .filter((seed) => seed.originPoolId)
      .forEach((seed) => this.unregisterFactionSeed(seed));
    forceSeeds.forEach((seed) => this.registerFactionSeed(seed));
  }

  private mergeForceShipState(
    existingState: SpaceFactionShipState | undefined,
    desiredState: SpaceFactionShipState,
    preserveKinematics: boolean,
  ): SpaceFactionShipState {
    if (!existingState) {
      return desiredState;
    }

    const hpRatio = existingState.maxHp > 0
      ? Phaser.Math.Clamp(existingState.hp / existingState.maxHp, 0, 1)
      : 1;
    return {
      ...desiredState,
      x: preserveKinematics ? existingState.x : desiredState.x,
      y: preserveKinematics ? existingState.y : desiredState.y,
      velocityX: preserveKinematics ? existingState.velocityX : desiredState.velocityX,
      velocityY: preserveKinematics ? existingState.velocityY : desiredState.velocityY,
      rotation: preserveKinematics ? existingState.rotation : desiredState.rotation,
      aimX: preserveKinematics ? existingState.aimX : desiredState.aimX,
      aimY: preserveKinematics ? existingState.aimY : desiredState.aimY,
      patrolX: preserveKinematics ? existingState.patrolX : desiredState.patrolX,
      patrolY: preserveKinematics ? existingState.patrolY : desiredState.patrolY,
      hp: Math.min(desiredState.maxHp, desiredState.maxHp * hpRatio),
      flash: existingState.flash,
      fireCooldown: existingState.fireCooldown,
      provokedByPlayer: existingState.provokedByPlayer,
      provokedByShips: [...existingState.provokedByShips],
      aggressionTimer: existingState.aggressionTimer,
      strafeSign: existingState.strafeSign,
      routeTargetKind: preserveKinematics ? existingState.routeTargetKind : desiredState.routeTargetKind,
      routeTargetId: preserveKinematics ? existingState.routeTargetId : desiredState.routeTargetId,
      routeWaitRemainingMs: preserveKinematics ? existingState.routeWaitRemainingMs : desiredState.routeWaitRemainingMs,
      supportRepairCooldown: existingState.supportRepairCooldown,
      destroyed: false,
    };
  }

  private shouldReplaceActiveForceShipVisual(
    ship: SpaceFactionShip,
    nextState: SpaceFactionShipState,
  ): boolean {
    return ship.factionId !== nextState.factionId
      || ship.originRaceId !== nextState.originRaceId
      || ship.shipRole !== nextState.shipRole
      || ship.radius !== nextState.radius
      || ship.customColor !== nextState.customColor
      || ship.customTrimColor !== nextState.customTrimColor
      || ship.customGlowColor !== nextState.customGlowColor;
  }

  private applyActiveForceShipState(
    ship: SpaceFactionShip,
    nextState: SpaceFactionShipState,
  ): void {
    ship.factionId = nextState.factionId;
    ship.originRaceId = nextState.originRaceId;
    ship.shipRole = nextState.shipRole;
    ship.assignmentKind = nextState.assignmentKind;
    ship.assignmentZoneId = nextState.assignmentZoneId;
    ship.sectorId = nextState.sectorId;
    ship.groupId = nextState.groupId;
    ship.leaderId = nextState.leaderId;
    ship.formationOffsetX = nextState.formationOffsetX;
    ship.formationOffsetY = nextState.formationOffsetY;
    ship.root.setPosition(nextState.x, nextState.y);
    ship.velocity.set(nextState.velocityX, nextState.velocityY);
    ship.root.rotation = nextState.rotation;
    ship.aimDirection.set(nextState.aimX, nextState.aimY);
    ship.patrolTarget.set(nextState.patrolX, nextState.patrolY);
    ship.customColor = nextState.customColor;
    ship.customTrimColor = nextState.customTrimColor;
    ship.customGlowColor = nextState.customGlowColor;
    if (nextState.guardAnchorX !== null && nextState.guardAnchorY !== null) {
      if (!ship.guardAnchor) {
        ship.guardAnchor = new Phaser.Math.Vector2(nextState.guardAnchorX, nextState.guardAnchorY);
      } else {
        ship.guardAnchor.set(nextState.guardAnchorX, nextState.guardAnchorY);
      }
    } else {
      ship.guardAnchor = null;
    }
    ship.guardRadius = nextState.guardRadius ?? 0;
    ship.originPoolId = nextState.originPoolId;
    ship.originPoolKind = nextState.originPoolKind;
    ship.originZoneId = nextState.originZoneId;
    ship.originSystemId = nextState.originSystemId;
    ship.radius = nextState.radius;
    ship.hp = nextState.hp;
    ship.maxHp = nextState.maxHp;
    ship.flash = nextState.flash;
    ship.fireCooldown = nextState.fireCooldown;
    ship.provokedByPlayer = nextState.provokedByPlayer;
    ship.provokedByShips = new Set(nextState.provokedByShips);
    ship.aggressionTimer = nextState.aggressionTimer;
    ship.strafeSign = nextState.strafeSign;
    ship.routeTargetKind = nextState.routeTargetKind;
    ship.routeTargetId = nextState.routeTargetId;
    ship.routeWaitRemainingMs = nextState.routeWaitRemainingMs;
    ship.supportRepairCooldown = nextState.supportRepairCooldown;
  }

  private replaceActiveForceShip(ship: SpaceFactionShip, nextState: SpaceFactionShipState): void {
    const shipIndex = this.factionShips.indexOf(ship);
    if (shipIndex < 0) {
      this.shipStates.set(nextState.id, nextState);
      return;
    }

    this.clearShipTargetReferences(ship.id);
    ship.root.destroy(true);
    this.factionShips.splice(shipIndex, 1);
    this.shipStates.set(nextState.id, nextState);
    if (this.activeShipCellKeys.includes(nextState.cellKey)) {
      this.factionShips.push(this.createFactionShip(nextState));
    }
  }

  private removeInvalidForceShips(validShipIds: Set<string>): void {
    for (let index = this.factionShips.length - 1; index >= 0; index -= 1) {
      const ship = this.factionShips[index];
      if (!ship.originPoolId || validShipIds.has(ship.id)) {
        continue;
      }

      this.clearShipTargetReferences(ship.id);
      ship.root.destroy(true);
      this.factionShips.splice(index, 1);
    }

    [...this.shipStates.keys()].forEach((shipId) => {
      const state = this.shipStates.get(shipId);
      if (!state?.originPoolId || validShipIds.has(shipId)) {
        return;
      }
      this.shipStates.delete(shipId);
    });
  }

  private reconcileForceShips(): void {
    const forceSeeds = createSpaceForceShipSeeds(
      this.galaxyDefinition,
      this.forceState,
      this.warState,
      SPACE_WORLD_CONFIG,
    );
    this.replaceForceSeeds(forceSeeds);
    const seedLookup = new Map(forceSeeds.map((seed) => ([seed.id, seed] as const)));
    this.removeInvalidForceShips(new Set(seedLookup.keys()));

    seedLookup.forEach((seed, shipId) => {
      const desiredState = this.createShipStateFromSeed(seed);
      const activeShip = this.factionShips.find((candidate) => candidate.id === shipId && candidate.originPoolId);
      const existingState = activeShip
        ? this.captureFactionShipState(activeShip)
        : this.shipStates.get(shipId);
      if (activeShip) {
        const mergedState = this.mergeForceShipState(existingState, desiredState, true);
        if (this.shouldReplaceActiveForceShipVisual(activeShip, mergedState)) {
          this.replaceActiveForceShip(activeShip, mergedState);
        } else {
          this.applyActiveForceShipState(activeShip, mergedState);
          this.shipStates.set(shipId, mergedState);
        }
        return;
      }

      const mergedState = this.mergeForceShipState(existingState, desiredState, false);
      this.shipStates.set(shipId, mergedState);
    });
  }

  private spawnProducedForceShips(spawnedShipIds: string[]): void {
    if (spawnedShipIds.length <= 0) {
      return;
    }

    const seedLookup = new Map(
      createSpaceForceShipSeeds(this.galaxyDefinition, this.forceState, this.warState, SPACE_WORLD_CONFIG)
        .filter((seed) => spawnedShipIds.includes(seed.id))
        .map((seed) => ([seed.id, seed] as const)),
    );

    seedLookup.forEach((seed, shipId) => {
      if (this.shipStates.has(shipId)) {
        return;
      }

      this.registerFactionSeed(seed);
      const state = this.createShipStateFromSeed(seed);
      this.shipStates.set(shipId, state);
      if (this.activeShipCellKeys.includes(state.cellKey)) {
        this.factionShips.push(this.createFactionShip(state));
      }
    });
  }

  private updateFactionWar(deltaMs: number): void {
    this.warStateUpdateTimerMs = Math.max(0, this.warStateUpdateTimerMs - deltaMs);
    if (this.warStateUpdateTimerMs > 0) {
      return;
    }

    const warUpdate = advanceFactionWarState(
      this.warState,
      this.galaxyDefinition,
      this.forceState,
      this.zoneAdjacency,
      deltaMs,
    );
    this.warStateUpdateTimerMs = WAR_STATE_UPDATE_INTERVAL_MS;
    if (!warUpdate.changed) {
      return;
    }

    this.galaxyStateDirty = true;
    this.warStateDirty = true;
    this.forceStateDirty = true;
    this.reconcileForceShips();
  }

  private updateForceProduction(deltaMs: number): void {
    const productionUpdate = advanceFactionForceProduction(this.forceState, this.galaxyDefinition, deltaMs);
    if (!productionUpdate.changed) {
      return;
    }

    this.forceStateDirty = true;
    this.spawnProducedForceShips(productionUpdate.spawnedShipIds);
  }

  private syncDirtyForceState(deltaMs: number): void {
    this.forceStateSyncTimerMs = Math.max(0, this.forceStateSyncTimerMs - deltaMs);
    if ((!this.forceStateDirty && !this.galaxyStateDirty && !this.warStateDirty) || this.forceStateSyncTimerMs > 0) {
      return;
    }

    this.syncForceStateToSession();
  }

  private syncForceStateToSession(): void {
    if (!this.forceStateDirty && !this.galaxyStateDirty && !this.warStateDirty) {
      return;
    }

    gameSession.setGalaxyDefinition(this.galaxyDefinition);
    gameSession.setFactionWarState(this.warState);
    gameSession.setFactionForceState(this.forceState);
    this.galaxyStateDirty = false;
    this.warStateDirty = false;
    this.forceStateDirty = false;
    this.forceStateSyncTimerMs = FORCE_STATE_SYNC_INTERVAL_MS;
  }

  private captureFieldObjectState(fieldObject: SpaceFieldObject, destroyed = false): SpaceFieldObjectState {
    return {
      id: fieldObject.id,
      cellKey: getSpaceCellKeyAtPosition(fieldObject.root.x, fieldObject.root.y, SPACE_WORLD_CONFIG),
      kind: fieldObject.kind,
      placementType: fieldObject.placementType,
      isLarge: fieldObject.isLarge,
      x: fieldObject.root.x,
      y: fieldObject.root.y,
      baseRadius: fieldObject.baseRadius,
      radius: fieldObject.radius,
      hp: Math.max(0, fieldObject.hp),
      maxHp: fieldObject.maxHp,
      velocityX: fieldObject.velocity.x,
      velocityY: fieldObject.velocity.y,
      spin: fieldObject.spin,
      rotation: fieldObject.root.rotation,
      flash: fieldObject.flash,
      destroyed,
    };
  }

  private captureFactionShipState(ship: SpaceFactionShip, destroyed = false): SpaceFactionShipState {
    return {
      id: ship.id,
      cellKey: getSpaceCellKeyAtPosition(ship.root.x, ship.root.y, SPACE_WORLD_CONFIG),
      factionId: ship.factionId,
      originRaceId: ship.originRaceId,
      shipRole: ship.shipRole,
      assignmentKind: ship.assignmentKind,
      assignmentZoneId: ship.assignmentZoneId,
      sectorId: ship.sectorId,
      groupId: ship.groupId,
      leaderId: ship.leaderId,
      formationOffsetX: ship.formationOffsetX,
      formationOffsetY: ship.formationOffsetY,
      x: ship.root.x,
      y: ship.root.y,
      velocityX: ship.velocity.x,
      velocityY: ship.velocity.y,
      rotation: ship.root.rotation,
      patrolX: ship.patrolTarget.x,
      patrolY: ship.patrolTarget.y,
      customColor: ship.customColor,
      customTrimColor: ship.customTrimColor,
      customGlowColor: ship.customGlowColor,
      guardAnchorX: ship.guardAnchor?.x ?? null,
      guardAnchorY: ship.guardAnchor?.y ?? null,
      guardRadius: ship.guardRadius > 0 ? ship.guardRadius : null,
      originPoolId: ship.originPoolId,
      originPoolKind: ship.originPoolKind,
      originZoneId: ship.originZoneId,
      originSystemId: ship.originSystemId,
      aimX: ship.aimDirection.x,
      aimY: ship.aimDirection.y,
      radius: ship.radius,
      hp: Math.max(0, ship.hp),
      maxHp: ship.maxHp,
      flash: ship.flash,
      fireCooldown: ship.fireCooldown,
      provokedByPlayer: ship.provokedByPlayer,
      provokedByShips: [...ship.provokedByShips],
      aggressionTimer: ship.aggressionTimer,
      strafeSign: ship.strafeSign,
      routeTargetKind: ship.routeTargetKind,
      routeTargetId: ship.routeTargetId,
      routeWaitRemainingMs: ship.routeWaitRemainingMs,
      supportRepairCooldown: ship.supportRepairCooldown,
      destroyed,
    };
  }

  private deactivateFieldObject(fieldObject: SpaceFieldObject): void {
    this.fieldStates.set(fieldObject.id, this.captureFieldObjectState(fieldObject));
    this.clearFieldTargetReferences(fieldObject.id);
    fieldObject.root.destroy(true);
    Phaser.Utils.Array.Remove(this.asteroids, fieldObject);
  }

  private deactivateFactionShip(ship: SpaceFactionShip): void {
    this.shipStates.set(ship.id, this.captureFactionShipState(ship));
    this.clearShipTargetReferences(ship.id);
    ship.root.destroy(true);
    Phaser.Utils.Array.Remove(this.factionShips, ship);
  }

  private clearFieldTargetReferences(fieldId: string): void {
    if (this.selectedTarget?.kind === "field" && this.selectedTarget.fieldObject.id === fieldId) {
      this.selectedTarget = null;
    }
    if (this.autoAimTarget?.kind === "field" && this.autoAimTarget.fieldObject.id === fieldId) {
      this.autoAimTarget = null;
    }
  }

  private clearShipTargetReferences(shipId: string): void {
    if (this.selectedTarget?.kind === "ship" && this.selectedTarget.ship.id === shipId) {
      this.selectedTarget = null;
    }
    if (this.autoAimTarget?.kind === "ship" && this.autoAimTarget.ship.id === shipId) {
      this.autoAimTarget = null;
    }
  }

  private getShipPalette(state: Pick<SpaceFactionShipState, "factionId" | "customColor" | "customTrimColor" | "customGlowColor">): {
    color: number;
    trimColor: number;
    glowColor: number;
  } {
    const faction = SPACE_FACTIONS[state.factionId];
    return {
      color: state.customColor ?? faction.color,
      trimColor: state.customTrimColor ?? faction.trimColor,
      glowColor: state.customGlowColor ?? faction.glowColor,
    };
  }

  private createFieldObject(state: SpaceFieldObjectState): SpaceFieldObject {
    const baseRadius = state.baseRadius > 0 ? state.baseRadius : state.radius;
    const visualScale = Phaser.Math.Clamp(state.radius / Math.max(1, baseRadius), 0.22, 1);
    const isBelt = state.placementType === "belt";
    const hullColor = state.kind === "asteroid"
      ? state.isLarge
        ? 0x71849f
        : isBelt
          ? 0x7b8698
          : 0x6e7e93
      : 0x877864;
    const strokeColor = state.kind === "asteroid"
      ? state.isLarge
        ? 0xe0eeff
        : isBelt
          ? 0xd4e4fa
          : 0xc2d4eb
      : 0xcbb185;
    const rockPoints = createRockPoints(baseRadius, state.id);
    const shadow = this.add.ellipse(6, 8, baseRadius * 1.84, baseRadius * 1.28, 0x000000, state.isLarge ? 0.22 : 0.16);
    const hull = this.add.polygon(0, 0, rockPoints, hullColor, 0.98).setStrokeStyle(state.isLarge ? 3 : 2, strokeColor, 0.66);
    const craterA = this.add.circle(-baseRadius * 0.18, baseRadius * 0.14, Math.max(4, baseRadius * 0.16), 0x34404d, 0.24);
    const craterB = this.add.circle(baseRadius * 0.2, -baseRadius * 0.1, Math.max(3, baseRadius * 0.12), 0x2f3945, 0.18);
    const craterC = state.isLarge
      ? this.add.circle(baseRadius * 0.06, baseRadius * 0.28, Math.max(5, baseRadius * 0.14), 0x26313d, 0.16)
      : null;
    const shardGlow = state.isLarge
      ? this.add.circle(0, 0, baseRadius * 1.08, 0xcde3ff, 0.08)
      : this.add.circle(0, 0, baseRadius * 0.92, strokeColor, 0.05);
    const damageRing = this.add.circle(0, 0, baseRadius * 0.76, 0xff8f57, 0).setStrokeStyle(2, 0xffcc92, 0);
    const visualChildren = craterC
      ? [shadow, shardGlow, hull, craterA, craterB, craterC, damageRing]
      : [shadow, shardGlow, hull, craterA, craterB, damageRing];
    const visualRoot = this.add.container(0, 0, visualChildren).setScale(visualScale);
    const root = this.add.container(state.x, state.y, [visualRoot]).setDepth(state.isLarge ? 9 : 8);
    root.rotation = state.rotation;
    root.setSize(state.radius * 2.2, state.radius * 2.2);

    return {
      id: state.id,
      kind: state.kind,
      placementType: state.placementType,
      isLarge: state.isLarge,
      root,
      visualRoot,
      damageRing,
      velocity: new Phaser.Math.Vector2(state.velocityX, state.velocityY),
      baseRadius,
      radius: state.radius,
      hp: state.hp,
      maxHp: state.maxHp,
      spin: state.spin,
      flash: state.flash ?? 0,
    };
  }

  private createFactionShip(state: SpaceFactionShipState): SpaceFactionShip {
    const faction = this.getShipCombatConfig(state);
    const palette = this.getShipPalette(state);
    const roleProfile = getSpaceShipRoleCombatProfile(state.shipRole);
    const bodyRadius = state.radius;
    const children: Phaser.GameObjects.GameObject[] = [];
    const shadow = this.add.ellipse(3, 7, bodyRadius * 2.1, bodyRadius * 1.05, 0x000000, 0.2);
    const damageRing = this.add.circle(0, 0, bodyRadius * 0.94, palette.glowColor, 0).setStrokeStyle(2, 0xf8fbff, 0);
    const thruster = this.add.ellipse(0, bodyRadius - 1, 12 + (bodyRadius * 0.16), 18 + (bodyRadius * 0.28), palette.glowColor, 0.2).setStrokeStyle(1, palette.trimColor, 0.28);
    children.push(shadow, damageRing, thruster);

    if (state.shipRole) {
      if (state.shipRole === "base-fighter" || state.shipRole === "support-fighter") {
        children.push(
          this.add.rectangle(-bodyRadius * 0.72, bodyRadius * 0.28, bodyRadius * 0.42, bodyRadius * 1.02, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.34),
          this.add.rectangle(bodyRadius * 0.72, bodyRadius * 0.28, bodyRadius * 0.42, bodyRadius * 1.02, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.34),
          this.add.rectangle(0, bodyRadius * 0.22, bodyRadius * 1.04, bodyRadius * 1.24, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.8),
          this.add.triangle(0, -bodyRadius * 0.78, 0, -bodyRadius * 1.12, -bodyRadius * 0.46, -bodyRadius * 0.08, bodyRadius * 0.46, -bodyRadius * 0.08, palette.trimColor, 0.94).setStrokeStyle(1, 0xf7fbff, 0.42),
          this.add.rectangle(0, bodyRadius * 0.98, bodyRadius * 0.64, bodyRadius * 0.34, 0x183248, 0.98).setStrokeStyle(1, palette.trimColor, 0.34),
        );
        if (state.shipRole === "support-fighter") {
          children.push(
            this.add.ellipse(0, bodyRadius * 0.1, bodyRadius * 1.42, bodyRadius * 0.7, palette.glowColor, 0.12).setStrokeStyle(1, palette.trimColor, 0.3),
            this.add.rectangle(-bodyRadius * 1.02, bodyRadius * 0.2, bodyRadius * 0.2, bodyRadius * 0.8, palette.trimColor, 0.94).setStrokeStyle(1, 0xf7fbff, 0.34),
            this.add.rectangle(bodyRadius * 1.02, bodyRadius * 0.2, bodyRadius * 0.2, bodyRadius * 0.8, palette.trimColor, 0.94).setStrokeStyle(1, 0xf7fbff, 0.34),
            this.add.circle(0, -bodyRadius * 0.1, bodyRadius * 0.18, 0xf7fbff, 0.5),
          );
        }
      } else if (state.shipRole === "attack-warship") {
        children.push(
          this.add.rectangle(-bodyRadius * 0.98, bodyRadius * 0.26, bodyRadius * 0.46, bodyRadius * 1.18, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.36),
          this.add.rectangle(bodyRadius * 0.98, bodyRadius * 0.26, bodyRadius * 0.46, bodyRadius * 1.18, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.36),
          this.add.rectangle(0, bodyRadius * 0.24, bodyRadius * 1.22, bodyRadius * 1.54, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.82),
          this.add.triangle(0, -bodyRadius * 1.08, 0, -bodyRadius * 1.52, -bodyRadius * 0.54, -bodyRadius * 0.1, bodyRadius * 0.54, -bodyRadius * 0.1, palette.trimColor, 0.96).setStrokeStyle(1, 0xf7fbff, 0.42),
          this.add.rectangle(0, bodyRadius * 1.12, bodyRadius * 0.92, bodyRadius * 0.44, 0x183248, 0.98).setStrokeStyle(1, palette.trimColor, 0.34),
          this.add.rectangle(-bodyRadius * 0.7, -bodyRadius * 0.2, bodyRadius * 0.18, bodyRadius * 0.92, palette.trimColor, 0.92).setStrokeStyle(1, 0xf7fbff, 0.28),
          this.add.rectangle(bodyRadius * 0.7, -bodyRadius * 0.2, bodyRadius * 0.18, bodyRadius * 0.92, palette.trimColor, 0.92).setStrokeStyle(1, 0xf7fbff, 0.28),
        );
      } else {
        children.push(
          this.add.rectangle(-bodyRadius * 1.08, bodyRadius * 0.3, bodyRadius * 0.56, bodyRadius * 1.16, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.38),
          this.add.rectangle(bodyRadius * 1.08, bodyRadius * 0.3, bodyRadius * 0.56, bodyRadius * 1.16, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.38),
          this.add.rectangle(0, bodyRadius * 0.34, bodyRadius * 1.36, bodyRadius * 1.62, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.84),
          this.add.polygon(0, -bodyRadius * 0.84, createStarPoints(bodyRadius * 0.34, bodyRadius * 0.16, 4), palette.trimColor, 0.92).setStrokeStyle(1, 0xf7fbff, 0.32),
          this.add.rectangle(0, bodyRadius * 1.18, bodyRadius * 0.98, bodyRadius * 0.46, 0x183248, 0.98).setStrokeStyle(1, palette.trimColor, 0.34),
          this.add.ellipse(0, bodyRadius * 0.16, bodyRadius * 1.76, bodyRadius * 0.96, palette.glowColor, 0.12).setStrokeStyle(1, palette.trimColor, 0.22),
        );
      }
    } else if (state.factionId === "empire") {
      children.push(
        this.add.rectangle(-14, 4, 10, 24, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.36),
        this.add.rectangle(14, 4, 10, 24, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.36),
        this.add.rectangle(0, 3, 24, 32, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.74),
        this.add.triangle(0, -18, 0, -24, -10, -2, 10, -2, palette.trimColor, 0.96).setStrokeStyle(1, 0xf7fbff, 0.48),
        this.add.rectangle(0, 20, 12, 10, 0x2b3648, 0.96).setStrokeStyle(1, palette.trimColor, 0.28),
      );
    } else if (state.factionId === "republic") {
      children.push(
        this.add.rectangle(-18, 5, 14, 22, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.3),
        this.add.rectangle(18, 5, 14, 22, palette.color, 0.98).setStrokeStyle(1, palette.trimColor, 0.3),
        this.add.rectangle(0, 3, 30, 30, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.78),
        this.add.triangle(0, -17, 0, -23, -11, -2, 11, -2, palette.trimColor, 0.94).setStrokeStyle(1, 0xf7fbff, 0.42),
        this.add.rectangle(0, 19, 18, 9, 0x203652, 0.96).setStrokeStyle(1, palette.trimColor, 0.28),
      );
    } else if (state.factionId === "homeguard") {
      children.push(
        this.add.rectangle(-17, 6, 10, 22, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.34),
        this.add.rectangle(17, 6, 10, 22, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.34),
        this.add.rectangle(0, 6, 24, 30, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.8),
        this.add.polygon(0, -14, createStarPoints(10, 4.6, 4), palette.trimColor, 0.92).setStrokeStyle(1, 0xf7fbff, 0.42),
        this.add.rectangle(0, 21, 14, 10, 0x183248, 0.98).setStrokeStyle(1, palette.trimColor, 0.34),
      );
    } else if (state.factionId === "pirate") {
      const leftWing = this.add.rectangle(-16, 7, 8, 24, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.3);
      leftWing.rotation = -0.26;
      const rightWing = this.add.rectangle(16, 7, 8, 24, palette.color, 0.96).setStrokeStyle(1, palette.trimColor, 0.3);
      rightWing.rotation = 0.26;
      children.push(
        leftWing,
        rightWing,
        this.add.rectangle(0, 4, 20, 28, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.72),
        this.add.triangle(0, -18, 0, -25, -10, 0, 10, 0, palette.trimColor, 0.95).setStrokeStyle(1, 0xfff3c5, 0.4),
        this.add.rectangle(0, 20, 14, 8, 0x473c1d, 0.96).setStrokeStyle(1, palette.trimColor, 0.3),
      );
    } else {
      children.push(
        this.add.rectangle(-16, 6, 10, 20, 0x555d68, 0.98).setStrokeStyle(1, palette.trimColor, 0.24),
        this.add.rectangle(16, 6, 10, 20, 0x555d68, 0.98).setStrokeStyle(1, palette.trimColor, 0.24),
        this.add.rectangle(0, 5, 26, 30, palette.color, 0.98).setStrokeStyle(2, palette.trimColor, 0.7),
        this.add.triangle(0, -16, 0, -22, -9, -2, 9, -2, palette.trimColor, 0.92).setStrokeStyle(1, 0xf7fbff, 0.42),
        this.add.rectangle(0, 21, 20, 10, 0x4a515c, 0.96).setStrokeStyle(1, palette.trimColor, 0.24),
      );
    }

    if (state.shipRole && roleProfile.radiusMultiplier > 1.15) {
      children.push(
        this.add.ellipse(0, bodyRadius * 0.18, bodyRadius * 2.1, bodyRadius * 1.12, palette.glowColor, 0.08).setStrokeStyle(1, palette.trimColor, 0.18),
      );
    }

    const root = this.add.container(state.x, state.y, children).setDepth(13);
    root.rotation = state.rotation;
    root.setSize(bodyRadius * 2.6, bodyRadius * 2.6);
    const aimDirection = new Phaser.Math.Vector2(state.aimX, state.aimY);
    if (aimDirection.lengthSq() <= 0.0001) {
      aimDirection.copy(angleToDirection(state.rotation));
    } else {
      aimDirection.normalize();
    }

    return {
      id: state.id,
      factionId: state.factionId,
      originRaceId: state.originRaceId,
      shipRole: state.shipRole,
      assignmentKind: state.assignmentKind,
      assignmentZoneId: state.assignmentZoneId,
      sectorId: state.sectorId,
      groupId: state.groupId,
      leaderId: state.leaderId,
      formationOffsetX: state.formationOffsetX,
      formationOffsetY: state.formationOffsetY,
      root,
      thruster,
      damageRing,
      velocity: new Phaser.Math.Vector2(state.velocityX, state.velocityY),
      aimDirection,
      patrolTarget: new Phaser.Math.Vector2(state.patrolX, state.patrolY),
      customColor: state.customColor ?? null,
      customTrimColor: state.customTrimColor ?? null,
      customGlowColor: state.customGlowColor ?? null,
      guardAnchor: state.guardAnchorX !== null && state.guardAnchorY !== null
        ? new Phaser.Math.Vector2(state.guardAnchorX, state.guardAnchorY)
        : null,
      guardRadius: state.guardRadius ?? 0,
      originPoolId: state.originPoolId,
      originPoolKind: state.originPoolKind,
      originZoneId: state.originZoneId,
      originSystemId: state.originSystemId,
      radius: faction.radius,
      hp: state.hp,
      maxHp: state.maxHp,
      flash: state.flash,
      fireCooldown: state.fireCooldown,
      provokedByPlayer: state.provokedByPlayer,
      provokedByShips: new Set<string>(state.provokedByShips),
      aggressionTimer: state.aggressionTimer,
      strafeSign: state.strafeSign,
      routeTargetKind: state.routeTargetKind ?? null,
      routeTargetId: state.routeTargetId ?? null,
      routeWaitRemainingMs: state.routeWaitRemainingMs ?? 0,
      supportRepairCooldown: state.supportRepairCooldown ?? 0,
    };
  }

  private createHud(): void {
    this.add.rectangle(236, 100, 412, 140, 0x07111d, 0.84)
      .setStrokeStyle(2, 0x365983, 0.72)
      .setScrollFactor(0)
      .setDepth(50);

    this.add.text(38, 34, "SPACE TEST FIELD", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#f3fbff",
      fontStyle: "bold",
    }).setScrollFactor(0).setDepth(51);

    this.routeText = this.add.text(38, 64, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#8fd4ff",
      wordWrap: { width: 376 },
    }).setScrollFactor(0).setDepth(51);

    this.statusText = this.add.text(38, 90, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d7eaff",
      wordWrap: { width: 376 },
    }).setScrollFactor(0).setDepth(51);

    this.contactText = this.add.text(38, 114, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#c8def9",
      wordWrap: { width: 376 },
    }).setScrollFactor(0).setDepth(51);

    this.coordinateText = this.add.text(GAME_WIDTH - 34, 92, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#eef7ff",
      align: "right",
      backgroundColor: "#09131fcc",
      padding: { x: 10, y: 8 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(51);

    this.waypointArrow = this.add.triangle(GAME_WIDTH * 0.5, 124, 0, 18, 13, -12, -13, -12, 0xffc56e, 0.96)
      .setStrokeStyle(2, 0xfff1cf, 0.86)
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);
    this.waypointLabel = this.add.text(GAME_WIDTH * 0.5, 142, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#fff1cf",
      fontStyle: "bold",
      backgroundColor: "#09131fcc",
      padding: { x: 8, y: 4 },
      align: "center",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(51).setVisible(false);

    this.desktopControlsText = this.add.text(GAME_WIDTH * 0.5, GAME_HEIGHT - 28, "WASD move  |  Mouse aim  |  LMB fire  |  F interact / land  |  Space hyperdrive  |  T target  |  TAB inventory  |  M map  |  ESC pause  |  X return to ship", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#dcecff",
      backgroundColor: "#09131fcc",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(51);
    this.desktopUiObjects.push(this.desktopControlsText);

    this.logbookButton = createMenuButton({
      scene: this,
      x: 928,
      y: 44,
      width: 126,
      height: 40,
      label: "Data Pad",
      onClick: () => this.toggleLogbookOverlay(),
      depth: 52,
      accentColor: 0x2b4462,
    });
    this.logbookButton.container.setScrollFactor(0);

    this.pauseButton = createMenuButton({
      scene: this,
      x: 1052,
      y: 44,
      width: 110,
      height: 40,
      label: "Pause",
      onClick: () => this.openPauseMenu(),
      depth: 52,
      accentColor: 0x233956,
    });
    this.pauseButton.container.setScrollFactor(0);

    this.returnButton = createMenuButton({
      scene: this,
      x: 1176,
      y: 44,
      width: 184,
      height: 40,
      label: "Return To Ship",
      onClick: () => this.returnToShip(),
      depth: 52,
      accentColor: 0x234566,
    });
    this.returnButton.container.setScrollFactor(0);

    this.radar = new SpaceRadarDisplay(this, {
      x: GAME_WIDTH * 0.5,
      y: 72,
      width: SHIP_RADAR_CONFIG.width,
      height: SHIP_RADAR_CONFIG.height,
      range: SHIP_RADAR_CONFIG.range,
      sweepSpeedDegPerSec: SHIP_RADAR_CONFIG.sweepSpeedDegPerSec,
      sweepWidthDeg: SHIP_RADAR_CONFIG.sweepWidthDeg,
      memoryFadeMs: SHIP_RADAR_CONFIG.memoryFadeMs,
      memoryClearMs: SHIP_RADAR_CONFIG.memoryClearMs,
      depth: 52,
    });
  }

  private createTouchUi(): void {
    if (!this.touchCapable) {
      return;
    }

    this.moveBase = this.add.circle(148, 566, TOUCH_STICK_RADIUS, 0x173054, 0.36).setDepth(54).setScrollFactor(0);
    this.moveBase.setStrokeStyle(3, 0x72a8ff, 0.65);
    this.moveKnob = this.add.circle(148, 566, 34, 0xdde9ff, 0.72).setDepth(55).setScrollFactor(0);
    this.moveKnob.setStrokeStyle(2, 0xffffff, 0.9);

    const moveLabel = this.add.text(148, 470, "MOVE / FACE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(55).setScrollFactor(0);

    const attackLabel = this.add.text(1114, 470, "ATTACK", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(55).setScrollFactor(0);

    this.attackButton = createMenuButton({
      scene: this,
      x: 1114,
      y: 566,
      width: 150,
      height: 68,
      label: "Attack",
      onClick: () => undefined,
      onPress: (pointer) => this.beginTouchAttack(pointer),
      onRelease: (pointer) => this.endTouchAttack(pointer),
      depth: 55,
      accentColor: 0x1f5a87,
    });
    this.attackButton.container.setScrollFactor(0);

    this.targetButton = createMenuButton({
      scene: this,
      x: 1188,
      y: 486,
      width: 112,
      height: 52,
      label: "Target",
      onClick: () => this.cycleTargetLock(),
      depth: 55,
      accentColor: 0x2b4966,
    });
    this.targetButton.container.setScrollFactor(0);

    this.abilityOneButton = createMenuButton({
      scene: this,
      x: 922,
      y: 572,
      width: 134,
      height: 62,
      label: "Hyper",
      onClick: () => this.queueTouchHyperdriveTap(),
      onPress: (pointer) => this.beginTouchHyperdrive(pointer),
      onRelease: (pointer) => this.endTouchHyperdrive(pointer),
      depth: 55,
      accentColor: 0x32536f,
    });
    this.abilityOneButton.container.setScrollFactor(0);

    this.abilityTwoButton = createMenuButton({
      scene: this,
      x: 942,
      y: 494,
      width: 126,
      height: 54,
      label: "Interact",
      onClick: () => this.tryHandlePrimaryInteraction(),
      depth: 55,
      accentColor: 0x2a394c,
      disabled: true,
    });
    this.abilityTwoButton.container.setScrollFactor(0);

    this.touchUiObjects.push(
      this.moveBase,
      this.moveKnob,
      moveLabel,
      attackLabel,
      this.attackButton.container,
      this.targetButton.container,
      this.abilityOneButton.container,
      this.abilityTwoButton.container,
    );
  }

  private createCommandOverlays(): void {
    this.logbookOverlay = new LogbookOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
      onOpenSettings: () => this.openPauseMenu(),
      onRequestTab: (tab) => this.openDataPadTab(tab),
    });

    this.inventoryOverlay = new InventoryOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
      onOpenSettings: () => this.openPauseMenu(),
      onRequestTab: (tab) => this.openDataPadTab(tab),
    });

    this.galaxyMapOverlay = new GalaxyMapOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
      onOpenSettings: () => this.openPauseMenu(),
      onRequestTab: (tab) => this.openDataPadTab(tab),
    });

    this.stationOverlay = new SpaceStationOverlay({
      scene: this,
      onClose: () => {
        this.stationOverlayStationId = null;
        this.handleCommandOverlayClosed();
      },
      onRepair: () => this.handleStationRepairRequested(),
    });
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.inputKeys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      interact: Phaser.Input.Keyboard.KeyCodes.F,
      hyperdrive: Phaser.Input.Keyboard.KeyCodes.SPACE,
      returnToShip: Phaser.Input.Keyboard.KeyCodes.X,
    }) as SpaceScene["inputKeys"];

    keyboard.on("keydown-ESC", () => {
      this.reportDesktopInput();
      if (this.isMenuOverlayVisible()) {
        this.closeCommandOverlays();
        return;
      }
      this.openPauseMenu();
    });
    keyboard.on("keydown-M", () => {
      this.reportDesktopInput();
      this.openDataPadTab("map");
    });
    keyboard.on("keydown-TAB", (event: KeyboardEvent) => {
      event.preventDefault();
      this.reportDesktopInput();
      this.openDataPadTab("inventory");
    });
    keyboard.on("keydown-T", () => {
      this.reportDesktopInput();
      if (this.isMenuOverlayVisible()) {
        return;
      }
      this.cycleTargetLock();
    });
    keyboard.on("keydown-F", () => {
      this.reportDesktopInput();
      if (this.isMenuOverlayVisible()) {
        return;
      }
      this.tryHandlePrimaryInteraction();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ESC");
      keyboard.removeAllListeners("keydown-M");
      keyboard.removeAllListeners("keydown-TAB");
      keyboard.removeAllListeners("keydown-T");
      keyboard.removeAllListeners("keydown-F");
    });
  }

  private bindPointers(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.playerDestroyed || this.returningToShip || this.isMenuOverlayVisible()) {
        return;
      }

      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (this.touchMode && touchLike) {
        if (this.pointerOverUi(pointer)) {
          return;
        }

        if (this.movePointerId === null && this.moveBase && this.moveKnob) {
          this.movePointerId = pointer.id;
          this.anchorMoveStick(pointer.x, pointer.y);
          this.updateMoveStick(pointer);
        }
        return;
      }

      if (this.pointerOverUi(pointer)) {
        return;
      }

      this.reportDesktopInput();
      this.fireHeld = true;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isMenuOverlayVisible()) {
        return;
      }

      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (this.touchMode && touchLike && pointer.id === this.movePointerId && pointer.isDown) {
        this.updateMoveStick(pointer);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.touchMode && this.isTouchPointer(pointer)) {
        if (pointer.id === this.movePointerId) {
          this.movePointerId = null;
          this.touchMoveVector.set(0, 0);
          this.resetMoveStick();
        }
        if (pointer.id === this.attackPointerId) {
          this.endTouchAttack(pointer);
        }
        if (pointer.id === this.hyperdrivePointerId) {
          this.endTouchHyperdrive(pointer);
        }
        return;
      }

      this.reportDesktopInput();
      this.fireHeld = false;
    });
  }

  private configureCamera(): void {
    this.cameras.main.setBounds(0, 0, SPACE_WORLD_CONFIG.width, SPACE_WORLD_CONFIG.height);
    this.cameras.main.startFollow(this.shipRoot, true, 1, 1);
    this.cameras.main.setRoundPixels(true);
  }

  private updateAimDirection(): void {
    if (isShipHyperdriveTurningLocked(this.hyperdrive.state)) {
      const lockedDirection = this.getLockedHyperdriveDirection();
      if (lockedDirection.lengthSq() <= 0.001) {
        return;
      }

      this.aimDirection.copy(lockedDirection);
      this.shipRoot.rotation = Math.atan2(this.aimDirection.y, this.aimDirection.x) + Math.PI * 0.5;
      return;
    }

    const baseDirection = this.getBaseAimDirection();
    if (isShipHyperdriveCombatLocked(this.hyperdrive.state)) {
      this.autoAimTarget = null;
      if (baseDirection.lengthSq() <= 0.001) {
        return;
      }

      this.aimDirection.copy(baseDirection.normalize());
      this.shipRoot.rotation = Math.atan2(this.aimDirection.y, this.aimDirection.x) + Math.PI * 0.5;
      return;
    }

    this.refreshAutoAimTarget(baseDirection);
    const combatDirection = this.getCombatAimDirection(baseDirection);
    if (combatDirection.lengthSq() <= 0.001) {
      return;
    }

    this.aimDirection.copy(combatDirection.normalize());
    this.shipRoot.rotation = Math.atan2(this.aimDirection.y, this.aimDirection.x) + Math.PI * 0.5;
  }

  private updateHyperdriveState(_dt: number, deltaMs: number): void {
    if (this.hyperdrive.cooldownRemainingMs > 0) {
      this.hyperdrive.cooldownRemainingMs = Math.max(0, this.hyperdrive.cooldownRemainingMs - deltaMs);
      if (this.hyperdrive.cooldownRemainingMs <= 0 && this.hyperdrive.state === "cooldown") {
        this.hyperdrive.state = "normal";
        this.hyperdrive.lastDisengageReason = null;
      }
    }

    if (this.hyperdrive.exitBlendRemainingMs > 0) {
      this.hyperdrive.exitBlendRemainingMs = Math.max(0, this.hyperdrive.exitBlendRemainingMs - deltaMs);
    }

    const chargeHeld = this.isHyperdriveChargeHeld();
    const manualDropRequested = this.consumeHyperdriveDropRequest();

    if (this.hyperdrive.state === "active") {
      if (manualDropRequested) {
        this.disengageHyperdrive("Manual drop complete.");
        return;
      }

      const interruptReason = this.getHyperdriveInterruptReason();
      if (interruptReason) {
        this.disengageHyperdrive(interruptReason);
      }
      return;
    }

    if (this.hyperdrive.state === "charging") {
      if (!chargeHeld) {
        this.cancelHyperdriveCharge("Charge aborted.");
        return;
      }

      this.hyperdrive.chargeElapsedMs += deltaMs;
      this.updateHyperdriveCountdownCue();
      if (this.hyperdrive.chargeElapsedMs >= SHIP_HYPERDRIVE_CONFIG.chargeDurationMs) {
        this.engageHyperdrive();
      }
      return;
    }

    if (this.hyperdrive.state === "normal" && chargeHeld) {
      this.beginHyperdriveCharge();
      return;
    }

    if (this.hyperdrive.state === "cooldown" && manualDropRequested) {
      this.hyperdrive.lastDisengageReason = `Cooldown ${Math.ceil(this.hyperdrive.cooldownRemainingMs / 1000)}s`;
    }
  }

  private beginHyperdriveCharge(): void {
    if (this.hyperdrive.state !== "normal" || this.hyperdrive.cooldownRemainingMs > 0) {
      return;
    }

    this.hyperdrive.state = "charging";
    this.hyperdrive.chargeElapsedMs = 0;
    this.hyperdrive.lastDisengageReason = "Charging hyperdrive.";
    this.hyperdriveCountdownValue = Math.ceil(
      SHIP_HYPERDRIVE_CONFIG.chargeDurationMs / SHIP_HYPERDRIVE_CONFIG.countdownIntervalMs,
    );
    retroSfx.play("hyperdrive-charge", {
      volume: 0.84,
      pitch: 0.98,
    });
    this.playHyperdriveCountdownCue(this.hyperdriveCountdownValue);
  }

  private cancelHyperdriveCharge(reason: string): void {
    if (this.hyperdrive.state !== "charging") {
      return;
    }

    this.hyperdrive.state = "normal";
    this.hyperdrive.chargeElapsedMs = 0;
    this.hyperdriveCountdownValue = 0;
    this.hyperdrive.lastDisengageReason = reason;
  }

  private updateHyperdriveCountdownCue(): void {
    if (this.hyperdrive.state !== "charging") {
      return;
    }

    const remainingMs = Math.max(0, SHIP_HYPERDRIVE_CONFIG.chargeDurationMs - this.hyperdrive.chargeElapsedMs);
    const countdownValue = Math.ceil(remainingMs / SHIP_HYPERDRIVE_CONFIG.countdownIntervalMs);
    if (countdownValue > 0 && countdownValue < this.hyperdriveCountdownValue) {
      this.playHyperdriveCountdownCue(countdownValue);
    }
    this.hyperdriveCountdownValue = countdownValue;
  }

  private playHyperdriveCountdownCue(countdownValue: number): void {
    if (countdownValue <= 0) {
      return;
    }

    retroSfx.play("hyperdrive-countdown", {
      volume: 0.7,
      pitch: 0.88 + ((3 - countdownValue) * 0.08),
    });
  }

  private engageHyperdrive(): void {
    const lockedDirection = this.aimDirection.clone().normalize();
    if (lockedDirection.lengthSq() <= 0.001) {
      lockedDirection.copy(angleToDirection(this.shipRoot.rotation));
    }

    this.hyperdrive.state = "active";
    this.hyperdrive.chargeElapsedMs = SHIP_HYPERDRIVE_CONFIG.chargeDurationMs;
    this.hyperdrive.lockedDirectionX = lockedDirection.x;
    this.hyperdrive.lockedDirectionY = lockedDirection.y;
    this.hyperdrive.lastDisengageReason = "Hyperdrive engaged.";
    this.hyperdriveCountdownValue = 0;
    this.fireHeld = false;
    this.shipVelocity.copy(lockedDirection.scale(PLAYER_HYPERDRIVE_MAX_SPEED));
    retroSfx.play("hyperdrive-engage", {
      volume: 0.9,
      pitch: 1.02,
    });
  }

  private disengageHyperdrive(reason: string): void {
    const wasActive = this.hyperdrive.state === "active";
    if (!wasActive) {
      return;
    }

    const lockedDirection = this.getLockedHyperdriveDirection();
    const recoverySpeed = PLAYER_MAX_SPEED * SHIP_HYPERDRIVE_CONFIG.postDropSpeedMultiplier;
    this.hyperdrive.state = "cooldown";
    this.hyperdrive.chargeElapsedMs = 0;
    this.hyperdrive.cooldownRemainingMs = SHIP_HYPERDRIVE_CONFIG.cooldownDurationMs;
    this.hyperdrive.exitBlendRemainingMs = SHIP_HYPERDRIVE_CONFIG.exitBlendDurationMs;
    this.hyperdrive.lastDisengageReason = reason;
    this.fireHeld = false;

    if (lockedDirection.lengthSq() > 0.001) {
      const preservedSpeed = Math.max(recoverySpeed, Math.min(this.shipVelocity.length(), PLAYER_HYPERDRIVE_MAX_SPEED));
      this.shipVelocity.copy(lockedDirection.scale(preservedSpeed));
    }

    retroSfx.play("hyperdrive-disengage", {
      volume: 0.82,
      pitch: 0.96,
    });
  }

  private getLockedHyperdriveDirection(): Phaser.Math.Vector2 {
    const lockedDirection = new Phaser.Math.Vector2(
      this.hyperdrive.lockedDirectionX,
      this.hyperdrive.lockedDirectionY,
    );
    if (lockedDirection.lengthSq() <= 0.001) {
      return angleToDirection(this.shipRoot.rotation);
    }

    return lockedDirection.normalize();
  }

  private isHyperdriveChargeHeld(): boolean {
    const keyboardHeld = this.inputKeys?.hyperdrive.isDown ?? false;
    return keyboardHeld || this.hyperdriveTouchHeld;
  }

  private consumeHyperdriveDropRequest(): boolean {
    const keyboardDown = this.inputKeys?.hyperdrive.isDown ?? false;
    const keyboardTap = keyboardDown && !this.hyperdriveKeyWasDown;
    this.hyperdriveKeyWasDown = keyboardDown;
    const touchTap = this.hyperdriveTouchTapQueued;
    this.hyperdriveTouchTapQueued = false;
    return keyboardTap || touchTap;
  }

  private getHyperdriveSafetyTargets(): SpaceHyperdriveDropTarget[] {
    const missionPlanet = this.getTrackedMissionPlanet();
    if (!missionPlanet) {
      return [];
    }

    return [{
      id: `mission:${missionPlanet.missionId}`,
      label: missionPlanet.name,
      x: missionPlanet.x,
      y: missionPlanet.y,
      safetyRadius: missionPlanet.radius + SHIP_HYPERDRIVE_CONFIG.proximitySafetyPadding,
      autoDropRadius: missionPlanet.radius + SHIP_HYPERDRIVE_CONFIG.waypointAutoDropPadding,
    }];
  }

  private getHyperdriveInterruptReason(): string | null {
    const targets = this.getHyperdriveSafetyTargets();
    for (const target of targets) {
      const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, target.x, target.y);
      if (distance <= target.autoDropRadius) {
        return `${target.label} waypoint reached. Dropping from hyperdrive.`;
      }
      if (distance <= target.safetyRadius) {
        return `${target.label} proximity alert. Dropping from hyperdrive.`;
      }
    }

    return null;
  }

  private updatePlayerShip(dt: number): void {
    if (!this.inputKeys) {
      return;
    }

    this.keyboardMoveVector.set(0, 0);
    if (this.inputKeys.left.isDown) {
      this.keyboardMoveVector.x -= 1;
    }
    if (this.inputKeys.right.isDown) {
      this.keyboardMoveVector.x += 1;
    }
    if (this.inputKeys.up.isDown) {
      this.keyboardMoveVector.y -= 1;
    }
    if (this.inputKeys.down.isDown) {
      this.keyboardMoveVector.y += 1;
    }

    if (this.touchCapable && (
      this.keyboardMoveVector.lengthSq() > 0.001
      || this.inputKeys.hyperdrive.isDown
      || this.inputKeys.returnToShip.isDown
    )) {
      this.reportDesktopInput();
    }

    const movementSource = this.touchMode && this.touchMoveVector.lengthSq() > 0.01
      ? this.touchMoveVector
      : this.keyboardMoveVector;
    this.moveDirection.copy(movementSource);
    const hyperdriveActive = isShipHyperdriveTurningLocked(this.hyperdrive.state);

    if (hyperdriveActive) {
      const lockedDirection = this.getLockedHyperdriveDirection();
      this.thrusting = true;
      this.moveDirection.copy(lockedDirection);
      this.shipVelocity.copy(lockedDirection.scale(PLAYER_HYPERDRIVE_MAX_SPEED));
    } else {
      this.thrusting = this.moveDirection.lengthSq() > 0;
      if (this.thrusting) {
        this.moveDirection.normalize();
        this.shipVelocity.x += this.moveDirection.x * PLAYER_ACCELERATION * dt;
        this.shipVelocity.y += this.moveDirection.y * PLAYER_ACCELERATION * dt;
        this.shipVelocity.scale(Math.max(0, 1 - (PLAYER_THRUST_DRAG * dt)));
      } else {
        this.shipVelocity.scale(Math.max(0, 1 - (PLAYER_COAST_DRAG * dt)));
      }

      if (this.hyperdrive.exitBlendRemainingMs > 0) {
        this.shipVelocity.scale(Math.max(0, 1 - (SHIP_HYPERDRIVE_CONFIG.exitDrag * dt)));
      }
    }

    let maxSpeed = PLAYER_MAX_SPEED;
    if (hyperdriveActive) {
      maxSpeed = PLAYER_HYPERDRIVE_MAX_SPEED;
    } else if (this.hyperdrive.exitBlendRemainingMs > 0) {
      const blendProgress = Phaser.Math.Clamp(
        this.hyperdrive.exitBlendRemainingMs / SHIP_HYPERDRIVE_CONFIG.exitBlendDurationMs,
        0,
        1,
      );
      maxSpeed = Phaser.Math.Linear(PLAYER_MAX_SPEED, PLAYER_HYPERDRIVE_MAX_SPEED, blendProgress);
    }

    if (this.shipVelocity.length() > maxSpeed) {
      this.shipVelocity.setLength(maxSpeed);
    }

    this.shipRoot.x += this.shipVelocity.x * dt;
    this.shipRoot.y += this.shipVelocity.y * dt;
    this.constrainMovingBody(this.shipRoot, PLAYER_RADIUS, this.shipVelocity, 0.16);
    gameSession.setShipSpacePosition(this.shipRoot.x, this.shipRoot.y);

    const combatLocked = isShipHyperdriveCombatLocked(this.hyperdrive.state);
    const lockAutoFire = !combatLocked && gameSession.settings.controls.autoFire && this.autoAimTarget !== null;
    if (!combatLocked && (this.fireHeld || lockAutoFire) && this.fireCooldown <= 0) {
      this.fireCooldown = PLAYER_FIRE_COOLDOWN;
      this.firePlayerShot();
    }

    this.updatePlayerVisuals();
  }

  private updatePlayerVisuals(): void {
    const activeTopSpeed = this.hyperdrive.state === "active" ? PLAYER_HYPERDRIVE_MAX_SPEED : PLAYER_MAX_SPEED;
    const speedPulse = Phaser.Math.Clamp(this.shipVelocity.length() / activeTopSpeed, 0, 1);
    if (this.hyperdrive.state === "active") {
      this.shipThruster.setFillStyle(0xfff0b0, 0.92);
      this.shipThruster.setScale(1.18, 2.6);
    } else if (this.hyperdrive.state === "charging") {
      const chargeProgress = Phaser.Math.Clamp(
        this.hyperdrive.chargeElapsedMs / SHIP_HYPERDRIVE_CONFIG.chargeDurationMs,
        0,
        1,
      );
      this.shipThruster.setFillStyle(0xc9eeff, 0.38 + (chargeProgress * 0.38));
      this.shipThruster.setScale(1, 1.08 + (chargeProgress * 0.82));
    } else if (this.thrusting) {
      this.shipThruster.setFillStyle(0x79e6ff, 0.58 + (speedPulse * 0.2));
      this.shipThruster.setScale(1, 1.1 + (speedPulse * 0.45));
    } else {
      this.shipThruster.setFillStyle(0x79e6ff, 0.16 + (speedPulse * 0.16));
      this.shipThruster.setScale(1, 0.82 + (speedPulse * 0.18));
    }

    this.shipDamageRing.setStrokeStyle(2, 0xffdbbc, this.playerFlash * 0.84);
    this.shipDamageRing.setFillStyle(0xff9f74, this.playerFlash * 0.16);
  }

  private constrainMovingBody(
    root: Phaser.GameObjects.Container,
    radius: number,
    velocity: Phaser.Math.Vector2,
    rebound = 0.22,
  ): void {
    const clamped = clampPointToGalaxyTravelBounds(root.x, root.y, radius);
    const collidedX = Math.abs(clamped.x - root.x) > 0.01;
    const collidedY = Math.abs(clamped.y - root.y) > 0.01;
    root.x = clamped.x;
    root.y = clamped.y;
    if (!collidedX && !collidedY) {
      return;
    }

    if (collidedX) {
      velocity.x *= -rebound;
    }
    if (collidedY) {
      velocity.y *= -rebound;
    }
    velocity.scale(0.88);
  }

  private getBaseAimDirection(): Phaser.Math.Vector2 {
    const direction = this.touchMode
      ? this.touchAimVector.clone()
      : this.getDesktopAimVector();

    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || direction.lengthSq() <= 0.0001) {
      return this.aimDirection.clone();
    }

    return direction.normalize();
  }

  private getDesktopAimVector(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    if (!pointer.isDown && pointer.x === 0 && pointer.y === 0) {
      return this.aimDirection.clone();
    }

    this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.pointerWorld);
    return new Phaser.Math.Vector2(
      this.pointerWorld.x - this.shipRoot.x,
      this.pointerWorld.y - this.shipRoot.y,
    );
  }

  private getCombatAimDirection(baseDirection: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    if (!this.autoAimTarget) {
      return baseDirection;
    }

    if (this.autoAimTarget.kind === "ship") {
      return new Phaser.Math.Vector2(
        this.autoAimTarget.ship.root.x - this.shipRoot.x,
        this.autoAimTarget.ship.root.y - this.shipRoot.y,
      ).normalize();
    }

    return new Phaser.Math.Vector2(
      this.autoAimTarget.fieldObject.root.x - this.shipRoot.x,
      this.autoAimTarget.fieldObject.root.y - this.shipRoot.y,
    ).normalize();
  }

  private refreshAutoAimTarget(direction: Phaser.Math.Vector2): void {
    if (this.selectedTarget && !this.isPlayerTargetValid(this.selectedTarget)) {
      this.selectedTarget = null;
    }

    this.autoAimTarget = this.getResolvedLockTarget(direction);
  }

  private getResolvedLockTarget(_direction: Phaser.Math.Vector2): SpacePlayerTarget | null {
    if (this.selectedTarget && this.isPlayerTargetValid(this.selectedTarget)) {
      return this.selectedTarget;
    }

    this.selectedTarget = null;
    if (!gameSession.settings.controls.autoAim) {
      return null;
    }

    const nearestHostileShip = this.getNearestHostileShip();
    return nearestHostileShip ? { kind: "ship", ship: nearestHostileShip } : null;
  }

  private getNearestHostileShip(): SpaceFactionShip | null {
    let nearest: SpaceFactionShip | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.factionShips.forEach((ship) => {
      if (!this.isShipHostileToPlayer(ship)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, ship.root.x, ship.root.y);
      if (distance > PLAYER_TARGET_LOCK_RANGE || distance >= nearestDistance) {
        return;
      }

      nearest = ship;
      nearestDistance = distance;
    });

    return nearest;
  }

  private getTargetCycleCandidates(): SpacePlayerTarget[] {
    const hostileShips = this.factionShips
      .filter((ship) => this.isShipHostileToPlayer(ship))
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, left.root.x, left.root.y);
        const rightDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, right.root.x, right.root.y);
        return leftDistance - rightDistance;
      })
      .filter((ship) => Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, ship.root.x, ship.root.y) <= PLAYER_TARGET_LOCK_RANGE)
      .map<SpacePlayerTarget>((ship) => ({ kind: "ship", ship }));

    if (hostileShips.length > 0) {
      return hostileShips;
    }

    return this.asteroids
      .filter((fieldObject) => Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, fieldObject.root.x, fieldObject.root.y) <= PLAYER_TARGET_LOCK_RANGE)
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, left.root.x, left.root.y);
        const rightDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, right.root.x, right.root.y);
        return leftDistance - rightDistance;
      })
      .map<SpacePlayerTarget>((fieldObject) => ({ kind: "field", fieldObject }));
  }

  private cycleTargetLock(): void {
    if (this.playerDestroyed || this.returningToShip || isShipHyperdriveCombatLocked(this.hyperdrive.state)) {
      return;
    }

    const candidates = this.getTargetCycleCandidates();
    if (candidates.length === 0) {
      this.selectedTarget = null;
      this.autoAimTarget = null;
      return;
    }

    const currentIndex = this.selectedTarget
      ? candidates.findIndex((candidate) => this.targetsMatch(candidate, this.selectedTarget))
      : -1;
    const nextTarget = candidates[(currentIndex + 1) % candidates.length] ?? candidates[0];
    this.selectedTarget = nextTarget;
    this.autoAimTarget = nextTarget;
  }

  private targetsMatch(left: SpacePlayerTarget | null, right: SpacePlayerTarget | null): boolean {
    if (!left || !right || left.kind !== right.kind) {
      return false;
    }

    if (left.kind === "ship" && right.kind === "ship") {
      return left.ship.id === right.ship.id;
    }

    if (left.kind === "field" && right.kind === "field") {
      return left.fieldObject.id === right.fieldObject.id;
    }

    return false;
  }

  private isPlayerTargetValid(target: SpacePlayerTarget): boolean {
    if (target.kind === "ship") {
      return this.factionShips.includes(target.ship)
        && this.isShipHostileToPlayer(target.ship)
        && Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, target.ship.root.x, target.ship.root.y) <= PLAYER_TARGET_LOCK_RANGE;
    }

    return this.asteroids.includes(target.fieldObject)
      && Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, target.fieldObject.root.x, target.fieldObject.root.y) <= PLAYER_TARGET_LOCK_RANGE;
  }

  private isShipHostileToPlayer(ship: SpaceFactionShip): boolean {
    return this.canShipAttackPlayer(ship);
  }

  private canShipAttackPlayer(ship: SpaceFactionShip): boolean {
    const faction = this.getShipCombatConfig(ship);
    return faction.attackPlayerByDefault || ship.provokedByPlayer;
  }

  private getShipCombatConfig(
    ship: Pick<SpaceFactionShip | SpaceFactionShipState, "factionId" | "originRaceId" | "shipRole">,
  ): (typeof SPACE_FACTIONS)[SpaceFactionId] {
    const baseFaction = getSpaceFactionConfig(ship.factionId, ship.originRaceId);
    const roleProfile = getSpaceShipRoleCombatProfile(ship.shipRole);
    return {
      ...baseFaction,
      maxHull: baseFaction.maxHull * roleProfile.hullMultiplier,
      radius: baseFaction.radius * roleProfile.radiusMultiplier,
      acceleration: baseFaction.acceleration * roleProfile.accelerationMultiplier,
      maxSpeed: baseFaction.maxSpeed * roleProfile.maxSpeedMultiplier,
      detectRange: baseFaction.detectRange * roleProfile.detectRangeMultiplier,
      fireRange: baseFaction.fireRange * roleProfile.fireRangeMultiplier,
      preferredRange: baseFaction.preferredRange * roleProfile.preferredRangeMultiplier,
      fireCooldown: baseFaction.fireCooldown * roleProfile.fireCooldownMultiplier,
      bulletSpeed: baseFaction.bulletSpeed * roleProfile.bulletSpeedMultiplier,
    };
  }

  private getShipRaceProfile(ship: Pick<SpaceFactionShip | SpaceFactionShipState, "originRaceId">) {
    return getSpaceRaceDefenseProfile(ship.originRaceId);
  }

  private getGuardTargetAnchorDistanceScore(
    ship: Pick<SpaceFactionShip, "originRaceId" | "guardAnchor" | "guardRadius">,
    target: Pick<SpaceFactionShip, "root"> | { root: Phaser.GameObjects.Container },
  ): number {
    if (!ship.guardAnchor) {
      return 0;
    }

    const raceProfile = this.getShipRaceProfile(ship);
    const distanceToAnchor = Phaser.Math.Distance.Between(
      target.root.x,
      target.root.y,
      ship.guardAnchor.x,
      ship.guardAnchor.y,
    );
    const softLimit = ship.guardRadius + raceProfile.interceptPadding;
    if (distanceToAnchor <= softLimit) {
      return distanceToAnchor * raceProfile.anchorPriority;
    }
    return (softLimit * raceProfile.anchorPriority) + ((distanceToAnchor - softLimit) * 4.8);
  }

  private canGuardShipInterceptTarget(ship: SpaceFactionShip, targetShip: SpaceFactionShip): boolean {
    if (!ship.guardAnchor) {
      return true;
    }

    if (ship.provokedByShips.has(targetShip.id)) {
      return true;
    }

    const raceProfile = this.getShipRaceProfile(ship);
    const distanceToAnchor = Phaser.Math.Distance.Between(
      targetShip.root.x,
      targetShip.root.y,
      ship.guardAnchor.x,
      ship.guardAnchor.y,
    );
    return distanceToAnchor <= ship.guardRadius + raceProfile.interceptPadding;
  }

  private getShipFireDamage(ship: SpaceFactionShip): number {
    let baseDamage = FACTION_DAMAGE;
    switch (ship.originRaceId) {
      case "ashari":
      case "rakkan":
        baseDamage += 0.25;
        break;
      case "svarin":
        baseDamage += 0.15;
        break;
      default:
        break;
    }
    return baseDamage * getSpaceShipRoleCombatProfile(ship.shipRole).damageMultiplier;
  }

  private trySupportRepair(ship: SpaceFactionShip): void {
    const roleProfile = getSpaceShipRoleCombatProfile(ship.shipRole);
    if (roleProfile.supportRepairAmount <= 0 || roleProfile.supportRepairRange <= 0 || ship.supportRepairCooldown > 0) {
      return;
    }

    const repairTarget = this.factionShips
      .filter((ally) => {
        if (ally.id === ship.id || ally.factionId !== ship.factionId || ally.hp >= ally.maxHp) {
          return false;
        }
        if (ship.factionId === "homeguard" && ally.originRaceId !== ship.originRaceId) {
          return false;
        }

        return Phaser.Math.Distance.Between(ship.root.x, ship.root.y, ally.root.x, ally.root.y) <= roleProfile.supportRepairRange;
      })
      .sort((left, right) => (left.hp / Math.max(1, left.maxHp)) - (right.hp / Math.max(1, right.maxHp)))[0];
    if (!repairTarget) {
      return;
    }

    repairTarget.hp = Math.min(repairTarget.maxHp, repairTarget.hp + roleProfile.supportRepairAmount);
    repairTarget.flash = Math.max(repairTarget.flash, 0.7);
    ship.supportRepairCooldown = roleProfile.supportRepairCooldownMs / 1000;
  }

  private canPlayerDamageShip(ship: SpaceFactionShip): boolean {
    return !this.playerDestroyed && !this.returningToShip && Boolean(ship);
  }

  private getWorldAudioMix(
    x: number,
    y: number,
    maxDistance = SHIP_RADAR_CONFIG.range,
  ): { pan: number; volume: number } | null {
    const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, x, y);
    if (distance > maxDistance) {
      return null;
    }

    const viewDistance = getDistanceToCameraView(this.cameras.main.worldView, x, y);
    const distanceFactor = Phaser.Math.Clamp(1 - (distance / maxDistance), 0, 1);
    const viewFactor = viewDistance <= 0
      ? 1
      : Phaser.Math.Clamp(1 - (viewDistance / Math.max(this.cameras.main.width, this.cameras.main.height)), 0.08, 1);
    const volume = Math.pow(distanceFactor, 1.4) * viewFactor;
    if (volume <= 0.02) {
      return null;
    }

    return {
      pan: Phaser.Math.Clamp((x - this.shipRoot.x) / 560, -0.82, 0.82),
      volume,
    };
  }

  private playWorldCue(
    cue: Parameters<typeof retroSfx.play>[0],
    x: number,
    y: number,
    baseVolume: number,
    pitch = 1,
  ): void {
    const mix = this.getWorldAudioMix(x, y);
    if (!mix) {
      return;
    }

    retroSfx.play(cue, {
      pan: mix.pan,
      volume: baseVolume * mix.volume,
      pitch,
    });
  }

  private pointerOverUi(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(
      this.pauseButton?.container.getBounds().contains(pointer.x, pointer.y)
      || this.logbookButton?.container.getBounds().contains(pointer.x, pointer.y)
      || this.returnButton?.container.getBounds().contains(pointer.x, pointer.y)
      || (this.attackButton?.container.visible && this.attackButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.targetButton?.container.visible && this.targetButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.abilityOneButton?.container.visible && this.abilityOneButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.abilityTwoButton?.container.visible && this.abilityTwoButton.container.getBounds().contains(pointer.x, pointer.y)),
    );
  }

  private anchorMoveStick(x: number, y: number): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(
      Phaser.Math.Clamp(x, 86, GAME_WIDTH - 86),
      Phaser.Math.Clamp(y, 104, GAME_HEIGHT - 88),
    );
    this.moveBase.setFillStyle(0x173054, 0.52);
    this.moveKnob.setPosition(this.moveBase.x, this.moveBase.y);
  }

  private updateMoveStick(pointer: Phaser.Input.Pointer): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    const vector = new Phaser.Math.Vector2(pointer.x - this.moveBase.x, pointer.y - this.moveBase.y);
    const distance = vector.length();
    if (distance > TOUCH_STICK_RADIUS) {
      vector.normalize().scale(TOUCH_STICK_RADIUS);
    }

    this.moveKnob.setPosition(this.moveBase.x + vector.x, this.moveBase.y + vector.y);
    if (distance <= TOUCH_STICK_DEADZONE) {
      this.touchMoveVector.set(0, 0);
      return;
    }

    const rawStrength = Phaser.Math.Clamp(
      (Math.min(distance, TOUCH_STICK_RADIUS) - TOUCH_STICK_DEADZONE) / (TOUCH_STICK_RADIUS - TOUCH_STICK_DEADZONE),
      0,
      1,
    );
    const sensitivityCurve = 100 / gameSession.settings.controls.touchSensitivity;
    const strength = Math.pow(rawStrength, sensitivityCurve);
    this.touchMoveVector.set(vector.x, vector.y).normalize().scale(strength);
    this.touchAimVector.set(vector.x, vector.y).normalize();
  }

  private resetMoveStick(): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(148, 566).setFillStyle(0x173054, 0.36);
    this.moveKnob.setPosition(148, 566);
  }

  private beginTouchAttack(pointer: Phaser.Input.Pointer): void {
    if (this.playerDestroyed || this.returningToShip || this.isMenuOverlayVisible()) {
      return;
    }

    this.attackPointerId = pointer.id;
    this.fireHeld = true;
  }

  private endTouchAttack(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.attackPointerId) {
      return;
    }

    this.attackPointerId = null;
    this.fireHeld = false;
  }

  private beginTouchHyperdrive(pointer: Phaser.Input.Pointer): void {
    if (this.playerDestroyed || this.returningToShip || this.isMenuOverlayVisible()) {
      return;
    }

    this.hyperdrivePointerId = pointer.id;
    if (this.hyperdrive.state !== "active") {
      this.hyperdriveTouchHeld = true;
    }
  }

  private endTouchHyperdrive(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.hyperdrivePointerId) {
      return;
    }

    this.hyperdrivePointerId = null;
    this.hyperdriveTouchHeld = false;
  }

  private queueTouchHyperdriveTap(): void {
    if (this.hyperdrive.state === "active") {
      this.hyperdriveTouchTapQueued = true;
    }
  }

  private firePlayerShot(): void {
    if (isShipHyperdriveCombatLocked(this.hyperdrive.state)) {
      return;
    }

    const spawnDistance = PLAYER_RADIUS + 10;
    const x = this.shipRoot.x + (this.aimDirection.x * spawnDistance);
    const y = this.shipRoot.y + (this.aimDirection.y * spawnDistance);
    const sprite = this.add.circle(x, y, 4, 0x8ae4ff, 1).setDepth(16);
    const glow = this.add.circle(x, y, 9, 0x3dbdff, 0.22).setDepth(15);
    const velocity = this.aimDirection.clone().scale(PLAYER_BULLET_SPEED).add(this.shipVelocity.clone().scale(0.3));

    this.shots.push({
      id: `shot-${this.time.now}-${this.shots.length}`,
      ownerKind: "player",
      ownerShipId: null,
      ownerFactionId: null,
      sprite,
      glow,
      velocity,
      life: PLAYER_PROJECTILE_LIFETIME,
      radius: 4,
      damage: PLAYER_DAMAGE,
      canHitPlayer: false,
    });

    retroSfx.play("player-fire", {
      pan: Phaser.Math.Clamp((x - this.shipRoot.x) / 420, -0.6, 0.6),
      volume: 0.92,
    });
  }

  private updateFieldObjects(dt: number): void {
    for (const fieldObject of this.asteroids) {
      fieldObject.root.x += fieldObject.velocity.x * dt;
      fieldObject.root.y += fieldObject.velocity.y * dt;
      fieldObject.root.rotation += fieldObject.spin * dt;
      this.constrainMovingBody(fieldObject.root, fieldObject.radius, fieldObject.velocity, 0.82);

      fieldObject.flash = Math.max(0, fieldObject.flash - (dt * 4));
      fieldObject.damageRing.setStrokeStyle(2, 0xffcf96, fieldObject.flash * 0.86);
      fieldObject.damageRing.setFillStyle(0xff8a52, fieldObject.flash * 0.16);
      this.resolvePlayerAgainstFieldObject(fieldObject);
    }
  }

  private resolvePlayerAgainstFieldObject(fieldObject: SpaceFieldObject): void {
    const dx = fieldObject.root.x - this.shipRoot.x;
    const dy = fieldObject.root.y - this.shipRoot.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
    const minimumDistance = fieldObject.radius + PLAYER_RADIUS;
    if (distance >= minimumDistance) {
      return;
    }

    const overlap = minimumDistance - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    this.shipRoot.x -= normalX * overlap;
    this.shipRoot.y -= normalY * overlap;
    this.constrainMovingBody(this.shipRoot, PLAYER_RADIUS, this.shipVelocity, 0.16);

    const impactSpeed = (this.shipVelocity.x * normalX) + (this.shipVelocity.y * normalY);
    if (impactSpeed > 0) {
      this.shipVelocity.x -= normalX * impactSpeed * 1.25;
      this.shipVelocity.y -= normalY * impactSpeed * 1.25;
      this.shipVelocity.scale(0.92);
    }
  }

  private updateFactionShips(dt: number): void {
    for (const ship of this.factionShips) {
      const faction = this.getShipCombatConfig(ship);
      const raceProfile = this.getShipRaceProfile(ship);
      const palette = this.getShipPalette(ship);
      ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
      ship.supportRepairCooldown = Math.max(0, ship.supportRepairCooldown - dt);
      ship.flash = Math.max(0, ship.flash - (dt * 4));
      ship.aggressionTimer = Math.max(0, ship.aggressionTimer - dt);
      if (ship.aggressionTimer <= 0) {
        ship.provokedByPlayer = false;
        ship.provokedByShips.clear();
      }

      const target = this.selectShipTarget(ship);
      const fleeTarget = target ? null : this.findNearestSmugglerThreat(ship);
      const movement = new Phaser.Math.Vector2();
      let aimDirection = ship.aimDirection.clone();
      let shouldFire = false;

      if (target?.kind === "player") {
        const dx = this.shipRoot.x - ship.root.x;
        const dy = this.shipRoot.y - ship.root.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
        aimDirection = new Phaser.Math.Vector2(dx / distance, dy / distance);
        movement.copy(this.getCombatMovement(aimDirection, distance, faction.preferredRange, ship.strafeSign, raceProfile));
        shouldFire = distance <= faction.fireRange;
      } else if (target?.kind === "ship") {
        const dx = target.ship.root.x - ship.root.x;
        const dy = target.ship.root.y - ship.root.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
        aimDirection = new Phaser.Math.Vector2(dx / distance, dy / distance);
        movement.copy(this.getCombatMovement(aimDirection, distance, faction.preferredRange, ship.strafeSign, raceProfile));
        shouldFire = distance <= faction.fireRange;
      } else if (fleeTarget) {
        movement.copy(this.getFleeMovement(ship, fleeTarget));
        if (movement.lengthSq() > 0) {
          aimDirection = movement.clone().normalize();
        }
      } else if (ship.factionId === "smuggler") {
        movement.copy(this.getSmugglerRouteMovement(ship, dt));
        if (movement.lengthSq() > 0) {
          aimDirection = movement.clone().normalize();
        }
      } else {
        movement.copy(this.getPatrolMovement(ship));
        if (movement.lengthSq() > 0) {
          aimDirection = movement.clone().normalize();
        }
      }

      this.applyFactionMovement(ship, movement, faction, dt);
      if (aimDirection.lengthSq() > 0.01) {
        ship.aimDirection.copy(aimDirection.normalize());
        ship.root.rotation = Math.atan2(ship.aimDirection.y, ship.aimDirection.x) + Math.PI * 0.5;
      }

      this.constrainMovingBody(ship.root, ship.radius, ship.velocity, 0.22);

      if (shouldFire && ship.fireCooldown <= 0) {
        ship.fireCooldown = faction.fireCooldown;
        this.fireFactionShot(ship);
      }

      this.trySupportRepair(ship);

      ship.damageRing.setStrokeStyle(2, palette.trimColor, ship.flash * 0.88);
      ship.damageRing.setFillStyle(palette.glowColor, ship.flash * 0.18);
      const velocityPulse = Phaser.Math.Clamp(ship.velocity.length() / faction.maxSpeed, 0, 1);
      const thrustAlpha = movement.lengthSq() > 0 ? 0.42 + (velocityPulse * 0.16) : 0.14 + (velocityPulse * 0.12);
      ship.thruster.setFillStyle(palette.glowColor, thrustAlpha);
      ship.thruster.setScale(1, movement.lengthSq() > 0 ? 1.05 + (velocityPulse * 0.35) : 0.82 + (velocityPulse * 0.12));
    }
  }

  private selectShipTarget(ship: SpaceFactionShip): { kind: "player" } | { kind: "ship"; ship: SpaceFactionShip } | null {
    const faction = this.getShipCombatConfig(ship);
    const raceProfile = this.getShipRaceProfile(ship);
    let bestScore = Number.POSITIVE_INFINITY;
    let bestTarget: { kind: "player" } | { kind: "ship"; ship: SpaceFactionShip } | null = null;

    this.factionShips.forEach((targetShip) => {
      if (targetShip.id === ship.id) {
        return;
      }
      if (!this.isShipHostileToShip(ship, targetShip)) {
        return;
      }
      if (!this.canGuardShipInterceptTarget(ship, targetShip)) {
        return;
      }
      const dx = targetShip.root.x - ship.root.x;
      const dy = targetShip.root.y - ship.root.y;
      const distanceSq = (dx * dx) + (dy * dy);
      if (distanceSq > faction.detectRange * faction.detectRange) {
        return;
      }

      const anchorScore = this.getGuardTargetAnchorDistanceScore(ship, targetShip);
      const damagedScore = (1 - (targetShip.hp / Math.max(1, targetShip.maxHp))) * 900 * raceProfile.damagedTargetBias;
      const targetScore = distanceSq + anchorScore - damagedScore;
      if (targetScore >= bestScore) {
        return;
      }

      bestScore = targetScore;
      bestTarget = { kind: "ship", ship: targetShip };
    });

    if (bestTarget) {
      return bestTarget;
    }

    if (!this.playerDestroyed && this.canShipAttackPlayer(ship)) {
      const dx = this.shipRoot.x - ship.root.x;
      const dy = this.shipRoot.y - ship.root.y;
      const distanceSq = (dx * dx) + (dy * dy);
      if (distanceSq <= faction.detectRange * faction.detectRange) {
        return { kind: "player" };
      }
    }

    return bestTarget;
  }

  private isShipHostileToShip(attacker: SpaceFactionShip, target: SpaceFactionShip): boolean {
    if (attacker.id === target.id || attacker.factionId === target.factionId) {
      return false;
    }

    if (isFactionHostileByDefault(attacker.factionId, target.factionId)) {
      return true;
    }

    return attacker.provokedByShips.has(target.id);
  }

  private findNearestSmugglerThreat(ship: SpaceFactionShip): Phaser.Math.Vector2 | null {
    if (ship.factionId !== "smuggler") {
      return null;
    }

    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    let nearestPosition: Phaser.Math.Vector2 | null = null;

    this.factionShips.forEach((otherShip) => {
      if (otherShip.id === ship.id || otherShip.factionId === "smuggler") {
        return;
      }
      const dx = otherShip.root.x - ship.root.x;
      const dy = otherShip.root.y - ship.root.y;
      const distanceSq = (dx * dx) + (dy * dy);
      if (distanceSq > 520 * 520 || distanceSq >= nearestDistanceSq) {
        return;
      }

      nearestDistanceSq = distanceSq;
      nearestPosition = new Phaser.Math.Vector2(otherShip.root.x, otherShip.root.y);
    });

    return nearestPosition;
  }

  private getSmugglerRouteMovement(ship: SpaceFactionShip, dt: number): Phaser.Math.Vector2 {
    if (ship.routeWaitRemainingMs > 0) {
      ship.routeWaitRemainingMs = Math.max(0, ship.routeWaitRemainingMs - (dt * 1000));
      if (ship.routeWaitRemainingMs <= 0) {
        this.assignSmugglerRouteTarget(ship, this.getNextSmugglerLegKind(ship));
      }
      return new Phaser.Math.Vector2();
    }

    let routeTarget = this.resolveSmugglerRouteTarget(ship.routeTargetKind, ship.routeTargetId);
    if (!routeTarget) {
      this.assignSmugglerRouteTarget(ship, this.getNextSmugglerLegKind(ship));
      routeTarget = this.resolveSmugglerRouteTarget(ship.routeTargetKind, ship.routeTargetId);
      if (!routeTarget) {
        return this.getPatrolMovement(ship);
      }
    }

    ship.patrolTarget.set(routeTarget.x, routeTarget.y);
    const dx = routeTarget.x - ship.root.x;
    const dy = routeTarget.y - ship.root.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy));
    const arrivalRadius = routeTarget.radius + (
      routeTarget.kind === "station"
        ? 150
        : routeTarget.kind === "moon"
          ? 90
          : 120
    );

    if (distance <= arrivalRadius) {
      ship.routeWaitRemainingMs = randomBetween(SMUGGLER_ROUTE_WAIT_MIN_MS, SMUGGLER_ROUTE_WAIT_MAX_MS);
      return new Phaser.Math.Vector2();
    }

    return distance <= 0.001
      ? new Phaser.Math.Vector2()
      : new Phaser.Math.Vector2(dx / distance, dy / distance);
  }

  private getNextSmugglerLegKind(ship: SpaceFactionShip): "world" | "station" {
    return ship.routeTargetKind === "planet" || ship.routeTargetKind === "moon"
      ? "station"
      : "world";
  }

  private assignSmugglerRouteTarget(ship: SpaceFactionShip, desiredLeg: "world" | "station"): void {
    const nextTarget = desiredLeg === "station"
      ? this.pickSmugglerStationTarget(ship)
      : this.pickSmugglerWorldTarget(ship);

    if (!nextTarget) {
      ship.routeTargetKind = null;
      ship.routeTargetId = null;
      return;
    }

    ship.routeTargetKind = nextTarget.kind;
    ship.routeTargetId = nextTarget.id;
    const resolvedTarget = this.resolveSmugglerRouteTarget(nextTarget.kind, nextTarget.id);
    if (resolvedTarget) {
      ship.patrolTarget.set(resolvedTarget.x, resolvedTarget.y);
    }
  }

  private pickSmugglerWorldTarget(ship: SpaceFactionShip): { kind: "planet" | "moon"; id: string } | null {
    const localCandidates = [
      ...this.galaxyDefinition.planets
        .filter((planet) => planet.sectorId === ship.sectorId && !planet.isHomeworld)
        .map((planet) => ({ kind: "planet" as const, id: planet.id })),
      ...this.galaxyDefinition.moons
        .filter((moon) => moon.sectorId === ship.sectorId)
        .map((moon) => ({ kind: "moon" as const, id: moon.id })),
    ];
    const fallbackCandidates = [
      ...this.galaxyDefinition.planets
        .filter((planet) => !planet.isHomeworld)
        .map((planet) => ({ kind: "planet" as const, id: planet.id })),
      ...this.galaxyDefinition.moons.map((moon) => ({ kind: "moon" as const, id: moon.id })),
    ];
    const candidates = localCandidates.length > 0 ? localCandidates : fallbackCandidates;
    if (candidates.length === 0) {
      return null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  private pickSmugglerStationTarget(ship: SpaceFactionShip): { kind: "station"; id: string } | null {
    const localStations = this.galaxyDefinition.stations
      .filter((station) => station.sectorId === ship.sectorId)
      .map((station) => ({ kind: "station" as const, id: station.id }));
    const stations = localStations.length > 0
      ? localStations
      : this.galaxyDefinition.stations.map((station) => ({ kind: "station" as const, id: station.id }));
    if (stations.length === 0) {
      return null;
    }

    return stations[Math.floor(Math.random() * stations.length)] ?? null;
  }

  private resolveSmugglerRouteTarget(
    kind: SmugglerRouteTargetKind | null,
    id: string | null,
  ): { kind: SmugglerRouteTargetKind; id: string; x: number; y: number; radius: number } | null {
    if (!kind || !id) {
      return null;
    }

    const orbitTimeMs = this.getOrbitTimeMs();

    if (kind === "planet") {
      const planet = this.galaxyPlanetsById.get(id);
      return planet
        ? { kind, id, ...getGalaxyPlanetPositionAtTime(this.galaxyDefinition, planet, orbitTimeMs), radius: this.getPlanetRenderRadius(planet) }
        : null;
    }

    if (kind === "moon") {
      const moon = this.galaxyMoonsById.get(id);
      return moon
        ? { kind, id, ...getGalaxyMoonPositionAtTime(this.galaxyDefinition, moon, orbitTimeMs), radius: this.getMoonRenderRadius(moon) }
        : null;
    }

    const station = this.galaxyStationsById.get(id);
    return station
      ? { kind, id, x: station.x, y: station.y, radius: station.radius }
      : null;
  }

  private getCombatMovement(
    aimDirection: Phaser.Math.Vector2,
    distance: number,
    preferredRange: number,
    strafeSign: number,
    raceProfile = getSpaceRaceDefenseProfile(null),
  ): Phaser.Math.Vector2 {
    const movement = new Phaser.Math.Vector2();
    if (distance > preferredRange + 90) {
      movement.copy(aimDirection);
      return movement;
    }

    if (distance < preferredRange - 70) {
      movement.copy(aimDirection).scale(-1);
      return movement;
    }

    movement.set(
      (-aimDirection.y * strafeSign * raceProfile.strafeStrength) + (aimDirection.x * raceProfile.combatAdvanceBias),
      (aimDirection.x * strafeSign * raceProfile.strafeStrength) + (aimDirection.y * raceProfile.combatAdvanceBias),
    );
    return movement;
  }

  private getFleeMovement(ship: SpaceFactionShip, threatPosition: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const movement = new Phaser.Math.Vector2(ship.root.x - threatPosition.x, ship.root.y - threatPosition.y);
    if (movement.lengthSq() <= 1) {
      return movement;
    }

    return movement.normalize();
  }

  private getPatrolMovement(ship: SpaceFactionShip): Phaser.Math.Vector2 {
    const leader = this.getPatrolLeader(ship);
    if (leader && leader.id !== ship.id) {
      const slotTarget = this.getFormationSlotTarget(ship, leader);
      const slotDx = slotTarget.x - ship.root.x;
      const slotDy = slotTarget.y - ship.root.y;
      if ((slotDx * slotDx) + (slotDy * slotDy) > 36) {
        return new Phaser.Math.Vector2(slotDx, slotDy).normalize();
      }

      const leaderForward = this.getShipTravelDirection(leader);
      return leaderForward.lengthSq() > 0 ? leaderForward : new Phaser.Math.Vector2();
    }

    const patrolDx = ship.patrolTarget.x - ship.root.x;
    const patrolDy = ship.patrolTarget.y - ship.root.y;
    const patrolDistance = Math.sqrt((patrolDx * patrolDx) + (patrolDy * patrolDy));
    const exceedsGuardRadius = ship.guardAnchor
      ? Phaser.Math.Distance.Between(ship.patrolTarget.x, ship.patrolTarget.y, ship.guardAnchor.x, ship.guardAnchor.y) > ship.guardRadius
      : false;
    if (patrolDistance < 90 || exceedsGuardRadius) {
      ship.patrolTarget = this.pickNewPatrolTarget(ship);
    }

    const nextDx = ship.patrolTarget.x - ship.root.x;
    const nextDy = ship.patrolTarget.y - ship.root.y;
    if ((nextDx * nextDx) + (nextDy * nextDy) <= 1) {
      return new Phaser.Math.Vector2();
    }

    return new Phaser.Math.Vector2(nextDx, nextDy).normalize();
  }

  private getPatrolLeader(ship: SpaceFactionShip): SpaceFactionShip | null {
    if (!ship.leaderId) {
      return ship;
    }

    return this.factionShips.find((candidate) => candidate.id === ship.leaderId) ?? null;
  }

  private getFormationSlotTarget(ship: SpaceFactionShip, leader: SpaceFactionShip): Phaser.Math.Vector2 {
    const forward = this.getShipTravelDirection(leader);
    const right = new Phaser.Math.Vector2(-forward.y, forward.x);
    return new Phaser.Math.Vector2(
      leader.root.x + (right.x * ship.formationOffsetX) - (forward.x * ship.formationOffsetY),
      leader.root.y + (right.y * ship.formationOffsetX) - (forward.y * ship.formationOffsetY),
    );
  }

  private getFormationSlotDistance(ship: SpaceFactionShip): number {
    const leader = this.getPatrolLeader(ship);
    if (!leader || leader.id === ship.id) {
      return 0;
    }

    const slotTarget = this.getFormationSlotTarget(ship, leader);
    return Phaser.Math.Distance.Between(ship.root.x, ship.root.y, slotTarget.x, slotTarget.y);
  }

  private getLeaderFormationLag(leader: SpaceFactionShip): number {
    return this.factionShips.reduce((largestLag, ship) => {
      if (ship.leaderId !== leader.id) {
        return largestLag;
      }
      return Math.max(largestLag, this.getFormationSlotDistance(ship));
    }, 0);
  }

  private getShipTravelDirection(ship: SpaceFactionShip): Phaser.Math.Vector2 {
    if (ship.velocity.lengthSq() > 16) {
      return ship.velocity.clone().normalize();
    }

    const patrolDirection = new Phaser.Math.Vector2(
      ship.patrolTarget.x - ship.root.x,
      ship.patrolTarget.y - ship.root.y,
    );
    if (patrolDirection.lengthSq() > 1) {
      return patrolDirection.normalize();
    }

    if (ship.aimDirection.lengthSq() > 0.01) {
      return ship.aimDirection.clone().normalize();
    }

    return new Phaser.Math.Vector2(0, -1);
  }

  private applyFactionMovement(
    ship: SpaceFactionShip,
    desiredDirection: Phaser.Math.Vector2,
    faction: (typeof SPACE_FACTIONS)[SpaceFactionId],
    dt: number,
  ): void {
    let acceleration = faction.acceleration;
    let maxSpeed = faction.maxSpeed;
    const formationSlotDistance = this.getFormationSlotDistance(ship);
    const leaderLag = ship.leaderId ? 0 : this.getLeaderFormationLag(ship);
    if (formationSlotDistance > FORMATION_RECOVERY_DISTANCE) {
      acceleration *= 1.22;
      maxSpeed *= 1.18;
    } else if (!ship.leaderId && leaderLag > FORMATION_RECOVERY_DISTANCE) {
      maxSpeed *= 0.72;
    }

    if (desiredDirection.lengthSq() > 0.0001) {
      const normalized = desiredDirection.clone().normalize();
      ship.velocity.x += normalized.x * acceleration * dt;
      ship.velocity.y += normalized.y * acceleration * dt;
      ship.velocity.scale(Math.max(0, 1 - (0.92 * dt)));
    } else {
      ship.velocity.scale(Math.max(0, 1 - (1.9 * dt)));
    }

    if (ship.velocity.length() > maxSpeed) {
      ship.velocity.setLength(maxSpeed);
    }

    ship.root.x += ship.velocity.x * dt;
    ship.root.y += ship.velocity.y * dt;
  }

  private pickNewPatrolTarget(ship: SpaceFactionShip): Phaser.Math.Vector2 {
    if (ship.guardAnchor && ship.guardRadius > 0) {
      const raceProfile = this.getShipRaceProfile(ship);
      const angle = randomBetween(0, Math.PI * 2);
      const radius = ship.guardRadius * randomBetween(raceProfile.patrolRadiusMin, raceProfile.patrolRadiusMax);
      return new Phaser.Math.Vector2(
        ship.guardAnchor.x + (Math.cos(angle) * radius),
        ship.guardAnchor.y + (Math.sin(angle) * radius),
      );
    }

    const point = createSpacePatrolTarget(ship.sectorId, SPACE_WORLD_CONFIG);
    return new Phaser.Math.Vector2(
      point.x,
      point.y,
    );
  }

  private fireFactionShot(ship: SpaceFactionShip): void {
    const faction = this.getShipCombatConfig(ship);
    const palette = this.getShipPalette(ship);
    const direction = ship.aimDirection.clone().normalize();
    const spawnDistance = ship.radius + 8;
    const x = ship.root.x + (direction.x * spawnDistance);
    const y = ship.root.y + (direction.y * spawnDistance);
    const sprite = this.add.circle(x, y, 4, palette.trimColor, 0.98).setDepth(15);
    const glow = this.add.circle(x, y, 8, palette.glowColor, 0.24).setDepth(14);
    const velocity = direction.scale(faction.bulletSpeed).add(ship.velocity.clone().scale(0.34));

    this.shots.push({
      id: `shot-${this.time.now}-${this.shots.length}`,
      ownerKind: "faction",
      ownerShipId: ship.id,
      ownerFactionId: ship.factionId,
      sprite,
      glow,
      velocity,
      life: FACTION_PROJECTILE_LIFETIME,
      radius: 4,
      damage: this.getShipFireDamage(ship),
      canHitPlayer: faction.attackPlayerByDefault || ship.provokedByPlayer,
    });

    this.playWorldCue(
      "enemy-shot",
      x,
      y,
      0.66,
      ship.factionId === "pirate"
        ? 1.06
        : ship.factionId === "smuggler"
          ? 0.94
          : ship.factionId === "homeguard"
            ? 1.02
            : 1,
    );
  }

  private resolveFactionShipCollisions(): void {
    this.factionShips.forEach((ship) => {
      this.asteroids.forEach((fieldObject) => {
        this.resolveFactionShipAgainstFieldObject(ship, fieldObject);
      });

      this.resolveMovingBodiesOverlap(
        ship.root,
        ship.radius,
        ship.velocity,
        this.shipRoot,
        PLAYER_RADIUS,
        this.shipVelocity,
        0.72,
      );
    });

    for (let leftIndex = 0; leftIndex < this.factionShips.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < this.factionShips.length; rightIndex += 1) {
        const leftShip = this.factionShips[leftIndex];
        const rightShip = this.factionShips[rightIndex];
        this.resolveMovingBodiesOverlap(
          leftShip.root,
          leftShip.radius,
          leftShip.velocity,
          rightShip.root,
          rightShip.radius,
          rightShip.velocity,
          0.5,
        );
      }
    }
  }

  private resolveFactionShipAgainstFieldObject(ship: SpaceFactionShip, fieldObject: SpaceFieldObject): void {
    const dx = fieldObject.root.x - ship.root.x;
    const dy = fieldObject.root.y - ship.root.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
    const minimumDistance = fieldObject.radius + ship.radius;
    if (distance >= minimumDistance) {
      return;
    }

    const overlap = minimumDistance - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    ship.root.x -= normalX * overlap;
    ship.root.y -= normalY * overlap;
    this.constrainMovingBody(ship.root, ship.radius, ship.velocity, 0.22);

    const impactSpeed = (ship.velocity.x * normalX) + (ship.velocity.y * normalY);
    if (impactSpeed > 0) {
      ship.velocity.x -= normalX * impactSpeed * 1.1;
      ship.velocity.y -= normalY * impactSpeed * 1.1;
      ship.velocity.scale(0.92);
    }
  }

  private resolveMovingBodiesOverlap(
    leftRoot: Phaser.GameObjects.Container,
    leftRadius: number,
    leftVelocity: Phaser.Math.Vector2,
    rightRoot: Phaser.GameObjects.Container,
    rightRadius: number,
    rightVelocity: Phaser.Math.Vector2,
    leftWeight: number,
  ): void {
    const dx = rightRoot.x - leftRoot.x;
    const dy = rightRoot.y - leftRoot.y;
    const distance = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
    const minimumDistance = leftRadius + rightRadius;
    if (distance >= minimumDistance) {
      return;
    }

    const overlap = minimumDistance - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    const rightWeight = 1 - leftWeight;

    leftRoot.x -= normalX * overlap * leftWeight;
    leftRoot.y -= normalY * overlap * leftWeight;
    rightRoot.x += normalX * overlap * rightWeight;
    rightRoot.y += normalY * overlap * rightWeight;

    this.constrainMovingBody(leftRoot, leftRadius, leftVelocity, 0.2);
    this.constrainMovingBody(rightRoot, rightRadius, rightVelocity, 0.2);

    leftVelocity.x -= normalX * 18;
    leftVelocity.y -= normalY * 18;
    rightVelocity.x += normalX * 18;
    rightVelocity.y += normalY * 18;
    leftVelocity.scale(0.96);
    rightVelocity.scale(0.96);
  }

  private updateProjectiles(dt: number): void {
    for (let shotIndex = this.shots.length - 1; shotIndex >= 0; shotIndex -= 1) {
      const shot = this.shots[shotIndex];
      shot.life -= dt;
      shot.sprite.x += shot.velocity.x * dt;
      shot.sprite.y += shot.velocity.y * dt;
      shot.glow.x = shot.sprite.x;
      shot.glow.y = shot.sprite.y;

      const distanceFromPlayer = Phaser.Math.Distance.Between(
        this.shipRoot.x,
        this.shipRoot.y,
        shot.sprite.x,
        shot.sprite.y,
      );
      const outOfBounds = shot.sprite.x < -40
        || shot.sprite.y < -40
        || shot.sprite.x > SPACE_WORLD_CONFIG.width + 40
        || shot.sprite.y > SPACE_WORLD_CONFIG.height + 40
        || distanceFromPlayer > PROJECTILE_CULL_DISTANCE;
      if (shot.life <= 0 || outOfBounds) {
        this.destroyProjectile(shotIndex);
        continue;
      }

      let consumed = false;
      if (shot.ownerKind === "player") {
        for (let shipIndex = this.factionShips.length - 1; shipIndex >= 0; shipIndex -= 1) {
          const ship = this.factionShips[shipIndex];
          if (!this.canPlayerDamageShip(ship)) {
            continue;
          }
          const dx = ship.root.x - shot.sprite.x;
          const dy = ship.root.y - shot.sprite.y;
          const combinedRadius = ship.radius + shot.radius;
          if ((dx * dx) + (dy * dy) > combinedRadius * combinedRadius) {
            continue;
          }

          this.damageFactionShip(ship, shot.damage, { kind: "player" });
          this.destroyProjectile(shotIndex);
          consumed = true;
          break;
        }

        if (consumed) {
          continue;
        }

        for (let objectIndex = this.asteroids.length - 1; objectIndex >= 0; objectIndex -= 1) {
          const fieldObject = this.asteroids[objectIndex];
          const dx = fieldObject.root.x - shot.sprite.x;
          const dy = fieldObject.root.y - shot.sprite.y;
          const combinedRadius = fieldObject.radius + shot.radius;
          if ((dx * dx) + (dy * dy) > combinedRadius * combinedRadius) {
            continue;
          }

          this.damageFieldObject(fieldObject);
          this.destroyProjectile(shotIndex);
          consumed = true;
          break;
        }
      } else {
        if (shot.canHitPlayer) {
          const dx = this.shipRoot.x - shot.sprite.x;
          const dy = this.shipRoot.y - shot.sprite.y;
          const combinedRadius = PLAYER_RADIUS + shot.radius;
          if ((dx * dx) + (dy * dy) <= combinedRadius * combinedRadius) {
            this.damagePlayerShip(shot.damage, shot.ownerFactionId);
            this.destroyProjectile(shotIndex);
            consumed = true;
          }
        }

        if (consumed) {
          continue;
        }

        for (let shipIndex = this.factionShips.length - 1; shipIndex >= 0; shipIndex -= 1) {
          const ship = this.factionShips[shipIndex];
          if (ship.id === shot.ownerShipId || ship.factionId === shot.ownerFactionId) {
            continue;
          }

          const dx = ship.root.x - shot.sprite.x;
          const dy = ship.root.y - shot.sprite.y;
          const combinedRadius = ship.radius + shot.radius;
          if ((dx * dx) + (dy * dy) > combinedRadius * combinedRadius) {
            continue;
          }

          this.damageFactionShip(ship, shot.damage, {
            kind: "ship",
            shipId: shot.ownerShipId,
            factionId: shot.ownerFactionId,
          });
          this.destroyProjectile(shotIndex);
          consumed = true;
          break;
        }
      }

      if (consumed) {
        continue;
      }
    }
  }

  private damageFieldObject(fieldObject: SpaceFieldObject): void {
    fieldObject.hp -= 1;
    fieldObject.flash = 1;
    this.playWorldCue("shield-hit", fieldObject.root.x, fieldObject.root.y, fieldObject.isLarge ? 0.74 : 0.8);

    const collapseThreshold = fieldObject.isLarge ? Math.max(1, Math.ceil(fieldObject.maxHp * 0.1)) : 0;
    if (fieldObject.isLarge && fieldObject.hp > collapseThreshold) {
      this.chipLargeFieldObject(fieldObject);
      return;
    }

    if (fieldObject.hp <= collapseThreshold) {
      this.breakFieldObject(fieldObject);
    }
  }

  private chipLargeFieldObject(fieldObject: SpaceFieldObject): void {
    const hpRatio = Phaser.Math.Clamp(fieldObject.hp / Math.max(1, fieldObject.maxHp), 0, 1);
    fieldObject.radius = Math.max(fieldObject.baseRadius * 0.44, fieldObject.baseRadius * (0.52 + (hpRatio * 0.48)));
    fieldObject.visualRoot.setScale(fieldObject.radius / Math.max(1, fieldObject.baseRadius));
    fieldObject.root.setSize(fieldObject.radius * 2.2, fieldObject.radius * 2.2);
    fieldObject.damageRing.setRadius(fieldObject.baseRadius * 0.76);
    this.spawnBurst(fieldObject.root.x, fieldObject.root.y, 0xb9cee6, 4, 54, 120);
  }

  private breakFieldObject(fieldObject: SpaceFieldObject): void {
    const x = fieldObject.root.x;
    const y = fieldObject.root.y;
    const radius = fieldObject.radius;
    const fragmentColor = fieldObject.kind === "asteroid" ? 0xa7bad3 : 0xd4ba8e;
    this.fieldStates.set(fieldObject.id, this.captureFieldObjectState(fieldObject, true));
    this.clearFieldTargetReferences(fieldObject.id);
    fieldObject.root.destroy(true);
    Phaser.Utils.Array.Remove(this.asteroids, fieldObject);
    this.destroyedObjects += 1;

    this.spawnExplosionRing(x, y, Math.max(14, radius * 0.45), 0xffd3a1, 0xffb171);
    this.spawnBurst(
      x,
      y,
      fragmentColor,
      fieldObject.kind === "asteroid"
        ? fieldObject.isLarge
          ? 14
          : 8
        : 5,
      fieldObject.isLarge ? 120 : 80,
      fieldObject.kind === "asteroid"
        ? fieldObject.isLarge
          ? 280
          : 210
        : 160,
    );

    this.playWorldCue("loot-burst", x, y, fieldObject.kind === "asteroid" ? (fieldObject.isLarge ? 0.92 : 0.86) : 0.64);
  }

  private damageFactionShip(
    ship: SpaceFactionShip,
    damage: number,
    source: SpaceDamageSource,
  ): void {
    if (!this.factionShips.includes(ship)) {
      return;
    }

    if (source.kind === "player" && !this.canPlayerDamageShip(ship)) {
      return;
    }

    ship.hp -= damage;
    ship.flash = 1;
    this.provokeShip(ship, source);
    this.propagateGroupAggro(ship, source);

    this.playWorldCue(ship.hp <= 0 ? "shield-break" : "shield-hit", ship.root.x, ship.root.y, ship.hp <= 0 ? 0.7 : 0.64);

    if (ship.hp <= 0) {
      this.destroyFactionShip(ship);
    }
  }

  private provokeShip(ship: SpaceFactionShip, source: SpaceDamageSource): void {
    ship.aggressionTimer = AGGRESSION_DURATION;
    if (source.kind === "player") {
      ship.provokedByPlayer = true;
      return;
    }

    if (source.shipId && source.shipId !== ship.id) {
      ship.provokedByShips.add(source.shipId);
    }
  }

  private propagateGroupAggro(targetShip: SpaceFactionShip, source: SpaceDamageSource): void {
    const linkedGuardAnchor = targetShip.guardAnchor;
    const allyAlertRadius = targetShip.originRaceId
      ? this.getShipRaceProfile(targetShip).allyAlertRadius
      : 820;
    this.factionShips.forEach((ally) => {
      if (ally.id === targetShip.id || ally.factionId !== targetShip.factionId) {
        return;
      }
      if (targetShip.factionId === "homeguard" && ally.originRaceId !== targetShip.originRaceId) {
        return;
      }

      const sameGroup = ally.groupId === targetShip.groupId;
      const sameGuardAnchor = Boolean(
        linkedGuardAnchor
        && ally.guardAnchor
        && Phaser.Math.Distance.Between(linkedGuardAnchor.x, linkedGuardAnchor.y, ally.guardAnchor.x, ally.guardAnchor.y) <= 140,
      );
      const nearby = Phaser.Math.Distance.Between(targetShip.root.x, targetShip.root.y, ally.root.x, ally.root.y) <= allyAlertRadius;
      if (!sameGroup && !sameGuardAnchor && !nearby) {
        return;
      }

      this.provokeShip(ally, source);
    });
  }

  private destroyFactionShip(ship: SpaceFactionShip): void {
    const shipIndex = this.factionShips.indexOf(ship);
    if (shipIndex < 0) {
      return;
    }

    const palette = this.getShipPalette(ship);
    const x = ship.root.x;
    const y = ship.root.y;
    if (ship.originPoolId) {
      if (markFactionForceShipDestroyed(this.forceState, ship.id)) {
        this.forceStateDirty = true;
      }
    }
    this.shipStates.set(ship.id, this.captureFactionShipState(ship, true));
    this.clearShipTargetReferences(ship.id);
    ship.root.destroy(true);
    this.factionShips.splice(shipIndex, 1);
    this.destroyedFactionShips += 1;
    this.factionShips.forEach((otherShip) => {
      otherShip.provokedByShips.delete(ship.id);
    });
    this.shipStates.forEach((state) => {
      if (state.id !== ship.id && state.provokedByShips.includes(ship.id)) {
        state.provokedByShips = state.provokedByShips.filter((provokedShipId) => provokedShipId !== ship.id);
      }
    });

    this.spawnExplosionRing(x, y, ship.radius * 0.7, palette.trimColor, palette.glowColor);
    this.spawnBurst(x, y, palette.color, ship.factionId === "pirate" ? 7 : 6, 100, 220);

    this.playWorldCue("loot-burst", x, y, 0.76, ship.factionId === "pirate" ? 1.06 : 0.96);
  }

  private damagePlayerShip(amount: number, sourceFactionId: SpaceFactionId | null): void {
    if (this.playerDestroyed || this.returningToShip) {
      return;
    }

    if (sourceFactionId !== null) {
      if (this.hyperdrive.state === "active") {
        this.disengageHyperdrive("Hostile impact interrupted hyperdrive.");
      } else if (this.hyperdrive.state === "charging") {
        this.cancelHyperdriveCharge("Charge interrupted by hostile fire.");
      }
    }

    this.playerHull -= amount;
    this.syncPlayerHullToSession();
    this.playerFlash = 1;
    retroSfx.play(this.playerHull <= 0 ? "shield-break" : "shield-hit", {
      volume: this.playerHull <= 0 ? 0.82 : 0.72,
      pan: sourceFactionId === "empire" ? -0.18 : sourceFactionId === "pirate" ? 0.22 : 0,
    });

    if (this.playerHull <= 0) {
      this.destroyPlayerShip();
    }
  }

  private destroyPlayerShip(): void {
    if (this.playerDestroyed) {
      return;
    }

    this.playerDestroyed = true;
    this.releaseTouchControls();
    this.returnButton?.setEnabled(false);
    this.statusText?.setText("Ship destroyed. Routing to GAME OVER.");
    this.contactText?.setText("Continue relaunches the current space route. Return To Ship docks back in the hub.");
    this.spawnExplosionRing(this.shipRoot.x, this.shipRoot.y, 24, 0xffe0bf, 0xff8f57);
    this.spawnBurst(this.shipRoot.x, this.shipRoot.y, 0x8ec7ff, 10, 120, 250);
    this.time.delayedCall(260, () => {
      this.scene.start("game-over", {
        mode: "space",
        missionId: this.routeMissionId,
        routeTitle: this.routeTitle,
      });
    });
  }

  private destroyProjectile(index: number): void {
    const shot = this.shots[index];
    if (!shot) {
      return;
    }

    shot.sprite.destroy();
    shot.glow.destroy();
    this.shots.splice(index, 1);
  }

  private spawnExplosionRing(x: number, y: number, radius: number, strokeColor: number, fillColor: number): void {
    const ring = this.add.circle(x, y, Math.max(14, radius), fillColor, 0)
      .setStrokeStyle(2, strokeColor, 0.82)
      .setDepth(18);
    this.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 240,
      onComplete: () => ring.destroy(),
    });
  }

  private spawnBurst(
    x: number,
    y: number,
    color: number,
    count: number,
    speedMin: number,
    speedMax: number,
  ): void {
    for (let fragmentIndex = 0; fragmentIndex < count; fragmentIndex += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(speedMin, speedMax);
      const width = randomBetween(4, 11);
      const height = randomBetween(3, 8);
      const sprite = this.add.rectangle(x, y, width, height, color, 0.94)
        .setRotation(angle)
        .setDepth(17);
      this.burstParticles.push({
        sprite,
        velocity: new Phaser.Math.Vector2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        rotationSpeed: randomBetween(-5.5, 5.5),
        life: randomBetween(0.35, 0.7),
        maxLife: randomBetween(0.35, 0.7),
      });
    }
  }

  private updateBurstParticles(dt: number): void {
    for (let index = this.burstParticles.length - 1; index >= 0; index -= 1) {
      const particle = this.burstParticles[index];
      particle.life -= dt;
      particle.sprite.x += particle.velocity.x * dt;
      particle.sprite.y += particle.velocity.y * dt;
      particle.sprite.rotation += particle.rotationSpeed * dt;
      particle.sprite.alpha = Math.max(0, particle.life / particle.maxLife);

      const distanceFromPlayer = Phaser.Math.Distance.Between(
        this.shipRoot.x,
        this.shipRoot.y,
        particle.sprite.x,
        particle.sprite.y,
      );
      if (particle.life > 0 && distanceFromPlayer <= BURST_CULL_DISTANCE) {
        continue;
      }

      particle.sprite.destroy();
      this.burstParticles.splice(index, 1);
    }
  }

  private refreshHud(): void {
    this.refreshCurrentSector();
    const regionLabel = this.getCurrentRegionLabel();
    const missionPlanet = this.getTrackedMissionPlanet();
    const trackedMissionId = missionPlanet?.missionId ?? this.routeMissionId ?? gameSession.getTrackedMissionId();
    const trackedMission = trackedMissionId ? getMissionContract(trackedMissionId) : null;
    const localCounts = this.getFactionCounts(1400);
    const localBreakables = this.countNearbyBreakables(1200);
    const speed = Math.round(this.shipVelocity.length());
    const hyperdriveStatus = this.getHyperdriveStatusLabel();
    const hyperdriveHint = this.getHyperdriveHintLabel();
    const missionDistance = missionPlanet
      ? Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, missionPlanet.x, missionPlanet.y)
      : null;
    const landingReady = this.canLandOnTrackedMissionPlanet(missionPlanet, missionDistance);
    const stationInteraction = this.getNearestStationInteraction();
    const touchLocked = this.returningToShip || this.playerDestroyed || this.isMenuOverlayVisible();
    const hyperdriveCombatLocked = isShipHyperdriveCombatLocked(this.hyperdrive.state);
    const playerHostiles = this.factionShips.filter((ship) => {
      if (!this.canShipAttackPlayer(ship)) {
        return false;
      }
      return Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, ship.root.x, ship.root.y) <= 1300;
    }).length;
    const targetLabel = this.autoAimTarget
      ? this.autoAimTarget.kind === "ship"
        ? `${SPACE_FACTIONS[this.autoAimTarget.ship.factionId].label} ship`
        : this.autoAimTarget.fieldObject.kind === "asteroid"
          ? this.autoAimTarget.fieldObject.isLarge ? "Large asteroid" : "Asteroid"
          : "Debris"
      : "None";
    const autoAim = gameSession.settings.controls.autoAim;
    const autoFire = gameSession.settings.controls.autoFire;
    const stationStatus = landingReady
      ? `Mission world ${missionPlanet?.name ?? "target"} | Press F to land`
      : stationInteraction
        ? stationInteraction.inRange
          ? `Station ${stationInteraction.station.name} | Press F to hail`
          : `Nearest station ${stationInteraction.station.name} | Dist ${Math.round(stationInteraction.distance)}`
        : "No station comm link nearby";
    const interactionAvailable = landingReady || Boolean(stationInteraction?.inRange);
    const interactionLabel = landingReady
      ? "Land"
      : stationInteraction?.inRange
        ? "Comms"
        : "Interact";

    this.routeText?.setText(trackedMission
      ? `Route staged: ${trackedMission.title}  |  Region: ${regionLabel}`
      : `Free roam launch  |  Region: ${regionLabel}`);
    this.statusText?.setText(`Hull ${Math.max(0, this.playerHull)}/${PLAYER_MAX_HULL}  |  Speed ${speed}  |  Hyper ${hyperdriveStatus}  |  Nearby hostiles ${playerHostiles}  |  Nearby debris ${localBreakables}${landingReady ? "  |  Landing ready" : ""}`);
    const localContactSummary = `Local contacts  Empire ${localCounts.empire}  |  Republic ${localCounts.republic}  |  Guardians ${localCounts.homeguard}  |  Pirates ${localCounts.pirate}  |  Smugglers ${localCounts.smuggler}`;
    this.contactText?.setText(missionPlanet
      ? `${localContactSummary}\nTarget ${targetLabel}  |  Auto Aim ${autoAim ? "On" : "Off"}  |  Auto Fire ${autoFire ? "On" : "Off"}  |  ${hyperdriveHint}  |  Waypoint ${missionPlanet.name} ${landingReady ? "| Landing window open." : `| Dist ${Math.round(missionDistance ?? 0)}`}\n${stationStatus}`
      : `${localContactSummary}\nTarget ${targetLabel}  |  Auto Aim ${autoAim ? "On" : "Off"}  |  Auto Fire ${autoFire ? "On" : "Off"}  |  ${hyperdriveHint}\n${stationStatus}`);
    this.coordinateText?.setText(missionPlanet
      ? `POS X ${Math.round(this.shipRoot.x)}  Y ${Math.round(this.shipRoot.y)}\nTARGET ${missionPlanet.name}  X ${Math.round(missionPlanet.x)}  Y ${Math.round(missionPlanet.y)}\nDIST ${Math.round(missionDistance ?? 0)}\n${stationInteraction ? `STATION ${stationInteraction.station.name}  ${Math.round(stationInteraction.distance)}` : `REGION ${regionLabel}`}\nHYPER ${hyperdriveStatus}`
      : `POS X ${Math.round(this.shipRoot.x)}  Y ${Math.round(this.shipRoot.y)}\nREGION ${regionLabel}\n${stationInteraction ? `STATION ${stationInteraction.station.name}  ${Math.round(stationInteraction.distance)}` : "STATION none nearby"}\nHYPER ${hyperdriveStatus}`);
    this.returnButton?.setLabel("Return To Ship");
    this.attackButton?.setLabel("Attack");
    this.attackButton?.setCooldownProgress(0);
    this.attackButton?.setInputEnabled(this.touchMode && !touchLocked && !hyperdriveCombatLocked);
    this.targetButton?.setLabel(this.autoAimTarget ? "Next\nTarget" : "Target");
    this.targetButton?.setCooldownProgress(0);
    this.targetButton?.setInputEnabled(this.touchMode && !touchLocked && !hyperdriveCombatLocked && this.getTargetCycleCandidates().length > 0);
    this.abilityOneButton?.setLabel(this.getHyperdriveTouchLabel());
    this.abilityOneButton?.setCooldownProgress(this.getHyperdriveTouchProgress());
    this.abilityOneButton?.setInputEnabled(this.touchMode && !touchLocked && this.hyperdrive.state !== "cooldown");
    this.abilityTwoButton?.setLabel(interactionLabel);
    this.abilityTwoButton?.setCooldownProgress(0);
    this.abilityTwoButton?.setEnabled(interactionAvailable);
    this.abilityTwoButton?.setInputEnabled(this.touchMode && !touchLocked && interactionAvailable);
    this.activeStationViews.forEach((stationView, stationId) => {
      const station = this.galaxyStationsById.get(stationId);
      const isNearestStation = stationInteraction?.station.id === stationId;
      const stationInRange = Boolean(isNearestStation && stationInteraction?.inRange);
      stationView.interactionRing.setStrokeStyle(
        isNearestStation ? 2.4 : 1.6,
        stationInRange ? 0x9df7c7 : station?.borderColor ?? 0xaed0ff,
        isNearestStation ? (stationInRange ? 0.92 : 0.34) : 0.12,
      );
      stationView.interactionRing.setFillStyle(stationInRange ? 0x9df7c7 : station?.color ?? 0xffffff, stationInRange ? 0.04 : 0);
      stationView.label.setAlpha(isNearestStation ? 0.98 : 0.8);
    });
    this.updateMissionPlanetVisuals(missionPlanet, landingReady);
    this.updateWaypointIndicator(missionPlanet, missionDistance, landingReady);
    if (this.stationOverlay?.isVisible() && this.stationOverlayStationId) {
      const station = this.galaxyStationsById.get(this.stationOverlayStationId);
      if (station) {
        this.stationOverlay.update(this.buildStationOverlayState(station));
      }
    }
    if (this.galaxyMapOverlay?.isVisible()) {
      this.galaxyMapOverlay.refresh();
    }
    this.syncSceneOverlayChrome();
    this.hudRefreshTimerMs = HUD_REFRESH_INTERVAL_MS;
  }

  private updateRadar(dt: number): void {
    if (!this.radar) {
      return;
    }

    const radarSources = this.collectRadarSources();
    this.radar.update(
      this.shipRoot.x,
      this.shipRoot.y,
      radarSources,
      this.time.now,
      dt,
      (sourceId) => this.isRadarSourceDestroyed(sourceId),
    );
  }

  private collectRadarSources(): SpaceRadarContactSource[] {
    const sources: SpaceRadarContactSource[] = [];

    this.factionShips.forEach((ship) => {
      const faction = SPACE_FACTIONS[ship.factionId];
      const palette = this.getShipPalette(ship);
      const hostile = this.canShipAttackPlayer(ship);
      sources.push({
        id: `ship:${ship.id}`,
        kind: hostile
          ? "enemy-ship"
          : ship.factionId === "smuggler"
            ? "neutral-ship"
            : "friendly-ship",
        label: `${faction.label} ship`,
        x: ship.root.x,
        y: ship.root.y,
        radius: ship.radius,
        color: palette.color,
      });
    });

    this.asteroids.forEach((fieldObject) => {
      if (fieldObject.kind !== "asteroid") {
        return;
      }
      sources.push({
        id: `field:${fieldObject.id}`,
        kind: "asteroid",
        label: fieldObject.isLarge ? "Large asteroid" : "Asteroid",
        x: fieldObject.root.x,
        y: fieldObject.root.y,
        radius: fieldObject.radius,
        color: fieldObject.isLarge ? 0xf0d49c : 0xe0b36a,
      });
    });

    this.activeCelestialSystems.forEach((_systemView, systemId) => {
      const system = this.galaxySystemsById.get(systemId);
      if (!system) {
        return;
      }
      sources.push({
        id: `star:${system.id}`,
        kind: "star",
        label: `${system.name} star`,
        x: system.x,
        y: system.y,
        radius: this.getSystemStarRenderRadius(system),
        color: system.starColor,
      });
    });

    this.activeStationViews.forEach((_stationView, stationId) => {
      const station = this.galaxyStationsById.get(stationId);
      if (!station) {
        return;
      }
      sources.push({
        id: `station:${station.id}`,
        kind: "station",
        label: station.name,
        x: station.x,
        y: station.y,
        radius: station.radius,
        color: station.borderColor,
      });
    });

    const missionPlanet = this.getTrackedMissionPlanet();
    if (missionPlanet) {
      sources.push({
        id: `mission:${missionPlanet.missionId}`,
        kind: "mission-planet",
        label: missionPlanet.name,
        x: missionPlanet.x,
        y: missionPlanet.y,
        radius: missionPlanet.radius,
        color: missionPlanet.color,
      });
    }

    return sources;
  }

  private isRadarSourceDestroyed(sourceId: string): boolean {
    if (sourceId.startsWith("ship:")) {
      const shipId = sourceId.slice(5);
      return this.shipStates.get(shipId)?.destroyed ?? false;
    }

    if (sourceId.startsWith("field:")) {
      const fieldId = sourceId.slice(6);
      return this.fieldStates.get(fieldId)?.destroyed ?? false;
    }

    return false;
  }

  private getCurrentGalaxySector(): GalaxySectorConfig {
    return this.currentSector;
  }

  private getCurrentRegionLabel(): string {
    return this.currentRegionLabel;
  }

  private getTrackedMissionPlanet(): GalaxyMissionPlanet | null {
    return this.trackedMissionPlanet;
  }

  private getStationInteractionRange(station: GalaxyStationRecord): number {
    return station.radius + STATION_INTERACTION_BUFFER;
  }

  private getNearestStationInteraction(): { station: GalaxyStationRecord; distance: number; inRange: boolean } | null {
    let nearestStation: GalaxyStationRecord | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.galaxyDefinition.stations.forEach((station) => {
      const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, station.x, station.y);
      if (distance >= nearestDistance) {
        return;
      }

      nearestStation = station;
      nearestDistance = distance;
    });

    if (!nearestStation) {
      return null;
    }

    return {
      station: nearestStation,
      distance: nearestDistance,
      inRange: nearestDistance <= this.getStationInteractionRange(nearestStation),
    };
  }

  private formatShipSystemName(systemId: string): string {
    switch (systemId) {
      case "lifeSupport":
        return "Life Support";
      default:
        return `${systemId.charAt(0).toUpperCase()}${systemId.slice(1)}`;
    }
  }

  private buildStationOverlayState(station: GalaxyStationRecord): SpaceStationOverlayState {
    const credits = gameSession.getCredits();
    const repairCost = gameSession.getShipRepairCost();
    const damagedSystems = gameSession.getDamagedShipSystemIds();
    const repairSummary = damagedSystems.length > 0
      ? `Repair bay quote: ${repairCost} credits for ${damagedSystems.map((systemId) => this.formatShipSystemName(systemId)).join(", ")}.`
      : "Repair bay scan: all ship systems are currently nominal.";

    return {
      stationName: station.name,
      sectorLabel: getGalaxyRegionLabelAtPosition(station.x, station.y),
      credits,
      repairCost,
      hasDamage: repairCost > 0,
      canAffordRepair: repairCost <= credits,
      repairSummary,
      statusText: this.stationOverlayStatusText || "Station traffic is open. Buy and Sell will come online in a later pass.",
    };
  }

  private tryHandlePrimaryInteraction(): void {
    if (this.playerDestroyed || this.returningToShip || this.isMenuOverlayVisible()) {
      return;
    }

    if (this.canLandOnTrackedMissionPlanet()) {
      this.landAtMissionPlanet();
      return;
    }

    this.tryOpenNearestStationComms();
  }

  private tryOpenNearestStationComms(): void {
    if (this.playerDestroyed || this.returningToShip) {
      return;
    }

    const stationInteraction = this.getNearestStationInteraction();
    if (!stationInteraction || !stationInteraction.inRange) {
      return;
    }

    this.releaseTouchControls();
    this.stationOverlayStationId = stationInteraction.station.id;
    this.stationOverlayStatusText = "Station traffic is open. Buy and Sell will come online in a later pass.";
    this.stationOverlay?.show(this.buildStationOverlayState(stationInteraction.station));
    this.syncSceneOverlayChrome();
  }

  private handleStationRepairRequested(): void {
    if (!this.stationOverlayStationId) {
      return;
    }

    const station = this.galaxyStationsById.get(this.stationOverlayStationId);
    if (!station) {
      return;
    }

    const result = gameSession.repairAllShipSystemsForCredits();
    if (!result.success) {
      this.stationOverlayStatusText = `Repair denied. ${result.cost} credits required.`;
    } else if (result.cost <= 0) {
      this.stationOverlayStatusText = "Repair bay confirms all systems are already nominal.";
    } else {
      this.stationOverlayStatusText = `Repair complete. ${result.cost} credits transferred.`;
      this.restorePlayerHullFromSession();
      this.playerFlash = 0;
      retroSfx.play("shield-recharge", { volume: 0.42, pan: 0 });
    }

    this.stationOverlay?.update(this.buildStationOverlayState(station));
    this.refreshHud();
  }

  private getFactionCounts(radius?: number): Record<SpaceFactionId, number> {
    return this.factionShips.reduce<Record<SpaceFactionId, number>>((counts, ship) => {
      if (radius !== undefined) {
        const distance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, ship.root.x, ship.root.y);
        if (distance > radius) {
          return counts;
        }
      }
      counts[ship.factionId] += 1;
      return counts;
    }, {
      empire: 0,
      pirate: 0,
      republic: 0,
      smuggler: 0,
      homeguard: 0,
    });
  }

  private getRemainingWorldFactionCounts(): Record<SpaceFactionId, number> {
    return [...this.shipStates.values()].reduce<Record<SpaceFactionId, number>>((counts, state) => {
      if (!state.destroyed) {
        counts[state.factionId] += 1;
      }
      return counts;
    }, {
      empire: 0,
      pirate: 0,
      republic: 0,
      smuggler: 0,
      homeguard: 0,
    });
  }

  private getRemainingFieldObjectCount(): number {
    let remaining = 0;
    this.fieldStates.forEach((state) => {
      if (!state.destroyed) {
        remaining += 1;
      }
    });
    return remaining;
  }

  private countNearbyBreakables(radius: number): number {
    return this.asteroids.filter((fieldObject) => (
      Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, fieldObject.root.x, fieldObject.root.y) <= radius
    )).length;
  }

  private getHyperdriveStatusLabel(): string {
    switch (this.hyperdrive.state) {
      case "charging":
        return `Charging ${Math.max(0, ((SHIP_HYPERDRIVE_CONFIG.chargeDurationMs - this.hyperdrive.chargeElapsedMs) / 1000)).toFixed(1)}s`;
      case "active":
        return "Active";
      case "cooldown":
        return `Cooldown ${Math.ceil(this.hyperdrive.cooldownRemainingMs / 1000)}s`;
      case "normal":
      default:
        return "Ready";
    }
  }

  private getHyperdriveHintLabel(): string {
    switch (this.hyperdrive.state) {
      case "charging":
        return "Hold Space to commit";
      case "active":
        return "Space drops out";
      case "cooldown":
        return `Cooldown ${Math.ceil(this.hyperdrive.cooldownRemainingMs / 1000)}s`;
      case "normal":
      default:
        return "Hold Space 3s";
    }
  }

  private getHyperdriveTouchLabel(): string {
    switch (this.hyperdrive.state) {
      case "charging":
        return `Charge\n${Math.max(0, ((SHIP_HYPERDRIVE_CONFIG.chargeDurationMs - this.hyperdrive.chargeElapsedMs) / 1000)).toFixed(1)}s`;
      case "active":
        return "Drop\nOut";
      case "cooldown":
        return `Cool\n${Math.ceil(this.hyperdrive.cooldownRemainingMs / 1000)}s`;
      case "normal":
      default:
        return "Hyper";
    }
  }

  private getHyperdriveTouchProgress(): number {
    if (this.hyperdrive.state === "charging") {
      return Phaser.Math.Clamp(this.hyperdrive.chargeElapsedMs / SHIP_HYPERDRIVE_CONFIG.chargeDurationMs, 0, 1);
    }
    if (this.hyperdrive.state === "cooldown") {
      return Phaser.Math.Clamp(this.hyperdrive.cooldownRemainingMs / SHIP_HYPERDRIVE_CONFIG.cooldownDurationMs, 0, 1);
    }
    return 0;
  }

  private canLandOnTrackedMissionPlanet(
    missionPlanet = this.getTrackedMissionPlanet(),
    distance = missionPlanet
      ? Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, missionPlanet.x, missionPlanet.y)
      : null,
  ): boolean {
    if (!missionPlanet || distance === null) {
      return false;
    }

    return distance <= missionPlanet.radius + MISSION_LANDING_RANGE_BUFFER;
  }

  private updateMissionPlanetVisuals(missionPlanet: GalaxyMissionPlanet | null, landingReady: boolean): void {
    if (!missionPlanet) {
      return;
    }

    const planetView = this.activePlanetViews.get(missionPlanet.id);
    if (!planetView) {
      return;
    }

    planetView.label.setVisible(true);
    planetView.landingRing.setStrokeStyle(
      2,
      landingReady ? 0x9df7c7 : 0xfff1cb,
      landingReady ? 0.9 : 0.2,
    );
    planetView.landingRing.setFillStyle(landingReady ? 0x9df7c7 : 0xffffff, landingReady ? 0.08 : 0);
  }

  private updateWaypointIndicator(
    missionPlanet: GalaxyMissionPlanet | null,
    missionDistance: number | null,
    landingReady: boolean,
  ): void {
    if (!this.waypointArrow || !this.waypointLabel || !missionPlanet || missionDistance === null) {
      this.waypointArrow?.setVisible(false);
      this.waypointLabel?.setVisible(false);
      return;
    }

    const dx = missionPlanet.x - this.shipRoot.x;
    const dy = missionPlanet.y - this.shipRoot.y;
    const angle = Math.atan2(dy, dx);
    const centerX = GAME_WIDTH * 0.5;
    const centerY = GAME_HEIGHT * 0.5;
    const halfWidth = centerX - 86;
    const halfHeight = centerY - 92;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const scaleX = Math.abs(dirX) < 0.001 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dirX);
    const scaleY = Math.abs(dirY) < 0.001 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dirY);
    const edgeDistance = Math.min(scaleX, scaleY);
    const indicatorX = centerX + dirX * edgeDistance;
    const indicatorY = centerY + dirY * edgeDistance;

    this.waypointArrow
      .setPosition(indicatorX, indicatorY)
      .setRotation(angle + Math.PI * 0.5)
      .setFillStyle(landingReady ? 0x9df7c7 : 0xffc56e, 0.96)
      .setVisible(true);
    this.waypointLabel
      .setPosition(indicatorX, indicatorY + 18)
      .setText(landingReady
        ? `${missionPlanet.name}\nLANDING WINDOW OPEN`
        : `${missionPlanet.name}\n${Math.round(missionDistance)} units`)
      .setVisible(true);
  }

  private landAtMissionPlanet(): void {
    const missionPlanet = this.getTrackedMissionPlanet();
    if (!missionPlanet || !this.canLandOnTrackedMissionPlanet(missionPlanet)) {
      return;
    }

    if (this.returningToShip || this.playerDestroyed) {
      return;
    }

    this.returningToShip = true;
    this.releaseTouchControls();
    this.closeCommandOverlays();
    this.returnButton?.setEnabled(false);
    this.logbookButton?.setEnabled(false);
    this.pauseButton?.setEnabled(false);
    this.statusText?.setText(`Landing window confirmed for ${missionPlanet.name}. Returning to the ship interior.`);
    gameSession.markShipArrived(missionPlanet.missionId);
    this.cameras.main.fadeOut(220, 8, 12, 18);
    this.time.delayedCall(220, () => {
      this.scene.start("hub");
    });
  }

  private returnToShip(): void {
    if (this.returningToShip || this.playerDestroyed) {
      return;
    }

    this.returningToShip = true;
    this.releaseTouchControls();
    this.closeCommandOverlays();
    this.returnButton?.setEnabled(false);
    this.logbookButton?.setEnabled(false);
    this.pauseButton?.setEnabled(false);
    this.statusText?.setText("Returning to ship interior.");
    gameSession.clearShipTravel();
    this.cameras.main.fadeOut(220, 8, 12, 18);
    this.time.delayedCall(220, () => {
      this.scene.start("hub");
    });
  }

  private handleCommandOverlayClosed(): void {
    this.refreshHud();
  }

  private closeCommandOverlays(): void {
    if (this.logbookOverlay?.isVisible()) {
      this.logbookOverlay.hide();
    }
    if (this.inventoryOverlay?.isVisible()) {
      this.inventoryOverlay.hide();
    }
    if (this.galaxyMapOverlay?.isVisible()) {
      this.galaxyMapOverlay.hide();
    }
    if (this.stationOverlay?.isVisible()) {
      this.stationOverlay.hide();
    }
    this.syncSceneOverlayChrome();
  }

  private isMenuOverlayVisible(): boolean {
    return Boolean(
      this.logbookOverlay?.isVisible()
      || this.inventoryOverlay?.isVisible()
      || this.galaxyMapOverlay?.isVisible()
      || this.stationOverlay?.isVisible(),
    );
  }

  private toggleLogbookOverlay(): void {
    if (this.logbookOverlay?.isVisible()) {
      this.logbookOverlay.hide();
      return;
    }

    this.openDataPadTab("missions");
  }

  private openDataPadTab(tab: "inventory" | "missions" | "skills" | "map" | "starship"): void {
    this.fireHeld = false;
    this.hyperdriveTouchHeld = false;
    this.hyperdriveTouchTapQueued = false;
    this.hyperdrivePointerId = null;
    this.hyperdriveKeyWasDown = false;
    if (this.hyperdrive.state === "charging") {
      this.cancelHyperdriveCharge("Charge aborted.");
    }
    this.releaseTouchControls();
    this.closeCommandOverlays();

    if (tab === "missions") {
      this.logbookOverlay?.show();
      this.syncSceneOverlayChrome();
      return;
    }

    if (tab === "inventory") {
      this.inventoryOverlay?.show();
      this.syncSceneOverlayChrome();
      return;
    }

    if (tab === "map") {
      this.galaxyMapOverlay?.show();
      this.syncSceneOverlayChrome();
    }
  }

  private openPauseMenu(): void {
    if (this.scene.isPaused("pause")) {
      return;
    }

    if (this.hyperdrive.state === "charging") {
      this.cancelHyperdriveCharge("Charge aborted.");
    }
    this.releaseTouchControls();
    this.closeCommandOverlays();
    this.touchUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(false);
    });
    this.scene.launch("pause", {
      returnSceneKey: "space",
      allowSave: true,
    });
    this.scene.pause();
  }

  private syncSceneOverlayChrome(): void {
    const blocking = this.isMenuOverlayVisible();
    const touchGameplayVisible = this.touchMode && !blocking;
    const alpha = blocking ? 0.1 : 1;
    this.routeText?.setAlpha(alpha);
    this.statusText?.setAlpha(alpha);
    this.contactText?.setAlpha(alpha);
    this.coordinateText?.setAlpha(alpha);
    this.radar?.setAlpha(alpha);
    this.waypointArrow?.setAlpha(blocking ? 0.16 : 1);
    this.waypointLabel?.setAlpha(blocking ? 0.16 : 1);
    this.logbookButton?.container.setAlpha(blocking ? 0.28 : 1);
    this.pauseButton?.container.setAlpha(blocking ? 0.28 : 1);
    this.returnButton?.container.setAlpha(blocking ? 0.28 : 1);
    this.touchUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(touchGameplayVisible);
    });
    this.attackButton?.container.setAlpha(this.touchMode ? (blocking ? 0.22 : 1) : 0);
    this.targetButton?.container.setAlpha(this.touchMode ? (blocking ? 0.22 : 1) : 0);
    this.abilityOneButton?.container.setAlpha(this.touchMode ? (blocking ? 0.2 : 0.92) : 0);
    this.abilityTwoButton?.container.setAlpha(this.touchMode ? (blocking ? 0.18 : 0.48) : 0);
  }

  private syncInputMode(): void {
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    const desktopVisible = !this.touchMode;
    this.desktopUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(desktopVisible);
    });

    if (!this.touchMode) {
      this.releaseTouchControls();
    }

    this.syncSceneOverlayChrome();
  }

  private releaseTouchControls(): void {
    this.movePointerId = null;
    this.attackPointerId = null;
    this.hyperdrivePointerId = null;
    this.touchMoveVector.set(0, 0);
    this.hyperdriveTouchHeld = false;
    this.hyperdriveTouchTapQueued = false;
    this.hyperdriveKeyWasDown = false;
    this.fireHeld = false;
    this.resetMoveStick();
  }

  private reportDesktopInput(): void {
    if (!this.touchCapable) {
      return;
    }

    gameSession.reportInputMode("desktop", this.touchCapable);
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const augmentedPointer = pointer as Phaser.Input.Pointer & { wasTouch?: boolean };
    const event = pointer.event as (PointerEvent & { pointerType?: string }) | undefined;
    return Boolean(augmentedPointer.wasTouch || event?.pointerType === "touch");
  }

  getDebugSnapshot(): Record<string, unknown> {
    const activeFactionCounts = this.getFactionCounts();
    const worldFactionCounts = this.getRemainingWorldFactionCounts();
    const nearestStation = this.getNearestStationInteraction();
    const nearestFieldObjects = [...this.asteroids]
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, left.root.x, left.root.y);
        const rightDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, right.root.x, right.root.y);
        return leftDistance - rightDistance;
      })
      .slice(0, 4)
      .map((fieldObject) => ({
        id: fieldObject.id,
        kind: fieldObject.kind,
        placementType: fieldObject.placementType,
        isLarge: fieldObject.isLarge,
        x: Math.round(fieldObject.root.x),
        y: Math.round(fieldObject.root.y),
        hp: fieldObject.hp,
        radius: Math.round(fieldObject.radius),
      }));
    const nearestShips = [...this.factionShips]
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, left.root.x, left.root.y);
        const rightDistance = Phaser.Math.Distance.Between(this.shipRoot.x, this.shipRoot.y, right.root.x, right.root.y);
        return leftDistance - rightDistance;
      })
      .slice(0, 6)
      .map((ship) => ({
        id: ship.id,
        factionId: ship.factionId,
        originRaceId: ship.originRaceId,
        shipRole: ship.shipRole,
        assignmentKind: ship.assignmentKind,
        assignmentZoneId: ship.assignmentZoneId,
        sectorId: ship.sectorId,
        guardRadius: ship.guardRadius,
        x: Math.round(ship.root.x),
        y: Math.round(ship.root.y),
        hp: ship.hp,
        maxHp: ship.maxHp,
        hostileToPlayer: this.canShipAttackPlayer(ship),
      }));
    const smugglerRouteStates = [
      ...this.factionShips.map((ship) => ({
        id: ship.id,
        factionId: ship.factionId,
        sectorId: ship.sectorId,
        routeTargetKind: ship.routeTargetKind,
        routeTargetId: ship.routeTargetId,
        routeWaitRemainingMs: ship.routeWaitRemainingMs,
        destroyed: false,
      })),
      ...[...this.shipStates.values()].filter((state) => !this.factionShips.some((ship) => ship.id === state.id)),
    ];
    const smugglerRoutes = smugglerRouteStates
      .filter((state) => state.factionId === "smuggler" && !state.destroyed)
      .slice(0, 6)
      .map((state) => ({
        id: state.id,
        sectorId: state.sectorId,
        routeTargetKind: state.routeTargetKind,
        routeTargetId: state.routeTargetId,
        routeWaitRemainingMs: Math.round(state.routeWaitRemainingMs ?? 0),
      }));

    return {
      coordinateSpace: "origin top-left, +x right, +y down",
      world: {
        width: SPACE_WORLD_CONFIG.width,
        height: SPACE_WORLD_CONFIG.height,
        galaxyRadius: GALAXY_WORLD_CONFIG.radius,
        restrictedCoreRadius: GALAXY_WORLD_CONFIG.restrictedCoreRadius,
      },
      sector: this.getCurrentGalaxySector().label,
      region: this.getCurrentRegionLabel(),
      isDeepSpace: this.currentRegionIsDeepSpace,
      playerRaceId: gameSession.getPlayerRaceId(),
      war: {
        empireRaceId: this.warState.empireRaceId,
        republicRaceIds: [...this.warState.republicRaceIds],
        alignments: Object.fromEntries(
          this.warState.raceStates.map((raceState) => [raceState.raceId, getRaceAllianceStatus(this.warState, raceState.raceId)]),
        ),
        raceTargets: this.warState.raceStates.map((raceState) => ({
          raceId: raceState.raceId,
          alignment: getRaceAllianceStatus(this.warState, raceState.raceId),
          activeTargetZoneId: raceState.activeTargetZoneId,
          retargetCooldownRemainingMs: Math.round(raceState.retargetCooldownRemainingMs),
        })),
        contestedZones: this.galaxyDefinition.zones
          .filter((zone) => zone.zoneState !== "stable" || zone.captureAttackerRaceId)
          .map((zone) => ({
            id: zone.id,
            systemId: zone.systemId,
            currentControllerId: zone.currentControllerId,
            zoneState: zone.zoneState,
            zoneCaptureProgress: Number(zone.zoneCaptureProgress.toFixed(3)),
            captureAttackerRaceId: zone.captureAttackerRaceId,
          })),
      },
      routeMissionId: this.routeMissionId,
      routeTitle: this.routeTitle,
      touchMode: this.touchMode,
      autoAim: gameSession.settings.controls.autoAim,
      autoFire: gameSession.settings.controls.autoFire,
      hyperdrive: {
        state: this.hyperdrive.state,
        chargeElapsedMs: Math.round(this.hyperdrive.chargeElapsedMs),
        chargeDurationMs: SHIP_HYPERDRIVE_CONFIG.chargeDurationMs,
        cooldownRemainingMs: Math.round(this.hyperdrive.cooldownRemainingMs),
        cooldownDurationMs: SHIP_HYPERDRIVE_CONFIG.cooldownDurationMs,
        exitBlendRemainingMs: Math.round(this.hyperdrive.exitBlendRemainingMs),
        maxSpeed: PLAYER_HYPERDRIVE_MAX_SPEED,
        lockedDirection: {
          x: Number(this.hyperdrive.lockedDirectionX.toFixed(3)),
          y: Number(this.hyperdrive.lockedDirectionY.toFixed(3)),
        },
        lastReason: this.hyperdrive.lastDisengageReason,
      },
      playerHull: {
        current: Math.max(0, this.playerHull),
        max: PLAYER_MAX_HULL,
      },
      ship: {
        x: Math.round(this.shipRoot.x),
        y: Math.round(this.shipRoot.y),
        vx: Math.round(this.shipVelocity.x),
        vy: Math.round(this.shipVelocity.y),
        facing: Math.round(Phaser.Math.RadToDeg(this.shipRoot.rotation)),
      },
      missionPlanet: this.getTrackedMissionPlanet() ? {
        missionId: this.getTrackedMissionPlanet()?.missionId ?? null,
        name: this.getTrackedMissionPlanet()?.name ?? null,
        x: Math.round(this.getTrackedMissionPlanet()?.x ?? 0),
        y: Math.round(this.getTrackedMissionPlanet()?.y ?? 0),
      } : null,
      landingReady: this.canLandOnTrackedMissionPlanet(),
      nearestStation: nearestStation
        ? {
            id: nearestStation.station.id,
            name: nearestStation.station.name,
            distance: Math.round(nearestStation.distance),
            inRange: nearestStation.inRange,
          }
        : null,
      asteroidsRemaining: this.getRemainingFieldObjectCount(),
      activeAsteroids: this.asteroids.length,
      activeCelestialSystems: this.activeCelestialSystems.size,
      activeCelestialPlanets: this.activePlanetViews.size,
      activeCelestialMoons: [...this.activeCelestialSystems.values()].reduce((sum, entry) => sum + entry.moonIds.length, 0),
      activeStations: this.activeStationViews.size,
      stationCount: this.galaxyDefinition.stations.length,
      destroyedObjects: this.destroyedObjects,
      factionShipsRemaining: [...this.shipStates.values()].filter((state) => !state.destroyed).length,
      activeFactionShips: this.factionShips.length,
      destroyedFactionShips: this.destroyedFactionShips,
      factionCounts: worldFactionCounts,
      activeFactionCounts,
      production: getFactionForceDebugSnapshot(this.forceState, this.galaxyDefinition),
      activeFieldCellKeys: [...this.activeFieldCellKeys],
      activeShipCellKeys: [...this.activeShipCellKeys],
      activeBackdropStarCells: this.activeBackdropStarCells.size,
      activeBackdropHazeNodes: this.activeBackdropHazeNodes.size,
      radar: this.radar?.getDebugSnapshot() ?? null,
      activeShots: this.shots.length,
      activeBurstParticles: this.burstParticles.length,
      logbookVisible: this.logbookOverlay?.isVisible() ?? false,
      inventoryVisible: this.inventoryOverlay?.isVisible() ?? false,
      mapVisible: this.galaxyMapOverlay?.isVisible() ?? false,
      stationOverlayVisible: this.stationOverlay?.isVisible() ?? false,
      selectedTarget: this.selectedTarget
        ? this.selectedTarget.kind === "ship"
          ? { kind: "ship", id: this.selectedTarget.ship.id, factionId: this.selectedTarget.ship.factionId }
          : { kind: "field", id: this.selectedTarget.fieldObject.id, fieldKind: this.selectedTarget.fieldObject.kind }
        : null,
      autoAimTarget: this.autoAimTarget
        ? this.autoAimTarget.kind === "ship"
          ? { kind: "ship", id: this.autoAimTarget.ship.id, factionId: this.autoAimTarget.ship.factionId }
          : { kind: "field", id: this.autoAimTarget.fieldObject.id, fieldKind: this.autoAimTarget.fieldObject.kind }
        : null,
      touchAttackHeld: this.attackPointerId !== null,
      touchHyperdriveHeld: this.hyperdrivePointerId !== null,
      returnReady: !this.returningToShip && !this.playerDestroyed,
      nearestFieldObjects,
      nearestShips,
      smugglerRoutes,
    };
  }
}



