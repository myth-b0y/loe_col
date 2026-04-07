import type { RewardData } from "../core/session";

export type MissionDifficultyTier = "easy" | "medium" | "hard";
export type MissionEnemyKind = "rusher" | "shooter";
export type MissionFlow = "right" | "up";

export type MissionEnemyGroup = {
  kind: MissionEnemyKind;
  count: number;
};

export type MissionHallwayZone = {
  id: string;
  triggerProgress: number;
  flavor: string;
  enemies: MissionEnemyGroup[];
};

export type HallwayStage = {
  id: string;
  name: string;
  flavor: string;
  type: "hallway";
  flow: MissionFlow;
  span: number;
  zones: MissionHallwayZone[];
};

export type RestStage = {
  id: string;
  name: string;
  flavor: string;
  type: "rest";
  flow: MissionFlow;
  span: number;
};

export type BossStage = {
  id: string;
  name: string;
  flavor: string;
  type: "boss";
  flow: MissionFlow;
  span: number;
  boss: "shard-bruiser";
  triggerProgress: number;
  adds?: MissionEnemyGroup[];
};

export type MissionStage = HallwayStage | RestStage | BossStage;

export type MissionContractDefinition = {
  id: string;
  difficulty: MissionDifficultyTier;
  title: string;
  location: string;
  briefingSpeaker: string;
  briefing: string[];
  prompt: string;
  objective: string;
  reward: RewardData;
  accentColor: number;
};

export type MissionDefinition = {
  id: string;
  difficulty: MissionDifficultyTier;
  title: string;
  location: string;
  briefingSpeaker: string;
  briefing: string[];
  prompt: string;
  objective: string;
  reward: RewardData;
  stages: MissionStage[];
};

const HALLWAY_NAMES = {
  right: ["Transit Spine", "Docking Run", "Signal Causeway", "Relay Hall", "Spine Track"],
  up: ["Lift Shaft", "Gantry Rise", "Elevator Cage", "Core Climb", "Service Spine"],
} as const;

const REST_NAMES = ["Maintenance Safe Room", "Field Reset Bay", "Support Vault", "Crew Shelter"];
const BOSS_NAMES = ["Shard Heart", "Anchor Chamber", "Core Rupture", "Dark Relay"];

const FLAVOR_BANK = {
  easy: [
    "Shadow residue flickers through the corridor, but the first pressure line is still manageable.",
    "The route is unstable yet readable, with enough cover to reset your pace between waves.",
    "Corrupted scavengers move in bursts, testing angles before committing to the push.",
  ],
  medium: [
    "The route tightens and darkens as disciplined raider cells turn the corridors into kill lanes.",
    "Crossfire builds around the reactor spine, forcing cleaner movement and better target calls.",
    "The deeper halls are hotter and meaner, with shadow pressure pooling around choke points.",
  ],
  hard: [
    "The corruption here is mature and angry, with defenders rotating fire the moment you overextend.",
    "The route is warped enough that every push feels like stepping into a prepared ambush.",
    "Hard pressure rolls through the hall in waves, and the route offers very little free space.",
  ],
} as const;

const ZONE_FLAVOR_BANK = [
  "The first contact wave bursts into the lane as the route wakes up around you.",
  "Fresh hostiles spill out of the dark edge of the hall and try to pin the team in place.",
  "A heavier screen locks in from deeper inside, turning the corridor into a live firing lane.",
  "Shadow defenders rotate in and try to break the formation before you can stabilize.",
  "The route groans as another strike pack pours into the chamber and tries to stop the push.",
];

export const MISSION_CONTRACTS: readonly MissionContractDefinition[] = [
  {
    id: "ember-watch",
    difficulty: "easy",
    title: "Ember Watch",
    location: "Cinder Relay Verge",
    briefingSpeaker: "Marshal Teren",
    briefing: [
      "A low-intensity shadow bloom has taken hold around an outer relay watchpost.",
      "Push the route, stabilize the chamber, and bring back whatever hardware survives the breach.",
      "This is a clean test contract for a squad that still wants room to breathe.",
    ],
    prompt: "Stabilize the watchpost before the darkness roots deeper into the relay shell.",
    objective: "Clear the generated route, use the safe rooms well, defeat the anchor brute, and extract.",
    reward: {
      credits: 180,
      xp: 150,
      item: "Relay Core Mk I",
      itemId: "relay-core-mk1",
    },
    accentColor: 0x7de6ff,
  },
  {
    id: "outpost-breach",
    difficulty: "medium",
    title: "Outpost Breach",
    location: "Ashfall Relay Rim",
    briefingSpeaker: "Marshal Teren",
    briefing: [
      "A Republic relay outpost has fallen dark after a shard flare rolled through the station spine.",
      "Shadow-corrupted raiders moved in behind the surge and are turning the relay into a launch point.",
      "Sweep the route, reset in the safe rooms when they appear, and break the brute anchoring the corruption.",
    ],
    prompt: "Clear the relay spine before it becomes a stable launch route for the darkness.",
    objective: "Fight through a medium-threat randomized route, break the boss room, and return with salvage.",
    reward: {
      credits: 230,
      xp: 195,
      item: "Ember Capacitor",
      itemId: "ember-capacitor",
    },
    accentColor: 0xffcb79,
  },
  {
    id: "nightglass-abyss",
    difficulty: "hard",
    title: "Nightglass Abyss",
    location: "Null Glass Descent",
    briefingSpeaker: "Void Marshal Nera",
    briefing: [
      "A severe shadow wound has cracked open through a buried vertical relay tract.",
      "Expect tighter routes, fewer reset opportunities, and a boss chamber that will hit back hard.",
      "Bring the strongest squad formation you have and cut through before the route locks permanently.",
    ],
    prompt: "Descend into the wound, hold formation under pressure, and tear out the anchor before it matures.",
    objective: "Survive a hard randomized route, endure sparse rest access, destroy the anchor, and get out.",
    reward: {
      credits: 320,
      xp: 260,
      item: "Nightglass Shard",
      itemId: "nightglass-shard",
    },
    accentColor: 0xc8a7ff,
  },
] as const;

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

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildEnemyGroups(difficulty: MissionDifficultyTier, stageNumber: number, zoneIndex: number, rng: SeededRandom): MissionEnemyGroup[] {
  const baseRushers = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : 4;
  const baseShooters = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 2;
  const stagePressure = Math.floor(stageNumber / 2);
  const rushers = baseRushers + stagePressure + rng.int(0, difficulty === "hard" ? 2 : 1);
  const shooters = baseShooters + Math.floor(zoneIndex / 2) + rng.int(0, difficulty === "easy" ? 1 : 2);

  return [
    { kind: "rusher", count: rushers },
    { kind: "shooter", count: shooters },
  ];
}

function createHallwayStage(
  contract: MissionContractDefinition,
  index: number,
  hallwayNumber: number,
  rng: SeededRandom,
): HallwayStage {
  const flow = rng.next() > 0.42 ? "right" : "up";
  const zoneCount = contract.difficulty === "hard" ? 3 : 2;
  const triggerPoints = zoneCount === 3
    ? [0.2, 0.47, 0.74]
    : [0.24, 0.62];

  return {
    id: `${contract.id}-hall-${index + 1}`,
    name: rng.pick(HALLWAY_NAMES[flow]),
    flavor: rng.pick(FLAVOR_BANK[contract.difficulty]),
    type: "hallway",
    flow,
    span: flow === "right"
      ? rng.int(1760, 2280)
      : rng.int(1500, 2120),
    zones: triggerPoints.slice(0, zoneCount).map((triggerProgress, zoneIndex) => ({
      id: `${contract.id}-hall-${index + 1}-zone-${zoneIndex + 1}`,
      triggerProgress,
      flavor: rng.pick(ZONE_FLAVOR_BANK),
      enemies: buildEnemyGroups(contract.difficulty, hallwayNumber, zoneIndex, rng),
    })),
  };
}

function createRestStage(contract: MissionContractDefinition, index: number, rng: SeededRandom): RestStage {
  const flow = rng.next() > 0.5 ? "right" : "up";
  return {
    id: `${contract.id}-rest-${index + 1}`,
    name: rng.pick(REST_NAMES),
    flavor: "A sealed room gives the crew one controlled breath before the next push.",
    type: "rest",
    flow,
    span: flow === "right" ? 1020 : 980,
  };
}

function createBossStage(contract: MissionContractDefinition, index: number, rng: SeededRandom): BossStage {
  const flow = rng.next() > 0.5 ? "right" : "up";
  const addScale = contract.difficulty === "easy" ? 1 : contract.difficulty === "medium" ? 2 : 3;
  return {
    id: `${contract.id}-boss-${index + 1}`,
    name: rng.pick(BOSS_NAMES),
    flavor: "The chamber hums with enough pressure to feel like the route itself is holding its breath.",
    type: "boss",
    flow,
    span: flow === "right" ? 1680 : 1540,
    boss: "shard-bruiser",
    triggerProgress: flow === "right" ? 0.44 : 0.38,
    adds: [
      { kind: "rusher", count: addScale + 1 },
      { kind: "shooter", count: addScale },
    ],
  };
}

function buildMissionStagePlan(contract: MissionContractDefinition): Array<"hallway" | "rest" | "boss"> {
  if (contract.difficulty === "easy") {
    return ["hallway", "hallway", "rest", "hallway", "hallway", "rest", "boss"];
  }

  if (contract.difficulty === "medium") {
    return ["hallway", "hallway", "rest", "hallway", "hallway", "boss"];
  }

  return ["hallway", "hallway", "hallway", "rest", "hallway", "hallway", "boss"];
}

export function getMissionContracts(): MissionContractDefinition[] {
  return [...MISSION_CONTRACTS];
}

export function getMissionContract(missionId: string): MissionContractDefinition | undefined {
  return MISSION_CONTRACTS.find((contract) => contract.id === missionId);
}

export function createMissionDefinition(contractId: string, seed = Date.now()): MissionDefinition {
  const contract = getMissionContract(contractId) ?? MISSION_CONTRACTS[1];
  const rng = new SeededRandom(seed ^ hashSeed(contract.id));
  const plan = buildMissionStagePlan(contract);
  let hallwayNumber = 0;
  let restNumber = 0;

  const stages = plan.map((stageType, index) => {
    if (stageType === "hallway") {
      hallwayNumber += 1;
      return createHallwayStage(contract, index, hallwayNumber, rng);
    }

    if (stageType === "rest") {
      restNumber += 1;
      return createRestStage(contract, restNumber, rng);
    }

    return createBossStage(contract, index, rng);
  });

  return {
    id: contract.id,
    difficulty: contract.difficulty,
    title: contract.title,
    location: contract.location,
    briefingSpeaker: contract.briefingSpeaker,
    briefing: [...contract.briefing],
    prompt: contract.prompt,
    objective: contract.objective,
    reward: { ...contract.reward },
    stages,
  };
}

export const FIRST_MISSION = createMissionDefinition("ember-watch", 1);

export const missionRegistry: Record<string, MissionDefinition> = {
  [FIRST_MISSION.id]: FIRST_MISSION,
};
