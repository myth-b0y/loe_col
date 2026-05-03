import Phaser from "phaser";

import {
  GALAXY_HAZE_NODES,
  GALAXY_RINGS,
  GALAXY_SECTORS,
  GALAXY_STARS,
  GALAXY_WORLD_CONFIG,
  getGalaxyControllerDisplayLabel,
  type GalaxyDefinition,
  getGalaxyControllerPalette,
  getGalaxyMoonPositionAtTime,
  getGalaxyPlanetPositionAtTime,
  getGalaxyRadialDistance,
  getGalaxyRegionLabelAtPosition,
  getGalaxySectorAtPosition,
  getGalaxySectorDisplayLabel,
  getGalaxySectorLabelPoint,
  getGalaxySectorPolygonPoints,
  type GalaxySectorConfig,
  type GalaxySystemRecord,
  type GalaxyZoneControllerId,
  type GalaxyZoneRecord,
} from "../content/galaxy";
import { getFactionAssetBuildTimeMs } from "../content/factionAssets";
import { isZoneActivelyContested } from "../content/factionWar";
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

type MapProductionIndicator = {
  poolId: string;
  systemId: string;
  raceId: GalaxyZoneControllerId;
  kind: "zone" | "prime-world";
  assetId: string;
  progress: number;
  remainingMs: number;
};

type MapZoneCaptureIndicator = {
  zoneId: string;
  zoneName: string;
  attackerId: GalaxyZoneRecord["captureAttackerRaceId"];
  controllerId: GalaxyZoneRecord["currentControllerId"];
  progress: number;
  point: { x: number; y: number };
};

const PANEL_DEPTH = 60;
const WINDOW = new Phaser.Geom.Rectangle(96, 54, 1088, 612);
const MAP_RECT = new Phaser.Geom.Rectangle(WINDOW.x + 20, WINDOW.y + 122, 690, 430);
const INFO_RECT = new Phaser.Geom.Rectangle(WINDOW.right - 334, WINDOW.y + 122, 314, 430);
const SECTOR_VIEW_PADDING = 900;
const MAP_SNAPSHOT_REDRAW_INTERVAL_MS = 1200;
const MAP_DATA_REFRESH_INTERVAL_MS = 450;
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
  private readonly scene: Phaser.Scene;
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
  private readonly homeworldLabel: Phaser.GameObjects.Text;
  private readonly sectorLabels: Phaser.GameObjects.Text[] = [];
  private readonly closeButton: MenuButton;
  private readonly sectorBackButton: MenuButton;
  private readonly settingsButton: MenuButton;
  private readonly tabButtons: Partial<Record<MapTab, MenuButton>> = {};
  private hoverWorldPoint: { x: number; y: number } | null = null;
  private selectedSectorId: string | null = null;
  private cachedGalaxy: GalaxyDefinition | null = null;
  private cachedHomeworlds: ReturnType<typeof gameSession.getHomeworldPlanets> = [];
  private cachedSystemsById = new Map<string, GalaxySystemRecord>();
  private cachedPlanetsBySystemId = new Map<string, GalaxyDefinition["planets"]>();
  private cachedMoonsByPlanetId = new Map<string, GalaxyDefinition["moons"]>();
  private cachedZonesBySectorId = new Map<string, GalaxyDefinition["zones"]>();
  private cachedStaticViewKey = "";
  private lastStaticDrawMs = Number.NEGATIVE_INFINITY;
  private lastSnapshotCaptureMs = Number.NEGATIVE_INFINITY;

  constructor({ scene, onClose, onOpenSettings, onRequestTab }: GalaxyMapOverlayOptions) {
    this.scene = scene;
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

    this.hoverText = scene.add.text(INFO_RECT.x + 14, INFO_RECT.y + 300, "", {
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

    this.homeworldLabel = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#fff4d2",
      fontStyle: "bold",
      backgroundColor: "#10203ad6",
      padding: { x: 6, y: 3 },
    }).setDepth(PANEL_DEPTH + 5).setScrollFactor(0).setVisible(false);

    GALAXY_SECTORS.forEach((sector) => {
      const labelPlacement = this.getSectorLabelPlacement(sector);
      const label = scene.add.text(labelPlacement.point.x, labelPlacement.point.y, sector.label.replace(" ", "\n"), {
        fontFamily: "Arial",
        fontSize: labelPlacement.fontSize,
        color: colorToCss(sector.borderColor),
        fontStyle: "bold",
        align: labelPlacement.originX === 0 ? "left" : labelPlacement.originX === 1 ? "right" : "center",
        backgroundColor: "#08111b8f",
        padding: { x: 4, y: 3 },
      }).setOrigin(labelPlacement.originX, labelPlacement.originY).setAlpha(0.82).setDepth(PANEL_DEPTH + 3).setScrollFactor(0);
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
      this.homeworldLabel,
      this.mapInputZone,
      this.settingsButton.container,
      this.closeButton.container,
      ...Object.values(this.tabButtons).flatMap((button) => (button ? [button.container] : [])),
    ]).setDepth(PANEL_DEPTH);

    this.root.bringToTop(this.markerMap);
    this.root.bringToTop(this.missionLabel);
    this.root.bringToTop(this.playerLabel);
    this.root.bringToTop(this.hoverLabel);
    this.root.bringToTop(this.homeworldLabel);
    this.root.bringToTop(this.mapInputZone);

    this.root.setVisible(false);
    this.setInputEnabled(false);
  }

  show(): void {
    this.selectedSectorId = null;
    this.captureGalaxySnapshot();
    this.root.setVisible(true);
    this.setInputEnabled(true);
    this.refresh(true);
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

  refresh(forceStatic = false): void {
    if (forceStatic || this.shouldRefreshGalaxySnapshot()) {
      this.captureGalaxySnapshot();
    }
    this.ensureGalaxySnapshot();
    const viewBounds = this.getMapViewBounds();
    const orbitTimeMs = this.scene.time.now;
    if (this.shouldRedrawStaticMap(viewBounds, orbitTimeMs, forceStatic)) {
      this.drawMap(viewBounds, orbitTimeMs);
      this.cachedStaticViewKey = this.getStaticViewKey(viewBounds);
      this.lastStaticDrawMs = orbitTimeMs;
    }
    this.syncReadout(viewBounds, orbitTimeMs);
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

  private captureGalaxySnapshot(): void {
    this.cachedGalaxy = gameSession.getGalaxyDefinition();
    this.cachedHomeworlds = gameSession.getHomeworldPlanets();
    this.cachedSystemsById.clear();
    this.cachedPlanetsBySystemId.clear();
    this.cachedMoonsByPlanetId.clear();
    this.cachedZonesBySectorId.clear();

    this.cachedGalaxy.systems.forEach((system) => {
      this.cachedSystemsById.set(system.id, system);
    });

    this.cachedGalaxy.planets.forEach((planet) => {
      const bucket = this.cachedPlanetsBySystemId.get(planet.systemId);
      if (bucket) {
        bucket.push(planet);
        return;
      }
      this.cachedPlanetsBySystemId.set(planet.systemId, [planet]);
    });

    this.cachedGalaxy.moons.forEach((moon) => {
      const bucket = this.cachedMoonsByPlanetId.get(moon.planetId);
      if (bucket) {
        bucket.push(moon);
        return;
      }
      this.cachedMoonsByPlanetId.set(moon.planetId, [moon]);
    });

    this.cachedGalaxy.zones.forEach((zone) => {
      const bucket = this.cachedZonesBySectorId.get(zone.sectorId);
      if (bucket) {
        bucket.push(zone);
        return;
      }
      this.cachedZonesBySectorId.set(zone.sectorId, [zone]);
    });

    this.cachedStaticViewKey = "";
    this.lastStaticDrawMs = Number.NEGATIVE_INFINITY;
    this.lastSnapshotCaptureMs = this.scene.time.now;
  }

  private ensureGalaxySnapshot(): void {
    if (!this.cachedGalaxy) {
      this.captureGalaxySnapshot();
    }
  }

  private shouldRefreshGalaxySnapshot(): boolean {
    if (!this.cachedGalaxy) {
      return true;
    }
    return (this.scene.time.now - this.lastSnapshotCaptureMs) >= MAP_DATA_REFRESH_INTERVAL_MS;
  }

  private getStaticViewKey(viewBounds: Phaser.Geom.Rectangle): string {
    return [
      this.selectedSectorId ?? "galaxy",
      Math.round(viewBounds.x),
      Math.round(viewBounds.y),
      Math.round(viewBounds.width),
      Math.round(viewBounds.height),
    ].join(":");
  }

  private shouldRedrawStaticMap(
    viewBounds: Phaser.Geom.Rectangle,
    orbitTimeMs: number,
    forceStatic: boolean,
  ): boolean {
    if (forceStatic || !this.cachedGalaxy) {
      return true;
    }

    if (this.cachedStaticViewKey !== this.getStaticViewKey(viewBounds)) {
      return true;
    }

    return (orbitTimeMs - this.lastStaticDrawMs) >= this.getStaticRedrawIntervalMs();
  }

  private getStaticRedrawIntervalMs(): number {
    if (!this.cachedGalaxy) {
      return MAP_SNAPSHOT_REDRAW_INTERVAL_MS;
    }
    const hasVisibleContestedZones = this.cachedGalaxy.zones.some((zone) => (
      isZoneActivelyContested(zone)
      && (!this.selectedSectorId || zone.sectorId === this.selectedSectorId)
    ));
    return hasVisibleContestedZones ? 220 : MAP_SNAPSHOT_REDRAW_INTERVAL_MS;
  }

  private getCachedGalaxySnapshot(): GalaxyDefinition {
    this.ensureGalaxySnapshot();
    return this.cachedGalaxy!;
  }

  private drawMap(viewBounds: Phaser.Geom.Rectangle, orbitTimeMs: number): void {
    this.staticMap.clear();
    this.markerMap.clear();
    const galaxy = this.getCachedGalaxySnapshot();
    const homeworlds = this.cachedHomeworlds;
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

    if (!selectedSector) {
      const centerPoint = this.worldToMapWithBounds(GALAXY_WORLD_CONFIG.center, viewBounds);
      GALAXY_RINGS.forEach((ring) => {
        if (ring.id === "deep-space") {
          return;
        }
        const radiusX = this.scaleWorldLengthToMap(ring.maxRadius, viewBounds);
        const radiusY = this.scaleWorldLengthToMapY(ring.maxRadius, viewBounds);
        this.staticMap.lineStyle(1, ring.id === "outer" ? 0x365a82 : 0x24415f, ring.id === "outer" ? 0.34 : 0.18);
        this.staticMap.strokeEllipse(
          centerPoint.x,
          centerPoint.y,
          radiusX * 2,
          radiusY * 2,
        );
      });
    }

    GALAXY_HAZE_NODES.forEach((node) => {
      if (selectedSector && !this.isPointInsideSector(node, selectedSector)) {
        return;
      }
      if (!this.isWorldPointVisible(node, viewBounds, node.radius)) {
        return;
      }
      const mappedPoint = this.worldToMapWithBounds(node, viewBounds);
      this.staticMap.fillStyle(node.color, node.alpha * 1.9);
      this.staticMap.fillCircle(mappedPoint.x, mappedPoint.y, this.scaleWorldLengthToMap(node.radius, viewBounds));
    });

    if (selectedSector) {
      this.drawSector(selectedSector, viewBounds);
    } else {
      GALAXY_SECTORS.forEach((sector) => {
        this.drawSector(sector, viewBounds);
      });

      const core = this.worldToMapWithBounds(GALAXY_WORLD_CONFIG.center, viewBounds);
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
      const point = this.worldToMapWithBounds(star, viewBounds);
      this.staticMap.fillStyle(star.color, star.alpha);
      this.staticMap.fillCircle(point.x, point.y, Math.max(0.45, star.size * 0.54));
    });

    this.drawZoneLayer(galaxy, viewBounds, selectedSector?.id ?? null, orbitTimeMs);
    this.drawGeneratedBodies(galaxy, viewBounds, selectedSector?.id ?? null, homeworlds, orbitTimeMs);
  }

  private drawZoneLayer(
    galaxy: GalaxyDefinition,
    viewBounds: Phaser.Geom.Rectangle,
    selectedSectorId: string | null,
    orbitTimeMs: number,
  ): void {
    const sectorIds = selectedSectorId
      ? [selectedSectorId]
      : GALAXY_SECTORS.map((sector) => sector.id);

    sectorIds.forEach((sectorId) => {
      const zones = galaxy.zones.filter((zone) => zone.sectorId === sectorId && zone.territoryPoints.length >= 3);
      const sector = GALAXY_SECTORS.find((candidate) => candidate.id === sectorId);
      if (!sector || zones.length <= 0) {
        return;
      }

      const controllerIds = [...new Set(zones.map((zone) => zone.currentControllerId))];
      const contestedZones = zones.filter((zone) => isZoneActivelyContested(zone));
      if (controllerIds.length === 1) {
        const palette = getGalaxyControllerPalette(controllerIds[0], sector.id);
        const polygon = getGalaxySectorPolygonPoints(sector);
        const mapped = this.mapFlatPolygonPoints(polygon, viewBounds);
        this.staticMap.fillStyle(palette.color, selectedSectorId ? 0.36 : 0.22);
        this.staticMap.fillPoints(mapped, true);
      } else {
        zones.forEach((zone) => {
          const palette = getGalaxyControllerPalette(zone.currentControllerId, zone.coreSectorId);
          const mapped = this.mapPointPolygon(zone.territoryPoints, viewBounds);
          this.staticMap.fillStyle(palette.color, selectedSectorId ? 0.34 : 0.2);
          this.staticMap.fillPoints(mapped, true);
        });

        const boundarySegments = this.getZoneBoundarySegments(zones);
        this.staticMap.lineStyle(selectedSectorId ? 2.2 : 1.4, 0xf4fbff, selectedSectorId ? 0.7 : 0.5);
        boundarySegments.forEach((segment) => {
          const start = this.worldToMapWithBounds(segment.start, viewBounds);
          const end = this.worldToMapWithBounds(segment.end, viewBounds);
          this.staticMap.lineBetween(start.x, start.y, end.x, end.y);
        });
      }

      contestedZones.forEach((zone) => {
        const invaderPalette = getGalaxyControllerPalette(zone.captureAttackerRaceId ?? zone.currentControllerId, zone.coreSectorId);
        const mapped = this.mapPointPolygon(zone.territoryPoints, viewBounds);
        const pulse = 0.5 + (Math.sin((orbitTimeMs / 450) + (zone.id.length * 0.27)) * 0.5);
        const fillAlpha = (selectedSectorId ? 0.2 : 0.13) + (pulse * (selectedSectorId ? 0.26 : 0.17));
        const strokeAlpha = 0.42 + (pulse * 0.5);
        this.staticMap.fillStyle(invaderPalette.color, fillAlpha);
        this.staticMap.fillPoints(mapped, true);
        this.staticMap.lineStyle(selectedSectorId ? 2.4 : 1.8, invaderPalette.borderColor, strokeAlpha);
        this.staticMap.strokePoints(mapped, true);
      });
    });
  }

  private mapPointPolygon(
    polygon: Array<{ x: number; y: number }>,
    viewBounds: Phaser.Geom.Rectangle,
  ): Phaser.Geom.Point[] {
    return polygon.map((point) => {
      const mapped = this.worldToMapWithBounds(point, viewBounds);
      return new Phaser.Geom.Point(mapped.x, mapped.y);
    });
  }

  private mapFlatPolygonPoints(
    polygon: number[],
    viewBounds: Phaser.Geom.Rectangle,
  ): Phaser.Geom.Point[] {
    const mapped: Phaser.Geom.Point[] = [];
    for (let index = 0; index < polygon.length; index += 2) {
      const point = this.worldToMapWithBounds({ x: polygon[index], y: polygon[index + 1] }, viewBounds);
      mapped.push(new Phaser.Geom.Point(point.x, point.y));
    }
    return mapped;
  }

  private getZoneBoundarySegments(
    zones: GalaxyDefinition["zones"],
  ): Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
    const segmentMap = new Map<string, {
      start: { x: number; y: number };
      end: { x: number; y: number };
      controllers: string[];
    }>();

    zones.forEach((zone) => {
      for (let index = 0; index < zone.territoryPoints.length; index += 1) {
        const start = zone.territoryPoints[index];
        const end = zone.territoryPoints[(index + 1) % zone.territoryPoints.length];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        if ((dx * dx) + (dy * dy) <= 1) {
          continue;
        }

        const key = this.getZoneBoundaryKey(start, end);
        const existing = segmentMap.get(key);
        if (existing) {
          existing.controllers.push(zone.currentControllerId);
          continue;
        }

        segmentMap.set(key, {
          start,
          end,
          controllers: [zone.currentControllerId],
        });
      }
    });

    return [...segmentMap.values()]
      .filter((segment) => segment.controllers.length >= 2 && new Set(segment.controllers).size > 1)
      .map((segment) => ({
        start: segment.start,
        end: segment.end,
      }));
  }

  private getZoneBoundaryKey(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): string {
    const left = `${Math.round(start.x * 10) / 10},${Math.round(start.y * 10) / 10}`;
    const right = `${Math.round(end.x * 10) / 10},${Math.round(end.y * 10) / 10}`;
    return left < right ? `${left}|${right}` : `${right}|${left}`;
  }

  private drawGeneratedBodies(
    galaxy: GalaxyDefinition,
    viewBounds: Phaser.Geom.Rectangle,
    selectedSectorId: string | null,
    homeworlds: ReturnType<typeof gameSession.getHomeworldPlanets>,
    orbitTimeMs: number,
  ): void {
    const homeworldIds = new Set(homeworlds.map((planet) => planet.id));

    galaxy.systems.forEach((system) => {
      if (selectedSectorId && system.sectorId !== selectedSectorId) {
        return;
      }
      if (!this.isWorldPointVisible(system, viewBounds, 260)) {
        return;
      }

      const systemPoint = this.worldToMapWithBounds(system, viewBounds);
      const planets = this.cachedPlanetsBySystemId.get(system.id) ?? [];
      const systemHasHomeworld = planets.some((planet) => homeworldIds.has(planet.id));
      const showOrbitLinks = selectedSectorId !== null;
      this.drawSystemStarGlyph(
        systemPoint.x,
        systemPoint.y,
        selectedSectorId
          ? systemHasHomeworld ? 9.2 : 6.2
          : systemHasHomeworld ? 6.2 : 3.9,
        system.starColor,
        systemHasHomeworld,
        showOrbitLinks,
      );
      planets.forEach((planet) => {
        const planetPosition = getGalaxyPlanetPositionAtTime(galaxy, planet, orbitTimeMs);
        if (!this.isWorldPointVisible(planetPosition, viewBounds, planet.radius)) {
          return;
        }

        const planetPoint = this.worldToMapWithBounds(planetPosition, viewBounds);
        const isHomeworld = homeworldIds.has(planet.id);
        if (showOrbitLinks || isHomeworld) {
          this.staticMap.lineStyle(1, system.starColor, showOrbitLinks ? 0.16 : 0.08);
          this.staticMap.lineBetween(systemPoint.x, systemPoint.y, planetPoint.x, planetPoint.y);
        }
        const planetRadius = this.getMapBodyRadius(planet.radius, viewBounds, planet.isHomeworld);
        if (isHomeworld) {
          this.staticMap.fillStyle(0x07131f, 0.92);
          this.staticMap.fillCircle(planetPoint.x, planetPoint.y, planetRadius + (selectedSectorId ? 2.8 : 1.8));
        }
        this.staticMap.fillStyle(planet.color, planet.isHomeworld ? 0.98 : selectedSectorId ? 0.84 : 0.72);
        this.staticMap.fillCircle(planetPoint.x, planetPoint.y, isHomeworld ? planetRadius + 0.7 : planetRadius);
        if (isHomeworld) {
          this.staticMap.lineStyle(selectedSectorId ? 2.4 : 1.8, 0xfff3cf, 0.94);
          this.staticMap.strokeCircle(planetPoint.x, planetPoint.y, planetRadius + (selectedSectorId ? 1.8 : 1.1));
          this.staticMap.fillStyle(0xfff8e6, 0.92);
          this.staticMap.fillCircle(planetPoint.x, planetPoint.y, Math.max(1.8, planetRadius * 0.42));
          this.staticMap.fillStyle(0xfff6dd, 0.86);
          this.staticMap.fillCircle(
            planetPoint.x - Math.max(0.6, planetRadius * 0.22),
            planetPoint.y - Math.max(0.6, planetRadius * 0.22),
            Math.max(0.7, planetRadius * 0.24),
          );
        }

        const moons = this.cachedMoonsByPlanetId.get(planet.id) ?? [];
        moons.forEach((moon) => {
          const moonPosition = getGalaxyMoonPositionAtTime(galaxy, moon, orbitTimeMs);
          if (!this.isWorldPointVisible(moonPosition, viewBounds, moon.radius)) {
            return;
          }

          const moonPoint = this.worldToMapWithBounds(moonPosition, viewBounds);
          if (showOrbitLinks) {
            this.staticMap.lineStyle(1, planet.color, 0.12);
            this.staticMap.lineBetween(planetPoint.x, planetPoint.y, moonPoint.x, moonPoint.y);
          }
          this.staticMap.fillStyle(moon.color, selectedSectorId ? 0.78 : 0.58);
          this.staticMap.fillCircle(moonPoint.x, moonPoint.y, this.getMapBodyRadius(moon.radius, viewBounds, false, true));
        });
      });
    });

    galaxy.stations.forEach((station) => {
      if (selectedSectorId && station.sectorId !== selectedSectorId) {
        return;
      }
      if (!this.isWorldPointVisible(station, viewBounds, station.radius)) {
        return;
      }

      const stationPoint = this.worldToMapWithBounds(station, viewBounds);
      this.drawStationGlyph(
        stationPoint.x,
        stationPoint.y,
        selectedSectorId ? 6.2 : 5.1,
        station.color,
        station.borderColor,
        selectedSectorId !== null,
      );
    });
  }

  private getVisibleProductionIndicators(viewBounds: Phaser.Geom.Rectangle): MapProductionIndicator[] {
    const selectedSectorId = this.selectedSectorId;
    const forceState = gameSession.getFactionForceState();
    return forceState.pools
      .filter((pool) => pool.productionAssetId && pool.spawnCooldownRemainingMs > 0)
      .map((pool): MapProductionIndicator | null => {
        if (!selectedSectorId && pool.kind !== "prime-world") {
          return null;
        }
        const system = this.cachedSystemsById.get(pool.originSystemId);
        if (!system) {
          return null;
        }
        if (selectedSectorId && system.sectorId !== selectedSectorId) {
          return null;
        }
        if (!this.isWorldPointVisible(system, viewBounds, 260)) {
          return null;
        }

        const assetId = pool.productionAssetId;
        if (!assetId) {
          return null;
        }
        const totalMs = Math.max(1, getFactionAssetBuildTimeMs(pool.kind, assetId));
        return {
          poolId: pool.id,
          systemId: system.id,
          raceId: pool.raceId,
          kind: pool.kind,
          assetId,
          progress: Phaser.Math.Clamp(1 - (pool.spawnCooldownRemainingMs / totalMs), 0, 1),
          remainingMs: Math.round(pool.spawnCooldownRemainingMs),
        };
      })
      .filter((indicator): indicator is MapProductionIndicator => indicator !== null);
  }

  private drawProductionIndicators(viewBounds: Phaser.Geom.Rectangle): void {
    this.getVisibleProductionIndicators(viewBounds).forEach((indicator) => {
      const system = this.cachedSystemsById.get(indicator.systemId);
      if (!system) {
        return;
      }

      const point = this.worldToMapWithBounds(system, viewBounds);
      const palette = getGalaxyControllerPalette(indicator.raceId, system.sectorId);
      const detailView = this.selectedSectorId !== null;
      const radius = indicator.kind === "prime-world"
        ? detailView ? 15 : 10
        : detailView ? 11 : 7;
      const start = -Math.PI / 2;
      const end = start + (Math.PI * 2 * indicator.progress);

      this.markerMap.lineStyle(detailView ? 2 : 1.4, 0x0b1624, 0.92);
      this.markerMap.strokeCircle(point.x, point.y, radius + 1.8);
      this.markerMap.lineStyle(detailView ? 2.2 : 1.6, palette.borderColor, 0.34);
      this.markerMap.strokeCircle(point.x, point.y, radius);
      this.markerMap.lineStyle(detailView ? 3.2 : 2.2, palette.color, indicator.kind === "prime-world" ? 0.98 : 0.86);
      this.markerMap.beginPath();
      this.markerMap.arc(point.x, point.y, radius, start, end, false);
      this.markerMap.strokePath();
      this.markerMap.fillStyle(palette.color, indicator.kind === "prime-world" ? 0.94 : 0.76);
      this.markerMap.fillCircle(point.x, point.y, detailView ? 2.2 : 1.5);
    });
  }

  private getVisibleZoneCaptureIndicators(
    galaxy: GalaxyDefinition,
    viewBounds: Phaser.Geom.Rectangle,
  ): MapZoneCaptureIndicator[] {
    const selectedSectorId = this.selectedSectorId;
    if (!selectedSectorId) {
      return [];
    }

    return galaxy.zones
      .filter((zone) => (
        zone.sectorId === selectedSectorId
        && zone.territoryPoints.length >= 3
        && this.isWorldPolygonVisible(zone.territoryPoints, viewBounds)
        && (
          isZoneActivelyContested(zone)
          || zone.zoneCaptureProgress > 0.01
          || zone.zoneConflictProgress > 0.01
        )
      ))
      .map((zone) => ({
        zoneId: zone.id,
        zoneName: zone.name,
        attackerId: zone.captureAttackerRaceId,
        controllerId: zone.currentControllerId,
        progress: Phaser.Math.Clamp(zone.zoneCaptureProgress, 0, 1),
        point: this.getZoneCentroid(zone),
      }));
  }

  private drawZoneCaptureIndicators(
    galaxy: GalaxyDefinition,
    viewBounds: Phaser.Geom.Rectangle,
  ): void {
    this.getVisibleZoneCaptureIndicators(galaxy, viewBounds).forEach((indicator) => {
      const point = this.worldToMapWithBounds(indicator.point, viewBounds);
      const palette = getGalaxyControllerPalette(indicator.attackerId ?? indicator.controllerId, this.selectedSectorId ?? undefined);
      const radius = 13;
      const start = -Math.PI / 2;
      const end = start + (Math.PI * 2 * indicator.progress);
      this.markerMap.fillStyle(0x050b13, 0.74);
      this.markerMap.fillCircle(point.x, point.y, radius + 7);
      this.markerMap.lineStyle(2, 0xdcecff, 0.32);
      this.markerMap.strokeCircle(point.x, point.y, radius + 3);
      this.markerMap.lineStyle(3.2, palette.borderColor, 0.94);
      this.markerMap.beginPath();
      this.markerMap.arc(point.x, point.y, radius, start, end, false);
      this.markerMap.strokePath();
      this.markerMap.fillStyle(palette.color, 0.92);
      this.markerMap.fillCircle(point.x, point.y, 3.2);
      this.markerMap.fillStyle(0x07111b, 0.92);
      this.markerMap.fillRoundedRect(point.x + 14, point.y - 4, 64, 8, 4);
      this.markerMap.fillStyle(palette.color, 0.94);
      this.markerMap.fillRoundedRect(point.x + 16, point.y - 2, 60 * indicator.progress, 4, 2);
      this.markerMap.lineStyle(1, palette.borderColor, 0.52);
      this.markerMap.strokeRoundedRect(point.x + 14, point.y - 4, 64, 8, 4);
    });
  }

  private drawSystemStarGlyph(
    x: number,
    y: number,
    size: number,
    color: number,
    isHomeworldSystem: boolean,
    detailView: boolean,
  ): void {
    const lineAlpha = detailView
      ? isHomeworldSystem ? 0.96 : 0.82
      : isHomeworldSystem ? 0.9 : 0.62;
    const lineWidth = detailView
      ? isHomeworldSystem ? 2.2 : 1.6
      : isHomeworldSystem ? 1.8 : 1.1;
    const diagonalSize = size * 0.68;

    this.staticMap.fillStyle(color, detailView ? 0.24 : isHomeworldSystem ? 0.22 : 0.12);
    this.staticMap.fillCircle(x, y, isHomeworldSystem ? size * 0.5 : size * 0.34);
    this.staticMap.lineStyle(lineWidth, color, lineAlpha);
    this.staticMap.lineBetween(x - size, y, x + size, y);
    this.staticMap.lineBetween(x, y - size, x, y + size);
    this.staticMap.lineBetween(x - diagonalSize, y - diagonalSize, x + diagonalSize, y + diagonalSize);
    this.staticMap.lineBetween(x - diagonalSize, y + diagonalSize, x + diagonalSize, y - diagonalSize);
    this.staticMap.fillStyle(isHomeworldSystem ? 0xfff4d8 : 0xf8fcff, isHomeworldSystem ? 0.98 : detailView ? 0.94 : 0.82);
    this.staticMap.fillCircle(x, y, isHomeworldSystem ? 2.5 : detailView ? 1.9 : 1.5);
    if (isHomeworldSystem) {
      this.staticMap.lineStyle(detailView ? 1.2 : 1, 0xfff0c2, detailView ? 0.54 : 0.4);
      this.staticMap.strokeCircle(x, y, size + (detailView ? 1.6 : 1));
    }
  }

  private drawStationGlyph(
    x: number,
    y: number,
    size: number,
    color: number,
    borderColor: number,
    detailView: boolean,
  ): void {
    this.staticMap.fillStyle(0x08111d, detailView ? 0.92 : 0.76);
    this.staticMap.fillCircle(x, y, size + (detailView ? 2.6 : 1.8));
    this.staticMap.fillStyle(color, detailView ? 0.96 : 0.82);
    this.staticMap.fillCircle(x, y, size);
    this.staticMap.lineStyle(detailView ? 2.4 : 1.8, borderColor, detailView ? 0.92 : 0.72);
    this.staticMap.strokeCircle(x, y, size + (detailView ? 1.2 : 0.8));
    this.staticMap.lineStyle(1.2, borderColor, detailView ? 0.64 : 0.46);
    this.staticMap.strokeCircle(x, y, Math.max(2.2, size * 0.56));
    this.staticMap.fillStyle(0xf5fbff, detailView ? 0.9 : 0.74);
    this.staticMap.fillCircle(x, y, Math.max(1.6, size * 0.26));
  }

  private getMapBodyRadius(
    worldRadius: number,
    viewBounds: Phaser.Geom.Rectangle,
    emphasize = false,
    isMoon = false,
  ): number {
    const scaled = this.scaleWorldLengthToMap(worldRadius * (isMoon ? 0.24 : 0.285), viewBounds);
    if (isMoon) {
      return Phaser.Math.Clamp(scaled, 1, 2.6);
    }
    return emphasize
      ? Phaser.Math.Clamp(scaled + 1.5, 3.4, 6.6)
      : Phaser.Math.Clamp(scaled, 1.4, 4.4);
  }

  private drawSector(sector: GalaxySectorConfig, viewBounds: Phaser.Geom.Rectangle): void {
    const polygon = getGalaxySectorPolygonPoints(sector);
    const mapped = this.mapFlatPolygonPoints(polygon, viewBounds);
    const isSelectedSector = sector.id === this.selectedSectorId;
    const controllerPalette = this.getSectorControllerPalette(sector);
    this.staticMap.fillStyle(0x07111b, isSelectedSector ? 0.7 : 0.44);
    this.staticMap.fillPoints(mapped, true);
    this.staticMap.lineStyle(isSelectedSector ? 3 : 2, controllerPalette.borderColor, isSelectedSector ? 0.94 : 0.54);
    this.staticMap.strokePoints(mapped, true);
  }

  private getSectorControllerPalette(sector: GalaxySectorConfig): ReturnType<typeof getGalaxyControllerPalette> {
    return getGalaxyControllerPalette(this.getSectorActiveControllerId(sector), sector.id);
  }

  private getSectorActiveControllerId(sector: GalaxySectorConfig): GalaxyDefinition["zones"][number]["currentControllerId"] {
    const zones = this.cachedZonesBySectorId.get(sector.id) ?? [];
    if (zones.length <= 0) {
      return sector.raceId;
    }

    const counts = new Map<GalaxyDefinition["zones"][number]["currentControllerId"], number>();
    zones.forEach((zone) => {
      counts.set(zone.currentControllerId, (counts.get(zone.currentControllerId) ?? 0) + 1);
    });

    let activeController: GalaxyDefinition["zones"][number]["currentControllerId"] = sector.raceId;
    let activeCount = -1;
    counts.forEach((count, controllerId) => {
      if (count > activeCount || (count === activeCount && controllerId === sector.raceId)) {
        activeController = controllerId;
        activeCount = count;
      }
    });

    return activeController;
  }

  private syncReadout(
    viewBounds: Phaser.Geom.Rectangle = this.getMapViewBounds(),
    orbitTimeMs = this.scene.time.now,
  ): void {
    const playerPosition = gameSession.getShipSpacePosition();
    const warState = gameSession.getFactionWarState();
    const galaxy = this.getCachedGalaxySnapshot();
    const playerRegionLabel = getGalaxyRegionLabelAtPosition(galaxy, playerPosition.x, playerPosition.y, warState);
    const homeworldPlanets = this.cachedHomeworlds;
    const selectedSector = this.selectedSectorId
      ? GALAXY_SECTORS.find((sector) => sector.id === this.selectedSectorId) ?? null
      : null;
    const missionId = gameSession.getTrackedMissionId();
    const mission = missionId ? getMissionContract(missionId) : null;
    const missionPlanet = gameSession.getMissionPlanetForMission(missionId, orbitTimeMs);
    const travel = gameSession.getShipTravelState();
    const sectorHomeworld = selectedSector
      ? homeworldPlanets.find((planet) => planet.sectorId === selectedSector.id) ?? null
      : null;
    const sectorSystems = selectedSector ? galaxy.systems.filter((system) => system.sectorId === selectedSector.id) : [];
    const sectorZones = selectedSector ? galaxy.zones.filter((zone) => zone.sectorId === selectedSector.id) : [];
    const sectorPlanets = selectedSector ? galaxy.planets.filter((planet) => planet.sectorId === selectedSector.id) : [];
    const sectorMoons = selectedSector ? galaxy.moons.filter((moon) => moon.sectorId === selectedSector.id) : [];
    const sectorStations = selectedSector ? galaxy.stations.filter((station) => station.sectorId === selectedSector.id) : [];
    const selectedSectorActiveControllerId = selectedSector ? this.getSectorActiveControllerId(selectedSector) : null;
    const selectedSectorDisplayLabel = selectedSector ? getGalaxySectorDisplayLabel(selectedSector, warState) : null;
    const hoveredZone = this.hoverWorldPoint
      ? this.getZoneAtWorldPoint(galaxy, this.hoverWorldPoint, selectedSector?.id ?? null)
      : null;

    this.subtitle.setText(selectedSector ? `${selectedSectorDisplayLabel} Sector Detail` : "Galaxy Map");
    this.infoTitle.setText(selectedSector ? `${selectedSectorDisplayLabel} Readout` : "Current Readout");
    this.sectorBackButton.container.setVisible(selectedSector !== null);
    this.sectorBackButton.setInputEnabled(this.root.visible && selectedSector !== null);

    this.routeText.setText([
      `Ship: X ${playerPosition.x}  Y ${playerPosition.y}`,
      `Region: ${playerRegionLabel}`,
      `Travel state: ${travel.status}`,
    ].join("\n"));

    this.detailText.setText(selectedSector
      ? [
          `${selectedSectorDisplayLabel} uses live galaxy coordinates.`,
          `Zones ${sectorZones.length}  |  Systems ${sectorSystems.length}  |  Planets ${sectorPlanets.length}  |  Moons ${sectorMoons.length}`,
          `Controller: ${selectedSectorActiveControllerId ? getGalaxyControllerDisplayLabel(selectedSectorActiveControllerId, warState, selectedSector.id) : selectedSectorDisplayLabel}  |  Stations ${sectorStations.length}`,
          `Span: ${Math.round(selectedSector.innerRadius)} - ${Math.round(selectedSector.outerRadius)} radius`,
          missionPlanet && getGalaxySectorAtPosition(missionPlanet.x, missionPlanet.y).id === selectedSector.id
            ? `Mission planet in sector: ${missionPlanet.name}`
            : "Mission planet is outside this sector detail view.",
          `Homeworld: ${sectorHomeworld?.name ?? "pending"}  |  Station: ${sectorStations[0]?.name ?? "pending"}`,
        ].join("\n")
      : missionPlanet
        ? [
            `Current route: ${mission?.title ?? missionPlanet.missionId}`,
            `Mission planet: ${missionPlanet.name}`,
            `Planet coords: X ${Math.round(missionPlanet.x)}  Y ${Math.round(missionPlanet.y)}`,
            `Planet region: ${getGalaxyRegionLabelAtPosition(galaxy, missionPlanet.x, missionPlanet.y, warState)}`,
            `Zones online: ${galaxy.zones.length}`,
            `Major stations online: ${galaxy.stations.length}`,
          ].join("\n")
        : `No mission planet staged. Accept or select a contract and the route target will appear here in the shared galaxy layout.\nZones online: ${galaxy.zones.length}\nMajor stations online: ${galaxy.stations.length}`);

    this.hoverText.setText(this.hoverWorldPoint
      ? (() => {
          const hoverRegion = getGalaxyRegionLabelAtPosition(galaxy, this.hoverWorldPoint.x, this.hoverWorldPoint.y, warState);
          const lines = selectedSector && hoveredZone
            ? [
                `Zone: ${hoveredZone.name}`,
                `Controller: ${getGalaxyControllerDisplayLabel(hoveredZone.currentControllerId, warState, hoveredZone.coreSectorId)}`,
                `X ${this.hoverWorldPoint.x}  Y ${this.hoverWorldPoint.y}`,
              ]
            : [
                `Hover: X ${this.hoverWorldPoint.x}  Y ${this.hoverWorldPoint.y}`,
                `Hover region: ${hoverRegion}`,
              ];
          if (selectedSector && hoveredZone && (hoveredZone.zoneCaptureProgress > 0.01 || isZoneActivelyContested(hoveredZone))) {
            lines.splice(2, 0, `Takeover progress: ${Math.round(hoveredZone.zoneCaptureProgress * 100)}%`);
          } else if (hoveredZone) {
            lines.push(`Zone: ${hoveredZone.name}`);
            lines.push(`Controller: ${getGalaxyControllerDisplayLabel(hoveredZone.currentControllerId, warState, hoveredZone.coreSectorId)}`);
            if (hoveredZone.zoneCaptureProgress > 0.01 || isZoneActivelyContested(hoveredZone)) {
              lines.push(`Takeover progress: ${Math.round(hoveredZone.zoneCaptureProgress * 100)}%`);
            }
          }
          return lines.join("\n");
        })()
      : "Hover over the map to inspect live galaxy coordinates.");

    this.footerText
      .setText("This is the same coordinate space used by the playable space map. The datapad adds strategic territorial partitions without turning space into a tile overlay.")
      .setVisible(!selectedSector);

    this.markerMap.clear();
    this.drawProductionIndicators(viewBounds);
    this.drawZoneCaptureIndicators(galaxy, viewBounds);
    this.homeworldLabel.setVisible(false);
    if (this.isWorldPointVisible(playerPosition, viewBounds)) {
      const playerMarker = this.worldToMapWithBounds(playerPosition, viewBounds);
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
      const missionMarker = this.worldToMapWithBounds(missionPlanet, viewBounds);
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
      const hoverMarker = this.worldToMapWithBounds(this.hoverWorldPoint, viewBounds);
      this.markerMap.lineStyle(2, 0xdde9ff, 0.96);
      this.markerMap.strokeCircle(hoverMarker.x, hoverMarker.y, 10);
      const hoverLabelText = hoveredZone
        ? [
            hoveredZone.name,
            getGalaxyControllerDisplayLabel(hoveredZone.currentControllerId, warState, hoveredZone.coreSectorId),
            hoveredZone.zoneCaptureProgress > 0.01 || isZoneActivelyContested(hoveredZone)
              ? `Takeover ${Math.round(hoveredZone.zoneCaptureProgress * 100)}%`
              : null,
          ].filter((line): line is string => typeof line === "string").join("\n")
        : `${this.hoverWorldPoint.x}, ${this.hoverWorldPoint.y}`;
      this.hoverLabel
        .setPosition(hoverMarker.x + 16, hoverMarker.y - 4)
        .setText(hoverLabelText)
        .setVisible(true);
    } else {
      this.hoverLabel.setVisible(false);
    }

    GALAXY_SECTORS.forEach((sector, index) => {
      const label = this.sectorLabels[index];
      const labelPlacement = this.getSectorLabelPlacement(sector, viewBounds);
      const controllerPalette = this.getSectorControllerPalette(sector);
      const sectorDisplayLabel = getGalaxySectorDisplayLabel(sector, warState);
      const isVisible = (!selectedSector || selectedSector.id === sector.id)
        && (selectedSector?.id === sector.id || this.isWorldPointVisible(labelPlacement.worldPoint, viewBounds));
      label
        .setText(selectedSector && selectedSector.id === sector.id ? sectorDisplayLabel : sectorDisplayLabel.replace(" ", "\n"))
        .setPosition(labelPlacement.point.x, labelPlacement.point.y)
        .setOrigin(labelPlacement.originX, labelPlacement.originY)
        .setColor(colorToCss(controllerPalette.borderColor))
        .setAlpha(selectedSector && selectedSector.id === sector.id ? 0.96 : 0.76)
        .setVisible(isVisible);
    });

    this.root.bringToTop(this.markerMap);
    this.root.bringToTop(this.missionLabel);
    this.root.bringToTop(this.playerLabel);
    this.root.bringToTop(this.hoverLabel);
    this.root.bringToTop(this.homeworldLabel);
    this.root.bringToTop(this.sectorBackButton.container);
    this.root.bringToTop(this.mapInputZone);
  }

  getDebugSnapshot(): Record<string, unknown> {
    const galaxy = this.getCachedGalaxySnapshot();
    const viewBounds = this.getMapViewBounds();
    const selectedSectorId = this.selectedSectorId;
    const warState = gameSession.getFactionWarState();
    const visibleSystems = galaxy.systems.filter((system) => (
      (!selectedSectorId || system.sectorId === selectedSectorId)
      && this.isWorldPointVisible(system, viewBounds, 260)
    )).length;
    const visiblePlanets = galaxy.planets.filter((planet) => (
      (!selectedSectorId || planet.sectorId === selectedSectorId)
      && this.isWorldPointVisible(planet, viewBounds, planet.radius)
    )).length;
    const visibleMoons = galaxy.moons.filter((moon) => (
      (!selectedSectorId || moon.sectorId === selectedSectorId)
      && this.isWorldPointVisible(moon, viewBounds, moon.radius)
    )).length;
    const visibleStations = galaxy.stations.filter((station) => (
      (!selectedSectorId || station.sectorId === selectedSectorId)
      && this.isWorldPointVisible(station, viewBounds, station.radius)
    )).length;
    const productionIndicators = this.getVisibleProductionIndicators(viewBounds);
    const zoneCaptureIndicators = this.getVisibleZoneCaptureIndicators(galaxy, viewBounds);
    const hoveredZone = this.hoverWorldPoint
      ? this.getZoneAtWorldPoint(galaxy, this.hoverWorldPoint, selectedSectorId)
      : null;
    const visibleZones = galaxy.zones.filter((zone) => {
      if (selectedSectorId && zone.sectorId !== selectedSectorId) {
        return false;
      }
      return this.isWorldPolygonVisible(zone.territoryPoints, viewBounds);
    }).length;

    return {
      selectedSectorId,
      visibleZones,
      visibleSystems,
      visiblePlanets,
      visibleMoons,
      visibleStations,
      visibleProductionIndicators: productionIndicators.length,
      visibleZoneCaptureIndicators: zoneCaptureIndicators.length,
      productionIndicators: productionIndicators.map((indicator) => ({
        poolId: indicator.poolId,
        systemId: indicator.systemId,
        raceId: indicator.raceId,
        kind: indicator.kind,
        assetId: indicator.assetId,
        progress: Number(indicator.progress.toFixed(3)),
        remainingMs: indicator.remainingMs,
      })),
      zoneCaptureIndicators: zoneCaptureIndicators.map((indicator) => ({
        zoneId: indicator.zoneId,
        zoneName: indicator.zoneName,
        attackerId: indicator.attackerId,
        controllerId: indicator.controllerId,
        progress: Number(indicator.progress.toFixed(3)),
      })),
      shipRegion: getGalaxyRegionLabelAtPosition(
        galaxy,
        gameSession.getShipSpacePosition().x,
        gameSession.getShipSpacePosition().y,
        warState,
      ),
      hoverRegion: this.hoverWorldPoint
        ? getGalaxyRegionLabelAtPosition(galaxy, this.hoverWorldPoint.x, this.hoverWorldPoint.y, warState)
        : null,
      hoverZone: hoveredZone
        ? {
            id: hoveredZone.id,
            name: hoveredZone.name,
            currentControllerId: hoveredZone.currentControllerId,
            zoneCaptureProgress: Number(hoveredZone.zoneCaptureProgress.toFixed(3)),
          }
        : null,
      sectorLabels: GALAXY_SECTORS.map((sector) => ({
        id: sector.id,
        label: getGalaxySectorDisplayLabel(sector, warState),
      })),
      contestedZones: galaxy.zones
        .filter((zone) => isZoneActivelyContested(zone))
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          currentControllerId: zone.currentControllerId,
          captureAttackerRaceId: zone.captureAttackerRaceId,
          zoneState: zone.zoneState,
          zoneCaptureProgress: Number(zone.zoneCaptureProgress.toFixed(3)),
        })),
    };
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
      this.refresh(true);
      return;
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
    this.refresh(true);
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

  private scaleWorldLengthToMapY(length: number, viewBounds: Phaser.Geom.Rectangle): number {
    return (length / viewBounds.height) * MAP_RECT.height;
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

  private isWorldPolygonVisible(
    polygon: Array<{ x: number; y: number }>,
    viewBounds: Phaser.Geom.Rectangle,
  ): boolean {
    if (polygon.length <= 0) {
      return false;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    return maxX >= viewBounds.x
      && minX <= viewBounds.right
      && maxY >= viewBounds.y
      && minY <= viewBounds.bottom;
  }

  private getZoneAtWorldPoint(
    galaxy: GalaxyDefinition,
    point: { x: number; y: number },
    sectorId: string | null,
  ): GalaxyZoneRecord | null {
    if (!sectorId) {
      return null;
    }

    return galaxy.zones.find((zone) => (
      zone.sectorId === sectorId
      && zone.territoryPoints.length >= 3
      && this.isPointInsideZonePolygon(point, zone.territoryPoints)
    )) ?? null;
  }

  private isPointInsideZonePolygon(
    point: { x: number; y: number },
    polygon: Array<{ x: number; y: number }>,
  ): boolean {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
      const currentPoint = polygon[index];
      const previousPoint = polygon[previous];
      if (!currentPoint || !previousPoint) {
        continue;
      }
      const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
        && (point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1) + currentPoint.x);
      if (intersects) {
        inside = !inside;
      }
    }
    return inside;
  }

  private getZoneCentroid(zone: Pick<GalaxyZoneRecord, "territoryPoints">): { x: number; y: number } {
    if (zone.territoryPoints.length <= 0) {
      return { x: 0, y: 0 };
    }

    const sum = zone.territoryPoints.reduce((accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y,
    }), { x: 0, y: 0 });
    return {
      x: sum.x / zone.territoryPoints.length,
      y: sum.y / zone.territoryPoints.length,
    };
  }

  private getSectorAtWorldPoint(point: { x: number; y: number }): GalaxySectorConfig | null {
    const sector = getGalaxySectorAtPosition(point.x, point.y);
    return this.isPointInsideSector(point, sector) ? sector : null;
  }

  private isPointInsideSector(point: { x: number; y: number }, sector: GalaxySectorConfig): boolean {
    const radialDistance = getGalaxyRadialDistance(point.x, point.y);
    return radialDistance >= sector.innerRadius && radialDistance <= sector.outerRadius;
  }

  private worldToMapWithBounds(
    point: { x: number; y: number },
    viewBounds: Phaser.Geom.Rectangle,
  ): { x: number; y: number } {
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

  private getSectorLabelPlacement(
    sector: GalaxySectorConfig,
    viewBounds: Phaser.Geom.Rectangle = this.getMapViewBounds(),
  ): {
    point: { x: number; y: number };
    worldPoint: { x: number; y: number };
    originX: number;
    originY: number;
    fontSize: string;
  } {
    if (this.selectedSectorId === sector.id) {
      const worldPoint = getGalaxySectorLabelPoint(sector);
      return {
        point: { x: MAP_RECT.x + 18, y: MAP_RECT.y + 16 },
        worldPoint,
        originX: 0,
        originY: 0,
        fontSize: "15px",
      };
    }

    const basePoint = getGalaxySectorLabelPoint(sector);
    const offsetX = basePoint.x - GALAXY_WORLD_CONFIG.center.x;
    const offsetY = basePoint.y - GALAXY_WORLD_CONFIG.center.y;
    const radiusScale = (sector.innerRadius + ((sector.outerRadius - sector.innerRadius) * 0.82))
      / Math.max(1, sector.labelRadius);
    const worldPoint = {
      x: GALAXY_WORLD_CONFIG.center.x + (offsetX * radiusScale),
      y: GALAXY_WORLD_CONFIG.center.y + (offsetY * radiusScale),
    };
    const point = this.worldToMapWithBounds(worldPoint, viewBounds);

    return {
      point,
      worldPoint,
      originX: 0.5,
      originY: 0.5,
      fontSize: "13px",
    };
  }
}
