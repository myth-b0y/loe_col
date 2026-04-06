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
  hint: Phaser.GameObjects.Text;
  interactionRadius: number;
};

const HUB_ROOM = new Phaser.Geom.Rectangle(68, 110, 1144, 520);
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
  private missionText?: Phaser.GameObjects.Text;
  private airlockDoor?: Phaser.GameObjects.Rectangle;
  private airlockGlow?: Phaser.GameObjects.Rectangle;
  private airlockLabel?: Phaser.GameObjects.Text;
  private deploying = false;
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
    this.refreshMissionState();

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
    this.updatePrompt();
    this.handleAirlockDeploy();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x070d16).setDepth(-14);

    const stars = this.add.graphics().setDepth(-13);
    stars.fillStyle(0xc8ddff, 0.92);
    for (let i = 0; i < 60; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(14, 1266),
        Phaser.Math.Between(14, 706),
        Phaser.Math.FloatBetween(1, 2.2),
      );
    }

    this.add.rectangle(640, 64, 1144, 60, 0x10192a, 0.96)
      .setStrokeStyle(2, 0x4a6f9b, 0.82);

    this.add.rectangle(HUB_ROOM.centerX, HUB_ROOM.centerY, HUB_ROOM.width, HUB_ROOM.height, 0x111e31, 0.98)
      .setStrokeStyle(4, 0x6f9fd7, 0.82)
      .setDepth(-8);

    this.add.rectangle(HUB_ROOM.centerX, 202, HUB_ROOM.width - 80, 10, 0x1f3552, 0.82).setDepth(-7);
    this.add.rectangle(HUB_ROOM.centerX, 362, HUB_ROOM.width - 120, 6, 0x223a58, 0.74).setDepth(-7);
    this.add.rectangle(HUB_ROOM.centerX, 520, HUB_ROOM.width - 80, 10, 0x1f3552, 0.82).setDepth(-7);

    this.add.rectangle(186, 368, 84, HUB_ROOM.height - 78, 0x0a1523, 0.95).setDepth(-7);
    this.add.rectangle(1094, 368, 130, HUB_ROOM.height - 78, 0x0a1523, 0.95).setDepth(-7);

    this.airlockGlow = this.add.rectangle(1120, HUB_ROOM.centerY, 84, 166, 0x4abfff, 0.1).setDepth(4);
    this.airlockDoor = this.add.rectangle(1120, HUB_ROOM.centerY, 60, 148, 0x173b5d, 0.92)
      .setStrokeStyle(3, 0x7ec4ff, 0.62)
      .setDepth(5);
    this.airlockLabel = this.add.text(1070, 192, "Deploy Door", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#c8ddff",
      fontStyle: "bold",
    }).setDepth(6);

    this.add.text(108, 46, "Lumen Carrier - Command Deck", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f5fbff",
      fontStyle: "bold",
    });
  }

  private createActors(): void {
    this.player = this.add.circle(186, HUB_ROOM.centerY, 20, 0xf2f7ff).setDepth(8);
    this.player.setStrokeStyle(4, 0x7caeff, 1);

    this.buddy = this.add.circle(this.player.x - 42, this.player.y + 44, 12, 0xf0cd79).setDepth(7);
    this.buddy.setStrokeStyle(3, 0xffedb3, 1);
  }

  private createStations(): void {
    this.stations = [
      this.createStation("mission", 348, 250, 190, 126, "Mission Terminal", "Accept contracts"),
      this.createStation("loadout", 642, 450, 220, 126, "Loadout Console", "Review current kit"),
      this.createStation("save", 920, 250, 190, 126, "Save Beacon", "Write active slot"),
    ];
  }

  private createStation(
    id: StationId,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    hintText: string,
  ): Station {
    const accent = id === "mission" ? 0x59c9ff : id === "loadout" ? 0xffd36d : 0x8cffaf;
    const zone = this.add.rectangle(x, y, width, height, 0x17314f, 0.84)
      .setStrokeStyle(3, accent, 0.72)
      .setDepth(5)
      .setInteractive();

    const title = this.add.text(x, y - 14, label, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#f3f8ff",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5).setDepth(6);

    const hint = this.add.text(x, y + 24, hintText, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#bed4f1",
      align: "center",
    }).setOrigin(0.5).setDepth(6);

    this.add.circle(x, y - 42, 16, accent, 0.68).setDepth(6);

    const station: Station = {
      id,
      zone,
      label: title,
      hint,
      interactionRadius: 112,
    };

    zone.on("pointerdown", () => this.tryInteractStation(station));
    return station;
  }

  private createHud(): void {
    this.add.text(820, 46, `Lv ${gameSession.saveData.profile.level}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.add.text(900, 46, `${gameSession.saveData.profile.credits} credits`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.add.text(1038, 46, `Slot ${gameSession.getActiveSlotIndex() + 1}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    });

    this.missionText = this.add.text(640, 92, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    }).setOrigin(0.5);

    this.statusText = this.add.text(640, 120, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#cfe0f7",
    }).setOrigin(0.5);

    this.rewardText = this.add.text(640, 150, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d8edff",
      backgroundColor: "#14314dcc",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setVisible(false);

    this.promptText = this.add.text(640, 664, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e8f1ff",
    }).setOrigin(0.5);

    createMenuButton({
      scene: this,
      x: 1130,
      y: 54,
      width: 114,
      height: 40,
      label: "Pause",
      onClick: () => this.openPauseMenu(),
      depth: 12,
      accentColor: 0x233956,
    });

    this.createPanel();
  }

  private createPanel(): void {
    const background = this.add.rectangle(900, 426, 520, 346, 0x08111c, 0.98)
      .setStrokeStyle(3, 0x79abed, 0.85)
      .setDepth(20);

    const title = this.add.text(672, 282, "", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(21);

    this.panelBody = this.add.text(672, 330, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e8ff",
      lineSpacing: 8,
      wordWrap: { width: 430 },
    }).setDepth(21);

    this.panelFooter = this.add.text(672, 534, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#9fc6ff",
      wordWrap: { width: 430 },
    }).setDepth(21);

    const close = createMenuButton({
      scene: this,
      x: 1102,
      y: 286,
      width: 92,
      height: 38,
      label: "Close",
      onClick: () => this.closePanel(),
      depth: 21,
      accentColor: 0x253a56,
    });

    this.panelAction = createMenuButton({
      scene: this,
      x: 900,
      y: 570,
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

      if (pointer.x > GAME_WIDTH * 0.45) {
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
      const closeEnough = distance <= station.interactionRadius;
      station.zone.setFillStyle(closeEnough ? 0x21486f : 0x17314f, closeEnough ? 0.96 : 0.84);
      station.hint.setColor(closeEnough ? "#f5fbff" : "#bed4f1");

      if (distance < nearestDistance) {
        nearest = station;
        nearestDistance = distance;
      }
    });

    const resolvedNearest = nearest as Station | null;
    if (resolvedNearest === null) {
      this.nearestStation = null;
      return;
    }

    this.nearestStation = nearestDistance <= resolvedNearest.interactionRadius ? resolvedNearest : null;
  }

  private updatePrompt(): void {
    if (!this.promptText) {
      return;
    }

    if (this.panel?.visible) {
      this.promptText.setText("");
      return;
    }

    if (this.nearestStation) {
      this.promptText.setText(this.touchEnabled
        ? `Tap ${this.nearestStation.label.text} while standing nearby.`
        : `Press E near ${this.nearestStation.label.text}.`);
      return;
    }

    if (this.isNearAirlock()) {
      this.promptText.setText(gameSession.acceptedMissionId
        ? "Walk into the deploy door to enter the mission zone."
        : "Accept a mission at the terminal before deploying.");
      return;
    }

    this.promptText.setText("");
  }

  private tryInteractStation(station: Station): void {
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, station.zone.x, station.zone.y);
    if (distance > station.interactionRadius) {
      this.statusText?.setText("Move closer before using that console.");
      return;
    }

    this.openStation(station.id);
  }

  private openStation(id: StationId): void {
    if (!this.panel || !this.panelBody || !this.panelFooter || !this.panelAction) {
      return;
    }

    const title = this.panel.data?.get("title") as Phaser.GameObjects.Text | undefined;
    this.panel.setVisible(true);

    if (id === "mission") {
      title?.setText("Mission Terminal");
      this.panelBody.setText([
        `${FIRST_MISSION.title} - ${FIRST_MISSION.location}`,
        "",
        `Commander: ${FIRST_MISSION.briefingSpeaker}`,
        "",
        ...FIRST_MISSION.briefing,
      ]);
      this.panelFooter.setText("Mission terminal accepts the contract. The deploy door is the temporary stand-in for future space travel.");
      this.panelAction.setLabel(gameSession.acceptedMissionId === FIRST_MISSION.id ? "Mission Accepted" : "Accept Mission");
      this.panelAction.setEnabled(gameSession.acceptedMissionId !== FIRST_MISSION.id);
      this.panelAction.setOnClick(() => {
        gameSession.acceptMission(FIRST_MISSION.id);
        this.statusText?.setText("Waypoint accepted. Deploy door unlocked.");
        this.refreshMissionState();
        this.closePanel();
      });
      return;
    }

    if (id === "loadout") {
      title?.setText("Loadout Console");
      this.panelBody.setText([
        `Weapon: ${gameSession.saveData.loadout.weapon}`,
        `Ability: ${gameSession.saveData.loadout.ability}`,
        `Support: ${gameSession.saveData.loadout.support}`,
        `Companion: ${gameSession.saveData.loadout.companion}`,
        "",
        "This console stays data-driven so adding new weapons, builds, and companions later will not break the hub flow.",
      ]);
      this.panelFooter.setText("Current prototype kit: basic fire, Pulse, Arc Lance, Dash, and one ranged support companion.");
      this.panelAction.setLabel("Close");
      this.panelAction.setEnabled(true);
      this.panelAction.setOnClick(() => this.closePanel());
      return;
    }

    title?.setText("Save Beacon");
    this.panelBody.setText([
      `Active slot: Slot ${gameSession.getActiveSlotIndex() + 1}`,
      "",
      "Save the current command-deck state, progression, loadout, and options.",
      "",
      "Mission saves remain disabled for now to keep the combat slice predictable while we build the foundation.",
    ]);
    this.panelFooter.setText("Use the main menu or pause menu load screen to choose which file to continue.");
    this.panelAction.setLabel("Save Game");
    this.panelAction.setEnabled(true);
    this.panelAction.setOnClick(() => {
      const ok = gameSession.saveToDisk();
      this.statusText?.setText(ok ? `Saved to Slot ${gameSession.getActiveSlotIndex() + 1}.` : "Save failed.");
      this.refreshMissionState();
    });
  }

  private closePanel(): void {
    this.panel?.setVisible(false);
  }

  private refreshMissionState(): void {
    const missionAccepted = gameSession.acceptedMissionId === FIRST_MISSION.id;
    this.missionText?.setText(missionAccepted
      ? `Accepted contract: ${FIRST_MISSION.title} | Deploy door primed`
      : "No contract accepted. Use the mission terminal to set a waypoint.");

    this.airlockDoor?.setFillStyle(missionAccepted ? 0x1d5c8d : 0x173b5d, missionAccepted ? 0.98 : 0.82);
    this.airlockDoor?.setStrokeStyle(3, missionAccepted ? 0x8be4ff : 0x7ec4ff, missionAccepted ? 0.96 : 0.62);
    this.airlockGlow?.setFillStyle(0x4abfff, missionAccepted ? 0.28 : 0.08);
    this.airlockLabel?.setColor(missionAccepted ? "#f4fbff" : "#c8ddff");
  }

  private presentPendingReward(): void {
    const reward = gameSession.consumePendingReward();
    if (!reward || !this.rewardText) {
      return;
    }

    this.rewardText.setText(`Mission reward: +${reward.xp} XP, +${reward.credits} credits, ${reward.item}`);
    this.rewardText.setVisible(true);

    this.time.delayedCall(5200, () => {
      this.rewardText?.setVisible(false);
    });
  }

  private handleAirlockDeploy(): void {
    if (!gameSession.acceptedMissionId || this.panel?.visible || !this.airlockDoor || this.deploying) {
      return;
    }

    const bounds = this.airlockDoor.getBounds();
    if (!bounds.contains(this.player.x, this.player.y)) {
      return;
    }

    this.deploying = true;
    this.statusText?.setText("Deploying through temporary airlock shortcut.");
    this.cameras.main.fadeOut(220, 8, 12, 18);
    this.time.delayedCall(220, () => {
      const missionId = gameSession.acceptedMissionId ?? FIRST_MISSION.id;
      gameSession.startMission(missionId);
      this.scene.start("mission", { missionId });
    });
  }

  private isNearAirlock(): boolean {
    if (!this.airlockDoor) {
      return false;
    }

    return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.airlockDoor.x, this.airlockDoor.y) < 108;
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
