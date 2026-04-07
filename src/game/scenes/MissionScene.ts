import Phaser from "phaser";

import {
  createMissionDefinition,
  FIRST_MISSION,
  type BossStage,
  type HallwayStage,
  type MissionDefinition,
  type MissionEnemyKind,
  type MissionFlow,
  type MissionHallwayZone,
  type MissionStage,
  type RestStage,
} from "../content/missions";
import { getFormationSlot, type CompanionAttackStyle, type CompanionId, type FormationSlotId } from "../content/companions";
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
  splashRadius?: number;
  splashDamage?: number;
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

type CompanionHud = {
  hpFill: Phaser.GameObjects.Rectangle;
  shieldFill: Phaser.GameObjects.Rectangle;
  hpValueText: Phaser.GameObjects.Text;
  shieldValueText: Phaser.GameObjects.Text;
  stateText: Phaser.GameObjects.Text;
};

type CompanionState = {
  id: CompanionId;
  name: string;
  roleLabel: string;
  attackStyle: CompanionAttackStyle;
  coreColor: number;
  trimColor: number;
  projectileColor: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldDelay: number;
  downed: boolean;
  reviveProgress: number;
  reviveHeld: boolean;
  revivePointerId: number | null;
  cooldown: number;
  slotId: FormationSlotId;
  slotForward: number;
  slotLateral: number;
  aggroWeight: number;
  sprite: Phaser.GameObjects.Arc;
  shieldRing: Phaser.GameObjects.Arc;
  guardPlate?: Phaser.GameObjects.Rectangle;
  guardFacing: Phaser.Math.Vector2;
  revivePromptText: Phaser.GameObjects.Text;
  hud: CompanionHud;
};

type EnemyFocusTarget = {
  side: ActorSide;
  x: number;
  y: number;
  radius: number;
  companion?: CompanionState;
};

const BASE_STAGE_BOUNDS = new Phaser.Geom.Rectangle(110, 174, 1500, 338);
const BASE_REST_BOUNDS = new Phaser.Geom.Rectangle(140, 150, 820, 420);
const BASE_STAGE_VERTICAL = new Phaser.Geom.Rectangle(338, 110, 604, 1500);
const BASE_REST_VERTICAL = new Phaser.Geom.Rectangle(250, 150, 780, 820);
const MOVE_SPEED = 315;
const DASH_DISTANCE = 128;
const PRIMARY_FIRE_COOLDOWN = 0.16;
const PULSE_COOLDOWN = 2.8;
const ARC_COOLDOWN = 4.5;
const DASH_COOLDOWN = 1.25;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;
const PLAYER_BAR_WIDTH = 160;
const COMPANION_BAR_WIDTH = 120;
const TARGET_LOCK_RANGE = 520;
const SHIELD_REGEN_DELAY = 3.25;
const PLAYER_CORE_COLOR = 0xf2f7ff;
const PLAYER_TRIM_COLOR = 0x7caeff;
const PLAYER_TARGET_COLOR = PLAYER_CORE_COLOR;
const PLAYER_SHIELD_REGEN_RATE = 18;
const COMPANION_SHIELD_REGEN_RATE = 12;
const COMPANION_REVIVE_HOLD_TIME = 2.4;
const COMPANION_REVIVE_RANGE = 78;
const COMPANION_BAR_SPACING = 48;

function cloneRect(rect: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(rect.x, rect.y, rect.width, rect.height);
}

function flowDirection(flow: MissionFlow): Phaser.Math.Vector2 {
  return flow === "up" ? new Phaser.Math.Vector2(0, -1) : new Phaser.Math.Vector2(1, 0);
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
  private worldBounds = { width: GAME_WIDTH, height: GAME_HEIGHT };
  private stageObjects: Phaser.GameObjects.GameObject[] = [];
  private hallwayZones: HallwayZoneRuntime[] = [];
  private restStations?: RestStations;
  private exitDoor?: DoorUi;
  private restHealed = false;
  private supplyHintShown = false;

  private player!: Phaser.GameObjects.Arc;
  private playerFacing!: Phaser.GameObjects.Rectangle;
  private playerShieldRing!: Phaser.GameObjects.Arc;
  private companions: CompanionState[] = [];
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerShield = 60;
  private playerMaxShield = 60;
  private playerShieldDelay = 0;
  private playerInvuln = 0;
  private fireCooldown = 0;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private arcCooldown = 0;

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
    revive: Phaser.Input.Keyboard.Key;
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
  private lockBracket!: Phaser.GameObjects.Graphics;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private shieldFill!: Phaser.GameObjects.Rectangle;
  private hpValueText!: Phaser.GameObjects.Text;
  private shieldValueText!: Phaser.GameObjects.Text;
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
    this.mission = createMissionDefinition(data.missionId ?? FIRST_MISSION.id);
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
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.playerShieldDelay = Math.max(0, this.playerShieldDelay - dt);
    this.companions.forEach((companion) => {
      companion.cooldown = Math.max(0, companion.cooldown - dt);
      companion.shieldDelay = Math.max(0, companion.shieldDelay - dt);
    });

    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateFacing();
    this.updateShieldStates(dt);
    this.updateCompanionRevive(dt);
    this.handleFiring();
    this.updateCompanions(dt);
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
    this.worldBounds = { width: GAME_WIDTH, height: GAME_HEIGHT };
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
    this.fireCooldown = 0;
    this.pulseCooldown = 0;
    this.dashCooldown = 0;
    this.arcCooldown = 0;
    this.companions = [];

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
    this.player = this.add.circle(210, 342, 18, PLAYER_CORE_COLOR).setDepth(10);
    this.player.setStrokeStyle(4, PLAYER_TRIM_COLOR, 1);
    this.playerShieldRing = this.add.circle(this.player.x, this.player.y, 26)
      .setStrokeStyle(4, 0x65d8ff, 0.82)
      .setDepth(9);

    this.playerFacing = this.add.rectangle(this.player.x + 26, this.player.y, 34, 8, 0x7ee1ff)
      .setOrigin(0, 0.5)
      .setDepth(11);

    const selectedCompanions = gameSession.getModeRules().companionsEnabled
      ? gameSession.getSelectedCompanions()
      : [];

    this.companions = selectedCompanions.map(({ companion, slotId }) => {
      const slot = getFormationSlot(slotId);
      const slotForward = slot?.missionForward ?? 0;
      const slotLateral = slot?.missionLateral ?? 0;
      const sprite = this.add.circle(
        this.player.x + slotForward,
        this.player.y + slotLateral,
        companion.radius,
        companion.coreColor,
      ).setDepth(9);
      sprite.setStrokeStyle(3, companion.trimColor, 1);

      const shieldRing = this.add.circle(sprite.x, sprite.y, companion.radius + 7)
        .setStrokeStyle(3, 0x7de6ff, 0.78)
        .setDepth(8);
      shieldRing.setVisible(gameSession.getModeRules().companionsEnabled);

      const guardPlate = companion.attackStyle === "shield"
        ? this.add.rectangle(sprite.x + companion.radius + 6, sprite.y, 10, 30, 0x325c48, 0.96)
          .setStrokeStyle(3, companion.trimColor, 0.95)
          .setDepth(10)
        : undefined;
      guardPlate?.setVisible(gameSession.getModeRules().companionsEnabled);

      const revivePromptText = this.add.text(sprite.x, sprite.y - 34, "", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#fff4c6",
        fontStyle: "bold",
        backgroundColor: "#0d1521cc",
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setDepth(16).setVisible(false);

      sprite.setVisible(gameSession.getModeRules().companionsEnabled);

      return {
        id: companion.id,
        name: companion.name,
        roleLabel: companion.roleLabel,
        attackStyle: companion.attackStyle,
        coreColor: companion.coreColor,
        trimColor: companion.trimColor,
        projectileColor: companion.projectileColor,
        radius: companion.radius,
        hp: companion.maxHp,
        maxHp: companion.maxHp,
        shield: companion.maxShield,
        maxShield: companion.maxShield,
        shieldDelay: 0,
        downed: false,
        reviveProgress: 0,
        reviveHeld: false,
        revivePointerId: null,
        cooldown: 0,
        slotId,
        slotForward,
        slotLateral,
        aggroWeight: companion.aggroWeight,
        sprite,
        shieldRing,
        guardPlate,
        guardFacing: new Phaser.Math.Vector2(1, 0),
        revivePromptText,
        hud: {} as CompanionHud,
      };
    });

    this.aimLine = this.add.graphics().setDepth(8);
    this.reticle = this.add.circle(this.lookPoint.x, this.lookPoint.y, 14, 0x7ee1ff, 0.14).setDepth(8);
    this.reticle.setStrokeStyle(3, this.getPlayerTargetColor(), 0.84);
    this.lockBracket = this.add.graphics().setDepth(8);
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

    this.pin(this.add.rectangle(166, 112, PLAYER_BAR_WIDTH + 8, 18, 0x08111c, 0.96).setStrokeStyle(2, 0x6ea2e5, 0.8));
    this.hpFill = this.pin(this.add.rectangle(86, 112, PLAYER_BAR_WIDTH, 10, 0x47c56c, 0.96).setOrigin(0, 0.5));
    this.pin(this.add.text(86, 95, "Vital Light", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d7e8ff",
    }));
    this.hpValueText = this.pin(this.add.text(166, 112, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setOrigin(0.5));
    this.pin(this.add.rectangle(166, 138, PLAYER_BAR_WIDTH + 8, 14, 0x08111c, 0.96).setStrokeStyle(2, 0x69d7ff, 0.72));
    this.shieldFill = this.pin(this.add.rectangle(86, 138, PLAYER_BAR_WIDTH, 8, 0x69d7ff, 0.94).setOrigin(0, 0.5));
    this.pin(this.add.text(86, 124, "Aegis Shield", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#c2f2ff",
    }));
    this.shieldValueText = this.pin(this.add.text(166, 138, "", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setOrigin(0.5));

    this.companions.forEach((companion, index) => {
      const stateY = 150 + index * COMPANION_BAR_SPACING;
      const hpY = 166 + index * COMPANION_BAR_SPACING;
      const shieldY = 182 + index * COMPANION_BAR_SPACING;

      this.pin(this.add.rectangle(146, hpY, COMPANION_BAR_WIDTH + 8, 12, 0x08111c, 0.96)
        .setStrokeStyle(2, companion.trimColor, 0.66));
      const hpFill = this.pin(this.add.rectangle(86, hpY, COMPANION_BAR_WIDTH, 6, companion.coreColor, 0.92).setOrigin(0, 0.5));
      const hpValueText = this.pin(this.add.text(146, hpY, "", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#fff6df",
        fontStyle: "bold",
      }).setOrigin(0.5));
      this.pin(this.add.rectangle(146, shieldY, COMPANION_BAR_WIDTH + 8, 10, 0x08111c, 0.96)
        .setStrokeStyle(2, 0x7de6ff, 0.62));
      const shieldFill = this.pin(this.add.rectangle(86, shieldY, COMPANION_BAR_WIDTH, 5, 0x78e3ff, 0.9).setOrigin(0, 0.5));
      const shieldValueText = this.pin(this.add.text(146, shieldY, "", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#ecfcff",
        fontStyle: "bold",
      }).setOrigin(0.5));
      const stateText = this.pin(this.add.text(86, stateY, `${companion.name} | ${companion.roleLabel}`, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: Phaser.Display.Color.IntegerToColor(companion.trimColor).rgba,
        fontStyle: "bold",
      }));

      companion.hud = {
        hpFill,
        shieldFill,
        hpValueText,
        shieldValueText,
        stateText,
      };
    });

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
      onPress: (pointer) => this.handleAttackButtonPress(pointer),
      onRelease: (pointer) => this.handleAttackButtonRelease(pointer),
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
      revive: Phaser.Input.Keyboard.KeyCodes.F,
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
    keyboard.on("keydown-F", () => {
      this.reportDesktopInput();
      this.beginKeyboardRevive();
    });
    keyboard.on("keyup-F", () => {
      this.endCompanionReviveHold();
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
      keyboard.removeAllListeners("keydown-F");
      keyboard.removeAllListeners("keyup-F");
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

    this.configureStageBounds(this.currentStage);

    this.cameras.main.stopFollow();
    this.cameras.main.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.cameras.main.setScroll(
      this.getStageFlow(this.currentStage) === "up" ? 0 : 0,
      this.getStageFlow(this.currentStage) === "up" ? Math.max(0, this.worldBounds.height - GAME_HEIGHT) : 0,
    );

    this.buildStageLayout(this.currentStage);
    const entryPoint = this.getStageEntryPoint(this.currentStage);
    const forward = flowDirection(this.getStageFlow(this.currentStage));
    this.player.setPosition(entryPoint.x, entryPoint.y);
    this.player.setAlpha(1);
    this.playerShieldRing.setPosition(this.player.x, this.player.y);
    this.companions.forEach((companion) => {
      const spawnAnchor = this.getCompanionDesiredAnchor(companion, forward, null, new Phaser.Math.Vector2(0, 0));
      companion.sprite.setPosition(spawnAnchor.x, spawnAnchor.y);
      companion.shieldRing.setPosition(companion.sprite.x, companion.sprite.y);
      companion.sprite.setVisible(gameSession.getModeRules().companionsEnabled);
      companion.shieldRing.setVisible(gameSession.getModeRules().companionsEnabled && companion.shield > 0.5);
      companion.guardPlate?.setPosition(companion.sprite.x + companion.radius + 6, companion.sprite.y);
      companion.guardPlate?.setVisible(gameSession.getModeRules().companionsEnabled && !companion.downed);
      companion.revivePromptText.setVisible(false);
    });
    this.lookPoint.set(this.player.x + forward.x * 180, this.player.y + forward.y * 180);

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

  private configureStageBounds(stage: MissionStage): void {
    const flow = this.getStageFlow(stage);
    const isRest = stage.type === "rest";

    if (flow === "up") {
      this.worldBounds = { width: GAME_WIDTH, height: stage.span };
      this.playArea = cloneRect(isRest ? BASE_REST_VERTICAL : BASE_STAGE_VERTICAL);
      this.playArea.setPosition(isRest ? 250 : 338, isRest ? 150 : 110);
      this.playArea.height = stage.span - (isRest ? 300 : 220);
      return;
    }

    this.worldBounds = { width: stage.span, height: GAME_HEIGHT };
    this.playArea = cloneRect(isRest ? BASE_REST_BOUNDS : BASE_STAGE_BOUNDS);
    this.playArea.setPosition(isRest ? 120 : 110, isRest ? 146 : 174);
    this.playArea.width = stage.span - (isRest ? 240 : 220);
  }

  private buildStageLayout(stage: MissionStage): void {
    const flow = this.getStageFlow(stage);
    const base = this.add.rectangle(this.worldBounds.width / 2, this.worldBounds.height / 2, this.worldBounds.width, this.worldBounds.height, 0x070d16).setDepth(-14);
    this.stageObjects.push(base);

    const stars = this.add.graphics().setDepth(-13);
    stars.fillStyle(0xc6ddff, 0.9);
    const density = gameSession.settings.graphics.quality === "Performance"
      ? 0.48
      : gameSession.settings.graphics.quality === "Balanced"
        ? 0.68
        : 0.88;
    const starBudget = flow === "up"
      ? Math.max(18, Math.floor((this.worldBounds.height / 32) * density))
      : Math.max(12, Math.floor((this.worldBounds.width / 28) * density));
    for (let i = 0; i < starBudget; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(18, this.worldBounds.width - 18),
        Phaser.Math.Between(16, this.worldBounds.height - 16),
        Phaser.Math.FloatBetween(0.8, 2),
      );
    }
    this.stageObjects.push(stars);

    if (flow === "right") {
      const upperWall = this.add.rectangle(this.worldBounds.width / 2, this.playArea.y - 42, this.worldBounds.width - 100, 120, 0x0b1523, 0.98)
        .setDepth(-10);
      const lowerWall = this.add.rectangle(this.worldBounds.width / 2, this.playArea.bottom + 42, this.worldBounds.width - 100, 120, 0x0b1523, 0.98)
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
    } else {
      const leftWall = this.add.rectangle(this.playArea.x - 42, this.worldBounds.height / 2, 120, this.worldBounds.height - 100, 0x0b1523, 0.98)
        .setDepth(-10);
      const rightWall = this.add.rectangle(this.playArea.right + 42, this.worldBounds.height / 2, 120, this.worldBounds.height - 100, 0x0b1523, 0.98)
        .setDepth(-10);
      const shaft = this.add.rectangle(this.playArea.centerX, this.playArea.centerY, this.playArea.width, this.playArea.height, 0x111f31, 0.98)
        .setStrokeStyle(4, 0x78abed, 0.82)
        .setDepth(-8);
      this.stageObjects.push(leftWall, rightWall, shaft);

      const rungSpacing = gameSession.settings.graphics.quality === "Performance"
        ? 280
        : gameSession.settings.graphics.quality === "Balanced"
          ? 220
          : 180;
      for (let lineY = this.playArea.bottom - 140; lineY > this.playArea.y + 120; lineY -= rungSpacing) {
        const line = this.add.rectangle(this.playArea.centerX, lineY, this.playArea.width - 48, 12, 0x1c304a, 0.58).setDepth(-7);
        this.stageObjects.push(line);
      }
    }

    const entryPoint = this.getStageEntryPoint(stage);
    const exitPoint = this.getStageExitPoint(stage);
    const entryVertical = flow === "up";

    const startGlow = this.add.rectangle(entryPoint.x, entryPoint.y, entryVertical ? 148 : 76, entryVertical ? 76 : 148, 0x56c8ff, 0.14).setDepth(-6);
    const startDoor = this.add.rectangle(entryPoint.x, entryPoint.y, entryVertical ? 134 : 50, entryVertical ? 50 : 134, 0x20486a, 0.96)
      .setStrokeStyle(3, 0x8be4ff, 0.72)
      .setDepth(-5);
    this.stageObjects.push(startGlow, startDoor);

    const doorGlow = this.add.rectangle(exitPoint.x, exitPoint.y, entryVertical ? 148 : 76, entryVertical ? 76 : 148, 0xffcb68, 0.08).setDepth(2);
    const doorFrame = this.add.rectangle(exitPoint.x, exitPoint.y, entryVertical ? 134 : 50, entryVertical ? 50 : 134, 0x473113, 0.94)
      .setStrokeStyle(3, 0xffcb68, 0.5)
      .setDepth(3);
    const doorLabel = this.add.text(flow === "up" ? exitPoint.x - 42 : exitPoint.x - 58, flow === "up" ? exitPoint.y + 40 : this.playArea.y - 28, "Locked", {
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
    const flow = this.getStageFlow(stage);
    this.hallwayZones = stage.zones.map((zone) => {
      const triggerPoint = this.getWorldPointAlongFlow(flow, zone.triggerProgress);
      const marker = flow === "up"
        ? this.add.rectangle(this.playArea.centerX, triggerPoint.y, this.playArea.width - 32, 10, 0x6fa8ef, 0.16).setDepth(-6)
        : this.add.rectangle(triggerPoint.x, this.playArea.centerY, 10, this.playArea.height - 36, 0x6fa8ef, 0.16).setDepth(-6);
      this.stageObjects.push(marker);
      return { data: zone, activated: false, marker };
    });
  }

  private setupRestRoom(_stage: RestStage): void {
    const flow = this.currentStage ? this.getStageFlow(this.currentStage) : "right";
    const horizontalOffset = flow === "up" ? 0 : 160;
    const verticalOffset = flow === "up" ? 160 : 0;

    const healPad = this.add.rectangle(this.playArea.centerX - horizontalOffset, this.playArea.centerY - verticalOffset, 134, 134, 0x173c2c, 0.94)
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

    const supplyPad = this.add.rectangle(this.playArea.centerX + horizontalOffset, this.playArea.centerY + verticalOffset, 134, 134, 0x3b2d18, 0.94)
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
    this.messageText.setText("Safe room secured. Heal up, check supplies, then move through the next door.");
  }

  private setupBossRoom(stage: BossStage): void {
    const flow = this.getStageFlow(stage);
    const triggerPoint = this.getWorldPointAlongFlow(flow, stage.triggerProgress);
    const triggerMarker = flow === "up"
      ? this.add.rectangle(this.playArea.centerX, triggerPoint.y, this.playArea.width - 36, 12, 0xc8a7ff, 0.2).setDepth(-6)
      : this.add.rectangle(triggerPoint.x, this.playArea.centerY, 12, this.playArea.height - 36, 0xc8a7ff, 0.2).setDepth(-6);
    this.stageObjects.push(triggerMarker);
    this.messageText.setText("Advance into the relay heart. The brute should wake once you cross the core threshold.");
  }

  private getStageFlow(stage: MissionStage): MissionFlow {
    return stage.flow;
  }

  private getStageEntryPoint(stage: MissionStage): Phaser.Math.Vector2 {
    return this.getStageFlow(stage) === "up"
      ? new Phaser.Math.Vector2(this.playArea.centerX, this.playArea.bottom - 90)
      : new Phaser.Math.Vector2(this.playArea.x + 90, this.playArea.centerY);
  }

  private getStageExitPoint(stage: MissionStage): Phaser.Math.Vector2 {
    return this.getStageFlow(stage) === "up"
      ? new Phaser.Math.Vector2(this.playArea.centerX, this.playArea.y + 26)
      : new Phaser.Math.Vector2(this.playArea.right - 26, this.playArea.centerY);
  }

  private getWorldPointAlongFlow(flow: MissionFlow, progress: number): Phaser.Math.Vector2 {
    if (flow === "up") {
      return new Phaser.Math.Vector2(
        this.playArea.centerX,
        Phaser.Math.Linear(this.playArea.bottom - 80, this.playArea.y + 80, progress),
      );
    }

    return new Phaser.Math.Vector2(
      Phaser.Math.Linear(this.playArea.x + 80, this.playArea.right - 80, progress),
      this.playArea.centerY,
    );
  }

  private hasReachedWorldPoint(point: Phaser.Math.Vector2, flow: MissionFlow): boolean {
    return flow === "up" ? this.player.y <= point.y : this.player.x >= point.x;
  }

  private getSpawnPointAheadOfProgress(flow: MissionFlow, progress: number): Phaser.Math.Vector2 {
    const base = this.getWorldPointAlongFlow(flow, progress);
    if (flow === "up") {
      return new Phaser.Math.Vector2(
        this.playArea.centerX + Phaser.Math.Between(-110, 110),
        Phaser.Math.Clamp(base.y - Phaser.Math.Between(140, 300), this.playArea.y + 60, this.playArea.bottom - 60),
      );
    }

    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(base.x + Phaser.Math.Between(140, 320), this.playArea.x + 60, this.playArea.right - 60),
      this.playArea.centerY + Phaser.Math.Between(-110, 110),
    );
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
    this.applyHumanoidStride(this.player, movement.length(), 0, this.getBaseAimDirection());
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

  private getPlayerTargetColor(): number {
    return (this.player.fillColor as number | undefined) ?? PLAYER_TARGET_COLOR;
  }

  private applyHumanoidStride(
    sprite: Phaser.GameObjects.Arc,
    movementAmount: number,
    phaseOffset: number,
    facingDirection?: Phaser.Math.Vector2,
  ): void {
    const intensity = Phaser.Math.Clamp(movementAmount, 0, 1);
    if (intensity <= 0.02) {
      sprite.setScale(1, 1);
      return;
    }

    const cycle = Number(sprite.getData("strideCycle") ?? phaseOffset) + (movementAmount * 0.38);
    sprite.setData("strideCycle", cycle);
    const sway = Math.sin(cycle * Math.PI * 2) * 0.045 * intensity;
    const facingWeight = facingDirection ? Math.abs(facingDirection.x) : 0.5;
    const xScale = 1 - sway * (0.8 + facingWeight * 0.55);
    const yScale = 1 + sway * (0.72 + (1 - facingWeight) * 0.45);
    sprite.setScale(xScale, yScale);
  }

  private updateShieldStates(dt: number): void {
    if (this.playerShield < this.playerMaxShield && this.playerShieldDelay <= 0) {
      this.playerShield = Math.min(this.playerMaxShield, this.playerShield + PLAYER_SHIELD_REGEN_RATE * dt);
    }

    this.companions.forEach((companion) => {
      if (!companion.downed && companion.shield < companion.maxShield && companion.shieldDelay <= 0) {
        companion.shield = Math.min(companion.maxShield, companion.shield + COMPANION_SHIELD_REGEN_RATE * dt);
      }
    });
  }

  private updateCompanionRevive(dt: number): void {
    this.companions.forEach((companion) => {
      if (!companion.downed) {
        companion.reviveProgress = 0;
        companion.reviveHeld = false;
        companion.revivePromptText.setVisible(false);
        return;
      }

      const reviveAvailable = this.canReviveCompanion(companion);
      companion.revivePromptText.setPosition(companion.sprite.x, companion.sprite.y - 38);
      companion.revivePromptText.setVisible(true);

      if (!reviveAvailable) {
        companion.reviveProgress = 0;
        companion.reviveHeld = false;
        companion.revivePointerId = null;
        companion.revivePromptText.setText(this.touchMode ? `${companion.name}\nMove Close To Revive` : `${companion.name}\nMove Close + Hold F`);
        return;
      }

      if (!companion.reviveHeld) {
        companion.reviveProgress = 0;
        companion.revivePromptText.setText(this.touchMode ? `Hold To Revive\n${companion.name}` : `Hold F To Revive\n${companion.name}`);
        return;
      }

      companion.reviveProgress = Math.min(COMPANION_REVIVE_HOLD_TIME, companion.reviveProgress + dt);
      const remaining = Math.max(0, COMPANION_REVIVE_HOLD_TIME - companion.reviveProgress);
      companion.revivePromptText.setText(`${companion.name}\nReviving ${remaining.toFixed(1)}s`);
      if (companion.reviveProgress >= COMPANION_REVIVE_HOLD_TIME) {
        this.reviveCompanion(companion, false);
        this.endCompanionReviveHold(companion);
      }
    });
  }

  private handleFiring(): void {
    if (this.isCombatLocked() || this.fireCooldown > 0 || this.isActivelyRevivingCompanion()) {
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

  private updateCompanions(dt: number): void {
    if (!gameSession.getModeRules().companionsEnabled) {
      this.companions.forEach((companion) => {
        companion.sprite.setVisible(false);
        companion.shieldRing.setVisible(false);
        companion.guardPlate?.setVisible(false);
        companion.revivePromptText.setVisible(false);
      });
      return;
    }

    const followDirection = this.getBaseAimDirection();
    this.companions.forEach((companion, index) => {
      if (companion.downed) {
        companion.sprite.setVisible(true);
        companion.shieldRing.setVisible(true);
        companion.guardPlate?.setVisible(false);
        companion.shieldRing.setStrokeStyle(3, 0xffd36d, 0.55 + 0.35 * (companion.reviveProgress / COMPANION_REVIVE_HOLD_TIME));
        companion.shieldRing.setPosition(companion.sprite.x, companion.sprite.y);
        companion.sprite.setFillStyle(0x5b4d3b, 0.92);
        companion.sprite.setAlpha(0.62 + Math.sin(this.time.now / 180 + index) * 0.08);
        return;
      }

      const target = this.getNearestEnemy(companion.sprite.x, companion.sprite.y, this.getCompanionAttackRange(companion.attackStyle));
      const threatAvoidance = this.getCompanionThreatAvoidance(companion);
      const desiredAnchor = this.getCompanionDesiredAnchor(companion, followDirection, target, threatAvoidance, index);
      const desiredX = desiredAnchor.x;
      const desiredY = desiredAnchor.y;
      const beforeX = companion.sprite.x;
      const beforeY = companion.sprite.y;
      const smoothing = 1 - Math.exp(-dt * (companion.attackStyle === "shield" || companion.attackStyle === "melee" ? 9 : 10.5));
      companion.sprite.x = Phaser.Math.Linear(companion.sprite.x, desiredX, smoothing);
      companion.sprite.y = Phaser.Math.Linear(companion.sprite.y, desiredY, smoothing);
      companion.sprite.x = Phaser.Math.Clamp(companion.sprite.x, this.playArea.x + companion.radius, this.playArea.right - companion.radius);
      companion.sprite.y = Phaser.Math.Clamp(companion.sprite.y, this.playArea.y + companion.radius, this.playArea.bottom - companion.radius);
      companion.sprite.setVisible(true);
      companion.sprite.setFillStyle(companion.coreColor, 1);
      companion.sprite.setAlpha(1);
      companion.shieldRing.setStrokeStyle(3, 0x7de6ff, 0.78);
      companion.shieldRing.setVisible(companion.shield > 0.5);
      companion.shieldRing.setPosition(companion.sprite.x, companion.sprite.y);
      const movementAmount = Phaser.Math.Clamp(
        Phaser.Math.Distance.Between(beforeX, beforeY, companion.sprite.x, companion.sprite.y) / Math.max(1, MOVE_SPEED * dt),
        0,
        1,
      );
      const facing = target
        ? new Phaser.Math.Vector2(target.sprite.x - companion.sprite.x, target.sprite.y - companion.sprite.y).normalize()
        : followDirection;
      companion.guardFacing = facing.clone();
      this.updateCompanionGuardPlate(companion);
      this.applyHumanoidStride(companion.sprite, movementAmount, index + 0.9, facing);

      if (companion.cooldown > 0 || this.currentStage?.type === "rest") {
        return;
      }

      if (companion.attackStyle === "healer") {
        const healTarget = this.getCompanionHealTarget(companion);
        if (healTarget) {
          companion.cooldown = 1.25;
          this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.46, 220);
          this.applyCompanionHeal(healTarget, 14, 9);
          return;
        }
      }

      if (!target) {
        return;
      }

      const distanceToTarget = Phaser.Math.Distance.Between(companion.sprite.x, companion.sprite.y, target.sprite.x, target.sprite.y);
      if (companion.attackStyle === "shield" && distanceToTarget <= 164) {
        companion.cooldown = 1.1;
        const shieldWave = this.add.circle(companion.sprite.x, companion.sprite.y, 20)
          .setStrokeStyle(5, companion.projectileColor, 0.92)
          .setDepth(12);
        this.tweens.add({
          targets: shieldWave,
          scale: 3,
          alpha: 0,
          duration: 180,
          onComplete: () => shieldWave.destroy(),
        });

        this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.52, 200);
        this.enemies.slice().forEach((enemy) => {
          const distance = Phaser.Math.Distance.Between(companion.sprite.x, companion.sprite.y, enemy.sprite.x, enemy.sprite.y);
          if (distance <= 100) {
            this.damageEnemy(enemy, 14);
            enemy.chargeTimer = 0;
            enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.35);
          }
        });
        return;
      }

      const direction = new Phaser.Math.Vector2(target.sprite.x - companion.sprite.x, target.sprite.y - companion.sprite.y).normalize();

      if (companion.attackStyle === "melee") {
        if (distanceToTarget > 112) {
          return;
        }

        companion.cooldown = 0.95;
        const slash = this.add.rectangle(companion.sprite.x + direction.x * 18, companion.sprite.y + direction.y * 18, 84, 16, companion.projectileColor, 0.58)
          .setOrigin(0.2, 0.5)
          .setRotation(direction.angle())
          .setDepth(12);
        this.tweens.add({
          targets: slash,
          alpha: 0,
          scaleX: 1.4,
          duration: 160,
          onComplete: () => slash.destroy(),
        });
        this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.42, 180);
        this.damageEnemy(target, 16);
        this.enemies.slice().forEach((enemy) => {
          if (enemy === target) {
            return;
          }
          const distance = Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, enemy.sprite.x, enemy.sprite.y);
          if (distance <= 62) {
            this.damageEnemy(enemy, 8);
          }
        });
        return;
      }

      if (companion.attackStyle === "caster") {
        companion.cooldown = 0.88;
        this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.4, 200);
        this.spawnBullet(companion.sprite.x, companion.sprite.y, direction, 470, 11, 5, "companion", companion.projectileColor);
        const chainedEnemy = this.enemies.find((enemy) =>
          enemy !== target
          && Phaser.Math.Distance.Between(target.sprite.x, target.sprite.y, enemy.sprite.x, enemy.sprite.y) <= 92,
        );
        if (chainedEnemy) {
          this.time.delayedCall(90, () => {
            if (!this.enemies.includes(chainedEnemy)) {
              return;
            }
            this.damageEnemy(chainedEnemy, 7);
            this.spawnCombatLight(chainedEnemy.sprite.x, chainedEnemy.sprite.y, companion.projectileColor, 0.34, 160);
          });
        }
        return;
      }

      if (companion.attackStyle === "demolition") {
        companion.cooldown = 1.18;
        this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.46, 220);
        this.spawnBullet(companion.sprite.x, companion.sprite.y, direction, 320, 14, 8, "companion", companion.projectileColor, 68, 7);
        return;
      }

      companion.cooldown = companion.attackStyle === "shield" ? 1.24 : 0.62;
      this.spawnCombatLight(companion.sprite.x, companion.sprite.y, companion.projectileColor, 0.36, 180);
      this.spawnBullet(
        companion.sprite.x,
        companion.sprite.y,
        direction,
        companion.attackStyle === "shield" ? 340 : 440,
        companion.attackStyle === "shield" ? 12 : 10,
        companion.attackStyle === "shield" ? 6 : 5,
        "companion",
        companion.projectileColor,
      );
    });
  }

  private getCompanionAttackRange(style: CompanionAttackStyle): number {
    if (style === "shield") {
      return 300;
    }

    if (style === "melee") {
      return 220;
    }

    if (style === "demolition" || style === "caster" || style === "healer") {
      return 420;
    }

    return 360;
  }

  private getCompanionHealTarget(companion: CompanionState): { side: ActorSide; companion?: CompanionState } | null {
    const playerMissing = this.playerMaxHp - this.playerHp + Math.max(0, this.playerMaxShield - this.playerShield) * 0.55;
    let best: { side: ActorSide; companion?: CompanionState; score: number } | null = playerMissing > 8
      ? { side: "player", score: playerMissing }
      : null;

    this.companions.forEach((ally) => {
      if (ally === companion || ally.downed) {
        return;
      }

      const missing = (ally.maxHp - ally.hp) + Math.max(0, ally.maxShield - ally.shield) * 0.55;
      if (missing <= 8) {
        return;
      }

      if (!best || missing > best.score) {
        best = {
          side: "companion",
          companion: ally,
          score: missing,
        };
      }
    });

    return best ? { side: best.side, companion: best.companion } : null;
  }

  private applyCompanionHeal(target: { side: ActorSide; companion?: CompanionState }, hpAmount: number, shieldAmount: number): void {
    if (target.side === "player") {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + hpAmount);
      this.playerShield = Math.min(this.playerMaxShield, this.playerShield + shieldAmount);
      this.playerShieldDelay = Math.max(0, this.playerShieldDelay - 0.35);
      this.spawnCombatLight(this.player.x, this.player.y, 0x9be8ff, 0.52, 220);
      return;
    }

    if (!target.companion) {
      return;
    }

    target.companion.hp = Math.min(target.companion.maxHp, target.companion.hp + hpAmount);
    target.companion.shield = Math.min(target.companion.maxShield, target.companion.shield + shieldAmount);
    target.companion.shieldDelay = Math.max(0, target.companion.shieldDelay - 0.35);
    this.spawnCombatLight(target.companion.sprite.x, target.companion.sprite.y, 0x9be8ff, 0.46, 220);
  }

  private spawnCombatLight(x: number, y: number, color: number, scale: number, duration: number): void {
    const flash = this.add.circle(x, y, 26, color, 0.22).setDepth(13);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1 + scale,
      scaleY: 1 + scale,
      duration,
      onComplete: () => flash.destroy(),
    });
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
          if (target.side === "companion" && target.companion) {
            this.damageCompanion(target.companion, Math.round((11 + Math.floor(this.stageIndex * 1.5)) * difficulty.enemyDamage));
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
          if (target.side === "companion" && target.companion) {
            this.damageCompanion(target.companion, Math.round((17 + this.stageIndex * 2) * difficulty.enemyDamage));
          } else {
            this.damagePlayer(Math.round((17 + this.stageIndex * 2) * difficulty.enemyDamage));
          }
          enemy.attackCooldown = 0.75;
        }
      }

      enemy.sprite.x = Phaser.Math.Clamp(enemy.sprite.x, this.playArea.x + enemy.radius, this.playArea.right - enemy.radius);
      enemy.sprite.y = Phaser.Math.Clamp(enemy.sprite.y, this.playArea.y + enemy.radius, this.playArea.bottom - enemy.radius);
      enemy.aura.setPosition(enemy.sprite.x, enemy.sprite.y);
      this.applyHumanoidStride(
        enemy.sprite,
        enemy.kind === "boss" ? 0.42 : 0.72,
        enemy.stateTimer * 7 + enemy.radius,
        direction,
      );
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
        const shieldBlocker = this.getShieldBlockingCompanion(bullet);
        if (shieldBlocker) {
          this.damageCompanion(shieldBlocker, Math.max(1, Math.round(bullet.damage * 0.8)));
          bullet.sprite.destroy();
          this.bullets.splice(index, 1);
          continue;
        }

        const hitCompanion = this.getTargetableCompanions()
          .find((companion) =>
            Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, companion.sprite.x, companion.sprite.y) <= bullet.radius + companion.radius,
          );
        const hitPlayer = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, this.player.x, this.player.y) <= bullet.radius + 18;
        if (hitCompanion) {
          this.damageCompanion(hitCompanion, bullet.damage);
          this.spawnCombatLight(bullet.sprite.x, bullet.sprite.y, 0xff9bb0, 0.34, 160);
          bullet.sprite.destroy();
          this.bullets.splice(index, 1);
          continue;
        }

        if (hitPlayer) {
          this.damagePlayer(bullet.damage);
          this.spawnCombatLight(bullet.sprite.x, bullet.sprite.y, 0xff9bb0, 0.4, 180);
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
        if (bullet.splashRadius && bullet.splashDamage) {
          const splashRadius = bullet.splashRadius;
          const splashDamage = bullet.splashDamage;
          this.enemies.slice().forEach((other) => {
            if (other === enemy) {
              return;
            }

            const splashDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, other.sprite.x, other.sprite.y);
            if (splashDistance <= splashRadius) {
              this.damageEnemy(other, splashDamage);
            }
          });
        }
        this.spawnCombatLight(enemy.sprite.x, enemy.sprite.y, 0xffd28f, bullet.splashRadius ? 0.52 : 0.3, 190);
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
    if (nextZone && this.hasReachedWorldPoint(this.getWorldPointAlongFlow(this.getStageFlow(this.currentStage as MissionStage), nextZone.data.triggerProgress), this.getStageFlow(this.currentStage as MissionStage))) {
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
      this.companions.forEach((companion) => {
        companion.hp = companion.maxHp;
        companion.shield = companion.maxShield;
        companion.shieldDelay = 0;
        if (companion.downed) {
          this.reviveCompanion(companion, true);
        }
      });
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
    const triggerPoint = this.getWorldPointAlongFlow(this.getStageFlow(stage), stage.triggerProgress);
    if (!this.bossTriggered && this.hasReachedWorldPoint(triggerPoint, this.getStageFlow(stage))) {
      this.bossTriggered = true;
      this.messageText.setText("The brute wakes. Break it and extract.");
      const bossSpawn = this.getStageFlow(stage) === "up"
        ? new Phaser.Math.Vector2(this.playArea.centerX, this.playArea.y + 220)
        : new Phaser.Math.Vector2(this.playArea.right - 220, this.playArea.centerY);
      this.spawnEnemy("boss", bossSpawn.x, bossSpawn.y);
      stage.adds?.forEach((group) => {
        for (let i = 0; i < group.count; i += 1) {
          const spawnPoint = this.getStageFlow(stage) === "up"
            ? new Phaser.Math.Vector2(
              this.playArea.centerX + Phaser.Math.Between(-120, 120),
              this.playArea.y + 320 + i * 28,
            )
            : new Phaser.Math.Vector2(
              this.playArea.right - 380 + i * 34,
              this.playArea.centerY + Phaser.Math.Between(-90, 90),
            );
          this.spawnEnemy(group.kind, spawnPoint.x, spawnPoint.y);
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
    const flow = this.getStageFlow(this.currentStage as MissionStage);
    zone.data.enemies.forEach((group) => {
      for (let i = 0; i < group.count; i += 1) {
        const spawnPoint = this.getSpawnPointAheadOfProgress(flow, zone.data.triggerProgress);
        this.spawnEnemy(group.kind, spawnPoint.x, spawnPoint.y);
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
    this.lockBracket.clear();
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
    this.lockBracket.clear();
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
    splashRadius = 0,
    splashDamage = 0,
  ): void {
    const bullet = this.add.circle(x, y, radius, color, 0.96).setDepth(9);
    bullet.setStrokeStyle(2, color, 0.84);
    this.spawnCombatLight(x, y, color, 0.22, 120);
    this.bullets.push({
      sprite: bullet,
      velocity: direction.clone().normalize().scale(speed),
      life: 1.5,
      damage,
      radius,
      owner,
      splashRadius: splashRadius > 0 ? splashRadius : undefined,
      splashDamage: splashDamage > 0 ? splashDamage : undefined,
    });
  }

  private castPulse(): void {
    if (this.pulseCooldown > 0 || this.isCombatLocked() || this.isActivelyRevivingCompanion()) {
      return;
    }

    this.pulseCooldown = PULSE_COOLDOWN;
    if (gameSession.settings.graphics.screenShake) {
      this.cameras.main.shake(90, 0.0015);
    }
    this.spawnCombatLight(this.player.x, this.player.y, 0x7fe3ff, 0.64, 220);

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
    if (this.arcCooldown > 0 || this.isCombatLocked() || this.isActivelyRevivingCompanion()) {
      return;
    }

    this.arcCooldown = ARC_COOLDOWN;
    const direction = this.getCombatAimDirection();
    this.spawnCombatLight(this.player.x, this.player.y, 0xffd16a, 0.52, 180);
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
    if (this.dashCooldown > 0 || this.isCombatLocked() || this.isActivelyRevivingCompanion()) {
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
    this.spawnCombatLight(this.player.x, this.player.y, 0x9ae7ff, 0.42, 150);
  }

  private damagePlayer(amount: number): void {
    if (this.playerInvuln > 0 || this.missionComplete) {
      return;
    }

    if (this.isActivelyRevivingCompanion()) {
      this.endAllCompanionRevives();
    }

    const resolved = this.applyShieldDamage(this.playerShield, amount);
    this.playerShield = resolved.shield;
    if (this.playerMaxShield > 0 && amount > 0) {
      this.playerShieldDelay = SHIELD_REGEN_DELAY;
    }
    this.playerInvuln = 0.45;
    this.playerHp = Math.max(0, this.playerHp - resolved.healthDamage);
    this.spawnCombatLight(this.player.x, this.player.y, resolved.healthDamage > 0 ? 0xff9bb0 : 0x7de6ff, 0.54, 180);
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
    if (enemy.maxShield > 0 && amount > 0) {
      enemy.shieldRegenDelay = SHIELD_REGEN_DELAY;
    }

    enemy.hp -= resolved.healthDamage;
    enemy.damageFlash = 0.28;
    this.spawnCombatLight(enemy.sprite.x, enemy.sprite.y, resolved.healthDamage > 0 ? enemy.roleColor : 0x7de6ff, 0.34, 170);
    if (enemy.hp > 0) {
      return;
    }

    if (enemy.kind === "boss") {
      this.spawnLootBurst(enemy.sprite.x, enemy.sprite.y);
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

  private damageCompanion(companion: CompanionState, amount: number): void {
    if (!this.canCompanionBeTargeted(companion)) {
      return;
    }

    this.endCompanionReviveHold(companion);
    const resolved = this.applyShieldDamage(companion.shield, amount);
    companion.shield = resolved.shield;
    if (companion.maxShield > 0 && amount > 0) {
      companion.shieldDelay = SHIELD_REGEN_DELAY;
    }
    companion.hp = Math.max(0, companion.hp - resolved.healthDamage);
    this.spawnCombatLight(companion.sprite.x, companion.sprite.y, resolved.healthDamage > 0 ? 0xffb08e : 0x7de6ff, 0.4, 180);

    if (companion.hp > 0) {
      return;
    }

    companion.downed = true;
    companion.reviveProgress = 0;
    companion.reviveHeld = false;
    companion.revivePointerId = null;
    companion.cooldown = 0;
    companion.sprite.setVisible(true);
    companion.shield = 0;
    companion.shieldRing.setVisible(true);
    companion.guardPlate?.setVisible(false);
    this.messageText.setText(`${companion.name} is down. Reach them and hold revive while the fight keeps moving.`);
  }

  private spawnLootBurst(x: number, y: number): void {
    const colors = [0xffd67a, 0x8fe8ff, 0xc8a7ff, 0xffb27d];
    for (let index = 0; index < 9; index += 1) {
      const angle = (Math.PI * 2 * index) / 9;
      const shard = this.add.circle(x, y, 6 + (index % 2), colors[index % colors.length], 0.92).setDepth(15);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * Phaser.Math.Between(54, 108),
        y: y + Math.sin(angle) * Phaser.Math.Between(54, 108),
        alpha: 0,
        scaleX: 1.45,
        scaleY: 1.45,
        duration: 460,
        onComplete: () => shard.destroy(),
      });
    }

    const rewardText = this.add.text(x, y - 26, "Loot Burst", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#fff4ca",
      fontStyle: "bold",
      backgroundColor: "#0c1522cc",
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(16);
    this.tweens.add({
      targets: rewardText,
      y: y - 58,
      alpha: 0,
      duration: 520,
      onComplete: () => rewardText.destroy(),
    });
  }

  private reviveCompanion(companion: CompanionState, fromRestRoom: boolean): void {
    companion.downed = false;
    companion.reviveProgress = 0;
    companion.reviveHeld = false;
    companion.revivePointerId = null;
    companion.hp = fromRestRoom ? companion.maxHp : Math.ceil(companion.maxHp * 0.55);
    companion.shield = fromRestRoom ? companion.maxShield : Math.ceil(companion.maxShield * 0.45);
    companion.shieldDelay = 0.4;
    companion.sprite.setFillStyle(companion.coreColor, 1);
    companion.sprite.setAlpha(1);
    companion.sprite.setVisible(true);
    companion.revivePromptText.setVisible(false);
    companion.shieldRing.setVisible(companion.shield > 0.5);
    companion.guardPlate?.setVisible(true);
    if (!fromRestRoom) {
      this.messageText.setText(`${companion.name} is back on their feet. Formation restored.`);
    }
  }

  private canCompanionBeTargeted(companion?: CompanionState): boolean {
    if (!gameSession.getModeRules().companionsEnabled) {
      return false;
    }

    if (!companion) {
      return this.companions.some((entry) => !entry.downed && entry.sprite.visible);
    }

    return !companion.downed && companion.sprite.visible;
  }

  private canReviveCompanion(companion: CompanionState): boolean {
    return companion.downed
      && !this.missionComplete
      && !this.transitioningStage
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, companion.sprite.x, companion.sprite.y) <= COMPANION_REVIVE_RANGE;
  }

  private isActivelyRevivingCompanion(): boolean {
    return this.companions.some((companion) => companion.downed && companion.reviveHeld && this.canReviveCompanion(companion));
  }

  private beginKeyboardRevive(): void {
    const reviveTarget = this.getReviveTarget();
    if (!reviveTarget) {
      return;
    }

    this.endAllCompanionRevives();
    reviveTarget.reviveHeld = true;
  }

  private beginTouchRevive(pointer: Phaser.Input.Pointer, companion: CompanionState): void {
    if (!this.canReviveCompanion(companion)) {
      return;
    }

    this.endAllCompanionRevives();
    companion.revivePointerId = pointer.id;
    companion.reviveHeld = true;
  }

  private endTouchRevive(pointer: Phaser.Input.Pointer): void {
    const reviveTarget = this.companions.find((companion) => companion.revivePointerId === pointer.id);
    if (!reviveTarget) {
      return;
    }

    this.endCompanionReviveHold(reviveTarget);
  }

  private endCompanionReviveHold(companion?: CompanionState): void {
    if (!companion) {
      this.endAllCompanionRevives();
      return;
    }

    companion.reviveHeld = false;
    companion.revivePointerId = null;
    companion.reviveProgress = 0;
  }

  private endAllCompanionRevives(): void {
    this.companions.forEach((companion) => {
      companion.reviveHeld = false;
      companion.revivePointerId = null;
      companion.reviveProgress = 0;
    });
  }

  private getEnemyFocusTarget(enemy: Enemy): EnemyFocusTarget {
    const baseTarget: EnemyFocusTarget = {
      side: "player",
      x: this.player.x,
      y: this.player.y,
      radius: 18,
    };

    const companionTargets = this.getTargetableCompanions();
    if (companionTargets.length === 0) {
      return baseTarget;
    }

    let bestTarget = baseTarget;
    let bestScore = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);

    companionTargets.forEach((companion) => {
      const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, companion.sprite.x, companion.sprite.y);
      const weightedDistance = distance * companion.aggroWeight;
      if (weightedDistance >= bestScore) {
        return;
      }

      bestScore = weightedDistance;
      bestTarget = {
        side: "companion",
        x: companion.sprite.x,
        y: companion.sprite.y,
        radius: companion.radius,
        companion,
      };
    });

    return bestTarget;
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
    this.hpFill.width = PLAYER_BAR_WIDTH * (this.playerHp / this.playerMaxHp);
    this.shieldFill.width = PLAYER_BAR_WIDTH * (this.playerShield / Math.max(1, this.playerMaxShield));
    this.hpValueText.setText(`${Math.ceil(this.playerHp)} / ${this.playerMaxHp}`);
    this.shieldValueText.setText(`${Math.ceil(this.playerShield)} / ${this.playerMaxShield}`);
    this.playerShieldRing.setVisible(this.playerShield > 0.5);
    this.playerShieldRing.setAlpha(this.playerShield > 0 ? 0.84 : 0);
    this.companions.forEach((companion) => {
      companion.hud.hpFill.width = companionsEnabled ? COMPANION_BAR_WIDTH * (companion.hp / Math.max(1, companion.maxHp)) : 0;
      companion.hud.shieldFill.width = companionsEnabled ? COMPANION_BAR_WIDTH * (companion.shield / Math.max(1, companion.maxShield)) : 0;
      companion.hud.hpValueText.setAlpha(companionsEnabled ? 1 : 0.32);
      companion.hud.shieldValueText.setAlpha(companionsEnabled ? 1 : 0.32);
      companion.hud.hpValueText.setText(companionsEnabled ? `${Math.ceil(companion.hp)} / ${companion.maxHp}` : "--");
      companion.hud.shieldValueText.setText(companionsEnabled ? `${Math.ceil(companion.shield)} / ${companion.maxShield}` : "--");
      companion.hud.stateText.setAlpha(companionsEnabled ? 1 : 0.32);
      companion.hud.stateText.setText(
        !companionsEnabled
          ? `${companion.name} | Offline`
          : companion.downed
            ? this.canReviveCompanion(companion)
              ? `${companion.name} | Hold ${this.touchMode ? "Revive" : "F"} ${Math.max(0, COMPANION_REVIVE_HOLD_TIME - companion.reviveProgress).toFixed(1)}s`
              : `${companion.name} | Downed - Move Close`
            : `${companion.name} | ${Math.round(companion.shield)} shield / ${Math.round(companion.hp)} hp`,
      );
      companion.shieldRing.setVisible(companion.downed || (this.canCompanionBeTargeted(companion) && companion.shield > 0.5));
    });

    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    const bossVisible = Boolean(boss);
    this.bossFrame.setVisible(bossVisible);
    this.bossFill.setVisible(bossVisible);
    this.bossTitle.setVisible(bossVisible);
    if (boss) {
      this.bossFill.width = 242 * (boss.hp / boss.maxHp);
    }

    if (this.autoAimTarget) {
      this.drawTargetBracket(this.autoAimTarget);
      this.reticle.setStrokeStyle(3, this.getPlayerTargetColor(), 0.96);
    } else {
      this.lockBracket.clear();
      this.reticle.setStrokeStyle(3, this.getPlayerTargetColor(), 0.82);
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

    const reviveTarget = this.getReviveTarget();
    if (reviveTarget) {
      this.attackButton?.setLabel(reviveTarget.reviveHeld
        ? `Revive\n${Math.max(0, COMPANION_REVIVE_HOLD_TIME - reviveTarget.reviveProgress).toFixed(1)}s`
        : `Revive\n${reviveTarget.name}`);
      this.attackButton?.setCooldownProgress(reviveTarget.reviveHeld ? 1 - (reviveTarget.reviveProgress / COMPANION_REVIVE_HOLD_TIME) : 0);
      this.attackButton?.setInputEnabled(this.touchMode && !combatLocked);
    } else {
      this.attackButton?.setLabel(combatLocked ? "Safe\nRoom" : "Attack");
      this.attackButton?.setCooldownProgress(combatLocked ? 1 : 0);
      this.attackButton?.setInputEnabled(this.touchMode && !combatLocked);
    }

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

  private drawTargetBracket(target: Enemy): void {
    const size = target.radius + 14;
    const corner = 11;
    const left = target.sprite.x - size;
    const right = target.sprite.x + size;
    const top = target.sprite.y - size;
    const bottom = target.sprite.y + size;

    this.lockBracket.clear();
    this.lockBracket.lineStyle(3, this.getPlayerTargetColor(), 0.96);
    this.lockBracket.beginPath();
    this.lockBracket.moveTo(left, top + corner);
    this.lockBracket.lineTo(left, top);
    this.lockBracket.lineTo(left + corner, top);
    this.lockBracket.moveTo(right - corner, top);
    this.lockBracket.lineTo(right, top);
    this.lockBracket.lineTo(right, top + corner);
    this.lockBracket.moveTo(right, bottom - corner);
    this.lockBracket.lineTo(right, bottom);
    this.lockBracket.lineTo(right - corner, bottom);
    this.lockBracket.moveTo(left + corner, bottom);
    this.lockBracket.lineTo(left, bottom);
    this.lockBracket.lineTo(left, bottom - corner);
    this.lockBracket.strokePath();
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
    this.lockBracket.clear();
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

  private handleAttackButtonPress(pointer: Phaser.Input.Pointer): void {
    const reviveTarget = this.getReviveTarget();
    if (reviveTarget) {
      this.beginTouchRevive(pointer, reviveTarget);
      return;
    }

    this.beginTouchAttack(pointer);
  }

  private handleAttackButtonRelease(pointer: Phaser.Input.Pointer): void {
    if (this.companions.some((companion) => companion.revivePointerId === pointer.id)) {
      this.endTouchRevive(pointer);
      return;
    }

    this.endTouchAttack(pointer);
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

  private getTargetableCompanions(): CompanionState[] {
    return this.companions.filter((companion) => this.canCompanionBeTargeted(companion));
  }

  private getReviveTarget(): CompanionState | null {
    const candidates = this.companions
      .filter((companion) => this.canReviveCompanion(companion))
      .sort((left, right) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, left.sprite.x, left.sprite.y)
        - Phaser.Math.Distance.Between(this.player.x, this.player.y, right.sprite.x, right.sprite.y),
      );

    return candidates[0] ?? null;
  }

  private getCompanionThreatAvoidance(companion: CompanionState): Phaser.Math.Vector2 {
    const threat = this.bullets
      .filter((bullet) => bullet.owner === "enemy")
      .map((bullet) => ({
        bullet,
        distance: Phaser.Math.Distance.Between(companion.sprite.x, companion.sprite.y, bullet.sprite.x, bullet.sprite.y),
      }))
      .filter((entry) => entry.distance <= 120)
      .sort((left, right) => left.distance - right.distance)[0];

    if (!threat) {
      return new Phaser.Math.Vector2(0, 0);
    }

    const avoid = new Phaser.Math.Vector2(
      companion.sprite.x - threat.bullet.sprite.x,
      companion.sprite.y - threat.bullet.sprite.y,
    );
    if (avoid.lengthSq() === 0) {
      return new Phaser.Math.Vector2(0, 0);
    }

    return avoid.normalize().scale(28);
  }

  private getCompanionDesiredAnchor(
    companion: CompanionState,
    followDirection: Phaser.Math.Vector2,
    target: Enemy | null,
    threatAvoidance: Phaser.Math.Vector2,
    motionSeed = 0,
  ): Phaser.Math.Vector2 {
    const normalizedForward = followDirection.clone();
    if (normalizedForward.lengthSq() === 0) {
      normalizedForward.set(1, 0);
    } else {
      normalizedForward.normalize();
    }

    const perpendicular = new Phaser.Math.Vector2(-normalizedForward.y, normalizedForward.x);
    const anchor = new Phaser.Math.Vector2(
      this.player.x + normalizedForward.x * companion.slotForward + perpendicular.x * companion.slotLateral,
      this.player.y + normalizedForward.y * companion.slotForward + perpendicular.y * companion.slotLateral,
    );

    if (companion.attackStyle === "shield") {
      const guardDirection = target
        ? new Phaser.Math.Vector2(target.sprite.x - this.player.x, target.sprite.y - this.player.y).normalize()
        : normalizedForward.clone();
      anchor.add(guardDirection.scale(target ? 18 : 10));
      anchor.add(perpendicular.clone().scale(companion.slotLateral >= 0 ? 6 : -6));
    } else if (companion.attackStyle === "melee" && target) {
      const lungeDirection = new Phaser.Math.Vector2(target.sprite.x - companion.sprite.x, target.sprite.y - companion.sprite.y).normalize();
      anchor.add(lungeDirection.scale(20));
    } else if (companion.attackStyle === "healer") {
      anchor.add(normalizedForward.clone().scale(-12));
      anchor.add(perpendicular.clone().scale(Math.sin(this.time.now / 260 + motionSeed) * 8));
    } else if (companion.attackStyle === "demolition" && target) {
      const stepOff = Math.sin(this.time.now / 240 + motionSeed * 0.8 + companion.slotLateral * 0.02) * 12;
      anchor.add(perpendicular.clone().scale(stepOff));
      anchor.add(normalizedForward.clone().scale(-4));
    } else if (target) {
      const weave = Math.sin(this.time.now / 180 + motionSeed * 0.8 + companion.slotLateral * 0.02) * 10;
      anchor.add(perpendicular.clone().scale(weave));
    }

    anchor.add(threatAvoidance);
    return anchor;
  }

  private updateCompanionGuardPlate(companion: CompanionState): void {
    if (!companion.guardPlate) {
      return;
    }

    const facing = companion.guardFacing.lengthSq() > 0 ? companion.guardFacing.clone().normalize() : new Phaser.Math.Vector2(1, 0);
    companion.guardPlate.setVisible(!companion.downed);
    companion.guardPlate.setPosition(
      companion.sprite.x + facing.x * (companion.radius + 9),
      companion.sprite.y + facing.y * (companion.radius + 9),
    );
    companion.guardPlate.setRotation(facing.angle());
  }

  private getShieldBlockingCompanion(bullet: Bullet): CompanionState | null {
    for (const companion of this.getTargetableCompanions()) {
      if (!companion.guardPlate || companion.attackStyle !== "shield" || companion.shield <= 0.5) {
        continue;
      }

      const plateCenter = companion.guardPlate.getCenter();
      const distance = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, plateCenter.x, plateCenter.y);
      if (distance > bullet.radius + 16) {
        continue;
      }

      const toBullet = new Phaser.Math.Vector2(bullet.sprite.x - companion.sprite.x, bullet.sprite.y - companion.sprite.y);
      if (toBullet.lengthSq() > 0 && companion.guardFacing.dot(toBullet.normalize()) < 0.15) {
        continue;
      }

      return companion;
    }

    return null;
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
    this.endCompanionReviveHold();
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
      companions: this.companions.map((companion) => ({
        id: companion.id,
        slotId: companion.slotId,
        hp: Math.round(companion.hp),
        shield: Math.round(companion.shield),
        downed: companion.downed,
        reviveProgress: Number(companion.reviveProgress.toFixed(1)),
        reviveReady: this.canReviveCompanion(companion),
        x: Math.round(companion.sprite.x),
        y: Math.round(companion.sprite.y),
      })),
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
