import Phaser from "phaser";

import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type SaveSlotsMode = "load" | "new";

type SaveSlotsOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  onLoadSlot: (slotIndex: number) => void;
  onNewSlot: (slotIndex: number) => void;
};

type SlotCard = {
  frame: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  action: MenuButton;
  deleteAction: MenuButton;
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export class SaveSlotsOverlay {
  private readonly onClose: () => void;
  private readonly onLoadSlot: (slotIndex: number) => void;
  private readonly onNewSlot: (slotIndex: number) => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly closeButton: MenuButton;
  private readonly cards: SlotCard[];
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly confirmBackdrop: Phaser.GameObjects.Rectangle;
  private readonly confirmPanel: Phaser.GameObjects.Rectangle;
  private readonly confirmTitle: Phaser.GameObjects.Text;
  private readonly confirmBody: Phaser.GameObjects.Text;
  private readonly confirmDeleteButton: MenuButton;
  private readonly confirmCancelButton: MenuButton;
  private mode: SaveSlotsMode = "load";
  private pendingDeleteSlotIndex: number | null = null;

  constructor({ scene, onClose, onLoadSlot, onNewSlot }: SaveSlotsOverlayOptions) {
    this.onClose = onClose;
    this.onLoadSlot = onLoadSlot;
    this.onNewSlot = onNewSlot;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.78).setDepth(90).setInteractive();
    this.panel = scene.add.rectangle(640, 360, 860, 520, 0x091321, 0.98).setDepth(91).setStrokeStyle(3, 0x79abed, 0.82);

    this.title = scene.add.text(238, 124, "Save Slots", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(92);

    this.subtitle = scene.add.text(238, 166, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#b7d1f3",
      wordWrap: { width: 720 },
    }).setDepth(92);

    this.closeButton = createMenuButton({
      scene,
      x: 946,
      y: 132,
      width: 110,
      height: 38,
      label: "Close",
      onClick: () => this.hide(),
      depth: 92,
      accentColor: 0x283d59,
    });

    this.cards = [0, 1, 2].map((slotIndex) => {
      const y = 258 + slotIndex * 114;
      const frame = scene.add.rectangle(640, y, 748, 96, 0x102035, 0.95)
        .setDepth(91)
        .setStrokeStyle(2, 0x35577f, 0.76);
      const title = scene.add.text(300, y - 28, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setDepth(92);
      const body = scene.add.text(300, y - 2, "", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#cfe0f7",
        lineSpacing: 4,
      }).setDepth(92);
      const action = createMenuButton({
        scene,
        x: 858,
        y,
        width: 126,
        height: 46,
        label: "Load",
        onClick: () => this.handleSlot(slotIndex),
        depth: 92,
        accentColor: 0x1c4f7f,
      });
      const deleteAction = createMenuButton({
        scene,
        x: 970,
        y,
        width: 98,
        height: 46,
        label: "Delete",
        onClick: () => this.promptDelete(slotIndex),
        depth: 92,
        accentColor: 0x5d2732,
        disabled: true,
      });

      return { frame, title, body, action, deleteAction };
    });

    this.statusText = scene.add.text(640, 584, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d7e8ff",
      align: "center",
      wordWrap: { width: 720 },
    }).setOrigin(0.5).setDepth(92);

    this.confirmBackdrop = scene.add.rectangle(640, 360, 1280, 720, 0x010409, 0.4)
      .setDepth(94)
      .setVisible(false)
      .setInteractive();
    this.confirmPanel = scene.add.rectangle(640, 360, 420, 190, 0x0a1220, 0.98)
      .setDepth(95)
      .setStrokeStyle(3, 0x79abed, 0.84)
      .setVisible(false);
    this.confirmTitle = scene.add.text(640, 304, "Delete Save?", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f8fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(96).setVisible(false);
    this.confirmBody = scene.add.text(640, 352, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d7e8ff",
      align: "center",
      wordWrap: { width: 330 },
    }).setOrigin(0.5).setDepth(96).setVisible(false);
    this.confirmDeleteButton = createMenuButton({
      scene,
      x: 580,
      y: 412,
      width: 126,
      label: "Delete",
      onClick: () => this.confirmDelete(),
      depth: 96,
      accentColor: 0x6d2937,
    });
    this.confirmCancelButton = createMenuButton({
      scene,
      x: 700,
      y: 412,
      width: 126,
      label: "Cancel",
      onClick: () => this.hideDeletePrompt(),
      depth: 96,
      accentColor: 0x283d59,
    });

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      this.panel,
      this.title,
      this.subtitle,
      this.closeButton.container,
      this.statusText,
      ...this.cards.flatMap((card) => [
        card.frame,
        card.title,
        card.body,
        card.action.container,
        card.deleteAction.container,
      ]),
      this.confirmBackdrop,
      this.confirmPanel,
      this.confirmTitle,
      this.confirmBody,
      this.confirmDeleteButton.container,
      this.confirmCancelButton.container,
    ]).setDepth(90);

    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.hideDeletePrompt();
  }

  show(mode: SaveSlotsMode): void {
    this.mode = mode;
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.hideDeletePrompt();
    this.refresh();
  }

  hide(): void {
    this.hideDeletePrompt();
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.onClose();
  }

  private refresh(): void {
    const slots = gameSession.getSaveSlots();
    this.statusText.setText("");
    this.title.setText(this.mode === "load" ? "Load Save" : "Choose Save Slot");
    this.subtitle.setText(
      this.mode === "load"
        ? "Pick the file you want to continue from."
        : "Choose a slot for a new run. Filled slots can be overwritten.",
    );

    slots.forEach((slot, index) => {
      const card = this.cards[index];
      const accent = slot.isActive ? 0x6aa5f2 : 0x35577f;
      card.frame.setStrokeStyle(2, accent, slot.isActive ? 0.95 : 0.76);

      if (!slot.data) {
        card.title.setText(`${slot.label} ${slot.isActive ? "- Active" : ""}`);
        card.body.setText("Empty slot\nNo campaign data saved yet.");
        card.action.setLabel(this.mode === "load" ? "Empty" : "Start");
        card.action.setEnabled(this.mode === "new");
        card.action.setOnClick(() => this.handleSlot(index));
        card.deleteAction.setEnabled(false);
        card.deleteAction.setInputEnabled(false);
        card.deleteAction.container.setVisible(false);
        return;
      }

      const save = slot.data;
      const completedCount = save.progression.completedMissionIds.length;
      const queuedCount = save.missions?.acceptedMissionIds?.length ?? 0;
      card.title.setText(`${slot.label}${slot.isActive ? " - Active" : ""} | Lv ${save.profile.level} ${save.profile.callsign}`);
      card.body.setText([
        `Saved: ${formatTimestamp(save.meta.lastSavedAt)} | Credits: ${save.profile.credits} | XP: ${save.profile.xp}`,
        `Weapon: ${save.loadout.weapon} | Squad: ${save.loadout.companion}`,
        `Queued missions: ${queuedCount} | Completed missions: ${completedCount}`,
      ]);
      card.action.setLabel(this.mode === "load" ? "Load" : "Overwrite");
      card.action.setEnabled(true);
      card.action.setOnClick(() => this.handleSlot(index));
      card.deleteAction.setOnClick(() => this.promptDelete(index));
      card.deleteAction.setEnabled(this.mode === "load");
      card.deleteAction.setInputEnabled(this.mode === "load");
      card.deleteAction.container.setVisible(this.mode === "load");
    });
  }

  private handleSlot(slotIndex: number): void {
    if (this.mode === "load") {
      this.onLoadSlot(slotIndex);
      return;
    }

    this.onNewSlot(slotIndex);
  }

  private promptDelete(slotIndex: number): void {
    const slot = gameSession.getSaveSlots()[slotIndex];
    if (this.mode !== "load" || !slot?.data) {
      return;
    }

    this.pendingDeleteSlotIndex = slotIndex;
    this.confirmBody.setText(
      `Delete ${slot.label} (${slot.data.profile.callsign})?\nThis cannot be undone.`,
    );
    this.confirmBackdrop.setVisible(true);
    this.confirmPanel.setVisible(true);
    this.confirmTitle.setVisible(true);
    this.confirmBody.setVisible(true);
    this.confirmDeleteButton.container.setVisible(true);
    this.confirmCancelButton.container.setVisible(true);
    this.confirmDeleteButton.setInputEnabled(true);
    this.confirmCancelButton.setInputEnabled(true);
    this.closeButton.setInputEnabled(false);
    this.cards.forEach((card) => {
      card.action.setInputEnabled(false);
      card.deleteAction.setInputEnabled(false);
    });
  }

  private hideDeletePrompt(): void {
    this.pendingDeleteSlotIndex = null;
    this.confirmBackdrop.setVisible(false);
    this.confirmPanel.setVisible(false);
    this.confirmTitle.setVisible(false);
    this.confirmBody.setVisible(false);
    this.confirmDeleteButton.container.setVisible(false);
    this.confirmCancelButton.container.setVisible(false);
    this.confirmDeleteButton.setInputEnabled(false);
    this.confirmCancelButton.setInputEnabled(false);
    if (!this.root.visible) {
      return;
    }

    this.closeButton.setInputEnabled(true);
    this.cards.forEach((card) => {
      card.action.setInputEnabled(true);
      card.deleteAction.setInputEnabled(this.mode === "load" && card.deleteAction.container.visible);
    });
  }

  private confirmDelete(): void {
    if (this.pendingDeleteSlotIndex === null) {
      this.hideDeletePrompt();
      return;
    }

    const ok = gameSession.deleteSave(this.pendingDeleteSlotIndex);
    this.hideDeletePrompt();
    this.refresh();
    this.statusText.setText(ok ? "Save deleted." : "Delete failed.");
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }
    if (this.confirmBackdrop.input) {
      this.confirmBackdrop.input.enabled = enabled && this.confirmBackdrop.visible;
    }

    this.closeButton.setInputEnabled(enabled);
    this.cards.forEach((card) => {
      card.action.setInputEnabled(enabled);
      card.deleteAction.setInputEnabled(enabled && this.mode === "load" && card.deleteAction.container.visible);
    });
    this.confirmDeleteButton.setInputEnabled(enabled && this.confirmBackdrop.visible);
    this.confirmCancelButton.setInputEnabled(enabled && this.confirmBackdrop.visible);
  }
}
