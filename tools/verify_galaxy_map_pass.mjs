import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/galaxy-map-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";
const MAP_TAB_X = 830;
const MAP_TAB_Y = 112;
const DATAPAD_BUTTON_X = 1008;
const DATAPAD_BUTTON_Y = 54;
const MAP_HOVER_X = 276;
const MAP_HOVER_Y = 248;
const TEST_SHIP_POSITION = { x: 8120, y: 7880 };
const DEEP_SPACE_POSITION = { x: 77000, y: 6200 };
const HOMEWORLD_RING_MARGIN = 520;
const HOMEWORLD_EDGE_MARGIN_DEG = 7;
const SECOND_RING_ID = "second";
const THIRD_RING_ID = "third";
const GALAXY_VERTICAL_SCALE = 0.72;
const GALAXY_SECTOR_INNER_RADIUS = 9600;
const GALAXY_SECTOR_OUTER_RADIUS = 30000;
const SECTOR_ARCS = {
  "olydran-expanse": { startAngleDeg: 338, endAngleDeg: 28 },
  "aaruian-reach": { startAngleDeg: 28, endAngleDeg: 78 },
  "elsari-veil": { startAngleDeg: 78, endAngleDeg: 130 },
  "nevari-bloom": { startAngleDeg: 130, endAngleDeg: 184 },
  "rakkan-drift": { startAngleDeg: 184, endAngleDeg: 238 },
  "svarin-span": { startAngleDeg: 238, endAngleDeg: 292 },
  "ashari-crown": { startAngleDeg: 292, endAngleDeg: 338 },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function wrapAngleDegrees(angleDeg) {
  let wrapped = angleDeg % 360;
  if (wrapped < 0) {
    wrapped += 360;
  }
  return wrapped;
}

function expandWrappedArc(startAngleDeg, endAngleDeg) {
  const start = wrapAngleDegrees(startAngleDeg);
  let end = wrapAngleDegrees(endAngleDeg);
  if (end <= start) {
    end += 360;
  }
  return { start, end };
}

function getGalaxyRadialDistance(point) {
  const dx = point.x - 40000;
  const dy = (point.y - 40000) / GALAXY_VERTICAL_SCALE;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function getAngularMarginFromSectorEdge(point, sectorId) {
  const sector = SECTOR_ARCS[sectorId];
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const dx = point.x - 40000;
  const dy = (point.y - 40000) / GALAXY_VERTICAL_SCALE;
  let angleDeg = wrapAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
  if (angleDeg < start) {
    angleDeg += 360;
  }
  return Math.min(angleDeg - start, end - angleDeg);
}

function getPolygonArea(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += (current.x * next.y) - (next.x * current.y);
  }

  return Math.abs(area) * 0.5;
}

function isPointOnSegment(point, start, end, epsilon = 0.001) {
  const cross = ((point.y - start.y) * (end.x - start.x)) - ((point.x - start.x) * (end.y - start.y));
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot = ((point.x - start.x) * (end.x - start.x)) + ((point.y - start.y) * (end.y - start.y));
  if (dot < -epsilon) {
    return false;
  }

  const squaredLength = ((end.x - start.x) ** 2) + ((end.y - start.y) ** 2);
  return dot <= squaredLength + epsilon;
}

function isPointInsidePolygon(point, polygon) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (isPointOnSegment(point, start, end)) {
      return true;
    }

    const cross = ((end.x - start.x) * (point.y - start.y)) - ((end.y - start.y) * (point.x - start.x));
    if (Math.abs(cross) <= 0.001) {
      continue;
    }

    const currentSign = Math.sign(cross);
    if (sign === 0) {
      sign = currentSign;
      continue;
    }

    if (currentSign !== sign) {
      return false;
    }
  }
  return true;
}

function getExpectedSectorArea(sectorId) {
  const sector = SECTOR_ARCS[sectorId];
  const { start, end } = expandWrappedArc(sector.startAngleDeg, sector.endAngleDeg);
  const theta = ((end - start) * Math.PI) / 180;
  return 0.5
    * GALAXY_VERTICAL_SCALE
    * ((GALAXY_SECTOR_OUTER_RADIUS * GALAXY_SECTOR_OUTER_RADIUS) - (GALAXY_SECTOR_INNER_RADIUS * GALAXY_SECTOR_INNER_RADIUS))
    * theta;
}

function isPointInsidePolygonBounds(point, polygon) {
  const bounds = polygon.reduce((acc, current) => ({
    minX: Math.min(acc.minX, current.x),
    maxX: Math.max(acc.maxX, current.x),
    minY: Math.min(acc.minY, current.y),
    maxY: Math.max(acc.maxY, current.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
  return point.x >= bounds.minX
    && point.x <= bounds.maxX
    && point.y >= bounds.minY
    && point.y <= bounds.maxY;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? "{}");
  return JSON.parse(raw);
}

async function getRadarSnapshot(page) {
  const state = await getState(page);
  return state.snapshot?.radar ?? null;
}

async function waitForRadarContact(page, predicate, timeoutMs = 6000) {
  const start = Date.now();
  let lastRadar = null;
  while ((Date.now() - start) < timeoutMs) {
    lastRadar = await getRadarSnapshot(page);
    if (lastRadar && predicate(lastRadar)) {
      return lastRadar;
    }
    await page.waitForTimeout(140);
  }

  throw new Error(`Timed out waiting for expected radar contact. Last radar state: ${JSON.stringify(lastRadar)}`);
}

async function waitForScene(page, sceneKey, timeoutMs = 8000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await getState(page);
    if (state.activeScene === sceneKey) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for scene '${sceneKey}'`);
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];

page.on("pageerror", (error) => {
  consoleErrors.push({ type: "pageerror", message: error.message, stack: error.stack });
});
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({ type: "console", message: message.text() });
  }
});

try {
  await ensureDir(OUTPUT_DIR);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");

  await page.evaluate((shipPosition) => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeSession?.acceptMission?.("test-chain-dispatch");
    window.__loeSession?.setSelectedMission?.("test-chain-dispatch");
    window.__loeSession?.setShipSpacePosition?.(shipPosition.x, shipPosition.y);
    window.__loeGame?.scene.start("hub");
  }, TEST_SHIP_POSITION);

  await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  await page.mouse.click(DATAPAD_BUTTON_X, DATAPAD_BUTTON_Y);
  await page.waitForTimeout(180);
  await page.mouse.click(MAP_TAB_X, MAP_TAB_Y);
  await page.waitForTimeout(220);
  await capture(page, "hub-map-tab.png");

  const hubMapState = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    const galaxy = window.__loeSession?.getGalaxyDefinition?.() ?? null;
    const missionPlanet = window.__loeSession?.getMissionPlanetForMission?.("test-chain-dispatch") ?? null;
    const homeworldPlanets = window.__loeSession?.getHomeworldPlanets?.() ?? [];
    return {
      snapshot: hub?.getDebugSnapshot?.() ?? null,
      visible: overlay?.isVisible?.() ?? false,
      routeText: overlay?.routeText?.text ?? "",
      detailText: overlay?.detailText?.text ?? "",
      hoverText: overlay?.hoverText?.text ?? "",
      mapDebug: overlay?.getDebugSnapshot?.() ?? null,
      shipSpacePosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
      trackedMissionId: window.__loeSession?.getTrackedMissionId?.() ?? null,
      missionPlanet,
      homeworldPlanets,
      galaxy,
      war: window.__loeSession?.getFactionWarState?.() ?? null,
      galaxySummary: galaxy
        ? {
            systemCountsBySector: galaxy.systems.reduce((counts, system) => {
              counts[system.sectorId] = (counts[system.sectorId] ?? 0) + 1;
              return counts;
            }, {}),
            zoneCountsBySector: galaxy.zones.reduce((counts, zone) => {
              counts[zone.sectorId] = (counts[zone.sectorId] ?? 0) + 1;
              return counts;
            }, {}),
            homeworldCount: galaxy.homeworlds.length,
            ringIds: galaxy.rings.map((ring) => ring.id),
          }
        : null,
      orbitSpeedSummary: galaxy
        ? (() => {
            const planetsBySystem = galaxy.planets.reduce((lookup, planet) => {
              const bucket = lookup.get(planet.systemId) ?? [];
              bucket.push(planet);
              lookup.set(planet.systemId, bucket);
              return lookup;
            }, new Map());
            const moonsByPlanet = galaxy.moons.reduce((lookup, moon) => {
              const bucket = lookup.get(moon.planetId) ?? [];
              bucket.push(moon);
              lookup.set(moon.planetId, bucket);
              return lookup;
            }, new Map());
            const planetSystemsChecked = [...planetsBySystem.values()]
              .filter((planets) => planets.length >= 2)
              .map((planets) => planets.slice().sort((left, right) => left.orbitRadius - right.orbitRadius));
            const planetOrderingFailures = planetSystemsChecked
              .filter((planets) => planets.some((planet, index) => index > 0 && planets[index - 1].orbitSpeed < planet.orbitSpeed))
              .slice(0, 4)
              .map((planets) => ({
                systemId: planets[0]?.systemId ?? null,
                speeds: planets.map((planet) => ({
                  id: planet.id,
                  orbitRadius: planet.orbitRadius,
                  orbitSpeed: planet.orbitSpeed,
                })),
              }));
            const moonSpeedChecks = galaxy.planets
              .map((planet) => {
                const moons = moonsByPlanet.get(planet.id) ?? [];
                if (moons.length === 0) {
                  return null;
                }
                const averageMoonOrbitSpeed = moons.reduce((sum, moon) => sum + moon.orbitSpeed, 0) / moons.length;
                return {
                  planetId: planet.id,
                  planetOrbitSpeed: planet.orbitSpeed,
                  averageMoonOrbitSpeed,
                };
              })
              .filter(Boolean);
            const moonSpeedFailures = moonSpeedChecks
              .filter((entry) => entry.averageMoonOrbitSpeed <= entry.planetOrbitSpeed)
              .slice(0, 4);
            return {
              planetSystemsChecked: planetSystemsChecked.length,
              moonSpeedChecks: moonSpeedChecks.length,
              planetOrderingFailures,
              moonSpeedFailures,
            };
          })()
        : null,
    };
  });

  assert(hubMapState.visible, "Galaxy map overlay is not visible from the hub datapad");
  assert(hubMapState.snapshot?.mapVisible === true, "Hub debug snapshot did not report the map as visible");
  assert(hubMapState.shipSpacePosition?.x === TEST_SHIP_POSITION.x && hubMapState.shipSpacePosition?.y === TEST_SHIP_POSITION.y,
    `Unexpected initial ship position on hub map: ${JSON.stringify(hubMapState.shipSpacePosition)}`);
  assert(hubMapState.routeText.includes(`Ship: X ${TEST_SHIP_POSITION.x}  Y ${TEST_SHIP_POSITION.y}`),
    `Hub map route text is missing shared ship coordinates: ${hubMapState.routeText}`);
  assert(hubMapState.routeText.includes("Region: "),
    `Hub map route text is missing the region label: ${hubMapState.routeText}`);
  assert(hubMapState.missionPlanet, "Hub map did not resolve a generated mission planet for test-chain-dispatch");
  assert(hubMapState.detailText.includes(hubMapState.missionPlanet.name),
    `Hub map detail text is missing the generated mission planet: ${hubMapState.detailText}`);
  assert(hubMapState.galaxySummary?.ringIds?.join("|") === "inner|second|third|outer|deep-space",
    `Galaxy ring framework is missing or out of order: ${JSON.stringify(hubMapState.galaxySummary?.ringIds)}`);
  assert(hubMapState.galaxySummary?.homeworldCount === 7,
    `Expected exactly 7 homeworlds, got ${hubMapState.galaxySummary?.homeworldCount}`);
  assert((hubMapState.galaxy?.zones ?? []).length === (hubMapState.galaxy?.systems ?? []).length,
    `Expected exactly one zone per generated system, got zones=${(hubMapState.galaxy?.zones ?? []).length} systems=${(hubMapState.galaxy?.systems ?? []).length}`);
  const secondRing = hubMapState.galaxy?.rings?.find?.((ring) => ring.id === SECOND_RING_ID) ?? null;
  assert(secondRing, "Galaxy is missing the second-ring definition needed for station placement");
  Object.entries(hubMapState.galaxySummary?.systemCountsBySector ?? {}).forEach(([sectorId, count]) => {
    assert(count >= 20 && count <= 40, `Sector ${sectorId} should have 20-40 systems, got ${count}`);
  });
  Object.entries(hubMapState.galaxySummary?.zoneCountsBySector ?? {}).forEach(([sectorId, count]) => {
    const systemCount = hubMapState.galaxySummary?.systemCountsBySector?.[sectorId] ?? 0;
    assert(count === systemCount, `Sector ${sectorId} should have one zone per system, got zones=${count} systems=${systemCount}`);
  });
  const systemsById = new Map((hubMapState.galaxy?.systems ?? []).map((system) => [system.id, system]));
  const zonesById = new Map((hubMapState.galaxy?.zones ?? []).map((zone) => [zone.id, zone]));
  const homeworldSectorByRace = new Map((hubMapState.galaxy?.homeworlds ?? []).map((homeworld) => [homeworld.raceId, homeworld.sectorId]));
  const empireCoreSectorId = hubMapState.war?.empireRaceId
    ? homeworldSectorByRace.get(hubMapState.war.empireRaceId) ?? null
    : null;
  const zoneNamePattern = /^[A-Z]{3}-[1-5][A-Z]+$/;
  const zoneAreaBySector = new Map();
  const empireStartingBonusZoneIds = [];
  (hubMapState.galaxy?.systems ?? []).forEach((system) => {
    assert(typeof system.zoneId === "string" && system.zoneId.length > 0,
      `Generated system ${system.id} is missing a zone id`);
  });
  (hubMapState.galaxy?.zones ?? []).forEach((zone) => {
    assert(zoneNamePattern.test(zone.name),
      `Zone ${zone.id} should have a compact readable code, got '${zone.name}'`);
    const system = systemsById.get(zone.systemId);
    assert(system, `Zone ${zone.id} points to a missing system ${zone.systemId}`);
    assert(zone.id === system.zoneId, `Zone ${zone.id} does not match system zone id ${system.zoneId}`);
    const sectorController = {
      "olydran-expanse": "olydran",
      "aaruian-reach": "aaruian",
      "elsari-veil": "elsari",
      "nevari-bloom": "nevari",
      "rakkan-drift": "rakkan",
      "svarin-span": "svarin",
      "ashari-crown": "ashari",
    }[zone.sectorId];
    const isEmpireBonusZone = Boolean(
      hubMapState.war?.empireRaceId
      && zone.currentControllerId === hubMapState.war.empireRaceId
      && empireCoreSectorId
      && zone.coreSectorId !== empireCoreSectorId,
    );
    if (!isEmpireBonusZone) {
      assert(zone.currentControllerId === sectorController,
        `Zone ${zone.id} should start owned by its sector race unless it is part of the Empire opening bonus, got ${zone.currentControllerId}`);
    } else {
      empireStartingBonusZoneIds.push(zone.id);
    }
    assert(zone.zoneState === "stable", `Zone ${zone.id} should start stable, got ${zone.zoneState}`);
    assert(zone.zoneCaptureProgress === 0, `Zone ${zone.id} should start with zero capture progress, got ${zone.zoneCaptureProgress}`);
    assert(Array.isArray(zone.territoryPoints) && zone.territoryPoints.length >= 3,
      `Zone ${zone.id} should store a full territorial polygon, got ${JSON.stringify(zone.territoryPoints)}`);
    assert(isPointInsidePolygonBounds({ x: system.x, y: system.y }, zone.territoryPoints),
      `Zone ${zone.id} territorial bounds do not contain its system anchor ${system.id}`);
    const zoneArea = getPolygonArea(zone.territoryPoints);
    zoneAreaBySector.set(zone.sectorId, (zoneAreaBySector.get(zone.sectorId) ?? 0) + zoneArea);
  });

  const sectorLabels = new Map((hubMapState.mapDebug?.sectorLabels ?? []).map((entry) => [entry.id, entry.label]));
  if (hubMapState.war) {
    assert(empireStartingBonusZoneIds.length >= 1 && empireStartingBonusZoneIds.length <= 6,
      `Empire should begin with a limited nearby starting bonus, got zones=${empireStartingBonusZoneIds.length}`);
    const empireSectorId = homeworldSectorByRace.get(hubMapState.war.empireRaceId);
    assert(empireSectorId && sectorLabels.get(empireSectorId) === "Galactic Empire",
      `Empire sector label should read 'Galactic Empire': ${JSON.stringify([...sectorLabels.entries()])}`);
    hubMapState.war.republicRaceIds.forEach((raceId) => {
      const sectorId = homeworldSectorByRace.get(raceId);
      assert(sectorId && /Republic$/.test(sectorLabels.get(sectorId) ?? ""),
        `Republic-aligned sector ${sectorId} should end with 'Republic': ${JSON.stringify([...sectorLabels.entries()])}`);
    });
  }
  Object.entries(SECTOR_ARCS).forEach(([sectorId]) => {
    const actualArea = zoneAreaBySector.get(sectorId) ?? 0;
    const expectedArea = getExpectedSectorArea(sectorId);
    const areaRatioDelta = Math.abs(actualArea - expectedArea) / expectedArea;
    assert(areaRatioDelta <= 0.05,
      `Zone territories should fully partition sector ${sectorId}; got ${actualArea} vs expected ${expectedArea}`);
  });
  const homeworldPlanetsById = new Map((hubMapState.homeworldPlanets ?? []).map((planet) => [planet.id, planet]));
  (hubMapState.galaxy?.homeworlds ?? []).forEach((homeworld) => {
    const planet = homeworldPlanetsById.get(homeworld.planetId);
    assert(planet, `Homeworld planet record missing for ${homeworld.name}`);
    assert(planet.ringId === THIRD_RING_ID, `Homeworld ${homeworld.name} is not in the third ring`);
    const zone = zonesById.get(`${homeworld.systemId}-zone`);
    const sectorZoneCount = hubMapState.galaxySummary?.zoneCountsBySector?.[homeworld.sectorId] ?? 1;
    const averageZoneArea = (zoneAreaBySector.get(homeworld.sectorId) ?? 0) / sectorZoneCount;
    assert(zone?.isPrimeWorldZone === true,
      `Prime world zone flag was not preserved for ${homeworld.name}: ${JSON.stringify(zone)}`);
    assert((zone?.anchorWeight ?? 0) > 0,
      `Prime world zone should carry an expanded territory weight for ${homeworld.name}: ${JSON.stringify(zone)}`);
    assert(getPolygonArea(zone?.territoryPoints ?? []) > averageZoneArea * 1.02,
      `Prime world zone should be larger than an average sector zone for ${homeworld.name}`);
  });
  const placeholderNamePattern = /^(Ashari|Aaruian|Nevari|Rakkan|Svarin|Olydran|Elsari|Averna|Elysiem|Nevaeh|Olympos|Nar'Akka|A'aru|Svaria)-/i;
  (hubMapState.galaxy?.planets ?? [])
    .filter((planet) => !planet.isHomeworld)
    .slice(0, 28)
    .forEach((planet) => {
      assert(!placeholderNamePattern.test(planet.name),
        `Generated non-home planet still uses a placeholder/race-style name: ${planet.name}`);
    });
  assert((hubMapState.galaxy?.stations ?? []).length === 7,
    `Expected exactly 7 generated stations, got ${(hubMapState.galaxy?.stations ?? []).length}`);
  const stationCountsBySector = (hubMapState.galaxy?.stations ?? []).reduce((counts, station) => {
    counts[station.sectorId] = (counts[station.sectorId] ?? 0) + 1;
    return counts;
  }, {});
  Object.entries(stationCountsBySector).forEach(([sectorId, count]) => {
    assert(count === 1, `Sector ${sectorId} should have exactly 1 major station, got ${count}`);
  });
  (hubMapState.galaxy?.stations ?? []).forEach((station) => {
    assert(station.ringId === SECOND_RING_ID, `Station ${station.name} is not placed in the second ring`);
    const radialDistance = getGalaxyRadialDistance(station);
    assert(radialDistance >= secondRing.minRadius, `Station ${station.name} is inside the second-ring inner edge`);
    assert(radialDistance <= secondRing.maxRadius, `Station ${station.name} is outside the second-ring outer edge`);
  });
  assert((hubMapState.mapDebug?.visibleZones ?? 0) > 0, "Galaxy map did not report any visible zones");
  assert((hubMapState.mapDebug?.visibleSystems ?? 0) > 0, "Galaxy map did not report any visible generated systems");
  assert((hubMapState.mapDebug?.visiblePlanets ?? 0) > 0, "Galaxy map did not report any visible generated planets");
  assert((hubMapState.mapDebug?.visibleStations ?? 0) > 0, "Galaxy map did not report any visible generated stations");
  assert((hubMapState.orbitSpeedSummary?.planetSystemsChecked ?? 0) > 0,
    `Galaxy verifier could not find any multi-planet systems to validate orbit-speed ordering: ${JSON.stringify(hubMapState.orbitSpeedSummary)}`);
  assert((hubMapState.orbitSpeedSummary?.planetOrderingFailures ?? []).length === 0,
    `Inner planets should orbit faster than outer planets: ${JSON.stringify(hubMapState.orbitSpeedSummary?.planetOrderingFailures)}`);
  assert((hubMapState.orbitSpeedSummary?.moonSpeedChecks ?? 0) > 0,
    `Galaxy verifier could not find any moon-bearing planets to validate moon-speed behavior: ${JSON.stringify(hubMapState.orbitSpeedSummary)}`);
  assert((hubMapState.orbitSpeedSummary?.moonSpeedFailures ?? []).length === 0,
    `Moons should orbit faster than their parent planets: ${JSON.stringify(hubMapState.orbitSpeedSummary?.moonSpeedFailures)}`);

  const sectorClickTarget = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    const firstVisibleLabel = overlay?.sectorLabels?.find?.((label) => label.visible);
    return firstVisibleLabel
      ? {
          x: firstVisibleLabel.x,
          y: firstVisibleLabel.y,
          label: firstVisibleLabel.text,
        }
      : null;
  });

  assert(sectorClickTarget, "Could not find a visible sector label to click for sector detail view");

  await page.mouse.click(sectorClickTarget.x, sectorClickTarget.y);
  await page.waitForTimeout(220);
  await capture(page, "hub-map-sector-detail.png");

  const sectorDetailState = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    const visibleLabels = overlay?.sectorLabels?.filter?.((label) => label.visible).map?.((label) => label.text) ?? [];
    return {
      subtitle: overlay?.subtitle?.text ?? "",
      infoTitle: overlay?.infoTitle?.text ?? "",
      detailText: overlay?.detailText?.text ?? "",
      mapDebug: overlay?.getDebugSnapshot?.() ?? null,
      backVisible: overlay?.sectorBackButton?.container?.visible ?? false,
      selectedSectorId: overlay?.selectedSectorId ?? null,
      visibleLabels,
      homeworldLabel: {
        visible: overlay?.homeworldLabel?.visible ?? false,
        text: overlay?.homeworldLabel?.text ?? "",
      },
    };
  });

  assert(sectorDetailState.selectedSectorId, "Clicking a sector did not enter sector detail mode");
  assert(sectorDetailState.backVisible, "Sector detail mode did not show a return-to-galaxy control");
  assert(sectorDetailState.visibleLabels.length === 1,
    `Sector detail view should only expose the selected sector label: ${JSON.stringify(sectorDetailState.visibleLabels)}`);
  assert(sectorDetailState.subtitle.includes("Sector Detail"),
    `Sector detail subtitle did not update: ${sectorDetailState.subtitle}`);
  assert(sectorDetailState.infoTitle.includes("Readout"),
    `Sector detail info title did not update: ${sectorDetailState.infoTitle}`);
  assert(sectorDetailState.detailText.includes("Zones "),
    `Sector detail should now expose zone readout text: ${sectorDetailState.detailText}`);
  assert((sectorDetailState.mapDebug?.visibleZones ?? 0) > 0,
    "Sector detail view did not report any visible territorial zones");
  assert((sectorDetailState.mapDebug?.visiblePlanets ?? 0) > 0,
    "Sector detail view did not report any visible generated planets");
  assert((sectorDetailState.mapDebug?.visibleMoons ?? 0) > 0,
    "Sector detail view did not report any visible generated moons");
  assert((sectorDetailState.mapDebug?.visibleStations ?? 0) === 1,
    `Sector detail view should show the sector's single major station: ${JSON.stringify(sectorDetailState.mapDebug)}`);
  assert(sectorDetailState.homeworldLabel.visible === false,
    `Sector detail should no longer show a separate prime-world map label: ${JSON.stringify(sectorDetailState.homeworldLabel)}`);

  const backButtonTarget = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    const container = overlay?.sectorBackButton?.container;
    return container ? { x: container.x, y: container.y } : null;
  });

  assert(backButtonTarget, "Could not find the Full Galaxy button position");

  await page.mouse.click(backButtonTarget.x, backButtonTarget.y);
  await page.waitForTimeout(220);

  const galaxyReturnState = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    return {
      subtitle: overlay?.subtitle?.text ?? "",
      backVisible: overlay?.sectorBackButton?.container?.visible ?? false,
      selectedSectorId: overlay?.selectedSectorId ?? null,
    };
  });

  assert(galaxyReturnState.selectedSectorId === null, "Full Galaxy did not restore the default galaxy overview");
  assert(galaxyReturnState.backVisible === false, "Full Galaxy button stayed visible after returning to overview");
  assert(galaxyReturnState.subtitle === "Galaxy Map",
    `Galaxy overview subtitle did not restore after returning: ${galaxyReturnState.subtitle}`);

  await page.mouse.move(MAP_HOVER_X, MAP_HOVER_Y);
  await page.waitForTimeout(120);
  const hoverState = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      hoverText: hub?.galaxyMapOverlay?.hoverText?.text ?? "",
      hoverLabel: hub?.galaxyMapOverlay?.hoverLabel?.text ?? "",
      mapDebug: hub?.galaxyMapOverlay?.getDebugSnapshot?.() ?? null,
    };
  });

  assert(hoverState.hoverText.includes("Hover: X "), `Map hover readout did not populate: ${hoverState.hoverText}`);
  assert(hoverState.hoverText.includes("Hover region: "), `Map hover readout did not expose the hover region: ${hoverState.hoverText}`);
  assert(hoverState.hoverLabel.length > 0, "Map hover label did not render live coordinates");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("test-chain-dispatch");
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(280);
  await capture(page, "space-map-foundation.png");

  const spaceStart = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      coordinateText: space?.coordinateText?.text ?? "",
    };
  });

  assert(spaceStart.snapshot?.missionPlanet?.missionId === "test-chain-dispatch",
    `Space scene did not expose the test-chain-dispatch mission planet: ${JSON.stringify(spaceStart.snapshot?.missionPlanet)}`);
  assert(spaceStart.snapshot?.missionPlanet?.name === hubMapState.missionPlanet.name,
    `Space scene mission planet does not match the generated mission target: ${JSON.stringify(spaceStart.snapshot?.missionPlanet)}`);
  assert(spaceStart.coordinateText.includes(`POS X ${TEST_SHIP_POSITION.x}  Y ${TEST_SHIP_POSITION.y}`),
    `Space HUD is missing player coordinates: ${spaceStart.coordinateText}`);

  await page.evaluate((missionPlanet) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space || !missionPlanet) {
      return;
    }
    const nextX = missionPlanet.x - 540;
    const nextY = missionPlanet.y;
    space.shipRoot.x = nextX;
    space.shipRoot.y = nextY;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(nextX, nextY);
    space.syncActiveWorld?.(true);
    space.refreshHud?.();
  }, hubMapState.missionPlanet);
  await page.waitForTimeout(150);
  await capture(page, "space-generated-system-nearby.png");

  const nearbyCelestialState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      coordinateText: space?.coordinateText?.text ?? "",
    };
  });

  assert((nearbyCelestialState.snapshot?.activeCelestialSystems ?? 0) > 0,
    `Space scene did not activate any generated celestial systems near the mission target: ${JSON.stringify(nearbyCelestialState.snapshot)}`);
  assert((nearbyCelestialState.snapshot?.activeCelestialPlanets ?? 0) > 0,
    `Space scene did not activate any generated planets near the mission target: ${JSON.stringify(nearbyCelestialState.snapshot)}`);
  assert((nearbyCelestialState.snapshot?.radar?.contacts ?? []).every((contact) => contact.kind !== "planet"),
    `Radar should not show normal planets after the cleanup pass: ${JSON.stringify(nearbyCelestialState.snapshot?.radar)}`);

  const homeworldSpaceTarget = await page.evaluate(() => {
    const galaxy = window.__loeSession?.getGalaxyDefinition?.();
    const firstHomeworld = galaxy?.homeworlds?.[0] ?? null;
    const homeworldPlanet = galaxy?.planets?.find?.((planet) => planet.id === firstHomeworld?.planetId) ?? null;
    const homeworldSystem = galaxy?.systems?.find?.((system) => system.id === firstHomeworld?.systemId) ?? null;
    return firstHomeworld && homeworldPlanet && homeworldSystem
      ? {
          homeworld: firstHomeworld,
          planet: homeworldPlanet,
          system: homeworldSystem,
        }
      : null;
  });

  assert(homeworldSpaceTarget, "Could not resolve a generated homeworld target for the guard-fleet verification");

  await page.evaluate((target) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space || !target) {
      return;
    }
    const nextX = target.system.x - 720;
    const nextY = target.system.y + 140;
    space.shipRoot.x = nextX;
    space.shipRoot.y = nextY;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(nextX, nextY);
    space.syncActiveWorld?.(true);
    space.refreshHud?.();
  }, homeworldSpaceTarget);
  await page.waitForTimeout(180);
  await capture(page, "space-homeworld-guard.png");

  const homeworldRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "star")
  ));

  const homeworldSpaceState = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const snapshot = space?.getDebugSnapshot?.() ?? null;
    const homeworldRaceId = space?.galaxyDefinition?.homeworlds?.[0]?.raceId ?? null;
    const homeworldAlignment = homeworldRaceId ? snapshot?.war?.alignments?.[homeworldRaceId] ?? "neutral" : "neutral";
    const expectedGuardFactionId = homeworldAlignment === "empire"
      ? "empire"
      : homeworldAlignment === "republic"
        ? "republic"
        : "homeguard";
    return {
      snapshot,
      expectedGuardFactionId,
      nearestShips: snapshot?.nearestShips ?? [],
    };
  });

  assert((homeworldSpaceState.snapshot?.activeCelestialSystems ?? 0) > 0,
    `Homeworld system did not activate in space: ${JSON.stringify(homeworldSpaceState.snapshot)}`);
  assert((homeworldSpaceState.snapshot?.activeFactionCounts?.[homeworldSpaceState.expectedGuardFactionId] ?? 0) > 0,
    `Homeworld guard fleet did not activate near the home system: ${JSON.stringify({
      expectedGuardFactionId: homeworldSpaceState.expectedGuardFactionId,
      activeFactionCounts: homeworldSpaceState.snapshot?.activeFactionCounts,
    })}`);
  assert((homeworldRadarState?.contacts ?? []).some((contact) => contact.kind === "star"),
    `Radar did not expose a nearby star contact near the home system: ${JSON.stringify(homeworldRadarState)}`);
  assert((homeworldRadarState?.contacts ?? []).every((contact) => contact.kind !== "planet"),
    `Radar should not show normal planets near the home system: ${JSON.stringify(homeworldRadarState)}`);

  await page.evaluate((shipPosition) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return;
    }
    space.shipRoot.x = shipPosition.x;
    space.shipRoot.y = shipPosition.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(shipPosition.x, shipPosition.y);
    space.syncActiveWorld?.(true);
    space.refreshHud?.();
  }, DEEP_SPACE_POSITION);
  await page.waitForTimeout(100);
  await capture(page, "space-deep-space-region.png");

  const movedSpace = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      coordinateText: space?.coordinateText?.text ?? "",
      sessionShipPosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
    };
  });

  assert(movedSpace.snapshot?.ship?.x === DEEP_SPACE_POSITION.x && movedSpace.snapshot?.ship?.y === DEEP_SPACE_POSITION.y,
    `Space ship position did not update to the expected coordinates: ${JSON.stringify(movedSpace.snapshot?.ship)}`);
  assert(movedSpace.sessionShipPosition?.x === DEEP_SPACE_POSITION.x && movedSpace.sessionShipPosition?.y === DEEP_SPACE_POSITION.y,
    `Session ship position did not track the moved ship: ${JSON.stringify(movedSpace.sessionShipPosition)}`);
  assert(movedSpace.coordinateText.includes(`POS X ${DEEP_SPACE_POSITION.x}  Y ${DEEP_SPACE_POSITION.y}`),
    `Space HUD did not refresh to the moved ship position: ${movedSpace.coordinateText}`);
  assert(movedSpace.snapshot?.region === "Deep space",
    `Space region label did not switch to Deep space outside the galaxy body: ${JSON.stringify(movedSpace.snapshot)}`);
  assert(movedSpace.snapshot?.isDeepSpace === true,
    `Space debug snapshot did not flag the player as being in deep space: ${JSON.stringify(movedSpace.snapshot)}`);

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.returnToShip?.();
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(240);

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.openDataPadTab?.("map");
  });
  await page.waitForTimeout(220);
  await capture(page, "hub-map-returned.png");

  const returnedHubMap = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub?.galaxyMapOverlay;
    return {
      snapshot: hub?.getDebugSnapshot?.() ?? null,
      routeText: overlay?.routeText?.text ?? "",
      shipSpacePosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
    };
  });

  assert(returnedHubMap.snapshot?.mapVisible === true, "Map tab did not reopen after returning from space");
  assert(returnedHubMap.shipSpacePosition?.x === DEEP_SPACE_POSITION.x && returnedHubMap.shipSpacePosition?.y === DEEP_SPACE_POSITION.y,
    `Returned hub map lost the shared ship position: ${JSON.stringify(returnedHubMap.shipSpacePosition)}`);
  assert(returnedHubMap.routeText.includes(`Ship: X ${DEEP_SPACE_POSITION.x}  Y ${DEEP_SPACE_POSITION.y}`),
    `Returned hub map is missing the updated ship coordinates: ${returnedHubMap.routeText}`);
  assert(returnedHubMap.routeText.includes("Region: Deep space"),
    `Returned hub map did not report Deep space after moving outside the galaxy body: ${returnedHubMap.routeText}`);

  const result = {
    verifiedScenes: ["hub", "space", "hub"],
    initialHubMap: hubMapState,
    sectorClickTarget,
    sectorDetailState,
    galaxyReturnState,
    hoverState,
    spaceStart,
    movedSpace,
    returnedHubMap,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
