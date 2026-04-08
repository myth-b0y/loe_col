import Phaser from "phaser";

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
    this.add.rectangle(640, 360, 640, 404, 0x08111c, 0.98).setStrokeStyle(3, 0x79abed, 0.85);

    this.add.text(640, 214, "Mission Complete", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f7fbff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(640, 272, [
      `${this.missionTitle} has been cleared.`,
      "",
      `+${data.reward.xp} XP`,
      `+${data.reward.credits} Credits`,
      "",
      "Return to the command deck to save, regroup, and queue the next contract.",
    ], {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e8ff",
      lineSpacing: 6,
      align: "center",
      wordWrap: { width: 460 },
    }).setOrigin(0.5, 0);

    this.add.rectangle(640, 392, 470, 142, 0x0b1521, 0.98)
      .setStrokeStyle(2, 0x4f7aa5, 0.72);
    this.add.text(640, 329, "Recovered Loot", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#eaf4ff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const rewardViewport = new Phaser.Geom.Rectangle(422, 348, 436, 106);
    const rewardLines = buildRewardDisplayLines(data.reward);
    const rewardText = this.add.text(rewardViewport.x, rewardViewport.y, rewardLines.join("\n"), {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e8ff",
      lineSpacing: 5,
      align: "left",
      wordWrap: { width: rewardViewport.width },
    }).setOrigin(0, 0);
    const maskShape = this.add.graphics().setVisible(false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(rewardViewport.x, rewardViewport.y, rewardViewport.width, rewardViewport.height);
    rewardText.setMask(maskShape.createGeometryMask());

    let rewardScroll = 0;
    const maxRewardScroll = Math.max(0, rewardText.height - rewardViewport.height);
    const applyRewardScroll = (): void => {
      rewardText.setY(rewardViewport.y - rewardScroll);
    };
    const pointerWithinRewards = (pointer: Phaser.Input.Pointer): boolean =>
      rewardViewport.contains(pointer.x, pointer.y);
    const wheelHandler = (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void => {
      if (!pointerWithinRewards(pointer) || maxRewardScroll <= 0) {
        return;
      }
      rewardScroll = Phaser.Math.Clamp(rewardScroll + dy * 0.45, 0, maxRewardScroll);
      applyRewardScroll();
    };
    this.input.on("wheel", wheelHandler);
    if (maxRewardScroll > 0) {
      this.add.text(640, 455, "Scroll for more", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#8ba3c3",
      }).setOrigin(0.5);
    }

    createMenuButton({
      scene: this,
      x: 640,
      y: 528,
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
      this.input.off("wheel", wheelHandler);
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

function buildRewardDisplayLines(reward: RewardData): string[] {
  const lines: string[] = [];
  if (reward.materials.alloy > 0 || reward.materials.shardDust > 0 || reward.materials.filament > 0) {
    lines.push("Salvage");
    if (reward.materials.alloy > 0) {
      lines.push(`Alloy x${reward.materials.alloy}`);
    }
    if (reward.materials.shardDust > 0) {
      lines.push(`Shard Dust x${reward.materials.shardDust}`);
    }
    if (reward.materials.filament > 0) {
      lines.push(`Filament x${reward.materials.filament}`);
    }
  }

  const aggregatedItems = new Map<string, number>();
  reward.items.forEach((item) => {
    const label = item.kind === "junk" && item.stackCount > 1 ? `${item.name} x${item.stackCount}` : item.name;
    aggregatedItems.set(label, (aggregatedItems.get(label) ?? 0) + 1);
  });
  if (aggregatedItems.size > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Recovered Items");
    aggregatedItems.forEach((count, label) => {
      lines.push(count > 1 ? `${label} x${count}` : label);
    });
  }

  return lines.length > 0 ? lines : ["No salvage recovered."];
}
