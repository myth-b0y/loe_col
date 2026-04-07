import Phaser from "phaser";

import {
  FIRST_MISSION,
  missionRegistry,
  type BossStage,
  type HallwayStage,
  type MissionDefinition,
  type MissionEnemyKind,
  type MissionHallwayZone,
  type MissionStage,
  type RestStage,
} from "../content/missions";
import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

type BulletOwner = "player" | "companion" | "enemy";
type EnemyKind = MissionEnemyKind | "boss";
type ActorSide = "player" | "companion";

type Bullet = {
  sprite: Phaser.GameObjects.Arc;
  velocity: Phaser.Math.Vector2;
  life: number;
  damage: number;
  radius: number;
  owner: BulletOwner;
};

type Enemy = {
  kind: EnemyKind;
  sprite: Phaser.GameObjects.Arc;
  aura: Phaser.GameObjects.Arc;
  shieldRing: Phaser.GameObjects.Arc;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRegenDelay: number;
  shieldRegenRate: number;
  radius: number;
  speed: number;
  attackCooldown: number;
  specialCooldown: number;
  chargeTimer: number;
  damageFlash: number;
  stateTimer: number;
  roleColor: number;
  strafeDir: -1 | 1;
  spawnedAdds: boolean;
};

type HallwayZoneRuntime = {
  data: MissionHallwayZone;
  activated: boolean;
  marker: Phaser.GameObjects.Rectangle;
};

type DoorUi = {
  glow: Phaser.GameObjects.Rectangle;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  open: boolean;
  extraction: boolean;
};

type RestStations = {
  healPad: Phaser.GameObjects.Rectangle;
  healText: Phaser.GameObjects.Text;
  supplyPad: Phaser.GameObjects.Rectangle;
  supplyText: Phaser.GameObjects.Text;
};

type AbilityCard = {
  frame: Phaser.GameObjects.Rectangle;
  cooldownMask: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
};

const BASE_STAGE_BOUNDS = new Phaser.Geom.Rectangle(110, 174, 1500, 338);
const BASE_REST_BOUNDS = new Phaser.Geom.Rectangle(140, 150, 820, 420);
const MOVE_SPEED = 315;
const DASH_DISTANCE = 128;
const PRIMARY_FIRE_COOLDOWN = 0.16;
const PULSE_COOLDOWN = 2.8;
const ARC_COOLDOWN = 4.5;
const DASH_COOLDOWN = 1.25;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;
const TARGET_LOCK_RANGE = 520;
const PLAYER_SHIELD_REGEN_DELAY = 2.4;
const PLAYER_SHIELD_REGEN_RATE = 18;
const COMPANION_SHIELD_REGEN_DELAY = 2.6;
const COMPANION_SHIELD_REGEN_RATE = 16;
const ENEMY_SHIELD_REGEN_DELAY = 2.9;
const COMPANION_REVIVE_TIME = 6;

function cloneRect(rect: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(rect.x, rect.y, rect.width, rect.height);
}

export class MissionScene extends Phaser.Scene {
  private mission: MissionDefinition = FIRST_MISSION;
  private brightnessLayer?: BrightnessLayer;
  private stageIndex = 0;
  private missionComplete = false;
  private stageCleared = false;
  private bossTriggered = false;
  private transitioningStage = false;
  private currentStage?: MissionStage;
  private playArea = cloneRect(BASE_STAGE_BOUNDS);
  private stageObjects: Phaser.GameObjects.GameObject[] = [];
  private hallwayZones: HallwayZoneRuntime[] = [];
  private restStations?: RestStations;
  private exitDoor?: DoorUi;
  private restHealed = false;
  private supplyHintShown = false;

  private player!: Phaser.GameObjects.Arc;
  private playerFacing!: Phaser.GameObjects.Rectangle;
  private playerShieldRing!: Phaser.GameObjects.Arc;
  private companion!: Phaser.GameObjects.Arc;
  private companionShieldRing!: Phaser.GameObjects.Arc;
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerShield = 60;
  private playerMaxShield = 60;
  private playerShieldDelay = 0;
  private playerInvuln = 0;
  private companionHp = 72;
  private companionMaxHp = 72;
  private companionShield = 44;
  private companionMaxShield = 44;
  private companionShieldDelay = 0;
  private companionReviveTimer = 0;
  private companionDowned = false;
  private fireCooldown = 0;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private arcCooldown = 0;
  private companionCooldown = 0;

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private fireHeld = false;

  private touchCapable = false;
  private touchMode = false;
  private moveKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    pulse: Phaser.Input.Keyboard.Key;
    arc: Phaser.Input.Keyboard.Key;
    dash: Phaser.Input.Keyboard.Key;
  };
  private keyboardVector = new Phaser.Math.Vector2();
  private moveVector = new Phaser.Math.Vector2();
  private aimVector = new Phaser.Math.Vector2(1, 0);
  private lookPoint = new Phaser.Math.Vector2(640, 360);
  private movePointerId: number | null = null;
  private attackPointerId: number | null = null;
  private moveBase?: Phaser.GameObjects.Arc;
  private moveKnob?: Phaser.GameObjects.Arc;
  private attackButton?: MenuButton;
  private targetButton?: MenuButton;
  private pulseButton?: MenuButton;
  private dashButton?: MenuButton;
  private arcButton?: MenuButton;
  private pauseButton?: MenuButton;
  private touchUiObjects: Phaser.GameObjects.GameObject[] = [];
  private desktopUiObjects: Phaser.GameObjects.GameObject[] = [];

  private aimLine!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Arc;
  private lockRing!: Phaser.GameObjects.Arc;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private shieldFill!: Phaser.GameObjects.Rectangle;
  private companionHpFill!: Phaser.GameObjects.Rectangle;
  private companionShieldFill!: Phaser.GameObjects.Rectangle;
  private companionStateText!: Phaser.GameObjects.Text;
  private bossFill!: Phaser.GameObjects.Rectangle;
  private bossFrame!: Phaser.GameObjects.Rectangle;
  private bossTitle!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private selectedTarget: Enemy | null = null;
  private autoAimTarget: Enemy | null = null;
  private toolbarCards?: {
    fire: AbilityCard;
    pulse: AbilityCard;
    arc: AbilityCard;
    dash: AbilityCard;
  };

  constructor() {
    super("mission");
  }

  init(data: { missionId?: string }): void {
    this.resetMissionRuntime();
    this.mission = missionRegistry[data.missionId ?? FIRST_MISSION.id] ?? FIRST_MISSION;
  }

  create(): void {
    this.touchCapable = this.sys.game.device.input.touch;
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    this.cameras.main.setBackgroundColor("#050911");
    this.brightnessLayer = createBrightnessLayer(this);
    this.createActors();
    this.createHud();
    this.createTouchUi();
    this.syncInputMode();
    this.bindKeyboard();
    this.bindPointers();
    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(120, 40);
    this.loadStage(0);

    const syncInputMode = (): void => this.syncInputMode();
    gameSession.on("settings-changed", syncInputMode);
    gameSession.on("input-mode-changed", syncInputMode);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameSession.off("settings-changed", syncInputMode);
      gameSession.off("input-mode-changed", syncInputMode);
      this.brightnessLayer?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.arcCooldown = Math.max(0, this.arcCooldown - dt);
    this.companionCooldown = Math.max(0, this.companionCooldown - dt);
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.playerShieldDelay = Math.max(0, this.playerShieldDelay - dt);
    this.companionShieldDelay = Math.max(0, this.companionShieldDelay - dt);

    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateFacing();
    this.updateShieldStates(dt);
    this.handleFiring();
    this.updateCompanion(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateStageState();
    this.updateHudState();
  }

  private resetMissionRuntime(): void {
    this.stageIndex = 0;
    this.missionComplete = false;
    this.stageCleared = false;
    this.bossTriggered = false;
    this.transitioningStage = false;
    this.currentStage = undefined;
    this.playArea = cloneRect(BASE_STAGE_BOUNDS);
    this.stageObjects = [];
    this.hallwayZones = [];
    this.restStations = undefined;
    this.exitDoor = undefined;
    this.restHealed = false;
    this.supplyHintShown = false;

    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerShield = 60;
    this.playerMaxShield = 60;
    this.playerShieldDelay = 0;
    this.playerInvuln = 0;
    this.companionHp = 72;
    this.companionMaxHp = 72;
    this.companionShield = 44;
    this.companionMaxShield = 44;
    this.companionShieldDelay = 0;
    this.companionReviveTimer = 0;
    this.companionDowned = false;
    this.fireCooldown = 0;
    this.pulseCooldown = 0;
    this.dashCooldown = 0;
    this.arcCooldown = 0;
    this.companionCooldown = 0;

    this.bullets = [];
    this.enemies = [];
    this.fireHeld = false;

    this.keyboardVector.set(0, 0);
    this.moveVector.set(0, 0);
    this.aimVector.set(1, 0);
    this.lookPoint.set(640, 360);

    this.movePointerId = null;
    this.attackPointerId = null;
    this.moveBase = undefined;
    this.moveKnob = undefined;
    this.attackButton = undefined;
    this.targetButton = undefined;
    this.pulseButton = undefined;
    this.dashButton = undefined;
    this.arcButton = undefined;
    this.pauseButton = undefined;
    this.touchUiObjects = [];
    this.desktopUiObjects = [];
    this.selectedTarget = null;
    this.autoAimTarget = null;
    this.moveKeys = undefined;
    this.toolbarCards = undefined;
  }

  private createActors(): void {
    this.player = this.add.circle(210, 342, 18, 0xf2f7ff).setDepth(10);
    this.player.setStrokeStyle(4, 0x7caeff, 1);
    this.playerShieldRing = this.add.circle(this.player.x, this.player.y, 26)
      .setStrokeStyle(4, 0x65d8ff, 0.82)
      .setDepth(9);

    this.playerFacing = this.add.rectangle(this.player.x + 26, this.player.y, 34, 8, 0x7ee1ff)
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.companion = this.add.circle(this.player.x - 48, this.player.y + 38, 12, 0xf3cc7a).setDepth(9);
    this.companion.setStrokeStyle(3, 0xfff1ba, 1);
    this.companionShieldRing = this.add.circle(this.companion.x, this.companion.y, 19)
      .setStrokeStyle(3, 0x7de6ff, 0.78)
      .setDepth(8);
    this.companion.setVisible(gameSession.getModeRules().companionsEnabled);
    this.companionShieldRing.setVisible(gameSession.getModeRules().companionsEnabled);

    this.aimLine = this.add.graphics().setDepth(8);
    this.reticle = this.add.circle(this.lookPoint.x, this.lookPoint.y, 14, 0x7ee1ff, 0.14).setDepth(8);
    this.reticle.setStrokeStyle(3, 0xbef2ff, 0.82);
    this.lockRing = this.add.circle(this.lookPoint.x, this.lookPoint.y, 24).setStrokeStyle(3, 0xffd36d, 0.92).setDepth(8);
    this.lockRing.setVisible(false);
  }

  private createHud(): void {
    this.pin(this.add.rectangle(640, 42, 1280, 70, 0x10182a, 0.96).setStrokeStyle(2, 0x4c709d, 0.8));
    this.pin(this.add.rectangle(640, 620, 1280, 62, 0x10182a, 0.92).setStrokeStyle(1, 0x304e74, 0.8));

    this.titleText = this.pin(this.add.text(96, 18, this.mission.title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f5fbff",
      fontStyle: "bold",
    }));

    this.objectiveText = this.pin(this.add.text(640, 18, this.mission.objective, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d7e8ff",
    }).setOrigin(0.5, 0));

    this.stageText = this.pin(this.add.text(96, 50, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    }));

    this.messageText = this.pin(this.add.text(640, 92, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d7e8ff",
      align: "center",
    }).setOrigin(0.5));

    this.pin(this.add.rectangle(170, 112, 168, 18, 0x08111c, 0.96).setStrokeStyle(2, 0x6ea2e5, 0.8));
    this.hpFill = this.pin(this.add.rectangle(86, 112, 160, 10, 0x47c56c, 0.96).setOrigin(0, 0.5));
    this.pin(this.add.text(86, 95, "Vital Light", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d7e8ff",
    }));
    this.pin(this.add.rectangle(170, 138, 168, 14, 0x08111c, 0.96).setStrokeStyle(2, 0x69d7ff, 0.72));
    this.shieldFill = this.pin(this.add.rectangle(86, 138, 160, 8, 0x69d7ff, 0.94).setOrigin(0, 0.5));
    this.pin(this.add.text(86, 124, "Aegis Shield", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#c2f2ff",
    }));
    this.pin(this.add.rectangle(170, 166, 168, 12, 0x08111c, 0.96).setStrokeStyle(2, 0xe2c483, 0.66));
    this.companionHpFill = this.pin(this.add.rectangle(86, 166, 160, 6, 0xdfc076, 0.92).setOrigin(0, 0.5));
    this.pin(this.add.rectangle(170, 182, 168, 10, 0x08111c, 0.96).setStrokeStyle(2, 0x7de6ff, 0.62));
    this.companionShieldFill = this.pin(this.add.rectangle(86, 182, 160, 5, 0x78e3ff, 0.9).setOrigin(0, 0.5));
    this.companionStateText = this.pin(this.add.text(86, 150, "Sera | Covering Fire", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#ffe7b5",
      fontStyle: "bold",
    }));

    this.progressDots = this.mission.stages.map((_stage, index) =>
      this.pin(this.add.circle(774 + index * 24, 56, 7, 0x29425f, 1)),
    );

    this.bossFrame = this.pin(this.add.rectangle(1010, 112, 250, 18, 0x08111c, 0.96)
      .setStrokeStyle(2, 0xc8a7ff, 0.84)
      .setVisible(false));
    this.bossFill = this.pin(this.add.rectangle(886, 112, 242, 10, 0x9f68ff, 0.95)
      .setOrigin(0, 0.5)
      .setVisible(false));
    this.bossTitle = this.pin(this.add.text(886, 94, "Shard Bruiser", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#eadfff",
    }).setVisible(false));

    this.pauseButton = createMenuButton({
      scene: this,
      x: 1132,
      y: 56,
      width: 110,
      height: 38,
      label: "Pause",
      onClick: () => this.openPauseMenu(),
      depth: 12,
      accentColor: 0x233956,
    });
    this.pauseButton.container.setScrollFactor(0);

    this.toolbarCards = {
      fire: this.createAbilityCard(296, 652, "Primary Fire", "LMB Hold | Ready"),
      pulse: this.createAbilityCard(516, 652, "Pulse Burst", "Q | Ready"),
      arc: this.createAbilityCard(736, 652, "Arc Lance", "E | Ready"),
      dash: this.createAbilityCard(956, 652, "Dash Step", "Shift / RMB | Ready"),
    };
  }

  private createTouchUi(): void {
    if (!this.touchCapable) {
      return;
    }

    this.moveBase = this.pin(this.add.circle(148, 566, STICK_RADIUS, 0x173054, 0.36).setDepth(14));
    this.moveBase.setStrokeStyle(3, 0x72a8ff, 0.65);
    this.moveKnob = this.pin(this.add.circle(148, 566, 34, 0xdde9ff, 0.72).setDepth(15));
    this.moveKnob.setStrokeStyle(2, 0xffffff, 0.9);

    const moveLabel = this.pin(this.add.text(148, 470, "MOVE / FACE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15));

    const attackLabel = this.pin(this.add.text(1114, 470, "ATTACK", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15));

    this.attackButton = createMenuButton({
      scene: this,
      x: 1114,
      y: 566,
      width: 150,
      height: 68,
      label: "Attack",
      onClick: () => undefined,
      onPress: (pointer) => this.beginTouchAttack(pointer),
      onRelease: (pointer) => this.endTouchAttack(pointer),
      depth: 15,
      accentColor: 0x1f5a87,
    });
    this.attackButton.container.setScrollFactor(0);

    this.targetButton = createMenuButton({
      scene: this,
      x: 1188,
      y: 486,
      width: 112,
      height: 52,
      label: "Target",
      onClick: () => this.cycleTargetLock(),
      depth: 15,
      accentColor: 0x2b4966,
    });
    this.targetButton.container.setScrollFactor(0);

    this.pulseButton = createMenuButton({
      scene: this,
      x: 922,
      y: 572,
      width: 134,
      height: 62,
      label: "Pulse",
      onClick: () => this.castPulse(),
      depth: 15,
      accentColor: 0x166b8c,
    });
    this.pulseButton.container.setScrollFactor(0);

    this.arcButton = createMenuButton({
      scene: this,
      x: 942,
      y: 494,
      width: 126,
      height: 54,
      label: "Arc",
      onClick: () => this.castArcLance(),
      depth: 15,
      accentColor: 0x7a5f1d,
    });
    this.arcButton.container.setScrollFactor(0);

    this.dashButton = createMenuButton({
      scene: this,
      x: 1060,
      y: 420,
      width: 122,
      height: 54,
      label: "Dash",
      onClick: () => this.tryDash(),
      depth: 15,
      accentColor: 0x63408f,
    });
    this.dashButton.container.setScrollFactor(0);

    this.touchUiObjects.push(
      this.moveBase,
      this.moveKnob,
      moveLabel,
      attackLabel,
      this.attackButton.container,
      this.targetButton.container,
      this.pulseButton.container,
      this.arcButton.container,
      this.dashButton.container,
    );
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.moveKeys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      pulse: Phaser.Input.Keyboard.KeyCodes.Q,
      arc: Phaser.Input.Keyboard.KeyCodes.E,
      dash: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }) as typeof this.moveKeys;

    keyboard.on("keydown-Q", () => {
      this.reportDesktopInput();
      this.castPulse();
    });
    keyboard.on("keydown-E", () => {
      this.reportDesktopInput();
      this.castArcLance();
    });
    keyboard.on("keydown-TAB", (event: KeyboardEvent) => {
      event.preventDefault();
      this.reportDesktopInput();
      this.cycleTargetLock();
    });
    keyboard.on("keydown-SHIFT", () => {
      this.reportDesktopInput();
      this.tryDash();
    });
    keyboard.on("keydown-ESC", () => {
      this.reportDesktopInput();
      this.openPauseMenu();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-Q");
      keyboard.removeAllListeners("keydown-E");
      keyboard.removeAllListeners("keydown-TAB");
      keyboard.removeAllListeners("keydown-SHIFT");
      keyboard.removeAllListeners("keydown-ESC");
    });
  }

  private bindPointers(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.missionComplete || this.transitioningStage) {
        return;
      }

      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (this.touchMode && touchLike) {
        if (this.pointerOverUi(pointer)) {
          return;
        }

        if (this.movePointerId === null && this.moveBase && this.moveKnob) {
          this.movePointerId = pointer.id;
          this.anchorMoveStick(pointer.x, pointer.y);
          this.updateMoveStick(pointer);
        }

        return;
      }

      if (this.pointerOverUi(pointer)) {
        return;
      }

      if (pointer.rightButtonDown()) {
        this.reportDesktopInput();
        this.tryDash();
        return;
      }

      this.reportDesktopInput();
      this.fireHeld = true;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (this.touchMode && touchLike) {
        if (pointer.id === this.movePointerId && pointer.isDown) {
          this.updateMoveStick(pointer);
          return;
        }

        return;
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.touchMode && this.isTouchPointer(pointer)) {
        if (pointer.id === this.movePointerId) {
          this.movePointerId = null;
          this.moveVector.set(0, 0);
          this.resetMoveStick();
        }

        if (pointer.id === this.attackPointerId) {
          this.endTouchAttack(pointer);
        }
        return;
      }

      this.reportDesktopInput();
      this.fireHeld = false;
    });
  }
  private loadStage(index: number): void {
    this.stageIndex = index;
    this.currentStage = this.mission.stages[index];
    this.stageCleared = this.currentStage.type === "rest";
    this.bossTriggered = false;
    this.transitioningStage = false;
    this.restHealed = false;
    this.supplyHintShown = false;
    this.clearBullets();
    this.clearEnemies();
    this.clearStageObjects();
    this.releaseMissionControls();
    this.selectedTarget = null;
    this.autoAimTarget = null;
    this.restStations = undefined;
    this.exitDoor = undefined;
    this.messageText.setText(this.currentStage.type === "rest"
      ? `${this.currentStage.flavor} Combat is offline while you reset here.`
      : this.currentStage.flavor);

    const isRest = this.currentStage.type === "rest";
    const width = this.currentStage.width;
    this.playArea = cloneRect(isRest ? BASE_REST_BOUNDS : BASE_STAGE_BOUNDS);
    this.playArea.setPosition(isRest ? 120 : 110, isRest ? 146 : 174);
    this.playArea.width = width - (isRest ? 240 : 220);

    this.cameras.main.stopFollow();
    this.cameras.main.setBounds(0, 0, width, GAME_HEIGHT);
    this.cameras.main.setScroll(0, 0);

    this.buildStageLayout(this.currentStage);
    this.player.setPosition(this.playArea.x + 90, this.playArea.centerY);
    this.player.setAlpha(1);
    this.playerShieldRing.setPosition(this.player.x, this.player.y);
    this.companion.setPosition(this.player.x - 48, this.player.y + 38);
    this.companionShieldRing.setPosition(this.companion.x, this.companion.y);
    this.companion.setVisible(gameSession.getModeRules().companionsEnabled && !this.companionDowned);
    this.companionShieldRing.setVisible(gameSession.getModeRules().companionsEnabled && !this.companionDowned);
    this.lookPoint.set(this.player.x + 180, this.player.y);

    this.progressDots.forEach((dot, dotIndex) => {
      dot.setFillStyle(dotIndex < index ? 0x79abed : dotIndex === index ? 0xffd36d : 0x29425f, 1);
    });
    this.titleText.setText(this.mission.title);
    this.objectiveText.setText(this.mission.objective);
    this.stageText.setText(`Stage ${index + 1}/${this.mission.stages.length}: ${this.currentStage.name}`);

    if (this.currentStage.type === "hallway") {
      this.setupHallway(this.currentStage);
    } else if (this.currentStage.type === "rest") {
      this.setupRestRoom(this.currentStage);
    } else {
      this.setupBossRoom(this.currentStage);
    }

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
  }

  private buildStageLayout(stage: MissionStage): void {
    const base = this.add.rectangle(stage.width / 2, GAME_HEIGHT / 2, stage.width, GAME_HEIGHT, 0x070d16).setDepth(-14);
    this.stageObjects.push(base);

    const stars = this.add.graphics().setDepth(-13);
    stars.fillStyle(0xc6ddff, 0.9);
    const density = gameSession.settings.graphics.quality === "Performance"
      ? 0.48
      : gameSession.settings.graphics.quality === "Balanced"
        ? 0.68
        : 0.88;
    for (let i = 0; i < Math.max(12, Math.floor((stage.width / 28) * density)); i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(18, stage.width - 18),
        Phaser.Math.Between(16, GAME_HEIGHT - 16),
        Phaser.Math.FloatBetween(0.8, 2),
      );
    }
    this.stageObjects.push(stars);

    const upperWall = this.add.rectangle(stage.width / 2, this.playArea.y - 42, stage.width - 100, 120, 0x0b1523, 0.98)
      .setDepth(-10);
    const lowerWall = this.add.rectangle(stage.width / 2, this.playArea.bottom + 42, stage.width - 100, 120, 0x0b1523, 0.98)
      .setDepth(-10);
    const floor = this.add.rectangle(this.playArea.centerX, this.playArea.centerY, this.playArea.width, this.playArea.height, 0x121f34, 0.98)
      .setStrokeStyle(4, 0x78abed, 0.82)
      .setDepth(-8);
    this.stageObjects.push(upperWall, lowerWall, floor);

    const laneSpacing = gameSession.settings.graphics.quality === "Performance"
      ? 360
      : gameSession.settings.graphics.quality === "Balanced"
        ? 300
        : 240;
    for (let lineX = this.playArea.x + 160; lineX < this.playArea.right - 120; lineX += laneSpacing) {
      const line = this.add.rectangle(lineX, this.playArea.centerY, 14, this.playArea.height - 44, 0x1c304a, 0.6).setDepth(-7);
      this.stageObjects.push(line);
    }

    const startDoorX = this.playArea.x + 26;
    const exitDoorX = this.playArea.right - 26;

    const startGlow = this.add.rectangle(startDoorX, this.playArea.centerY, 76, 148, 0x56c8ff, 0.14).setDepth(-6);
    const startDoor = this.add.rectangle(startDoorX, this.playArea.centerY, 50, 134, 0x20486a, 0.96)
      .setStrokeStyle(3, 0x8be4ff, 0.72)
      .setDepth(-5);
    this.stageObjects.push(startGlow, startDoor);

    const doorGlow = this.add.rectangle(exitDoorX, this.playArea.centerY, 76, 148, 0xffcb68, 0.08).setDepth(2);
    const doorFrame = this.add.rectangle(exitDoorX, this.playArea.centerY, 50, 134, 0x473113, 0.94)
      .setStrokeStyle(3, 0xffcb68, 0.5)
      .setDepth(3);
    const doorLabel = this.add.text(exitDoorX - 58, this.playArea.y - 28, "Locked", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#efd8b0",
      fontStyle: "bold",
    }).setDepth(4);
    this.stageObjects.push(doorGlow, doorFrame, doorLabel);

    this.exitDoor = {
      glow: doorGlow,
      frame: doorFrame,
      label: doorLabel,
      open: false,
      extraction: stage.type === "boss",
    };

    this.setExitDoorOpen(stage.type === "rest", stage.type === "rest" ? "Ready" : "Locked");
  }

  private setupHallway(stage: HallwayStage): void {
    this.hallwayZones = stage.zones.map((zone) => {
      const marker = this.add.rectangle(zone.triggerX, this.playArea.centerY, 10, this.playArea.height - 36, 0x6fa8ef, 0.16)
        .setDepth(-6);
      this.stageObjects.push(marker);
      return { data: zone, activated: false, marker };
    });
  }

  private setupRestRoom(_stage: RestStage): void {
    const healPad = this.add.rectangle(this.playArea.centerX - 160, this.playArea.centerY, 134, 134, 0x173c2c, 0.94)
      .setStrokeStyle(3, 0x7ff3b1, 0.86)
      .setDepth(2);
    const healText = this.add.text(healPad.x, healPad.y - 10, "Med Bay", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#f4fff7",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(3);
    const healHint = this.add.text(healPad.x, healPad.y + 22, "Step in to heal", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#c5f3d6",
    }).setOrigin(0.5).setDepth(3);

    const supplyPad = this.add.rectangle(this.playArea.centerX + 160, this.playArea.centerY, 134, 134, 0x3b2d18, 0.94)
      .setStrokeStyle(3, 0xffd36d, 0.86)
      .setDepth(2);
    const supplyText = this.add.text(supplyPad.x, supplyPad.y - 10, "Supply Locker", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#fff8e9",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(3);
    const supplyHint = this.add.text(supplyPad.x, supplyPad.y + 22, "Ammo system later", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#f4dfab",
    }).setOrigin(0.5).setDepth(3);

    this.stageObjects.push(healPad, healText, healHint, supplyPad, supplyText, supplyHint);
    this.restStations = {
      healPad,
      healText,
      supplyPad,
      supplyText,
    };
    this.messageText.setText("Rest room secured. Heal up, check supplies, then move through the next door.");
  }

  private setupBossRoom(stage: BossStage): void {
    const triggerMarker = this.add.rectangle(stage.triggerX, this.playArea.centerY, 12, this.playArea.height - 36, 0xc8a7ff, 0.2)
      .setDepth(-6);
    this.stageObjects.push(triggerMarker);
    this.messageText.setText("Advance into the relay heart. The brute should wake once you cross the core threshold.");
  }
  private updateKeyboardVector(): void {
    this.keyboardVector.set(0, 0);
    if (!this.moveKeys || this.missionComplete || this.transitioningStage) {
      return;
    }

    if (this.moveKeys.left.isDown) {
      this.keyboardVector.x -= 1;
    }
    if (this.moveKeys.right.isDown) {
      this.keyboardVector.x += 1;
    }
    if (this.moveKeys.up.isDown) {
      this.keyboardVector.y -= 1;
    }
    if (this.moveKeys.down.isDown) {
      this.keyboardVector.y += 1;
    }

    if (this.keyboardVector.lengthSq() > 0) {
      this.keyboardVector.normalize();
      this.reportDesktopInput();
    }
  }

  private updateMovement(dt: number): void {
    if (this.missionComplete || this.transitioningStage) {
      return;
    }

    const movement = this.moveVector.lengthSq() > 0.01 ? this.moveVector : this.keyboardVector;
    this.player.x = Phaser.Math.Clamp(this.player.x + movement.x * MOVE_SPEED * dt, this.playArea.x + 20, this.playArea.right - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y + movement.y * MOVE_SPEED * dt, this.playArea.y + 20, this.playArea.bottom - 20);
    this.player.setAlpha(this.playerInvuln > 0 ? 0.6 : 1);
    this.playerShieldRing.setPosition(this.player.x, this.player.y);
  }

  private updateFacing(): void {
    const direction = this.getBaseAimDirection();
    this.refreshAutoAimTarget(direction);

    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || direction.lengthSq() === 0) {
      direction.set(1, 0);
    }

    const reticleX = this.player.x + direction.x * 130;
    const reticleY = this.player.y + direction.y * 130;
    this.lookPoint.set(reticleX, reticleY);
    this.playerFacing.setPosition(this.player.x + direction.x * 26, this.player.y + direction.y * 26);
    this.playerFacing.setRotation(direction.angle());
    this.reticle.setPosition(reticleX, reticleY);

    this.aimLine.clear();
    this.aimLine.lineStyle(3, 0x7ee1ff, 0.28);
    this.aimLine.beginPath();
    this.aimLine.moveTo(this.player.x, this.player.y);
    this.aimLine.lineTo(reticleX, reticleY);
    this.aimLine.strokePath();
  }

  private updateShieldStates(dt: number): void {
    if (this.playerShield < this.playerMaxShield && this.playerShieldDelay <= 0) {
      this.playerShield = Math.min(this.playerMaxShield, this.playerShield + PLAYER_SHIELD_REGEN_RATE * dt);
    }

    if (!this.companionDowned && this.companionShield < this.companionMaxShield && this.companionShieldDelay <= 0) {
      this.companionShield = Math.min(this.companionMaxShield, this.companionShield + COMPANION_SHIELD_REGEN_RATE * dt);
    }
  }

  private handleFiring(): void {
    if (this.isCombatLocked() || this.fireCooldown > 0) {
      return;
    }

    const lockAutoFire = gameSession.settings.controls.autoFire && this.autoAimTarget !== null;
    if (!this.fireHeld && !lockAutoFire) {
      return;
    }

    this.fireCooldown = PRIMARY_FIRE_COOLDOWN;
    const direction = this.getCombatAimDirection();
    this.spawnBullet(this.player.x + direction.x * 24, this.player.y + direction.y * 24, direction, 560, 12, 5, "player", 0x7ee1ff);
  }

  private updateCompanion(dt: number): void {
    if (!gameSession.getModeRules().companionsEnabled) {
      this.companion.setVisible(false);
      this.companionShieldRing.setVisible(false);
      return;
    }

    if (this.companionDowned) {
      this.companionReviveTimer = Math.max(0, this.companionReviveTimer - dt);
      this.companion.setVisible(true);
      this.companionShieldRing.setVisible(false);
      this.companion.setFillStyle(0x5b4d3b, 0.92);
      this.companion.setAlpha(0.55 + Math.sin(this.time.now / 180) * 0.08);
      if (this.companionReviveTimer <= 0) {
        this.reviveCompanion(false);
      }
      return;
    }

    const desiredX = this.player.x - 44;
    const desiredY = this.player.y + 34;
    const smoothing = 1 - Math.exp(-dt * 6);
    this.companion.x = Phaser.Math.Linear(this.companion.x, desiredX, smoothing);
    this.companion.y = Phaser.Math.Linear(this.companion.y, desiredY, smoothing);
    this.companion.setVisible(true);
    this.companion.setFillStyle(0xf3cc7a, 1);
    this.companion.setAlpha(1);
    this.companionShieldRing.setVisible(this.companionShield > 0.5);
    this.companionShieldRing.setPosition(this.companion.x, this.companion.y);

    const target = this.getNearestEnemy(this.companion.x, this.companion.y, 340);
    if (!target || this.companionCooldown > 0 || this.currentStage?.type === "rest") {
      return;
    }

    this.companionCooldown = 0.62;
    const direction = new Phaser.Math.Vector2(target.sprite.x - this.companion.x, target.sprite.y - this.companion.y).normalize();
    this.spawnBullet(this.companion.x, this.companion.y, direction, 440, 10, 5, "companion", 0xffd779);
  }

  private updateEnemies(dt: number): void {
    const difficulty = gameSession.getDifficultyProfile();
    const stageIntensity = 1 + this.stageIndex * 0.08;

    this.enemies.forEach((enemy) => {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.specialCooldown = Math.max(0, enemy.specialCooldown - dt);
      enemy.chargeTimer = Math.max(0, enemy.chargeTimer - dt);
      enemy.damageFlash = Math.max(0, enemy.damageFlash - dt * 6);
      enemy.shieldRegenDelay = Math.max(0, enemy.shieldRegenDelay - dt);
      enemy.stateTimer += dt;
      if (enemy.shield < enemy.maxShield && enemy.shieldRegenDelay <= 0) {
        enemy.shield = Math.min(enemy.maxShield, enemy.shield + enemy.shieldRegenRate * dt);
      }

      enemy.aura.setPosition(enemy.sprite.x, enemy.sprite.y);
      enemy.aura.setScale(enemy.damageFlash > 0 ? 1.22 : 1, enemy.damageFlash > 0 ? 1.22 : 1);
      enemy.aura.setAlpha(enemy.damageFlash > 0 ? 0.4 : 0.26);
      enemy.sprite.setFillStyle(0x050608, enemy.damageFlash > 0 && gameSession.settings.graphics.hitFlash ? 0.5 : 1);
      enemy.shieldRing.setPosition(enemy.sprite.x, enemy.sprite.y);
      enemy.shieldRing.setVisible(enemy.shield > 0.5);
      enemy.shieldRing.setAlpha(enemy.damageFlash > 0 ? 0.96 : 0.74);

      const target = this.getEnemyFocusTarget(enemy);
      const toTarget = new Phaser.Math.Vector2(target.x - enemy.sprite.x, target.y - enemy.sprite.y);
      const distance = toTarget.length();
      const direction = distance > 0 ? toTarget.normalize() : new Phaser.Math.Vector2(1, 0);
      const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);

      if (enemy.kind === "rusher") {
        if (enemy.specialCooldown <= 0 && distance > 120 && distance < 360) {
          enemy.specialCooldown = 2.6 * difficulty.enemyCooldown;
          enemy.chargeTimer = 0.45;
        }

        const weave = perpendicular.scale(Math.sin(enemy.stateTimer * 5.6) * 0.35);
        const move = direction.clone().scale(enemy.chargeTimer > 0 ? 1.9 : 1).add(weave).normalize();
        enemy.sprite.x += move.x * enemy.speed * dt;
        enemy.sprite.y += move.y * enemy.speed * dt;

        if (distance < enemy.radius + target.radius && enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 0.9 * difficulty.enemyCooldown;
          if (target.side === "companion") {
            this.damageCompanion(Math.round((11 + Math.floor(this.stageIndex * 1.5)) * difficulty.enemyDamage));
          } else {
            this.damagePlayer(Math.round((11 + Math.floor(this.stageIndex * 1.5)) * difficulty.enemyDamage));
          }
        }
      } else if (enemy.kind === "shooter") {
        const desiredRange = 270;
        if (enemy.stateTimer > 1.4) {
          enemy.stateTimer = 0;
          enemy.strafeDir = enemy.strafeDir === 1 ? -1 : 1;
        }

        const rangeMove = distance > desiredRange + 40
          ? direction
          : distance < desiredRange - 70
            ? direction.clone().scale(-1)
            : new Phaser.Math.Vector2(0, 0);
        const strafe = perpendicular.scale(enemy.strafeDir * 0.9);
        const move = rangeMove.add(strafe).normalize();

        if (move.lengthSq() > 0) {
          enemy.sprite.x += move.x * enemy.speed * dt;
          enemy.sprite.y += move.y * enemy.speed * dt;
        }

        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1.2 * difficulty.enemyCooldown;
          this.spawnBullet(
            enemy.sprite.x,
            enemy.sprite.y,
            direction,
            280 + stageIntensity * 10,
            Math.round((9 + this.stageIndex) * difficulty.enemyDamage),
            6,
            "enemy",
            enemy.roleColor,
          );
        }
      } else {
        if (!enemy.spawnedAdds && enemy.hp < enemy.maxHp * 0.52) {
          enemy.spawnedAdds = true;
          this.spawnEnemy("rusher", enemy.sprite.x - 120, enemy.sprite.y - 40);
          this.spawnEnemy("rusher", enemy.sprite.x - 120, enemy.sprite.y + 40);
          this.spawnEnemy("shooter", enemy.sprite.x + 90, enemy.sprite.y);
          this.messageText.setText("The brute tears open fresh shadow spawn as it weakens.");
        }

        if (enemy.specialCooldown <= 0) {
          enemy.specialCooldown = (enemy.hp < enemy.maxHp * 0.5 ? 1.8 : 2.6) * difficulty.enemyCooldown;
          const burstCount = enemy.hp < enemy.maxHp * 0.5 ? 10 : 8;
          for (let burst = 0; burst < burstCount; burst += 1) {
            const angle = (Math.PI * 2 * burst) / burstCount;
            const vector = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
            this.spawnBullet(enemy.sprite.x, enemy.sprite.y, vector, 230, Math.round(9 * difficulty.enemyDamage), 7, "enemy", 0xc8a7ff);
          }
        }

        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1.6 * difficulty.enemyCooldown;
          enemy.chargeTimer = 0.42;
        }

        const move = direction.clone().scale(enemy.chargeTimer > 0 ? 1.75 : 0.92).add(perpendicular.scale(Math.sin(enemy.stateTimer * 2.8) * 0.25)).normalize();
        enemy.sprite.x += move.x * enemy.speed * dt;
        enemy.sprite.y += move.y * enemy.speed * dt;

        if (distance < enemy.radius + target.radius + 4 && enemy.attackCooldown > 0.9) {
          if (target.side === "companion") {
            this.damageCompanion(Math.round((17 + this.stageIndex * 2) * difficulty.enemyDamage));
          } else {
            this.damagePlayer(Math.round((17 + this.stageIndex * 2) * difficulty.enemyDamage));
          }
          enemy.attackCooldown = 0.75;
        }
      }

      enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, this.playArea.x + enemy.radius, this.playArea.right - enemy.radius);
      enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, this.playArea.y + enemy.radius, this.playArea.bottom - enemy.radius);
      enemy.aura.setPosition(enemy.sprite.x, enemy.sprite.y);
    });
  }

  private updateBullets(dt: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.life -= dt;
      bullet.sprite.x += bullet.velocity.x * dt;
      bullet.sprite.y += bullet.velocity.y * dt;

      if (!this.playArea.contains(bullet.sprite.x, bullet.sprite.y) || bullet.life <= 0) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
        continue;
      }

      if (bullet.owner === "enemy") {
        const hitCompanion = this.canCompanionBeTargeted()
          && Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, this.companion.x, this.companion.y) <= bullet.radius + 12;
        const hitPlayer = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, this.player.x, this.player.y) <= bullet.radius + 18;
        if (hitCompanion) {
          this.damageCompanion(bullet.damage);
          bullet.sprite.destroy();
          this.bullets.splice(index, 1);
          continue;
        }

        if (hitPlayer) {
          this.damagePlayer(bullet.damage);
          bullet.sprite.destroy();
          this.bullets.splice(index, 1);
          continue;
        }

        continue;
      }

      let hit = false;
      this.enemies.slice().forEach((enemy) => {
        if (hit) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (distance > bullet.radius + enemy.radius) {
          return;
        }

        this.damageEnemy(enemy, bullet.damage);
        hit = true;
      });

      if (hit) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
      }
    }
  }

  private updateStageState(): void {
    if (!this.currentStage || this.missionComplete || this.transitioningStage) {
      return;
    }

    if (this.currentStage.type === "hallway") {
      this.updateHallwayState();
    } else if (this.currentStage.type === "rest") {
      this.updateRestState();
    } else {
      this.updateBossState();
    }

    this.handleExitDoor();
  }

  private updateHallwayState(): void {
    const nextZone = this.hallwayZones.find((zone) => !zone.activated);
    if (nextZone && this.player.x >= nextZone.data.triggerX) {
      this.activateHallwayZone(nextZone);
    }

    if (!this.stageCleared && this.hallwayZones.every((zone) => zone.activated) && this.enemies.length === 0) {
      this.stageCleared = true;
      this.setExitDoorOpen(true, "Door Open");
      this.messageText.setText("Hallway secure. Push through the next door.");
      this.progressDots[this.stageIndex].setFillStyle(0x79abed, 1);
    }
  }

  private updateRestState(): void {
    if (!this.restStations) {
      return;
    }

    if (!this.restHealed && this.restStations.healPad.getBounds().contains(this.player.x, this.player.y)) {
      this.restHealed = true;
      this.playerHp = this.playerMaxHp;
      this.playerShield = this.playerMaxShield;
      this.playerShieldDelay = 0;
      this.companionHp = this.companionMaxHp;
      this.companionShield = this.companionMaxShield;
      this.companionShieldDelay = 0;
      if (this.companionDowned) {
        this.reviveCompanion(true);
      }
      this.messageText.setText("Vital Light restored. Push on when ready.");
      this.restStations.healText.setText("Med Bay\nRecharged");
    }

    if (!this.supplyHintShown && this.restStations.supplyPad.getBounds().contains(this.player.x, this.player.y)) {
      this.supplyHintShown = true;
      this.messageText.setText("Ammo economy is queued for a later milestone. The locker is here as a future hook.");
      this.restStations.supplyText.setText("Supply Locker\nAmmo later");
    }
  }

  private updateBossState(): void {
    const stage = this.currentStage as BossStage;
    if (!this.bossTriggered && this.player.x >= stage.triggerX) {
      this.bossTriggered = true;
      this.messageText.setText("The brute wakes. Break it and extract.");
      this.spawnEnemy("boss", this.playArea.right - 220, this.playArea.centerY);
      stage.adds?.forEach((group) => {
        for (let i = 0; i < group.count; i += 1) {
          this.spawnEnemy(group.kind, this.playArea.right - 380 + i * 34, this.playArea.centerY + Phaser.Math.Between(-90, 90));
        }
      });
    }

    if (this.bossTriggered && !this.stageCleared && this.enemies.length === 0) {
      this.stageCleared = true;
      this.setExitDoorOpen(true, "Extract");
      this.messageText.setText("Relay heart broken. Move through the extraction door.");
      this.progressDots[this.stageIndex].setFillStyle(0x79abed, 1);
    }
  }

  private activateHallwayZone(zone: HallwayZoneRuntime): void {
    zone.activated = true;
    zone.marker.setFillStyle(0x6fa8ef, 0.04);
    this.messageText.setText(zone.data.flavor);
    zone.data.enemies.forEach((group) => {
      for (let i = 0; i < group.count; i += 1) {
        this.spawnEnemy(group.kind, zone.data.triggerX + Phaser.Math.Between(140, 360), this.playArea.centerY + Phaser.Math.Between(-110, 110));
      }
    });
  }

  private handleExitDoor(): void {
    if (!this.exitDoor?.open) {
      return;
    }

    const doorBounds = this.exitDoor.frame.getBounds();
    if (!doorBounds.contains(this.player.x, this.player.y)) {
      return;
    }

    if (this.stageIndex < this.mission.stages.length - 1) {
      this.transitionToStage(this.stageIndex + 1);
      return;
    }

    this.finishMission();
  }

  private transitionToStage(nextStageIndex: number): void {
    if (this.transitioningStage) {
      return;
    }

    this.transitioningStage = true;
    this.releaseMissionControls();
    this.autoAimTarget = null;
    this.lockRing.setVisible(false);
    this.cameras.main.fadeOut(180, 8, 12, 18);
    this.time.delayedCall(180, () => {
      this.cameras.main.fadeIn(180, 8, 12, 18);
      this.loadStage(nextStageIndex);
    });
  }

  private finishMission(): void {
    this.missionComplete = true;
    this.fireHeld = false;
    this.messageText.setText("Relay secure. Extraction confirmed.");
    this.setExitDoorOpen(false, "Complete");
    this.lockRing.setVisible(false);
    this.releaseMissionControls();
    this.scene.start("mission-result", {
      missionId: this.mission.id,
      missionTitle: this.mission.title,
      reward: this.mission.reward,
    });
  }

  private spawnEnemy(kind: EnemyKind, preferredX?: number, preferredY?: number): void {
    const difficulty = gameSession.getDifficultyProfile();
    const stageIntensity = 1 + this.stageIndex * 0.09;
    const config = kind === "rusher"
      ? { color: 0xff6b7d, hp: 60, radius: 18, speed: 150 }
      : kind === "shooter"
        ? { color: 0xffc86d, hp: 46, radius: 16, speed: 118 }
        : { color: 0xba84ff, hp: 360, radius: 34, speed: 92 };

    const spawnX = Phaser.Math.Clamp(
      preferredX ?? Phaser.Math.Between(this.playArea.x + 240, this.playArea.right - 120),
      this.playArea.x + config.radius,
      this.playArea.right - config.radius,
    );
    const spawnY = Phaser.Math.Clamp(
      preferredY ?? Phaser.Math.Between(this.playArea.y + 70, this.playArea.bottom - 70),
      this.playArea.y + config.radius,
      this.playArea.bottom - config.radius,
    );

    const baseShield = kind === "boss"
      ? 120 + this.stageIndex * 14
      : kind === "shooter" && this.stageIndex >= 3
        ? 24 + this.stageIndex * 8
        : kind === "rusher" && this.stageIndex >= 4
          ? 18 + this.stageIndex * 6
          : 0;
    const scaledShield = Math.round(baseShield * difficulty.enemyHp);

    const aura = this.add.circle(spawnX, spawnY, config.radius + 8, config.color, 0.26).setDepth(8);
    const shieldRing = this.add.circle(spawnX, spawnY, config.radius + 12)
      .setStrokeStyle(3, 0x7ce8ff, 0.78)
      .setVisible(scaledShield > 0)
      .setDepth(8);
    const sprite = this.add.circle(spawnX, spawnY, config.radius, 0x050608).setDepth(9);
    sprite.setStrokeStyle(4, config.color, 0.92);

    this.enemies.push({
      kind,
      sprite,
      aura,
      shieldRing,
      hp: Math.round(config.hp * stageIntensity * difficulty.enemyHp),
      maxHp: Math.round(config.hp * stageIntensity * difficulty.enemyHp),
      shield: scaledShield,
      maxShield: scaledShield,
      shieldRegenDelay: 0,
      shieldRegenRate: Math.max(10, scaledShield * 0.22),
      radius: config.radius,
      speed: config.speed * Math.min(stageIntensity, 1.35) * difficulty.enemySpeed,
      attackCooldown: Phaser.Math.FloatBetween(0.45, 1.05),
      specialCooldown: kind === "boss" ? 1.9 : 1.4,
      chargeTimer: 0,
      damageFlash: 0,
      stateTimer: 0,
      roleColor: config.color,
      strafeDir: Phaser.Math.Between(0, 1) === 0 ? -1 : 1,
      spawnedAdds: false,
    });
  }
  private spawnBullet(
    x: number,
    y: number,
    direction: Phaser.Math.Vector2,
    speed: number,
    damage: number,
    radius: number,
    owner: BulletOwner,
    color: number,
  ): void {
    const bullet = this.add.circle(x, y, radius, color, 0.96).setDepth(9);
    this.bullets.push({
      sprite: bullet,
      velocity: direction.clone().normalize().scale(speed),
      life: 1.5,
      damage,
      radius,
      owner,
    });
  }

  private castPulse(): void {
    if (this.pulseCooldown > 0 || this.isCombatLocked()) {
      return;
    }

    this.pulseCooldown = PULSE_COOLDOWN;
    if (gameSession.settings.graphics.screenShake) {
      this.cameras.main.shake(90, 0.0015);
    }

    const ring = this.add.circle(this.player.x, this.player.y, 24).setStrokeStyle(6, 0x7fe3ff, 0.95).setDepth(15);
    this.tweens.add({
      targets: ring,
      scale: 5.6,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy(),
    });

    this.enemies.slice().forEach((enemy) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      if (distance <= 170) {
        this.damageEnemy(enemy, 28);
      }
    });
  }

  private castArcLance(): void {
    if (this.arcCooldown > 0 || this.isCombatLocked()) {
      return;
    }

    this.arcCooldown = ARC_COOLDOWN;
    const direction = this.getCombatAimDirection();
    const beam = this.add.rectangle(this.player.x, this.player.y, 240, 12, 0xffd16a, 0.55).setOrigin(0, 0.5).setDepth(13);
    beam.setRotation(direction.angle());
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 180,
      onComplete: () => beam.destroy(),
    });

    this.enemies.slice().forEach((enemy) => {
      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      const distanceAlong = toEnemy.dot(direction);
      const lateral = Math.abs(toEnemy.cross(direction));
      if (distanceAlong >= 0 && distanceAlong <= 250 && lateral <= 38) {
        this.damageEnemy(enemy, 40);
      }
    });
  }

  private tryDash(): void {
    if (this.dashCooldown > 0 || this.isCombatLocked()) {
      return;
    }

    this.dashCooldown = DASH_COOLDOWN;
    const direction = this.moveVector.lengthSq() > 0.01
      ? this.moveVector.clone()
      : this.keyboardVector.lengthSq() > 0.01
        ? this.keyboardVector.clone()
        : this.touchMode
          ? this.aimVector.clone()
          : new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y);

    if (direction.lengthSq() === 0) {
      direction.set(1, 0);
    } else {
      direction.normalize();
    }

    this.player.x = Phaser.Math.Clamp(this.player.x + direction.x * DASH_DISTANCE, this.playArea.x + 18, this.playArea.right - 18);
    this.player.y = Phaser.Math.Clamp(this.player.y + direction.y * DASH_DISTANCE, this.playArea.y + 18, this.playArea.bottom - 18);
    this.playerInvuln = 0.22;
  }

  private damagePlayer(amount: number): void {
    if (this.playerInvuln > 0 || this.missionComplete) {
      return;
    }

    const resolved = this.applyShieldDamage(this.playerShield, amount);
    this.playerShield = resolved.shield;
    this.playerShieldDelay = resolved.absorbed > 0 ? PLAYER_SHIELD_REGEN_DELAY : this.playerShieldDelay;
    this.playerInvuln = 0.45;
    this.playerHp = Math.max(0, this.playerHp - resolved.healthDamage);
    if (gameSession.settings.graphics.screenShake) {
      this.cameras.main.shake(80, 0.0012);
    }

    if (this.playerHp > 0) {
      return;
    }

    this.openGameOver();
  }

  private damageEnemy(enemy: Enemy, amount: number): void {
    if (!this.enemies.includes(enemy)) {
      return;
    }

    const resolved = this.applyShieldDamage(enemy.shield, amount);
    enemy.shield = resolved.shield;
    if (resolved.absorbed > 0) {
      enemy.shieldRegenDelay = ENEMY_SHIELD_REGEN_DELAY;
    }

    enemy.hp -= resolved.healthDamage;
    enemy.damageFlash = 0.28;
    if (enemy.hp > 0) {
      return;
    }

    enemy.sprite.destroy();
    enemy.aura.destroy();
    enemy.shieldRing.destroy();
    if (this.selectedTarget === enemy) {
      this.selectedTarget = null;
    }
    if (this.autoAimTarget === enemy) {
      this.autoAimTarget = null;
    }
    this.enemies = this.enemies.filter((entry) => entry !== enemy);
  }

  private damageCompanion(amount: number): void {
    if (!this.canCompanionBeTargeted()) {
      return;
    }

    const resolved = this.applyShieldDamage(this.companionShield, amount);
    this.companionShield = resolved.shield;
    this.companionShieldDelay = resolved.absorbed > 0 ? COMPANION_SHIELD_REGEN_DELAY : this.companionShieldDelay;
    this.companionHp = Math.max(0, this.companionHp - resolved.healthDamage);

    if (this.companionHp > 0) {
      return;
    }

    this.companionDowned = true;
    this.companionReviveTimer = COMPANION_REVIVE_TIME;
    this.companionCooldown = 0;
    this.companion.setVisible(true);
    this.companionShieldRing.setVisible(false);
    this.messageText.setText("Sera is down. Hold the line until her light stabilizes.");
  }

  private reviveCompanion(fromRestRoom: boolean): void {
    this.companionDowned = false;
    this.companionReviveTimer = 0;
    this.companionHp = fromRestRoom ? this.companionMaxHp : Math.ceil(this.companionMaxHp * 0.55);
    this.companionShield = fromRestRoom ? this.companionMaxShield : Math.ceil(this.companionMaxShield * 0.45);
    this.companionShieldDelay = 0.4;
    this.companion.setFillStyle(0xf3cc7a, 1);
    this.companion.setAlpha(1);
    this.companion.setVisible(true);
    this.companionShieldRing.setVisible(this.companionShield > 0.5);
    if (!fromRestRoom) {
      this.messageText.setText("Sera reforms from the relay light. Covering fire is back.");
    }
  }

  private canCompanionBeTargeted(): boolean {
    return gameSession.getModeRules().companionsEnabled && !this.companionDowned && this.companion.visible;
  }

  private getEnemyFocusTarget(enemy: Enemy): { side: ActorSide; x: number; y: number; radius: number } {
    if (!this.canCompanionBeTargeted()) {
      return {
        side: "player",
        x: this.player.x,
        y: this.player.y,
        radius: 18,
      };
    }

    const companionDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.companion.x, this.companion.y);
    const playerDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
    if (companionDistance < playerDistance - 26) {
      return {
        side: "companion",
        x: this.companion.x,
        y: this.companion.y,
        radius: 12,
      };
    }

    return {
      side: "player",
      x: this.player.x,
      y: this.player.y,
      radius: 18,
    };
  }

  private applyShieldDamage(currentShield: number, amount: number): { shield: number; healthDamage: number; absorbed: number } {
    if (currentShield <= 0 || amount <= 0) {
      return {
        shield: Math.max(0, currentShield),
        healthDamage: amount,
        absorbed: 0,
      };
    }

    const absorbed = Math.min(currentShield, amount);
    return {
      shield: Math.max(0, currentShield - absorbed),
      healthDamage: amount - absorbed,
      absorbed,
    };
  }

  private updateHudState(): void {
    const combatLocked = this.isCombatLocked();
    const companionsEnabled = gameSession.getModeRules().companionsEnabled;
    this.hpFill.width = 160 * (this.playerHp / this.playerMaxHp);
    this.shieldFill.width = 160 * (this.playerShield / Math.max(1, this.playerMaxShield));
    this.playerShieldRing.setVisible(this.playerShield > 0.5);
    this.playerShieldRing.setAlpha(this.playerShield > 0 ? 0.84 : 0);
    this.companionHpFill.width = companionsEnabled ? 160 * (this.companionHp / Math.max(1, this.companionMaxHp)) : 0;
    this.companionShieldFill.width = companionsEnabled ? 160 * (this.companionShield / Math.max(1, this.companionMaxShield)) : 0;
    this.companionStateText.setAlpha(companionsEnabled ? 1 : 0.32);
    this.companionStateText.setText(
      !companionsEnabled
        ? "Companion Bay | Offline"
        : this.companionDowned
          ? `Sera | Downed ${this.companionReviveTimer.toFixed(1)}s`
          : `Sera | ${Math.round(this.companionShield)} shield / ${Math.round(this.companionHp)} hp`,
    );
    this.companionShieldRing.setVisible(this.canCompanionBeTargeted() && this.companionShield > 0.5);

    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    const bossVisible = Boolean(boss);
    this.bossFrame.setVisible(bossVisible);
    this.bossFill.setVisible(bossVisible);
    this.bossTitle.setVisible(bossVisible);
    if (boss) {
      this.bossFill.width = 242 * (boss.hp / boss.maxHp);
    }

    if (this.autoAimTarget) {
      this.lockRing.setVisible(true);
      this.lockRing.setPosition(this.autoAimTarget.sprite.x, this.autoAimTarget.sprite.y);
      this.lockRing.setRadius(this.autoAimTarget.radius + 10);
      this.reticle.setStrokeStyle(3, 0xffe18a, 0.96);
    } else {
      this.lockRing.setVisible(false);
      this.reticle.setStrokeStyle(3, 0xbef2ff, 0.82);
    }

    if (this.toolbarCards) {
      this.toolbarCards.fire.detail.setText(this.getPrimaryFireDetail(combatLocked));
      this.toolbarCards.pulse.detail.setText(this.getCooldownDetail("Q", this.pulseCooldown, combatLocked));
      this.toolbarCards.arc.detail.setText(this.getCooldownDetail("E", this.arcCooldown, combatLocked));
      this.toolbarCards.dash.detail.setText(this.getCooldownDetail("Shift / RMB", this.dashCooldown, combatLocked));
      this.setAbilityCardColor(this.toolbarCards.pulse, this.pulseCooldown <= 0 ? 0x144d6a : 0x17314f);
      this.setAbilityCardColor(this.toolbarCards.arc, this.arcCooldown <= 0 ? 0x5a4617 : 0x17314f);
      this.setAbilityCardColor(this.toolbarCards.dash, this.dashCooldown <= 0 ? 0x4a3370 : 0x17314f);
      this.setAbilityCardCooldown(this.toolbarCards.fire, combatLocked ? 1 : 0);
      this.setAbilityCardCooldown(this.toolbarCards.pulse, combatLocked ? 1 : this.pulseCooldown / PULSE_COOLDOWN);
      this.setAbilityCardCooldown(this.toolbarCards.arc, combatLocked ? 1 : this.arcCooldown / ARC_COOLDOWN);
      this.setAbilityCardCooldown(this.toolbarCards.dash, combatLocked ? 1 : this.dashCooldown / DASH_COOLDOWN);
    }

    this.attackButton?.setLabel(combatLocked ? "Safe\nRoom" : "Attack");
    this.attackButton?.setCooldownProgress(combatLocked ? 1 : 0);
    this.attackButton?.setInputEnabled(this.touchMode && !combatLocked);
    this.targetButton?.setLabel(this.autoAimTarget ? "Next\nTarget" : "Target");
    this.targetButton?.setCooldownProgress(0);
    this.targetButton?.setInputEnabled(this.touchMode && !combatLocked && this.enemies.length > 0);

    this.pulseButton?.setLabel(this.getTouchCooldownLabel("Pulse", this.pulseCooldown, combatLocked));
    this.arcButton?.setLabel(this.getTouchCooldownLabel("Arc", this.arcCooldown, combatLocked));
    this.dashButton?.setLabel(this.getTouchCooldownLabel("Dash", this.dashCooldown, combatLocked));
    this.pulseButton?.setCooldownProgress(combatLocked ? 1 : this.pulseCooldown / PULSE_COOLDOWN);
    this.arcButton?.setCooldownProgress(combatLocked ? 1 : this.arcCooldown / ARC_COOLDOWN);
    this.dashButton?.setCooldownProgress(combatLocked ? 1 : this.dashCooldown / DASH_COOLDOWN);
    this.pulseButton?.setInputEnabled(this.touchMode && !combatLocked && this.pulseCooldown <= 0);
    this.arcButton?.setInputEnabled(this.touchMode && !combatLocked && this.arcCooldown <= 0);
    this.dashButton?.setInputEnabled(this.touchMode && !combatLocked && this.dashCooldown <= 0);
  }

  private setAbilityCardColor(card: AbilityCard, color: number): void {
    card.frame.setFillStyle(color, 0.94);
  }

  private setAbilityCardCooldown(card: AbilityCard, progress: number): void {
    const clamped = Phaser.Math.Clamp(progress, 0, 1);
    if (clamped <= 0) {
      card.cooldownMask.setVisible(false);
      return;
    }

    card.cooldownMask.setVisible(true);
    card.cooldownMask.setDisplaySize(190, Math.max(4, 44 * clamped));
  }

  private openPauseMenu(): void {
    this.scene.launch("pause", {
      returnSceneKey: "mission",
      allowSave: false,
    });
    this.scene.pause();
  }

  private pointerOverUi(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(
      this.pauseButton?.container.getBounds().contains(pointer.x, pointer.y)
      || (this.attackButton?.container.visible && this.attackButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.targetButton?.container.visible && this.targetButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.pulseButton?.container.visible && this.pulseButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.arcButton?.container.visible && this.arcButton.container.getBounds().contains(pointer.x, pointer.y))
      || (this.dashButton?.container.visible && this.dashButton.container.getBounds().contains(pointer.x, pointer.y)),
    );
  }

  private openGameOver(): void {
    this.fireHeld = false;
    this.selectedTarget = null;
    this.autoAimTarget = null;
    this.lockRing.setVisible(false);
    this.releaseMissionControls();
    this.scene.start("game-over", {
      missionId: this.mission.id,
    });
  }

  private anchorMoveStick(x: number, y: number): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(
      Phaser.Math.Clamp(x, 86, GAME_WIDTH - 86),
      Phaser.Math.Clamp(y, 104, GAME_HEIGHT - 88),
    );
    this.moveBase.setFillStyle(0x173054, 0.52);
    this.moveKnob.setPosition(this.moveBase.x, this.moveBase.y);
  }

  private updateMoveStick(pointer: Phaser.Input.Pointer): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    const vector = new Phaser.Math.Vector2(pointer.x - this.moveBase.x, pointer.y - this.moveBase.y);
    const distance = vector.length();
    if (distance > STICK_RADIUS) {
      vector.normalize().scale(STICK_RADIUS);
    }
    this.moveKnob.setPosition(this.moveBase.x + vector.x, this.moveBase.y + vector.y);
    if (distance <= STICK_DEADZONE) {
      this.moveVector.set(0, 0);
      return;
    }

    const rawStrength = Phaser.Math.Clamp(
      (Math.min(distance, STICK_RADIUS) - STICK_DEADZONE) / (STICK_RADIUS - STICK_DEADZONE),
      0,
      1,
    );
    const sensitivityCurve = 100 / gameSession.settings.controls.touchSensitivity;
    const strength = Math.pow(rawStrength, sensitivityCurve);
    this.moveVector.set(vector.x, vector.y).normalize().scale(strength);
    this.aimVector.set(vector.x, vector.y).normalize();
  }

  private resetMoveStick(): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(148, 566).setFillStyle(0x173054, 0.36);
    this.moveKnob.setPosition(148, 566);
  }

  private beginTouchAttack(pointer: Phaser.Input.Pointer): void {
    this.attackPointerId = pointer.id;
    this.fireHeld = true;
  }

  private endTouchAttack(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.attackPointerId) {
      return;
    }

    this.attackPointerId = null;
    this.fireHeld = false;
  }

  private getNearestEnemy(x: number, y: number, range: number): Enemy | null {
    let nearest: Enemy | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.enemies.forEach((enemy) => {
      const distance = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
      if (distance > range || distance >= nearestDistance) {
        return;
      }

      nearest = enemy;
      nearestDistance = distance;
    });

    return nearest;
  }

  private getBaseAimDirection(): Phaser.Math.Vector2 {
    const direction = this.touchMode
      ? this.aimVector.clone()
      : this.getDesktopAimVector();

    if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y) || direction.lengthSq() === 0) {
      direction.set(1, 0);
    } else {
      direction.normalize();
    }

    return direction;
  }

  private getCombatAimDirection(): Phaser.Math.Vector2 {
    const baseDirection = this.getBaseAimDirection();
    this.refreshAutoAimTarget(baseDirection);
    if (!this.autoAimTarget) {
      return baseDirection;
    }

    return new Phaser.Math.Vector2(
      this.autoAimTarget.sprite.x - this.player.x,
      this.autoAimTarget.sprite.y - this.player.y,
    ).normalize();
  }

  private refreshAutoAimTarget(direction: Phaser.Math.Vector2): void {
    if (this.selectedTarget && !this.isAutoAimTargetValid(this.selectedTarget)) {
      this.selectedTarget = null;
    }

    this.autoAimTarget = this.getResolvedLockTarget(direction);
  }

  private getDesktopAimVector(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    if (!pointer.isDown && pointer.x === 0 && pointer.y === 0) {
      return new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y);
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.lookPoint.set(worldPoint.x, worldPoint.y);
    return new Phaser.Math.Vector2(worldPoint.x - this.player.x, worldPoint.y - this.player.y);
  }

  private releaseMissionControls(): void {
    this.movePointerId = null;
    this.attackPointerId = null;
    this.fireHeld = false;
    this.moveVector.set(0, 0);
    this.resetMoveStick();
  }

  private cycleTargetLock(): void {
    if (this.isCombatLocked()) {
      return;
    }

    const candidates = this.getTargetCycleCandidates();
    if (candidates.length === 0) {
      this.selectedTarget = null;
      this.autoAimTarget = null;
      return;
    }

    const current = this.autoAimTarget && candidates.includes(this.autoAimTarget)
      ? this.autoAimTarget
      : null;
    if (!current) {
      this.selectedTarget = candidates[0];
      this.autoAimTarget = this.selectedTarget;
      return;
    }

    const index = candidates.indexOf(current);
    this.selectedTarget = candidates[(index + 1) % candidates.length] ?? candidates[0];
    this.autoAimTarget = this.selectedTarget;
  }

  private getResolvedLockTarget(direction: Phaser.Math.Vector2): Enemy | null {
    if (this.selectedTarget && this.isAutoAimTargetValid(this.selectedTarget)) {
      return this.selectedTarget;
    }

    this.selectedTarget = null;
    if (!gameSession.settings.controls.autoAim) {
      return null;
    }

    return this.getAutoAimTarget(direction);
  }

  private getTargetCycleCandidates(): Enemy[] {
    const baseDirection = this.getBaseAimDirection();
    const normalized = baseDirection.clone().normalize();

    return this.enemies
      .filter((enemy) => this.isAutoAimTargetValid(enemy))
      .sort((left, right) => {
        const leftVector = new Phaser.Math.Vector2(left.sprite.x - this.player.x, left.sprite.y - this.player.y);
        const rightVector = new Phaser.Math.Vector2(right.sprite.x - this.player.x, right.sprite.y - this.player.y);
        const leftDistance = leftVector.length();
        const rightDistance = rightVector.length();
        const leftAngle = Math.abs(Phaser.Math.Angle.Wrap(leftVector.normalize().angle() - normalized.angle()));
        const rightAngle = Math.abs(Phaser.Math.Angle.Wrap(rightVector.normalize().angle() - normalized.angle()));
        return (leftAngle * 220 + leftDistance) - (rightAngle * 220 + rightDistance);
      });
  }

  private getAutoAimTarget(direction: Phaser.Math.Vector2): Enemy | null {
    if (!this.selectedTarget && this.autoAimTarget && this.isAutoAimTargetValid(this.autoAimTarget)) {
      return this.autoAimTarget;
    }

    let nearest: Enemy | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const normalized = direction.clone().normalize();

    for (const enemy of this.enemies) {
      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      const distance = toEnemy.length();
      if (distance <= 0 || distance > TARGET_LOCK_RANGE) {
        continue;
      }

      const aimVector = toEnemy.normalize();
      const angle = Math.abs(Phaser.Math.Angle.Wrap(aimVector.angle() - normalized.angle()));
      if (angle > 0.52) {
        continue;
      }

      const score = distance + angle * 220;
      if (score >= bestScore) {
        continue;
      }

      bestScore = score;
      nearest = enemy;
    }

    if (!nearest) {
      return null;
    }

    return nearest;
  }

  private isAutoAimTargetValid(target: Enemy): boolean {
    return this.enemies.includes(target)
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, target.sprite.x, target.sprite.y) <= TARGET_LOCK_RANGE;
  }

  private setExitDoorOpen(open: boolean, label: string): void {
    if (!this.exitDoor) {
      return;
    }

    this.exitDoor.open = open;
    this.exitDoor.label.setText(label);
    if (open) {
      this.exitDoor.frame.setFillStyle(this.exitDoor.extraction ? 0x205c80 : 0x1b5a84, 0.98);
      this.exitDoor.frame.setStrokeStyle(3, this.exitDoor.extraction ? 0x9fe9ff : 0x8ed2ff, 0.96);
      this.exitDoor.glow.setFillStyle(this.exitDoor.extraction ? 0x7de2ff : 0x56c8ff, 0.28);
      return;
    }

    this.exitDoor.frame.setFillStyle(0x473113, 0.94);
    this.exitDoor.frame.setStrokeStyle(3, 0xffcb68, 0.52);
    this.exitDoor.glow.setFillStyle(0xffcb68, 0.08);
  }

  private createAbilityCard(x: number, y: number, titleText: string, detailText: string): AbilityCard {
    const frame = this.pin(this.add.rectangle(x, y, 196, 50, 0x17314f, 0.94)
      .setStrokeStyle(2, 0x6ea2e5, 0.78));
    const cooldownMask = this.pin(this.add.rectangle(x, y - 22, 190, 44, 0x03070d, 0.38)
      .setOrigin(0.5, 0)
      .setVisible(false));
    const title = this.pin(this.add.text(x - 84, y - 18, titleText, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f5fbff",
      fontStyle: "bold",
    }));
    const detail = this.pin(this.add.text(x - 84, y + 3, detailText, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#cfe0f7",
    }));

    this.desktopUiObjects.push(frame, cooldownMask, title, detail);

    return { frame, cooldownMask, title, detail };
  }

  private clearBullets(): void {
    this.bullets.forEach((bullet) => bullet.sprite.destroy());
    this.bullets = [];
  }

  private clearEnemies(): void {
    this.enemies.forEach((enemy) => {
      enemy.sprite.destroy();
      enemy.aura.destroy();
      enemy.shieldRing.destroy();
    });
    this.enemies = [];
  }

  private clearStageObjects(): void {
    this.stageObjects.forEach((object) => object.destroy());
    this.stageObjects = [];
    this.hallwayZones = [];
  }

  private syncInputMode(): void {
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    const desktopVisible = !this.touchMode;

    this.touchUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(this.touchMode);
    });
    this.desktopUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(desktopVisible);
    });

    if (!this.touchMode) {
      this.movePointerId = null;
      this.attackPointerId = null;
      this.moveVector.set(0, 0);
      this.fireHeld = false;
      this.resetMoveStick();
    }
  }

  private isCombatLocked(): boolean {
    return this.missionComplete || this.transitioningStage || this.currentStage?.type === "rest";
  }

  private getCooldownDetail(hotkey: string, cooldown: number, combatLocked: boolean): string {
    if (combatLocked) {
      return this.currentStage?.type === "rest" ? "Safe Room | Offline" : "Transitioning | Hold";
    }

    return cooldown <= 0 ? `${hotkey} | Ready` : `${hotkey} | ${cooldown.toFixed(1)}s`;
  }

  private getPrimaryFireDetail(combatLocked: boolean): string {
    if (combatLocked) {
      return this.currentStage?.type === "rest" ? "Safe Room | Combat Offline" : "Transitioning | Hold";
    }

    const autoAim = gameSession.settings.controls.autoAim;
    const autoFire = gameSession.settings.controls.autoFire;
    if (this.autoAimTarget) {
      if (autoAim && autoFire) {
        return "Tab Cycle | Auto Fire Locked";
      }

      if (autoAim) {
        return "Tab Cycle | Auto Aim, Manual Fire";
      }

      if (autoFire) {
        return "Tab Cycle | Locked Auto Fire";
      }

      return "Tab Cycle | Manual Fire";
    }

    if (autoAim && autoFire) {
      return "Tab Cycle | Seeking Auto Lock";
    }

    if (autoAim) {
      return "LMB Fire | Auto Aim Only";
    }

    if (autoFire) {
      return "Tab Cycle | Auto Fire Needs Lock";
    }

    return "LMB Fire | Tab Cycle";
  }

  private getTouchCooldownLabel(label: string, cooldown: number, combatLocked: boolean): string {
    if (combatLocked) {
      return "Safe\nRoom";
    }

    return cooldown <= 0 ? label : `${label}\n${cooldown.toFixed(1)}s`;
  }

  private reportDesktopInput(): void {
    if (!this.touchCapable) {
      return;
    }

    gameSession.reportInputMode("desktop", this.touchCapable);
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    const augmentedPointer = pointer as Phaser.Input.Pointer & { wasTouch?: boolean };
    const event = pointer.event as (PointerEvent & { pointerType?: string }) | undefined;
    return Boolean(augmentedPointer.wasTouch || event?.pointerType === "touch");
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      run: gameSession.getRunConfig(),
      touchMode: this.touchMode,
      stageIndex: this.stageIndex,
      stageName: this.currentStage?.name ?? null,
      missionComplete: this.missionComplete,
      autoFire: gameSession.settings.controls.autoFire,
      autoAimTarget: this.autoAimTarget?.kind ?? null,
      selectedTarget: this.selectedTarget?.kind ?? null,
      touchAttackHeld: this.attackPointerId !== null,
      playerHp: this.playerHp,
      playerShield: Math.round(this.playerShield),
      companion: {
        hp: Math.round(this.companionHp),
        shield: Math.round(this.companionShield),
        downed: this.companionDowned,
        reviveTimer: Number(this.companionReviveTimer.toFixed(1)),
      },
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
      },
      enemies: this.enemies.map((enemy) => ({
        kind: enemy.kind,
        hp: Math.round(enemy.hp),
        shield: Math.round(enemy.shield),
        x: Math.round(enemy.sprite.x),
        y: Math.round(enemy.sprite.y),
      })),
    };
  }

  private pin<T extends Phaser.GameObjects.GameObject>(object: T): T {
    const scrollable = object as T & { setScrollFactor?: (x: number, y?: number) => T };
    scrollable.setScrollFactor?.(0);
    return object;
  }
}
