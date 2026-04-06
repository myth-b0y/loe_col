import Phaser from "phaser";

import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { SettingsOverlay } from "../ui/SettingsOverlay";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

export class MainMenuScene extends Phaser.Scene {
  private brightnessLayer?: BrightnessLayer;
  private settingsOverlay?: SettingsOverlay;
  private loadButton?: MenuButton;
  private creditsPanel?: Phaser.GameObjects.Container;
  private creditsCloseButton?: MenuButton;

  constructor() {
    super("main-menu");
  }

  create(): void {
    this.drawBackdrop();
    this.brightnessLayer = createBrightnessLayer(this);

    this.add.text(160, 108, "Legends of EDEN", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#9fc6ff",
      fontStyle: "bold",
    });

    this.add.text(160, 144, "Champions of Light", {
      fontFamily: "Arial",
      fontSize: "58px",
      color: "#f6fbff",
      fontStyle: "bold",
    });

    this.add.text(164, 220, "Age of Legends tactical action RPG prototype", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d2e5ff",
    });

    this.add.text(162, 268, "Build the crew. Launch the mission. Clear the outpost. Return stronger.", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#b4cbed",
    });

    const buttons: MenuButton[] = [
      createMenuButton({
        scene: this,
        x: 286,
        y: 372,
        width: 250,
        label: "New Game",
        onClick: () => {
          gameSession.startNewGame();
          this.scene.start("hub");
        },
      }),
      createMenuButton({
        scene: this,
        x: 286,
        y: 432,
        width: 250,
        label: "Load Game",
        onClick: () => {
          if (!gameSession.loadSave()) {
            return;
          }

          this.scene.start("hub");
        },
      }),
      createMenuButton({
        scene: this,
        x: 286,
        y: 492,
        width: 250,
        label: "Options",
        onClick: () => this.settingsOverlay?.show("graphics"),
      }),
      createMenuButton({
        scene: this,
        x: 286,
        y: 552,
        width: 250,
        label: "Credits",
        onClick: () => this.showCredits(true),
      }),
    ];

    this.loadButton = buttons[1];
    this.loadButton.setEnabled(gameSession.hasSaveData());

    this.add.text(162, 628, "Current milestone: foundation + first mission slice", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#98aed1",
    });

    this.add.text(958, 662, "loe_col_v0.10", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8aa3c7",
    });

    this.settingsOverlay = new SettingsOverlay({
      scene: this,
      onClose: () => undefined,
    });

    this.creditsPanel = this.createCreditsPanel();
    this.bindKeyboard();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.brightnessLayer?.destroy();
    });
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x060a12).setDepth(-10);
    this.add.rectangle(950, 358, 520, 540, 0x0c1422, 0.94).setStrokeStyle(2, 0x31557f, 0.7).setDepth(-8);
    this.add.circle(1020, 202, 120, 0x3a79c5, 0.16).setDepth(-9);
    this.add.circle(1068, 214, 54, 0x8ed2ff, 0.18).setDepth(-9);

    const stars = this.add.graphics().setDepth(-9);
    stars.fillStyle(0xcfe2ff, 0.9);
    for (let i = 0; i < 70; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(16, 1264),
        Phaser.Math.Between(16, 704),
        Phaser.Math.FloatBetween(1, 2.4),
      );
    }

    const ship = this.add.graphics().setDepth(-7);
    ship.fillStyle(0x8ca9cf, 0.18);
    ship.fillRoundedRect(890, 282, 240, 118, 26);
    ship.fillTriangle(1118, 324, 1200, 342, 1118, 362);
    ship.fillRect(842, 320, 48, 34);
    ship.lineStyle(3, 0xaad5ff, 0.24);
    ship.strokeRoundedRect(890, 282, 240, 118, 26);
  }

  private createCreditsPanel(): Phaser.GameObjects.Container {
    const background = this.add
      .rectangle(640, 360, 620, 380, 0x08111c, 0.98)
      .setStrokeStyle(3, 0x79abed, 0.8)
      .setDepth(70);

    const title = this.add.text(374, 202, "Credits", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(71);

    const body = this.add.text(374, 256, [
      "Creative direction, world vision, and testing: Chase / myth-b0y",
      "",
      "Programming and prototype implementation: Codex",
      "",
      "Current focus: building a data-driven mission/combat foundation",
      "that can expand into dialogue, factions, story beats, bosses, and",
      "the broader EDEN world without hardcoding every new addition.",
    ], {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d6e7ff",
      lineSpacing: 8,
    }).setDepth(71);

    const close = createMenuButton({
      scene: this,
      x: 640,
      y: 510,
      width: 180,
      label: "Back",
      onClick: () => this.showCredits(false),
      depth: 71,
      accentColor: 0x203a57,
    });
    this.creditsCloseButton = close;

    const panel = this.add.container(0, 0, [
      background,
      title,
      body,
      close.container,
    ]).setDepth(70);

    panel.setVisible(false);
    close.setInputEnabled(false);
    return panel;
  }

  private bindKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    const startNewGame = (): void => {
      gameSession.startNewGame();
      this.scene.start("hub");
    };

    keyboard.on("keydown-ENTER", startNewGame);
    keyboard.on("keydown-SPACE", startNewGame);
    keyboard.on("keydown-N", startNewGame);
    keyboard.on("keydown-L", () => {
      if (!gameSession.loadSave()) {
        return;
      }

      this.scene.start("hub");
    });
    keyboard.on("keydown-O", () => this.settingsOverlay?.show("graphics"));
    keyboard.on("keydown-C", () => this.showCredits(true));
    keyboard.on("keydown-ESC", () => {
      if (this.creditsPanel?.visible) {
        this.showCredits(false);
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ENTER");
      keyboard.removeAllListeners("keydown-SPACE");
      keyboard.removeAllListeners("keydown-N");
      keyboard.removeAllListeners("keydown-L");
      keyboard.removeAllListeners("keydown-O");
      keyboard.removeAllListeners("keydown-C");
      keyboard.removeAllListeners("keydown-ESC");
    });
  }

  private showCredits(visible: boolean): void {
    this.creditsPanel?.setVisible(visible);
    this.creditsCloseButton?.setInputEnabled(visible);
  }
}
