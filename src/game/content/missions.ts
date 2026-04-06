import type { RewardData } from "../core/session";

export type MissionEnemyKind = "rusher" | "shooter";

export type MissionEnemyGroup = {
  kind: MissionEnemyKind;
  count: number;
};

export type MissionHallwayZone = {
  id: string;
  triggerX: number;
  flavor: string;
  enemies: MissionEnemyGroup[];
};

export type HallwayStage = {
  id: string;
  name: string;
  flavor: string;
  type: "hallway";
  width: number;
  zones: MissionHallwayZone[];
};

export type RestStage = {
  id: string;
  name: string;
  flavor: string;
  type: "rest";
  width: number;
};

export type BossStage = {
  id: string;
  name: string;
  flavor: string;
  type: "boss";
  width: number;
  boss: "shard-bruiser";
  triggerX: number;
  adds?: MissionEnemyGroup[];
};

export type MissionStage = HallwayStage | RestStage | BossStage;

export type MissionDefinition = {
  id: string;
  title: string;
  location: string;
  briefingSpeaker: string;
  briefing: string[];
  objective: string;
  reward: RewardData;
  stages: MissionStage[];
};

export const FIRST_MISSION: MissionDefinition = {
  id: "outpost-breach",
  title: "Outpost Breach",
  location: "Ashfall Relay Rim",
  briefingSpeaker: "Marshal Teren",
  briefing: [
    "A Republic relay outpost has fallen dark after a shard flare rolled through the station spine.",
    "Shadow-corrupted raiders moved in behind the surge and are turning the relay into a launch point.",
    "Sweep the outpost, rest when you can, and break the brute anchoring the corruption.",
  ],
  objective: "Clear four hallway phases, survive the rest stops, defeat the brute, and extract.",
  reward: {
    credits: 220,
    xp: 190,
    item: "Relay Core Mk I",
  },
  stages: [
    {
      id: "dock-ring-a",
      name: "Dock Ring",
      flavor: "The first breach corridor still crackles from the boarding surge.",
      type: "hallway",
      width: 1880,
      zones: [
        {
          id: "dock-ring-entry",
          triggerX: 240,
          flavor: "Boarders spill out of the shattered docking clamps.",
          enemies: [
            { kind: "rusher", count: 2 },
            { kind: "shooter", count: 1 },
          ],
        },
        {
          id: "dock-ring-mid",
          triggerX: 940,
          flavor: "A second pack rushes in from the maintenance ribs.",
          enemies: [
            { kind: "rusher", count: 3 },
            { kind: "shooter", count: 1 },
          ],
        },
      ],
    },
    {
      id: "dock-ring-b",
      name: "Transit Spine",
      flavor: "The spine narrows and sightlines get meaner.",
      type: "hallway",
      width: 1980,
      zones: [
        {
          id: "spine-entry",
          triggerX: 280,
          flavor: "Corrupted marksmen set up overlapping fire lanes.",
          enemies: [
            { kind: "rusher", count: 2 },
            { kind: "shooter", count: 2 },
          ],
        },
        {
          id: "spine-mid",
          triggerX: 1120,
          flavor: "More shadows push down the catwalk as the hull groans around you.",
          enemies: [
            { kind: "rusher", count: 3 },
            { kind: "shooter", count: 2 },
          ],
        },
      ],
    },
    {
      id: "rest-alpha",
      name: "Maintenance Rest Stop",
      flavor: "A sealed support room gives you one clean breath before the next push.",
      type: "rest",
      width: 980,
    },
    {
      id: "gantry-breach",
      name: "Power Gantry",
      flavor: "The gantry opens up and enemies attack in staggered bursts.",
      type: "hallway",
      width: 2080,
      zones: [
        {
          id: "gantry-entry",
          triggerX: 320,
          flavor: "The first wave drops from the gantry braces.",
          enemies: [
            { kind: "rusher", count: 3 },
            { kind: "shooter", count: 2 },
          ],
        },
        {
          id: "gantry-mid",
          triggerX: 1180,
          flavor: "A heavier defensive screen pours in from deeper inside.",
          enemies: [
            { kind: "rusher", count: 4 },
            { kind: "shooter", count: 2 },
          ],
        },
      ],
    },
    {
      id: "signal-conduit",
      name: "Signal Conduit",
      flavor: "The conduit corridor is hotter, tighter, and visibly more corrupted.",
      type: "hallway",
      width: 2160,
      zones: [
        {
          id: "conduit-entry",
          triggerX: 320,
          flavor: "Fast movers flood the approach before the sharpshooters settle in.",
          enemies: [
            { kind: "rusher", count: 4 },
            { kind: "shooter", count: 2 },
          ],
        },
        {
          id: "conduit-mid",
          triggerX: 1220,
          flavor: "The final defense line throws everything it has left.",
          enemies: [
            { kind: "rusher", count: 5 },
            { kind: "shooter", count: 3 },
          ],
        },
      ],
    },
    {
      id: "rest-beta",
      name: "Staging Vault",
      flavor: "A square staging vault gives you one last chance to reset before the core.",
      type: "rest",
      width: 1020,
    },
    {
      id: "relay-heart",
      name: "Relay Heart",
      flavor: "The relay core chamber thrums with shard pressure and the brute keeping it stable.",
      type: "boss",
      width: 1700,
      boss: "shard-bruiser",
      triggerX: 680,
      adds: [
        { kind: "rusher", count: 2 },
        { kind: "shooter", count: 1 },
      ],
    },
  ],
};

export const missionRegistry: Record<string, MissionDefinition> = {
  [FIRST_MISSION.id]: FIRST_MISSION,
};
