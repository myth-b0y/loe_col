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
  | "resource"
  | "smuggling";
export type MissionSourceKind = "terminal" | "live-space" | "prime-world";
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
  distressTiming?: "timed" | "state";
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
      "The source is a real terminal giver, then the route moves through handoffs, defense, reclaim, smuggling, pirate pressure, and escort work.",
      "Encounter offsets and targets are seeded from the save so the chain is stable but still follows the live galaxy state.",
    ],
    prompt: "Run a linked field dispatch from setup to climax.",
    objective: "Move through a believable chain of comms, delivery, defense, reclaim, smuggling, pirate response, and escort work.",
    activities: [
      {
        id: "chain-travel",
        type: "travel",
        objective: "Travel to the generated planet that opened the dispatch.",
        targetHint: "mission-planet",
        completionText: "Dispatch waypoint reached.",
      },
      {
        id: "chain-briefing",
        type: "comms",
        objective: "Open comms with the local contact.",
        targetHint: "mission-planet",
        completionText: "Local contact acknowledged.",
        commsText: [
          "The local contact verifies your transponder and asks for a delivery before they can commit forces.",
          "Take the package to the linked station contact, then stand by for the next front update.",
        ],
        dialogueOptions: ["Accept delivery handoff", "Ask why this route matters"],
      },
      {
        id: "chain-delivery-pickup",
        type: "comms",
        objective: "Pick up the local delivery package.",
        targetHint: "station",
        completionText: "Delivery package loaded.",
        commsText: [
          "Station traffic control releases a marked civilian package into your hold.",
          "Deliver it intact so the front can coordinate the next move.",
        ],
        dialogueOptions: ["Load delivery package", "Confirm destination"],
      },
      {
        id: "chain-delivery-dropoff",
        type: "comms",
        objective: "Deliver the package to the assigned contact.",
        targetHint: "station",
        completionText: "Delivery package transferred.",
        commsText: [
          "The receiving contact verifies the package and forwards a live defense request.",
          "A nearby zone is under pressure and needs help immediately.",
        ],
        dialogueOptions: ["Transfer package", "Ask where help is needed"],
      },
      {
        id: "chain-defend-zone",
        type: "space-battle",
        objective: "Help defend the marked zone from real hostile pressure.",
        targetHint: "ship",
        completionText: "Defense wave cleared.",
      },
      {
        id: "chain-assistance-checkin",
        type: "comms",
        objective: "Ask the nearest command contact where assistance is needed next.",
        targetHint: "prime-world",
        completionText: "Assistance request received.",
        commsText: [
          "Command confirms the defense bought them time.",
          "They now need a captured zone reclaimed before the front collapses.",
        ],
        dialogueOptions: ["Ask where to reclaim", "Request enemy status"],
      },
      {
        id: "chain-reclaim-zone",
        type: "zone",
        objective: "Clear real enemy ships from the marked zone and stabilize it.",
        targetHint: "zone",
        completionText: "Reclaim zone stabilized.",
      },
      {
        id: "chain-return-contact",
        type: "comms",
        objective: "Return to the original contact for the next handoff.",
        targetHint: "mission-planet",
        completionText: "Original contact updated.",
        commsText: [
          "The original contact confirms the reclaimed zone and offers a risky cargo route.",
          "This next package must pass through restricted traffic without being lost.",
        ],
        dialogueOptions: ["Accept smuggling handoff", "Ask about patrol lanes"],
      },
      {
        id: "chain-smuggle-pickup",
        type: "comms",
        objective: "Pick up sealed smuggling cargo.",
        targetHint: "station",
        completionText: "Sealed cargo loaded.",
        commsText: [
          "The broker confirms a sealed package is ready.",
          "Keep it in your cargo hold until the delivery contact clears it.",
        ],
        dialogueOptions: ["Load sealed cargo", "Confirm risk"],
      },
      {
        id: "chain-smuggle-delivery",
        type: "comms",
        objective: "Deliver the sealed smuggling cargo.",
        targetHint: "station",
        completionText: "Smuggling cargo delivered.",
        commsText: [
          "The receiving contact clears the sealed cargo hash.",
          "A pirate distress call interrupts the channel before you can leave.",
        ],
        dialogueOptions: ["Transfer sealed cargo", "Ask about the distress call"],
      },
      {
        id: "chain-pirate-defense",
        type: "space-battle",
        objective: "Help defend against a pirate attack tied to the local zone.",
        targetHint: "ship",
        completionText: "Pirate attack broken.",
      },
      {
        id: "chain-escort",
        type: "escort",
        objective: "Escort the transport from the current contact to a real destination.",
        targetHint: "escort",
        completionText: "Transport escort complete.",
      },
      {
        id: "chain-final-report",
        type: "comms",
        objective: "Return to the original dispatch contact and close the route.",
        targetHint: "mission-planet",
        completionText: "Linked dispatch complete.",
        commsText: [
          "The original contact logs the delivery, reclaim, smuggling, pirate response, and escort as complete.",
          "The route is stable for now.",
        ],
        dialogueOptions: ["Close dispatch", "Request final receipt"],
      },
    ],
    baseXp: 230,
    rewardPreview: getMissionRewardPreview("test-chain-dispatch", 230),
    accentColor: 0xffd27a,
  },
  {
    id: "distress-transport",
    difficulty: "easy",
    activityType: "escort",
    source: { kind: "live-space", giver: "Distress Call", label: "Live transport distress" },
    terminalVisible: false,
    title: "Distress: Transport Escort",
    location: "Live courier signal",
    briefingSpeaker: "Distress Call",
    briefing: [
      "A courier has broadcast a short-range distress call.",
      "The escort begins at a real station or world, then a transport enters the mission route.",
      "Set it as your course from the Data Pad to show the escort waypoint and keep the transport alive.",
    ],
    prompt: "Escort the live transport to a real nearby destination.",
    objective: "Keep the escort ship alive until it reaches its destination.",
    distressTiming: "timed",
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
    rewardPreview: getMissionRewardPreview("distress-transport", 115),
    accentColor: 0x9fffd0,
  },
  {
    id: "distress-salvage",
    difficulty: "easy",
    activityType: "resource",
    source: { kind: "live-space", giver: "Salvage Ping", label: "Live salvage ping" },
    terminalVisible: false,
    title: "Distress: Salvage Recovery",
    location: "Live resource ping",
    briefingSpeaker: "Salvage Ping",
    briefing: [
      "A recoverable object has been detected inside a drifting wreckage field.",
      "Recover the object, then deliver it to the assigned station contact.",
      "Set it as your course, reach the marker, recover it, and complete the delivery through comms.",
    ],
    prompt: "Recover the marked salvage package and deliver it.",
    objective: "Collect the salvage package from wreckage and deliver it to the station contact.",
    distressTiming: "timed",
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
    rewardPreview: getMissionRewardPreview("distress-salvage", 95),
    accentColor: 0xf0d49c,
  },
  {
    id: "distress-smuggling",
    difficulty: "medium",
    activityType: "smuggling",
    source: { kind: "live-space", giver: "Grey Route Broker", label: "Live smuggling offer" },
    terminalVisible: false,
    title: "Distress: Smuggling Run",
    location: "Restricted cargo route",
    briefingSpeaker: "Grey Route Broker",
    briefing: [
      "This tests the first-pass smuggling loop using real cargo inventory.",
      "Recover a sealed cargo package from a risky waypoint, carry it through restricted space, then deliver it to the marked contact.",
      "If your ship is destroyed while carrying the cargo, the package is lost and the mission fails.",
    ],
    prompt: "Pick up the sealed cargo and deliver it through a risky route.",
    objective: "Recover smuggled cargo, keep it in your inventory, and deliver it to the contact.",
    distressTiming: "timed",
    activities: [
      {
        id: "pickup-cargo",
        type: "comms",
        objective: "Pick up sealed cargo from the marked station or world contact.",
        targetHint: "station",
        completionText: "Smuggling cargo loaded.",
        commsText: [
          "The broker confirms a sealed package is ready for pickup.",
          "Load it into your cargo hold and keep moving.",
        ],
        dialogueOptions: ["Load sealed cargo", "Ask about patrol risk"],
      },
      {
        id: "deliver-smuggling",
        type: "comms",
        objective: "Deliver the sealed cargo to the marked contact.",
        targetHint: "station",
        completionText: "Smuggling delivery complete.",
        commsText: [
          "The station contact verifies the sealed cargo hash and opens a quiet transfer slot.",
          "Hand over the package to complete the run.",
        ],
        dialogueOptions: ["Transfer sealed cargo", "Ask about route exposure"],
      },
    ],
    baseXp: 135,
    rewardPreview: getMissionRewardPreview("distress-smuggling", 135),
    accentColor: 0xc8ced7,
  },
  {
    id: "distress-reclaim",
    difficulty: "medium",
    activityType: "zone",
    source: { kind: "live-space", giver: "Republic Commander", label: "Live reclaim request" },
    terminalVisible: false,
    title: "Distress: Reclaim Front",
    location: "Enemy-held strategic zone",
    briefingSpeaker: "Republic Commander",
    briefing: [
      "A Republic force is starting a reclaim push and needs an extra ship on the line.",
      "The target must be a real Empire-held or contested zone in this save.",
    ],
    prompt: "Help reclaim a real enemy-held zone.",
    objective: "Clear real enemy ships in the zone and stabilize it.",
    distressTiming: "state",
    activities: [
      {
        id: "reclaim-zone",
        type: "zone",
        objective: "Clear real Empire pressure from the marked zone, then stabilize it.",
        targetHint: "zone",
        completionText: "Reclaim support complete.",
      },
    ],
    baseXp: 145,
    rewardPreview: getMissionRewardPreview("distress-reclaim", 145),
    accentColor: 0x8bd0ff,
  },
  {
    id: "distress-pirate-defense",
    difficulty: "easy",
    activityType: "space-battle",
    source: { kind: "live-space", giver: "Local Defense Channel", label: "Live pirate distress" },
    terminalVisible: false,
    title: "Distress: Pirate Defense",
    location: "Local pirate attack",
    briefingSpeaker: "Local Defense Channel",
    briefing: [
      "Pirates are pressuring a local shipping lane.",
      "This should use actual pirate faction ships and clear when those ships are destroyed.",
    ],
    prompt: "Help local defenders clear a pirate attack.",
    objective: "Destroy the pirate attackers.",
    distressTiming: "timed",
    activities: [
      {
        id: "pirate-defense",
        type: "space-battle",
        objective: "Destroy the pirate attackers near the marked system.",
        targetHint: "ship",
        completionText: "Pirate attack broken.",
      },
    ],
    baseXp: 105,
    rewardPreview: getMissionRewardPreview("distress-pirate-defense", 105),
    accentColor: 0xaeb6c2,
  },
  {
    id: "distress-neutral-empire-defense",
    difficulty: "medium",
    activityType: "space-battle",
    source: { kind: "live-space", giver: "Neutral Prime World", label: "Live neutral distress" },
    terminalVisible: false,
    title: "Distress: Neutral World Defense",
    location: "Neutral zone under Empire pressure",
    briefingSpeaker: "Neutral Prime World",
    briefing: [
      "A neutral world is under Empire pressure and is asking for immediate help.",
      "The attacking ships must match the Empire race selected for this save.",
    ],
    prompt: "Help a neutral world fight off an Empire attack.",
    objective: "Destroy the Empire attackers.",
    distressTiming: "state",
    activities: [
      {
        id: "neutral-defense",
        type: "space-battle",
        objective: "Destroy the Empire ships pressuring the marked neutral zone.",
        targetHint: "ship",
        completionText: "Neutral defense completed.",
      },
    ],
    baseXp: 135,
    rewardPreview: getMissionRewardPreview("distress-neutral-empire-defense", 135),
    accentColor: 0xd8e6ff,
  },
  {
    id: "prime-assist-reclaim",
    difficulty: "medium",
    activityType: "zone",
    source: { kind: "prime-world", giver: "Prime World Command", label: "Prime World assistance" },
    terminalVisible: false,
    title: "Prime Request: Reclaim Zone",
    location: "Prime World command channel",
    briefingSpeaker: "Prime World Command",
    briefing: [
      "Prime World command is requesting help with a real contested or occupied zone.",
      "The request should never originate from the Empire home world unless a later story path explicitly allows it.",
    ],
    prompt: "Ask a non-Empire Prime World where help is needed.",
    objective: "Assist a real reclaim or defense action.",
    activities: [
      {
        id: "prime-reclaim",
        type: "zone",
        objective: "Help stabilize the real zone identified by Prime World command.",
        targetHint: "zone",
        completionText: "Prime assistance resolved.",
      },
    ],
    baseXp: 150,
    rewardPreview: getMissionRewardPreview("prime-assist-reclaim", 150),
    accentColor: 0x9fd7ff,
  },
  {
    id: "world-zone-reclaim",
    difficulty: "medium",
    activityType: "ground",
    source: { kind: "prime-world", giver: "Local Resistance", label: "Direct reclaim action" },
    terminalVisible: false,
    title: "Direct Reclaim Operation",
    location: "Enemy-held system",
    briefingSpeaker: "Local Resistance",
    briefing: [
      "You have cleared the ships around an enemy-held system.",
      "Land and break the occupation command cell on the ground.",
    ],
    prompt: "Land in the enemy-held system and defeat the occupation boss.",
    objective: "Clear the short reclaim ground operation.",
    groundVariant: "short",
    activities: [
      {
        id: "direct-reclaim-ground",
        type: "ground",
        objective: "Land and defeat the occupation boss.",
        targetHint: "mission-planet",
        completionText: "Direct reclaim ground operation complete.",
      },
    ],
    baseXp: 150,
    rewardPreview: getMissionRewardPreview("world-zone-reclaim", 150),
    accentColor: 0x9df7c7,
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
