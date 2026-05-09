import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/reclaim-audio-hud-pass");
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

async function capture(page, filename) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
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

  const reclaimSetup = await page.evaluate(() => {
    window.localStorage.clear();
    const session = window.__loeSession;
    session.startNewGame(0);

    const galaxy = session.getGalaxyDefinition();
    const war = session.getFactionWarState();
    const zone = galaxy.zones.find((candidate) => (
      !candidate.isPrimeWorldZone
      && candidate.currentControllerId !== war.empireRaceId
      && galaxy.planets.some((planet) => planet.systemId === candidate.systemId)
    ));
    if (!zone) {
      return null;
    }

    zone.currentControllerId = war.empireRaceId;
    zone.zoneState = "stable";
    zone.zoneCaptureProgress = 0;
    zone.zoneConflictProgress = 0;
    zone.captureAttackerRaceId = null;
    session.setGalaxyDefinition(galaxy, true);

    session.acceptMission("distress-reclaim");
    session.setMissionActivityState("distress-reclaim", {
      stepIndex: 0,
      completedStepIds: [],
      flags: {
        targetZoneId: zone.id,
        reclaimZoneId: zone.id,
      },
    }, true);
    session.setSelectedMission("distress-reclaim");

    const planet = galaxy.planets.find((candidate) => candidate.systemId === zone.systemId);
    const spaceSeedX = planet?.x ?? 0;
    const spaceSeedY = planet?.y ?? 0;
    session.setShipSpacePosition(spaceSeedX, spaceSeedY);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("space");

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      planetId: planet?.id ?? null,
      planetName: planet?.name ?? null,
      empireRaceId: war.empireRaceId,
    };
  });
  assert(reclaimSetup, "Failed to seed reclaim test zone");

  await waitForScene(page, "space");
  await page.waitForTimeout(250);

  const blockedResult = await page.evaluate((seed) => {
    const space = window.__loeGame?.scene.keys.space;
    const contract = window.__loeContracts?.find?.((candidate) => candidate.id === "distress-reclaim");
    const step = contract?.activities?.[0];
    const targetZone = space?.galaxyDefinition?.zones?.find?.((zone) => zone.id === seed.zoneId) ?? null;
    const targetPlanet = targetZone
      ? space?.galaxyDefinition?.planets?.find?.((planet) => planet.id === seed.planetId)
      : null;
    if (!space || !step || !targetZone || !targetPlanet) {
      return null;
    }

    space.syncActiveWorld?.(true);
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();

    const shipId = space.spawnWorldMissionFactionShip?.("empire", "distress-reclaim", step, targetPlanet.x + 180, targetPlanet.y + 90, 0);
    const hostileShip = space.factionShips.find((ship) => ship.id === shipId);
    if (hostileShip) {
      hostileShip.assignmentZoneId = seed.zoneId;
      hostileShip.originZoneId = seed.zoneId;
      hostileShip.originSystemId = targetZone.systemId;
      hostileShip.root.x = targetPlanet.x + 120;
      hostileShip.root.y = targetPlanet.y + 72;
    }

    const planetView = space.activePlanetViews.get(seed.planetId);
    if (planetView) {
      const matrix = planetView.root.getWorldTransformMatrix();
      space.shipRoot.x = matrix.tx;
      space.shipRoot.y = matrix.ty;
      window.__loeSession?.setShipSpacePosition?.(matrix.tx, matrix.ty);
    }

    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
    const interactionBlocked = space.tryCompleteInteractiveMissionStep?.() ?? null;
    const snapshot = space.getDebugSnapshot?.() ?? {};
    return {
      interactionBlocked,
      directReclaimReady: snapshot.directReclaimReady ?? null,
      statusText: space.statusText?.text ?? "",
      contactText: space.contactText?.text ?? "",
      coordinateText: space.coordinateText?.text ?? "",
      routeText: space.routeText?.text ?? "",
      thrusterCounts: window.__loeSfx?.getDebugState?.()?.counts ?? {},
    };
  }, reclaimSetup);
  assert(blockedResult, "Failed to create blocked reclaim state");
  assert(blockedResult.interactionBlocked === true, `Zone interaction should still block while Empire ships remain: ${JSON.stringify(blockedResult)}`);
  assert(blockedResult.directReclaimReady === false, `Direct reclaim should be unavailable while Empire ships remain: ${JSON.stringify(blockedResult)}`);
  assert(!String(blockedResult.routeText).includes("SPACE TEST FIELD"), `Space HUD title should be removed: ${JSON.stringify(blockedResult)}`);
  assert(String(blockedResult.statusText).includes("Sector") && String(blockedResult.statusText).includes("Zone"),
    `Left HUD should describe world/navigation context: ${JSON.stringify(blockedResult)}`);
  assert(String(blockedResult.coordinateText).includes("HULL")
    && String(blockedResult.coordinateText).includes("SHIELD")
    && String(blockedResult.coordinateText).includes("THRUSTERS")
    && String(blockedResult.coordinateText).includes("REACTOR")
    && String(blockedResult.coordinateText).includes("HYPERDRIVE"),
  `Right HUD should show ship-only status: ${JSON.stringify(blockedResult)}`);
  await capture(page, "space-hud.png");

  const clearedResult = await page.evaluate((seed) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    space.factionShips
      .filter((ship) => ship.factionId === "empire" && ship.assignmentZoneId === seed.zoneId)
      .forEach((ship) => {
        ship.hp = 0;
        const state = space.shipStates.get(ship.id);
        if (state) {
          state.hp = 0;
          state.destroyed = true;
        }
        ship.root.destroy();
      });
    space.factionShips = space.factionShips.filter((ship) => !(ship.factionId === "empire" && ship.assignmentZoneId === seed.zoneId && ship.hp <= 0));

    const thrusterBefore = { ...window.__loeSfx?.getDebugState?.()?.counts };
    space.shipVelocity.set(space.playerMaxSpeed * 0.92, 0);
    space.thrusting = true;
    for (let index = 0; index < 8; index += 1) {
      space.updateSpaceAmbientSoundscape?.(9999);
      space.updateMissionActivity?.(1 / 60);
      space.refreshHud?.();
    }
    const thrusterAfter = { ...window.__loeSfx?.getDebugState?.()?.counts };
    const interactionBlocked = space.tryCompleteInteractiveMissionStep?.() ?? null;
    const directReclaimReady = Boolean(space.getDirectReclaimLandingTarget?.());
    const landed = space.landAtDirectReclaimPlanet?.() ?? false;
    return {
      interactionBlocked,
      directReclaimReady,
      landed,
      thrusterBefore,
      thrusterAfter,
      ambientCounts: window.__loeSfx?.getDebugState?.()?.counts ?? {},
    };
  }, reclaimSetup);
  assert(clearedResult, "Failed to evaluate cleared reclaim state");
  assert(clearedResult.interactionBlocked === false, `Zone step should no longer consume interaction once reclaim is ready: ${JSON.stringify(clearedResult)}`);
  assert(clearedResult.directReclaimReady === true, `Direct reclaim should become available after clearing Empire ships: ${JSON.stringify(clearedResult)}`);
  assert(clearedResult.landed === true, `Direct reclaim landing handoff should launch after the system is clear: ${JSON.stringify(clearedResult)}`);
  assert((clearedResult.thrusterAfter["ship-thruster"] ?? 0) === (clearedResult.thrusterBefore["ship-thruster"] ?? 0)
    && (clearedResult.thrusterAfter["npc-thruster"] ?? 0) === (clearedResult.thrusterBefore["npc-thruster"] ?? 0),
  `Thruster cues should remain silent after the cleanup: ${JSON.stringify(clearedResult)}`);
  assert(
    (clearedResult.ambientCounts["space-ambient"] ?? 0)
    + (clearedResult.ambientCounts["space-ambient-hum"] ?? 0)
    + (clearedResult.ambientCounts["space-ambient-drift"] ?? 0)
    + (clearedResult.ambientCounts["space-ambient-signal"] ?? 0) > 0,
    `Space ambient cues should still play: ${JSON.stringify(clearedResult)}`,
  );

  await waitForScene(page, "hub");

  const hubAmbient = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    const before = { ...window.__loeSfx?.getDebugState?.()?.counts };
    hub?.updateShipInteriorAmbient?.(9999);
    const after = { ...window.__loeSfx?.getDebugState?.()?.counts };
    return { before, after };
  });
  assert((hubAmbient.after["ship-interior-ambient"] ?? 0) > (hubAmbient.before["ship-interior-ambient"] ?? 0),
    `Hub should emit ship interior ambience: ${JSON.stringify(hubAmbient)}`);

  await page.evaluate(() => {
    window.__loeSession?.startMission?.("world-zone-reclaim");
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.start("mission", { missionId: "world-zone-reclaim" });
  });
  await waitForScene(page, "mission");

  const groundAmbient = await page.evaluate(() => {
    const mission = window.__loeGame?.scene.keys.mission;
    const before = { ...window.__loeSfx?.getDebugState?.()?.counts };
    mission?.updateGroundAmbientSoundscape?.(9999);
    mission?.updateGroundAmbientSoundscape?.(9999);
    const after = { ...window.__loeSfx?.getDebugState?.()?.counts };
    return { before, after };
  });
  assert(
    ((groundAmbient.after["ground-ambient"] ?? 0) + (groundAmbient.after["ground-ambient-rumble"] ?? 0))
    > ((groundAmbient.before["ground-ambient"] ?? 0) + (groundAmbient.before["ground-ambient-rumble"] ?? 0)),
    `Ground missions should emit ambient cues: ${JSON.stringify(groundAmbient)}`,
  );

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify({
    reclaimSetup,
    blockedResult,
    clearedResult,
    hubAmbient,
    groundAmbient,
    consoleErrors,
  }, null, 2));
} finally {
  await browser.close();
}
