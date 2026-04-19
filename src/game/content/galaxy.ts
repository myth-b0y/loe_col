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
  verticalScale: number;
  armCount: number;
  armTurns: number;
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

function pointFromPolar(angleRad: number, radius: number): GalaxyPoint {
  return {
    x: GALAXY_WORLD_CONFIG.center.x + Math.cos(angleRad) * radius,
    y: GALAXY_WORLD_CONFIG.center.y + Math.sin(angleRad) * radius * GALAXY_WORLD_CONFIG.verticalScale,
  };
}

function pointFromDegrees(angleDeg: number, radius: number): GalaxyPoint {
  return pointFromPolar((angleDeg * Math.PI) / 180, radius);
}

function buildGalaxyStars(config: GalaxyWorldConfig): GalaxyStarSeed[] {
  const rng = new SeededRandom(0x0f4c_91a7);
  const stars: GalaxyStarSeed[] = [];

  for (let index = 0; index < 190; index += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = Math.pow(rng.next(), 0.48) * config.coreRadius;
    const jitter = rng.range(-24, 24);
    const point = pointFromPolar(angle, radius + jitter);
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
    const baseRadius = config.coreRadius + radialT * (config.radius - config.coreRadius);
    const baseAngle = (armIndex / config.armCount) * Math.PI * 2 + radialT * config.armTurns * Math.PI * 2;
    const angularNoise = rng.range(-0.34, 0.34);
    const radialNoise = rng.range(-(120 + radialT * 420), 120 + radialT * 420);
    const point = pointFromPolar(baseAngle + angularNoise, baseRadius + radialNoise);
    if (
      point.x < 64
      || point.x > config.width - 64
      || point.y < 64
      || point.y > config.height - 64
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
      const radius = config.coreRadius + radialT * (config.radius - config.coreRadius);
      const angle = (armIndex / config.armCount) * Math.PI * 2 + radialT * config.armTurns * Math.PI * 2;
      const point = pointFromPolar(angle, radius);
      nodes.push({
        x: point.x,
        y: point.y,
        radius: 340 + step * 120,
        color: colors[(armIndex + step) % colors.length],
        alpha: 0.06 + (step * 0.01),
      });
    }
  }

  nodes.push({
    x: config.center.x,
    y: config.center.y,
    radius: config.coreRadius * 1.26,
    color: 0x365c86,
    alpha: 0.14,
  });

  return nodes;
}

export const GALAXY_WORLD_CONFIG: GalaxyWorldConfig = {
  width: 16000,
  height: 16000,
  center: {
    x: 8000,
    y: 8000,
  },
  spawn: {
    x: 8000,
    y: 8000,
  },
  radius: 6200,
  coreRadius: 940,
  verticalScale: 0.72,
  armCount: 4,
  armTurns: 1.64,
  starCount: 1320,
  backgroundStarCount: 360,
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
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4680,
  },
  {
    id: "aaruian-reach",
    raceId: "aaruian",
    label: "Aaruian Reach",
    color: 0x4f8dff,
    borderColor: 0xbad7ff,
    startAngleDeg: 28,
    endAngleDeg: 78,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4860,
  },
  {
    id: "elsari-veil",
    raceId: "elsari",
    label: "Elsari Veil",
    color: 0x8a58ff,
    borderColor: 0xd2b7ff,
    startAngleDeg: 78,
    endAngleDeg: 130,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4960,
  },
  {
    id: "nevari-bloom",
    raceId: "nevari",
    label: "Nevari Bloom",
    color: 0x49a85c,
    borderColor: 0xb9efc3,
    startAngleDeg: 130,
    endAngleDeg: 184,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4860,
  },
  {
    id: "rakkan-drift",
    raceId: "rakkan",
    label: "Rakkan Drift",
    color: 0xff9a3c,
    borderColor: 0xffd29f,
    startAngleDeg: 184,
    endAngleDeg: 238,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4820,
  },
  {
    id: "svarin-span",
    raceId: "svarin",
    label: "Svarin Span",
    color: 0xe4c83d,
    borderColor: 0xffefb2,
    startAngleDeg: 238,
    endAngleDeg: 292,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4800,
  },
  {
    id: "ashari-crown",
    raceId: "ashari",
    label: "Ashari Crown",
    color: 0xd74b56,
    borderColor: 0xffb3b8,
    startAngleDeg: 292,
    endAngleDeg: 338,
    innerRadius: 880,
    outerRadius: GALAXY_WORLD_CONFIG.radius,
    labelRadius: 4720,
  },
];

export const GALAXY_STARS: GalaxyStarSeed[] = buildGalaxyStars(GALAXY_WORLD_CONFIG);
export const GALAXY_HAZE_NODES: GalaxyHazeNode[] = buildGalaxyHazeNodes(GALAXY_WORLD_CONFIG);

export const GALAXY_MISSION_PLANETS: GalaxyMissionPlanet[] = [
  {
    missionId: "ember-watch",
    name: "Pyre Verge",
    sectorId: "ashari-crown",
    ...pointFromDegrees(318, 5040),
    color: 0xff8569,
    radius: 138,
  },
  {
    missionId: "outpost-breach",
    name: "Ashfall Prime",
    sectorId: "rakkan-drift",
    ...pointFromDegrees(212, 4540),
    color: 0xffb65e,
    radius: 146,
  },
  {
    missionId: "nightglass-abyss",
    name: "Nullglass",
    sectorId: "elsari-veil",
    ...pointFromDegrees(104, 5420),
    color: 0xc894ff,
    radius: 154,
  },
];

export function clampPointToGalaxyBounds(x: number, y: number): GalaxyPoint {
  return {
    x: Math.max(0, Math.min(GALAXY_WORLD_CONFIG.width, x)),
    y: Math.max(0, Math.min(GALAXY_WORLD_CONFIG.height, y)),
  };
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
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  return pointFromDegrees((start + end) * 0.5, sector.labelRadius);
}

export function getMissionPlanetForMission(missionId: string | null | undefined): GalaxyMissionPlanet | null {
  if (!missionId) {
    return null;
  }

  return GALAXY_MISSION_PLANETS.find((planet) => planet.missionId === missionId) ?? null;
}
