import Phaser from "phaser";

import { UI_THEME, getActiveUiAccentColor } from "./theme";

export type SpaceRadarContactKind =
  | "enemy-ship"
  | "friendly-ship"
  | "neutral-ship"
  | "asteroid"
  | "planet"
  | "mission-planet"
  | "station"
  | "poi";

export type SpaceRadarContactSource = {
  id: string;
  kind: SpaceRadarContactKind;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  destroyed?: boolean;
};

export type SpaceRadarSnapshot = {
  range: number;
  sweepAngleDeg: number;
  trackedContacts: number;
  visibleContacts: number;
  contacts: Array<{
    id: string;
    kind: SpaceRadarContactKind;
    label: string;
    x: number;
    y: number;
    ageMs: number;
    alpha: number;
  }>;
};

export type SpaceRadarOptions = {
  x: number;
  y: number;
  width?: number;
  height?: number;
  depth?: number;
  range?: number;
  sweepSpeedDegPerSec?: number;
  sweepWidthDeg?: number;
  memoryFadeMs?: number;
  memoryClearMs?: number;
};

type RadarMemory = {
  id: string;
  kind: SpaceRadarContactKind;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  lastSeenAt: number;
};

const DEFAULT_WIDTH = 246;
const DEFAULT_HEIGHT = 66;
const DEFAULT_DEPTH = 52;
const DEFAULT_RANGE = 2600;
const DEFAULT_SWEEP_SPEED_DEG_PER_SEC = 165;
const DEFAULT_SWEEP_WIDTH_DEG = 14;
const DEFAULT_MEMORY_FADE_MS = 1400;
const DEFAULT_MEMORY_CLEAR_MS = 2400;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number): number {
  return Phaser.Math.Angle.Wrap(angle);
}

export class SpaceRadarDisplay {
  readonly root: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly frame: Phaser.GameObjects.Ellipse;
  private readonly grid: Phaser.GameObjects.Graphics;
  private readonly contactsGraphics: Phaser.GameObjects.Graphics;
  private readonly sweepGraphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly width: number;
  private readonly height: number;
  private readonly range: number;
  private readonly sweepSpeedRadPerSec: number;
  private readonly sweepHalfWidthRad: number;
  private readonly memoryFadeMs: number;
  private readonly memoryClearMs: number;
  private readonly memory = new Map<string, RadarMemory>();
  private sweepAngle = -Math.PI / 2;

  constructor(scene: Phaser.Scene, options: SpaceRadarOptions) {
    this.scene = scene;
    this.width = options.width ?? DEFAULT_WIDTH;
    this.height = options.height ?? DEFAULT_HEIGHT;
    this.range = options.range ?? DEFAULT_RANGE;
    this.sweepSpeedRadPerSec = Phaser.Math.DegToRad(options.sweepSpeedDegPerSec ?? DEFAULT_SWEEP_SPEED_DEG_PER_SEC);
    this.sweepHalfWidthRad = Phaser.Math.DegToRad((options.sweepWidthDeg ?? DEFAULT_SWEEP_WIDTH_DEG) * 0.5);
    this.memoryFadeMs = options.memoryFadeMs ?? DEFAULT_MEMORY_FADE_MS;
    this.memoryClearMs = options.memoryClearMs ?? DEFAULT_MEMORY_CLEAR_MS;

    this.frame = scene.add.ellipse(0, 0, this.width, this.height, 0x08131e, 0.86)
      .setStrokeStyle(2, getActiveUiAccentColor(), 0.52);
    this.grid = scene.add.graphics();
    this.contactsGraphics = scene.add.graphics();
    this.sweepGraphics = scene.add.graphics();
    this.label = scene.add.text(0, -(this.height * 0.5) - 6, "RADAR", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: UI_THEME.textSoft,
      fontStyle: "bold",
      letterSpacing: 1,
    }).setOrigin(0.5, 1);

    this.root = scene.add.container(options.x, options.y, [
      this.frame,
      this.grid,
      this.contactsGraphics,
      this.sweepGraphics,
      this.label,
    ]).setDepth(options.depth ?? DEFAULT_DEPTH).setScrollFactor(0);

    this.drawStaticGrid();
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  setAlpha(alpha: number): void {
    this.root.setAlpha(alpha);
  }

  destroy(): void {
    this.root.destroy(true);
    this.memory.clear();
  }

  update(
    playerX: number,
    playerY: number,
    sources: SpaceRadarContactSource[],
    nowMs: number,
    dtSeconds: number,
    isSourceDestroyed: (id: string) => boolean,
  ): void {
    this.sweepAngle = normalizeAngle(this.sweepAngle + (this.sweepSpeedRadPerSec * dtSeconds));
    const sourceById = new Map(sources.map((source) => [source.id, source]));

    sources.forEach((source) => {
      if (source.destroyed || isSourceDestroyed(source.id)) {
        this.memory.delete(source.id);
        return;
      }

      const dx = source.x - playerX;
      const dy = source.y - playerY;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      if (distance > this.range) {
        return;
      }

      const contactAngle = Math.atan2(dy, dx);
      if (!this.isWithinSweep(contactAngle)) {
        return;
      }

      this.memory.set(source.id, {
        id: source.id,
        kind: source.kind,
        label: source.label,
        x: source.x,
        y: source.y,
        radius: source.radius,
        color: source.color,
        lastSeenAt: nowMs,
      });
    });

    this.memory.forEach((entry) => {
      const source = sourceById.get(entry.id);
      if ((source && source.destroyed) || isSourceDestroyed(entry.id)) {
        this.memory.delete(entry.id);
        return;
      }

      if ((nowMs - entry.lastSeenAt) > this.memoryClearMs) {
        this.memory.delete(entry.id);
      }
    });

    this.redraw(playerX, playerY, nowMs);
  }

  getDebugSnapshot(): SpaceRadarSnapshot {
    const visibleContacts = [...this.memory.values()]
      .filter((entry) => this.getAgeMs(entry) <= this.memoryClearMs)
      .length;

    return {
      range: this.range,
      sweepAngleDeg: Math.round(Phaser.Math.RadToDeg(this.sweepAngle)),
      trackedContacts: this.memory.size,
      visibleContacts,
      contacts: [...this.memory.values()]
        .map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          label: entry.label,
          x: Math.round(entry.x),
          y: Math.round(entry.y),
          ageMs: Math.round(this.getAgeMs(entry)),
          alpha: Number(this.getContactAlpha(entry).toFixed(3)),
        }))
        .sort((left, right) => left.ageMs - right.ageMs)
        .slice(0, 18),
    };
  }

  private redraw(playerX: number, playerY: number, nowMs: number): void {
    this.contactsGraphics.clear();
    this.sweepGraphics.clear();

    const accentColor = getActiveUiAccentColor();
    const radiusX = this.width * 0.5 - 10;
    const radiusY = this.height * 0.5 - 10;
    const sweepEdge = this.getEllipsePoint(this.sweepAngle, radiusX, radiusY);

    this.frame.setStrokeStyle(2, accentColor, 0.52);
    this.grid.clear();
    this.grid.lineStyle(1, accentColor, 0.14);
    this.grid.strokeEllipse(0, 0, this.width * 0.88, this.height * 0.72);
    this.grid.lineStyle(1, accentColor, 0.1);
    this.grid.lineBetween(-radiusX * 0.72, 0, radiusX * 0.72, 0);
    this.grid.lineBetween(0, -radiusY * 0.62, 0, radiusY * 0.62);
    this.grid.lineStyle(1, 0xffffff, 0.08);
    this.grid.strokeEllipse(0, 0, this.width * 0.56, this.height * 0.44);

    this.contactsGraphics.fillStyle(accentColor, 1);
    this.contactsGraphics.fillCircle(0, 0, 1.8);
    this.contactsGraphics.lineStyle(1, accentColor, 0.24);
    this.contactsGraphics.strokeCircle(0, 0, 5);

    this.memory.forEach((entry) => {
      const ageMs = nowMs - entry.lastSeenAt;
      if (ageMs > this.memoryClearMs) {
        return;
      }

      const alpha = this.getContactAlpha(entry);
      const localX = ((entry.x - playerX) / this.range) * radiusX;
      const localY = ((entry.y - playerY) / this.range) * radiusY;
      const size = this.getContactSize(entry.kind, entry.radius);
      const pulseRadius = size + (alpha > 0.8 ? 4 : 2);

      this.drawContactShape(entry.kind, localX, localY, size, alpha, accentColor);
      this.contactsGraphics.lineStyle(1, 0xf4fbff, alpha * 0.36);
      this.contactsGraphics.strokeCircle(localX, localY, pulseRadius);
    });

    this.sweepGraphics.lineStyle(4, accentColor, 0.08);
    this.sweepGraphics.lineBetween(0, 0, sweepEdge.x, sweepEdge.y);
    this.sweepGraphics.lineStyle(2, accentColor, 0.76);
    this.sweepGraphics.lineBetween(0, 0, sweepEdge.x, sweepEdge.y);
    this.sweepGraphics.fillStyle(accentColor, 0.88);
    this.sweepGraphics.fillCircle(sweepEdge.x, sweepEdge.y, 1.9);
    this.sweepGraphics.lineStyle(1, accentColor, 0.14);
    this.sweepGraphics.strokeEllipse(0, 0, this.width * 0.86, this.height * 0.69);
  }

  private drawStaticGrid(): void {
    const accentColor = getActiveUiAccentColor();
    this.grid.clear();
    this.grid.lineStyle(1, accentColor, 0.12);
    this.grid.strokeEllipse(0, 0, this.width * 0.88, this.height * 0.72);
    this.grid.lineStyle(1, accentColor, 0.1);
    this.grid.lineBetween(-(this.width * 0.36), 0, this.width * 0.36, 0);
    this.grid.lineBetween(0, -(this.height * 0.18), 0, this.height * 0.18);
    this.grid.lineStyle(1, 0xffffff, 0.09);
    this.grid.strokeEllipse(0, 0, this.width * 0.56, this.height * 0.44);
  }

  private getContactAlpha(entry: RadarMemory): number {
    const ageMs = this.getAgeMs(entry);
    return clamp(1 - (ageMs / this.memoryFadeMs), 0.18, 1);
  }

  private getAgeMs(entry: RadarMemory): number {
    return this.scene.time.now - entry.lastSeenAt;
  }

  private getContactSize(kind: SpaceRadarContactKind, radius: number): number {
    switch (kind) {
      case "planet":
      case "mission-planet":
      case "station":
        return Math.max(5.6, radius / 24);
      case "poi":
        return Math.max(4.8, radius / 24);
      case "asteroid":
        return Math.max(4.4, radius / 20);
      case "enemy-ship":
        return Math.max(4.8, radius / 18);
      case "friendly-ship":
      case "neutral-ship":
      default:
        return Math.max(4.6, radius / 18);
    }
  }

  private drawContactShape(
    kind: SpaceRadarContactKind,
    x: number,
    y: number,
    size: number,
    alpha: number,
    accentColor: number,
  ): void {
    this.contactsGraphics.fillStyle(accentColor, alpha);
    this.contactsGraphics.lineStyle(1, 0xf4fbff, alpha * 0.42);

    switch (kind) {
      case "asteroid": {
        const points = this.getHexagonPoints(x, y, size);
        this.contactsGraphics.fillPoints(points, true);
        this.contactsGraphics.strokePoints(points, true);
        return;
      }
      case "enemy-ship": {
        this.contactsGraphics.fillTriangle(
          x,
          y - size,
          x - size * 0.92,
          y + size,
          x + size * 0.92,
          y + size,
        );
        this.contactsGraphics.strokeTriangle(
          x,
          y - size,
          x - size * 0.92,
          y + size,
          x + size * 0.92,
          y + size,
        );
        return;
      }
      case "friendly-ship":
      case "neutral-ship": {
        this.contactsGraphics.fillRect(x - size, y - size, size * 2, size * 2);
        this.contactsGraphics.strokeRect(x - size, y - size, size * 2, size * 2);
        return;
      }
      case "planet":
      case "mission-planet":
      case "station": {
        this.contactsGraphics.fillCircle(x, y, size);
        this.contactsGraphics.strokeCircle(x, y, size + 1.4);
        return;
      }
      case "poi":
      default: {
        this.contactsGraphics.fillPoints(this.getDiamondPoints(x, y, size), true);
        this.contactsGraphics.strokePoints(this.getDiamondPoints(x, y, size), true);
      }
    }
  }

  private getHexagonPoints(x: number, y: number, size: number): Phaser.Geom.Point[] {
    const points: Phaser.Geom.Point[] = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI / 3);
      points.push(new Phaser.Geom.Point(
        x + (Math.cos(angle) * size),
        y + (Math.sin(angle) * size),
      ));
    }

    return points;
  }

  private getDiamondPoints(x: number, y: number, size: number): Phaser.Geom.Point[] {
    return [
      new Phaser.Geom.Point(x, y - size),
      new Phaser.Geom.Point(x + size, y),
      new Phaser.Geom.Point(x, y + size),
      new Phaser.Geom.Point(x - size, y),
    ];
  }

  private getEllipsePoint(angle: number, radiusX: number, radiusY: number): { x: number; y: number } {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const denom = Math.sqrt(((cos * cos) / (radiusX * radiusX)) + ((sin * sin) / (radiusY * radiusY)));
    const scale = denom > 0 ? 1 / denom : 1;
    return {
      x: cos * scale,
      y: sin * scale,
    };
  }

  private isWithinSweep(contactAngle: number): boolean {
    const delta = Phaser.Math.Angle.Wrap(contactAngle - this.sweepAngle);
    return Math.abs(delta) <= this.sweepHalfWidthRad;
  }
}
