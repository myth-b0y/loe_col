import Phaser from "phaser";

import { describeRewardBundle } from "../content/loot";
import { gameSession, type RewardData } from "../core/session";
import { createMenuButton } from "../ui/buttons";

type MissionResultSceneData = {
  missionId: string;
  missionTitle: string;
  reward: RewardData;
};

export class MissionResultScene extends Phaser.Scene {
  private missionId = "";
  private missionTitle = "";
  private reward?: RewardData;

  constructor() {
    super("mission-result");
  }

  create(data: MissionResultSceneData): void {
    this.missionId = data.missionId;
    this.missionTitle = data.missionTitle;
    this.reward = data.reward;

    this.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.76);
    this.add.rectangle(640, 360, 620, 360, 0x08111c, 0.98).setStrokeStyle(3, 0x79abed, 0.85);

    this.add.text(640, 214, "Mission Complete", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(640, 278, [
      `${this.missionTitle} has been cleared.`,
      "",
      ...describeRewardBundle(data.reward),
      "",
      "Return to the command deck to save, regroup, and queue the next contract.",
    ], {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d7e8ff",
      lineSpacing: 8,
      align: "center",
      wordWrap: { width: 460 },
    }).setOrigin(0.5, 0);

    createMenuButton({
      scene: this,
      x: 640,
      y: 498,
      width: 230,
      label: "Return To Ship",
      onClick: () => this.returnToShip(),
      depth: 12,
      accentColor: 0x1c4f7f,
    });

    this.input.keyboard?.on("keydown-ENTER", this.returnToShip, this);
    this.input.keyboard?.on("keydown-SPACE", this.returnToShip, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-ENTER", this.returnToShip, this);
      this.input.keyboard?.off("keydown-SPACE", this.returnToShip, this);
    });
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      missionId: this.missionId,
      missionTitle: this.missionTitle,
      reward: this.reward ?? null,
    };
  }

  private returnToShip(): void {
    if (!this.reward) {
      return;
    }

    gameSession.completeMission(this.missionId, this.reward);
    this.scene.start("hub");
  }
}
