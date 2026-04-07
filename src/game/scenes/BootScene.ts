import Phaser from "phaser";

import { gameSession } from "../core/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    gameSession.bootstrap();
    gameSession.configureDeviceContext(
      this.sys.game.device.input.touch,
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false,
    );
    this.input.mouse?.disableContextMenu();
    this.scene.start("main-menu");
  }
}
