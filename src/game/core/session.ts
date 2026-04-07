import Phaser from "phaser";

import {
  DEFAULT_RUN_CONFIG,
  GAME_MODE_RULES,
  type GameModeRules,
  type PlayerCount,
  type RunConfig,
  type SessionType,
} from "./gameModes";

export type GraphicsQuality = "High" | "Balanced" | "Performance";
export type InputModePreference = "Auto" | "Desktop" | "Touch";
export type ResolvedInputMode = "desktop" | "touch";
export type GameplayDifficulty = "Novice" | "Knight" | "Legend" | "Mythic";
export type ControlSensitivity = 60 | 80 | 100 | 120 | 140;

export type DifficultyProfile = {
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;
  enemyCooldown: number;
};

export const INPUT_MODE_OPTIONS: InputModePreference[] = ["Auto", "Desktop", "Touch"];
export const DIFFICULTY_OPTIONS: GameplayDifficulty[] = ["Novice", "Knight", "Legend", "Mythic"];

export const DIFFICULTY_PROFILES: Record<GameplayDifficulty, DifficultyProfile> = {
  Novice: {
    enemyHp: 0.82,
    enemyDamage: 0.78,
    enemySpeed: 0.92,
    enemyCooldown: 1.12,
  },
  Knight: {
    enemyHp: 0.9,
    enemyDamage: 0.9,
    enemySpeed: 0.96,
    enemyCooldown: 1.06,
  },
  Legend: {
    enemyHp: 1,
    enemyDamage: 1,
    enemySpeed: 1,
    enemyCooldown: 1,
  },
  Mythic: {
    enemyHp: 1.16,
    enemyDamage: 1.18,
    enemySpeed: 1.08,
    enemyCooldown: 0.9,
  },
};

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
    move: "WASD / Touch Stick";
    aim: "Mouse / Stick Facing";
    attack: "LMB Hold / Attack Button";
    pause: "Esc / Pause Button";
    inputMode: InputModePreference;
    autoAim: boolean;
    autoFire: boolean;
    mouseSensitivity: ControlSensitivity;
    touchSensitivity: ControlSensitivity;
  };
  gameplay: {
    difficulty: GameplayDifficulty;
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
    move: "WASD / Touch Stick",
    aim: "Mouse / Stick Facing",
    attack: "LMB Hold / Attack Button",
    pause: "Esc / Pause Button",
    inputMode: "Auto",
    autoAim: true,
    autoFire: true,
    mouseSensitivity: 100,
    touchSensitivity: 100,
  },
  gameplay: {
    difficulty: "Knight",
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
  runConfig: RunConfig = clone(DEFAULT_RUN_CONFIG);
  activeMissionId: string | null = null;
  acceptedMissionId: string | null = null;
  pendingReward: RewardData | null = null;
  private activeSlotIndex = 0;
  private saveSlots: Array<SaveData | null> = createEmptySlots();
  private hasTouchInput = false;
  private prefersCoarsePointer = false;
  private lastInputMode: ResolvedInputMode = "desktop";

  bootstrap(): void {
    this.loadSettings();
    this.loadSaveSlots();

    const latestSlot = sortByMostRecent(this.saveSlots);
    if (latestSlot !== null) {
      this.loadSave(latestSlot);
      return;
    }

    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.activeSlotIndex = 0;
    this.saveData = clone(DEFAULT_SAVE);
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
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

  getRunConfig(): RunConfig {
    return clone(this.runConfig);
  }

  getModeRules(mode = this.runConfig.mode): GameModeRules {
    return GAME_MODE_RULES[mode];
  }

  configureRun(nextConfig: Partial<RunConfig>): void {
    const mode = nextConfig.mode ?? this.runConfig.mode;
    const modeRules = GAME_MODE_RULES[mode];
    const sessionType = nextConfig.sessionType ?? this.runConfig.sessionType;
    const requestedPlayerCount = nextConfig.playerCount ?? this.runConfig.playerCount;
    const clampedPlayerCount = Phaser.Math.Clamp(requestedPlayerCount, 1, modeRules.maxPlayers) as PlayerCount;
    const resolvedPlayerCount = mode === "story" ? 1 : clampedPlayerCount;
    const resolvedSessionType: SessionType = resolvedPlayerCount === 1 ? "solo" : sessionType;

    this.runConfig = {
      mode,
      sessionType: resolvedSessionType,
      playerCount: resolvedPlayerCount,
    };

    this.emit("run-config-changed", this.getRunConfig());
  }

  configureDeviceContext(hasTouchInput: boolean, prefersCoarsePointer: boolean): void {
    const previousMode = this.getResolvedInputMode();
    this.hasTouchInput = hasTouchInput;
    this.prefersCoarsePointer = prefersCoarsePointer;

    if (!hasTouchInput) {
      this.lastInputMode = "desktop";
    } else if (this.settings.controls.inputMode === "Auto") {
      this.lastInputMode = prefersCoarsePointer ? "touch" : this.lastInputMode;
    }

    const resolvedMode = this.getResolvedInputMode();
    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  getResolvedInputMode(hasTouchInput = this.hasTouchInput): ResolvedInputMode {
    if (!hasTouchInput) {
      return "desktop";
    }

    if (this.settings.controls.inputMode === "Desktop") {
      return "desktop";
    }

    if (this.settings.controls.inputMode === "Touch") {
      return "touch";
    }

    return this.prefersCoarsePointer ? "touch" : this.lastInputMode;
  }

  shouldUseTouchUi(hasTouchInput = this.hasTouchInput): boolean {
    return hasTouchInput && this.getResolvedInputMode(hasTouchInput) === "touch";
  }

  reportInputMode(mode: ResolvedInputMode, hasTouchInput = this.hasTouchInput): void {
    if (mode === "touch" && !hasTouchInput) {
      return;
    }

    const previousMode = this.getResolvedInputMode(hasTouchInput);
    this.lastInputMode = mode;
    const resolvedMode = this.getResolvedInputMode(hasTouchInput);

    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  getDifficultyProfile(): DifficultyProfile {
    return DIFFICULTY_PROFILES[this.settings.gameplay.difficulty];
  }

  getPreferredNewGameSlot(): number {
    return this.firstEmptySlotOrActive();
  }

  startNewGame(slotIndex = this.firstEmptySlotOrActive()): void {
    this.activeSlotIndex = Phaser.Math.Clamp(slotIndex, 0, SLOT_COUNT - 1);
    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.saveData = clone(DEFAULT_SAVE);
    this.activeMissionId = null;
    this.acceptedMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
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
    this.runConfig = clone(DEFAULT_RUN_CONFIG);
    this.activeSlotIndex = safeSlot;
    this.activeMissionId = null;
    this.acceptedMissionId = null;
    this.pendingReward = null;
    this.emit("save-changed", this.saveData);
    this.emit("run-config-changed", this.getRunConfig());
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

  leaveMission(options?: { missionId?: string | null; requeue?: boolean }): void {
    const missionId = options?.missionId ?? this.activeMissionId;
    this.activeMissionId = null;
    this.pendingReward = null;
    this.acceptedMissionId = options?.requeue && missionId ? missionId : null;
    this.emit("mission-left", {
      missionId,
      requeue: Boolean(options?.requeue && missionId),
    });
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

  setInputMode(value: InputModePreference): void {
    const previousMode = this.getResolvedInputMode();
    this.settings.controls.inputMode = value;
    this.persistSettings();

    const resolvedMode = this.getResolvedInputMode();
    if (resolvedMode !== previousMode) {
      this.emit("input-mode-changed", resolvedMode);
    }
  }

  setAutoAim(value: boolean): void {
    this.settings.controls.autoAim = value;
    this.persistSettings();
  }

  setAutoFire(value: boolean): void {
    this.settings.controls.autoFire = value;
    this.persistSettings();
  }

  setMouseSensitivity(value: ControlSensitivity): void {
    this.settings.controls.mouseSensitivity = value;
    this.persistSettings();
  }

  setTouchSensitivity(value: ControlSensitivity): void {
    this.settings.controls.touchSensitivity = value;
    this.persistSettings();
  }

  setDifficulty(value: GameplayDifficulty): void {
    this.settings.gameplay.difficulty = value;
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
        gameplay: { ...DEFAULT_SETTINGS.gameplay, ...parsed.gameplay },
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
