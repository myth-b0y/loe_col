import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { MissionScene } from "./scenes/MissionScene";
import { PauseScene } from "./scenes/PauseScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#070b12",
    scene: [BootScene, MainMenuScene, HubScene, MissionScene, PauseScene],
    input: {
      activePointers: 6,
    },
    scale: {
      mode: Phaser.Scale.FIT,
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

