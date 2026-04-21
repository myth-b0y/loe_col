import Phaser from "phaser";

import { gameSession } from "../core/session";

export const UI_FONT_FAMILY = "Arial";

export const UI_THEME = {
  background: 0x040812,
  panel: 0x06111d,
  panelSoft: 0x0a1826,
  rail: 0x09131f,
  border: 0x6ea6d8,
  borderSoft: 0x274566,
  text: "#f4fbff",
  textSoft: "#bdd2ec",
  textDim: "#7d97b7",
  accent: 0x79c9ff,
  accentSoft: 0x1d3250,
};

export function getActiveUiAccentColor(): number {
  return gameSession.settings.graphics.uiColor ?? UI_THEME.accent;
}

type StarfieldOptions = {
  count?: number;
  seed?: number;
};

type PanelOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  lineWidth?: number;
};

type DividerOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  color?: number;
  alpha?: number;
  depth?: number;
};

type GlowLineOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  color?: number;
  alpha?: number;
  depth?: number;
};

export function drawCosmicBackdrop(scene: Phaser.Scene, { count = 110, seed = 7 }: StarfieldOptions = {}): void {
  scene.add.rectangle(640, 360, 1280, 720, UI_THEME.background).setDepth(-20);

  const nebula = scene.add.graphics().setDepth(-19);
  nebula.fillGradientStyle(0x09131f, 0x050a13, 0x0d1730, 0x060b15, 0.95, 0.95, 0.72, 0.95);
  nebula.fillRect(0, 0, 1280, 720);

  const horizon = scene.add.graphics().setDepth(-18);
  horizon.fillStyle(0x17304f, 0.08);
  horizon.fillRect(0, 0, 1280, 180);
  horizon.fillStyle(0x11253e, 0.06);
  horizon.fillRect(0, 540, 1280, 180);

  const stars = scene.add.graphics().setDepth(-17);
  const random = new Phaser.Math.RandomDataGenerator([`${seed}`]);
  for (let index = 0; index < count; index += 1) {
    const radius = random.realInRange(0.6, 2.2);
    const alpha = random.realInRange(0.22, 0.95);
    const color = random.pick([0xf3fbff, 0xddeeff, 0xb6d8ff, 0x94baff]);
    stars.fillStyle(color, alpha);
    stars.fillCircle(random.realInRange(10, 1270), random.realInRange(10, 710), radius);
  }
}

export function createUiPanel({
  scene,
  x,
  y,
  width,
  height,
  depth = 10,
  fillColor = UI_THEME.panel,
  fillAlpha = 0.94,
  borderColor = UI_THEME.border,
  borderAlpha = 0.78,
  lineWidth = 2,
}: PanelOptions): Phaser.GameObjects.Container {
  const frame = scene.add.container(x, y).setDepth(depth);
  const backing = scene.add.rectangle(0, 0, width, height, fillColor, fillAlpha);
  const outer = scene.add.rectangle(0, 0, width, height)
    .setStrokeStyle(lineWidth, borderColor, borderAlpha);
  const inner = scene.add.rectangle(0, 0, width - 10, height - 10)
    .setStrokeStyle(1, UI_THEME.borderSoft, 0.5);
  frame.add([backing, inner, outer]);
  return frame;
}

export function createDivider({
  scene,
  x,
  y,
  width,
  color = UI_THEME.borderSoft,
  alpha = 0.65,
  depth = 11,
}: DividerOptions): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y, width, 2, color, alpha).setDepth(depth);
}

export function createGlowLine({
  scene,
  x,
  y,
  width,
  color = UI_THEME.accent,
  alpha = 0.8,
  depth = 12,
}: GlowLineOptions): Phaser.GameObjects.Container {
  const bar = scene.add.rectangle(0, 0, width, 2, color, alpha);
  const bloom = scene.add.rectangle(0, 0, width, 8, color, alpha * 0.12);
  const spark = scene.add.circle(width / 2, 0, 2.5, 0xf8fdff, 0.92);
  return scene.add.container(x, y, [bloom, bar, spark]).setDepth(depth);
}

export function createTitle(scene: Phaser.Scene, x: number, y: number, label: string, size = 34): Phaser.GameObjects.Text {
  return scene.add.text(x, y, label, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: `${size}px`,
    color: UI_THEME.text,
    fontStyle: "bold",
  });
}

export function createBodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string | string[],
  width: number,
  color = UI_THEME.textSoft,
  size = 18,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, label, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    wordWrap: { width },
    lineSpacing: 6,
  });
}

export function createMockButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  label: string,
  accentColor = UI_THEME.accentSoft,
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, 46, accentColor, 0.46)
    .setStrokeStyle(2, UI_THEME.border, 0.8);
  const inner = scene.add.rectangle(0, 0, width - 10, 36)
    .setStrokeStyle(1, 0xf4fbff, 0.12);
  const text = scene.add.text(0, 0, label, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: "22px",
    color: UI_THEME.text,
    fontStyle: "bold",
  }).setOrigin(0.5);
  return scene.add.container(x, y, [background, inner, text]);
}

export function createSlotFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, width, height, 0x07121d, 0.92)
    .setStrokeStyle(2, UI_THEME.borderSoft, 0.78);
  const inner = scene.add.rectangle(0, 0, width - 8, height - 8)
    .setStrokeStyle(1, UI_THEME.border, 0.18);
  const text = scene.add.text(0, height / 2 - 10, label, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: "13px",
    color: UI_THEME.textDim,
    fontStyle: "bold",
  }).setOrigin(0.5, 1);
  return scene.add.container(x, y, [background, inner, text]);
}

export function createEmptyCharacterWell(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  emberColor: number,
  label = "CHARACTER PREVIEW",
): Phaser.GameObjects.Container {
  const panel = createUiPanel({
    scene,
    x: 0,
    y: 0,
    width,
    height,
    fillColor: UI_THEME.rail,
    fillAlpha: 0.92,
    borderColor: UI_THEME.borderSoft,
    borderAlpha: 0.9,
  });
  const beam = scene.add.triangle(0, 10, 0, height / 2 - 18, width / 2 - 18, height / 2 - 18, 0, -height / 2 + 14, emberColor, 0.12);
  const halo = scene.add.circle(0, height / 2 - 34, 62, emberColor, 0.08)
    .setStrokeStyle(2, emberColor, 0.4);
  const silhouette = scene.add.graphics();
  silhouette.lineStyle(4, 0xeaf5ff, 0.35);
  silhouette.strokeCircle(0, -46, 36);
  silhouette.strokeRoundedRect(-54, -6, 108, 138, 26);
  const prompt = scene.add.text(0, height / 2 - 84, label, {
    fontFamily: UI_FONT_FAMILY,
    fontSize: "16px",
    color: "#d7e8ff",
    fontStyle: "bold",
  }).setOrigin(0.5);
  const sub = scene.add.text(0, height / 2 - 58, "Waiting for final sprite and gear paper doll", {
    fontFamily: UI_FONT_FAMILY,
    fontSize: "13px",
    color: UI_THEME.textDim,
  }).setOrigin(0.5);

  return scene.add.container(x, y, [
    panel,
    beam,
    halo,
    silhouette,
    prompt,
    sub,
  ]);
}

export function createEmberAccent(colorKey: "white" | "blue" | "green" | "orange" | "purple" | "yellow" | "red"): number {
  switch (colorKey) {
    case "blue":
      return 0x56a7ff;
    case "green":
      return 0x6fe3a2;
    case "orange":
      return 0xffa14d;
    case "purple":
      return 0xc38cff;
    case "yellow":
      return 0xffdc74;
    case "red":
      return 0xff6e78;
    case "white":
    default:
      return 0xe6f4ff;
  }
}
