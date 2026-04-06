import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";

type MoveKeys = {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
};

type DummyTarget = {
  body: Phaser.GameObjects.Arc;
  hp: number;
  label: Phaser.GameObjects.Text;
};

const ROOM = new Phaser.Geom.Rectangle(80, 118, 1120, 520);
const PLAYER_SPEED = 310;
const JOYSTICK_RADIUS = 72;

export class ControlLabScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
  private facingMarker!: Phaser.GameObjects.Rectangle;
  private companion!: Phaser.GameObjects.Arc;
  private missionPulse!: Phaser.GameObjects.Text;
  private infoPanel!: Phaser.GameObjects.Text;
  private hintPanel!: Phaser.GameObjects.Text;
  private touchBanner!: Phaser.GameObjects.Text;
  private moveKeys?: MoveKeys;
  private cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  private lookPoint = new Phaser.Math.Vector2(GAME_WIDTH * 0.7, GAME_HEIGHT * 0.5);
  private keyboardVector = new Phaser.Math.Vector2();
  private touchVector = new Phaser.Math.Vector2();
  private movePointerId: number | null = null;
  private touchEnabled = false;
  private joystickBase!: Phaser.GameObjects.Arc;
  private joystickKnob!: Phaser.GameObjects.Arc;
  private pulseButton!: Phaser.GameObjects.Container;
  private dashButton!: Phaser.GameObjects.Container;
  private pulseCooldown = 0;
  private dashCooldown = 0;
  private dashFlash = 0;
  private dummies: DummyTarget[] = [];

  constructor() {
    super("control-lab");
  }

  create(): void {
    this.touchEnabled = this.sys.game.device.input.touch;
    this.cameras.main.setBackgroundColor("#070b12");

    this.drawBackdrop();
    this.createActors();
    this.createHud();
    this.createKeyboardInput();
    this.createTouchUi();
    this.createDummyTargets();
    this.registerPointerInput();
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashFlash = Math.max(0, this.dashFlash - dt * 3);

    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateFacing();
    this.updateCompanion(dt);
    this.updateHud();
  }

  private drawBackdrop(): void {
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1220)
      .setDepth(-10);

    const stars = this.add.graphics().setDepth(-9);
    stars.fillStyle(0xc6ddff, 0.9);

    for (let index = 0; index < 65; index += 1) {
      const x = Phaser.Math.Between(16, GAME_WIDTH - 16);
      const y = Phaser.Math.Between(16, GAME_HEIGHT - 16);
      const radius = Phaser.Math.FloatBetween(1, 2.6);
      stars.fillCircle(x, y, radius);
    }

    this.add
      .rectangle(ROOM.centerX, ROOM.centerY, ROOM.width, ROOM.height, 0x101f38, 0.94)
      .setStrokeStyle(4, 0x6ca8ff, 0.7);

    this.add
      .rectangle(ROOM.centerX, ROOM.y + 56, ROOM.width - 72, 66, 0x0d1729, 0.95)
      .setStrokeStyle(2, 0x3e5e93, 1);

    this.add
      .text(ROOM.x + 34, ROOM.y + 30, "Champions of Light - Control Lab", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#f3f7ff",
        fontStyle: "bold",
      })
      .setDepth(2);

    this.add
      .text(ROOM.right - 340, ROOM.y + 32, "Prototype Goal: desktop + iPhone input", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#9fc6ff",
      })
      .setDepth(2);
  }

  private createActors(): void {
    this.player = this.add.circle(ROOM.x + 190, ROOM.centerY, 20, 0xf2f7ff).setDepth(5);
    this.player.setStrokeStyle(4, 0x7caeff, 1);

    this.facingMarker = this.add
      .rectangle(this.player.x + 28, this.player.y, 34, 8, 0x7ee1ff)
      .setDepth(6)
      .setOrigin(0, 0.5);

    this.companion = this.add.circle(this.player.x - 52, this.player.y + 58, 14, 0xf0cd79).setDepth(4);
    this.companion.setStrokeStyle(3, 0xffe8a6, 1);

    this.missionPulse = this.add
      .text(ROOM.centerX, ROOM.bottom - 46, "Movement test first. Combat feel next.", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#d6e7ff",
      })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private createHud(): void {
    this.infoPanel = this.add
      .text(ROOM.x + 30, ROOM.y + 102, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#eef4ff",
        lineSpacing: 8,
      })
      .setDepth(10);

    this.hintPanel = this.add
      .text(ROOM.right - 342, ROOM.y + 102, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#eef4ff",
        lineSpacing: 8,
        align: "left",
      })
      .setDepth(10);

    this.touchBanner = this.add
      .text(GAME_WIDTH / 2, 36, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#b8d8ff",
        backgroundColor: "#10213ccc",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(20)
      .setVisible(this.touchEnabled);
  }

  private createKeyboardInput(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.moveKeys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as MoveKeys;

    this.cursorKeys = keyboard.createCursorKeys();

    keyboard.on("keydown-SPACE", () => this.tryPulse());
    keyboard.on("keydown-SHIFT", () => this.tryDash());
  }

  private createTouchUi(): void {
    this.joystickBase = this.add.circle(150, 566, JOYSTICK_RADIUS, 0x173054, 0.44).setDepth(12);
    this.joystickBase.setStrokeStyle(3, 0x72a8ff, 0.65);

    this.joystickKnob = this.add.circle(150, 566, 34, 0xdde9ff, 0.72).setDepth(13);
    this.joystickKnob.setStrokeStyle(2, 0xffffff, 0.9);

    this.pulseButton = this.createActionButton(1090, 562, 58, 0x1a5e7c, "Pulse");
    this.dashButton = this.createActionButton(1186, 470, 48, 0x5e3d84, "Dash");

    this.pulseButton.on("pointerdown", () => this.tryPulse());
    this.dashButton.on("pointerdown", () => this.tryDash());

    this.setTouchUiVisible(this.touchEnabled);
  }

  private createActionButton(
    x: number,
    y: number,
    radius: number,
    fillColor: number,
    label: string,
  ): Phaser.GameObjects.Container {
    const ring = this.add.circle(0, 0, radius, fillColor, 0.65).setStrokeStyle(3, 0xe7f1ff, 0.9);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: radius > 50 ? "20px" : "18px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    text.setOrigin(0.5);

    const button = this.add.container(x, y, [ring, text]).setDepth(14);
    const hitArea = new Phaser.Geom.Circle(0, 0, radius);

    button.setSize(radius * 2, radius * 2);
    button.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

    return button;
  }

  private createDummyTargets(): void {
    const dummyPositions = [
      new Phaser.Math.Vector2(ROOM.x + 760, ROOM.y + 220),
      new Phaser.Math.Vector2(ROOM.x + 934, ROOM.y + 340),
      new Phaser.Math.Vector2(ROOM.x + 690, ROOM.y + 408),
    ];

    dummyPositions.forEach((position, index) => {
      const body = this.add.circle(position.x, position.y, 22, 0xcc4761).setDepth(4);
      body.setStrokeStyle(4, 0xffc8d4, 0.9);

      const label = this.add
        .text(position.x, position.y + 38, `Target ${index + 1}: 3`, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#ffdce4",
        })
        .setOrigin(0.5, 0)
        .setDepth(5);

      this.dummies.push({ body, hp: 3, label });
    });
  }

  private registerPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.touchEnabled && pointer.x < GAME_WIDTH * 0.5 && this.movePointerId === null) {
        this.movePointerId = pointer.id;
        this.updateTouchVector(pointer);
        return;
      }

      if (this.isPointerOverButton(pointer)) {
        return;
      }

      this.lookPoint.set(pointer.worldX, pointer.worldY);

      if (this.touchEnabled) {
        this.tryPulse();
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.movePointerId && pointer.isDown) {
        this.updateTouchVector(pointer);
        return;
      }

      if (!this.touchEnabled || pointer.isDown) {
        this.lookPoint.set(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.movePointerId) {
        this.movePointerId = null;
        this.touchVector.set(0, 0);
        this.joystickKnob.setPosition(this.joystickBase.x, this.joystickBase.y);
      }
    });
  }

  private updateKeyboardVector(): void {
    this.keyboardVector.set(0, 0);

    const leftDown = this.moveKeys?.left.isDown || this.cursorKeys?.left.isDown;
    const rightDown = this.moveKeys?.right.isDown || this.cursorKeys?.right.isDown;
    const upDown = this.moveKeys?.up.isDown || this.cursorKeys?.up.isDown;
    const downDown = this.moveKeys?.down.isDown || this.cursorKeys?.down.isDown;

    if (leftDown) {
      this.keyboardVector.x -= 1;
    }
    if (rightDown) {
      this.keyboardVector.x += 1;
    }
    if (upDown) {
      this.keyboardVector.y -= 1;
    }
    if (downDown) {
      this.keyboardVector.y += 1;
    }

    if (this.keyboardVector.lengthSq() > 0) {
      this.keyboardVector.normalize();
    }
  }

  private updateTouchVector(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.joystickBase.x;
    const dy = pointer.y - this.joystickBase.y;
    const vector = new Phaser.Math.Vector2(dx, dy);

    if (vector.length() > JOYSTICK_RADIUS) {
      vector.normalize().scale(JOYSTICK_RADIUS);
    }

    this.joystickKnob.setPosition(this.joystickBase.x + vector.x, this.joystickBase.y + vector.y);
    this.touchVector.set(vector.x / JOYSTICK_RADIUS, vector.y / JOYSTICK_RADIUS);
  }

  private updateMovement(dt: number): void {
    const moveVector = this.touchVector.lengthSq() > 0.01 ? this.touchVector : this.keyboardVector;

    this.player.x = Phaser.Math.Clamp(this.player.x + moveVector.x * PLAYER_SPEED * dt, ROOM.x + 22, ROOM.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + moveVector.y * PLAYER_SPEED * dt, ROOM.y + 88, ROOM.bottom - 24);

    if (this.dashFlash > 0) {
      this.player.setFillStyle(0xffffff, 1);
    } else {
      this.player.setFillStyle(0xf2f7ff, 1);
    }
  }

  private updateFacing(): void {
    const aim = new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y);
    const direction = aim.lengthSq() > 1 ? aim.normalize() : new Phaser.Math.Vector2(1, 0);
    const angle = direction.angle();

    this.facingMarker.setPosition(this.player.x + direction.x * 26, this.player.y + direction.y * 26);
    this.facingMarker.setRotation(angle);
  }

  private updateCompanion(dt: number): void {
    const desiredX = this.player.x - 56;
    const desiredY = this.player.y + 56;
    const smoothing = 1 - Math.exp(-dt * 7);

    this.companion.x = Phaser.Math.Linear(this.companion.x, desiredX, smoothing);
    this.companion.y = Phaser.Math.Linear(this.companion.y, desiredY, smoothing);
  }

  private tryPulse(): void {
    if (this.pulseCooldown > 0) {
      return;
    }

    this.pulseCooldown = 0.45;
    this.cameras.main.shake(90, 0.0015);

    const ring = this.add.circle(this.player.x, this.player.y, 24).setStrokeStyle(6, 0x7fe3ff, 0.95).setDepth(15);
    this.tweens.add({
      targets: ring,
      scale: 5.2,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy(),
    });

    this.missionPulse.setText("Pulse cast. This will evolve into color-based abilities.");

    this.dummies.forEach((dummy) => {
      if (dummy.hp <= 0) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, dummy.body.x, dummy.body.y);
      if (distance > 170) {
        return;
      }

      dummy.hp -= 1;
      dummy.label.setText(`Target ${this.dummies.indexOf(dummy) + 1}: ${Math.max(dummy.hp, 0)}`);
      dummy.body.setFillStyle(dummy.hp > 0 ? 0xff8aa2 : 0x43617f, 1);

      this.tweens.add({
        targets: dummy.body,
        scaleX: 1.25,
        scaleY: 1.25,
        yoyo: true,
        duration: 90,
      });
    });
  }

  private tryDash(): void {
    if (this.dashCooldown > 0) {
      return;
    }

    this.dashCooldown = 1.2;
    this.dashFlash = 0.18;

    const direction = this.resolveDashDirection();
    const dashDistance = 120;

    this.player.x = Phaser.Math.Clamp(this.player.x + direction.x * dashDistance, ROOM.x + 22, ROOM.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + direction.y * dashDistance, ROOM.y + 88, ROOM.bottom - 24);

    const trail = this.add.rectangle(this.player.x, this.player.y, 56, 24, 0xbcb2ff, 0.42).setDepth(3);
    trail.setRotation(direction.angle());
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: 1.8,
      duration: 180,
      onComplete: () => trail.destroy(),
    });

    this.cameras.main.flash(90, 118, 94, 182, false);
    this.missionPulse.setText("Dash used. Mobility and readability are both feeling points.");
  }

  private resolveDashDirection(): Phaser.Math.Vector2 {
    const candidate = this.touchVector.lengthSq() > 0.01
      ? this.touchVector.clone()
      : this.keyboardVector.lengthSq() > 0.01
        ? this.keyboardVector.clone()
        : new Phaser.Math.Vector2(this.lookPoint.x - this.player.x, this.lookPoint.y - this.player.y);

    if (candidate.lengthSq() === 0) {
      return new Phaser.Math.Vector2(1, 0);
    }

    return candidate.normalize();
  }

  private isPointerOverButton(pointer: Phaser.Input.Pointer): boolean {
    return this.pulseButton.getBounds().contains(pointer.x, pointer.y) || this.dashButton.getBounds().contains(pointer.x, pointer.y);
  }

  private setTouchUiVisible(visible: boolean): void {
    this.joystickBase.setVisible(visible);
    this.joystickKnob.setVisible(visible);
    this.pulseButton.setVisible(visible);
    this.dashButton.setVisible(visible);
  }

  private updateHud(): void {
    const activeInput = this.touchEnabled ? "Touch + on-screen controls" : "Keyboard + mouse";
    const pulseReady = this.pulseCooldown <= 0 ? "ready" : `${this.pulseCooldown.toFixed(1)}s`;
    const dashReady = this.dashCooldown <= 0 ? "ready" : `${this.dashCooldown.toFixed(1)}s`;
    const remainingTargets = this.dummies.filter((dummy) => dummy.hp > 0).length;

    this.infoPanel.setText([
      "Phase 0 foundation",
      "Responsive browser build",
      `Input mode: ${activeInput}`,
      "",
      "Core test actions",
      "Move: WASD / left thumb joystick",
      "Pulse: left click or tap / Space",
      "Dash: right click / Shift / Dash button",
    ]);

    this.hintPanel.setText([
      "Current readout",
      `Targets standing: ${remainingTargets}`,
      `Pulse cooldown: ${pulseReady}`,
      `Dash cooldown: ${dashReady}`,
      "",
      "Immediate next steps",
      "Combat rhythm pass",
      "Companion role behavior",
      "Mission terminal flow",
    ]);

    this.touchBanner.setText(
      this.touchEnabled
        ? "Touch mode active: left thumb moves, right side aims and taps Pulse."
        : "",
    );
  }
}
