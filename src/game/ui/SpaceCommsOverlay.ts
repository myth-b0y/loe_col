import Phaser from "phaser";

import { createMenuButton, type MenuButton } from "./buttons";

export type SpaceCommsOverlayState = {
  title: string;
  speaker: string;
  locationLabel: string;
  bodyText: string;
  options: string[];
  continueLabel: string;
};

type SpaceCommsOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  onContinue: () => void;
};

const PANEL_DEPTH = 74;

export class SpaceCommsOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly optionText: Phaser.GameObjects.Text;
  private readonly continueButton: MenuButton;
  private readonly leaveButton: MenuButton;
  private readonly onClose: () => void;
  private readonly onContinue: () => void;

  constructor({ scene, onClose, onContinue }: SpaceCommsOverlayOptions) {
    this.onClose = onClose;
    this.onContinue = onContinue;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.46)
      .setDepth(PANEL_DEPTH)
      .setScrollFactor(0)
      .setInteractive();
    this.backdrop.on("pointerdown", () => this.hide());

    const panel = scene.add.rectangle(640, 360, 560, 364, 0x08111b, 0.98)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(3, 0x3d647f, 0.88);
    const header = scene.add.rectangle(640, 232, 520, 58, 0x0c1a28, 0.98)
      .setScrollFactor(0)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, 0x35556f, 0.78);

    this.title = scene.add.text(392, 210, "Mission Comms", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.subtitle = scene.add.text(392, 244, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#a9d3f4",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.body = scene.add.text(392, 286, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#dceeff",
      lineSpacing: 6,
      wordWrap: { width: 496 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.optionText = scene.add.text(392, 404, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffdca3",
      lineSpacing: 5,
      wordWrap: { width: 496 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.continueButton = createMenuButton({
      scene,
      x: 570,
      y: 512,
      width: 178,
      height: 44,
      label: "Continue",
      onClick: () => this.onContinue(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x2f6686,
    });
    this.continueButton.container.setScrollFactor(0);

    this.leaveButton = createMenuButton({
      scene,
      x: 762,
      y: 512,
      width: 126,
      height: 44,
      label: "Leave",
      onClick: () => this.hide(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x2b4462,
    });
    this.leaveButton.container.setScrollFactor(0);

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      header,
      this.title,
      this.subtitle,
      this.body,
      this.optionText,
      this.continueButton.container,
      this.leaveButton.container,
    ]).setDepth(PANEL_DEPTH);
    this.root.setScrollFactor(0);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(state: SpaceCommsOverlayState): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.update(state);
  }

  update(state: SpaceCommsOverlayState): void {
    this.title.setText(state.title);
    this.subtitle.setText(`${state.speaker}  |  ${state.locationLabel}`);
    this.body.setText(state.bodyText);
    this.optionText.setText(state.options.map((option, index) => `${index + 1}. ${option}`).join("\n"));
    this.continueButton.setLabel(state.continueLabel);
  }

  hide(): void {
    if (!this.root.visible) {
      return;
    }

    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }
    this.continueButton.setInputEnabled(enabled);
    this.leaveButton.setInputEnabled(enabled);
  }
}
