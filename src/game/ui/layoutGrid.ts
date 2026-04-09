import Phaser from "phaser";

export const UI_GRID_COLUMNS = 16;
export const UI_GRID_ROWS = 9;

export type GridRegionSpec = {
  id: number | string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  color?: number;
  alpha?: number;
  label?: string;
};

export type LayoutGrid = {
  bounds: Phaser.Geom.Rectangle;
  columns: number;
  rows: number;
  columnWidth: number;
  rowHeight: number;
};

export function createLayoutGrid(
  bounds: Phaser.Geom.Rectangle,
  columns = UI_GRID_COLUMNS,
  rows = UI_GRID_ROWS,
): LayoutGrid {
  return {
    bounds,
    columns,
    rows,
    columnWidth: bounds.width / columns,
    rowHeight: bounds.height / rows,
  };
}

export function getGridRegionRect(grid: LayoutGrid, spec: GridRegionSpec): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    grid.bounds.x + spec.col * grid.columnWidth,
    grid.bounds.y + spec.row * grid.rowHeight,
    spec.colSpan * grid.columnWidth,
    spec.rowSpan * grid.rowHeight,
  );
}

export function insetRect(rect: Phaser.Geom.Rectangle, insetX: number, insetY = insetX): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    rect.x + insetX,
    rect.y + insetY,
    Math.max(0, rect.width - insetX * 2),
    Math.max(0, rect.height - insetY * 2),
  );
}
