import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { ControlLabScene } from "./scenes/ControlLabScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#070b12",
    scene: [BootScene, ControlLabScene],
    input: {
      activePointers: 4,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      expandParent: true,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  });
}
