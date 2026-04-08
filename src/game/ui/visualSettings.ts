import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../createGame";
import { gameSession } from "../core/session";

export type BrightnessLayer = {
  dark: Phaser.GameObjects.Rectangle;
  light: Phaser.GameObjects.Rectangle;
  refresh: () => void;
  destroy: () => void;
};

export type BrightnessLayerOptions = {
  ambientAlpha?: number;
  tintColor?: number;
  tintAlpha?: number;
  edgeShadeAlpha?: number;
  edgeThickness?: number;
};

export function createBrightnessLayer(scene: Phaser.Scene, options: BrightnessLayerOptions = {}): BrightnessLayer {
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

  const tint = scene.add
    .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, options.tintColor ?? 0x04111d, options.tintAlpha ?? 0)
    .setOrigin(0)
    .setDepth(198)
    .setScrollFactor(0);

  const edgeThickness = options.edgeThickness ?? 0;
  const edgeShadeAlpha = options.edgeShadeAlpha ?? 0;
  const edgeShades = edgeThickness > 0 && edgeShadeAlpha > 0
    ? [
        scene.add.rectangle(GAME_WIDTH / 2, edgeThickness / 2, GAME_WIDTH, edgeThickness, 0x000000, edgeShadeAlpha)
          .setDepth(201)
          .setScrollFactor(0),
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - edgeThickness / 2, GAME_WIDTH, edgeThickness, 0x000000, edgeShadeAlpha)
          .setDepth(201)
          .setScrollFactor(0),
        scene.add.rectangle(edgeThickness / 2, GAME_HEIGHT / 2, edgeThickness, GAME_HEIGHT, 0x000000, edgeShadeAlpha)
          .setDepth(201)
          .setScrollFactor(0),
        scene.add.rectangle(GAME_WIDTH - edgeThickness / 2, GAME_HEIGHT / 2, edgeThickness, GAME_HEIGHT, 0x000000, edgeShadeAlpha)
          .setDepth(201)
          .setScrollFactor(0),
      ]
    : [];

  const refresh = (): void => {
    const brightness = gameSession.settings.graphics.brightness;
    const ambientAlpha = options.ambientAlpha ?? 0;
    if (brightness === 100) {
      dark.setAlpha(ambientAlpha);
      light.setAlpha(0);
      return;
    }

    if (brightness < 100) {
      dark.setAlpha(ambientAlpha + ((100 - brightness) / 10) * 0.08);
      light.setAlpha(0);
      return;
    }

    light.setAlpha(((brightness - 100) / 10) * 0.05);
    dark.setAlpha(Math.max(0, ambientAlpha - ((brightness - 100) / 10) * 0.02));
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
      tint.destroy();
      edgeShades.forEach((shade) => shade.destroy());
    },
  };
}
