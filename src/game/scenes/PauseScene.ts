import Phaser from "phaser";

import { gameSession } from "../core/session";
import { createMenuButton } from "../ui/buttons";
import { SettingsOverlay } from "../ui/SettingsOverlay";

type PauseSceneData = {
  returnSceneKey: "hub" | "mission";
  allowSave: boolean;
};

export class PauseScene extends Phaser.Scene {
  private returnSceneKey: PauseSceneData["returnSceneKey"] = "hub";
  private allowSave = false;
  private statusText?: Phaser.GameObjects.Text;
  private settingsOverlay?: SettingsOverlay;

  constructor() {
    super("pause");
  }

  create(data: PauseSceneData): void {
    this.returnSceneKey = data.returnSceneKey;
    this.allowSave = data.allowSave;

    this.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.7);
    this.add.rectangle(640, 360, 520, 468, 0x091321, 0.98).setStrokeStyle(3, 0x79abed, 0.82);

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
      onClick: () => {
        const ok = gameSession.loadSave();
        if (!ok) {
          this.statusText?.setText("No valid save found.");
          return;
        }

        this.leaveToHub();
      },
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

    createMenuButton({
      scene: this,
      x: 640,
      y: 518,
      width: 260,
      label: "Quit To Main Menu",
      onClick: () => this.leaveToMenu(),
      depth: 12,
      accentColor: 0x4f2630,
    });

    this.statusText = this.add.text(640, 586, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#d1e4ff",
    }).setOrigin(0.5);

    this.settingsOverlay = new SettingsOverlay({
      scene: this,
      onClose: () => undefined,
    });

    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-ESC", this.resumeGame, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard?.off("keydown-ESC", this.resumeGame, this);
    });
  }

  private resumeGame(): void {
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
}
