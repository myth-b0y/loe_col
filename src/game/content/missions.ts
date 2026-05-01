import { getMissionRewardPreview, type MissionRewardPreview } from "./loot";

export type MissionDifficultyTier = "easy" | "medium" | "hard";
export type MissionActivityType =
  | "travel"
  | "comms"
  | "space-battle"
  | "ground"
  | "zone"
  | "kill-target"
  | "escort"
  | "boss"
  | "resource";
export type MissionSourceKind = "terminal" | "live-space";
export type MissionTargetHint = "mission-planet" | "prime-world" | "station" | "zone" | "ship" | "resource" | "escort";
export type MissionEnemyKind = "rusher" | "shooter" | "hexer";
export type MissionFlow = "right" | "up";
export type MissionBossKind = "shard-bruiser" | "relay-seer" | "nightglass-behemoth";

export type MissionActivityStepDefinition = {
  id: string;
  type: MissionActivityType;
  objective: string;
  targetHint: MissionTargetHint;
  completionText: string;
  commsText?: string[];
  dialogueOptions?: string[];
  waveCount?: number;
};

export type MissionActivityState = {
  stepIndex: number;
  completedStepIds: string[];
  flags: Record<string, string | number | boolean>;
};

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
  boss: MissionBossKind;
  triggerProgress: number;
  adds?: MissionEnemyGroup[];
};

export type MissionStage = HallwayStage | RestStage | BossStage;

export type MissionContractDefinition = {
  id: string;
  difficulty: MissionDifficultyTier;
  activityType: MissionActivityType | "chain";
  source: {
    kind: MissionSourceKind;
    giver: string;
    label: string;
  };
  terminalVisible: boolean;
  title: string;
  location: string;
  briefingSpeaker: string;
  briefing: string[];
  prompt: string;
  objective: string;
  activities: MissionActivityStepDefinition[];
  groundVariant?: "standard" | "short";
  baseXp: number;
  rewardPreview: MissionRewardPreview;
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
  activities: MissionActivityStepDefinition[];
  seed: number;
  baseXp: number;
  rewardPreview: MissionRewardPreview;
  stages: MissionStage[];
};

const HALLWAY_NAMES = {
  right: ["Transit Spine", "Docking Run", "Signal Causeway", "Relay Hall", "Spine Track"],
  up: ["Lift Shaft", "Gantry Rise", "Elevator Cage", "Core Climb", "Service Spine"],
} as const;

const REST_NAMES = ["Maintenance Safe Room", "Field Reset Bay", "Support Vault", "Crew Shelter"];
const BOSS_NAMES = ["Shard Heart", "Anchor Chamber", "Core Rupture", "Dark Relay"];
const BOSS_VARIANTS_BY_DIFFICULTY: Record<MissionDifficultyTier, readonly MissionBossKind[]> = {
  easy: ["shard-bruiser"],
  medium: ["relay-seer"],
  hard: ["nightglass-behemoth"],
};

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
    id: "test-comms-checkin",
    difficulty: "easy",
    activityType: "comms",
    source: { kind: "terminal", giver: "Republic Signal Clerk", label: "Terminal comms test" },
    terminalVisible: true,
    title: "Test: Prime Comms",
    location: "Prime-world comms channel",
    briefingSpeaker: "Republic Signal Clerk",
    briefing: [
      "This checks the talk/comms activity path without full landing.",
      "Fly to the marked Prime World contact and open comms from interaction range.",
      "The comms exchange completes the test mission.",
    ],
    prompt: "Make contact with a Prime World through the ship comms window.",
    objective: "Fly to the marked Prime World and press F in comms range.",
    activities: [
      {
        id: "comms",
        type: "comms",
        objective: "Open comms with the marked Prime World contact.",
        targetHint: "prime-world",
        completionText: "Comms contact verified.",
        commsText: [
          "Prime-world signal lock established. The channel carries local traffic, patrol reports, and a short confirmation packet.",
          "Reply with the verification phrase so the comms activity can advance through the real dialogue hook.",
        ],
        dialogueOptions: ["Transmit verification phrase", "Ask for local status"],
      },
    ],
    baseXp: 80,
    rewardPreview: getMissionRewardPreview("test-comms-checkin", 80),
    accentColor: 0x8fe3ff,
  },
  {
    id: "test-space-battle",
    difficulty: "medium",
    activityType: "space-battle",
    source: { kind: "terminal", giver: "Patrol Coordinator", label: "Terminal battle test" },
    terminalVisible: true,
    title: "Test: Skirmish Clear",
    location: "Hostile fleet marker",
    briefingSpeaker: "Patrol Coordinator",
    briefing: [
      "This stages a finite Empire skirmish near a valid generated route target.",
      "Clear the hostile waves in the marked encounter area.",
      "The mission succeeds when the wave count is exhausted and the encounter is empty.",
    ],
    prompt: "Destroy the Empire skirmish group without letting it endlessly respawn.",
    objective: "Reach the marker and clear the finite hostile waves.",
    activities: [
      {
        id: "space-battle",
        type: "space-battle",
        objective: "Destroy the hostile Empire skirmish group.",
        targetHint: "ship",
        completionText: "Hostile fleet cleared.",
        waveCount: 2,
      },
    ],
    baseXp: 130,
    rewardPreview: getMissionRewardPreview("test-space-battle", 130),
    accentColor: 0xffb86c,
  },
  {
    id: "test-ground-sweep",
    difficulty: "easy",
    activityType: "ground",
    source: { kind: "terminal", giver: "Ground Dispatch", label: "Terminal ground test" },
    terminalVisible: true,
    title: "Test: Ground Sweep",
    location: "Marked generated world",
    briefingSpeaker: "Ground Dispatch",
    briefing: [
      "This uses the existing ground mission slice rather than replacing it.",
      "Set course, land at the mission world, and clear the generated combat route.",
      "The existing extraction and reward flow should complete the mission.",
    ],
    prompt: "Land at the marked world and run a short ground combat verification route.",
    objective: "Land, clear the generated ground route, defeat the final room, and extract.",
    groundVariant: "short",
    activities: [
      {
        id: "ground",
        type: "ground",
        objective: "Land and complete the ground combat slice.",
        targetHint: "mission-planet",
        completionText: "Ground sweep complete.",
      },
    ],
    baseXp: 150,
    rewardPreview: getMissionRewardPreview("test-ground-sweep", 150),
    accentColor: 0x9df7c7,
  },
  {
    id: "test-zone-reclaim",
    difficulty: "medium",
    activityType: "zone",
    source: { kind: "terminal", giver: "Frontline Monitor", label: "Terminal war test" },
    terminalVisible: true,
    title: "Test: Zone Assist",
    location: "Active war-zone marker",
    briefingSpeaker: "Frontline Monitor",
    briefing: [
      "This verifies a mission can talk to the existing zone/faction war state.",
      "Fly to an Empire-held or contested zone and clear the enemy defenders.",
      "After the defenders are gone, stabilize the zone so the map visibly updates.",
    ],
    prompt: "Help stabilize a contested or occupied zone using the real zone data.",
    objective: "Reach the marked zone, clear defenders, then press F to reclaim it.",
    activities: [
      {
        id: "zone",
        type: "zone",
        objective: "Clear and stabilize the marked strategic zone.",
        targetHint: "zone",
        completionText: "Zone reclaim resolved.",
      },
    ],
    baseXp: 145,
    rewardPreview: getMissionRewardPreview("test-zone-reclaim", 145),
    accentColor: 0x8bd0ff,
  },
  {
    id: "test-kill-target",
    difficulty: "medium",
    activityType: "kill-target",
    source: { kind: "terminal", giver: "Bounty Relay", label: "Terminal target test" },
    terminalVisible: true,
    title: "Test: Marked Target",
    location: "Commander intercept point",
    briefingSpeaker: "Bounty Relay",
    briefing: [
      "This creates one dangerous marked ship target tied to the active mission.",
      "The target uses real hostile context and does not respawn after destruction.",
      "Destroying the target should complete the objective and clear the waypoint.",
    ],
    prompt: "Intercept and destroy the marked hostile elite.",
    objective: "Destroy the marked elite target ship.",
    activities: [
      {
        id: "target",
        type: "kill-target",
        objective: "Destroy the marked elite target ship.",
        targetHint: "ship",
        completionText: "Marked target destroyed.",
      },
    ],
    baseXp: 125,
    rewardPreview: getMissionRewardPreview("test-kill-target", 125),
    accentColor: 0xff8f8f,
  },
  {
    id: "test-boss-climax",
    difficulty: "hard",
    activityType: "boss",
    source: { kind: "terminal", giver: "Threat Analysis", label: "Terminal boss test" },
    terminalVisible: true,
    title: "Test: Heavy Contact",
    location: "Boss-style intercept",
    briefingSpeaker: "Threat Analysis",
    briefing: [
      "This stages one tougher Empire command ship as a first-pass climax activity.",
      "It is a real finite combat objective and should not loop-spawn after death.",
      "Later story chapters can reuse the same activity slot with authored encounters.",
    ],
    prompt: "Destroy the heavy hostile contact at the marked intercept point.",
    objective: "Defeat the stronger boss-style ship.",
    activities: [
      {
        id: "boss",
        type: "boss",
        objective: "Destroy the heavy hostile contact.",
        targetHint: "ship",
        completionText: "Heavy contact eliminated.",
      },
    ],
    baseXp: 210,
    rewardPreview: getMissionRewardPreview("test-boss-climax", 210),
    accentColor: 0xc8a7ff,
  },
  {
    id: "test-chain-dispatch",
    difficulty: "medium",
    activityType: "chain",
    source: { kind: "terminal", giver: "Operations Desk", label: "Terminal chain test" },
    terminalVisible: true,
    title: "Test: Linked Dispatch",
    location: "Multi-step live route",
    briefingSpeaker: "Operations Desk",
    briefing: [
      "This proves a mission can advance through several activity types in order.",
      "The source is a real terminal giver, then the route moves through travel, comms, escort, and a final heavy contact.",
      "Encounter offsets and targets are seeded from the save so the chain is stable but not identical across saves.",
    ],
    prompt: "Run a linked field dispatch from setup to climax.",
    objective: "Travel, open comms, escort a courier, then destroy the final heavy contact.",
    activities: [
      {
        id: "chain-travel",
        type: "travel",
        objective: "Travel to the first generated waypoint.",
        targetHint: "mission-planet",
        completionText: "Dispatch waypoint reached.",
      },
      {
        id: "chain-comms",
        type: "comms",
        objective: "Open comms with the field contact.",
        targetHint: "prime-world",
        completionText: "Field contact acknowledged.",
        commsText: [
          "The field contact verifies the route and uploads the courier transponder.",
          "Accept the handoff, then escort the transport to its real destination.",
        ],
        dialogueOptions: ["Accept courier handoff", "Request threat summary"],
      },
      {
        id: "chain-escort",
        type: "escort",
        objective: "Escort the courier ship to its exit marker.",
        targetHint: "escort",
        completionText: "Courier reached the transfer point.",
      },
      {
        id: "chain-boss",
        type: "boss",
        objective: "Destroy the heavy contact blocking extraction.",
        targetHint: "ship",
        completionText: "Linked dispatch complete.",
      },
    ],
    baseXp: 230,
    rewardPreview: getMissionRewardPreview("test-chain-dispatch", 230),
    accentColor: 0xffd27a,
  },
  {
    id: "test-escort-distress",
    difficulty: "easy",
    activityType: "escort",
    source: { kind: "live-space", giver: "Distress Call", label: "Live distress call" },
    terminalVisible: false,
    title: "Test: Distress Escort",
    location: "Live courier signal",
    briefingSpeaker: "Distress Call",
    briefing: [
      "A courier has broadcast a short-range distress call.",
      "The escort begins at a real station or world, then a transport enters the mission route.",
      "Set it as your course from the Data Pad to show the escort waypoint and keep the transport alive.",
    ],
    prompt: "Escort the live transport to a real nearby destination.",
    objective: "Keep the escort ship alive until it reaches its destination.",
    activities: [
      {
        id: "escort",
        type: "escort",
        objective: "Escort the courier ship.",
        targetHint: "escort",
        completionText: "Courier escort complete.",
      },
    ],
    baseXp: 115,
    rewardPreview: getMissionRewardPreview("test-escort-distress", 115),
    accentColor: 0x9fffd0,
  },
  {
    id: "test-resource-salvage",
    difficulty: "easy",
    activityType: "resource",
    source: { kind: "live-space", giver: "Salvage Ping", label: "Live salvage ping" },
    terminalVisible: false,
    title: "Test: Salvage Recovery",
    location: "Live resource ping",
    briefingSpeaker: "Salvage Ping",
    briefing: [
      "A recoverable object has been detected inside a drifting wreckage field.",
      "Recover the object, then deliver it to the assigned station contact.",
      "Set it as your course, reach the marker, recover it, and complete the delivery through comms.",
    ],
    prompt: "Recover the marked salvage package and deliver it.",
    objective: "Collect the salvage package from wreckage and deliver it to the station contact.",
    activities: [
      {
        id: "resource",
        type: "resource",
        objective: "Recover the marked salvage package from wreckage.",
        targetHint: "resource",
        completionText: "Salvage package recovered.",
      },
      {
        id: "deliver-salvage",
        type: "comms",
        objective: "Deliver the recovered salvage package to the station contact.",
        targetHint: "station",
        completionText: "Salvage delivered.",
        commsText: [
          "Station salvage control confirms the package beacon and opens a clean delivery channel.",
          "Transfer the manifest to complete the retrieval activity.",
        ],
        dialogueOptions: ["Transfer salvage manifest", "Ask for recovery receipt"],
      },
    ],
    baseXp: 95,
    rewardPreview: getMissionRewardPreview("test-resource-salvage", 95),
    accentColor: 0xf0d49c,
  },
] as const;

export const TEMP_TEST_MISSION_IDS = MISSION_CONTRACTS.map((contract) => contract.id);

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
  const baseRushers = difficulty === "easy" ? 3 : difficulty === "medium" ? 4 : 5;
  const baseShooters = difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3;
  const stagePressure = Math.floor(stageNumber / 2);
  const rushers = baseRushers + stagePressure + rng.int(0, difficulty === "hard" ? 2 : 1);
  const shooters = baseShooters + Math.floor(zoneIndex / 2) + rng.int(0, difficulty === "easy" ? 1 : 2);
  const groups: MissionEnemyGroup[] = [
    { kind: "rusher", count: rushers },
    { kind: "shooter", count: shooters },
  ];

  const shouldAddHexer = difficulty !== "easy" && (stageNumber >= 2 || zoneIndex >= 1);
  if (shouldAddHexer) {
    groups.push({
      kind: "hexer",
      count: difficulty === "hard"
        ? 1 + (stageNumber >= 4 ? 1 : 0)
        : 1,
    });
  }

  return groups;
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
  const bossPool = BOSS_VARIANTS_BY_DIFFICULTY[contract.difficulty];
  return {
    id: `${contract.id}-boss-${index + 1}`,
    name: rng.pick(BOSS_NAMES),
    flavor: "The chamber hums with enough pressure to feel like the route itself is holding its breath.",
    type: "boss",
    flow,
    span: flow === "right" ? 1680 : 1540,
    boss: rng.pick(bossPool),
    triggerProgress: flow === "right" ? 0.44 : 0.38,
    adds: [
      { kind: "rusher", count: addScale + 1 },
      { kind: "shooter", count: addScale },
      ...(contract.difficulty === "easy" ? [] : [{ kind: "hexer" as const, count: contract.difficulty === "hard" ? 2 : 1 }]),
    ],
  };
}

function buildMissionStagePlan(contract: MissionContractDefinition): Array<"hallway" | "rest" | "boss"> {
  if (contract.groundVariant === "short") {
    return ["hallway", "boss"];
  }

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

export function getTerminalMissionContracts(): MissionContractDefinition[] {
  return MISSION_CONTRACTS.filter((contract) => contract.terminalVisible);
}

export function getMissionContract(missionId: string): MissionContractDefinition | undefined {
  return MISSION_CONTRACTS.find((contract) => contract.id === missionId);
}

export function createDefaultMissionActivityState(): MissionActivityState {
  return {
    stepIndex: 0,
    completedStepIds: [],
    flags: {},
  };
}

export function getCurrentMissionActivityStep(contract: MissionContractDefinition, state?: Partial<MissionActivityState> | null): MissionActivityStepDefinition | null {
  const stepIndex = typeof state?.stepIndex === "number" && Number.isFinite(state.stepIndex)
    ? Math.max(0, Math.floor(state.stepIndex))
    : 0;
  return contract.activities[stepIndex] ?? null;
}

export function isGroundMissionContract(contract: MissionContractDefinition | null | undefined): boolean {
  return Boolean(contract?.activities.some((activity) => activity.type === "ground"));
}

export function createMissionDefinition(contractId: string, seed = Date.now()): MissionDefinition {
  const contract = getMissionContract(contractId) ?? getMissionContract("test-ground-sweep") ?? MISSION_CONTRACTS[0];
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
    activities: contract.activities.map((activity) => ({ ...activity })),
    seed,
    baseXp: contract.baseXp,
    rewardPreview: { ...contract.rewardPreview, dropLines: [...contract.rewardPreview.dropLines] },
    stages,
  };
}

export const FIRST_MISSION = createMissionDefinition("test-ground-sweep", 1);

export const missionRegistry: Record<string, MissionDefinition> = {
  [FIRST_MISSION.id]: FIRST_MISSION,
};
