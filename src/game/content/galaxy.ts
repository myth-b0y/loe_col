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

export type GalaxyMissionPlanet = {
  missionId: string;
  name: string;
  sectorId: string;
  x: number;
  y: number;
  color: number;
  radius: number;
};

export type GalaxyPoint = {
  x: number;
  y: number;
};

const STAR_COLORS = [0xffffff, 0xe4f1ff, 0xa4d2ff, 0xffe9ae] as const;
const DEFAULT_PLAYER_RACE_ID: RaceId = "olydran";

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

export const GALAXY_STARS: GalaxyStarSeed[] = buildGalaxyStars(GALAXY_WORLD_CONFIG);
export const GALAXY_HAZE_NODES: GalaxyHazeNode[] = buildGalaxyHazeNodes(GALAXY_WORLD_CONFIG);

export const GALAXY_MISSION_PLANETS: GalaxyMissionPlanet[] = [
  {
    missionId: "ember-watch",
    name: "Pyre Verge",
    sectorId: "ashari-crown",
    ...pointFromDegrees(318, GALAXY_WORLD_CONFIG.radius * 0.813),
    color: 0xff8569,
    radius: 138,
  },
  {
    missionId: "outpost-breach",
    name: "Ashfall Prime",
    sectorId: "rakkan-drift",
    ...pointFromDegrees(212, GALAXY_WORLD_CONFIG.radius * 0.732),
    color: 0xffb65e,
    radius: 146,
  },
  {
    missionId: "nightglass-abyss",
    name: "Nullglass",
    sectorId: "elsari-veil",
    ...pointFromDegrees(104, GALAXY_WORLD_CONFIG.radius * 0.874),
    color: 0xc894ff,
    radius: 154,
  },
];

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

export function getMissionPlanetForMission(missionId: string | null | undefined): GalaxyMissionPlanet | null {
  if (!missionId) {
    return null;
  }

  return GALAXY_MISSION_PLANETS.find((planet) => planet.missionId === missionId) ?? null;
}
