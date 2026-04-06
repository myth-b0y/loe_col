import Phaser from "phaser";

export type GraphicsQuality = "High" | "Balanced" | "Performance";

export type GameSettings = {
  graphics: {
    quality: GraphicsQuality;
    brightness: 90 | 100 | 110;
    screenShake: boolean;
    hitFlash: boolean;
  };
  audio: {
    master: 100 | 80 | 60 | 40 | 20 | 0;
    music: 100 | 80 | 60 | 40 | 20 | 0;
    sfx: 100 | 80 | 60 | 40 | 20 | 0;
  };
  controls: {
    move: "WASD / Left Stick";
    aim: "Mouse / Right Stick";
    fireMode: "Hold To Fire / Auto Fire On Aim";
    pause: "Esc / Pause Button";
  };
};

export type RewardData = {
  credits: number;
  xp: number;
  item: string;
};

export type SaveData = {
  version: 1;
  meta: {
    lastSavedAt: string | null;
  };
  profile: {
    callsign: string;
    level: number;
    xp: number;
    credits: number;
  };
  loadout: {
    weapon: string;
    ability: string;
    support: string;
    companion: string;
  };
  progression: {
    completedMissionIds: string[];
    unlockedMissionIds: string[];
  };
};

const SAVE_KEY = "loe-col-save-v1";
const SETTINGS_KEY = "loe-col-settings-v1";

const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    quality: "High",
    brightness: 100,
    screenShake: true,
    hitFlash: true,
  },
  audio: {
    master: 100,
    music: 80,
    sfx: 100,
  },
  controls: {
    move: "WASD / Left Stick",
    aim: "Mouse / Right Stick",
    fireMode: "Hold To Fire / Auto Fire On Aim",
    pause: "Esc / Pause Button",
  },
};

const DEFAULT_SAVE: SaveData = {
  version: 1,
  meta: {
    lastSavedAt: null,
  },
  profile: {
    callsign: "Champion",
    level: 1,
    xp: 0,
    credits: 140,
  },
  loadout: {
    weapon: "Lumen Carbine",
    ability: "Pulse Burst",
    support: "Arc Lance",
    companion: "Sera - Ranger Support",
  },
  progression: {
    completedMissionIds: [],
    unlockedMissionIds: ["outpost-breach"],
  },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class GameSession extends Phaser.Events.EventEmitter {
  settings: GameSettings = clone(DEFAULT_SETTINGS);
  saveData: SaveData = clone(DEFAULT_SAVE);
  activeMissionId: string | null = null;
  pendingReward: RewardData | null = null;

  bootstrap(): void {
    this.loadSettings();
    this.loadSave();
  }

  startNewGame(): void {
    this.saveData = clone(DEFAULT_SAVE);
    this.activeMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
  }

  hasSaveData(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SAVE_KEY) !== null;
  }

  saveToDisk(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      this.saveData.meta.lastSavedAt = new Date().toISOString();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData));
      this.emit("save-changed", this.saveData);
      return true;
    } catch {
      return false;
    }
  }

  loadSave(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw) as SaveData;
      this.saveData = {
        ...clone(DEFAULT_SAVE),
        ...parsed,
        meta: { ...clone(DEFAULT_SAVE.meta), ...parsed.meta },
        profile: { ...clone(DEFAULT_SAVE.profile), ...parsed.profile },
        loadout: { ...clone(DEFAULT_SAVE.loadout), ...parsed.loadout },
        progression: {
          ...clone(DEFAULT_SAVE.progression),
          ...parsed.progression,
        },
      };
      this.activeMissionId = null;
      this.pendingReward = null;
      this.emit("save-changed", this.saveData);
      return true;
    } catch {
      return false;
    }
  }

  private loadSettings(): void {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      this.settings = {
        graphics: { ...DEFAULT_SETTINGS.graphics, ...parsed.graphics },
        audio: { ...DEFAULT_SETTINGS.audio, ...parsed.audio },
        controls: { ...DEFAULT_SETTINGS.controls, ...parsed.controls },
      };
    } catch {
      this.settings = clone(DEFAULT_SETTINGS);
    }
  }

  persistSettings(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.emit("settings-changed", this.settings);
      return true;
    } catch {
      return false;
    }
  }

  setGraphicsQuality(value: GraphicsQuality): void {
    this.settings.graphics.quality = value;
    this.persistSettings();
  }

  setBrightness(value: 90 | 100 | 110): void {
    this.settings.graphics.brightness = value;
    this.persistSettings();
  }

  setScreenShake(value: boolean): void {
    this.settings.graphics.screenShake = value;
    this.persistSettings();
  }

  setHitFlash(value: boolean): void {
    this.settings.graphics.hitFlash = value;
    this.persistSettings();
  }

  setAudioValue(key: keyof GameSettings["audio"], value: 100 | 80 | 60 | 40 | 20 | 0): void {
    this.settings.audio[key] = value;
    this.persistSettings();
  }

  startMission(missionId: string): void {
    this.activeMissionId = missionId;
    this.emit("mission-started", missionId);
  }

  completeMission(missionId: string, reward: RewardData): void {
    this.activeMissionId = null;
    this.pendingReward = reward;

    if (!this.saveData.progression.completedMissionIds.includes(missionId)) {
      this.saveData.progression.completedMissionIds.push(missionId);
    }

    this.saveData.profile.credits += reward.credits;
    this.saveData.profile.xp += reward.xp;
    this.saveData.profile.level = 1 + Math.floor(this.saveData.profile.xp / 160);

    this.emit("save-changed", this.saveData);
  }

  consumePendingReward(): RewardData | null {
    const reward = this.pendingReward;
    this.pendingReward = null;
    return reward;
  }
}

export const gameSession = new GameSession();

