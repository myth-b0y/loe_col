import Phaser from "phaser";

import { getMissionContracts } from "../content/missions";
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
    return "Active Contract";
  }

  if (gameSession.isMissionAccepted(contractId)) {
    return "Queued";
  }

  if (gameSession.isMissionCompleted(contractId)) {
    return "Completed";
  }

  return "Available";
}

export class LogbookOverlay {
  private readonly onClose: () => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly queueSummary: Phaser.GameObjects.Text;
  private readonly detailTitle: Phaser.GameObjects.Text;
  private readonly detailMeta: Phaser.GameObjects.Text;
  private readonly detailBody: Phaser.GameObjects.Text;
  private readonly completedText: Phaser.GameObjects.Text;
  private readonly setActiveButton: MenuButton;
  private readonly abandonButton: MenuButton;
  private readonly closeButton: MenuButton;
  private readonly cards: LogCard[];
  private selectedMissionId: string;

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

    this.queueSummary = scene.add.text(142, 188, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#9fc6ff",
    }).setDepth(62);

    this.cards = contracts.map((contract, index) => {
      const y = 248 + index * 118;
      const frame = scene.add.rectangle(350, y, 340, 92, 0x0d1825, 0.97)
        .setDepth(62)
        .setStrokeStyle(2, 0x35577f, 0.78)
        .setInteractive({ useHandCursor: true });
      const titleText = scene.add.text(198, y - 18, contract.title, {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f7fbff",
        fontStyle: "bold",
      }).setDepth(63);
      const status = scene.add.text(198, y + 14, "", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#9fc6ff",
      }).setDepth(63);
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

  private syncSelection(): void {
    const contracts = getMissionContracts();
    if (contracts.some((contract) => contract.id === this.selectedMissionId)) {
      return;
    }

    this.selectedMissionId = gameSession.getSelectedMissionId()
      ?? gameSession.getAcceptedMissionIds()[0]
      ?? contracts[0]?.id
      ?? "";
  }

  private refresh(): void {
    const contracts = getMissionContracts();
    this.syncSelection();
    const selected = contracts.find((contract) => contract.id === this.selectedMissionId) ?? contracts[0];
    const acceptedMissionIds = gameSession.getAcceptedMissionIds();
    const completedMissionIds = gameSession.getCompletedMissionIds();
    const activeMission = gameSession.getSelectedMissionId()
      ? contracts.find((contract) => contract.id === gameSession.getSelectedMissionId())
      : undefined;

    this.subtitle.setText("Your datapad tracks queued contracts, the active deployment route, and the missions you have already cleared.");
    this.queueSummary.setText(
      acceptedMissionIds.length > 0
        ? `Queued routes: ${acceptedMissionIds.length} | Active: ${activeMission?.title ?? "none selected"}`
        : "No queued routes yet. Accept contracts at the mission terminal first.",
    );

    this.cards.forEach((card) => {
      const contract = contracts.find((entry) => entry.id === card.contractId);
      if (!contract) {
        return;
      }

      const isSelected = selected?.id === card.contractId;
      card.frame.setFillStyle(isSelected ? 0x13263a : 0x0d1825, 0.98);
      card.frame.setStrokeStyle(2, isSelected ? contract.accentColor : 0x35577f, isSelected ? 0.98 : 0.78);
      card.status.setText(`${contract.location} | ${getStatusLabel(card.contractId)}`);
    });

    if (!selected) {
      this.detailTitle.setText("No Mission Selected");
      this.detailMeta.setText("");
      this.detailBody.setText("Choose a mission from the left rail.");
      this.completedText.setText("");
      this.setActiveButton.setEnabled(false);
      this.abandonButton.setEnabled(false);
      return;
    }

    const accepted = acceptedMissionIds.includes(selected.id);
    const completed = completedMissionIds.includes(selected.id);
    const active = gameSession.getSelectedMissionId() === selected.id;

    this.detailTitle.setText(selected.title);
    this.detailMeta.setText(`${selected.location} | ${getStatusLabel(selected.id)}`);
    this.detailBody.setText([
      selected.prompt,
      "",
      `Objective: ${selected.objective}`,
      "",
      `Reward`,
      `+${selected.reward.xp} XP | +${selected.reward.credits} Credits`,
      `Recovered Item: ${selected.reward.item}`,
    ]);
    this.completedText.setText([
      "Completed Routes",
      completedMissionIds.length > 0
        ? completedMissionIds
          .map((missionId) => {
            const contract = getMissionContracts().find((entry) => entry.id === missionId);
            return contract ? `${contract.title} | ${contract.location}` : missionId;
          })
          .join("\n")
        : "None yet.",
      "",
      completed && !accepted ? "This route remains available to queue again for more testing." : "",
      active ? "This contract is currently the one the deploy door will launch." : "",
    ]);

    this.setActiveButton.setEnabled(accepted && !active);
    this.abandonButton.setEnabled(accepted);
  }

  private setInputEnabled(enabled: boolean): void {
    if (this.backdrop.input) {
      this.backdrop.input.enabled = enabled;
    }

    this.setActiveButton.setInputEnabled(enabled);
    this.abandonButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    this.cards.forEach((card) => {
      if (card.frame.input) {
        card.frame.input.enabled = enabled;
      }
    });
  }
}
