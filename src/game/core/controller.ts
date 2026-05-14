import Phaser from "phaser";

export type ControllerButtonName =
  | "south"
  | "east"
  | "west"
  | "north"
  | "leftShoulder"
  | "rightShoulder"
  | "leftTrigger"
  | "rightTrigger"
  | "back"
  | "start"
  | "leftStickPress"
  | "rightStickPress"
  | "dpadUp"
  | "dpadDown"
  | "dpadLeft"
  | "dpadRight";

export type ControllerNavDirection = "up" | "down" | "left" | "right";

const BUTTON_INDEX: Record<Exclude<ControllerButtonName, "leftTrigger" | "rightTrigger">, number> = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftShoulder: 4,
  rightShoulder: 5,
  back: 8,
  start: 9,
  leftStickPress: 10,
  rightStickPress: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
};

const STICK_DEADZONE = 0.22;
const NAV_STICK_THRESHOLD = 0.55;
const TRIGGER_THRESHOLD = 0.35;
const NAV_REPEAT_INITIAL_MS = 220;
const NAV_REPEAT_MS = 140;

function normalizeStick(x: number, y: number, deadzone = STICK_DEADZONE): Phaser.Math.Vector2 {
  const vector = new Phaser.Math.Vector2(x, y);
  const length = vector.length();
  if (!Number.isFinite(length) || length <= deadzone) {
    return new Phaser.Math.Vector2(0, 0);
  }

  const scaled = Phaser.Math.Clamp((length - deadzone) / Math.max(0.0001, 1 - deadzone), 0, 1);
  return vector.normalize().scale(scaled);
}

function isButtonPressed(button: GamepadButton | undefined): boolean {
  return Boolean(button?.pressed || (button?.value ?? 0) >= 0.5);
}

function getButtonValue(button: GamepadButton | undefined): number {
  return Phaser.Math.Clamp(button?.value ?? 0, 0, 1);
}

type NavRepeatState = {
  down: boolean;
  nextRepeatAtMs: number;
};

export class ControllerInput {
  private readonly leftStick = new Phaser.Math.Vector2();
  private readonly rightStick = new Phaser.Math.Vector2();
  private readonly justPressed = new Set<ControllerButtonName>();
  private readonly justReleased = new Set<ControllerButtonName>();
  private readonly buttonDown = new Map<ControllerButtonName, boolean>();
  private readonly navPressed = new Set<ControllerNavDirection>();
  private readonly navState: Record<ControllerNavDirection, NavRepeatState> = {
    up: { down: false, nextRepeatAtMs: 0 },
    down: { down: false, nextRepeatAtMs: 0 },
    left: { down: false, nextRepeatAtMs: 0 },
    right: { down: false, nextRepeatAtMs: 0 },
  };

  private connected = false;
  private usedThisFrame = false;
  private gamepadId = "";

  update(nowMs: number): void {
    this.justPressed.clear();
    this.justReleased.clear();
    this.navPressed.clear();
    this.usedThisFrame = false;

    const gamepad = this.getPrimaryGamepad();
    if (!gamepad) {
      this.connected = false;
      this.gamepadId = "";
      this.leftStick.set(0, 0);
      this.rightStick.set(0, 0);
      this.resetNavState();
      this.clearButtons();
      return;
    }

    this.connected = true;
    this.gamepadId = gamepad.id;

    const nextLeftStick = normalizeStick(gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0);
    const nextRightStick = normalizeStick(gamepad.axes[2] ?? 0, gamepad.axes[3] ?? 0);
    this.leftStick.copy(nextLeftStick);
    this.rightStick.copy(nextRightStick);

    const nextButtonState: Record<ControllerButtonName, boolean> = {
      south: isButtonPressed(gamepad.buttons[BUTTON_INDEX.south]),
      east: isButtonPressed(gamepad.buttons[BUTTON_INDEX.east]),
      west: isButtonPressed(gamepad.buttons[BUTTON_INDEX.west]),
      north: isButtonPressed(gamepad.buttons[BUTTON_INDEX.north]),
      leftShoulder: isButtonPressed(gamepad.buttons[BUTTON_INDEX.leftShoulder]),
      rightShoulder: isButtonPressed(gamepad.buttons[BUTTON_INDEX.rightShoulder]),
      leftTrigger: getButtonValue(gamepad.buttons[6]) >= TRIGGER_THRESHOLD,
      rightTrigger: getButtonValue(gamepad.buttons[7]) >= TRIGGER_THRESHOLD,
      back: isButtonPressed(gamepad.buttons[BUTTON_INDEX.back]),
      start: isButtonPressed(gamepad.buttons[BUTTON_INDEX.start]),
      leftStickPress: isButtonPressed(gamepad.buttons[BUTTON_INDEX.leftStickPress]),
      rightStickPress: isButtonPressed(gamepad.buttons[BUTTON_INDEX.rightStickPress]),
      dpadUp: isButtonPressed(gamepad.buttons[BUTTON_INDEX.dpadUp]),
      dpadDown: isButtonPressed(gamepad.buttons[BUTTON_INDEX.dpadDown]),
      dpadLeft: isButtonPressed(gamepad.buttons[BUTTON_INDEX.dpadLeft]),
      dpadRight: isButtonPressed(gamepad.buttons[BUTTON_INDEX.dpadRight]),
    };

    (Object.keys(nextButtonState) as ControllerButtonName[]).forEach((name) => {
      const wasDown = this.buttonDown.get(name) ?? false;
      const isDown = nextButtonState[name];
      if (isDown && !wasDown) {
        this.justPressed.add(name);
      } else if (!isDown && wasDown) {
        this.justReleased.add(name);
      }
      this.buttonDown.set(name, isDown);
    });

    this.updateNavState("up", nextButtonState.dpadUp || nextLeftStick.y <= -NAV_STICK_THRESHOLD, nowMs);
    this.updateNavState("down", nextButtonState.dpadDown || nextLeftStick.y >= NAV_STICK_THRESHOLD, nowMs);
    this.updateNavState("left", nextButtonState.dpadLeft || nextLeftStick.x <= -NAV_STICK_THRESHOLD, nowMs);
    this.updateNavState("right", nextButtonState.dpadRight || nextLeftStick.x >= NAV_STICK_THRESHOLD, nowMs);

    this.usedThisFrame = this.justPressed.size > 0
      || this.navPressed.size > 0
      || nextLeftStick.lengthSq() > 0.01
      || nextRightStick.lengthSq() > 0.01;
  }

  isConnected(): boolean {
    return this.connected;
  }

  wasUsedThisFrame(): boolean {
    return this.usedThisFrame;
  }

  getGamepadId(): string {
    return this.gamepadId;
  }

  getLeftStick(): Phaser.Math.Vector2 {
    return this.leftStick.clone();
  }

  getRightStick(): Phaser.Math.Vector2 {
    return this.rightStick.clone();
  }

  isDown(button: ControllerButtonName): boolean {
    return this.buttonDown.get(button) ?? false;
  }

  wasPressed(button: ControllerButtonName): boolean {
    return this.justPressed.has(button);
  }

  wasReleased(button: ControllerButtonName): boolean {
    return this.justReleased.has(button);
  }

  wasNavigatePressed(direction: ControllerNavDirection): boolean {
    return this.navPressed.has(direction);
  }

  private updateNavState(direction: ControllerNavDirection, isDown: boolean, nowMs: number): void {
    const state = this.navState[direction];
    if (isDown) {
      if (!state.down) {
        state.down = true;
        state.nextRepeatAtMs = nowMs + NAV_REPEAT_INITIAL_MS;
        this.navPressed.add(direction);
        return;
      }

      if (nowMs >= state.nextRepeatAtMs) {
        state.nextRepeatAtMs = nowMs + NAV_REPEAT_MS;
        this.navPressed.add(direction);
      }
      return;
    }

    state.down = false;
    state.nextRepeatAtMs = 0;
  }

  private clearButtons(): void {
    this.buttonDown.clear();
    this.justPressed.clear();
    this.justReleased.clear();
  }

  private resetNavState(): void {
    (Object.keys(this.navState) as ControllerNavDirection[]).forEach((direction) => {
      this.navState[direction].down = false;
      this.navState[direction].nextRepeatAtMs = 0;
    });
  }

  private getPrimaryGamepad(): Gamepad | null {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
      return null;
    }

    const gamepads = navigator.getGamepads();
    let fallback: Gamepad | null = null;
    for (const gamepad of gamepads) {
      if (!gamepad || !gamepad.connected) {
        continue;
      }
      if (gamepad.mapping === "standard") {
        return gamepad;
      }
      fallback ??= gamepad;
    }

    return fallback;
  }
}
