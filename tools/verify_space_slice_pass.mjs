import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-slice-pass");
const URL = "http://127.0.0.1:4173/?renderer=canvas";

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

async function moveWithKeys(page, keys, durationMs) {
  for (const key of keys) {
    await page.keyboard.down(key);
  }
  await page.waitForTimeout(durationMs);
  for (const key of [...keys].reverse()) {
    await page.keyboard.up(key);
  }
}

function pickTarget(state) {
  const ship = state.snapshot.ship;
  const objects = state.snapshot.nearestFieldObjects ?? [];
  const enriched = objects.map((object) => {
    const dx = object.x - ship.x;
    const dy = object.y - ship.y;
    return {
      ...object,
      dx,
      dy,
      dist: Math.hypot(dx, dy),
      visible: Math.abs(dx) <= 520 && Math.abs(dy) <= 300,
    };
  });

  return enriched.find((object) => object.visible && object.dist <= 1050)
    ?? enriched.find((object) => object.dist <= 1050)
    ?? enriched[0]
    ?? null;
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
    window.__loeGame?.scene.start("hub");
  });

  const hubState = await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  const pilotSeatInfo = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    if (!hub) {
      return null;
    }

    hub.player.setPosition(640, 176);
    hub.updateNearestStation?.();
    hub.updateInteractionTarget?.();
    hub.updatePrompt?.();

    return {
      nearestStation: hub.nearestStation?.id ?? null,
      currentInteraction: hub.currentInteraction?.station?.id ?? null,
      prompt: hub.promptText?.text ?? "",
    };
  });

  assert(pilotSeatInfo?.nearestStation === "pilotSeat", `Expected nearest station pilotSeat, got ${pilotSeatInfo?.nearestStation}`);

  await page.keyboard.press("e");
  await page.waitForTimeout(250);

  const pilotPanel = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      visible: hub?.panel?.visible ?? false,
      title: hub?.panelTitle?.text ?? "",
      actionLabel: hub?.panelAction?.label?.text ?? "",
    };
  });

  assert(pilotPanel.visible, "Pilot seat panel did not open");
  assert(pilotPanel.title === "Pilot Seat", `Unexpected pilot panel title '${pilotPanel.title}'`);
  assert(pilotPanel.actionLabel === "Launch Into Space", `Unexpected pilot action label '${pilotPanel.actionLabel}'`);
  await capture(page, "hub-pilot-panel.png");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });

  const spaceStart = await waitForScene(page, "space");
  await page.waitForTimeout(300);
  await capture(page, "space-start.png");

  const cameraLock = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    const camera = space.cameras.main;
    const centerX = camera.scrollX + (camera.width * 0.5);
    const centerY = camera.scrollY + (camera.height * 0.5);
    return {
      shipX: Math.round(space.shipRoot.x),
      shipY: Math.round(space.shipRoot.y),
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      deltaX: Math.round(centerX - space.shipRoot.x),
      deltaY: Math.round(centerY - space.shipRoot.y),
    };
  });

  assert(cameraLock && Math.abs(cameraLock.deltaX) <= 2 && Math.abs(cameraLock.deltaY) <= 2,
    `Camera is not centered on ship: ${JSON.stringify(cameraLock)}`);

  const movementBefore = spaceStart.snapshot.ship;
  await page.mouse.move(980, 220);
  await moveWithKeys(page, ["KeyD", "KeyW"], 650);
  await page.waitForTimeout(250);
  const movementAfterState = await getState(page);
  const movementAfter = movementAfterState.snapshot.ship;
  const movedDistance = Math.hypot(movementAfter.x - movementBefore.x, movementAfter.y - movementBefore.y);

  assert(movedDistance >= 40, `Ship movement too small: ${movedDistance}`);
  assert(Math.abs(movementAfter.vx) > 0 || Math.abs(movementAfter.vy) > 0, "Ship velocity did not update during movement test");

  let destroyedVerified = false;
  let fireVerified = false;
  let targetUsed = null;

  for (let attempt = 0; attempt < 7 && !destroyedVerified; attempt += 1) {
    const state = await getState(page);
    const target = pickTarget(state);
    assert(target, "No nearby asteroid/debris target available for shooting test");

    if (!target.visible) {
      const keys = [];
      if (target.dx > 70) keys.push("KeyD");
      if (target.dx < -70) keys.push("KeyA");
      if (target.dy > 70) keys.push("KeyS");
      if (target.dy < -70) keys.push("KeyW");
      if (keys.length > 0) {
        await moveWithKeys(page, keys, 420);
        await page.waitForTimeout(180);
        continue;
      }
    }

    targetUsed = target;
    const aimX = 640 + target.dx;
    const aimY = 360 + target.dy;
    await page.mouse.move(aimX, aimY);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(300);

    const afterBurst = await getState(page);
    fireVerified = fireVerified || afterBurst.snapshot.activeShots > 0 || afterBurst.snapshot.destroyedObjects > 0;
    destroyedVerified = afterBurst.snapshot.destroyedObjects >= 1;
  }

  assert(fireVerified, "Ship firing did not register");
  assert(destroyedVerified, `No asteroid/debris was destroyed. Last target: ${JSON.stringify(targetUsed)}`);
  const postCombatState = await getState(page);
  await capture(page, "space-combat.png");

  const returnControl = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      returnReady: !space?.returningToShip,
      label: space?.returnButton?.label?.text ?? "",
    };
  });

  assert(returnControl.returnReady, "Space return control is not ready");
  assert(returnControl.label === "Return To Ship", `Unexpected return label '${returnControl.label}'`);

  await page.mouse.click(1170, 44);
  await page.waitForTimeout(400);
  const returnedHubState = await waitForScene(page, "hub");
  await capture(page, "hub-returned.png");

  const summary = {
    url: URL,
    scenesVerified: ["hub", "space", "hub"],
    hubStart: hubState.snapshot,
    pilotSeatInfo,
    pilotPanel,
    spaceStart: spaceStart.snapshot,
    cameraLock,
    movementBefore,
    movementAfter,
    movedDistance: Math.round(movedDistance),
    postCombat: {
      destroyedObjects: postCombatState.snapshot.destroyedObjects,
      asteroidsRemaining: postCombatState.snapshot.asteroidsRemaining,
      activeShots: postCombatState.snapshot.activeShots,
    },
    returnedHub: returnedHubState.snapshot,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}




