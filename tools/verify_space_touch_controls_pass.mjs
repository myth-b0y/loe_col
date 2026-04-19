import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-touch-controls-pass");
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
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
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
    window.__loeSession?.setInputMode?.("Touch");
    window.__loeSession?.setAutoAim?.(true);
    window.__loeSession?.setAutoFire?.(true);
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await page.waitForTimeout(250);
  await capture(page, "hub-touch-start.png");

  const hubTouchHud = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      touchMode: hub?.touchMode ?? false,
      stickVisible: hub?.stickBase?.visible ?? false,
      activateVisible: hub?.activateButton?.container?.visible ?? false,
    };
  });

  assert(hubTouchHud.touchMode, "Hub scene did not resolve to touch mode in a touch-capable context");
  assert(hubTouchHud.stickVisible, "Hub touch movement stick is not visible during gameplay");

  const hubInventoryHidden = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.openDataPadTab?.("inventory");
    return {
      inventoryVisible: hub?.inventoryOverlay?.isVisible?.() ?? false,
      stickVisible: hub?.stickBase?.visible ?? true,
      activateVisible: hub?.activateButton?.container?.visible ?? true,
    };
  });
  await page.waitForTimeout(80);
  await capture(page, "hub-inventory-hidden.png");

  assert(hubInventoryHidden.inventoryVisible, "Hub inventory overlay did not open in touch mode");
  assert(!hubInventoryHidden.stickVisible, "Hub touch movement stick stayed visible under the inventory overlay");
  assert(!hubInventoryHidden.activateVisible, "Hub touch activate button stayed visible under the inventory overlay");

  const hubPanelHidden = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.inventoryOverlay?.hide?.();
    hub?.openStation?.("pilotSeat");
    return {
      panelVisible: hub?.panel?.visible ?? false,
      stickVisible: hub?.stickBase?.visible ?? true,
      activateVisible: hub?.activateButton?.container?.visible ?? true,
      panelTitle: hub?.panelTitle?.text ?? "",
    };
  });
  await page.waitForTimeout(80);
  await capture(page, "hub-pilot-panel-hidden.png");

  assert(hubPanelHidden.panelVisible, "Hub pilot seat panel did not open");
  assert(hubPanelHidden.panelTitle === "Pilot Seat", `Unexpected pilot panel title '${hubPanelHidden.panelTitle}'`);
  assert(!hubPanelHidden.stickVisible, "Hub touch movement stick stayed visible under the pilot seat panel");
  assert(!hubPanelHidden.activateVisible, "Hub touch activate button stayed visible under the pilot seat panel");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.closePanel?.();
    window.__loeSession?.startMission?.("ember-watch");
    window.__loeGame?.scene.start("mission", { missionId: "ember-watch" });
  });

  await waitForScene(page, "mission");
  await page.waitForTimeout(300);
  await capture(page, "mission-touch-start.png");

  const missionTouchHud = await page.evaluate(() => {
    const mission = window.__loeGame?.scene.keys.mission;
    return {
      touchMode: mission?.touchMode ?? false,
      moveVisible: mission?.moveBase?.visible ?? false,
      attackVisible: mission?.attackButton?.container?.visible ?? false,
      pulseVisible: mission?.pulseButton?.container?.visible ?? false,
    };
  });

  assert(missionTouchHud.touchMode, "Mission scene did not resolve to touch mode in a touch-capable context");
  assert(missionTouchHud.moveVisible, "Mission touch movement stick is not visible during gameplay");
  assert(missionTouchHud.attackVisible, "Mission touch attack button is not visible during gameplay");

  const missionInventoryHidden = await page.evaluate(() => {
    const mission = window.__loeGame?.scene.keys.mission;
    mission?.openDataPadTab?.("inventory");
    return {
      inventoryVisible: mission?.inventoryOverlay?.isVisible?.() ?? false,
      moveVisible: mission?.moveBase?.visible ?? true,
      attackVisible: mission?.attackButton?.container?.visible ?? true,
      pulseVisible: mission?.pulseButton?.container?.visible ?? true,
    };
  });
  await page.waitForTimeout(80);
  await capture(page, "mission-inventory-hidden.png");

  assert(missionInventoryHidden.inventoryVisible, "Mission inventory overlay did not open in touch mode");
  assert(!missionInventoryHidden.moveVisible, "Mission touch movement stick stayed visible under the inventory overlay");
  assert(!missionInventoryHidden.attackVisible, "Mission touch attack button stayed visible under the inventory overlay");
  assert(!missionInventoryHidden.pulseVisible, "Mission touch ability buttons stayed visible under the inventory overlay");

  await page.evaluate(() => {
    const game = window.__loeGame;
    const mission = window.__loeGame?.scene.keys.mission;
    mission?.inventoryOverlay?.hide?.();
    game?.scene.stop("mission");
    game?.scene.start("hub");
  });
  await page.waitForTimeout(200);

  await waitForScene(page, "hub");
  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("ember-watch");
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(300);
  await capture(page, "space-touch-start.png");

  const touchHud = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      touchMode: space?.getDebugSnapshot?.().touchMode ?? false,
      moveVisible: space?.moveBase?.visible ?? false,
      attackVisible: space?.attackButton?.container?.visible ?? false,
      targetVisible: space?.targetButton?.container?.visible ?? false,
      auxOneVisible: space?.abilityOneButton?.container?.visible ?? false,
      auxTwoVisible: space?.abilityTwoButton?.container?.visible ?? false,
    };
  });

  assert(touchHud.touchMode, "Space scene did not resolve to touch mode in a touch-capable context");
  assert(touchHud.moveVisible, "Space touch movement stick is not visible");
  assert(touchHud.attackVisible, "Space touch attack button is not visible");
  assert(touchHud.targetVisible, "Space touch target button is not visible");
  assert(touchHud.auxOneVisible && touchHud.auxTwoVisible, "Space touch ability placeholders are not visible");

  const spaceInventoryHidden = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.openDataPadTab?.("inventory");
    return {
      inventoryVisible: space?.inventoryOverlay?.isVisible?.() ?? false,
      moveVisible: space?.moveBase?.visible ?? true,
      attackVisible: space?.attackButton?.container?.visible ?? true,
      targetVisible: space?.targetButton?.container?.visible ?? true,
      auxOneVisible: space?.abilityOneButton?.container?.visible ?? true,
      auxTwoVisible: space?.abilityTwoButton?.container?.visible ?? true,
    };
  });
  await page.waitForTimeout(80);
  await capture(page, "space-inventory-hidden.png");

  assert(spaceInventoryHidden.inventoryVisible, "Space inventory overlay did not open in touch mode");
  assert(!spaceInventoryHidden.moveVisible, "Space touch movement stick stayed visible under the inventory overlay");
  assert(!spaceInventoryHidden.attackVisible, "Space touch attack button stayed visible under the inventory overlay");
  assert(!spaceInventoryHidden.targetVisible, "Space touch target button stayed visible under the inventory overlay");
  assert(!spaceInventoryHidden.auxOneVisible && !spaceInventoryHidden.auxTwoVisible, "Space touch ability placeholders stayed visible under the inventory overlay");

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.inventoryOverlay?.hide?.();
  });
  await page.waitForTimeout(80);

  const shipBeforeMove = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      x: space?.shipRoot?.x ?? 0,
      y: space?.shipRoot?.y ?? 0,
    };
  });

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const pointer = { id: 1, x: 184, y: 560, isDown: true };
    space.movePointerId = 1;
    space.anchorMoveStick(pointer.x, pointer.y);
    space.updateMoveStick(pointer);
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.updateMoveStick({ id: 1, x: 266, y: 498, isDown: true });
  });
  await page.waitForTimeout(420);

  const shipAfterMove = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      x: space?.shipRoot?.x ?? 0,
      y: space?.shipRoot?.y ?? 0,
      vx: space?.shipVelocity?.x ?? 0,
      vy: space?.shipVelocity?.y ?? 0,
      aimX: space?.aimDirection?.x ?? 0,
      aimY: space?.aimDirection?.y ?? 0,
      touchAttackHeld: space?.attackPointerId !== null,
    };
  });

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.movePointerId = null;
    space.touchMoveVector.set(0, 0);
    space.resetMoveStick();
  });
  await page.waitForTimeout(100);

  assert(
    Math.abs(shipAfterMove.x - shipBeforeMove.x) > 6 || Math.abs(shipAfterMove.y - shipBeforeMove.y) > 6,
    `Touch stick did not move the ship: before=${JSON.stringify(shipBeforeMove)} after=${JSON.stringify(shipAfterMove)}`,
  );
  assert(
    Math.abs(shipAfterMove.vx) > 10 || Math.abs(shipAfterMove.vy) > 10,
    `Touch stick did not generate ship velocity: ${JSON.stringify(shipAfterMove)}`,
  );
  assert(
    Math.abs(shipAfterMove.aimX) > 0.1 || Math.abs(shipAfterMove.aimY) > 0.1,
    `Touch stick did not update ship facing: ${JSON.stringify(shipAfterMove)}`,
  );
  assert(!shipAfterMove.touchAttackHeld, "Movement touch incorrectly latched the attack state");

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.shots.forEach((shot) => {
      shot.sprite.destroy();
      shot.glow.destroy();
    });
    space.shots = [];
    space.fireHeld = false;
    space.attackPointerId = null;
    space.fireCooldown = 0;
  });

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.beginTouchAttack({ id: 2 });
  });
  await page.waitForTimeout(220);
  const attackDuringHold = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return {
      shots: space?.shots?.length ?? 0,
      touchAttackHeld: space?.attackPointerId !== null,
    };
  });
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.endTouchAttack({ id: 2 });
  });
  await page.waitForTimeout(80);

  assert(attackDuringHold.touchAttackHeld, "Touch attack button did not latch held-fire state while pressed");
  assert(attackDuringHold.shots > 0, "Touch attack button did not fire in space");

  const autoAimDisabled = await page.evaluate(async () => {
    const space = window.__loeGame?.scene.keys.space;
    const empire = space?.factionShips?.find((ship) => ship.factionId === "empire");
    if (!space || !empire) {
      return null;
    }

    space.factionShips.forEach((ship, index) => {
      ship.root.x = space.shipRoot.x + 1800 + (index * 80);
      ship.root.y = space.shipRoot.y + 1400;
      ship.velocity.set(0, 0);
    });
    empire.root.x = space.shipRoot.x + 220;
    empire.root.y = space.shipRoot.y - 20;
    empire.velocity.set(0, 0);
    space.shipVelocity.set(0, 0);
    space.fireHeld = false;
    space.attackPointerId = null;
    space.selectedTarget = null;
    space.autoAimTarget = null;
    space.shots.forEach((shot) => {
      shot.sprite.destroy();
      shot.glow.destroy();
    });
    space.shots = [];
    space.fireCooldown = 0;
    window.__loeSession?.setAutoAim?.(false);
    window.__loeSession?.setAutoFire?.(false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      autoAimTarget: space.autoAimTarget,
      playerShots: space.shots.filter((shot) => shot.ownerKind === "player").length,
    };
  });

  assert(autoAimDisabled?.autoAimTarget === null, "Space still acquired an auto-aim target with auto aim disabled");
  assert(autoAimDisabled?.playerShots === 0, "Space fired player shots with both auto aim and auto fire disabled");

  const autoAimOnly = await page.evaluate(async () => {
    const space = window.__loeGame?.scene.keys.space;
    const empire = space?.factionShips?.find((ship) => ship.factionId === "empire");
    if (!space || !empire) {
      return null;
    }

    space.factionShips.forEach((ship, index) => {
      ship.root.x = space.shipRoot.x + 1800 + (index * 80);
      ship.root.y = space.shipRoot.y + 1400;
      ship.velocity.set(0, 0);
    });
    empire.root.x = space.shipRoot.x + 220;
    empire.root.y = space.shipRoot.y - 20;
    empire.velocity.set(0, 0);
    space.shipVelocity.set(0, 0);
    space.fireHeld = false;
    space.attackPointerId = null;
    space.selectedTarget = null;
    space.autoAimTarget = null;
    space.shots.forEach((shot) => {
      shot.sprite.destroy();
      shot.glow.destroy();
    });
    space.shots = [];
    space.fireCooldown = 0;
    window.__loeSession?.setAutoAim?.(true);
    window.__loeSession?.setAutoFire?.(false);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      autoAimTargetKind: space.autoAimTarget?.kind ?? null,
      autoAimFaction: space.autoAimTarget?.kind === "ship" ? space.autoAimTarget.ship.factionId : null,
      playerShots: space.shots.filter((shot) => shot.ownerKind === "player").length,
    };
  });

  assert(autoAimOnly?.autoAimTargetKind === "ship", "Space did not acquire a hostile ship target with auto aim enabled");
  assert(autoAimOnly?.autoAimFaction === "empire", `Unexpected auto-aim ship target ${JSON.stringify(autoAimOnly)}`);
  assert(autoAimOnly?.playerShots === 0, "Space auto-fired player shots with auto fire disabled");

  const autoAimFire = await page.evaluate(async () => {
    const space = window.__loeGame?.scene.keys.space;
    const empire = space?.factionShips?.find((ship) => ship.factionId === "empire");
    if (!space || !empire) {
      return null;
    }

    space.factionShips.forEach((ship, index) => {
      ship.root.x = space.shipRoot.x + 1800 + (index * 80);
      ship.root.y = space.shipRoot.y + 1400;
      ship.velocity.set(0, 0);
    });
    empire.root.x = space.shipRoot.x + 220;
    empire.root.y = space.shipRoot.y - 20;
    empire.velocity.set(0, 0);
    space.shipVelocity.set(0, 0);
    space.fireHeld = false;
    space.attackPointerId = null;
    space.selectedTarget = null;
    space.autoAimTarget = null;
    space.shots.forEach((shot) => {
      shot.sprite.destroy();
      shot.glow.destroy();
    });
    space.shots = [];
    space.fireCooldown = 0;
    window.__loeSession?.setAutoAim?.(true);
    window.__loeSession?.setAutoFire?.(true);
    await new Promise((resolve) => setTimeout(resolve, 320));
    return {
      autoAimTargetKind: space.autoAimTarget?.kind ?? null,
      playerShots: space.shots.filter((shot) => shot.ownerKind === "player").length,
      hostileShipHp: empire.hp,
    };
  });

  assert(autoAimFire?.autoAimTargetKind === "ship", "Space lost the hostile ship lock with auto aim and auto fire enabled");
  assert(autoAimFire?.playerShots > 0, "Space did not auto-fire with both auto aim and auto fire enabled");

  await capture(page, "space-touch-verified.png");

  const summary = {
    url: URL,
    hubTouchHud,
    hubInventoryHidden,
    hubPanelHidden,
    missionTouchHud,
    missionInventoryHidden,
    touchHud,
    spaceInventoryHidden,
    shipBeforeMove,
    shipAfterMove,
    attackDuringHold,
    autoAimDisabled,
    autoAimOnly,
    autoAimFire,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
