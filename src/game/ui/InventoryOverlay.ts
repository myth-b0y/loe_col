import Phaser from "phaser";

import {
  EQUIPMENT_SLOTS,
  describeCraftingMaterials,
  describeInventoryItem,
  getItemColor,
  getItemName,
  getItemShortLabel,
  isGearItem,
  summarizeCombatProfile,
  type CraftingMaterials,
  type EquipmentLoadout,
  type EquipmentSlotId,
  type InventoryItem,
} from "../content/items";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

export type InventoryOverlaySnapshot = {
  title?: string;
  subtitle?: string;
  emptyStatusText?: string;
  allowEquip?: boolean;
  equipment: EquipmentLoadout;
  cargo: Array<InventoryItem | null>;
  materials: CraftingMaterials;
  currencyLines?: string[];
  statLines?: string[];
};

type InventoryOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  getSnapshot?: () => InventoryOverlaySnapshot;
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

type InventorySelection =
  | { kind: "cargo"; index: number }
  | { kind: "equipment"; slotId: EquipmentSlotId };

const PANEL_DEPTH = 60;
const FRAME_COLOR = 0x365a82;
const FRAME_ALPHA = 0.78;
const SECTION_FILL = 0x0b1622;
const SLOT_FILL = 0x0f1d2d;
const SLOT_INNER = 0x12263a;
const SELECTED_COLOR = 0xdab66b;

export class InventoryOverlay {
  private readonly onClose: () => void;
  private readonly getSnapshot: () => InventoryOverlaySnapshot;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly currencyText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly characterWell: Phaser.GameObjects.Rectangle;
  private readonly characterRing: Phaser.GameObjects.Ellipse;
  private readonly equipmentSlots: EquipmentSlotUi[];
  private readonly cargoCells: CargoCellUi[];
  private readonly closeButton: MenuButton;
  private readonly actionMenu: Phaser.GameObjects.Container;
  private readonly actionTitle: Phaser.GameObjects.Text;
  private readonly actionBody: Phaser.GameObjects.Text;
  private readonly actionPrimary: MenuButton;
  private readonly actionSecondary: MenuButton;
  private readonly actionTertiary: MenuButton;
  private selectedEntry: InventorySelection | null = null;
  private currentSnapshot!: InventoryOverlaySnapshot;
  private readonly panelBounds = new Phaser.Geom.Rectangle(80, 25, 1120, 670);

  constructor({ scene, onClose, getSnapshot }: InventoryOverlayOptions) {
    this.onClose = onClose;
    this.getSnapshot = getSnapshot ?? (() => this.getDefaultSnapshot());

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.9)
      .setDepth(PANEL_DEPTH)
      .setInteractive();
    this.backdrop.on("pointerdown", () => {
      if (this.actionMenu.visible) {
        this.hideActionMenu();
        this.refresh();
      }
    });

    const panel = scene.add.rectangle(640, 360, 1120, 670, 0x08111b, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, FRAME_ALPHA);

    const equipmentSection = scene.add.rectangle(254, 330, 300, 330, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const characterSection = scene.add.rectangle(796, 310, 500, 286, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const cargoSection = scene.add.rectangle(640, 570, 1040, 156, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const footerBar = scene.add.rectangle(640, 674, 1040, 38, 0x091724, 0.98)
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

    const actionPanel = scene.add.rectangle(0, 0, 228, 206, 0x09131f, 0.98)
      .setStrokeStyle(2, 0x6b93be, 0.82);
    this.actionTitle = scene.add.text(0, -74, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f7fbff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 182 },
    }).setOrigin(0.5);
    this.actionBody = scene.add.text(0, -34, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#b8cfe9",
      align: "center",
      wordWrap: { width: 186 },
    }).setOrigin(0.5, 0);
    this.actionPrimary = createMenuButton({
      scene,
      x: 0,
      y: 32,
      width: 172,
      height: 38,
      label: "Equip",
      onClick: () => this.runActionMenuPrimary(),
      depth: PANEL_DEPTH + 6,
      accentColor: 0x214a72,
    });
    this.actionSecondary = createMenuButton({
      scene,
      x: 0,
      y: 78,
      width: 172,
      height: 34,
      label: "Drop",
      onClick: () => this.runActionMenuDrop(),
      depth: PANEL_DEPTH + 6,
      accentColor: 0x5a3b22,
    });
    this.actionTertiary = createMenuButton({
      scene,
      x: 0,
      y: 120,
      width: 172,
      height: 34,
      label: "Examine",
      onClick: () => this.runActionMenuExamine(),
      depth: PANEL_DEPTH + 6,
      accentColor: 0x263f5f,
    });
    this.actionMenu = scene.add.container(0, 0, [
      actionPanel,
      this.actionTitle,
      this.actionBody,
      this.actionPrimary.container,
      this.actionSecondary.container,
      this.actionTertiary.container,
    ]).setDepth(PANEL_DEPTH + 5).setVisible(false);
    this.actionMenu.setScrollFactor(0);
    this.actionPrimary.container.setScrollFactor(0);
    this.actionSecondary.container.setScrollFactor(0);
    this.actionTertiary.container.setScrollFactor(0);

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

    this.characterWell = scene.add.rectangle(796, 294, 430, 206, 0x0a1520, 0.98)
      .setDepth(PANEL_DEPTH + 2)
      .setStrokeStyle(2, FRAME_COLOR, 0.44);
    const characterBeam = scene.add.triangle(796, 246, 0, 138, 164, 138, 82, 0, 0x64a8ff, 0.12)
      .setDepth(PANEL_DEPTH + 2)
      .setAngle(180);
    const characterHead = scene.add.circle(796, 266, 34, 0x10314f, 0.3)
      .setDepth(PANEL_DEPTH + 3)
      .setStrokeStyle(4, 0xb7d5ff, 0.38);
    const characterTorso = scene.add.rectangle(796, 334, 104, 126, 0x102842, 0.2)
      .setDepth(PANEL_DEPTH + 3)
      .setStrokeStyle(4, 0xb7d5ff, 0.38);
    this.characterRing = scene.add.ellipse(796, 388, 116, 38, 0x4c9dff, 0.12)
      .setDepth(PANEL_DEPTH + 2)
      .setStrokeStyle(2, 0x5ba8ff, 0.46);
    const combatHeader = scene.add.text(548, 392, "Combat Readout", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#9ebce0",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);
    this.statsText = scene.add.text(548, 408, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#e2eefc",
      lineSpacing: 2,
      wordWrap: { width: 420 },
    }).setDepth(PANEL_DEPTH + 2);

    const slotPositions: Record<EquipmentSlotId, { x: number; y: number; width: number; height: number }> = {
      head: { x: 176, y: 238, width: 106, height: 56 },
      chest: { x: 300, y: 238, width: 106, height: 56 },
      legs: { x: 176, y: 318, width: 106, height: 56 },
      back: { x: 300, y: 318, width: 106, height: 56 },
      belt: { x: 238, y: 398, width: 228, height: 56 },
      leftHand: { x: 176, y: 478, width: 106, height: 56 },
      rightHand: { x: 300, y: 478, width: 106, height: 56 },
      accessory1: { x: 696, y: 480, width: 90, height: 46 },
      accessory2: { x: 796, y: 480, width: 90, height: 46 },
      accessory3: { x: 896, y: 480, width: 90, height: 46 },
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

    const cargoHeader = scene.add.text(118, 502, "Cargo", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2);

    this.cargoCells = Array.from({ length: 20 }, (_, index) => {
      const column = index % 10;
      const row = Math.floor(index / 10);
      const x = 170 + column * 96;
      const y = 554 + row * 68;
      const frame = scene.add.rectangle(x, y, 64, 64, SLOT_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.62)
        .setInteractive({ useHandCursor: true });
      const itemLabel = scene.add.text(x, y, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#f5fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 50 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3);
      const hotkeyLabel = scene.add.text(x - 26, y - 27, `${index + 1}`, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#6f88a7",
        fontStyle: "bold",
      }).setDepth(PANEL_DEPTH + 3);

      frame.on("pointerdown", () => this.onCargoCellClicked(index));

      return { index, frame, itemLabel, hotkeyLabel };
    });

    this.statusText = scene.add.text(120, 661, "No item selected.", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9eb7d7",
      wordWrap: { width: 700 },
    }).setDepth(PANEL_DEPTH + 2);

    this.currencyText = scene.add.text(1080, 657, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d9e9fb",
      fontStyle: "bold",
      align: "right",
      lineSpacing: 2,
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
      this.actionMenu,
      gearHeader,
      characterHeader,
      this.characterWell,
      characterBeam,
      characterHead,
      characterTorso,
      this.characterRing,
      combatHeader,
      this.statsText,
      cargoHeader,
      ...this.equipmentSlots.flatMap((slot) => [slot.frame, slot.slotLabel, slot.itemLabel]),
      ...this.cargoCells.flatMap((cell) => [cell.frame, cell.itemLabel, cell.hotkeyLabel]),
      this.statusText,
      this.currencyText,
    ]).setDepth(PANEL_DEPTH);
    this.root.iterate((child: Phaser.GameObjects.GameObject) => {
      (child as Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number, y?: number) => void }).setScrollFactor?.(0, 0);
    });

    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.currentSnapshot = this.getSnapshot();
  }

  show(): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.hideActionMenu();
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.hideActionMenu();
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  refresh(): void {
    this.currentSnapshot = this.getSnapshot();
    const { equipment, cargo, materials } = this.currentSnapshot;
    const allowEquip = this.currentSnapshot.allowEquip ?? true;
    const titleText = this.currentSnapshot.title ?? "Inventory";
    const subtitleText = this.currentSnapshot.subtitle ?? "Select cargo, then click a valid equipment slot.";
    const selectedItem = this.getSelectedItem();

    const materialSummary = describeCraftingMaterials(materials);
    this.title.setText(titleText);
    this.subtitle.setText(subtitleText);
    this.currencyText.setText((this.currentSnapshot.currencyLines ?? [
      `Credits: ${gameSession.saveData.profile.credits}`,
      materialSummary.length > 0 ? materialSummary.join(" | ") : "No crafting salvage",
    ]).join("\n"));
    this.statsText.setText((this.currentSnapshot.statLines ?? summarizeCombatProfile(gameSession.getPlayerCombatProfile())).join("\n"));

    this.equipmentSlots.forEach((slot) => {
      const item = equipment[slot.slotId];
      slot.itemLabel.setText(item ? getItemShortLabel(item) : "Empty");
      slot.itemLabel.setColor(item ? "#f5fbff" : "#6f88a7");

      const isSelected = this.selectedEntry?.kind === "equipment" && this.selectedEntry.slotId === slot.slotId;
      const borderColor = isSelected ? SELECTED_COLOR : item ? getItemColor(item) : FRAME_COLOR;
      const borderAlpha = isSelected ? 0.98 : item ? 0.84 : 0.7;
      slot.frame.setStrokeStyle(2, borderColor, borderAlpha);
      slot.frame.setFillStyle(isSelected ? SLOT_INNER : SLOT_FILL, 0.98);
    });

    this.cargoCells.forEach((cell) => {
      const item = cargo[cell.index];
      const isSelected = this.selectedEntry?.kind === "cargo" && this.selectedEntry.index === cell.index;
      cell.itemLabel.setText(item ? getItemShortLabel(item) : "");
      cell.itemLabel.setColor(item ? "#f5fbff" : "#7a91ad");
      cell.frame.setStrokeStyle(2, isSelected ? SELECTED_COLOR : item ? getItemColor(item) : FRAME_COLOR, isSelected ? 0.98 : item ? 0.84 : 0.62);
      cell.frame.setFillStyle(isSelected ? SLOT_INNER : SLOT_FILL, 0.98);
      cell.hotkeyLabel.setAlpha(item ? 0.85 : 0.3);
    });

    if (!selectedItem) {
      this.statusText.setText(this.currentSnapshot.emptyStatusText ?? "No item selected. Gear starts empty now, and boss drops will fill this board as you progress.");
      return;
    }

    if (!allowEquip) {
      this.statusText.setText([`${getItemName(selectedItem)} | Mission View`, ...describeInventoryItem(selectedItem)].join("\n"));
      return;
    }

    this.statusText.setText([`${getItemName(selectedItem)} selected.`, ...describeInventoryItem(selectedItem)].join("\n"));
  }

  private onCargoCellClicked(index: number): void {
    const cargo = this.currentSnapshot.cargo;
    const item = cargo[index];

    if (!item) {
      this.hideActionMenu();
      this.statusText.setText("Empty cargo slot.");
      this.refresh();
      return;
    }

    this.selectedEntry = { kind: "cargo", index };
    const cell = this.cargoCells.find((entry) => entry.index === index);
    if (cell) {
      this.showActionMenu(cell.frame.x + 110, cell.frame.y - 18);
    }
    this.refresh();
  }

  private onEquipmentSlotClicked(slotId: EquipmentSlotId): void {
    const currentItem = this.currentSnapshot.equipment[slotId];
    if ((this.currentSnapshot.allowEquip ?? true) === false) {
      this.statusText.setText(currentItem
        ? [`${getItemName(currentItem)} equipped in ${this.getSlotLabel(slotId)}.`, ...describeInventoryItem(currentItem)].join("\n")
        : `${this.getSlotLabel(slotId)} is empty.`);
      return;
    }

    if (!currentItem) {
      this.hideActionMenu();
      this.statusText.setText(`${this.getSlotLabel(slotId)} is empty.`);
      return;
    }

    this.selectedEntry = { kind: "equipment", slotId };
    const slot = this.equipmentSlots.find((entry) => entry.slotId === slotId);
    if (slot) {
      this.showActionMenu(slot.frame.x + 138, slot.frame.y - 10);
    }
    this.refresh();
  }

  private getSelectedItem(): InventoryItem | null {
    if (!this.selectedEntry) {
      return null;
    }

    if (this.selectedEntry.kind === "cargo") {
      return this.currentSnapshot.cargo[this.selectedEntry.index];
    }

    return this.currentSnapshot.equipment[this.selectedEntry.slotId];
  }

  private getSlotLabel(slotId: EquipmentSlotId): string {
    return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
  }

  private getDefaultSnapshot(): InventoryOverlaySnapshot {
    return {
      equipment: gameSession.getEquipmentLoadout(),
      cargo: gameSession.getCargoSlots(),
      materials: gameSession.getCraftingMaterials(),
      allowEquip: true,
      statLines: summarizeCombatProfile(gameSession.getPlayerCombatProfile()),
    };
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
    this.actionPrimary.setInputEnabled(enabled && this.actionPrimary.container.visible);
    this.actionSecondary.setInputEnabled(enabled && this.actionSecondary.container.visible);
    this.actionTertiary.setInputEnabled(enabled && this.actionTertiary.container.visible);
  }

  private showActionMenu(x: number, y: number): void {
    const item = this.getSelectedItem();
    if (!item || !this.selectedEntry) {
      this.hideActionMenu();
      return;
    }

    this.actionMenu.setVisible(true);
    this.root.bringToTop(this.actionMenu);
    const menuHalfWidth = 114;
    const menuHalfHeight = 103;
    let desiredX = x + 136;
    let desiredY = y;
    if (x + menuHalfWidth + 154 > this.panelBounds.right - 18) {
      desiredX = x - 136;
    }
    if (y + menuHalfHeight > this.panelBounds.bottom - 56) {
      desiredY = y - 118;
    } else if (y - menuHalfHeight < this.panelBounds.top + 62) {
      desiredY = y + 104;
    }
    this.actionMenu.setPosition(
      Phaser.Math.Clamp(desiredX, this.panelBounds.left + menuHalfWidth + 10, this.panelBounds.right - menuHalfWidth - 10),
      Phaser.Math.Clamp(desiredY, this.panelBounds.top + menuHalfHeight + 10, this.panelBounds.bottom - menuHalfHeight - 10),
    );
    this.actionTitle.setText(getItemName(item));
    this.actionBody.setText(describeInventoryItem(item).slice(0, 2).join("\n"));

    const allowEquip = this.currentSnapshot.allowEquip ?? true;
    const canEquip = allowEquip && this.selectedEntry.kind === "cargo" && isGearItem(item);
    const canUnequip = allowEquip && this.selectedEntry.kind === "equipment";
    this.actionPrimary.container.setVisible(canEquip || canUnequip);
    this.actionPrimary.setInputEnabled(canEquip || canUnequip);
    this.actionPrimary.setLabel(canUnequip ? "Unequip" : "Equip");

    const canDrop = allowEquip;
    this.actionSecondary.container.setVisible(canDrop);
    this.actionSecondary.setInputEnabled(canDrop);
    this.actionSecondary.setLabel("Drop");

    this.actionTertiary.container.setVisible(true);
    this.actionTertiary.setInputEnabled(true);
    this.actionTertiary.setLabel("Examine");
  }

  private hideActionMenu(): void {
    this.selectedEntry = null;
    this.actionMenu.setVisible(false);
    this.actionPrimary.container.setVisible(false);
    this.actionSecondary.container.setVisible(false);
    this.actionTertiary.container.setVisible(false);
  }

  private runActionMenuPrimary(): void {
    if (!this.selectedEntry) {
      return;
    }

    if (this.selectedEntry.kind === "cargo") {
      const slotId = gameSession.autoEquipCargoItem(this.selectedEntry.index);
      this.statusText.setText(slotId ? `Equipped into ${this.getSlotLabel(slotId)}.` : "That item cannot be equipped right now.");
    } else {
      const ok = gameSession.unequipItemFromSlot(this.selectedEntry.slotId);
      this.statusText.setText(ok ? `Moved ${this.getSlotLabel(this.selectedEntry.slotId)} item into cargo.` : "No open cargo slot for unequip.");
    }

    this.hideActionMenu();
    this.refresh();
  }

  private runActionMenuDrop(): void {
    if (!this.selectedEntry || (this.currentSnapshot.allowEquip ?? true) === false) {
      return;
    }

    const ok = this.selectedEntry.kind === "cargo"
      ? gameSession.dropCargoItem(this.selectedEntry.index)
      : gameSession.dropEquippedItem(this.selectedEntry.slotId);
    this.statusText.setText(ok ? "Item dropped." : "Drop failed.");
    this.hideActionMenu();
    this.refresh();
  }

  private runActionMenuExamine(): void {
    const item = this.getSelectedItem();
    if (!item) {
      return;
    }

    this.statusText.setText([`Examine page later for ${getItemName(item)}.`, ...describeInventoryItem(item)].join("\n"));
  }
}
