import Phaser from "phaser";

import { getMissionContracts, type MissionContractDefinition } from "../content/missions";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type MissionCard = {
  contractId: string;
  frame: Phaser.GameObjects.Rectangle;
  badge: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  location: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  action: MenuButton;
};

type MissionBoardOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
};

function getDifficultyLabel(contract: MissionContractDefinition): string {
  if (contract.difficulty === "easy") {
    return "Easy";
  }

  if (contract.difficulty === "medium") {
    return "Medium";
  }

  return "Hard";
}

export class MissionBoardOverlay {
  private readonly onClose: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailBody: Phaser.GameObjects.Text;
  private readonly detailReward: Phaser.GameObjects.Text;
  private readonly acceptAllButton: MenuButton;
  private readonly closeButton: MenuButton;
  private readonly cards: MissionCard[];
  private selectedMissionId: string;

  constructor({ scene, onClose }: MissionBoardOverlayOptions) {
    this.onClose = onClose;
    const contracts = getMissionContracts();
    this.selectedMissionId = contracts[0]?.id ?? "";

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x01050a, 0.9)
      .setDepth(60)
      .setInteractive();

    const panel = scene.add.rectangle(640, 360, 1100, 610, 0x06101a, 0.985)
      .setDepth(61)
      .setStrokeStyle(3, 0x6e9bd1, 0.84);
    const leftRail = scene.add.rectangle(338, 360, 408, 522, 0x091724, 0.98)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const rightRail = scene.add.rectangle(790, 360, 612, 522, 0x09131f, 0.985)
      .setDepth(61)
      .setStrokeStyle(2, 0x274566, 0.82);
    const title = scene.add.text(126, 92, "Mission Terminal", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setDepth(62);

    this.subtitle = scene.add.text(126, 138, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd4f3",
      wordWrap: { width: 900 },
    }).setDepth(62);

    this.statusText = scene.add.text(126, 636, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d7e8ff",
    }).setDepth(62);

    this.detailTitle = scene.add.text(570, 188, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f7fbff",
      fontStyle: "bold",
      wordWrap: { width: 480 },
    }).setDepth(62);

    this.detailBody = scene.add.text(570, 244, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d2e3fa",
      lineSpacing: 8,
      wordWrap: { width: 480 },
    }).setDepth(62);

    this.detailReward = scene.add.text(570, 520, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#8fc9ff",
      lineSpacing: 6,
      wordWrap: { width: 480 },
    }).setDepth(62);

    this.cards = contracts.map((contract, index) => {
      const y = 226 + index * 148;
      const frame = scene.add.rectangle(338, y, 360, 120, 0x0c1725, 0.97)
        .setDepth(62)
        .setStrokeStyle(2, 0x37577e, 0.78)
        .setInteractive({ useHandCursor: true });
      const badge = scene.add.text(182, y - 42, getDifficultyLabel(contract).toUpperCase(), {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#f6fbff",
        fontStyle: "bold",
        backgroundColor: `#${contract.accentColor.toString(16).padStart(6, "0")}99`,
        padding: { x: 8, y: 4 },
      }).setDepth(63);
      const titleText = scene.add.text(182, y - 10, contract.title, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setDepth(63);
      const location = scene.add.text(182, y + 20, contract.location, {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#bdd4f3",
      }).setDepth(63);
      const status = scene.add.text(182, y + 46, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#8fc9ff",
      }).setDepth(63);
      const action = createMenuButton({
        scene,
        x: 456,
        y,
        width: 108,
        height: 40,
        label: "Accept",
        onClick: () => this.acceptMission(contract.id),
        depth: 63,
        accentColor: 0x1e4f7d,
      });

      frame.on("pointerdown", () => {
        this.selectedMissionId = contract.id;
        this.refresh();
      });

      return {
        contractId: contract.id,
        frame,
        badge,
        title: titleText,
        location,
        status,
        action,
      };
    });

    this.acceptAllButton = createMenuButton({
      scene,
      x: 214,
      y: 588,
      width: 180,
      label: "Accept All",
      onClick: () => {
        gameSession.acceptAllMissions(this.getAvailableContracts().map((contract) => contract.id));
        this.refresh();
      },
      depth: 62,
      accentColor: 0x205c8c,
    });

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
      rightRail,
      title,
      this.subtitle,
      this.statusText,
      this.detailTitle,
      this.detailBody,
      this.detailReward,
      this.acceptAllButton.container,
      this.closeButton.container,
      ...this.cards.flatMap((card) => [
        card.frame,
        card.badge,
        card.title,
        card.location,
        card.status,
        card.action.container,
      ]),
    ]).setDepth(60);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(): void {
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.syncSelection();
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

  private acceptMission(missionId: string): void {
    gameSession.acceptMission(missionId);
    this.selectedMissionId = missionId;
    this.refresh();
  }

  private getAvailableContracts(): MissionContractDefinition[] {
    return getMissionContracts().filter((contract) =>
      gameSession.isMissionUnlocked(contract.id) && !gameSession.isMissionCompleted(contract.id),
    );
  }

  private syncSelection(): void {
    const contracts = this.getAvailableContracts();
    if (contracts.some((contract) => contract.id === this.selectedMissionId)) {
      return;
    }

    this.selectedMissionId = gameSession.getSelectedMissionId()
      ?? gameSession.getAcceptedMissionIds()[0]
      ?? contracts[0]?.id
      ?? "";
  }

  private refresh(): void {
    const contracts = this.getAvailableContracts();
    this.syncSelection();
    const selected = contracts.find((contract) => contract.id === this.selectedMissionId) ?? contracts[0];
    const acceptedMissionIds = gameSession.getAcceptedMissionIds();
    const selectedMissionId = gameSession.getSelectedMissionId();
    const selectedContract = selectedMissionId
      ? contracts.find((contract) => contract.id === selectedMissionId)
      : undefined;

    this.subtitle.setText("Review the current contracts, accept one or all of them, then use the Data Pad to choose which queued route becomes your active deployment.");
    this.statusText.setText(
      contracts.length === 0
        ? "All current story contracts have been cleared. Check the Data Pad archive while we line up the next routes."
        : acceptedMissionIds.length > 0
          ? `${acceptedMissionIds.length} contract${acceptedMissionIds.length === 1 ? "" : "s"} queued. Active contract: ${selectedContract?.title ?? "none selected yet"}.`
          : "No contracts queued yet. Accept a route to make it available in the Data Pad and at the deploy door.",
    );

    this.cards.forEach((card) => {
      const contract = contracts.find((entry) => entry.id === card.contractId);
      if (!contract) {
        card.frame.setVisible(false);
        card.badge.setVisible(false);
        card.title.setVisible(false);
        card.location.setVisible(false);
        card.status.setVisible(false);
        card.action.container.setVisible(false);
        return;
      }

      card.frame.setVisible(true);
      card.badge.setVisible(true);
      card.title.setVisible(true);
      card.location.setVisible(true);
      card.status.setVisible(true);
      card.action.container.setVisible(true);
      const visibleIndex = contracts.findIndex((entry) => entry.id === card.contractId);
      const y = 226 + visibleIndex * 148;
      card.frame.setPosition(338, y);
      card.badge.setPosition(182, y - 42);
      card.title.setPosition(182, y - 10);
      card.location.setPosition(182, y + 20);
      card.status.setPosition(182, y + 46);
      card.action.container.setPosition(456, y);
      const isSelected = selected?.id === card.contractId;
      const isAccepted = acceptedMissionIds.includes(card.contractId);
      card.frame.setFillStyle(isSelected ? 0x122334 : 0x0c1725, 0.98);
      card.frame.setStrokeStyle(2, isSelected ? contract.accentColor : 0x37577e, isSelected ? 0.98 : 0.78);
      card.status.setText(
        isAccepted
          ? selectedMissionId === card.contractId
            ? "Queued | Active in Data Pad"
            : "Queued"
          : "Ready to accept",
      );
      card.action.setLabel(isAccepted ? "Queued" : "Accept");
      card.action.setEnabled(!isAccepted);
    });

    if (!selected) {
      this.detailTitle.setText(contracts.length === 0 ? "Terminal Clear" : "No Contract Selected");
      this.detailBody.setText(
        contracts.length === 0
          ? "Every currently unlocked story contract has been cleared. Completed routes now live in the Data Pad archive instead of staying on the terminal."
          : "Pick a contract card from the left rail.",
      );
      this.detailReward.setText("");
      this.acceptAllButton.setEnabled(false);
      return;
    }

    this.detailTitle.setText(`${selected.title}\n${selected.location}`);
    this.detailBody.setText([
      `Threat: ${getDifficultyLabel(selected)}`,
      "",
      selected.prompt,
      "",
      `Objective: ${selected.objective}`,
      "",
      "Dispatch Notes",
      selected.briefing[0] ?? "",
    ]);
    this.detailReward.setText([
      `Reward Projection`,
      `+${selected.reward.xp} XP`,
      `+${selected.reward.credits} Credits`,
      `Recovered Item: ${selected.reward.item}`,
    ]);

    this.acceptAllButton.setEnabled(contracts.some((contract) => !acceptedMissionIds.includes(contract.id)));
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.acceptAllButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    this.cards.forEach((card) => {
      card.action.setInputEnabled(enabled && card.action.container.visible);
      if (card.frame.input) {
        card.frame.input.enabled = enabled && card.frame.visible;
      }
    });
  }
}
