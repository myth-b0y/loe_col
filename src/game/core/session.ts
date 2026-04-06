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
  version: 2;
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

export type SaveSlot = {
  index: number;
  label: string;
  data: SaveData | null;
  isActive: boolean;
};

const SLOT_COUNT = 3;
const LEGACY_SAVE_KEY = "loe-col-save-v1";
const SAVE_SLOTS_KEY = "loe-col-save-slots-v2";
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
  version: 2,
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

function createEmptySlots(): Array<SaveData | null> {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

function mergeSaveData(parsed: Partial<SaveData>): SaveData {
  return {
    ...clone(DEFAULT_SAVE),
    ...parsed,
    version: 2,
    meta: { ...clone(DEFAULT_SAVE.meta), ...parsed.meta },
    profile: { ...clone(DEFAULT_SAVE.profile), ...parsed.profile },
    loadout: { ...clone(DEFAULT_SAVE.loadout), ...parsed.loadout },
    progression: {
      ...clone(DEFAULT_SAVE.progression),
      ...parsed.progression,
    },
  };
}

function sortByMostRecent(slots: Array<SaveData | null>): number | null {
  let bestIndex: number | null = null;
  let bestTime = -1;

  slots.forEach((slot, index) => {
    const lastSavedAt = slot?.meta.lastSavedAt;
    const timestamp = lastSavedAt ? Date.parse(lastSavedAt) : Number.NaN;
    if (!Number.isFinite(timestamp) || timestamp <= bestTime) {
      return;
    }

    bestTime = timestamp;
    bestIndex = index;
  });

  return bestIndex;
}

export class GameSession extends Phaser.Events.EventEmitter {
  settings: GameSettings = clone(DEFAULT_SETTINGS);
  saveData: SaveData = clone(DEFAULT_SAVE);
  activeMissionId: string | null = null;
  acceptedMissionId: string | null = null;
  pendingReward: RewardData | null = null;
  private activeSlotIndex = 0;
  private saveSlots: Array<SaveData | null> = createEmptySlots();

  bootstrap(): void {
    this.loadSettings();
    this.loadSaveSlots();

    const latestSlot = sortByMostRecent(this.saveSlots);
    if (latestSlot !== null) {
      this.loadSave(latestSlot);
      return;
    }

    this.activeSlotIndex = 0;
    this.saveData = clone(DEFAULT_SAVE);
    this.emit("save-changed", this.saveData);
    this.emit("slots-changed", this.getSaveSlots());
  }

  getSaveSlots(): SaveSlot[] {
    return this.saveSlots.map((slot, index) => ({
      index,
      label: `Slot ${index + 1}`,
      data: slot ? clone(slot) : null,
      isActive: index === this.activeSlotIndex,
    }));
  }

  getActiveSlotIndex(): number {
    return this.activeSlotIndex;
  }

  getPreferredNewGameSlot(): number {
    return this.firstEmptySlotOrActive();
  }

  startNewGame(slotIndex = this.firstEmptySlotOrActive()): void {
    this.activeSlotIndex = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    this.saveData = clone(DEFAULT_SAVE);
    this.activeMissionId = null;
    this.acceptedMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("slots-changed", this.getSaveSlots());
  }

  hasSaveData(slotIndex?: number): boolean {
    if (slotIndex !== undefined) {
      return this.saveSlots[slotIndex] !== null;
    }

    return this.saveSlots.some((slot) => slot !== null);
  }

  saveToDisk(slotIndex = this.activeSlotIndex): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const safeSlot = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);

    try {
      this.activeSlotIndex = safeSlot;
      this.saveData.meta.lastSavedAt = new Date().toISOString();
      this.saveSlots[safeSlot] = clone(this.saveData);
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(this.saveSlots));
      this.emit("save-changed", this.saveData);
      this.emit("slots-changed", this.getSaveSlots());
      return true;
    } catch {
      return false;
    }
  }

  loadSave(slotIndex = this.activeSlotIndex): boolean {
    const safeSlot = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    const slot = this.saveSlots[safeSlot];
    if (!slot) {
      return false;
    }

    this.saveData = mergeSaveData(slot);
    this.activeSlotIndex = safeSlot;
    this.activeMissionId = null;
    this.acceptedMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("slots-changed", this.getSaveSlots());
    return true;
  }

  acceptMission(missionId: string): void {
    this.acceptedMissionId = missionId;
    this.emit("mission-accepted", missionId);
  }

  startMission(missionId: string): void {
    this.activeMissionId = missionId;
    this.acceptedMissionId = null;
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

  private loadSaveSlots(): void {
    if (typeof window === "undefined") {
      this.saveSlots = createEmptySlots();
      return;
    }

    const raw = window.localStorage.getItem(SAVE_SLOTS_KEY);
    if (!raw) {
      this.migrateLegacySave();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Array<Partial<SaveData> | null>;
      const normalized = createEmptySlots();
      parsed.slice(0, SLOT_COUNT).forEach((slot, index) => {
        normalized[index] = slot ? mergeSaveData(slot) : null;
      });
      this.saveSlots = normalized;
    } catch {
      this.saveSlots = createEmptySlots();
    }
  }

  private migrateLegacySave(): void {
    if (typeof window === "undefined") {
      this.saveSlots = createEmptySlots();
      return;
    }

    const legacy = window.localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacy) {
      this.saveSlots = createEmptySlots();
      return;
    }

    try {
      const parsed = JSON.parse(legacy) as Partial<SaveData>;
      this.saveSlots = createEmptySlots();
      this.saveSlots[0] = mergeSaveData(parsed);
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(this.saveSlots));
    } catch {
      this.saveSlots = createEmptySlots();
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

  private firstEmptySlotOrActive(): number {
    const emptyIndex = this.saveSlots.findIndex((slot) => slot === null);
    return emptyIndex >= 0 ? emptyIndex : this.activeSlotIndex;
  }
}

export const gameSession = new GameSession();
