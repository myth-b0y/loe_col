import Phaser from "phaser";

import { getFormationSlot } from "../content/companions";
import { EQUIPMENT_SLOTS, getItemDefinition, type EquipmentSlotId } from "../content/items";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type InventoryOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
};

type CargoCellUi = {
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
};

type EquipmentSlotUi = {
  slotId: EquipmentSlotId;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  item: Phaser.GameObjects.Text;
};

export class InventoryOverlay {
  private readonly onClose: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly profileText: Phaser.GameObjects.Text;
  private readonly squadText: Phaser.GameObjects.Text;
  private readonly materialsText: Phaser.GameObjects.Text;
  private readonly cargoTitle: Phaser.GameObjects.Text;
  private readonly materialsTitle: Phaser.GameObjects.Text;
  private readonly cargoCells: CargoCellUi[];
  private readonly equipmentSlots: EquipmentSlotUi[];
  private readonly closeButton: MenuButton;

  constructor({ scene, onClose }: InventoryOverlayOptions) {
    this.onClose = onClose;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x01050a, 0.91)
      .setDepth(60)
      .setInteractive();
    const panel = scene.add.rectangle(640, 360, 1120, 620, 0x06101a, 0.985)
      .setDepth(61)
      .setStrokeStyle(3, 0x6e9bd1, 0.84);
    const leftRail = scene.add.rectangle(308, 366, 332, 556, 0x08141f, 0.99)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const rightTopRail = scene.add.rectangle(806, 290, 646, 362, 0x09131f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const rightBottomRail = scene.add.rectangle(806, 548, 646, 154, 0x0a1521, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);

    const title = scene.add.text(120, 88, "Loadout Bench", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.subtitle = scene.add.text(120, 130, "Gear slots, cargo, and the shipboard crafting shell all live here.", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd4f3",
      wordWrap: { width: 820 },
    }).setDepth(62);

    const dollFrame = scene.add.rectangle(308, 280, 252, 268, 0x09141f, 0.98)
      .setDepth(62)
      .setStrokeStyle(2, 0x2f4e70, 0.8);
    const characterBeam = scene.add.triangle(308, 270, 0, 228, 180, 228, 90, 0, 0xf2f7ff, 0.08)
      .setDepth(62)
      .setOrigin(0.5);
    const characterHalo = scene.add.circle(308, 252, 72, 0xf2f7ff, 0.08)
      .setDepth(62)
      .setStrokeStyle(2, 0x7caeff, 0.36);
    const characterCore = scene.add.circle(308, 244, 34, 0xf2f7ff, 0.94)
      .setDepth(63)
      .setStrokeStyle(4, 0x7caeff, 0.96);
    const characterBody = scene.add.rectangle(308, 330, 120, 124, 0xd8e8ff, 0.14)
      .setDepth(62)
      .setStrokeStyle(3, 0x7caeff, 0.74);
    const silhouette = scene.add.text(308, 330, "PLAYER", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(63);

    const profileTitle = scene.add.text(520, 518, "Pilot Readout", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.profileText = scene.add.text(520, 548, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d2e3fa",
      lineSpacing: 6,
      wordWrap: { width: 220 },
    }).setDepth(62);

    const squadTitle = scene.add.text(760, 518, "Squad Sync", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.squadText = scene.add.text(760, 548, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9fc6ff",
      lineSpacing: 5,
      wordWrap: { width: 178 },
    }).setDepth(62);

    const equipmentTitle = scene.add.text(504, 168, "Cargo + Bench", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    const equipmentHint = scene.add.text(504, 194, "Gear sockets live around the paper-doll. Cargo, salvage, and bench systems live in this bay.", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8fb1d6",
      wordWrap: { width: 600 },
    }).setDepth(62);

    const equipmentSlotPositions: Record<EquipmentSlotId, { x: number; y: number }> = {
      head: { x: 308, y: 192 },
      chest: { x: 308, y: 272 },
      legs: { x: 308, y: 352 },
      leftHand: { x: 208, y: 274 },
      rightHand: { x: 408, y: 274 },
      belt: { x: 308, y: 434 },
      back: { x: 208, y: 192 },
      accessory1: { x: 208, y: 434 },
      accessory2: { x: 308, y: 512 },
      accessory3: { x: 408, y: 434 },
    };

    this.equipmentSlots = EQUIPMENT_SLOTS.map((slot) => {
      const position = equipmentSlotPositions[slot.id];
      const frame = scene.add.rectangle(position.x, position.y, 72, 72, 0x101b29, 0.98)
        .setDepth(63)
        .setStrokeStyle(2, 0x35577f, 0.74);
      const item = scene.add.text(position.x, position.y - 4, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#f7fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 60 },
      }).setOrigin(0.5).setDepth(64);
      const label = scene.add.text(position.x, position.y + 48, slot.label, {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#92abc6",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 78 },
      }).setOrigin(0.5).setDepth(64);

      return {
        slotId: slot.id,
        frame,
        label,
        item,
      };
    });

    this.cargoTitle = scene.add.text(520, 232, "Cargo Grid", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.cargoCells = Array.from({ length: 20 }, (_, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = 556 + column * 78;
      const y = 282 + row * 68;
      const frame = scene.add.rectangle(x, y, 64, 64, 0x102035, 0.98)
        .setDepth(62)
        .setStrokeStyle(2, 0x35577f, 0.74);
      const label = scene.add.text(x, y, "", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#d7e8ff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 54 },
      }).setOrigin(0.5).setDepth(63);

      return { frame, label };
    });

    this.materialsTitle = scene.add.text(988, 232, "Bench Feed", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.materialsText = scene.add.text(988, 274, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d2e3fa",
      lineSpacing: 6,
      wordWrap: { width: 140 },
    }).setDepth(62);

    const bottomTitle = scene.add.text(1012, 494, "Craft Shell", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(62);
    const bottomCopy = scene.add.text(1012, 518, "Future bench lane", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#9fc6ff",
      align: "center",
    }).setOrigin(0.5, 0).setDepth(62);
    const bottomAccent = scene.add.rectangle(1012, 580, 118, 70, 0x101b29, 0.98)
      .setDepth(62)
      .setStrokeStyle(2, 0x35577f, 0.74);
    const bottomAccentTitle = scene.add.text(1012, 564, "Bench Core", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(63);
    const bottomAccentValue = scene.add.text(1012, 592, "READY", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#a6f3ff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(63);

    this.closeButton = createMenuButton({
      scene,
      x: 984,
      y: 94,
      width: 112,
      height: 40,
      label: "Close",
      onClick: () => this.hide(),
      depth: 62,
      accentColor: 0x2a405f,
    });

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      leftRail,
      rightTopRail,
      rightBottomRail,
      title,
      this.subtitle,
      dollFrame,
      characterBeam,
      characterHalo,
      characterCore,
      characterBody,
      silhouette,
      profileTitle,
      this.profileText,
      squadTitle,
      this.squadText,
      equipmentTitle,
      equipmentHint,
      this.cargoTitle,
      this.materialsTitle,
      this.materialsText,
      bottomTitle,
      bottomCopy,
      bottomAccent,
      bottomAccentTitle,
      bottomAccentValue,
      this.closeButton.container,
      ...this.equipmentSlots.flatMap((slot) => [slot.frame, slot.item, slot.label]),
      ...this.cargoCells.flatMap((cell) => [cell.frame, cell.label]),
    ]).setDepth(60);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  private refresh(): void {
    const equipment = gameSession.getEquipmentLoadout();
    const cargo = gameSession.getCargoSlots();
    const materials = gameSession.getCraftingMaterials();
    const companions = gameSession.getSelectedCompanions();

    this.profileText.setText([
      `${gameSession.saveData.profile.callsign}`,
      `Lv ${gameSession.saveData.profile.level} | Credits ${gameSession.saveData.profile.credits}`,
      `${gameSession.saveData.loadout.ability} | ${gameSession.saveData.loadout.support}`,
    ]);

    this.squadText.setText([
      companions.length > 0
        ? companions
          .map(({ companion, slotId }) => {
            const slotLabel = getFormationSlot(slotId)?.label
              .replace("Front ", "F ")
              .replace("Back ", "B ")
              .replace("Left", "L")
              .replace("Right", "R") ?? slotId;
            return `${companion.name} | ${slotLabel}`;
          })
          .join("\n")
        : "No companions assigned.",
    ]);

    this.equipmentSlots.forEach((slot) => {
      const item = getItemDefinition(equipment[slot.slotId]);
      slot.item.setText(item?.shortLabel ?? "+");
      slot.item.setColor(item ? "#f7fbff" : "#6f849d");
      slot.frame.setStrokeStyle(2, item?.color ?? 0x35577f, item ? 0.92 : 0.72);
      slot.frame.setFillStyle(item ? 0x172436 : 0x101b29, 0.98);
    });

    this.cargoCells.forEach((cell, index) => {
      const item = getItemDefinition(cargo[index]);
      cell.label.setText(item?.shortLabel ?? "");
      cell.label.setColor(item ? "#f7fbff" : "#7f92a9");
      cell.frame.setStrokeStyle(2, item?.color ?? 0x35577f, item ? 0.92 : 0.72);
      cell.frame.setFillStyle(item ? 0x172436 : 0x102035, 0.98);
    });

    this.materialsText.setText([
      `Alloy | ${materials.alloy}`,
      `Shard Dust | ${materials.shardDust}`,
      `Filament | ${materials.filament}`,
      `Cargo | ${cargo.filter((itemId) => itemId !== null).length}/${cargo.length}`,
    ]);
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.closeButton.setInputEnabled(enabled);
  }
}
