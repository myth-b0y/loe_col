import Phaser from "phaser";

import { retroSfx } from "../audio/retroSfx";
import { GAME_BUILD, GAME_MILESTONE } from "../core/buildInfo";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { SaveSlotsOverlay } from "../ui/SaveSlotsOverlay";
import { SettingsOverlay } from "../ui/SettingsOverlay";
import { createBrightnessLayer, type BrightnessLayer } from "../ui/visualSettings";

const MAIN_MENU_LOGO_KEY = "main-menu-logo";
const MAIN_MENU_LOGO_URL = "assets/ui/main-menu-logo.png";
const MAIN_MENU_MUSIC_KEY = "main-menu-music";
const MAIN_MENU_MUSIC_URL = "assets/audio/main-menu-once-upon-a-myth-16bit.mp3";

type MenuMusicSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => Phaser.Sound.BaseSound;
  volume?: number;
  loop?: boolean;
};

export class MainMenuScene extends Phaser.Scene {
  private brightnessLayer?: BrightnessLayer;
  private settingsOverlay?: SettingsOverlay;
  private saveSlotsOverlay?: SaveSlotsOverlay;
  private loadButton?: MenuButton;
  private uiVisionButton?: MenuButton;
  private creditsPanel?: Phaser.GameObjects.Container;
  private creditsCloseButton?: MenuButton;
  private menuMusic?: MenuMusicSound;
  private menuMusicVolume = 0;
  private menuMusicStartQueued = false;

  constructor() {
    super("main-menu");
  }

  preload(): void {
    this.load.image(MAIN_MENU_LOGO_KEY, MAIN_MENU_LOGO_URL);
    this.load.audio(MAIN_MENU_MUSIC_KEY, [MAIN_MENU_MUSIC_URL]);
  }

  create(): void {
    this.drawBackdrop();
    this.brightnessLayer = createBrightnessLayer(this);

    const logo = this.add.image(640, 8, MAIN_MENU_LOGO_KEY).setOrigin(0.5, 0);
    logo.setDisplaySize(500, 500 * (logo.height / logo.width));

    const buttons: MenuButton[] = [
      createMenuButton({
        scene: this,
        x: 640,
        y: 372,
        width: 250,
        label: "New Game",
        onClick: () => this.saveSlotsOverlay?.show("new"),
      }),
      createMenuButton({
        scene: this,
        x: 640,
        y: 432,
        width: 250,
        label: "Load Game",
        onClick: () => this.saveSlotsOverlay?.show("load"),
      }),
      createMenuButton({
        scene: this,
        x: 640,
        y: 492,
        width: 250,
        label: "Options",
        onClick: () => this.settingsOverlay?.show("graphics"),
      }),
      createMenuButton({
        scene: this,
        x: 640,
        y: 552,
        width: 250,
        label: "Credits",
        onClick: () => this.showCredits(true),
      }),
      createMenuButton({
        scene: this,
        x: 640,
        y: 612,
        width: 250,
        label: "UI Vision",
        onClick: () => this.scene.start("ui-vision"),
      }),
    ];

    this.loadButton = buttons[1];
    this.uiVisionButton = buttons[4];
    this.loadButton.setEnabled(gameSession.hasSaveData());

    this.add.text(162, 662, `Current milestone: ${GAME_MILESTONE}`, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#98aed1",
    });

    this.add.text(930, 662, GAME_BUILD, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8aa3c7",
    });

    this.settingsOverlay = new SettingsOverlay({
      scene: this,
      onClose: () => undefined,
    });

    this.saveSlotsOverlay = new SaveSlotsOverlay({
      scene: this,
      onClose: () => undefined,
      onLoadSlot: (slotIndex, kind) => {
        if (!gameSession.loadSave(slotIndex, kind)) {
          return;
        }

        this.scene.start("hub");
      },
      onNewSlot: (slotIndex) => {
        gameSession.startNewGame(slotIndex);
        gameSession.saveToDisk(slotIndex);
        this.scene.start("hub");
      },
    });

    this.creditsPanel = this.createCreditsPanel();
    this.bindKeyboard();
    this.startMenuMusic();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stopMenuMusic();
      this.brightnessLayer?.destroy();
    });
  }

  update(): void {
    this.updateMenuMusicVolume();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 360, 1280, 720, 0x060a12).setDepth(-10);

    const stars = this.add.graphics().setDepth(-9);
    stars.fillStyle(0xcfe2ff, 0.9);
    for (let i = 0; i < 70; i += 1) {
      stars.fillCircle(
        Phaser.Math.Between(16, 1264),
        Phaser.Math.Between(16, 704),
        Phaser.Math.FloatBetween(1, 2.4),
      );
    }
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
      this.saveSlotsOverlay?.show("new");
    };

    keyboard.on("keydown-ENTER", startNewGame);
    keyboard.on("keydown-SPACE", startNewGame);
    keyboard.on("keydown-N", startNewGame);
    keyboard.on("keydown-L", () => this.saveSlotsOverlay?.show("load"));
    keyboard.on("keydown-O", () => this.settingsOverlay?.show("graphics"));
    keyboard.on("keydown-C", () => this.showCredits(true));
    keyboard.on("keydown-V", () => this.scene.start("ui-vision"));
    keyboard.on("keydown-ESC", () => {
      if (this.creditsPanel?.visible) {
        this.showCredits(false);
        return;
      }

      this.saveSlotsOverlay?.hide();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.removeAllListeners("keydown-ENTER");
      keyboard.removeAllListeners("keydown-SPACE");
      keyboard.removeAllListeners("keydown-N");
      keyboard.removeAllListeners("keydown-L");
      keyboard.removeAllListeners("keydown-O");
      keyboard.removeAllListeners("keydown-C");
      keyboard.removeAllListeners("keydown-V");
      keyboard.removeAllListeners("keydown-ESC");
    });
  }

  private showCredits(visible: boolean): void {
    retroSfx.play(visible ? "ui-window-open" : "ui-window-close", { volume: visible ? 0.48 : 0.4 });
    this.creditsPanel?.setVisible(visible);
    this.creditsCloseButton?.setInputEnabled(visible);
  }

  private startMenuMusic(): void {
    this.menuMusic = this.sound.add(MAIN_MENU_MUSIC_KEY, {
      loop: true,
      volume: this.getMenuMusicVolume(),
    }) as MenuMusicSound;

    this.updateMenuMusicVolume();
    this.tryPlayMenuMusic();
  }

  private stopMenuMusic(): void {
    if (!this.menuMusic) {
      return;
    }

    this.menuMusic.stop();
    this.menuMusic.destroy();
    this.menuMusic = undefined;
    this.menuMusicStartQueued = false;
  }

  private tryPlayMenuMusic(): void {
    if (!this.menuMusic || this.menuMusic.isPlaying) {
      return;
    }

    const started = this.menuMusic.play({ loop: true, volume: this.menuMusicVolume });
    if (!started) {
      this.queueMenuMusicStart();
    }
  }

  private queueMenuMusicStart(): void {
    if (this.menuMusicStartQueued) {
      return;
    }

    this.menuMusicStartQueued = true;
    const retry = (): void => {
      this.menuMusicStartQueued = false;
      this.tryPlayMenuMusic();
    };

    this.input.once(Phaser.Input.Events.POINTER_DOWN, retry);
    this.input.keyboard?.once("keydown", retry);
  }

  private updateMenuMusicVolume(): void {
    const nextVolume = this.getMenuMusicVolume();
    if (Math.abs(nextVolume - this.menuMusicVolume) < 0.005) {
      return;
    }

    this.menuMusicVolume = nextVolume;
    this.menuMusic?.setVolume?.(nextVolume);
    if (this.menuMusic && typeof this.menuMusic.setVolume !== "function") {
      this.menuMusic.volume = nextVolume;
    }
  }

  private getMenuMusicVolume(): number {
    const { master, music } = gameSession.settings.audio;
    return Phaser.Math.Clamp((master / 100) * (music / 100), 0, 1);
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      version: GAME_BUILD,
      milestone: GAME_MILESTONE,
      run: gameSession.getRunConfig(),
      hasSaves: gameSession.hasSaveData(),
      creditsVisible: this.creditsPanel?.visible ?? false,
      uiVisionReady: Boolean(this.uiVisionButton),
      menuMusic: {
        key: MAIN_MENU_MUSIC_KEY,
        playing: this.menuMusic?.isPlaying ?? false,
        paused: this.menuMusic?.isPaused ?? false,
        loop: this.menuMusic?.loop ?? true,
        volume: this.menuMusicVolume,
      },
    };
  }
}
