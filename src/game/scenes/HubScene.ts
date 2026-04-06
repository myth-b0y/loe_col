import Phaser from "phaser";

import { FIRST_MISSION } from "../content/missions";
import { GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

type StationId = "mission" | "loadout" | "save";

type Station = {
  id: StationId;
  zone: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

const HUB_ROOM = new Phaser.Geom.Rectangle(80, 108, 1120, 544);
const HUB_SPEED = 250;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;

export class HubScene extends Phaser.Scene {
  private brightnessLayer?: BrightnessLayer;
  private player!: Phaser.GameObjects.Arc;
  private buddy!: Phaser.GameObjects.Arc;
  private stations: Station[] = [];
  private nearestStation: Station | null = null;
  private panel?: Phaser.GameObjects.Container;
  private panelBody?: Phaser.GameObjects.Text;
  private panelFooter?: Phaser.GameObjects.Text;
  private panelAction?: MenuButton;
  private promptText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private rewardText?: Phaser.GameObjects.Text;
  private touchEnabled = false;
  private moveKeys?: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
  };
  private moveVector = new Phaser.Math.Vector2();
  private keyboardVector = new Phaser.Math.Vector2();
  private movePointerId: number | null = null;
  private stickBase?: Phaser.GameObjects.Arc;
  private stickKnob?: Phaser.GameObjects.Arc;

  constructor() {
    super("hub");
  }

  create(): void {
    this.touchEnabled = this.sys.game.device.input.touch;
    this.drawBackdrop();
    this.brightnessLayer = createBrightnessLayer(this);
    this.createActors();
    this.createStations();
    this.createHud();
    this.createTouchControls();
    this.bindKeyboard();
    this.bindPointerInput();
    this.presentPendingReward();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.brightnessLayer?.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateBuddy(dt);
    this.updateNearestStation();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x08101a).setDepth(-10);
    this.add.rectangle(HUB_ROOM.centerX, HUB_ROOM.centerY, HUB_ROOM.width, HUB_ROOM.height, 0x122034, 0.95)
      .setStrokeStyle(4, 0x719fd8, 0.82)
      .setDepth(-6);

    this.add.rectangle(640, 74, 1120, 56, 0x10192a, 0.95)
      .setStrokeStyle(2, 0x4a6f9b, 0.8);

    this.add.text(106, 58, "Lumen Carrier - Command Deck", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#f5fbff",
      fontStyle: "bold",
    });

    this.add.text(108, 618, "Prototype hub: move, inspect stations, launch the first mission slice.", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#8eb2da",
    });

    const stars = this.add.graphics().setDepth(-9);
    stars.fillStyle(0xc6ddff, 0.9);
    for (let i = 0; i < 52; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(18, 1262),
        Phaser.Math.Between(18, 702),
        Phaser.Math.FloatBetween(1, 2.3),
      );
    }
  }

  private createActors(): void {
    this.player = this.add.circle(HUB_ROOM.x + 180, HUB_ROOM.centerY, 20, 0xf2f7ff).setDepth(8);
    this.player.setStrokeStyle(4, 0x7caeff, 1);

    this.buddy = this.add.circle(this.player.x - 42, this.player.y + 48, 12, 0xf0cd79).setDepth(7);
    this.buddy.setStrokeStyle(3, 0xffedb3, 1);
  }

  private createStations(): void {
    this.stations = [
      this.createStation("mission", 320, 260, 250, 140, "Mission Terminal"),
      this.createStation("loadout", 650, 420, 250, 140, "Loadout Console"),
      this.createStation("save", 980, 260, 250, 140, "Save Beacon"),
    ];
  }

  private createStation(
    id: StationId,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
  ): Station {
    const zone = this.add.rectangle(x, y, width, height, 0x1a3352, 0.72)
      .setStrokeStyle(3, 0x9ac8ff, 0.82)
      .setDepth(5)
      .setInteractive();

    zone.on("pointerdown", () => this.openStation(id));

    const text = this.add.text(x, y, label, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f2f8ff",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5).setDepth(6);

    this.add.circle(x, y - 38, 18, id === "mission" ? 0x4dc7ff : id === "loadout" ? 0xffd164 : 0x87ffa4, 0.68)
      .setDepth(6);

    return { id, zone, label: text };
  }

  private createHud(): void {
    this.add.text(878, 58, `Level ${gameSession.saveData.profile.level}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.add.text(986, 58, `${gameSession.saveData.profile.credits} credits`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.promptText = this.add.text(640, 662, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e8f1ff",
    }).setOrigin(0.5);

    this.statusText = this.add.text(640, 92, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#9fc6ff",
    }).setOrigin(0.5);

    this.rewardText = this.add.text(640, 128, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d8edff",
      backgroundColor: "#14314dcc",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setVisible(false);

    createMenuButton({
      scene: this,
      x: 1128,
      y: 56,
      width: 116,
      height: 40,
      label: "Pause",
      onClick: () => this.openPauseMenu(),
      depth: 12,
      accentColor: 0x233956,
    });

    this.createPanel();
  }

  private createPanel(): void {
    const background = this.add.rectangle(640, 360, 620, 380, 0x08111c, 0.98)
      .setStrokeStyle(3, 0x79abed, 0.85)
      .setDepth(20);

    const title = this.add.text(368, 202, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(21);

    this.panelBody = this.add.text(368, 252, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
      lineSpacing: 8,
      wordWrap: { width: 540 },
    }).setDepth(21);

    this.panelFooter = this.add.text(368, 484, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#9fc6ff",
    }).setDepth(21);

    const close = createMenuButton({
      scene: this,
      x: 886,
      y: 214,
      width: 88,
      height: 38,
      label: "Close",
      onClick: () => this.closePanel(),
      depth: 21,
      accentColor: 0x253a56,
    });

    this.panelAction = createMenuButton({
      scene: this,
      x: 640,
      y: 522,
      width: 220,
      label: "Confirm",
      onClick: () => undefined,
      depth: 21,
      accentColor: 0x1c4f7f,
    });

    this.panel = this.add.container(0, 0, [
      background,
      title,
      this.panelBody,
      this.panelFooter,
      close.container,
      this.panelAction.container,
    ]).setDepth(20);

    this.panel.setVisible(false);
    this.panel.setDataEnabled();
    this.panel.data?.set("title", title);
  }

  private createTouchControls(): void {
    if (!this.touchEnabled) {
      return;
    }

    this.stickBase = this.add.circle(150, 566, STICK_RADIUS, 0x173054, 0.36).setDepth(14);
    this.stickBase.setStrokeStyle(3, 0x72a8ff, 0.65);

    this.stickKnob = this.add.circle(150, 566, 34, 0xdde9ff, 0.72).setDepth(15);
    this.stickKnob.setStrokeStyle(2, 0xffffff, 0.9);

    this.add.text(150, 470, "MOVE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15);
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
      interact: Phaser.Input.Keyboard.KeyCodes.E,
    }) as typeof this.moveKeys;

    keyboard.on("keydown-ESC", () => this.openPauseMenu());
    keyboard.on("keydown-E", () => {
      if (this.nearestStation) {
        this.openStation(this.nearestStation.id);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ESC");
      keyboard.removeAllListeners("keydown-E");
    });
  }

  private bindPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.touchEnabled || !this.stickBase || this.panel?.visible) {
        return;
      }

      if (pointer.x > GAME_WIDTH * 0.5) {
        return;
      }

      this.movePointerId = pointer.id;
      this.anchorStick(pointer.x, pointer.y);
      this.updateTouchVector(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.movePointerId || !pointer.isDown) {
        return;
      }

      this.updateTouchVector(pointer);
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.movePointerId) {
        return;
      }

      this.movePointerId = null;
      this.moveVector.set(0, 0);
      this.resetStick();
    });
  }

  private updateKeyboardVector(): void {
    this.keyboardVector.set(0, 0);

    if (!this.moveKeys) {
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
    if (this.panel?.visible) {
      return;
    }

    const move = this.moveVector.lengthSq() > 0.01 ? this.moveVector : this.keyboardVector;
    this.player.x = Phaser.Math.Clamp(this.player.x + move.x * HUB_SPEED * dt, HUB_ROOM.x + 22, HUB_ROOM.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + move.y * HUB_SPEED * dt, HUB_ROOM.y + 22, HUB_ROOM.bottom - 22);
  }

  private updateBuddy(dt: number): void {
    const desiredX = this.player.x - 38;
    const desiredY = this.player.y + 44;
    const smoothing = 1 - Math.exp(-dt * 7);

    this.buddy.x = Phaser.Math.Linear(this.buddy.x, desiredX, smoothing);
    this.buddy.y = Phaser.Math.Linear(this.buddy.y, desiredY, smoothing);
  }

  private updateNearestStation(): void {
    let nearest: Station | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.stations.forEach((station) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, station.zone.x, station.zone.y);
      station.zone.setFillStyle(0x1a3352, distance < 110 ? 0.88 : 0.72);

      if (distance < nearestDistance) {
        nearest = station;
        nearestDistance = distance;
      }
    });

    this.nearestStation = nearestDistance < 110 ? nearest : null;

    if (!this.promptText) {
      return;
    }

    if (!this.nearestStation || this.panel?.visible) {
      this.promptText.setText("");
      return;
    }

    const station = this.nearestStation as Station;

    this.promptText.setText(
      this.touchEnabled
        ? `Tap ${station.label.text} or the station itself.`
        : `Press E near ${station.label.text} or click it.`,
    );
  }

  private openStation(id: StationId): void {
    if (!this.panel || !this.panelBody || !this.panelFooter || !this.panelAction) {
      return;
    }

    const title = this.panel.data?.get("title") as Phaser.GameObjects.Text | undefined;
    title?.setText(
      id === "mission"
        ? "Mission Terminal"
        : id === "loadout"
          ? "Loadout Console"
          : "Save Beacon",
    );

    this.panel.setVisible(true);

    if (id === "mission") {
      this.panelBody.setText([
        `${FIRST_MISSION.title} - ${FIRST_MISSION.location}`,
        "",
        `Commander: ${FIRST_MISSION.briefingSpeaker}`,
        "",
        ...FIRST_MISSION.briefing,
      ]);
      this.panelFooter.setText(`Objective: ${FIRST_MISSION.objective}`);
      this.panelAction.setLabel("Launch Mission");
      this.panelAction.setEnabled(true);
      this.panelAction.setOnClick(() => {
        gameSession.startMission(FIRST_MISSION.id);
        this.scene.start("mission", { missionId: FIRST_MISSION.id });
      });
      return;
    }

    if (id === "loadout") {
      this.panelBody.setText([
        `Weapon: ${gameSession.saveData.loadout.weapon}`,
        `Ability: ${gameSession.saveData.loadout.ability}`,
        `Support: ${gameSession.saveData.loadout.support}`,
        `Companion: ${gameSession.saveData.loadout.companion}`,
        "",
        "This console is data-driven on purpose so we can expand builds",
        "and companion kits without rewriting the hub flow later.",
      ]);
      this.panelFooter.setText("Current slice uses a ranged opener, pulse burst, dash, and arc-lance support shot.");
      this.panelAction.setLabel("Close");
      this.panelAction.setEnabled(true);
      this.panelAction.setOnClick(() => this.closePanel());
      return;
    }

    this.panelBody.setText([
      "Seal current command-deck progress to save memory.",
      "",
      "Mission saves stay disabled for now so the combat slice remains",
      "clean and predictable while we build the first real loop.",
    ]);
    this.panelFooter.setText("Saves include level, XP, credits, options, and unlocked progress.");
    this.panelAction.setLabel("Save Game");
    this.panelAction.setEnabled(true);
    this.panelAction.setOnClick(() => {
      const ok = gameSession.saveToDisk();
      this.statusText?.setText(ok ? "Save complete." : "Save failed.");
    });
  }

  private closePanel(): void {
    this.panel?.setVisible(false);
  }

  private presentPendingReward(): void {
    const reward = gameSession.consumePendingReward();
    if (!reward || !this.rewardText) {
      return;
    }

    this.rewardText.setText(`Mission reward received: +${reward.xp} XP, +${reward.credits} credits, ${reward.item}`);
    this.rewardText.setVisible(true);

    this.time.delayedCall(4600, () => {
      this.rewardText?.setVisible(false);
    });
  }

  private openPauseMenu(): void {
    if (this.scene.isPaused("pause")) {
      return;
    }

    this.scene.launch("pause", {
      returnSceneKey: "hub",
      allowSave: true,
    });
    this.scene.pause();
  }

  private anchorStick(x: number, y: number): void {
    if (!this.stickBase || !this.stickKnob) {
      return;
    }

    const anchorX = Phaser.Math.Clamp(x, 110, GAME_WIDTH * 0.42);
    const anchorY = Phaser.Math.Clamp(y, 380, 628);
    this.stickBase.setPosition(anchorX, anchorY).setFillStyle(0x173054, 0.52);
    this.stickKnob.setPosition(anchorX, anchorY);
  }

  private updateTouchVector(pointer: Phaser.Input.Pointer): void {
    if (!this.stickBase || !this.stickKnob) {
      return;
    }

    const dx = pointer.x - this.stickBase.x;
    const dy = pointer.y - this.stickBase.y;
    const vector = new Phaser.Math.Vector2(dx, dy);
    const distance = vector.length();

    if (distance > STICK_RADIUS) {
      vector.normalize().scale(STICK_RADIUS);
    }

    this.stickKnob.setPosition(this.stickBase.x + vector.x, this.stickBase.y + vector.y);

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

  private resetStick(): void {
    if (!this.stickBase || !this.stickKnob) {
      return;
    }

    this.stickBase.setPosition(150, 566).setFillStyle(0x173054, 0.36);
    this.stickKnob.setPosition(150, 566);
  }
}
