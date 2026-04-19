import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/galaxy-scale-pass");
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

function getOffsetDistance(point, centerX, centerY) {
  return Math.hypot(point.x - centerX, point.y - centerY);
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
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(280);
  await capture(page, "space-olydran-start.png");

  const defaultSnapshot = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      shipPosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
      playerRaceId: window.__loeSession?.getPlayerRaceId?.() ?? null,
    };
  });

  const world = defaultSnapshot.snapshot?.world;
  const ship = defaultSnapshot.snapshot?.ship;
  assert(world?.width >= 78000 && world?.height >= 78000, `World scale is still too small: ${JSON.stringify(world)}`);
  assert(world?.galaxyRadius >= 28000, `Galaxy radius did not scale up enough: ${JSON.stringify(world)}`);
  assert(world?.restrictedCoreRadius >= 6000, `Restricted core radius is smaller than expected: ${JSON.stringify(world)}`);
  assert(world.width > (world.galaxyRadius * 2) + 10000, `Deep-space margin is too small for the larger galaxy: ${JSON.stringify(world)}`);

  const centerX = world.width * 0.5;
  const centerY = world.height * 0.5;
  const spawnDistance = getOffsetDistance(ship, centerX, centerY);
  assert(spawnDistance >= 12000, `Player still spawned too close to the map center: ${JSON.stringify(ship)}`);
  assert(defaultSnapshot.playerRaceId === "olydran", `Unexpected default player race '${defaultSnapshot.playerRaceId}'`);
  assert(defaultSnapshot.snapshot?.sector === "Olydran Expanse",
    `Default spawn did not land in the player's race sector: ${JSON.stringify(defaultSnapshot.snapshot)}`);

  const ashariSpawn = await page.evaluate(() => {
    window.__loeSession.saveData.profile.raceId = "ashari";
    const spawn = window.__loeSession?.resetShipSpacePosition?.();
    const space = window.__loeGame?.scene.keys.space;
    if (space && spawn) {
      space.shipRoot.x = spawn.x;
      space.shipRoot.y = spawn.y;
      space.shipVelocity.set(0, 0);
      space.refreshHud?.();
    }
    return {
      spawn,
      snapshot: space?.getDebugSnapshot?.() ?? null,
    };
  });

  await page.waitForTimeout(120);
  await capture(page, "space-ashari-spawn.png");

  assert(ashariSpawn.snapshot?.playerRaceId === "ashari", `Race override did not stick: ${JSON.stringify(ashariSpawn.snapshot)}`);
  assert(ashariSpawn.snapshot?.sector === "Ashari Crown",
    `Race-based spawn did not move to the matching sector: ${JSON.stringify(ashariSpawn.snapshot)}`);

  const coreRestriction = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const snapshot = space?.getDebugSnapshot?.() ?? null;
    if (!space || !snapshot?.world) {
      return null;
    }

    const centerX = snapshot.world.width * 0.5;
    const centerY = snapshot.world.height * 0.5;
    space.shipRoot.x = centerX;
    space.shipRoot.y = centerY;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(centerX, centerY);

    return {
      before: { x: centerX, y: centerY },
      restrictedCoreRadius: snapshot.world.restrictedCoreRadius,
    };
  });

  await page.waitForTimeout(220);
  await capture(page, "space-core-block.png");

  const coreAfter = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      snapshot: space?.getDebugSnapshot?.() ?? null,
      shipPosition: window.__loeSession?.getShipSpacePosition?.() ?? null,
    };
  });

  const pushedShip = coreAfter.snapshot?.ship;
  const pushedDistance = getOffsetDistance(pushedShip, centerX, centerY);
  assert(
    pushedDistance >= (coreRestriction?.restrictedCoreRadius ?? 0) - 8,
    `Ship was not pushed back out of the restricted core: ${JSON.stringify({ coreRestriction, pushedShip, pushedDistance })}`,
  );

  const summary = {
    url: URL,
    defaultSnapshot,
    ashariSpawn,
    coreRestriction,
    coreAfter,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}
