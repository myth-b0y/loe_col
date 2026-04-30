import Phaser from "phaser";

import {
  getCurrentMissionActivityStep,
  getMissionContracts,
  type MissionContractDefinition,
} from "../content/missions";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";
import { LayoutDebugOverlay } from "./LayoutDebugOverlay";
import { createLayoutGrid, getGridRegionRect, insetRect } from "./layoutGrid";

type LogbookTab = "inventory" | "skills" | "missions" | "map" | "starship";

type LogbookOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  onOpenSettings?: () => void;
  onRequestTab?: (tab: Exclude<LogbookTab, "missions">) => void;
};

type MissionCardUi = {
  contractId: string;
  frame: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
};

const PANEL_DEPTH = 60;
const FRAME_COLOR = 0x365a82;
const FRAME_ALPHA = 0.82;
const WINDOW = new Phaser.Geom.Rectangle(96, 54, 1088, 612);
const SECTION_FILL = 0x0b1622;
const CARD_FILL = 0x0f1d2d;
const CARD_SELECTED_FILL = 0x12263a;
const TEXT_PRIMARY = "#f5fbff";
const TEXT_SECONDARY = "#dceafd";
const TEXT_DIM = "#8da6c3";
const TAB_LAYOUT = [
  { tab: "inventory", label: "Inventory", x: 428 },
  { tab: "skills", label: "Skills", x: 562 },
  { tab: "missions", label: "Missions", x: 696 },
  { tab: "map", label: "Map", x: 830 },
  { tab: "starship", label: "Starship", x: 964 },
] as const;

function getStatusLabel(contractId: string): string {
  if (gameSession.activeMissionId === contractId) {
    return "In Mission";
  }

  if (gameSession.getSelectedMissionId() === contractId) {
    return "Course Set";
  }

  if (gameSession.isMissionAccepted(contractId)) {
    return "Queued";
  }

  if (gameSession.isMissionCompleted(contractId)) {
    return "Completed";
  }

  return "Unknown";
}

export class LogbookOverlay {
  private readonly onClose: () => void;
  private readonly onOpenSettings: () => void;
  private readonly onRequestTab?: (tab: Exclude<LogbookTab, "missions">) => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly listSummary: Phaser.GameObjects.Text;
  private readonly listEmptyText: Phaser.GameObjects.Text;
  private readonly completedToggleFrame: Phaser.GameObjects.Rectangle;
  private readonly completedToggleText: Phaser.GameObjects.Text;
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailBody: Phaser.GameObjects.Text;
  private readonly detailFooter: Phaser.GameObjects.Text;
  private readonly setActiveButton: MenuButton;
  private readonly abandonButton: MenuButton;
  private readonly closeButton: MenuButton;
  private readonly settingsButton: MenuButton;
  private readonly tabButtons: Partial<Record<LogbookTab, MenuButton>> = {};
  private readonly missionCards: MissionCardUi[];
  private readonly layoutDebug: LayoutDebugOverlay;
  private readonly listRect: Phaser.Geom.Rectangle;
  private selectedMissionId = "";
  private completedExpanded = false;

  constructor({ scene, onClose, onOpenSettings, onRequestTab }: LogbookOverlayOptions) {
    this.onClose = onClose;
    this.onOpenSettings = onOpenSettings ?? onClose;
    this.onRequestTab = onRequestTab;

    const contracts = getMissionContracts();
    this.selectedMissionId = contracts[0]?.id ?? "";

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.14)
      .setDepth(PANEL_DEPTH)
      .setInteractive();
    this.backdrop.on("pointerdown", () => this.hide());

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
      color: TEXT_PRIMARY,
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.subtitle = scene.add.text(WINDOW.x + 24, WINDOW.y + 94, "Mission Log", {
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
    this.listRect = insetRect(getGridRegionRect(grid, { id: 8, col: 2, row: 1, colSpan: 4, rowSpan: 6 }), 12, 10);
    const detailRect = insetRect(getGridRegionRect(grid, { id: 9, col: 7, row: 1, colSpan: 7, rowSpan: 6 }), 12, 10);

    const listPanel = scene.add.rectangle(this.listRect.centerX, this.listRect.centerY, this.listRect.width, this.listRect.height, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);
    const detailPanel = scene.add.rectangle(detailRect.centerX, detailRect.centerY, detailRect.width, detailRect.height, SECTION_FILL, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, FRAME_COLOR, 0.66);

    const listHeader = scene.add.text(this.listRect.x + 44, this.listRect.y + 10, "Mission Log", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: TEXT_PRIMARY,
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const detailHeader = scene.add.text(detailRect.x + 14, detailRect.y + 10, "Details", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: TEXT_PRIMARY,
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.listSummary = scene.add.text(this.listRect.x + 14, this.listRect.y + 42, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9fc6ff",
      wordWrap: { width: this.listRect.width - 28 },
      lineSpacing: 4,
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.listEmptyText = scene.add.text(this.listRect.centerX, this.listRect.y + 164, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: TEXT_DIM,
      align: "center",
      wordWrap: { width: this.listRect.width - 42 },
    }).setOrigin(0.5, 0).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.completedToggleFrame = scene.add.rectangle(this.listRect.centerX, this.listRect.bottom - 44, this.listRect.width - 28, 38, 0x0b1724, 0.96)
      .setDepth(PANEL_DEPTH + 2)
      .setStrokeStyle(2, 0x35577f, 0.72)
      .setInteractive({ useHandCursor: true });
    this.completedToggleText = scene.add.text(this.listRect.x + 22, this.listRect.bottom - 54, "Completed (0)", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#d7e8ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
    const toggleCompleted = (): void => {
      this.completedExpanded = !this.completedExpanded;
      this.refresh();
    };
    this.completedToggleFrame.on("pointerdown", toggleCompleted);
    this.completedToggleText.setInteractive({ useHandCursor: true });
    this.completedToggleText.on("pointerdown", toggleCompleted);

    this.missionCards = contracts.map((contract) => {
      const frame = scene.add.rectangle(this.listRect.centerX, 0, this.listRect.width - 28, 78, CARD_FILL, 0.98)
        .setDepth(PANEL_DEPTH + 2)
        .setStrokeStyle(2, FRAME_COLOR, 0.72)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      const titleText = scene.add.text(this.listRect.x + 22, 0, contract.title, {
        fontFamily: "Arial",
        fontSize: "19px",
        color: TEXT_PRIMARY,
        fontStyle: "bold",
        wordWrap: { width: this.listRect.width - 52 },
      }).setDepth(PANEL_DEPTH + 3).setVisible(false);
      const statusText = scene.add.text(this.listRect.x + 22, 0, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#9fc6ff",
        wordWrap: { width: this.listRect.width - 52 },
      }).setDepth(PANEL_DEPTH + 3).setVisible(false);

      frame.on("pointerdown", () => {
        this.selectedMissionId = contract.id;
        this.refresh();
      });

      return {
        contractId: contract.id,
        frame,
        title: titleText,
        status: statusText,
      };
    });

    this.detailTitle = scene.add.text(detailRect.x + 14, detailRect.y + 42, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: TEXT_PRIMARY,
      fontStyle: "bold",
      wordWrap: { width: detailRect.width - 28 },
      lineSpacing: 6,
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.detailMeta = scene.add.text(detailRect.x + 14, detailRect.y + 108, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#9fc6ff",
      wordWrap: { width: detailRect.width - 28 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.detailBody = scene.add.text(detailRect.x + 14, detailRect.y + 146, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: TEXT_SECONDARY,
      wordWrap: { width: detailRect.width - 28 },
      lineSpacing: 8,
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.detailFooter = scene.add.text(detailRect.x + 14, detailRect.bottom - 116, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: TEXT_DIM,
      wordWrap: { width: detailRect.width - 28 },
      lineSpacing: 5,
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.setActiveButton = createMenuButton({
      scene,
      x: detailRect.x + 122,
      y: detailRect.bottom - 44,
      width: 196,
      height: 40,
      label: "Set Course",
      onClick: () => {
        if (gameSession.setSelectedMission(this.selectedMissionId)) {
          this.refresh();
        }
      },
      depth: PANEL_DEPTH + 2,
      accentColor: 0x214a72,
    });

    this.abandonButton = createMenuButton({
      scene,
      x: detailRect.x + 342,
      y: detailRect.bottom - 44,
      width: 196,
      height: 40,
      label: "Drop Route",
      onClick: () => {
        if (gameSession.abandonAcceptedMission(this.selectedMissionId)) {
          this.refresh();
        }
      },
      depth: PANEL_DEPTH + 2,
      accentColor: 0x5a3b22,
    });

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      panelInset,
      topBar,
      this.title,
      this.subtitle,
      listPanel,
      detailPanel,
      listHeader,
      detailHeader,
      this.listSummary,
      this.listEmptyText,
      this.completedToggleFrame,
      this.completedToggleText,
      this.detailTitle,
      this.detailMeta,
      this.detailBody,
      this.detailFooter,
      this.settingsButton.container,
      this.closeButton.container,
      ...Object.values(this.tabButtons).map((button) => button!.container),
      ...this.missionCards.flatMap((card) => [card.frame, card.title, card.status]),
      this.setActiveButton.container,
      this.abandonButton.container,
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
      { id: 8, col: 2, row: 1, colSpan: 4, rowSpan: 6, color: 0xb45f9f, label: "Mission List" },
      { id: 9, col: 7, row: 1, colSpan: 7, rowSpan: 6, color: 0xb45f9f, label: "Details" },
    ], "Mission Log");

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
  }

  show(): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.layoutDebug.setVisible(false);
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  private handleTab(tab: LogbookTab): void {
    if (tab === "missions") {
      return;
    }

    if (tab === "skills" || tab === "starship") {
      this.detailFooter.setText(`${TAB_LAYOUT.find((entry) => entry.tab === tab)?.label ?? "This"} tab is scaffolded in the new UI system and will be wired in next.`);
      return;
    }

    this.hide();
    this.root.scene.time.delayedCall(0, () => {
      this.onRequestTab?.(tab as Exclude<LogbookTab, "missions">);
    });
  }

  private getQueuedContracts(contracts: MissionContractDefinition[]): MissionContractDefinition[] {
    const queuedIds: string[] = [];
    if (gameSession.activeMissionId) {
      queuedIds.push(gameSession.activeMissionId);
    }

    const selectedMissionId = gameSession.getSelectedMissionId();
    if (selectedMissionId && gameSession.isMissionAccepted(selectedMissionId) && !queuedIds.includes(selectedMissionId)) {
      queuedIds.push(selectedMissionId);
    }

    gameSession.getAcceptedMissionIds().forEach((missionId) => {
      if (!queuedIds.includes(missionId)) {
        queuedIds.push(missionId);
      }
    });

    return queuedIds
      .map((missionId) => contracts.find((contract) => contract.id === missionId))
      .filter((contract): contract is MissionContractDefinition => Boolean(contract));
  }

  private getCompletedContracts(contracts: MissionContractDefinition[]): MissionContractDefinition[] {
    return gameSession.getCompletedMissionIds()
      .map((missionId) => contracts.find((contract) => contract.id === missionId))
      .filter((contract): contract is MissionContractDefinition => Boolean(contract));
  }

  private syncSelection(
    queuedContracts: MissionContractDefinition[],
    completedContracts: MissionContractDefinition[],
  ): void {
    const visibleIds = new Set<string>(queuedContracts.map((contract) => contract.id));
    if (this.completedExpanded) {
      completedContracts.forEach((contract) => visibleIds.add(contract.id));
    }

    if (visibleIds.has(this.selectedMissionId)) {
      return;
    }

    this.selectedMissionId = queuedContracts[0]?.id
      ?? (this.completedExpanded ? completedContracts[0]?.id : undefined)
      ?? "";
  }

  private refresh(): void {
    const contracts = getMissionContracts();
    const queuedContracts = this.getQueuedContracts(contracts);
    const completedContracts = this.getCompletedContracts(contracts);
    this.syncSelection(queuedContracts, completedContracts);

    const selected = contracts.find((contract) => contract.id === this.selectedMissionId);
    const selectedMissionId = gameSession.getSelectedMissionId();
    const activeMission = gameSession.activeMissionId
      ? contracts.find((contract) => contract.id === gameSession.activeMissionId)
      : undefined;

    this.subtitle.setText("Accepted missions, archived clears, and the current set course live here.");
    this.listSummary.setText(
      queuedContracts.length > 0
        ? `Queued missions: ${queuedContracts.length}\nSet course: ${(selectedMissionId && contracts.find((contract) => contract.id === selectedMissionId)?.title) ?? (activeMission?.title ?? "None")}`
        : "No accepted routes yet.\nVisit the mission terminal to queue contracts, then choose one here.",
    );

    this.listEmptyText.setVisible(queuedContracts.length === 0);
    this.listEmptyText.setText("No accepted missions.\nCompleted contracts stay in the archive below.");

    let nextCardY = this.listRect.y + 112;
    const visibleCards = new Set<string>();
    const renderCard = (contract: MissionContractDefinition, statusOverride?: string): void => {
      const card = this.missionCards.find((entry) => entry.contractId === contract.id);
      if (!card) {
        return;
      }

      visibleCards.add(contract.id);
      const isSelected = selected?.id === contract.id;
      card.frame.setVisible(true);
      card.title.setVisible(true);
      card.status.setVisible(true);
      card.frame.setPosition(this.listRect.centerX, nextCardY);
      card.title.setPosition(this.listRect.x + 22, nextCardY - 26);
      card.status.setPosition(this.listRect.x + 22, nextCardY + 4);
      card.frame.setFillStyle(isSelected ? CARD_SELECTED_FILL : CARD_FILL, 0.98);
      card.frame.setStrokeStyle(2, isSelected ? contract.accentColor : FRAME_COLOR, isSelected ? 0.98 : 0.72);
      card.title.setColor(isSelected ? TEXT_PRIMARY : "#dce8f8");
      card.status.setColor(isSelected ? "#cfe4ff" : "#9fc6ff");
      card.status.setText(statusOverride ?? `${contract.location} | ${getStatusLabel(contract.id)}`);
      nextCardY += 92;
    };

    queuedContracts.forEach((contract) => renderCard(contract));

    const completedToggleY = this.listRect.bottom - 44;
    this.completedToggleFrame.setPosition(this.listRect.centerX, completedToggleY);
    this.completedToggleText.setPosition(this.listRect.x + 22, completedToggleY - 10);
    this.completedToggleText.setText(`${this.completedExpanded ? "v" : ">"} Completed (${completedContracts.length})`);
    this.completedToggleFrame.setFillStyle(completedContracts.length > 0 ? 0x0b1724 : 0x0a131d, 0.96);
    this.completedToggleFrame.setStrokeStyle(2, completedContracts.length > 0 ? 0x40648e : 0x223447, 0.72);

    if (this.completedExpanded) {
      nextCardY = completedToggleY + 62;
      completedContracts.forEach((contract) => renderCard(contract, `${contract.location} | Completed`));
    }

    this.missionCards.forEach((card) => {
      if (visibleCards.has(card.contractId)) {
        return;
      }

      card.frame.setVisible(false);
      card.title.setVisible(false);
      card.status.setVisible(false);
    });

    if (!selected) {
      this.detailTitle.setText("No Route Selected");
      this.detailMeta.setText("");
      this.detailBody.setText("Queue a mission from the terminal, then pick it here to make it the active deployment route.");
      this.detailFooter.setText(completedContracts.length > 0
        ? "Open the completed archive to review past clears."
        : "No completed missions recorded yet.");
      this.setActiveButton.setEnabled(false);
      this.abandonButton.setEnabled(false);
      return;
    }

    const accepted = gameSession.isMissionAccepted(selected.id);
    const completed = gameSession.isMissionCompleted(selected.id);
    const activeRoute = gameSession.getSelectedMissionId() === selected.id;
    const inMission = gameSession.activeMissionId === selected.id;

    this.detailTitle.setText(selected.title);
    const activityState = gameSession.getMissionActivityState(selected.id);
    const currentStep = getCurrentMissionActivityStep(selected, activityState);
    this.detailMeta.setText(`${selected.location} | ${getStatusLabel(selected.id)} | ${selected.source.label}`);
    this.detailBody.setText([
      selected.prompt,
      "",
      `Objective: ${selected.objective}`,
      currentStep ? `Current step: ${currentStep.objective}` : "",
      "",
      `Rewards: +${selected.baseXp} XP | ${selected.rewardPreview.dropLines.join(" | ")} | ${selected.rewardPreview.salvageLine}`,
    ].filter(Boolean).join("\n"));
    this.detailFooter.setText(
      inMission
        ? "This contract is currently live in the field."
        : accepted
          ? activeRoute
            ? "This mission is your set course. Waypoints are visible only for this accepted mission."
            : "Queued mission. Set course here when you want its waypoint and route active."
          : completed
            ? "Archived story clear. Completed routes are removed from the mission terminal and kept here for review."
            : "This contract is not currently queued.",
    );

    this.setActiveButton.setEnabled(accepted && !activeRoute && !inMission);
    this.abandonButton.setEnabled(accepted && !inMission);
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.settingsButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    this.setActiveButton.setInputEnabled(enabled);
    this.abandonButton.setInputEnabled(enabled);
    Object.values(this.tabButtons).forEach((button) => button?.setInputEnabled(enabled));
    if (this.completedToggleFrame.input) {
      this.completedToggleFrame.input.enabled = enabled;
    }
    if (this.completedToggleText.input) {
      this.completedToggleText.input.enabled = enabled;
    }

    this.missionCards.forEach((card) => {
      if (card.frame.input) {
        card.frame.input.enabled = enabled && card.frame.visible;
      }
    });
  }
}
