import { type RaceId } from "./items";

export type GalaxyWorldConfig = {
  width: number;
  height: number;
  center: {
    x: number;
    y: number;
  };
  spawn: {
    x: number;
    y: number;
  };
  radius: number;
  coreRadius: number;
  restrictedCoreRadius: number;
  sectorInnerRadius: number;
  raceSpawnRadius: number;
  verticalScale: number;
  armCount: number;
  armTurns: number;
  coreStarCount: number;
  starCount: number;
  backgroundStarCount: number;
};

export type GalaxySectorConfig = {
  id: string;
  raceId: RaceId;
  label: string;
  color: number;
  borderColor: number;
  startAngleDeg: number;
  endAngleDeg: number;
  innerRadius: number;
  outerRadius: number;
  labelRadius: number;
};

export type GalaxyStarSeed = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: number;
  armIndex: number;
};

export type GalaxyHazeNode = {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
};

export type GalaxyPoint = {
  x: number;
  y: number;
};

export type GalaxyRingId = "inner" | "second" | "third" | "outer" | "deep-space";

export type GalaxyRingConfig = {
  id: GalaxyRingId;
  label: string;
  minRadius: number;
  maxRadius: number;
  densityWeight: number;
  isMainGalaxyBody: boolean;
};

export type GalaxyZoneControllerId = RaceId | "empire" | "republic" | "inactive";
export type GalaxyZoneState = "stable" | "contested" | "capturing";

export type GalaxyZoneRecord = {
  id: string;
  systemId: string;
  sectorId: string;
  coreSectorId: string;
  ringId: GalaxyRingId;
  territoryPoints: GalaxyPoint[];
  anchorWeight: number;
  isPrimeWorldZone: boolean;
  currentControllerId: GalaxyZoneControllerId;
  zoneState: GalaxyZoneState;
  zoneCaptureProgress: number;
};

export type GalaxySystemRecord = {
  id: string;
  name: string;
  sectorId: string;
  ringId: GalaxyRingId;
  zoneId: string;
  starId: string;
  x: number;
  y: number;
  starColor: number;
  starSize: number;
  planetIds: string[];
};

export type GalaxyPlanetRecord = {
  id: string;
  systemId: string;
  starId: string;
  sectorId: string;
  ringId: GalaxyRingId;
  orbitIndex: number;
  orbitRadius: number;
  orbitBaseAngleDeg: number;
  orbitSpeed: number;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  moonIds: string[];
  isHomeworld: boolean;
  homeworldRaceId: RaceId | null;
  missionIds: string[];
};

export type GalaxyMoonRecord = {
  id: string;
  planetId: string;
  systemId: string;
  sectorId: string;
  ringId: GalaxyRingId;
  orbitIndex: number;
  orbitRadius: number;
  orbitBaseAngleDeg: number;
  orbitSpeed: number;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: number;
};

export type GalaxyHomeworldRecord = {
  raceId: RaceId;
  sectorId: string;
  systemId: string;
  planetId: string;
  name: string;
  moonCount: number;
};

export type GalaxyStationRecord = {
  id: string;
  sectorId: string;
  ringId: "second";
  name: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  borderColor: number;
};

export type GalaxyMissionPlanet = GalaxyPlanetRecord & {
  missionId: string;
};

export type GalaxyDefinition = {
  seed: number;
  rings: GalaxyRingConfig[];
  systems: GalaxySystemRecord[];
  zones: GalaxyZoneRecord[];
  planets: GalaxyPlanetRecord[];
  moons: GalaxyMoonRecord[];
  homeworlds: GalaxyHomeworldRecord[];
  stations: GalaxyStationRecord[];
  missionAssignments: Record<string, string>;
};

export type GalaxyControllerPalette = {
  color: number;
  borderColor: number;
  label: string;
};

type GalaxyHomeworldSpec = {
  name: string;
  moonCount: number;
};

type GalaxyStationSpec = {
  name: string;
};

type GalaxyMissionAssignmentRule = {
  missionId: string;
  preferredSectorId: string;
  preferredRingIds: GalaxyRingId[];
};

type GalaxyRingSystemCounts = Record<Exclude<GalaxyRingId, "deep-space">, number>;

type GalaxySystemCluster = {
  ringId: Exclude<GalaxyRingId, "deep-space">;
  centerAngleDeg: number;
  centerRadius: number;
  angularJitterDeg: number;
  radialJitter: number;
};

const STAR_COLORS = [0xffffff, 0xe4f1ff, 0xa4d2ff, 0xffe9ae] as const;
const DEFAULT_PLAYER_RACE_ID: RaceId = "olydran";
const ACTIVE_SYSTEM_RING_IDS = ["inner", "second", "third", "outer"] as const;
const GALAXY_SYSTEM_MIN_DISTANCE_BY_RING: Record<Exclude<GalaxyRingId, "deep-space">, number> = {
  inner: 1880,
  second: 2080,
  third: 2320,
  outer: 2480,
};
const GALAXY_MOON_CHANCE = 0.54;
const GALAXY_HOMEWORLD_RADIUS_SCALE = 1.24;
const GALAXY_HOMEWORLD_SECTOR_EDGE_MARGIN_DEG = 7;
const GALAXY_HOMEWORLD_RING_EDGE_MARGIN = 520;
const GALAXY_PRIME_WORLD_ZONE_WEIGHT_FACTOR = 0.42;
const GALAXY_ZONE_POLYGON_STEPS = 28;
const GALAXY_ZONE_CLIP_EPSILON = 0.0001;
const GALAXY_PLANET_ORBIT_DEGREES_PER_SECOND = 0.12;
const GALAXY_MOON_ORBIT_DEGREES_PER_SECOND = 0.18;
const GALAXY_STATION_RADIUS = 180;
const GALAXY_STATION_RING_EDGE_MARGIN = 460;
const GALAXY_STATION_SYSTEM_BUFFER = 1180;
const GALAXY_STATION_SECTOR_EDGE_MARGIN_DEG = 6;
const GALAXY_STATION_SEED_SALT = 0x5f37_29df;
const GALAXY_PLANET_ORBIT_SPEED_RANGE = {
  minRadius: 220,
  maxRadius: 860,
  fastest: 1.24,
  slowest: 0.82,
  variation: 0.02,
} as const;
const GALAXY_MOON_ORBIT_SPEED_RANGE = {
  minRadius: 140,
  maxRadius: 260,
  fastest: 1.58,
  slowest: 1.3,
  variation: 0.01,
} as const;
const GALAXY_SYSTEM_NAME_PARTS = [
  "al", "an", "ar", "bel", "cal", "cer", "dor", "el", "eris", "fen",
  "gal", "hal", "ion", "jor", "ka", "lor", "mer", "nyx", "or", "pra",
  "quor", "ryl", "sol", "tal", "ul", "vor", "wyr", "xer", "yor", "zen",
] as const;
const GALAXY_WORLD_NAME_PARTS = [
  "ae", "al", "an", "ara", "bel", "ca", "cel", "dra", "el", "eon",
  "fal", "gan", "hel", "ia", "jor", "ka", "lor", "myr", "na", "or",
  "pra", "qua", "ria", "sel", "ta", "ul", "va", "wen", "xan", "yor",
] as const;

const GALAXY_HOMEWORLD_SPECS: Record<RaceId, GalaxyHomeworldSpec> = {
  nevari: { name: "Nevaeh", moonCount: 1 },
  olydran: { name: "Olympos", moonCount: 1 },
  aaruian: { name: "A\u2019aru", moonCount: 2 },
  rakkan: { name: "Nar\u2019Akka", moonCount: 0 },
  svarin: { name: "Svaria", moonCount: 1 },
  ashari: { name: "Averna", moonCount: 1 },
  elsari: { name: "Elysiem", moonCount: 0 },
};

const GALAXY_STATION_SPECS: Record<RaceId, GalaxyStationSpec> = {
  nevari: { name: "Nevari Station" },
  olydran: { name: "Olydran Station" },
  aaruian: { name: "Aaruian Station" },
  rakkan: { name: "Rakkan Station" },
  svarin: { name: "Svarin Station" },
  ashari: { name: "Ashari Station" },
  elsari: { name: "Elsari Station" },
};

const GALAXY_SPECIAL_CONTROLLER_PALETTES: Record<Exclude<GalaxyZoneControllerId, RaceId>, GalaxyControllerPalette> = {
  empire: {
    color: 0xa82e38,
    borderColor: 0xff9ca4,
    label: "Empire",
  },
  republic: {
    color: 0x2c5cab,
    borderColor: 0x92c5ff,
    label: "Republic",
  },
  inactive: {
    color: 0x7d8793,
    borderColor: 0xc7d0db,
    label: "Inactive",
  },
};

const GALAXY_MISSION_ASSIGNMENT_RULES: GalaxyMissionAssignmentRule[] = [
  {
    missionId: "ember-watch",
    preferredSectorId: "ashari-crown",
    preferredRingIds: ["second", "third"],
  },
  {
    missionId: "outpost-breach",
    preferredSectorId: "rakkan-drift",
    preferredRingIds: ["third", "outer"],
  },
  {
    missionId: "nightglass-abyss",
    preferredSectorId: "elsari-veil",
    preferredRingIds: ["outer", "third"],
  },
];

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
  }

  next(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }
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

function pointFromPolarWithGeometry(
  centerX: number,
  centerY: number,
  verticalScale: number,
  angleRad: number,
  radius: number,
): GalaxyPoint {
  return {
    x: centerX + Math.cos(angleRad) * radius,
    y: centerY + Math.sin(angleRad) * radius * verticalScale,
  };
}

function pointFromPolarForConfig(config: GalaxyWorldConfig, angleRad: number, radius: number): GalaxyPoint {
  return pointFromPolarWithGeometry(config.center.x, config.center.y, config.verticalScale, angleRad, radius);
}

export function pointFromPolar(angleRad: number, radius: number): GalaxyPoint {
  return pointFromPolarForConfig(GALAXY_WORLD_CONFIG, angleRad, radius);
}

export function pointFromDegrees(angleDeg: number, radius: number): GalaxyPoint {
  return pointFromPolar((angleDeg * Math.PI) / 180, radius);
}

function buildGalaxyStars(config: GalaxyWorldConfig): GalaxyStarSeed[] {
  const rng = new SeededRandom(0x0f4c_91a7);
  const stars: GalaxyStarSeed[] = [];
  const radialScale = config.radius / 6200;
  const edgePadding = Math.max(96, 64 * radialScale);

  for (let index = 0; index < config.coreStarCount; index += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = Math.pow(rng.next(), 0.48) * config.coreRadius;
    const jitter = rng.range(-24 * radialScale, 24 * radialScale);
    const point = pointFromPolarForConfig(config, angle, radius + jitter);
    stars.push({
      x: point.x,
      y: point.y,
      size: rng.range(1.4, 3.2),
      alpha: rng.range(0.72, 0.98),
      color: rng.pick(STAR_COLORS),
      armIndex: -1,
    });
  }

  for (let index = 0; index < config.starCount; index += 1) {
    const armIndex = rng.int(0, config.armCount - 1);
    const radialT = Math.pow(rng.next(), 0.72);
    const baseRadius = config.sectorInnerRadius + radialT * (config.radius - config.sectorInnerRadius);
    const baseAngle = (armIndex / config.armCount) * Math.PI * 2 + radialT * config.armTurns * Math.PI * 2;
    const angularNoise = rng.range(-0.34, 0.34);
    const radialNoiseMagnitude = (120 + radialT * 420) * radialScale;
    const radialNoise = rng.range(-radialNoiseMagnitude, radialNoiseMagnitude);
    const point = pointFromPolarForConfig(config, baseAngle + angularNoise, baseRadius + radialNoise);
    if (
      point.x < edgePadding
      || point.x > config.width - edgePadding
      || point.y < edgePadding
      || point.y > config.height - edgePadding
    ) {
      continue;
    }

    stars.push({
      x: point.x,
      y: point.y,
      size: rng.range(0.7, radialT > 0.78 ? 2.1 : 1.7),
      alpha: rng.range(radialT > 0.72 ? 0.42 : 0.56, radialT > 0.72 ? 0.88 : 0.96),
      color: rng.pick(STAR_COLORS),
      armIndex,
    });
  }

  for (let index = 0; index < config.backgroundStarCount; index += 1) {
    stars.push({
      x: rng.range(24, config.width - 24),
      y: rng.range(24, config.height - 24),
      size: rng.range(0.35, 1.1),
      alpha: rng.range(0.18, 0.52),
      color: rng.pick(STAR_COLORS),
      armIndex: -1,
    });
  }

  return stars;
}

function buildGalaxyHazeNodes(config: GalaxyWorldConfig): GalaxyHazeNode[] {
  const nodes: GalaxyHazeNode[] = [];
  const colors = [0x1f4f78, 0x34245c, 0x215844, 0x5d2b2b] as const;

  for (let armIndex = 0; armIndex < config.armCount; armIndex += 1) {
    for (let step = 0; step < 6; step += 1) {
      const radialT = 0.18 + step * 0.14;
      const radius = config.sectorInnerRadius + radialT * (config.radius - config.sectorInnerRadius);
      const angle = (armIndex / config.armCount) * Math.PI * 2 + radialT * config.armTurns * Math.PI * 2;
      const point = pointFromPolarForConfig(config, angle, radius);
      nodes.push({
        x: point.x,
        y: point.y,
        radius: config.radius * (0.055 + step * 0.018),
        color: colors[(armIndex + step) % colors.length],
        alpha: 0.06 + (step * 0.01),
      });
    }
  }

  nodes.push({
    x: config.center.x,
    y: config.center.y,
    radius: config.restrictedCoreRadius * 1.14,
    color: 0x365c86,
    alpha: 0.14,
  });

  return nodes;
}

function interpolateColor(start: number, end: number, t: number): number {
  const startR = (start >> 16) & 0xff;
  const startG = (start >> 8) & 0xff;
  const startB = start & 0xff;
  const endR = (end >> 16) & 0xff;
  const endG = (end >> 8) & 0xff;
  const endB = end & 0xff;
  const r = Math.round(startR + ((endR - startR) * t));
  const g = Math.round(startG + ((endG - startG) * t));
  const b = Math.round(startB + ((endB - startB) * t));
  return (r << 16) | (g << 8) | b;
}

function hashStringToSeed(value: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeAngleDegrees(angleDeg: number): number {
  const wrapped = angleDeg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function getAngleDegreesBetweenPoints(originX: number, originY: number, targetX: number, targetY: number): number {
  return normalizeAngleDegrees(Math.atan2(targetY - originY, targetX - originX) * (180 / Math.PI));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundOrbitSpeed(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getOrbitVariationMultiplier(recordId: string, variation: number): number {
  const unit = hashStringToSeed(recordId) / 0xffff_ffff;
  return 1 + (((unit * 2) - 1) * variation);
}

function getDistanceWeightedOrbitSpeed(
  orbitRadius: number,
  recordId: string,
  config: {
    minRadius: number;
    maxRadius: number;
    fastest: number;
    slowest: number;
    variation: number;
  },
): number {
  const normalizedDistance = clamp01(
    (orbitRadius - config.minRadius) / Math.max(1, config.maxRadius - config.minRadius),
  );
  const baseSpeed = config.fastest - ((config.fastest - config.slowest) * normalizedDistance);
  return roundOrbitSpeed(baseSpeed * getOrbitVariationMultiplier(recordId, config.variation));
}

function getPlanetOrbitSpeedForRadius(orbitRadius: number, recordId: string): number {
  return getDistanceWeightedOrbitSpeed(orbitRadius, recordId, GALAXY_PLANET_ORBIT_SPEED_RANGE);
}

function getMoonOrbitSpeedForRadius(orbitRadius: number, recordId: string): number {
  return getDistanceWeightedOrbitSpeed(orbitRadius, recordId, GALAXY_MOON_ORBIT_SPEED_RANGE);
}

function isLegacyOrbitSpeed(value: number | undefined): boolean {
  return typeof value === "number"
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= 1
    && value <= 4;
}

function getOrbitPositionAtTime(
  anchorX: number,
  anchorY: number,
  orbitRadius: number,
  orbitBaseAngleDeg: number,
  orbitSpeed: number,
  orbitDegreesPerSecond: number,
  orbitTimeMs = 0,
): GalaxyPoint {
  const angleDeg = normalizeAngleDegrees(
    orbitBaseAngleDeg + ((orbitTimeMs / 1000) * orbitDegreesPerSecond * orbitSpeed),
  );
  const angleRad = angleDeg * (Math.PI / 180);
  return {
    x: Math.round(anchorX + (Math.cos(angleRad) * orbitRadius)),
    y: Math.round(anchorY + (Math.sin(angleRad) * orbitRadius)),
  };
}

function getNormalizedOrbitRadius(value: number | undefined, fallbackValue: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, value)
    : Math.max(1, fallbackValue);
}

function getNormalizedOrbitBaseAngleDeg(value: number | undefined, fallbackValue: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? normalizeAngleDegrees(value)
    : normalizeAngleDegrees(fallbackValue);
}

function getNormalizedOrbitSpeed(value: number | undefined, fallbackValue: number): number {
  const candidate = typeof value === "number"
    && Number.isFinite(value)
    && !isLegacyOrbitSpeed(value)
    ? value
    : fallbackValue;
  return roundOrbitSpeed(Math.max(0.72, Math.min(1.62, candidate)));
}

function getGalaxyWorldMaxRadius(config: GalaxyWorldConfig): number {
  const corners = [
    { x: 0, y: 0 },
    { x: config.width, y: 0 },
    { x: 0, y: config.height },
    { x: config.width, y: config.height },
  ];

  return corners.reduce((largest, corner) => {
    const dx = corner.x - config.center.x;
    const dy = (corner.y - config.center.y) / config.verticalScale;
    return Math.max(largest, Math.sqrt((dx * dx) + (dy * dy)));
  }, config.radius);
}

function buildGalaxyRingConfigs(config: GalaxyWorldConfig): GalaxyRingConfig[] {
  const mainBodyStart = config.sectorInnerRadius;
  const mainBodySpan = config.radius - mainBodyStart;
  const innerEnd = mainBodyStart + (mainBodySpan * 0.25);
  const secondEnd = mainBodyStart + (mainBodySpan * 0.5);
  const thirdEnd = mainBodyStart + (mainBodySpan * 0.75);
  const deepSpaceEnd = getGalaxyWorldMaxRadius(config);

  return [
    {
      id: "inner",
      label: "Inner ring",
      minRadius: mainBodyStart,
      maxRadius: innerEnd,
      densityWeight: 0.38,
      isMainGalaxyBody: true,
    },
    {
      id: "second",
      label: "Second ring",
      minRadius: innerEnd,
      maxRadius: secondEnd,
      densityWeight: 0.3,
      isMainGalaxyBody: true,
    },
    {
      id: "third",
      label: "Third ring",
      minRadius: secondEnd,
      maxRadius: thirdEnd,
      densityWeight: 0.22,
      isMainGalaxyBody: true,
    },
    {
      id: "outer",
      label: "Outer ring",
      minRadius: thirdEnd,
      maxRadius: config.radius,
      densityWeight: 0.1,
      isMainGalaxyBody: true,
    },
    {
      id: "deep-space",
      label: "Deep space",
      minRadius: config.radius,
      maxRadius: deepSpaceEnd,
      densityWeight: 0,
      isMainGalaxyBody: false,
    },
  ];
}

export const GALAXY_WORLD_CONFIG: GalaxyWorldConfig = {
  width: 80000,
  height: 80000,
  center: {
    x: 40000,
    y: 40000,
  },
  spawn: pointFromPolarWithGeometry(40000, 40000, 0.72, 0, 21000),
  radius: 30000,
  coreRadius: 4700,
  restrictedCoreRadius: 6200,
  sectorInnerRadius: 9600,
  raceSpawnRadius: 21000,
  verticalScale: 0.72,
  armCount: 4,
  armTurns: 1.68,
  coreStarCount: 760,
  starCount: 5200,
  backgroundStarCount: 1200,
};

export const GALAXY_SECTORS: GalaxySectorConfig[] = [
  {
    id: "olydran-expanse",
    raceId: "olydran",
    label: "Olydran Expanse",
    color: 0xf0f5ff,
    borderColor: 0xffffff,
    startAngleDeg: 338,
    endAngleDeg: 28,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.76,
  },
  {
    id: "aaruian-reach",
    raceId: "aaruian",
    label: "Aaruian Reach",
    color: 0x4f8dff,
    borderColor: 0xbad7ff,
    startAngleDeg: 28,
    endAngleDeg: 78,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.785,
  },
  {
    id: "elsari-veil",
    raceId: "elsari",
    label: "Elsari Veil",
    color: 0x8a58ff,
    borderColor: 0xd2b7ff,
    startAngleDeg: 78,
    endAngleDeg: 130,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.8,
  },
  {
    id: "nevari-bloom",
    raceId: "nevari",
    label: "Nevari Bloom",
    color: 0x49a85c,
    borderColor: 0xb9efc3,
    startAngleDeg: 130,
    endAngleDeg: 184,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.785,
  },
  {
    id: "rakkan-drift",
    raceId: "rakkan",
    label: "Rakkan Drift",
    color: 0xff9a3c,
    borderColor: 0xffd29f,
    startAngleDeg: 184,
    endAngleDeg: 238,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.78,
  },
  {
    id: "svarin-span",
    raceId: "svarin",
    label: "Svarin Span",
    color: 0xe4c83d,
    borderColor: 0xffefb2,
    startAngleDeg: 238,
    endAngleDeg: 292,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.775,
  },
  {
    id: "ashari-crown",
    raceId: "ashari",
    label: "Ashari Crown",
    color: 0xd74b56,
    borderColor: 0xffb3b8,
    startAngleDeg: 292,
    endAngleDeg: 338,
    innerRadius: GALAXY_WORLD_CONFIG.sectorInnerRadius,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: GALAXY_WORLD_CONFIG.radius * 0.765,
  },
];

export const GALAXY_RINGS: GalaxyRingConfig[] = buildGalaxyRingConfigs(GALAXY_WORLD_CONFIG);
export const GALAXY_STARS: GalaxyStarSeed[] = buildGalaxyStars(GALAXY_WORLD_CONFIG);
export const GALAXY_HAZE_NODES: GalaxyHazeNode[] = buildGalaxyHazeNodes(GALAXY_WORLD_CONFIG);

function getGalaxyRingByIdLocal(ringId: GalaxyRingId): GalaxyRingConfig {
  return GALAXY_RINGS.find((ring) => ring.id === ringId) ?? GALAXY_RINGS[0];
}

function pickWeighted<T>(entries: Array<{ value: T; weight: number }>, rng: SeededRandom): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rng.range(0, total);
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.value;
    }
  }
  return entries[entries.length - 1].value;
}

function getGalaxyAngleDeg(x: number, y: number): number {
  const dx = x - GALAXY_WORLD_CONFIG.center.x;
  const dy = (y - GALAXY_WORLD_CONFIG.center.y) / GALAXY_WORLD_CONFIG.verticalScale;
  return wrapAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
}

function normalizeSectorAngle(angleDeg: number, sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  let candidate = wrapAngleDegrees(angleDeg);
  if (candidate < start) {
    candidate += 360;
  }
  return Math.max(start, Math.min(end, candidate));
}

function getSectorInteriorMarginDegrees(sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  return Math.min(GALAXY_HOMEWORLD_SECTOR_EDGE_MARGIN_DEG, (end - start) * 0.18);
}

function getPlanetAngularMarginFromSectorEdge(planet: GalaxyPlanetRecord, sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const angleDeg = normalizeSectorAngle(getGalaxyAngleDeg(planet.x, planet.y), sector);
  return Math.min(angleDeg - start, end - angleDeg);
}

function getHomeworldCandidateScore(planet: GalaxyPlanetRecord, sector: GalaxySectorConfig): number {
  const ring = getGalaxyRingByIdLocal("third");
  const ringMid = (ring.minRadius + ring.maxRadius) * 0.5;
  const ringHalfSpan = Math.max(1, (ring.maxRadius - ring.minRadius) * 0.5);
  const radialDistance = getGalaxyRadialDistance(planet.x, planet.y);
  const radialScore = Math.abs(radialDistance - ringMid) / ringHalfSpan;
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const sectorMid = (start + end) * 0.5;
  const angleDeg = normalizeSectorAngle(getGalaxyAngleDeg(planet.x, planet.y), sector);
  const angularScore = Math.abs(angleDeg - sectorMid) / Math.max(1, (end - start) * 0.5);
  const orbitScore = planet.orbitIndex * 0.08;
  return radialScore + angularScore + orbitScore;
}

function isStationPointValid(
  point: GalaxyPoint,
  sector: GalaxySectorConfig,
  stations: GalaxyStationRecord[],
  systems: GalaxySystemRecord[],
): boolean {
  const radialDistance = getGalaxyRadialDistance(point.x, point.y);
  const secondRing = getGalaxyRingByIdLocal("second");
  if (getGalaxySectorAtPosition(point.x, point.y).id !== sector.id) {
    return false;
  }
  if (getGalaxyRingAtPosition(point.x, point.y).id !== "second") {
    return false;
  }
  if (radialDistance < secondRing.minRadius + GALAXY_STATION_RING_EDGE_MARGIN) {
    return false;
  }
  if (radialDistance > secondRing.maxRadius - GALAXY_STATION_RING_EDGE_MARGIN) {
    return false;
  }
  if (getPlanetAngularMarginFromSectorEdge({
    id: "station-probe",
    systemId: "",
    starId: "",
    sectorId: sector.id,
    ringId: "second",
    orbitIndex: 0,
    orbitRadius: 0,
    orbitBaseAngleDeg: 0,
    orbitSpeed: 1,
    name: "",
    x: point.x,
    y: point.y,
    radius: GALAXY_STATION_RADIUS,
    color: 0,
    moonIds: [],
    isHomeworld: false,
    homeworldRaceId: null,
    missionIds: [],
  }, sector) < GALAXY_STATION_SECTOR_EDGE_MARGIN_DEG) {
    return false;
  }

  const stationRadiusSq = (GALAXY_STATION_RADIUS * 4) * (GALAXY_STATION_RADIUS * 4);
  if (stations.some((station) => {
    const dx = station.x - point.x;
    const dy = station.y - point.y;
    return (dx * dx) + (dy * dy) < stationRadiusSq;
  })) {
    return false;
  }

  const systemBufferSq = GALAXY_STATION_SYSTEM_BUFFER * GALAXY_STATION_SYSTEM_BUFFER;
  return systems.every((system) => {
    const dx = system.x - point.x;
    const dy = system.y - point.y;
    return (dx * dx) + (dy * dy) >= systemBufferSq;
  });
}

function getStationCandidateScore(point: GalaxyPoint, systems: GalaxySystemRecord[]): number {
  return systems.reduce((nearestDistanceSq, system) => {
    const dx = system.x - point.x;
    const dy = system.y - point.y;
    const distanceSq = (dx * dx) + (dy * dy);
    return Math.min(nearestDistanceSq, distanceSq);
  }, Number.POSITIVE_INFINITY);
}

function createStationsForSectors(
  systems: GalaxySystemRecord[],
  rng: SeededRandom,
): GalaxyStationRecord[] {
  const stations: GalaxyStationRecord[] = [];
  const secondRing = getGalaxyRingByIdLocal("second");

  GALAXY_SECTORS.forEach((sector) => {
    const spec = GALAXY_STATION_SPECS[sector.raceId];
    let bestCandidate = pointFromDegrees(getGalaxySectorMidAngleDeg(sector), (secondRing.minRadius + secondRing.maxRadius) * 0.5);
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let attempt = 0; attempt < 72; attempt += 1) {
      const point = pointFromDegrees(
        pickAngleInSector(sector, rng),
        rng.range(secondRing.minRadius + 260, secondRing.maxRadius - 220),
      );
      const candidateScore = getStationCandidateScore(point, systems);
      if (candidateScore > bestScore) {
        bestCandidate = point;
        bestScore = candidateScore;
      }
      if (!isStationPointValid(point, sector, stations, systems)) {
        continue;
      }
      bestCandidate = point;
      break;
    }

    stations.push({
      id: `${sector.id}-station`,
      sectorId: sector.id,
      ringId: "second",
      name: spec.name,
      x: Math.round(bestCandidate.x),
      y: Math.round(bestCandidate.y),
      radius: GALAXY_STATION_RADIUS,
      color: interpolateColor(sector.color, 0xffffff, 0.2),
      borderColor: sector.borderColor,
    });
  });

  return stations;
}

function createProceduralName(
  rng: SeededRandom,
  usedNames: Set<string>,
  parts: readonly string[],
  minParts: number,
  maxParts: number,
): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const partCount = rng.int(minParts, maxParts);
    let raw = "";
    for (let index = 0; index < partCount; index += 1) {
      raw += rng.pick(parts);
    }
    const trimmed = raw.replace(/([aeiou])\1+/g, "$1").replace(/q(?!u)/g, "qu");
    const candidate = `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }

  const fallback = `World-${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

function getPlanetCount(rng: SeededRandom): number {
  return pickWeighted<number>([
    { value: 1, weight: 0.2 },
    { value: 2, weight: 0.5 },
    { value: 3, weight: 0.22 },
    { value: 4, weight: 0.08 },
  ], rng);
}

function getMoonCount(rng: SeededRandom): number {
  return pickWeighted<number>([
    { value: 1, weight: 0.68 },
    { value: 2, weight: 0.32 },
  ], rng);
}

function allocateRingSystemCounts(total: number, rng: SeededRandom): GalaxyRingSystemCounts {
  const counts: GalaxyRingSystemCounts = {
    inner: 1,
    second: 1,
    third: 1,
    outer: 1,
  };

  for (let remaining = total - ACTIVE_SYSTEM_RING_IDS.length; remaining > 0; remaining -= 1) {
    const ringId = pickWeighted<Exclude<GalaxyRingId, "deep-space">>([
      { value: "inner", weight: 0.38 },
      { value: "second", weight: 0.3 },
      { value: "third", weight: 0.22 },
      { value: "outer", weight: 0.1 },
    ], rng);
    counts[ringId] += 1;
  }

  return counts;
}

function clampAngleToSector(angleDeg: number, sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const candidate = normalizeSectorAngle(angleDeg, sector);
  return wrapAngleDegrees(Math.max(start, Math.min(end, candidate)));
}

function pickAngleInSector(sector: GalaxySectorConfig, rng: SeededRandom): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  return wrapAngleDegrees(rng.range(start, end));
}

function pickRadiusInRing(ring: GalaxyRingConfig, rng: SeededRandom): number {
  const innerPadding = 240;
  const outerPadding = 180;
  const minRadius = ring.minRadius + innerPadding;
  const maxRadius = Math.max(minRadius + 180, ring.maxRadius - outerPadding);
  const t = Math.pow(rng.next(), 0.82);
  return minRadius + ((maxRadius - minRadius) * t);
}

function createRingClustersForSector(
  sector: GalaxySectorConfig,
  ringId: Exclude<GalaxyRingId, "deep-space">,
  systemCount: number,
  rng: SeededRandom,
): GalaxySystemCluster[] {
  const ring = getGalaxyRingByIdLocal(ringId);
  const clusterCount = systemCount >= 12 ? 3 : systemCount >= 6 ? 2 : 1;
  const clusters: GalaxySystemCluster[] = [];

  for (let index = 0; index < clusterCount; index += 1) {
    const spanMultiplier = ringId === "inner" ? 0.06 : ringId === "second" ? 0.08 : ringId === "third" ? 0.1 : 0.12;
    clusters.push({
      ringId,
      centerAngleDeg: pickAngleInSector(sector, rng),
      centerRadius: pickRadiusInRing(ring, rng),
      angularJitterDeg: 4.6 + (index * 0.85) + (spanMultiplier * 40),
      radialJitter: 440 + (ring.maxRadius - ring.minRadius) * spanMultiplier,
    });
  }

  return clusters;
}

function getSystemPlacementMinDistance(ringId: Exclude<GalaxyRingId, "deep-space">): number {
  return GALAXY_SYSTEM_MIN_DISTANCE_BY_RING[ringId];
}

function getPairwiseSystemPlacementDistance(
  ringId: Exclude<GalaxyRingId, "deep-space">,
  otherRingId: Exclude<GalaxyRingId, "deep-space">,
): number {
  return Math.max(getSystemPlacementMinDistance(ringId), getSystemPlacementMinDistance(otherRingId));
}

function canPlaceSystem(
  point: GalaxyPoint,
  ringId: Exclude<GalaxyRingId, "deep-space">,
  systems: GalaxySystemRecord[],
): boolean {
  return systems.every((system) => {
    const dx = system.x - point.x;
    const dy = system.y - point.y;
    const otherRingId = system.ringId === "deep-space" ? "outer" : system.ringId;
    const minimumDistance = getPairwiseSystemPlacementDistance(ringId, otherRingId);
    return (dx * dx) + (dy * dy) >= minimumDistance * minimumDistance;
  });
}

function getNearestSystemDistanceSq(point: GalaxyPoint, systems: GalaxySystemRecord[]): number {
  if (systems.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  systems.forEach((system) => {
    const dx = system.x - point.x;
    const dy = system.y - point.y;
    const distanceSq = (dx * dx) + (dy * dy);
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
    }
  });
  return nearestDistanceSq;
}

function createCandidateSystemPoint(
  sector: GalaxySectorConfig,
  ringId: Exclude<GalaxyRingId, "deep-space">,
  cluster: GalaxySystemCluster,
  systems: GalaxySystemRecord[],
  rng: SeededRandom,
): GalaxyPoint {
  const ring = getGalaxyRingByIdLocal(ringId);
  let bestCandidate: GalaxyPoint | null = null;
  let bestCandidateDistanceSq = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < 52; attempt += 1) {
    const angleDeg = clampAngleToSector(
      cluster.centerAngleDeg + rng.range(-cluster.angularJitterDeg, cluster.angularJitterDeg),
      sector,
    );
    const radius = Math.max(
      ring.minRadius + 220,
      Math.min(ring.maxRadius - 140, cluster.centerRadius + rng.range(-cluster.radialJitter, cluster.radialJitter)),
    );
    const point = pointFromDegrees(angleDeg, radius);
    if (
      getGalaxySectorAtPosition(point.x, point.y).id === sector.id
      && getGalaxyRingAtPosition(point.x, point.y).id === ringId
    ) {
      const nearestDistanceSq = getNearestSystemDistanceSq(point, systems);
      if (nearestDistanceSq > bestCandidateDistanceSq) {
        bestCandidate = point;
        bestCandidateDistanceSq = nearestDistanceSq;
      }
      if (canPlaceSystem(point, ringId, systems)) {
        return point;
      }
    }
  }

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = pointFromDegrees(pickAngleInSector(sector, rng), pickRadiusInRing(ring, rng));
    if (getGalaxySectorAtPosition(point.x, point.y).id !== sector.id || getGalaxyRingAtPosition(point.x, point.y).id !== ringId) {
      continue;
    }

    const nearestDistanceSq = getNearestSystemDistanceSq(point, systems);
    if (nearestDistanceSq > bestCandidateDistanceSq) {
      bestCandidate = point;
      bestCandidateDistanceSq = nearestDistanceSq;
    }
    if (canPlaceSystem(point, ringId, systems)) {
      return point;
    }
  }

  if (bestCandidate) {
    return bestCandidate;
  }

  return pointFromDegrees(getGalaxySectorMidAngleDeg(sector), pickRadiusInRing(ring, rng));
}

function buildSystemName(rng: SeededRandom, usedNames: Set<string>): string {
  return createProceduralName(rng, usedNames, GALAXY_SYSTEM_NAME_PARTS, 2, 3);
}

function buildPlanetName(rng: SeededRandom, usedNames: Set<string>): string {
  return createProceduralName(rng, usedNames, GALAXY_WORLD_NAME_PARTS, 2, 3);
}

function buildPlanetColor(sector: GalaxySectorConfig, rng: SeededRandom, orbitIndex: number): number {
  const baseMix = 0.18 + (orbitIndex * 0.08) + rng.range(0, 0.12);
  const accentMix = 0.1 + rng.range(0, 0.16);
  return interpolateColor(
    interpolateColor(sector.color, 0xffffff, Math.min(0.72, baseMix)),
    sector.borderColor,
    accentMix,
  );
}

function createPlanetsForSystem(
  system: GalaxySystemRecord,
  sector: GalaxySectorConfig,
  planets: GalaxyPlanetRecord[],
  rng: SeededRandom,
  usedPlanetNames: Set<string>,
): void {
  const planetCount = getPlanetCount(rng);
  const baseOrbit = 240 + rng.range(0, 90);

  for (let orbitIndex = 0; orbitIndex < planetCount; orbitIndex += 1) {
    const orbitDistance = baseOrbit + (orbitIndex * 190) + rng.range(-16, 32);
    const orbitBaseAngleDeg = rng.range(0, 360);
    const point = getOrbitPositionAtTime(
      system.x,
      system.y,
      orbitDistance,
      orbitBaseAngleDeg,
      1,
      GALAXY_PLANET_ORBIT_DEGREES_PER_SECOND,
      0,
    );

    const planetId = `${system.id}-planet-${orbitIndex + 1}`;
    const planet: GalaxyPlanetRecord = {
      id: planetId,
      systemId: system.id,
      starId: system.starId,
      sectorId: system.sectorId,
      ringId: system.ringId,
      orbitIndex,
      orbitRadius: Math.round(orbitDistance),
      orbitBaseAngleDeg,
      orbitSpeed: getPlanetOrbitSpeedForRadius(orbitDistance, planetId),
      name: buildPlanetName(rng, usedPlanetNames),
      x: Math.round(point.x),
      y: Math.round(point.y),
      radius: Math.round(92 + rng.range(0, 34) + (orbitIndex * 4)),
      color: buildPlanetColor(sector, rng, orbitIndex),
      moonIds: [],
      isHomeworld: false,
      homeworldRaceId: null,
      missionIds: [],
    };
    planets.push(planet);
    system.planetIds.push(planetId);
  }
}

function getNearestSystemDistanceForHomeworldCandidate(
  system: GalaxySystemRecord | undefined,
  systems: GalaxySystemRecord[],
): number {
  if (!system) {
    return 0;
  }

  return systems.reduce((nearestDistance, otherSystem) => {
    if (otherSystem.id === system.id || otherSystem.sectorId !== system.sectorId) {
      return nearestDistance;
    }
    const dx = otherSystem.x - system.x;
    const dy = otherSystem.y - system.y;
    return Math.min(nearestDistance, Math.sqrt((dx * dx) + (dy * dy)));
  }, Number.POSITIVE_INFINITY);
}

function getHomeworldIsolationPenalty(
  system: GalaxySystemRecord | undefined,
  systems: GalaxySystemRecord[],
): number {
  const nearestDistance = getNearestSystemDistanceForHomeworldCandidate(system, systems);
  if (!Number.isFinite(nearestDistance)) {
    return 0;
  }

  const thirdRingSpacing = getSystemPlacementMinDistance("third");
  const normalizedIsolation = clamp01((nearestDistance - thirdRingSpacing) / (thirdRingSpacing * 1.55));
  return (1 - normalizedIsolation) * 0.34;
}

function assignHomeworlds(
  planets: GalaxyPlanetRecord[],
  systems: GalaxySystemRecord[],
): GalaxyHomeworldRecord[] {
  const homeworlds: GalaxyHomeworldRecord[] = [];
  const thirdRing = getGalaxyRingByIdLocal("third");
  const systemsById = systems.reduce<Map<string, GalaxySystemRecord>>((lookup, system) => {
    lookup.set(system.id, system);
    return lookup;
  }, new Map());

  GALAXY_SECTORS.forEach((sector) => {
    const spec = GALAXY_HOMEWORLD_SPECS[sector.raceId];
    const candidates = planets.filter((planet) => (
      planet.sectorId === sector.id
      && planet.ringId === "third"
      && !planet.isHomeworld
    ));
    const fallbackCandidates = planets.filter((planet) => planet.sectorId === sector.id && !planet.isHomeworld);
    const safeCandidates = candidates.filter((planet) => {
      const angularMargin = getPlanetAngularMarginFromSectorEdge(planet, sector);
      const radialDistance = getGalaxyRadialDistance(planet.x, planet.y);
      return angularMargin >= getSectorInteriorMarginDegrees(sector)
        && radialDistance >= thirdRing.minRadius + GALAXY_HOMEWORLD_RING_EDGE_MARGIN
        && radialDistance <= thirdRing.maxRadius - GALAXY_HOMEWORLD_RING_EDGE_MARGIN;
    });
    const candidatePool = (safeCandidates.length > 0 ? safeCandidates : candidates.length > 0 ? candidates : fallbackCandidates)
      .slice()
      .sort((left, right) => {
        const leftScore = getHomeworldCandidateScore(left, sector)
          + getHomeworldIsolationPenalty(systemsById.get(left.systemId), systems);
        const rightScore = getHomeworldCandidateScore(right, sector)
          + getHomeworldIsolationPenalty(systemsById.get(right.systemId), systems);
        return leftScore - rightScore;
      });
    const homeworldPlanet = candidatePool[0] ?? fallbackCandidates[0];
    homeworldPlanet.isHomeworld = true;
    homeworldPlanet.homeworldRaceId = sector.raceId;
    homeworldPlanet.name = spec.name;
    homeworldPlanet.radius = Math.round(homeworldPlanet.radius * GALAXY_HOMEWORLD_RADIUS_SCALE);

    homeworlds.push({
      raceId: sector.raceId,
      sectorId: sector.id,
      systemId: homeworldPlanet.systemId,
      planetId: homeworldPlanet.id,
      name: spec.name,
      moonCount: spec.moonCount,
    });
  });

  return homeworlds;
}

function createMoonsForPlanets(
  planets: GalaxyPlanetRecord[],
  homeworlds: GalaxyHomeworldRecord[],
  moons: GalaxyMoonRecord[],
  rng: SeededRandom,
): void {
  const homeworldsByPlanetId = homeworlds.reduce<Record<string, GalaxyHomeworldRecord>>((lookup, homeworld) => {
    lookup[homeworld.planetId] = homeworld;
    return lookup;
  }, {});

  planets.forEach((planet) => {
    planet.moonIds = [];
    const homeworld = homeworldsByPlanetId[planet.id];
    const moonCount = homeworld
      ? homeworld.moonCount
      : rng.next() <= GALAXY_MOON_CHANCE
        ? getMoonCount(rng)
        : 0;

    for (let orbitIndex = 0; orbitIndex < moonCount; orbitIndex += 1) {
      const orbitDistance = planet.radius + 52 + (orbitIndex * 30) + rng.range(0, 10);
      const orbitBaseAngleDeg = rng.range(0, 360);
      const point = getOrbitPositionAtTime(
        planet.x,
        planet.y,
        orbitDistance,
        orbitBaseAngleDeg,
        1,
        GALAXY_MOON_ORBIT_DEGREES_PER_SECOND,
        0,
      );
      const moon: GalaxyMoonRecord = {
        id: `${planet.id}-moon-${orbitIndex + 1}`,
        planetId: planet.id,
        systemId: planet.systemId,
        sectorId: planet.sectorId,
        ringId: planet.ringId,
        orbitIndex,
        orbitRadius: Math.round(orbitDistance),
        orbitBaseAngleDeg,
        orbitSpeed: getMoonOrbitSpeedForRadius(orbitDistance, `${planet.id}-moon-${orbitIndex + 1}`),
        name: `${planet.name} ${String.fromCharCode(65 + orbitIndex)}`,
        x: Math.round(point.x),
        y: Math.round(point.y),
        radius: Math.round(28 + rng.range(0, 10)),
        color: interpolateColor(planet.color, 0xffffff, 0.3 + rng.range(0, 0.2)),
      };
      moons.push(moon);
      planet.moonIds.push(moon.id);
    }
  });
}

function assignMissionTargets(
  planets: GalaxyPlanetRecord[],
  rng: SeededRandom,
): Record<string, string> {
  const assignments: Record<string, string> = {};
  const assignedPlanetIds = new Set<string>();

  GALAXY_MISSION_ASSIGNMENT_RULES.forEach((rule) => {
    const preferredCandidates = planets.filter((planet) => (
      !planet.isHomeworld
      && !assignedPlanetIds.has(planet.id)
      && planet.sectorId === rule.preferredSectorId
      && rule.preferredRingIds.includes(planet.ringId)
    ));
    const sectorCandidates = planets.filter((planet) => (
      !planet.isHomeworld
      && !assignedPlanetIds.has(planet.id)
      && planet.sectorId === rule.preferredSectorId
    ));
    const fallbackCandidates = planets.filter((planet) => !planet.isHomeworld && !assignedPlanetIds.has(planet.id));
    const candidatePool = preferredCandidates.length > 0
      ? preferredCandidates
      : sectorCandidates.length > 0
        ? sectorCandidates
        : fallbackCandidates;
    const selected = candidatePool[rng.int(0, candidatePool.length - 1)];
    assignments[rule.missionId] = selected.id;
    selected.missionIds.push(rule.missionId);
    assignedPlanetIds.add(selected.id);
  });

  return assignments;
}

function roundZoneCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function getZoneAnchorWeight(
  system: GalaxySystemRecord,
  sectorSystems: GalaxySystemRecord[],
  homeworldSystemIds: Set<string>,
  weightFactor = GALAXY_PRIME_WORLD_ZONE_WEIGHT_FACTOR,
): number {
  if (!homeworldSystemIds.has(system.id)) {
    return 0;
  }

  const nearestDistanceSq = sectorSystems.reduce((nearest, otherSystem) => {
    if (otherSystem.id === system.id) {
      return nearest;
    }
    const dx = otherSystem.x - system.x;
    const dy = otherSystem.y - system.y;
    return Math.min(nearest, (dx * dx) + (dy * dy));
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(nearestDistanceSq)) {
    return 0;
  }

  return Math.round(nearestDistanceSq * weightFactor);
}

function getSectorPolygonPointObjects(sector: GalaxySectorConfig): GalaxyPoint[] {
  const polygon = getGalaxySectorPolygonPoints(sector, GALAXY_ZONE_POLYGON_STEPS);
  const points: GalaxyPoint[] = [];
  for (let index = 0; index < polygon.length; index += 2) {
    points.push({
      x: polygon[index],
      y: polygon[index + 1],
    });
  }
  return points;
}

function normalizeZonePolygonPoints(points: GalaxyPoint[]): GalaxyPoint[] {
  if (points.length <= 0) {
    return [];
  }

  const normalized: GalaxyPoint[] = [];
  points.forEach((point) => {
    const roundedPoint = {
      x: roundZoneCoordinate(point.x),
      y: roundZoneCoordinate(point.y),
    };
    const previous = normalized[normalized.length - 1];
    if (!previous || Math.abs(previous.x - roundedPoint.x) > GALAXY_ZONE_CLIP_EPSILON || Math.abs(previous.y - roundedPoint.y) > GALAXY_ZONE_CLIP_EPSILON) {
      normalized.push(roundedPoint);
    }
  });

  if (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (Math.abs(first.x - last.x) <= GALAXY_ZONE_CLIP_EPSILON && Math.abs(first.y - last.y) <= GALAXY_ZONE_CLIP_EPSILON) {
      normalized.pop();
    }
  }

  return normalized;
}

function isPointInsideHalfPlane(
  point: GalaxyPoint,
  normalX: number,
  normalY: number,
  constant: number,
): boolean {
  return ((normalX * point.x) + (normalY * point.y)) <= constant + GALAXY_ZONE_CLIP_EPSILON;
}

function getHalfPlaneIntersectionPoint(
  start: GalaxyPoint,
  end: GalaxyPoint,
  normalX: number,
  normalY: number,
  constant: number,
): GalaxyPoint {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const denominator = (normalX * deltaX) + (normalY * deltaY);
  if (Math.abs(denominator) <= GALAXY_ZONE_CLIP_EPSILON) {
    return { x: end.x, y: end.y };
  }

  const startValue = (normalX * start.x) + (normalY * start.y);
  const t = (constant - startValue) / denominator;
  return {
    x: start.x + (deltaX * t),
    y: start.y + (deltaY * t),
  };
}

function clipPolygonAgainstHalfPlane(
  polygon: GalaxyPoint[],
  normalX: number,
  normalY: number,
  constant: number,
): GalaxyPoint[] {
  if (polygon.length < 3) {
    return [];
  }

  const clipped: GalaxyPoint[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = isPointInsideHalfPlane(current, normalX, normalY, constant);
    const nextInside = isPointInsideHalfPlane(next, normalX, normalY, constant);

    if (currentInside && nextInside) {
      clipped.push(next);
      continue;
    }

    if (currentInside && !nextInside) {
      clipped.push(getHalfPlaneIntersectionPoint(current, next, normalX, normalY, constant));
      continue;
    }

    if (!currentInside && nextInside) {
      clipped.push(getHalfPlaneIntersectionPoint(current, next, normalX, normalY, constant));
      clipped.push(next);
    }
  }

  return normalizeZonePolygonPoints(clipped);
}

function isPointOnZoneSegment(point: GalaxyPoint, start: GalaxyPoint, end: GalaxyPoint): boolean {
  const cross = ((point.y - start.y) * (end.x - start.x)) - ((point.x - start.x) * (end.y - start.y));
  if (Math.abs(cross) > 0.001) {
    return false;
  }

  const dot = ((point.x - start.x) * (end.x - start.x)) + ((point.y - start.y) * (end.y - start.y));
  if (dot < -0.001) {
    return false;
  }

  const squaredLength = ((end.x - start.x) * (end.x - start.x)) + ((end.y - start.y) * (end.y - start.y));
  return dot <= squaredLength + 0.001;
}

function isPointInsideZonePolygon(point: GalaxyPoint, polygon: GalaxyPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (isPointOnZoneSegment(point, previousPoint, currentPoint)) {
      return true;
    }

    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < (((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 0.000001)) + currentPoint.x);
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function buildZoneTerritoryPolygon(
  system: GalaxySystemRecord,
  sectorSystems: GalaxySystemRecord[],
  sectorPolygon: GalaxyPoint[],
  zoneAnchorWeights: Map<string, number>,
): GalaxyPoint[] {
  const anchorWeight = zoneAnchorWeights.get(system.id) ?? 0;
  let polygon = sectorPolygon.map((point) => ({ ...point }));

  sectorSystems.forEach((otherSystem) => {
    if (otherSystem.id === system.id) {
      return;
    }

    const otherWeight = zoneAnchorWeights.get(otherSystem.id) ?? 0;
    const normalX = 2 * (otherSystem.x - system.x);
    const normalY = 2 * (otherSystem.y - system.y);
    const constant = (
      (otherSystem.x * otherSystem.x)
      + (otherSystem.y * otherSystem.y)
      - (system.x * system.x)
      - (system.y * system.y)
      + anchorWeight
      - otherWeight
    );
    polygon = clipPolygonAgainstHalfPlane(polygon, normalX, normalY, constant);
  });

  return normalizeZonePolygonPoints(polygon);
}

function createZonesForSystems(
  systems: GalaxySystemRecord[],
  homeworlds: GalaxyHomeworldRecord[],
): GalaxyZoneRecord[] {
  const homeworldSystemIds = new Set(homeworlds.map((homeworld) => homeworld.systemId));
  const systemsBySectorId = systems.reduce<Map<string, GalaxySystemRecord[]>>((lookup, system) => {
    const bucket = lookup.get(system.sectorId);
    if (bucket) {
      bucket.push(system);
      return lookup;
    }
    lookup.set(system.sectorId, [system]);
    return lookup;
  }, new Map());

  const zoneGeometryBySystemId = new Map<string, Pick<GalaxyZoneRecord, "territoryPoints" | "anchorWeight" | "isPrimeWorldZone">>();
  GALAXY_SECTORS.forEach((sector) => {
    const sectorSystems = systemsBySectorId.get(sector.id) ?? [];
    if (sectorSystems.length <= 0) {
      return;
    }

    const sectorPolygon = getSectorPolygonPointObjects(sector);
    const zoneAnchorWeights = new Map<string, number>();
    const sectorZoneGeometry = new Map<string, Pick<GalaxyZoneRecord, "territoryPoints" | "anchorWeight" | "isPrimeWorldZone">>();
    let weightFactor = GALAXY_PRIME_WORLD_ZONE_WEIGHT_FACTOR;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      zoneAnchorWeights.clear();
      sectorZoneGeometry.clear();
      sectorSystems.forEach((system) => {
        zoneAnchorWeights.set(system.id, getZoneAnchorWeight(system, sectorSystems, homeworldSystemIds, weightFactor));
      });
      sectorSystems.forEach((system) => {
        const territoryPoints = buildZoneTerritoryPolygon(system, sectorSystems, sectorPolygon, zoneAnchorWeights);
        sectorZoneGeometry.set(system.id, {
          territoryPoints,
          anchorWeight: zoneAnchorWeights.get(system.id) ?? 0,
          isPrimeWorldZone: homeworldSystemIds.has(system.id),
        });
      });

      const allAnchorsContained = sectorSystems.every((system) => {
        const territoryPoints = sectorZoneGeometry.get(system.id)?.territoryPoints ?? [];
        return territoryPoints.length >= 3 && isPointInsideZonePolygon(system, territoryPoints);
      });

      if (allAnchorsContained) {
        break;
      }

      weightFactor *= 0.72;
    }

    sectorZoneGeometry.forEach((geometry, systemId) => {
      zoneGeometryBySystemId.set(systemId, geometry);
    });
  });

  return systems.map((system) => {
    const sector = getGalaxySectorById(system.sectorId) ?? GALAXY_SECTORS[0];
    const zoneGeometry = zoneGeometryBySystemId.get(system.id);
    return {
      id: system.zoneId,
      systemId: system.id,
      sectorId: system.sectorId,
      coreSectorId: system.sectorId,
      ringId: system.ringId,
      territoryPoints: zoneGeometry?.territoryPoints ?? [],
      anchorWeight: zoneGeometry?.anchorWeight ?? 0,
      isPrimeWorldZone: zoneGeometry?.isPrimeWorldZone ?? false,
      currentControllerId: sector.raceId,
      zoneState: "stable",
      zoneCaptureProgress: 0,
    };
  });
}

function createSectorSystems(
  sector: GalaxySectorConfig,
  sectorIndex: number,
  systems: GalaxySystemRecord[],
  planets: GalaxyPlanetRecord[],
  rng: SeededRandom,
  usedSystemNames: Set<string>,
  usedPlanetNames: Set<string>,
): void {
  const systemCount = rng.int(20, 40);
  const ringCounts = allocateRingSystemCounts(systemCount, rng);
  const ringClusters = ACTIVE_SYSTEM_RING_IDS.reduce<Record<string, GalaxySystemCluster[]>>((lookup, ringId) => {
    lookup[ringId] = createRingClustersForSector(sector, ringId, ringCounts[ringId], rng);
    return lookup;
  }, {});

  let sectorSystemIndex = 0;
  ACTIVE_SYSTEM_RING_IDS.forEach((ringId) => {
    for (let ringSystemIndex = 0; ringSystemIndex < ringCounts[ringId]; ringSystemIndex += 1) {
      const clusterPool = ringClusters[ringId];
      const cluster = clusterPool[rng.int(0, clusterPool.length - 1)];
      const point = createCandidateSystemPoint(sector, ringId, cluster, systems, rng);
      const systemId = `system-${sectorIndex + 1}-${sectorSystemIndex + 1}`;
      const system: GalaxySystemRecord = {
        id: systemId,
        name: buildSystemName(rng, usedSystemNames),
        sectorId: sector.id,
        ringId,
        zoneId: `${systemId}-zone`,
        starId: `${systemId}-star`,
        x: Math.round(point.x),
        y: Math.round(point.y),
        starColor: interpolateColor(
          interpolateColor(sector.color, sector.borderColor, 0.72),
          0xfff7eb,
          0.16 + rng.range(0, 0.1),
        ),
        starSize: 2.2 + rng.range(0, 1.8),
        planetIds: [],
      };
      systems.push(system);
      createPlanetsForSystem(system, sector, planets, rng, usedPlanetNames);
      sectorSystemIndex += 1;
    }
  });
}

export function createGalaxySeed(random: () => number = Math.random): number {
  return Math.floor(random() * 0xffff_ffff) >>> 0;
}

export function createGalaxyDefinition(seed = createGalaxySeed()): GalaxyDefinition {
  const rng = new SeededRandom(seed);
  const systems: GalaxySystemRecord[] = [];
  const planets: GalaxyPlanetRecord[] = [];
  const usedSystemNames = new Set<string>();
  const usedPlanetNames = new Set<string>(Object.values(GALAXY_HOMEWORLD_SPECS).map((spec) => spec.name));

  GALAXY_SECTORS.forEach((sector, sectorIndex) => {
    createSectorSystems(sector, sectorIndex, systems, planets, rng, usedSystemNames, usedPlanetNames);
  });

  const homeworlds = assignHomeworlds(planets, systems);
  const zones = createZonesForSystems(systems, homeworlds);
  const moons: GalaxyMoonRecord[] = [];
  createMoonsForPlanets(planets, homeworlds, moons, rng);
  const stations = createStationsForSectors(systems, new SeededRandom((seed ^ GALAXY_STATION_SEED_SALT) >>> 0));
  const missionAssignments = assignMissionTargets(planets, rng);

  return {
    seed,
    rings: GALAXY_RINGS.map((ring) => ({ ...ring })),
    systems,
    zones,
    planets,
    moons,
    homeworlds,
    stations,
    missionAssignments,
  };
}

function isGalaxyDefinitionLike(value: Partial<GalaxyDefinition> | undefined): value is GalaxyDefinition {
  return Boolean(
    value
    && typeof value.seed === "number"
    && Array.isArray(value.rings)
    && Array.isArray(value.systems)
    && Array.isArray(value.planets)
    && Array.isArray(value.moons)
    && Array.isArray(value.homeworlds)
    && typeof value.missionAssignments === "object"
    && value.missionAssignments !== null,
  );
}

function isGalaxyZoneControllerId(value: unknown): value is GalaxyZoneControllerId {
  return typeof value === "string"
    && (
      value === "empire"
      || value === "republic"
      || value === "inactive"
      || GALAXY_SECTORS.some((sector) => sector.raceId === value)
    );
}

function normalizeGalaxyZoneState(value: unknown): GalaxyZoneState {
  if (value === "capturing" || value === "contested") {
    return value;
  }
  return "stable";
}

export function normalizeGalaxyDefinition(
  galaxy: Partial<GalaxyDefinition> | undefined,
  fallbackSeed?: number,
): GalaxyDefinition {
  if (isGalaxyDefinitionLike(galaxy)) {
    const homeworlds = galaxy.homeworlds.map((homeworld) => ({ ...homeworld }));
    const systems = galaxy.systems.map((system) => ({
      ...system,
      zoneId: typeof system.zoneId === "string" && system.zoneId.length > 0
        ? system.zoneId
        : `${system.id}-zone`,
      planetIds: [...system.planetIds],
    }));
    const systemsById = systems.reduce<Map<string, GalaxySystemRecord>>((lookup, system) => {
      lookup.set(system.id, system);
      return lookup;
    }, new Map());
    const generatedZones = createZonesForSystems(systems, homeworlds);
    const sourceZones = Array.isArray(galaxy.zones) ? galaxy.zones : [];
    const planets = galaxy.planets.map((planet) => {
      const system = systemsById.get(planet.systemId);
      const fallbackOrbitRadius = system
        ? Math.max(160, Math.round(Math.hypot(planet.x - system.x, planet.y - system.y)))
        : Math.max(160, 240 + (planet.orbitIndex * 190));
      const fallbackOrbitAngleDeg = system
        ? getAngleDegreesBetweenPoints(system.x, system.y, planet.x, planet.y)
        : normalizeAngleDegrees(planet.orbitIndex * 90);
      return {
        ...planet,
        orbitRadius: getNormalizedOrbitRadius(planet.orbitRadius, fallbackOrbitRadius),
        orbitBaseAngleDeg: getNormalizedOrbitBaseAngleDeg(planet.orbitBaseAngleDeg, fallbackOrbitAngleDeg),
        orbitSpeed: getNormalizedOrbitSpeed(
          planet.orbitSpeed,
          getPlanetOrbitSpeedForRadius(
            getNormalizedOrbitRadius(planet.orbitRadius, fallbackOrbitRadius),
            planet.id,
          ),
        ),
        moonIds: [...planet.moonIds],
        missionIds: [...planet.missionIds],
      };
    });
    const planetsById = planets.reduce<Map<string, GalaxyPlanetRecord>>((lookup, planet) => {
      lookup.set(planet.id, planet);
      return lookup;
    }, new Map());
    const zones = systems.map((system) => {
      const fallbackZone = generatedZones.find((zone) => zone.systemId === system.id) ?? {
        id: system.zoneId,
        systemId: system.id,
        sectorId: system.sectorId,
        coreSectorId: system.sectorId,
        ringId: system.ringId,
        territoryPoints: [],
        anchorWeight: 0,
        isPrimeWorldZone: false,
        currentControllerId: (getGalaxySectorById(system.sectorId) ?? GALAXY_SECTORS[0]).raceId,
        zoneState: "stable" as const,
        zoneCaptureProgress: 0,
      };
      const sourceZone = sourceZones.find((zone) => zone.systemId === system.id || zone.id === system.zoneId);
      return {
        id: system.zoneId,
        systemId: system.id,
        sectorId: system.sectorId,
        coreSectorId: typeof sourceZone?.coreSectorId === "string" && sourceZone.coreSectorId.length > 0
          ? sourceZone.coreSectorId
          : fallbackZone.coreSectorId,
        ringId: system.ringId,
        territoryPoints: Array.isArray(sourceZone?.territoryPoints) && sourceZone.territoryPoints.length >= 3
          ? normalizeZonePolygonPoints(sourceZone.territoryPoints)
          : fallbackZone.territoryPoints,
        anchorWeight: typeof sourceZone?.anchorWeight === "number" && Number.isFinite(sourceZone.anchorWeight)
          ? sourceZone.anchorWeight
          : fallbackZone.anchorWeight,
        isPrimeWorldZone: typeof sourceZone?.isPrimeWorldZone === "boolean"
          ? sourceZone.isPrimeWorldZone
          : fallbackZone.isPrimeWorldZone,
        currentControllerId: isGalaxyZoneControllerId(sourceZone?.currentControllerId)
          ? sourceZone.currentControllerId
          : fallbackZone.currentControllerId,
        zoneState: normalizeGalaxyZoneState(sourceZone?.zoneState),
        zoneCaptureProgress: typeof sourceZone?.zoneCaptureProgress === "number" && Number.isFinite(sourceZone.zoneCaptureProgress)
          ? Math.max(0, Math.min(1, sourceZone.zoneCaptureProgress))
          : 0,
      };
    });
    return {
      seed: galaxy.seed,
      rings: galaxy.rings.map((ring) => ({ ...ring })),
      systems,
      zones,
      planets,
      moons: galaxy.moons.map((moon) => {
        const planet = planetsById.get(moon.planetId);
        const fallbackOrbitRadius = planet
          ? Math.max(56, Math.round(Math.hypot(moon.x - planet.x, moon.y - planet.y)))
          : Math.max(56, 110 + (moon.orbitIndex * 30));
        const fallbackOrbitAngleDeg = planet
          ? getAngleDegreesBetweenPoints(planet.x, planet.y, moon.x, moon.y)
          : normalizeAngleDegrees(moon.orbitIndex * 120);
        return {
          ...moon,
          orbitRadius: getNormalizedOrbitRadius(moon.orbitRadius, fallbackOrbitRadius),
          orbitBaseAngleDeg: getNormalizedOrbitBaseAngleDeg(moon.orbitBaseAngleDeg, fallbackOrbitAngleDeg),
          orbitSpeed: getNormalizedOrbitSpeed(
            moon.orbitSpeed,
            getMoonOrbitSpeedForRadius(
              getNormalizedOrbitRadius(moon.orbitRadius, fallbackOrbitRadius),
              moon.id,
            ),
          ),
        };
      }),
      homeworlds,
      stations: Array.isArray(galaxy.stations) && galaxy.stations.length > 0
        ? galaxy.stations.map((station) => ({ ...station }))
        : createStationsForSectors(systems, new SeededRandom((galaxy.seed ^ GALAXY_STATION_SEED_SALT) >>> 0)),
      missionAssignments: { ...galaxy.missionAssignments },
    };
  }

  return createGalaxyDefinition(fallbackSeed);
}

export function clampPointToGalaxyBounds(x: number, y: number, padding = 0): GalaxyPoint {
  const edgePadding = Math.max(0, padding);
  return {
    x: Math.max(edgePadding, Math.min(GALAXY_WORLD_CONFIG.width - edgePadding, x)),
    y: Math.max(edgePadding, Math.min(GALAXY_WORLD_CONFIG.height - edgePadding, y)),
  };
}

export function getGalaxyRadialDistance(x: number, y: number): number {
  const dx = x - GALAXY_WORLD_CONFIG.center.x;
  const dy = (y - GALAXY_WORLD_CONFIG.center.y) / GALAXY_WORLD_CONFIG.verticalScale;
  return Math.sqrt((dx * dx) + (dy * dy));
}

export function getGalaxyRingAtDistance(distance: number): GalaxyRingConfig {
  return GALAXY_RINGS.find((ring) => distance >= ring.minRadius && distance <= ring.maxRadius) ?? GALAXY_RINGS[GALAXY_RINGS.length - 1];
}

export function getGalaxyRingAtPosition(x: number, y: number): GalaxyRingConfig {
  return getGalaxyRingAtDistance(getGalaxyRadialDistance(x, y));
}

export function isPointWithinGalaxyBody(x: number, y: number, padding = 0): boolean {
  return getGalaxyRadialDistance(x, y) <= Math.max(0, GALAXY_WORLD_CONFIG.radius - padding);
}

export function isPointWithinGalaxyCoreRestriction(x: number, y: number, padding = 0): boolean {
  return getGalaxyRadialDistance(x, y) < GALAXY_WORLD_CONFIG.restrictedCoreRadius + padding;
}

export function clampPointOutsideGalaxyCore(x: number, y: number, padding = 0): GalaxyPoint {
  const clamped = clampPointToGalaxyBounds(x, y, padding);
  const dx = clamped.x - GALAXY_WORLD_CONFIG.center.x;
  const dy = (clamped.y - GALAXY_WORLD_CONFIG.center.y) / GALAXY_WORLD_CONFIG.verticalScale;
  const radialDistance = Math.sqrt((dx * dx) + (dy * dy));
  const minimumRadius = GALAXY_WORLD_CONFIG.restrictedCoreRadius + padding;
  if (radialDistance >= minimumRadius) {
    return clamped;
  }

  const angleRad = radialDistance > 0.0001 ? Math.atan2(dy, dx) : 0;
  return clampPointToGalaxyBounds(
    GALAXY_WORLD_CONFIG.center.x + Math.cos(angleRad) * minimumRadius,
    GALAXY_WORLD_CONFIG.center.y + Math.sin(angleRad) * minimumRadius * GALAXY_WORLD_CONFIG.verticalScale,
    padding,
  );
}

export function clampPointToGalaxyTravelBounds(x: number, y: number, padding = 0): GalaxyPoint {
  const clamped = clampPointToGalaxyBounds(x, y, padding);
  return clampPointOutsideGalaxyCore(clamped.x, clamped.y, padding);
}

export function getGalaxySectorById(sectorId: string): GalaxySectorConfig | null {
  return GALAXY_SECTORS.find((sector) => sector.id === sectorId) ?? null;
}

export function getGalaxySectorByRace(raceId: RaceId): GalaxySectorConfig {
  return GALAXY_SECTORS.find((sector) => sector.raceId === raceId) ?? GALAXY_SECTORS[0];
}

export function getGalaxySectorAtPosition(x: number, y: number): GalaxySectorConfig {
  const angleDeg = getGalaxyAngleDeg(x, y);
  const matching = GALAXY_SECTORS.find((sector) => {
    const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
    let candidate = angleDeg;
    if (candidate < start) {
      candidate += 360;
    }
    return candidate >= start && candidate <= end;
  });

  return matching ?? GALAXY_SECTORS[0];
}

export function isGalaxyDeepSpaceAtPosition(x: number, y: number): boolean {
  return getGalaxyRingAtPosition(x, y).id === "deep-space";
}

export function getGalaxyRegionLabelAtPosition(x: number, y: number): string {
  return isGalaxyDeepSpaceAtPosition(x, y)
    ? "Deep space"
    : getGalaxySectorAtPosition(x, y).label;
}

export function getGalaxySectorMidAngleDeg(sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  return wrapAngleDegrees((start + end) * 0.5);
}

function getGalaxyHomeworldSpawnPoint(
  galaxy: GalaxyDefinition | null | undefined,
  raceId: RaceId,
): GalaxyPoint | null {
  const homeworld = getGalaxyHomeworldByRace(galaxy, raceId);
  if (!galaxy || !homeworld) {
    return null;
  }

  const system = getGalaxySystemById(galaxy, homeworld.systemId);
  const planet = getGalaxyPlanetById(galaxy, homeworld.planetId);
  if (!system || !planet) {
    return null;
  }

  const spawnAngleDeg = normalizeAngleDegrees(planet.orbitBaseAngleDeg + 180);
  const spawnDistance = Math.max(420, Math.min(680, planet.orbitRadius * 0.72));
  const spawnAngleRad = spawnAngleDeg * (Math.PI / 180);
  return clampPointToGalaxyTravelBounds(
    Math.round(system.x + (Math.cos(spawnAngleRad) * spawnDistance)),
    Math.round(system.y + (Math.sin(spawnAngleRad) * spawnDistance)),
    180,
  );
}

export function getGalaxySpawnPointForRace(raceId: RaceId, galaxy?: GalaxyDefinition | null): GalaxyPoint {
  const homeworldSpawn = getGalaxyHomeworldSpawnPoint(galaxy, raceId);
  if (homeworldSpawn) {
    return homeworldSpawn;
  }

  const sector = getGalaxySectorByRace(raceId);
  return pointFromDegrees(getGalaxySectorMidAngleDeg(sector), GALAXY_WORLD_CONFIG.raceSpawnRadius);
}

export function getDefaultGalaxySpawnPoint(galaxy?: GalaxyDefinition | null): GalaxyPoint {
  return getGalaxySpawnPointForRace(DEFAULT_PLAYER_RACE_ID, galaxy);
}

export function getGalaxySectorPolygonPoints(sector: GalaxySectorConfig, steps = 18): number[] {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const points: number[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const angleDeg = start + ((end - start) * (step / steps));
    const point = pointFromDegrees(angleDeg, sector.outerRadius);
    points.push(point.x, point.y);
  }

  for (let step = steps; step >= 0; step -= 1) {
    const angleDeg = start + ((end - start) * (step / steps));
    const point = pointFromDegrees(angleDeg, sector.innerRadius);
    points.push(point.x, point.y);
  }

  return points;
}

export function getGalaxySectorLabelPoint(sector: GalaxySectorConfig): GalaxyPoint {
  return pointFromDegrees(getGalaxySectorMidAngleDeg(sector), sector.labelRadius);
}

export function getGalaxySystemById(galaxy: GalaxyDefinition | null | undefined, systemId: string): GalaxySystemRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.systems.find((system) => system.id === systemId) ?? null;
}

export function getGalaxyPlanetById(galaxy: GalaxyDefinition | null | undefined, planetId: string): GalaxyPlanetRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.planets.find((planet) => planet.id === planetId) ?? null;
}

export function getGalaxyMoonById(galaxy: GalaxyDefinition | null | undefined, moonId: string): GalaxyMoonRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.moons.find((moon) => moon.id === moonId) ?? null;
}

export function getGalaxyStationById(galaxy: GalaxyDefinition | null | undefined, stationId: string): GalaxyStationRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.stations.find((station) => station.id === stationId) ?? null;
}

export function getGalaxyZoneById(galaxy: GalaxyDefinition | null | undefined, zoneId: string): GalaxyZoneRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.zones.find((zone) => zone.id === zoneId) ?? null;
}

export function getGalaxyZoneBySystemId(galaxy: GalaxyDefinition | null | undefined, systemId: string): GalaxyZoneRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.zones.find((zone) => zone.systemId === systemId) ?? null;
}

export function getGalaxyControllerPalette(
  controllerId: GalaxyZoneControllerId,
  coreSectorId?: string,
): GalaxyControllerPalette {
  const sectorController = GALAXY_SECTORS.find((sector) => sector.raceId === controllerId);
  if (sectorController) {
    return {
      color: sectorController.color,
      borderColor: sectorController.borderColor,
      label: sectorController.label,
    };
  }

  const specialPalette = GALAXY_SPECIAL_CONTROLLER_PALETTES[controllerId as Exclude<GalaxyZoneControllerId, RaceId>];
  if (specialPalette) {
    return specialPalette;
  }

  const fallbackSector = getGalaxySectorById(coreSectorId ?? "") ?? GALAXY_SECTORS[0];
  return {
    color: fallbackSector.color,
    borderColor: fallbackSector.borderColor,
    label: fallbackSector.label,
  };
}

export function getGalaxyHomeworldByRace(
  galaxy: GalaxyDefinition | null | undefined,
  raceId: RaceId,
): GalaxyHomeworldRecord | null {
  if (!galaxy) {
    return null;
  }
  return galaxy.homeworlds.find((homeworld) => homeworld.raceId === raceId) ?? null;
}

export function getGalaxyHomeworldPlanets(galaxy: GalaxyDefinition | null | undefined): GalaxyPlanetRecord[] {
  if (!galaxy) {
    return [];
  }
  return galaxy.planets.filter((planet) => planet.isHomeworld);
}

export function getGalaxyPlanetPositionAtTime(
  galaxy: GalaxyDefinition | null | undefined,
  planet: GalaxyPlanetRecord,
  orbitTimeMs = 0,
): GalaxyPoint {
  const system = getGalaxySystemById(galaxy, planet.systemId);
  if (!system) {
    return { x: planet.x, y: planet.y };
  }

  return getOrbitPositionAtTime(
    system.x,
    system.y,
    planet.orbitRadius,
    planet.orbitBaseAngleDeg,
    planet.orbitSpeed,
    GALAXY_PLANET_ORBIT_DEGREES_PER_SECOND,
    orbitTimeMs,
  );
}

export function getGalaxyMoonPositionAtTime(
  galaxy: GalaxyDefinition | null | undefined,
  moon: GalaxyMoonRecord,
  orbitTimeMs = 0,
): GalaxyPoint {
  const planet = getGalaxyPlanetById(galaxy, moon.planetId);
  if (!planet) {
    return { x: moon.x, y: moon.y };
  }

  const planetPosition = getGalaxyPlanetPositionAtTime(galaxy, planet, orbitTimeMs);
  return getOrbitPositionAtTime(
    planetPosition.x,
    planetPosition.y,
    moon.orbitRadius,
    moon.orbitBaseAngleDeg,
    moon.orbitSpeed,
    GALAXY_MOON_ORBIT_DEGREES_PER_SECOND,
    orbitTimeMs,
  );
}

export function getMissionPlanetForMission(
  missionId: string | null | undefined,
  galaxy: GalaxyDefinition | null | undefined,
  orbitTimeMs = 0,
): GalaxyMissionPlanet | null {
  if (!missionId || !galaxy) {
    return null;
  }

  const planetId = galaxy.missionAssignments[missionId];
  const planet = getGalaxyPlanetById(galaxy, planetId);
  if (!planet) {
    return null;
  }

  return {
    ...planet,
    ...getGalaxyPlanetPositionAtTime(galaxy, planet, orbitTimeMs),
    missionId,
  };
}
