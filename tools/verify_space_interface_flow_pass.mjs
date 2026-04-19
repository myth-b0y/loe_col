import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-interface-flow-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

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

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeSession?.acceptMission?.("ember-watch");
    window.__loeSession?.setSelectedMission?.("ember-watch");
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  const hubInventory = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      inventoryVisible: hub?.inventoryOverlay?.isVisible?.() ?? false,
      logbookVisible: hub?.logbookOverlay?.isVisible?.() ?? false,
      mapVisible: hub?.galaxyMapOverlay?.isVisible?.() ?? false,
    };
  });
  assert(hubInventory.inventoryVisible, "TAB did not open inventory in hub");
  assert(!hubInventory.logbookVisible && !hubInventory.mapVisible, "TAB in hub did not default to inventory");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  const preLandingGate = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.openDeployOverlay?.();
    hub?.deployAcceptedMission?.();
    return {
      deployVisible: hub?.deployOverlay?.visible ?? false,
      deployStatus: hub?.deployStatusText?.text ?? "",
      activeMissionId: window.__loeSession?.activeMissionId ?? null,
      travel: window.__loeSession?.getShipTravelState?.() ?? null,
    };
  });
  assert(preLandingGate.deployVisible, "Exit hatch prep overlay did not stay open before landing");
  assert(preLandingGate.activeMissionId === null, "Ground mission started before landing");
  assert(/reach the mission planet and land/i.test(preLandingGate.deployStatus), `Unexpected pre-landing hatch message '${preLandingGate.deployStatus}'`);

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.closeDeployOverlay?.();
    hub?.openDataPadTab?.("map");
  });
  await page.waitForTimeout(200);
  const hubMapReadout = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      mapVisible: hub?.galaxyMapOverlay?.isVisible?.() ?? false,
      routeText: hub?.galaxyMapOverlay?.routeText?.text ?? "",
      detailText: hub?.galaxyMapOverlay?.detailText?.text ?? "",
    };
  });
  assert(hubMapReadout.mapVisible, "Galaxy map did not open in hub");
  assert(/Current route: Ember Watch/i.test(hubMapReadout.detailText), `Galaxy map is not tracking the active mission: '${hubMapReadout.detailText}'`);
  await capture(page, "hub-galaxy-map.png");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("ember-watch");
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  await capture(page, "space-start.png");

  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  const spaceInventory = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      inventoryVisible: space?.inventoryOverlay?.isVisible?.() ?? false,
      logbookVisible: space?.logbookOverlay?.isVisible?.() ?? false,
      mapVisible: space?.galaxyMapOverlay?.isVisible?.() ?? false,
    };
  });
  assert(spaceInventory.inventoryVisible, "TAB did not open inventory in space");
  assert(!spaceInventory.logbookVisible && !spaceInventory.mapVisible, "TAB in space did not default to inventory");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const spaceEscClose = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      pauseActive: window.__loeGame?.scene.isActive("pause") ?? false,
      inventoryVisible: space?.inventoryOverlay?.isVisible?.() ?? false,
    };
  });
  assert(!spaceEscClose.pauseActive, "ESC opened pause instead of closing the space datapad overlay first");
  assert(!spaceEscClose.inventoryVisible, "ESC did not close the space inventory overlay");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const pauseActive = await page.evaluate(() => window.__loeGame?.scene.isActive("pause") ?? false);
  assert(pauseActive, "ESC did not open pause in space");
  await capture(page, "space-pause.png");

  await page.keyboard.press("Escape");
  await waitForScene(page, "space");
  await page.waitForTimeout(150);

  const landingPrep = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const missionPlanet = space?.getTrackedMissionPlanet?.();
    if (!space || !missionPlanet) {
      return null;
    }

    space.shipRoot.x = missionPlanet.x - (missionPlanet.radius + 90);
    space.shipRoot.y = missionPlanet.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(space.shipRoot.x, space.shipRoot.y);
    space.refreshHud?.();

    return {
      missionPlanet,
      landingReady: space.canLandOnTrackedMissionPlanet?.() ?? false,
      returnLabel: space.returnButton?.label?.text ?? "",
      waypointLabel: space.waypointLabel?.text ?? "",
      travel: window.__loeSession?.getShipTravelState?.() ?? null,
    };
  });

  assert(landingPrep?.landingReady, "Mission planet did not enter landing range");
  assert(landingPrep.returnLabel === "Land On Planet", `Unexpected landing button label '${landingPrep?.returnLabel}'`);
  assert(/LANDING WINDOW OPEN/i.test(landingPrep.waypointLabel), `Waypoint label did not announce landing window: '${landingPrep?.waypointLabel}'`);
  await capture(page, "space-landing-window.png");

  await page.mouse.click(1176, 44);
  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const landedHub = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      airlockLabel: hub?.airlockLabel?.text ?? "",
      missionText: hub?.missionText?.text ?? "",
      statusText: hub?.statusText?.text ?? "",
      travel: window.__loeSession?.getShipTravelState?.() ?? null,
    };
  });

  assert(landedHub.travel?.status === "arrived", `Landing did not mark ship travel as arrived: ${JSON.stringify(landedHub.travel)}`);
  assert(landedHub.airlockLabel === "Exit Hatch Ready", `Hub hatch was not ready after landing: '${landedHub.airlockLabel}'`);
  await capture(page, "hub-after-landing.png");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.deployAcceptedMission?.();
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(250);
  await capture(page, "mission-start.png");

  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  const missionInventory = await page.evaluate(() => {
    const mission = window.__loeGame?.scene.keys.mission;
    return {
      inventoryVisible: mission?.inventoryOverlay?.isVisible?.() ?? false,
      logbookVisible: mission?.logbookOverlay?.isVisible?.() ?? false,
      mapVisible: mission?.galaxyMapOverlay?.isVisible?.() ?? false,
    };
  });
  assert(missionInventory.inventoryVisible, "TAB did not open inventory in mission");
  assert(!missionInventory.logbookVisible && !missionInventory.mapVisible, "TAB in mission did not default to inventory");

  const summary = {
    url: URL,
    verifiedScenes: ["hub", "space", "hub", "mission"],
    preLandingGate,
    hubMapReadout,
    landingPrep,
    landedHub,
    missionInventory,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
