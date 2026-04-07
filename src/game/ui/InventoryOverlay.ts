import Phaser from "phaser";

import { STORY_COMPANIONS } from "../content/companions";
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

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x01050a, 0.9)
      .setDepth(60)
      .setInteractive();
    const panel = scene.add.rectangle(640, 360, 1120, 620, 0x06101a, 0.985)
      .setDepth(61)
      .setStrokeStyle(3, 0x6e9bd1, 0.84);
    const leftRail = scene.add.rectangle(318, 360, 318, 534, 0x08141f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const equipmentRail = scene.add.rectangle(756, 258, 696, 312, 0x09131f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const cargoRail = scene.add.rectangle(756, 518, 696, 218, 0x09131f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);

    const title = scene.add.text(126, 92, "Loadout & Crafting Bench", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.subtitle = scene.add.text(126, 138, "Inventory, cargo, equipped gear, and the first placeholder pass for shipboard crafting all live here.", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd4f3",
      wordWrap: { width: 860 },
    }).setDepth(62);

    const characterBeam = scene.add.triangle(318, 296, 0, 220, 180, 220, 90, 0, 0xf2f7ff, 0.1)
      .setDepth(62)
      .setOrigin(0.5);
    const characterCore = scene.add.circle(318, 284, 70, 0xf2f7ff, 0.92)
      .setDepth(63)
      .setStrokeStyle(4, 0x7caeff, 0.96);
    const characterBody = scene.add.rectangle(318, 374, 110, 148, 0xd8e8ff, 0.16)
      .setDepth(62)
      .setStrokeStyle(3, 0x7caeff, 0.76);
    const silhouette = scene.add.text(318, 372, "PLAYER", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(63);

    const profileTitle = scene.add.text(176, 448, "Pilot Readout", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.profileText = scene.add.text(176, 478, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d2e3fa",
      lineSpacing: 6,
      wordWrap: { width: 248 },
    }).setDepth(62);

    const squadTitle = scene.add.text(176, 606, "Active Squad", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.squadText = scene.add.text(176, 634, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9fc6ff",
      lineSpacing: 5,
      wordWrap: { width: 248 },
    }).setDepth(62);

    const equipmentTitle = scene.add.text(502, 166, "Gear Slots", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    const equipmentHint = scene.add.text(502, 192, "The command layer now tracks your equipment shell even before full loot/crafting depth lands.", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8fb1d6",
      wordWrap: { width: 642 },
    }).setDepth(62);

    this.equipmentSlots = EQUIPMENT_SLOTS.map((slot, index) => {
      const column = index < 5 ? 0 : 1;
      const row = index < 5 ? index : index - 5;
      const x = 620 + column * 246;
      const y = 196 + row * 48;
      const frame = scene.add.rectangle(x, y, 220, 42, 0x102035, 0.96)
        .setDepth(62)
        .setStrokeStyle(2, 0x35577f, 0.78);
      const label = scene.add.text(x - 98, y - 12, slot.label, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#9fc6ff",
      }).setDepth(63);
      const item = scene.add.text(x - 98, y + 4, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#f7fbff",
        fontStyle: "bold",
        wordWrap: { width: 188 },
      }).setDepth(63);

      return {
        slotId: slot.id,
        frame,
        label,
        item,
      };
    });

    this.cargoTitle = scene.add.text(502, 420, "Cargo Grid", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.cargoCells = Array.from({ length: 20 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 500 + column * 90;
      const y = 470 + row * 32;
      const frame = scene.add.rectangle(x, y, 82, 34, 0x102035, 0.96)
        .setDepth(62)
        .setStrokeStyle(2, 0x35577f, 0.72);
      const label = scene.add.text(x, y, "", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#d7e8ff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 72 },
      }).setOrigin(0.5).setDepth(63);

      return { frame, label };
    });

    this.materialsTitle = scene.add.text(852, 420, "Bench Materials", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.materialsText = scene.add.text(852, 468, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d2e3fa",
      lineSpacing: 6,
      wordWrap: { width: 250 },
    }).setDepth(62);

    const craftingHint = scene.add.text(852, 572, "Crafting stays lightweight for now, but this bench is where recipes, belt upgrades, shield variants, and weapon tuning will live.", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8fb1d6",
      lineSpacing: 6,
      wordWrap: { width: 250 },
    }).setDepth(62);

    this.closeButton = createMenuButton({
      scene,
      x: 982,
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
      equipmentRail,
      cargoRail,
      title,
      this.subtitle,
      characterBeam,
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
      craftingHint,
      this.closeButton.container,
      ...this.equipmentSlots.flatMap((slot) => [slot.frame, slot.label, slot.item]),
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
      `Callsign: ${gameSession.saveData.profile.callsign}`,
      `Level ${gameSession.saveData.profile.level} | Credits ${gameSession.saveData.profile.credits}`,
      "",
      `Abilities: ${gameSession.saveData.loadout.ability} / ${gameSession.saveData.loadout.support}`,
      `Shield Belt: ${getItemDefinition(equipment.belt)?.name ?? "None"}`,
    ]);

    this.squadText.setText([
      companions.length > 0
        ? companions
          .map(({ companion, slotId }) => `${companion.name} | ${slotId}`)
          .join("\n")
        : "No companions assigned.",
      "",
      `Roster Ready: ${STORY_COMPANIONS.length} companions`,
    ]);

    this.equipmentSlots.forEach((slot) => {
      const item = getItemDefinition(equipment[slot.slotId]);
      slot.item.setText(item?.name ?? "Empty");
      slot.item.setColor(item ? "#f7fbff" : "#7f92a9");
      slot.frame.setStrokeStyle(2, item?.color ?? 0x35577f, item ? 0.92 : 0.72);
    });

    this.cargoCells.forEach((cell, index) => {
      const item = getItemDefinition(cargo[index]);
      cell.label.setText(item?.shortLabel ?? "");
      cell.label.setColor(item ? "#f7fbff" : "#7f92a9");
      cell.frame.setStrokeStyle(2, item?.color ?? 0x35577f, item ? 0.92 : 0.72);
      cell.frame.setFillStyle(item ? 0x172436 : 0x102035, 0.96);
    });

    this.materialsText.setText([
      `Alloy: ${materials.alloy}`,
      `Shard Dust: ${materials.shardDust}`,
      `Filament: ${materials.filament}`,
      "",
      `Cargo Slots Used: ${cargo.filter((itemId) => itemId !== null).length}/${cargo.length}`,
    ]);
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.closeButton.setInputEnabled(enabled);
  }
}
