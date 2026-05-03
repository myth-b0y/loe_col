import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/state-flow-pass");
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

async function waitForGameBootstrap(page, timeoutMs = 30000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const ready = await page.evaluate(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for game bootstrap");
}

async function waitForScene(page, sceneKey, timeoutMs = 10000) {
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

function getPolygonCentroid(points) {
  const sum = points.reduce((accumulator, point) => ({
    x: accumulator.x + point.x,
    y: accumulator.y + point.y,
  }), { x: 0, y: 0 });
  return {
    x: Math.round(sum.x / points.length),
    y: Math.round(sum.y / points.length),
  };
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
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
  await waitForGameBootstrap(page);

  const saveSplit = await page.evaluate(() => {
    window.localStorage.clear();
    const session = window.__loeSession;
    session.startNewGame(0);

    session.saveData.profile.callsign = "Manual Save";
    session.saveData.profile.credits = 111;
    session.saveData.ship.systems.hull = { integrity: 70, online: true };
    session.saveToDisk(0);

    session.saveData.profile.callsign = "Autosave";
    session.saveData.profile.credits = 222;
    session.saveData.ship.travel = {
      status: "in-transit",
      destinationMissionId: "distress-transport",
      arrivedMissionId: null,
      lastDepartureAt: new Date().toISOString(),
      lastArrivalAt: null,
    };
    session.saveData.ship.systems.hull = { integrity: 0, online: false };
    session.autosaveToDisk(0);

    const slot = session.getSaveSlots()[0];
    const manualCredits = slot.data?.profile.credits ?? null;
    const autosaveCredits = slot.autosaveData?.profile.credits ?? null;
    session.loadSave(0, "manual");
    const loadedManualCredits = session.saveData.profile.credits;
    session.loadSave(0, "autosave");
    const loadedAutosaveCredits = session.saveData.profile.credits;
    return {
      hasManual: Boolean(slot.data),
      hasAutosave: Boolean(slot.autosaveData),
      manualCredits,
      autosaveCredits,
      loadedManualCredits,
      loadedAutosaveCredits,
      latestCredits: slot.latestData?.profile.credits ?? null,
    };
  });
  assert(saveSplit.hasManual && saveSplit.hasAutosave, `Expected manual and autosave records: ${JSON.stringify(saveSplit)}`);
  assert(saveSplit.manualCredits === 111 && saveSplit.autosaveCredits === 222,
    `Manual/autosave should remain separate: ${JSON.stringify(saveSplit)}`);
  assert(saveSplit.loadedManualCredits === 111 && saveSplit.loadedAutosaveCredits === 222,
    `Loading manual/autosave should select the requested record: ${JSON.stringify(saveSplit)}`);

  await page.evaluate(() => {
    window.__loeGame?.scene.start("game-over", { mode: "space" });
  });
  await waitForScene(page, "game-over");
  const gameOverSnapshot = await getState(page);
  assert(JSON.stringify(gameOverSnapshot.snapshot?.buttons ?? []).includes("Continue"),
    `Game over buttons should expose Continue: ${JSON.stringify(gameOverSnapshot.snapshot)}`);
  assert(!JSON.stringify(gameOverSnapshot.snapshot?.buttons ?? []).includes("Return To Ship"),
    `Game over must not expose Return To Ship: ${JSON.stringify(gameOverSnapshot.snapshot)}`);
  await capture(page, "game-over-buttons.png");

  const continueResult = await page.evaluate(() => {
    const gameOver = window.__loeGame?.scene.keys["game-over"];
    gameOver?.continueFromLatestSave?.();
    return true;
  });
  assert(continueResult, "Continue action did not run");
  await waitForScene(page, "hub");
  const respawnState = await page.evaluate(() => ({
    credits: window.__loeSession?.saveData.profile.credits,
    travel: window.__loeSession?.getShipTravelState?.(),
    hull: window.__loeSession?.getShipSystemsState?.().hull,
  }));
  assert(respawnState.credits === 222, `Continue should load the latest autosave: ${JSON.stringify(respawnState)}`);
  assert(respawnState.travel.status === "docked", `Continue should respawn inside the ship: ${JSON.stringify(respawnState)}`);
  assert(respawnState.hull.integrity === 100 && respawnState.hull.online,
    `Continue should not restore a dead hull state: ${JSON.stringify(respawnState)}`);

  const reclaimSeed = await page.evaluate(() => {
    const session = window.__loeSession;
    session.startNewGame(0);
    const galaxy = session.getGalaxyDefinition();
    const war = session.getFactionWarState();
    const targetZone = galaxy.zones.find((zone) => (
      !zone.isPrimeWorldZone
      && zone.currentControllerId !== war.empireRaceId
      && galaxy.planets.some((planet) => planet.systemId === zone.systemId)
    ));
    if (!targetZone) {
      return null;
    }
    const originalControllerId = targetZone.currentControllerId;
    targetZone.currentControllerId = war.empireRaceId;
    targetZone.zoneState = "stable";
    targetZone.zoneCaptureProgress = 0;
    targetZone.zoneConflictProgress = 0;
    targetZone.captureAttackerRaceId = null;
    session.setGalaxyDefinition(galaxy, true);
    const planet = galaxy.planets.find((candidate) => candidate.systemId === targetZone.systemId);
    session.setShipSpacePosition(planet.x, planet.y);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.start("space");
    return {
      zoneId: targetZone.id,
      zoneName: targetZone.name,
      originalControllerId,
      planetId: planet.id,
      planetCount: galaxy.planets.length,
      systemCount: galaxy.systems.length,
    };
  });
  assert(reclaimSeed, "Could not seed an Empire-held reclaim zone");
  await waitForScene(page, "space");
  await page.waitForTimeout(250);

  const reclaimLaunch = await page.evaluate((seed) => {
    const space = window.__loeGame?.scene.keys.space;
    space.syncActiveWorld?.();
    space.updateCelestialMotion?.();
    const planetView = space.activePlanetViews?.get?.(seed.planetId);
    if (planetView) {
      const matrix = planetView.root.getWorldTransformMatrix();
      space.shipRoot.x = matrix.tx;
      space.shipRoot.y = matrix.ty;
      window.__loeSession?.setShipSpacePosition?.(matrix.tx, matrix.ty);
    }
    space.shipStates?.forEach?.((state) => {
      if (state.factionId === "empire") {
        state.destroyed = true;
      }
    });
    const launched = space.landAtDirectReclaimPlanet?.() ?? false;
    return {
      launched,
      activeMissionId: window.__loeSession?.activeMissionId ?? null,
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      travel: window.__loeSession?.getShipTravelState?.(),
      accepted: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
      planetCount: space.galaxyDefinition?.planets?.length ?? 0,
      systemCount: space.galaxyDefinition?.systems?.length ?? 0,
    };
  }, reclaimSeed);
  assert(reclaimLaunch.launched, `Direct reclaim should launch normal landing handoff: ${JSON.stringify(reclaimLaunch)}`);
  assert(reclaimLaunch.activeMissionId === null, `Direct reclaim should not start ground mission immediately: ${JSON.stringify(reclaimLaunch)}`);
  assert(reclaimLaunch.selectedMissionId === "world-zone-reclaim", `Direct reclaim should select reclaim mission: ${JSON.stringify(reclaimLaunch)}`);
  assert(reclaimLaunch.travel.status === "arrived" && reclaimLaunch.travel.arrivedMissionId === "world-zone-reclaim",
    `Direct reclaim should mark ship arrived for hub deployment: ${JSON.stringify(reclaimLaunch)}`);
  assert(reclaimLaunch.planetCount === reclaimSeed.planetCount && reclaimLaunch.systemCount === reclaimSeed.systemCount,
    `Reclaim landing should not corrupt planet/system counts: ${JSON.stringify({ reclaimSeed, reclaimLaunch })}`);
  await waitForScene(page, "hub");

  const reclaimComplete = await page.evaluate((seed) => {
    const session = window.__loeSession;
    session.startMission("world-zone-reclaim");
    session.completeMission("world-zone-reclaim", {
      credits: 0,
      xp: 0,
      materials: { alloy: 0, shardDust: 0, filament: 0 },
      items: [],
    });
    const galaxy = session.getGalaxyDefinition();
    const zone = galaxy.zones.find((candidate) => candidate.id === seed.zoneId);
    return {
      zone,
      planetCount: galaxy.planets.length,
      systemCount: galaxy.systems.length,
      hasAutosave: Boolean(session.getSaveSlots()[0]?.autosaveData),
    };
  }, reclaimSeed);
  assert(reclaimComplete.zone.currentControllerId === reclaimSeed.originalControllerId,
    `Reclaim completion should restore original owner: ${JSON.stringify(reclaimComplete.zone)}`);
  assert(reclaimComplete.planetCount === reclaimSeed.planetCount && reclaimComplete.systemCount === reclaimSeed.systemCount,
    `Reclaim completion should not delete generated worlds: ${JSON.stringify(reclaimComplete)}`);
  assert(reclaimComplete.hasAutosave,
    `Mission completion should write an autosave record: ${JSON.stringify(reclaimComplete)}`);

  await page.evaluate(() => {
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.start("space");
  });
  await waitForScene(page, "space");
  const freezeProbe = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.liveMissionGrantTimerMs = 12345;
    space.openDataPadTab?.("map");
    const before = space.liveMissionGrantTimerMs;
    space.update?.(0, 60000);
    const after = space.liveMissionGrantTimerMs;
    return {
      before,
      after,
      mapVisible: space.galaxyMapOverlay?.isVisible?.() ?? false,
    };
  });
  assert(freezeProbe.mapVisible, `Map overlay should be visible for freeze probe: ${JSON.stringify(freezeProbe)}`);
  assert(freezeProbe.before === freezeProbe.after,
    `Live space timers should not tick under datapad/map overlay: ${JSON.stringify(freezeProbe)}`);

  await page.evaluate(() => {
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("hub");
  });
  await waitForScene(page, "hub");

  const sectorMapFeedback = await page.evaluate(() => {
    const session = window.__loeSession;
    const galaxy = session.saveData.galaxy;
    const zone = galaxy.zones.find((candidate) => candidate.territoryPoints.length >= 3 && !candidate.isPrimeWorldZone);
    const system = galaxy.systems.find((candidate) => candidate.id === zone.systemId);
    zone.zoneState = "capturing";
    zone.zoneCaptureProgress = 0.46;
    zone.zoneConflictProgress = 0.3;
    zone.captureAttackerRaceId = session.getFactionWarState().empireRaceId;

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      sectorId: zone.sectorId,
      hoverPoint: { x: Math.round(system.x), y: Math.round(system.y) },
    };
  });
  const mapSnapshot = await page.evaluate((feedback) => {
    const hub = window.__loeGame?.scene.keys.hub;
    const overlay = hub.galaxyMapOverlay;
    const hoverPoint = feedback.hoverPoint;
    overlay.show();
    overlay.selectedSectorId = feedback.sectorId;
    overlay.hoverWorldPoint = hoverPoint;
    overlay.refresh(true);
    return overlay.getDebugSnapshot();
  }, sectorMapFeedback);
  assert(mapSnapshot.selectedSectorId === sectorMapFeedback.sectorId,
    `Expected sector detail view: ${JSON.stringify(mapSnapshot)}`);
  assert(mapSnapshot.visibleZoneCaptureIndicators >= 1,
    `Sector map should expose takeover progress indicators: ${JSON.stringify(mapSnapshot)}`);
  assert(mapSnapshot.hoverZone?.id === sectorMapFeedback.zoneId,
    `Sector hover should identify zone name: ${JSON.stringify({ expected: sectorMapFeedback, mapSnapshot })}`);
  await capture(page, "sector-map-zone-feedback.png");

  const relevantErrors = consoleErrors.filter((entry) => (
    !entry.message.includes("Failed to load resource")
    && !entry.message.includes("404")
  ));
  assert(relevantErrors.length === 0, `Unexpected browser errors: ${JSON.stringify(relevantErrors, null, 2)}`);

  console.log("State flow pass verified.");
} finally {
  await browser.close();
}
