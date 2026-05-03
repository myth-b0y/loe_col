import Phaser from "phaser";

import { createMenuButton, type MenuButton } from "./buttons";

export type SpaceStationOverlayState = {
  mode?: "station" | "prime-world";
  stationName: string;
  sectorLabel: string;
  credits: number;
  repairCost: number;
  hasDamage: boolean;
  canAffordRepair: boolean;
  repairSummary: string;
  statusText: string;
  missionActionLabel?: string;
  missionActionEnabled?: boolean;
  missionActionSummary?: string;
};

type SpaceStationOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  onRepair: () => void;
  onMissionAction?: () => void;
};

const PANEL_DEPTH = 72;

export class SpaceStationOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly summaryText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly buyButton: MenuButton;
  private readonly sellButton: MenuButton;
  private readonly repairButton: MenuButton;
  private readonly missionButton: MenuButton;
  private readonly leaveButton: MenuButton;
  private readonly onClose: () => void;
  private readonly onRepair: () => void;
  private readonly onMissionAction?: () => void;

  constructor({ scene, onClose, onRepair, onMissionAction }: SpaceStationOverlayOptions) {
    this.onClose = onClose;
    this.onRepair = onRepair;
    this.onMissionAction = onMissionAction;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.42)
      .setDepth(PANEL_DEPTH)
      .setScrollFactor(0)
      .setInteractive();
    this.backdrop.on("pointerdown", () => this.hide());

    const stopPanelPointer = (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData): void => {
      event.stopPropagation();
    };
    const panel = scene.add.rectangle(640, 360, 560, 394, 0x08111b, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(3, 0x365a82, 0.86)
      .setInteractive()
      .on("pointerdown", stopPanelPointer);
    const inset = scene.add.rectangle(640, 360, 540, 374, 0x0b1622, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x294563, 0.7)
      .setInteractive()
      .on("pointerdown", stopPanelPointer);
    const header = scene.add.rectangle(640, 214, 512, 54, 0x0d1a2a, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setScrollFactor(0)
      .setStrokeStyle(2, 0x294563, 0.78)
      .setInteractive()
      .on("pointerdown", stopPanelPointer);

    this.title = scene.add.text(400, 215, "Station Comms", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.subtitle = scene.add.text(400, 248, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#b9d4f1",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.summaryText = scene.add.text(400, 290, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d8ebff",
      lineSpacing: 6,
      wordWrap: { width: 438 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.statusText = scene.add.text(400, 392, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#9fc6ff",
      lineSpacing: 5,
      wordWrap: { width: 438 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.buyButton = createMenuButton({
      scene,
      x: 432,
      y: 546,
      width: 108,
      height: 44,
      label: "Buy",
      onClick: () => undefined,
      depth: PANEL_DEPTH + 2,
      accentColor: 0x27384b,
      disabled: true,
    });

    this.sellButton = createMenuButton({
      scene,
      x: 550,
      y: 546,
      width: 108,
      height: 44,
      label: "Sell",
      onClick: () => undefined,
      depth: PANEL_DEPTH + 2,
      accentColor: 0x27384b,
      disabled: true,
    });

    this.repairButton = createMenuButton({
      scene,
      x: 678,
      y: 546,
      width: 124,
      height: 44,
      label: "Repair",
      onClick: () => this.onRepair(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x305c86,
    });

    this.missionButton = createMenuButton({
      scene,
      x: 812,
      y: 546,
      width: 130,
      height: 44,
      label: "Mission",
      onClick: () => this.onMissionAction?.(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x6a5030,
      disabled: true,
    });

    this.leaveButton = createMenuButton({
      scene,
      x: 948,
      y: 546,
      width: 110,
      height: 44,
      label: "Depart",
      onClick: () => this.hide(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x2b4462,
    });

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      inset,
      header,
      this.title,
      this.subtitle,
      this.summaryText,
      this.statusText,
      this.buyButton.container,
      this.sellButton.container,
      this.repairButton.container,
      this.missionButton.container,
      this.leaveButton.container,
    ]).setDepth(PANEL_DEPTH);
    this.root.setScrollFactor(0);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(state: SpaceStationOverlayState): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.update(state);
  }

  update(state: SpaceStationOverlayState): void {
    const isPrimeWorld = state.mode === "prime-world";
    this.title.setText(isPrimeWorld ? "Prime World Channel" : "Station Comms");
    this.subtitle.setText(`${state.stationName}  |  ${state.sectorLabel}`);
    this.summaryText.setText([
      `Credits: ${state.credits}`,
      state.repairSummary,
      state.missionActionSummary ?? (isPrimeWorld
        ? "Assistance and Trade are scaffolded for a later Prime World pass."
        : "Buy and Sell are scaffolded for a later station pass."),
    ].join("\n"));
    this.statusText.setText(state.statusText);

    const repairDisabled = !state.hasDamage || !state.canAffordRepair;
    this.repairButton.setEnabled(!repairDisabled);
    this.repairButton.setInputEnabled(!repairDisabled);
    this.repairButton.setLabel(state.hasDamage ? `Repair\n${state.repairCost} cr` : "Repair\nReady");
    this.buyButton.setLabel(isPrimeWorld ? "Offer\nAssistance" : "Buy");
    this.sellButton.setLabel(isPrimeWorld ? "Trade" : "Sell");
    const hasMissionAction = Boolean(state.missionActionLabel);
    this.missionButton.container.setVisible(hasMissionAction);
    this.missionButton.setLabel(state.missionActionLabel ?? "Mission");
    this.missionButton.setEnabled(Boolean(state.missionActionEnabled));
    this.missionButton.setInputEnabled(Boolean(state.missionActionEnabled));
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

    this.buyButton.setInputEnabled(false);
    this.sellButton.setInputEnabled(false);
    this.leaveButton.setInputEnabled(enabled);
    this.repairButton.setInputEnabled(enabled && this.repairButton.container.visible);
    this.missionButton.setInputEnabled(enabled && this.missionButton.container.visible);
  }
}
