import Phaser from "phaser";

import { ControllerInput } from "../core/controller";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "../ui/buttons";
import { SaveSlotsOverlay } from "../ui/SaveSlotsOverlay";

type GameOverMode = "mission" | "space";

type GameOverSceneData = {
  missionId?: string | null;
  mode?: GameOverMode;
  routeTitle?: string;
};

export class GameOverScene extends Phaser.Scene {
  private missionId: string | null = null;
  private mode: GameOverMode = "mission";
  private routeTitle = "Free roam launch";
  private statusText?: Phaser.GameObjects.Text;
  private saveSlotsOverlay?: SaveSlotsOverlay;
  private readonly controller = new ControllerInput();
  private buttons: MenuButton[] = [];
  private focusIndex = 0;

  constructor() {
    super("game-over");
  }

  create(data: GameOverSceneData = {}): void {
    this.missionId = typeof data.missionId === "string" && data.missionId.length > 0
      ? data.missionId
      : null;
    this.mode = data.mode ?? "mission";
    this.routeTitle = data.routeTitle ?? "Free roam launch";

    const subtitle = this.mode === "space"
      ? "The ship was destroyed. Continue loads the latest save and returns you to the ship."
      : "The mission failed. Continue loads the latest save and returns you to the ship.";

    this.add.rectangle(640, 360, 1280, 720, 0x02060b, 0.76);
    this.add.rectangle(640, 360, 560, 520, 0x120916, 0.98).setStrokeStyle(3, 0xc96a88, 0.82);

    this.add.text(640, 162, "Game Over", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#fff2f5",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(640, 214, subtitle, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f2c8d5",
      wordWrap: { width: 420 },
      align: "center",
    }).setOrigin(0.5);

    const continueButton = createMenuButton({
      scene: this,
      x: 640,
      y: 294,
      width: 280,
      label: "Continue",
      onClick: () => this.continueFromLatestSave(),
      depth: 12,
      accentColor: 0x7b3651,
      disabled: !gameSession.hasSaveData(),
    });

    const loadButton = createMenuButton({
      scene: this,
      x: 640,
      y: 352,
      width: 280,
      label: "Load",
      onClick: () => this.saveSlotsOverlay?.show("load"),
      depth: 12,
      disabled: !gameSession.hasSaveData(),
    });

    const menuButton = createMenuButton({
      scene: this,
      x: 640,
      y: 410,
      width: 280,
      label: "Main Menu",
      onClick: () => this.returnToMainMenu(),
      depth: 12,
      accentColor: 0x5a4678,
    });

    const quitButton = createMenuButton({
      scene: this,
      x: 640,
      y: 468,
      width: 280,
      label: "Quit",
      onClick: () => this.quitGame(),
      depth: 12,
      accentColor: 0x4f2630,
    });
    this.buttons = [continueButton, loadButton, menuButton, quitButton];
    this.refreshFocus();

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
      onLoadSlot: (slotIndex, kind) => {
        const ok = gameSession.loadSave(slotIndex, kind);
        if (!ok) {
          this.statusText?.setText("No valid save found.");
          return;
        }

        gameSession.prepareRespawnInShip();
        this.scene.start("hub");
      },
      onNewSlot: () => undefined,
    });
  }

  update(): void {
    this.controller.update(this.time.now);
    if (this.saveSlotsOverlay?.isVisible()) {
      this.saveSlotsOverlay.handleControllerInput(this.controller);
      return;
    }

    if (this.controller.wasNavigatePressed("up") || this.controller.wasNavigatePressed("left")) {
      this.moveFocus(-1);
      return;
    }

    if (this.controller.wasNavigatePressed("down") || this.controller.wasNavigatePressed("right")) {
      this.moveFocus(1);
      return;
    }

    if (this.controller.wasPressed("south")) {
      this.buttons.filter((button) => button.isEnabled())[this.focusIndex]?.trigger();
      return;
    }

    if (this.controller.wasPressed("east") || this.controller.wasPressed("back")) {
      this.returnToMainMenu();
    }
  }

  getDebugSnapshot(): Record<string, unknown> {
    return {
      missionId: this.missionId,
      mode: this.mode,
      routeTitle: this.routeTitle,
      hasSaves: gameSession.hasSaveData(),
      status: this.statusText?.text ?? "",
      buttons: ["Continue", "Load", "Main Menu", "Quit"],
    };
  }

  private continueFromLatestSave(): void {
    const ok = gameSession.loadLatestSaveForContinue();
    if (!ok) {
      this.statusText?.setText("No valid save found.");
      return;
    }

    this.scene.start("hub");
  }

  private returnToMainMenu(): void {
    this.scene.start("main-menu");
  }

  private quitGame(): void {
    if (typeof window !== "undefined") {
      window.close();
    }
    this.statusText?.setText("Quit requested. If the browser blocks it, use Main Menu.");
  }

  private moveFocus(delta: number): void {
    const focusable = this.buttons.filter((button) => button.isEnabled());
    if (focusable.length <= 0) {
      return;
    }

    this.focusIndex = Phaser.Math.Wrap(this.focusIndex + delta, 0, focusable.length);
    this.refreshFocus();
  }

  private refreshFocus(): void {
    const focusable = this.buttons.filter((button) => button.isEnabled());
    this.focusIndex = focusable.length > 0 ? Phaser.Math.Wrap(this.focusIndex, 0, focusable.length) : 0;
    this.buttons.forEach((button) => {
      button.setFocused(focusable[this.focusIndex] === button);
    });
  }
}
