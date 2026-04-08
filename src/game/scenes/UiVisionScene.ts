import Phaser from "phaser";

import { GAME_CODE, GAME_IP, GAME_SERIES, GAME_TITLE, GAME_VERSION } from "../core/buildInfo";
import {
  createBodyText,
  createEmberAccent,
  createEmptyCharacterWell,
  createTitle,
  createUiPanel,
  drawCosmicBackdrop,
  UI_FONT_FAMILY,
  UI_THEME,
} from "../ui/theme";

type VisionPage = "main-menu" | "data-pad" | "inventory";

type PageTab = {
  id: VisionPage;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type PreviewButtonOptions = {
  x: number;
  y: number;
  width: number;
  label: string;
  height?: number;
  depth?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  labelColor?: string;
  fontSize?: number;
};

export class UiVisionScene extends Phaser.Scene {
  private currentPage: VisionPage = "main-menu";
  private readonly pages = new Map<VisionPage, Phaser.GameObjects.Container>();
  private readonly tabs: PageTab[] = [];
  private ringGraphics?: Phaser.GameObjects.Graphics;
  private ringTime = 0;
  private pageDescription?: Phaser.GameObjects.Text;
  private pageTitle?: Phaser.GameObjects.Text;

  constructor() {
    super("ui-vision");
  }

  create(): void {
    drawCosmicBackdrop(this, { count: 150, seed: 29 });
    this.createSandboxChrome();
    this.buildMainMenuPage();
    this.buildDataPadPage();
    this.buildInventoryPage();
    this.bindKeyboard();
    this.showPage("main-menu");
  }

  update(_: number, delta: number): void {
    this.ringTime += delta * 0.001;
    if (this.currentPage === "main-menu" && this.ringGraphics) {
      this.drawAnimatedRing(this.ringGraphics, 948, 398, 148, this.ringTime);
    }
  }

  private createSandboxChrome(): void {
    createUiPanel({
      scene: this,
      x: 640,
      y: 82,
      width: 1170,
      height: 110,
      fillColor: 0x06101a,
      fillAlpha: 0.9,
      borderAlpha: 0.48,
      depth: 5,
    });

    this.pageTitle = createTitle(this, 90, 48, "UI Vision Sandbox", 34).setDepth(6);
    this.pageDescription = createBodyText(
      this,
      92,
      92,
      "Reference-led concept screens. These are look targets for the future UI kit, not live menu replacements yet.",
      850,
      "#c6d7ee",
      15,
    ).setDepth(6);

    const backButton = this.createPreviewButton({
      x: 1114,
      y: 82,
      width: 170,
      height: 44,
      label: "Back To Menu",
      depth: 6,
      fillColor: 0x12243b,
      fillAlpha: 0.78,
      borderColor: 0x86c9ff,
      labelColor: "#f5fbff",
      fontSize: 18,
    });
    const backHit = this.add.rectangle(0, 0, 170, 44, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    backHit.on("pointerdown", () => this.scene.start("main-menu"));
    backButton.add(backHit);

    const tabLabels: Array<{ id: VisionPage; label: string }> = [
      { id: "main-menu", label: "Main Menu" },
      { id: "data-pad", label: "Data Pad" },
      { id: "inventory", label: "Inventory" },
    ];

    tabLabels.forEach((tab, index) => {
      const x = 122 + index * 190;
      const background = this.add.rectangle(0, 0, 168, 40, 0x0a1420, 0.74)
        .setStrokeStyle(2, UI_THEME.borderSoft, 0.64);
      const label = this.add.text(0, 0, tab.label, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "18px",
        color: "#d2e3f9",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, 168, 40, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const container = this.add.container(x, 150, [background, label, hit]).setDepth(6);
      hit.on("pointerdown", () => this.showPage(tab.id));
      this.tabs.push({ id: tab.id, container, background, label });
    });
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    keyboard.on("keydown-ONE", () => this.showPage("main-menu"));
    keyboard.on("keydown-TWO", () => this.showPage("data-pad"));
    keyboard.on("keydown-THREE", () => this.showPage("inventory"));
    keyboard.on("keydown-ESC", () => this.scene.start("main-menu"));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ONE");
      keyboard.removeAllListeners("keydown-TWO");
      keyboard.removeAllListeners("keydown-THREE");
      keyboard.removeAllListeners("keydown-ESC");
    });
  }

  private buildMainMenuPage(): void {
    const container = this.add.container(0, 0).setDepth(4);

    const titlePrefix = this.add.text(284, 178, GAME_IP, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "16px",
      color: "#91b7ef",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setDepth(6);
    const title = this.add.text(108, 214, GAME_SERIES, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "58px",
      color: "#f6fbff",
      fontStyle: "bold",
    }).setDepth(6);
    const subtitle = this.add.text(288, 278, GAME_TITLE, {
      fontFamily: "\"Georgia\"",
      fontSize: "34px",
      color: "#f6fbff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0).setDepth(6);
    const titleLine = this.add.graphics().setDepth(6);
    titleLine.lineStyle(2, 0x74bfff, 0.92);
    titleLine.beginPath();
    titleLine.moveTo(110, 338);
    titleLine.lineTo(470, 338);
    titleLine.strokePath();
    titleLine.fillStyle(0xf4fbff, 0.94);
    titleLine.fillCircle(472, 338, 2.5);

    const tagline = this.add.text(110, 380, ["Build the crew.", "Launch the mission.", "Return stronger."], {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "20px",
      color: "#d1e3fb",
      lineSpacing: 8,
    }).setDepth(6);

    const mainButtons = [
      { y: 520, label: "Begin Journey" },
      { y: 578, label: "Continue" },
      { y: 636, label: "Settings" },
      { y: 694, label: "Archive" },
    ];
    mainButtons.forEach((button) => {
      const frame = this.createPreviewButton({
        x: 222,
        y: button.y,
        width: 258,
        height: 42,
        label: button.label,
        depth: 6,
        fillColor: 0x102038,
        fillAlpha: 0.42,
        borderColor: 0x78bbf4,
        fontSize: 18,
      });
      container.add(frame);
    });

    const ringFrame = createUiPanel({
      scene: this,
      x: 948,
      y: 404,
      width: 514,
      height: 566,
      fillColor: 0x06111c,
      fillAlpha: 0.38,
      borderColor: 0x5a8ab9,
      borderAlpha: 0.34,
      depth: 5,
    });
    const ringMaskFrame = this.add.rectangle(948, 404, 462, 520)
      .setStrokeStyle(1, 0x5a8ab9, 0.22)
      .setDepth(6);
    this.ringGraphics = this.add.graphics().setDepth(7);

    const cornerLights = this.add.graphics().setDepth(7);
    cornerLights.fillStyle(0xaedcff, 0.8);
    cornerLights.fillRect(716, 150, 4, 34);
    cornerLights.fillRect(1176, 150, 4, 34);
    cornerLights.fillRect(716, 624, 4, 34);
    cornerLights.fillRect(1176, 624, 4, 34);

    const milestone = this.add.text(106, 748, "Current milestone: ui vision mockup pass", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "15px",
      color: "#93a8c5",
    }).setDepth(6);
    const version = this.add.text(1046, 748, `${GAME_CODE} ${GAME_VERSION}`, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "14px",
      color: "#90a6c6",
    }).setDepth(6);

    container.add([
      titlePrefix,
      title,
      subtitle,
      titleLine,
      tagline,
      ringFrame,
      ringMaskFrame,
      this.ringGraphics,
      cornerLights,
      milestone,
      version,
    ]);

    this.pages.set("main-menu", container);
  }

  private buildDataPadPage(): void {
    const container = this.add.container(0, 0).setDepth(4);
    const panel = createUiPanel({
      scene: this,
      x: 640,
      y: 440,
      width: 1120,
      height: 540,
      fillColor: 0x07111b,
      fillAlpha: 0.965,
      depth: 4,
    });
    const leftRail = createUiPanel({
      scene: this,
      x: 118,
      y: 438,
      width: 84,
      height: 482,
      fillColor: 0x08131f,
      fillAlpha: 0.99,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.84,
      depth: 5,
    });
    const listPanel = createUiPanel({
      scene: this,
      x: 356,
      y: 410,
      width: 292,
      height: 388,
      fillColor: 0x091522,
      fillAlpha: 0.99,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.72,
      depth: 5,
    });
    const detailPanel = createUiPanel({
      scene: this,
      x: 784,
      y: 410,
      width: 540,
      height: 388,
      fillColor: 0x091420,
      fillAlpha: 0.99,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.72,
      depth: 5,
    });

    const title = createTitle(this, 98, 200, "MISSION LOG", 30).setDepth(6);
    const headerLine = this.add.graphics().setDepth(6);
    headerLine.lineStyle(2, 0x74d9ff, 0.86);
    headerLine.beginPath();
    headerLine.moveTo(188, 238);
    headerLine.lineTo(1016, 238);
    headerLine.strokePath();
    headerLine.fillStyle(0xf4fbff, 0.9);
    headerLine.fillCircle(1016, 238, 2.5);

    container.add([panel, leftRail, listPanel, detailPanel, title, headerLine]);

    this.createDataPadRailButton(container, 118, 316, "MISSIONS", true);
    this.createDataPadRailButton(container, 118, 396, "CREW", false);
    this.createDataPadRailButton(container, 118, 476, "SYSTEM", false);

    const listLabel = createBodyText(this, 214, 284, "ACTIVE", 120, "#9ab0cc", 14).setDepth(6);
    const missions = [
      { y: 336, label: "Distress Signal Investigation", active: true },
      { y: 394, label: "Supply Run to Outpost Delta", active: false },
      { y: 452, label: "Rescue the Scientists", active: false },
    ];
    missions.forEach((mission) => {
      const frame = this.add.rectangle(356, mission.y, 252, 46, mission.active ? 0x13293f : 0x0d1722, 0.96)
        .setStrokeStyle(2, mission.active ? 0xdcb66e : 0x2f4b67, mission.active ? 0.92 : 0.6)
        .setDepth(6);
      const marker = this.add.text(230, mission.y - 11, mission.active ? ">" : "-", {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "20px",
        color: mission.active ? "#ffd07a" : "#7e99bb",
        fontStyle: "bold",
      }).setDepth(7);
      const text = this.add.text(246, mission.y - 11, mission.label, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "16px",
        color: mission.active ? "#f4fbff" : "#bed3ee",
      }).setDepth(7);
      container.add([frame, marker, text]);
    });

    const completedLabel = createBodyText(this, 214, 492, "COMPLETED", 120, "#9ab0cc", 14).setDepth(6);
    const completed = [
      { y: 536, label: "ANTHIC Vice" },
      { y: 574, label: "The Drifter" },
    ];
    completed.forEach((mission) => {
      const text = this.add.text(228, mission.y, `> ${mission.label}`, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "16px",
        color: "#7287a4",
      }).setDepth(6);
      container.add(text);
    });

    const detailTitle = this.add.text(536, 294, "Distress Signal Investigation", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "28px",
      color: "#f6fbff",
    }).setDepth(6);

    const missionIcon = this.add.graphics().setDepth(6);
    missionIcon.lineStyle(3, 0xd8b56e, 0.9);
    missionIcon.strokeCircle(646, 372, 18);
    missionIcon.strokeCircle(646, 372, 34);
    missionIcon.lineStyle(3, 0xd8b56e, 0.72);
    missionIcon.strokeCircle(646, 372, 50);
    missionIcon.fillStyle(0xf5d78f, 0.94);
    missionIcon.fillCircle(646, 372, 4);

    const summaryLabel = createBodyText(this, 576, 418, "MISSION SUMMARY", 220, "#8399b6", 14).setDepth(6);
    const summary = createBodyText(
      this,
      536,
      446,
      "Investigate the distress signal coming from a derelict ship on the edge of the sector. Find out what happened to the crew and salvage any useful materials.",
      430,
      "#cfddf1",
      17,
    ).setDepth(6);
    const taskLabel = createBodyText(this, 536, 546, "CURRENT TASK", 220, "#8399b6", 14).setDepth(6);
    const task = createBodyText(
      this,
      536,
      574,
      "Board the derelict ship and investigate the distress signal.",
      430,
      "#cfddf1",
      17,
    ).setDepth(6);

    const setActiveButton = this.createPreviewButton({
      x: 742,
      y: 652,
      width: 238,
      height: 40,
      label: "SET AS ACTIVE",
      depth: 6,
      fillColor: 0x102038,
      fillAlpha: 0.42,
      borderColor: 0x7abcf6,
      fontSize: 17,
    });
    const backButton = this.createPreviewButton({
      x: 742,
      y: 698,
      width: 238,
      height: 38,
      label: "BACK",
      depth: 6,
      fillColor: 0x0e1b2e,
      fillAlpha: 0.35,
      borderColor: 0x587ca4,
      fontSize: 17,
    });

    container.add([
      listLabel,
      completedLabel,
      detailTitle,
      missionIcon,
      summaryLabel,
      summary,
      taskLabel,
      task,
      setActiveButton,
      backButton,
    ]);

    this.pages.set("data-pad", container);
  }

  private buildInventoryPage(): void {
    const container = this.add.container(0, 0).setDepth(4);
    const panel = createUiPanel({
      scene: this,
      x: 640,
      y: 432,
      width: 1120,
      height: 530,
      fillColor: 0x07111b,
      fillAlpha: 0.97,
      depth: 4,
    });
    const title = createTitle(this, 98, 202, "INVENTORY", 30).setDepth(6);
    const headerLine = this.add.graphics().setDepth(6);
    headerLine.lineStyle(2, 0x74d9ff, 0.86);
    headerLine.beginPath();
    headerLine.moveTo(190, 240);
    headerLine.lineTo(1018, 240);
    headerLine.strokePath();
    headerLine.fillStyle(0xf4fbff, 0.9);
    headerLine.fillCircle(1018, 240, 2.5);

    const emberColor = createEmberAccent("blue");
    const previewWell = createEmptyCharacterWell(this, 636, 382, 382, 258, emberColor, "AARUIAN CHARACTER WELL");
    previewWell.setDepth(6);

    container.add([panel, title, headerLine, previewWell]);

    const slotStyle = { width: 92, height: 48 };
    const leftColumn = [
      { x: 120, y: 332, label: "HEAD" },
      { x: 120, y: 394, label: "LEGS" },
      { x: 120, y: 456, label: "BELT" },
      { x: 120, y: 518, label: "WEAPON LEFT" },
    ];
    const rightColumn = [
      { x: 236, y: 332, label: "CHEST" },
      { x: 236, y: 394, label: "BACK" },
      { x: 236, y: 456, label: "GLOVES" },
      { x: 236, y: 518, label: "WEAPON RIGHT" },
    ];
    leftColumn.concat(rightColumn).forEach((slot) => {
      container.add(this.createGearSlot(slot.x, slot.y, slotStyle.width, slotStyle.height, slot.label));
    });

    [542, 636, 730].forEach((x) => {
      container.add(this.createGearSlot(x, 496, 82, 40, "ACCESSORY", 11));
    });

    const cargoTitle = this.add.text(100, 556, "CARGO", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "22px",
      color: "#f0f7ff",
      fontStyle: "bold",
    }).setDepth(6);
    const cargoLine = this.add.rectangle(612, 584, 888, 2, 0x2d4c69, 0.74).setDepth(6);
    const cargoInnerLine = this.add.rectangle(612, 584, 888, 1, 0x79c9ff, 0.3).setDepth(7);

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const cellX = 194 + column * 86;
        const cellY = 610 + row * 32;
        const cell = this.add.rectangle(cellX, cellY, 72, 26, 0x08131d, 0.95)
          .setStrokeStyle(2, UI_THEME.borderSoft, 0.66)
          .setDepth(6);
        container.add(cell);
      }
    }

    const highlighted = this.add.rectangle(796, 610, 72, 26, 0x10243b, 0.98)
      .setStrokeStyle(2, 0x85cbff, 0.92)
      .setDepth(7);
    const highlightedGlyph = this.add.rectangle(796, 610, 16, 8, 0x98c8ff, 0.9)
      .setStrokeStyle(1, 0xd9efff, 0.74)
      .setDepth(8);

    const controls = this.add.text(102, 676, "E  EQUIP     R  DROP     ESC  BACK", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "16px",
      color: "#899fbc",
    }).setDepth(6);
    const currencies = this.add.text(878, 674, "1,250      47", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "18px",
      color: "#d7e6fa",
    }).setDepth(6);
    const chips = this.add.text(98, 642, "o 0       ) 0", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "18px",
      color: "#89d8ff",
    }).setDepth(6);

    container.add([
      cargoTitle,
      cargoLine,
      cargoInnerLine,
      highlighted,
      highlightedGlyph,
      controls,
      currencies,
      chips,
    ]);

    this.pages.set("inventory", container);
  }

  private createPreviewButton({
    x,
    y,
    width,
    label,
    height = 46,
    depth = 6,
    fillColor = 0x102038,
    fillAlpha = 0.4,
    borderColor = 0x76b9f3,
    labelColor = "#f4fbff",
    fontSize = 18,
  }: PreviewButtonOptions): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, width, height, fillColor, fillAlpha)
      .setStrokeStyle(2, borderColor, 0.82);
    const inner = this.add.rectangle(0, 0, width - 8, height - 8)
      .setStrokeStyle(1, 0xf8fdff, 0.12);
    const text = this.add.text(0, 0, label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: `${fontSize}px`,
      color: labelColor,
      fontStyle: "bold",
    }).setOrigin(0.5);
    return this.add.container(x, y, [background, inner, text]).setDepth(depth);
  }

  private createDataPadRailButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    active: boolean,
  ): void {
    const frame = this.add.rectangle(x, y, 54, 64, active ? 0x10243a : 0x0a1420, active ? 0.98 : 0.78)
      .setStrokeStyle(2, active ? 0xd6b268 : UI_THEME.borderSoft, active ? 0.86 : 0.56)
      .setDepth(6);
    const icon = this.add.graphics().setDepth(7);
    const iconColor = active ? 0xe4c06e : 0x8ca9cb;
    icon.lineStyle(2, iconColor, active ? 0.94 : 0.68);
    icon.strokeRect(x - 8, y - 12, 16, 16);
    if (label === "MISSIONS") {
      icon.strokeCircle(x, y - 4, 8);
      icon.fillStyle(iconColor, active ? 0.9 : 0.6);
      icon.fillCircle(x, y - 4, 2.5);
    } else {
      icon.lineStyle(2, iconColor, active ? 0.94 : 0.68);
      icon.strokeRect(x - 7, y - 11, 14, 14);
    }
    const text = this.add.text(x, y + 18, label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "11px",
      color: active ? "#ffd37a" : "#8aa4c4",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(7);
    container.add([frame, icon, text]);
  }

  private createGearSlot(x: number, y: number, width: number, height: number, label: string, size = 12): Phaser.GameObjects.Container {
    const frame = this.add.rectangle(0, 0, width, height, 0x07131d, 0.95)
      .setStrokeStyle(2, UI_THEME.borderSoft, 0.72);
    const inner = this.add.rectangle(0, 0, width - 8, height - 8)
      .setStrokeStyle(1, 0x7dc9ff, 0.14);
    const text = this.add.text(0, 0, label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: `${size}px`,
      color: "#9eb5d2",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5);
    return this.add.container(x, y, [frame, inner, text]).setDepth(6);
  }

  private drawAnimatedRing(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, time: number): void {
    graphics.clear();

    const glowRings = [
      { r: radius + 20, alpha: 0.07 },
      { r: radius + 8, alpha: 0.1 },
    ];
    glowRings.forEach((ring) => {
      graphics.lineStyle(2, 0xffffff, ring.alpha);
      graphics.strokeCircle(x, y, ring.r);
    });

    const segments = 96;
    for (let index = 0; index < segments; index += 1) {
      const progress = index / segments;
      const hue = Phaser.Math.Wrap(progress + time * 0.06, 0, 1);
      const color = Phaser.Display.Color.HSVToRGB(hue, 0.7, 1) as { r: number; g: number; b: number };
      const start = Phaser.Math.DegToRad(progress * 360);
      const end = Phaser.Math.DegToRad((index + 1) / segments * 360);
      const lineColor = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      graphics.lineStyle(6, lineColor, 0.28);
      graphics.beginPath();
      graphics.arc(x, y, radius + 2, start, end);
      graphics.strokePath();
      graphics.lineStyle(3, lineColor, 0.98);
      graphics.beginPath();
      graphics.arc(x, y, radius, start, end);
      graphics.strokePath();
    }

    for (let index = 0; index < 14; index += 1) {
      const angle = time * 1.4 + index * 0.46;
      const sparkRadius = radius + 6 + (index % 3) * 8;
      const sparkX = x + Math.cos(angle) * sparkRadius;
      const sparkY = y + Math.sin(angle) * sparkRadius;
      graphics.fillStyle(0xffffff, 0.3);
      graphics.fillCircle(sparkX, sparkY, 1.8);
    }
  }

  private showPage(page: VisionPage): void {
    this.currentPage = page;
    this.pages.forEach((container, id) => {
      container.setVisible(id === page);
    });

    this.tabs.forEach((tab) => {
      const active = tab.id === page;
      tab.background.setFillStyle(active ? 0x15314b : 0x0a1420, active ? 0.96 : 0.74);
      tab.background.setStrokeStyle(2, active ? 0x92d7ff : UI_THEME.borderSoft, active ? 0.9 : 0.64);
      tab.label.setColor(active ? "#f5fbff" : "#c9daef");
    });

    if (!this.pageTitle || !this.pageDescription) {
      return;
    }

    this.pageTitle.setText("UI Vision Sandbox");
    if (page === "main-menu") {
      this.pageDescription.setText("Main menu target: sacred ring, cleaner button language, and a calmer premium shell.");
      return;
    }

    if (page === "data-pad") {
      this.pageDescription.setText("Data Pad target: icon rail, mission list, detail pane, and a shared command-layer shell.");
      return;
    }

    this.pageDescription.setText("Inventory target: central character well, corrected slot logic, and a stronger cargo presentation.");
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      page: this.currentPage,
      pages: [...this.pages.keys()],
    };
  }
}
