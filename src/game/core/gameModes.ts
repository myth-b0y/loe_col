export type GameModeId = "story" | "arcade";
export type SessionType = "solo" | "couch-co-op" | "online";
export type PlayerCount = 1 | 2 | 3 | 4;

export type RunConfig = {
  mode: GameModeId;
  sessionType: SessionType;
  playerCount: PlayerCount;
};

export type GameModeRules = {
  id: GameModeId;
  label: string;
  description: string;
  companionsEnabled: boolean;
  timerEnabled: boolean;
  dayCycleEnabled: boolean;
  storyDriven: boolean;
  saveStyle: "campaign" | "run";
  maxPlayers: PlayerCount;
};

export const DEFAULT_RUN_CONFIG: RunConfig = {
  mode: "story",
  sessionType: "solo",
  playerCount: 1,
};

export const GAME_MODE_RULES: Record<GameModeId, GameModeRules> = {
  story: {
    id: "story",
    label: "Story",
    description: "Authored campaign flow with companions, dialogue hooks, and persistent progression.",
    companionsEnabled: true,
    timerEnabled: false,
    dayCycleEnabled: false,
    storyDriven: true,
    saveStyle: "campaign",
    maxPlayers: 1,
  },
  arcade: {
    id: "arcade",
    label: "Arcade",
    description: "Run-based darkness race with timer/day-cycle pressure and no companion layer.",
    companionsEnabled: false,
    timerEnabled: true,
    dayCycleEnabled: true,
    storyDriven: false,
    saveStyle: "run",
    maxPlayers: 4,
  },
};
