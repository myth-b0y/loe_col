import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";

export type BrightnessLayer = {
  dark: Phaser.GameObjects.Rectangle;
  light: Phaser.GameObjects.Rectangle;
  refresh: () => void;
  destroy: () => void;
};

export function createBrightnessLayer(scene: Phaser.Scene): BrightnessLayer {
  const dark = scene.add
    .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
    .setOrigin(0)
    .setDepth(200)
    .setScrollFactor(0);

  const light = scene.add
    .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
    .setOrigin(0)
    .setDepth(199)
    .setScrollFactor(0);

  const refresh = (): void => {
    const brightness = gameSession.settings.graphics.brightness;
    if (brightness === 100) {
      dark.setAlpha(0);
      light.setAlpha(0);
      return;
    }

    if (brightness < 100) {
      dark.setAlpha(((100 - brightness) / 10) * 0.08);
      light.setAlpha(0);
      return;
    }

    light.setAlpha(((brightness - 100) / 10) * 0.05);
    dark.setAlpha(0);
  };

  refresh();
  gameSession.on("settings-changed", refresh);

  return {
    dark,
    light,
    refresh,
    destroy() {
      gameSession.off("settings-changed", refresh);
      dark.destroy();
      light.destroy();
    },
  };
}
