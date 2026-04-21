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

export type GalaxySystemRecord = {
  id: string;
  name: string;
  sectorId: string;
  ringId: GalaxyRingId;
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

export type GalaxyMissionPlanet = GalaxyPlanetRecord & {
  missionId: string;
};

export type GalaxyDefinition = {
  seed: number;
  rings: GalaxyRingConfig[];
  systems: GalaxySystemRecord[];
  planets: GalaxyPlanetRecord[];
  moons: GalaxyMoonRecord[];
  homeworlds: GalaxyHomeworldRecord[];
  missionAssignments: Record<string, string>;
};

type GalaxyHomeworldSpec = {
  name: string;
  moonCount: number;
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
const GALAXY_SYSTEM_MIN_DISTANCE = 1080;
const GALAXY_MOON_CHANCE = 0.54;
const GALAXY_HOMEWORLD_RADIUS_SCALE = 1.24;

const GALAXY_HOMEWORLD_SPECS: Record<RaceId, GalaxyHomeworldSpec> = {
  nevari: { name: "Nevaeh", moonCount: 1 },
  olydran: { name: "Olympos", moonCount: 1 },
  aaruian: { name: "A\u2019aru", moonCount: 2 },
  rakkan: { name: "Nar\u2019Akka", moonCount: 0 },
  svarin: { name: "Svaria", moonCount: 1 },
  ashari: { name: "Averna", moonCount: 1 },
  elsari: { name: "Elysiem", moonCount: 0 },
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

function sanitizeSectorToken(sector: GalaxySectorConfig): string {
  return sector.label.split(" ")[0] ?? sector.id;
}

function toRomanNumeral(value: number): string {
  const numerals = ["I", "II", "III", "IV", "V", "VI"] as const;
  return numerals[Math.max(0, Math.min(numerals.length - 1, value - 1))] ?? `${value}`;
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
  let candidate = wrapAngleDegrees(angleDeg);
  if (candidate < start) {
    candidate += 360;
  }
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

function canPlaceSystem(point: GalaxyPoint, systems: GalaxySystemRecord[]): boolean {
  return systems.every((system) => {
    const dx = system.x - point.x;
    const dy = system.y - point.y;
    return (dx * dx) + (dy * dy) >= GALAXY_SYSTEM_MIN_DISTANCE * GALAXY_SYSTEM_MIN_DISTANCE;
  });
}

function createCandidateSystemPoint(
  sector: GalaxySectorConfig,
  ringId: Exclude<GalaxyRingId, "deep-space">,
  cluster: GalaxySystemCluster,
  systems: GalaxySystemRecord[],
  rng: SeededRandom,
): GalaxyPoint {
  const ring = getGalaxyRingByIdLocal(ringId);

  for (let attempt = 0; attempt < 36; attempt += 1) {
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
      && canPlaceSystem(point, systems)
    ) {
      return point;
    }
  }

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const point = pointFromDegrees(pickAngleInSector(sector, rng), pickRadiusInRing(ring, rng));
    if (canPlaceSystem(point, systems)) {
      return point;
    }
  }

  return pointFromDegrees(getGalaxySectorMidAngleDeg(sector), pickRadiusInRing(ring, rng));
}

function buildSystemName(sector: GalaxySectorConfig, index: number): string {
  return `${sanitizeSectorToken(sector)}-${index.toString().padStart(2, "0")}`;
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
): void {
  const planetCount = getPlanetCount(rng);
  const baseOrbit = 240 + rng.range(0, 90);

  for (let orbitIndex = 0; orbitIndex < planetCount; orbitIndex += 1) {
    const orbitDistance = baseOrbit + (orbitIndex * 190) + rng.range(-16, 32);
    const orbitAngle = rng.range(0, Math.PI * 2);
    const point = {
      x: system.x + Math.cos(orbitAngle) * orbitDistance,
      y: system.y + Math.sin(orbitAngle) * orbitDistance,
    };

    const planetId = `${system.id}-planet-${orbitIndex + 1}`;
    const planet: GalaxyPlanetRecord = {
      id: planetId,
      systemId: system.id,
      starId: system.starId,
      sectorId: system.sectorId,
      ringId: system.ringId,
      orbitIndex,
      name: `${system.name} ${toRomanNumeral(orbitIndex + 1)}`,
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

function assignHomeworlds(planets: GalaxyPlanetRecord[], rng: SeededRandom): GalaxyHomeworldRecord[] {
  const homeworlds: GalaxyHomeworldRecord[] = [];

  GALAXY_SECTORS.forEach((sector) => {
    const spec = GALAXY_HOMEWORLD_SPECS[sector.raceId];
    const candidates = planets.filter((planet) => (
      planet.sectorId === sector.id
      && planet.ringId === "third"
      && !planet.isHomeworld
    ));
    const fallbackCandidates = planets.filter((planet) => planet.sectorId === sector.id && !planet.isHomeworld);
    const candidatePool = candidates.length > 0 ? candidates : fallbackCandidates;
    const homeworldPlanet = candidatePool[rng.int(0, candidatePool.length - 1)];
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
      const orbitAngle = rng.range(0, Math.PI * 2);
      const moon: GalaxyMoonRecord = {
        id: `${planet.id}-moon-${orbitIndex + 1}`,
        planetId: planet.id,
        systemId: planet.systemId,
        sectorId: planet.sectorId,
        ringId: planet.ringId,
        orbitIndex,
        name: `${planet.name} ${String.fromCharCode(65 + orbitIndex)}`,
        x: Math.round(planet.x + Math.cos(orbitAngle) * orbitDistance),
        y: Math.round(planet.y + Math.sin(orbitAngle) * orbitDistance),
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

function createSectorSystems(
  sector: GalaxySectorConfig,
  sectorIndex: number,
  systems: GalaxySystemRecord[],
  planets: GalaxyPlanetRecord[],
  rng: SeededRandom,
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
        name: buildSystemName(sector, sectorSystemIndex + 1),
        sectorId: sector.id,
        ringId,
        starId: `${systemId}-star`,
        x: Math.round(point.x),
        y: Math.round(point.y),
        starColor: interpolateColor(sector.borderColor, 0xffffff, 0.14 + rng.range(0, 0.18)),
        starSize: 2.2 + rng.range(0, 1.8),
        planetIds: [],
      };
      systems.push(system);
      createPlanetsForSystem(system, sector, planets, rng);
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

  GALAXY_SECTORS.forEach((sector, sectorIndex) => {
    createSectorSystems(sector, sectorIndex, systems, planets, rng);
  });

  const homeworlds = assignHomeworlds(planets, rng);
  const moons: GalaxyMoonRecord[] = [];
  createMoonsForPlanets(planets, homeworlds, moons, rng);
  const missionAssignments = assignMissionTargets(planets, rng);

  return {
    seed,
    rings: GALAXY_RINGS.map((ring) => ({ ...ring })),
    systems,
    planets,
    moons,
    homeworlds,
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

export function normalizeGalaxyDefinition(
  galaxy: Partial<GalaxyDefinition> | undefined,
  fallbackSeed?: number,
): GalaxyDefinition {
  if (isGalaxyDefinitionLike(galaxy)) {
    return {
      seed: galaxy.seed,
      rings: galaxy.rings.map((ring) => ({ ...ring })),
      systems: galaxy.systems.map((system) => ({ ...system, planetIds: [...system.planetIds] })),
      planets: galaxy.planets.map((planet) => ({
        ...planet,
        moonIds: [...planet.moonIds],
        missionIds: [...planet.missionIds],
      })),
      moons: galaxy.moons.map((moon) => ({ ...moon })),
      homeworlds: galaxy.homeworlds.map((homeworld) => ({ ...homeworld })),
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
  const dx = x - GALAXY_WORLD_CONFIG.center.x;
  const dy = (y - GALAXY_WORLD_CONFIG.center.y) / GALAXY_WORLD_CONFIG.verticalScale;
  const angleDeg = wrapAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
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

export function getGalaxySectorMidAngleDeg(sector: GalaxySectorConfig): number {
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  return wrapAngleDegrees((start + end) * 0.5);
}

export function getGalaxySpawnPointForRace(raceId: RaceId): GalaxyPoint {
  const sector = getGalaxySectorByRace(raceId);
  return pointFromDegrees(getGalaxySectorMidAngleDeg(sector), GALAXY_WORLD_CONFIG.raceSpawnRadius);
}

export function getDefaultGalaxySpawnPoint(): GalaxyPoint {
  return getGalaxySpawnPointForRace(DEFAULT_PLAYER_RACE_ID);
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

export function getMissionPlanetForMission(
  missionId: string | null | undefined,
  galaxy: GalaxyDefinition | null | undefined,
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
    missionId,
  };
}
