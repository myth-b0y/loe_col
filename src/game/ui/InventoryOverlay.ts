import Phaser from "phaser";

import {
  EQUIPMENT_SLOTS,
  getCompatibleEquipmentSlots,
  getItemDefinition,
  type EquipmentSlotId,
  type ItemDefinition,
} from "../content/items";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type InventoryOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
};

type CargoCellUi = {
  index: number;
  frame: Phaser.GameObjects.Rectangle;
  itemLabel: Phaser.GameObjects.Text;
  hotkeyLabel: Phaser.GameObjects.Text;
};

type EquipmentSlotUi = {
  slotId: EquipmentSlotId;
  frame: Phaser.GameObjects.Rectangle;
  slotLabel: Phaser.GameObjects.Text;
  itemLabel: Phaser.GameObjects.Text;
};

const PANEL_DEPTH = 60;
const FRAME_COLOR = 0x365a82;
const FRAME_ALPHA = 0.78;
const SECTION_FILL = 0x0b1622;
const SLOT_FILL = 0x0f1d2d;
const SLOT_INNER = 0x12263a;
const SELECTED_COLOR = 0xdab66b;
const VALID_COLOR = 0x73c2ff;

export class InventoryOverlay {
  private readonly onClose: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly currencyText: Phaser.GameObjects.Text;
  private readonly characterWell: Phaser.GameObjects.Rectangle;
  private readonly characterRing: Phaser.GameObjects.Ellipse;
  private readonly equipmentSlots: EquipmentSlotUi[];
  private readonly cargoCells: CargoCellUi[];
  private readonly closeButton: MenuButton;
  private selectedCargoIndex: number | null = null;

  constructor({ scene, onClose }: InventoryOverlayOptions) {
    this.onClose = onClose;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.9)
      .setDepth(PANEL_DEPTH)
      .setInteractive();

    const panel = scene.add.rectangle(640, 360, 1120, 630, 0x08111b, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, FRAME_ALPHA);

    const equipmentSection = scene.add.rectangle(254, 330, 300, 330, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const characterSection = scene.add.rectangle(796, 310, 500, 286, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const cargoSection = scene.add.rectangle(640, 555, 1040, 168, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const footerBar = scene.add.rectangle(640, 663, 1040, 40, 0x091724, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.54);

    this.title = scene.add.text(108, 72, "Inventory", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);

    this.subtitle = scene.add.text(110, 114, "Select cargo, then click a valid equipment slot.", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd2ec",
    }).setDepth(PANEL_DEPTH + 2);

    const divider = scene.add.rectangle(640, 150, 1010, 2, 0x4f7aa5, 0.7).setDepth(PANEL_DEPTH + 2);
    const dividerSpark = scene.add.circle(1142, 150, 2.5, 0xf6fbff, 0.92).setDepth(PANEL_DEPTH + 3);

    this.closeButton = createMenuButton({
      scene,
      x: 1038,
      y: 88,
      width: 122,
      height: 40,
      label: "Close",
      onClick: () => this.hide(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x19324f,
    });

    const gearHeader = scene.add.text(118, 174, "Equipment", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);

    const characterHeader = scene.add.text(548, 174, "Character", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);

    this.characterWell = scene.add.rectangle(796, 310, 430, 238, 0x0a1520, 0.98)
      .setDepth(PANEL_DEPTH + 2)
      .setStrokeStyle(2, FRAME_COLOR, 0.44);
    const characterBeam = scene.add.triangle(796, 256, 0, 138, 164, 138, 82, 0, 0x64a8ff, 0.12)
      .setDepth(PANEL_DEPTH + 2)
      .setAngle(180);
    const characterHead = scene.add.circle(796, 278, 34, 0x10314f, 0.3)
      .setDepth(PANEL_DEPTH + 3)
      .setStrokeStyle(4, 0xb7d5ff, 0.38);
    const characterTorso = scene.add.rectangle(796, 356, 104, 132, 0x102842, 0.2)
      .setDepth(PANEL_DEPTH + 3)
      .setStrokeStyle(4, 0xb7d5ff, 0.38);
    this.characterRing = scene.add.ellipse(796, 412, 116, 38, 0x4c9dff, 0.12)
      .setDepth(PANEL_DEPTH + 2)
      .setStrokeStyle(2, 0x5ba8ff, 0.46);

    const slotPositions: Record<EquipmentSlotId, { x: number; y: number; width: number; height: number }> = {
      head: { x: 176, y: 238, width: 106, height: 56 },
      chest: { x: 300, y: 238, width: 106, height: 56 },
      legs: { x: 176, y: 318, width: 106, height: 56 },
      back: { x: 300, y: 318, width: 106, height: 56 },
      belt: { x: 238, y: 398, width: 228, height: 56 },
      leftHand: { x: 176, y: 478, width: 106, height: 56 },
      rightHand: { x: 300, y: 478, width: 106, height: 56 },
      accessory1: { x: 696, y: 468, width: 90, height: 46 },
      accessory2: { x: 796, y: 468, width: 90, height: 46 },
      accessory3: { x: 896, y: 468, width: 90, height: 46 },
    };

    this.equipmentSlots = EQUIPMENT_SLOTS.map((slot) => {
      const position = slotPositions[slot.id];
      const frame = scene.add.rectangle(position.x, position.y, position.width, position.height, SLOT_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.7)
        .setInteractive({ useHandCursor: true });
      const slotLabel = scene.add.text(position.x, position.y - position.height / 2 + 8, slot.label.toUpperCase(), {
        fontFamily: "Arial",
        fontSize: slot.id.startsWith("accessory") ? "11px" : "12px",
        color: "#90a8c7",
        fontStyle: "bold",
      }).setOrigin(0.5, 0).setDepth(PANEL_DEPTH + 3);
      const itemLabel = scene.add.text(position.x, position.y + 4, "", {
        fontFamily: "Arial",
        fontSize: slot.id.startsWith("accessory") ? "13px" : "14px",
        color: "#f5fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: position.width - 16 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3);

      frame.on("pointerdown", () => this.onEquipmentSlotClicked(slot.id));

      return { slotId: slot.id, frame, slotLabel, itemLabel };
    });

    const cargoHeader = scene.add.text(118, 494, "Cargo", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);

    this.cargoCells = Array.from({ length: 20 }, (_, index) => {
      const column = index % 10;
      const row = Math.floor(index / 10);
      const x = 170 + column * 96;
      const y = 560 + row * 74;
      const frame = scene.add.rectangle(x, y, 72, 72, SLOT_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.62)
        .setInteractive({ useHandCursor: true });
      const itemLabel = scene.add.text(x, y, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#f5fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 58 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3);
      const hotkeyLabel = scene.add.text(x - 30, y - 31, `${index + 1}`, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#6f88a7",
        fontStyle: "bold",
      }).setDepth(PANEL_DEPTH + 3);

      frame.on("pointerdown", () => this.onCargoCellClicked(index));

      return { index, frame, itemLabel, hotkeyLabel };
    });

    this.statusText = scene.add.text(120, 664, "No item selected.", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#9eb7d7",
    }).setDepth(PANEL_DEPTH + 2);

    this.currencyText = scene.add.text(1080, 664, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d9e9fb",
      fontStyle: "bold",
    }).setOrigin(1, 0).setDepth(PANEL_DEPTH + 2);

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      equipmentSection,
      characterSection,
      cargoSection,
      footerBar,
      this.title,
      this.subtitle,
      divider,
      dividerSpark,
      this.closeButton.container,
      gearHeader,
      characterHeader,
      this.characterWell,
      characterBeam,
      characterHead,
      characterTorso,
      this.characterRing,
      cargoHeader,
      this.statusText,
      this.currencyText,
      ...this.equipmentSlots.flatMap((slot) => [slot.frame, slot.slotLabel, slot.itemLabel]),
      ...this.cargoCells.flatMap((cell) => [cell.frame, cell.itemLabel, cell.hotkeyLabel]),
    ]).setDepth(PANEL_DEPTH);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.selectedCargoIndex = null;
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.selectedCargoIndex = null;
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  refresh(): void {
    const equipment = gameSession.getEquipmentLoadout();
    const cargo = gameSession.getCargoSlots();
    const selectedItem = this.getSelectedCargoItem();
    const validSlots = selectedItem ? new Set(getCompatibleEquipmentSlots(selectedItem).map((slot) => slot.id)) : new Set<EquipmentSlotId>();

    this.currencyText.setText(`Credits: ${gameSession.saveData.profile.credits}`);

    this.equipmentSlots.forEach((slot) => {
      const item = getItemDefinition(equipment[slot.slotId]);
      slot.itemLabel.setText(item?.shortLabel ?? "Empty");
      slot.itemLabel.setColor(item ? "#f5fbff" : "#6f88a7");

      const isValid = selectedItem ? validSlots.has(slot.slotId) : false;
      const borderColor = isValid ? VALID_COLOR : item?.color ?? FRAME_COLOR;
      const borderAlpha = isValid ? 0.96 : item ? 0.84 : 0.7;
      slot.frame.setStrokeStyle(2, borderColor, borderAlpha);
      slot.frame.setFillStyle(isValid ? SLOT_INNER : SLOT_FILL, 0.98);
    });

    this.cargoCells.forEach((cell) => {
      const item = getItemDefinition(cargo[cell.index]);
      const isSelected = this.selectedCargoIndex === cell.index;
      cell.itemLabel.setText(item?.shortLabel ?? "");
      cell.itemLabel.setColor(item ? "#f5fbff" : "#7a91ad");
      cell.frame.setStrokeStyle(2, isSelected ? SELECTED_COLOR : item?.color ?? FRAME_COLOR, isSelected ? 0.98 : item ? 0.84 : 0.62);
      cell.frame.setFillStyle(isSelected ? SLOT_INNER : SLOT_FILL, 0.98);
      cell.hotkeyLabel.setAlpha(item ? 0.85 : 0.3);
    });

    if (!selectedItem) {
      this.statusText.setText("No item selected.");
      return;
    }

    if (validSlots.size === 0) {
      this.statusText.setText(`${selectedItem.name} cannot be equipped.`);
      return;
    }

    this.statusText.setText(`Selected ${selectedItem.name}. Click a highlighted slot to equip.`);
  }

  private onCargoCellClicked(index: number): void {
    const cargo = gameSession.getCargoSlots();
    const item = getItemDefinition(cargo[index]);

    if (!item) {
      this.selectedCargoIndex = null;
      this.statusText.setText("Empty cargo slot.");
      this.refresh();
      return;
    }

    this.selectedCargoIndex = this.selectedCargoIndex === index ? null : index;
    this.refresh();
  }

  private onEquipmentSlotClicked(slotId: EquipmentSlotId): void {
    if (this.selectedCargoIndex === null) {
      const item = getItemDefinition(gameSession.getEquipmentLoadout()[slotId]);
      this.statusText.setText(item ? `${item.name} equipped in ${this.getSlotLabel(slotId)}.` : `${this.getSlotLabel(slotId)} is empty.`);
      return;
    }

    const success = gameSession.equipCargoItemToSlot(this.selectedCargoIndex, slotId);
    if (!success) {
      this.statusText.setText(`That item can't go into ${this.getSlotLabel(slotId)}.`);
      this.refresh();
      return;
    }

    this.selectedCargoIndex = null;
    this.statusText.setText(`Equipped item into ${this.getSlotLabel(slotId)}.`);
    this.refresh();
  }

  private getSelectedCargoItem(): ItemDefinition | null {
    if (this.selectedCargoIndex === null) {
      return null;
    }

    const cargo = gameSession.getCargoSlots();
    return getItemDefinition(cargo[this.selectedCargoIndex]);
  }

  private getSlotLabel(slotId: EquipmentSlotId): string {
    return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.closeButton.setInputEnabled(enabled);
    this.equipmentSlots.forEach((slot) => {
      if (slot.frame.input) {
        slot.frame.input.enabled = enabled;
      }
    });
    this.cargoCells.forEach((cell) => {
      if (cell.frame.input) {
        cell.frame.input.enabled = enabled;
      }
    });
  }
}
