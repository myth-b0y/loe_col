import Phaser from "phaser";

import { FIRST_MISSION } from "../content/missions";
import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

type StationId = "mission" | "loadout" | "save";
type InteractionTargetKind = "station" | "airlock";

type Station = {
  id: StationId;
  zone: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hint: Phaser.GameObjects.Text;
  interactionRadius: number;
};

type InteractionTarget = {
  kind: InteractionTargetKind;
  x: number;
  y: number;
  buttonLabel: string;
  station?: Station;
};

const HUB_ROOM = new Phaser.Geom.Rectangle(68, 110, 1144, 520);
const HUB_SPEED = 250;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;

export class HubScene extends Phaser.Scene {
  private brightnessLayer?: BrightnessLayer;
  private player!: Phaser.GameObjects.Arc;
  private buddy!: Phaser.GameObjects.Arc;
  private buddyAnchor = new Phaser.Math.Vector2(676, 536);
  private buddyPulse = 0;
  private stations: Station[] = [];
  private nearestStation: Station | null = null;
  private panel?: Phaser.GameObjects.Container;
  private panelBody?: Phaser.GameObjects.Text;
  private panelFooter?: Phaser.GameObjects.Text;
  private panelAction?: MenuButton;
  private panelClose?: MenuButton;
  private promptText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private rewardText?: Phaser.GameObjects.Text;
  private missionText?: Phaser.GameObjects.Text;
  private airlockDoor?: Phaser.GameObjects.Rectangle;
  private airlockGlow?: Phaser.GameObjects.Rectangle;
  private airlockLabel?: Phaser.GameObjects.Text;
  private pauseButton?: MenuButton;
  private activateButton?: MenuButton;
  private interactionHintFrame?: Phaser.GameObjects.Rectangle;
  private interactionHintText?: Phaser.GameObjects.Text;
  private deploying = false;
  private touchCapable = false;
  private touchMode = false;
  private currentInteraction: InteractionTarget | null = null;
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
  private touchUiObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("hub");
  }

  create(): void {
    this.deploying = false;
    this.currentInteraction = null;
    this.touchCapable = this.sys.game.device.input.touch;
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    this.drawBackdrop();
    this.brightnessLayer = createBrightnessLayer(this);
    this.createActors();
    this.createStations();
    this.createHud();
    this.createTouchControls();
    this.syncInputMode();
    this.bindKeyboard();
    this.bindPointerInput();
    this.presentPendingReward();
    this.refreshMissionState();

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
    this.updateKeyboardVector();
    this.updateMovement(dt);
    this.updateBuddy(dt);
    this.updateNearestStation();
    this.updateInteractionTarget();
    this.updatePrompt();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x070d16).setDepth(-14);

    const stars = this.add.graphics().setDepth(-13);
    stars.fillStyle(0xc8ddff, 0.92);
    const starCount = gameSession.settings.graphics.quality === "Performance"
      ? 28
      : gameSession.settings.graphics.quality === "Balanced"
        ? 40
        : 54;
    for (let i = 0; i < starCount; i += 1) {
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
    this.add.rectangle(676, 536, 196, 120, 0x132a40, 0.88)
      .setStrokeStyle(2, 0x7aa9dd, 0.72)
      .setDepth(-6);
    this.add.text(676, 492, "Companion Bay", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(-5);
    this.add.text(676, 518, "Friendly crew zone", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#aecded",
    }).setOrigin(0.5).setDepth(-5);

    this.airlockGlow = this.add.rectangle(1120, HUB_ROOM.centerY, 84, 166, 0x4abfff, 0.1).setDepth(4);
    this.airlockDoor = this.add.rectangle(1120, HUB_ROOM.centerY, 60, 148, 0x173b5d, 0.92)
      .setStrokeStyle(3, 0x7ec4ff, 0.62)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    this.airlockDoor.on("pointerdown", () => this.tryActivateAirlock());
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

    this.buddy = this.add.circle(this.buddyAnchor.x, this.buddyAnchor.y, 12, 0xf0cd79).setDepth(7);
    this.buddy.setStrokeStyle(3, 0xffedb3, 1);
    this.add.text(this.buddyAnchor.x, this.buddyAnchor.y + 26, "Sera", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fff0bf",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(7);
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

    this.pauseButton = createMenuButton({
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
    this.pauseButton.container.setScrollFactor(0);

    this.interactionHintFrame = this.add.rectangle(0, 0, 48, 36, 0x102035, 0.95)
      .setStrokeStyle(2, 0x8ed2ff, 0.9)
      .setDepth(14)
      .setVisible(false);
    this.interactionHintText = this.add.text(0, 0, "E", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15).setVisible(false);

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

    this.panelClose = createMenuButton({
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
      this.panelClose.container,
      this.panelAction.container,
    ]).setDepth(20);

    this.panel.setVisible(false);
    this.panel.setDataEnabled();
    this.panel.data?.set("title", title);
  }

  private createTouchControls(): void {
    if (!this.touchCapable) {
      return;
    }

    this.stickBase = this.add.circle(150, 566, STICK_RADIUS, 0x173054, 0.36).setDepth(14);
    this.stickBase.setStrokeStyle(3, 0x72a8ff, 0.65);

    this.stickKnob = this.add.circle(150, 566, 34, 0xdde9ff, 0.72).setDepth(15);
    this.stickKnob.setStrokeStyle(2, 0xffffff, 0.9);

    const label = this.add.text(150, 470, "MOVE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fc6ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(15);

    this.activateButton = createMenuButton({
      scene: this,
      x: 1114,
      y: 566,
      width: 150,
      height: 68,
      label: "Activate",
      onClick: () => this.tryActivateCurrentTarget(),
      depth: 15,
      accentColor: 0x1f5a87,
    });
    this.activateButton.container.setScrollFactor(0);
    this.activateButton.container.setVisible(false);
    this.activateButton.setInputEnabled(false);

    this.touchUiObjects.push(this.stickBase, this.stickKnob, label, this.activateButton.container);
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

    keyboard.on("keydown-ESC", () => {
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
      this.openPauseMenu();
    });
    keyboard.on("keydown-E", () => {
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
      this.tryActivateCurrentTarget();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ESC");
      keyboard.removeAllListeners("keydown-E");
    });
  }

  private bindPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (!this.touchMode || !touchLike || !this.stickBase || this.panel?.visible) {
        return;
      }

      if (this.pointerOverTouchUi(pointer) || this.pointerOverInteractionArea(pointer)) {
        return;
      }

      this.movePointerId = pointer.id;
      this.anchorStick(pointer.x, pointer.y);
      this.updateTouchVector(pointer);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.touchMode || !this.isTouchPointer(pointer)) {
        return;
      }

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
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
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
    this.buddyPulse += dt;
    this.buddy.x = this.buddyAnchor.x + Math.sin(this.buddyPulse * 1.4) * 8;
    this.buddy.y = this.buddyAnchor.y + Math.cos(this.buddyPulse * 1.8) * 5;
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

    if (this.currentInteraction) {
      this.promptText.setText("");
      return;
    }

    if (this.isNearAirlock()) {
      this.promptText.setText(gameSession.acceptedMissionId
        ? "Move closer to the deploy door to activate it."
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
      this.panelClose?.setLabel("Close");
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
      this.panelClose?.setLabel("Close");
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
    this.panelClose?.setLabel("Close");
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
    if (!missionAccepted) {
      this.deploying = false;
    }
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

  private deployAcceptedMission(): void {
    if (!this.airlockDoor || this.deploying || !gameSession.acceptedMissionId) {
      return;
    }

    this.deploying = true;
    this.closePanel();
    this.statusText?.setText("Deploying through temporary airlock shortcut.");
    this.cameras.main.fadeOut(220, 8, 12, 18);
    this.time.delayedCall(220, () => {
      const missionId = gameSession.acceptedMissionId ?? FIRST_MISSION.id;
      gameSession.startMission(missionId);
      this.scene.start("mission", { missionId });
    });
  }

  private updateInteractionTarget(): void {
    const stationTarget = this.nearestStation
      ? {
          kind: "station" as const,
          x: this.nearestStation.zone.x,
          y: this.nearestStation.zone.getBounds().top - 26,
          buttonLabel: this.nearestStation.id === "mission"
            ? "Use"
            : this.nearestStation.id === "save"
              ? "Save"
              : "Open",
          station: this.nearestStation,
        }
      : null;

    const airlockTarget = this.canActivateAirlock()
      ? {
          kind: "airlock" as const,
          x: this.airlockDoor?.x ?? 0,
          y: (this.airlockDoor?.getBounds().top ?? 0) - 26,
          buttonLabel: "Deploy",
        }
      : null;

    if (stationTarget && airlockTarget) {
      const stationDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, stationTarget.x, stationTarget.y);
      const airlockDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, airlockTarget.x, airlockTarget.y);
      this.currentInteraction = stationDistance <= airlockDistance ? stationTarget : airlockTarget;
    } else {
      this.currentInteraction = stationTarget ?? airlockTarget;
    }

    this.updateInteractionVisuals();
  }

  private updateInteractionVisuals(): void {
    const showTouchActivate = this.touchMode && !this.panel?.visible && Boolean(this.currentInteraction);
    this.activateButton?.container.setVisible(showTouchActivate);
    this.activateButton?.setInputEnabled(showTouchActivate);
    if (showTouchActivate && this.currentInteraction) {
      this.activateButton?.setLabel(this.currentInteraction.buttonLabel);
    }

    const showDesktopHint = !this.touchMode && !this.panel?.visible && Boolean(this.currentInteraction);
    this.interactionHintFrame?.setVisible(showDesktopHint);
    this.interactionHintText?.setVisible(showDesktopHint);
    if (showDesktopHint && this.currentInteraction) {
      this.interactionHintFrame?.setPosition(this.currentInteraction.x, this.currentInteraction.y);
      this.interactionHintText?.setPosition(this.currentInteraction.x, this.currentInteraction.y);
    }
  }

  private tryActivateCurrentTarget(): void {
    if (!this.currentInteraction) {
      return;
    }

    if (this.currentInteraction.kind === "station" && this.currentInteraction.station) {
      this.openStation(this.currentInteraction.station.id);
      return;
    }

    this.tryActivateAirlock();
  }

  private tryActivateAirlock(): void {
    if (!this.canActivateAirlock()) {
      this.statusText?.setText(gameSession.acceptedMissionId
        ? "Move closer to the deploy door."
        : "Accept a mission before deploying.");
      return;
    }

    if (!this.panel || !this.panelBody || !this.panelFooter || !this.panelAction) {
      return;
    }

    const title = this.panel.data?.get("title") as Phaser.GameObjects.Text | undefined;
    title?.setText("Deploy Door");
    this.panel.setVisible(true);
    this.panelBody.setText([
      `Launch contract: ${FIRST_MISSION.title}`,
      "",
      `Location: ${FIRST_MISSION.location}`,
      "",
      "You are about to leave the command deck and begin the current mission slice.",
    ]);
    this.panelFooter.setText("Start mission now? Choose Start Mission to deploy, or Decline to stay on the ship.");
    this.panelClose?.setLabel("Decline");
    this.panelAction.setLabel("Start Mission");
    this.panelAction.setEnabled(true);
    this.panelAction.setOnClick(() => this.deployAcceptedMission());
  }

  private canActivateAirlock(): boolean {
    return Boolean(
      this.airlockDoor
      && gameSession.acceptedMissionId
      && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.airlockDoor.x, this.airlockDoor.y) < 108,
    );
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

    const anchorX = Phaser.Math.Clamp(x, 86, GAME_WIDTH - 86);
    const anchorY = Phaser.Math.Clamp(y, 104, GAME_HEIGHT - 88);
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

    const rawStrength = Phaser.Math.Clamp(
      (Math.min(distance, STICK_RADIUS) - STICK_DEADZONE) / (STICK_RADIUS - STICK_DEADZONE),
      0,
      1,
    );
    const sensitivityCurve = 100 / gameSession.settings.controls.touchSensitivity;
    const strength = Math.pow(rawStrength, sensitivityCurve);
    this.moveVector.set(vector.x, vector.y).normalize().scale(strength);
  }

  private resetStick(): void {
    if (!this.stickBase || !this.stickKnob) {
      return;
    }

    this.stickBase.setPosition(150, 566).setFillStyle(0x173054, 0.36);
    this.stickKnob.setPosition(150, 566);
  }

  private syncInputMode(): void {
    this.touchMode = gameSession.shouldUseTouchUi(this.touchCapable);
    this.touchUiObjects.forEach((object) => {
      (object as Phaser.GameObjects.GameObject & { setVisible: (value: boolean) => Phaser.GameObjects.GameObject }).setVisible(this.touchMode);
    });
    this.updateInteractionVisuals();

    if (!this.touchMode) {
      this.movePointerId = null;
      this.moveVector.set(0, 0);
      this.resetStick();
    }
  }

  private pointerOverTouchUi(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(
      this.pauseButton?.container.getBounds().contains(pointer.x, pointer.y)
      || (this.activateButton?.container.visible && this.activateButton.container.getBounds().contains(pointer.x, pointer.y)),
    );
  }

  private pointerOverInteractionArea(pointer: Phaser.Input.Pointer): boolean {
    return Boolean(
      this.stations.some((station) => station.zone.getBounds().contains(pointer.x, pointer.y))
      || this.airlockDoor?.getBounds().contains(pointer.x, pointer.y),
    );
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
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
      },
      buddy: {
        x: Math.round(this.buddy.x),
        y: Math.round(this.buddy.y),
      },
      nearestStation: this.nearestStation?.id ?? null,
      currentInteraction: this.currentInteraction?.kind ?? null,
      acceptedMissionId: gameSession.acceptedMissionId,
      activeSlot: gameSession.getActiveSlotIndex(),
      prompt: this.promptText?.text ?? "",
    };
  }
}
