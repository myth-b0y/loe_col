import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-hyperdrive-pass");
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

async function waitForHyperdriveState(page, expectedState, timeoutMs = 6000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await getState(page);
    if (state.snapshot?.hyperdrive?.state === expectedState) {
      return state;
    }
    await page.waitForTimeout(50);
  }

  throw new Error(`Timed out waiting for hyperdrive state '${expectedState}'`);
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
}

async function holdSpaceToEngage(page) {
  await page.keyboard.down("Space");
  await page.waitForTimeout(3200);
  await page.keyboard.up("Space");
  return waitForHyperdriveState(page, "active", 2000);
}

async function resetHyperdriveScenario(page, x, y) {
  await page.evaluate(({ x: nextX, y: nextY }) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return;
    }

    space.hyperdrive.state = "normal";
    space.hyperdrive.chargeElapsedMs = 0;
    space.hyperdrive.cooldownRemainingMs = 0;
    space.hyperdrive.exitBlendRemainingMs = 0;
    space.hyperdrive.lastDisengageReason = null;
    space.hyperdrive.lockedDirectionX = 1;
    space.hyperdrive.lockedDirectionY = 0;
    space.hyperdriveTouchHeld = false;
    space.hyperdriveTouchTapQueued = false;
    space.hyperdriveCountdownValue = 0;
    space.shipRoot.x = nextX;
    space.shipRoot.y = nextY;
    space.shipVelocity.set(0, 0);
    space.fireHeld = false;
    space.playerHull = Math.max(space.playerHull, 6);
    window.__loeSession?.setShipSpacePosition?.(space.shipRoot.x, space.shipRoot.y);
    space.refreshHud?.();
  }, { x, y });
  await page.waitForTimeout(120);
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
  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("ember-watch");
  });

  const spaceStart = await waitForScene(page, "space");
  await page.waitForTimeout(250);
  await capture(page, "space-start.png");

  assert(spaceStart.snapshot?.hyperdrive?.state === "normal", `Expected initial hyperdrive state normal, got ${spaceStart.snapshot?.hyperdrive?.state}`);

  await page.mouse.move(1180, 360);
  const sfxBeforeEngage = spaceStart.sfx?.counts ?? {};
  const activeState = await holdSpaceToEngage(page);
  await capture(page, "hyperdrive-active.png");

  assert(activeState.snapshot.hyperdrive.state === "active", "Hyperdrive did not enter active state after charge");
  assert(Math.hypot(activeState.snapshot.ship.vx, activeState.snapshot.ship.vy) >= 2500,
    `Hyperdrive speed did not spike high enough: ${Math.hypot(activeState.snapshot.ship.vx, activeState.snapshot.ship.vy)}`);
  assert((activeState.snapshot.hyperdrive.lockedDirection.x ?? 0) > 0.92,
    `Hyperdrive locked direction did not follow facing: ${JSON.stringify(activeState.snapshot.hyperdrive.lockedDirection)}`);
  assert((activeState.sfx?.counts?.["hyperdrive-charge"] ?? 0) > (sfxBeforeEngage["hyperdrive-charge"] ?? 0), "Missing hyperdrive charge audio cue");
  assert((activeState.sfx?.counts?.["hyperdrive-countdown"] ?? 0) >= (sfxBeforeEngage["hyperdrive-countdown"] ?? 0) + 3, "Missing hyperdrive countdown beeps");
  assert((activeState.sfx?.counts?.["hyperdrive-engage"] ?? 0) > (sfxBeforeEngage["hyperdrive-engage"] ?? 0), "Missing hyperdrive engage audio cue");

  const activeFacing = activeState.snapshot.ship.facing;
  const fireCountBeforeCombatLock = activeState.sfx?.counts?.["player-fire"] ?? 0;
  await page.mouse.move(120, 120);
  await page.mouse.down();
  await page.waitForTimeout(240);
  await page.mouse.up();
  await page.waitForTimeout(160);
  const combatLockedState = await getState(page);
  assert(combatLockedState.snapshot.hyperdrive.state === "active", "Hyperdrive dropped out unexpectedly during combat-lock check");
  assert(Math.abs(combatLockedState.snapshot.ship.facing - activeFacing) <= 3,
    `Ship turned during active hyperdrive: ${activeFacing} -> ${combatLockedState.snapshot.ship.facing}`);
  assert((combatLockedState.sfx?.counts?.["player-fire"] ?? 0) === fireCountBeforeCombatLock,
    "Player weapons still fired during active hyperdrive");

  await page.keyboard.down("Space");
  await page.waitForTimeout(120);
  await page.keyboard.up("Space");
  await page.waitForTimeout(120);
  const manualDropState = await waitForHyperdriveState(page, "cooldown", 1200);
  await capture(page, "hyperdrive-manual-drop.png");

  assert(manualDropState.snapshot.hyperdrive.cooldownRemainingMs <= 30000 && manualDropState.snapshot.hyperdrive.cooldownRemainingMs >= 28500,
    `Unexpected cooldown after manual drop: ${manualDropState.snapshot.hyperdrive.cooldownRemainingMs}`);
  assert((manualDropState.sfx?.counts?.["hyperdrive-disengage"] ?? 0) >= 1, "Missing hyperdrive disengage audio cue");

  const cooldownStart = manualDropState.snapshot.hyperdrive.cooldownRemainingMs;
  await page.keyboard.down("Space");
  await page.waitForTimeout(450);
  await page.keyboard.up("Space");
  const cooldownBlockedState = await getState(page);
  assert(cooldownBlockedState.snapshot.hyperdrive.state === "cooldown", "Hyperdrive restarted during cooldown");
  assert(cooldownBlockedState.snapshot.hyperdrive.cooldownRemainingMs < cooldownStart, "Cooldown timer did not continue ticking");

  const missionPlanet = await page.evaluate(() => {
    const trackedMissionPlanet = window.__loeGame?.scene.keys.space?.getTrackedMissionPlanet?.();
    if (!trackedMissionPlanet) {
      return null;
    }

    return {
      missionId: trackedMissionPlanet.missionId,
      name: trackedMissionPlanet.name,
      x: trackedMissionPlanet.x,
      y: trackedMissionPlanet.y,
      radius: trackedMissionPlanet.radius,
    };
  });
  assert(missionPlanet, "Mission planet missing from space snapshot");

  await resetHyperdriveScenario(page, missionPlanet.x - 5200, missionPlanet.y - 1800);
  await page.mouse.move(1180, 360);
  await holdSpaceToEngage(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.damagePlayerShip?.(1, "pirate");
  });
  await page.waitForTimeout(150);
  const hostileDropState = await waitForHyperdriveState(page, "cooldown", 1200);
  await capture(page, "hyperdrive-hostile-drop.png");
  assert(/Hostile impact/i.test(hostileDropState.snapshot.hyperdrive.lastReason ?? ""),
    `Hostile damage did not interrupt hyperdrive cleanly: '${hostileDropState.snapshot.hyperdrive.lastReason}'`);

  await resetHyperdriveScenario(page, missionPlanet.x - (missionPlanet.radius + 3100), missionPlanet.y);
  await page.mouse.move(1180, 360);
  await holdSpaceToEngage(page);
  const proximityStart = Date.now();
  let waypointDropState = null;
  while ((Date.now() - proximityStart) < 4000) {
    const state = await getState(page);
    if (state.snapshot.hyperdrive.state === "cooldown") {
      waypointDropState = state;
      break;
    }
    await page.waitForTimeout(50);
  }

  assert(waypointDropState, "Hyperdrive did not auto-drop near the mission waypoint");
  await capture(page, "hyperdrive-waypoint-drop.png");
  assert(/waypoint reached|proximity alert/i.test(waypointDropState.snapshot.hyperdrive.lastReason ?? ""),
    `Unexpected waypoint drop reason '${waypointDropState.snapshot.hyperdrive.lastReason}'`);
  assert(waypointDropState.snapshot.landingReady || waypointDropState.snapshot.missionPlanet,
    "Waypoint drop did not leave the ship near the mission target");

  const summary = {
    url: URL,
    initialHyperdrive: spaceStart.snapshot.hyperdrive,
    activeHyperdrive: activeState.snapshot.hyperdrive,
    manualDrop: manualDropState.snapshot.hyperdrive,
    hostileDrop: hostileDropState.snapshot.hyperdrive,
    waypointDrop: waypointDropState.snapshot.hyperdrive,
    shipSnapshots: {
      active: activeState.snapshot.ship,
      manualDrop: manualDropState.snapshot.ship,
      hostileDrop: hostileDropState.snapshot.ship,
      waypointDrop: waypointDropState.snapshot.ship,
    },
    sfxCounts: (await getState(page)).sfx?.counts ?? {},
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
