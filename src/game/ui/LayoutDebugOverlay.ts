import Phaser from "phaser";

import {
  createLayoutGrid,
  getGridRegionRect,
  type GridRegionSpec,
  type LayoutGrid,
} from "./layoutGrid";

const GRID_COLOR = 0x86b2e3;
const LABEL_COLOR = "#f7fbff";

export class LayoutDebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly gridGraphics: Phaser.GameObjects.Graphics;
  private readonly regionGraphics: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private visible = false;

  constructor(scene: Phaser.Scene, depth = 200) {
    this.scene = scene;
    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x010409, 0.12)
      .setDepth(depth)
      .setVisible(false);
    this.gridGraphics = scene.add.graphics().setDepth(depth + 1).setVisible(false);
    this.regionGraphics = scene.add.graphics().setDepth(depth + 2).setVisible(false);
    this.titleText = scene.add.text(24, 18, "UI Layout Debug", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: LABEL_COLOR,
      fontStyle: "bold",
    }).setDepth(depth + 3).setVisible(false).setScrollFactor(0);
    this.infoText = scene.add.text(24, 44, "F7 toggles this overlay", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#cfe0f7",
    }).setDepth(depth + 3).setVisible(false).setScrollFactor(0);
    this.root = scene.add.container(0, 0, [
      this.backdrop,
      this.gridGraphics,
      this.regionGraphics,
      this.titleText,
      this.infoText,
    ]).setDepth(depth);
    this.root.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.setVisible(visible);
    this.backdrop.setVisible(visible);
    this.gridGraphics.setVisible(visible);
    this.regionGraphics.setVisible(visible);
    this.titleText.setVisible(visible);
    this.infoText.setVisible(visible);
    this.labels.forEach((label) => label.setVisible(visible));
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  draw(
    bounds: Phaser.Geom.Rectangle,
    regions: GridRegionSpec[],
    caption: string,
    rows = 9,
    columns = 16,
  ): void {
    const grid = createLayoutGrid(bounds, columns, rows);
    this.clearLabels();
    this.gridGraphics.clear();
    this.regionGraphics.clear();
    this.titleText.setText(`UI Layout Debug | ${caption}`);
    this.infoText.setText(`${columns}x${rows} grid | F7 toggles overlay`);
    this.drawGrid(grid);
    this.drawRegions(grid, regions);
    if (this.visible) {
      this.setVisible(true);
    }
  }

  destroy(): void {
    this.clearLabels();
    this.root.destroy(true);
  }

  private drawGrid(grid: LayoutGrid): void {
    this.gridGraphics.lineStyle(1, GRID_COLOR, 0.22);
    for (let col = 0; col <= grid.columns; col += 1) {
      const x = grid.bounds.x + col * grid.columnWidth;
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(x, grid.bounds.y);
      this.gridGraphics.lineTo(x, grid.bounds.bottom);
      this.gridGraphics.strokePath();
    }
    for (let row = 0; row <= grid.rows; row += 1) {
      const y = grid.bounds.y + row * grid.rowHeight;
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(grid.bounds.x, y);
      this.gridGraphics.lineTo(grid.bounds.right, y);
      this.gridGraphics.strokePath();
    }
  }

  private drawRegions(grid: LayoutGrid, regions: GridRegionSpec[]): void {
    regions.forEach((region) => {
      const rect = getGridRegionRect(grid, region);
      const color = region.color ?? 0x57a7ff;
      const alpha = region.alpha ?? 0.22;
      this.regionGraphics.fillStyle(color, alpha);
      this.regionGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      this.regionGraphics.lineStyle(2, color, 0.88);
      this.regionGraphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
      const label = this.scene.add.text(rect.x + 6, rect.y + 4, `${region.id}${region.label ? ` ${region.label}` : ""}`, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: LABEL_COLOR,
        fontStyle: "bold",
      }).setDepth(this.root.depth + 3).setScrollFactor(0).setVisible(this.visible);
      this.labels.push(label);
    });
  }

  private clearLabels(): void {
    this.labels.splice(0).forEach((label) => label.destroy());
  }
}
