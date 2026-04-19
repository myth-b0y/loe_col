import Phaser from "phaser";

import { gameSession } from "../core/session";
import { createMenuButton } from "../ui/buttons";
import { SaveSlotsOverlay } from "../ui/SaveSlotsOverlay";
import { SettingsOverlay } from "../ui/SettingsOverlay";

type PauseSceneData = {
  returnSceneKey: "hub" | "mission" | "space";
  allowSave: boolean;
};

export class PauseScene extends Phaser.Scene {
  private returnSceneKey: PauseSceneData["returnSceneKey"] = "hub";
  private allowSave = false;
  private statusText?: Phaser.GameObjects.Text;
  private settingsOverlay?: SettingsOverlay;
  private saveSlotsOverlay?: SaveSlotsOverlay;
  private fullscreenRow?: Phaser.GameObjects.Rectangle;
  private fullscreenBox?: Phaser.GameObjects.Rectangle;
  private fullscreenCheck?: Phaser.GameObjects.Text;
  private fullscreenLabel?: Phaser.GameObjects.Text;

  constructor() {
    super("pause");
  }

  create(data: PauseSceneData): void {
    this.returnSceneKey = data.returnSceneKey;
    this.allowSave = data.allowSave;
    const isMissionPause = this.returnSceneKey === "mission";

    this.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.7);
    this.add.rectangle(640, 360, 520, isMissionPause ? 590 : 520, 0x091321, 0.98).setStrokeStyle(3, 0x79abed, 0.82);

    this.add.text(470, 162, "Paused", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#f7fbff",
      fontStyle: "bold",
    });

    this.add.text(470, 206, this.allowSave ? "Command deck paused" : "Mission paused", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fc6ff",
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 286,
      width: 260,
      label: "Resume",
      onClick: () => this.resumeGame(),
      depth: 12,
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 344,
      width: 260,
      label: this.allowSave ? "Save Game" : "Save Disabled In Missions",
      onClick: () => {
        if (!this.allowSave) {
          return;
        }

        const ok = gameSession.saveToDisk();
        this.statusText?.setText(ok ? "Save complete." : "Save failed.");
      },
      depth: 12,
      disabled: !this.allowSave,
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 402,
      width: 260,
      label: "Load Save",
      onClick: () => this.saveSlotsOverlay?.show("load"),
      depth: 12,
      disabled: !gameSession.hasSaveData(),
    });

    createMenuButton({
      scene: this,
      x: 640,
      y: 460,
      width: 260,
      label: "Options",
      onClick: () => this.settingsOverlay?.show("graphics"),
      depth: 12,
    });

    this.createFullscreenRow(isMissionPause ? 516 : 518);

    if (isMissionPause) {
      createMenuButton({
        scene: this,
        x: 640,
        y: 566,
        width: 260,
        label: "Return To Ship",
        onClick: () => this.abandonMission(),
        depth: 12,
        accentColor: 0x5a4521,
      });
    }

    createMenuButton({
      scene: this,
      x: 640,
      y: isMissionPause ? 624 : 576,
      width: 260,
      label: "Quit To Main Menu",
      onClick: () => this.leaveToMenu(),
      depth: 12,
      accentColor: 0x4f2630,
    });

    this.statusText = this.add.text(640, isMissionPause ? 648 : 606, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d1e4ff",
    }).setOrigin(0.5);

    this.settingsOverlay = new SettingsOverlay({
      scene: this,
      onClose: () => undefined,
    });

    this.saveSlotsOverlay = new SaveSlotsOverlay({
      scene: this,
      onClose: () => undefined,
      onLoadSlot: (slotIndex) => {
        const ok = gameSession.loadSave(slotIndex);
        if (!ok) {
          this.statusText?.setText("No valid save found.");
          return;
        }

        this.leaveToHub();
      },
      onNewSlot: () => undefined,
    });

    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-ESC", this.resumeGame, this);

    const fullscreenListener = (): void => this.refreshFullscreenUi();
    if (typeof document !== "undefined") {
      document.addEventListener("fullscreenchange", fullscreenListener);
    }
    this.refreshFullscreenUi();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off("keydown-ESC", this.resumeGame, this);
      if (typeof document !== "undefined") {
        document.removeEventListener("fullscreenchange", fullscreenListener);
      }
    });
  }

  private resumeGame(): void {
    if (this.saveSlotsOverlay) {
      this.saveSlotsOverlay.hide();
    }
    this.scene.resume(this.returnSceneKey);
    this.scene.stop();
  }

  private leaveToMenu(): void {
    this.scene.stop(this.returnSceneKey);
    this.scene.stop();
    this.scene.start("main-menu");
  }

  private leaveToHub(): void {
    this.scene.stop(this.returnSceneKey);
    this.scene.stop();
    this.scene.start("hub");
  }

  private abandonMission(): void {
    const missionScene = this.scene.get("mission") as Phaser.Scene & { extractMissionLootToShip?: () => void };
    if (typeof missionScene.extractMissionLootToShip === "function") {
      missionScene.extractMissionLootToShip();
    } else {
      const missionId = gameSession.activeMissionId;
      gameSession.leaveMission({
        missionId,
        requeue: Boolean(missionId),
      });
    }
    this.leaveToHub();
  }

  private createFullscreenRow(y: number): void {
    this.fullscreenRow = this.add.rectangle(640, y, 260, 42, 0x0d1726, 0.96)
      .setStrokeStyle(2, 0x36557a, 0.82)
      .setInteractive({ useHandCursor: true });
    this.fullscreenBox = this.add.rectangle(532, y, 20, 20, 0x08111c, 0.98)
      .setStrokeStyle(2, 0xaed0ff, 0.8);
    this.fullscreenCheck = this.add.text(532, y - 1, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.fullscreenLabel = this.add.text(554, y - 10, "Focus Mode", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#eef5ff",
    });

    const toggle = (): void => {
      void this.toggleFullscreen();
    };
    this.fullscreenRow.on("pointerdown", toggle);
    this.fullscreenBox.setInteractive({ useHandCursor: true }).on("pointerdown", toggle);
    this.fullscreenCheck.setInteractive({ useHandCursor: true }).on("pointerdown", toggle);
    this.fullscreenLabel.setInteractive({ useHandCursor: true }).on("pointerdown", toggle);
  }

  private isFullscreenActive(): boolean {
    if (typeof document === "undefined") {
      return false;
    }

    return Boolean(document.fullscreenElement);
  }

  private refreshFullscreenUi(): void {
    const supported = typeof document !== "undefined" && document.fullscreenEnabled !== false;
    const active = this.isFullscreenActive();
    this.fullscreenRow?.setAlpha(supported ? 1 : 0.45);
    this.fullscreenBox?.setFillStyle(active ? 0x215a96 : 0x08111c, active ? 0.98 : 0.98);
    this.fullscreenBox?.setStrokeStyle(2, active ? 0xe7f2ff : 0xaed0ff, active ? 0.94 : 0.8);
    this.fullscreenCheck?.setText(active ? "X" : "");
    this.fullscreenLabel?.setText(supported ? "Focus Mode" : "Focus Mode Unavailable");
  }

  private async toggleFullscreen(): Promise<void> {
    if (typeof document === "undefined" || document.fullscreenEnabled === false) {
      this.statusText?.setText("Fullscreen is unavailable in this browser.");
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this.statusText?.setText("Focus mode disabled.");
      } else {
        const host = this.game.canvas.parentElement ?? this.game.canvas;
        await host.requestFullscreen?.();
        this.statusText?.setText("Focus mode enabled. Browser Esc can still exit it.");
      }
    } catch {
      this.statusText?.setText("Focus mode request was blocked.");
    } finally {
      this.refreshFullscreenUi();
    }
  }
}
