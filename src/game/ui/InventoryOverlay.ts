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
import { LayoutDebugOverlay } from "./LayoutDebugOverlay";
import { createLayoutGrid, getGridRegionRect, insetRect } from "./layoutGrid";

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

type InventoryTab = "inventory" | "skills" | "missions" | "map" | "starship";

type InventoryOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  getSnapshot?: () => InventoryOverlaySnapshot;
  onOpenSettings?: () => void;
  onRequestTab?: (tab: Exclude<InventoryTab, "inventory">) => void;
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
const FRAME_ALPHA = 0.82;
const SECTION_FILL = 0x0b1622;
const SLOT_FILL = 0x0f1d2d;
const SLOT_INNER = 0x12263a;
const SELECTED_COLOR = 0xdab66b;
const TEXT_PRIMARY = "#f5fbff";
const TEXT_SECONDARY = "#dceafd";
const TEXT_DIM = "#8da6c3";
const WINDOW = new Phaser.Geom.Rectangle(96, 54, 1088, 612);
const TAB_LAYOUT = [
  { tab: "inventory", label: "Inventory", x: 428 },
  { tab: "skills", label: "Skills", x: 562 },
  { tab: "missions", label: "Missions", x: 696 },
  { tab: "map", label: "Map", x: 830 },
  { tab: "starship", label: "Starship", x: 964 },
] as const;

export class InventoryOverlay {
  private readonly onClose: () => void;
  private readonly onOpenSettings: () => void;
  private readonly onRequestTab?: (tab: Exclude<InventoryTab, "inventory">) => void;
  private readonly getSnapshot: () => InventoryOverlaySnapshot;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly currencyText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly selectedText: Phaser.GameObjects.Text;
  private readonly characterWell: Phaser.GameObjects.Rectangle;
  private readonly characterRing: Phaser.GameObjects.Ellipse;
  private readonly equipmentSlots: EquipmentSlotUi[];
  private readonly cargoCells: CargoCellUi[];
  private readonly closeButton: MenuButton;
  private readonly settingsButton: MenuButton;
  private readonly tabButtons: Partial<Record<InventoryTab, MenuButton>> = {};
  private readonly prevPageButton: MenuButton;
  private readonly nextPageButton: MenuButton;
  private readonly pageText: Phaser.GameObjects.Text;
  private readonly actionMenu: Phaser.GameObjects.Container;
  private readonly actionTitle: Phaser.GameObjects.Text;
  private readonly actionBody: Phaser.GameObjects.Text;
  private readonly actionPrimary: MenuButton;
  private readonly actionSecondary: MenuButton;
  private readonly actionTertiary: MenuButton;
  private readonly layoutDebug: LayoutDebugOverlay;
  private selectedEntry: InventorySelection | null = null;
  private currentSnapshot!: InventoryOverlaySnapshot;
  private cargoPage = 0;

  constructor({ scene, onClose, getSnapshot, onOpenSettings, onRequestTab }: InventoryOverlayOptions) {
    this.onClose = onClose;
    this.onOpenSettings = onOpenSettings ?? onClose;
    this.onRequestTab = onRequestTab;
    this.getSnapshot = getSnapshot ?? (() => this.getDefaultSnapshot());

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.14)
      .setDepth(PANEL_DEPTH)
      .setInteractive();
    this.backdrop.on("pointerdown", () => {
      if (this.actionMenu.visible) {
        this.hideActionMenu();
        this.refresh();
        return;
      }
      this.hide();
    });

    const panel = scene.add.rectangle(WINDOW.centerX, WINDOW.centerY, WINDOW.width, WINDOW.height, 0x08111b, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(3, FRAME_COLOR, FRAME_ALPHA);
    const panelInset = scene.add.rectangle(WINDOW.centerX, WINDOW.centerY, WINDOW.width - 18, WINDOW.height - 18, 0x091724, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(1, 0x294563, 0.72);
    const topBar = scene.add.rectangle(WINDOW.centerX, WINDOW.y + 42, WINDOW.width - 40, 58, 0x0b1522, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, 0x294563, 0.78);

    this.title = scene.add.text(WINDOW.x + 24, WINDOW.y + 20, "Data Pad", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.subtitle = scene.add.text(WINDOW.x + 24, WINDOW.y + 94, "Inventory", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd2ec",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.settingsButton = createMenuButton({
      scene,
      x: WINDOW.x + 54,
      y: WINDOW.y + 58,
      width: 84,
      height: 36,
      label: "Pause",
      onClick: () => {
        this.hide();
        this.onOpenSettings();
      },
      depth: PANEL_DEPTH + 2,
      accentColor: 0x283d59,
    });

    TAB_LAYOUT.forEach(({ tab, label, x }) => {
      this.tabButtons[tab] = createMenuButton({
        scene,
        x,
        y: WINDOW.y + 58,
        width: tab === "starship" ? 126 : 118,
        height: 36,
        label,
        onClick: () => this.handleTab(tab),
        depth: PANEL_DEPTH + 2,
        accentColor: 0x214467,
      });
    });
    this.tabButtons.skills?.setEnabled(false);
    this.tabButtons.map?.setEnabled(false);
    this.tabButtons.starship?.setEnabled(false);

    this.closeButton = createMenuButton({
      scene,
      x: WINDOW.right - 54,
      y: WINDOW.y + 58,
      width: 84,
      height: 36,
      label: "Close",
      onClick: () => this.hide(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x283d59,
    });

    const grid = createLayoutGrid(new Phaser.Geom.Rectangle(0, 0, 1280, 720));
    const gearRect = insetRect(getGridRegionRect(grid, { id: 8, col: 2, row: 1, colSpan: 3, rowSpan: 4 }), 12, 10);
    const charRect = insetRect(getGridRegionRect(grid, { id: 16, col: 6, row: 1, colSpan: 4, rowSpan: 4 }), 12, 10);
    const statsRect = insetRect(getGridRegionRect(grid, { id: 17, col: 11, row: 1, colSpan: 3, rowSpan: 4 }), 12, 10);
    const cargoRect = insetRect(getGridRegionRect(grid, { id: 18, col: 2, row: 6, colSpan: 13, rowSpan: 2 }), 12, 8);

    const gearPanel = scene.add.rectangle(gearRect.centerX, gearRect.centerY, gearRect.width, gearRect.height, SECTION_FILL, 0.98).setDepth(PANEL_DEPTH + 1).setStrokeStyle(2, FRAME_COLOR, 0.66);
    const charPanel = scene.add.rectangle(charRect.centerX, charRect.centerY, charRect.width, charRect.height, SECTION_FILL, 0.98).setDepth(PANEL_DEPTH + 1).setStrokeStyle(2, FRAME_COLOR, 0.66);
    const statsPanel = scene.add.rectangle(statsRect.centerX, statsRect.centerY, statsRect.width, statsRect.height, SECTION_FILL, 0.98).setDepth(PANEL_DEPTH + 1).setStrokeStyle(2, FRAME_COLOR, 0.66);
    const cargoPanel = scene.add.rectangle(cargoRect.centerX, cargoRect.centerY, cargoRect.width, cargoRect.height, SECTION_FILL, 0.98).setDepth(PANEL_DEPTH + 1).setStrokeStyle(2, FRAME_COLOR, 0.66);

    const gearHeader = scene.add.text(gearRect.x + 44, gearRect.y + 8, "Equipment", { fontFamily: "Arial", fontSize: "20px", color: "#eef6ff", fontStyle: "bold" }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const cargoHeader = scene.add.text(cargoRect.x + 14, cargoRect.y + 8, "Cargo", { fontFamily: "Arial", fontSize: "20px", color: "#eef6ff", fontStyle: "bold" }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const statsHeader = scene.add.text(statsRect.x + 14, statsRect.y + 8, "Stats", { fontFamily: "Arial", fontSize: "20px", color: "#eef6ff", fontStyle: "bold" }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.characterWell = scene.add.rectangle(charRect.centerX, charRect.centerY - 8, charRect.width - 24, charRect.height - 30, 0x0a1520, 0.98).setDepth(PANEL_DEPTH + 2).setStrokeStyle(2, FRAME_COLOR, 0.44);
    const characterBeam = scene.add.triangle(charRect.centerX, charRect.y + 78, 0, 0, 164, 0, 82, 136, 0x64a8ff, 0.08).setDepth(PANEL_DEPTH + 2);
    const characterHead = scene.add.circle(charRect.centerX, charRect.y + 122, 32, 0x10314f, 0.3).setDepth(PANEL_DEPTH + 3).setStrokeStyle(4, 0xb7d5ff, 0.38);
    const characterTorso = scene.add.rectangle(charRect.centerX, charRect.y + 218, 102, 126, 0x102842, 0.2).setDepth(PANEL_DEPTH + 3).setStrokeStyle(4, 0xb7d5ff, 0.38);
    this.characterRing = scene.add.ellipse(charRect.centerX, charRect.bottom - 44, 116, 38, 0x4c9dff, 0.12).setDepth(PANEL_DEPTH + 2).setStrokeStyle(2, 0x5ba8ff, 0.46);

    this.statsText = scene.add.text(statsRect.x + 14, statsRect.y + 38, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#e2eefc",
      lineSpacing: 4,
      wordWrap: { width: statsRect.width - 26 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const selectedHeader = scene.add.text(statsRect.x + 14, statsRect.y + 234, "Selection", { fontFamily: "Arial", fontSize: "16px", color: "#dceaff", fontStyle: "bold" }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    this.selectedText = scene.add.text(statsRect.x + 14, statsRect.y + 260, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: TEXT_DIM,
      lineSpacing: 4,
      wordWrap: { width: statsRect.width - 26 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.statusText = scene.add.text(cargoRect.x + 14, cargoRect.bottom - 28, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9eb7d7",
      wordWrap: { width: cargoRect.width - 340 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.currencyText = scene.add.text(cargoRect.right - 132, cargoRect.bottom - 34, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d9e9fb",
      fontStyle: "bold",
      align: "right",
      lineSpacing: 2,
    }).setOrigin(1, 0).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    const slotPositions: Record<EquipmentSlotId, { x: number; y: number; width: number; height: number }> = {
      head: { x: gearRect.x + 122, y: gearRect.y + 72, width: 96, height: 52 },
      belt: { x: gearRect.x + 20, y: gearRect.y + 138, width: 96, height: 52 },
      chest: { x: gearRect.x + 122, y: gearRect.y + 138, width: 96, height: 52 },
      back: { x: gearRect.x + 224, y: gearRect.y + 138, width: 96, height: 52 },
      leftHand: { x: gearRect.x + 20, y: gearRect.y + 204, width: 96, height: 52 },
      legs: { x: gearRect.x + 122, y: gearRect.y + 204, width: 96, height: 52 },
      rightHand: { x: gearRect.x + 224, y: gearRect.y + 204, width: 96, height: 52 },
      accessory1: { x: gearRect.x + 20, y: gearRect.y + 270, width: 96, height: 52 },
      accessory2: { x: gearRect.x + 122, y: gearRect.y + 270, width: 96, height: 52 },
      accessory3: { x: gearRect.x + 224, y: gearRect.y + 270, width: 96, height: 52 },
    };

    this.equipmentSlots = EQUIPMENT_SLOTS.map((slot) => {
      const position = slotPositions[slot.id];
      const frame = scene.add.rectangle(position.x + position.width / 2, position.y + position.height / 2, position.width, position.height, SLOT_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.7)
        .setInteractive({ useHandCursor: true });
      const slotLabel = scene.add.text(frame.x, position.y + 8, slot.label.toUpperCase(), {
        fontFamily: "Arial",
        fontSize: slot.id.startsWith("accessory") ? "11px" : "12px",
        color: "#90a8c7",
        fontStyle: "bold",
      }).setOrigin(0.5, 0).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
      const itemLabel = scene.add.text(frame.x, frame.y + 6, "", {
        fontFamily: "Arial",
        fontSize: slot.id.startsWith("accessory") ? "12px" : "13px",
        color: "#f5fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: position.width - 16 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
      frame.on("pointerdown", () => this.onEquipmentSlotClicked(slot.id));
      return { slotId: slot.id, frame, slotLabel, itemLabel };
    });

    const cargoColumns = 12;
    const cargoCellGap = 8;
    const cargoCellSize = 64;
    this.cargoCells = Array.from({ length: 12 }, (_, index) => {
      const column = index % cargoColumns;
      const row = Math.floor(index / cargoColumns);
      const x = cargoRect.x + 48 + cargoCellSize / 2 + column * (cargoCellSize + cargoCellGap);
      const y = cargoRect.y + 84 + row * (cargoCellSize + cargoCellGap);
      const frame = scene.add.rectangle(x, y, cargoCellSize, cargoCellSize, SLOT_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.62)
        .setInteractive({ useHandCursor: true });
      const itemLabel = scene.add.text(x, y, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#f5fbff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 66 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
      const hotkeyLabel = scene.add.text(x - 36, y - 38, `${index + 1}`, {
        fontFamily: "Arial",
        fontSize: "10px",
        color: "#6f88a7",
        fontStyle: "bold",
      }).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
      frame.on("pointerdown", () => this.onCargoCellClicked(index));
      return { index, frame, itemLabel, hotkeyLabel };
    });

    this.prevPageButton = createMenuButton({ scene, x: cargoRect.right - 120, y: cargoRect.y + 22, width: 34, height: 26, label: "<", onClick: () => this.changeCargoPage(-1), depth: PANEL_DEPTH + 3, accentColor: 0x26405f });
    this.nextPageButton = createMenuButton({ scene, x: cargoRect.right - 38, y: cargoRect.y + 22, width: 34, height: 26, label: ">", onClick: () => this.changeCargoPage(1), depth: PANEL_DEPTH + 3, accentColor: 0x26405f });
    this.pageText = scene.add.text(cargoRect.right - 79, cargoRect.y + 12, "1/1", { fontFamily: "Arial", fontSize: "12px", color: "#cfe0f7", fontStyle: "bold" }).setOrigin(0.5, 0).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);

    const actionPanel = scene.add.rectangle(640, 360, 286, 220, 0x09131f, 0.98).setStrokeStyle(2, 0x6b93be, 0.82).setScrollFactor(0);
    this.actionTitle = scene.add.text(640, 282, "", { fontFamily: "Arial", fontSize: "20px", color: "#f7fbff", fontStyle: "bold", align: "center", wordWrap: { width: 220 } }).setOrigin(0.5).setDepth(PANEL_DEPTH + 6).setScrollFactor(0);
    this.actionBody = scene.add.text(640, 320, "", { fontFamily: "Arial", fontSize: "13px", color: "#b8cfe9", align: "center", wordWrap: { width: 220 } }).setOrigin(0.5, 0).setDepth(PANEL_DEPTH + 6).setScrollFactor(0);
    this.actionPrimary = createMenuButton({ scene, x: 640, y: 390, width: 186, height: 34, label: "Equip", onClick: () => this.runActionMenuPrimary(), depth: PANEL_DEPTH + 6, accentColor: 0x214a72 });
    this.actionSecondary = createMenuButton({ scene, x: 640, y: 430, width: 186, height: 30, label: "Drop", onClick: () => this.runActionMenuDrop(), depth: PANEL_DEPTH + 6, accentColor: 0x5a3b22 });
    this.actionTertiary = createMenuButton({ scene, x: 640, y: 468, width: 186, height: 30, label: "Examine", onClick: () => this.runActionMenuExamine(), depth: PANEL_DEPTH + 6, accentColor: 0x263f5f });
    this.actionMenu = scene.add.container(0, 0, [actionPanel, this.actionTitle, this.actionBody, this.actionPrimary.container, this.actionSecondary.container, this.actionTertiary.container]).setDepth(PANEL_DEPTH + 5).setVisible(false);
    this.actionMenu.setScrollFactor(0);

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      panelInset,
      topBar,
      this.title,
      this.subtitle,
      gearPanel,
      charPanel,
      statsPanel,
      cargoPanel,
      gearHeader,
      cargoHeader,
      statsHeader,
      this.characterWell,
      characterBeam,
      characterHead,
      characterTorso,
      this.characterRing,
      this.statsText,
      selectedHeader,
      this.selectedText,
      this.statusText,
      this.currencyText,
      this.settingsButton.container,
      this.closeButton.container,
      ...Object.values(this.tabButtons).map((button) => button!.container),
      ...this.equipmentSlots.flatMap((slot) => [slot.frame, slot.slotLabel, slot.itemLabel]),
      ...this.cargoCells.flatMap((cell) => [cell.frame, cell.itemLabel, cell.hotkeyLabel]),
      this.prevPageButton.container,
      this.nextPageButton.container,
      this.pageText,
      this.actionMenu,
    ]).setDepth(PANEL_DEPTH);
    this.root.iterate((child: Phaser.GameObjects.GameObject) => {
      (child as Phaser.GameObjects.GameObject & { setScrollFactor?: (x: number, y?: number) => void }).setScrollFactor?.(0, 0);
    });

    this.layoutDebug = new LayoutDebugOverlay(scene, 140);
    this.layoutDebug.draw(new Phaser.Geom.Rectangle(0, 0, 1280, 720), [
      { id: 1, col: 1, row: 0, colSpan: 1, rowSpan: 1, color: 0x6ea6d8, label: "Pause" },
      { id: 2, col: 2, row: 0, colSpan: 2, rowSpan: 1, color: 0x6ea6d8, label: "Inventory" },
      { id: 3, col: 4, row: 0, colSpan: 2, rowSpan: 1, color: 0x6ea6d8, label: "Skills" },
      { id: 4, col: 6, row: 0, colSpan: 2, rowSpan: 1, color: 0x6ea6d8, label: "Missions" },
      { id: 5, col: 8, row: 0, colSpan: 2, rowSpan: 1, color: 0x6ea6d8, label: "Map" },
      { id: 6, col: 10, row: 0, colSpan: 2, rowSpan: 1, color: 0x6ea6d8, label: "Starship" },
      { id: 7, col: 12, row: 0, colSpan: 1, rowSpan: 1, color: 0x6ea6d8, label: "Exit" },
      { id: 8, col: 2, row: 1, colSpan: 3, rowSpan: 4, color: 0x8a75d6, label: "Gear" },
      { id: 16, col: 6, row: 1, colSpan: 4, rowSpan: 4, color: 0xb0ad60, label: "Character" },
      { id: 17, col: 11, row: 1, colSpan: 3, rowSpan: 4, color: 0xb45f9f, label: "Stats" },
      { id: 18, col: 2, row: 6, colSpan: 13, rowSpan: 2, color: 0x8a75d6, label: "Cargo" },
    ], "Inventory");

    const keyboard = scene.input.keyboard;
    keyboard?.on("keydown-F7", () => {
      if (this.isVisible()) {
        this.layoutDebug.toggle();
      }
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.removeAllListeners("keydown-F7");
      this.layoutDebug.destroy();
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
    this.layoutDebug.setVisible(false);
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  toggleLayoutDebug(): void {
    if (this.isVisible()) {
      this.layoutDebug.toggle();
    }
  }

  refresh(): void {
    this.currentSnapshot = this.getSnapshot();
    const { equipment, cargo, materials } = this.currentSnapshot;
    const allowEquip = this.currentSnapshot.allowEquip ?? true;
    const selectedItem = this.getSelectedItem();
    const pageSize = this.cargoCells.length;
    const pageCount = Math.max(1, Math.ceil(cargo.length / pageSize));
    this.cargoPage = Phaser.Math.Clamp(this.cargoPage, 0, pageCount - 1);

    this.title.setText(this.currentSnapshot.title ?? "Data Pad");
    this.subtitle.setText(this.currentSnapshot.subtitle ?? "Inventory");
    this.currencyText.setText((this.currentSnapshot.currencyLines ?? [
      `Credits: ${gameSession.saveData.profile.credits}`,
      ...(describeCraftingMaterials(materials).length > 0 ? [describeCraftingMaterials(materials).join(" | ")] : ["No salvage"]) ,
    ]).join("\n"));
    this.statsText.setText((this.currentSnapshot.statLines ?? summarizeCombatProfile(gameSession.getPlayerCombatProfile())).join("\n"));
    this.pageText.setText(`${this.cargoPage + 1}/${pageCount}`);
    const showPager = pageCount > 1;
    this.prevPageButton.container.setVisible(showPager);
    this.nextPageButton.container.setVisible(showPager);
    this.prevPageButton.setInputEnabled(showPager && this.cargoPage > 0);
    this.nextPageButton.setInputEnabled(showPager && this.cargoPage < pageCount - 1);

    this.equipmentSlots.forEach((slot) => {
      const item = equipment[slot.slotId];
      const isSelected = this.selectedEntry?.kind === "equipment" && this.selectedEntry.slotId === slot.slotId;
      slot.itemLabel.setText(item ? getItemShortLabel(item) : "Empty");
      slot.itemLabel.setColor(item ? TEXT_PRIMARY : TEXT_DIM);
      slot.frame.setStrokeStyle(2, isSelected ? SELECTED_COLOR : item ? getItemColor(item) : FRAME_COLOR, isSelected ? 0.98 : item ? 0.84 : 0.7);
      slot.frame.setFillStyle(isSelected ? SLOT_INNER : SLOT_FILL, 0.98);
    });

    this.cargoCells.forEach((cell) => {
      const cargoIndex = this.cargoPage * pageSize + cell.index;
      const item = cargo[cargoIndex] ?? null;
      const isSelected = this.selectedEntry?.kind === "cargo" && this.selectedEntry.index === cargoIndex;
      cell.hotkeyLabel.setText(`${cargoIndex + 1}`);
      cell.itemLabel.setText(item ? getItemShortLabel(item) : "");
      cell.itemLabel.setColor(item ? TEXT_PRIMARY : TEXT_DIM);
      cell.frame.setStrokeStyle(2, isSelected ? SELECTED_COLOR : item ? getItemColor(item) : FRAME_COLOR, isSelected ? 0.98 : item ? 0.84 : 0.62);
      cell.frame.setFillStyle(isSelected ? SLOT_INNER : SLOT_FILL, 0.98);
      cell.hotkeyLabel.setAlpha(item ? 0.85 : 0.32);
    });

    if (!selectedItem) {
      this.selectedText.setColor(TEXT_DIM);
      this.selectedText.setText(this.currentSnapshot.emptyStatusText ?? "No item selected. Choose cargo or gear to inspect it.");
      this.statusText.setText(allowEquip
        ? "F7 toggles layout debug. Missions tab is live; the other tabs are scaffolded."
        : "Mission view is read-only for now. Inspect run loot and gear without changing loadout.");
      return;
    }

    this.selectedText.setColor(TEXT_SECONDARY);
    this.selectedText.setText([getItemName(selectedItem), ...describeInventoryItem(selectedItem)].join("\n"));
    this.statusText.setText(allowEquip
      ? "Select an item, then use the centered popup to equip, unequip, drop, or examine."
      : "Mission view is read-only. Inspect your recovered gear here.");
  }

  private handleTab(tab: InventoryTab): void {
    if (tab === "inventory") {
      return;
    }

    if (tab === "skills" || tab === "map" || tab === "starship") {
      this.statusText.setText(`${TAB_LAYOUT.find((entry) => entry.tab === tab)?.label ?? "This"} tab is scaffolded in the new UI system and will be wired in next.`);
      return;
    }

    this.hide();
    this.root.scene.time.delayedCall(0, () => {
      this.onRequestTab?.(tab as Exclude<InventoryTab, "inventory">);
    });
  }

  private changeCargoPage(delta: number): void {
    this.cargoPage = Math.max(0, this.cargoPage + delta);
    this.selectedEntry = null;
    this.hideActionMenu();
    this.refresh();
  }

  private onCargoCellClicked(localIndex: number): void {
    const cargoIndex = this.cargoPage * this.cargoCells.length + localIndex;
    const item = this.currentSnapshot.cargo[cargoIndex] ?? null;
    this.selectedEntry = item ? { kind: "cargo", index: cargoIndex } : null;
    if (item) {
      this.showActionMenu(item);
    } else {
      this.hideActionMenu();
    }
    this.refresh();
  }

  private onEquipmentSlotClicked(slotId: EquipmentSlotId): void {
    const item = this.currentSnapshot.equipment[slotId];
    this.selectedEntry = item ? { kind: "equipment", slotId } : null;
    if (item) {
      this.showActionMenu(item);
    } else {
      this.hideActionMenu();
    }
    this.refresh();
  }

  private showActionMenu(item: InventoryItem): void {
    const allowEquip = this.currentSnapshot.allowEquip ?? true;
    const canEquip = allowEquip && this.selectedEntry?.kind === "cargo" && isGearItem(item);
    const canUnequip = allowEquip && this.selectedEntry?.kind === "equipment";
    this.actionMenu.setVisible(true);
    this.actionTitle.setText(getItemName(item));
    this.actionBody.setText(describeInventoryItem(item).slice(0, 3).join("\n"));
    this.actionPrimary.container.setVisible(canEquip || canUnequip);
    this.actionPrimary.setLabel(canUnequip ? "Unequip" : "Equip");
    this.actionPrimary.setInputEnabled(canEquip || canUnequip);
    this.actionSecondary.container.setVisible(allowEquip);
    this.actionSecondary.setInputEnabled(allowEquip);
    this.actionTertiary.container.setVisible(true);
    this.actionTertiary.setInputEnabled(true);
  }

  private hideActionMenu(): void {
    this.selectedEntry = null;
    this.actionMenu.setVisible(false);
    this.actionPrimary.container.setVisible(false);
    this.actionSecondary.container.setVisible(false);
    this.actionTertiary.container.setVisible(false);
  }

  private getSelectedItem(): InventoryItem | null {
    if (!this.selectedEntry) {
      return null;
    }
    return this.selectedEntry.kind === "cargo"
      ? this.currentSnapshot.cargo[this.selectedEntry.index] ?? null
      : this.currentSnapshot.equipment[this.selectedEntry.slotId];
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }
    this.settingsButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    Object.values(this.tabButtons).forEach((button) => button?.setInputEnabled(enabled));
    this.prevPageButton.setInputEnabled(enabled && this.prevPageButton.container.visible);
    this.nextPageButton.setInputEnabled(enabled && this.nextPageButton.container.visible);
    this.actionPrimary.setInputEnabled(enabled && this.actionPrimary.container.visible);
    this.actionSecondary.setInputEnabled(enabled && this.actionSecondary.container.visible);
    this.actionTertiary.setInputEnabled(enabled && this.actionTertiary.container.visible);
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

  private runActionMenuPrimary(): void {
    if (!this.selectedEntry) {
      return;
    }
    if (this.selectedEntry.kind === "cargo") {
      gameSession.autoEquipCargoItem(this.selectedEntry.index);
    } else {
      gameSession.unequipItemFromSlot(this.selectedEntry.slotId);
    }
    this.hideActionMenu();
    this.refresh();
  }

  private runActionMenuDrop(): void {
    if (!this.selectedEntry || (this.currentSnapshot.allowEquip ?? true) === false) {
      return;
    }
    if (this.selectedEntry.kind === "cargo") {
      gameSession.dropCargoItem(this.selectedEntry.index);
    } else {
      gameSession.dropEquippedItem(this.selectedEntry.slotId);
    }
    this.hideActionMenu();
    this.refresh();
  }

  private runActionMenuExamine(): void {
    const item = this.getSelectedItem();
    if (!item) {
      return;
    }
    this.selectedText.setText([`Examine | ${getItemName(item)}`, ...describeInventoryItem(item)].join("\n"));
  }

  private getDefaultSnapshot(): InventoryOverlaySnapshot {
    return {
      equipment: gameSession.getEquipmentLoadout(),
      cargo: gameSession.getCargoSlots(),
      materials: gameSession.getCraftingMaterials(),
      allowEquip: true,
      statLines: summarizeCombatProfile(gameSession.getPlayerCombatProfile()),
      subtitle: "Inventory",
    };
  }
}
