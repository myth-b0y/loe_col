import type { RewardData } from "../core/session";

export type MissionEnemyGroup = {
  kind: "rusher" | "shooter";
  count: number;
};

export type MissionRoom = {
  id: string;
  name: string;
  flavor: string;
  enemies?: MissionEnemyGroup[];
  boss?: "shard-bruiser";
};

export type MissionDefinition = {
  id: string;
  title: string;
  location: string;
  briefingSpeaker: string;
  briefing: string[];
  objective: string;
  reward: RewardData;
  rooms: MissionRoom[];
};

export const FIRST_MISSION: MissionDefinition = {
  id: "outpost-breach",
  title: "Outpost Breach",
  location: "Ashfall Relay Rim",
  briefingSpeaker: "Marshal Teren",
  briefing: [
    "A Republic relay outpost has fallen dark after a shard flare rolled through the station spine.",
    "Shadow-corrupted raiders moved in behind the surge and are turning the relay into a launch point.",
    "Sweep the outpost, keep your companion alive, and break the brute anchoring the corruption.",
  ],
  objective: "Clear the relay, defeat the shard brute, and return to ship.",
  reward: {
    credits: 165,
    xp: 140,
    item: "Relay Core Mk I",
  },
  rooms: [
    {
      id: "dock-ring",
      name: "Dock Ring",
      flavor: "The outer docking ring is crawling with corrupted boarders.",
      enemies: [
        { kind: "rusher", count: 3 },
        { kind: "shooter", count: 1 },
      ],
    },
    {
      id: "transit-spine",
      name: "Transit Spine",
      flavor: "The spine is tighter, hotter, and layered with suppressive fire lanes.",
      enemies: [
        { kind: "rusher", count: 2 },
        { kind: "shooter", count: 2 },
      ],
    },
    {
      id: "relay-heart",
      name: "Relay Heart",
      flavor: "The core chamber pulses with shard pressure and a single oversized guardian.",
      boss: "shard-bruiser",
    },
  ],
};

export const missionRegistry: Record<string, MissionDefinition> = {
  [FIRST_MISSION.id]: FIRST_MISSION,
};

