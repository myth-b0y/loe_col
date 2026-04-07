import Phaser from "phaser";

import { createBodyText, createDivider, createEmberAccent, createEmptyCharacterWell, createGlowLine, createMockButton, createSlotFrame, createTitle, createUiPanel, drawCosmicBackdrop, UI_FONT_FAMILY, UI_THEME } from "../ui/theme";

type VisionPage = "main-menu" | "data-pad" | "inventory";

type PageTab = {
  id: VisionPage;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
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
    drawCosmicBackdrop(this, { count: 140, seed: 28 });

    createUiPanel({
      scene: this,
      x: 640,
      y: 82,
      width: 1170,
      height: 116,
      fillColor: 0x06101a,
      fillAlpha: 0.88,
      borderAlpha: 0.52,
      depth: 5,
    });

    this.pageTitle = createTitle(this, 92, 50, "UI Vision Mockups", 36).setDepth(6);
    this.pageDescription = createBodyText(
      this,
      94,
      96,
      "A style-preview pass for the future UI kit. These are direction boards, not live replacements yet.",
      940,
      UI_THEME.textSoft,
      16,
    ).setDepth(6);

    const backButton = createMockButton(this, 1128, 82, 180, "Back To Menu");
    backButton.setDepth(6);
    const backHit = this.add.rectangle(0, 0, 180, 46, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    backHit.on("pointerdown", () => this.scene.start("main-menu"));
    backButton.add(backHit);

    const tabLabels: Array<{ id: VisionPage; label: string }> = [
      { id: "main-menu", label: "Main Menu" },
      { id: "data-pad", label: "Data Pad" },
      { id: "inventory", label: "Inventory" },
    ];

    tabLabels.forEach((tab, index) => {
      const x = 128 + index * 198;
      const background = this.add.rectangle(0, 0, 174, 42, 0x0b1622, 0.72)
        .setStrokeStyle(2, UI_THEME.borderSoft, 0.66);
      const label = this.add.text(0, 0, tab.label, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "20px",
        color: UI_THEME.textSoft,
        fontStyle: "bold",
      }).setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, 174, 42, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const container = this.add.container(x, 150, [background, label, hit]).setDepth(6);
      hit.on("pointerdown", () => this.showPage(tab.id));
      this.tabs.push({ id: tab.id, container, background, label });
    });

    this.buildMainMenuPage();
    this.buildDataPadPage();
    this.buildInventoryPage();
    this.bindKeyboard();
    this.showPage("main-menu");
  }

  update(_: number, delta: number): void {
    this.ringTime += delta * 0.0012;
    if (this.currentPage === "main-menu" && this.ringGraphics) {
      this.drawAnimatedRing(this.ringGraphics, 958, 382, 148, this.ringTime);
    }
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
    const heroFrame = createUiPanel({
      scene: this,
      x: 944,
      y: 424,
      width: 472,
      height: 518,
      fillColor: 0x07111c,
      fillAlpha: 0.5,
      borderAlpha: 0.38,
      depth: 4,
    });
    const lensGlow = this.add.circle(955, 410, 180, 0x5eb7ff, 0.08).setDepth(4);
    const titlePrefix = this.add.text(114, 214, "Legends of EDEN", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "30px",
      color: "#8cb5ef",
      fontStyle: "bold",
    }).setDepth(5);
    const title = this.add.text(112, 252, "Circle of Light", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "62px",
      color: UI_THEME.text,
      fontStyle: "bold",
    }).setDepth(5);
    const flare = createGlowLine({
      scene: this,
      x: 286,
      y: 338,
      width: 350,
      color: 0x67b3ff,
      alpha: 0.92,
      depth: 5,
    });
    const tagline = createBodyText(
      this,
      116,
      372,
      ["Build the crew.", "Launch the mission.", "Return stronger."],
      280,
      "#d3e5ff",
      18,
    ).setDepth(5);

    const buttonLabels = ["Begin Journey", "Continue", "Settings", "Archive"];
    buttonLabels.forEach((label, index) => {
      const button = createMockButton(this, 238, 510 + index * 60, 254, label);
      button.setDepth(5);
      container.add(button);
    });

    this.ringGraphics = this.add.graphics().setDepth(5);
    const ringBox = this.add.rectangle(944, 424, 440, 488)
      .setStrokeStyle(2, 0x5683b8, 0.26)
      .setDepth(5);
    const heroCaption = createBodyText(
      this,
      752,
      612,
      "Animated ember-circle motif with pixel shimmer and slow rainbow travel. The rest of the menu stays restrained so the ring feels sacred.",
      384,
      UI_THEME.textDim,
      15,
    ).setDepth(5);

    container.add([
      heroFrame,
      lensGlow,
      titlePrefix,
      title,
      flare,
      tagline,
      this.ringGraphics,
      ringBox,
      heroCaption,
    ]);

    this.pages.set("main-menu", container);
  }

  private buildDataPadPage(): void {
    const container = this.add.container(0, 18).setDepth(4);
    const panel = createUiPanel({
      scene: this,
      x: 640,
      y: 426,
      width: 1120,
      height: 530,
      fillColor: 0x07111b,
      fillAlpha: 0.96,
      depth: 4,
    });
    const leftRail = createUiPanel({
      scene: this,
      x: 126,
      y: 426,
      width: 88,
      height: 474,
      fillColor: 0x081521,
      fillAlpha: 0.98,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.8,
      depth: 5,
    });
    const listRail = createUiPanel({
      scene: this,
      x: 374,
      y: 408,
      width: 310,
      height: 404,
      fillColor: 0x091622,
      fillAlpha: 0.98,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.74,
      depth: 5,
    });
    const detailRail = createUiPanel({
      scene: this,
      x: 816,
      y: 408,
      width: 564,
      height: 404,
      fillColor: 0x0a1521,
      fillAlpha: 0.98,
      borderColor: UI_THEME.borderSoft,
      borderAlpha: 0.74,
      depth: 5,
    });

    const title = createTitle(this, 106, 188, "DATA PAD", 30).setDepth(6);
    const glow = createGlowLine({
      scene: this,
      x: 628,
      y: 222,
      width: 860,
      color: 0x74d9ff,
      alpha: 0.88,
      depth: 6,
    });
    const section = createBodyText(this, 226, 260, "MISSIONS", 160, "#f1f7ff", 18).setDepth(6);
    const listHeader = createBodyText(this, 226, 286, "ACTIVE", 160, UI_THEME.textDim, 14).setDepth(6);

    container.add([
      panel,
      leftRail,
      listRail,
      detailRail,
      title,
      glow,
      section,
      listHeader,
    ]);

    const icons = [
      { y: 278, label: "MISSIONS", active: true },
      { y: 360, label: "CREW", active: false },
      { y: 442, label: "SYSTEM", active: false },
    ];
    icons.forEach(({ y, label, active }) => {
      const button = this.add.rectangle(126, y, 56, 64, active ? 0x10263b : 0x0a1320, active ? 0.96 : 0.72)
        .setStrokeStyle(2, active ? 0xffc874 : UI_THEME.borderSoft, active ? 0.84 : 0.52)
        .setDepth(6);
      const glyph = this.add.text(126, y - 6, active ? "◒" : "◻", {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "22px",
        color: active ? "#ffd37a" : "#88a8cc",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(7);
      const text = this.add.text(126, y + 20, label, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "11px",
        color: active ? "#ffd37a" : UI_THEME.textDim,
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(7);
      container.add([button, glyph, text]);
    });

    const missions = [
      { y: 324, title: "Distress Signal Investigation", active: true },
      { y: 382, title: "Supply Run to Outpost Delta", active: false },
      { y: 440, title: "Rescue the Scientists", active: false },
      { y: 518, title: "ANTHIC Vice", active: false, dim: true },
      { y: 556, title: "The Drifter", active: false, dim: true },
    ];
    missions.forEach((mission) => {
      if (mission.dim) {
        const item = createBodyText(this, 236, mission.y, `› ${mission.title}`, 240, UI_THEME.textDim, 16).setDepth(6);
        container.add(item);
        return;
      }

      const frame = this.add.rectangle(372, mission.y, 262, 46, mission.active ? 0x12273b : 0x0c1622, 0.94)
        .setStrokeStyle(2, mission.active ? 0xffd37c : UI_THEME.borderSoft, mission.active ? 0.78 : 0.56)
        .setDepth(6);
      const titleText = this.add.text(248, mission.y - 8, mission.title, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "17px",
        color: mission.active ? "#f6fbff" : "#b2cae6",
      }).setDepth(7);
      const marker = this.add.text(220, mission.y - 8, mission.active ? "➤" : "›", {
        fontFamily: UI_FONT_FAMILY,
        fontSize: "18px",
        color: mission.active ? "#ffd37a" : "#82a4c7",
        fontStyle: "bold",
      }).setDepth(7);
      container.add([frame, marker, titleText]);
    });

    const detailTitle = createBodyText(this, 560, 280, "Distress Signal Investigation", 360, UI_THEME.text, 30)
      .setDepth(6);
    const icon = this.add.text(678, 360, "⌁", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "54px",
      color: "#ffd37a",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(6);
    const summaryTitle = createBodyText(this, 606, 392, "MISSION SUMMARY", 220, UI_THEME.textDim, 14).setDepth(6);
    const summary = createBodyText(
      this,
      560,
      424,
      "Investigate the distress signal coming from a derelict ship on the edge of the sector. Find out what happened to the crew and salvage any useful materials.",
      424,
      UI_THEME.textSoft,
      16,
    ).setDepth(6);
    const taskTitle = createBodyText(this, 560, 530, "CURRENT TASK", 220, UI_THEME.textDim, 14).setDepth(6);
    const task = createBodyText(this, 560, 560, "Board the derelict ship and investigate the distress signal.", 424, UI_THEME.textSoft, 18)
      .setDepth(6);
    const activeButton = createMockButton(this, 774, 606, 248, "Set Route");
    activeButton.setDepth(6);
    const backButton = createMockButton(this, 774, 660, 248, "Back", 0x17283d);
    backButton.setDepth(6);

    container.add([detailTitle, icon, summaryTitle, summary, taskTitle, task, activeButton, backButton]);

    this.pages.set("data-pad", container);
  }

  private buildInventoryPage(): void {
    const container = this.add.container(0, 18).setDepth(4);
    const panel = createUiPanel({
      scene: this,
      x: 640,
      y: 430,
      width: 1120,
      height: 568,
      fillColor: 0x07111b,
      fillAlpha: 0.96,
      depth: 4,
    });

    const title = createTitle(this, 96, 176, "INVENTORY", 30).setDepth(6);
    const glow = createGlowLine({
      scene: this,
      x: 628,
      y: 212,
      width: 860,
      color: 0x74d9ff,
      alpha: 0.88,
      depth: 6,
    });

    const emberColor = createEmberAccent("blue");
    const previewWell = createEmptyCharacterWell(this, 634, 362, 368, 308, emberColor, "AARUIAN CHARACTER WELL");
    previewWell.setDepth(6);

    container.add([panel, title, glow, previewWell]);

    const gearSlots: Array<{ x: number; y: number; label: string }> = [
      { x: 132, y: 288, label: "HEAD" },
      { x: 132, y: 348, label: "CHEST" },
      { x: 132, y: 408, label: "LEGS" },
      { x: 132, y: 468, label: "BELT" },
      { x: 132, y: 528, label: "WEAPON LEFT" },
      { x: 252, y: 528, label: "WEAPON RIGHT" },
      { x: 252, y: 408, label: "BACK" },
      { x: 252, y: 468, label: "GLOVES" },
    ];
    gearSlots.forEach((slot) => {
      const frame = createSlotFrame(this, slot.x, slot.y, 104, 50, slot.label);
      frame.setDepth(6);
      container.add(frame);
    });

    const accessoryY = 502;
    [538, 634, 730].forEach((x) => {
      const accessory = createSlotFrame(this, x, accessoryY, 82, 44, "ACCESSORY");
      accessory.setDepth(6);
      container.add(accessory);
    });

    const cargoTitle = createBodyText(this, 96, 548, "CARGO", 140, UI_THEME.text, 24).setDepth(6);
    const cargoDivider = createDivider({
      scene: this,
      x: 640,
      y: 584,
      width: 920,
      color: UI_THEME.borderSoft,
      alpha: 0.68,
      depth: 6,
    });

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const cell = this.add.rectangle(202 + column * 90, 612 + row * 48, 74, 40, 0x08131d, 0.92)
          .setStrokeStyle(2, UI_THEME.borderSoft, 0.62)
          .setDepth(6);
        container.add(cell);
      }
    }

    const itemCell = this.add.rectangle(832, 612, 74, 40, 0x0d1e2b, 0.96)
      .setStrokeStyle(2, 0x7cd0ff, 0.82)
      .setDepth(7);
    const itemGlyph = this.add.text(832, 654, "▭", {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "22px",
      color: "#9dc7ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(8);
    const currency = createBodyText(this, 892, 676, "1,250        47", 190, UI_THEME.textSoft, 18).setDepth(6);
    const controls = createBodyText(this, 454, 548, "E  EQUIP      R  DROP      ESC  BACK", 360, UI_THEME.textDim, 15).setDepth(6);

    container.add([cargoTitle, cargoDivider, itemCell, itemGlyph, currency, controls]);

    this.pages.set("inventory", container);
  }

  private drawAnimatedRing(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, time: number): void {
    graphics.clear();

    graphics.lineStyle(3, 0xffffff, 0.1);
    graphics.strokeCircle(x, y, radius + 16);

    const segments = 72;
    for (let index = 0; index < segments; index += 1) {
      const progress = index / segments;
      const hue = Phaser.Math.Wrap(progress + time * 0.08, 0, 1);
      const color = Phaser.Display.Color.HSVToRGB(hue, 0.72, 1) as { r: number; g: number; b: number };
      const start = Phaser.Math.DegToRad(progress * 360);
      const end = Phaser.Math.DegToRad((index + 1) / segments * 360);
      graphics.lineStyle(5, Phaser.Display.Color.GetColor(color.r, color.g, color.b), 0.92);
      graphics.beginPath();
      graphics.arc(x, y, radius, start, end);
      graphics.strokePath();
    }

    for (let index = 0; index < 18; index += 1) {
      const angle = time * 3 + index * 0.35;
      const sparkX = x + Math.cos(angle) * (radius + Phaser.Math.Between(8, 18));
      const sparkY = y + Math.sin(angle * 1.03) * (radius + Phaser.Math.Between(8, 18));
      graphics.fillStyle(0xffffff, 0.18);
      graphics.fillCircle(sparkX, sparkY, Phaser.Math.FloatBetween(1.4, 2.6));
    }
  }

  private showPage(page: VisionPage): void {
    this.currentPage = page;
    this.pages.forEach((container, containerPage) => {
      container.setVisible(containerPage === page);
    });

    this.tabs.forEach((tab) => {
      const active = tab.id === page;
      tab.background.setFillStyle(active ? 0x12314b : 0x0b1622, active ? 0.94 : 0.72);
      tab.background.setStrokeStyle(2, active ? 0x8fd5ff : UI_THEME.borderSoft, active ? 0.88 : 0.66);
      tab.label.setColor(active ? "#f6fbff" : UI_THEME.textSoft);
    });

    if (this.pageTitle && this.pageDescription) {
      if (page === "main-menu") {
        this.pageTitle.setText("UI Vision Mockups");
        this.pageDescription.setText("Main menu direction: sacred ember ring, restrained controls, and a premium cosmic shell.");
      } else if (page === "data-pad") {
        this.pageTitle.setText("UI Vision Mockups");
        this.pageDescription.setText("Data Pad direction: icon rail, clean list/detail split, and a shared command-layer shell.");
      } else {
        this.pageTitle.setText("UI Vision Mockups");
        this.pageDescription.setText("Inventory direction: central character well, clear gear sockets, and a cleaner cargo board.");
      }
    }
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      page: this.currentPage,
      pages: [...this.pages.keys()],
    };
  }
}
