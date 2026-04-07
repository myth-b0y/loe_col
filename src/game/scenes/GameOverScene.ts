import Phaser from "phaser";

import { gameSession } from "../core/session";
import { createMenuButton } from "../ui/buttons";
import { SaveSlotsOverlay } from "../ui/SaveSlotsOverlay";

type GameOverSceneData = {
  missionId: string;
};

export class GameOverScene extends Phaser.Scene {
  private missionId = "";
  private statusText?: Phaser.GameObjects.Text;
  private saveSlotsOverlay?: SaveSlotsOverlay;

  constructor() {
    super("game-over");
  }

  create(data: GameOverSceneData): void {
    this.missionId = data.missionId;

    this.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.76);
    this.add.rectangle(640, 360, 560, 520, 0x120916, 0.98).setStrokeStyle(3, 0xc96a88, 0.82);

    this.add.text(640, 162, "Game Over", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#fff2f5",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(640, 214, "The mission failed, but the contract is still active.", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f2c8d5",
    }).setOrigin(0.5);

    createMenuButton({
      scene: this,
      x: 640,
      y: 294,
      width: 280,
      label: "Continue?",
      onClick: () => this.restartMission(),
      depth: 12,
      accentColor: 0x7b3651,
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 352,
      width: 280,
      label: "Return To Ship",
      onClick: () => this.returnToShip(),
      depth: 12,
      accentColor: 0x5a4678,
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 410,
      width: 280,
      label: "Load Save",
      onClick: () => this.saveSlotsOverlay?.show("load"),
      depth: 12,
      disabled: !gameSession.hasSaveData(),
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 468,
      width: 280,
      label: "Quit To Main Menu",
      onClick: () => this.quitToMenu(),
      depth: 12,
      accentColor: 0x4f2630,
    });

    this.statusText = this.add.text(640, 538, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f1dfe6",
      align: "center",
      wordWrap: { width: 420 },
    }).setOrigin(0.5);

    this.saveSlotsOverlay = new SaveSlotsOverlay({
      scene: this,
      onClose: () => undefined,
      onLoadSlot: (slotIndex) => {
        const ok = gameSession.loadSave(slotIndex);
        if (!ok) {
          this.statusText?.setText("No valid save found.");
          return;
        }

        this.scene.start("hub");
      },
      onNewSlot: () => undefined,
    });
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      missionId: this.missionId,
      hasSaves: gameSession.hasSaveData(),
      status: this.statusText?.text ?? "",
    };
  }

  private restartMission(): void {
    gameSession.startMission(this.missionId);
    this.scene.start("mission", { missionId: this.missionId });
  }

  private returnToShip(): void {
    gameSession.leaveMission({
      missionId: this.missionId,
      requeue: true,
    });
    this.scene.start("hub");
  }

  private quitToMenu(): void {
    gameSession.leaveMission({
      missionId: this.missionId,
      requeue: false,
    });
    this.scene.start("main-menu");
  }
}
