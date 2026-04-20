import Phaser from "phaser";

import {
  GALAXY_HAZE_NODES,
  GALAXY_SECTORS,
  GALAXY_STARS,
  GALAXY_WORLD_CONFIG,
  getGalaxyRadialDistance,
  getGalaxySectorAtPosition,
  getGalaxySectorLabelPoint,
  getGalaxySectorPolygonPoints,
  getMissionPlanetForMission,
  type GalaxySectorConfig,
} from "../content/galaxy";
import { getMissionContract } from "../content/missions";
import { gameSession } from "../core/session";
import { createMenuButton, type MenuButton } from "./buttons";

type MapTab = "inventory" | "skills" | "missions" | "map" | "starship";

type GalaxyMapOverlayOptions = {
  scene: Phaser.Scene;
  onClose: () => void;
  onOpenSettings?: () => void;
  onRequestTab?: (tab: Exclude<MapTab, "map">) => void;
};

const PANEL_DEPTH = 60;
const WINDOW = new Phaser.Geom.Rectangle(96, 54, 1088, 612);
const MAP_RECT = new Phaser.Geom.Rectangle(WINDOW.x + 20, WINDOW.y + 122, 690, 430);
const INFO_RECT = new Phaser.Geom.Rectangle(WINDOW.right - 334, WINDOW.y + 122, 314, 430);
const SECTOR_VIEW_PADDING = 900;
const TAB_LAYOUT = [
  { tab: "inventory", label: "Inventory", x: 428 },
  { tab: "skills", label: "Skills", x: 562 },
  { tab: "missions", label: "Missions", x: 696 },
  { tab: "map", label: "Map", x: 830 },
  { tab: "starship", label: "Starship", x: 964 },
] as const;

function colorToCss(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

export class GalaxyMapOverlay {
  private readonly onClose: () => void;
  private readonly onOpenSettings: () => void;
  private readonly onRequestTab?: (tab: Exclude<MapTab, "map">) => void;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly staticMap: Phaser.GameObjects.Graphics;
  private readonly markerMap: Phaser.GameObjects.Graphics;
  private readonly mapInputZone: Phaser.GameObjects.Zone;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly infoTitle: Phaser.GameObjects.Text;
  private readonly routeText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly hoverText: Phaser.GameObjects.Text;
  private readonly footerText: Phaser.GameObjects.Text;
  private readonly playerLabel: Phaser.GameObjects.Text;
  private readonly missionLabel: Phaser.GameObjects.Text;
  private readonly hoverLabel: Phaser.GameObjects.Text;
  private readonly sectorLabels: Phaser.GameObjects.Text[] = [];
  private readonly closeButton: MenuButton;
  private readonly sectorBackButton: MenuButton;
  private readonly settingsButton: MenuButton;
  private readonly tabButtons: Partial<Record<MapTab, MenuButton>> = {};
  private hoverWorldPoint: { x: number; y: number } | null = null;
  private selectedSectorId: string | null = null;

  constructor({ scene, onClose, onOpenSettings, onRequestTab }: GalaxyMapOverlayOptions) {
    this.onClose = onClose;
    this.onOpenSettings = onOpenSettings ?? onClose;
    this.onRequestTab = onRequestTab;

    this.backdrop = scene.add.rectangle(640, 360, 1280, 720, 0x02060c, 0.14)
      .setDepth(PANEL_DEPTH)
      .setInteractive();
    this.backdrop.on("pointerdown", () => this.hide());

    const panel = scene.add.rectangle(WINDOW.centerX, WINDOW.centerY, WINDOW.width, WINDOW.height, 0x08111b, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(3, 0x365a82, 0.82);
    const panelInset = scene.add.rectangle(WINDOW.centerX, WINDOW.centerY, WINDOW.width - 18, WINDOW.height - 18, 0x091724, 0.985)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(1, 0x294563, 0.72);
    const topBar = scene.add.rectangle(WINDOW.centerX, WINDOW.y + 42, WINDOW.width - 40, 58, 0x0b1522, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, 0x294563, 0.78);

    this.title = scene.add.text(WINDOW.x + 24, WINDOW.y + 20, "Data Pad", {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#f5fbff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.subtitle = scene.add.text(WINDOW.x + 24, WINDOW.y + 94, "Galaxy Map", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#bdd2ec",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);

    this.settingsButton = createMenuButton({
      scene,
      x: WINDOW.x + 54,
      y: WINDOW.y + 58,
      width: 84,
      height: 36,
      label: "Pause",
      onClick: () => {
        this.hide();
        this.onOpenSettings();
      },
      depth: PANEL_DEPTH + 2,
      accentColor: 0x283d59,
    });

    TAB_LAYOUT.forEach(({ tab, label, x }) => {
      this.tabButtons[tab] = createMenuButton({
        scene,
        x,
        y: WINDOW.y + 58,
        width: tab === "starship" ? 126 : 118,
        height: 36,
        label,
        onClick: () => this.handleTab(tab),
        depth: PANEL_DEPTH + 2,
        accentColor: tab === "map" ? 0x305c86 : 0x214467,
      });
    });
    this.tabButtons.skills?.setEnabled(false);
    this.tabButtons.starship?.setEnabled(false);

    this.closeButton = createMenuButton({
      scene,
      x: WINDOW.right - 54,
      y: WINDOW.y + 58,
      width: 84,
      height: 36,
      label: "Close",
      onClick: () => this.hide(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x283d59,
    });

    this.sectorBackButton = createMenuButton({
      scene,
      x: MAP_RECT.right - 76,
      y: MAP_RECT.y - 28,
      width: 132,
      height: 34,
      label: "Full Galaxy",
      onClick: () => this.returnToGalaxyView(),
      depth: PANEL_DEPTH + 2,
      accentColor: 0x214467,
    });

    const mapPanel = scene.add.rectangle(MAP_RECT.centerX, MAP_RECT.centerY, MAP_RECT.width, MAP_RECT.height, 0x07111d, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, 0x365a82, 0.74);
    const infoPanel = scene.add.rectangle(INFO_RECT.centerX, INFO_RECT.centerY, INFO_RECT.width, INFO_RECT.height, 0x0b1622, 0.98)
      .setDepth(PANEL_DEPTH + 1)
      .setStrokeStyle(2, 0x365a82, 0.66);

    const mapHeader = scene.add.text(MAP_RECT.x + 14, MAP_RECT.y - 28, "Shared Galaxy Layout", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.infoTitle = scene.add.text(INFO_RECT.x + 14, INFO_RECT.y + 12, "Current Readout", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#eef6ff",
      fontStyle: "bold",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.routeText = scene.add.text(INFO_RECT.x + 14, INFO_RECT.y + 44, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#dceafd",
      lineSpacing: 4,
      wordWrap: { width: INFO_RECT.width - 28 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.detailText = scene.add.text(INFO_RECT.x + 14, INFO_RECT.y + 136, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#9fc6ff",
      lineSpacing: 4,
      wordWrap: { width: INFO_RECT.width - 28 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.hoverText = scene.add.text(INFO_RECT.x + 14, INFO_RECT.y + 274, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d7e8ff",
      lineSpacing: 4,
      wordWrap: { width: INFO_RECT.width - 28 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.footerText = scene.add.text(INFO_RECT.x + 14, INFO_RECT.bottom - 84, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#8da6c3",
      lineSpacing: 4,
      wordWrap: { width: INFO_RECT.width - 28 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    const legendY = INFO_RECT.bottom - 42;
    const playerSwatch = scene.add.circle(INFO_RECT.x + 24, legendY, 7, 0x8fe3ff, 1).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const missionSwatch = scene.add.circle(INFO_RECT.x + 138, legendY, 7, 0xffb86c, 1).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const hoverSwatch = scene.add.circle(INFO_RECT.x + 246, legendY, 7, 0xffffff, 0).setStrokeStyle(2, 0xdcecff, 0.9).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const legendPlayer = scene.add.text(INFO_RECT.x + 38, legendY - 9, "Ship", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d7e8ff",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const legendMission = scene.add.text(INFO_RECT.x + 152, legendY - 9, "Mission", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d7e8ff",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    const legendHover = scene.add.text(INFO_RECT.x + 260, legendY - 9, "Hover", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#d7e8ff",
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0);

    this.staticMap = scene.add.graphics().setDepth(PANEL_DEPTH + 2).setScrollFactor(0);
    this.markerMap = scene.add.graphics().setDepth(PANEL_DEPTH + 5).setScrollFactor(0);

    this.playerLabel = scene.add.text(0, 0, "SHIP", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#dff7ff",
      fontStyle: "bold",
      backgroundColor: "#03111de6",
      padding: { x: 6, y: 3 },
    }).setDepth(PANEL_DEPTH + 6).setScrollFactor(0).setVisible(false);

    this.missionLabel = scene.add.text(0, 0, "MISSION", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#fff1d0",
      fontStyle: "bold",
      backgroundColor: "#08111bd8",
      padding: { x: 4, y: 2 },
    }).setDepth(PANEL_DEPTH + 4).setScrollFactor(0).setVisible(false);

    this.hoverLabel = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#eef6ff",
      backgroundColor: "#08111bd8",
      padding: { x: 4, y: 2 },
    }).setDepth(PANEL_DEPTH + 4).setScrollFactor(0).setVisible(false);

    GALAXY_SECTORS.forEach((sector) => {
      const labelPoint = this.worldToMap(getGalaxySectorLabelPoint(sector));
      const label = scene.add.text(labelPoint.x, labelPoint.y, sector.label.replace(" ", "\n"), {
        fontFamily: "Arial",
        fontSize: "14px",
        color: colorToCss(sector.borderColor),
        fontStyle: "bold",
        align: "center",
        backgroundColor: "#08111bc4",
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
      this.sectorLabels.push(label);
    });

    this.mapInputZone = scene.add.zone(MAP_RECT.x, MAP_RECT.y, MAP_RECT.width, MAP_RECT.height)
      .setOrigin(0, 0)
      .setDepth(PANEL_DEPTH + 4)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.mapInputZone.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.mapInputZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.mapInputZone.on("pointerout", () => this.clearHover());

    this.root = scene.add.container(0, 0, [
      this.backdrop,
      panel,
      panelInset,
      topBar,
      mapPanel,
      infoPanel,
      mapHeader,
      this.sectorBackButton.container,
      this.title,
      this.subtitle,
      this.infoTitle,
      this.routeText,
      this.detailText,
      this.hoverText,
      this.footerText,
      legendPlayer,
      legendMission,
      legendHover,
      playerSwatch,
      missionSwatch,
      hoverSwatch,
      this.staticMap,
      ...this.sectorLabels,
      this.markerMap,
      this.playerLabel,
      this.missionLabel,
      this.hoverLabel,
      this.mapInputZone,
      this.settingsButton.container,
      this.closeButton.container,
      ...Object.values(this.tabButtons).flatMap((button) => (button ? [button.container] : [])),
    ]).setDepth(PANEL_DEPTH);

    this.root.bringToTop(this.markerMap);
    this.root.bringToTop(this.missionLabel);
    this.root.bringToTop(this.playerLabel);
    this.root.bringToTop(this.hoverLabel);
    this.root.bringToTop(this.mapInputZone);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(): void {
    this.selectedSectorId = null;
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.refresh();
  }

  hide(): void {
    this.root.setVisible(false);
    this.setInputEnabled(false);
    this.clearHover();
    this.onClose();
  }

  isVisible(): boolean {
    return this.root.visible;
  }

  refresh(): void {
    this.drawMap();
    this.syncReadout();
  }

  private handleTab(tab: MapTab): void {
    if (tab === "map") {
      return;
    }

    if (tab === "skills" || tab === "starship") {
      this.detailText.setText(`${TAB_LAYOUT.find((entry) => entry.tab === tab)?.label ?? "This"} tab is scaffolded and will be wired in after the galaxy foundation settles.`);
      return;
    }

    this.hide();
    this.root.scene.time.delayedCall(0, () => {
      this.onRequestTab?.(tab as Exclude<MapTab, "map">);
    });
  }

  private setInputEnabled(enabled: boolean): void {
    this.backdrop.input && (this.backdrop.input.enabled = enabled);
    this.mapInputZone.input && (this.mapInputZone.input.enabled = enabled);
    this.settingsButton.setInputEnabled(enabled);
    this.closeButton.setInputEnabled(enabled);
    this.sectorBackButton.setInputEnabled(enabled && this.selectedSectorId !== null);
    Object.values(this.tabButtons).forEach((button) => button?.setInputEnabled(enabled));
  }

  private drawMap(): void {
    this.staticMap.clear();
    this.markerMap.clear();
    const viewBounds = this.getMapViewBounds();
    const selectedSector = this.selectedSectorId
      ? GALAXY_SECTORS.find((sector) => sector.id === this.selectedSectorId) ?? null
      : null;

    this.staticMap.fillStyle(0x050913, 1);
    this.staticMap.fillRect(MAP_RECT.x + 4, MAP_RECT.y + 4, MAP_RECT.width - 8, MAP_RECT.height - 8);

    this.staticMap.lineStyle(1, 0x17304f, 0.52);
    for (let step = 1; step < 4; step += 1) {
      const verticalX = MAP_RECT.x + (MAP_RECT.width * step) / 4;
      const horizontalY = MAP_RECT.y + (MAP_RECT.height * step) / 4;
      this.staticMap.lineBetween(verticalX, MAP_RECT.y, verticalX, MAP_RECT.bottom);
      this.staticMap.lineBetween(MAP_RECT.x, horizontalY, MAP_RECT.right, horizontalY);
    }

    GALAXY_HAZE_NODES.forEach((node) => {
      if (selectedSector && !this.isPointInsideSector(node, selectedSector)) {
        return;
      }
      if (!this.isWorldPointVisible(node, viewBounds, node.radius)) {
        return;
      }
      const point = this.worldToMap(node);
      this.staticMap.fillStyle(node.color, node.alpha * 1.9);
      this.staticMap.fillCircle(point.x, point.y, this.scaleWorldLengthToMap(node.radius, viewBounds));
    });

    if (selectedSector) {
      this.drawSector(selectedSector);
    } else {
      GALAXY_SECTORS.forEach((sector) => {
        this.drawSector(sector);
      });

      const core = this.worldToMap(GALAXY_WORLD_CONFIG.center);
      this.staticMap.fillStyle(0x214c71, 0.22);
      this.staticMap.fillCircle(core.x, core.y, this.scaleWorldLengthToMap(GALAXY_WORLD_CONFIG.coreRadius * 1.22, viewBounds));
      this.staticMap.fillStyle(0xe5f4ff, 0.18);
      this.staticMap.fillCircle(core.x, core.y, this.scaleWorldLengthToMap(GALAXY_WORLD_CONFIG.coreRadius * 0.48, viewBounds));
    }

    GALAXY_STARS.forEach((star) => {
      if (selectedSector && !this.isPointInsideSector(star, selectedSector)) {
        return;
      }
      if (!this.isWorldPointVisible(star, viewBounds, star.size * 10)) {
        return;
      }
      const point = this.worldToMap(star);
      this.staticMap.fillStyle(star.color, star.alpha);
      this.staticMap.fillCircle(point.x, point.y, Math.max(0.45, star.size * 0.54));
    });
  }

  private drawSector(sector: GalaxySectorConfig): void {
    const polygon = getGalaxySectorPolygonPoints(sector);
    const mapped: number[] = [];
    for (let index = 0; index < polygon.length; index += 2) {
      const point = this.worldToMap({ x: polygon[index], y: polygon[index + 1] });
      mapped.push(point.x, point.y);
    }

    const shape = new Phaser.Geom.Polygon(mapped);
    const isSelectedSector = sector.id === this.selectedSectorId;
    this.staticMap.fillStyle(sector.color, isSelectedSector ? 0.28 : 0.16);
    this.staticMap.fillPoints(shape.points, true);
    this.staticMap.lineStyle(isSelectedSector ? 3 : 2, sector.borderColor, isSelectedSector ? 0.94 : 0.54);
    this.staticMap.strokePoints(shape.points, true);
  }

  private syncReadout(): void {
    const playerPosition = gameSession.getShipSpacePosition();
    const playerSector = getGalaxySectorAtPosition(playerPosition.x, playerPosition.y);
    const selectedSector = this.selectedSectorId
      ? GALAXY_SECTORS.find((sector) => sector.id === this.selectedSectorId) ?? null
      : null;
    const viewBounds = this.getMapViewBounds();
    const missionId = gameSession.getTrackedMissionId();
    const mission = missionId ? getMissionContract(missionId) : null;
    const missionPlanet = getMissionPlanetForMission(missionId);
    const travel = gameSession.getShipTravelState();

    this.subtitle.setText(selectedSector ? `${selectedSector.label} Sector Detail` : "Galaxy Map");
    this.infoTitle.setText(selectedSector ? `${selectedSector.label} Readout` : "Current Readout");
    this.sectorBackButton.container.setVisible(selectedSector !== null);
    this.sectorBackButton.setInputEnabled(this.root.visible && selectedSector !== null);

    this.routeText.setText([
      `Ship: X ${playerPosition.x}  Y ${playerPosition.y}`,
      `Sector: ${playerSector.label}`,
      `Travel state: ${travel.status}`,
    ].join("\n"));

    this.detailText.setText(selectedSector
      ? [
          `${selectedSector.label} uses the same galaxy coordinates as live space.`,
          `Sector span: ${Math.round(selectedSector.innerRadius)} - ${Math.round(selectedSector.outerRadius)} radius`,
          missionPlanet && getGalaxySectorAtPosition(missionPlanet.x, missionPlanet.y).id === selectedSector.id
            ? `Mission planet in sector: ${missionPlanet.name}`
            : "Mission planet is outside this sector detail view.",
          "Future sector content can anchor here without changing the shared map data.",
        ].join("\n")
      : missionPlanet
        ? [
            `Current route: ${mission?.title ?? missionPlanet.missionId}`,
            `Mission planet: ${missionPlanet.name}`,
            `Planet coords: X ${Math.round(missionPlanet.x)}  Y ${Math.round(missionPlanet.y)}`,
            `Planet sector: ${getGalaxySectorAtPosition(missionPlanet.x, missionPlanet.y).label}`,
          ].join("\n")
        : "No mission planet staged. Accept or select a contract and the route target will appear here in the shared galaxy layout.");

    this.hoverText.setText(this.hoverWorldPoint
      ? (() => {
          const hoverSector = getGalaxySectorAtPosition(this.hoverWorldPoint.x, this.hoverWorldPoint.y);
          return [
            `Hover: X ${this.hoverWorldPoint.x}  Y ${this.hoverWorldPoint.y}`,
            `Hover sector: ${hoverSector.label}`,
          ].join("\n");
        })()
      : "Hover over the map to inspect live galaxy coordinates.");

    this.footerText.setText(selectedSector
      ? "Sector detail is a zoomed view of the same playable galaxy. Use Full Galaxy to return to the overview."
      : "This is the same coordinate space used by the playable space map. Normal flight stays local; the datapad shows the full structure.");

    this.markerMap.clear();
    if (this.isWorldPointVisible(playerPosition, viewBounds)) {
      const playerMarker = this.worldToMap(playerPosition);
      this.markerMap.fillStyle(0x8fe3ff, 1);
      this.markerMap.fillCircle(playerMarker.x, playerMarker.y, 5);
      this.markerMap.lineStyle(3, 0xf3fbff, 0.98);
      this.markerMap.strokeCircle(playerMarker.x, playerMarker.y, 11);
      this.markerMap.lineStyle(2, 0x8fe3ff, 0.96);
      this.markerMap.strokeCircle(playerMarker.x, playerMarker.y, 17);
      this.markerMap.lineBetween(playerMarker.x - 14, playerMarker.y, playerMarker.x + 14, playerMarker.y);
      this.markerMap.lineBetween(playerMarker.x, playerMarker.y - 14, playerMarker.x, playerMarker.y + 14);
      this.playerLabel.setPosition(playerMarker.x + 18, playerMarker.y - 24).setVisible(true);
      this.playerLabel.setText("YOU");
    } else {
      this.playerLabel.setVisible(false);
    }

    if (missionPlanet && this.isWorldPointVisible(missionPlanet, viewBounds, missionPlanet.radius)) {
      const missionMarker = this.worldToMap(missionPlanet);
      this.markerMap.fillStyle(missionPlanet.color, 0.9);
      this.markerMap.fillCircle(missionMarker.x, missionMarker.y, 6);
      this.markerMap.lineStyle(2, 0xffefc6, 0.96);
      this.markerMap.strokeCircle(missionMarker.x, missionMarker.y, 12);
      this.markerMap.strokeCircle(missionMarker.x, missionMarker.y, 18);
      this.missionLabel
        .setPosition(missionMarker.x + 16, missionMarker.y + 10)
        .setText(`${missionPlanet.name}`)
        .setVisible(true);
    } else {
      this.missionLabel.setVisible(false);
    }

    if (this.hoverWorldPoint && this.isWorldPointVisible(this.hoverWorldPoint, viewBounds)) {
      const hoverMarker = this.worldToMap(this.hoverWorldPoint);
      this.markerMap.lineStyle(2, 0xdde9ff, 0.96);
      this.markerMap.strokeCircle(hoverMarker.x, hoverMarker.y, 10);
      this.hoverLabel
        .setPosition(hoverMarker.x + 16, hoverMarker.y - 4)
        .setText(`${this.hoverWorldPoint.x}, ${this.hoverWorldPoint.y}`)
        .setVisible(true);
    } else {
      this.hoverLabel.setVisible(false);
    }

    GALAXY_SECTORS.forEach((sector, index) => {
      const label = this.sectorLabels[index];
      const labelPoint = this.worldToMap(getGalaxySectorLabelPoint(sector));
      const isVisible = (!selectedSector || selectedSector.id === sector.id)
        && this.isWorldPointVisible(getGalaxySectorLabelPoint(sector), viewBounds);
      label
        .setText(selectedSector && selectedSector.id === sector.id ? sector.label : sector.label.replace(" ", "\n"))
        .setPosition(labelPoint.x, labelPoint.y)
        .setVisible(isVisible);
    });

    this.root.bringToTop(this.markerMap);
    this.root.bringToTop(this.missionLabel);
    this.root.bringToTop(this.playerLabel);
    this.root.bringToTop(this.hoverLabel);
    this.root.bringToTop(this.sectorBackButton.container);
    this.root.bringToTop(this.mapInputZone);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.mapToWorld(pointer.x, pointer.y);
    this.hoverWorldPoint = worldPoint;
    this.syncReadout();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const worldPoint = this.mapToWorld(pointer.x, pointer.y);
    this.hoverWorldPoint = worldPoint;
    const clickedSector = this.getSectorAtWorldPoint(worldPoint);
    if (clickedSector && clickedSector.id !== this.selectedSectorId) {
      this.selectedSectorId = clickedSector.id;
      this.drawMap();
    }
    this.syncReadout();
  }

  private clearHover(): void {
    this.hoverWorldPoint = null;
    this.hoverLabel.setVisible(false);
    if (this.root.visible) {
      this.syncReadout();
    }
  }

  private returnToGalaxyView(): void {
    if (!this.selectedSectorId) {
      return;
    }

    this.selectedSectorId = null;
    this.drawMap();
    this.syncReadout();
  }

  private getMapViewBounds(): Phaser.Geom.Rectangle {
    if (!this.selectedSectorId) {
      return new Phaser.Geom.Rectangle(0, 0, GALAXY_WORLD_CONFIG.width, GALAXY_WORLD_CONFIG.height);
    }

    const sector = GALAXY_SECTORS.find((entry) => entry.id === this.selectedSectorId);
    if (!sector) {
      return new Phaser.Geom.Rectangle(0, 0, GALAXY_WORLD_CONFIG.width, GALAXY_WORLD_CONFIG.height);
    }

    const polygon = getGalaxySectorPolygonPoints(sector);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < polygon.length; index += 2) {
      minX = Math.min(minX, polygon[index]);
      maxX = Math.max(maxX, polygon[index]);
      minY = Math.min(minY, polygon[index + 1]);
      maxY = Math.max(maxY, polygon[index + 1]);
    }

    const paddedMinX = Phaser.Math.Clamp(minX - SECTOR_VIEW_PADDING, 0, GALAXY_WORLD_CONFIG.width);
    const paddedMaxX = Phaser.Math.Clamp(maxX + SECTOR_VIEW_PADDING, 0, GALAXY_WORLD_CONFIG.width);
    const paddedMinY = Phaser.Math.Clamp(minY - SECTOR_VIEW_PADDING, 0, GALAXY_WORLD_CONFIG.height);
    const paddedMaxY = Phaser.Math.Clamp(maxY + SECTOR_VIEW_PADDING, 0, GALAXY_WORLD_CONFIG.height);

    return new Phaser.Geom.Rectangle(
      paddedMinX,
      paddedMinY,
      Math.max(1, paddedMaxX - paddedMinX),
      Math.max(1, paddedMaxY - paddedMinY),
    );
  }

  private scaleWorldLengthToMap(length: number, viewBounds: Phaser.Geom.Rectangle): number {
    return (length / viewBounds.width) * MAP_RECT.width;
  }

  private isWorldPointVisible(
    point: { x: number; y: number },
    viewBounds: Phaser.Geom.Rectangle,
    padding = 0,
  ): boolean {
    return point.x >= (viewBounds.x - padding)
      && point.x <= (viewBounds.right + padding)
      && point.y >= (viewBounds.y - padding)
      && point.y <= (viewBounds.bottom + padding);
  }

  private getSectorAtWorldPoint(point: { x: number; y: number }): GalaxySectorConfig | null {
    const sector = getGalaxySectorAtPosition(point.x, point.y);
    return this.isPointInsideSector(point, sector) ? sector : null;
  }

  private isPointInsideSector(point: { x: number; y: number }, sector: GalaxySectorConfig): boolean {
    const radialDistance = getGalaxyRadialDistance(point.x, point.y);
    return radialDistance >= sector.innerRadius && radialDistance <= sector.outerRadius;
  }

  private worldToMap(point: { x: number; y: number }): { x: number; y: number } {
    const viewBounds = this.getMapViewBounds();
    return {
      x: MAP_RECT.x + ((point.x - viewBounds.x) / viewBounds.width) * MAP_RECT.width,
      y: MAP_RECT.y + ((point.y - viewBounds.y) / viewBounds.height) * MAP_RECT.height,
    };
  }

  private mapToWorld(x: number, y: number): { x: number; y: number } {
    const viewBounds = this.getMapViewBounds();
    const clampedX = Phaser.Math.Clamp(x, MAP_RECT.x, MAP_RECT.right);
    const clampedY = Phaser.Math.Clamp(y, MAP_RECT.y, MAP_RECT.bottom);
    return {
      x: Math.round(viewBounds.x + (((clampedX - MAP_RECT.x) / MAP_RECT.width) * viewBounds.width)),
      y: Math.round(viewBounds.y + (((clampedY - MAP_RECT.y) / MAP_RECT.height) * viewBounds.height)),
    };
  }
}
