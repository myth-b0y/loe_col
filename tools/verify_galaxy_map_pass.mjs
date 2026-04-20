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
const RETURN_SHIP_POSITION = { x: 9033, y: 7422 };

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? "{}");
  return JSON.parse(raw);
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
    window.__loeSession?.acceptMission?.("ember-watch");
    window.__loeSession?.setSelectedMission?.("ember-watch");
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
    return {
      snapshot: hub?.getDebugSnapshot?.() ?? null,
      visible: overlay?.isVisible?.() ?? false,
      routeText: overlay?.routeText?.text ?? "",
      detailText: overlay?.detailText?.text ?? "",
      hoverText: overlay?.hoverText?.text ?? "",
      shipSpacePosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
      trackedMissionId: window.__loeSession?.getTrackedMissionId?.() ?? null,
    };
  });

  assert(hubMapState.visible, "Galaxy map overlay is not visible from the hub datapad");
  assert(hubMapState.snapshot?.mapVisible === true, "Hub debug snapshot did not report the map as visible");
  assert(hubMapState.shipSpacePosition?.x === TEST_SHIP_POSITION.x && hubMapState.shipSpacePosition?.y === TEST_SHIP_POSITION.y,
    `Unexpected initial ship position on hub map: ${JSON.stringify(hubMapState.shipSpacePosition)}`);
  assert(hubMapState.routeText.includes(`Ship: X ${TEST_SHIP_POSITION.x}  Y ${TEST_SHIP_POSITION.y}`),
    `Hub map route text is missing shared ship coordinates: ${hubMapState.routeText}`);
  assert(hubMapState.detailText.includes("Pyre Verge"), `Hub map detail text is missing the mission planet: ${hubMapState.detailText}`);

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
      backVisible: overlay?.sectorBackButton?.container?.visible ?? false,
      selectedSectorId: overlay?.selectedSectorId ?? null,
      visibleLabels,
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
    };
  });

  assert(hoverState.hoverText.includes("Hover: X "), `Map hover readout did not populate: ${hoverState.hoverText}`);
  assert(hoverState.hoverLabel.length > 0, "Map hover label did not render live coordinates");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("ember-watch");
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

  assert(spaceStart.snapshot?.missionPlanet?.missionId === "ember-watch",
    `Space scene did not expose the ember-watch mission planet: ${JSON.stringify(spaceStart.snapshot?.missionPlanet)}`);
  assert(spaceStart.coordinateText.includes(`POS X ${TEST_SHIP_POSITION.x}  Y ${TEST_SHIP_POSITION.y}`),
    `Space HUD is missing player coordinates: ${spaceStart.coordinateText}`);

  await page.evaluate((shipPosition) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return;
    }
    space.shipRoot.x = shipPosition.x;
    space.shipRoot.y = shipPosition.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(shipPosition.x, shipPosition.y);
    space.refreshHud?.();
  }, RETURN_SHIP_POSITION);
  await page.waitForTimeout(100);

  const movedSpace = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      coordinateText: space?.coordinateText?.text ?? "",
      sessionShipPosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
    };
  });

  assert(movedSpace.snapshot?.ship?.x === RETURN_SHIP_POSITION.x && movedSpace.snapshot?.ship?.y === RETURN_SHIP_POSITION.y,
    `Space ship position did not update to the expected coordinates: ${JSON.stringify(movedSpace.snapshot?.ship)}`);
  assert(movedSpace.sessionShipPosition?.x === RETURN_SHIP_POSITION.x && movedSpace.sessionShipPosition?.y === RETURN_SHIP_POSITION.y,
    `Session ship position did not track the moved ship: ${JSON.stringify(movedSpace.sessionShipPosition)}`);
  assert(movedSpace.coordinateText.includes(`POS X ${RETURN_SHIP_POSITION.x}  Y ${RETURN_SHIP_POSITION.y}`),
    `Space HUD did not refresh to the moved ship position: ${movedSpace.coordinateText}`);

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
  assert(returnedHubMap.shipSpacePosition?.x === RETURN_SHIP_POSITION.x && returnedHubMap.shipSpacePosition?.y === RETURN_SHIP_POSITION.y,
    `Returned hub map lost the shared ship position: ${JSON.stringify(returnedHubMap.shipSpacePosition)}`);
  assert(returnedHubMap.routeText.includes(`Ship: X ${RETURN_SHIP_POSITION.x}  Y ${RETURN_SHIP_POSITION.y}`),
    `Returned hub map is missing the updated ship coordinates: ${returnedHubMap.routeText}`);

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
