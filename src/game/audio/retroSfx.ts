import { gameSession } from "../core/session";

export type SfxCue =
  | "player-fire"
  | "enemy-shot"
  | "pulse"
  | "arc-lance"
  | "dash"
  | "shield-hit"
  | "shield-break"
  | "shield-recharge"
  | "heal-cast"
  | "support-bolt"
  | "guard-pulse"
  | "guard-shot"
  | "shield-bash"
  | "melee-slash"
  | "caster-arc"
  | "demolition-shot"
  | "ranged-volley"
  | "boss-burst"
  | "loot-burst"
  | "companion-revive";

type CueOptions = {
  pan?: number;
  pitch?: number;
  throttleMs?: number;
  volume?: number;
};

type ToneParams = {
  attack?: number;
  duration: number;
  endFreq?: number;
  filterFreq?: number;
  pan?: number;
  startFreq: number;
  startOffset?: number;
  type: OscillatorType;
  volume: number;
};

type NoiseParams = {
  attack?: number;
  duration: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  pan?: number;
  playbackRate?: number;
  startOffset?: number;
  volume: number;
};

type OutputNode = {
  node: AudioNode;
  cleanup: () => void;
};

const DEFAULT_THROTTLES: Partial<Record<SfxCue, number>> = {
  "player-fire": 45,
  "enemy-shot": 70,
  "pulse": 120,
  "arc-lance": 120,
  "dash": 110,
  "shield-hit": 80,
  "shield-break": 120,
  "shield-recharge": 180,
  "heal-cast": 140,
  "support-bolt": 90,
  "guard-pulse": 120,
  "guard-shot": 90,
  "shield-bash": 110,
  "melee-slash": 90,
  "caster-arc": 90,
  "demolition-shot": 120,
  "ranged-volley": 90,
  "boss-burst": 180,
  "loot-burst": 200,
  "companion-revive": 140,
};

class RetroSfxManager {
  private context: AudioContext | null = null;
  private debugCounts: Partial<Record<SfxCue, number>> = {};
  private lastPlayed = new Map<SfxCue, number>();
  private noiseBuffer: AudioBuffer | null = null;
  private unlockInstalled = false;
  private unlockHandler?: () => void;

  installAutoUnlock(): void {
    if (this.unlockInstalled || typeof window === "undefined") {
      return;
    }

    this.unlockInstalled = true;
    const unlock = (): void => {
      void this.resumeContext().finally(() => {
        if (this.context?.state === "running") {
          this.removeUnlockListeners();
        }
      });
    };
    this.unlockHandler = unlock;

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  getDebugState(): Record<string, unknown> {
    return {
      available: this.isAvailable(),
      state: this.context?.state ?? "uninitialized",
      counts: { ...this.debugCounts },
    };
  }

  play(cue: SfxCue, options: CueOptions = {}): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const throttleMs = options.throttleMs ?? DEFAULT_THROTTLES[cue] ?? 0;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const lastPlayed = this.lastPlayed.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - lastPlayed < throttleMs) {
      return;
    }

    this.lastPlayed.set(cue, nowMs);
    this.debugCounts[cue] = (this.debugCounts[cue] ?? 0) + 1;
    void this.resumeContext();

    const volume = this.getSfxVolume(options.volume ?? 1);
    if (volume <= 0.0001) {
      return;
    }

    const pan = options.pan ?? 0;
    const pitch = options.pitch ?? 1;

    switch (cue) {
      case "player-fire":
        this.tone(context, { type: "square", startFreq: 980 * pitch, endFreq: 410 * pitch, duration: 0.06, volume: volume * 0.3, filterFreq: 2800, pan });
        this.tone(context, { type: "triangle", startFreq: 520 * pitch, endFreq: 290 * pitch, duration: 0.075, volume: volume * 0.14, filterFreq: 1600, pan });
        this.noise(context, { duration: 0.024, volume: volume * 0.04, filterFreq: 2600, filterType: "highpass", pan });
        return;
      case "enemy-shot":
        this.tone(context, { type: "square", startFreq: 340 * pitch, endFreq: 160 * pitch, duration: 0.08, volume: volume * 0.2, filterFreq: 1800, pan });
        this.noise(context, { duration: 0.026, volume: volume * 0.03, filterFreq: 1500, filterType: "highpass", pan });
        return;
      case "pulse":
        this.tone(context, { type: "square", startFreq: 280 * pitch, endFreq: 80 * pitch, duration: 0.22, volume: volume * 0.26, filterFreq: 1200, pan });
        this.tone(context, { type: "triangle", startFreq: 180 * pitch, endFreq: 90 * pitch, duration: 0.24, volume: volume * 0.18, filterFreq: 900, pan });
        this.noise(context, { duration: 0.11, volume: volume * 0.06, filterFreq: 900, filterType: "lowpass", pan });
        return;
      case "arc-lance":
        this.tone(context, { type: "sawtooth", startFreq: 840 * pitch, endFreq: 210 * pitch, duration: 0.18, volume: volume * 0.24, filterFreq: 2600, pan });
        this.tone(context, { type: "square", startFreq: 1280 * pitch, endFreq: 430 * pitch, duration: 0.1, volume: volume * 0.12, filterFreq: 3200, pan });
        this.noise(context, { duration: 0.05, volume: volume * 0.04, filterFreq: 2200, filterType: "highpass", pan });
        return;
      case "dash":
        this.tone(context, { type: "triangle", startFreq: 480 * pitch, endFreq: 130 * pitch, duration: 0.11, volume: volume * 0.2, filterFreq: 1400, pan });
        this.noise(context, { duration: 0.035, volume: volume * 0.035, filterFreq: 1800, filterType: "highpass", pan });
        return;
      case "shield-hit":
        this.tone(context, { type: "triangle", startFreq: 510 * pitch, endFreq: 360 * pitch, duration: 0.07, volume: volume * 0.12, filterFreq: 2200, pan });
        return;
      case "shield-break":
        this.noise(context, { duration: 0.18, volume: volume * 0.08, filterFreq: 1300, filterType: "bandpass", pan });
        this.tone(context, { type: "square", startFreq: 340 * pitch, endFreq: 70 * pitch, duration: 0.24, volume: volume * 0.16, filterFreq: 1200, pan });
        this.tone(context, { type: "triangle", startFreq: 180 * pitch, endFreq: 60 * pitch, duration: 0.16, volume: volume * 0.1, filterFreq: 900, pan, startOffset: 0.04 });
        return;
      case "shield-recharge":
        this.playArpeggio(context, [220, 278, 330], "triangle", volume * 0.11, pan, pitch, 0.075, 2200);
        return;
      case "heal-cast":
        this.playArpeggio(context, [300, 378, 450], "triangle", volume * 0.12, pan, pitch, 0.08, 1800);
        this.tone(context, { type: "sine", startFreq: 220 * pitch, endFreq: 320 * pitch, duration: 0.18, volume: volume * 0.07, filterFreq: 1400, pan });
        return;
      case "support-bolt":
        this.tone(context, { type: "triangle", startFreq: 560 * pitch, endFreq: 320 * pitch, duration: 0.08, volume: volume * 0.14, filterFreq: 2000, pan });
        return;
      case "guard-pulse":
        this.tone(context, { type: "square", startFreq: 220 * pitch, endFreq: 100 * pitch, duration: 0.18, volume: volume * 0.18, filterFreq: 1100, pan });
        this.playArpeggio(context, [210, 252, 300], "triangle", volume * 0.08, pan, pitch, 0.06, 1400);
        return;
      case "guard-shot":
        this.tone(context, { type: "square", startFreq: 330 * pitch, endFreq: 170 * pitch, duration: 0.08, volume: volume * 0.18, filterFreq: 1500, pan });
        return;
      case "shield-bash":
        this.noise(context, { duration: 0.07, volume: volume * 0.06, filterFreq: 950, filterType: "bandpass", pan });
        this.tone(context, { type: "square", startFreq: 170 * pitch, endFreq: 80 * pitch, duration: 0.1, volume: volume * 0.16, filterFreq: 900, pan });
        return;
      case "melee-slash":
        this.noise(context, { duration: 0.05, volume: volume * 0.06, filterFreq: 1500, filterType: "highpass", pan });
        this.tone(context, { type: "sawtooth", startFreq: 240 * pitch, endFreq: 110 * pitch, duration: 0.09, volume: volume * 0.14, filterFreq: 1600, pan });
        return;
      case "caster-arc":
        this.tone(context, { type: "sawtooth", startFreq: 700 * pitch, endFreq: 240 * pitch, duration: 0.16, volume: volume * 0.2, filterFreq: 2400, pan });
        this.tone(context, { type: "triangle", startFreq: 420 * pitch, endFreq: 210 * pitch, duration: 0.14, volume: volume * 0.1, filterFreq: 1800, pan, startOffset: 0.02 });
        return;
      case "demolition-shot":
        this.tone(context, { type: "square", startFreq: 170 * pitch, endFreq: 74 * pitch, duration: 0.18, volume: volume * 0.2, filterFreq: 900, pan });
        this.noise(context, { duration: 0.08, volume: volume * 0.06, filterFreq: 700, filterType: "lowpass", pan });
        return;
      case "ranged-volley":
        this.tone(context, { type: "square", startFreq: 610 * pitch, endFreq: 350 * pitch, duration: 0.055, volume: volume * 0.16, filterFreq: 2400, pan });
        return;
      case "boss-burst":
        this.tone(context, { type: "square", startFreq: 170 * pitch, endFreq: 90 * pitch, duration: 0.22, volume: volume * 0.18, filterFreq: 900, pan });
        this.playArpeggio(context, [160, 120, 96], "triangle", volume * 0.08, pan, pitch, 0.08, 1000);
        this.noise(context, { duration: 0.1, volume: volume * 0.04, filterFreq: 800, filterType: "lowpass", pan });
        return;
      case "loot-burst":
        this.playArpeggio(context, [392, 494, 659, 784], "square", volume * 0.1, pan, pitch, 0.065, 2600);
        return;
      case "companion-revive":
        this.playArpeggio(context, [262, 330, 392], "triangle", volume * 0.11, pan, pitch, 0.085, 1800);
        return;
      default:
        return;
    }
  }

  private isAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    const webkitWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    return Boolean(window.AudioContext || webkitWindow.webkitAudioContext);
  }

  private ensureContext(): AudioContext | null {
    if (!this.isAvailable()) {
      return null;
    }

    if (this.context) {
      return this.context;
    }

    const webkitWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext || webkitWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    this.context = new AudioContextCtor();
    return this.context;
  }

  private removeUnlockListeners(): void {
    if (typeof window === "undefined" || !this.unlockHandler) {
      return;
    }

    window.removeEventListener("pointerdown", this.unlockHandler);
    window.removeEventListener("touchstart", this.unlockHandler);
    window.removeEventListener("keydown", this.unlockHandler);
    this.unlockHandler = undefined;
  }

  private async resumeContext(): Promise<void> {
    const context = this.ensureContext();
    if (!context || context.state !== "suspended") {
      return;
    }

    await context.resume().catch(() => undefined);
  }

  private getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const buffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private createOutputNode(context: AudioContext, pan: number): OutputNode {
    const stereoContext = context as AudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (typeof stereoContext.createStereoPanner === "function") {
      const panner = stereoContext.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(context.destination);
      return {
        node: panner,
        cleanup: () => {
          panner.disconnect();
        },
      };
    }

    return {
      node: context.destination,
      cleanup: () => undefined,
    };
  }

  private getSfxVolume(multiplier: number): number {
    const { master, sfx } = gameSession.settings.audio;
    return Math.max(0, Math.min(1, (master / 100) * (sfx / 100) * multiplier));
  }

  private tone(context: AudioContext, params: ToneParams): void {
    const startTime = context.currentTime + (params.startOffset ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = params.type;
    oscillator.frequency.setValueAtTime(Math.max(30, params.startFreq), startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, params.endFreq ?? params.startFreq), startTime + params.duration);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(params.filterFreq ?? 2600, startTime);
    filter.Q.value = 0.7;

    const gain = context.createGain();
    const attack = params.attack ?? 0.004;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(params.volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + params.duration);

    const output = this.createOutputNode(context, params.pan ?? 0);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output.node);

    oscillator.onended = () => {
      oscillator.disconnect();
      filter.disconnect();
      gain.disconnect();
      output.cleanup();
    };

    oscillator.start(startTime);
    oscillator.stop(startTime + params.duration + 0.02);
  }

  private noise(context: AudioContext, params: NoiseParams): void {
    const startTime = context.currentTime + (params.startOffset ?? 0);
    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer(context);
    source.playbackRate.setValueAtTime(params.playbackRate ?? 1, startTime);

    const filter = context.createBiquadFilter();
    filter.type = params.filterType ?? "lowpass";
    filter.frequency.setValueAtTime(params.filterFreq ?? 1400, startTime);
    filter.Q.value = 0.7;

    const gain = context.createGain();
    const attack = params.attack ?? 0.002;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(params.volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + params.duration);

    const output = this.createOutputNode(context, params.pan ?? 0);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output.node);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      output.cleanup();
    };

    source.start(startTime);
    source.stop(startTime + params.duration + 0.02);
  }

  private playArpeggio(
    context: AudioContext,
    freqs: number[],
    type: OscillatorType,
    volume: number,
    pan: number,
    pitch: number,
    noteDuration: number,
    filterFreq: number,
  ): void {
    freqs.forEach((frequency, index) => {
      this.tone(context, {
        type,
        startFreq: frequency * pitch,
        endFreq: frequency * pitch * 0.98,
        duration: noteDuration,
        volume,
        pan,
        filterFreq,
        startOffset: index * noteDuration * 0.72,
      });
    });
  }
}

export const retroSfx = new RetroSfxManager();
