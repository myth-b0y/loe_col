import Phaser from "phaser";

import {
  DIFFICULTY_OPTIONS,
  INPUT_MODE_OPTIONS,
  gameSession,
  type ControlSensitivity,
  type GameplayDifficulty,
  type GraphicsQuality,
  type InputModePreference,
} from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type SettingsTab = "graphics" | "audio" | "controls" | "gameplay";
type ControlSubTab = "keyboard" | "touch";

type SettingsOverlayOptions = {
  scene: Phaser.Scene;
  title?: string;
  onClose: () => void;
};

type RowUi = {
  label: Phaser.GameObjects.Text;
  valueButton: MenuButton;
};

const QUALITY_OPTIONS: GraphicsQuality[] = ["High", "Balanced", "Performance"];
const BRIGHTNESS_OPTIONS: Array<90 | 100 | 110> = [90, 100, 110];
const AUDIO_OPTIONS: Array<100 | 80 | 60 | 40 | 20 | 0> = [100, 80, 60, 40, 20, 0];
const INPUT_OPTIONS: InputModePreference[] = INPUT_MODE_OPTIONS;
const GAMEPLAY_OPTIONS: GameplayDifficulty[] = DIFFICULTY_OPTIONS;
const SENSITIVITY_OPTIONS: ControlSensitivity[] = [60, 80, 100, 120, 140];

function cycleValue<T>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  const nextIndex = index >= 0 ? (index + 1) % values.length : 0;
  return values[nextIndex];
}

export class SettingsOverlay {
  private readonly onClose: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly info: Phaser.GameObjects.Text;
  private readonly tabButtons: Record<SettingsTab, MenuButton>;
  private readonly controlTabButtons: Record<ControlSubTab, MenuButton>;
  private readonly rows: RowUi[];
  private readonly closeButton: MenuButton;
  private currentTab: SettingsTab = "graphics";
  private currentControlTab: ControlSubTab = "touch";

  constructor({ scene, title = "Options", onClose }: SettingsOverlayOptions) {
    this.onClose = onClose;

    this.backdrop = scene.add
      .rectangle(640, 360, 1280, 720, 0x02060b, 0.74)
      .setInteractive()
      .setDepth(80);

    this.panel = scene.add
      .rectangle(640, 360, 760, 540, 0x091321, 0.98)
      .setStrokeStyle(3, 0x79abed, 0.85)
      .setDepth(81);

    this.title = scene.add.text(270, 146, title, {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(82);

    this.info = scene.add.text(270, 468, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d2e4ff",
      lineSpacing: 6,
      wordWrap: { width: 700 },
    }).setDepth(82);
    this.info.setPosition(270, 538);

    this.closeButton = createMenuButton({
      scene,
      x: 948,
      y: 156,
      width: 100,
      height: 38,
      label: "Close",
      onClick: () => this.hide(),
      depth: 82,
      accentColor: 0x283d59,
    });

    this.tabButtons = {
      graphics: createMenuButton({
        scene,
        x: 360,
        y: 216,
        width: 150,
        label: "Graphics",
        onClick: () => this.setTab("graphics"),
        depth: 82,
      }),
      audio: createMenuButton({
        scene,
        x: 532,
        y: 216,
        width: 150,
        label: "Sound",
        onClick: () => this.setTab("audio"),
        depth: 82,
      }),
      controls: createMenuButton({
        scene,
        x: 704,
        y: 216,
        width: 150,
        label: "Controls",
        onClick: () => this.setTab("controls"),
        depth: 82,
      }),
      gameplay: createMenuButton({
        scene,
        x: 876,
        y: 216,
        width: 150,
        label: "Gameplay",
        onClick: () => this.setTab("gameplay"),
        depth: 82,
      }),
    };

    this.controlTabButtons = {
      keyboard: createMenuButton({
        scene,
        x: 456,
        y: 278,
        width: 170,
        height: 40,
        label: "Keyboard / Mouse",
        onClick: () => this.setControlTab("keyboard"),
        depth: 82,
        accentColor: 0x214569,
      }),
      touch: createMenuButton({
        scene,
        x: 642,
        y: 278,
        width: 126,
        height: 40,
        label: "Touch",
        onClick: () => this.setControlTab("touch"),
        depth: 82,
        accentColor: 0x214569,
      }),
    };

    this.rows = Array.from({ length: 5 }, (_, index) => {
      const y = 314 + index * 48;
      const label = scene.add.text(298, y, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#eef5ff",
      }).setDepth(82);

      const valueButton = createMenuButton({
        scene,
        x: 810,
        y: y + 12,
        width: 210,
        label: "",
        onClick: () => undefined,
        depth: 82,
        accentColor: 0x14375d,
      });

      return { label, valueButton };
    });

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      this.panel,
      this.title,
      this.info,
      this.closeButton.container,
      this.tabButtons.graphics.container,
      this.tabButtons.audio.container,
      this.tabButtons.controls.container,
      this.tabButtons.gameplay.container,
      this.controlTabButtons.keyboard.container,
      this.controlTabButtons.touch.container,
      ...this.rows.flatMap((row) => [row.label, row.valueButton.container]),
    ]).setDepth(80);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(initialTab: SettingsTab = this.currentTab): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.setTab(initialTab);
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.onClose();
  }

  private setTab(tab: SettingsTab): void {
    this.currentTab = tab;
    this.refresh();
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.closeButton.setInputEnabled(enabled);
    this.tabButtons.graphics.setInputEnabled(enabled);
    this.tabButtons.audio.setInputEnabled(enabled);
    this.tabButtons.controls.setInputEnabled(enabled);
    this.tabButtons.gameplay.setInputEnabled(enabled);
    this.controlTabButtons.keyboard.setInputEnabled(enabled && this.currentTab === "controls");
    this.controlTabButtons.touch.setInputEnabled(enabled && this.currentTab === "controls");
    this.rows.forEach((row) => row.valueButton.setInputEnabled(enabled));
  }

  private setControlTab(tab: ControlSubTab): void {
    this.currentControlTab = tab;
    this.refresh();
  }

  private refresh(): void {
    const graphics = gameSession.settings.graphics;
    const audio = gameSession.settings.audio;
    const controls = gameSession.settings.controls;
    const gameplay = gameSession.settings.gameplay;

    const tabAccent = (tab: SettingsTab): void => {
      this.tabButtons.graphics.label.setColor(tab === "graphics" ? "#ffffff" : "#d5e6ff");
      this.tabButtons.audio.label.setColor(tab === "audio" ? "#ffffff" : "#d5e6ff");
      this.tabButtons.controls.label.setColor(tab === "controls" ? "#ffffff" : "#d5e6ff");
      this.tabButtons.gameplay.label.setColor(tab === "gameplay" ? "#ffffff" : "#d5e6ff");
    };

    tabAccent(this.currentTab);
    const controlsVisible = this.currentTab === "controls";
    this.controlTabButtons.keyboard.container.setVisible(controlsVisible);
    this.controlTabButtons.touch.container.setVisible(controlsVisible);
    this.controlTabButtons.keyboard.setInputEnabled(this.root.visible && controlsVisible);
    this.controlTabButtons.touch.setInputEnabled(this.root.visible && controlsVisible);
    this.controlTabButtons.keyboard.label.setColor(
      controlsVisible && this.currentControlTab === "keyboard" ? "#ffffff" : "#d5e6ff",
    );
    this.controlTabButtons.touch.label.setColor(
      controlsVisible && this.currentControlTab === "touch" ? "#ffffff" : "#d5e6ff",
    );

    if (this.currentTab === "graphics") {
      this.setRow(0, "Render Quality", graphics.quality, () => {
        gameSession.setGraphicsQuality(cycleValue(QUALITY_OPTIONS, graphics.quality));
        this.refresh();
      }, true);
      this.setRow(1, "Brightness", `${graphics.brightness}%`, () => {
        gameSession.setBrightness(cycleValue(BRIGHTNESS_OPTIONS, graphics.brightness));
        this.refresh();
      }, true);
      this.setRow(2, "Screen Shake", graphics.screenShake ? "On" : "Off", () => {
        gameSession.setScreenShake(!graphics.screenShake);
        this.refresh();
      }, true);
      this.setRow(3, "Hit Flash", graphics.hitFlash ? "On" : "Off", () => {
        gameSession.setHitFlash(!graphics.hitFlash);
        this.refresh();
      }, true);
      this.setRow(4, "", "", () => undefined, false);

      this.info.setText([
        "Browser testing stays responsive to your screen, so this menu focuses on visual quality, brightness, and feedback intensity.",
        "Desktop resolution choices will matter more once we package the downloadable build.",
      ]);
      return;
    }

    if (this.currentTab === "audio") {
      this.setRow(0, "Master Volume", `${audio.master}%`, () => {
        gameSession.setAudioValue("master", cycleValue(AUDIO_OPTIONS, audio.master));
        this.refresh();
      }, true);
      this.setRow(1, "Music Volume", `${audio.music}%`, () => {
        gameSession.setAudioValue("music", cycleValue(AUDIO_OPTIONS, audio.music));
        this.refresh();
      }, true);
      this.setRow(2, "SFX Volume", `${audio.sfx}%`, () => {
        gameSession.setAudioValue("sfx", cycleValue(AUDIO_OPTIONS, audio.sfx));
        this.refresh();
      }, true);
      this.setRow(3, "Mix Profile", "Combat Focus", () => undefined, false);
      this.setRow(4, "", "", () => undefined, false);

      this.info.setText([
        "Sound sliders are wired into saveable settings now, even though the slice is still light on real audio assets.",
        "That means we can drop in real music and SFX later without rebuilding the options framework.",
      ]);
      return;
    }

    if (this.currentTab === "controls") {
      if (this.currentControlTab === "keyboard") {
        this.setRow(0, "Input Mode", controls.inputMode, () => {
          gameSession.setInputMode(cycleValue(INPUT_OPTIONS, controls.inputMode));
          this.refresh();
        }, true);
        this.setRow(1, "Auto Aim", controls.autoAim ? "On" : "Off", () => {
          gameSession.setAutoAim(!controls.autoAim);
          this.refresh();
        }, true);
        this.setRow(2, "Auto Fire", controls.autoFire ? "On" : "Off", () => {
          gameSession.setAutoFire(!controls.autoFire);
          this.refresh();
        }, true);
        this.setRow(3, "Mouse Sensitivity", `${controls.mouseSensitivity}%`, () => undefined, false);
        this.setRow(4, "Combat Keys", "Q Pulse | E Arc | Tab Target", () => undefined, false);

        this.info.setText([
          "Keyboard / mouse now separates lock-on from auto-fire so you can choose assisted aiming without forcing automatic shots.",
          "Mouse sensitivity is still scaffolded for a later tuning pass, while Tab target cycling is now part of the shared combat foundation.",
        ]);
        return;
      }

      this.setRow(0, "Input Mode", controls.inputMode, () => {
        gameSession.setInputMode(cycleValue(INPUT_OPTIONS, controls.inputMode));
        this.refresh();
      }, true);
      this.setRow(1, "Touch Sensitivity", `${controls.touchSensitivity}%`, () => {
        gameSession.setTouchSensitivity(cycleValue(SENSITIVITY_OPTIONS, controls.touchSensitivity));
        this.refresh();
      }, true);
      this.setRow(2, "Auto Aim", controls.autoAim ? "On" : "Off", () => {
        gameSession.setAutoAim(!controls.autoAim);
        this.refresh();
      }, true);
      this.setRow(3, "Auto Fire", controls.autoFire ? "On" : "Off", () => {
        gameSession.setAutoFire(!controls.autoFire);
        this.refresh();
      }, true);
      this.setRow(4, "Combat Layout", "Stick + Attack + Target", () => undefined, false);

      this.info.setText([
        "Touch can now mix manual attack, target cycling, auto aim, and auto fire without forcing all of them on together.",
        "Touch sensitivity changes how quickly the floating stick reaches full strength while keeping the same combat layout.",
      ]);
      return;
    }

    this.setRow(0, "Difficulty", gameplay.difficulty, () => {
      gameSession.setDifficulty(cycleValue(GAMEPLAY_OPTIONS, gameplay.difficulty));
      this.refresh();
    }, true);
    this.setRow(1, "Current Preset", this.describeDifficulty(gameplay.difficulty), () => undefined, false);
    this.setRow(2, "Pause / Save", controls.pause, () => undefined, false);
    this.setRow(3, "Mission Saves", "Disabled", () => undefined, false);
    this.setRow(4, "Story Hooks", "Data-Driven", () => undefined, false);

    this.info.setText([
      "Difficulty now adjusts enemy health, damage, speed, and attack cadence instead of living as hardcoded scene values.",
      "That keeps combat tuning plug-and-play while we keep layering in missions, dialogue, and story logic.",
    ]);
  }

  private describeDifficulty(value: GameplayDifficulty): string {
    if (value === "Novice") {
      return "Easier enemy pressure";
    }

    if (value === "Knight") {
      return "Default balanced slice";
    }

    if (value === "Legend") {
      return "Original combat pressure";
    }

    return "High enemy pressure";
  }

  private setRow(
    index: number,
    label: string,
    value: string,
    onClick: () => void,
    enabled: boolean,
  ): void {
    const row = this.rows[index];
    row.label.setText(label);
    row.valueButton.setLabel(value);
    row.valueButton.setEnabled(enabled);
    row.label.setAlpha(label ? 1 : 0);
    row.valueButton.container.setAlpha(label ? 1 : 0);
    row.valueButton.setOnClick(() => {
      if (!enabled) {
        return;
      }

      onClick();
    });
  }
}
