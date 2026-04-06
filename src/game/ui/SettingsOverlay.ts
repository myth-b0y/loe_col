import Phaser from "phaser";

import { gameSession, type GraphicsQuality } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type SettingsTab = "graphics" | "audio" | "controls";

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
  private readonly rows: RowUi[];
  private currentTab: SettingsTab = "graphics";

  constructor({ scene, title = "Options", onClose }: SettingsOverlayOptions) {
    this.onClose = onClose;

    this.backdrop = scene.add
      .rectangle(640, 360, 1280, 720, 0x02060b, 0.74)
      .setInteractive()
      .setDepth(80);

    this.panel = scene.add
      .rectangle(640, 360, 760, 500, 0x091321, 0.98)
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

    const closeButton = createMenuButton({
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
    };

    this.rows = Array.from({ length: 4 }, (_, index) => {
      const y = 290 + index * 58;
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
      closeButton.container,
      this.tabButtons.graphics.container,
      this.tabButtons.audio.container,
      this.tabButtons.controls.container,
      ...this.rows.flatMap((row) => [row.label, row.valueButton.container]),
    ]).setDepth(80);

    this.root.setVisible(false);
  }

  show(initialTab: SettingsTab = this.currentTab): void {
    this.root.setVisible(true);
    this.setTab(initialTab);
  }

  hide(): void {
    this.root.setVisible(false);
    this.onClose();
  }

  private setTab(tab: SettingsTab): void {
    this.currentTab = tab;
    this.refresh();
  }

  private refresh(): void {
    const graphics = gameSession.settings.graphics;
    const audio = gameSession.settings.audio;

    const tabAccent = (tab: SettingsTab): void => {
      this.tabButtons.graphics.label.setColor(tab === "graphics" ? "#ffffff" : "#d5e6ff");
      this.tabButtons.audio.label.setColor(tab === "audio" ? "#ffffff" : "#d5e6ff");
      this.tabButtons.controls.label.setColor(tab === "controls" ? "#ffffff" : "#d5e6ff");
    };

    tabAccent(this.currentTab);

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

      this.info.setText([
        "Sound sliders are wired into saveable settings now, even though the slice is still light on real audio assets.",
        "That means we can drop in real music and SFX later without rebuilding the options framework.",
      ]);
      return;
    }

    this.setRow(0, "Move", gameSession.settings.controls.move, () => undefined, false);
    this.setRow(1, "Aim", gameSession.settings.controls.aim, () => undefined, false);
    this.setRow(2, "Fire", gameSession.settings.controls.fireMode, () => undefined, false);
    this.setRow(3, "Pause", gameSession.settings.controls.pause, () => undefined, false);

    this.info.setText([
      "This slice uses fixed, readable default controls so we can focus on gameplay first.",
      "Custom rebinding can come later once the combat loop and UI flow settle down.",
    ]);
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
    row.valueButton.setOnClick(() => {
      if (!enabled) {
        return;
      }

      onClick();
    });
  }
}
