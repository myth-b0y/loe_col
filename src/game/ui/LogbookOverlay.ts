import Phaser from "phaser";

import { getMissionContracts, type MissionContractDefinition } from "../content/missions";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type LogCard = {
  contractId: string;
  frame: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
};

type LogbookOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
};

function getStatusLabel(contractId: string): string {
  if (gameSession.activeMissionId === contractId) {
    return "In Mission";
  }

  if (gameSession.getSelectedMissionId() === contractId) {
    return "Active Route";
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
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly queueSummary: Phaser.GameObjects.Text;
  private readonly queuedHeader: Phaser.GameObjects.Text;
  private readonly emptyQueueText: Phaser.GameObjects.Text;
  private readonly completedToggleFrame: Phaser.GameObjects.Rectangle;
  private readonly completedToggleText: Phaser.GameObjects.Text;
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailBody: Phaser.GameObjects.Text;
  private readonly completedText: Phaser.GameObjects.Text;
  private readonly setActiveButton: MenuButton;
  private readonly abandonButton: MenuButton;
  private readonly closeButton: MenuButton;
  private readonly cards: LogCard[];
  private selectedMissionId = "";
  private completedExpanded = false;

  constructor({ scene, onClose }: LogbookOverlayOptions) {
    this.onClose = onClose;
    const contracts = getMissionContracts();
    this.selectedMissionId = contracts[0]?.id ?? "";

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x01050a, 0.9)
      .setDepth(60)
      .setInteractive();

    const panel = scene.add.rectangle(640, 360, 1080, 610, 0x07111b, 0.985)
      .setDepth(61)
      .setStrokeStyle(3, 0x6e9bd1, 0.84);
    const leftRail = scene.add.rectangle(350, 360, 396, 516, 0x091724, 0.98)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const rightRail = scene.add.rectangle(786, 360, 556, 516, 0x09131f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const title = scene.add.text(126, 92, "Data Pad", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.subtitle = scene.add.text(126, 138, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd4f3",
      wordWrap: { width: 860 },
    }).setDepth(62);

    this.queueSummary = scene.add.text(142, 184, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#9fc6ff",
    }).setDepth(62);

    this.queuedHeader = scene.add.text(152, 220, "QUEUED / ACTIVE", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d9e9ff",
      fontStyle: "bold",
    }).setDepth(62);

    this.emptyQueueText = scene.add.text(198, 264, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#93aac6",
      wordWrap: { width: 292 },
      align: "center",
    }).setOrigin(0.5, 0).setDepth(62);

    this.cards = contracts.map((contract) => {
      const frame = scene.add.rectangle(350, 0, 340, 84, 0x0d1825, 0.97)
        .setDepth(62)
        .setStrokeStyle(2, 0x35577f, 0.78)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      const titleText = scene.add.text(198, 0, contract.title, {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setDepth(63).setVisible(false);
      const status = scene.add.text(198, 0, "", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#9fc6ff",
        wordWrap: { width: 248 },
      }).setDepth(63).setVisible(false);

      frame.on("pointerdown", () => {
        this.selectedMissionId = contract.id;
        this.refresh();
      });

      return {
        contractId: contract.id,
        frame,
        title: titleText,
        status,
      };
    });

    this.completedToggleFrame = scene.add.rectangle(350, 0, 340, 40, 0x0b1724, 0.96)
      .setDepth(62)
      .setStrokeStyle(2, 0x35577f, 0.72)
      .setInteractive({ useHandCursor: true });
    this.completedToggleText = scene.add.text(182, 0, "Completed (0)", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#d7e8ff",
      fontStyle: "bold",
    }).setDepth(63);

    const toggleCompleted = (): void => {
      this.completedExpanded = !this.completedExpanded;
      this.refresh();
    };
    this.completedToggleFrame.on("pointerdown", toggleCompleted);
    this.completedToggleText.setInteractive({ useHandCursor: true });
    this.completedToggleText.on("pointerdown", toggleCompleted);

    this.detailTitle = scene.add.text(564, 188, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f7fbff",
      fontStyle: "bold",
      wordWrap: { width: 470 },
    }).setDepth(62);

    this.detailMeta = scene.add.text(564, 248, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#9fc6ff",
      wordWrap: { width: 470 },
    }).setDepth(62);

    this.detailBody = scene.add.text(564, 288, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d2e3fa",
      lineSpacing: 8,
      wordWrap: { width: 470 },
    }).setDepth(62);

    this.completedText = scene.add.text(564, 536, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#8fb1d6",
      lineSpacing: 6,
      wordWrap: { width: 470 },
    }).setDepth(62);

    this.setActiveButton = createMenuButton({
      scene,
      x: 648,
      y: 604,
      width: 180,
      label: "Set Route",
      onClick: () => {
        if (gameSession.setSelectedMission(this.selectedMissionId)) {
          this.refresh();
        }
      },
      depth: 62,
      accentColor: 0x1f5586,
    });

    this.abandonButton = createMenuButton({
      scene,
      x: 838,
      y: 604,
      width: 180,
      label: "Drop",
      onClick: () => {
        if (gameSession.abandonAcceptedMission(this.selectedMissionId)) {
          this.refresh();
        }
      },
      depth: 62,
      accentColor: 0x5a3a32,
    });

    this.closeButton = createMenuButton({
      scene,
      x: 978,
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
      rightRail,
      title,
      this.subtitle,
      this.queueSummary,
      this.queuedHeader,
      this.emptyQueueText,
      this.completedToggleFrame,
      this.completedToggleText,
      this.detailTitle,
      this.detailMeta,
      this.detailBody,
      this.completedText,
      this.setActiveButton.container,
      this.abandonButton.container,
      this.closeButton.container,
      ...this.cards.flatMap((card) => [card.frame, card.title, card.status]),
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

    this.subtitle.setText("Your Data Pad tracks routed contracts, the current deployment, and archived clears from previous runs.");
    this.queueSummary.setText(
      queuedContracts.length > 0
        ? `Tracked routes: ${queuedContracts.length} | Deploy target: ${(selectedMissionId && contracts.find((contract) => contract.id === selectedMissionId)?.title) ?? (activeMission?.title ?? "none selected")}`
        : "No routed contracts yet. Accept missions at the terminal, then choose one here when you are ready to deploy.",
    );

    this.emptyQueueText.setVisible(queuedContracts.length === 0);
    this.emptyQueueText.setText("No accepted missions yet.\nVisit the mission terminal to queue routes.");

    let nextCardY = 272;
    const visibleCards = new Set<string>();
    queuedContracts.forEach((contract) => {
      const card = this.cards.find((entry) => entry.contractId === contract.id);
      if (!card) {
        return;
      }

      visibleCards.add(contract.id);
      const isSelected = selected?.id === contract.id;
      card.frame.setVisible(true);
      card.title.setVisible(true);
      card.status.setVisible(true);
      card.frame.setPosition(350, nextCardY);
      card.title.setPosition(198, nextCardY - 20);
      card.status.setPosition(198, nextCardY + 10);
      card.frame.setFillStyle(isSelected ? 0x13263a : 0x0d1825, 0.98);
      card.frame.setStrokeStyle(2, isSelected ? contract.accentColor : 0x35577f, isSelected ? 0.98 : 0.78);
      card.status.setText(`${contract.location} | ${getStatusLabel(contract.id)}`);
      nextCardY += 96;
    });

    const completedToggleY = queuedContracts.length > 0 ? nextCardY + 8 : 336;
    this.completedToggleFrame.setPosition(350, completedToggleY);
    this.completedToggleText.setPosition(182, completedToggleY - 10);
    this.completedToggleText.setText(
      `${this.completedExpanded ? "v" : ">"} Completed (${completedContracts.length})`,
    );
    this.completedToggleFrame.setFillStyle(completedContracts.length > 0 ? 0x0b1724 : 0x0a131d, 0.96);
    this.completedToggleFrame.setStrokeStyle(2, completedContracts.length > 0 ? 0x40648e : 0x223447, 0.72);

    if (this.completedExpanded) {
      nextCardY = completedToggleY + 62;
      completedContracts.forEach((contract) => {
        const card = this.cards.find((entry) => entry.contractId === contract.id);
        if (!card) {
          return;
        }

        visibleCards.add(contract.id);
        const isSelected = selected?.id === contract.id;
        card.frame.setVisible(true);
        card.title.setVisible(true);
        card.status.setVisible(true);
        card.frame.setPosition(350, nextCardY);
        card.title.setPosition(198, nextCardY - 20);
        card.status.setPosition(198, nextCardY + 10);
        card.frame.setFillStyle(isSelected ? 0x13263a : 0x0d1825, 0.98);
        card.frame.setStrokeStyle(2, isSelected ? contract.accentColor : 0x35577f, isSelected ? 0.98 : 0.78);
        card.status.setText(`${contract.location} | Completed`);
        nextCardY += 96;
      });
    }

    this.cards.forEach((card) => {
      if (visibleCards.has(card.contractId)) {
        return;
      }

      card.frame.setVisible(false);
      card.title.setVisible(false);
      card.status.setVisible(false);
    });

    if (!selected) {
      this.detailTitle.setText("No Mission Routed");
      this.detailMeta.setText("");
      this.detailBody.setText("Accepted missions will appear here after you queue them at the terminal. Completed missions live under the collapsed archive below.");
      this.completedText.setText(completedContracts.length > 0
        ? "Open the completed archive to review clears from earlier runs."
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
    this.detailMeta.setText(`${selected.location} | ${getStatusLabel(selected.id)}`);
    this.detailBody.setText([
      selected.prompt,
      "",
      `Objective: ${selected.objective}`,
      "",
      "Reward",
      `+${selected.reward.xp} XP | +${selected.reward.credits} Credits`,
      `Recovered Item: ${selected.reward.item}`,
    ]);
    this.completedText.setText(
      inMission
        ? "This contract is currently live in the field."
        : accepted
          ? activeRoute
            ? "This contract is the current deployment target for the ship door."
            : "Queued contract. Set it active here if you want the ship door to launch it next."
          : completed
            ? "Archived clear. Completed missions stay here for review and can be accepted again from the mission terminal."
            : "This route is not currently queued.",
    );

    this.setActiveButton.setEnabled(accepted && !activeRoute && !inMission);
    this.abandonButton.setEnabled(accepted && !inMission);
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.setActiveButton.setInputEnabled(enabled);
    this.abandonButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    if (this.completedToggleFrame.input) {
      this.completedToggleFrame.input.enabled = enabled;
    }
    if (this.completedToggleText.input) {
      this.completedToggleText.input.enabled = enabled;
    }
    this.cards.forEach((card) => {
      if (card.frame.input) {
        card.frame.input.enabled = enabled && card.frame.visible;
      }
    });
  }
}
