import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    this.scene.start("control-lab");
  }
}

