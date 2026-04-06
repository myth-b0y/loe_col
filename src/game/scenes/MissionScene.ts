import Phaser from "phaser";

import { FIRST_MISSION, missionRegistry, type MissionDefinition } from "../content/missions";
import { GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

type BulletOwner = "player" | "companion" | "enemy";
type EnemyKind = "rusher" | "shooter" | "boss";

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
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  attackCooldown: number;
  specialCooldown: number;
  damageFlash: number;
  stateTimer: number;
};

const ARENA = new Phaser.Geom.Rectangle(92, 100, 1096, 520);
const MOVE_SPEED = 315;
const DASH_DISTANCE = 128;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;

export class MissionScene extends Phaser.Scene {
  private mission: MissionDefinition = FIRST_MISSION;
  private brightnessLayer?: BrightnessLayer;
  private roomIndex = 0;
  private roomCleared = false;
  private missionComplete = false;

  private player!: Phaser.GameObjects.Arc;
  private playerFacing!: Phaser.GameObjects.Rectangle;
  private companion!: Phaser.GameObjects.Arc;
  private playerHp = 100;
  private playerMaxHp = 100;
  private playerInvuln = 0;
  private fireCooldown = 0;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private arcCooldown = 0;
  private companionCooldown = 0;

  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private fireHeld = false;

  private touchEnabled = false;
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
  private lookPoint = new Phaser.Math.Vector2(ARENA.centerX + 120, ARENA.centerY);
  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;
  private moveBase?: Phaser.GameObjects.Arc;
  private moveKnob?: Phaser.GameObjects.Arc;
  private aimBase?: Phaser.GameObjects.Arc;
  private aimKnob?: Phaser.GameObjects.Arc;
  private pulseButton?: MenuButton;
  private dashButton?: MenuButton;
  private arcButton?: MenuButton;
  private pauseButton?: MenuButton;

  private aimLine!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Arc;
  private hpFill!: Phaser.GameObjects.Rectangle;
  private bossFill?: Phaser.GameObjects.Rectangle;
  private bossFrame?: Phaser.GameObjects.Rectangle;
  private roomText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private progressDots: Phaser.GameObjects.Arc[] = [];
  private advanceButton?: MenuButton;
  private resultPanel?: Phaser.GameObjects.Container;

  constructor() {
    super("mission");
  }

  init(data: { missionId?: string }): void {
    this.resetMissionRuntime();
    this.mission = missionRegistry[data.missionId ?? FIRST_MISSION.id] ?? FIRST_MISSION;
  }

  create(): void {
    this.touchEnabled = this.sys.game.device.input.touch;
    this.drawBackdrop();
    this.brightnessLayer = createBrightnessLayer(this);
    this.createActors();
    this.createHud();
    this.createTouchUi();
    this.createResultPanel();
    this.bindKeyboard();
    this.bindPointers();
    this.spawnRoom(0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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

    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateFacing();
    this.handleFiring();
    this.updateCompanion(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateRoomState();
    this.updateHudState();
  }

  private resetMissionRuntime(): void {
    this.roomIndex = 0;
    this.roomCleared = false;
    this.missionComplete = false;

    this.playerHp = 100;
    this.playerMaxHp = 100;
    this.playerInvuln = 0;
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
    this.lookPoint.set(ARENA.centerX + 120, ARENA.centerY);

    this.movePointerId = null;
    this.aimPointerId = null;

    this.progressDots = [];
    this.bossFill = undefined;
    this.bossFrame = undefined;
    this.advanceButton = undefined;
    this.resultPanel = undefined;

    this.moveBase = undefined;
    this.moveKnob = undefined;
    this.aimBase = undefined;
    this.aimKnob = undefined;
    this.pulseButton = undefined;
    this.dashButton = undefined;
    this.arcButton = undefined;
    this.pauseButton = undefined;
    this.moveKeys = undefined;
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x070d16).setDepth(-10);
    this.add.rectangle(ARENA.centerX, ARENA.centerY, ARENA.width, ARENA.height, 0x121f34, 0.96)
      .setStrokeStyle(4, 0x78abed, 0.82)
      .setDepth(-6);
    this.add.rectangle(640, 58, 1120, 54, 0x10182a, 0.96)
      .setStrokeStyle(2, 0x4c709d, 0.8);
    this.add.rectangle(640, 662, 1120, 34, 0x10182a, 0.9)
      .setStrokeStyle(1, 0x304e74, 0.8);

    const stars = this.add.graphics().setDepth(-9);
    stars.fillStyle(0xc6ddff, 0.9);
    for (let i = 0; i < 62; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(18, 1262),
        Phaser.Math.Between(18, 702),
        Phaser.Math.FloatBetween(1, 2.2),
      );
    }
  }

  private createActors(): void {
    this.player = this.add.circle(ARENA.x + 140, ARENA.centerY, 18, 0xf2f7ff).setDepth(10);
    this.player.setStrokeStyle(4, 0x7caeff, 1);
    this.playerFacing = this.add.rectangle(this.player.x + 26, this.player.y, 34, 8, 0x7ee1ff)
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.companion = this.add.circle(this.player.x - 48, this.player.y + 38, 12, 0xf3cc7a).setDepth(9);
    this.companion.setStrokeStyle(3, 0xfff1ba, 1);

    this.aimLine = this.add.graphics().setDepth(8);
    this.reticle = this.add.circle(this.lookPoint.x, this.lookPoint.y, 14, 0x7ee1ff, 0.14).setDepth(8);
    this.reticle.setStrokeStyle(3, 0xbef2ff, 0.82);
  }

  private createHud(): void {
    this.add.text(112, 43, this.mission.title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f5fbff",
      fontStyle: "bold",
    });

    this.add.text(640, 43, this.mission.objective, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
    }).setOrigin(0.5);

    this.roomText = this.add.text(640, 84, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    }).setOrigin(0.5);

    this.messageText = this.add.text(640, 646, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d7e8ff",
    }).setOrigin(0.5);

    this.add.rectangle(176, 88, 168, 18, 0x08111c, 0.96).setStrokeStyle(2, 0x6ea2e5, 0.8);
    this.hpFill = this.add.rectangle(92, 88, 160, 10, 0x47c56c, 0.96).setOrigin(0, 0.5);
    this.add.text(94, 72, "Hull / Vital Light", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d7e8ff",
    });

    this.progressDots = this.mission.rooms.map((_room, index) =>
      this.add.circle(544 + index * 24, 84, 7, 0x29425f, 1).setDepth(5),
    );

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
  }

  private createTouchUi(): void {
    if (!this.touchEnabled) {
      return;
    }

    this.moveBase = this.add.circle(148, 566, STICK_RADIUS, 0x173054, 0.36).setDepth(14);
    this.moveBase.setStrokeStyle(3, 0x72a8ff, 0.65);
    this.moveKnob = this.add.circle(148, 566, 34, 0xdde9ff, 0.72).setDepth(15);
    this.moveKnob.setStrokeStyle(2, 0xffffff, 0.9);

    this.aimBase = this.add.circle(1114, 566, STICK_RADIUS, 0x173054, 0.36).setDepth(14);
    this.aimBase.setStrokeStyle(3, 0x72a8ff, 0.65);
    this.aimKnob = this.add.circle(1114, 566, 34, 0xdde9ff, 0.72).setDepth(15);
    this.aimKnob.setStrokeStyle(2, 0xffffff, 0.9);

    this.add.text(148, 470, "MOVE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15);

    this.add.text(1114, 470, "AIM / FIRE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15);

    this.pulseButton = createMenuButton({
      scene: this,
      x: 916,
      y: 566,
      width: 140,
      height: 68,
      label: "Pulse",
      onClick: () => this.castPulse(),
      depth: 15,
      accentColor: 0x166b8c,
    });

    this.arcButton = createMenuButton({
      scene: this,
      x: 930,
      y: 480,
      width: 128,
      height: 56,
      label: "Arc",
      onClick: () => this.castArcLance(),
      depth: 15,
      accentColor: 0x7a5f1d,
    });

    this.dashButton = createMenuButton({
      scene: this,
      x: 1046,
      y: 406,
      width: 124,
      height: 56,
      label: "Dash",
      onClick: () => this.tryDash(),
      depth: 15,
      accentColor: 0x63408f,
    });
  }

  private createResultPanel(): void {
    const background = this.add.rectangle(640, 360, 620, 360, 0x08111c, 0.98)
      .setStrokeStyle(3, 0x79abed, 0.85)
      .setDepth(40);

    const title = this.add.text(410, 214, "Mission Complete", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(41);

    const body = this.add.text(410, 278, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
      lineSpacing: 8,
      wordWrap: { width: 460 },
    }).setDepth(41);

    const returnButton = createMenuButton({
      scene: this,
      x: 640,
      y: 498,
      width: 230,
      label: "Return To Ship",
      onClick: () => {
        gameSession.completeMission(this.mission.id, this.mission.reward);
        this.scene.start("hub");
      },
      depth: 41,
      accentColor: 0x1c4f7f,
    });

    this.resultPanel = this.add.container(0, 0, [
      background,
      title,
      body,
      returnButton.container,
    ]).setDepth(40);

    this.resultPanel.setVisible(false);
    this.resultPanel.setDataEnabled();
    this.resultPanel.data?.set("body", body);
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

    keyboard.on("keydown-Q", () => this.castPulse());
    keyboard.on("keydown-E", () => this.castArcLance());
    keyboard.on("keydown-SHIFT", () => this.tryDash());
    keyboard.on("keydown-ESC", () => this.openPauseMenu());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-Q");
      keyboard.removeAllListeners("keydown-E");
      keyboard.removeAllListeners("keydown-SHIFT");
      keyboard.removeAllListeners("keydown-ESC");
    });
  }

  private bindPointers(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.missionComplete) {
        return;
      }

      if (this.touchEnabled) {
        if (this.pointerOverUi(pointer)) {
          return;
        }

        if (pointer.x < GAME_WIDTH * 0.5 && this.movePointerId === null && this.moveBase && this.moveKnob) {
          this.movePointerId = pointer.id;
          this.anchorMoveStick(pointer.x, pointer.y);
          this.updateMoveStick(pointer);
          return;
        }

        if (pointer.x >= GAME_WIDTH * 0.5 && this.aimPointerId === null && this.aimBase && this.aimKnob) {
          this.aimPointerId = pointer.id;
          this.anchorAimStick(pointer.x, pointer.y);
          this.updateAimStick(pointer);
        }

        return;
      }

      if (pointer.rightButtonDown()) {
        this.tryDash();
        return;
      }

      this.fireHeld = true;
      this.lookPoint.set(pointer.worldX, pointer.worldY);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.touchEnabled) {
        if (pointer.id === this.movePointerId && pointer.isDown) {
          this.updateMoveStick(pointer);
          return;
        }

        if (pointer.id === this.aimPointerId && pointer.isDown) {
          this.updateAimStick(pointer);
          return;
        }

        return;
      }

      this.lookPoint.set(pointer.worldX, pointer.worldY);
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.touchEnabled) {
        if (pointer.id === this.movePointerId) {
          this.movePointerId = null;
          this.moveVector.set(0, 0);
          this.resetMoveStick();
        }

        if (pointer.id === this.aimPointerId) {
          this.aimPointerId = null;
          this.resetAimStick();
        }
        return;
      }

      this.fireHeld = false;
    });
  }

  private spawnRoom(index: number): void {
    this.roomIndex = index;
    this.roomCleared = false;
    this.clearBullets();
    this.clearEnemies();
    this.advanceButton?.container.setVisible(false);
    this.messageText.setText(this.mission.rooms[index].flavor);
    this.roomText.setText(`Room ${index + 1}/${this.mission.rooms.length}: ${this.mission.rooms[index].name}`);

    this.progressDots.forEach((dot, dotIndex) => {
      dot.setFillStyle(dotIndex < index ? 0x79abed : dotIndex === index ? 0xffd36d : 0x29425f, 1);
    });

    const room = this.mission.rooms[index];
    if (room.enemies) {
      room.enemies.forEach((group) => {
        for (let i = 0; i < group.count; i += 1) {
          this.spawnEnemy(group.kind);
        }
      });
    }

    if (room.boss) {
      this.spawnEnemy("boss");
    }
  }

  private spawnEnemy(kind: EnemyKind): void {
    const position = new Phaser.Math.Vector2(
      Phaser.Math.Between(ARENA.x + 220, ARENA.right - 110),
      Phaser.Math.Between(ARENA.y + 70, ARENA.bottom - 70),
    );

    const config = kind === "rusher"
      ? { color: 0xdd5f6f, hp: 54, radius: 18, speed: 142 }
      : kind === "shooter"
        ? { color: 0xf4b566, hp: 40, radius: 16, speed: 112 }
        : { color: 0x9f68ff, hp: 290, radius: 32, speed: 88 };

    const sprite = this.add.circle(position.x, position.y, config.radius, config.color).setDepth(9);
    sprite.setStrokeStyle(4, 0xffecf2, 0.7);

    this.enemies.push({
      kind,
      sprite,
      hp: config.hp,
      maxHp: config.hp,
      radius: config.radius,
      speed: config.speed,
      attackCooldown: Phaser.Math.FloatBetween(0.4, 1.1),
      specialCooldown: kind === "boss" ? 2.2 : 0,
      damageFlash: 0,
      stateTimer: 0,
    });
  }

  private updateKeyboardVector(): void {
    this.keyboardVector.set(0, 0);
    if (!this.moveKeys || this.missionComplete) {
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
    }
  }

  private updateMovement(dt: number): void {
    if (this.missionComplete) {
      return;
    }

    const movement = this.moveVector.lengthSq() > 0.01 ? this.moveVector : this.keyboardVector;
    this.player.x = Phaser.Math.Clamp(this.player.x + movement.x * MOVE_SPEED * dt, ARENA.x + 20, ARENA.right - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y + movement.y * MOVE_SPEED * dt, ARENA.y + 20, ARENA.bottom - 20);

    const alpha = this.playerInvuln > 0 ? 0.6 : 1;
    this.player.setAlpha(alpha);
  }

  private updateFacing(): void {
    const direction = this.touchEnabled
      ? this.aimVector.clone().normalize()
      : new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y).normalize();

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

  private handleFiring(): void {
    if (this.missionComplete || this.roomCleared || this.fireCooldown > 0) {
      return;
    }

    const touchAutoFire = this.touchEnabled && this.aimPointerId !== null && this.aimVector.lengthSq() > 0.2;
    if (!this.fireHeld && !touchAutoFire) {
      return;
    }

    this.fireCooldown = 0.16;
    const direction = new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y).normalize();
    this.spawnBullet(this.player.x + direction.x * 24, this.player.y + direction.y * 24, direction, 560, 12, 5, "player", 0x7ee1ff);
  }

  private updateCompanion(dt: number): void {
    const desiredX = this.player.x - 44;
    const desiredY = this.player.y + 34;
    const smoothing = 1 - Math.exp(-dt * 6);
    this.companion.x = Phaser.Math.Linear(this.companion.x, desiredX, smoothing);
    this.companion.y = Phaser.Math.Linear(this.companion.y, desiredY, smoothing);

    const target = this.getNearestEnemy(this.companion.x, this.companion.y, 280);
    if (!target || this.companionCooldown > 0 || this.roomCleared) {
      return;
    }

    this.companionCooldown = 0.65;
    const direction = new Phaser.Math.Vector2(target.sprite.x - this.companion.x, target.sprite.y - this.companion.y).normalize();
    this.spawnBullet(this.companion.x, this.companion.y, direction, 440, 10, 5, "companion", 0xffd779);
  }

  private updateEnemies(dt: number): void {
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);

    this.enemies.forEach((enemy) => {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.specialCooldown = Math.max(0, enemy.specialCooldown - dt);
      enemy.damageFlash = Math.max(0, enemy.damageFlash - dt * 6);

      enemy.sprite.setFillStyle(
        enemy.kind === "rusher" ? 0xdd5f6f : enemy.kind === "shooter" ? 0xf4b566 : 0x9f68ff,
        enemy.damageFlash > 0 ? 0.45 : 1,
      );

      const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.sprite.x, this.player.y - enemy.sprite.y);
      const distance = toPlayer.length();
      const direction = distance > 0 ? toPlayer.normalize() : new Phaser.Math.Vector2(1, 0);

      if (enemy.kind === "rusher") {
        enemy.sprite.x += direction.x * enemy.speed * dt;
        enemy.sprite.y += direction.y * enemy.speed * dt;

        if (distance < enemy.radius + 24 && enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1;
          this.damagePlayer(11);
        }
        return;
      }

      if (enemy.kind === "shooter") {
        const desiredRange = 220;
        const moveDir = distance > desiredRange ? direction : distance < 150 ? direction.clone().scale(-1) : new Phaser.Math.Vector2(0, 0);
        enemy.sprite.x += moveDir.x * enemy.speed * dt;
        enemy.sprite.y += moveDir.y * enemy.speed * dt;

        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1.4;
          this.spawnBullet(enemy.sprite.x, enemy.sprite.y, direction, 260, 9, 6, "enemy", 0xff7f9c);
        }
        return;
      }

      enemy.stateTimer += dt;
      enemy.sprite.x += direction.x * enemy.speed * dt;
      enemy.sprite.y += direction.y * enemy.speed * dt;

      if (distance < enemy.radius + 28 && enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 1;
        this.damagePlayer(16);
      }

      if (enemy.specialCooldown <= 0) {
        enemy.specialCooldown = enemy.hp < enemy.maxHp * 0.5 ? 1.8 : 2.6;
        const burstCount = enemy.hp < enemy.maxHp * 0.5 ? 10 : 8;
        for (let burst = 0; burst < burstCount; burst += 1) {
          const angle = (Math.PI * 2 * burst) / burstCount;
          const vector = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
          this.spawnBullet(enemy.sprite.x, enemy.sprite.y, vector, 210, 8, 7, "enemy", 0xc8a7ff);
        }
      }
    });

    if (this.bossFrame && this.bossFill) {
      const boss = this.enemies.find((enemy) => enemy.kind === "boss");
      const visible = Boolean(boss);
      this.bossFrame.setVisible(visible);
      this.bossFill.setVisible(visible);
      if (boss) {
        this.bossFill.width = 320 * (boss.hp / boss.maxHp);
      }
    }
  }

  private updateBullets(dt: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.life -= dt;
      bullet.sprite.x += bullet.velocity.x * dt;
      bullet.sprite.y += bullet.velocity.y * dt;

      if (!ARENA.contains(bullet.sprite.x, bullet.sprite.y) || bullet.life <= 0) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
        continue;
      }

      if (bullet.owner === "enemy") {
        if (Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, this.player.x, this.player.y) <= bullet.radius + 18) {
          this.damagePlayer(bullet.damage);
          bullet.sprite.destroy();
          this.bullets.splice(index, 1);
        }
        continue;
      }

      let hit = false;
      this.enemies.forEach((enemy) => {
        if (hit || enemy.hp <= 0) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(bullet.sprite.x, bullet.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (distance > bullet.radius + enemy.radius) {
          return;
        }

        enemy.hp -= bullet.damage;
        enemy.damageFlash = 0.25;
        hit = true;

        if (enemy.hp <= 0) {
          enemy.sprite.destroy();
        }
      });

      if (hit) {
        bullet.sprite.destroy();
        this.bullets.splice(index, 1);
      }
    }
  }

  private updateRoomState(): void {
    if (this.missionComplete) {
      return;
    }

    const enemiesAlive = this.enemies.some((enemy) => enemy.hp > 0);
    if (enemiesAlive || this.roomCleared) {
      return;
    }

    this.roomCleared = true;
    this.progressDots[this.roomIndex].setFillStyle(0x79abed, 1);

    if (!this.advanceButton) {
      this.advanceButton = createMenuButton({
        scene: this,
        x: 640,
        y: 606,
        width: 190,
        height: 44,
        label: "Advance",
        onClick: () => undefined,
        depth: 16,
        accentColor: 0x1a4a78,
      });
      this.advanceButton.container.setVisible(false);
    }

    if (this.roomIndex < this.mission.rooms.length - 1) {
      this.messageText.setText("Room secure. Advance when ready.");
      this.advanceButton.setLabel("Advance");
      this.advanceButton.setEnabled(true);
      this.advanceButton.setOnClick(() => this.spawnRoom(this.roomIndex + 1));
      this.advanceButton.container.setVisible(true);
      return;
    }

    this.finishMission();
  }

  private finishMission(): void {
    this.missionComplete = true;
    this.messageText.setText("Relay secure. Mission complete.");
    this.advanceButton?.container.setVisible(false);

    const body = this.resultPanel?.data?.get("body") as Phaser.GameObjects.Text | undefined;
    body?.setText([
      `${this.mission.title} has been cleared.`,
      "",
      `Reward: +${this.mission.reward.xp} XP`,
      `Credits: +${this.mission.reward.credits}`,
      `Recovered Item: ${this.mission.reward.item}`,
      "",
      "Return to the command deck to save, regroup, and queue the next build chunk.",
    ]);
    this.resultPanel?.setVisible(true);
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
      life: 1.4,
      damage,
      radius,
      owner,
    });
  }

  private castPulse(): void {
    if (this.pulseCooldown > 0 || this.missionComplete) {
      return;
    }

    this.pulseCooldown = 2.8;
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

    this.enemies.forEach((enemy) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      if (distance <= 170) {
        enemy.hp -= 28;
        enemy.damageFlash = 0.3;
      }
    });
  }

  private castArcLance(): void {
    if (this.arcCooldown > 0 || this.missionComplete) {
      return;
    }

    this.arcCooldown = 4.5;
    const direction = new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y).normalize();
    const beam = this.add.rectangle(this.player.x, this.player.y, 220, 12, 0xffd16a, 0.55).setOrigin(0, 0.5).setDepth(13);
    beam.setRotation(direction.angle());
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 180,
      onComplete: () => beam.destroy(),
    });

    this.enemies.forEach((enemy) => {
      const toEnemy = new Phaser.Math.Vector2(enemy.sprite.x - this.player.x, enemy.sprite.y - this.player.y);
      const distanceAlong = toEnemy.dot(direction);
      const lateral = Math.abs(toEnemy.cross(direction));
      if (distanceAlong >= 0 && distanceAlong <= 230 && lateral <= 34) {
        enemy.hp -= 40;
        enemy.damageFlash = 0.35;
      }
    });
  }

  private tryDash(): void {
    if (this.dashCooldown > 0 || this.missionComplete) {
      return;
    }

    this.dashCooldown = 1.25;
    const direction = this.moveVector.lengthSq() > 0.01
      ? this.moveVector.clone()
      : this.keyboardVector.lengthSq() > 0.01
        ? this.keyboardVector.clone()
        : this.touchEnabled
          ? this.aimVector.clone()
          : new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y);

    if (direction.lengthSq() === 0) {
      direction.set(1, 0);
    } else {
      direction.normalize();
    }

    this.player.x = Phaser.Math.Clamp(this.player.x + direction.x * DASH_DISTANCE, ARENA.x + 18, ARENA.right - 18);
    this.player.y = Phaser.Math.Clamp(this.player.y + direction.y * DASH_DISTANCE, ARENA.y + 18, ARENA.bottom - 18);
    this.playerInvuln = 0.22;
  }

  private damagePlayer(amount: number): void {
    if (this.playerInvuln > 0 || this.missionComplete) {
      return;
    }

    this.playerInvuln = 0.45;
    this.playerHp = Math.max(0, this.playerHp - amount);
    if (gameSession.settings.graphics.screenShake) {
      this.cameras.main.shake(80, 0.0012);
    }

    if (this.playerHp > 0) {
      return;
    }

    this.scene.start("hub");
  }

  private updateHudState(): void {
    this.hpFill.width = 160 * (this.playerHp / this.playerMaxHp);

    const boss = this.enemies.find((enemy) => enemy.kind === "boss");
    if (boss && !this.bossFrame && !this.bossFill) {
      this.bossFrame = this.add.rectangle(956, 88, 328, 18, 0x08111c, 0.96)
        .setStrokeStyle(2, 0xc8a7ff, 0.84)
        .setOrigin(0.5);
      this.bossFill = this.add.rectangle(792, 88, 320, 10, 0x9f68ff, 0.95)
        .setOrigin(0, 0.5);
      this.add.text(794, 72, "Shard Bruiser", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#eadfff",
      });
    }

    const pulseText = this.pulseCooldown <= 0 ? "Pulse ready" : `Pulse ${this.pulseCooldown.toFixed(1)}s`;
    const arcText = this.arcCooldown <= 0 ? "Arc ready" : `Arc ${this.arcCooldown.toFixed(1)}s`;
    const dashText = this.dashCooldown <= 0 ? "Dash ready" : `Dash ${this.dashCooldown.toFixed(1)}s`;
    if (!this.roomCleared) {
      this.messageText.setText(`${pulseText} • ${arcText} • ${dashText}`);
    }

    this.pulseButton?.setLabel(this.pulseCooldown <= 0 ? "Pulse" : `Pulse ${this.pulseCooldown.toFixed(0)}`);
    this.arcButton?.setLabel(this.arcCooldown <= 0 ? "Arc" : `Arc ${this.arcCooldown.toFixed(0)}`);
    this.dashButton?.setLabel(this.dashCooldown <= 0 ? "Dash" : `Dash ${this.dashCooldown.toFixed(0)}`);
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
      || this.pulseButton?.container.getBounds().contains(pointer.x, pointer.y)
      || this.arcButton?.container.getBounds().contains(pointer.x, pointer.y)
      || this.dashButton?.container.getBounds().contains(pointer.x, pointer.y)
      || (this.advanceButton?.container.visible && this.advanceButton.container.getBounds().contains(pointer.x, pointer.y)),
    );
  }

  private anchorMoveStick(x: number, y: number): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(Phaser.Math.Clamp(x, 110, GAME_WIDTH * 0.42), Phaser.Math.Clamp(y, 380, 628));
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

    const strength = Phaser.Math.Clamp(
      (Math.min(distance, STICK_RADIUS) - STICK_DEADZONE) / (STICK_RADIUS - STICK_DEADZONE),
      0,
      1,
    );
    this.moveVector.set(vector.x, vector.y).normalize().scale(strength);
  }

  private resetMoveStick(): void {
    if (!this.moveBase || !this.moveKnob) {
      return;
    }

    this.moveBase.setPosition(148, 566).setFillStyle(0x173054, 0.36);
    this.moveKnob.setPosition(148, 566);
  }

  private anchorAimStick(x: number, y: number): void {
    if (!this.aimBase || !this.aimKnob) {
      return;
    }

    this.aimBase.setPosition(Phaser.Math.Clamp(x, GAME_WIDTH * 0.58, 1188), Phaser.Math.Clamp(y, 350, 628));
    this.aimBase.setFillStyle(0x173054, 0.52);
    this.aimKnob.setPosition(this.aimBase.x, this.aimBase.y);
  }

  private updateAimStick(pointer: Phaser.Input.Pointer): void {
    if (!this.aimBase || !this.aimKnob) {
      return;
    }

    const vector = new Phaser.Math.Vector2(pointer.x - this.aimBase.x, pointer.y - this.aimBase.y);
    const distance = vector.length();
    if (distance > STICK_RADIUS) {
      vector.normalize().scale(STICK_RADIUS);
    }
    this.aimKnob.setPosition(this.aimBase.x + vector.x, this.aimBase.y + vector.y);
    if (distance <= STICK_DEADZONE) {
      return;
    }

    this.aimVector.set(vector.x, vector.y).normalize();
  }

  private resetAimStick(): void {
    if (!this.aimBase || !this.aimKnob) {
      return;
    }

    this.aimBase.setPosition(1114, 566).setFillStyle(0x173054, 0.36);
    this.aimKnob.setPosition(1114, 566);
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

  private clearBullets(): void {
    this.bullets.forEach((bullet) => bullet.sprite.destroy());
    this.bullets = [];
  }

  private clearEnemies(): void {
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies = [];
  }
}
