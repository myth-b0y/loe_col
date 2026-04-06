import Phaser from "phaser";

import { gameSession } from "../core/session";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    gameSession.bootstrap();
    this.input.mouse?.disableContextMenu();
    this.scene.start("main-menu");
  }
}
