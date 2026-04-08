import Phaser from "phaser";

import {
  FORMATION_SLOTS,
  STORY_COMPANIONS,
  canCompanionOccupySlot,
  getCompanionDefinition,
  getCompanionRoleDisplay,
  getFormationSlot,
  type CompanionDefinition,
  type CompanionId,
  type FormationSlotDefinition,
  type FormationSlotId,
} from "../content/companions";
import { getMissionContract } from "../content/missions";
import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { InventoryOverlay } from "../ui/InventoryOverlay";
import { LogbookOverlay } from "../ui/LogbookOverlay";
import { MissionBoardOverlay } from "../ui/MissionBoardOverlay";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

type StationId = "cockpit" | "mission" | "loadout";
type InteractionTargetKind = "station" | "airlock";

type Station = {
  id: StationId;
  shadow: Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Ellipse;
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

type HubCompanionActor = {
  id: string;
  name: string;
  roleLabel: string;
  primaryGear: string;
  supportGear: string;
  anchor: Phaser.Math.Vector2;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Arc;
  shieldPlate?: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  pulseOffset: number;
};

type DeployRosterCard = {
  companionId: CompanionId;
  companion: CompanionDefinition;
  baseY: number;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  beam: Phaser.GameObjects.Graphics;
  beamCore: Phaser.GameObjects.Graphics;
  portraitGlow: Phaser.GameObjects.Arc;
  portraitHead: Phaser.GameObjects.Arc;
  portraitBody: Phaser.GameObjects.Rectangle;
  pedestal: Phaser.GameObjects.Ellipse;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  slotText: Phaser.GameObjects.Text;
  infoButton: Phaser.GameObjects.Rectangle;
  infoLabel: Phaser.GameObjects.Text;
};

type FormationSlotUi = {
  slot: FormationSlotDefinition;
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  occupantText: Phaser.GameObjects.Text;
};

const HUB_ROOM = new Phaser.Geom.Rectangle(68, 110, 1144, 520);
const HUB_SPEED = 250;
const STICK_RADIUS = 72;
const STICK_DEADZONE = 18;

function getShortFormationLabel(slotId: FormationSlotId | null): string {
  switch (slotId) {
    case "front-left":
      return "Front L";
    case "front-right":
      return "Front R";
    case "back-left":
      return "Back L";
    case "back-right":
      return "Back R";
    case "left":
      return "Left";
    case "right":
      return "Right";
    default:
      return "Unassigned";
  }
}

function getBoardFormationLabel(slotId: FormationSlotId): string {
  switch (slotId) {
    case "front-left":
      return "FL";
    case "front-right":
      return "FR";
    case "back-left":
      return "BL";
    case "back-right":
      return "BR";
    case "left":
      return "L";
    case "right":
      return "R";
    default:
      return slotId;
  }
}

export class HubScene extends Phaser.Scene {
  private brightnessLayer?: BrightnessLayer;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private player!: Phaser.GameObjects.Arc;
  private crew: HubCompanionActor[] = [];
  private buddyPulse = 0;
  private stations: Station[] = [];
  private nearestStation: Station | null = null;
  private panel?: Phaser.GameObjects.Container;
  private panelBody?: Phaser.GameObjects.Text;
  private panelFooter?: Phaser.GameObjects.Text;
  private panelAction?: MenuButton;
  private panelClose?: MenuButton;
  private missionBoardOverlay?: MissionBoardOverlay;
  private logbookOverlay?: LogbookOverlay;
  private inventoryOverlay?: InventoryOverlay;
  private deployOverlay?: Phaser.GameObjects.Container;
  private deploySubtitle?: Phaser.GameObjects.Text;
  private deployStatusText?: Phaser.GameObjects.Text;
  private deployMissionText?: Phaser.GameObjects.Text;
  private deployLaunchButton?: MenuButton;
  private deployCloseButton?: MenuButton;
  private deployClearButton?: MenuButton;
  private deployInfoDismissLayer?: Phaser.GameObjects.Rectangle;
  private deployInfoPanel?: Phaser.GameObjects.Container;
  private deployInfoTitle?: Phaser.GameObjects.Text;
  private deployInfoBody?: Phaser.GameObjects.Text;
  private deployRosterCards: DeployRosterCard[] = [];
  private deploySlotUis: FormationSlotUi[] = [];
  private selectedDeployCompanionId: CompanionId | null = null;
  private hoveredDeployCompanionId: CompanionId | null = null;
  private deployInfoCompanionId: CompanionId | null = null;
  private promptText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private rewardText?: Phaser.GameObjects.Text;
  private missionText?: Phaser.GameObjects.Text;
  private airlockDoor?: Phaser.GameObjects.Rectangle;
  private airlockGlow?: Phaser.GameObjects.Rectangle;
  private airlockLabel?: Phaser.GameObjects.Text;
  private logbookButton?: MenuButton;
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
    logbook: Phaser.Input.Keyboard.Key;
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
    this.createDeployOverlay();
    this.createCommandOverlays();
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
    this.updateCrew(dt);
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

    this.add.rectangle(HUB_ROOM.centerX, 214, HUB_ROOM.width - 110, 12, 0x1f3552, 0.82).setDepth(-7);
    this.add.rectangle(HUB_ROOM.centerX, 360, HUB_ROOM.width - 150, 6, 0x223a58, 0.74).setDepth(-7);
    this.add.rectangle(HUB_ROOM.centerX, 520, HUB_ROOM.width - 110, 12, 0x1f3552, 0.82).setDepth(-7);

    this.add.rectangle(182, 368, 94, HUB_ROOM.height - 78, 0x0a1523, 0.95).setDepth(-7);
    this.add.rectangle(1098, 368, 134, HUB_ROOM.height - 78, 0x0a1523, 0.95).setDepth(-7);
    this.add.rectangle(186, 360, 68, 176, 0x123354, 0.94)
      .setStrokeStyle(3, 0x7ebaff, 0.82)
      .setDepth(-5);

    this.add.rectangle(708, 546, 532, 136, 0x132a40, 0.88)
      .setStrokeStyle(2, 0x7aa9dd, 0.72)
      .setDepth(-6);
    this.add.text(708, 484, "Crew Quarters", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(-5);
    this.add.text(708, 506, "Roster on deck and ready for formation assignment", {
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
    this.playerShadow = this.add.ellipse(304, HUB_ROOM.centerY + 14, 38, 16, 0x000000, 0.28).setDepth(6);
    this.player = this.add.circle(304, HUB_ROOM.centerY, 20, 0xf2f7ff).setDepth(8);
    this.player.setStrokeStyle(4, 0x7caeff, 1);

    this.crew = STORY_COMPANIONS.map((companion, index) => {
      const anchor = new Phaser.Math.Vector2(companion.hubPosition.x, companion.hubPosition.y);
      const shadow = this.add.ellipse(anchor.x, anchor.y + companion.radius * 0.72, companion.radius * 1.9, companion.radius * 0.9, 0x000000, 0.24)
        .setDepth(6);
      const sprite = this.add.circle(anchor.x, anchor.y, companion.radius, companion.coreColor).setDepth(7);
      sprite.setStrokeStyle(3, companion.trimColor, 1);

      const shieldPlate = companion.attackStyle === "shield"
        ? this.add.rectangle(anchor.x + companion.radius + 8, anchor.y, 10, 28, 0x335e48, 0.96)
          .setStrokeStyle(3, companion.trimColor, 0.95)
          .setDepth(8)
        : undefined;

      const label = this.add.text(anchor.x, anchor.y + 26, `${companion.name}\n${getCompanionRoleDisplay(companion)}`, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#e8f3ff",
        fontStyle: "bold",
        align: "center",
      }).setOrigin(0.5).setDepth(7);

      return {
        id: companion.id,
        name: companion.name,
        roleLabel: getCompanionRoleDisplay(companion),
        primaryGear: companion.primaryGear,
        supportGear: companion.supportGear,
        anchor,
        shadow,
        sprite,
        shieldPlate,
        label,
        pulseOffset: index * 0.9,
      };
    });
  }

  private createStations(): void {
    this.stations = [
      this.createStation("cockpit", 188, 360, 86, 176, "Cockpit", "Future space bridge"),
      this.createStation("mission", 482, 252, 230, 120, "Mission Terminal", "Queue contracts"),
      this.createStation("loadout", 798, 252, 230, 120, "Loadout Bench", "Gear + crafting"),
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
    const accent = id === "mission"
      ? 0x59c9ff
      : id === "loadout"
        ? 0xffd36d
        : 0x8dc8ff;
    const glow = this.add.ellipse(x, y + height * 0.1, width * 0.92, height * 0.5, accent, 0.08).setDepth(4);
    const shadow = this.add.ellipse(x, y + height * 0.34, width * 0.9, 18, 0x000000, 0.24).setDepth(4);
    const zone = this.add.rectangle(x, y, width, height, 0x17314f, 0.84)
      .setStrokeStyle(3, accent, 0.72)
      .setDepth(5)
      .setInteractive();

    const title = this.add.text(x, y - 14, label, {
      fontFamily: "Arial",
      fontSize: id === "cockpit" ? "20px" : "22px",
      color: "#f3f8ff",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5).setDepth(6);

    const hint = this.add.text(x, y + 24, hintText, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#bed4f1",
      align: "center",
      wordWrap: { width: width - 24 },
    }).setOrigin(0.5).setDepth(6);

    const station: Station = {
      id,
      shadow,
      glow,
      zone,
      label: title,
      hint,
      interactionRadius: 112,
    };

    zone.on("pointerdown", () => this.tryInteractStation(station));
    return station;
  }

  private createHud(): void {
    this.add.text(702, 46, `Lv ${gameSession.saveData.profile.level}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.add.text(770, 46, `${gameSession.saveData.profile.credits} credits`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e7f1ff",
    });

    this.add.text(896, 46, `Slot ${gameSession.getActiveSlotIndex() + 1}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    });

    this.missionText = this.add.text(638, 84, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#9fc6ff",
      wordWrap: { width: 940 },
      align: "center",
    }).setOrigin(0.5);

    this.statusText = this.add.text(638, 122, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#cfe0f7",
      wordWrap: { width: 980 },
      align: "center",
    }).setOrigin(0.5);

    this.rewardText = this.add.text(638, 144, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d8edff",
      backgroundColor: "#14314dcc",
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setVisible(false);

    this.promptText = this.add.text(640, 664, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e8f1ff",
    }).setOrigin(0.5);

    this.logbookButton = createMenuButton({
      scene: this,
      x: 1008,
      y: 54,
      width: 128,
      height: 40,
      label: "Data Pad",
      onClick: () => this.toggleLogbookOverlay(),
      depth: 12,
      accentColor: 0x2b4462,
    });
    this.logbookButton.container.setScrollFactor(0);

    this.pauseButton = createMenuButton({
      scene: this,
      x: 1136,
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

  private createCommandOverlays(): void {
    this.missionBoardOverlay = new MissionBoardOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
    });

    this.logbookOverlay = new LogbookOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
    });

    this.inventoryOverlay = new InventoryOverlay({
      scene: this,
      onClose: () => this.handleCommandOverlayClosed(),
    });
  }

  private createDeployOverlay(): void {
    const backdrop = this.add.rectangle(640, 360, 1280, 720, 0x01040b, 0.94)
      .setDepth(40)
      .setVisible(false)
      .setInteractive();
    backdrop.on("pointerdown", () => {
      if (this.deployInfoCompanionId) {
        this.hideDeployInfo();
        return;
      }

      this.closeDeployOverlay();
    });

    const shadow = this.add.rectangle(640, 360, 1144, 638, 0x000000, 0.36)
      .setDepth(41);
    const panel = this.add.rectangle(640, 360, 1124, 618, 0x040913, 1)
      .setDepth(41)
      .setStrokeStyle(3, 0x6f9fd7, 0.84);
    const panelInset = this.add.rectangle(640, 360, 1086, 580, 0x08111b, 0.985)
      .setDepth(41)
      .setStrokeStyle(1, 0x223852, 0.72);
    const headerBand = this.add.rectangle(640, 126, 1026, 106, 0x0b1624, 0.98)
      .setDepth(41)
      .setStrokeStyle(2, 0x294665, 0.78);
    const rosterBand = this.add.rectangle(640, 298, 1026, 252, 0x09111a, 0.985)
      .setDepth(41)
      .setStrokeStyle(2, 0x223852, 0.78);
    const footerBand = this.add.rectangle(640, 618, 1026, 66, 0x08111a, 0.98)
      .setDepth(41)
      .setStrokeStyle(1, 0x223852, 0.74);
    const title = this.add.text(146, 86, "Deployment Prep", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(42);
    this.deploySubtitle = this.add.text(146, 124, "Pick up to 3 companions, then lock in where they stand around you before launch.", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#bdd4f3",
      wordWrap: { width: 620 },
    }).setDepth(42);
    this.deployMissionText = this.add.text(146, 164, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#8fc9ff",
    }).setDepth(42);
    const rosterCount = STORY_COMPANIONS.length;
    const rosterGap = rosterCount >= 6 ? 12 : rosterCount >= 4 ? 18 : 28;
    const rosterWidth = 900;
    const cardWidth = Phaser.Math.Clamp(
      Math.floor((rosterWidth - rosterGap * Math.max(0, rosterCount - 1)) / Math.max(1, rosterCount)),
      126,
      188,
    );
    const cardHeight = 210;
    const rowWidth = cardWidth * rosterCount + rosterGap * Math.max(0, rosterCount - 1);
    const rowStartX = 640 - rowWidth / 2 + cardWidth / 2;
    const rowY = 294;

    const rosterCards = STORY_COMPANIONS.map((companion, index) => {
      const x = rowStartX + index * (cardWidth + rosterGap);
      const frame = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x0a1320, 0.9)
        .setDepth(42)
        .setStrokeStyle(2, companion.trimColor, 0.4)
        .setInteractive({ useHandCursor: true });

      const beam = this.add.graphics({ x: 0, y: -8 }).setDepth(42);
      beam.fillStyle(companion.coreColor, 1);
      beam.fillPoints([
        new Phaser.Geom.Point(-18, -94),
        new Phaser.Geom.Point(18, -94),
        new Phaser.Geom.Point(62, 42),
        new Phaser.Geom.Point(-62, 42),
      ], true);
      beam.setAlpha(0.12);

      const beamCore = this.add.graphics({ x: 0, y: -6 }).setDepth(42);
      beamCore.fillStyle(companion.trimColor, 1);
      beamCore.fillPoints([
        new Phaser.Geom.Point(-10, -96),
        new Phaser.Geom.Point(10, -96),
        new Phaser.Geom.Point(30, 38),
        new Phaser.Geom.Point(-30, 38),
      ], true);
      beamCore.setAlpha(0.16);

      const portraitGlow = this.add.circle(0, -10, 52, companion.coreColor, 0.12).setDepth(43);
      portraitGlow.setStrokeStyle(2, companion.trimColor, 0.18);

      const portraitBody = this.add.rectangle(0, 8, Math.min(58, Math.floor(cardWidth * 0.42)), 82, companion.coreColor, 0.8)
        .setDepth(44);
      portraitBody.setStrokeStyle(3, companion.trimColor, 0.92);

      const portraitHead = this.add.circle(0, -56, 18, companion.trimColor, 0.98).setDepth(45);
      portraitHead.setStrokeStyle(3, companion.coreColor, 0.9);

      const pedestal = this.add.ellipse(0, 42, 106, 22, companion.coreColor, 0.12).setDepth(43);
      pedestal.setStrokeStyle(2, companion.trimColor, 0.26);

      const titleText = this.add.text(0, 70, companion.name, {
        fontFamily: "Arial",
        fontSize: cardWidth < 150 ? "16px" : "18px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(45);
      const detail = this.add.text(0, 92, getCompanionRoleDisplay(companion), {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#cfe0f7",
        align: "center",
        wordWrap: { width: cardWidth - 18 },
      }).setOrigin(0.5, 0).setDepth(45);
      const slotText = this.add.text(0, 116, "Unassigned", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#8ea5bf",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: cardWidth - 18 },
      }).setOrigin(0.5, 0).setDepth(45);
      const infoButton = this.add.rectangle(cardWidth / 2 - 16, -cardHeight / 2 + 18, 24, 24, 0x102133, 0.96)
        .setStrokeStyle(2, companion.trimColor, 0.5)
        .setDepth(45)
        .setInteractive({ useHandCursor: true });
      const infoLabel = this.add.text(infoButton.x, infoButton.y - 1, "I", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(46);

      infoButton.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.toggleDeployInfo(companion.id);
      });
      infoButton.on("pointerover", () => {
        infoButton.setFillStyle(0x183049, 0.98);
        infoButton.setStrokeStyle(2, companion.trimColor, 0.8);
      });
      infoButton.on("pointerout", () => {
        const active = this.deployInfoCompanionId === companion.id;
        infoButton.setFillStyle(active ? 0x183049 : 0x102133, 0.96);
        infoButton.setStrokeStyle(2, companion.trimColor, active ? 0.88 : 0.5);
      });

      frame.on("pointerdown", () => this.handleDeployRosterSelect(companion.id));
      frame.on("pointerover", () => {
        this.hoveredDeployCompanionId = companion.id;
        this.refreshDeployOverlay();
      });
      frame.on("pointerout", () => {
        if (this.hoveredDeployCompanionId === companion.id) {
          this.hoveredDeployCompanionId = null;
          this.refreshDeployOverlay();
        }
      });

      const container = this.add.container(x, rowY, [
        frame,
        beam,
        beamCore,
        pedestal,
        portraitGlow,
        portraitBody,
        portraitHead,
        titleText,
        detail,
        slotText,
        infoButton,
        infoLabel,
      ]).setDepth(42);

      return {
        companionId: companion.id,
        companion,
        baseY: rowY,
        container,
        frame,
        beam,
        beamCore,
        portraitGlow,
        portraitHead,
        portraitBody,
        pedestal,
        title: titleText,
        detail,
        slotText,
        infoButton,
        infoLabel,
      };
    });

    const formationFrame = this.add.rectangle(640, 532, 580, 138, 0x0b1522, 0.98)
      .setDepth(41)
      .setStrokeStyle(2, 0x294665, 0.78);
    const formationTitle = this.add.text(640, 448, "Formation Layout", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(42);
    const formationHint = this.add.text(640, 470, "Tanks forward, healers back, DPS anywhere.", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#8ea5bf",
    }).setOrigin(0.5).setDepth(42);

    const centerX = 640;
    const centerY = 544;
    const playerRing = this.add.circle(centerX, centerY, 34, 0xf2f7ff, 0.02).setDepth(42);
    playerRing.setStrokeStyle(2, 0x547eaf, 0.42);
    const playerCore = this.add.circle(centerX, centerY, 17, 0xf2f7ff, 1).setDepth(43);
    playerCore.setStrokeStyle(4, 0x7caeff, 1);
    const playerLabel = this.add.text(centerX, centerY + 28, "Player", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(43);

    const formationScaleX = 0.48;
    const formationScaleY = 0.42;
    const slotUis = FORMATION_SLOTS.map((slot) => {
      const slotX = centerX + slot.boardX * formationScaleX;
      const slotY = centerY + slot.boardY * formationScaleY + 6;
      const circle = this.add.circle(slotX, slotY, 21, 0x122338, 0.98)
        .setStrokeStyle(2, 0x5d86b9, 0.72)
        .setDepth(42)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(circle.x, circle.y - 25, getBoardFormationLabel(slot.id), {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#9bb6d3",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(43);
      const occupantText = this.add.text(circle.x, circle.y + 23, "Empty", {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#7f92a9",
      }).setOrigin(0.5).setDepth(43);
      circle.on("pointerdown", () => this.handleDeploySlotClick(slot.id));
      return { slot, circle, label, occupantText };
    });

    this.deployStatusText = this.add.text(146, 596, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d8edff",
      wordWrap: { width: 470 },
    }).setDepth(42);

    this.deployInfoDismissLayer = this.add.rectangle(640, 360, 1086, 580, 0x01040b, 0.001)
      .setDepth(44)
      .setVisible(false)
      .setInteractive();
    this.deployInfoDismissLayer.on("pointerdown", () => this.hideDeployInfo());

    const infoPanelFrame = this.add.rectangle(894, 396, 356, 286, 0x07111b, 0.985)
      .setDepth(45)
      .setStrokeStyle(2, 0x78a8df, 0.82);
    const infoPanelInset = this.add.rectangle(894, 396, 332, 260, 0x0b1622, 0.98)
      .setDepth(45)
      .setStrokeStyle(1, 0x223852, 0.72);
    this.deployInfoTitle = this.add.text(736, 276, "", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#f7fbff",
      fontStyle: "bold",
      wordWrap: { width: 308 },
    }).setDepth(46);
    this.deployInfoBody = this.add.text(736, 330, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d0e2fa",
      lineSpacing: 6,
      wordWrap: { width: 308 },
    }).setDepth(46);
    this.deployInfoPanel = this.add.container(0, 0, [
      infoPanelFrame,
      infoPanelInset,
      this.deployInfoTitle,
      this.deployInfoBody,
    ]).setDepth(45).setVisible(false);

    this.deployCloseButton = createMenuButton({
      scene: this,
      x: 982,
      y: 88,
      width: 110,
      height: 40,
      label: "Close",
      onClick: () => this.closeDeployOverlay(),
      depth: 43,
      accentColor: 0x253a56,
    });
    this.deployClearButton = createMenuButton({
      scene: this,
      x: 772,
      y: 618,
      width: 160,
      height: 44,
      label: "Clear Squad",
      onClick: () => this.clearDeployAssignments(),
      depth: 43,
      accentColor: 0x3f3148,
    });
    this.deployLaunchButton = createMenuButton({
      scene: this,
      x: 952,
      y: 618,
      width: 220,
      height: 50,
      label: "Launch Mission",
      onClick: () => this.deployAcceptedMission(),
      depth: 43,
      accentColor: 0x1c4f7f,
    });

    this.deployOverlay = this.add.container(0, 0, [
      backdrop,
      shadow,
      panel,
      panelInset,
      headerBand,
      rosterBand,
      footerBand,
      title,
      this.deploySubtitle,
      this.deployMissionText,
      formationFrame,
      formationTitle,
      formationHint,
      playerRing,
      playerCore,
      playerLabel,
      this.deployStatusText,
      this.deployCloseButton.container,
      this.deployClearButton.container,
      this.deployLaunchButton.container,
      ...rosterCards.flatMap((card) => [card.container]),
      ...slotUis.flatMap((slotUi) => [slotUi.circle, slotUi.label, slotUi.occupantText]),
      this.deployInfoDismissLayer,
      this.deployInfoPanel,
    ]).setDepth(40).setVisible(false);

    this.deployRosterCards = rosterCards;
    this.deploySlotUis = slotUis;
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
      logbook: Phaser.Input.Keyboard.KeyCodes.L,
    }) as typeof this.moveKeys;

    keyboard.on("keydown-ESC", () => {
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
      if (this.deployOverlay?.visible) {
        this.closeDeployOverlay();
        return;
      }
      if (this.hasBlockingOverlay()) {
        this.closeCommandOverlays();
        return;
      }
      this.openPauseMenu();
    });
    keyboard.on("keydown-E", () => {
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
      this.tryActivateCurrentTarget();
    });
    keyboard.on("keydown-L", () => {
      if (this.touchCapable) {
        gameSession.reportInputMode("desktop", this.touchCapable);
      }
      this.toggleLogbookOverlay();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ESC");
      keyboard.removeAllListeners("keydown-E");
      keyboard.removeAllListeners("keydown-L");
    });
  }

  private bindPointerInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const touchLike = this.isTouchPointer(pointer);
      if (this.touchCapable) {
        gameSession.reportInputMode(touchLike ? "touch" : "desktop", this.touchCapable);
      }

      if (!this.touchMode || !touchLike || !this.stickBase || this.panel?.visible || this.deployOverlay?.visible) {
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
    if (this.hasBlockingOverlay()) {
      return;
    }

    const move = this.moveVector.lengthSq() > 0.01 ? this.moveVector : this.keyboardVector;
    this.player.x = Phaser.Math.Clamp(this.player.x + move.x * HUB_SPEED * dt, HUB_ROOM.x + 22, HUB_ROOM.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + move.y * HUB_SPEED * dt, HUB_ROOM.y + 22, HUB_ROOM.bottom - 22);
    this.playerShadow.setPosition(this.player.x, this.player.y + 14);
  }

  private updateCrew(dt: number): void {
    this.buddyPulse += dt;
    this.crew.forEach((companion) => {
      companion.sprite.x = companion.anchor.x + Math.sin(this.buddyPulse * 1.3 + companion.pulseOffset) * 5;
      companion.sprite.y = companion.anchor.y + Math.cos(this.buddyPulse * 1.7 + companion.pulseOffset) * 3;
      companion.shadow.setPosition(companion.sprite.x, companion.sprite.y + companion.sprite.radius * 0.72);
      if (companion.shieldPlate) {
        companion.shieldPlate.setPosition(companion.sprite.x + companion.sprite.radius + 8, companion.sprite.y);
      }
      companion.label.setPosition(companion.sprite.x, companion.sprite.y + 30);
    });
  }

  private updateNearestStation(): void {
    let nearest: Station | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.stations.forEach((station) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, station.zone.x, station.zone.y);
      const closeEnough = distance <= station.interactionRadius;
      station.zone.setFillStyle(closeEnough ? 0x21486f : 0x17314f, closeEnough ? 0.96 : 0.84);
      station.glow.setAlpha(closeEnough ? 0.18 : 0.08);
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

    if (this.hasBlockingOverlay()) {
      this.promptText.setText("");
      return;
    }

    if (this.currentInteraction) {
      this.promptText.setText("");
      return;
    }

    if (this.isNearAirlock()) {
      const selectedMission = gameSession.getSelectedMissionId();
      this.promptText.setText(selectedMission
        ? "Activate the deploy door to assign the squad and launch the active contract."
        : "Activate the deploy door to assign the squad. Launch unlocks once the Data Pad has an active contract.");
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

    this.closeCommandOverlays();
    const title = this.panel.data?.get("title") as Phaser.GameObjects.Text | undefined;
    this.panel.setVisible(id === "cockpit");

    if (id === "mission") {
      this.missionBoardOverlay?.show();
      this.syncSceneOverlayChrome();
      return;
    }

    if (id === "loadout") {
      this.inventoryOverlay?.show();
      this.syncSceneOverlayChrome();
      return;
    }

    if (id === "cockpit") {
      title?.setText("Cockpit Bridge");
      this.panelBody.setText([
        "The flight bridge is the future space layer entry point.",
        "",
        "You will eventually launch into space from here, travel to mission waypoints, discover secrets, and decide when to dock or deploy.",
        "",
        "For this milestone, the right-side deploy door is still acting as the temporary shortcut into ground missions.",
      ]);
      this.panelFooter.setText("Space flight is not live yet, but the bridge door is now in place so the command deck layout matches the longer-term plan.");
      this.panelClose?.setLabel("Close");
      this.panelAction.setLabel("Bridge Offline");
      this.panelAction.setEnabled(false);
      this.syncSceneOverlayChrome();
      return;
    }
  }

  private closePanel(): void {
    this.panel?.setVisible(false);
    this.syncSceneOverlayChrome();
  }

  private closeCommandOverlays(): void {
    this.closePanel();
    if (this.missionBoardOverlay?.isVisible()) {
      this.missionBoardOverlay.hide();
    }
    if (this.logbookOverlay?.isVisible()) {
      this.logbookOverlay.hide();
    }
    if (this.inventoryOverlay?.isVisible()) {
      this.inventoryOverlay.hide();
    }
    this.syncSceneOverlayChrome();
  }

  private hasBlockingOverlay(): boolean {
    return Boolean(
      this.panel?.visible
      || this.deployOverlay?.visible
      || this.missionBoardOverlay?.isVisible()
      || this.logbookOverlay?.isVisible()
      || this.inventoryOverlay?.isVisible(),
    );
  }

  private openDeployOverlay(): void {
    this.closeCommandOverlays();
    this.selectedDeployCompanionId = null;
    this.hoveredDeployCompanionId = null;
    this.hideDeployInfo();
    this.deployOverlay?.setVisible(true);
    this.refreshDeployOverlay("Choose your squad and formation before launch.");
    this.syncSceneOverlayChrome();
  }

  private closeDeployOverlay(): void {
    this.deployOverlay?.setVisible(false);
    this.selectedDeployCompanionId = null;
    this.hoveredDeployCompanionId = null;
    this.hideDeployInfo();
    this.syncSceneOverlayChrome();
  }

  private toggleDeployInfo(companionId: CompanionId): void {
    if (this.deployInfoCompanionId === companionId) {
      this.hideDeployInfo();
      return;
    }

    this.deployInfoCompanionId = companionId;
    this.refreshDeployInfo();
    this.refreshDeployOverlay();
  }

  private hideDeployInfo(): void {
    this.deployInfoCompanionId = null;
    this.refreshDeployInfo();
    if (this.deployOverlay?.visible) {
      this.refreshDeployOverlay();
    }
  }

  private refreshDeployInfo(): void {
    const companion = this.deployInfoCompanionId ? getCompanionDefinition(this.deployInfoCompanionId) : undefined;
    const visible = Boolean(companion);
    this.deployInfoDismissLayer?.setVisible(visible);
    this.deployInfoPanel?.setVisible(visible);

    if (!companion || !this.deployInfoTitle || !this.deployInfoBody) {
      return;
    }

    this.deployInfoTitle.setText(`${companion.name}\n${getCompanionRoleDisplay(companion)}`);
    this.deployInfoBody.setText([
      companion.bio,
      "",
      "Attack",
      companion.attackSummary,
      "",
      "Ability",
      `${companion.abilityLabel}: ${companion.abilitySummary}`,
      "",
      "Loadout",
      `${companion.primaryGear}`,
      `${companion.supportGear}`,
    ]);
  }

  private refreshDeployOverlay(statusMessage?: string): void {
    const assignments = gameSession.getSquadAssignments();
    const activeMissionId = gameSession.getSelectedMissionId();
    const activeMission = activeMissionId ? getMissionContract(activeMissionId) : null;
    const selectedCompanion = this.selectedDeployCompanionId ? getCompanionDefinition(this.selectedDeployCompanionId) : undefined;
    const fallbackStatus = selectedCompanion
      ? `${selectedCompanion.name} selected. Choose a valid slot below.`
      : assignments.length === 0
        ? "No companions assigned. Launch will go solo until you slot someone in."
        : `${assignments.length} companion${assignments.length === 1 ? "" : "s"} readied. You can still move them before launch.`;

    this.deployMissionText?.setText(activeMission
      ? `Active contract: ${activeMission.title} | ${activeMission.location}`
      : "No active contract selected. Use the mission terminal and Data Pad before launch.");
    this.deployStatusText?.setText(statusMessage ?? fallbackStatus);

    this.deployRosterCards.forEach((card) => {
      const assignedSlot = assignments.find((assignment) => assignment.companionId === card.companionId)?.slotId ?? null;
      const selected = this.selectedDeployCompanionId === card.companionId;
      const hovered = this.hoveredDeployCompanionId === card.companionId;
      const assigned = assignedSlot !== null;
      const slotLabel = getShortFormationLabel(assignedSlot);
      const emphasis = selected ? 1 : hovered ? 0.92 : assigned ? 0.18 : 0.05;
      const frameColor = selected ? 0x13263a : hovered ? 0x101d2e : assigned ? 0x0d1825 : 0x0a1320;

      card.container.setScale(selected ? 1.03 : hovered ? 1.01 : 1);
      card.container.setY(card.baseY - (selected ? 8 : hovered ? 3 : 0));
      card.frame.setStrokeStyle(3, card.companion.trimColor, selected ? 0.98 : hovered ? 0.88 : assigned ? 0.7 : 0.34);
      card.frame.setFillStyle(frameColor, 0.96);
      card.beam.setAlpha(0.38 * emphasis);
      card.beamCore.setAlpha(0.68 * emphasis);
      card.portraitGlow.setAlpha(0.42 * emphasis + 0.04);
      card.pedestal.setAlpha(0.08 + 0.24 * emphasis);
      card.portraitHead.setScale(selected ? 1.04 : hovered ? 1.02 : 1);
      card.portraitBody.setScale(selected ? 1.03 : hovered ? 1.015 : 1);
      card.title.setColor(selected || hovered || assigned ? "#f7fbff" : "#d5e0f0");
      card.detail.setColor(selected || hovered ? "#dbeaff" : "#b3c7de");
      card.detail.setText(getCompanionRoleDisplay(card.companion));
      card.slotText.setColor(selected ? "#f4fbff" : assigned ? "#cfe4ff" : hovered ? "#bdd8f8" : "#7d90a8");
      card.slotText.setText(assigned ? `Assigned: ${slotLabel}` : selected ? "Choose a slot" : "Unassigned");
      const infoActive = this.deployInfoCompanionId === card.companionId;
      card.infoButton.setFillStyle(infoActive ? 0x183049 : 0x102133, 0.96);
      card.infoButton.setStrokeStyle(2, card.companion.trimColor, infoActive ? 0.88 : hovered || selected ? 0.72 : 0.5);
      card.infoLabel.setColor(infoActive ? "#ffffff" : "#dce8f8");
    });

    this.deploySlotUis.forEach((slotUi) => {
      const assignment = assignments.find((entry) => entry.slotId === slotUi.slot.id);
      const occupant = assignment ? getCompanionDefinition(assignment.companionId) : undefined;
      const validForSelection = selectedCompanion ? canCompanionOccupySlot(selectedCompanion, slotUi.slot) : true;
      slotUi.circle.setFillStyle(occupant?.coreColor ?? 0x122338, occupant ? 0.92 : 0.98);
      slotUi.circle.setStrokeStyle(
        2,
        selectedCompanion && !validForSelection ? 0x8c4b4b : occupant?.trimColor ?? 0x5d86b9,
        selectedCompanion && !validForSelection ? 0.88 : occupant ? 0.92 : 0.72,
      );
      slotUi.occupantText.setText(occupant ? occupant.name : "Empty");
      slotUi.occupantText.setColor(occupant ? "#f7fbff" : validForSelection ? "#7f92a9" : "#d59595");
    });

    this.deployLaunchButton?.setEnabled(Boolean(activeMission));
    this.deployLaunchButton?.setLabel(activeMission ? "Launch Mission" : "Launch Locked");
    this.deployClearButton?.setEnabled(assignments.length > 0);
  }

  private handleDeployRosterSelect(companionId: CompanionId): void {
    this.selectedDeployCompanionId = this.selectedDeployCompanionId === companionId ? null : companionId;
    this.refreshDeployOverlay();
  }

  private handleDeploySlotClick(slotId: FormationSlotId): void {
    const assignments = gameSession.getSquadAssignments();
    const occupant = assignments.find((assignment) => assignment.slotId === slotId);

    if (!this.selectedDeployCompanionId) {
      if (!occupant) {
        this.refreshDeployOverlay("Select a companion first, then choose a slot.");
        return;
      }

      gameSession.setSquadAssignments(assignments.filter((assignment) => assignment.slotId !== slotId));
      this.refreshDeployOverlay(`${getCompanionDefinition(occupant.companionId)?.name ?? "Companion"} removed from ${getFormationSlot(slotId)?.label ?? slotId}.`);
      return;
    }

    const selectedCompanion = getCompanionDefinition(this.selectedDeployCompanionId);
    const slot = getFormationSlot(slotId);
    if (!selectedCompanion || !slot) {
      return;
    }

    if (!canCompanionOccupySlot(selectedCompanion, slot)) {
      this.refreshDeployOverlay(`${selectedCompanion.name} cannot occupy ${slot.label}.`);
      return;
    }

    const alreadyAssigned = assignments.some((assignment) => assignment.companionId === this.selectedDeployCompanionId);
    const openSlots = assignments.filter((assignment) => assignment.companionId !== this.selectedDeployCompanionId && assignment.slotId !== slotId);
    if (!alreadyAssigned && !occupant && assignments.length >= 3) {
      this.refreshDeployOverlay("Only 3 companions can join the mission at once.");
      return;
    }

    openSlots.push({
      companionId: this.selectedDeployCompanionId,
      slotId,
    });
    gameSession.setSquadAssignments(openSlots);
    this.selectedDeployCompanionId = null;
    this.refreshDeployOverlay(`${selectedCompanion.name} assigned to ${slot.label}.`);
  }

  private clearDeployAssignments(): void {
    gameSession.setSquadAssignments([]);
    this.selectedDeployCompanionId = null;
    this.refreshDeployOverlay("Squad cleared. You can launch solo or rebuild the team.");
  }

  private refreshMissionState(): void {
    const activeMissionId = gameSession.getSelectedMissionId();
    const activeMission = activeMissionId ? getMissionContract(activeMissionId) : null;
    const queuedCount = gameSession.getAcceptedMissionIds().length;
    this.missionText?.setText(activeMission
      ? `Active contract: ${activeMission.title} | ${queuedCount} queued`
      : "No active contract. Queue missions at the terminal, then make one active in the Data Pad.");
    this.statusText?.setText(activeMission
      ? `${activeMission.prompt}`
      : "Mission Terminal queues routes. Data Pad picks the active one. Deploy Door launches it once your squad is set.");

    this.airlockDoor?.setFillStyle(activeMission ? 0x1d5c8d : 0x173b5d, activeMission ? 0.98 : 0.9);
    this.airlockDoor?.setStrokeStyle(3, activeMission ? 0x8be4ff : 0x7ec4ff, activeMission ? 0.96 : 0.62);
    this.airlockGlow?.setFillStyle(0x4abfff, activeMission ? 0.28 : 0.14);
    this.airlockLabel?.setColor(activeMission ? "#f4fbff" : "#c8ddff");
    if (!activeMission) {
      this.deploying = false;
    }
  }

  private handleCommandOverlayClosed(): void {
    this.refreshMissionState();
    this.syncSceneOverlayChrome();
  }

  private toggleLogbookOverlay(): void {
    if (this.deployOverlay?.visible) {
      this.closeDeployOverlay();
    }

    if (this.logbookOverlay?.isVisible()) {
      this.logbookOverlay.hide();
      return;
    }

    this.closeCommandOverlays();
    this.logbookOverlay?.show();
    this.syncSceneOverlayChrome();
  }

  private syncSceneOverlayChrome(): void {
    const blocking = this.hasBlockingOverlay();
    const alpha = blocking ? 0.08 : 1;
    this.missionText?.setAlpha(alpha);
    this.statusText?.setAlpha(alpha);
    this.rewardText?.setAlpha(alpha);
    this.promptText?.setAlpha(alpha);
    this.logbookButton?.container.setAlpha(blocking ? 0.28 : 1);
    this.pauseButton?.container.setAlpha(blocking ? 0.28 : 1);
  }

  private presentPendingReward(): void {
    const reward = gameSession.consumePendingReward();
    if (!reward || !this.rewardText) {
      return;
    }

    const materialCount = [
      reward.materials.alloy > 0,
      reward.materials.shardDust > 0,
      reward.materials.filament > 0,
    ].filter(Boolean).length;
    this.rewardText.setText(
      `Mission reward: +${reward.xp} XP | +${reward.credits} credits | ${reward.items.length} gear drop${reward.items.length === 1 ? "" : "s"} | ${materialCount} salvage bundle${materialCount === 1 ? "" : "s"}`,
    );
    this.rewardText.setVisible(true);

    this.time.delayedCall(5200, () => {
      this.rewardText?.setVisible(false);
    });
  }

  private deployAcceptedMission(): void {
    if (!this.airlockDoor || this.deploying) {
      return;
    }

    const missionId = gameSession.getSelectedMissionId();
    if (!missionId) {
      this.refreshDeployOverlay("You can prep the squad now, but launch stays locked until the Data Pad has an active contract.");
      return;
    }

    this.deploying = true;
    this.closeDeployOverlay();
    this.statusText?.setText("Deploying through the temporary airlock shortcut.");
    this.cameras.main.fadeOut(220, 8, 12, 18);
    this.time.delayedCall(220, () => {
      gameSession.startMission(missionId);
      this.scene.start("mission", { missionId });
    });
  }

  private updateInteractionTarget(): void {
    if (this.hasBlockingOverlay()) {
      this.currentInteraction = null;
      this.updateInteractionVisuals();
      return;
    }

    const stationTarget = this.nearestStation
      ? {
          kind: "station" as const,
          x: this.nearestStation.zone.x,
          y: this.nearestStation.zone.getBounds().top - 26,
          buttonLabel: this.nearestStation.id === "mission"
            ? "Use"
            : this.nearestStation.id === "cockpit"
              ? "Bridge"
              : "Loadout",
          station: this.nearestStation,
        }
      : null;

    const airlockTarget = this.isNearAirlock()
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
    const showTouchActivate = this.touchMode && !this.hasBlockingOverlay() && Boolean(this.currentInteraction);
    this.activateButton?.container.setVisible(showTouchActivate);
    this.activateButton?.setInputEnabled(showTouchActivate);
    if (showTouchActivate && this.currentInteraction) {
      this.activateButton?.setLabel(this.currentInteraction.buttonLabel);
    }

    const showDesktopHint = !this.touchMode && !this.hasBlockingOverlay() && Boolean(this.currentInteraction);
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
    if (!this.isNearAirlock()) {
      this.statusText?.setText("Move closer to the deploy door.");
      return;
    }

    this.openDeployOverlay();
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
      || this.logbookButton?.container.getBounds().contains(pointer.x, pointer.y)
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
      deployOverlayVisible: this.deployOverlay?.visible ?? false,
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
      },
      crew: this.crew.map((companion) => ({
        id: companion.id,
        x: Math.round(companion.sprite.x),
        y: Math.round(companion.sprite.y),
      })),
      nearestStation: this.nearestStation?.id ?? null,
      currentInteraction: this.currentInteraction?.kind ?? null,
      acceptedMissionId: gameSession.acceptedMissionId,
      logbookVisible: this.logbookOverlay?.isVisible() ?? false,
      squadAssignments: gameSession.getSquadAssignments(),
      activeSlot: gameSession.getActiveSlotIndex(),
      prompt: this.promptText?.text ?? "",
    };
  }
}
