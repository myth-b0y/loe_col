import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-radar-pass");
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

async function getSpaceSeeds(page) {
  return page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    const factionSeeds = space.worldDefinition?.factionSeeds ?? [];
    const pickSeed = (factionId) => factionSeeds.find((seed) => seed.factionId === factionId) ?? null;
    return {
      enemy: pickSeed("pirate"),
      friendly: pickSeed("republic"),
      neutral: pickSeed("smuggler"),
      missionPlanet: state.snapshot?.missionPlanet ?? null,
    };
  });
}

async function focusOnContact(page, contact, filename, freezeTarget = true) {
  const result = await page.evaluate(({ contact, freezeTarget }) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space || !contact) {
      return null;
    }

    const offsetX = -1200;
    const offsetY = 480;
    const playerX = Math.round(contact.x + offsetX);
    const playerY = Math.round(contact.y + offsetY);

    space.shipRoot.setPosition(playerX, playerY);
    space.shipVelocity.set(0, 0);
    space.playerHull = 999;
    space.playerFlash = 0;
    space.playerDestroyed = false;
    space.returningToShip = false;
    if (space.hyperdrive) {
      space.hyperdrive.state = "normal";
      space.hyperdrive.chargeElapsedMs = 0;
      space.hyperdrive.cooldownRemainingMs = 0;
      space.hyperdrive.exitBlendRemainingMs = 0;
      space.hyperdrive.lastDisengageReason = null;
    }
    if (Array.isArray(space.shots)) {
      space.shots.forEach((shot) => {
        shot.sprite.destroy();
        shot.glow.destroy();
      });
      space.shots.length = 0;
    }
    if (Array.isArray(space.burstParticles)) {
      space.burstParticles.forEach((particle) => particle.sprite.destroy());
      space.burstParticles.length = 0;
    }
    window.__loeSession?.setShipSpacePosition?.(playerX, playerY);
    space.cameras.main.centerOn(playerX, playerY);
    space.syncActiveWorld?.(true);

    const freezeRadiusSq = 4200 * 4200;
    space.factionShips.forEach((ship) => {
      const dx = ship.root.x - playerX;
      const dy = ship.root.y - playerY;
      if ((dx * dx) + (dy * dy) <= freezeRadiusSq) {
        ship.velocity.set(0, 0);
        ship.patrolTarget.set(ship.root.x, ship.root.y);
        ship.fireCooldown = Math.max(ship.fireCooldown, 999);
        ship.aggressionTimer = 0;
        ship.provokedByPlayer = false;
        ship.provokedByShips.clear();
      }
    });

    if (freezeTarget) {
      const targetShip = space.factionShips.find((ship) => ship.id === contact.id);
      if (targetShip) {
        targetShip.velocity.set(0, 0);
        targetShip.patrolTarget.set(targetShip.root.x, targetShip.root.y);
        targetShip.fireCooldown = Math.max(targetShip.fireCooldown, 999);
        targetShip.aggressionTimer = 0;
        targetShip.provokedByPlayer = false;
        targetShip.provokedByShips.clear();
      }
    }

    if (freezeTarget && contact.kind === "asteroid") {
      const targetField = space.asteroids.find((fieldObject) => fieldObject.id === contact.id);
      if (targetField) {
        targetField.velocity.set(0, 0);
        targetField.spin = 0;
      }
    }

    space.refreshHud?.();
    return {
      ship: { x: Math.round(space.shipRoot.x), y: Math.round(space.shipRoot.y) },
      contact,
    };
  }, { contact, freezeTarget });

  if (!result) {
    throw new Error(`Could not focus radar on contact: ${JSON.stringify(contact)}`);
  }

  await page.waitForTimeout(2100);
  await capture(page, filename);
  return result;
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

  await waitForScene(page, "space");
  await page.waitForTimeout(320);
  await capture(page, "space-radar-start.png");

  const localRadarState = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return {
      snapshot: state.snapshot ?? null,
      radar: state.snapshot?.radar ?? null,
    };
  });

  assert(localRadarState.radar, "Radar state was missing from the space snapshot");
  assert(localRadarState.radar.trackedContacts > 0, "Radar did not track any local contacts");
  assert(localRadarState.radar.contacts.some((contact) => contact.kind === "asteroid"),
    `Radar did not report an asteroid contact: ${JSON.stringify(localRadarState.radar.contacts)}`);

  const spaceSeeds = await getSpaceSeeds(page);
  assert(spaceSeeds, "Could not read space seed data for radar verification");

  const enemyMoveState = await focusOnContact(page, spaceSeeds.enemy, "space-radar-enemy.png");
  const enemyRadarState = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return state.snapshot?.radar ?? null;
  });
  assert(enemyMoveState, "Enemy ship state was not available for radar verification");
  assert(enemyRadarState, "Radar state was missing after moving near an enemy ship");
  assert(enemyRadarState.contacts.some((contact) => contact.kind === "enemy-ship"),
    `Radar did not report an enemy ship contact: ${JSON.stringify(enemyRadarState.contacts)}`);

  const friendlyMoveState = await focusOnContact(page, spaceSeeds.friendly, "space-radar-friendly.png");
  const friendlyRadarState = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return state.snapshot?.radar ?? null;
  });
  assert(friendlyMoveState, "Friendly ship state was not available for radar verification");
  assert(friendlyRadarState, "Radar state was missing after moving near a friendly ship");
  assert(friendlyRadarState.contacts.some((contact) => contact.kind === "friendly-ship" || contact.kind === "neutral-ship"),
    `Radar did not report a friendly or neutral ship contact: ${JSON.stringify(friendlyRadarState.contacts)}`);

  const neutralMoveState = await focusOnContact(page, spaceSeeds.neutral, "space-radar-neutral.png");
  const neutralRadarState = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return state.snapshot?.radar ?? null;
  });
  assert(neutralMoveState, "Neutral ship state was not available for radar verification");
  assert(neutralRadarState, "Radar state was missing after moving near a neutral ship");
  assert(neutralRadarState.contacts.some((contact) => contact.kind === "neutral-ship"),
    `Radar did not report a neutral ship contact: ${JSON.stringify(neutralRadarState.contacts)}`);

  const missionPlanetMoveState = await focusOnContact(page, {
    id: `mission:${spaceSeeds.missionPlanet?.missionId ?? "unknown"}`,
    kind: "mission-planet",
    label: spaceSeeds.missionPlanet?.name ?? "Mission Planet",
    x: spaceSeeds.missionPlanet?.x ?? 0,
    y: spaceSeeds.missionPlanet?.y ?? 0,
    radius: spaceSeeds.missionPlanet?.radius ?? 0,
    color: spaceSeeds.missionPlanet?.color ?? 0xffffff,
  }, "space-radar-mission.png", false);
  const missionRadarState = await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return state.snapshot?.radar ?? null;
  });
  assert(missionPlanetMoveState, "Mission planet state was not available for radar verification");
  assert(missionRadarState, "Radar state was missing after moving near the mission planet");
  assert(missionRadarState.contacts.some((contact) => contact.kind === "mission-planet"),
    `Radar did not report the mission planet contact: ${JSON.stringify(missionRadarState.contacts)}`);

  const sweepBefore = localRadarState.radar.sweepAngleDeg;
  const sweepAfter = missionRadarState.sweepAngleDeg;
  assert(sweepBefore !== sweepAfter, `Radar sweep did not move between snapshots: ${sweepBefore} vs ${sweepAfter}`);

  const result = {
    url: URL,
    localRadarState,
    spaceSeeds,
    enemyMoveState,
    enemyRadarState,
    friendlyMoveState,
    friendlyRadarState,
    neutralMoveState,
    neutralRadarState,
    missionPlanetMoveState,
    missionRadarState,
    consoleErrors,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
