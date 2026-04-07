import Phaser from "phaser";

import { getMissionContracts } from "./content/missions";
import { gameSession } from "./core/session";
import { BootScene } from "./scenes/BootScene";
import { HubScene } from "./scenes/HubScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { MissionScene } from "./scenes/MissionScene";
import { MissionResultScene } from "./scenes/MissionResultScene";
import { PauseScene } from "./scenes/PauseScene";
import { GameOverScene } from "./scenes/GameOverScene";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

function resolveRendererType(): number {
  if (typeof window === "undefined") {
    return Phaser.AUTO;
  }

  const rendererParam = new URLSearchParams(window.location.search).get("renderer");
  if (rendererParam === "canvas") {
    return Phaser.CANVAS;
  }

  if (rendererParam === "webgl") {
    return Phaser.WEBGL;
  }

  return Phaser.AUTO;
}

export function createGame(parent: string): Phaser.Game {
  const game = new Phaser.Game({
    type: resolveRendererType(),
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#070b12",
    scene: [BootScene, MainMenuScene, HubScene, MissionScene, PauseScene, GameOverScene, MissionResultScene],
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

  if (typeof window !== "undefined") {
    const debugWindow = window as Window & {
      __loeGame?: Phaser.Game;
      __loeSession?: typeof gameSession;
      __loeContracts?: ReturnType<typeof getMissionContracts>;
      render_game_to_text?: () => string;
    };
    debugWindow.__loeGame = game;
    debugWindow.__loeSession = gameSession;
    debugWindow.__loeContracts = getMissionContracts();
    debugWindow.render_game_to_text = () => {
      const activeScene = game.scene.getScenes(true).at(-1) as
        | (Phaser.Scene & { getDebugSnapshot?: () => unknown })
        | undefined;

      return JSON.stringify({
        activeScene: activeScene?.scene.key ?? null,
        snapshot: activeScene?.getDebugSnapshot?.() ?? null,
      });
    };
  }

  return game;
}

