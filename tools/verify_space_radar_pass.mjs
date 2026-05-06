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

async function getRadarSnapshot(page) {
  return page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    return state.snapshot?.radar ?? null;
  });
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

async function getSpaceSeeds(page) {
  return page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() ?? "{}");
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    const factionSeeds = space.worldDefinition?.factionSeeds ?? [];
    const fieldSeeds = space.worldDefinition?.fieldSeeds ?? [];
    const liveShips = space.factionShips ?? [];
    const galaxy = window.__loeSession?.getGalaxyDefinition?.() ?? null;
    const debug = space.getDebugSnapshot?.() ?? null;
    const pickSeed = (factionId) => factionSeeds.find((seed) => seed.factionId === factionId) ?? null;
    const pickLiveShip = (factionId) => {
      const liveShip = liveShips.find((ship) => ship.factionId === factionId) ?? null;
      if (!liveShip) {
        return null;
      }

      const palette = liveShip.customColor ?? liveShip.root?.first?.fillColor ?? 0xffffff;
      return {
        id: liveShip.id,
        factionId: liveShip.factionId,
        x: liveShip.root.x,
        y: liveShip.root.y,
        radius: liveShip.radius,
        color: palette,
      };
    };
    const homeworld = galaxy?.homeworlds?.[0] ?? null;
    const homeSystem = galaxy?.systems?.find?.((system) => system.id === homeworld?.systemId) ?? null;
    const homeworldAlignment = homeworld?.raceId ? debug?.war?.alignments?.[homeworld.raceId] ?? "neutral" : "neutral";
    const homeGuardFactionId = homeworldAlignment === "empire"
      ? "empire"
      : homeworldAlignment === "republic"
        ? "republic"
        : "homeguard";
    return {
      enemy: pickLiveShip("pirate") ?? pickSeed("pirate"),
      guard: pickLiveShip(homeGuardFactionId) ?? pickSeed(homeGuardFactionId),
      homeGuardFactionId,
      neutral: pickLiveShip("smuggler") ?? pickSeed("smuggler"),
      asteroid: fieldSeeds.find((seed) => seed.kind === "asteroid") ?? null,
      largeAsteroid: fieldSeeds.find((seed) => seed.kind === "asteroid" && seed.isLarge) ?? null,
      homeSystem,
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

    const offsetX = -760;
    const offsetY = 260;
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

    const cellSize = 3200;
    const nextCellKey = `${Math.max(0, Math.floor(contact.x / cellSize))},${Math.max(0, Math.floor(contact.y / cellSize))}`;

    const shipState = space.shipStates?.get?.(contact.id) ?? null;
    if (shipState) {
      shipState.x = contact.x;
      shipState.y = contact.y;
      shipState.velocityX = 0;
      shipState.velocityY = 0;
      shipState.patrolX = contact.x;
      shipState.patrolY = contact.y;
      shipState.destroyed = false;
      shipState.cellKey = nextCellKey;
    }

    const fieldState = space.fieldStates?.get?.(contact.id) ?? null;
    if (fieldState) {
      fieldState.x = contact.x;
      fieldState.y = contact.y;
      fieldState.velocityX = 0;
      fieldState.velocityY = 0;
      fieldState.destroyed = false;
      fieldState.cellKey = nextCellKey;
    }

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
      const targetShip = space.factionShips.find((ship) => ship.id === contact.id)
        ?? (
          typeof contact.factionId === "string"
            ? space.factionShips.find((ship) => ship.factionId === contact.factionId)
            : null
        );
      if (targetShip) {
        targetShip.root.setPosition(contact.x, contact.y);
        targetShip.velocity.set(0, 0);
        targetShip.patrolTarget.set(contact.x, contact.y);
        targetShip.fireCooldown = Math.max(targetShip.fireCooldown, 999);
        targetShip.aggressionTimer = 0;
        targetShip.provokedByPlayer = false;
        targetShip.provokedByShips.clear();
        const targetShipState = space.shipStates?.get?.(targetShip.id) ?? null;
        if (targetShipState) {
          targetShipState.x = contact.x;
          targetShipState.y = contact.y;
          targetShipState.velocityX = 0;
          targetShipState.velocityY = 0;
          targetShipState.patrolX = contact.x;
          targetShipState.patrolY = contact.y;
          targetShipState.destroyed = false;
          targetShipState.cellKey = nextCellKey;
        }
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

  await page.waitForTimeout(900);
  await capture(page, filename);
  return result;
}

async function focusOnFactionShip(page, factionId, filename, anchor = null) {
  const result = await page.evaluate(({ factionId, anchor }) => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return null;
    }

    const targetState = [...(space.shipStates?.values?.() ?? [])]
      .find((state) => state.factionId === factionId && !state.destroyed)
      ?? null;
    if (!targetState) {
      return null;
    }

    const targetX = anchor?.x ?? targetState.x;
    const targetY = anchor?.y ?? targetState.y;
    const playerX = Math.round(targetX - 260);
    const playerY = Math.round(targetY + 80);
    const cellSize = 3200;
    const nextCellKey = `${Math.max(0, Math.floor(targetX / cellSize))},${Math.max(0, Math.floor(targetY / cellSize))}`;

    space.shipRoot.setPosition(playerX, playerY);
    space.shipVelocity.set(0, 0);
    space.playerHull = 999;
    space.playerFlash = 0;
    space.playerDestroyed = false;
    space.returningToShip = false;

    targetState.x = targetX;
    targetState.y = targetY;
    targetState.velocityX = 0;
    targetState.velocityY = 0;
    targetState.patrolX = targetX;
    targetState.patrolY = targetY;
    targetState.destroyed = false;
    targetState.cellKey = nextCellKey;

    window.__loeSession?.setShipSpacePosition?.(playerX, playerY);
    space.cameras.main.centerOn(playerX, playerY);
    space.syncActiveWorld?.(true);

    const liveShip = space.factionShips.find((ship) => ship.id === targetState.id)
      ?? space.factionShips.find((ship) => ship.factionId === factionId)
      ?? null;
    if (!liveShip) {
      return null;
    }

    liveShip.root.setPosition(targetX, targetY);
    liveShip.velocity.set(0, 0);
    liveShip.patrolTarget.set(targetX, targetY);
    liveShip.fireCooldown = Math.max(liveShip.fireCooldown, 999);
    liveShip.aggressionTimer = 0;
    liveShip.provokedByPlayer = false;
    liveShip.provokedByShips.clear();

    const liveShipState = space.shipStates?.get?.(liveShip.id) ?? null;
    if (liveShipState) {
      liveShipState.x = targetX;
      liveShipState.y = targetY;
      liveShipState.velocityX = 0;
      liveShipState.velocityY = 0;
      liveShipState.patrolX = targetX;
      liveShipState.patrolY = targetY;
      liveShipState.destroyed = false;
      liveShipState.cellKey = nextCellKey;
    }

    space.refreshHud?.();
    return {
      factionId,
      shipId: liveShip.id,
      targetX: Math.round(targetX),
      targetY: Math.round(targetY),
      playerX: Math.round(playerX),
      playerY: Math.round(playerY),
    };
  }, { factionId, anchor });

  if (!result) {
    throw new Error(`Could not focus radar on faction ship: ${factionId}`);
  }

  await page.waitForTimeout(400);
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
    window.__loeSession?.acceptMission?.("test-chain-dispatch");
    window.__loeSession?.setSelectedMission?.("test-chain-dispatch");
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.("test-chain-dispatch");
  });

  await waitForScene(page, "space");
  await page.waitForTimeout(320);
  await capture(page, "space-radar-start.png");

  const localRadarState = {
    snapshot: await getState(page),
    radar: await getRadarSnapshot(page),
  };

  assert(localRadarState.radar, "Radar state was missing from the space snapshot");
  assert(localRadarState.radar.range === 1880,
    `Radar range drifted from the tuned value: ${JSON.stringify(localRadarState.radar)}`);

  const initialSpaceSeeds = await getSpaceSeeds(page);
  assert(initialSpaceSeeds, "Could not read space seed data for radar verification");
  assert(initialSpaceSeeds.asteroid, "Could not resolve an asteroid seed for radar verification");
  assert(initialSpaceSeeds.homeSystem, "Could not resolve a generated home system for radar verification");
  assert(initialSpaceSeeds.missionPlanet, "Could not resolve a tracked mission world for radar verification");

  const asteroidMoveState = await focusOnContact(page, initialSpaceSeeds.asteroid, "space-radar-asteroid.png");
  const asteroidRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "asteroid")
  ));
  assert(asteroidMoveState, "Asteroid state was not available for radar verification");
  assert(asteroidRadarState.contacts.some((contact) => contact.kind === "asteroid"),
    `Radar did not report an asteroid contact after moving into a field: ${JSON.stringify(asteroidRadarState.contacts)}`);

  const enemyMoveState = await focusOnFactionShip(page, "pirate", "space-radar-enemy.png");
  const enemyRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "enemy-ship")
  ));
  assert(enemyMoveState, "Enemy ship state was not available for radar verification");
  assert(enemyRadarState, "Radar state was missing after moving near an enemy ship");
  assert(enemyRadarState.contacts.some((contact) => contact.kind === "enemy-ship"),
    `Radar did not report an enemy ship contact: ${JSON.stringify(enemyRadarState.contacts)}`);

  const guardMoveState = await focusOnFactionShip(
    page,
    initialSpaceSeeds.homeGuardFactionId,
    "space-radar-homeguard.png",
    initialSpaceSeeds.homeSystem
      ? { x: initialSpaceSeeds.homeSystem.x, y: initialSpaceSeeds.homeSystem.y }
      : null,
  );
  const guardRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "friendly-ship")
      && radar.contacts.some((contact) => contact.kind === "star")
  ));
  assert(guardMoveState, "Homeguard ship state was not available for radar verification");
  assert(guardRadarState, "Radar state was missing after moving near a homeguard ship");
  assert(guardRadarState.contacts.some((contact) => contact.kind === "friendly-ship"),
    `Radar did not report a friendly homeguard contact: ${JSON.stringify(guardRadarState.contacts)}`);
  assert(guardRadarState.contacts.some((contact) => contact.kind === "star"),
    `Radar did not report a star contact near the home system: ${JSON.stringify(guardRadarState.contacts)}`);
  assert(guardRadarState.contacts.every((contact) => contact.kind !== "planet"),
    `Radar should not show ordinary planets near a home system: ${JSON.stringify(guardRadarState.contacts)}`);

  const neutralMoveState = await focusOnFactionShip(page, "smuggler", "space-radar-neutral.png");
  const neutralRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "neutral-ship")
  ));
  assert(neutralMoveState, "Neutral ship state was not available for radar verification");
  assert(neutralRadarState, "Radar state was missing after moving near a neutral ship");
  assert(neutralRadarState.contacts.some((contact) => contact.kind === "neutral-ship"),
    `Radar did not report a neutral ship contact: ${JSON.stringify(neutralRadarState.contacts)}`);

  const missionPlanetMoveState = await focusOnContact(page, {
    id: `mission:${initialSpaceSeeds.missionPlanet?.missionId ?? "unknown"}`,
    kind: "mission-planet",
    label: initialSpaceSeeds.missionPlanet?.name ?? "Mission Planet",
    x: initialSpaceSeeds.missionPlanet?.x ?? 0,
    y: initialSpaceSeeds.missionPlanet?.y ?? 0,
    radius: initialSpaceSeeds.missionPlanet?.radius ?? 0,
    color: initialSpaceSeeds.missionPlanet?.color ?? 0xffffff,
  }, "space-radar-mission.png", false);
  const missionRadarState = await waitForRadarContact(page, (radar) => (
    radar.contacts.some((contact) => contact.kind === "mission-planet")
  ));
  assert(missionPlanetMoveState, "Mission planet state was not available for radar verification");
  assert(missionRadarState, "Radar state was missing after moving near the mission planet");
  assert(missionRadarState.contacts.some((contact) => contact.kind === "mission-planet"),
    `Radar did not report the mission planet contact: ${JSON.stringify(missionRadarState.contacts)}`);
  assert(missionRadarState.contacts.every((contact) => contact.kind !== "planet"),
    `Radar should only show the mission-relevant world marker, not ordinary planets: ${JSON.stringify(missionRadarState.contacts)}`);

  const sweepBefore = localRadarState.radar.sweepAngleDeg;
  const sweepAfter = missionRadarState.sweepAngleDeg;
  assert(sweepBefore !== sweepAfter, `Radar sweep did not move between snapshots: ${sweepBefore} vs ${sweepAfter}`);

  const result = {
    url: URL,
    localRadarState,
    initialSpaceSeeds,
    asteroidMoveState,
    asteroidRadarState,
    enemyMoveState,
    enemyRadarState,
    guardMoveState,
    guardRadarState,
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
